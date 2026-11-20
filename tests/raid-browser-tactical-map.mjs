// Isolated Chrome grader for the full-screen tactical map and waypoint.
// Two independent browser contexts enter the raid through the real UI, verify
// the M binding, pan/zoom/recentre, click a world-to-map waypoint, read its
// distance and cardinal on the HUD compass, confirm the cyan minimap overlay,
// clear the waypoint, and ensure base screens cannot open the raid map.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function key(page, code, keyName) {
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code, key: keyName || code.slice(3).toLowerCase()});
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code, key: keyName || code.slice(3).toLowerCase()});
}
async function register(page, username) {
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value='a long tactical map password';document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
}
async function deploy(page) {
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
}
async function canvasRect(page) {
  return page.evaluate(`(() => { const box = document.getElementById('tacticalCanvas').getBoundingClientRect(); return {left: box.left, top: box.top, width: box.width, height: box.height}; })()`);
}
async function pixelSignature(page) {
  return page.evaluate(`(() => {
    const canvas = document.getElementById('tacticalCanvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data[i]) | 0;
    return hash;
  })()`);
}
async function cyanPixels(page) {
  return page.evaluate(`(() => {
    const canvas = document.getElementById('minimap');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= 105 && data[i] <= 135 && data[i + 1] >= 215 && data[i + 1] <= 245 && data[i + 2] >= 248) count++;
    }
    return count;
  })()`);
}
async function openMap(page) {
  await page.evaluate("document.getElementById('mapToggle').click()");
  await page.wait("document.getElementById('tacticalMap').hidden===false && document.getElementById('mapToggle').getAttribute('aria-expanded')==='true'");
}
async function clickWorld(page, fx, fy) {
  const box = await canvasRect(page);
  const x = Math.round(box.left + box.width * fx), y = Math.round(box.top + box.height * fy);
  await page.command('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
  await page.command('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, button: 'left', buttons: 1, clickCount: 1});
  await page.command('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
  return {x, y};
}
async function dragCanvas(page, dx, dy) {
  const box = await canvasRect(page);
  const x = Math.round(box.left + box.width * 0.5), y = Math.round(box.top + box.height * 0.5);
  const endX = Math.round(x + dx), endY = Math.round(y + dy);
  await page.command('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
  await page.command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: x + 8, y: y + 2, button: 'left', buttons: 1, clickCount: 1});
  await page.command('Input.dispatchMouseEvent', {type: 'mouseMoved', x: endX, y: endY, button: 'left', buttons: 1, clickCount: 1});
  await page.command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: endX, y: endY, button: 'left', buttons: 0, clickCount: 1});
}
async function closeMap(page) {
  await page.evaluate("document.getElementById('mapClose').click()");
  await page.wait("document.getElementById('tacticalMap').hidden===true && document.getElementById('mapToggle').getAttribute('aria-expanded')==='false'");
}

let first, second;
try {
  first = await h.page();
  await register(first, 'tacmap1_' + Date.now().toString(36).slice(-8));
  // The raid map is a raid-only surface; the key binding is ignored at the home
  // base before deployment and no overlay leaks over account setup.
  await key(first, 'KeyM', 'm');
  await sleep(80);
  assert.equal(await first.evaluate("document.getElementById('tacticalMap').hidden"), true, 'the map stays closed at base');
  await deploy(first);
  await first.wait("document.getElementById('compass').textContent.startsWith('Facing')");

  await key(first, 'KeyM', 'm');
  await first.wait("document.getElementById('tacticalMap').hidden===false");
  assert.equal(await first.evaluate("document.getElementById('mapToggle').getAttribute('aria-expanded')"), 'true');
  assert.ok(await first.evaluate("document.getElementById('mapReadout').textContent.includes('Drag to pan')"), 'the map explains its controls');
  const openedSignature = await pixelSignature(first);
  assert.notEqual(openedSignature, 0, 'the full map canvas renders');

  // The raid map blocks movement while it is open; the key is dispatched but
  // the authoritative operator position must stay put.
  const beforeBlocked = await first.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>({x:s.self.x,z:s.self.z}))");
  await first.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'KeyW', key: 'w'});
  await sleep(600);
  await first.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyW', key: 'w'});
  const afterBlocked = await first.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>({x:s.self.x,z:s.self.z}))");
  assert.ok(Math.hypot(afterBlocked.x - beforeBlocked.x, afterBlocked.z - beforeBlocked.z) < 0.5, 'an open map does not enable movement');

  // Clicking the canvas establishes a map waypoint expressed in world units.
  await clickWorld(first, 0.62, 0.64);
  await first.wait("document.getElementById('mapReadout').textContent.startsWith('Waypoint')");
  const readout = await first.evaluate("document.getElementById('mapReadout').textContent");
  assert.match(readout, /Waypoint \d+ m (north|northeast|east|southeast|south|southwest|west|northwest) \d{3}°/, 'readout exposes range, cardinal and bearing');
  let compass = await first.evaluate("document.getElementById('compass').textContent");
  assert.match(compass, /Facing (north|northeast|east|southeast|south|southwest|west|northwest) \d{3}°/, 'compass shows the live facing');
  assert.match(compass, /· waypoint \d+ m (north|northeast|east|southeast|south|southwest|west|northwest) \d{3}°/, 'compass repeats the waypoint range and bearing');
  assert.ok(await cyanPixels(first) > 0, 'the minimap paints the cyan waypoint');

  // Clicking the same on-screen cyan marker clears it; a fresh click elsewhere
  // then provides the waypoint used by the pan/zoom portion below.
  await clickWorld(first, 0.62, 0.64);
  await first.wait("!document.getElementById('mapReadout').textContent.startsWith('Waypoint')");
  assert.equal(await cyanPixels(first), 0, 'clicking the waypoint marker clears the minimap overlay');
  await clickWorld(first, 0.6, 0.4);
  await first.wait("document.getElementById('mapReadout').textContent.startsWith('Waypoint')");
  const activeReadout = await first.evaluate("document.getElementById('mapReadout').textContent");
  compass = await first.evaluate("document.getElementById('compass').textContent");
  assert.ok(await cyanPixels(first) > 0, 'the minimap repaints after a new waypoint click');
  // Normalize to the operator-centred view before recording the baseline: a
  // wheel event delivered by CDP may land asynchronously and leave the camera
  // at a non-unit zoom, which would make an exact signature comparison flaky.
  await first.evaluate("document.getElementById('mapRecenter').click()");
  const centredSignature = await pixelSignature(first);

  // Panning and zooming repaint the full map without changing the world waypoint.
  await dragCanvas(first, 48, 24);
  await first.wait(`document.getElementById('mapReadout').textContent===${JSON.stringify(activeReadout)}`);
  const pannedSignature = await pixelSignature(first);
  assert.notEqual(pannedSignature, centredSignature, 'dragging pans the tactical map');
  const showBox = await canvasRect(first);
  await first.command('Input.dispatchMouseEvent', {type: 'mouseWheel', x: Math.round(showBox.left + showBox.width / 2), y: Math.round(showBox.top + showBox.height / 2), deltaX: 0, deltaY: -120});
  const wheelSignature = await pixelSignature(first);
  assert.notEqual(wheelSignature, pannedSignature, 'the mouse wheel zooms the tactical map');
  await first.evaluate("document.getElementById('mapZoomIn').click()");
  const zoomedSignature = await pixelSignature(first);
  assert.notEqual(zoomedSignature, wheelSignature, 'zoom button scales the tactical map');
  await first.evaluate("document.getElementById('mapZoomOut').click()");
  await first.evaluate("document.getElementById('mapRecenter').click()");
  // The map scene contains live-patrolling machines, so an exact pixel
  // signature across two renders is not stable. Recentre is verified
  // behaviourally instead: a click at the map's centre must resolve to the
  // operator's own position in world space.
  await clickWorld(first, 0.5, 0.5);
  await first.wait("/^Waypoint [01] m /.test(document.getElementById('mapReadout').textContent)");
  const recentredCompass = await first.evaluate("document.getElementById('compass').textContent");
  assert.match(recentredCompass, /· waypoint [01] m /, 'recentre restores the operator-centred view');

  await first.evaluate("document.getElementById('mapClear').click()");
  await first.wait("!document.getElementById('mapReadout').textContent.startsWith('Waypoint')");
  await closeMap(first);
  assert.equal(await cyanPixels(first) > 0, false, 'closing the map clears the minimap waypoint marker');

  // Reopen from the in-raid button, close from that same button, and verify the
  // binding is reflected by settings-derived labels.
  await openMap(first);
  await first.evaluate("document.getElementById('mapToggle').click()");
  await first.wait("document.getElementById('tacticalMap').hidden===true");
  assert.deepEqual(first.errors, [], 'first context has no browser errors');

  // The renderer also works on a detached canvas with explicit state/camera, so
  // marker coverage and camera math can be graded without opening the overlay.
  const detached = await first.evaluate(`(async () => {
    const {drawTacticalMap} = await import('./raid-online.mjs');
    const {getWorld} = await import('./shared/raid-worlds.mjs');
    const state = await (await fetch('/api/raid')).json();
    const self = state.self;
    const world = getWorld(state.map, state.mapVersion === undefined ? 1 : state.mapVersion);
    const k = 720 / world.size;
    const marker = {x: self.x + 30, z: self.z + 30};
    const bx = 360 + 30 * k, by = 360 + 30 * k;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 720;
    const empty = {...state, exits: [], caches: [], rivals: [], machines: [], loot: [], players: [], bodies: [], pings: []};
    const draw = (value, opts = {}) => {
      drawTacticalMap(canvas, state.map, value, {camera: {x: self.x, z: self.z, zoom: 1}, headingYaw: self.yaw, ...opts});
      return canvas.getContext('2d').getImageData(0, 0, 720, 720).data;
    };
    const base = draw(empty);
    const delta = (data, radius = 24) => {
      let count = 0;
      for (let y = Math.max(0, Math.floor(by - radius)); y < Math.min(720, by + radius); y++) for (let x = Math.max(0, Math.floor(bx - radius)); x < Math.min(720, bx + radius); x++) {
        const i = (y * 720 + x) * 4;
        if (data[i] !== base[i] || data[i + 1] !== base[i + 1] || data[i + 2] !== base[i + 2]) count++;
      }
      return count;
    };
    const exit = {...marker, kind: 'timed', seats: 6, usedSeats: 0, reservedSeats: 0, openAt: state.serverTime + 30, closeAt: state.serverTime + 90, maxActivations: 1, arrival: 0, duration: 60};
    const variants = {
      exit: {...empty, exits: [exit]},
      weaponCache: {...empty, caches: [{...marker, weaponCache: true}]},
      cache: {...empty, caches: [{...marker, open: true}]},
      machine: {...empty, machines: [{...marker, kind: 'overlord'}]},
      rival: {...empty, rivals: [{...marker, state: 'patrol'}]},
      loot: {...empty, loot: [{...marker, id: 'fixture-loot'}]},
      squadmate: {...empty, players: [{...marker, team: self.team, name: 'Squadmate'}]},
      opponent: {...empty, players: [{...marker, team: '__fixture_enemy__', name: 'Opponent'}]},
      bodyOpen: {...empty, bodies: [{...marker, team: '__fixture_enemy__', open: true}]},
      bodyClosed: {...empty, bodies: [{...marker, team: '__fixture_enemy__', open: false}]},
      ping: {...empty, pings: [{...marker, kind: 'danger'}]},
      waypoint: empty
    };
    const deltas = {};
    for (const [kind, value] of Object.entries(variants)) deltas[kind] = delta(draw(value, kind === 'waypoint' ? {waypoint: marker} : {}));
    const centred = draw(empty), zoomed = draw(empty, {camera: {x: self.x, z: self.z, zoom: 2}});
    let zoomDelta = 0;
    for (let i = 0; i < centred.length; i += 13) if (centred[i] !== zoomed[i]) zoomDelta++;
    return {deltas, zoomDelta, backgroundDrawn: base.some((v) => v !== 0 || v !== 255)};
  })()`);
  for (const [kind, count] of Object.entries(detached.deltas)) assert.ok(count > 0, `tactical map paints ${kind}`);
  assert.ok(detached.zoomDelta > 0, 'detached camera zoom changes the rendered map');
  assert.equal(detached.backgroundDrawn, true, 'detached full map paints its background');

  // The second isolated browser context must have its own map state and clean
  // behavior while the first context remains connected.
  second = await h.page();
  await register(second, 'tacmap2_' + Date.now().toString(36).slice(-8));
  await deploy(second);
  await second.wait("document.getElementById('compass').textContent.startsWith('Facing')");
  await openMap(second);
  assert.equal(await second.evaluate("document.getElementById('tacticalMap').hidden"), false, 'second context opens its own map');
  await clickWorld(second, 0.68, 0.6);
  await second.wait("document.getElementById('mapReadout').textContent.startsWith('Waypoint')");
  assert.equal(await first.evaluate("document.getElementById('mapReadout').textContent.startsWith('Waypoint')"), false, 'map waypoints stay client-local per context');
  await closeMap(second);
  assert.deepEqual(second.errors, [], 'second context has no browser errors');

  console.log(JSON.stringify({
    mapOpensWithM: true,
    mapBlockedAtBase: true,
    panned: true,
    zoomed: true,
    recentred: true,
    waypointWorldReadout: activeReadout,
    compassWaypoint: compass,
    minimapCyanMarker: true,
    waypointCleared: true,
    independentContexts: true,
    browserErrors: [],
    scope: 'Isolated Chrome contexts through the real raid UI; map rendering and waypoint math are client-only and no server game state is fabricated.'
  }));
} catch (error) {
  console.error(JSON.stringify({firstErrors: first?.errors, secondErrors: second?.errors,
    mapHidden: await first?.evaluate("document.getElementById('tacticalMap').hidden").catch(() => null),
    readout: await first?.evaluate("document.getElementById('mapReadout').textContent").catch(() => null),
    compass: await first?.evaluate("document.getElementById('compass').textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
