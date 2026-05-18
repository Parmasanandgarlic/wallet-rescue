// hl-force-multisig-removal.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Last resort: Try to use convertToMultiSigUser with empty signers
// to convert the account back to a normal EOA.
// ─────────────────────────────────────────────────────────────────────────────

import { ExchangeClient, InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(COMPROMISED_KEY);
const WALLET = account.address;

const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FORCE MULTI-SIG REMOVAL ATTEMPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Wallet: ${WALLET}\n`);

  // ── Attempt 1: convertToMultiSigUser with empty signers ────────────────
  console.log('── Attempt 1: convertToMultiSigUser(empty) directly ────────\n');
  try {
    const result = await exchange.convertToMultiSigUser({
      authorizedUsers: [],
      threshold: 0,
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(result));
    console.log('  🎉 MULTI-SIG REMOVED! Account is back to normal EOA!');
    return; // We're done!
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }

  // ── Attempt 2: convertToMultiSigUser with only our address ─────────────
  console.log('\n── Attempt 2: convertToMultiSigUser(self only, threshold=1) ─\n');
  try {
    const result = await exchange.convertToMultiSigUser({
      authorizedUsers: [WALLET],
      threshold: 1,
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(result));
    console.log('  🎉 Multi-sig now only has YOUR address as sole signer!');
    return;
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }

  // ── Attempt 3: Try noop through the exchange client ────────────────────
  // Sometimes multi-sig errors include the config details
  console.log('\n── Attempt 3: Detailed error extraction ────────────────────\n');
  try {
    await exchange.noop();
  } catch (e) {
    const full = JSON.stringify(e, Object.getOwnPropertyNames(e));
    console.log('  Full noop error object:');
    console.log(`  ${full}`);
  }

  // ── Attempt 4: Check if there's a multiSig method on exchange ──────────
  console.log('\n── Attempt 4: Try cSignerAction or subAccountModify ────────\n');

  // Check cSignerAction — this might be related to multi-sig signer ops
  try {
    if (typeof exchange.cSignerAction === 'function') {
      console.log('  cSignerAction exists! Trying to remove signer...');
      // Try various payloads to see what this method accepts
      try {
        const r = await exchange.cSignerAction({
          type: 'removeAuthorizedUser',
          user: '0x0000000000000000000000000000000000000000', // dummy
        });
        console.log('  Result:', JSON.stringify(r));
      } catch (e2) {
        console.log('  cSignerAction error:', e2.message);
      }
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }

  // ── Result summary ─────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ❌ ALL ATTEMPTS FAILED');
  console.log('');
  console.log('  The multi-sig is enforced at the protocol level.');
  console.log('  Your key alone cannot bypass it.');
  console.log('');
  console.log('  ONLY Hyperliquid support can resolve this.');
  console.log('  Share all script output with them as evidence.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
