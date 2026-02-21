# DNS Spoofing and Hijacking

DNS spoofing is the injection of fraudulent DNS data into a resolver's cache or a client's resolution path, redirecting users to attacker-controlled infrastructure. The terms spoofing and hijacking are often used interchangeably, but hijacking more precisely describes sustained redirection (infrastructure compromise or rogue server deployment) whereas spoofing typically describes transient injection attacks.

---

## Attack Taxonomy

### On-Path (Man-in-the-Middle) Attacks

An attacker positioned between a client and its resolver, or between a resolver and an authoritative server, can intercept DNS queries and inject fabricated responses. The attacker must win the race against the legitimate response.

Requirements:
- Network position allowing packet interception (ARP spoofing on LAN, compromised router, BGP prefix hijack)
- Knowledge of the query ID (16-bit, trivially observable for on-path attackers)
- Matching source IP, destination IP, source port, and query ID

On-path attacks are straightforward on networks where the attacker can observe traffic. The UDP nature of DNS makes injection simple — there is no connection state to forge.

### Off-Path Attacks (Blind Spoofing)

An off-path attacker cannot observe the query or the legitimate response. They must guess the transaction ID and source port, then flood the resolver with forged responses before the legitimate one arrives.

The Kaminsky attack (2008) demonstrated a practical off-path attack. Pre-Kaminsky, guessing a 16-bit transaction ID against a known source port gave a 1-in-65,536 probability per attempt. Source port randomization (DNSSEC BCP, RFC 5452) expanded the entropy to ~32 bits across ID and port, requiring millions of attempts per second to be viable — but not impossible.

### Rogue DNS Server Deployment

Rather than attacking the wire protocol, attackers compromise or replace DNS infrastructure:

- **ISP-level redirection.** Some ISPs configure resolvers to return synthetic responses for NXDOMAIN or monetize traffic, which creates resolver-level spoofing as a business practice rather than an attack.
- **DHCP poisoning.** On local networks, an attacker responding to DHCP requests can supply a malicious DNS server address, diverting all DNS traffic from affected clients.
- **Router compromise.** Home and SMB routers with default credentials or unpatched firmware are frequently targeted to change their DNS resolver configuration. The attacker then controls all DNS for the local network without touching the client directly.
- **Registrar/DNS account compromise.** If an attacker gains access to a domain's registrar account or DNS hosting panel, they can alter NS records, pointing the domain's delegation to attacker-controlled nameservers. This is distinct from protocol-level spoofing but achieves the same result.

### BGP Hijacking of DNS Infrastructure

BGP prefix hijacking redirects routing for an IP prefix to an attacker-controlled AS. If a DNS provider's IP space is hijacked, queries to that provider's resolvers or authoritative servers are answered by the attacker.

Notable incidents:
- **2010 China Telecom.** BGP routes for roughly 15% of the internet were briefly hijacked, including routes for DNS infrastructure. While largely interpreted as accidental, the mechanism is applicable to intentional attacks.
- **2019 MyEtherwallet / Route Origin Hijack.** Attackers hijacked the BGP prefix of Amazon Route 53's anycast infrastructure (205.251.196.0/24), intercepting DNS queries for MyEtherwallet and redirecting users to a phishing server with a self-signed certificate. Approximately $150,000 in cryptocurrency was stolen before Amazon restored routing.

BGP hijacking is difficult to execute without AS-level access but is not limited to nation-state actors. RPKI (Resource Public Key Infrastructure) and ROA (Route Origin Authorizations) partially mitigate this by allowing prefix owners to cryptographically attest the legitimate originating AS.

---

## The Kaminsky Attack (2008)

Dan Kaminsky disclosed a critical DNS cache poisoning vulnerability in July 2008. Prior to coordinated vendor disclosure (unprecedented at the time), he worked with major DNS software vendors to patch simultaneously.

**How it works:**

1. The attacker sends a query to the target resolver for a name that does not exist under a victim domain (e.g., `random1234.example.com`).
2. The resolver, lacking a cached answer, queries the authoritative server for `example.com`.
3. Before the legitimate response arrives, the attacker floods the resolver with forged responses that:
   - Match the random subdomain query
   - Include a forged answer section
   - Include a forged authority section that poisons the NS records for `example.com` itself
4. Because each attempt uses a new random subdomain, the resolver must send a fresh query each time, giving the attacker repeated attempts.
5. If one forged response matches the transaction ID and source port before the legitimate response arrives, the attacker's NS records for `example.com` are cached.

The result: all queries for `example.com` from that resolver are directed to attacker-controlled nameservers, indefinitely (until the cached NS TTL expires).

**Why it was novel:** Previous cache poisoning attacks targeted individual records. The Kaminsky attack poisons the NS delegation itself, enabling mass redirection rather than targeting single hostnames. The repeated-attempt mechanism via random subdomains made it practical even against source port randomization at the time.

**Mitigations applied post-Kaminsky:**
- Source port randomization (expanded entropy from 16 to ~32 bits)
- 0x20 encoding (mixed-case query, resolver verifies matching case in response)
- DNSSEC (makes poisoned NS records verifiable as fraudulent)

---

## SAD DNS (2020)

SAD DNS (Side-channel AttackeD DNS) is an off-path cache poisoning attack that exploits ICMP rate limiting as a side channel to infer open UDP source ports used by resolvers.

**Mechanism:** Linux kernels rate-limit ICMP "port unreachable" messages to 1,000 per second globally. By sending UDP probes to the resolver's external IP across all 65,536 ports, an attacker observes which ports receive ICMP replies (closed) versus which do not (open — a resolver is listening there). This narrows the source port search space from 65,536 to a small set of candidates, dramatically reducing the brute-force cost.

Published by Keyu Man et al. (UC Riverside) in 2020, SAD DNS demonstrated practical off-path poisoning against standard Linux resolver deployments. Mitigations include disabling ICMP globally on resolver hosts, restricting inbound ICMP at the network level, and enabling DNSSEC validation.

---

## Mitigations

### DNSSEC Validation

A validating resolver rejects unsigned or incorrectly signed responses regardless of how they were injected. DNSSEC is the only mitigation that addresses the fundamental authentication gap in DNS. Its limitation is coverage: a poisoned response for an unsigned zone cannot be detected. You can verify whether a domain has DNSSEC enabled by [inspecting its DNS records](https://dnschkr.com/dns-inspector) and checking for DNSKEY and DS records.

### DNS over TLS (DoT) — RFC 7858

DNS queries and responses are carried over an authenticated TLS connection to the resolver. This prevents on-path injection between the client and its configured resolver. It does not protect the resolver-to-authoritative path unless the authoritative server also supports DoT and the resolver validates it.

### DNS over HTTPS (DoH) — RFC 8484

Functionally equivalent to DoT for confidentiality and integrity, but uses HTTPS (port 443). DoH traffic is indistinguishable from web traffic, complicating network-level DNS inspection.

### Source Port Randomization — RFC 5452

Using a random source port for each outgoing DNS query expands the transaction ID entropy from 16 bits to approximately 32 bits when combined with the transaction ID. Patches for this were deployed broadly after Kaminsky disclosure in 2008. This is a defense-in-depth measure, not a complete solution — SAD DNS circumvents it.

### 0x20 Encoding

Resolvers randomize the case of query names (e.g., `ExAmPlE.cOm`) and verify that responses preserve the same case pattern. DNS names are case-insensitive per RFC 1034, but the case encoding must be echoed by the authoritative server. Forged responses generated without observing the query cannot match the case encoding, failing validation. This is an optional heuristic, not standardized, and not universally deployed.

### RPKI and ROA

Route Origin Authorization records cryptographically bind IP prefixes to originating ASes, mitigating BGP hijacking of DNS infrastructure IP space. RPKI does not protect the DNS protocol itself but addresses the routing layer attack vector.

---

## Real-World Incidents

**2014 — .cu ccTLD Hijack.** Cuba's DNS delegation was briefly redirected via registrar-level compromise, affecting `.cu` domains globally.

**2019 — Sea Turtle.** A multi-year campaign attributed to a nation-state actor compromised registrars and registries to modify NS records for government and telco targets across the Middle East and North Africa. The attacker obtained valid TLS certificates during the window of DNS control. Cisco Talos published detailed analysis.

**2021 — Cloudflare Route Leak.** A Verizon BGP route leak (not intentional attack) caused widespread resolution failures for Cloudflare-served domains, demonstrating how routing infrastructure failures and BGP manipulation affect DNS reliability.

**2023 — Pakistan Telecom BGP Incident.** Accidental BGP announcement caused brief hijacking of IP space including DNS resolver addresses, affecting regional resolution.

---

## References

- RFC 5452 — Measures for Making DNS More Resilient Against Forged Answers
- RFC 7858 — Specification for DNS over Transport Layer Security (TLS)
- RFC 8484 — DNS Queries over HTTPS (DoH)
- Kaminsky, D. (2008). Black Ops 2008: It's the End of the Cache as We Know It. DEF CON 16.
- Man, K. et al. (2020). SAD DNS Explained. USENIX Security 2021.
- For a comprehensive overview of DNS attack vectors including spoofing, hijacking, and cache poisoning, see the [DNS attacks guide](https://dnschkr.com/blog/dns-attacks-guide).
- Current DNS security findings across the internet: [DNS security dashboard](https://dnschkr.com/security)
- Cisco Talos — Sea Turtle Campaign: https://blog.talosintelligence.com/sea-turtle/
- RPKI Overview: https://rpki.cloudflare.com/
- RIPE NCC RPKI Dashboard: https://rpki-monitor.antd.nist.gov/
