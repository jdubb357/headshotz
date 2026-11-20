// Static-Pages offline base availability and salvage liquidation.
//
// GitHub Pages has no vendor/contract service, so the offline base must say so
// instead of rendering dead controls, and it must still offer an honest way to
// turn recovered salvage into credits. This grader serves the checkout as plain
// files (every /api/* is 404), boots the offline base, checks the notices and
// the absence of purchase/contract buttons, then seeds salvage and liquidates
// it through the shipped button. All money and item removal come from the
// in-page authoritative MemoryRaidStore, and no /api request is allowed.
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
  const guest = 'availability_' + Date.now().toString(36);
  const page = await harness.page('/raid-online.html?offline=1&guest=' + guest);
  await page.wait(BOOTED);

  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'the offline base makes no Node API calls',
  );

  // 1. Traders are explicitly online-only and expose no purchase controls.
  const trader = await page.evaluate(`(()=>{
    const section=document.querySelector('#trader [data-offline-notice=traders]');
    if(!section)return null;
    return {
      text:section.textContent,
      buyButtons:[...section.querySelectorAll('button')].filter(b=>/^Buy /.test(b.textContent)).length,
      sale:!!section.querySelector('button[data-salvage-sale]'),
      saleDisabled:!!section.querySelector('button[data-salvage-sale]')?.disabled,
      stock:section.querySelector('[data-salvage-stock]')?.textContent||'',
    };
  })()`);
  assert.ok(trader, 'offline Traders renders a named availability section');
  assert.match(trader.text, /online-only/i, 'the Traders section says vendor stock is online-only');
  assert.match(trader.text, /craft/i, 'the Traders section points to local crafting');
  assert.equal(trader.buyButtons, 0, 'offline Traders has no purchase buttons');
  assert.equal(trader.sale, true, 'offline Traders offers a salvage liquidation button');
  assert.equal(trader.saleDisabled, true, 'liquidation stays disabled with an empty stash');
  assert.match(trader.stock, /No sellable recovery salvage/i, 'the empty stash is explained, not blank');

  // 2. Contracts never render the 501 action buttons offline, but each contract
  //    still explains why its stages are unavailable.
  const contracts = await page.evaluate(`(()=>{
    const sections=[...document.querySelectorAll('#contracts section')];
    return {
      count:sections.length,
      notices:sections.filter(s=>s.dataset.offlineNotice==='contracts').length,
      actions:sections.flatMap(s=>[...s.querySelectorAll('button')]).filter(b=>/^(Accept contract|Deliver |Claim stage reward)/.test(b.textContent)).length,
      copy:sections.map(s=>[...s.querySelectorAll('p')].map(p=>p.textContent).join(' ')).join(' '),
    };
  })()`);
  assert.equal(contracts.count, 8, 'all authored contracts are listed offline');
  assert.equal(contracts.notices, 8, 'every contract section carries the offline notice');
  assert.equal(contracts.actions, 0, 'offline contracts render no accept/deliver/claim buttons');
  assert.match(contracts.copy, /Online only/i, 'the contract notice says stages need the hosted service');

  // 3. Seed recoverable salvage (a fixture standing in for carried raid loot),
  //    including a favorited material that must stay out of the quick sale.
  await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime();
    const state=rt.store.state(rt.account);
    state.items.push(
      {id:'grader-steel-sale',kind:'material',material:'steel',quantity:4,condition:100},
      {id:'grader-valuable-sale',kind:'valuable',label:'Purifier cartridge',value:17,quantity:1,rarity:2},
      {id:'grader-favorite-wire',kind:'material',material:'wire',quantity:2,condition:100,favorite:true},
    );
    rt.store.save(rt.account,state);
  })()`);
  await page.evaluate("window.__hszOfflineRaid.runtime().flush().then(()=>0)");
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);

  const seeded = await page.evaluate(`(()=>{
    const section=document.querySelector('#trader [data-offline-notice=traders]');
    return {
      stock:section.querySelector('[data-salvage-stock]').textContent,
      sale:section.querySelector('button[data-salvage-sale]').textContent,
      disabled:section.querySelector('button[data-salvage-sale]').disabled,
    };
  })()`);
  assert.match(seeded.stock, /steel ×4/, 'the exchange lists recovered steel');
  assert.match(seeded.stock, /Purifier cartridge ×1/, 'the exchange lists recovered valuables');
  assert.ok(!/wire ×/.test(seeded.stock), 'favorited salvage is excluded from the quick sale');
  assert.match(seeded.stock, /25 credits at base sale price/, 'the total uses authoritative sale values (4×2 + 17)');
  assert.match(seeded.sale, /Sell all recovery salvage · 25 credits/, 'the action names the authoritative total');
  assert.equal(seeded.disabled, false, 'the action becomes available with sellable salvage');

  // 4. Liquidation runs through the shipped button and the authoritative store.
  await page.evaluate("window.confirm=()=>true");
  await page.evaluate("document.querySelector('#trader button[data-salvage-sale]').click()");
  await page.wait("document.querySelector('#trader button[data-salvage-sale]')?.disabled===true && document.body.getAttribute('aria-busy')==='false'");
  const profile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(profile.credits, 275, 'credits rose by the authoritative base sale value');
  assert.equal(profile.items.some(it => it.id === 'grader-steel-sale'), false, 'sold steel left the stash');
  assert.equal(profile.items.some(it => it.id === 'grader-valuable-sale'), false, 'sold valuable left the stash');
  assert.equal(profile.items.some(it => it.id === 'grader-favorite-wire' && it.favorite), true, 'favorited wire stayed in the stash');
  const after = await page.evaluate("[...document.querySelectorAll('#trader [data-salvage-sale]')][0].disabled");
  assert.equal(after, true, 'the action disables again once no sellable salvage remains');

  // 5. The credit change and removals survive an offline reload.
  await page.evaluate("window.__hszOfflineRaid.runtime().flush().then(()=>0)");
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);
  const persisted = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(persisted.credits, 275, 'sale credits survive the offline reload');
  assert.equal(persisted.items.some(it => it.id.startsWith('grader-') && it.id !== 'grader-favorite-wire'), false, 'sold items stay gone after reload');
  assert.match(await page.evaluate("document.getElementById('identity').textContent"), /275 credits/, 'the identity line shows the persisted balance');

  await page.evaluate("document.getElementById('trader').scrollIntoView({block:'center'})");
  await page.wait("document.getElementById('trader').getBoundingClientRect().top>=0");
  await writeFile('/tmp/hs-offline-availability.png', Buffer.from((await page.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    offlineTradersNotice: true,
    offlineContractNotice: true,
    deadContractButtons: contracts.actions,
    salvageListed: seeded.stock,
    saleTotal: 25,
    creditsAfterSale: profile.credits,
    persisted: persisted.credits,
    noApiTraffic: true,
    screenshot: '/tmp/hs-offline-availability.png',
    browserErrors: [],
  }));
} finally {
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
  await harness.close();
  server.close();
}
