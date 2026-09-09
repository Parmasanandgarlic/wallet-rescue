import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrivateKey } from '../key-config.mjs';
import { executionStatus, operatorStatus } from '../safety.mjs';

const wallet = '0x0000000000000000000000000000000000000001';

test('normalizes 32-byte private keys without exposing them', () => {
  const raw = 'a'.repeat(64);
  assert.equal(normalizePrivateKey(raw), `0x${raw}`);
  assert.throws(() => normalizePrivateKey('short'), /32-byte hex private key/);
});

test('operator mode defaults to inspection for a validated public target', () => {
  const status = operatorStatus({ args: [], expectedWallet: wallet });
  assert.deepEqual(status, { ok: true, mode: 'inspect', address: wallet });
});

test('operator mode only requests mutation when --execute is explicit', () => {
  const status = operatorStatus({ args: ['--execute'], expectedWallet: wallet });
  assert.deepEqual(status, { ok: true, mode: 'execute', address: wallet });
});

test('operator mode rejects missing or invalid public targets', () => {
  assert.equal(operatorStatus({ args: [], expectedWallet: '' }).ok, false);
  assert.equal(operatorStatus({ args: [], expectedWallet: 'not-an-address' }).ok, false);
});

test('live execution is disabled without --execute', () => {
  const status = executionStatus({ address: wallet, args: [], expectedWallet: wallet });
  assert.equal(status.ok, false);
  assert.match(status.reason, /--execute/);
});

test('live execution requires EXPECTED_WALLET', () => {
  const status = executionStatus({ address: wallet, args: ['--execute'], expectedWallet: '' });
  assert.equal(status.ok, false);
  assert.match(status.reason, /EXPECTED_WALLET/);
});

test('live execution rejects signer/address mismatches', () => {
  const status = executionStatus({
    address: wallet,
    args: ['--execute'],
    expectedWallet: '0x0000000000000000000000000000000000000002',
  });
  assert.equal(status.ok, false);
  assert.match(status.reason, /does not match/);
});

test('live execution allows an explicitly armed matching wallet', () => {
  const status = executionStatus({ address: wallet, args: ['--execute'], expectedWallet: wallet });
  assert.equal(status.ok, true);
  assert.equal(status.address, wallet);
});
