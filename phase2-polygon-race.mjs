// phase2-polygon-race.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Revokes a malicious EIP-7702 delegation on POLYGON only.
// ⚡ This is the "race" script — run it the INSTANT your funding tx lands
//    to beat the sweeper bot to the gas.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createWalletClient,
  http,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

// ── Account Setup ────────────────────────────────────────────────────────────
const PRIVATE_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(PRIVATE_KEY);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  EIP-7702 DELEGATION REVOCATION — PHASE 2: POLYGON RACE');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Account: ${account.address}`);
console.log(`  Chain:   Polygon (ID: ${polygon.id})`);
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Revocation Logic ─────────────────────────────────────────────────────────
async function revokeOnPolygon() {
  try {
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });

    // Step 1: Sign an authorization that points to the zero address.
    console.log('⏳ Signing revocation authorization (target: zero address)...');
    const authorization = await walletClient.signAuthorization({
      contractAddress: zeroAddress,
      executor: 'self',
    });
    console.log('✅ Authorization signed.');

    // Step 2: Send a Type 4 (EIP-7702) transaction to self with the revocation.
    console.log('⏳ Broadcasting revocation transaction on Polygon...');
    console.log('   (Racing the sweeper bot — this needs to land first!)');
    const txHash = await walletClient.sendTransaction({
      to: account.address,
      authorizationList: [authorization],
      value: 0n,
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ SUCCESS — POLYGON REVOCATION SENT!');
    console.log(`  📝 TX Hash: ${txHash}`);
    console.log(`  🔍 View on PolygonScan: https://polygonscan.com/tx/${txHash}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎉 Delegation revoked! Your wallet should now be a normal EOA');
    console.log('   on ALL chains. Verify on a block explorer to confirm.');
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  ❌ FAILED — POLYGON REVOCATION DID NOT GO THROUGH');
    console.error(`  Error: ${error.shortMessage || error.message}`);
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('💡 The sweeper bot may have drained the gas. Try again:');
    console.error('   1. Send another 0.05 POL from your clean wallet.');
    console.error('   2. Immediately run: node phase2-polygon-race.mjs');
    process.exit(1);
  }
}

revokeOnPolygon().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
