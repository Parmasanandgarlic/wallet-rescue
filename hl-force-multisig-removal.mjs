// hl-force-multisig-removal.mjs
// Experimental last-resort Hyperliquid multi-sig remediation attempts.

import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const WALLET = account.address;
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  requireLiveExecution({ address: WALLET });
  console.warn(`Experimental multi-sig remediation enabled for ${WALLET}.`);

  console.log('Attempt 1: convertToMultiSigUser(empty)');
  try {
    const result = await exchange.convertToMultiSigUser({ authorizedUsers: [], threshold: 0 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (error) {
    console.log('FAILED:', error.message);
  }

  console.log('\nAttempt 2: self only, threshold=1');
  try {
    const result = await exchange.convertToMultiSigUser({ authorizedUsers: [WALLET], threshold: 1 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (error) {
    console.log('FAILED:', error.message);
  }

  console.log('\nAttempt 3: detailed noop error');
  try {
    await exchange.noop();
  } catch (error) {
    console.log(JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }

  console.log('\nAttempt 4: cSignerAction probe');
  if (typeof exchange.cSignerAction === 'function') {
    try {
      const result = await exchange.cSignerAction({
        type: 'removeAuthorizedUser',
        user: '0x0000000000000000000000000000000000000000',
      });
      console.log('Result:', JSON.stringify(result));
    } catch (error) {
      console.log('cSignerAction error:', error.message);
    }
  }

  console.log('\nAll attempts failed. Prefer the supported Hyperliquid recovery/support path over further speculative writes.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
