/** Configuration validation and presets, without external services. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WalletManagerConcordium, {
  ConcordiumOnboarding,
  CONCORDIUM_MAINNET_CONFIG,
  CONCORDIUM_TESTNET_CONFIG,
} from '../../index.js';
import * as sdk from '@concordium/web-sdk';
import { TEST_SEED } from '../helpers.mjs';

const custom = { useMainnetKeyDerivation: false, grpcUrl: 'http://localhost:20000' };

test('configuration and a boolean derivation choice are required', () => {
  for (const config of [undefined, null, [], {}, ...[undefined, null, '', 0, 1, 'false'].map(
    useMainnetKeyDerivation => ({ ...custom, useMainnetKeyDerivation })
  )]) {
    assert.throws(() => new WalletManagerConcordium(TEST_SEED, config), /configuration|useMainnetKeyDerivation/);
  }
});

test('gRPC URLs require HTTP(S), valid ports, and no routing or authentication details', () => {
  for (const grpcUrl of [undefined, null, 42, '', 'localhost:20000', 'ftp://localhost',
    'https://localhost:0', 'https://localhost:65536', 'https://localhost:abc',
    'https://localhost/rpc', 'https://localhost/?x=1', 'https://localhost/#fragment',
    'https://localhost/?', 'https://localhost/#',
    'https://user:password@localhost']) {
    assert.throws(() => new WalletManagerConcordium(TEST_SEED, { ...custom, grpcUrl }), /config.grpcUrl/);
  }
});

test('gRPC URLs determine host, port, and TLS independently of key derivation', () => {
  for (const [grpcUrl, host, port, secure] of [
    ['https://custom.example', 'custom.example', 443, true],
    ['http://localhost', 'localhost', 80, false],
    ['https://custom.example:20000/', 'custom.example', 20000, true],
    ['http://127.0.0.1:20001', '127.0.0.1', 20001, false],
    ['http://[::1]:20000', '[::1]', 20000, false],
  ]) {
    const manager = new WalletManagerConcordium(TEST_SEED, { ...custom, grpcUrl });
    assert.deepEqual(manager._ccd.grpcEndpoint, { host, port, secure });
    assert.equal(manager._ccd.derivationNetwork, 'Testnet');
    manager.dispose();
  }
});

test('public presets provide complete connectivity and can be overridden', () => {
  for (const [preset, network] of [
    [CONCORDIUM_MAINNET_CONFIG, 'Mainnet'], [CONCORDIUM_TESTNET_CONFIG, 'Testnet'],
  ]) {
    const manager = new WalletManagerConcordium(TEST_SEED, preset);
    assert.equal(manager._ccd.derivationNetwork, network);
    assert.equal(manager._ccd.grpcEndpoint.port, 20000);
    assert.equal(manager._ccd.grpcEndpoint.secure, true);
    assert.equal(manager._ccd.walletProxy, preset.walletProxy);
    manager.dispose();
  }
  const manager = new WalletManagerConcordium(TEST_SEED, {
    ...CONCORDIUM_TESTNET_CONFIG, grpcUrl: custom.grpcUrl,
  });
  assert.equal(manager._ccd.grpcEndpoint.host, 'localhost');
  assert.equal(CONCORDIUM_TESTNET_CONFIG.grpcUrl, 'https://grpc.testnet.concordium.com:20000');
  manager.dispose();
});

test('the flag selects SDK-compatible keys without inferring from the endpoint', async () => {
  const keys = [];
  for (const useMainnetKeyDerivation of [false, true]) {
    const manager = new WalletManagerConcordium(TEST_SEED, { ...custom, useMainnetKeyDerivation });
    try {
      const account = await manager.getAccountByPath('0/0/0');
      const expected = sdk.ConcordiumHdWallet.fromHex(
        manager._seedHex, useMainnetKeyDerivation ? 'Mainnet' : 'Testnet'
      ).getAccountPublicKey(0, 0, 0);
      const actual = Buffer.from(account.keyPair.publicKey);
      assert.deepEqual(actual, Buffer.from(expected));
      keys.push(actual);
    } finally {
      manager.dispose();
    }
  }
  assert.notDeepEqual(keys[0], keys[1]);
});

test('wallet-proxy is optional for node-based operations but required for discovery and onboarding', async () => {
  const manager = new WalletManagerConcordium(TEST_SEED, custom);
  try {
    assert.ok(await manager.getAccountByPath('0/0/0'));
    const key = 'ab'.repeat(32);
    await assert.rejects(() => manager.findAccountByPublicKey(key), /config.walletProxy is required/);
    await assert.rejects(() => manager.recoverAccounts({ providerIndex: 0, identityIndex: 0 }), /config.walletProxy is required/);
    assert.throws(() => manager.getOnboarding(), /config.walletProxy is required/);
    assert.throws(() => new ConcordiumOnboarding(manager), /config.walletProxy is required/);
  } finally {
    manager.dispose();
  }
});

test('wallet-proxy must be an absolute HTTP(S) URL and supports base paths', async () => {
  for (const walletProxy of [null, '', 42, 'not-a-url', 'ftp://proxy.example']) {
    assert.throws(() => new WalletManagerConcordium(TEST_SEED, { ...custom, walletProxy }), /config.walletProxy/);
  }
  const manager = new WalletManagerConcordium(TEST_SEED, {
    ...custom, walletProxy: 'https://proxy.example/base/',
  });
  try {
    let calledUrl;
    manager._fetch = async (url) => { calledUrl = url; return { status: 404 }; };
    await manager.findAccountByPublicKey('ab'.repeat(32));
    assert.equal(calledUrl, `https://proxy.example/base/v0/keyAccounts/${'ab'.repeat(32)}`);
    assert.ok(manager.getOnboarding() instanceof ConcordiumOnboarding);
  } finally {
    manager.dispose();
  }
});
