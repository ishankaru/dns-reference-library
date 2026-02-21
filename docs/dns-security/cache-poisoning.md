# DNS Cache Poisoning

DNS cache poisoning is the insertion of fraudulent records into a recursive resolver's cache. Once poisoned, the resolver serves the attacker's data to all clients using it until the TTL expires, without further active involvement from the attacker.

The attack exploits the fact that DNS is a stateless UDP protocol with a 16-bit transaction ID as its only authentication mechanism. Poisoning a cache affects all downstream clients — potentially millions — from a single successful injection.

---

## How Caching Works

Recursive resolvers cache DNS responses to reduce latency and authoritative server load. When a response is received, it is stored with its TTL. Subsequent queries for the same name return the cached record without contacting authoritative servers.

The cache stores the full response: answer records, authority section NS records, and additional section glue records. An attacker who controls what is written to any of these sections controls what the resolver and its clients believe about those names.

---

## The Classic Birthday Attack

Named after the birthday paradox, this attack exploits collision probability in the transaction ID space.

**Transaction ID space:** 16 bits = 65,536 possible values.

**Attack procedure:**

1. The attacker sends many queries to the resolver for a name under the victim domain.
2. Simultaneously, the attacker floods the resolver with forged responses containing different transaction IDs.
3. When a forged response's transaction ID matches the resolver's outstanding query, it is accepted.

**Probability:** With a fixed source port (pre-2008 practice), sending 65,536 forged responses gives roughly a 50% chance of a match per query. Sending multiple queries multiplies attempts but also multiplies the resolver's legitimate queries.

**Limitation:** The attacker must win the race against the legitimate authoritative response. On fast networks, the authoritative response arrives quickly, leaving a narrow window.

---

## The Kaminsky Variant (2008)

Dan Kaminsky's improvement transformed cache poisoning from a nuisance into a systemic threat. The key insight was to poison NS records rather than A records, enabling repeated attempts.

**Classic attack:** Each attempt targets a single hostname. Once the legitimate response is cached, the window closes.

**Kaminsky improvement:**
1. Query for a random subdomain: `a1b2c3.example.com`, `d4e5f6.example.com`, etc.
2. Each random subdomain produces a cache miss, forcing the resolver to send a new query.
3. The forged response includes not just the (nonexistent) subdomain answer, but also a poisoned authority section overwriting `example.com`'s NS records.
4. The attacker gets unlimited attempts by changing the subdomain on each try.

**Result:** The authoritative delegation for `example.com` is replaced with attacker-controlled nameservers. All subsequent queries for any name under `example.com` are answered by the attacker.

**Why it worked at scale:** The attack requires guessing only 16 bits (transaction ID) against a fixed source port. At 1,000 forged responses per second, 65 seconds gives statistically near-certain success. Kaminsky demonstrated this was practical before patches were deployed.

**Coordinated vendor response:** Kaminsky disclosed privately to major DNS vendors (BIND, Microsoft, Cisco, etc.) in March 2008. A coordinated patch release occurred on July 8, 2008, before public disclosure. This remains a model for large-scale coordinated vulnerability disclosure.

---

## Source Port Randomization

The primary mitigation deployed after Kaminsky's disclosure. Instead of using a fixed source port (53 or a single ephemeral port), the resolver randomizes the source port for each outgoing query.

**Entropy expansion:** Transaction ID (16 bits) + source port (16 bits, minus reserved ranges) = approximately 32 bits of effective entropy.

**Attack cost:** To poison a cache with 32-bit entropy, an attacker must flood approximately 4 billion responses to achieve near-certain success. At 1 million packets per second, this takes roughly 72 minutes — much less practical but not impossible.

**Limitation:** Source port randomization is a defense-in-depth measure. It raises the bar but does not eliminate off-path poisoning. It is specifically circumvented by SAD DNS (see below) and is insufficient against on-path attackers who can observe the source port directly.

RFC 5452 (2009) documents the requirements for making DNS more resilient against forged answers, including source port randomization.

---

## SAD DNS (Side-channel AttackeD DNS, 2020)

SAD DNS is an off-path cache poisoning attack that infers the open source port used by a resolver via an ICMP side channel, dramatically reducing brute-force complexity.

**Discovery:** Keyu Man, Xin'an Zhou, Zhiyun Qian (UC Riverside / Georgia Tech), published at CCS 2020.

**Mechanism:**

Linux kernels implement global ICMP rate limiting (default: 1,000 ICMP messages per second). When a UDP packet arrives at a closed port, the kernel sends an ICMP "port unreachable" message. When a packet arrives at an open port (where the resolver is listening), no ICMP is generated.

Attack procedure:
1. The attacker sends UDP probes to the resolver's external IP on port 0 through 65,535 in batches.
2. The rate of ICMP replies received reflects how many of the probed ports were closed.
3. When ICMP rate drops significantly, the attacker has identified a batch containing the open port.
4. Binary search narrows the open port to a single value within seconds.
5. Now knowing the source port, the attacker only needs to brute-force the 16-bit transaction ID.

**Practical impact:** SAD DNS reduces the effective entropy from ~32 bits to 16 bits. On a standard Linux resolver, the attack succeeds within 60–120 seconds.

**Vulnerable systems:** Any Linux-based resolver (BIND, Unbound, dnsmasq) on the default kernel configuration. The vulnerability is in the OS ICMP stack, not the DNS software.

**Mitigations:**
- Disable ICMP globally on resolver hosts: `net.ipv4.icmp_ratelimit = 0` (makes all ports appear closed to the probe)
- Block inbound UDP probes at the network perimeter for resolver IPs
- DNSSEC validation (renders poisoned records invalid regardless of how they were injected)
- DNS cookies (RFC 7873): a stateful transaction cookie added to EDNS0 options

---

## 0x20 Encoding

An optional heuristic where resolvers randomize the case of outgoing query names (e.g., `eXaMpLe.cOm`) and verify that responses echo the exact same case pattern. DNS is case-insensitive for name resolution purposes, but the authoritative server must return the same case that was queried.

An off-path attacker who has not observed the query cannot know the case pattern and will fail to match it. A forged response with different case encoding is rejected.

**Status:** Not standardized. Implemented in some resolvers (including newer versions of BIND and Unbound). Provides no protection against on-path attackers who can observe and mirror the case from the original query.

DNS cookies (RFC 7873) provide a more robust alternative for resolvers that support them.

---

## DNSSEC as a Defense

DNSSEC is the only mitigation that addresses the root cause: the absence of authentication in DNS responses.

A DNSSEC-validating resolver cryptographically verifies every response against signatures in the zone. A poisoned response — whether injected via birthday attack, Kaminsky, or SAD DNS — will either lack valid signatures or have signatures that fail verification. The resolver returns SERVFAIL and does not cache the fraudulent data.

**Coverage gap:** DNSSEC protects only zones that are signed. For unsigned zones, DNSSEC validation provides no protection. As of 2026, a significant fraction of domains remain unsigned. You can check whether a domain's zone is signed using a [DNS record lookup tool](https://dnschkr.com/dns-inspector) that displays DNSKEY and RRSIG records.

**Deployment:** DNSSEC validation must be enabled on the resolver side. Authoritative zones must be signed. Both conditions must be met for DNSSEC to protect a given resolution path.

---

## DNS Cookies (RFC 7873)

DNS cookies add a client cookie (random 64-bit value sent with each query) and a server cookie (derived from client IP, port, and server secret) to EDNS0 options. The server verifies the client cookie in subsequent requests. An off-path attacker who cannot observe the cookie exchange cannot forge a valid response.

DNS cookies are lightweight, stateless (no TCP), and do not require cryptographic key management. They defend against off-path spoofing without the deployment overhead of DNSSEC. RFC 7873 defines the mechanism; RFC 9018 standardizes the server cookie algorithm.

---

## Summary of Defenses

| Defense | Threat Addressed | Coverage |
|---------|-----------------|----------|
| Source port randomization | Off-path brute force | All unsigned zones |
| 0x20 encoding | Off-path injection | All unsigned zones (heuristic) |
| DNS cookies (RFC 7873) | Off-path injection | Participating resolvers/servers |
| DNSSEC validation | All cache poisoning attacks | Only signed zones |
| DoT/DoH to resolver | On-path client-to-resolver injection | Full path to configured resolver |
| ICMP rate limit disable | SAD DNS side channel | Linux resolvers |

---

## References

- RFC 5452 — Measures for Making DNS More Resilient Against Forged Answers
- RFC 7873 — Domain Name System (DNS) Cookies
- RFC 9018 — Interoperable Domain Name System (DNS) Server Cookies
- For a detailed analysis of cache poisoning mechanics and real-world incidents, see this [DNS cache poisoning deep dive](https://dnschkr.com/blog/dns-cache-poisoning).
- For broader context on DNS attack vectors including cache poisoning, see the [comprehensive DNS attacks guide](https://dnschkr.com/blog/dns-attacks-guide).
- Kaminsky, D. (2008). Black Ops 2008: It's the End of the Cache as We Know It. DEF CON 16.
- Man, K. et al. (2020). DNS Cache Poisoning Attack Reloaded: Revolutions with Side Channels. ACM CCS 2020.
- Herzberg, A. & Shulman, H. (2012). Fragmentation Considered Poisonous. IEEE CNS.
- Vixie, P. & Gudmundsson, O. (2002). Randomness Recommendations for DNS. IETF.
- BIND 9 Administrator Reference Manual — Security hardening section.
