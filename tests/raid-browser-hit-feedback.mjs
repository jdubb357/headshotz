// Isolated Chrome grader for authoritative outgoing hit feedback. The client
// fires through the real keyboard/driver, receives a server-resolved hit token,
// renders the X marker and accessible caption, and replays only new tokens.
// A miss, a reconnect and a fresh baseline must never fabricate or replay a hit.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore(), runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness(), sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (p, code, down = true) => p.command('Input.dispatchKeyEvent', {type: down ? 'keyDown' : 'keyUp', code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code});
const hitState = p => p.evaluate("(()=>{const m=document.getElementById('hitmarker'),c=document.getElementById('hitmarkerCaption');return {show:m.classList.contains('show'),kind:m.dataset.kind,caption:c.textContent,opacity:getComputedStyle(m).opacity,visibility:getComputedStyle(m).visibility}})()");
let page;
try {
  const p = page = await h.page();
  await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await p.evaluate("document.querySelector('[name=username]').value='hit_ui_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long hit feedback browser password';document.getElementById('register').click()");
  await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  const profile = await p.evaluate("fetch('/api/profile').then(r=>r.json())");
  // The recovery kit supplies a server-owned weapon for the real UI deployment.
  await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()");
  await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && !document.getElementById('fire').disabled");
  const player = runtime.raids.byAccount.get(profile.id), raid = runtime.raids.raids.get(player.raidId);
  assert.ok(player.weaponId, 'the UI deployment equipped a usable weapon');
  raid.machines = []; raid.rivals = [];
  raid.world = {...raid.world, blocks: [], ramps: []};
  Object.assign(player, {x: 0, y: 0, z: 0, yaw: 0, pitch: 0, move: {x: 0, z: 0}, protectedUntil: 0});
  const enemy = store.register('hit_ui_target', 'a long hit target password').id;
  runtime.raids.deploy(enemy, {requestId: 'hit_ui_target_raid', mapId: 'relay', recovery: true});
  const target = runtime.raids.byAccount.get(enemy);
  assert.equal(target.raidId, player.raidId, 'the target joined the same authoritative raid');
  Object.assign(target, {x: 0, y: 0, z: 4, protectedUntil: 0});

  await p.evaluate("document.getElementById('view').focus()");
  // Observe local cue requests without depending on headless speaker output.
  await p.evaluate("(async()=>{const {RaidAudio}=await import('./raid-audio.mjs');const original=RaidAudio.prototype.play;window.__hitCues=[];RaidAudio.prototype.play=function(kind,spatial){if(kind==='hit'||kind==='headshot'||kind==='weak'||kind==='kill')window.__hitCues.push(kind);return original.call(this,kind,spatial)}})()");

  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.getElementById('hitmarker').classList.contains('show')");
  const body = await hitState(p);
  assert.equal(body.kind, 'hit', 'a confirmed body hit shows the hit marker, not a kill marker');
  assert.match(body.caption, /Hit confirmed · operator/);
  assert.notEqual(body.visibility, 'hidden', 'the marker is rendered visibly');
  assert.ok(Number(body.opacity) > 0 || body.show, 'the marker is not transparent while shown');
  await p.wait("window.__hitCues.includes('hit')");
  assert.equal(await p.evaluate("window.__hitCues.filter(k=>k==='hit').length"), 1, 'one hit cue per authoritative token');
  const serverHit = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit)");
  assert.equal(serverHit.target, 'operator'); assert.equal(serverHit.headshot, false); assert.equal(serverHit.kill, false);
  await writeFile('/tmp/headshotz-hit-feedback.png', Buffer.from((await p.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));

  // A miss must not produce a token, marker or cue. Wait for the first marker to
  // clear, then fire past an off-axis target.
  await sleep(1000);
  assert.equal(await p.evaluate("document.getElementById('hitmarker').classList.contains('show')"), false, 'the hit marker clears after its short presentation');
  Object.assign(target, {alive: false, hp: 0, x: 40, z: 40});
  const before = await p.evaluate("window.__hitCues.filter(k=>k==='hit'||k==='headshot'||k==='kill').length");
  const tokenBefore = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit?.token||0)");
  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.querySelectorAll('#hud b').length>0", 'the miss action still returns a snapshot');
  await p.wait("document.getElementById('hitmarker').classList.contains('show')===false");
  const after = await p.evaluate("window.__hitCues.filter(k=>k==='hit'||k==='headshot'||k==='kill').length");
  const tokenAfter = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit?.token||0)");
  assert.equal(after, before, 'a miss plays no outgoing hit cue');
  assert.equal(tokenAfter, tokenBefore, 'a miss does not invent a token');

  // A machine core hit while its attack is charging is authoritative weak
  // feedback: exhibit the core exactly at the horizontal aim line (hunter core
  // 1.2 m above a 0.35 m hull, eye 1.55 m) so real client fire resolves weak.
  raid.machines = [{id: 'hit_ui_weak_machine', kind: 'hunter', x: 0, y: 0.35, z: 4, hp: 120, maxHp: 140, state: 'windup', yaw: 0, nextAttack: 9999999999,
    attack: {at: 9999999999, point: {x: 0, y: 0, z: 4}, radius: 1.15}}];
  await sleep(700);
  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.getElementById('hitmarker').dataset.kind==='weak'");
  const weak = await hitState(p);
  assert.equal(weak.kind, 'weak', 'a server-resolved core hit shows the weak-point marker');
  assert.match(weak.caption, /Weak point hit · machine/);
  await p.wait("window.__hitCues.includes('weak')");
  assert.equal(await p.evaluate("window.__hitCues.filter(k=>k==='weak').length"), 1, 'one weak cue per authoritative token');
  const weakToken = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit)");
  assert.equal(weakToken.weak, true, 'the authoritative token marks the core hit');
  assert.equal(weakToken.kill, false, 'weak feedback does not fabricate a kill');
  await writeFile('/tmp/headshotz-hit-weak.png', Buffer.from((await p.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  await sleep(800);

  // A machine kill is still authoritative and uses the kill marker. The target
  // operator is purposefully removed from the ray so the machine is hit.
  raid.machines = [{id: 'hit_ui_machine', kind: 'hunter', x: 0, y: 0, z: 4, hp: 1, state: 'patrol'}];
  await sleep(700);
  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.getElementById('hitmarker').dataset.kind==='kill'");
  const kill = await hitState(p);
  assert.equal(kill.kind, 'kill', 'a verified machine death shows the kill marker');
  assert.match(kill.caption, /Machine destroyed/);
  await p.wait("window.__hitCues.includes('kill')");
  assert.equal(await p.evaluate("window.__hitCues.filter(k=>k==='kill').length"), 1, 'one kill cue per authoritative token');

  // Reconnect baseline: leave and resume within the server's presentation
  // window. start() must seed lastHitToken and clear the marker, so the old hit
  // is never replayed even if it is still present in the snapshot.
  raid.machines = [];
  await p.evaluate("document.getElementById('leave').click()");
  await p.wait("document.getElementById('play').style.display==='none' && !document.getElementById('resume').hidden");
  const stale = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit||null)");
  assert.ok(stale, 'the server still holds the recent hit inside its presentation window');
  const cuesBeforeResume = await p.evaluate("window.__hitCues.length");
  await p.evaluate("document.getElementById('resume').click()");
  await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  assert.equal(await p.evaluate("document.getElementById('hitmarker').classList.contains('show')"), false, 'reconnect clears and does not replay the old hit marker');
  assert.equal(await p.evaluate("window.__hitCues.length"), cuesBeforeResume, 'reconnect does not replay the old hit cue');
  assert.deepEqual(p.errors, []);
  console.log(JSON.stringify({
    bodyHitMarker: true,
    bodyCaption: body.caption,
    weakMarker: true,
    weakCaption: weak.caption,
    weakCue: true,
    killMarker: true,
    killCaption: kill.caption,
    oneCuePerToken: true,
    missNoMarker: true,
    missNoToken: true,
    reconnectBaseline: true,
    screenshot: '/tmp/headshotz-hit-feedback.png',
    weakScreenshot: '/tmp/headshotz-hit-weak.png',
    browserErrors: p.errors,
    scope: 'Isolated loopback service, one real Chrome client, arranged empty-cover geometry; the hit token is read from /api/raid. Does not prove human balance or remote/device acceptance.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    hit: await page?.evaluate("(()=>{const m=document.getElementById('hitmarker');return {show:m?.classList.contains('show'),kind:m?.dataset.kind,caption:document.getElementById('hitmarkerCaption')?.textContent}})()").catch(() => null),
    errors: page?.errors,
    cues: await page?.evaluate("window.__hitCues").catch(() => null)
  }));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
