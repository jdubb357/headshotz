import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const skins = readFileSync(new URL('../wskins.js', import.meta.url), 'utf8');
const humans = readFileSync(new URL('../humans.js', import.meta.url), 'utf8');
const toon = readFileSync(new URL('../toon.js', import.meta.url), 'utf8');

test('cache is v104 or newer', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 104);
  assert.match(sw, /wskins\.js/);
});

test('galaxy gun skins scroll in object space on every colourway', () => {
  for (const id of ['galaxy', 'galaxy_blue', 'galaxy_red', 'galaxy_gold']) {
    assert.match(skins, new RegExp(`${id}:\\[`));
  }
  assert.match(skins, /key\.startsWith\('galaxy'\)/);
  assert.match(skins, /gxDefs\(gun\?2\.1:toon\?1\.5:1\.6,lo,toon\?1:1\.7,toon,gun\)/);
  assert.match(skins, /gun\?'#define GXGUN\\n':''/);
  assert.match(skins, /#ifdef GXGUN/);
  assert.match(skins, /vec3 q=vp\*22\.\+vec3\(gt\*1\.7,gt\*\.4,-gt\*\.95\)/);
  assert.match(skins, /#define GXSTARK/);
  assert.match(skins, /float flow=fract\(dot\(vp,vec3\(\.55,\.28,4\.4\)\)-gt\*\.72\)/);
  assert.match(skins, /#ifndef GXLO/);
});

test('character galaxy suits keep the suit shader and guns still skip hands', () => {
  assert.match(humans, /gxDefs\(1\.25,glo,1,true\)/);
  assert.match(toon, /gxMat\(o\.fx,'toon'\)/);
  assert.match(skins, /if\(!o\.isMesh\|\|o\.userData\.hand\|\|o\.userData\.fx\)return/);
});
