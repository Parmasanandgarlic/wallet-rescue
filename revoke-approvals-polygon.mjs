// revoke-approvals-polygon.mjs
// Revoke ERC-20 approvals on Polygon for the compromised wallet.

import { createPublicClient, createWalletClient, http, parseAbi, pad, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const RPC_URL = 'https://polygon-bor-rpc.publicnode.com';
const publicClient = createPublicClient({ chain: polygon, transport: http(RPC_URL, { timeout: 30_000 }) });
const walletClient = createWalletClient({ account, chain: polygon, transport: http(RPC_URL, { timeout: 30_000 }) });

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
]);
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

async function discoverApprovals() {
  const ownerPadded = pad(account.address, { size: 32 }).toLowerCase();
  const url = `https://api.polygonscan.com/api?module=logs&action=getLogs&topic0=${APPROVAL_TOPIC}&topic0_1_opr=and&topic1=${ownerPadded}&fromBlock=50000000&toBlock=latest&page=1&offset=1000`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== '1' || !Array.isArray(data.result) || !data.result.length) return fallbackApprovals();

  const seen = new Map();
  for (const log of data.result) {
    const token = getAddress(log.address);
    const spender = getAddress(`0x${log.topics[2].slice(26)}`);
    seen.set(`${token}-${spender}`, { token, spender });
  }
  return Array.from(seen.values());
}

function fallbackApprovals() {
  const tokens = [
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  ];
  const spenders = ['0x000000000022D473030F116dDEE9F6B43aC78BA3'];
  return tokens.flatMap((token) => spenders.map((spender) => ({ token: getAddress(token), spender: getAddress(spender) })));
}

async function checkAndRevokeAll(approvals) {
  let revoked = 0;
  let skipped = 0;
  for (const { token, spender } of approvals) {
    let symbol = `${token.slice(0, 10)}...`;
    try {
      symbol = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'symbol' });
    } catch {}

    let allowance;
    try {
      allowance = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, spender],
      });
    } catch {
      skipped++;
      continue;
    }
    if (allowance === 0n) {
      skipped++;
      continue;
    }

    try {
      const hash = await walletClient.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, 0n],
        gas: 80_000n,
      });
      console.log(`Revoked ${symbol} -> ${spender}: https://polygonscan.com/tx/${hash}`);
      revoked++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Failed ${symbol} -> ${spender}: ${error.shortMessage || error.message}`);
    }
  }
  return { revoked, skipped };
}

async function main() {
  console.log(`Wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  const pol = Number(balance) / 1e18;
  if (pol < 0.01) throw new Error('Insufficient POL for approval-revocation gas.');

  const approvals = await discoverApprovals();
  if (!approvals.length) {
    console.log('No approvals found.');
    return;
  }
  const result = await checkAndRevokeAll(approvals);
  console.log(`Revoked: ${result.revoked}; skipped: ${result.skipped}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
