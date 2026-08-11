# Security Policy

This repository must never contain live private keys, seed phrases, session credentials, API tokens, or credential-bearing `.env` files.

## Exposed key policy

Any wallet private key that has ever been committed to Git — including a key later deleted from the current tree — is considered permanently compromised. Do not reuse it for funds, approvals, signatures, rescue operations, deposits, or API authorization.

When an exposed key is discovered:

1. Move assets and authorities to a newly generated wallet.
2. Revoke sensitive token and contract approvals from the exposed wallet.
3. Rotate any API credentials or sessions derived from the exposed identity.
4. Only after rotation/revocation, consider Git history rewrite as cleanup; history rewriting is not a substitute for rotation.

The pull-request security gates scan the current tree and Git history without printing matched secret values.