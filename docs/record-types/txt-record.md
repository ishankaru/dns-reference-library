# TXT Record

## Overview

The TXT record (Text record) stores arbitrary human-readable or machine-readable text associated with a domain name. Originally defined in RFC 1035 for administrative information, TXT records have evolved into the primary mechanism for publishing policy data, verification tokens, and authentication information in DNS.

TXT records are used for:

- **SPF** (Sender Policy Framework) — authorizes which servers may send email for a domain
- **DKIM** (DomainKeys Identified Mail) — publishes public keys for email signature verification
- **DMARC** — specifies email authentication policy and reporting addresses
- **Domain verification** — Google Search Console, GitHub, various SaaS platforms
- **BIMI** (Brand Indicators for Message Identification) — links a domain to a verified logo
- **ACME DNS-01 challenges** — Let's Encrypt DNS-based certificate validation
- **MTA-STS** — signals that an MTA-STS policy is published

## Syntax

Zone file format (RFC 1035):

```
<name> [<TTL>] [<class>] TXT "<string>"
```

For multiple strings (concatenated by the resolver):

```
<name> [<TTL>] [<class>] TXT "<string1>" "<string2>"
```

**Size limits.** Each individual string within a TXT record is limited to 255 octets (bytes). A single TXT record can contain multiple strings; the DNS protocol concatenates them end-to-end for the client. The total RDATA (all strings combined) is limited by the UDP message size (512 bytes without EDNS, up to 65535 bytes with EDNS0). In practice, individual TXT records should stay under 450 bytes total to avoid fragmentation issues.

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 300

; SPF
@         IN  TXT  "v=spf1 include:_spf.google.com include:sendgrid.net ~all"

; DKIM (public key split across multiple strings for length)
mail._domainkey  IN  TXT  (
  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"
  "u8TGMbBJFb3oA0Afs2l4ILH8+V1kQR6jVMZB9R7mH2nS+v5+jI/NJOmVpKi1"
  "Wk9h0sFbSGVYxJT8DQkfPz+example+key+data+here+AQAB"
)

; DMARC
_dmarc    IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com; ruf=mailto:dmarc-forensic@example.com; pct=100"

; Google domain verification
@         IN  TXT  "google-site-verification=abc123XYZdef456"

; BIMI
default._bimi  IN  TXT  "v=BIMI1; l=https://example.com/logo.svg; a=https://authority.example.com/vmc.pem"

; ACME DNS-01 challenge (temporary)
_acme-challenge  IN  TXT  "8jX2WrRwGJkI4hO6LrIbFXkJRNaLqvM9PfUcZsPpjGM"
```

`dig` output:

```
$ dig TXT example.com

;; QUESTION SECTION:
;example.com.                   IN      TXT

;; ANSWER SECTION:
example.com.            300     IN      TXT     "v=spf1 include:_spf.google.com include:sendgrid.net ~all"
example.com.            300     IN      TXT     "google-site-verification=abc123XYZdef456"

;; Query time: 18 msec
```

Multiple TXT records at the same name are returned as an unordered set. SPF processors look for the record starting with `v=spf1`.

## Resolution Process

TXT record resolution follows standard recursive resolution. The query type is `TXT` (type 16). A name can have multiple TXT records; all are returned in the answer section.

**Application-layer parsing.** DNS returns all TXT records at a name; the application selects the relevant one by prefix:
- SPF: starts with `v=spf1`
- DKIM: starts with `v=DKIM1`
- DMARC: starts with `v=DMARC1`
- BIMI: starts with `v=BIMI1`

**String concatenation.** When a TXT RDATA contains multiple strings (split for length), they are concatenated in order by the DNS library before being handed to the application. The `dig` output presents them space-separated in quotes; software must concatenate them without any separator.

**EDNS and large TXT records.** DKIM public key TXT records can exceed 512 bytes. Queries should use EDNS0 (most resolvers do by default) to allow larger UDP responses. Without EDNS, the resolver falls back to TCP. Some firewalls block DNS over TCP; ensure port 53 TCP is permitted.

## TTL Considerations

| Record Purpose | Recommended TTL |
|---|---|
| SPF | 3600 seconds |
| DKIM public key | 3600–86400 seconds |
| DMARC | 3600 seconds |
| Domain verification token | 3600 seconds |
| ACME DNS-01 challenge | 60–120 seconds (temporary) |
| BIMI | 3600 seconds |

SPF, DKIM, and DMARC records change infrequently. Higher TTLs reduce resolver query load. ACME DNS-01 challenge records are ephemeral and should use low TTLs so they propagate quickly and can be cleaned up promptly after certificate issuance.

## Security Considerations

**SPF alignment.** An SPF record that is too permissive (`+all` or broad `include` chains) authorizes too many senders and provides weak protection. Use `~all` (softfail) during evaluation and `‑all` (hardfail) when the policy is stable. Never use `?all`. For data on SPF, DKIM, and DMARC deployment rates across the internet, see the [email authentication research](https://dnschkr.com/blog/email-authentication-spf-dkim-dmarc).

**Multiple SPF records.** A domain must have exactly one SPF TXT record. Multiple `v=spf1` records at the same name cause an SPF `PermError`, which many receivers treat as a policy failure. Consolidate all SPF mechanisms into a single record.

**DKIM key rotation.** DKIM private keys should be rotated periodically (every 6–12 months). Publish the new selector's public key in DNS before updating the signing configuration. Keep the old selector active for the duration of in-transit message lifetimes (typically 7 days) before removing it.

**DKIM key length.** RSA keys shorter than 1024 bits are considered broken. RSA-2048 is the current minimum recommendation. RSA-4096 provides stronger security at a small performance cost. Ed25519 keys (`k=ed25519`) are supported by modern email systems and provide strong security with short key material.

**DMARC reporting.** The `rua` (aggregate) and `ruf` (forensic) reporting addresses in DMARC receive reports from mail receivers. If these addresses are on a different domain, that domain must publish a DMARC external reporting authorization record to prevent spoofed reporting abuse.

**TXT record enumeration.** All TXT records at a name are publicly readable. Avoid publishing sensitive data (internal hostnames, API keys, internal network information) in TXT records. Zone walking or brute-force subdomain enumeration can discover all TXT records at any publicly queried name.

**BIMI and VMC.** BIMI logo display by major mail clients (Gmail, Apple Mail) requires a Verified Mark Certificate (VMC) from an authorized authority (e.g., Entrust, DigiCert). Publishing a BIMI record without a valid VMC will not result in logo display in these clients.

## Troubleshooting

**SPF PermError due to multiple SPF records.** [Look up TXT records](https://dnschkr.com/dns-inspector) for the domain and count records starting with `v=spf1`. Consolidate into one. Delete extras.

**SPF TempError or lookup limit exceeded.** SPF allows a maximum of 10 DNS lookups during evaluation (RFC 7208 §4.6.4). `include:` mechanisms each cost at least one lookup. Audit with an SPF validator tool; flatten `include:` chains where possible using IP-based mechanisms.

**DKIM verification failure.** Common causes: (1) The signing selector does not match the `s=` tag in the DKIM signature header. (2) The public key in DNS does not match the private key used for signing. (3) The message was modified in transit (e.g., mailing list footer added). Verify with `dig TXT <selector>._domainkey.<domain>` and compare to the `s=` and `d=` tags in the email headers.

**DMARC reports not arriving.** Check that the `rua` address is reachable and that the receiving domain has an external reporting authorization record if the report address is on a different domain: `dig TXT <your-domain>.report-domain.example.com` should return `v=DMARC1`.

**Domain verification token not detected.** The verification service queries the TXT record. Confirm it is published at the correct name (usually the zone apex or a specific subdomain specified by the service). Verify with `dig TXT <domain>` directly against the authoritative server, or use a [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) to confirm the TXT record is visible from multiple locations before retrying verification.

**Large DKIM key not resolving over UDP.** Test with `dig +tcp TXT <selector>._domainkey.<domain>`. If this works but UDP does not, the response exceeds 512 bytes and EDNS is not negotiated. Check firewalls for DNS UDP packet size restrictions; enable EDNS at the resolver.

## Related Records

- **MX** — Mail delivery; TXT records (SPF, DKIM, DMARC) authenticate mail sent from the domain
- **CNAME** — Cannot coexist with TXT at the same name; DKIM records at `_domainkey` subdomains avoid this
- **TLSA** — Alternative/complement to DANE for mail server certificate binding
- **CAA** — Authorizes certificate issuance; complements ACME DNS-01 validation

## References

- RFC 1035 — Domain Names: Implementation and Specification (defines TXT record)
- RFC 7208 — Sender Policy Framework (SPF) for Authorizing Use of Domains in Email
- RFC 6376 — DomainKeys Identified Mail (DKIM) Signatures
- RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (DMARC)
- RFC 8461 — SMTP MTA Strict Transport Security (MTA-STS)
- RFC 8659 — DNS Certification Authority Authorization (CAA) Resource Record
- RFC 3339 — Date and Time on the Internet: Timestamps (ACME DNS-01 challenge format)
- BIMI Group — Brand Indicators for Message Identification specification
