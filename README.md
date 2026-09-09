# Wallet Rescue

Wallet Rescue is a **defensive EVM incident-response toolkit** built around a real class of account compromise: EIP-7702 delegation abuse combined with persistent approvals, automated sweepers and downstream account-control problems such as Hyperliquid multi-sig lockout.

It is not a consumer wallet and it is not a one-click recovery product. The repository is an auditable collection of diagnostic, evidence and remediation utilities for responders who understand the consequences of signing with an already-compromised account.

## What this repository covers

- **Read-only EIP-7702 inspection by default** across supported EVM chains without loading the compromised private key.
- **Verified EIP-7702 delegation revocation** with explicit execution and chain-scope gates.
- **Sponsored revocation** where a separate clean wallet pays gas for the compromised signer.
- **ERC-20 approval discovery and revocation** on Polygon.
- **Hyperliquid account diagnostics** including balances, positions, agents and multi-sig state.
- **Evidence packaging** for support/escalation with a signed wallet-ownership statement.
- Historical Hyperliquid write research documented separately from the supported operator surface.

## Safety model

The most important engineering property in this repository is the distinction between **inspection** and **execution**.

### Primary EIP-7702 tools default to inspection

`revoke-eip7702.mjs` and `sponsored-rescue.mjs` use `EXPECTED_WALLET` as the public inspection target. Without `--execute`, they read account code, report delegation state and exit without loading `COMPROMISED_PRIVATE_KEY` or broadcasting a transaction.

```bash
EXPECTED_WALLET=0x... node revoke-eip7702.mjs
```

Inspection defaults to the complete supported registry and can be narrowed:

```bash
EXPECTED_WALLET=0x... node revoke-eip7702.mjs --chains=ethereum,base
```

Supported chain keys are:

```text
ethereum, bsc, polygon, base, arbitrum, optimism, berachain
```

### Live mutation requires three independent decisions

Primary multi-chain EIP-7702 mutation requires:

1. the command includes `--execute`;
2. `EXPECTED_WALLET` matches the address derived from `COMPROMISED_PRIVATE_KEY`; and
3. the operator supplies explicit `--chains=<chain[,chain...]>` scope.

Presence of a private key alone never authorizes a transaction. Unknown chain names fail closed.

For EIP-7702 revocation, transaction submission is **not** the success criterion. The revocation paths additionally:

1. read account code before mutation;
2. confirm it is an EIP-7702 delegation designator rather than unrelated contract/account code;
3. submit the revocation only after that preflight passes;
4. wait for a successful transaction receipt; and
5. read account code again and fail unless the delegation is actually cleared.

Chains with no current delegation are skipped without mutation. Unexpected account code fails closed for manual review.

### Read-only / evidence tools

These do not intentionally broadcast state-changing transactions:

- `revoke-eip7702.mjs` without `--execute` — inspect EIP-7702 account code.
- `sponsored-rescue.mjs` without `--execute` — inspect the same state using RPC fallback.
- `hl-check-multisig.mjs` — inspect Hyperliquid account, balances, agents and multi-sig state.
- `hl-evidence-package.mjs` — collect account evidence and sign an ownership statement for support/escalation.
- `security-audit.mjs` — scan the checkout for private-key / credential mistakes.

## Setup

Requires Node.js 20+.

```bash
git clone https://github.com/Parmasanandgarlic/wallet-rescue.git
cd wallet-rescue
npm ci
cp .env.example .env
```

Do not commit `.env` or paste private keys into source files, shell history, issues or logs.

For inspection, only the public target address is required:

```env
EXPECTED_WALLET=<address you have independently verified>
```

Live operations additionally load runtime-only signing keys:

```env
COMPROMISED_PRIVATE_KEY=<32-byte hex key supplied at runtime>

# Sponsored rescue only
RESCUE_PRIVATE_KEY=<clean gas-payer key>
```

The compromised key is still compromised. Loading it into any process should be treated as sensitive incident handling, not routine application configuration.

## Recommended incident-response order

### 1. Establish the facts first

Preserve evidence and inspect control state before broadcasting anything.

For EIP-7702:

```bash
EXPECTED_WALLET=0x... npm run inspect:eip7702
```

For Hyperliquid:

```bash
COMPROMISED_PRIVATE_KEY=... node hl-check-multisig.mjs
```

If escalation evidence is required:

```bash
COMPROMISED_PRIVATE_KEY=... node hl-evidence-package.mjs
```

Review addresses, active agents, balances, multi-sig configuration and recent activity before moving to remediation.

### 2. Verify the exact target wallet independently

Set `EXPECTED_WALLET` from an independently verified source—not by copying an address emitted by the same signing path you are about to run.

```bash
export EXPECTED_WALLET=0x...
```

### 3. Select only the chains you intend to mutate

Read-only inspection may cover all supported chains. Live mutation does not: you must explicitly name the chain scope.

```bash
COMPROMISED_PRIVATE_KEY=... \
EXPECTED_WALLET=0x... \
node revoke-eip7702.mjs --execute --chains=base,arbitrum
```

Sponsored recovery uses the same target and chain gates plus a clean gas-payer key:

```bash
COMPROMISED_PRIVATE_KEY=... \
RESCUE_PRIVATE_KEY=... \
EXPECTED_WALLET=0x... \
node sponsored-rescue.mjs --execute --chains=base
```

## EIP-7702 utilities

EIP-7702 delegated accounts expose a delegation designator in account code. The primary revocation utilities parse that state before broadcasting and verify the postcondition after confirmation rather than assuming a returned transaction hash means recovery succeeded.

### `revoke-eip7702.mjs`

Primary direct/self-funded path. It defaults to read-only inspection. Live mode requires `--execute`, signer/`EXPECTED_WALLET` agreement and explicit `--chains` scope.

### `sponsored-rescue.mjs`

Uses the compromised account only to sign the EIP-7702 authorization while a separate clean account submits/pays for the transaction. It defaults to read-only inspection, includes bounded RPC fallback and timeout handling, and applies the same preflight/receipt/post-state verification in live mode.

### `phase1-safe-chains.mjs`

Earlier chain-by-chain self-funded revocation retained as an incident-specific utility. It uses the shared live-execution gate but is not the preferred multi-chain operator entry point.

### `phase2-polygon-race.mjs`

A Polygon-specific revocation path retained for incident timing/race scenarios. It remains separately armed by the shared live-execution gate.

## Approval cleanup

`revoke-approvals-polygon.mjs` discovers historical `Approval` events, checks the current on-chain allowance for each token/spender pair, and writes `approve(spender, 0)` only where a non-zero allowance remains.

Discovery failure aborts by default. The historical common-token fallback is available only when explicitly requested:

```bash
--include-common-fallbacks
```

That keeps external API failure from silently changing the scope of a live incident-response action.

## Hyperliquid utilities

Hyperliquid account-control recovery is protocol-specific. The supported active surface is deliberately conservative:

- `hl-check-multisig.mjs` — **read-only** inspection.
- `hl-evidence-package.mjs` — evidence/support package.

Earlier state-changing Hyperliquid probes are not shipped in the current working tree because they were speculative incident research rather than a general recovery method. Their status is documented in [`research/hyperliquid/README.md`](research/hyperliquid/README.md); historical source remains auditable in Git history.

Prefer Hyperliquid's documented recovery/support process when account ownership, agents or multi-sig control has been altered.

## Verification

```bash
npm run check
npm test
npm run audit
npm audit --omit=dev --audit-level=high
```

CI runs these checks on pushes and pull requests. Unit tests exercise private-key validation, operator inspection mode, the live-execution gate, explicit chain selection, EIP-7702 delegation parsing and the postcondition verifier without using real keys or broadcasting transactions.

## Threat model and operator runbook

- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — assets, attacker/operator threats, invariants and limitations.
- [`docs/OPERATOR_RUNBOOK.md`](docs/OPERATOR_RUNBOOK.md) — guarded incident-response sequence and command examples.
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting and secret-handling policy.

This toolkit assumes the compromised private key may already be known to an attacker, a sweeper may race transactions, RPC/API availability can be unreliable, and downstream protocols may maintain authorization state independent of EVM delegation. Revoking one delegation or approval does not prove the account is globally safe.

After successful asset/control recovery, migrate to a clean account and rotate or revoke related credentials. Do not return a known-compromised private key to normal operational use.

## Responsible use

This repository is for defensive incident response on accounts you control or are authorized to assist. It does not provide a mechanism for bypassing ownership or authorization of third-party accounts.

## License

ISC. See [`LICENSE`](LICENSE).
