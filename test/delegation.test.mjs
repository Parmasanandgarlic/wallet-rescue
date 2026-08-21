import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDelegationCleared, parseDelegationCode } from '../delegation.mjs';

const target = '1234567890abcdef1234567890abcdef12345678';

test('parseDelegationCode distinguishes empty, delegated, and unrelated code', () => {
  assert.deepEqual(parseDelegationCode(undefined), { kind: 'empty' });
  assert.deepEqual(parseDelegationCode('0x'), { kind: 'empty' });

  const delegated = parseDelegationCode(`0xef0100${target}`);
  assert.equal(delegated.kind, 'delegated');
  assert.equal(delegated.delegate.toLowerCase(), `0x${target}`);

  assert.deepEqual(parseDelegationCode('0x6001600055'), {
    kind: 'non-delegation-code',
    code: '0x6001600055',
  });
});

test('parseDelegationCode rejects malformed designators', () => {
  const malformed = parseDelegationCode('0xef01001234');
  assert.equal(malformed.kind, 'non-delegation-code');
});

test('assertDelegationCleared fails closed on remaining or unexpected code', () => {
  assert.equal(assertDelegationCleared('0x', 'Testnet').kind, 'empty');
  assert.throws(
    () => assertDelegationCleared(`0xef0100${target}`, 'Testnet'),
    /delegation remains/i,
  );
  assert.throws(
    () => assertDelegationCleared('0x6001600055', 'Testnet'),
    /manual review required/i,
  );
});
