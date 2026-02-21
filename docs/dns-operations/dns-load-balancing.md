# DNS Load Balancing

DNS load balancing distributes client connections across multiple servers by returning different IP addresses in response to the same DNS query. It leverages the [DNS resolution process](https://dnschkr.com/blog/how-dns-queries-work) to direct clients to different endpoints based on rotation, geography, or health status.

DNS load balancing is widely used because it requires no network-layer infrastructure and works across any IP-based service. Its limitations — rooted in DNS caching behavior and lack of connection-level awareness — mean it complements rather than replaces dedicated load balancing hardware or software.

---

## Round-Robin DNS

Round-robin (RR) is the simplest DNS load balancing technique. Multiple A (or AAAA) records are published for a hostname, each pointing to a different server. Authoritative nameservers return these records in rotating order on successive queries.

```zone
www.example.com.  300  IN  A  203.0.113.10
www.example.com.  300  IN  A  203.0.113.11
www.example.com.  300  IN  A  203.0.113.12
```

A resolver querying for `www.example.com` receives all three records in a single response. The resolver may cache and return these in rotation, or always in the same order depending on implementation.

### Client Behavior

The client selects an IP from the returned list. RFC 3484 and its successor RFC 6724 (Source Address Selection) define how clients order destination addresses. In practice:
- Many clients try the first returned IP
- Some clients (browsers, cURL) try multiple IPs in parallel (Happy Eyeballs, RFC 6555, RFC 8305)
- Operating system TCP stacks typically try addresses in order, falling back on connection failure

**The resolver is not in control of which IP the client uses.** The nameserver controls the order in which records are returned; the resolver may reorder them; the client makes the final selection. This makes traffic distribution across round-robin entries approximate rather than precise.

### Limitations of Round-Robin

**No health awareness.** A failed server remains in the rotation until manually removed. Clients directed to the failed server experience connection timeouts.

**Caching breaks rotation.** Once a resolver caches the RRset, all clients using that resolver receive the same set of records in the same order for the duration of the [TTL](https://dnschkr.com/blog/what-is-dns-ttl). Load is not balanced across resolvers — it accumulates at the resolver population that last cached each permutation.

**Persistent connections.** A client that establishes a connection to one IP does not benefit from subsequent DNS round-robin iterations. The connection stays on the originally selected server.

**No weight control.** All records are treated equally. You cannot direct 80% of traffic to three new servers and 20% to one legacy server using standard DNS.

---

## Weighted DNS

Some DNS providers allow assigning weights to DNS records, returning higher-weighted records more frequently. This is not standardized in the DNS protocol — it is implemented at the authoritative server level.

AWS Route 53 weighted routing policy:
- Record A (203.0.113.10): weight 80
- Record B (203.0.113.11): weight 20

Route 53 returns record A for approximately 80% of queries and record B for 20%. This enables traffic splitting for A/B testing, canary deployments, or gradual traffic migration.

The same caching caveats apply: once a resolver caches a record, all clients of that resolver see the same result for the TTL duration.

---

## Geographic DNS (GeoDNS)

GeoDNS returns different DNS answers based on the geographic location of the querying resolver. The authoritative server determines the resolver's approximate location using the source IP of the DNS query or the EDNS Client Subnet extension (RFC 7871).

```
Query from European resolver  -->  Return 198.51.100.10 (EU servers)
Query from Asian resolver     -->  Return 203.0.113.20 (APAC servers)
Query from US resolver        -->  Return 192.0.2.30 (US servers)
```

### EDNS Client Subnet (ECS)

RFC 7871 defines the EDNS Client Subnet option, which allows a resolver to include a truncated version of the client's IP (typically /24 for IPv4) in the DNS query sent to authoritative servers. This allows the authoritative server to return geo-targeted responses appropriate for the client's region rather than the resolver's location.

Without ECS, a resolver in Virginia (used by clients across the US East Coast) sends queries with its own IP. The authoritative server targets responses to the resolver's Virginia location, even if the client is in California. ECS corrects this by including the client's approximate IP.

ECS is implemented by Google Public DNS, Cloudflare, and most major public resolvers. Some resolvers disable ECS for privacy reasons (it leaks client subnet information to authoritative servers).

### GeoDNS Data Sources

Authoritative DNS providers implement GeoDNS using:
- MaxMind GeoLite2 or GeoIP2 databases
- RIPE NCC, ARIN, APNIC IP allocation data
- Custom IP-to-region mapping tables

Accuracy varies. IP geolocation is approximate — mobile users, VPN users, and CDN-proxied clients may resolve to unexpected regions.

### Use Cases

- Directing users to the nearest CDN origin
- Serving regional content (language, regulatory compliance)
- Failover by region (if EU servers fail, fall back to US)
- Latency optimization for latency-sensitive applications

---

## Health Checks and DNS Failover

DNS health checking systems monitor backend servers and automatically update DNS records when failures are detected. This transforms DNS from a static routing mechanism to a dynamic one.

### How It Works

1. A health checker continuously tests backends (HTTP GET, TCP connect, ICMP ping)
2. When a backend fails health checks, the DNS record pointing to it is removed or replaced
3. Resolvers whose cached records expire after the change receive the updated record
4. Clients are directed to healthy backends on subsequent DNS lookups

### TTL and Failover Time

Failover time = health check interval + DNS update latency + remaining cache TTL

With a 10-second health check, 5-second automation pipeline, and 60-second TTL:
- Failure detected: T+10s
- DNS updated: T+15s
- Resolvers pick up change: T+15s to T+75s (depending on cache age)

Active connections established before the failover are not redirected. DNS failover only affects new connection establishment.

### Providers

- **AWS Route 53** — Native health checks with automatic failover, integrated with CloudWatch
- **Cloudflare DNS** — Health checks via Load Balancing product (paid)
- **Dyn (Oracle)** — Legacy provider with comprehensive health-check-driven DNS
- **NS1** — Programmatic DNS with filter chain for health-aware routing

For a comprehensive list of DNS providers and their market share, see the [DNS provider directory](https://dnschkr.com/providers).

---

## Comparison with L4 and L7 Load Balancers

| Dimension | DNS Load Balancing | L4 Load Balancer | L7 Load Balancer |
|-----------|-------------------|-----------------|-----------------|
| Layer | Application (DNS) | Transport (TCP/UDP) | Application (HTTP) |
| Connection awareness | No | Yes | Yes |
| Session persistence | No (client-controlled) | Yes (IP hash, sticky) | Yes (cookie, header) |
| Health check granularity | IP-level | Port-level | URL/HTTP-level |
| Failover speed | TTL-bounded (~60s min) | Sub-second | Sub-second |
| Traffic weight precision | Approximate | Exact | Exact |
| Protocol agnostic | Yes | Yes | No (HTTP-specific) |
| Client location routing | Yes (GeoDNS) | No | No (without GSLB) |
| Infrastructure cost | Low (DNS only) | Medium (hardware/VM) | Higher (proxy compute) |

DNS load balancing is best suited for:
- Global server load balancing (GSLB) across geographic regions
- Initial traffic distribution when per-connection precision is not required
- Failover between geographically separated sites
- Traffic splitting for canary deployments

L4/L7 load balancers are required when:
- Session persistence is needed
- Health checks must be path-specific (HTTP 200 at `/healthz`)
- Sub-second failover is required
- Connection-level traffic visibility or manipulation is needed

### The Common Architecture

Production systems typically combine both:
1. GeoDNS routes users to the nearest regional cluster
2. An L4 or L7 load balancer within each region distributes connections across individual servers

DNS handles macro-routing (continent or data center); L7 handles micro-routing (individual server selection, health checks, session affinity).

---

## SRV Records for Service Discovery

SRV records (RFC 2782) provide built-in weighted load balancing and failover for services that support them. SRV records specify target hostnames (not IPs), port numbers, priority, and weight.

```zone
_http._tcp.example.com.  300  IN  SRV  10 50 80 server1.example.com.
_http._tcp.example.com.  300  IN  SRV  10 50 80 server2.example.com.
_http._tcp.example.com.  300  IN  SRV  20 0  80 backup.example.com.
```

- **Priority (10, 20):** Lower priority is preferred. Clients try all priority-10 records before using priority-20 (backup).
- **Weight (50, 50):** Within the same priority, weight distributes load. Equal weights distribute 50/50.

Protocols that support SRV: XMPP, SIP, LDAP, Kerberos, some email systems. HTTP does not natively support SRV for standard browser clients.

---

## Limitations Summary

**DNS load balancing does not see individual connections.** It cannot balance based on server CPU load, active connection count, response time, or request characteristics. It distributes at the query level, not the connection level.

**Caching undermines balance precision.** The real unit of DNS load balancing is resolver populations, not individual clients. A resolver serving 100,000 clients sending all traffic to one RR entry defeats the purpose.

**Clients may not honor DNS.** Applications that cache DNS results internally, maintain connection pools, or use CNAME flattening may not react to DNS changes as expected. Connection pools in particular can keep traffic on servers long after DNS has been updated.

**Negative TTL traps.** If a health check removes a record and adds it back quickly, resolvers that cached an NXDOMAIN for the domain during the outage continue returning NXDOMAIN until their negative cache expires.

---

## References

- RFC 1794 — DNS Support for Load Balancing (historical, describes round-robin)
- RFC 2782 — A DNS RR for Specifying the Location of Services (SRV)
- RFC 6724 — Default Address Selection for Internet Protocol Version 6 (IPv6)
- RFC 6555 — Happy Eyeballs: Success with Dual-Stack Hosts
- RFC 7871 — Client Subnet in DNS Queries (EDNS Client Subnet)
- RFC 8305 — Happy Eyeballs Version 2: Better Connectivity Using Concurrency
- AWS Route 53 Routing Policies: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html
- NS1 Intelligent DNS: https://ns1.com/
- Cloudflare Load Balancing: https://developers.cloudflare.com/load-balancing/
- MaxMind GeoIP2: https://dev.maxmind.com/geoip/
