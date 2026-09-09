import { defineChain } from 'viem';
import { mainnet, bsc, polygon, base, arbitrum, optimism } from 'viem/chains';

const berachain = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
  blockExplorers: { default: { name: 'Berascan', url: 'https://berascan.com' } },
});

export const CHAIN_REGISTRY = Object.freeze([
  {
    key: 'ethereum',
    chain: mainnet,
    label: 'Ethereum Mainnet',
    explorer: 'https://etherscan.io/tx/',
    rpcs: ['https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth'],
  },
  {
    key: 'bsc',
    chain: bsc,
    label: 'BNB Smart Chain',
    explorer: 'https://bscscan.com/tx/',
    rpcs: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed2.binance.org'],
  },
  {
    key: 'polygon',
    chain: polygon,
    label: 'Polygon',
    explorer: 'https://polygonscan.com/tx/',
    rpcs: ['https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
  },
  {
    key: 'base',
    chain: base,
    label: 'Base',
    explorer: 'https://basescan.org/tx/',
    rpcs: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
  },
  {
    key: 'arbitrum',
    chain: arbitrum,
    label: 'Arbitrum One',
    explorer: 'https://arbiscan.io/tx/',
    rpcs: ['https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
  },
  {
    key: 'optimism',
    chain: optimism,
    label: 'Optimism',
    explorer: 'https://optimistic.etherscan.io/tx/',
    rpcs: ['https://optimism-rpc.publicnode.com', 'https://mainnet.optimism.io'],
  },
  {
    key: 'berachain',
    chain: berachain,
    label: 'Berachain',
    explorer: 'https://berascan.com/tx/',
    rpcs: ['https://rpc.berachain.com'],
  },
]);

const aliases = Object.freeze({
  eth: 'ethereum',
  mainnet: 'ethereum',
  bnb: 'bsc',
  arb: 'arbitrum',
  op: 'optimism',
  bera: 'berachain',
});

function readChainsArgument(args) {
  const inline = args.find((arg) => arg.startsWith('--chains='));
  if (inline) return inline.slice('--chains='.length);

  const index = args.indexOf('--chains');
  if (index >= 0) return args[index + 1];
  return undefined;
}

export function selectChainsFromArgs(args = process.argv.slice(2), { requireExplicit = false } = {}) {
  const raw = readChainsArgument(args);
  if (raw === undefined) {
    if (requireExplicit) {
      throw new Error('Live execution requires explicit --chains=<chain[,chain...]> selection.');
    }
    return [...CHAIN_REGISTRY];
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('The --chains option requires at least one supported chain name.');
  }

  const byKey = new Map(CHAIN_REGISTRY.map((entry) => [entry.key, entry]));
  const selected = [];
  const seen = new Set();

  for (const token of raw.split(',')) {
    const normalized = token.trim().toLowerCase();
    const key = aliases[normalized] || normalized;
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Unsupported chain: ${normalized}`);
    if (!seen.has(key)) {
      selected.push(entry);
      seen.add(key);
    }
  }

  return selected;
}
