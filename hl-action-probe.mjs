// hl-action-probe.mjs
// Experimental, STATE-CHANGING Hyperliquid recovery probe.
// Use hl-check-multisig.mjs first. This file will not run without the shared
// --execute + EXPECTED_WALLET safety gate.

import { ExchangeClient, InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const WALLET = account.address;
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const info = new InfoClient({ transport });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  requireLiveExecution({ address: WALLET });
  console.warn('STATE-CHANGING Hyperliquid probe enabled. Use only for the explicitly verified recovery wallet.');

  try {
    const state = await info.clearinghouseState({ user: WALLET });
    console.log(`Account Value: $${state.marginSummary?.accountValue}`);
    console.log(`Withdrawable: $${state.withdrawable}`);
  } catch (error) {
    console.log(`Account-state error: ${error.message}`);
  }

  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(exchange)).filter((method) => method !== 'constructor');
  console.log(`Available ExchangeClient methods: ${methods.join(', ')}`);

  // Historical recovery probes retained for reproducibility. They may mutate
  // account authorization or submit signed actions; the shared gate above is mandatory.
  try {
    const result = await exchange.approveAgent({
      agentAddress: '0x0000000000000000000000000000000000000001',
      agentName: 'wallet-rescue-probe',
    });
    console.log('approveAgent result:', JSON.stringify(result));
  } catch (error) {
    console.log('approveAgent error:', error.message);
  }

  try {
    if (typeof exchange.noop === 'function') {
      console.log('noop result:', JSON.stringify(await exchange.noop()));
    }
  } catch (error) {
    console.log(`noop error: ${error.message}`);
  }

  try {
    if (typeof exchange.withdraw3 === 'function') {
      console.log('withdraw result:', JSON.stringify(await exchange.withdraw3({ amount: '0.01', destination: WALLET })));
    } else if (typeof exchange.withdraw === 'function') {
      console.log('withdraw result:', JSON.stringify(await exchange.withdraw({ amount: '0.01', destination: WALLET })));
    }
  } catch (error) {
    console.log('withdraw error:', error.message);
  }

  try {
    if (typeof exchange.usdSend === 'function') {
      console.log('usdSend result:', JSON.stringify(await exchange.usdSend({ amount: '0.01', destination: WALLET })));
    }
  } catch (error) {
    console.log('usdSend error:', error.message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
