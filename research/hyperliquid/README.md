# Historical Hyperliquid Write Research

Wallet Rescue's supported Hyperliquid surface is intentionally read-only: `hl-check-multisig.mjs` for diagnostics and `hl-evidence-package.mjs` for support/escalation evidence.

Earlier incident work included speculative, state-changing probes named:

- `hl-action-probe.mjs`
- `hl-force-multisig-removal.mjs`
- `hl-final-attempt.mjs`

Those executable probes are deliberately **not shipped in the current working tree**. They mixed protocol archaeology with live mutation attempts and are not a supported or generally reliable recovery procedure. Their historical source remains available through Git history for audit/research, but the public release does not place them on the primary operator path.

For an active incident, inspect account state first, preserve evidence, use documented protocol recovery/support mechanisms, and limit live EVM mutation to the explicitly guarded recovery utilities in the repository root.
