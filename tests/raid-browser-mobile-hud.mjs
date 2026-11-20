// Mobile/touch HUD declutter grader. Serves the game as plain static files (no
// Node /api), deploys an offline solo raid, and checks that the compact touch
// layout leaves at least 75% of a 1024x720 and an 844x390 landscape viewport
// unobstructed by HUD surfaces. Also exercises the live touch controls:
// crosshair auto-fire for every weapon class, automatic reload when the
// magazine empties, hold-to-zoom Aim, Swap and contextual USE. Saves
// screenshots and asserts the retired Fire/Sprint buttons stay gone.
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

// Fraction of the viewport covered by the union of visible HUD surfaces. Uses a
// coordinate-compressed union so overlapping panels are counted once.
const measure = p => p.evaluate(`(() => {
  const selectors = ['#hudSlim', '#hudStatus', '#telemetry', '#minimap', '#packToggle', '#pack',
    '#hint', '#leave', '#globalTools', '#spectate', '#bossPanel', '#networkStatus', '#commsToggle',
    '#stickBase', '#raidMenu', '#raidMenuPanel', '#cross', '#lootCelebration', '#hurt', '#threats', '#interactionStatus'];
  const rects = [];
  const detail = [];
  const add = (rect, name) => {
    const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
    if (right > left && bottom > top) { rects.push({left, top, right, bottom}); detail.push({name, w: Math.round(right - left), h: Math.round(bottom - top), x: Math.round(left), y: Math.round(top)}); }
  };
  for (const selector of selectors) {
    const follow = selector === '#hurt' || selector === '#threats';
    const nodes = follow ? [...document.querySelectorAll(selector + ' > *')] : [document.querySelector(selector)];
    for (const el of nodes) {
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.15) continue;
      add(el.getBoundingClientRect(), selector);
    }
  }
  for (const el of document.querySelectorAll('#touch button')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    add(el.getBoundingClientRect(), 'touch:' + (el.id || el.dataset.move || el.dataset.look || el.textContent));
  }
  const xs = [...new Set(rects.flatMap(r => [r.left, r.right]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap(r => [r.top, r.bottom]))].sort((a, b) => a - b);
  let covered = 0;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (rects.some(r => r.left <= cx && cx <= r.right && r.top <= cy && cy <= r.bottom)) covered += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
  }
  const viewport = innerWidth * innerHeight;
  return {width: innerWidth, height: innerHeight, covered, viewport, fraction: covered / viewport, unobstructed: 1 - covered / viewport, rects: rects.length, detail};
})()`);

const size = async (p, width, height, mobile) => {
  await p.command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
  await p.command('Emulation.setTouchEmulationEnabled', {enabled: mobile, maxTouchPoints: 5});
  await sleep(350);
};

const touchPoint = async (p, id) => {
  const rect = await p.evaluate(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  return rect;
};
const tap = async (p, id) => {
  const pt = await touchPoint(p, id);
  await p.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: pt.x, y: pt.y, id: 1}]});
  await p.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
};

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=mobile-hud');
  await page.wait('document.body.dataset.raidTransport===\'offline\'');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"), [], 'no Node API traffic');

  // Offline boot must never paint the online account form (it briefly showed a
  // username/password prompt while the local store hydrates). Reload with an
  // instrumented document-start observer to prove the password field is never
  // visible at any point between parse and the guest base resolving.
  await page.command('Page.addScriptToEvaluateOnNewDocument', {source: `
    window.__hsAuthPaint = false;
    const scanAuth = () => {
      try {
        const auth = document.getElementById('auth');
        if (!auth) return;
        const pw = document.querySelector('#login [name=password]');
        const show = !auth.hidden && getComputedStyle(auth).display !== 'none';
        if (show && pw && pw.getClientRects().length > 0 && getComputedStyle(pw).visibility !== 'hidden') window.__hsAuthPaint = true;
      } catch {}
    };
    const authTimer = setInterval(scanAuth, 20);
    addEventListener('load', () => { scanAuth(); clearInterval(authTimer); }, {once: true});
    document.addEventListener('DOMContentLoaded', scanAuth);
  `});
  await page.command('Page.reload');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  assert.equal(await page.evaluate("document.getElementById('auth').hidden"), true, 'offline boot keeps the account form hidden');
  assert.equal(await page.evaluate("window.__hsAuthPaint"), false, 'offline boot never paints a username/password form');
  assert.equal(await page.evaluate("!!document.querySelector('#login [name=password]').closest('label').hidden"), true, 'offline boot hides the password field');
  for (const [label, width, height] of [['1024x720', 1024, 720], ['844x390', 844, 390]]) {
    await size(page, width, height, true);
    await shot(page, '/tmp/hs-offline-base-' + label + '.png');
  }
  await size(page, 1024, 720, false);

  // Player-facing naming: the mode is "THE SECTOR" and the base copy avoids
  // developer jargon (authority, settlement reconciliation, server ownership).
  assert.equal(await page.evaluate("document.title"), 'HeadShotz — The Sector', 'page title uses the player-facing mode name');
  assert.equal(await page.evaluate("document.querySelector('h1').textContent.trim()"), 'THE SECTOR', 'base heading uses the player-facing mode name');
  const baseText = await page.evaluate("document.body.innerText");
  assert.equal(/persistent extraction|server-owned|authoritative|reconciliation/i.test(baseText), false, 'base copy has no developer jargon: ' + baseText.slice(0, 400));
  const menuHtml = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  assert.match(menuHtml, /<b>THE <em>SECTOR<\/em><\/b>/, 'main menu raid banner is renamed to THE SECTOR');
  assert.match(menuHtml, /CLASSIC EXTRACTION/, 'the original cooperative raid stays reachable as CLASSIC EXTRACTION');

  await page.wait("!!document.querySelector('#stash input[data-equip]')");
  await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  await page.wait('!!window.__hszOfflineRaid.snapshot()');
  await sleep(600);

  const scores = {};
  for (const [label, width, height] of [['1024x720', 1024, 720], ['844x390', 844, 390]]) {
    await size(page, width, height, true);
    await page.wait("document.getElementById('pack').hidden===true", 'compact HUD closes the backpack panel');
    assert.equal(await page.evaluate("document.documentElement.dataset.compactHud"), 'true', label + ' auto-enables compact HUD on touch landscape');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('telemetry')).opacity"), '0', label + ' clips the detailed telemetry panel');
    assert.equal(await page.evaluate("document.getElementById('hudSlim').getBoundingClientRect().height>0"), true, label + ' renders the slim strip');
    assert.equal(await page.evaluate("document.getElementById('networkStatus').hidden"), true, label + ' hides the offline connection readout');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('stick')).display!=='none'"), true, label + ' shows the virtual thumbstick');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('touchMove')).display"), 'none', label + ' replaces the arrow grid');
    assert.equal(await page.evaluate("[...document.querySelectorAll('#touch [data-look]')].every(b=>getComputedStyle(b).display==='none')"), true, label + ' hides discrete turn/aim buttons');
    assert.equal(await page.evaluate("[...['fire','sprint']].every(id=>!document.getElementById(id))"), true, label + ' removes the Fire and Sprint deck buttons');
    assert.equal(await page.evaluate("[...['aim','reload','jump','swap','slide']].every(id=>{const b=document.getElementById(id),s=getComputedStyle(b),r=b.getBoundingClientRect();return s.display!=='none'&&r.width>=44&&r.height>=44&&s.borderTopLeftRadius==='50%'})"), true, label + ' keeps the round action cluster at least 44px');
    assert.equal(await page.evaluate("[...['utility','vault','mapToggle']].every(id=>{const b=document.getElementById(id),s=getComputedStyle(b),r=b.getBoundingClientRect();return s.display!=='none'&&r.width>=44&&r.height>=44&&s.borderTopLeftRadius==='50%'})"), true, label + ' shows round Utility/Map/Vault icons at least 44px');
    assert.equal(await page.evaluate("[...['vault','mapToggle']].every(id=>!!document.getElementById(id).querySelector('svg'))"), true, label + ' keeps icon art on stateful deck controls');
    assert.equal(await page.evaluate("[...document.querySelectorAll('#touchActions .tb')].filter(b=>getComputedStyle(b).display!=='none').every(b=>getComputedStyle(b).borderTopLeftRadius==='50%')"), true, label + ' every visible deck control is a round icon');
    assert.equal(await page.evaluate("document.getElementById('interact').querySelector('span')?.textContent"), 'USE', label + ' labels the contextual interaction button USE');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('leave')).display"), 'none', label + ' collapses Back to base into the raid menu');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('globalTools')).display"), 'none', label + ' collapses Account/Guide/Settings into the raid menu');
    const menu = await page.evaluate("(()=>{const b=document.getElementById('raidMenu'),r=b.getBoundingClientRect();return {w:r.width,h:r.height,expanded:b.getAttribute('aria-expanded')}})()");
    assert.ok(menu.w >= 44 && menu.h >= 44, label + ' shows a 44px raid menu icon');
    await tap(page, 'raidMenu');
    await page.wait("document.getElementById('raidMenu').getAttribute('aria-expanded')==='true' && getComputedStyle(document.getElementById('raidMenuPanel')).display==='flex'", 'raid menu opens');
    const back = await page.evaluate("(()=>{const b=document.getElementById('raidMenuBack'),r=b.getBoundingClientRect();return {hidden:b.hidden,w:r.width,h:r.height}})()");
    assert.ok(!back.hidden && back.w >= 44 && back.h >= 44, label + ' raid menu exposes a 44px Back to base control');
    await tap(page, 'raidMenu');
    await page.wait("document.getElementById('raidMenu').getAttribute('aria-expanded')==='false'", 'raid menu closes');
    // Compact surfaces must not collide, and the crosshair center must not sit
    // under a control in either landscape size.
    const collisions = await page.evaluate(`(() => {
      const els = [...document.querySelectorAll('#touch button, #raidMenu, #packToggle, #stickBase, #minimap, #hudSlim')].filter(e => {
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      });
      const out = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
          out.push((els[i].id || els[i].dataset.move || els[i].dataset.look || els[i].textContent) + '/' + (els[j].id || els[j].dataset.move || els[j].dataset.look || els[j].textContent));
        }
      }
      return out;
    })()`);
    assert.deepEqual(collisions, [], label + ' compact controls do not overlap: ' + collisions);
    assert.equal(await page.evaluate("(document.elementFromPoint(innerWidth/2,innerHeight/2)||{}).id"), 'view', label + ' crosshair center remains clear');
    // Interact stays hidden unless the authoritative snapshot has an in-reach
    // cache, loot, body, door or exit. No rarity/ownership filtering here.
    const context = await page.evaluate(`(() => {
      const s = window.__hszOfflineRaid.snapshot(), self = s.self, d = o => Math.hypot((o.x||0) - self.x, (o.z||0) - self.z);
      const near = [...(s.caches||[]), ...(s.loot||[]), ...(s.bags||[]), ...(s.bodies||[]).filter(b => b.team !== self.team), ...(s.doors||[])].some(o => d(o) < 3)
        || (s.exits||[]).some(o => d(o) < 4);
      return {near, hidden: document.getElementById('interact').hidden};
    })()`);
    assert.equal(context.hidden, !context.near, label + ' Interact is visible only when something is in reach');
    // The briefing is transient by design; measure the steady-state HUD after
    // it has faded, and keep one screenshot while it is visible.
    if (label === '1024x720') {
      await page.wait("document.getElementById('hudStatus').hidden===false", 'compact briefing appears on spawn');
      await shot(page, '/tmp/hs-mobile-hud-briefing.png');
    }
    await page.wait("document.getElementById('hudStatus').hidden===true", 'compact briefing fades after spawning');
    const result = await measure(page);
    console.log(label, JSON.stringify(result));
    scores[label] = result;
    assert.ok(result.unobstructed >= 0.75, label + ' HUD leaves at least 75% of the world unobstructed (unobstructed ' + (result.unobstructed * 100).toFixed(1) + '%)');
    await shot(page, '/tmp/hs-mobile-hud-' + label + '.png');
  }

  // Virtual thumbstick: hold the stick up and let the authoritative simulation
  // integrate the analogue move. Only the server snapshot decides whether the
  // operator actually moved.
  const joystickStart = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z}})()");
  const stick = await page.evaluate("(()=>{const r=document.getElementById('stickBase').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await page.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: stick.x, y: stick.y, id: 7}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: stick.x, y: stick.y - 38, id: 7}]});
  for (let i = 0; i < 4; i++) {
    await sleep(180);
    await page.command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: stick.x + (i % 2 ? 1 : -1), y: stick.y - 38, id: 7}]});
  }
  await page.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  const joystickTravel = await page.evaluate(`(() => {
    const s = window.__hszOfflineRaid.snapshot().self;
    return Math.hypot(s.x - (${joystickStart.x}), s.z - (${joystickStart.z}));
  })()`);
  assert.ok(joystickTravel > 0.5, 'thumbstick drives authoritative operator movement (travel ' + joystickTravel.toFixed(2) + ' m)');

  // Right-half drag turns the camera through the same view pointer handler a
  // real touch uses. The authoritative yaw must change.
  const yawStart = await page.evaluate("window.__hszOfflineRaid.snapshot().self.yaw");
  const viewportSize = await page.evaluate("({w:innerWidth,h:innerHeight})");
  const lookX = Math.round(viewportSize.w * 0.72), lookY = Math.round(viewportSize.h / 2);
  await page.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: lookX, y: lookY, id: 8}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: lookX + 70, y: lookY, id: 8}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.wait(`(() => { const s = window.__hszOfflineRaid.snapshot(); return !!s && Math.abs(s.self.yaw - (${yawStart})) > 0.05; })()`);
  const yawEnd = await page.evaluate("window.__hszOfflineRaid.snapshot().self.yaw");
  assert.ok(Math.abs(yawEnd - yawStart) > 0.05, 'right-half drag turns the authoritative camera');

  // Touch aim and crosshair auto-fire: there is no Fire button. The main game
  // contract is that the reticle itself fires while it covers a machine, for
  // every weapon class, and an empty magazine reloads without a Reload tap.
  await size(page, 1024, 720, true);
  const staged = await page.evaluate(`(() => {
    const rt = window.__hszOfflineRaid.runtime();
    const operator = rt.raids.byAccount.get(rt.account);
    const raid = rt.raids.raids.get(operator.raidId);
    clearInterval(rt.tickTimer); rt.tickTimer = null;
    const dist = 8, angle = operator.yaw || 0;
    const mx = operator.x + Math.sin(angle) * dist, mz = operator.z + Math.cos(angle) * dist;
    raid.machines = [{id: 'auto-scout', kind: 'scout', x: mx, y: operator.y || 0, z: mz, hp: 99999, maxHp: 75, state: 'guard', yaw: Math.atan2(operator.x - mx, operator.z - mz), nextAttack: 1e12, patrolRadius: 0, guard: true, home: {x: mx, y: operator.y || 0, z: mz}}];
    raid.blocks = [];
    const weapon = operator.equipment.find(item => item.kind === 'weapon');
    weapon.loaded = 30; weapon.condition = 100; operator.ammo = 30;
    rt.raids.tick(0);
    return {x: mx, z: mz, yaw: operator.yaw, weaponId: weapon.id};
  })()`);
  await sleep(500);
  const viewportNow = await page.evaluate("({w:innerWidth,h:innerHeight})");
  const reticleX = Math.round(viewportNow.w * 0.72), reticleY = Math.round(viewportNow.h * 0.5);
  await page.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: reticleX, y: reticleY, id: 9}]});
  for (let i = 1; i <= 8; i++) await page.command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: reticleX, y: reticleY + i * 5, id: 9}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.wait("document.getElementById('play').dataset.target==='true'", 10000);

  const fired = {};
  for (const [cls, mag] of [['ar', 30], ['pistol', 12], ['shotgun', 6]]) {
    if (cls !== 'ar') {
      await page.evaluate(`(() => {
        const rt = window.__hszOfflineRaid.runtime();
        const operator = rt.raids.byAccount.get(rt.account);
        const weapon = operator.equipment.find(item => item.kind === 'weapon');
        weapon.weapon = ${JSON.stringify(cls)}; weapon.loaded = ${mag}; operator.ammo = ${mag};
        rt.raids.tick(0); return 0;
      })()`);
    }
    await page.wait(`(() => { const s = window.__hszOfflineRaid.snapshot(); const w = [...s.self.equipment, ...s.self.pack].find(item => item.id === s.self.weaponId); return !!w && w.weapon === ${JSON.stringify(cls)}; })()`, 5000);
    await page.wait(`window.__hszOfflineRaid.snapshot().self.ammo < ${mag}`, 8000);
    fired[cls] = await page.evaluate("window.__hszOfflineRaid.snapshot().self.ammo");
    await sleep(250);
    await shot(page, '/tmp/hs-mobile-hud-action-' + cls + '.png');
  }
  assert.ok(fired.ar < 30 && fired.pistol < 12 && fired.shotgun < 6, 'crosshair auto-fire consumes rounds for pistol, shotgun and AR without a Fire button');
  const deck = await page.evaluate("({fire:!!document.getElementById('fire'),sprint:!!document.getElementById('sprint'),round:[...document.querySelectorAll('#touchActions .tb')].filter(b=>getComputedStyle(b).display!=='none').every(b=>getComputedStyle(b).borderTopLeftRadius==='50%'),swap:!document.getElementById('swap').disabled})");
  assert.equal(deck.fire, false, 'the deck has no Fire button');
  assert.equal(deck.sprint, false, 'the deck has no sticky Sprint button');

  // Empty magazine with a compatible reserve: the reticle remains on the scout,
  // so the client reloads on its own. Never taps the Reload control.
  await page.evaluate(`(() => {
    const rt = window.__hszOfflineRaid.runtime();
    const operator = rt.raids.byAccount.get(rt.account);
    const weapon = operator.equipment.find(item => item.kind === 'weapon');
    if (!operator.pack.some(item => item.id === 'auto-reload-ammo')) operator.pack.push({id: 'auto-reload-ammo', kind: 'ammo', ammo: 'shell', quantity: 24, condition: 100});
    weapon.loaded = 0; operator.ammo = 0;
    rt.raids.tick(0); return 0;
  })()`);
  await page.wait("(() => { const s = window.__hszOfflineRaid.snapshot(); const w = [...s.self.equipment, ...s.self.pack].find(item => item.id === s.self.weaponId); return !!w && w.loaded === 0; })()", 5000);
  await page.wait("(() => { const s = window.__hszOfflineRaid.snapshot(); const w = [...s.self.equipment, ...s.self.pack].find(item => item.id === s.self.weaponId); return !!w && w.loaded > 0; })()", 8000);
  const autoReload = await page.evaluate("(() => { const rt = window.__hszOfflineRaid.runtime(); const o = rt.raids.byAccount.get(rt.account); const w = o.equipment.find(item => item.kind === 'weapon'); return {loaded: w.loaded, ammo: o.ammo, reserve: o.pack.filter(item => item.kind === 'ammo').reduce((n, item) => n + (item.quantity || 0), 0)}; })()");
  assert.ok(autoReload.loaded > 0 && autoReload.reserve < 24, 'an empty magazine reloads automatically without tapping Reload');

  // Aim is hold-to-zoom: pressing the round Aim icon lifts the optic until the
  // thumb lifts, and releasing restores hip fire.
  const aimPoint = await touchPoint(page, 'aim');
  await page.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: aimPoint.x, y: aimPoint.y, id: 11}]});
  await page.wait("document.getElementById('play').dataset.aiming==='true'", 3000);
  assert.equal(await page.evaluate("document.getElementById('aim').getAttribute('aria-pressed')"), 'true', 'holding Aim zooms');
  await page.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.wait("document.getElementById('play').dataset.aiming==='false'", 3000);
  assert.equal(await page.evaluate("document.getElementById('aim').getAttribute('aria-pressed')"), 'false', 'releasing Aim returns to hip fire');

  // Swap: with a second weapon carried, the round Swap icon equips it.
  await page.command('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: reticleX, y: reticleY, id: 12}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: reticleX, y: reticleY - 140, id: 12}]});
  await page.command('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.wait("document.getElementById('play').dataset.target==='false'", 5000);
  await page.evaluate(`(() => {
    const rt = window.__hszOfflineRaid.runtime();
    const operator = rt.raids.byAccount.get(rt.account);
    operator.pack = operator.pack.filter(item => item.id !== 'swap-pistol');
    operator.pack.push({id: 'swap-pistol', kind: 'weapon', weapon: 'pistol', condition: 100, loaded: 12, quantity: 1, attachments: []});
    rt.raids.tick(0); return 0;
  })()`);
  await page.wait("!document.getElementById('swap').disabled", 5000);
  await page.wait("(() => { const rt = window.__hszOfflineRaid.runtime(); const o = rt.raids.byAccount.get(rt.account); return (o.nextFire || 0) <= Date.now() / 1000; })()", 7000);
  await tap(page, 'swap');
  await page.wait("window.__hszOfflineRaid.snapshot().self.weaponId==='swap-pistol'", 8000);

  // Resume the 50 ms authority loop so the exit test observes boarding and
  // extraction exactly as the live page does.
  await page.evaluate("(() => { const rt = window.__hszOfflineRaid.runtime(); if (rt.tickTimer === null) rt.tickTimer = setInterval(() => { try { rt.raids.tick(0.05); } catch {} }, 50); return rt.tickTimer !== null; })()");

  // Touch Interact through an authoritative open exit. The fixture only
  // repositions the operator to an already-authored exit; boarding, the
  // extraction decision and rewards stay inside the RaidService.
  const exit = await page.evaluate(`(() => {
    const rt = window.__hszOfflineRaid.runtime();
    const operator = rt.raids.byAccount.get(rt.account);
    const raid = rt.raids.raids.get(operator.raidId);
    const exit = raid.exits[0], now = Date.now() / 1000;
    exit.openAt = now - 1; exit.closeAt = now + 30;
    Object.assign(operator, {x: exit.x, y: exit.y || 0, z: exit.z, move: {x: 0, z: 0}, protectedUntil: now + 60});
    return {x: exit.x, z: exit.z, id: exit.id};
  })()`);
  await sleep(700);
  const arrivals = await page.evaluate(`(() => {
    const s = window.__hszOfflineRaid.snapshot()?.self, exit = {x: ${JSON.stringify(exit.x)}, z: ${JSON.stringify(exit.z)}};
    return !!s && Math.hypot(s.x - exit.x, s.z - exit.z) < 1;
  })()`);
  assert.equal(arrivals, true, 'repositioned operator reaches the exit');
  await tap(page, 'interact');
  await page.wait(`window.__hszOfflineRaid.snapshot().self.result?.outcome==='extract' || document.getElementById('interactionStatus').textContent.includes('Boarding')`);
  const interaction = await page.evaluate("({result:window.__hszOfflineRaid.snapshot().self.result?.outcome||null,boarding:document.getElementById('interactionStatus').textContent})");
  assert.ok(interaction.result === 'extract' || /Boarding/i.test(interaction.boarding), 'touch Interact reaches the authoritative exit interaction');

  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    staticServer: true,
    noApiTraffic: true,
    compactHud: {desktop1024x720: scores['1024x720'].fraction, mobile844x390: scores['844x390'].fraction},
    unobstructed: {desktop1024x720: scores['1024x720'].unobstructed, mobile844x390: scores['844x390'].unobstructed},
    thumbstickMoved: true,
    rightDragTurned: true,
    interactContextual: true,
    raidMenuCollapsed: true,
    autoFireAllClasses: true,
    autoReloadEmptyMagazine: true,
    aimHoldToZoom: true,
    swapEquipsSecondWeapon: true,
    interactByTouch: true,
    screenshots: ['/tmp/hs-mobile-hud-1024x720.png', '/tmp/hs-mobile-hud-844x390.png', '/tmp/hs-mobile-hud-action-ar.png', '/tmp/hs-mobile-hud-action-pistol.png', '/tmp/hs-mobile-hud-action-shotgun.png'],
    browserErrors: [],
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
