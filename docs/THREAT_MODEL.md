# Wallet Rescue Threat Model

## Purpose and authorization boundary

Wallet Rescue is a defensive toolkit for incident response on accounts the operator owns or is explicitly authorized to recover. It assumes the compromised private key may already be known to an attacker and therefore treats every signing operation as high risk.

The toolkit does not grant ownership, bypass protocol authorization, or make an exposed private key trustworthy again.

## Assets at risk

- funds and protocol positions controlled by the compromised account;
- downstream authorization state such as token approvals, EIP-7702 delegation, agents, or multi-signature configuration;
- the compromised private key during incident handling;
- the clean rescue/gas-payer private key used by sponsored recovery;
- forensic evidence needed for support, law-enforcement, or protocol escalation.

## Principal threats

### Wrong-wallet mutation

A responder can have multiple terminals, environment files, or keys open during an incident. Accidentally signing for the wrong wallet is treated as a first-class threat.

**Controls:** every supported state-changing path requires `--execute` plus an independently supplied `EXPECTED_WALLET` that must equal the signer derived from `COMPROMISED_PRIVATE_KEY`.

### Over-broad chain mutation

A multi-chain recovery command can affect more networks than the responder intended.

**Controls:** primary EIP-7702 tools inspect all supported chains by default, but live execution requires explicit `--chains=<chain[,chain...]>` scope. Unknown chain names fail closed.

### Treating transaction submission as recovery success

A transaction hash can represent a reverted, replaced, or ineffective state transition.

**Controls:** EIP-7702 mutation preflights account code, requires a delegation designator, waits for a successful receipt, then re-reads account code and fails unless the delegation is actually cleared.

### Loading secrets unnecessarily

Read-only diagnosis should not require loading an already-compromised signing key.

**Controls:** primary EIP-7702 entry points resolve `EXPECTED_WALLET` first and default to read-only inspection. Private keys are loaded only after explicit live execution has been requested and chain scope has been supplied.

### RPC/API failure changing remediation scope

An unavailable indexer or RPC can cause incomplete discovery or misleading results.

**Controls:** unexpected errors are surfaced; approval discovery fails closed by default; sponsored EIP-7702 recovery can use bounded RPC fallback; chain selection is explicit for live mutation.

### Speculative protocol-specific writes

Historical incident experiments can look authoritative after the context that produced them is gone.

**Controls:** unsupported Hyperliquid mutation probes are removed from the active working tree. The supported Hyperliquid surface is read-only diagnostics/evidence plus the protocol's documented support/recovery path.

### Attacker transaction racing

A sweeper may observe and race rescue transactions using the same compromised account.

**Controls and limitation:** sponsored gas payment can avoid funding the compromised account directly, but this repository does not guarantee victory against a faster attacker, private order flow, or protocol-specific controls. Responders must evaluate timing and use protocol-supported recovery mechanisms where available.

## Security invariants

1. No supported script broadcasts solely because a private key exists in the environment.
2. `--execute` is mandatory for mutation.
3. `EXPECTED_WALLET` is mandatory for mutation and must match the derived compromised signer.
4. Primary multi-chain EIP-7702 mutation requires explicit chain selection.
5. Unexpected EVM account code is never overwritten blindly.
6. Receipt success is necessary but not sufficient; post-state verification is required.
7. Read-only inspection does not load the compromised private key.
8. Real keys, wallet-specific secrets, and secret-bearing fixtures must not be committed.

## Out of scope

- restoring secrecy to a private key that has already been exposed;
- guaranteeing asset recovery against an active sweeper or malicious validator/order-flow participant;
- bypassing Hyperliquid or another protocol's authorization/support process;
- proving that revoking one delegation or approval makes an account globally safe;
- malware removal, endpoint forensics, or OS-level host remediation;
- key custody after the incident is complete.

## Exit condition

A recovered account should not be returned to normal use merely because one control was removed. After the immediate incident, migrate assets and authority to a new clean account, revoke residual approvals/agents where appropriate, rotate credentials, preserve evidence, and document the final on-chain state.
