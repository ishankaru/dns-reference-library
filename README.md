# DNS Reference Library

An open, authoritative reference library for DNS infrastructure — covering protocols, record types, security mechanisms, operational best practices, and troubleshooting techniques.

DNS documentation is scattered across hundreds of RFCs, vendor pages, and outdated blog posts. This library consolidates the most important technical information into structured, peer-reviewed reference documents. Built from hands-on experience operating DNS infrastructure at scale and analyzing hundreds of millions of domain records across the global zone file system.

## Contents

| Section | Documents | Topics |
|---------|-----------|--------|
| [Fundamentals](docs/fundamentals/) | 5 | DNS architecture, resolution chain, recursive vs authoritative servers, root servers, namespace hierarchy |
| [Record Types](docs/record-types/) | 11 | A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, DNSSEC records — syntax, examples, troubleshooting |
| [Security](docs/dns-security/) | 6 | DNSSEC, cache poisoning, DNS spoofing, amplification attacks, DNSBLs, email authentication (SPF/DKIM/DMARC) |
| [Operations](docs/dns-operations/) | 5 | Zone files, TTL strategy, propagation mechanics, anycast DNS, DNS load balancing |
| [TLD Reference](docs/tlds/) | 5 | TLD types, ccTLD vs gTLD, registry-registrar model, ICANN accreditation, IANA root database |
| [Troubleshooting](docs/troubleshooting/) | 5 | Propagation delays, SERVFAIL, NXDOMAIN, mail delivery DNS issues, cache clearing |
| [Datasets](datasets/) | 4 | Structured JSON: TLD list, root servers, DNS ports, record type reference |
| [Resources](resources/) | 2 | Annotated RFC index, curated external links |

**42 reference documents. 4 structured datasets. 28,000+ words.**

## Who This Is For

- **Software engineers** — DNS misconfiguration causes production outages. Understanding resolution, caching, and TTL behavior prevents them.
- **DevOps / SRE teams** — Zone migrations, delegation changes, DNSSEC rollouts, and debugging resolution failures at 2 AM.
- **Security researchers** — DNS-based attack vectors, DNSSEC deployment analysis, domain abuse patterns, and threat intelligence.
- **Network engineers** — Authoritative and recursive DNS infrastructure, anycast design, delegation chain diagnostics.
- **Technical SEO practitioners** — How DNS configuration affects crawlability, site migrations, and domain authority signals.

## Quick Start

Each document is standalone — start with whatever you need. No required reading order.

```
dns-reference-library/
  docs/
    fundamentals/        # How DNS works from first principles
    record-types/        # One reference doc per record type
    dns-security/        # Threat vectors and defensive mechanisms
    dns-operations/      # Running DNS infrastructure
    tlds/                # TLD ecosystem and governance
    troubleshooting/     # Debugging common failures
  datasets/              # Machine-readable JSON reference data
  resources/             # RFC index and external links
  scripts/               # Index generator and sitemap tools
```

Files are plain Markdown. Read them on GitHub, clone locally, or integrate into your own documentation.

## Practical Tools

The reference material in this library pairs with hands-on DNS analysis tools:

- [DNS Inspector](https://dnschkr.com/dns-inspector) — query all record types for any domain against authoritative nameservers
- [DNS Propagation Checker](https://dnschkr.com/propagation-checker) — verify DNS changes across global resolvers in real time
- [TLD Directory](https://dnschkr.com/tlds) — browse 1,500+ TLDs with zone analytics, provider data, and pricing
- [IP Intelligence](https://dnschkr.com/whats-my-ip-address) — IP geolocation, ASN, and threat intelligence lookup

## Datasets

The `datasets/` directory contains structured JSON files for programmatic use:

- **[tld-list.json](datasets/tld-list.json)** — 50 representative TLDs with type, registry, and introduction year
- **[root-servers.json](datasets/root-servers.json)** — All 13 root servers with operator, IP addresses, and instance counts
- **[common-ports.json](datasets/common-ports.json)** — DNS-related network ports (53, 853, 443, 784, 5353, 953)
- **[dns-record-reference.json](datasets/dns-record-reference.json)** — 23 record types with RFC, numeric value, and usage notes

## Contributing

Contributions welcome. Open a pull request if you find an error, want to expand a topic, or have a better explanation.

**Guidelines:**
- Accuracy over volume — every technical claim should be traceable to an RFC or documented behavior
- Practical focus — what practitioners need to know, not exhaustive protocol theory
- Plain Markdown — no build tools, no frameworks, just `.md` files
- Reference sources — include RFC numbers and links for all protocol-level claims

## References

This library draws from and cross-references:

- [IETF RFC Database](https://datatracker.ietf.org/) — Protocol specifications
- [IANA Root Zone Database](https://www.iana.org/domains/root/db) — TLD registry data
- [ICANN](https://www.icann.org/) — Domain governance and policy
- [root-servers.org](https://root-servers.org/) — Root server infrastructure

See [resources/rfc-index.md](resources/rfc-index.md) for an annotated index of the most important DNS RFCs.

## License

MIT License. Use this material in your own docs, wikis, training, or projects. Attribution appreciated but not required.

---

Maintained by [Ishan Karunaratne](https://github.com/ishankaru).
