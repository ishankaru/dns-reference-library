# Recursive vs Authoritative DNS Servers

## Two Distinct Roles

DNS servers perform one of two fundamentally different functions — and the distinction is not merely operational but architectural. Conflating these roles is a common source of confusion when diagnosing DNS problems.

An **authoritative server** holds zone data and answers queries about names within its zones with finality. It speaks for the zone.

A **recursive resolver** finds answers on behalf of clients by querying the DNS hierarchy. It does not hold zone data; it discovers it.

These roles are not mutually exclusive in the protocol — a server can technically be both — but in modern production deployments they are almost always separated for security and performance reasons.

---

## Authoritative Nameservers

### What They Do

An authoritative nameserver is the definitive source for a zone. When a query for a name within its zone arrives, the authoritative server responds with:

- The requested resource record(s) (if they exist), with the `AA` (Authoritative Answer) bit set
- An NXDOMAIN response (RCODE 3) if the name does not exist within the zone
- A NODATA response (NOERROR with empty answer section) if the name exists but lacks records of the queried type
- A referral with NS records (without the AA bit) if the queried name is within a delegated subzone

### The AA Bit

The Authoritative Answer flag (bit 5 of the second header byte) is set exclusively by authoritative servers when they answer from their own zone data. Recursive resolvers do not set this bit when returning cached answers, even if the cached answer originally came from an authoritative server. The presence of the AA flag tells the client that the answer came directly from the zone's authority.

### Zone Data Sources

Authoritative servers load zone data from:

- **Zone files**: Plain-text master files in the format defined by RFC 1035, Section 5
- **Database backends**: Proprietary or standardised (e.g., PowerDNS with MySQL, BIND DLZ)
- **Zone transfers**: AXFR (full) or IXFR (incremental) from a primary server to secondary servers

### Primary and Secondary (formerly Master/Slave)

RFC 8499 standardises the preferred terminology as **primary** and **secondary** (replacing the older master/slave terminology).

- **Primary**: Holds the original, writable copy of zone data. The SOA MNAME field identifies the primary server.
- **Secondary**: Maintains a read-only copy obtained via zone transfer from the primary. Serves authoritative answers from this copy. A zone may have multiple secondaries for redundancy and geographic distribution.

A secondary server serves with full authority (AA bit set) from its transferred copy. It does not forward queries to the primary at query time.

### Examples of Authoritative DNS Platforms

| Platform | Type | Notes |
|----------|------|-------|
| Amazon Route 53 | Cloud-managed | Anycast, integrates with AWS services |
| Cloudflare DNS (authoritative) | Cloud-managed | Distinct from 1.1.1.1 resolver; managed via Cloudflare dashboard |
| NS1 | Cloud-managed | Traffic management, filter chains |
| Azure DNS | Cloud-managed | Integrated with Azure Resource Manager |
| Google Cloud DNS | Cloud-managed | 100% uptime SLA |
| BIND (named) | Self-hosted | Most widely deployed open-source DNS server |
| PowerDNS Authoritative | Self-hosted | Flexible backends, REST API |
| Knot DNS | Self-hosted | High performance, designed for TLD operators |
| NSD | Self-hosted | Authoritative-only, used by TLD operators |

For market share data across these platforms, see the [DNS hosting providers directory](https://dnschkr.com/providers).

---

## Recursive Resolvers

### What They Do

A recursive resolver (also called a full-service resolver or caching resolver) performs resolution on behalf of a client. When a query arrives with the RD (Recursion Desired) bit set and the resolver does not have a cached answer, it:

1. Queries a root server (using its root hints or a primed root cache) for the TLD's nameservers
2. Queries the TLD's nameservers for the authoritative nameservers of the domain
3. Queries those authoritative nameservers for the requested record
4. Caches the answer according to the record's TTL
5. Returns the answer to the client

The resolver tracks NXDOMAIN and NODATA responses and caches them as negative cache entries (RFC 2308).

### Forwarding Resolvers

A forwarding resolver does not perform the full iterative resolution process. Instead, it forwards all queries to one or more upstream resolvers (called forwarders) and returns their answers. The forwarding resolver may cache responses.

**Use cases for forwarding:**
- Split-horizon DNS: internal resolvers forward to internal authoritative servers for private zones, and to a public resolver for everything else
- Network appliances or small routers that cannot perform full iterative resolution efficiently
- Restricting outbound DNS to a controlled set of resolvers

A forwarding resolver is not the same as a recursive resolver, even if it returns recursive answers to clients. The distinction matters when diagnosing resolution failures: a forwarding resolver depends entirely on its configured upstream, so a failure at the upstream propagates to all clients.

### Caching Resolvers

The terms "recursive resolver" and "caching resolver" are often used interchangeably. All full recursive resolvers cache; it is how they achieve the performance needed to serve millions of clients. A resolver that does not cache is technically possible but impractical — it would re-traverse the full hierarchy for every query.

---

## Open Resolvers and Security Implications

An **open resolver** is a recursive resolver that accepts and processes queries from any source IP address, not just its intended clients. For a full analysis of the risks, see [what is an open DNS resolver](https://dnschkr.com/blog/what-is-open-resolver).

### Security Risks

**DNS Amplification / Reflection Attacks**: Open resolvers can be abused in DDoS attacks. An attacker sends queries with a spoofed source IP (the victim's address) to large numbers of open resolvers. The resolvers return answers to the victim. DNS responses are often significantly larger than the queries (amplification factor of 10x–70x is common with DNSSEC-signed zones), turning the resolvers into unwitting amplifiers. This is one of several [common DNS attack vectors](https://dnschkr.com/blog/dns-attacks-guide) targeting resolver infrastructure.

**Cache Poisoning**: Open resolvers have a larger attack surface. Accepting queries from arbitrary sources increases the difficulty of correlating source ports and transaction IDs, which are the primary defences against cache poisoning (RFC 5452).

**Information Disclosure**: Resolvers that accept queries from outside may reveal internal network information through observed query patterns.

### Mitigation

- Restrict recursive service to authorised clients only (ACLs by source IP)
- Implement Response Rate Limiting (RRL) for authoritative servers (RFC 8020 discusses related semantics; RRL is vendor-specific)
- Never configure a general-purpose authoritative server to also perform recursion for external clients

---

## Well-Known Public Recursive Resolvers

| Provider | IPv4 | IPv6 | Notes |
|----------|------|------|-------|
| Google Public DNS | 8.8.8.8, 8.8.4.4 | 2001:4860:4860::8888 | Supports DoT, DoH |
| Cloudflare | 1.1.1.1, 1.0.0.1 | 2606:4700:4700::1111 | Supports DoT, DoH; privacy-focused logging policy |
| Quad9 | 9.9.9.9, 149.112.112.112 | 2620:fe::fe | Threat-blocking; non-profit operator |
| OpenDNS (Cisco) | 208.67.222.222 | 2620:119:35::35 | Optional content filtering |
| Comodo Secure DNS | 8.26.56.26, 8.20.247.20 | — | Malware domain blocking |

These are **recursive** resolvers. Cloudflare also operates an **authoritative** DNS platform (separate infrastructure, accessed via Cloudflare dashboard), which is a distinct service. This naming overlap is a frequent source of confusion when troubleshooting.

---

## Practical Differences in Behaviour

| Characteristic | Authoritative Server | Recursive Resolver |
|----------------|---------------------|-------------------|
| AA bit in responses | Set for own zones | Never set |
| Holds zone files | Yes | No |
| Performs iterative queries | No (only for delegation) | Yes, always |
| Caches third-party records | No | Yes |
| Accepts RD=1 from clients | No (typically) | Yes |
| Should be open to internet | Yes (for public zones) | No (restrict to clients) |
| Responds to zone transfers | Yes (primary/secondary) | No |

---

## References

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) — Domain Names: Concepts and Facilities
- [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035) — Domain Names: Implementation and Specification
- [RFC 2308](https://www.rfc-editor.org/rfc/rfc2308) — Negative Caching of DNS Queries
- [RFC 5358](https://www.rfc-editor.org/rfc/rfc5358) — Preventing Use of Recursive Nameservers in Reflector Attacks
- [RFC 5452](https://www.rfc-editor.org/rfc/rfc5452) — Measures for Making DNS More Resilient Against Forged Answers
- [RFC 7816](https://www.rfc-editor.org/rfc/rfc7816) — DNS Query Name Minimisation to Improve Privacy
- [RFC 8499](https://www.rfc-editor.org/rfc/rfc8499) — DNS Terminology (primary/secondary terminology)
- [RFC 9471](https://www.rfc-editor.org/rfc/rfc9471) — DNS Glue Requirements in Referral Responses

## Tools

- [Check DNS records for any domain](https://dnschkr.com/dns-inspector) — Query authoritative and recursive responses side by side
- [DNS security findings dashboard](https://dnschkr.com/security) — Research on open resolvers, lame delegations, and nameserver vulnerabilities
