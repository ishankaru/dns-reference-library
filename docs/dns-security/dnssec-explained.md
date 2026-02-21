# DNSSEC Explained

DNSSEC (Domain Name System Security Extensions) adds cryptographic authentication to DNS. It does not encrypt DNS traffic — it provides data origin authentication and data integrity verification, allowing resolvers to confirm that DNS responses are genuine and unmodified.

DNSSEC is defined across three core RFCs: 4033 (introduction and requirements), 4034 (resource records), and 4035 (protocol modifications).

---

## The Problem DNSSEC Solves

Standard DNS is unauthenticated. A resolver that receives a response to a query has no way to verify that the response came from the authoritative server or that it was not modified in transit. This enables cache poisoning and on-path attacks. DNSSEC addresses this by signing DNS data with asymmetric cryptography and publishing the public keys in DNS itself.

---

## Key Types

### Zone Signing Key (ZSK)

The ZSK signs the actual zone data: A, MX, CNAME, and other resource record sets. It is typically 1024–2048 bits (RSA) or 256 bits (ECDSA P-256). ZSKs are rotated frequently — monthly or quarterly — because they handle high-volume signing operations.

### Key Signing Key (KSK)

The KSK signs only the DNSKEY record set, which contains the ZSK. It is typically larger (2048–4096 bits RSA or 384 bits ECDSA) and rotated less frequently — annually or less. The KSK is the anchor for trust from the parent zone.

### The DNSKEY Record

Both keys are published as DNSKEY records in the zone. The DNSKEY record contains the algorithm identifier, flags (bit 256 for ZSK, bit 257 for KSK), and the raw public key material.

```
example.com.  3600  IN  DNSKEY  257 3 13 mdsswUyr3DPW...
example.com.  3600  IN  DNSKEY  256 3 13 oJMRESz5E4gY...
```

---

## Chain of Trust

DNSSEC relies on a hierarchical chain of trust rooted at the DNS root zone. Each level in the hierarchy signs a hash of the child zone's KSK, creating a delegation signer (DS) record.

```
Root zone (.)
  |-- signs DNSKEY set for .com
  |-- publishes DS record for .com

.com zone
  |-- signs DNSKEY set for example.com
  |-- publishes DS record for example.com

example.com zone
  |-- signs all resource record sets with ZSK
  |-- KSK verified by DS record in .com
```

The root zone's trust anchor (KSK) is distributed with resolvers out-of-band. IANA manages the Root Zone Signing Key. The current root KSK (ID 20326) was rolled in 2018.

### DS Record

The DS (Delegation Signer) record is published in the parent zone and contains a hash of the child zone's KSK. It links the parent's authenticated zone to the child's key material.

```
example.com.  3600  IN  DS  12345 13 2 49FD46E6C4B45C55D4AC69...
```

Fields: key tag, algorithm, digest type (1=SHA-1, 2=SHA-256, 4=SHA-384), digest.

---

## Resource Records Introduced by DNSSEC

### RRSIG

An RRSIG record contains a cryptographic signature over a specific resource record set (RRset). Every signed RRset has a corresponding RRSIG.

```
example.com.  3600  IN  RRSIG  A 13 2 3600 20260301000000 20260201000000 12345 example.com. base64sig...
```

Fields: type covered, algorithm, labels, original TTL, signature expiration, signature inception, key tag, signer's name, signature.

### NSEC and NSEC3

NSEC (Next Secure) proves the non-existence of a name or record type. It lists the next name in canonical order and the types present at that name. This allows authenticated denial of existence but exposes the full zone contents through zone walking.

NSEC3 is the hashed variant. Names are hashed with SHA-1 before listing, preventing trivial zone enumeration. The hash uses a salt and iteration count to slow offline attacks.

```
example.com.  3600  IN  NSEC  mail.example.com. A MX RRSIG NSEC DNSKEY
```

---

## Signing a Zone

Zone signing is performed by the DNS operator or registrar. The process:

1. Generate ZSK and KSK key pairs.
2. Add both public keys as DNSKEY records to the zone.
3. Sign each RRset with the ZSK, producing RRSIG records.
4. Sign the DNSKEY RRset with the KSK.
5. Add NSEC or NSEC3 records for authenticated denial of existence.
6. Submit the KSK hash as a DS record to the parent zone via the registrar.

Common tools: BIND's `dnssec-keygen` and `dnssec-signzone`, Knot DNS's `keymgr`, OpenDNSSEC (automated key and signing management). To verify that signing is working correctly, you can [inspect the DNS records](https://dnschkr.com/dns-inspector) for a domain and confirm that RRSIG and DNSKEY records are present.

---

## Validation Process

A DNSSEC-validating resolver performs the following when it receives a response:

1. Retrieve the DNSKEY records for the zone being queried.
2. Verify the DNSKEY RRset signature using the KSK found in the DS record from the parent zone.
3. Verify the KSK itself using the DS record from the parent zone, whose keys are verified by its parent, up to the root.
4. Verify the signature (RRSIG) on the requested RRset using the ZSK.
5. Check that the RRSIG has not expired.
6. If all checks pass, set the AD (Authentic Data) bit in the response.

If any step fails, the resolver returns SERVFAIL to the client. This is intentional — a validation failure should be visible, not silently fall back to an unsigned response.

The `DO` (DNSSEC OK) bit in the EDNS0 options signals that the client or resolver wants DNSSEC records returned. The `AD` bit in responses indicates the data was validated.

---

## Algorithm Support

| Number | Algorithm | Status |
|--------|-----------|--------|
| 5 | RSA/SHA-1 | Deprecated |
| 7 | RSASHA1-NSEC3-SHA1 | Deprecated |
| 8 | RSA/SHA-256 | Widely supported |
| 10 | RSA/SHA-512 | Supported |
| 13 | ECDSA P-256/SHA-256 | Recommended |
| 14 | ECDSA P-384/SHA-384 | Supported |
| 15 | Ed25519 | Recommended (RFC 8080) |
| 16 | Ed448 | Supported |

ECDSA (algorithm 13) and Ed25519 (algorithm 15) are the current recommendations for new deployments. They produce smaller signatures and keys than RSA while maintaining equivalent security levels.

---

## Key Rollover

Keys must be rotated periodically. Two rollover approaches exist:

### Pre-publication Rollover (ZSK)

1. Publish new ZSK alongside old ZSK for one TTL period.
2. Begin signing with new ZSK.
3. Retire old ZSK after another TTL period.

### Double-DS Rollover (KSK)

1. Generate new KSK, add to DNSKEY RRset.
2. Submit new DS record to parent zone.
3. Wait for old DS to expire from caches.
4. Remove old KSK.

KSK rollover requires coordination with the parent zone — the registrar must update the DS record. This is the most operationally error-prone step and requires confirmation that the parent DS record is updated before retiring the old KSK.

---

## Deployment Challenges

**Registrar support.** Not all registrars support DS record submission or automated key management. The registrar must relay the DS record to the registry. You can browse the [TLD directory](https://dnschkr.com/tlds) to see which TLDs and their registries support DNSSEC signing.

**Key management complexity.** Managing key material, rotation schedules, and signing expiry requires operational discipline. Expired RRSIG records cause SERVFAIL for all validating resolvers.

**Fragmentation and packet size.** DNSSEC responses are larger than unsigned DNS. RRSIGs and DNSKEY records add significant payload. Responses frequently exceed 512 bytes, requiring EDNS0 and sometimes TCP fallback. Some middleboxes drop large UDP DNS packets.

**Negative trust anchor.** BIND and Unbound support manually configured negative trust anchors to bypass validation for broken zones. This is a workaround, not a solution.

**DNSSEC adoption.** As of early 2026, global DNSSEC signing rates vary significantly by TLD. The root zone and most ccTLDs are signed. .com adoption is low among registered domains (~3%). Many registrars still do not automate DS submission. For current DNSSEC adoption rates broken down by TLD, see the [DNSSEC rankings](https://dnschkr.com/rankings).

---

## DNSSEC and DANE

DANE (DNS-Based Authentication of Named Entities, RFC 6698) uses DNSSEC-authenticated DNS to publish TLS certificate constraints in TLSA records. This allows services to bind their TLS certificates to DNS, removing dependence on the CA ecosystem for validation. DANE requires DNSSEC to be meaningful — without it, TLSA records provide no security guarantee.

---

## References

- RFC 4033 — DNS Security Introduction and Requirements
- RFC 4034 — Resource Records for the DNS Security Extensions
- RFC 4035 — Protocol Modifications for the DNS Security Extensions
- RFC 5011 — Automated Updates of DNS Security Trust Anchors
- RFC 6781 — DNSSEC Operational Practices, Version 2
- RFC 7583 — DNSSEC Key Rollover Timing Considerations
- RFC 8080 — Edwards-Curve Digital Security Algorithm (EdDSA) for DNSSEC
- RFC 9276 — Guidance for NSEC3 Parameter Settings
- IANA DNSSEC Algorithm Numbers: https://www.iana.org/assignments/dns-sec-alg-numbers/
- Verisign DNSSEC Debugger: https://dnssec-debugger.verisignlabs.com/
- ICANN Root KSK Rollover: https://www.iana.org/dnssec/files
