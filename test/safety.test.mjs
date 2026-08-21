import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrivateKey } from '../key-config.mjs';
import { executionStatus } from '../safety.mjs';

const wallet = '0x0000000000000000000000000000000000000001';

test('normalizes 32-byte private keys without exposing them', () => {
  const raw = 'a'.repeat(64);
  assert.equal(normalizePrivateKey(raw), `0x${raw}`);
  assert.throws(() => normalizePrivateKey('short'), /32-byte hex private key/);
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
