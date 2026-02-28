# How DNS Resolution Works

## Overview

DNS resolution is the process of converting a domain name into a resource record — most commonly an IP address. The process involves up to four distinct actors: the stub resolver, the recursive resolver, one or more root servers, TLD nameservers, and the authoritative nameserver for the queried zone. In practice, caching at every layer means most queries are answered without traversing the full chain. To look [into DNS resolution results](https://dnschkr.com/dns-inspector) for any domain, query its records against authoritative nameservers directly.

---

## The Resolution Chain

```
Client Application
       |
       | (1) Query: www.example.com A?
       v
  Stub Resolver  (OS resolver library, /etc/resolv.conf)
       |
       | (2) Recursive query to configured resolver
       v
 Recursive Resolver  (e.g., 8.8.8.8, 1.1.1.1, ISP resolver)
       |
       | (3) Not cached. Begin iterative resolution.
       |
       | (4) Query root servers: www.example.com A?
       v
 Root Server  (e.g., a.root-servers.net)
       |
       | (5) Referral: NS records for .com zone
       |     → a.gtld-servers.net, b.gtld-servers.net, ...
       v
 TLD Nameserver  (e.g., a.gtld-servers.net)
       |
       | (6) Referral: NS records for example.com
       |     → ns1.example.com, ns2.example.com
       v
 Authoritative Nameserver  (ns1.example.com)
       |
       | (7) Answer: www.example.com A 93.184.216.34 TTL 3600
       v
 Recursive Resolver
       | (caches the answer per TTL)
       | (8) Returns answer to stub resolver
       v
  Stub Resolver
       | (may cache per OS policy)
       | (9) Returns to application
       v
Client Application
       | Connects to 93.184.216.34
```

Steps 4–7 represent the iterative resolution performed by the recursive resolver. The client is only involved in steps 1–2 and 9. For a deeper dive into each stage with packet-level examples, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

---

## Iterative vs Recursive Queries

**Recursive query**: The queried server is expected to do all the work and return a final answer. Clients send recursive queries to their recursive resolver (the `RD` bit, Recursion Desired, is set in the request header). If the server supports recursion and the `RA` bit (Recursion Available) is set in the response, it will resolve the name fully before replying.

**Iterative query**: The queried server returns the best answer it has — either a final answer or a referral to other nameservers that may know more. The querying party (in practice, the recursive resolver) is responsible for following referrals. Root servers and TLD nameservers respond iteratively; they do not perform recursion on behalf of callers.

The recursive resolver acts as the bridge: it accepts a recursive query from the client, then performs a series of iterative queries against the DNS hierarchy to find the answer.

---

## DNS Message Format

Every DNS message — query or response — uses the same wire format defined in RFC 1035, Section 4. A message consists of five sections:

### Header (12 bytes, always present)

| Field | Bits | Description |
|-------|------|-------------|
| ID | 16 | Query identifier; response copies this value |
| QR | 1 | 0 = query, 1 = response |
| OPCODE | 4 | 0 = QUERY, 1 = IQUERY (obsolete), 2 = STATUS |
| AA | 1 | Authoritative Answer — set by authoritative servers |
| TC | 1 | Truncated — response exceeded transport limit |
| RD | 1 | Recursion Desired — set by client |
| RA | 1 | Recursion Available — set by server if it supports recursion |
| Z | 1 | Reserved, must be zero |
| AD | 1 | Authentic Data — DNSSEC validated (RFC 4035) |
| CD | 1 | Checking Disabled — bypass DNSSEC validation (RFC 4035) |
| RCODE | 4 | Response code (see below) |
| QDCOUNT | 16 | Number of entries in Question section |
| ANCOUNT | 16 | Number of entries in Answer section |
| NSCOUNT | 16 | Number of entries in Authority section |
| ARCOUNT | 16 | Number of entries in Additional section |

### Question Section

Contains the name being queried, the QTYPE (record type: A, AAAA, MX, etc.), and QCLASS (typically IN for Internet). A standard DNS query has exactly one question entry, though the protocol permits multiple (virtually no implementations use this).

### Answer Section

Resource records that directly answer the question. May be empty in referral responses or error responses.

### Authority Section

NS records pointing to authoritative nameservers for the zone being referred to, or the SOA record for negative responses (NXDOMAIN or NODATA). The SOA's minimum TTL field governs negative caching per RFC 2308.

### Additional Section

Records that anticipate follow-up queries. Primarily used for glue records (A/AAAA addresses for nameservers named within the zone being delegated) and EDNS(0) OPT pseudo-records.

---

## Response Codes (RCODE)

| RCODE | Name | Meaning |
|-------|------|---------|
| 0 | NOERROR | Query completed successfully |
| 1 | FORMERR | Query was malformed |
| 2 | SERVFAIL | Server failed to process query |
| 3 | NXDOMAIN | Name does not exist |
| 4 | NOTIMP | Query type not implemented by server |
| 5 | REFUSED | Server refuses to answer this query |
| 6 | YXDOMAIN | Name exists when it should not (update) |
| 7 | YXRRSET | RR set exists when it should not (update) |
| 8 | NXRRSET | RR set does not exist (update) |
| 9 | NOTAUTH | Server not authoritative for zone (update) |
| 10 | NOTZONE | Name not in zone (update) |

**Operational interpretations:**

- `NXDOMAIN` means the queried name does not exist in the DNS. The authoritative server for the zone confirms the name's absence. See [NXDOMAIN explained](https://dnschkr.com/blog/what-is-nxdomain) for a detailed breakdown of this response code and common causes.
- `NOERROR` with an empty answer section (called a NODATA response) means the name exists but has no records of the requested type. This is distinct from NXDOMAIN.
- `SERVFAIL` is returned by recursive resolvers when they cannot complete resolution — due to unreachable authoritative servers, DNSSEC validation failure, or internal errors. It is distinct from the authoritative server's own failures.
- `REFUSED` is common from authoritative servers that receive recursive queries from unauthorized sources, and from recursive resolvers that enforce access control (e.g., blocking queries from outside their service network).

Extended RCODEs (values 11–15 are unassigned; 16+ require EDNS(0) to be signalled) include BADVERS (16) for EDNS version mismatch and BADSIG (16, same value, context-dependent) for TSIG errors.

---

## Caching and TTL Behavior

Caching is fundamental to DNS scalability. Without it, every DNS query would require traversal of the full hierarchy, placing enormous load on root and TLD servers.

**Cache lifetime**: Each resource record carries a [TTL (Time To Live)](https://dnschkr.com/blog/what-is-dns-ttl) value set by the zone operator. Resolvers decrement this value as time passes and must not serve a cached record beyond its TTL.

**Negative caching**: RFC 2308 defines caching of NXDOMAIN and NODATA responses. The negative TTL is the minimum of the SOA's minimum field and the SOA record's own TTL. Resolvers cache negative responses to avoid hammering authoritative servers for names that do not exist.

**Cache hierarchy**: Caching occurs at multiple points:
1. The recursive resolver (primary cache, shared across all clients it serves)
2. The stub resolver / OS resolver library (per-process or system-wide, typically short-lived)
3. The application itself (e.g., JVM DNS cache, browser DNS cache — often ignores TTL)

**TTL design considerations for zone operators:**

| Scenario | Recommended TTL |
|----------|-----------------|
| Stable records (MX, NS) | 3600–86400 seconds |
| Records subject to change | 300–3600 seconds |
| Pre-migration (imminent change) | 300 seconds or lower |
| Root zone NS records | 518400 seconds (6 days) |

**Minimum TTL**: RFC 2181 clarifies that a TTL of 0 means the record must not be cached; every query requires a fresh lookup. This is rarely appropriate for production use due to latency and load implications.

**TTL clamping**: Some public resolvers impose a minimum TTL floor (commonly 30–60 seconds) to prevent cache poisoning via TTL 0 records used as an attack vector.

---

## EDNS(0) and Extended Capabilities

The original DNS message format limited UDP payloads to 512 bytes. RFC 6891 (EDNS(0)) extends this by adding a pseudo-RR of type OPT to the additional section. This OPT record carries:

- Requested UDP payload size (commonly 1232 or 4096 bytes)
- Extended RCODE bits (upper 8 bits, allowing RCODEs > 15)
- EDNS version (must be 0 for current implementations)
- EDNS flags including the DO (DNSSEC OK) bit
- Variable-length options (e.g., NSID, Client Subnet, Padding, Cookies)

Servers that do not support EDNS(0) may return FORMERR or silently drop queries with OPT records. Modern DNS implementations universally support EDNS(0). DNS Flag Day 2019 established a baseline: resolvers that do not support EDNS(0) are treated as broken and are not given TCP fallback workarounds.

---

## References

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) — Domain Names: Concepts and Facilities
- [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035) — Domain Names: Implementation and Specification
- [RFC 2181](https://www.rfc-editor.org/rfc/rfc2181) — Clarifications to the DNS Specification
- [RFC 2308](https://www.rfc-editor.org/rfc/rfc2308) — Negative Caching of DNS Queries
- [RFC 6891](https://www.rfc-editor.org/rfc/rfc6891) — Extension Mechanisms for DNS (EDNS(0))
- [RFC 7766](https://www.rfc-editor.org/rfc/rfc7766) — DNS Transport over TCP
- [RFC 8499](https://www.rfc-editor.org/rfc/rfc8499) — DNS Terminology

## Tools

- [DNS record checker](https://dnschkr.com/dns-inspector) — Query any record type against authoritative nameservers
- [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) — Observe how cached records update across global resolvers in real time
- [dig command guide](https://dnschkr.com/blog/dig-command-guide) — Inspect the full DNS resolution chain from the command line
