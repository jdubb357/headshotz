import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash as nodeCreateHash} from 'node:crypto';
import {createHash, randomBytes, randomHex, randomUUID, toHex, fromHex} from '../shared/raid-crypto.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Node's own crypto is the oracle: both transports must agree on sequence hashes.
const nodeHash = value => nodeCreateHash('sha256').update(value).digest('hex');

test('sha256 matches Node createHash for text, empty and unicode input', () => {
  for (const value of ['', 'abc', 'The quick brown fox jumps over the lazy dog', 'raid-action-✓-日本']) {
    assert.equal(createHash('sha256').update(value).digest('hex'), nodeHash(value));
  }
});

test('createHash produces the FIPS 180-4 vectors', () => {
  assert.equal(
    createHash('sha256').update('abc').digest('hex'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    createHash('sha256').update('').digest('hex'),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('createHash is chainable and rejects unsupported algorithms and encodings', () => {
  const chained = createHash('SHA256').update('salvage').update(' cache');
  assert.equal(chained.digest('hex'), nodeHash('salvage cache'));
  assert.throws(() => createHash('md5'), /Unsupported hash algorithm/);
  assert.throws(() => createHash('sha256').update('x').digest('rot13'), /Unsupported digest encoding/);
});

test('randomUUID returns a version-4 UUID, unique across calls', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const id = randomUUID();
    assert.match(id, UUID_V4);
    ids.add(id);
  }
  assert.equal(ids.size, 100);
});

test('randomBytes and hex helpers produce sized, non-constant output', () => {
  assert.equal(randomBytes(0).length, 0);
  assert.equal(randomBytes(16).length, 16);
  assert.equal(randomHex(8).length, 16);
  assert.match(randomHex(16), /^[0-9a-f]{32}$/);
  const first = randomBytes(32);
  const second = randomBytes(32);
  assert.notDeepEqual(first, second);
  assert.equal(toHex(fromHex('00ff10a3')), '00ff10a3');
  assert.throws(() => randomBytes(-1), RangeError);
  assert.throws(() => randomBytes(1.5), RangeError);
});
