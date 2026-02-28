# DNS Propagation Issues

## Why DNS Changes Appear Slow

"Propagation" is an informal term for the delay between making a DNS change and that change being visible to all resolvers on the internet. The DNS system does not push changes — resolvers cache records and serve them until the TTL (Time to Live) expires. Until a resolver's cache expires, it serves the old record regardless of what the authoritative server now says. For an in-depth look at what is actually happening under the hood, see [what is DNS propagation](https://dnschkr.com/blog/what-is-dns-propagation).

There is no single propagation event. Different resolvers see the change at different times depending on when they last cached the record and what their local cache state is. To get visibility into DNS health for a specific domain, use a tool that digs [into DNS records across record types](https://dnschkr.com/dns-inspector) — checking A, AAAA, MX, NS, TXT, and SOA simultaneously.

## The Caching Hierarchy

DNS lookups involve multiple layers, each of which may cache independently:

```
Application (browser, OS)
    |
    v
OS stub resolver (local cache)
    |
    v
Recursive resolver (ISP, Google 8.8.8.8, Cloudflare 1.1.1.1)
    |
    v
Authoritative nameserver (source of truth)
```

When a DNS change is made at the authoritative server, the change is immediately visible to anyone querying the authoritative server directly. But all resolvers above it in the chain serve cached responses until their TTLs expire.

### TTL

The TTL value on a DNS record is the maximum number of seconds resolvers should cache that record. It is set by the zone operator in the authoritative zone file.

- A record with `TTL 3600` can be cached for up to 1 hour.
- A record with `TTL 86400` can be cached for up to 24 hours.
- A record with `TTL 300` should become visible within 5 minutes after it expires.

**The TTL on the old record determines the delay** — not the TTL on the new record. After the cache expires, resolvers re-query and receive the new record with the new TTL.

### Practical Propagation Windows

| Scenario | Expected delay |
|---|---|
| Low TTL (300s / 5 min) | 5–15 minutes for most resolvers |
| Standard TTL (3600s / 1 hr) | 1–2 hours for most resolvers |
| High TTL (86400s / 24 hr) | Up to 48+ hours for some resolvers |
| SOA negative TTL (`MINIMUM`) | Up to 1 hour for NXDOMAIN caching |

These are typical values. Some resolvers (particularly poorly configured ISP resolvers) may exceed the stated TTL or have their own maximum cache times.

## Negative Caching

When a resolver queries for a record that does not exist, it caches the negative result (NXDOMAIN or NOERROR with empty answer) for the duration of the SOA record's `MINIMUM` field. This is specified in RFC 2308.

The SOA MINIMUM value controls how long negative answers are cached:

```
example.com.  3600  IN  SOA  ns1.example.com. admin.example.com. (
    2024010101  ; serial
    3600        ; refresh
    900         ; retry
    604800      ; expire
    300         ; minimum (negative TTL)
)
```

In this example, NXDOMAIN responses for names under `example.com` are cached for 300 seconds.

Consequence: if a resolver has cached a NXDOMAIN for a name, adding a record for that name to the zone will not be visible to that resolver until the negative cache entry expires.

## Registrar vs DNS Provider: A Common Source of Confusion

DNS changes require updating the correct layer:

### Nameserver Delegation (at the Registrar)

This controls which DNS servers are authoritative for the domain. Changing nameservers is an EPP operation: the registrar submits a new NS record set to the registry, which updates the TLD zone file.

The TLD zone's NS records for the domain have their own TTL — typically 172800 seconds (48 hours) for `.com`. Changing nameservers can take up to 48 hours to be fully reflected.

### DNS Records (at the DNS Provider / Authoritative Server)

This controls individual A, AAAA, MX, TXT, and other records. Changing a record at the authoritative server takes effect according to the record's TTL.

**Common mistake:** Making record changes at the old DNS provider after the nameservers have already been changed to a new provider. The new authoritative server is being queried, but the change was made at the old server.

**Verification step:** Always confirm which nameservers are currently authoritative before editing records. The [DNS inspector tool](https://dnschkr.com/dns-inspector) shows the current authoritative nameservers and all record types for any domain.

```bash
# Check current authoritative nameservers (bypass cache)
dig NS example.com @a.root-servers.net +norecurse
dig NS example.com @a.gtld-servers.net +norecurse

# Query the authoritative server directly
dig A example.com @ns1.example.com
```

## Pre-Change TTL Reduction

Best practice before making any DNS change that will cause downtime or cutover:

1. Reduce the TTL of the affected record to 300 seconds (5 minutes).
2. Wait for the original TTL to expire (so all resolvers refresh and cache the low TTL).
3. Make the DNS change.
4. Verify the change is visible.
5. After the cutover is stable, restore the TTL to its original value.

This minimizes the window in which stale cached records cause problems.

## How to Check Propagation

### Query Authoritative Servers Directly

Bypass resolver caches entirely by querying the authoritative nameservers:

```bash
# Find authoritative nameservers
dig NS example.com +short

# Query authoritative server directly (no cache)
dig A example.com @ns1.example.com +norecurse
```

### Query Multiple Geographic Resolvers

Different regions may have different cache states. Use multiple public resolvers to get a global view:

```bash
dig A example.com @8.8.8.8          # Google (US-heavy)
dig A example.com @1.1.1.1          # Cloudflare
dig A example.com @9.9.9.9          # Quad9
dig A example.com @208.67.222.222   # OpenDNS
```

### Use Web-Based Propagation Checkers

Tools that query resolvers in multiple geographic locations simultaneously:
- [dnschkr DNS propagation checker](https://dnschkr.com/dns-propagation-checker) — queries resolvers worldwide in real time
- https://dnschecker.org/
- https://www.whatsmydns.net/

### Check Cache TTL Remaining

The `ANSWER SECTION` TTL in `dig` output shows the remaining cached TTL at the queried resolver, not the original TTL:

```bash
dig A example.com @8.8.8.8
# Answer section shows remaining TTL:
# example.com.   247   IN   A   93.184.216.34
# 247 seconds remain in Google's cache for this record
```

## Forcing Cache Expiry

You cannot force third-party resolvers to flush their caches for a specific domain. You can:

- Lower the TTL before making changes (proactive).
- Wait for the TTL to expire naturally (reactive).
- Request a cache flush from specific resolver operators (only practical for large operators; Cloudflare's cache purge API supports this for Cloudflare resolvers).

For local debugging, flush the local OS cache and browser cache (see the cache-clearing reference guide).

## References

- RFC 1034 — DNS Concepts and Facilities (TTL behavior): https://www.rfc-editor.org/rfc/rfc1034
- RFC 2308 — Negative Caching of DNS Queries: https://www.rfc-editor.org/rfc/rfc2308
- RFC 5731 — EPP Domain Name Mapping (nameserver changes): https://www.rfc-editor.org/rfc/rfc5731
- ICANN TTL Guidance: https://www.icann.org/resources/pages/ttl-best-practices-2017-11-15-en
