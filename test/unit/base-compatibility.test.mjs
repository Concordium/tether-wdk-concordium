/** Compatibility with the WDK base classes; no external services. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WalletAccountReadOnly, NotImplementedError } from '@tetherto/wdk-wallet';
import { makeManager } from '../helpers.mjs';
import * as publicApi from '../../index.js';

test('onboarding is not part of the public API', () => {
  assert.equal('ConcordiumOnboarding' in publicApi, false);
  const manager = makeManager();
  try {
    assert.equal('getOnboarding' in manager, false);
  } finally {
    manager.dispose();
  }
});

test('accounts inherit the read-only base and expose their disposal state', async () => {
  const manager = makeManager();
  try {
    const account = await manager.getAccountByPath('0/0/0');
    assert.ok(account instanceof WalletAccountReadOnly);
    assert.equal(account.disposed, false);
    manager.dispose();
    assert.equal(account.disposed, true);
  } finally {
    manager.dispose();
  }
});

test('normalized transaction receipts remain explicitly unsupported', async () => {
  const manager = makeManager();
  try {
    const account = await manager.getAccountByPath('0/0/0');
    await assert.rejects(() => account.getTransaction('unused'), NotImplementedError);
  } finally {
    manager.dispose();
  }
});
