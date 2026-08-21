import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base, arbitrum, optimism } from 'viem/chains';
import { requireCompromisedKey } from './key-config.mjs';
import { requireLiveExecution } from './safety.mjs';
import { assertDelegationCleared, parseDelegationCode } from './delegation.mjs';

const berachain = {
  id: 80094,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.berachain.com'] } },
};

const account = privateKeyToAccount(requireCompromisedKey());
const chains = [mainnet, bsc, base, arbitrum, optimism, berachain];

async function revokeOnChain(chain) {
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const beforeCode = await publicClient.getCode({ address: account.address });
  const before = parseDelegationCode(beforeCode);

  if (before.kind === 'empty') {
    console.log(`SKIP ${chain.name}: account has no code/delegation.`);
    return { chain: chain.name, skipped: true, reason: 'no-delegation' };
  }
  if (before.kind !== 'delegated') {
    throw new Error(`Refusing ${chain.name}: account code is not an EIP-7702 delegation designator.`);
  }

  console.log(`Revoking ${chain.name} delegation to ${before.delegate}...`);
  const authorization = await walletClient.signAuthorization({ contractAddress: zeroAddress });
  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address,
    value: 0n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') {
    throw new Error(`Revocation transaction reverted on ${chain.name}: ${hash}`);
  }

  const afterCode = await publicClient.getCode({ address: account.address });
  assertDelegationCleared(afterCode, chain.name);
  console.log(`SUCCESS ${chain.name}: ${hash}`);
  return { chain: chain.name, success: true, hash };
}

async function run() {
  requireLiveExecution({ address: account.address });
  console.log(`Initiating EIP-7702 revocation for: ${account.address}`);

  const results = [];
  for (const chain of chains) {
    try {
      results.push(await revokeOnChain(chain));
    } catch (error) {
      const message = error.shortMessage || error.message;
      console.error(`FAIL ${chain.name}: ${message}`);
      results.push({ chain: chain.name, success: false, error: message });
    }
  }

  if (results.some((result) => result.success === false)) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
