// hl-force-multisig-removal.mjs
// Last-resort Hyperliquid multi-sig remediation attempts. Key is runtime-only.

import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const WALLET = account.address;
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  console.log(`Force multi-sig removal attempt for ${WALLET}\n`);

  console.log('Attempt 1: convertToMultiSigUser(empty)');
  try {
    const result = await exchange.convertToMultiSigUser({ authorizedUsers: [], threshold: 0 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (e) {
    console.log('FAILED:', e.message);
  }

  console.log('\nAttempt 2: self only, threshold=1');
  try {
    const result = await exchange.convertToMultiSigUser({ authorizedUsers: [WALLET], threshold: 1 });
    console.log('SUCCESS:', JSON.stringify(result));
    return;
  } catch (e) {
    console.log('FAILED:', e.message);
  }

  console.log('\nAttempt 3: detailed noop error');
  try {
    await exchange.noop();
  } catch (e) {
    console.log(JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }

  console.log('\nAttempt 4: cSignerAction probe');
  try {
    if (typeof exchange.cSignerAction === 'function') {
      try {
        const r = await exchange.cSignerAction({
          type: 'removeAuthorizedUser',
          user: '0x0000000000000000000000000000000000000000',
        });
        console.log('Result:', JSON.stringify(r));
      } catch (e2) {
        console.log('cSignerAction error:', e2.message);
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\nAll attempts failed. Protocol-level multi-sig remediation requires the supported Hyperliquid path.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
