import { getAddress } from 'viem';

export function operatorStatus({
  args = process.argv.slice(2),
  expectedWallet = process.env.EXPECTED_WALLET,
} = {}) {
  if (!expectedWallet) {
    return { ok: false, reason: 'EXPECTED_WALLET must identify the wallet being inspected or recovered.' };
  }

  try {
    const address = getAddress(expectedWallet);
    return {
      ok: true,
      mode: args.includes('--execute') ? 'execute' : 'inspect',
      address,
    };
  } catch {
    return { ok: false, reason: 'EXPECTED_WALLET must be a valid EVM address.' };
  }
}

export function executionStatus({
  address,
  args = process.argv.slice(2),
  expectedWallet = process.env.EXPECTED_WALLET,
} = {}) {
  if (!args.includes('--execute')) {
    return { ok: false, reason: 'Live execution requires the explicit --execute flag.' };
  }
  if (!expectedWallet) {
    return { ok: false, reason: 'EXPECTED_WALLET must be set before any state-changing operation.' };
  }

  try {
    const actual = getAddress(address);
    const expected = getAddress(expectedWallet);
    if (actual !== expected) {
      return { ok: false, reason: `Derived signer ${actual} does not match EXPECTED_WALLET ${expected}.` };
    }
    return { ok: true, address: actual };
  } catch {
    return { ok: false, reason: 'A valid derived signer and EXPECTED_WALLET are required.' };
  }
}

export function requireLiveExecution(options) {
  const status = executionStatus(options);
  if (!status.ok) {
    throw new Error(`${status.reason} No transaction was broadcast.`);
  }
  return status.address;
}
