// Base lobby grader. Serves the game as plain static files (no Node /api) and
// checks the between-raid base is a single hero DEPLOY screen with one tab
// panel visible at a time, no page scrolling on 1024x720, usable touch targets
// at 844x390, and that offline mode hides account, squad, comms and latency.
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
  await new Promise((ready, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ready);
  });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async (p, path) => writeFile(path, Buffer.from((await p.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
const size = async (p, width, height, mobile) => {
  await p.command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
  await p.command('Emulation.setTouchEmulationEnabled', {enabled: mobile, maxTouchPoints: 5});
  await sleep(250);
};
const visible = `(el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)`;

const {server, url} = await staticServer();
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=base-lobby');
  await page.wait('document.body.dataset.raidTransport===\'offline\'');
  await page.wait('!document.getElementById(\'base\').hidden && document.body.getAttribute(\'aria-busy\')===\'false\'');
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'no Node API traffic');

  for (const [label, width, height] of [['1024x720', 1024, 720], ['844x390', 844, 390]]) {
    await size(page, width, height, true);

    // The base must fit the viewport without scrolling the page itself: long
    // tab panels scroll inside their own region.
    assert.equal(await page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1'), true, label + ' page does not scroll');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, label + ' page does not scroll sideways');
    assert.equal(await page.evaluate("getComputedStyle(document.body).overflowY"), 'hidden', label + ' lobby locks page scrolling');

    // Hero deploy button is the one obvious action.
    const deploy = await page.evaluate(`(() => { const el = document.getElementById('deploy'); const r = el.getBoundingClientRect(); return {visible: ${visible}(el), w: r.width, h: r.height, text: el.textContent.trim(), card: !!document.getElementById('deployCard').getClientRects().length}; })()`);
    assert.equal(deploy.visible, true, label + ' DEPLOY stays visible');
    assert.equal(deploy.card, true, label + ' hero deploy card stays visible');
    assert.ok(deploy.h >= 42 && deploy.w >= 110, label + ' DEPLOY is a big target: ' + deploy.w + 'x' + deploy.h);
    assert.match(deploy.text, /deploy/i, label + ' hero action is labelled Deploy');

    // One tab at a time: exactly the active tab's cards paint.
    const tabs = await page.evaluate("[...document.querySelectorAll('#baseTabs [role=tab]')].filter(t=>!t.hidden).map(t=>t.dataset.baseTab)");
    assert.deepEqual(tabs, ['loadout', 'traders', 'workshop', 'contracts', 'records', 'sector'], label + ' offline tab set has no squad');
    for (const tab of tabs) {
      await page.evaluate(`(() => { const t = document.querySelector('#baseTabs [data-base-tab="${tab}"]'); t.click(); })()`);
      await sleep(60);
      const state = await page.evaluate(`(() => {
        const cards = [...document.querySelectorAll('#basePanels > .card')];
        const shown = cards.filter(el => !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0);
        return {tabs: shown.map(el => el.dataset.panel), active: document.getElementById('base').dataset.baseTab, selected: [...document.querySelectorAll('#baseTabs [role=tab][aria-selected=true]')].map(t=>t.dataset.baseTab)};
      })()`);
      assert.equal(state.active, tab, label + ' base switches to ' + tab);
      assert.deepEqual(state.selected, [tab], label + ' only the ' + tab + ' tab is selected');
      assert.ok(state.tabs.length > 0 && state.tabs.every(name => name === tab), label + ' only ' + tab + ' panels are visible: ' + state.tabs.join(','));
    }
    await page.evaluate("document.querySelector('#baseTabs [data-base-tab=loadout]').click()");
    await page.evaluate("document.getElementById('deploy').focus()");
    await shot(page, '/tmp/hs-base-lobby-' + label + '.png');
  }

  // Offline hides online-only account/security, squad, comms and latency copy.
  for (const id of ['accountOpen', 'tabSquad', 'connectionControls', 'commsToggle', 'communications', 'networkStatus']) {
    assert.equal(await page.evaluate(`(${visible})(document.getElementById('${id}'))`), false, 'offline hides #' + id);
  }
  assert.equal(await page.evaluate(`(${visible})(document.getElementById('login'))`), false, 'offline shows no username/password form');
  assert.equal(await page.evaluate("[...document.querySelectorAll('#basePanels button, #basePanels a')].filter(el=>/password|recovery code|session/i.test(el.textContent)).length"), 0, 'offline base has no account-security actions');
  const baseText = await page.evaluate("document.getElementById('base').innerText");
  assert.equal(/username|password|squad communication|signed in|latency|round trip/i.test(baseText), false, 'offline base copy has no account or network jargon: ' + baseText.slice(0, 400));

  // The first-raid guide is a one-line dismissible tip, not a panel.
  await page.evaluate("localStorage.removeItem('headshotz.raid.settings.v1')");
  await page.command('Page.reload');
  await page.wait('!document.getElementById(\'base\').hidden && document.body.getAttribute(\'aria-busy\')===\'false\'');
  await size(page, 1024, 720, true);
  const tip = await page.evaluate(`(() => { const el = document.getElementById('welcome'); const s = getComputedStyle(el), span = el.querySelector('span'); return {visible: ${visible}(el), height: el.getBoundingClientRect().height, spanHeight: span.getBoundingClientRect().height, fontSize: parseFloat(s.fontSize)}; })()`);
  assert.equal(tip.visible, true, 'first-raid tip is visible for a fresh operator');
  assert.ok(tip.height <= 60, 'first-raid tip stays a slim strip: ' + tip.height + 'px');
  assert.ok(tip.spanHeight <= tip.fontSize * 2, 'first-raid tip copy is one line: ' + tip.spanHeight + 'px');
  await page.evaluate("document.getElementById('dismissWelcome').click()");
  await page.wait("document.getElementById('welcome').hidden");
  assert.equal(await page.evaluate(`(${visible})(document.getElementById('welcome'))`), false, 'first-raid tip dismisses');

  // No jargon anywhere in visible base text.
  const text = await page.evaluate("document.body.innerText");
  assert.equal(/persistent extraction|server-owned|authoritative|settlement reconciliation|protected overflow|appraisal|vitality|field-objective deploy plan/i.test(text), false, 'base copy stays player-facing: ' + text.slice(0, 400));
  console.log('base lobby grader passed');
} finally {
  await harness.close();
  server.close();
}
