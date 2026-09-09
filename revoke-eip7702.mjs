import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey } from './key-config.mjs';
import { operatorStatus, requireLiveExecution } from './safety.mjs';
import { assertDelegationCleared, parseDelegationCode } from './delegation.mjs';
import { selectChainsFromArgs } from './chains.mjs';

const args = process.argv.slice(2);

function publicClientFor({ chain, rpcs }) {
  return createPublicClient({
    chain,
    transport: http(rpcs[0], { timeout: 30_000 }),
  });
}

async function inspectOnChain(entry, address) {
  const publicClient = publicClientFor(entry);
  const state = parseDelegationCode(await publicClient.getCode({ address }));

  if (state.kind === 'empty') {
    console.log(`CLEAR ${entry.label}: no account code/delegation.`);
    return { chain: entry.label, state: 'clear' };
  }
  if (state.kind === 'delegated') {
    console.log(`DELEGATED ${entry.label}: ${state.delegate}`);
    return { chain: entry.label, state: 'delegated', delegate: state.delegate };
  }

  console.log(`REVIEW ${entry.label}: unexpected account code (${state.kind}).`);
  return { chain: entry.label, state: state.kind };
}

async function revokeOnChain(entry, account) {
  const publicClient = publicClientFor(entry);
  const walletClient = createWalletClient({
    account,
    chain: entry.chain,
    transport: http(entry.rpcs[0], { timeout: 30_000 }),
  });

  const beforeCode = await publicClient.getCode({ address: account.address });
  const before = parseDelegationCode(beforeCode);

  if (before.kind === 'empty') {
    console.log(`SKIP ${entry.label}: account has no code/delegation.`);
    return { chain: entry.label, success: true, skipped: true, reason: 'no-delegation' };
  }
  if (before.kind !== 'delegated') {
    throw new Error(`Refusing ${entry.label}: account code is not an EIP-7702 delegation designator.`);
  }

  console.log(`Revoking ${entry.label} delegation to ${before.delegate}...`);
  const authorization = await walletClient.signAuthorization({ contractAddress: zeroAddress });
  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address,
    value: 0n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') {
    throw new Error(`Revocation transaction reverted on ${entry.label}: ${hash}`);
  }

  const afterCode = await publicClient.getCode({ address: account.address });
  assertDelegationCleared(afterCode, entry.label);
  console.log(`SUCCESS ${entry.label}: ${entry.explorer}${hash}`);
  return { chain: entry.label, success: true, hash };
}

async function run() {
  const operator = operatorStatus({ args });
  if (!operator.ok) throw new Error(`${operator.reason} No transaction was broadcast.`);

  const selectedChains = selectChainsFromArgs(args, {
    requireExplicit: operator.mode === 'execute',
  });

  if (operator.mode === 'inspect') {
    console.log(`Read-only EIP-7702 inspection for: ${operator.address}`);
    const results = [];
    for (const entry of selectedChains) {
      try {
        results.push(await inspectOnChain(entry, operator.address));
      } catch (error) {
        const message = error.shortMessage || error.message;
        console.error(`FAIL ${entry.label}: ${message}`);
        results.push({ chain: entry.label, state: 'error', error: message });
      }
    }
    if (results.some((result) => result.state === 'error')) process.exitCode = 1;
    console.log('Inspection complete. No transaction was broadcast and no private key was loaded.');
    return;
  }

  const account = privateKeyToAccount(requireCompromisedKey());
  requireLiveExecution({ address: account.address, args });
  console.log(`Initiating EIP-7702 revocation for: ${account.address}`);

  const results = [];
  for (const entry of selectedChains) {
    try {
      results.push(await revokeOnChain(entry, account));
    } catch (error) {
      const message = error.shortMessage || error.message;
      console.error(`FAIL ${entry.label}: ${message}`);
      results.push({ chain: entry.label, success: false, error: message });
    }
  }

  if (results.some((result) => result.success === false)) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
