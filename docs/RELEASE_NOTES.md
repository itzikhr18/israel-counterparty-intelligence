# Verified invoice-gate release

Version 1.2.3 connects the free browser invoice check to a private, validated JSON download and
buyer bridge 0.4.0. The bridge supports `--invoice-file`, previews for free by default, checks
supplier resolution before signing, and caps an explicitly authorized invoice report at 0.25 USDC.
Structural errors and unknown buyer conditions block the paid step. A purchased report can still
return HOLD/BLOCK; official and bank-ownership limitations remain explicit.

Invoice-specific browser and MCP funnel events now measure progression without logging browser
invoice fields. A log-summary utility distinguishes observed settled USDC from unpaid challenges
and internal tests. No self-payment was performed to test this release.

This release includes the fail-safe Israeli invoice payment gate and the browser preview. Allocation applicability uses the invoice date, a strictly-greater-than amount comparison, a VAT component, and buyer-attested conditions. Missing buyer context returns HOLD.

The release workflow runs formatting, lint, type checking, tests, and the production build before packaging. Downloadable assets include a tracked-source archive, the buyer bridge package, SHA256SUMS, and a Sigstore provenance bundle. The source archive is not a standalone production binary. These attestations establish provenance; they do not certify that the software is vulnerability-free or that an invoice is authentic.

CodeQL default setup scans the repository. Secret scanning and push protection are enabled. The Bazaar rank checker now compares the actual payment-resource origin rather than matching URL substrings in arbitrary result text. Missing resource metadata is reported as not matched, not as proof of non-indexing. The MCP Registry metadata remains at version 1.8.1; this release does not change the payment prices or MCP contract.

After downloading an asset and `attestation.sigstore.json`, verify it using GitHub CLI:

```sh
gh attestation verify <downloaded-asset> --bundle attestation.sigstore.json --repo itzikhr18/israel-counterparty-intelligence --signer-workflow itzikhr18/israel-counterparty-intelligence/.github/workflows/release.yml --deny-self-hosted-runners
```
