import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../lib/three.module.min.js';
import { clampZoom, mapSpan, zoomAbout, pinchMap, panBy, mapPoint, mapWorld, mapGesture, markerHit, edgeClamp, placeMark, clearMark, markVisible, TAP_PX, stepOpacity, gunHear, shotOpacity, relBearing, groundAngle, cameraMarkerAngle, senseAngle, segDist, iconPoint, makeRing, ringPush, ringStep } from '../sense.js';

const quiet = { enemy: 1, cloaked: 0, crouch: 0, air: 0 };

test('the full map zooms from 1x to 4x and keeps the point under the cursor', () => {
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(9), 4);
  assert.equal(mapSpan(420, 2), 210);
  const cam = { z: 1, cx: 0, cz: 0 };
  const next = zoomAbout(cam, 2, 75, 50, 100, 100, 100, 40);
  assert.equal(next.z, 2);
  const back = mapPoint(25, 0, next, 100, 100, 100);
  assert.ok(Math.abs(back[0] - 75) < 0.01);
  const locked = panBy({ z: 1, cx: 0, cz: 0 }, 40, -20, 100, 100, 100, 40);
  assert.ok(Math.abs(locked.cx) < 1e-9);
  assert.ok(Math.abs(locked.cz) < 1e-9);
  const moved = panBy({ z: 2, cx: 0, cz: 0 }, 10, 0, 100, 100, 100, 40);
  assert.ok(moved.cx < 0);
  const pinch = pinchMap({ z: 1, cx: 0, cz: 0, d: 40, mx: 70, my: 50 }, 80, 80, 60, 100, 100, 100, 40);
  assert.equal(pinch.z, 2);
  const held = mapPoint(20, 0, pinch, 100, 100, 100);
  assert.ok(Math.abs(held[0] - 80) < 0.01);
});

test('a map tap converts back to the same world point at every zoom, and a drag does not count as a tap', () => {
  assert.equal(mapGesture(0, 0, 1), 'tap');
  assert.equal(mapGesture(TAP_PX, 0, 1), 'tap');
  assert.equal(mapGesture(TAP_PX + 1, 2, 1), 'pan');
  assert.equal(mapGesture(0, 0, 2), 'pinch');
  for (const z of [1, 2, 4]) {
    const cam = { z, cx: 30, cz: -12 };
    const spot = mapWorld(180, 90, cam, 320, 240, 420);
    const back = mapPoint(spot[0], spot[1], cam, 320, 240, 420);
    assert.ok(Math.abs(back[0] - 180) < 1e-6, `x zoom ${z}`);
    assert.ok(Math.abs(back[1] - 90) < 1e-6, `y zoom ${z}`);
    assert.ok(markerHit(back[0], back[1], spot[0], spot[1], cam, 320, 240, 420, 16));
  }
  const wide = mapPoint(40, -20, { z: 1, cx: 0, cz: 0 }, 200, 200, 400);
  const tight = mapPoint(40, -20, { z: 4, cx: 0, cz: 0 }, 200, 200, 400);
  assert.ok(Math.hypot(wide[0] - tight[0], wide[1] - tight[1]) > 20);
  const inside = edgeClamp(110, 100, 100, 100, 40);
  assert.equal(inside.edge, false);
  const out = edgeClamp(180, 100, 100, 100, 40);
  assert.equal(out.edge, true);
  assert.ok(Math.abs(out.x - 140) < 1e-6);
  assert.ok(Math.abs(out.y - 100) < 1e-6);
  let marks = placeMark({}, 'me', 12, -4);
  marks = placeMark(marks, 'ally', 3, 8);
  marks = placeMark(marks, 'me', 20, 1);
  assert.equal(marks.me.x, 20);
  assert.equal(marks.ally.z, 8);
  assert.equal(Object.keys(marks).length, 2);
  marks = clearMark(marks, 'me');
  assert.equal(marks.me, undefined);
  assert.equal(marks.ally.x, 3);
  assert.equal(markVisible('me', 'me', false), true);
  assert.equal(markVisible('ally', 'me', true), true);
  assert.equal(markVisible('foe', 'me', false), false);
});

test('footsteps fade with distance and stay quiet for teammates, crouch, cloak, and standing still', () => {
  const near = stepOpacity(6, 6, quiet);
  const far = stepOpacity(24, 6, quiet);
  assert.ok(near > far && far > 0);
  assert.equal(stepOpacity(6, 6, { ...quiet, enemy: 0 }), 0);
  assert.equal(stepOpacity(6, 6, { ...quiet, cloaked: 1 }), 0);
  assert.equal(stepOpacity(6, 6, { ...quiet, crouch: 1 }), 0);
  assert.equal(stepOpacity(6, 0.4, quiet), 0);
  assert.equal(stepOpacity(40, 8, quiet), 0);
});

test('gunshots use a 60-80 m range, and a shot aimed at you reads louder', () => {
  const smg = gunHear(0.42, 'smg');
  const sniper = gunHear(0.8, 'sniper');
  assert.ok(smg >= 60 && smg <= 80);
  assert.ok(sniper >= smg && sniper <= 80);
  const range = 70;
  assert.ok(shotOpacity(20, range, true) > shotOpacity(20, range, false));
  assert.equal(shotOpacity(90, range, true), 0);
  assert.ok(segDist(0, 0, 10, 0, 5, 1) < 2.4);
  assert.ok(shotOpacity(24, range, false) >= 0.55);
});

function angErr(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

test('an on-screen enemy follows the projected ray, and off-screen eases onto flat yaw', () => {
  const camera = new THREE.PerspectiveCamera(75, 390 / 844, 0.03, 300);
  camera.rotation.order = 'YXZ';
  camera.position.set(36, 1.62, -8);
  camera.rotation.set(-0.12, 0.4, 0);
  camera.updateMatrixWorld(true);
  const look = new THREE.Vector3();
  camera.getWorldDirection(look);
  const fl = Math.hypot(look.x, look.z) || 1;
  const fx = look.x / fl, fz = look.z / fl, rx = -fz, rz = fx;

  const ndc = new THREE.Vector3(Math.sin(-Math.PI / 3), Math.cos(-Math.PI / 3), 0.45);
  const enemy = ndc.clone().unproject(camera);
  const ang = cameraMarkerAngle(camera, enemy.x, enemy.y, enemy.z);
  const back = enemy.clone().project(camera);
  const screen = Math.atan2(back.x, back.y);
  assert.ok(angErr(ang, screen) < Math.PI / 180, `on-screen ${ang} vs ${screen}`);
  assert.ok(Math.abs(ang + Math.PI / 3) < Math.PI / 180);
  assert.ok(iconPoint(ang, 200)[0] < 80);

  const left = camera.position.clone().add(new THREE.Vector3(-rx, 0, -rz).multiplyScalar(12));
  const leftAng = cameraMarkerAngle(camera, left.x, camera.position.y, left.z);
  const leftFlat = groundAngle(left.x - camera.position.x, left.z - camera.position.z, fx, fz);
  assert.ok(angErr(leftAng, leftFlat) < Math.PI / 180, `90 left ${leftAng} vs flat ${leftFlat}`);
  assert.ok(Math.abs(leftAng + Math.PI / 2) < Math.PI / 180);
  const leftSpot = iconPoint(leftAng, 200);
  assert.ok(leftSpot[0] < 100);
  assert.ok(Math.abs(leftSpot[1] - 100) < 2);

  const behind = camera.position.clone().add(new THREE.Vector3(-fx * 6 + rx * 4, 0.2, -fz * 6 + rz * 4));
  const behindAng = cameraMarkerAngle(camera, behind.x, behind.y, behind.z);
  const behindFlat = groundAngle(behind.x - camera.position.x, behind.z - camera.position.z, fx, fz);
  assert.ok(angErr(behindAng, behindFlat) < Math.PI / 180);
  const mirrored = Math.atan2(behind.clone().project(camera).x, behind.clone().project(camera).y);
  assert.ok(angErr(behindAng, mirrored) > Math.PI / 6);
  assert.ok(iconPoint(behindAng, 200)[0] > 120);

  let prev = null, maxStep = 0;
  for (let x = -0.4; x >= -2.4; x -= 0.04) {
    const p = new THREE.Vector3(x, 0.15, 0.5).unproject(camera);
    const a = cameraMarkerAngle(camera, p.x, p.y, p.z);
    if (prev != null) maxStep = Math.max(maxStep, angErr(a, prev));
    prev = a;
  }
  assert.ok(maxStep < 8 * Math.PI / 180, `slide step ${(maxStep * 180 / Math.PI).toFixed(2)} deg`);

  const edgePt = new THREE.Vector3(-1, 0.2, 0.5).unproject(camera);
  const edgeAng = cameraMarkerAngle(camera, edgePt.x, edgePt.y, edgePt.z);
  const edgeScreen = Math.atan2(edgePt.clone().project(camera).x, edgePt.clone().project(camera).y);
  const edgeFlat = groundAngle(edgePt.x - camera.position.x, edgePt.z - camera.position.z, fx, fz);
  assert.ok(angErr(edgeAng, edgeScreen) < 12 * Math.PI / 180);
  const gap = angErr(edgeScreen, edgeFlat);
  assert.ok(angErr(edgeAng, edgeScreen) <= gap + 1e-6);
  assert.ok(angErr(edgeAng, edgeFlat) <= gap + 1e-6);

  const off = new THREE.Vector3(-1.9, 0.15, 0.5).unproject(camera);
  const offAng = cameraMarkerAngle(camera, off.x, off.y, off.z);
  const offFlat = groundAngle(off.x - camera.position.x, off.z - camera.position.z, fx, fz);
  assert.ok(angErr(offAng, offFlat) < Math.PI / 180);

  const pure = senseAngle(-0.4, 0.2, 4, -0.4, 4, 0.35, 0.75);
  assert.ok(angErr(pure, Math.atan2((-0.4 / 4) / 0.35, (0.2 / 4) / 0.75)) < 1e-6);
  const rear = senseAngle(3, 0, -2, 3, -2, 0.35, 0.75);
  assert.ok(angErr(rear, Math.atan2(3, -2)) < 1e-6);
});

test('a target 90 degrees left of the camera sits on the left of the ring', () => {
  // Render camera looks down -Z. Its right axis is +X, so -X is 90 degrees left.
  const left = groundAngle(-12, 0, 0, -1);
  assert.ok(Math.abs(left + Math.PI / 2) < 1e-6);
  const p = iconPoint(left, 200);
  assert.ok(p[0] < 100);
  assert.ok(Math.abs(p[1] - 100) < 1);
  const right = groundAngle(12, 0, 0, -1);
  const q = iconPoint(right, 200);
  assert.ok(q[0] > 100);
  assert.ok(Math.abs(q[1] - 100) < 1);
});

test('the ring points at a known target for the camera yaw', () => {
  // yaw 0 looks toward -Z, which is the top of the screen.
  const ahead = relBearing(0, 0, -12);
  assert.ok(Math.abs(ahead) < 1e-6);
  const up = iconPoint(ahead, 400);
  assert.ok(up[1] < 160);
  assert.ok(Math.abs(up[0] - 200) < 1);
  // +X is the player's right, so the icon sits on the right of the ring.
  const right = relBearing(0, 14, 0);
  assert.ok(Math.abs(right - Math.PI / 2) < 1e-6);
  const side = iconPoint(right, 400);
  assert.ok(side[0] > 280);
  assert.ok(Math.abs(side[1] - 200) < 1);
  // yaw PI/2 looks toward -X. That target is still straight ahead.
  const turned = relBearing(Math.PI / 2, -9, 0);
  assert.ok(Math.abs(turned) < 1e-6);
  assert.ok(iconPoint(turned, 400)[1] < 160);
});

test('the direction ring reuses slots instead of growing', () => {
  const ring = makeRing(4);
  ringPush(ring, 1, 0.2, 0.8, 1, 'bot');
  ringPush(ring, 1, 0.4, 0.9, 1, 'bot');
  assert.equal(ring.slots.filter(s => s.on && s.id === 'bot').length, 1);
  assert.equal(ring.slots[0].ang, 0.4);
  ringPush(ring, 2, 1, 1, 2, 'bot');
  assert.equal(ring.slots.filter(s => s.on && s.id === 'bot').length, 1);
  assert.equal(ring.slots.find(s => s.id === 'bot').kind, 2);
  ringPush(ring, 1, 0.2, 0.6, 1, 'bot');
  assert.equal(ring.slots.find(s => s.id === 'bot').kind, 2);
  ringPush(ring, 2, 1, 1, 0.5, 'gun');
  ringStep(ring, 0.6);
  assert.equal(ring.slots.find(s => s.id === 'gun').on, 0);
  assert.equal(ring.slots.find(s => s.id === 'bot').on, 1);
  assert.equal(ring.n, 4);
});
