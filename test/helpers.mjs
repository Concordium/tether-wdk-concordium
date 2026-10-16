/**
 * Shared fixtures and helpers for the test suite.
 *
 * Public unit-test fixtures shared with the example scripts. The mnemonic is
 * publicly known and must never be used to secure real funds.
 */

import WalletManagerConcordium, { CONCORDIUM_TESTNET_CONFIG } from '../index.js';

/** Well-known BIP-39 test seed (public; used across the examples). */
export const TEST_SEED =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about';

/** Public testnet connectivity configuration. */
export const CONFIG = {
  ...CONCORDIUM_TESTNET_CONFIG,
};

export const IDENTITY_COORDINATES = { providerIndex: 0, identityIndex: 899424164 };
export const ACCOUNT_PATH = '0/899424164/0';

/** The address derived from ACCOUNT_PATH on testnet (deterministic). */
export const KNOWN_ADDRESS = '3GEmZc57STNxVqWykUceXAeCVsDzaogq6wNZhDLAV8bRNYzUYd';

/** Tokens the test account holds on testnet. */
export const PLT_TOKEN = process.env.PLT_TOKEN || 'TN';
export const CIS2_TOKEN = process.env.CIS2_TOKEN || 'cis2:12754:0:01';

export const WALLET_PROXY =
  process.env.WALLET_PROXY || 'https://wallet-proxy.testnet.concordium.com';

/** True when write (money-moving) tests should run. */
export const RUN_WRITE = !!process.env.WRITE;

/** Offline unit-test manager: credential lookup is stubbed. Remember to dispose() it. */
export function makeManager(config = CONFIG) {
  const manager = new WalletManagerConcordium(TEST_SEED, config);
  manager._lookupAccountInfo = async () => ({ accountAddress: KNOWN_ADDRESS });
  return manager;
}

/** Query the real on-chain outcome of a submitted transaction (for write tests). */
export async function submissionStatus(hash) {
  try {
    const res = await fetch(`${WALLET_PROXY}/v0/submissionStatus/${hash}`);
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Build a minimal fake gRPC client for the mocked (offline) unit tier.
 * Only the methods a test needs are provided; anything else throws so an
 * accidental real dependency is caught rather than silently passing.
 *
 * @param {object} behaviour
 * @param {(addr:any)=>any} [behaviour.getAccountInfo] - return value or throw.
 */
export function fakeClient(behaviour = {}) {
  const notWired = (name) => () => {
    throw new Error(`fakeClient.${name} was called but not wired up in this test`);
  };
  return {
    getAccountInfo: behaviour.getAccountInfo ?? notWired('getAccountInfo'),
    getNextAccountNonce: behaviour.getNextAccountNonce ?? notWired('getNextAccountNonce'),
    getBlockChainParameters: behaviour.getBlockChainParameters ?? notWired('getBlockChainParameters'),
  };
}
