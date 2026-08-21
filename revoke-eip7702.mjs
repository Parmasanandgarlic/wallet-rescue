import { createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base, arbitrum, optimism } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';

const berachain = {
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
};

const account = privateKeyToAccount(requireCompromisedKey());
const chains = [mainnet, bsc, base, arbitrum, optimism, berachain];

async function run() {
  requireLiveExecution({ address: account.address });
  console.log(`Initiating EIP-7702 revocation for: ${account.address}`);
  for (const chain of chains) {
    try {
      const client = createWalletClient({ account, chain, transport: http() });
      const auth = await client.signAuthorization({ contractAddress: zeroAddress });
      const hash = await client.sendTransaction({ authorizationList: [auth], to: account.address });
      console.log(`Delegation removed on ${chain.name}: ${hash}`);
    } catch (error) {
      console.error(`Failed on ${chain.name}: ${error.shortMessage || error.message}`);
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
