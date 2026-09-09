# Security Policy

Wallet Rescue is defensive incident-response software for wallets the operator owns or is explicitly authorized to recover. The repository may be used while handling already-compromised private keys, so reporting and operational hygiene matter as much as code correctness.

## Supported code

Security fixes target the current `main` branch. Historical incident experiments and prior commits are not supported recovery procedures.

## Reporting a vulnerability

Never publish a private key, seed phrase, API credential, recovery token, target-specific forensic data, or other live secret in a GitHub issue, pull request, discussion, log, or screenshot.

If GitHub private vulnerability reporting is available for this repository, use it. Otherwise, open a minimal public issue requesting a private reporting channel and include no exploit details or sensitive values.

A useful report includes the affected commit, the safety invariant involved, synthetic reproduction steps, required attacker/operator capabilities, expected versus observed behavior, and realistic impact.

## Previously exposed private keys

Any private key that has appeared in public Git history must be treated as permanently compromised. Deleting it from the current tree or rewriting a later file does not make that key safe to reuse. Move assets and authority to newly generated wallets and revoke or rotate related approvals/credentials.

## Safety invariants

- Presence of a private key alone must never authorize a transaction.
- Live mutation requires both `--execute` and an independently verified `EXPECTED_WALLET` matching the derived signer.
- Primary EIP-7702 tools default to read-only inspection and do not load a private key in inspection mode.
- Live EIP-7702 mutation additionally requires an explicit `--chains=...` scope.
- EIP-7702 revocation verifies pre-state, receipt success, and post-state.
- Unexpected account code fails closed for manual review.
- Unsupported historical Hyperliquid write probes are not shipped in the active release tree.

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and [`docs/OPERATOR_RUNBOOK.md`](docs/OPERATOR_RUNBOOK.md) for the intended operating model.
