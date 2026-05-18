// phase1-safe-chains.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Revokes a malicious EIP-7702 delegation on SAFE chains (no sweeper bot).
// Sends a Type 4 transaction with an authorization pointing to the zero address
// to revert the EOA back to a vanilla externally-owned account.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createWalletClient,
  http,
  defineChain,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  mainnet,
  bsc,
  base,
  arbitrum,
  optimism,
} from 'viem/chains';

// ── Account Setup ────────────────────────────────────────────────────────────
const PRIVATE_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(PRIVATE_KEY);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  EIP-7702 DELEGATION REVOCATION — PHASE 1: SAFE CHAINS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Account: ${account.address}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Custom Chain Definitions ─────────────────────────────────────────────────
const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: {
    name: 'BERA',
    symbol: 'BERA',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.berachain.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Berascan', url: 'https://berascan.com' },
  },
});

// ── Chains to Revoke On ──────────────────────────────────────────────────────
const chains = [
  { chain: mainnet,   label: 'Ethereum Mainnet' },
  { chain: bsc,       label: 'BNB Smart Chain'  },
  { chain: base,      label: 'Base'             },
  { chain: arbitrum,  label: 'Arbitrum One'     },
  { chain: optimism,  label: 'Optimism'         },
  { chain: berachain, label: 'Berachain'        },
];

// ── Revocation Logic ─────────────────────────────────────────────────────────
async function revokeOnChain({ chain, label }) {
  const divider = '─'.repeat(60);
  console.log(divider);
  console.log(`🔗 Chain: ${label} (ID: ${chain.id})`);
  console.log(divider);

  try {
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    // Step 1: Sign an authorization that points to the zero address.
    // This tells the network to clear any delegated code on this EOA.
    console.log('  ⏳ Signing revocation authorization (target: zero address)...');
    const authorization = await walletClient.signAuthorization({
      contractAddress: zeroAddress,
      executor: 'self',
    });
    console.log('  ✅ Authorization signed.');

    // Step 2: Send a Type 4 (EIP-7702) transaction to self with the revocation.
    console.log('  ⏳ Broadcasting revocation transaction...');
    const txHash = await walletClient.sendTransaction({
      to: account.address,
      authorizationList: [authorization],
      value: 0n,
    });

    console.log(`  ✅ SUCCESS on ${label}!`);
    console.log(`  📝 TX Hash: ${txHash}`);
    console.log('');
    return { chain: label, success: true, txHash };
  } catch (error) {
    console.error(`  ❌ FAILED on ${label}: ${error.shortMessage || error.message}`);
    console.log('');
    return { chain: label, success: false, error: error.shortMessage || error.message };
  }
}

// ── Main Execution ───────────────────────────────────────────────────────────
async function main() {
  const results = [];

  // Execute sequentially to avoid nonce collisions and to keep output readable.
  for (const entry of chains) {
    const result = await revokeOnChain(entry);
    results.push(result);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 1 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success ? r.txHash : r.error;
    console.log(`  ${icon} ${r.chain.padEnd(20)} ${detail}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} chain(s) failed. Check errors above.`);
  } else {
    console.log('\n🎉 All safe chains revoked successfully!');
    console.log('👉 Proceed to Phase 2 (Polygon) when ready.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
