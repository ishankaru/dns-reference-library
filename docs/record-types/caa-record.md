# CAA Record

## Overview

The CAA record (Certification Authority Authorization record) allows a domain owner to specify which Certificate Authorities (CAs) are authorized to issue TLS certificates for the domain. CAs that comply with the CA/Browser Forum baseline requirements are required to check for CAA records and respect them before issuing a certificate.

CAA records were standardized in RFC 8659 (superseding RFC 6844) and became mandatory for CAs to check in September 2017 under CA/Browser Forum Ballot 187. If a CA finds a CAA record that does not authorize it to issue for a domain, it must refuse to issue the certificate.

Without a CAA record, any CA can issue for the domain. With one or more CAA records published, only the listed CAs are authorized.

**Three standard tags:**

- `issue` — authorizes a CA to issue non-wildcard certificates for the domain
- `issuewild` — authorizes a CA to issue wildcard certificates (`*.example.com`); if absent, `issue` applies to wildcards
- `iodef` — specifies a URL where CAs should report policy violations or unauthorized issuance attempts

## Syntax

Zone file format (RFC 8659):

```
<name> [<TTL>] [<class>] CAA <flags> <tag> "<value>"
```

- `name` — the domain name; CAA inheritance traverses up the DNS tree
- `TTL` — time-to-live in seconds
- `class` — `IN`
- `CAA` — record type
- `flags` — 8-bit integer; currently only bit 7 (the "Issuer Critical" flag, value `128`) is defined; use `0` unless the tag is critical and must be understood by the CA
- `tag` — one of `issue`, `issuewild`, `iodef`, or a CA-defined extension tag
- `value` — the CA's domain name (for `issue`/`issuewild`) or a URL (for `iodef`); enclosed in double quotes

**CAA inheritance.** If no CAA record exists at the queried name, the CA checks the parent domain. For example, if `api.example.com` has no CAA record, the CA checks `example.com`. If `example.com` has no CAA record, any CA may issue. This inheritance stops at the first parent that has at least one CAA record.

**Subdomains.** A CAA record at `example.com` applies to all subdomains unless the subdomain has its own CAA record overriding it.

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

; Authorize Let's Encrypt only, for all certificate types
@   IN  CAA  0  issue     "letsencrypt.org"
@   IN  CAA  0  issuewild "letsencrypt.org"
@   IN  CAA  0  iodef     "mailto:security@example.com"

; Authorize multiple CAs
; @  IN  CAA  0  issue  "letsencrypt.org"
; @  IN  CAA  0  issue  "digicert.com"
; @  IN  CAA  0  issue  "sectigo.com"

; Wildcard from DigiCert only, non-wildcard from Let's Encrypt or DigiCert
; @  IN  CAA  0  issue     "letsencrypt.org"
; @  IN  CAA  0  issue     "digicert.com"
; @  IN  CAA  0  issuewild "digicert.com"

; Block all issuance (empty value)
; @  IN  CAA  0  issue     ""

; Subdomain with its own policy
api IN  CAA  0  issue  "digicert.com"

; iodef via URL (HTTPS endpoint to receive reports)
@   IN  CAA  0  iodef  "https://security.example.com/caa-report"
```

`dig` output:

```
$ dig CAA example.com

;; QUESTION SECTION:
;example.com.                   IN      CAA

;; ANSWER SECTION:
example.com.    3600    IN      CAA     0 issue "letsencrypt.org"
example.com.    3600    IN      CAA     0 issuewild "letsencrypt.org"
example.com.    3600    IN      CAA     0 iodef "mailto:security@example.com"

;; Query time: 11 msec
```

Let's Encrypt domain-specific account binding (using `accounturi` extension):

```zone
@  IN  CAA  0  issue "letsencrypt.org; accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/12345"
```

The `accounturi` parameter restricts issuance to a specific ACME account, preventing issuance via other accounts even from the same CA.

## Resolution Process

When a CA receives a certificate issuance request:

1. CA queries for CAA records at the exact domain name (e.g., `api.example.com`).
2. If no CAA records are found, CA walks up the DNS tree: `example.com`, then `com.`, then `.`. Stops at the first name that has CAA records.
3. If no CAA records are found at any level, issuance is permitted (open policy).
4. If CAA records are found, the CA checks whether any `issue` record (for non-wildcard) or `issuewild` record (for wildcards) authorizes the requesting CA.
5. If the CA finds an authorizing record (its own domain name in the value), it may proceed.
6. If no authorizing record exists, or if only an empty value `""` is present, the CA must refuse issuance.
7. If an unknown critical tag (flags bit 7 set) is present that the CA does not understand, the CA must refuse issuance (Issuer Critical flag enforcement).

**CNAME and CAA.** If the queried name has a CNAME, the CA follows the CNAME chain and checks CAA records at the canonical name, not the alias. This means a CNAME to a third-party domain inherits that domain's CAA policy, which may be open.

## TTL Considerations

| Scenario | Recommended TTL |
|---|---|
| Stable CA policy | 3600–86400 seconds |
| Transitioning CA (pre-change) | 300–600 seconds |
| Post-transition | Raise back to 3600+ seconds |

CAA TTLs have limited operational impact compared to A or MX records because CAs query CAA at issuance time (not continuously). However, if you are changing CA policy (e.g., adding a new CA during a certificate renewal window), lower the TTL beforehand to ensure the new policy is visible when the CA checks.

## Security Considerations

**CAA is not a cryptographic control.** CAA is a policy signal, not a cryptographic proof. A CA or a compromised CA that does not check CAA records can still issue a certificate. CAA is effective only because the CA/Browser Forum mandates compliance; a rogue CA could ignore it. Certificate Transparency (CT) logs provide the complementary cryptographic audit trail.

**Certificate Transparency monitoring.** Pair CAA records with CT log monitoring (e.g., via `crt.sh` or a monitoring service like Facebook's CT webhook infrastructure) to detect unauthorized certificate issuance in near real-time. CAA prevents compliant CAs from issuing; CT monitoring detects cases where issuance occurs anyway.

**Empty issue value to block all issuance.** Setting `issue ""` (empty string value) blocks all non-wildcard issuance. Use this for domains that should never have certificates issued (e.g., internal hostnames that appear in public DNS, parking domains). This is more explicit than relying on the absence of any authorized CA.

**`iodef` reporting.** The `iodef` tag is advisory; CAs may send reports but are not required to. In practice, few CAs actively implement iodef reporting. Do not rely on it as a security alert mechanism. Use it to signal intent and capture any reports that do arrive.

**Overly narrow CAA during renewal.** If your certificate is issued by CA A and you add a CAA record authorizing only CA B, the next renewal attempt by CA A will fail. Plan CAA changes to include the current CA until the certificate has been successfully renewed under the new CA.

**Issuer Critical flag (flags = 128).** Setting the critical flag on an extension tag that the CA does not understand forces the CA to refuse issuance. This is a forward-compatibility mechanism: if you publish a CAA record with a critical extension tag requiring specific behavior (e.g., specific validation method), a CA that does not implement that extension cannot issue even if it is listed in an `issue` record.

## Troubleshooting

**Certificate issuance refused; CA cites CAA mismatch.** Query: `dig CAA <domain>`, or [check CAA records online](https://dnschkr.com/dns-inspector) if you don't have command-line access. Identify which CAs are listed in `issue` records. Add the CA attempting to issue, or switch to an authorized CA. If CAA records are inherited from a parent, check the parent domain.

**CAA records not found by the CA but present in DNS.** Some CAs have caching issues or query the wrong name. Verify the records are at the correct name: `dig CAA <exact-domain>`. Also check whether a CNAME is redirecting the CAA lookup to a different domain.

**Let's Encrypt fails CAA check.** Let's Encrypt checks CAA from multiple vantage points (RFC 8555 multi-perspective issuance). If CAA records are inconsistently visible (e.g., only at one authoritative server due to zone propagation delay), the check may fail. Use a [DNS propagation tool](https://dnschkr.com/dns-propagation-checker) to confirm the CAA record is visible globally before retrying issuance.

**Wildcard certificate refused.** If only an `issue` record is present (no `issuewild`), the CA may refuse wildcard issuance from some CAs (behavior varies by CA interpretation). Add an explicit `issuewild` record for the CA you intend to use for wildcards.

**iodef reports not arriving.** Most CAs do not actively send iodef reports for rejected issuance attempts. The absence of reports is not evidence the records are working. Test CAA policy enforcement via a manual certificate request attempt from an unauthorized CA (note: this requires interacting with a CA's test environment).

## Related Records

- **TXT** — ACME DNS-01 challenges (`_acme-challenge`) are separate from CAA but part of the same certificate lifecycle
- **TLSA** — DANE; cryptographically binds a certificate to a specific hostname via DNS; complements CAA
- **NS** — CAA inheritance traverses the DNS tree up to zone boundaries; for background on the full resolution path, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work)
- **CNAME** — CNAME targets inherit the CAA policy of the canonical name, not the alias

## References

- RFC 8659 — DNS Certification Authority Authorization (CAA) Resource Record (supersedes RFC 6844)
- RFC 6844 — DNS Certification Authority Authorization (CAA) Resource Record (original)
- RFC 8555 — Automatic Certificate Management Environment (ACME)
- CA/Browser Forum Baseline Requirements — §3.2.2.8 (CAA checking requirements)
- RFC 6962 — Certificate Transparency
- RFC 9162 — Certificate Transparency Version 2.0
