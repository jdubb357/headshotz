// Static-Pages base stash inventory readability: each row carries a
// presentation-only rarity gem in the shared loot palette plus one appraisal
// line whose weight and sale value come straight from the authoritative
// itemWeight/sellValue helpers. Rules, selection, insurance, buy/sell and
// persistence are untouched, and no Node `/api` is contacted.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {itemWeight} from '../shared/raid-catalog.mjs';
import {sellValue} from '../shared/raid-appraisal.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};
const BOOTED = "document.body.dataset.raidTransport==='offline' && !document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'";

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

const sample = {
  rare: {kind: 'weapon', weapon: 'smg', condition: 80, rarity: 3, loaded: 20},
  epic: {kind: 'valuable', label: 'Prototype capacitor', value: 90, rarity: 4},
  common: {kind: 'material', material: 'steel', quantity: 3, rarity: 0},
};
const palette = ['rgb(148, 166, 174)', 'rgb(114, 226, 176)', 'rgb(99, 217, 242)', 'rgb(199, 144, 255)', 'rgb(255, 180, 74)', 'rgb(255, 100, 95)'];

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=rarity_' + Date.now().toString(36));
  await page.wait(BOOTED);
  await page.wait("document.querySelectorAll('#stash .item').length>0");
  await page.command('Emulation.setDeviceMetricsOverride', {width: 900, height: 900, deviceScaleFactor: 1, mobile: false});

  // Seed three authoritative items through the same store transaction/save the
  // base uses, flush, then reload so the rows come from the persisted snapshot.
  const seeded = await page.evaluate(`(async()=>{
    const rt=window.__hszOfflineRaid.runtime();
    const {item}=await import('/shared/raid-rules.mjs');
    const rare=item(${JSON.stringify(sample.rare.kind)},{weapon:${JSON.stringify(sample.rare.weapon)},condition:${sample.rare.condition},rarity:${sample.rare.rarity},loaded:${sample.rare.loaded}});
    const epic=item(${JSON.stringify(sample.epic.kind)},{label:${JSON.stringify(sample.epic.label)},value:${sample.epic.value},rarity:${sample.epic.rarity}});
    const common=item(${JSON.stringify(sample.common.kind)},{material:${JSON.stringify(sample.common.material)},quantity:${sample.common.quantity},rarity:${sample.common.rarity}});
    rt.store.transaction(()=>{const state=rt.store.state(rt.account);state.items.push(rare,epic,common);rt.store.save(rt.account,state)});
    await rt.store.flushNow();
    return {rare:rare.id,epic:epic.id,common:common.id};
  })()`);
  await page.command('Page.reload');
  await page.wait(BOOTED);
  await page.wait("document.querySelectorAll('#stash .item').length>=7");
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'the stash probe makes no Node API calls');

  const rows = await page.evaluate(`(()=>{
    const out={};
    for(const [key,id] of Object.entries(${JSON.stringify(seeded)})){
      const row=[...document.querySelectorAll('#stash .item')].find(r=>r.dataset.itemId===id);
      if(!row){out[key]=null;continue}
      const gem=row.querySelector('.rarityGem'),facts=row.querySelector('.stashFacts'),style=gem?getComputedStyle(gem):null;
      out[key]={rarity:row.dataset.rarity,gem:gem?{rarity:gem.dataset.rarity,hidden:gem.getAttribute('aria-hidden'),background:style.backgroundColor,shadow:style.boxShadow,transform:style.transform,w:gem.offsetWidth,h:gem.offsetHeight}:null,facts:facts?.textContent||null,controls:row.querySelectorAll('button').length};
    }
    return {rows:document.querySelectorAll('#stash .item').length,gems:document.querySelectorAll('#stash .rarityGem').length,facts:document.querySelectorAll('#stash .stashFacts').length,...out};
  })()`);

  for (const [key,spec] of Object.entries(sample)) {
    const row = rows[key];
    assert.ok(row, key + ' seeded item rendered in the stash');
    assert.equal(row.rarity, String(spec.rarity), key + ' row exposes its authoritative rarity');
    assert.deepEqual(row.gem, {rarity: String(spec.rarity), hidden: 'true', background: palette[spec.rarity], shadow: row.gem.shadow, transform: 'matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)', w: 10, h: 10}, key + ' rarity gem uses the shared palette and is decorative');
    assert.ok(row.gem.shadow && row.gem.shadow !== 'none', key + ' rarity gem has a readable edge/glow');
    assert.equal(row.facts, itemWeight(spec).toFixed(1) + ' kg · ' + sellValue(spec) + ' cr', key + ' facts mirror itemWeight/sellValue exactly');
    assert.ok(row.controls >= 2, key + ' row keeps all action controls');
  }
  assert.equal(rows.gems, rows.rows, 'every stash row carries exactly one rarity gem');
  assert.equal(rows.facts, rows.rows, 'every stash row carries exactly one appraisal line');

  await page.evaluate(`document.querySelector(${JSON.stringify('#stash [data-item-id="' + seeded.rare + '"]')}).scrollIntoView({block:'center'})`);
  await new Promise(r => setTimeout(r, 250));
  const after = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile('/tmp/hs-stash-rarity.png', Buffer.from(after.data, 'base64'));
  // Comparison shot without the two presentation layers, so the visual delta
  // is inspectable side by side with the feature shot.
  await page.evaluate("for(const el of document.querySelectorAll('#stash .rarityGem,#stash .stashFacts'))el.style.display='none'");
  await new Promise(r => setTimeout(r, 150));
  const before = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile('/tmp/hs-stash-rarity-before.png', Buffer.from(before.data, 'base64'));
  await page.evaluate("for(const el of document.querySelectorAll('#stash .rarityGem,#stash .stashFacts'))el.style.display=''");

  assert.deepEqual(page.errors, [], 'no browser errors');
  console.log(JSON.stringify({
    rarityRows: rows.rows, gems: rows.gems, facts: rows.facts, accentPalette: palette,
    rare: {rarity: rows.rare.rarity, facts: rows.rare.facts},
    epic: {rarity: rows.epic.rarity, facts: rows.epic.facts},
    common: {rarity: rows.common.rarity, facts: rows.common.facts},
    noApiTraffic: true, browserErrors: [],
    screenshots: ['/tmp/hs-stash-rarity-before.png', '/tmp/hs-stash-rarity.png'],
    scope: 'Presentation-only stash appraisal/rarity styling; no rules or persistence changed.'
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
