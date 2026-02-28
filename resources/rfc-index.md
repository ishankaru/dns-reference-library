# DNS RFC Index

An annotated reference to the most important DNS-related RFCs, organized by topic. This is not exhaustive -- there are hundreds of DNS RFCs. These are the ones you will actually need to read, reference, or at least know exist. For a beginner-friendly walkthrough of the core protocol, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

Links point to the IETF Datatracker, which provides the full text, errata, and update history for each document.

---

## Core DNS Protocol

The foundational specifications that define how DNS works.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 1034](https://datatracker.ietf.org/doc/html/rfc1034) | Domain Names - Concepts and Facilities | The original DNS architecture document. Defines the namespace hierarchy, delegation model, and resolver behavior. Still the starting point for understanding DNS design. |
| [RFC 1035](https://datatracker.ietf.org/doc/html/rfc1035) | Domain Names - Implementation and Specification | The wire protocol specification. Defines message format, record types (A, NS, CNAME, SOA, MX, PTR, TXT), and the basics of zone files. Read alongside RFC 1034. |
| [RFC 2181](https://datatracker.ietf.org/doc/html/rfc2181) | Clarifications to the DNS Specification | Resolves ambiguities in RFCs 1034/1035. Clarifies TTL handling, CNAME semantics, data ranking rules, and authoritative vs. non-authoritative answers. Essential reading. |
| [RFC 8499](https://datatracker.ietf.org/doc/html/rfc8499) | DNS Terminology | Standardizes DNS terminology. Defines what "authoritative," "recursive," "stub resolver," "bailiwick," and dozens of other terms actually mean. Reference this when terms are used inconsistently elsewhere. |

## DNSSEC

DNS Security Extensions -- cryptographic authentication of DNS responses.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 4033](https://datatracker.ietf.org/doc/html/rfc4033) | DNS Security Introduction and Requirements | DNSSEC overview. Explains the threat model, the chain of trust concept, and what DNSSEC does and does not protect against. Start here before reading 4034/4035. |
| [RFC 4034](https://datatracker.ietf.org/doc/html/rfc4034) | Resource Records for the DNS Security Extensions | Defines DNSKEY, RRSIG, NSEC, and DS record types. Specifies their wire format, canonical ordering rules, and signature generation procedures. |
| [RFC 4035](https://datatracker.ietf.org/doc/html/rfc4035) | Protocol Modifications for the DNS Security Extensions | How resolvers and authoritative servers process DNSSEC records. Covers validation logic, the authenticated data (AD) flag, and opt-in behavior. |
| [RFC 5155](https://datatracker.ietf.org/doc/html/rfc5155) | DNS Security (DNSSEC) Hashed Authenticated Denial of Existence | Defines NSEC3, which provides authenticated denial of existence without revealing all names in a zone. Addresses the zone enumeration concern with plain NSEC. |
| [RFC 8624](https://datatracker.ietf.org/doc/html/rfc8624) | Algorithm Implementation Requirements and Usage Guidance for DNSSEC | Specifies which DNSSEC algorithms are mandatory, recommended, or deprecated. Check this before choosing signing algorithms -- it changes over time. |

## DNS Transport

How DNS queries and responses are transmitted over the network.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 7858](https://datatracker.ietf.org/doc/html/rfc7858) | Specification for DNS over Transport Layer Security (DoT) | DNS over TLS on port 853. Encrypts DNS traffic between stub resolvers and recursive resolvers. The first standardized encrypted DNS transport. |
| [RFC 8484](https://datatracker.ietf.org/doc/html/rfc8484) | DNS Queries over HTTPS (DoH) | DNS over HTTPS using standard HTTP/2. Queries are encoded as DNS wire format in HTTP request/response bodies. Controversial because it moves DNS into the HTTPS port (443), making it harder to distinguish from web traffic. |
| [RFC 9250](https://datatracker.ietf.org/doc/html/rfc9250) | DNS over Dedicated QUIC Connections (DoQ) | DNS over QUIC on port 853. Combines TLS 1.3 encryption with QUIC's connection establishment and multiplexing benefits. Lower latency than DoT for new connections. |

## Email Authentication

DNS records used to authenticate email senders and prevent spoofing.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 7208](https://datatracker.ietf.org/doc/html/rfc7208) | Sender Policy Framework (SPF) for Authorizing Use of Domains in Email | Defines SPF (published as TXT records). Specifies which IP addresses are authorized to send email for a domain. Covers the lookup algorithm, macro syntax, and the 10-lookup limit. |
| [RFC 6376](https://datatracker.ietf.org/doc/html/rfc6376) | DomainKeys Identified Mail (DKIM) Signatures | Defines DKIM, which uses public key cryptography to sign email headers and body. The public key is published as a DNS TXT record. Allows receivers to verify that a message was not modified in transit. |
| [RFC 7489](https://datatracker.ietf.org/doc/html/rfc7489) | Domain-based Message Authentication, Reporting, and Conformance (DMARC) | Builds on SPF and DKIM. Defines a policy mechanism (published as a DNS TXT record at `_dmarc.domain`) that tells receivers what to do when authentication fails, and provides aggregate and forensic reporting. |

## Record Types

RFCs that define specific DNS record types beyond those in RFC 1035.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 3596](https://datatracker.ietf.org/doc/html/rfc3596) | DNS Extensions to Support IP Version 6 | Defines the AAAA record type for mapping domain names to IPv6 addresses. Short and straightforward. |
| [RFC 2782](https://datatracker.ietf.org/doc/html/rfc2782) | A DNS RR for Specifying the Location of Services (DNS SRV) | Defines SRV records, which allow services to advertise their location (host and port) via DNS. Used by LDAP, SIP, XMPP, Minecraft, and many internal service discovery systems. |
| [RFC 6844](https://datatracker.ietf.org/doc/html/rfc6844) | DNS Certification Authority Authorization (CAA) Resource Record | Defines CAA records, which specify which Certificate Authorities are authorized to issue certificates for a domain. CAs are required to check CAA before issuance since September 2017. |
| [RFC 7871](https://datatracker.ietf.org/doc/html/rfc7871) | Client Subnet in DNS Queries | Defines the EDNS Client Subnet (ECS) option, which allows recursive resolvers to pass a portion of the client's IP address to authoritative servers. Used by CDNs for geo-aware DNS responses. Privacy implications are significant. |

## Operations and Best Practices

Practical guidance for running DNS infrastructure correctly.

| RFC | Title | Description |
|-----|-------|-------------|
| [RFC 1912](https://datatracker.ietf.org/doc/html/rfc1912) | Common DNS Operational and Configuration Errors | A catalog of mistakes people make when configuring DNS. Written in 1996 but most of the errors described are still regularly committed today. Required reading for anyone managing zones. |
| [RFC 2308](https://datatracker.ietf.org/doc/html/rfc2308) | Negative Caching of DNS Queries (DNS NCACHE) | Defines how resolvers cache negative responses (NXDOMAIN, NODATA). Explains the SOA minimum TTL field's role in negative caching. Understanding this prevents confusion about why deleted records seem to persist. |
| [RFC 8767](https://datatracker.ietf.org/doc/html/rfc8767) | Serving Stale Data to Improve DNS Resiliency | Specifies how resolvers can serve expired (stale) cached data when authoritative servers are unreachable. A practical resilience mechanism that major resolvers now implement. |

---

## Further Reading

This index covers the RFCs most relevant to day-to-day DNS work. For a complete list of all DNS-related RFCs, see the [IETF DNS-related RFCs page](https://www.rfc-editor.org/search/rfc_search_detail.php?title=dns) or the [DNSOP Working Group](https://datatracker.ietf.org/wg/dnsop/documents/) document list.

For practical tools to test and verify the protocols described in these RFCs, try the [DNS record inspector](https://dnschkr.com/dns-inspector) and [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) at dnschkr.com.
