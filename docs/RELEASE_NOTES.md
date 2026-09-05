# Verified invoice-gate release

This release includes the fail-safe Israeli invoice payment gate and the browser preview. Allocation applicability uses the invoice date, a strictly-greater-than amount comparison, a VAT component, and buyer-attested conditions. Missing buyer context returns HOLD.

The release workflow runs formatting, lint, type checking, tests, and the production build before packaging. Downloadable assets include a tracked-source archive, the buyer bridge package, SHA256SUMS, and a Sigstore provenance bundle. The source archive is not a standalone production binary. These attestations establish provenance; they do not certify that the software is vulnerability-free or that an invoice is authentic.

CodeQL default setup scans the repository. Secret scanning and push protection are enabled. The Bazaar rank checker now compares the actual payment-resource origin rather than matching URL substrings in arbitrary result text. Missing resource metadata is reported as not matched, not as proof of non-indexing. The MCP Registry metadata remains at version 1.8.1; this release does not change the payment prices or MCP contract.

After downloading an asset and `attestation.sigstore.json`, verify it using GitHub CLI:

```sh
gh attestation verify <downloaded-asset> --bundle attestation.sigstore.json --repo itzikhr18/israel-counterparty-intelligence --signer-workflow itzikhr18/israel-counterparty-intelligence/.github/workflows/release.yml --deny-self-hosted-runners
```
