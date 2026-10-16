/**
 * Quote transfer fees and sign and verify messages:
 *   - quoteSendTransaction  (estimate a transfer fee, no send)
 *   - sign / verify         (sign an arbitrary message, then verify it)
 *
 * These operations do not submit transactions. The account must exist on-chain.
 * Run: npm run example:verify
 */

import WalletManagerConcordium, { CONCORDIUM_TESTNET_CONFIG } from '../index.js';

const TEST_SEED =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about';

const config = {
  ...CONCORDIUM_TESTNET_CONFIG,
};

async function main() {
  const manager = new WalletManagerConcordium(TEST_SEED, config);
  const account = await manager.getAccountByPath('0/899424164/0');
  const address = await account.getAddress();
  console.log('Account:', address);

  console.log('\n[A] quoteSendTransaction — estimate fee for sending 1 CCD...');
  try {
    const q = await account.quoteSendTransaction({ to: address, value: 1_000_000n });
    console.log('    ✅ estimated fee (microCCD):', q.fee.toString());
  } catch (e) {
    console.log('    ⚠️ ', e.message);
  }

  console.log('\n[B] sign — sign an arbitrary message...');
  let signature;
  try {
    signature = await account.sign('hello concordium');
    console.log('    ✅ signature:', signature.slice(0, 80) + (signature.length > 80 ? '…' : ''));
  } catch (e) {
    console.log('    ⚠️ ', e.message);
  }

  console.log('\n[C] verify — verify the signature just produced...');
  if (signature) {
    try {
      const ok = await account.verify('hello concordium', signature);
      console.log('    verify result:', ok === true ? '✅ true (valid)' : '⚠️  ' + ok);
      const tampered = await account.verify('a different message', signature);
      console.log('    verify wrong message:', tampered === false ? '✅ false (correctly rejected)' : '⚠️  ' + tampered);
    } catch (e) {
      console.log('    ⚠️ ', e.message);
    }
  } else {
    console.log('    (skipped — no signature from step B)');
  }

  manager.dispose();
  console.log('\nDone.');
}

main().catch((e) => { console.error('Unexpected failure:', e); process.exit(1); });
