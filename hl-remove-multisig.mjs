// hl-remove-multisig.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Attempt to query and remove multi-sig from Hyperliquid account.
// ─────────────────────────────────────────────────────────────────────────────

import { ExchangeClient, InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(COMPROMISED_KEY);
const WALLET = account.address;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  HYPERLIQUID MULTI-SIG PROBE & REMOVAL ATTEMPT');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Wallet: ${WALLET}\n`);

const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const info = new InfoClient({ transport });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  // ── Step 1: Check account state via info client ─────────────────────────
  console.log('── Step 1: Account State ───────────────────────────────────\n');
  try {
    const state = await info.clearinghouseState({ user: WALLET });
    console.log(`  Account Value: $${state.marginSummary?.accountValue}`);
    console.log(`  Withdrawable:  $${state.withdrawable}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  // ── Step 2: List exchange client methods ────────────────────────────────
  console.log('\n── Step 2: Available ExchangeClient methods ────────────────\n');
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(exchange))
    .filter(m => m !== 'constructor');
  console.log(`  Methods: ${methods.join(', ')}`);

  // ── Step 3: Try to deregister the suspicious agent ─────────────────────
  console.log('\n── Step 3: Attempting to deregister agent "Fbb67df966962" ──\n');
  try {
    // Try registering a new agent with the same name to replace it
    // (per docs, same-name approval replaces the old agent)
    const result = await exchange.approveAgent({
      agentAddress: '0x0000000000000000000000000000000000000001',
      agentName: 'Fbb67df966962',
    });
    console.log('  ✅ Result:', JSON.stringify(result));
  } catch (e) {
    console.log('  ❌ Error:', e.message);
    // The error message is critical — it tells us if multi-sig is blocking
    if (e.message?.includes('multi') || e.message?.includes('Multi')) {
      console.log('\n  ⚠️  CONFIRMED: Multi-sig is blocking this action.');
      console.log('  The account requires multiple signatures for user-signed actions.');
    }
  }

  // ── Step 4: Try a simple noop to test signing ──────────────────────────
  console.log('\n── Step 4: Attempting noop (test basic signing) ────────────\n');
  try {
    // Raw fetch with proper EIP-712 signing would be needed
    // Let's see if the exchange client has a noop or generic method
    if (typeof exchange.noop === 'function') {
      const r = await exchange.noop();
      console.log('  Noop result:', JSON.stringify(r));
    } else {
      console.log('  No noop method on ExchangeClient. Trying raw API...');

      // Attempt raw signed request
      const res = await fetch('https://api.hyperliquid.xyz/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'noop' },
          nonce: Date.now(),
          // We need proper EIP-712 signature here
          // The error without it will still be informative
          signature: {
            r: '0x0000000000000000000000000000000000000000000000000000000000000001',
            s: '0x0000000000000000000000000000000000000000000000000000000000000001',
            v: 27,
          },
        }),
      });
      const text = await res.text();
      console.log(`  Raw noop response: ${text}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  // ── Step 5: Try to withdraw the dust (will reveal multi-sig error) ─────
  console.log('\n── Step 5: Attempting withdrawal of $0.01 (reveals multi-sig config) ──\n');
  try {
    if (typeof exchange.withdraw3 === 'function') {
      const r = await exchange.withdraw3({
        amount: '0.01',
        destination: WALLET,
      });
      console.log('  ✅ Withdraw result:', JSON.stringify(r));
    } else if (typeof exchange.withdraw === 'function') {
      const r = await exchange.withdraw({
        amount: '0.01',
        destination: WALLET,
      });
      console.log('  ✅ Withdraw result:', JSON.stringify(r));
    } else {
      console.log('  No withdraw method found. Available:', methods.join(', '));
    }
  } catch (e) {
    console.log('  ❌ Withdraw error:', e.message);
    console.log('  Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 500));
  }

  // ── Step 6: Try usdSend ────────────────────────────────────────────────
  console.log('\n── Step 6: Attempting usdSend (another user-signed action test) ──\n');
  try {
    if (typeof exchange.usdSend === 'function') {
      const r = await exchange.usdSend({
        amount: '0.01',
        destination: WALLET,
      });
      console.log('  ✅ usdSend result:', JSON.stringify(r));
    } else {
      console.log('  No usdSend method found.');
    }
  } catch (e) {
    console.log('  ❌ usdSend error:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DONE — share all output with Hyperliquid support');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
