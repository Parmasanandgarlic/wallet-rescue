import { getAddress } from 'viem';

const EIP7702_PREFIX = '0xef0100';
const EIP7702_CODE_LENGTH = EIP7702_PREFIX.length + 40;

export function parseDelegationCode(code) {
  if (!code || code === '0x') return { kind: 'empty' };
  if (typeof code !== 'string') return { kind: 'unknown', code };

  const normalized = code.toLowerCase();
  if (!normalized.startsWith(EIP7702_PREFIX) || normalized.length !== EIP7702_CODE_LENGTH) {
    return { kind: 'non-delegation-code', code };
  }

  try {
    const delegate = getAddress(`0x${code.slice(EIP7702_PREFIX.length)}`);
    return { kind: 'delegated', delegate };
  } catch {
    return { kind: 'malformed-delegation', code };
  }
}

export function assertDelegationCleared(code, chainLabel) {
  const state = parseDelegationCode(code);
  if (state.kind === 'empty') return state;
  if (state.kind === 'delegated') {
    throw new Error(`EIP-7702 delegation remains on ${chainLabel}: ${state.delegate}`);
  }
  throw new Error(`Unexpected account code remained on ${chainLabel}; manual review required.`);
}
