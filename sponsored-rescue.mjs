// sponsored-rescue.mjs
// ─────────────────────────────────────────────────────────────────────────────
// SWEEPER BOT BYPASS — Sponsored EIP-7702 Revocation (v3 — fixed RPCs + gas)
//
// Strategy: The compromised wallet ONLY signs the revocation authorization.
//           The clean wallet pays for gas and broadcasts the transaction.
//           The sweeper bot never sees gas on the compromised address.
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
  polygon,
} from 'viem/chains';

// ── Account Setup ────────────────────────────────────────────────────────────
const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const compromisedAccount = privateKeyToAccount(COMPROMISED_KEY);

const CLEAN_KEY = '0xd4a41b0bd4b5c0229e22c446b4b51183a7a87aa8348b2a7a5616bcd74a43228b';
const cleanAccount = privateKeyToAccount(CLEAN_KEY);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  EIP-7702 SPONSORED RESCUE v3 — SWEEPER BOT BYPASS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Compromised wallet: ${compromisedAccount.address}`);
console.log(`  Gas payer (clean):  ${cleanAccount.address}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Custom Chain: Berachain ──────────────────────────────────────────────────
const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.berachain.com'] },
  },
  blockExplorers: {
    default: { name: 'Berascan', url: 'https://berascan.com' },
  },
});

// ── Chains — SKIP Optimism (already succeeded) ──────────────────────────────
// Using reliable RPCs: ankr (free, no key), publicnode, official endpoints
const chains = [
  {
    chain: mainnet,
    label: 'Ethereum Mainnet',
    explorer: 'https://etherscan.io/tx/',
    rpcs: [
      'https://rpc.ankr.com/eth',
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
    ],
  },
  {
    chain: bsc,
    label: 'BNB Smart Chain',
    explorer: 'https://bscscan.com/tx/',
    rpcs: [
      'https://rpc.ankr.com/bsc',
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed2.binance.org',
    ],
  },
  {
    chain: polygon,
    label: 'Polygon',
    explorer: 'https://polygonscan.com/tx/',
    rpcs: [
      'https://rpc.ankr.com/polygon',
      'https://polygon-bor-rpc.publicnode.com',
      'https://1rpc.io/matic',
    ],
  },
  {
    chain: base,
    label: 'Base',
    explorer: 'https://basescan.org/tx/',
    rpcs: [
      'https://rpc.ankr.com/base',
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org',
    ],
  },
  {
    chain: arbitrum,
    label: 'Arbitrum One',
    explorer: 'https://arbiscan.io/tx/',
    rpcs: [
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc',
    ],
  },
  // Optimism SKIPPED — already revoked ✅
  {
    chain: berachain,
    label: 'Berachain',
    explorer: 'https://berascan.com/tx/',
    rpcs: [
      'https://rpc.berachain.com',
    ],
  },
];

// ── Timeout helper ───────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// ── Try multiple RPCs for resilience ─────────────────────────────────────────
async function sponsoredRevokeOnChain({ chain, label, explorer, rpcs }) {
  const divider = '─'.repeat(60);
  console.log(divider);
  console.log(`🔗 Chain: ${label} (ID: ${chain.id})`);
  console.log(divider);

  for (let i = 0; i < rpcs.length; i++) {
    const rpc = rpcs[i];
    console.log(`  📡 Trying RPC ${i + 1}/${rpcs.length}: ${rpc}`);

    try {
      const transport = http(rpc, { timeout: 30_000 });

      const compromisedClient = createWalletClient({
        account: compromisedAccount,
        chain,
        transport,
      });

      const cleanClient = createWalletClient({
        account: cleanAccount,
        chain,
        transport,
      });

      // Step 1: Compromised wallet signs the revocation authorization
      console.log('  ⏳ [Compromised] Signing revocation authorization...');
      const authorization = await withTimeout(
        compromisedClient.signAuthorization({
          contractAddress: zeroAddress,
        }),
        20_000
      );
      console.log('  ✅ [Compromised] Authorization signed.');

      // Step 2: Clean wallet broadcasts with explicit gas limit
      console.log('  ⏳ [Clean wallet] Broadcasting sponsored revocation tx...');
      const txHash = await withTimeout(
        cleanClient.sendTransaction({
          to: compromisedAccount.address,
          authorizationList: [authorization],
          value: 0n,
          gas: 100_000n,  // Explicit gas limit to avoid estimation issues
        }),
        45_000
      );

      console.log(`  ✅ SUCCESS on ${label}!`);
      console.log(`  📝 TX Hash: ${txHash}`);
      console.log(`  🔍 ${explorer}${txHash}`);
      console.log('');
      return { chain: label, success: true, txHash };

    } catch (error) {
      const msg = error.shortMessage || error.message;
      console.error(`  ⚠️  RPC ${i + 1} failed: ${msg}`);

      if (i < rpcs.length - 1) {
        console.log('  🔄 Trying next RPC...');
      } else {
        console.error(`  ❌ ALL RPCs FAILED on ${label}`);
        if (msg.includes('exceeds the balance')) {
          console.error(`  💡 Clean wallet needs more gas on ${label}`);
        }
        console.log('');
        return { chain: label, success: false, error: msg };
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('ℹ️  Skipping Optimism — already revoked in previous run.\n');

  const results = [];

  for (const entry of chains) {
    const result = await sponsoredRevokeOnChain(entry);
    results.push(result);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SPONSORED RESCUE v3 — FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Optimism              (revoked in previous run)');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success ? r.txHash : r.error;
    console.log(`  ${icon} ${r.chain.padEnd(20)} ${detail}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  const succeeded = results.filter(r => r.success).length + 1; // +1 for Optimism
  const failed = results.filter(r => !r.success).length;

  if (failed > 0) {
    console.log(`\n⚠️  ${succeeded}/7 chains revoked. ${failed} still need attention.`);
  } else {
    console.log(`\n🎉 ALL 7 CHAINS REVOKED SUCCESSFULLY!`);
    console.log('🛡️  Your wallet is now a clean EOA on every chain.');
    console.log('👉 Move remaining assets to a fresh wallet ASAP.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
