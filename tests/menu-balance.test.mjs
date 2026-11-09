import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function parsesAsModule(name) {
  const src = readFileSync(new URL('../' + name, import.meta.url));
  const run = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: src, encoding: 'utf8' });
  assert.equal(run.status, 0, name + ' failed to parse:\n' + run.stderr);
}

test('pet and game modules parse, including the seahorse scale', () => {
  for (const name of ['petmodels4.js', 'petabil3.js', 'sidekicks.js', 'game.js', 'weapons.js', 'throwkit.js']) parsesAsModule(name);
  const pets = readFileSync(new URL('../petmodels4.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pets, /\.\d+-\.[A-Za-z]/);
});

test('the saved name is written into the name field and diamonds paint on load', () => {
  assert.match(game, /\$\('nameIn'\)\.value=LS\('name'\)\|\|''/);
  assert.match(html, /id="nameIn"/);
  const ui = game.slice(game.indexOf('function fmtDia'), game.indexOf('let diaToastT'));
  assert.match(ui, /toLocaleString\('en-US'\)/);
  assert.match(ui, /querySelectorAll\('\.diaBal,#chDia,#clDia,#ssDia,#pkDia,#raidDia'\)/);
  assert.match(ui, /\nupdDiaUI\(\);/);
  assert.match(css, /#menu \.card\.play \.cardHead\{display:flex;[^}]*flex-wrap:wrap/);
  assert.match(css, /-webkit-text-fill-color:#111/);
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 105);
});
