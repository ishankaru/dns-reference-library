# What Is a Top-Level Domain (TLD)?

## Definition

A top-level domain (TLD) is the rightmost label in a fully qualified domain name (FQDN). In the name `www.example.com.`, the TLD is `com`. The trailing dot represents the DNS root, and `com` is the label immediately to its left — at the top of the hierarchical namespace below the root itself.

TLDs are also referred to as the DNS root zone's direct children. Every domain name that resolves on the public internet belongs to exactly one TLD. You can browse the [complete TLD directory](https://dnschkr.com/tlds) to see every currently delegated extension with registry details and zone analytics.

## Position in the DNS Hierarchy

The DNS namespace is a tree. The root is represented by an empty label (`.`), and all other labels branch downward:

```
. (root)
├── com
│   ├── example
│   │   └── www
│   └── google
├── net
├── org
├── uk
│   └── co
│       └── bbc
└── xn--nxasmq6b (IDN TLD)
```

Resolution travels right-to-left: a resolver first contacts a root nameserver, which delegates to the TLD nameserver, which delegates to the authoritative nameserver for the second-level domain (SLD).

### Labels and Delegation

Each node in the tree is a DNS zone. The root zone is maintained by IANA and published by Verisign. The root zone lists every TLD's nameservers. When IANA adds a TLD to the root zone, it becomes resolvable globally — this is delegation. For a deeper look at how this resolution process works in practice, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

## How TLDs Are Delegated

TLD delegation follows a defined process administered by ICANN and IANA:

1. An applicant submits a proposal to ICANN (for new gTLDs) or is recognized under ISO 3166-1 (for ccTLDs).
2. ICANN evaluates the application against technical, financial, and policy criteria.
3. Upon approval, ICANN instructs IANA to insert the TLD's NS records into the root zone.
4. IANA publishes the updated root zone. Verisign, the root zone maintainer under contract with ICANN, distributes it to the 13 root server clusters.

The authoritative specification is RFC 1591 (1994), which established the principle that TLD delegation carries responsibilities to the internet community, not ownership of the namespace.

## Current TLD Count

As of early 2026, the IANA root zone database contains approximately 1,500 delegated TLDs. The breakdown is roughly:

| Category | Count |
|---|---|
| Generic TLDs (gTLDs) | ~1,200 |
| Country-code TLDs (ccTLDs) | ~250 |
| Internationalized TLDs (IDN) | ~60 (ccTLD) + ~100 (gTLD) |
| Infrastructure (.arpa) | 1 |

The count fluctuates as new TLDs are delegated and retired TLDs are removed. The new gTLD program launched in 2012 added over 1,200 strings; the next application round opened in 2026. The [TLD size rankings](https://dnschkr.com/rankings/tld-size) track which extensions hold the most registered domains.

Tracking sources:
- IANA Root Zone Database: https://www.iana.org/domains/root/db
- ICANN CZDS (Centralized Zone Data Service): https://czds.icann.org

## Infrastructure TLD: .arpa

`.arpa` is the Address and Routing Parameter Area domain. It is not a general-purpose TLD — it exists solely for infrastructure use:

- `in-addr.arpa` — IPv4 reverse DNS (PTR records)
- `ip6.arpa` — IPv6 reverse DNS
- `uri.arpa`, `urn.arpa` — URI/URN resolution

`.arpa` is operated by IANA directly, not delegated to a commercial registry.

## Internationalized Domain Name (IDN) TLDs

IDN TLDs allow non-ASCII scripts in the TLD label itself. They are encoded using Punycode (RFC 3492) for DNS wire format but displayed in their native script in user interfaces.

### Encoding

A Unicode label is converted to an ASCII-Compatible Encoding (ACE) form prefixed with `xn--`. For example:

| Unicode | Punycode |
|---|---|
| `.中文网` | `.xn--fiq228c5hs` |
| `.한국` | `.xn--3e0b707e` |
| `.мкд` | `.xn--d1alf` |
| `.닷넷` | `.xn--t60b56a` |

### Display Convention

When displaying IDN TLDs in interfaces, show the Unicode form first with the Punycode in parentheses:

```
.닷넷 (.xn--t60b56a)
.中文网 (.xn--fiq228c5hs)
```

### Technical Constraints

- IDN TLDs must pass IDNA2008 (RFC 5891) validity checks.
- Labels must be in a single script (no mixing scripts within a label).
- Confusable characters between scripts require careful evaluation to prevent homograph attacks.
- The DNS wire format always uses Punycode — resolvers and authoritative servers never handle raw Unicode.

## Root Zone Signing

The root zone is signed with DNSSEC. ICANN manages the Root Zone DNSSEC Key Signing Key (KSK). Resolvers configured to validate DNSSEC use the root KSK as the trust anchor. This is specified in RFC 4034, RFC 4035, and RFC 5011 (automated trust anchor updates). You can verify DNSSEC configuration for any domain using a [DNS record checker](https://dnschkr.com/dns-inspector).

The root KSK was last rolled in 2018. The current key material is available at: https://data.iana.org/root-anchors/

## Retired TLDs

TLDs can be removed from the root zone. This happens when:
- A ccTLD's corresponding ISO 3166-1 country code is retired (e.g., `.su` for the Soviet Union remains active despite the ISO code being withdrawn — an exception granted by ICANN).
- A gTLD registry fails financially or operationally and ICANN does not find a replacement operator.

Historical examples of retired gTLDs from the new program include `.&amp;` (abandoned) and several brand TLDs that were withdrawn during the evaluation period.

## References

- RFC 1034 — Domain Names: Concepts and Facilities (1987)
- RFC 1035 — Domain Names: Implementation and Specification (1987)
- RFC 1591 — Domain Name System Structure and Delegation (1994)
- RFC 3492 — Punycode: A Bootstring Encoding of Unicode (2003)
- RFC 5891 — IDNA 2008: Internationalized Domain Names in Applications (2010)
- IANA Root Zone Database: https://www.iana.org/domains/root/db
- ICANN New gTLD Program: https://newgtlds.icann.org/
- Root Zone DNSSEC KSK: https://data.iana.org/root-anchors/root-anchors.xml
