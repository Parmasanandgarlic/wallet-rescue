// revoke-approvals-polygon.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Revoke ALL ERC-20 token approvals on Polygon for the compromised wallet.
// Uses Polygonscan API to discover approvals, then sends approve(spender, 0).
// ─────────────────────────────────────────────────────────────────────────────

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  pad,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

// ── Config ───────────────────────────────────────────────────────────────────
const COMPROMISED_KEY = '0x60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(COMPROMISED_KEY);

const RPC_URL = 'https://polygon-bor-rpc.publicnode.com';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(RPC_URL, { timeout: 30_000 }),
});

const walletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(RPC_URL, { timeout: 30_000 }),
});

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
]);

// Approval(address indexed owner, address indexed spender, uint256 value)
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

// ── Discover approvals via Polygonscan free API ──────────────────────────────
async function discoverApprovals() {
  const ownerPadded = pad(account.address, { size: 32 }).toLowerCase();
  const url =
    `https://api.polygonscan.com/api?module=logs&action=getLogs` +
    `&topic0=${APPROVAL_TOPIC}&topic0_1_opr=and&topic1=${ownerPadded}` +
    `&fromBlock=50000000&toBlock=latest&page=1&offset=1000`;

  console.log('📡 Querying Polygonscan for approval events...\n');
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' || !Array.isArray(data.result) || !data.result.length) {
    console.log('⚠️  Polygonscan returned no results. Falling back to known tokens...');
    return fallbackApprovals();
  }

  // Deduplicate by (token, spender)
  const seen = new Map();
  for (const log of data.result) {
    const token = getAddress(log.address);
    const spender = getAddress('0x' + log.topics[2].slice(26));
    seen.set(`${token}-${spender}`, { token, spender });
  }

  console.log(`  Found ${seen.size} unique (token, spender) pairs.\n`);
  return Array.from(seen.values());
}

// ── Fallback: check known Polygon tokens against common spenders ─────────────
async function fallbackApprovals() {
  const TOKENS = [
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC (native)
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
  ];
  const SPENDERS = [
    '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Permit2
  ];

  const pairs = [];
  for (const token of TOKENS) {
    for (const spender of SPENDERS) {
      pairs.push({ token: getAddress(token), spender: getAddress(spender) });
    }
  }
  return pairs;
}

// ── Check allowance & revoke ─────────────────────────────────────────────────
async function checkAndRevokeAll(approvals) {
  let revoked = 0;
  let skipped = 0;

  for (const { token, spender } of approvals) {
    let symbol = token.slice(0, 10) + '…';
    try {
      symbol = await publicClient.readContract({
        address: token, abi: ERC20_ABI, functionName: 'symbol',
      });
    } catch {}

    let allowance;
    try {
      allowance = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, spender],
      });
    } catch (e) {
      console.log(`  ⏭️  ${symbol} → ${spender.slice(0, 10)}… (can't read allowance, skipping)`);
      skipped++;
      continue;
    }

    if (allowance === 0n) {
      console.log(`  ⏭️  ${symbol} → ${spender.slice(0, 10)}… (already zero)`);
      skipped++;
      continue;
    }

    const label = allowance > 2n ** 200n ? 'UNLIMITED' : allowance.toString();
    console.log(`  🔄 Revoking: ${symbol} → ${spender} (${label})`);

    try {
      const hash = await walletClient.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, 0n],
        gas: 80_000n,
      });
      console.log(`  ✅ Done! https://polygonscan.com/tx/${hash}`);
      revoked++;
      // Avoid nonce collisions
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      console.error(`  ❌ Failed: ${e.shortMessage || e.message}`);
    }
  }

  return { revoked, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  POLYGON — REVOKE ALL TOKEN APPROVALS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Wallet: ${account.address}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check gas
  const balance = await publicClient.getBalance({ address: account.address });
  const pol = Number(balance) / 1e18;
  console.log(`💰 POL balance: ${pol.toFixed(6)} POL`);

  if (pol < 0.01) {
    console.error('\n❌ Not enough POL for gas!');
    console.error(`   Send at least 0.05 POL to ${account.address}`);
    console.error('   Each revoke costs ~0.003-0.005 POL, 6 approvals ≈ 0.03 POL.\n');
    process.exit(1);
  }

  console.log('');

  // Discover
  const approvals = await discoverApprovals();

  if (!approvals.length) {
    console.log('No approvals found. Nothing to revoke.');
    return;
  }

  // Revoke
  console.log('─── Revoking Non-Zero Approvals ────────────────────────────\n');
  const { revoked, skipped } = await checkAndRevokeAll(approvals);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Revoked:  ${revoked}`);
  console.log(`  ⏭️  Skipped:  ${skipped} (already zero or unreadable)`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (revoked > 0) {
    console.log('\n🎉 All active approvals have been revoked!');
    console.log('🔍 Verify at: https://revoke.cash/address/' + account.address + '?chainId=137');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
