// hl-remove-multisig.mjs
// Hyperliquid multi-sig probe/removal attempts. Wallet key is runtime-only.

import { ExchangeClient, InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const WALLET = account.address;
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const info = new InfoClient({ transport });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  console.log(`Hyperliquid multi-sig probe for ${WALLET}\n`);

  try {
    const state = await info.clearinghouseState({ user: WALLET });
    console.log(`Account Value: $${state.marginSummary?.accountValue}`);
    console.log(`Withdrawable: $${state.withdrawable}`);
  } catch (e) {
    console.log(`Account-state error: ${e.message}`);
  }

  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(exchange)).filter((m) => m !== 'constructor');
  console.log(`Available ExchangeClient methods: ${methods.join(', ')}`);

  try {
    const result = await exchange.approveAgent({
      agentAddress: '0x0000000000000000000000000000000000000001',
      agentName: 'Fbb67df966962',
    });
    console.log('approveAgent result:', JSON.stringify(result));
  } catch (e) {
    console.log('approveAgent error:', e.message);
  }

  try {
    if (typeof exchange.noop === 'function') {
      const r = await exchange.noop();
      console.log('noop result:', JSON.stringify(r));
    } else {
      console.log('No noop method on ExchangeClient.');
    }
  } catch (e) {
    console.log(`noop error: ${e.message}`);
  }

  try {
    if (typeof exchange.withdraw3 === 'function') {
      const r = await exchange.withdraw3({ amount: '0.01', destination: WALLET });
      console.log('withdraw result:', JSON.stringify(r));
    } else if (typeof exchange.withdraw === 'function') {
      const r = await exchange.withdraw({ amount: '0.01', destination: WALLET });
      console.log('withdraw result:', JSON.stringify(r));
    }
  } catch (e) {
    console.log('withdraw error:', e.message);
  }

  try {
    if (typeof exchange.usdSend === 'function') {
      const r = await exchange.usdSend({ amount: '0.01', destination: WALLET });
      console.log('usdSend result:', JSON.stringify(r));
    }
  } catch (e) {
    console.log('usdSend error:', e.message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
