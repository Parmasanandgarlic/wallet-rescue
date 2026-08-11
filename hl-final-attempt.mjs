// hl-final-attempt.mjs
// Final Hyperliquid remediation attempts. Wallet key is runtime-only.

import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  console.log(`Wallet: ${account.address}\n`);

  console.log('Attempt 1: convertToMultiSigUser({ signers: [], threshold: 0 })');
  try {
    const r = await exchange.convertToMultiSigUser({ signers: [], threshold: 0 });
    console.log('SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('FAILED:', e.message);
  }

  console.log('\nAttempt 2: self signer, threshold 1');
  try {
    const r = await exchange.convertToMultiSigUser({
      signers: [{ address: account.address }],
      threshold: 1,
    });
    console.log('SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('FAILED:', e.message);
  }

  console.log('\nAttempt 3: signer as address string');
  try {
    const r = await exchange.convertToMultiSigUser({
      signers: [account.address],
      threshold: 1,
    });
    console.log('SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('FAILED:', e.message);
  }

  console.log('\nAttempt 4: cSignerAction variants');
  for (const type of ['convertToMultiSigUser', 'removeMultiSig', 'removeSigner', 'revokeMultiSig', 'resetMultiSig']) {
    try {
      const r = await exchange.cSignerAction({ type, signers: [], threshold: 0 });
      console.log(`SUCCESS ${type}:`, JSON.stringify(r));
      return;
    } catch (e) {
      console.log(`FAILED ${type}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log('\nAll code-level attempts exhausted. Hyperliquid support is the remaining path.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
