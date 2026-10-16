/** Live testnet fixtures. Never fall back to the public unit-test mnemonic. */
import WalletManagerConcordium from '../../index.js';
import { CONFIG as UNIT_CONFIG, IDENTITY_COORDINATES as UNIT_IDENTITY } from '../helpers.mjs';

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

export const IDENTITY_COORDINATES = {
  providerIndex: indexFromEnvironment('TESTNET_PROVIDER_INDEX', UNIT_IDENTITY.providerIndex),
  identityIndex: indexFromEnvironment('TESTNET_IDENTITY_INDEX', UNIT_IDENTITY.identityIndex),
};
export const ACCOUNT_PATH = `${IDENTITY_COORDINATES.providerIndex}/${IDENTITY_COORDINATES.identityIndex}/0`;

export function makeManager() {
  return new WalletManagerConcordium(process.env.TESTNET_SEED, {
    ...UNIT_CONFIG,
    walletProxy: process.env.WALLET_PROXY || 'https://wallet-proxy.testnet.concordium.com',
  });
}
