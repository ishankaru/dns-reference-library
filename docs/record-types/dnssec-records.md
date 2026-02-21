# DNSSEC Records

## Overview

DNSSEC (DNS Security Extensions) adds cryptographic authentication to DNS. It enables resolvers to verify that DNS responses are authentic and have not been tampered with in transit. DNSSEC does not encrypt DNS responses — it signs them. A validating resolver can confirm that the data came from the legitimate zone operator and has not been modified.

DNSSEC introduces four new resource record types:

| Record | Description |
|---|---|
| **DNSKEY** | Public key used to verify signatures in the zone |
| **RRSIG** | Cryptographic signature over an RRset |
| **DS** | Delegation Signer; hash of a child zone's KSK, published in the parent zone |
| **NSEC / NSEC3** | Authenticated denial of existence; proves a name or type does not exist |

The relevant RFCs are:
- RFC 4033 — DNS Security Introduction and Requirements
- RFC 4034 — Resource Records for the DNS Security Extensions (RRSIG, DNSKEY, DS, NSEC)
- RFC 4035 — Protocol Modifications for the DNS Security Extensions
- RFC 5155 — DNS Security (DNSSEC) Hashed Authenticated Denial of Existence (NSEC3)

## Chain of Trust

DNSSEC establishes a chain of trust from the IANA root zone downward to every signed zone:

```
Root zone (.)
  ├── Signed by Root KSK (currently RSA-2048, generated at key signing ceremony)
  ├── Root DS records published at IANA
  │
  └── .com zone
        ├── DS record for .com published in root zone (signed by root ZSK)
        ├── .com zone signed by .com KSK + ZSK
        │
        └── example.com zone
              ├── DS record for example.com published in .com zone
              └── example.com signed by example.com KSK + ZSK
```

A validating resolver starts with the root's trust anchor (the root KSK public key, hardcoded in resolver software and updated via RFC 5011 automated rollover). It validates each link in the chain by verifying DS records in parent zones against DNSKEY records in child zones. For a detailed walkthrough of how resolvers traverse this hierarchy, see [how DNS resolution works](https://dnschkr.com/blog/how-dns-queries-work). You can also explore DNSSEC adoption rates across TLDs in the [DNS provider and TLD rankings](https://dnschkr.com/rankings).

## Key Types: KSK and ZSK

Zones typically use two DNSKEY types:

**KSK (Key Signing Key)** — DNSKEY with bit 8 set in the flags field (SEP bit, flag value `257`). The KSK signs only the DNSKEY RRset. The KSK's public key is hashed to produce the DS record published in the parent zone. The KSK is the zone's trust anchor in the parent. KSKs are typically 2048-bit RSA or P-256/P-384 ECDSA and change infrequently (annually or less).

**ZSK (Zone Signing Key)** — DNSKEY without the SEP bit (flag value `256`). The ZSK signs all other RRsets in the zone. ZSKs are typically smaller (1024–2048 bit RSA, or ECDSA P-256) and rotate more frequently (monthly to quarterly) to limit exposure.

Some operators use a single key for both functions (combined KSK/ZSK). This simplifies key management but requires updating the DS record in the parent zone on every key rotation.

## DNSKEY Record

### Syntax

```
<zone-apex> [<TTL>] [<class>] DNSKEY <flags> <protocol> <algorithm> <public-key-base64>
```

- `flags` — `256` (ZSK) or `257` (KSK/SEP bit set)
- `protocol` — must be `3` (DNSSEC)
- `algorithm` — cryptographic algorithm number (see IANA DNSSEC Algorithm Numbers registry)
- `public-key-base64` — base64-encoded public key

Common algorithm numbers:

| Number | Algorithm | Notes |
|---|---|---|
| 5 | RSA/SHA-1 | Deprecated; do not use |
| 7 | RSASHA1-NSEC3-SHA1 | Deprecated |
| 8 | RSA/SHA-256 | Widely supported; current minimum for RSA |
| 10 | RSA/SHA-512 | Larger signatures; less common |
| 13 | ECDSA Curve P-256 with SHA-256 | Recommended; smaller keys and signatures |
| 14 | ECDSA Curve P-384 with SHA-384 | Higher security margin |
| 15 | Ed25519 | Modern; compact; RFC 8080 |
| 16 | Ed448 | Higher security margin for Ed curve family |

### Example

```
$ dig DNSKEY example.com

;; ANSWER SECTION:
example.com.  3600  IN  DNSKEY  257 3 13 (
    mdsswUyr3DPW132mOi8V9xESWE8jTo0d
    KGFtxXaY0Nb3XDsJtUfvAKtHUKHSHFD
    B0RzVQQe7kYkOcr2bS5TZfBCrD== )

example.com.  3600  IN  DNSKEY  256 3 13 (
    oJMRESz5E4gYzS/q6XDrvU1qMPYIjCWz
    JaOau8XNEZeqCYKD5ar0IRd8KqXXFJkq
    mVfRvMGPmM1x8fGAa2XhSA== )
```

The first record (flags `257`) is the KSK. The second (flags `256`) is the ZSK.

## RRSIG Record

An RRSIG record contains the cryptographic signature over a specific RRset (records of the same type at the same name).

### Syntax

```
<name> [<TTL>] [<class>] RRSIG <type-covered> <algorithm> <labels> <orig-ttl> <sig-expiration> <sig-inception> <key-tag> <signer-name> <signature-base64>
```

- `type-covered` — the record type being signed (e.g., `A`, `MX`, `DNSKEY`)
- `algorithm` — same algorithm numbers as DNSKEY
- `labels` — number of labels in the original SIGNER's name (used for wildcard validation)
- `orig-ttl` — original TTL of the signed RRset
- `sig-expiration / sig-inception` — validity window (Unix timestamps in YYYYMMDDHHMMSS format)
- `key-tag` — short identifier linking this RRSIG to the DNSKEY that signed it
- `signer-name` — the zone name that owns the signing DNSKEY
- `signature-base64` — the cryptographic signature

### Example

```
$ dig A example.com +dnssec

;; ANSWER SECTION:
example.com.  3600  IN  A      93.184.216.34
example.com.  3600  IN  RRSIG  A 13 2 3600 (
    20240401000000 20240301000000 12345 example.com.
    HjFGiqoS+oXyVfEkTfgS5UEuHT6hVr0d
    mhvCXdz8W9QKAbJz5dMgqD3K+6CxU6DG
    bSAFz2eRoVPNFqDAMp3vfA== )
```

Every RRset in a signed zone has a corresponding RRSIG. When a resolver requests records with `DO` bit set (DNSSEC OK), the response includes both the RRset and its RRSIG(s).

## DS Record

The DS (Delegation Signer) record is published in the **parent zone** and contains a hash of the child zone's KSK. It is what connects the child zone to the parent's chain of trust.

### Syntax

```
<child-zone> [<TTL>] [<class>] DS <key-tag> <algorithm> <digest-type> <digest>
```

- `key-tag` — identifies the child zone's KSK
- `algorithm` — algorithm of the child zone's KSK
- `digest-type` — hash algorithm: `1` = SHA-1 (deprecated), `2` = SHA-256, `4` = SHA-384
- `digest` — hash of the child zone's KSK RRSIG wire format data

### Example

```
$ dig DS example.com

;; ANSWER SECTION:
example.com.  3600  IN  DS  12345 13 2 (
    49FD46E6C4B45C55D4AC69CBD3CD34AC
    29B6CD04F9D68AACC7FED62EBAE00D6C )
```

The DS record is set by submitting the child zone's KSK to the registrar, which forwards it to the TLD registry. The registry publishes it in the TLD zone file. At the IANA root, DS records are published after the Root Key Signing Ceremony validates the submission.

## NSEC and NSEC3 Records

NSEC and NSEC3 provide authenticated denial of existence — cryptographic proof that a name or record type does not exist.

**NSEC (RFC 4034).** Each NSEC record covers a range of names that do not exist, using a sorted linked-list structure. An NSEC response to a query for a non-existent name returns the NSEC record for the name immediately before and after the queried name in canonical order, proving the queried name falls in the gap.

Problem: NSEC allows zone enumeration. By following the NSEC chain, an attacker can walk the entire zone and enumerate all published names.

**NSEC3 (RFC 5155).** Replaces name ordering with hashed name ordering. NSEC3 records cover ranges of hashed names, preventing direct enumeration. However, offline dictionary attacks against the hash are possible (the hash algorithm is published). The `opt-out` flag allows unsigned delegations (unsigned child zones) to not be listed, reducing zone size for large zones with many unsigned delegations (e.g., `.com`).

### NSEC Example

```
$ dig A nonexistent.example.com +dnssec

;; AUTHORITY SECTION:
example.com.  3600  IN  NSEC  www.example.com. A NS SOA MX AAAA RRSIG NSEC DNSKEY
example.com.  3600  IN  RRSIG NSEC 13 2 3600 20240401000000 20240301000000 12345 example.com. (signature)
```

This NSEC record proves: names between `example.com.` and `www.example.com.` do not exist (including `nonexistent.example.com.`), and `example.com.` itself has only the listed record types.

## Resolution Process

A validating resolver performs these steps on every DNSSEC-signed response:

1. Resolver requests records with the `DO` (DNSSEC OK) EDNS0 flag set.
2. Authoritative server returns the RRset plus accompanying RRSIG record(s).
3. Resolver retrieves the DNSKEY RRset for the signing zone.
4. Resolver verifies the DNSKEY RRset by checking its RRSIG (signed by the KSK).
5. Resolver verifies the KSK is legitimate by checking the DS record in the parent zone.
6. Resolver walks the chain of trust up to the root trust anchor.
7. Resolver uses the ZSK to verify the RRSIG on the original RRset.
8. If all verifications succeed, the resolver sets the `AD` (Authentic Data) flag in the response to the client.
9. If verification fails (bad signature, expired RRSIG, missing DS), the resolver returns `SERVFAIL`.

## TTL Considerations

| Record | Recommended TTL | Notes |
|---|---|---|
| DNSKEY | 3600–86400 seconds | Must be available for signature verification |
| RRSIG | Same as signed RRset | Validity window set during signing; typically 30 days |
| DS | Controlled by parent zone | Usually 86400 seconds in TLD zones |
| NSEC / NSEC3 | Same as SOA minimum | Short enough to allow new names to be visible quickly |

**RRSIG validity window.** RRSIGs have an inception and expiration time. Zone operators must re-sign before expiration. Automated signing software (BIND with auto-dnssec, Knot DNS, PowerDNS with inline signing) handles re-signing transparently. Manual signing requires monitoring the expiration window and re-signing at least 7–14 days before expiry.

## Security Considerations

**DNSSEC does not encrypt.** Responses are authenticated but remain visible in transit. DNS over TLS (DoT, RFC 7858) and DNS over HTTPS (DoH, RFC 8484) provide confidentiality; DNSSEC provides integrity and authenticity. They are complementary, not alternatives. For more on the types of attacks DNSSEC protects against, see the [DNS attacks guide](https://dnschkr.com/blog/dns-attacks-guide).

**KSK rollover.** Changing the KSK requires updating the DS record in the parent zone. This is a coordinated operation:
1. Publish the new KSK alongside the old one (pre-publication).
2. Submit the new KSK's DS to the registrar/registry.
3. Wait for the old DS to expire from caches.
4. Remove the old KSK.
5. Update signing configuration to use the new KSK only.

Failure to maintain DS/KSK consistency causes validation failures for the entire zone.

**Algorithm rollover.** Migrating from RSA/SHA-256 (algorithm 8) to ECDSA P-256 (algorithm 13) requires publishing DNSKEY records for both algorithms simultaneously, signing all RRsets with both, and updating the DS record in the parent before removing the old algorithm.

**Root Key Signing Ceremony.** The IANA Root KSK is generated and managed in a Hardware Security Module (HSM) at a physically secured facility. Key ceremonies are held approximately twice per year with multiple Trusted Community Representatives (TCRs) holding key shares. The ceremony is publicly documented and streamed. The root trust anchor (currently key tag 20326) is distributed in resolver software.

**DNSSEC amplification.** DNSSEC responses are significantly larger than unsigned responses due to RRSIG and DNSKEY records. This can amplify DNS-based DDoS attacks. Authoritative servers should implement response rate limiting (RRL) to mitigate amplification abuse.

## Troubleshooting

**SERVFAIL with DNSSEC-validating resolver but success with non-validating.** This confirms a DNSSEC validation failure. Use `dig +dnssec +cd <query>` (Checking Disabled) to bypass validation and see the raw response, or [inspect DNS records online](https://dnschkr.com/dns-inspector) to see DNSKEY and DS records without command-line tools. Use `dnsviz.net` or `verisignlabs.com/dnssec-debugger` to visualize the chain of trust and identify the broken link.

**Expired RRSIG.** The zone's signing automation has stopped or failed to re-sign. Check the RRSIG expiration: `dig RRSIG example.com`. Compare the expiry timestamp to the current time. Immediately re-sign the zone and investigate why automated re-signing failed.

**DS record missing in parent zone after DNSSEC enablement.** The DS record was not submitted to the registrar, or the registrar has not yet propagated it to the TLD zone. Verify: `dig DS example.com @a.gtld-servers.net`. Submit the DS via the registrar's DNSSEC management interface.

**DNSKEY and DS do not match.** The KSK was rotated without updating the DS record in the parent, or the wrong key was submitted. Calculate the expected DS from the DNSKEY: `dnssec-dsfromkey <key-file>` (BIND tools) and compare to what is published in the parent zone.

**NSEC zone walking.** If you observe your zone being enumerated via NSEC walking, migrate to NSEC3. Configure with a random salt and sufficient iterations (1–100 in modern guidance; very high iteration counts cause resolver timeouts per RFC 9276 recommendations). Alternatively, use "black lies" NSEC3 (online signing of minimal responses).

## Related Records

- **SOA** — Must be signed; NSEC/NSEC3 records at zone apex reference the SOA
- **NS** — Must be signed at zone apex; glue NS records are not signed (outside the zone)
- **A / AAAA** — All RRsets in a signed zone have corresponding RRSIG records
- **TLSA** — DANE; uses DNSSEC-validated DNS to bind TLS certificates to hostnames

## References

- RFC 4033 — DNS Security Introduction and Requirements
- RFC 4034 — Resource Records for the DNS Security Extensions (RRSIG, DNSKEY, DS, NSEC)
- RFC 4035 — Protocol Modifications for the DNS Security Extensions
- RFC 5155 — DNS Security (DNSSEC) Hashed Authenticated Denial of Existence (NSEC3)
- RFC 5011 — Automated Updates of DNS Security (DNSSEC) Trust Anchors
- RFC 6840 — Clarifications and Implementation Notes for DNS Security (DNSSEC)
- RFC 7583 — DNSSEC Key Rollover Timing Considerations
- RFC 8080 — Edwards-Curve Digital Security Algorithm (EdDSA) for DNSSEC (Ed25519, Ed448)
- RFC 9276 — Guidance for NSEC3 Parameter Settings
- RFC 7858 — Specification for DNS over Transport Layer Security (TLS) (DoT)
- RFC 8484 — DNS Queries over HTTPS (DoH)
- IANA DNSSEC Algorithm Numbers Registry
