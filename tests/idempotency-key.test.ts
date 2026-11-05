import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createIdempotencyKey } from '../src/lib/idempotency-key';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('HTTPS/localhost Crypto uses native randomUUID with the correct receiver', () => {
  const source = {
    randomUUID() { assert.equal(this, source); return '00112233-4455-4677-8899-aabbccddeeff'; },
    getRandomValues() { throw new Error('Native path must not use fallback'); },
  };
  assert.equal(createIdempotencyKey(source), '00112233-4455-4677-8899-aabbccddeeff');
  assert.match(createIdempotencyKey(webcrypto), uuidV4);
});
test('non-secure HTTP Crypto uses all 16 secure random bytes and sets v4/variant bits', () => {
  for (const byte of [0, 255]) {
    let requested = 0;
    const value = createIdempotencyKey({ getRandomValues(bytes) {
      assert.equal(bytes.length, 16);
      requested++;
      return bytes.fill(byte);
    } });
    assert.equal(requested, 1);
    assert.equal(value, byte === 0 ? '00000000-0000-4000-8000-000000000000' : 'ffffffff-ffff-4fff-bfff-ffffffffffff');
    assert.match(value, uuidV4);
  }
});
test('HTTP fallback produces distinct UUIDv4 keys using real secure entropy', () => {
  const source = { getRandomValues: (bytes: Uint8Array) => webcrypto.getRandomValues(bytes) };
  const values = Array.from({ length: 256 }, () => createIdempotencyKey(source));
  for (const value of values) assert.match(value, uuidV4);
  assert.equal(new Set(values).size, values.length);
});
test('failure to obtain secure entropy is surfaced without an insecure fallback', () => {
  assert.throws(() => createIdempotencyKey({ getRandomValues() { throw new Error('Entropy unavailable'); } }), /Entropy unavailable/);
});

test('missing secure Crypto API is rejected instead of fabricating a key', () => {
  assert.throws(() => createIdempotencyKey({} as Crypto), /Secure random number generation is unavailable/);
});
