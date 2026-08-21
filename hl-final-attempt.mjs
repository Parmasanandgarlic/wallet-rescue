// hl-final-attempt.mjs
// Historical experimental Hyperliquid remediation variants. STATE-CHANGING.

import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  requireLiveExecution({ address: account.address });
  console.warn(`Experimental Hyperliquid remediation enabled for ${account.address}.`);

  console.log('Attempt 1: convertToMultiSigUser({ signers: [], threshold: 0 })');
  try {
    const result = await exchange.convertToMultiSigUser({ signers: [], threshold: 0 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (error) {
    console.log('FAILED:', error.message);
  }

  console.log('\nAttempt 2: self signer, threshold 1');
  try {
    const result = await exchange.convertToMultiSigUser({ signers: [{ address: account.address }], threshold: 1 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (error) {
    console.log('FAILED:', error.message);
  }

  console.log('\nAttempt 3: signer as address string');
  try {
    const result = await exchange.convertToMultiSigUser({ signers: [account.address], threshold: 1 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (error) {
    console.log('FAILED:', error.message);
  }

  console.log('\nAttempt 4: cSignerAction variants');
  for (const type of ['convertToMultiSigUser', 'removeMultiSig', 'removeSigner', 'revokeMultiSig', 'resetMultiSig']) {
    try {
      const result = await exchange.cSignerAction({ type, signers: [], threshold: 0 });
      console.log(`SUCCESS ${type}:`, JSON.stringify(result));
      return;
    } catch (error) {
      console.log(`FAILED ${type}: ${error.message?.slice(0, 100)}`);
    }
  }

  console.log('\nAll code-level attempts exhausted. Hyperliquid support is the remaining preferred path.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
