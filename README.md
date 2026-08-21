# Wallet Rescue

Wallet Rescue is a **defensive EVM incident-response toolkit** built around a real class of account compromise: EIP-7702 delegation abuse combined with persistent approvals, automated sweepers and downstream account-control problems such as Hyperliquid multi-sig lockout.

It is not a consumer wallet and it is not a one-click recovery product. The repository is an auditable collection of diagnostic, evidence and remediation utilities for responders who understand the consequences of signing with an already-compromised account.

## What this repository covers

- **EIP-7702 delegation revocation** across several EVM chains.
- **Sponsored revocation** where a separate clean wallet pays gas for the compromised signer.
- **ERC-20 approval discovery and revocation** on Polygon.
- **Hyperliquid account diagnostics** including balances, positions, agents and multi-sig state.
- **Evidence packaging** for support/escalation with a signed wallet-ownership statement.
- **Experimental Hyperliquid remediation probes** retained as incident research, clearly separated from read-only diagnostics.

## Safety model

The most important engineering property in this repository is the distinction between **inspection** and **execution**.

### Read-only / evidence tools

These do not intentionally broadcast state-changing transactions:

- `hl-check-multisig.mjs` — inspect Hyperliquid account, balances, agents and multi-sig state.
- `hl-evidence-package.mjs` — collect account evidence and sign an ownership statement for support/escalation.
- `security-audit.mjs` — scan the checkout for private-key / credential mistakes.

### State-changing tools

Every state-changing recovery script now shares the same two-part execution gate:

1. the command must include `--execute`; and
2. `EXPECTED_WALLET` must be set and match the address derived from `COMPROMISED_PRIVATE_KEY`.

If either condition is absent, the process stops **before broadcasting**.

This protects against the most dangerous operator error in a rescue environment: running an old command with the wrong key, wrong terminal environment or wrong target wallet.

## Setup

Requires Node.js 20+.

```bash
git clone https://github.com/Parmasanandgarlic/wallet-rescue.git
cd wallet-rescue
npm ci
cp .env.example .env
```

Do not commit `.env` or paste private keys into source files, shell history, issues or logs.

Required runtime values depend on the operation:

```env
COMPROMISED_PRIVATE_KEY=<32-byte hex key supplied at runtime>
EXPECTED_WALLET=<address you have independently verified>

# Sponsored rescue only
RESCUE_PRIVATE_KEY=<clean gas-payer key>
```

The compromised key is still compromised. Loading it into any process should be treated as sensitive incident handling, not routine application configuration.

## Recommended incident-response order

### 1. Establish the facts first

Before broadcasting anything, preserve evidence and understand the control state.

For Hyperliquid:

```bash
COMPROMISED_PRIVATE_KEY=... node hl-check-multisig.mjs
```

If escalation evidence is required:

```bash
COMPROMISED_PRIVATE_KEY=... node hl-evidence-package.mjs
```

Review the resulting addresses, active agents, balances, multi-sig configuration and recent activity before moving to remediation.

### 2. Verify the exact target wallet

Set `EXPECTED_WALLET` from an independently verified source—not by copying an address emitted by the same script you are about to run.

```bash
export EXPECTED_WALLET=0x...
```

### 3. Arm only the remediation you intend

For example, an EIP-7702 delegation revocation is deliberately inert without `--execute`:

```bash
COMPROMISED_PRIVATE_KEY=... \
EXPECTED_WALLET=0x... \
node revoke-eip7702.mjs --execute
```

The same gate applies to the phase-specific, approval-revocation, sponsored and experimental Hyperliquid write utilities.

## EIP-7702 utilities

### `revoke-eip7702.mjs`

Attempts to replace delegation with `zeroAddress` across Ethereum, BNB Smart Chain, Base, Arbitrum, Optimism and Berachain.

### `phase1-safe-chains.mjs`

A chain-by-chain self-funded revocation path where the compromised wallet can still pay gas.

### `phase2-polygon-race.mjs`

A Polygon-specific revocation path retained for incident timing/race scenarios.

### `sponsored-rescue.mjs`

Uses the compromised account only to sign the EIP-7702 authorization while a separate clean account submits/pays for the transaction. It includes RPC fallback and timeout handling.

## Approval cleanup

`revoke-approvals-polygon.mjs` discovers historical `Approval` events, checks the current on-chain allowance for each token/spender pair, and writes `approve(spender, 0)` only where a non-zero allowance remains.

A previous version silently substituted a hardcoded common-token list when discovery failed. The portfolio version is intentionally stricter: discovery failure aborts by default. The historical common-token fallback is available only when you explicitly add:

```bash
--include-common-fallbacks
```

That keeps external API failure from silently changing the scope of a live incident-response action.

## Hyperliquid utilities

Hyperliquid account-control recovery can be protocol-specific. Treat the read-only diagnostic path as authoritative and prefer the platform's supported recovery/support process when account ownership or multi-sig control has been altered.

- `hl-check-multisig.mjs` — **read-only** inspection.
- `hl-evidence-package.mjs` — evidence/support package.
- `hl-action-probe.mjs` — **experimental and state-changing** historical action probes; renamed from the misleading `hl-remove-multisig.mjs`.
- `hl-force-multisig-removal.mjs` — **experimental and state-changing** variants.
- `hl-final-attempt.mjs` — **experimental and state-changing** historical variants.

The experimental files are retained because they document the investigation path, not because they are recommended as a generic Hyperliquid recovery procedure.

## Verification

```bash
npm run check
npm test
npm run audit
npm audit --omit=dev --audit-level=high
```

CI runs these checks on pushes and pull requests. Unit tests specifically exercise private-key validation and the live-execution safety gate without using real keys or broadcasting transactions.

## Threat model and limitations

This toolkit assumes:

- you are responding to a wallet you own or are explicitly authorized to recover;
- the compromised private key may already be known to an attacker;
- a sweeper may race transactions;
- network/RPC/API availability can be unreliable during response;
- revoking one delegation or approval does not prove the account is globally safe;
- downstream protocols may maintain their own authorization state independent of the EVM account's delegation.

After successful asset/control recovery, migrate to a clean account and rotate or revoke any related credentials. Do not return a known-compromised private key to normal operational use.

## Responsible use

This repository is for defensive incident response on accounts you control or are authorized to assist. It does not provide a mechanism for bypassing ownership or authorization of third-party accounts.
