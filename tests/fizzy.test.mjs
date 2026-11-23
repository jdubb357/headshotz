import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CLOAK, cloakBlocks, hostCloak, hostMark, OMNI_MARK, tickCloak, veilView } from '../petabil3.js';

// Fizzy: small Godly rainbow chameleon. A lick cloaks you for 10s. Cooldown is 15s.
const root = new URL('..', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const pets = read('sidekicks.js');
const game = read('game.js');
const models = read('petmodels4.js');

function def(id) {
  const line = pets.split('\n').find(l => l.includes(`id:'${id}'`));
  assert.ok(line, id);
  const grab = key => { const m = line.match(new RegExp(key + ":'([^']*)'")); return m ? m[1] : ''; };
  const num = key => { const m = line.match(new RegExp(key + ':(\\d+)')); return m ? +m[1] : NaN; };
  return { name: grab('name'), kind: grab('kind'), ab: grab('ab'), price: num('price'), rar: num('rar'), godly: /godly:1/.test(line), ride: /ride:1/.test(line), veil: /veil:1/.test(line) };
}

test('Fizzy is the small Godly Rainbow Chameleon at 50,000 and only in the Godly chest', () => {
  const f = def('fizzy');
  assert.equal(f.name, 'Fizzy');
  assert.equal(f.kind, 'Rainbow Chameleon');
  assert.equal(f.ab, 'veil');
  assert.equal(f.price, 50000);
  assert.equal(f.rar, 5);
  assert.equal(f.godly, true);
  assert.equal(f.ride, false);
  assert.equal(f.veil, true);
  assert.match(pets, /Fizzy the Rainbow Chameleon/);
  assert.match(pets, /act:1/);
  const godly = game.slice(game.lastIndexOf('CHEST.loot.godly='), game.indexOf(';', game.lastIndexOf('CHEST.loot.godly=')));
  const secret = game.slice(game.lastIndexOf('CHEST.loot.secret='), game.indexOf(';', game.lastIndexOf('CHEST.loot.secret=')));
  assert.match(godly, /\['pet','fizzy',1\]/);
  assert.doesNotMatch(secret, /fizzy/);
  assert.match(godly, /\['pet','chimera',1\]/);
  const body = models.slice(models.indexOf('fizzy(){'), models.indexOf('function whSafe'));
  assert.match(body, /casque/);
  assert.match(body, /turret/);
  assert.match(body, /curl/);
  assert.match(body, /rainbow/);
  assert.match(body, /rig\.tongue/);
  assert.match(body, /GQ\.level==='low'/);
  assert.match(body, /sc:\.78/);
  assert.match(pets, /ph\*2\.1/);
  assert.match(pets, /k:'veil'/);
  assert.match(pets, /fizzyCloak/);
  assert.match(game, /v\.cloak&&H\.t<v\.cloak/);
  assert.match(game, /q\.veil\|\|/);
});

test('a lick cloaks for 10s, blocks every hit, hides you, and waits 15s', () => {
  assert.equal(CLOAK.dur, 10);
  assert.equal(CLOAK.cd, 15);
  const others = veilView(false), self = veilView(true);
  assert.deepEqual(others, { body: false, gun: false, tag: false, chameleon: false });
  assert.equal(self.chameleon, true);
  assert.equal(self.body, false);
  const fx = [];
  const X = { bcast(m) { fx.push(m.k); } };
  const p = { id: 'me', hp: 80, veil: 0, cloak: 0 };
  const S = {};
  assert.equal(hostCloak(X, p, S, { t: 3 }), true);
  assert.equal(p.veil, 1);
  assert.equal(p.cloak, 13);
  assert.equal(S.cd, 18);
  assert.deepEqual(fx, ['lick', 'cloak']);
  assert.equal(cloakBlocks(p, 3), true);
  assert.equal(cloakBlocks(p, 12.9), true);
  assert.equal(cloakBlocks(p, 13), false);
  assert.equal(tickCloak(p, 12), false);
  assert.equal(p.veil, 1);
  assert.equal(hostCloak(X, p, S, { t: 14 }), false);
  assert.equal(tickCloak(p, 13), true);
  assert.equal(p.veil, 0);
  assert.equal(p.cloak, 0);
  assert.equal(cloakBlocks(p, 14), false);
  assert.equal(hostCloak(X, p, S, { t: 18 }), true);
  assert.equal(p.cloak, 28);
});

test('Fizzy marks enemies with Sol\'s tier timers and leaves the cloak cooldown alone', () => {
  assert.deepEqual(OMNI_MARK.dur, [5, 7, 10]);
  assert.deepEqual(OMNI_MARK.cd, [18, 14, 10]);
  const expect = [[1, 5, 18], [2, 7, 14], [3, 10, 10]];
  for (const [tier, dur, cd] of expect) {
    const sent = [];
    const S = { cd: 99 };
    const p = { id: 'me' };
    assert.equal(hostMark({ bcast: m => sent.push(m) }, p, S, { t: 2 }, tier), true);
    assert.equal(sent[0].k, 'omniscan');
    assert.equal(sent[0].d, dur);
    assert.equal(sent[0].cd, cd);
    assert.equal(S.mk, 2 + cd);
    assert.equal(S.cd, 99);
    assert.equal(hostMark({ bcast: m => sent.push(m) }, p, S, { t: 2 + cd - 0.05 }, tier), false);
    assert.equal(sent.length, 1);
  }
  const abil = read('petabil3.js');
  assert.match(abil, /function hostOmni[\s\S]*hostMark\(X,p,S,H,tr\)/);
  assert.match(pets, /if\(d\.ab==='veil'\)\{hostMark\(X,p,S,H,tr\)/);
  assert.match(pets, /id="bScan"|getElementById\('bScan'\)/);
  assert.match(pets, /scanEl\.classList/);
  const veil = pets.slice(pets.indexOf("d.ab==='veil'"), pets.indexOf("d.ab==='guard'"));
  assert.doesNotMatch(veil, /hostOmni|tryRebirth|omniHealRate/);
  assert.match(pets, /id!=='phoenix'&&d\.ab!=='omni'/);
  assert.match(game, /v\.cloak&&H\.t<v\.cloak/);
});
