import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChainsFromArgs } from '../chains.mjs';

test('inspection defaults to the full supported chain registry', () => {
  const selected = selectChainsFromArgs([]);
  assert.deepEqual(
    selected.map(({ key }) => key),
    ['ethereum', 'bsc', 'polygon', 'base', 'arbitrum', 'optimism', 'berachain'],
  );
});

test('live execution requires an explicit chain selection', () => {
  assert.throws(
    () => selectChainsFromArgs(['--execute'], { requireExplicit: true }),
    /requires explicit --chains/,
  );
});

test('explicit chain selection is normalized, deduplicated, and ordered by operator input', () => {
  const selected = selectChainsFromArgs(['--chains=base,ETHEREUM,base']);
  assert.deepEqual(selected.map(({ key }) => key), ['base', 'ethereum']);
});

test('unknown chain names fail closed', () => {
  assert.throws(
    () => selectChainsFromArgs(['--chains=base,unknown-chain']),
    /Unsupported chain: unknown-chain/,
  );
});
