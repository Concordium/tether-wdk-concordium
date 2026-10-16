/**
 * Read account addresses and CCD balances on Concordium testnet.
 *
 * Retrieves an existing account by its provider/identity/credential path,
 * then reads its balance both by explicit address and through the account API.
 *
 * Run:  npm install   (once)
 *       npm run example
 */

import WalletManagerConcordium, { AccountNotCreatedError, CONCORDIUM_TESTNET_CONFIG } from '../index.js';

// Public test mnemonic for the account at path 0/899424164/0. Never use for real funds.
const TEST_SEED =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about';
const KNOWN_ACCOUNT = '3GEmZc57STNxVqWykUceXAeCVsDzaogq6wNZhDLAV8bRNYzUYd';

const wdkLikeConfig = {
  ...CONCORDIUM_TESTNET_CONFIG,
};

async function main() {
  const manager = new WalletManagerConcordium(TEST_SEED, wdkLikeConfig);
  const account = await manager.getAccountByPath('0/899424164/0');

  console.log('Account path (provider/identity/cred):', account.path);

  // Read a known account's balance by explicit address.
  console.log('\n[1] Reading the known testnet account by address...');
  try {
    const bal = await account.getBalanceForAddress(KNOWN_ACCOUNT);
    console.log('    ✅ balance (microCCD):', bal.toString(), '  (0 = created but unfunded)');
  } catch (e) {
    console.log('    ❌', e.message);
  }

  // Read the verified account address and balance through the WDK interface.
  console.log('\n[2] Reading the account address via getAddress()...');
  try {
    const addr = await account.getAddress();
    console.log('    address:', addr);
    console.log('    matches known account:', addr === KNOWN_ACCOUNT ? '✅ yes' : '⚠️  no');
    const bal = await account.getBalance();
    console.log('    ✅ getBalance (microCCD):', bal.toString());
  } catch (e) {
    if (e instanceof AccountNotCreatedError) console.log('    (account not created yet):', e.message);
    else console.log('    ⚠️  Account read failed:\n       ', e.message);
  }

  manager.dispose();
  console.log('\nDone.');
}

main().catch((e) => { console.error('Unexpected failure:', e); process.exit(1); });
