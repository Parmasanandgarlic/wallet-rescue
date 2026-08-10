// sponsored-rescue.mjs
// Sponsored EIP-7702 revocation. Both signing keys are runtime-only.

import { createWalletClient, http, defineChain, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base, arbitrum, polygon } from 'viem/chains';
import { requireCompromisedKey, requireRescueKey } from './key-config.mjs';

const compromisedAccount = privateKeyToAccount(requireCompromisedKey());
const cleanAccount = privateKeyToAccount(requireRescueKey());

const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
  blockExplorers: { default: { name: 'Berascan', url: 'https://berascan.com' } },
});

const chains = [
  {
    chain: mainnet,
    label: 'Ethereum Mainnet',
    explorer: 'https://etherscan.io/tx/',
    rpcs: ['https://rpc.ankr.com/eth', 'https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth'],
  },
  {
    chain: bsc,
    label: 'BNB Smart Chain',
    explorer: 'https://bscscan.com/tx/',
    rpcs: ['https://rpc.ankr.com/bsc', 'https://bsc-rpc.publicnode.com', 'https://bsc-dataseed2.binance.org'],
  },
  {
    chain: polygon,
    label: 'Polygon',
    explorer: 'https://polygonscan.com/tx/',
    rpcs: ['https://rpc.ankr.com/polygon', 'https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
  },
  {
    chain: base,
    label: 'Base',
    explorer: 'https://basescan.org/tx/',
    rpcs: ['https://rpc.ankr.com/base', 'https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
  },
  {
    chain: arbitrum,
    label: 'Arbitrum One',
    explorer: 'https://arbiscan.io/tx/',
    rpcs: ['https://rpc.ankr.com/arbitrum', 'https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
  },
  {
    chain: berachain,
    label: 'Berachain',
    explorer: 'https://berascan.com/tx/',
    rpcs: ['https://rpc.berachain.com'],
  },
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)),
  ]);
}

async function sponsoredRevokeOnChain({ chain, label, explorer, rpcs }) {
  for (let i = 0; i < rpcs.length; i++) {
    const rpc = rpcs[i];
    try {
      const transport = http(rpc, { timeout: 30_000 });
      const compromisedClient = createWalletClient({ account: compromisedAccount, chain, transport });
      const cleanClient = createWalletClient({ account: cleanAccount, chain, transport });

      const authorization = await withTimeout(
        compromisedClient.signAuthorization({ contractAddress: zeroAddress }),
        20_000,
      );
      const txHash = await withTimeout(
        cleanClient.sendTransaction({
          to: compromisedAccount.address,
          authorizationList: [authorization],
          value: 0n,
          gas: 100_000n,
        }),
        45_000,
      );
      console.log(`SUCCESS ${label}: ${explorer}${txHash}`);
      return { chain: label, success: true, txHash };
    } catch (error) {
      const message = error.shortMessage || error.message;
      console.error(`RPC ${i + 1}/${rpcs.length} failed on ${label}: ${message}`);
      if (i === rpcs.length - 1) return { chain: label, success: false, error: message };
    }
  }
}

async function main() {
  console.log(`Compromised wallet: ${compromisedAccount.address}`);
  console.log(`Rescue gas payer: ${cleanAccount.address}`);
  const results = [];
  for (const entry of chains) results.push(await sponsoredRevokeOnChain(entry));
  for (const result of results) {
    console.log(`${result.success ? 'OK' : 'FAIL'} ${result.chain}: ${result.txHash || result.error}`);
  }
  if (results.some((result) => !result.success)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
