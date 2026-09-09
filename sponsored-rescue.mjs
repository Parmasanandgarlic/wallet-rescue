// sponsored-rescue.mjs
// Sponsored EIP-7702 revocation. Signing keys are loaded only for explicit live execution.

import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireCompromisedKey, requireRescueKey } from './key-config.mjs';
import { operatorStatus, requireLiveExecution } from './safety.mjs';
import { assertDelegationCleared, parseDelegationCode } from './delegation.mjs';
import { selectChainsFromArgs } from './chains.mjs';
import { mayRetryRpcFailure } from './retry-policy.mjs';

const args = process.argv.slice(2);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)),
  ]);
}

async function inspectOnChain(entry, address) {
  let lastError;
  for (const rpc of entry.rpcs) {
    try {
      const publicClient = createPublicClient({
        chain: entry.chain,
        transport: http(rpc, { timeout: 30_000 }),
      });
      const code = await withTimeout(publicClient.getCode({ address }), 20_000);
      const state = parseDelegationCode(code);
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
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`No RPC endpoint available for ${entry.label}.`);
}

async function sponsoredRevokeOnChain(entry, compromisedAccount, cleanAccount) {
  for (let i = 0; i < entry.rpcs.length; i++) {
    const rpc = entry.rpcs[i];
    let broadcastAttempted = false;
    let txHash;

    try {
      const transport = http(rpc, { timeout: 30_000 });
      const publicClient = createPublicClient({ chain: entry.chain, transport });
      const compromisedClient = createWalletClient({ account: compromisedAccount, chain: entry.chain, transport });
      const cleanClient = createWalletClient({ account: cleanAccount, chain: entry.chain, transport });

      const before = parseDelegationCode(await withTimeout(
        publicClient.getCode({ address: compromisedAccount.address }),
        20_000,
      ));
      if (before.kind === 'empty') {
        console.log(`SKIP ${entry.label}: account has no EIP-7702 delegation.`);
        return { chain: entry.label, success: true, skipped: true, reason: 'no-delegation' };
      }
      if (before.kind !== 'delegated') {
        throw new Error('Account code is not an EIP-7702 delegation designator; refusing sponsored mutation.');
      }

      const authorization = await withTimeout(
        compromisedClient.signAuthorization({ contractAddress: zeroAddress }),
        20_000,
      );

      // Once submission begins, a timeout or RPC disconnect is ambiguous: the
      // transaction may already be in the mempool. Never retry on another RPC
      // from this process, because that could create a second live mutation.
      broadcastAttempted = true;
      txHash = await withTimeout(
        cleanClient.sendTransaction({
          to: compromisedAccount.address,
          authorizationList: [authorization],
          value: 0n,
          gas: 100_000n,
        }),
        45_000,
      );
      const receipt = await withTimeout(
        publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 }),
        90_000,
      );
      if (receipt.status !== 'success') throw new Error(`Revocation transaction reverted: ${txHash}`);

      const afterCode = await withTimeout(
        publicClient.getCode({ address: compromisedAccount.address }),
        20_000,
      );
      assertDelegationCleared(afterCode, entry.label);
      console.log(`SUCCESS ${entry.label}: ${entry.explorer}${txHash}`);
      return { chain: entry.label, success: true, txHash };
    } catch (error) {
      const message = error.shortMessage || error.message;
      console.error(`RPC ${i + 1}/${entry.rpcs.length} failed on ${entry.label}: ${message}`);

      if (mayRetryRpcFailure({
        broadcastAttempted,
        attemptIndex: i,
        totalAttempts: entry.rpcs.length,
      })) {
        continue;
      }

      if (broadcastAttempted) {
        const suffix = txHash ? ` Transaction: ${txHash}.` : '';
        return {
          chain: entry.label,
          success: false,
          txHash,
          ambiguous: true,
          error: `Broadcast was attempted; automatic retry is disabled.${suffix} Verify chain state manually before any further mutation. ${message}`,
        };
      }

      return { chain: entry.label, success: false, error: message };
    }
  }

  return { chain: entry.label, success: false, error: 'No RPC attempt completed.' };
}

async function main() {
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

  const compromisedAccount = privateKeyToAccount(requireCompromisedKey());
  const cleanAccount = privateKeyToAccount(requireRescueKey());
  requireLiveExecution({ address: compromisedAccount.address, args });

  console.log(`Compromised wallet: ${compromisedAccount.address}`);
  console.log(`Rescue gas payer: ${cleanAccount.address}`);
  const results = [];
  for (const entry of selectedChains) {
    results.push(await sponsoredRevokeOnChain(entry, compromisedAccount, cleanAccount));
  }
  for (const result of results) {
    console.log(`${result.success ? 'OK' : 'FAIL'} ${result.chain}: ${result.txHash || result.reason || result.error}`);
  }
  if (results.some((result) => !result.success)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
