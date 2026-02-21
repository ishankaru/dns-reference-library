# Anycast DNS

Anycast is a network addressing and routing method in which a single IP address is assigned to multiple servers in different geographic locations. The BGP routing protocol directs each incoming DNS query to the topologically nearest server that announces the anycast prefix, typically resulting in the geographically closest or lowest-latency instance handling the request.

Anycast is the foundational technology enabling global DNS infrastructure at scale. All 13 DNS root server letter identifiers operate via anycast, collectively served by over 1,500 physical instances worldwide. Public resolvers (Cloudflare 1.1.1.1, Google 8.8.8.8), large authoritative [DNS hosting providers](https://dnschkr.com/providers) (Cloudflare DNS, AWS Route 53, Akamai), and major CDN nameservers all use anycast.

---

## How Anycast Works

### Unicast vs. Anycast

In standard unicast networking, each IP address identifies exactly one endpoint. Routing tables point to a single destination for a given IP.

In anycast, the same IP prefix (e.g., `192.0.2.0/24`) is announced via BGP from multiple autonomous systems or from the same AS at multiple physical locations. The internet's routing protocol selects the "best" path according to BGP path selection rules, which consider AS path length, local preference, and other attributes. The result is that different clients across the internet reach different physical servers, all sharing the same IP address.

### BGP Prefix Announcement

Each anycast node announces the same IP prefix to its upstream BGP peers. When a client's packet is sent to the anycast IP, routers forward it toward the nearest announcement — the one with the shortest BGP path or lowest routing cost.

```
Client in Tokyo  -->  BGP selects Tokyo PoP  -->  Anycast node at Tokyo datacenter
Client in London -->  BGP selects London PoP -->  Anycast node at London datacenter
Client in NYC    -->  BGP selects NYC PoP    -->  Anycast node at NYC datacenter
```

All three clients send packets to the same IP address. The internet's routing infrastructure handles directing each packet to the appropriate physical server.

### DNS and Statelessness

DNS over UDP is inherently stateless and connectionless. Each query-response pair is a single UDP exchange with no session state. This makes DNS ideal for anycast: routing may change between two queries from the same client, but because each exchange is independent, this causes no protocol issues.

DNS over TCP (used for large responses, zone transfers, DoT) is more sensitive to routing changes. If a TCP connection is mid-stream and the route changes, the connection is broken. Anycast deployments handle this by ensuring routing is stable during a connection's lifetime — BGP path changes are infrequent relative to TCP connection duration.

---

## Benefits

### Latency Reduction

By routing each query to the nearest anycast node, round-trip time is minimized. A resolver in a major metro area responds to queries from nearby clients in single-digit milliseconds. Without anycast, a single-location DNS server might add 150–300ms for geographically distant clients.

For high-volume services like public resolvers, this latency reduction is a primary operational requirement. Cloudflare measured that globally distributed anycast reduced median DNS resolution latency from ~50ms (with distant unicast servers) to ~4ms for their 1.1.1.1 resolver.

### DDoS Resilience

Anycast provides inherent DDoS absorption capacity. A volumetric attack directed at an anycast IP is automatically distributed across all anycast nodes proportional to the routing topology. An attack generating 1 Tbps directed at an anycast IP with 200 nodes averages 5 Gbps per node — manageable for a well-provisioned infrastructure, where 1 Tbps concentrated at a single unicast IP would be catastrophic.

This property is why anycast is essential for DNS infrastructure. DNS DDoS attacks are common (amplification attacks use open resolvers; authoritative DNS is targeted for application-layer outages). Distributing traffic across globally dispersed nodes prevents any single location from being overwhelmed.

The 2016 Dyn attack (October 21, 2016) demonstrated the limits: a Mirai botnet generated approximately 1.2 Tbps targeting Dyn's anycast infrastructure, causing service degradation across Dyn's network. The attack revealed that even anycast is not infinitely resilient — sufficient aggregate volume can overwhelm the global infrastructure.

### No Single Point of Failure

Loss of an anycast node causes BGP to withdraw the announcement for that location. Traffic is rerouted to the next-best node automatically. This failover is handled by the BGP routing layer without any application-level detection or intervention.

Recovery time depends on BGP convergence, typically 1–5 minutes in well-configured networks. This is not instantaneous, but is substantially faster than manual failover to a backup IP.

### Proximity for Regulatory Requirements

Different anycast nodes can implement location-specific policies while sharing a common IP. A query routed to a European node can apply GDPR-compliant data handling; a US node applies different rules. The client IP seen by the node corresponds to the querying client's region, enabling geographic policy enforcement.

---

## BGP Anycast Architecture

### Autonomous Systems and Announcements

For anycast to work, the operator must control the IP space and announce it from multiple ASes, or announce the same prefix from one AS with multiple BGP peers at different locations.

Large operators (Cloudflare AS13335, Google AS15169) have their own ASes and peer with other networks at internet exchange points (IXPs) globally. Smaller operators may use a transit provider that supports anycast announcement on their behalf.

### Hot-Potato vs. Cold-Potato Routing

- **Hot-potato (early exit):** The upstream network hands off the packet as soon as it reaches an anycast announcement, even if a "closer" node in the IP owner's network is not far. ISPs prefer this because it minimizes their carrying cost.
- **Cold-potato (late exit):** The IP owner carries traffic on its own network to the optimal egress point before handing off. Requires the operator to have a well-connected private backbone.

Public resolvers using hot-potato routing may not always send clients to the geographically closest node — routing depends on the ISP's peering agreements and preference settings.

### Route Leaks and Anycast

BGP route leaks can cause traffic to be misdirected to an unintended anycast node. If a non-anycast participant erroneously announces an anycast prefix, traffic destined for the anycast service is attracted to that announcement. This is equivalent to BGP hijacking in effect.

RPKI ROAs (Route Origin Authorizations) mitigate this by allowing anycast prefix owners to publish the authorized originating ASes, enabling receivers to reject invalid announcements.

---

## Challenges and Limitations

### Debugging

Anycast makes network debugging non-trivial. Two clients on the same LAN querying the same anycast IP may hit different physical servers. A traceroute from a debugging workstation may reach a different node than the production client being investigated.

Operators must instrument each anycast node independently and aggregate logs, metrics, and traces across all nodes. A DNS query's latency, error rate, or rate-limiting behavior depends on which node handled it — invisible from the client's perspective.

Some operators inject node-specific identifiers in responses (e.g., Cloudflare's ID.SERVER CHAOS TXT query returns which data center handled the request). For a practical guide to querying DNS servers and interpreting responses, see the [dig command guide](https://dnschkr.com/blog/dig-command-guide):
```bash
dig +short ch txt id.server @1.1.1.1
# Returns: "MIA" (Miami data center)
```

### Health Checking and Failover

BGP withdrawal (removing an anycast announcement) is the failover mechanism. This requires the anycast node to detect its own failure and withdraw its BGP announcement, or for a monitoring system external to the node to trigger the withdrawal.

Failure scenarios:
- **Node hardware failure:** BGP session drops; announcement is withdrawn automatically.
- **Application failure (DNS daemon crash):** BGP session may remain up while the DNS service is unavailable. Health-check daemons (e.g., ExaBGP with custom health scripts) monitor the application and withdraw the BGP announcement if the DNS daemon is unresponsive.
- **Partial degradation:** A node that is overloaded or returning incorrect responses may continue announcing. Application-aware health checking is required to detect these cases.

### Asymmetric Routing

Anycast can produce asymmetric routes where the request path and the response path traverse different networks. In UDP DNS, this is acceptable — responses are independently routed back to the client's IP. TCP connections require the return path to reach the same anycast node, which is generally true within a single BGP session but may fail in complex routing environments.

### Not Suitable for All Services

Anycast is appropriate for stateless or short-connection protocols. It is less suitable for:
- Long-lived stateful connections (database connections, persistent WebSocket sessions)
- Services requiring client affinity (session state, TLS session resumption across nodes without shared state)

For DNS specifically, UDP's statelessness makes anycast ideal.

---

## Root Servers and Anycast

The 13 DNS root server letter identifiers (A through M) are each operated by a different organization. As of 2026, the root server system comprises over 1,500 physical instances distributed globally via anycast.

- A-root: Verisign — 8 instances
- F-root: ISC — 250+ instances
- K-root: RIPE NCC — 90+ instances

For a deeper explanation of the root server system and how queries traverse the DNS hierarchy, see [DNS root servers explained](https://dnschkr.com/blog/dns-root-servers-explained).

This anycast distribution means the root server "system" can absorb attacks that would overwhelm any non-anycast infrastructure. The 2002 attack on root servers (before widespread anycast deployment) took 9 of 13 servers offline for a period. Modern root server infrastructure, with anycast distribution, successfully absorbed the November 2015 and November 2016 DDoS attacks without measurable client impact.

---

## References

- RFC 4786 — Operation of Anycast Services
- RFC 7094 — Architectural Considerations of IP Anycast
- RFC 1546 — Host Anycasting Service (historical)
- Cloudflare — How Anycast Works: https://www.cloudflare.com/learning/cdn/glossary/anycast-network/
- ISC F-root anycast: https://www.isc.org/f-root/
- RIPE NCC K-root: https://www.ripe.net/analyse/dns/k-root
- Root Server Technical Operations Association (RSSAC): https://www.icann.org/groups/rssac
- Verisign 2016 Dyn attack analysis: https://blog.verisign.com/domain-names/verisign-dns-answers-rise-internet-upheaval/
