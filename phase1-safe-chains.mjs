// phase1-safe-chains.mjs
// Revoke EIP-7702 delegation on chains where the compromised account can pay gas.

import { createPublicClient, createWalletClient, http, defineChain, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base, arbitrum, optimism } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';
import { assertDelegationCleared, parseDelegationCode } from './delegation.mjs';

const account = privateKeyToAccount(requireCompromisedKey());
const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
  blockExplorers: { default: { name: 'Berascan', url: 'https://berascan.com' } },
});
const chains = [
  { chain: mainnet, label: 'Ethereum Mainnet' },
  { chain: bsc, label: 'BNB Smart Chain' },
  { chain: base, label: 'Base' },
  { chain: arbitrum, label: 'Arbitrum One' },
  { chain: optimism, label: 'Optimism' },
  { chain: berachain, label: 'Berachain' },
];

async function revokeOnChain({ chain, label }) {
  console.log(`Checking delegation on ${label} (chain ${chain.id})...`);
  try {
    const transport = http();
    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });
    const before = parseDelegationCode(await publicClient.getCode({ address: account.address }));

    if (before.kind === 'empty') {
      console.log(`SKIP ${label}: account has no EIP-7702 delegation.`);
      return { chain: label, success: true, skipped: true, reason: 'no-delegation' };
    }
    if (before.kind !== 'delegated') {
      throw new Error('Account code is not an EIP-7702 delegation designator; refusing mutation.');
    }

    console.log(`Revoking delegation to ${before.delegate}...`);
    const authorization = await walletClient.signAuthorization({ contractAddress: zeroAddress, executor: 'self' });
    const txHash = await walletClient.sendTransaction({
      to: account.address,
      authorizationList: [authorization],
      value: 0n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error(`Revocation transaction reverted: ${txHash}`);

    assertDelegationCleared(await publicClient.getCode({ address: account.address }), label);
    console.log(`SUCCESS ${label}: ${txHash}`);
    return { chain: label, success: true, txHash };
  } catch (error) {
    const message = error.shortMessage || error.message;
    console.error(`FAILED ${label}: ${message}`);
    return { chain: label, success: false, error: message };
  }
}

async function main() {
  requireLiveExecution({ address: account.address });
  console.log(`Account: ${account.address}`);
  const results = [];
  for (const entry of chains) results.push(await revokeOnChain(entry));
  console.log('\nPhase 1 summary');
  for (const result of results) {
    console.log(`${result.success ? 'OK' : 'FAIL'} ${result.chain}: ${result.txHash || result.reason || result.error}`);
  }
  if (results.some((result) => !result.success)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
