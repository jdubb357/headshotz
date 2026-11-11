// Static-Pages offline raid records: the base "Raid records" card opens with an
// honest empty state, then aggregates the authoritative settled results (outcome,
// raid rewards, XP, machine kills) and updates in place after each settlement.
// Every figure comes from the same `results` rows the detail list renders; no
// client rule or invented reward is involved.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {careerSummary,careerText} from '../shared/raid-report.mjs';

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

async function recordsShot(page, path) {
  await page.evaluate("document.getElementById('records').closest('section').scrollIntoView({block:'center'})");
  await new Promise(r => setTimeout(r, 150));
  const png = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(png.data, 'base64'));
  return path;
}

async function summary(page) {
  return page.evaluate("(()=>{const el=document.getElementById('recordsSummary');return el?{text:el.textContent,empty:el.dataset.empty||null}:null})()");
}

// Settle through the same authoritative RaidService rules combat uses: the
// machine damage path and the extraction path, not a client shortcut or a
// direct store call that would leave the service believing the operator is
// still deployed.
async function settleDeath(page) {
  return page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(),p=rt.raids.byAccount.get(rt.account),r=rt.raids.raids.get(p.raidId);
    p.protectedUntil=0;
    rt.raids.damage(r,p,9999,{source:'machine'});
    return {alive:p.alive,outcome:p.result?.outcome,items:p.result?.items?.length,lost:p.result?.lostItems?.length,credits:p.result?.credits,xp:p.result?.xp};
  })()`);
}
async function settleExtract(page) {
  return page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(),p=rt.raids.byAccount.get(rt.account),r=rt.raids.raids.get(p.raidId);
    rt.raids.end(r,p,'extract',null,null);
    return {alive:p.alive,extracted:p.extracted,outcome:p.result?.outcome,items:p.result?.items?.length,lost:p.result?.lostItems?.length,credits:p.result?.credits,xp:p.result?.xp};
  })()`);
}

async function toBase(page) {
  await page.evaluate("document.getElementById('leave').click()");
  await page.wait(BOOTED);
}

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=records_' + Date.now().toString(36));
  await page.wait(BOOTED);
  await page.wait("!!document.getElementById('recordsSummary')");
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'offline boot makes no Node API calls');

  // ---- 1. A fresh operator sees an honest empty record state. ----
  const initial = await summary(page);
  assert.equal(initial.text, 'No raids recorded yet. Settled deployments appear here with returned, lost and insured items. Deploy to begin.');
  assert.equal(initial.empty, 'true', 'the aggregate is marked as empty for styling');

  // ---- 2. A settled death is counted from the authoritative result. ----
  await page.evaluate("window.__hszRecordsProbe='no-reload'");
  const selected = await page.evaluate(`(()=>{
    const equip=document.querySelector('#stash input[data-equip]');
    equip.checked=true;equip.dispatchEvent(new Event('change',{bubbles:true}));
    return equip.value;
  })()`);
  assert.ok(selected, 'the starter weapon is equippable offline');
  await page.wait("(()=>{const line=document.getElementById('deployReadiness');return !!line&&!line.hidden&&line.dataset.ready==='true'})()");
  await page.wait("document.body.getAttribute('aria-busy')!=='true'");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && !!window.__hszOfflineRaid.snapshot()");
  await page.command('Page.bringToFront');
  const firstDeployment = await page.evaluate("window.__hszOfflineRaid.snapshot().self.deploymentId");
  assert.ok(firstDeployment);
  const death = await settleDeath(page);
  assert.equal(death.alive, false, 'authoritative machine damage eliminated the operator');
  assert.equal(death.outcome, 'death');
  await toBase(page);
  await page.wait("(()=>!!document.getElementById('recordsSummary'))()");
  const resultsAfterDeath = await page.evaluate("window.__hszOfflineRaid.api('results')");
  assert.equal(resultsAfterDeath.length, 1, 'one authoritative result was recorded');
  assert.equal(resultsAfterDeath[0].outcome, 'death');
  const deathSummary = await summary(page);
  assert.equal(deathSummary.text, careerText(resultsAfterDeath), 'the card matches the authoritative results one-for-one');
  assert.match(deathSummary.text, /^1 recorded deployment · 0 extractions · 1 ended without extraction/);
  assert.equal(await page.evaluate("window.__hszRecordsProbe"), 'no-reload', 'the card updated without reloading the page');
  const pendingShot = await recordsShot(page, '/tmp/hs-records-summary.png');

  // ---- 3. A recovery-kit extraction adds a second record in place. ----
  await page.evaluate("window.__hszRecordsProbe='no-reload-2'");
  await page.evaluate(`(()=>{
    const recovery=document.getElementById('recovery');
    recovery.checked=true;recovery.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await page.wait("(()=>{const line=document.getElementById('deployReadiness');return !!line&&!line.hidden&&line.dataset.ready==='true'&&/Recovery kit ready/.test(line.textContent)})()");
  await page.wait("document.body.getAttribute('aria-busy')!=='true'");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && !!window.__hszOfflineRaid.snapshot()");
  await page.command('Page.bringToFront');
  const secondDeployment = await page.evaluate("window.__hszOfflineRaid.snapshot().self.deploymentId");
  assert.ok(secondDeployment && secondDeployment !== firstDeployment);
  const extraction = await settleExtract(page);
  assert.equal(extraction.outcome, 'extract', 'the authoritative extraction settled');
  assert.equal(extraction.extracted, true, 'the settled operator is marked as extracted');
  assert.equal(extraction.items, 0, 'recovery-kit items are not banked');
  await toBase(page);
  await page.wait("(()=>{const t=document.getElementById('recordsSummary')?.textContent||'';return /^2 recorded deployments/.test(t)})()");
  const resultsAfterExtract = await page.evaluate("window.__hszOfflineRaid.api('results')");
  assert.equal(resultsAfterExtract.length, 2);
  assert.equal(resultsAfterExtract.filter(r => r.outcome === 'extract').length, 1);
  const finalSummary = await summary(page);
  assert.equal(finalSummary.text, careerText(resultsAfterExtract), 'the aggregate matches the authoritative results');
  const totals = careerSummary(resultsAfterExtract);
  assert.equal(totals.raids, 2);
  assert.equal(totals.extractions, 1);
  assert.equal(totals.losses, 1);
  assert.match(finalSummary.text, /^2 recorded deployments · 1 extraction · 1 ended without extraction · \+/);
  assert.ok(finalSummary.text.includes(`+${totals.credits} credits from raid rewards`));
  assert.ok(finalSummary.text.includes(`+${totals.xp} XP`));
  assert.equal(await page.evaluate("window.__hszRecordsProbe"), 'no-reload-2', 'the second settlement updated the card in place');
  const finalShot = await recordsShot(page, '/tmp/hs-records-summary-extracted.png');

  // ---- 4. Both settled records and the aggregate survive a full reload. ----
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);
  await page.wait("(()=>!!document.getElementById('recordsSummary'))()");
  const reloaded = await summary(page);
  const reloadedResults = await page.evaluate("window.__hszOfflineRaid.api('results')");
  assert.equal(reloadedResults.length, 2, 'the settled results were restored from the local store');
  assert.equal(reloaded.text, careerText(reloadedResults), 'the reloaded aggregate matches the restored authoritative records');
  assert.equal(reloaded.text, finalSummary.text, 'the reloaded aggregate is unchanged');
  assert.equal(await page.evaluate("document.getElementById('records').querySelectorAll('details').length"), 2, 'both settled detail rows were restored');

  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'no Node API calls were made');
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    offline: true,
    emptyState: true,
    recordsAfterDeath: resultsAfterDeath.length,
    recordsAfterExtract: resultsAfterExtract.length,
    extractions: resultsAfterExtract.filter(r => r.outcome === 'extract').length,
    summary: finalSummary.text,
    persistedAcrossReload: true,
    noReload: true,
    apiRequests: [],
    screenshots: [pendingShot, finalShot],
    browserErrors: [],
  }));
} finally {
  process.env.RAID_TEST_URL = previous;
  harness.close().finally(() => server.close());
  await new Promise(r => setTimeout(r, 200));
  server.close();
}
