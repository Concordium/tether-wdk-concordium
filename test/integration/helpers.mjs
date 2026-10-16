/** Live testnet fixtures. Never fall back to the public unit-test mnemonic. */
import WalletManagerConcordium from '../../index.js';
import { CONFIG as UNIT_CONFIG } from '../helpers.mjs';

export { PLT_TOKEN, CIS2_TOKEN, submissionStatus } from '../helpers.mjs';
export const RUN_WRITE = process.env.WRITE === '1';
export const KNOWN_ADDRESS = process.env.TESTNET_ADDRESS;

if (!process.env.TESTNET_SEED || !KNOWN_ADDRESS) {
  throw new Error('Integration tests require TESTNET_SEED and TESTNET_ADDRESS in the environment.');
}

function indexFromEnvironment(name, fallback) {
  const value = process.env[name] ?? String(fallback);
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return Number(value);
}

export function makeManager() {
  return new WalletManagerConcordium(process.env.TESTNET_SEED, {
    ...UNIT_CONFIG,
    walletProxy: process.env.WALLET_PROXY || 'https://wallet-proxy.testnet.concordium.com',
    identityProviderIndex: indexFromEnvironment('TESTNET_PROVIDER_INDEX', UNIT_CONFIG.identityProviderIndex),
    identityIndex: indexFromEnvironment('TESTNET_IDENTITY_INDEX', UNIT_CONFIG.identityIndex),
  });
}
