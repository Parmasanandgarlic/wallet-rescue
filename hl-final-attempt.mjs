// hl-final-attempt.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Final attempts with correct parameter names
// ─────────────────────────────────────────────────────────────────────────────

import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(COMPROMISED_KEY);

const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const exchange = new ExchangeClient({ transport, wallet: account });

async function main() {
  console.log(`Wallet: ${account.address}\n`);

  // Attempt 1: convertToMultiSigUser with correct "signers" field
  console.log('── Attempt 1: convertToMultiSigUser({ signers: [], threshold: 0 }) ──');
  try {
    const r = await exchange.convertToMultiSigUser({ signers: [], threshold: 0 });
    console.log('  ✅ SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('  ❌', e.message);
  }

  // Attempt 2: with just our address
  console.log('\n── Attempt 2: convertToMultiSigUser({ signers: [self], threshold: 1 }) ──');
  try {
    const r = await exchange.convertToMultiSigUser({
      signers: [{ address: account.address }],
      threshold: 1,
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('  ❌', e.message);
  }

  // Attempt 3: signers as plain address strings
  console.log('\n── Attempt 3: signers as string array ──');
  try {
    const r = await exchange.convertToMultiSigUser({
      signers: [account.address],
      threshold: 1,
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(r));
    return;
  } catch (e) {
    console.log('  ❌', e.message);
  }

  // Attempt 4: probe cSignerAction types
  console.log('\n── Attempt 4: cSignerAction with various types ──');
  const signerActions = [
    'convertToMultiSigUser',
    'removeMultiSig',
    'removeSigner',
    'revokeMultiSig',
    'resetMultiSig',
  ];
  for (const type of signerActions) {
    try {
      const r = await exchange.cSignerAction({
        type,
        signers: [],
        threshold: 0,
      });
      console.log(`  ✅ ${type}:`, JSON.stringify(r));
      return;
    } catch (e) {
      console.log(`  ❌ ${type}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  All code-level attempts exhausted.');
  console.log('  Hyperliquid support is the only path forward.');
  console.log('══════════════════════════════════════════════════');
}

main().catch(console.error);
