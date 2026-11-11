// Static-Pages base economy: with no Node `/api`, the workshop must craft and
// upgrade through the in-page authoritative store, and the recipe notes must
// state owned salvage, credits and blockers before the player acts.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';

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
  await new Promise((ready, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ready);
  });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const guest = 'base_economy_' + Date.now().toString(36);
  const page = await harness.page('/raid-online.html?offline=1&guest=' + guest);
  await page.wait(BOOTED);

  // 1. Nothing outside the page answers: no Node API traffic in offline mode.
  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'the offline base economy makes no Node API calls',
  );
  assert.ok(await page.evaluate("!!document.getElementById('recipeNote-med')"), 'the workshop renders a readiness note per recipe');
  assert.match(
    await page.evaluate("document.getElementById('recipeNote-med').textContent"),
    /steel 0\/1 · chem 0\/1 · unavailable: missing 1 steel/,
    'an empty stash explains exactly what the medkit is missing',
  );

  // 2. Seed scavenged salvage into the authoritative stash (a fixture standing in
  //    for a completed raid's carried material loot), then reload so the shipped
  //    base UI renders it. Crafting, pricing and consumption below still run
  //    through MemoryRaidStore.trade, not client shortcuts.
  await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime();
    const state=rt.store.state(rt.account);
    state.items.push(
      {id:'grader-steel',kind:'material',material:'steel',quantity:4,condition:100},
      {id:'grader-wire',kind:'material',material:'wire',quantity:1,condition:100},
      {id:'grader-chem',kind:'material',material:'chem',quantity:1,condition:100},
    );
    rt.store.save(rt.account,state);
  })()`);
  await page.evaluate("window.__hszOfflineRaid.runtime().flush()");
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);
  assert.match(
    await page.evaluate("document.getElementById('recipeNote-med').textContent"),
    /steel 4\/1 · chem 1\/1 · ready to craft/,
    'the readiness note shows owned stock and credits for a craftable recipe',
  );

  // 3. Craft through the shipped workshop button.
  await page.evaluate("[...document.querySelectorAll('#workshop button')].find(b=>b.textContent.includes('Craft Field Medkit')).click()");
  await page.wait("document.body.getAttribute('aria-busy')==='false'");
  let profile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(profile.credits, 245, 'the recipe charged its authoritative credit cost');
  assert.equal(profile.items.filter(it => it.kind === 'med').length, 3, 'the crafted medkit joined the two starter medkits');
  assert.equal(profile.items.filter(it => it.kind === 'material' && it.material === 'steel').reduce((n, it) => n + it.quantity, 0), 3, 'one steel was consumed');
  assert.equal(profile.items.filter(it => it.kind === 'material' && it.material === 'chem').length, 0, 'the chem salvage was consumed');

  // 4. Upgrade the workbench through the shipped base control.
  await page.evaluate("[...document.querySelectorAll('#upgrades button')].find(b=>b.textContent.includes('bench 0/2')).click()");
  await page.wait("document.body.getAttribute('aria-busy')==='false'");
  profile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(profile.upgrades.bench, 1, 'the workbench tier advanced authoritatively');
  assert.equal(profile.credits, 145, 'the upgrade charged 100 credits');
  assert.equal(profile.items.filter(it => it.kind === 'material' && it.material === 'steel').reduce((n, it) => n + it.quantity, 0), 1, 'the upgrade consumed two steel');
  assert.equal(profile.items.filter(it => it.kind === 'material' && it.material === 'wire').length, 0, 'the upgrade consumed the wire');
  assert.match(
    await page.evaluate("document.getElementById('recipeNote-med').textContent"),
    /chem 0\/1 · unavailable: missing 1 chem/,
    'the readiness note refreshes from the authoritative stash after spending salvage',
  );

  // 5. Reload: crafted gear and the upgrade live in IndexedDB, not just the DOM.
  await page.evaluate("window.__hszOfflineRaid.runtime().flush()");
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);
  profile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(profile.credits, 145, 'credits survive the offline reload');
  assert.equal(profile.upgrades.bench, 1, 'the workbench upgrade survives the offline reload');
  assert.equal(profile.items.filter(it => it.kind === 'med').length, 3, 'the crafted medkit survives the offline reload');
  assert.equal(
    await page.evaluate("document.getElementById('identity').textContent.toLowerCase().includes('145 credits')"),
    true,
    'the identity line shows the persisted balance',
  );

  await writeFile('/tmp/raid-static-base-economy.png', Buffer.from((await page.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    offlineWorkshop: true,
    recipeReadiness: true,
    crafted: profile.items.filter(it => it.kind === 'med').length,
    credits: profile.credits,
    bench: profile.upgrades.bench,
    persisted: true,
    noApiTraffic: true,
    screenshot: '/tmp/raid-static-base-economy.png',
    browserErrors: [],
  }));
} finally {
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
  await harness.close();
  server.close();
}
