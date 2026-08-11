// phase1-safe-chains.mjs
// Revoke an EIP-7702 delegation on chains where the compromised account can pay gas.

import { createWalletClient, http, defineChain, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base, arbitrum, optimism } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';

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
  console.log(`Revoking delegation on ${label} (chain ${chain.id})...`);
  try {
    const walletClient = createWalletClient({ account, chain, transport: http() });
    const authorization = await walletClient.signAuthorization({
      contractAddress: zeroAddress,
      executor: 'self',
    });
    const txHash = await walletClient.sendTransaction({
      to: account.address,
      authorizationList: [authorization],
      value: 0n,
    });
    console.log(`SUCCESS ${label}: ${txHash}`);
    return { chain: label, success: true, txHash };
  } catch (error) {
    const message = error.shortMessage || error.message;
    console.error(`FAILED ${label}: ${message}`);
    return { chain: label, success: false, error: message };
  }
}

async function main() {
  console.log(`Account: ${account.address}`);
  const results = [];
  for (const entry of chains) results.push(await revokeOnChain(entry));

  console.log('\nPhase 1 summary');
  for (const result of results) {
    console.log(`${result.success ? 'OK' : 'FAIL'} ${result.chain}: ${result.txHash || result.error}`);
  }
  if (results.some((result) => !result.success)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
