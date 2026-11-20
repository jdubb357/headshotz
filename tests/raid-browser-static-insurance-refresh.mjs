// Static-Pages offline insurance refresh: after a death settlement the base
// shows authoritative pending claims, and once the in-page RaidService tick
// makes a claim eligible the Insurance card re-renders the returned/destroyed
// status without a page reload. The authority is the MemoryRaidStore's
// processInsurance — no client timer invents outcomes.
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

async function insuranceShot(page, path) {
  await page.evaluate("document.getElementById('insurance').closest('section').scrollIntoView({block:'center'})");
  await new Promise(r => setTimeout(r, 150));
  const png = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(png.data, 'base64'));
  return path;
}

const BOOTED = "document.body.dataset.raidTransport==='offline' && !document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'";

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=insurance_' + Date.now().toString(36));
  await page.wait(BOOTED);
  await page.evaluate("window.__hszInsuranceProbe='no-reload'");
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'offline boot makes no Node API calls');

  // Select the starter weapon and its insurance in the shipped stash, then deploy.
  const selected = await page.evaluate(`(()=>{
    const equip=document.querySelector('#stash input[data-equip]');
    equip.checked=true;equip.dispatchEvent(new Event('change',{bubbles:true}));
    const insure=document.querySelector('#stash input[data-insure]');
    if(insure){insure.checked=true;insure.dispatchEvent(new Event('change',{bubbles:true}))}
    return {weaponId:equip.value,insured:!!insure};
  })()`);
  assert.equal(selected.insured, true, 'the starter weapon exposes an insurance checkbox offline');
  await page.wait("(()=>{const line=document.getElementById('deployReadiness');return !!line&&!line.hidden&&line.dataset.ready==='true'})()");
  const creditsBefore = await page.evaluate("window.__hszOfflineRaid.api('profile').then(p=>p.credits)");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && !!window.__hszOfflineRaid.snapshot()");
  await page.command('Page.bringToFront');

  const deploymentId = await page.evaluate("window.__hszOfflineRaid.snapshot().self.deploymentId");
  assert.ok(deploymentId, 'the offline deployment committed');
  const premium = await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime();return rt.store.deployments.get(${JSON.stringify(deploymentId)}).state.premium})()`);
  assert.ok(premium > 0, 'the authoritative insurance premium was charged');

  // Settle an authoritative death through the same store contract RaidService
  // uses; insured gear is lost and the claim becomes pending.
  await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime();rt.store.settle(${JSON.stringify(deploymentId)},{outcome:'death',credits:0,facts:{},lostItems:[]})})()`);
  await page.evaluate("document.getElementById('leave').click()");
  await page.wait(BOOTED);
  await page.wait("(()=>{const t=document.getElementById('insurance').textContent.toLowerCase();return t.includes('pending')&&t.includes('eligible after')})()");

  const afterDeath = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(afterDeath.credits, creditsBefore - premium, 'the premium was debited from the starting balance');
  assert.equal(afterDeath.activeDeployment, null, 'the settlement cleared the active deployment');
  assert.equal(afterDeath.items.some(it => it.id === selected.weaponId), false, 'the insured weapon left the stash on death');
  const pendingClaims = afterDeath.insurance.filter(c => c.status === 'pending').length;
  assert.ok(pendingClaims >= 1, 'the settled profile carries a pending insurance claim');
  const pendingText = await page.evaluate("[...document.querySelectorAll('#insurance p')].map(p=>p.textContent).join(' · ')");
  assert.match(pendingText, /pending/i, 'the card reflects the authoritative pending claim');
  const pendingShot = await insuranceShot(page, '/tmp/hs-insurance-pending.png');

  // Advance only the authoritative eligibility clock (no UI shortcut): mark the
  // pending claim due and force the next in-page tick to run processInsurance.
  const claims = await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime();const pending=[];for(const claim of rt.store.insurance.values())if(claim.account===rt.account&&claim.status==='pending'){claim.due=Date.now()-1;pending.push(claim.item)}rt.raids.insuranceAt=0;return pending})()`);
  assert.ok(claims.length >= 1, 'a pending claim was made eligible');
  const insuredItem = claims[0];

  // The poll must re-render on the authoritative change; the marker proves the
  // base updated in place instead of reloading.
  await page.wait("(()=>{const t=document.getElementById('insurance').textContent.toLowerCase();return t.includes('returned')&&!t.includes('eligible after')})()");
  assert.equal(await page.evaluate("window.__hszInsuranceProbe"), 'no-reload', 'the base updated without reloading the page');
  assert.equal(await page.evaluate(`window.__hszOfflineRaid.api('profile').then(p=>p.insurance.find(c=>c.item===${JSON.stringify(insuredItem)})?.status)`), 'returned', 'the authoritative claim resolved to returned');
  assert.equal(await page.evaluate(`window.__hszOfflineRaid.api('profile').then(p=>p.items.some(it=>it.id===${JSON.stringify(insuredItem)}))`), true, 'the returned insured gear is banked in the stash');
  const returnedText = await page.evaluate("[...document.querySelectorAll('#insurance p')].map(p=>p.textContent).join(' · ')");
  assert.match(returnedText, /returned/i, 'the card reflects the resolved claim');
  const returnedShot = await insuranceShot(page, '/tmp/hs-insurance-returned.png');

  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'insurance refresh makes no Node API calls');
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    offline: true,
    insured: true,
    premium,
    pendingClaims,
    pendingText,
    resolved: 'returned',
    returnedText,
    returnedToStash: true,
    noReload: true,
    apiRequests: [],
    screenshots: [pendingShot, returnedShot],
    browserErrors: [],
  }));
} finally {
  process.env.RAID_TEST_URL = previous;
  harness.close().finally(() => server.close());
  await new Promise(r => setTimeout(r, 200));
  server.close();
}
