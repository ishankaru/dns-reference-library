# What Is DNS

## Definition

The Domain Name System (DNS) is a hierarchical, distributed database that maps human-readable names to network resources — most commonly IP addresses. It serves as the naming infrastructure for the internet, enabling applications to resolve hostnames like `www.example.com` to addresses like `93.184.216.34` without users or applications needing to track address changes manually.

DNS is defined as an application-layer protocol. Queries and responses are carried over UDP port 53 for standard lookups, with TCP port 53 used when response payloads exceed 512 bytes (the original UDP limit), for zone transfers (AXFR/IXFR), and mandated by EDNS(0) extended payloads or DNSSEC responses that require reliable delivery. RFC 7766 formalises TCP as a mandatory transport for DNS implementations, not merely a fallback. For a step-by-step walkthrough of the resolution process, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

---

## The DNS Namespace

The DNS namespace is a tree structure rooted at a single unnamed node conventionally represented by a dot (`.`). Every node in the tree has a label, and the fully qualified path from any node back to the root forms that node's domain name.

```
                    . (root)
                    |
        +-----------+-----------+
        |           |           |
       com         net         org
        |
   +----+----+
   |         |
example    google
   |
  www
```

Key structural properties:

- **Labels** are the individual components separated by dots. Each label is 1–63 octets. The total length of a fully qualified domain name (FQDN) including all labels and separating dots must not exceed 253 characters (255 octets in wire format, where each label is length-prefixed and the root label is a zero-length octet).
- **Case insensitivity**: DNS labels are case-insensitive for ASCII characters. `EXAMPLE.COM` and `example.com` are the same name.
- **Internationalised labels**: RFC 5891 (IDNA 2008) defines how Unicode labels are encoded as ASCII-Compatible Encoding (ACE) prefixed with `xn--`. These are Internationalised Domain Names in Applications (IDNA).

---

## Key Terminology

**Zone**
A zone is a contiguous portion of the DNS namespace for which a particular nameserver holds authoritative data. A zone is not the same as a domain. A zone begins at a delegation boundary and includes all labels below that boundary unless a subdomain has been delegated away as its own zone.

**Label**
A single component of a domain name, separated by dots. In `mail.example.com`, the labels are `mail`, `example`, and `com`. The root label is empty (zero length).

**FQDN (Fully Qualified Domain Name)**
A domain name written from its rightmost label (closest to the root) to its leftmost label, terminated with a dot to indicate the root: `www.example.com.` The trailing dot is required for unambiguous representation but is often omitted in user-facing contexts. Without the trailing dot, a name is relative to some implied origin, which is resolver- and context-dependent.

**Delegation**
The mechanism by which authority over a subtree of the namespace is assigned to specific nameservers. A parent zone holds NS records pointing to the child zone's authoritative nameservers. The parent does not serve data for the child zone; it only provides the referral. This is the mechanism that makes DNS distributed.

**Authoritative Server**
A nameserver that holds the definitive data for a zone. It responds to queries with the `AA` (Authoritative Answer) flag set.

**Recursive Resolver**
A nameserver that performs the full resolution process on behalf of a client, traversing the hierarchy from root to authoritative server. Also called a full-service resolver.

**Stub Resolver**
A minimal resolver, typically embedded in an operating system, that sends queries to a configured recursive resolver. It does not perform iterative resolution itself.

**Resource Record (RR)**
The fundamental data unit in DNS. Each RR has a name, type, class, TTL, and RDATA. Common types include A, AAAA, MX, NS, CNAME, TXT, and SOA. You can inspect the full record set for any domain using a [DNS record lookup tool](https://dnschkr.com/dns-inspector).

**TTL (Time To Live)**
An unsigned 32-bit integer in seconds attached to every resource record. It governs how long a resolver may cache the record before it must be re-queried from an authoritative source. Setting TTL values is a trade-off between cache freshness and query load on authoritative servers. For guidance on choosing appropriate values, see [DNS TTL explained](https://dnschkr.com/blog/what-is-dns-ttl).

---

## DNS as an Application-Layer Protocol

DNS operates at the application layer of the internet protocol stack. Its wire format is defined independently of the transport layer, with the same message structure used over both UDP and TCP.

**Transport selection rules:**

| Condition | Transport |
|-----------|-----------|
| Standard query, response fits in negotiated payload | UDP/53 |
| Response exceeds negotiated payload (TC bit set) | Retry over TCP/53 |
| Zone transfer (AXFR, IXFR) | TCP/53 |
| DNS over TLS (DoT) | TCP/853 |
| DNS over HTTPS (DoH) | TCP/443 (HTTPS) |
| DNS over QUIC (DoQ) | UDP/853 |

EDNS(0) (RFC 6891) allows clients to advertise a larger UDP payload size (commonly 1232 or 4096 bytes), reducing the frequency of TCP fallback. However, path MTU considerations make 1232 bytes a common practical cap recommended by DNS Flag Day 2020 participants.

---

## Brief History

DNS was designed and specified by Paul Mockapetris at USC/ISI. Prior to DNS, name-to-address mapping was maintained in a single flat file (`HOSTS.TXT`) distributed from SRI-NIC. As ARPANET grew, this approach became unscalable — file size, update frequency, and the need for a hierarchical authority model all pointed to a distributed system.

**Timeline of key specifications:**

| Year | Document | Significance |
|------|----------|--------------|
| 1983 | RFC 882, RFC 883 | Mockapetris's original DNS design documents |
| 1987 | RFC 1034, RFC 1035 | Supersede 882/883; remain the foundational DNS specifications |
| 1993 | RFC 1591 | Domain Name System Structure and Delegation |
| 1997 | RFC 2181 | Clarifications to the DNS Specification |
| 1999 | RFC 2535 | Original DNSSEC specification (largely superseded) |
| 2005 | RFC 4033–4035 | Current DNSSEC specification |
| 2019 | RFC 8499 | DNS Terminology — canonical definitions for modern DNS |

RFC 1034 and RFC 1035 remain the normative baseline for DNS. RFC 8499 supersedes earlier terminology documents and provides authoritative definitions for terms that had accumulated inconsistent usage across the industry.

---

## Why DNS Is Distributed

No single server or organisation could serve authoritative data for all names in the global namespace. DNS solves this through delegation: each zone's operator runs nameservers for that zone and delegates authority for subzones to their respective operators. The only globally coordinated component is the root zone, maintained by IANA and operated by ICANN under contract with the US Department of Commerce (transitioned to the IANA Stewardship model in 2016).

This distribution provides:

- **Scalability**: Billions of queries per second handled globally without central coordination per query
- **Resilience**: No single point of failure for the namespace as a whole
- **Administrative autonomy**: Each zone operator controls their own data

---

## References

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) — Domain Names: Concepts and Facilities (Mockapetris, 1987)
- [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035) — Domain Names: Implementation and Specification (Mockapetris, 1987)
- [RFC 2181](https://www.rfc-editor.org/rfc/rfc2181) — Clarifications to the DNS Specification
- [RFC 5891](https://www.rfc-editor.org/rfc/rfc5891) — Internationalised Domain Names in Applications (IDNA): Protocol
- [RFC 6891](https://www.rfc-editor.org/rfc/rfc6891) — Extension Mechanisms for DNS (EDNS(0))
- [RFC 7766](https://www.rfc-editor.org/rfc/rfc7766) — DNS Transport over TCP — Implementation Requirements
- [RFC 8499](https://www.rfc-editor.org/rfc/rfc8499) — DNS Terminology
- [RFC 882](https://www.rfc-editor.org/rfc/rfc882) — Domain Names: Concepts and Facilities (original, 1983)
- [RFC 883](https://www.rfc-editor.org/rfc/rfc883) — Domain Names: Implementation and Specification (original, 1983)

## Tools

- [DNS record checker](https://dnschkr.com/dns-inspector) — Query A, AAAA, MX, NS, CNAME, TXT, and SOA records for any domain
- [Check DNS propagation worldwide](https://dnschkr.com/propagation-checker) — Verify record changes across global resolvers
