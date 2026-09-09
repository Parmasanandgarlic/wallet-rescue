# Wallet Rescue Operator Runbook

This runbook describes the intended order of operations for a wallet you own or are explicitly authorized to recover. Use synthetic/test wallets to rehearse the tooling before relying on it in an incident.

## 1. Preserve evidence and isolate the environment

- Record the affected address, chains, timestamps, suspected compromise mechanism, and relevant transaction hashes.
- Do not paste private keys into tickets, chat, screenshots, shell commands that are being recorded, or source files.
- Treat `COMPROMISED_PRIVATE_KEY` as attacker-known even if you still control it.
- Use a separate clean wallet for any rescue/gas-payer role.

## 2. Set the independently verified target

Set the public wallet address before any recovery command:

```bash
export EXPECTED_WALLET=0x...
```

`EXPECTED_WALLET` is both the read-only inspection target and the independent identity assertion used by live-execution gates.

## 3. Inspect EIP-7702 state without loading a key

Primary EIP-7702 tools are read-only unless `--execute` is supplied:

```bash
npm run inspect:eip7702
```

To inspect only selected chains:

```bash
node revoke-eip7702.mjs --chains=ethereum,base,arbitrum
```

Inspection reads account code and reports clear, delegated, unexpected, or RPC-error state. It does not load `COMPROMISED_PRIVATE_KEY` and does not broadcast.

The supported chain keys are:

```text
ethereum, bsc, polygon, base, arbitrum, optimism, berachain
```

## 4. Choose the narrowest remediation

Do not execute against every chain reflexively. Select only chains where inspection shows a delegation you intend to clear.

Self-funded revocation requires the compromised wallet to pay gas. Sponsored revocation uses a separate clean account to pay gas while the compromised account signs the authorization.

## 5. Arm live execution deliberately

Live EIP-7702 execution requires all of the following:

- `--execute`;
- `EXPECTED_WALLET`;
- `COMPROMISED_PRIVATE_KEY` matching `EXPECTED_WALLET`;
- explicit `--chains=...` scope;
- `RESCUE_PRIVATE_KEY` as well for sponsored recovery.

Example direct revocation:

```bash
COMPROMISED_PRIVATE_KEY=... \
EXPECTED_WALLET=0x... \
node revoke-eip7702.mjs --execute --chains=base,arbitrum
```

Example sponsored revocation:

```bash
COMPROMISED_PRIVATE_KEY=... \
RESCUE_PRIVATE_KEY=... \
EXPECTED_WALLET=0x... \
node sponsored-rescue.mjs --execute --chains=base
```

A returned transaction hash is not considered success. The scripts wait for a successful receipt and verify that account code no longer contains the delegation.

## 6. Clean up approvals separately

Use `revoke-approvals-polygon.mjs` only when Polygon approval cleanup is relevant. Discovery failure aborts by default; `--include-common-fallbacks` deliberately expands scope and should be used only when you have reviewed that behavior.

## 7. Handle Hyperliquid as a separate authorization domain

Use:

- `hl-check-multisig.mjs` for diagnostics;
- `hl-evidence-package.mjs` for support/escalation evidence.

Unsupported historical Hyperliquid mutation probes are not part of the active release. Prefer documented protocol recovery/support procedures rather than speculative writes.

## 8. Verify and exit the incident

After remediation:

1. re-run read-only EIP-7702 inspection;
2. verify token approvals/agents/multisig state independently;
3. verify balances and positions on every affected protocol;
4. migrate assets and authority to a newly generated clean wallet;
5. revoke or rotate related credentials;
6. retain incident evidence and transaction receipts.

Do not return a publicly exposed or otherwise compromised private key to normal operational use.
