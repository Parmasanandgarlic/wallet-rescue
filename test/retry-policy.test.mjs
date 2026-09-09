import test from 'node:test';
import assert from 'node:assert/strict';
import { mayRetryRpcFailure } from '../retry-policy.mjs';

test('RPC fallback is allowed before any broadcast attempt when another endpoint remains', () => {
  assert.equal(mayRetryRpcFailure({ broadcastAttempted: false, attemptIndex: 0, totalAttempts: 3 }), true);
});

test('RPC fallback stops once transaction submission has been attempted', () => {
  assert.equal(mayRetryRpcFailure({ broadcastAttempted: true, attemptIndex: 0, totalAttempts: 3 }), false);
});

test('RPC fallback stops when no endpoint remains', () => {
  assert.equal(mayRetryRpcFailure({ broadcastAttempted: false, attemptIndex: 2, totalAttempts: 3 }), false);
});
