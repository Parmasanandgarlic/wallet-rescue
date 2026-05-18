import { createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, polygon, base, arbitrum, optimism } from 'viem/chains';

const berachain = {
    id: 80094,
    name: 'Berachain',
    nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
};

// 🛑 INSERT YOUR PRIVATE KEY HERE (Must start with 0x)
const privateKey = '60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4';
const account = privateKeyToAccount(60e54163d59c7773514e9803dc90a2dd5a428df1b313938dc76a5cc58bce74e4);

console.log(`Initiating Recovery for: ${account.address}`);

// PHASE 1: Polygon is intentionally left out of this list
const chains = [mainnet, bsc, base, arbitrum, optimism, berachain];

async function run() {
    for (const chain of chains) {
        try {
            console.log(`\n--- Attempting Revocation on ${chain.name} ---`);
            const client = createWalletClient({ account, chain, transport: http() });
            const auth = await client.signAuthorization({ contractAddress: zeroAddress });
            const hash = await client.sendTransaction({
                authorizationList: [auth],
                to: account.address,
            });
            console.log(`✅ SUCCESS: Delegation removed on ${chain.name}! Hash: ${hash}`);
        } catch (e) {
            console.error(`❌ FAILED on ${chain.name}: ${e.shortMessage || e.message}`);
        }
    }
}
run();