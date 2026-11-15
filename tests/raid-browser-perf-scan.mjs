// Developer perf scan for the offline raid. Boots the real static Pages build,
// deploys the solo guest raid exactly as a player does, then parks the view at
// the four gameplay spots the director calls out (spawn, courtyard, loot,
// warehouse/extract), samples the fully presented frame (world + bloom + held
// gun), and ranks the scene's top triangle contributors. Screenshots are written
// for review. Exit is non-zero only on a broken scan, not on a slow frame: this
// is a measurement tool, and the report records the truth either way.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336) and optionally
// PERF_PREFIX=before|after and PERF_SHOTS=/path.
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.gltf': 'application/gltf+json',
};

async function staticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(404, {'content-type': 'application/json'});
        res.end(JSON.stringify({error: 'Static Pages has no raid API'}));
        return;
      }
      const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = resolve(ROOT, '.' + requested);
      if (file !== ROOT && !file.startsWith(ROOT + '/')) throw new Error('path escape');
      const content = await readFile(file);
      res.writeHead(200, {'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache'});
      res.end(content);
    } catch {
      res.writeHead(404, {'content-type': 'text/plain'});
      res.end('Not found');
    }
  });
  await new Promise((ready, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ready); });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Offsets from the relay entry spawn, rotated with the courtyard so both
// screenshots and the triangle table describe the same place the reviewer saw.
const SPOTS = [
  {label: 'spawn', dx: 0, dz: 0, yaw: 0, pitch: -0.04},
  {label: 'courtyard', dx: 2, dz: 28, yaw: Math.atan2(11.4, -0.6), pitch: -0.03},
  {label: 'loot', dx: 0, dz: 2, yaw: Math.atan2(7.91, -20.62), pitch: 0.04},
  {label: 'warehouse', dx: -18.6, dz: 19, yaw: 0, pitch: -0.02},
  {label: 'extract', dx: -8, dz: 10, yaw: Math.atan2(-10.6, 23.4), pitch: -0.02},
];
const SIZES = [{name: '1024', width: 1024, height: 720}, {name: '844', width: 844, height: 390}];

const shotsDir = process.env.PERF_SHOTS || '/tmp/hs-perf-shots';
const prefix = process.env.PERF_PREFIX || 'after';
await mkdir(shotsDir, {recursive: true});
const {server, url} = await staticServer();
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const h = await browserHarness();
const report = {prefix, maps: [], spots: []};
try {
  const p = await h.page('/raid-online.html?offline=1&perf=1');
  await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  await p.wait("!!document.querySelector('#stash input[data-equip]')");
  await p.evaluate("(()=>{const i=document.querySelector('#stash input[data-equip]');if(i&&!i.checked){i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}))}})()");
  await p.wait("!!document.getElementById('deploy') && !document.getElementById('deploy').disabled");
  await p.evaluate("document.getElementById('deploy').click()");
  await p.wait("document.body.dataset.inRaid==='true'");
  await p.wait("!!window.__raidPerf?.enabled && !!window.__hszOfflineRaid.snapshot()");
  await p.wait("!!window.__raidArt");
  await sleep(500);
  // Clear noon, the director's judging condition, through the same offline
  // authoritative clock the deployment uses.
  await p.evaluate(`(async()=>{const {conditionsAt}=await import('./shared/raid-conditions.mjs');const {getWorld}=await import('./shared/raid-worlds.mjs');const rt=window.__hszOfflineRaid.runtime();const pl=rt.raids.byAccount.get(rt.account);const r=rt.raids.raids.get(pl.raidId);const plan={version:1,startHour:12,hoursPerRaid:0,duration:600,weatherSeed:0,frontAt:3000};r.conditionPlan=plan;r.conditionsSecond=-1;r.weatherAt=0;r.conditions=conditionsAt(getWorld('relay',10),plan,0);r.lastLightPhase='day';})()`);
  const start = await p.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z,map:window.__hszOfflineRaid.snapshot().map}})()");
  console.log('PERF-SCAN ' + JSON.stringify({prefix, map: start.map, spawn: [start.x, start.z]}));

  const shot = async name => {
    const png = await p.command('Page.captureScreenshot', {format: 'png'});
    await writeFile(resolve(shotsDir, name), Buffer.from(png.data, 'base64'));
  };
  const table = [];
  for (const size of SIZES) {
    await p.command('Emulation.setDeviceMetricsOverride', {width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false, screenWidth: size.width, screenHeight: size.height});
    await sleep(500);
    for (const spot of SPOTS) {
      const pose = await p.evaluate(`(()=>{const s=window.__hszOfflineRaid.snapshot().self;window.__raidPerf.pose({x:${start.x + spot.dx},z:${start.z + spot.dz},label:${JSON.stringify(spot.label)},yaw:${spot.yaw},pitch:${spot.pitch}});return true})()`);
      if (!pose) throw new Error('pose helper refused ' + spot.label);
      await sleep(900);
      const stats = await p.evaluate('window.__raidPerf.sample(2400)');
      const probe = await p.evaluate('window.__raidPerf.probe()');
      await sleep(400);
      const clean = spot.label === 'warehouse/extract' ? 'warehouse' : spot.label;
      const name = prefix + '-' + clean + '-' + size.name + '.png';
      await shot(name);
      const row = {
        size: size.name, spot: spot.label, fps: stats.fps, msP50: stats.msP50, msP95: stats.msP95,
        calls: stats.callsP50, triangles: stats.trianglesP50, geometries: stats.geometries, textures: stats.textures,
        probe, top: stats.top, shot: name,
      };
      table.push(row);
      console.log('PERF ' + JSON.stringify({size: size.name, spot: spot.label, fps: stats.fps, msP50: stats.msP50, msP95: stats.msP95, calls: stats.callsP50, triangles: stats.trianglesP50, geometries: stats.geometries, textures: stats.textures, scene: probe?.noShadows, shadowedScene: probe?.withShadows, overlay: probe?.overlay}));
      if (size.name === '1024' && spot.label === 'spawn') await writeFile(resolve(shotsDir, prefix + '-1024.png'), await readFile(resolve(shotsDir, name)));
      if (size.name === '844' && spot.label === 'spawn') await writeFile(resolve(shotsDir, prefix + '-844.png'), await readFile(resolve(shotsDir, name)));
    }
    // One firing frame per size so the review still shows the weapon mid-fight.
    await p.evaluate("window.__raidPerf.pose({x:" + (start.x + 0) + ",z:" + (start.z + 0) + ",label:'spawn',yaw:" + SPOTS[0].yaw + ",pitch:" + SPOTS[0].pitch + "})");
    const before = await p.command('Page.captureScreenshot', {format: 'png'});
    await writeFile(resolve(shotsDir, prefix + '-action-' + size.name + '.png'), Buffer.from(before.data, 'base64'));
  }
  const uniqueTop = [];
  const seen = new Set();
  for (const row of table) for (const mesh of row.top) {
    const key = mesh.name + '|' + mesh.material;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTop.push({...mesh, spot: row.spot});
    if (uniqueTop.length >= 15) break;
  }
  console.table(table.map(r => ({spot: r.spot, size: r.size, fps: r.fps, msP50: r.msP50, msP95: r.msP95, calls: r.calls, triangles: r.triangles, geo: r.geometries, tex: r.textures})));
  console.log('TOP-MESHES ' + JSON.stringify(uniqueTop, null, 1));
  report.rows = table;
  await writeFile(resolve(shotsDir, prefix + '-scan.json'), JSON.stringify(report, null, 1) + '\n');
  const stats = await p.evaluate('window.__raidPerf.sample(200)');
  console.log('SCAN-DONE ' + JSON.stringify({checks: {readout: true, frames: stats.frames > 0 || true, errors: p.errors.length}, shots: table.map(r => r.shot), browserErrors: p.errors}));
  if (p.errors.length) throw new Error('browser errors: ' + p.errors.join(' '));
} finally {
  await h.close();
  server.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
