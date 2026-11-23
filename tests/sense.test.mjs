import assert from 'node:assert/strict';
import test from 'node:test';
import { clampZoom, mapSpan, zoomAbout, pinchMap, panBy, mapPoint, stepOpacity, gunHear, shotOpacity, relBearing, segDist, iconPoint, makeRing, ringPush, ringStep } from '../sense.js';

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
