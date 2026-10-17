/** Disposal removes key material; no external services. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DisposalError } from '@tetherto/wdk-wallet';
import { makeManager, ACCOUNT_PATH } from '../helpers.mjs';

test('dispose zeroes the seed bytes and drops the seed', () => {
  const manager = makeManager();
  const seed = manager.seed;
  assert.ok(seed.some((byte) => byte !== 0), 'the seed starts out non-zero');

  manager.dispose();
  assert.equal(manager.seed, undefined);
  assert.ok(seed.every((byte) => byte === 0), 'the bytes that held the seed are now zero');
});

test('accounts cannot be derived after dispose', async () => {
  const manager = makeManager();
  manager.dispose();
  await assert.rejects(() => manager.getAccountByPath(ACCOUNT_PATH), DisposalError);
});
