# Wallet Rescue Public Hardening Design

## Goal

Prepare Wallet Rescue for public open-source release as a defensive, auditable EVM incident-response toolkit that defaults to inspection, makes mutation difficult to trigger accidentally, and cleanly separates supported recovery flows from historical experiments.

## Architecture direction

Preserve the existing safety invariants: state-changing operations require both `--execute` and an independently supplied `EXPECTED_WALLET` matching the derived signer; EIP-7702 mutation must preflight delegation code, wait for a successful receipt, and verify the postcondition.

The hardening pass will:

- improve module boundaries so signer loading, safety checks, delegation parsing, chain configuration, diagnostics, and mutation logic are easier to test independently;
- move historical/experimental Hyperliquid mutation probes out of the primary operator path and document them explicitly as research artifacts;
- strengthen dry-run/read-only ergonomics and command descriptions so users can distinguish inspection from mutation without reading source first;
- improve tests around key validation, execution gating, delegation parsing, chain selection, and non-broadcast defaults;
- add public-release documentation (`LICENSE`, `SECURITY.md`, threat model, operator runbook);
- ensure examples use synthetic addresses/keys and do not imply universal recovery guarantees.

## Safety constraints

No change may weaken the live-execution gate. No script may broadcast merely because a private key is present. Experimental protocol-specific write paths remain opt-in and are not presented as authoritative recovery methods. The repository is for wallets the operator owns or is explicitly authorized to recover.

## Verification

A release candidate is acceptable only when syntax checks, unit tests, dependency/security audits, and documentation agree on the safety model and no secret-bearing fixtures or personal account identifiers are present.
