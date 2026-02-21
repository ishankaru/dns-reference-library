# DNS TTL Strategy

TTL (Time to Live) is the number of seconds a DNS resolver is permitted to cache a response before it must re-query the authoritative server. TTL governs the fundamental tradeoff in DNS: caching improves performance and reduces authoritative server load, but it delays the propagation of changes.

Setting TTLs correctly requires understanding your operational context: record stability, change frequency, migration requirements, and resolver cache behavior. For a foundational overview of what TTL is and how it affects DNS resolution, see [DNS TTL explained](https://dnschkr.com/blog/what-is-dns-ttl).

---

## How TTL Works

When a resolver receives a DNS response, it caches the records along with their TTL values. The TTL decrements in real time. When the TTL reaches zero, the resolver discards the cached record and must re-query the authoritative server on the next request.

A TTL of 3600 means a resolver may cache the record for up to one hour. A resolver that queried 30 minutes ago has a remaining TTL of 1800 seconds. If a client queries that resolver 10 minutes before expiry, they receive the cached record and see a TTL of approximately 600.

**Important:** The TTL a client receives reflects the remaining cache lifetime at the resolver, not the original TTL set at the authoritative server.

---

## The Core Tradeoff

### High TTL (hours to days)

Benefits:
- Reduced query volume to authoritative servers
- Fewer external dependencies at runtime (cached records survive authoritative server downtime)
- Better performance for end users (faster cache hits, no round-trip to authoritative)
- Reduced cost on DNS providers that charge per query

Drawbacks:
- Changes propagate slowly — records remain stale in caches for the full TTL duration
- DNS-based failover is ineffective if the TTL is longer than the acceptable failover window
- Rollback after an error is delayed

### Low TTL (seconds to minutes)

Benefits:
- Changes take effect quickly
- DNS-based failover approaches real-time behavior (at 60-second TTLs)
- Errors can be corrected rapidly

Drawbacks:
- Increased authoritative server query load (potentially 60–120x more queries vs. one-hour TTL)
- Higher latency for uncached lookups (cache misses are more frequent)
- Greater dependence on authoritative server availability
- Higher DNS hosting costs on query-priced providers
- Resolvers that do not respect low TTLs may ignore them (some ISP resolvers floor TTLs at 300 seconds)

---

## Recommended TTLs by Record Type

These are operational defaults based on record stability and typical change patterns. Adjust based on your operational requirements.

| Record Type | Recommended TTL | Rationale |
|-------------|-----------------|-----------|
| A / AAAA (stable) | 3600–86400 | Infrastructure changes infrequently; high TTL improves performance |
| A / AAAA (active failover) | 60–300 | Failover must propagate within the health-check interval |
| CNAME | 3600 | Typically stable; lowering adds load without benefit |
| MX | 3600–14400 | Mail delivery queues handle delivery failures for hours; low MX TTL rarely helps |
| NS | 86400 | Changes require coordination with registrar/registry; should be rare |
| SOA | 3600 | Rarely queried directly by clients; high TTL is fine |
| TXT (SPF, DKIM, DMARC) | 3600–86400 | Authentication records are stable; low TTL causes unnecessary re-queries |
| TXT (DKIM during rotation) | 300–3600 | Lower during rotation window to ensure new key propagates quickly |
| CAA | 86400 | Certificate policies change rarely |
| SRV | 300–3600 | Depends on service topology stability |
| PTR | 86400 | Reverse DNS rarely changes |
| DS | 86400 | DNSSEC delegation; changes require parent zone coordination |

**Floor consideration:** Many public resolvers (Cloudflare 1.1.1.1, Google 8.8.8.8) honor sub-second TTLs, but ISP resolvers frequently floor TTLs at 300 seconds. Practical minimum effective TTL is approximately 300 seconds on the public internet.

---

## Pre-Migration TTL Lowering

Reducing TTL before a planned change is one of the most operationally important DNS practices. If records currently have a TTL of 86400 (24 hours) and you change an A record, it may take up to 24 hours for all resolvers to pick up the change. By reducing the TTL in advance, you shrink the propagation window to minutes.

### Procedure

1. **T minus 48 hours (or 2x the current TTL):** Lower the TTL to 300 seconds (5 minutes). This change itself takes up to the current TTL to propagate, so the lower value needs to be in place well before the change.
2. **Wait for the TTL reduction to propagate.** Verify with `dig +short example.com A` from multiple locations — the TTL in the response should be approaching 300. You can also [inspect DNS records](https://dnschkr.com/dns-inspector) online to check the current TTL from various nameservers.
3. **T minus 0:** Make the DNS change (update the A record, swap NS, etc.). The change propagates within 300 seconds (5 minutes) to resolvers that have expired their cache.
4. **Verify propagation** using a [DNS propagation checker](https://dnschkr.com/propagation-checker) that queries resolvers across multiple continents.
5. **After change is confirmed stable:** Raise TTL back to the operational default.

### Why the 2x buffer

If your current TTL is 86400, a resolver that just cached the record at T-86400 will not re-query for 24 hours. You need the TTL reduction to be in place before that cache entry is refreshed. Setting the reduced TTL at T-48h ensures all cached copies expire and re-query with the shorter TTL before the actual change at T=0.

**Example timeline:**
```
Day 1 09:00 — Lower TTL from 86400 to 300
Day 2 09:00 — All caches have expired (max 24h); resolvers now caching with TTL=300
Day 2 09:30 — Make the actual DNS change
Day 2 09:35 — Change visible to all resolvers (300s propagation window)
Day 2 10:00 — Raise TTL back to 86400
```

---

## Negative Caching TTL (RFC 2308)

Negative caching is the caching of NXDOMAIN (name does not exist) and NOERROR/NODATA (name exists but no record of requested type) responses. The TTL for negative responses is controlled by the SOA record's minimum field (the last value in the SOA RDATA).

RFC 2308 revised the interpretation of the SOA minimum field. Prior to RFC 2308, it was the minimum TTL for all records in the zone. After RFC 2308, it is used as the negative cache TTL.

**Effective negative TTL:** `min(SOA minimum field, SOA TTL)`

Resolvers cache NXDOMAIN for the negative TTL duration. During this time, queries for a name that does not exist return NXDOMAIN from cache without querying authoritative servers.

### Recommended NCTTL Values

- **Standard zones:** 300–900 seconds. A 5-minute negative cache TTL means that adding a new record becomes visible within 5 minutes to clients that previously received NXDOMAIN.
- **High-change zones:** 60–300 seconds.
- **Stable zones with low query volume:** Up to 3600 seconds.

Overly long negative TTLs cause problems when new records are added. If a resolver cached NXDOMAIN for a new domain for 86400 seconds, a newly created A record will not be seen by clients of that resolver for up to 24 hours.

### SOA Negative TTL Configuration

```zone
example.com.  IN  SOA  ns1.example.com. hostmaster.example.com. (
    2024020101  ; serial
    7200        ; refresh
    3600        ; retry
    604800      ; expire
    300         ; negative cache TTL  <-- this field
)
```

---

## TTL and DNS-Based Failover

DNS-based failover — where a health-checking system swaps DNS records when a service becomes unavailable — requires low TTLs to be effective. The failover window is approximately one TTL duration after the health check detects failure.

**Realistic failover timeline:**
1. Health check detects failure (health check interval, e.g., 10 seconds)
2. DNS record is updated (automation latency, e.g., 5 seconds)
3. Resolvers expire their cached record and pick up the new value (TTL duration, e.g., 60 seconds)
4. Clients retry (retry logic dependent)

Total failover window at TTL=60: approximately 75–90 seconds after failure detection. At TTL=300, approximately 310–320 seconds.

**DNS failover is not a substitute for application-layer load balancing.** Clients that established TCP connections before a failover are not redirected. Connection-level failover (L4 load balancers) or health-aware proxies (Nginx, HAProxy) provide more reliable failover than DNS alone.

---

## Resolver TTL Behavior in Practice

Not all resolvers honor published TTLs exactly:

- **Minimum TTL clamping:** Many ISP resolvers floor TTLs at 300 seconds, ignoring smaller values. Some floor at 60 seconds.
- **Maximum TTL clamping:** Some resolvers cap TTLs at 86400 (24 hours) or lower, ignoring larger published values.
- **Expired record serving:** Under heavy load or during resolver failures, some resolvers continue serving expired records (stale-while-revalidate behavior). RFC 8767 standardizes this for resilience.
- **Negative TTL clamping:** Resolvers may floor negative TTLs, causing NXDOMAIN to be cached longer than the SOA specifies.

Operational planning should account for these behaviors. Do not assume sub-60-second TTLs propagate instantly in practice.

---

## References

- RFC 1034 — Domain Names — Concepts and Facilities (TTL definition)
- RFC 1035 — Domain Names — Implementation and Specification
- RFC 2308 — Negative Caching of DNS Queries (DNS NCACHE)
- RFC 8767 — Serving Stale Data to Improve DNS Resiliency
- RFC 8906 — A Common Operational Problem in DNS Servers — Failure to Communicate
- Verisign — DNS Best Practices: https://www.verisign.com/en_US/domain-names/dns/
- Cloudflare — Understanding DNS TTLs: https://developers.cloudflare.com/dns/manage-dns-records/reference/ttl/
- APNIC — TTL recommendations: https://blog.apnic.net/2019/11/12/stop-using-ridiculously-low-dns-ttls/
