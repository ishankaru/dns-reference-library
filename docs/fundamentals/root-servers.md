# DNS Root Servers

## The Root of the Hierarchy

The DNS root zone is the top of the global DNS hierarchy. Every name resolution that cannot be answered from cache must ultimately trace back to the root — it is the entry point for discovering which nameservers are authoritative for any TLD. The infrastructure that serves the root zone is therefore among the most critical on the internet.

Root servers do not hold records for individual domain names. They hold only the NS and glue records that delegate authority to TLD nameservers (e.g., the nameservers for `.com`, `.de`, `.uk`, `.xn--p1ai`). For a detailed walkthrough of how resolvers traverse from root to authoritative answer, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

---

## The 13 Root Server Identities

There are exactly 13 root server identities, identified by letters A through M. This limit originates from a constraint in the original DNS specification: a DNS response must fit within 512 bytes over UDP (without EDNS(0)), and 13 is the maximum number of NS records with associated IPv4 glue that fits within that budget.

Each identity is a logical name under `root-servers.net`. The actual service is delivered by many physical machines through anycast (see below).

| Letter | Hostname | Operator |
|--------|----------|----------|
| A | a.root-servers.net | Verisign |
| B | b.root-servers.net | USC Information Sciences Institute (ISI) |
| C | c.root-servers.net | Cogent Communications |
| D | d.root-servers.net | University of Maryland |
| E | e.root-servers.net | NASA Ames Research Center |
| F | f.root-servers.net | Internet Systems Consortium (ISC) |
| G | g.root-servers.net | US Department of Defense (DoD NIC) |
| H | h.root-servers.net | US Army Research Laboratory (ARL) |
| I | i.root-servers.net | Netnod (Sweden) |
| J | j.root-servers.net | Verisign |
| K | k.root-servers.net | RIPE NCC |
| L | l.root-servers.net | ICANN |
| M | m.root-servers.net | WIDE Project (Japan) |

Verisign operates two root server identities (A and J). All other operators run one each.

---

## Anycast: 13 Identities, 1500+ Instances

Although there are only 13 logical root server identities, the physical infrastructure is vastly larger. Each operator deploys multiple geographically distributed nodes, all announcing the same IP address via BGP anycast.

### How Anycast Works for Root Servers

Each root server identity has assigned IP addresses (one IPv4, one IPv6) that are stable and globally known. The operator announces these addresses from multiple points of presence (PoPs) simultaneously using BGP. When a recursive resolver sends a query to (for example) `198.41.0.4` (a.root-servers.net), the internet's routing infrastructure directs that packet to the nearest node announcing that prefix — not to a single centralised machine.

```
Recursive Resolver (Frankfurt)
        |
        | Query to 198.41.0.4
        v
   BGP routing selects nearest anycast node
        |
        +---> a.root-servers.net node in Amsterdam
             (not the one in Ashburn, or Singapore)
```

The recursive resolver is unaware of which physical node answered. From its perspective, there is one server at each IP address.

### Instance Count

As of 2024, the global root server system comprises over 1,700 instances across all 13 identities. F-root (ISC) and L-root (ICANN) each operate hundreds of nodes. This makes the root server system one of the most distributed and resilient DNS infrastructures in existence.

**Current instance counts by operator (approximate, as of 2024):**

| Operator | Approx. Instances |
|----------|-------------------|
| ISC (F) | 250+ |
| ICANN (L) | 200+ |
| RIPE NCC (K) | 150+ |
| Verisign (A, J) | 150+ (combined) |
| Netnod (I) | 100+ |
| Others | 50–100 each |

Operators publish their current node counts and locations at `root-servers.org` and on their individual operator pages.

---

## Root Server IP Addresses

The IPv4 and IPv6 addresses for all 13 root servers are stable and rarely change. Changes require coordination across the entire internet (every DNS resolver that uses root hints files must be updated).

| Identity | IPv4 | IPv6 |
|----------|------|------|
| A | 198.41.0.4 | 2001:503:ba3e::2:30 |
| B | 170.247.170.2 | 2801:1b8:10::b |
| C | 192.33.4.12 | 2001:500:2::c |
| D | 199.7.91.13 | 2001:500:2d::d |
| E | 192.203.230.10 | 2001:500:a8::e |
| F | 192.5.5.241 | 2001:500:2f::f |
| G | 192.112.36.4 | 2001:500:12::d0d |
| H | 198.97.190.53 | 2001:500:1::53 |
| I | 192.36.148.17 | 2001:7fe::53 |
| J | 192.58.128.30 | 2001:503:c27::2:30 |
| K | 193.0.14.129 | 2001:7fd::1 |
| L | 199.7.83.42 | 2001:500:9f::42 |
| M | 202.12.27.33 | 2001:dc3::35 |

---

## The Root Zone File

The root zone file is the authoritative data served by all root servers. It contains:

- The SOA record for the root zone (`.`)
- NS records listing all 13 root server identities
- For each TLD delegated from the root: NS records pointing to the TLD's authoritative nameservers, plus glue A/AAAA records for those nameservers

The root zone file is maintained by IANA (the Internet Assigned Numbers Authority, a function of ICANN) and distributed to all 13 root server operators. As of 2024, the root zone contains delegations for approximately 1,480 TLDs, making the root zone file several megabytes in size. You can browse all delegated TLDs with their nameservers and registry data in the [TLD directory](https://dnschkr.com/tlds).

**Root zone publication:**
- Published at: `https://www.iana.org/domains/root/files`
- Signed with DNSSEC (trust anchor: the root Key Signing Key, KSK)
- Updated by Verisign as the Root Zone Maintainer under contract with ICANN
- Format: Standard DNS master file (RFC 1035 zone file format)

---

## Root Hints and Priming Queries

A recursive resolver needs to know where to start the resolution process. It obtains the addresses of the root servers via a **root hints file** — a static file bundled with the resolver software or maintained by the operator.

### Root Hints File

The root hints file contains NS and A/AAAA records for all 13 root server identities. It is distinct from the root zone itself: the hints file is a bootstrap mechanism, not authoritative data. It answers the question "where do I query to start?" before the resolver has fetched any authoritative data.

IANA publishes the canonical root hints file at:
`https://www.iana.org/domains/root/files` (named `named.root` or `db.root` depending on context)

### Priming Query

When a resolver starts up (or after its cached root NS data expires), it performs a **priming query**: it sends an NS query for the root zone (`.`) to one of the root server addresses from its hints file. The response contains the current authoritative NS records and glue for all 13 root server identities. The resolver caches these with their TTL (typically 518,400 seconds — 6 days) and uses them for subsequent resolution.

This means the hints file does not need to be perfectly current — it just needs to contain at least one address that is still valid. As long as one root server responds to the priming query, the resolver can refresh its root server knowledge.

---

## Root Server Governance

The root zone is operated under a layered governance structure:

- **IANA** (ICANN): Maintains the authoritative data — decides what TLD delegations exist
- **Verisign**: Root Zone Maintainer — generates and signs the root zone file and distributes it to root server operators
- **13 operators**: Each independently operates their identity using the root zone file they receive from Verisign
- **ICANN**: Oversees the root zone management through the Root Zone Management framework, working with the community and governments

Changes to the root zone (adding, modifying, or removing TLD delegations) require requests through IANA's delegation procedures and involve notification to all stakeholders.

---

## References

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) — Domain Names: Concepts and Facilities
- [RFC 8499](https://www.rfc-editor.org/rfc/rfc8499) — DNS Terminology
- [RFC 8806](https://www.rfc-editor.org/rfc/rfc8806) — Running a Root Server Local to a Resolver
- [root-servers.org](https://root-servers.org/) — Root server operator statistics and instance maps
- [IANA Root Zone Database](https://www.iana.org/domains/root/db) — Authoritative TLD delegation records
- [IANA Root Files](https://www.iana.org/domains/root/files) — Root zone file and root hints file
- [Root Zone Management](https://www.iana.org/domains/root) — IANA root zone management procedures

## See Also

- [DNS root servers explained](https://dnschkr.com/blog/dns-root-servers-explained) — Deep dive into root server infrastructure and anycast deployment
- [TLD rankings by zone size](https://dnschkr.com/rankings) — Ranked TLD data including delegation counts and DNSSEC adoption
- [DNS record lookup tool](https://dnschkr.com/dns-inspector) — Query root, TLD, and authoritative nameservers directly
