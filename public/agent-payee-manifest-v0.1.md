# Agent Payee Manifest v0.1

The Agent Payee Manifest is a small JSON document published by a payment-receiving service at
`https://<service-domain>/.well-known/agent-payee.json`.

It declares which EVM payment destinations the service claims to use and binds that declaration to
an EVM signing key. The Verified Payee Firewall fetches the document from the service origin without
following redirects, validates its schema and expiry, verifies the signature, compares the declared
Israeli company number with public registry data, and checks the proposed x402 payment against the
allowed destinations.

## Security boundary

A valid manifest proves technical control of the signing key and publication under the service
domain. Registry corroboration proves that the declared Israeli company record exists and reports
its current public status. Neither fact proves legal ownership of the recipient wallet. The service
reports this as Level 2 assurance, not bank-account ownership or Full Regulatory KYB.

## Example

```json
{
  "version": "0.1",
  "company_number": "514744887",
  "legal_name": "Example Ltd",
  "service_origin": "https://merchant.example",
  "allowed_payments": [
    {
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "pay_to": "0x1111111111111111111111111111111111111111"
    }
  ],
  "issued_at": "2026-09-01T00:00:00.000Z",
  "expires_at": "2026-10-01T00:00:00.000Z",
  "signing_address": "0x0000000000000000000000000000000000000000",
  "signature": "0x<65-byte-EIP-191-signature>"
}
```

## Signing payload

Sign the following UTF-8 message with the EVM key identified by `signing_address`:

```text
Israel Counterparty Intelligence Agent Payee Manifest v0.1
<JSON.stringify of the manifest without signature, preserving the documented key order>
```

The exact key order is `version`, `company_number`, optional `legal_name`, `service_origin`,
`allowed_payments`, `issued_at`, `expires_at`, `signing_address`.

The complete JSON Schema is available at `/.well-known/agent-payee-schema.json`.

## Decision contract

- `ALLOW` requires an active resolved company, a valid signature, domain-fetched manifest, allowed
  payment destination and resource origin, and a complete buyer mandate.
- `REVIEW` means no hard contradiction was found but at least one required assurance signal is
  missing or changed.
- `DENY` means a hard mismatch or policy violation was found. A buyer should not sign.

The MVP endpoint and MCP tool are dry-run only. They never sign or submit a payment.
