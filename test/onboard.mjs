/**
 * Internal testnet setup — create a brand-new Concordium test account.
 *
 * Uses the internal ConcordiumOnboarding helper, not the public package API.
 * Two steps with a one-time browser step between them:
 *
 *   npm run test:onboard:request
 *     -> prints an issuance URL. Open it; the test provider auto-verifies and
 *        redirects to http://localhost:4000/callback#code_uri=...  (that page
 *        fails to load — expected). Paste that full URL into callback.txt.
 *
 *   npm run test:onboard:create
 *     -> reads callback.txt, retrieves the identity, creates the account, and
 *        then reads the new account's balance back through the WDK interface.
 *
 * A fresh random identity index is used each request (so idCredPub is unique)
 * and saved to onboard-state.json so step 2 matches step 1.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import WalletManagerConcordium, { CONCORDIUM_TESTNET_CONFIG } from '../index.js';
import ConcordiumOnboarding from './helpers/ConcordiumOnboarding.js';

const TEST_SEED =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about';
const STATE = './onboard-state.json';
const CALLBACK = './callback.txt';

function baseConfig() {
  return {
    ...CONCORDIUM_TESTNET_CONFIG,
  };
}

async function doRequest() {
  const identityIndex = Math.floor(Math.random() * 2 ** 31);
  writeFileSync(STATE, JSON.stringify({ identityIndex }, null, 2));

  const manager = new WalletManagerConcordium(TEST_SEED, baseConfig());
  const onboarding = new ConcordiumOnboarding(manager);

  const { issuanceUrl } = await onboarding.createIdentityRequest({ providerIndex: 0, identityIndex });
  console.log('Fresh identity index:', identityIndex, '(saved to onboard-state.json)');
  console.log('\n1. Open this URL in a browser:\n');
  console.log('   ' + issuanceUrl + '\n');
  console.log('2. It redirects to http://localhost:4000/callback#code_uri=... (page fails to load — fine).');
  console.log('   Paste that full address-bar URL into a file named callback.txt in this folder.');
  console.log('3. Run:  npm run test:onboard:create');
  manager.dispose();
}

async function doCreate() {
  if (!existsSync(STATE)) throw new Error('Run "npm run test:onboard:request" first.');
  if (!existsSync(CALLBACK)) throw new Error('Paste the callback URL into callback.txt first.');
  const { identityIndex } = JSON.parse(readFileSync(STATE, 'utf8'));
  const callbackUrl = readFileSync(CALLBACK, 'utf8').trim();

  const manager = new WalletManagerConcordium(TEST_SEED, baseConfig());
  const onboarding = new ConcordiumOnboarding(manager);

  console.log('Retrieving the issued identity (polling the provider)...');
  const identityObject = await onboarding.retrieveIdentity(callbackUrl);
  console.log('  ✅ identity issued.');

  console.log('Creating the on-chain account...');
  const { address } = await onboarding.createAccount({ identityObject, providerIndex: 0, identityIndex });
  console.log('  🎉 account created:', address);

  // Read the newly created account through the standard account interface.
  console.log('\nReading the new account through the WDK interface...');
  const account = await manager.getAccountByPath(`0/${identityIndex}/0`);
  const derived = await account.getAddress();
  console.log('  getAddress():', derived, derived === address ? '✅ matches' : '⚠️  mismatch');
  await new Promise((r) => setTimeout(r, 12000));   // let it finalize
  const bal = await account.getBalanceForAddress(address);
  console.log('  getBalance():', bal.toString(), 'microCCD (0 = created, unfunded)');

  manager.dispose();
}

const mode = process.argv[2];
(async () => {
  if (mode === 'request') await doRequest();
  else if (mode === 'create') await doCreate();
  else { console.log('Usage: node test/onboard.mjs request | create'); }
})().catch((e) => { console.error('Failed:', e); process.exit(1); });
