# DNS Amplification Attacks

DNS amplification is a volumetric DDoS technique that exploits open DNS resolvers to reflect and amplify traffic toward a victim. The attacker sends small queries with a spoofed source IP (the victim's address); the resolver sends large responses to the victim. The DNS protocol's asymmetric query-to-response size ratio provides the amplification factor.

DNS amplification accounted for a significant fraction of the largest DDoS attacks recorded before mitigations became widespread. In 2013, Spamhaus was targeted with a 300 Gbps attack using DNS amplification. In 2018, GitHub was hit with a 1.35 Tbps memcached amplification attack, but DNS amplification attacks in the 500 Gbps range remained common through that period.

---

## Attack Mechanics

### Source IP Spoofing

UDP does not require a connection. An attacker on a network that does not enforce source address validation can send UDP packets with an arbitrary source IP. By setting the source IP to the victim's address, all resolver responses are directed to the victim.

Without source address validation at the network edge, this is trivial. The attacker does not need to be on the same network as the victim. They only need access to a network that does not filter outbound packets for valid source IPs.

### Open Resolver Abuse

An open resolver answers queries from any source IP without restriction. Historically, misconfigured ISP resolvers and default-open residential routers created large populations of open resolvers. The Open Resolver Project catalogued millions of such resolvers at its peak. For more on the security risks of misconfigured resolvers, see [what is an open resolver and why it matters](https://dnschkr.com/blog/what-is-open-resolver).

The attacker queries the open resolver with the victim's IP as the source. The resolver processes the query and sends the response to the victim.

### Amplification Factor

The ratio of response size to query size determines the amplification factor.

**Typical DNS query:** 40–60 bytes (UDP header + DNS query)
**Typical DNS response (A record):** 60–100 bytes — minimal amplification
**ANY query response (pre-RFC 8482):** 2,000–4,000 bytes — 50–100x amplification
**DNSKEY query:** 1,000–3,000 bytes (large due to DNSSEC key material)
**TXT record query (SPF/DKIM zones):** 500–2,000 bytes

The ANY query type requested all records for a name, producing the largest possible response. Before RFC 8482 deprecated ANY as a query type for most purposes, it was the primary vector for maximum amplification.

**Calculation example:**
- Attacker sends 100 Mbps of query traffic
- Average amplification factor of 50x
- Victim receives 5 Gbps of traffic
- Attacker requires only 1/50th of the attack bandwidth

This asymmetry makes DNS amplification cost-effective and difficult to attribute to the attacker.

---

## ANY Query Exploitation

The `ANY` query type (QTYPE=255) historically asked the server to return all records of all types for a name. Authoritative servers for zones with many record types (MX, A, AAAA, TXT, NS, DNSKEY, etc.) returned very large responses.

Attackers consistently queried for domains known to have large ANY responses. isc.org and ripe.net were frequently abused as amplification sources because they had large DNSSEC-signed zones with many record types.

**RFC 8482 (2019)** deprecated the minimal-any behavior. Resolvers and authoritative servers now return a minimal response to ANY queries (typically a single record and a note that the response is not complete). This significantly reduced the amplification factor from ANY queries.

---

## Attack Variants

### NXDOMAIN Amplification

Queries for nonexistent names generate [NXDOMAIN responses](https://dnschkr.com/blog/what-is-nxdomain). DNSSEC-signed zones return NSEC/NSEC3 records in NXDOMAIN responses, which can be substantially larger than a simple NXDOMAIN. This vector can also be weaponized in dedicated [NXDOMAIN flood attacks](https://dnschkr.com/blog/nxdomain-attack).

### EDNS0 Buffer Size Manipulation

EDNS0 allows clients to advertise their UDP payload size (up to 65,535 bytes). A resolver or authoritative server respecting a large EDNS0 buffer size may send a much larger response than would otherwise fit in a standard 512-byte DNS response. Attackers include large EDNS0 buffer sizes in queries to maximize response size.

### Recursive vs. Authoritative Amplification

- **Open recursive resolvers** perform the full resolution process and return cached results. They are the primary target for abuse.
- **Authoritative servers** can also be abused directly if they respond to any source IP. However, authoritative responses are bounded by the zone's actual content rather than the full resolution result, limiting amplification potential relative to recursion.

---

## Infrastructure Impact

Beyond the victim, DNS amplification attacks harm:

- **Open resolvers** that carry the attack traffic and exhaust their bandwidth/CPU
- **Authoritative servers** for the queried domains, which receive query floods
- **Upstream ISPs** of all parties, whose links carry amplified traffic
- **Internet routing infrastructure** during very large attacks

At sufficient scale, these attacks can degrade DNS resolution for legitimate users of targeted authoritative zones, causing collateral outages.

---

## BCP38 — Source Address Validation

BCP38 (Best Current Practice 38, RFC 2827) defines network ingress filtering: ISPs and network operators should drop outbound packets with source addresses not in their assigned ranges.

If every network enforced BCP38, source IP spoofing — and therefore DNS amplification — would be impossible. A packet with a spoofed source IP would be dropped at the first hop.

**Current state:** BCP38 adoption remains incomplete. The Spoofer Project (MIT, now part of CAIDA) measures spoofing capability globally. As of recent measurements, approximately 20–25% of network probes from diverse ASes can successfully send spoofed packets that reach external destinations. This represents the population of networks that do not enforce ingress filtering.

Enforcement is an economic coordination problem: filtering benefits others, not the network implementing it. Networks that generate attack traffic bear no direct cost from that traffic and face implementation overhead to filter it. BCP38 requires industry-wide adoption to be effective, but adoption is voluntary.

### Related Standards

- **BCP84 (RFC 3704)** — Ingress filtering for multihomed networks
- **URPF (Unicast Reverse Path Forwarding)** — Router feature that drops packets whose source IP has no valid return path, effectively enforcing BCP38 on router hardware

---

## Response Rate Limiting (RRL)

RRL (Response Rate Limiting) is an authoritative server feature that limits the rate at which a server will send identical or similar responses to the same source IP. This mitigates amplification by throttling the server's contribution to the attack.

**How it works:**
1. The server tracks responses by (source IP, response type, query name) within a sliding time window.
2. Responses that exceed the rate limit are either dropped (slip=0) or converted to truncated (TC=1) responses at a configured slip rate.
3. Truncated responses signal the client to retry over TCP, which requires a full connection and eliminates the spoofing vector.

**Configuration example (BIND):**
```
rate-limit {
    responses-per-second 5;
    window 5;
    slip 2;
};
```

**Limitations:**
- Affects legitimate clients behind NAT that share a source IP with attack traffic
- Does not prevent open resolver abuse (only affects authoritative servers)
- Attackers can spread queries across source IPs (though this reduces amplification efficiency)

RRL was developed by Paul Vixie and Vernon Schryver and is documented in IETF informational draft `draft-ietf-dnsop-rrl`.

---

## Operational Mitigations

### Disable Open Recursion

The most effective mitigation for operators running resolvers is to restrict recursion to known clients.

**BIND:**
```
options {
    recursion yes;
    allow-recursion { 192.0.2.0/24; 198.51.100.0/24; };
};
```

**Unbound:**
```
server:
    access-control: 0.0.0.0/0 refuse
    access-control: 192.0.2.0/24 allow
```

### Anycast Distribution

Distributing resolvers via anycast across many locations spreads attack traffic geographically. Each anycast node absorbs a fraction of the amplified traffic. Major [DNS hosting providers](https://dnschkr.com/providers) like Cloudflare (1.1.1.1) and Google (8.8.8.8) use anycast across hundreds of PoPs, making volumetric exhaustion of any single resolver location impractical.

### Upstream Scrubbing

DDoS mitigation providers (Cloudflare, Akamai, Radware) offer DNS scrubbing services that absorb and filter attack traffic upstream of the victim. Traffic is rerouted via BGP or GRE tunneling to scrubbing centers that strip amplified DNS traffic before forwarding legitimate traffic to the origin.

### EDNS0 Response Size Limiting

Authoritative servers can be configured to cap EDNS0 response sizes regardless of the advertised buffer size in the query. Keeping responses small reduces the amplification factor even when queries are malicious.

---

## References

- RFC 2827 / BCP38 — Network Ingress Filtering: Defeating Denial of Service Attacks which employ IP Source Address Spoofing
- RFC 3704 / BCP84 — Ingress Filtering for Multihomed Networks
- RFC 8482 — Providing Minimal-Sized Responses to DNS Queries That Have QTYPE=ANY
- Vixie, P. & Schryver, V. — DNS Response Rate Limiting (DNS RRL). ISC Technical Report.
- Cloudflare (2013). The DDoS That Almost Broke the Internet. https://blog.cloudflare.com/the-ddos-that-almost-broke-the-internet/
- CAIDA Spoofer Project: https://spoofer.caida.org/
- Open Resolver Project: http://openresolverproject.org/
- US-CERT Alert (TA13-088A) — DNS Amplification Attacks
