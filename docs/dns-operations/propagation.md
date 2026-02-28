# DNS Propagation

"DNS propagation" is a widely used but technically imprecise term. It implies that DNS changes travel outward across the internet like a wave — that servers are actively notified and updated. This is not how DNS works.

What is commonly called propagation is actually **cache expiry**. DNS records are cached by recursive resolvers for the duration of their TTL. When a record is changed at the authoritative server, the change does not automatically reach resolvers. Each resolver continues serving its cached copy until the TTL expires, at which point it re-queries the authoritative server and receives the updated record.

Understanding this distinction matters operationally: you cannot force DNS changes to appear everywhere instantly (short of reducing TTL well in advance), and you cannot know exactly when a specific resolver will pick up a change without querying it directly. The best approach is to look [into DNS records directly at the authoritative server](https://dnschkr.com/dns-inspector) to confirm your change is live, then wait for caches to expire.

---

## What Actually Happens When You Change a DNS Record

### Step 1: Update at the Authoritative Server

When you modify a DNS record (via a registrar control panel, DNS hosting provider API, or direct zone file edit), the change is written to the authoritative nameserver(s) for the zone. From that moment, any resolver querying the authoritative server receives the new record.

### Step 2: Existing Caches Are Unaffected

Resolvers that have already cached the record will not query the authoritative server again until the cached TTL expires. During this window, those resolvers serve the old record to their clients.

**No mechanism exists to invalidate resolver caches externally.** DNS does not have a "push" notification system for cached record expiry. Operators can request cache clearing from specific public resolvers (Google, Cloudflare offer this as a diagnostic tool), but cannot flush arbitrary resolver caches across the internet.

### Step 3: Gradual Re-Query as TTLs Expire

As each resolver's cached copy expires, it re-queries the authoritative server and receives the new record. The rate at which the internet "sees" the change is a function of:
- The TTL that was set before the change
- The distribution of when individual resolvers last cached the record

A resolver that cached the record 5 minutes before the change with a 1-hour TTL will not pick up the change for 55 more minutes. A resolver that cached the record 59 minutes before the change will pick it up within 1 minute.

### Step 4: New Clients See Updated Records

Once a resolver's cache is refreshed, all clients using that resolver receive the updated record. The change becomes visible globally as cached entries expire across the resolver population.

---

## NS Record Changes and Delegation

NS record changes are a special case. Changing nameservers involves not just updating zone data but changing the **delegation** at the parent zone (registry). This is more complex than changing an A or MX record.

### What Happens During NS Change

1. The registrar submits the new NS records to the registry (TLD operator).
2. The registry updates its zone with the new NS delegation and glue records.
3. Resolvers caching the old NS delegation continue using old nameservers until TTL expiry.
4. NS delegation TTLs in TLD zones are typically set by the registry: often 172800 seconds (48 hours) for ccTLDs, 86400 for .com/.net.
5. Additionally, the old nameservers' A records may be cached. Glue records have their own TTL.
6. After all caches expire, resolvers begin querying the new nameservers.

**Total expected NS propagation window:** 24–72 hours in practice, depending on TTLs set by the registry and the resolver population.

Best practice during NS migration: keep the zone data identical on both old and new nameservers until propagation completes. Do not decommission old nameservers until you are confident all resolvers have transitioned.

---

## The "48 Hour Propagation" Myth

The commonly cited "DNS propagation takes 24–48 hours" is an oversimplification that originates from the historical 48-hour TTL commonly set on NS records by registrars. For a thorough breakdown of why this number is misleading, see [DNS propagation myths debunked](https://dnschkr.com/blog/dns-propagation-myths-debunked). In reality:

- Records with low TTLs (300 seconds) propagate in minutes
- Records with high TTLs (86400) take up to 24 hours
- NS delegation changes depend on registry TTLs, which are beyond the registrant's control
- Some resolvers (particularly ISP resolvers) may cache records longer than the published TTL (RFC 8767 stale-while-revalidate behavior)
- Enterprise DNS resolvers with configured minimum TTLs may hold records longer

The specific propagation time for any change is: the TTL that was in effect when resolvers last cached the record. There is no universal "propagation time" independent of TTL.

---

## Verifying Propagation

Because different resolvers cache independently, you must query multiple resolvers from different locations to assess propagation status. Checking from your local machine only tells you what your ISP's resolver has cached.

### Tools

**dig** — Query a specific resolver directly:

```bash
# Query Google's resolver
dig @8.8.8.8 example.com A

# Query Cloudflare's resolver
dig @1.1.1.1 example.com A

# Query a specific nameserver (bypasses resolver caching, hits authoritative directly)
dig @ns1.example.com example.com A

# Check remaining TTL (second field in answer section)
dig example.com A
```

**Online propagation checkers:** Tools like the [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) query multiple resolvers across different global locations simultaneously and show what each sees. This provides a representative view of propagation status across geographic regions and resolver populations.

**Authoritative query:** Querying the authoritative server directly tells you what the current authoritative answer is, independent of resolver caches. If the authoritative answer is correct but resolvers still show old data, the issue is cache expiry — not an authoritative zone problem.

```bash
# Find authoritative nameserver
dig example.com NS

# Query authoritative directly
dig @ns1.example.com example.com A +norec
```

### Interpreting Results

- **Authoritative answer correct, resolvers show old data:** Normal cache expiry in progress. Wait for TTL to expire.
- **Authoritative answer correct, some resolvers show new data:** Propagation partially complete. Resolvers that last cached recently will update sooner.
- **Authoritative answer incorrect:** The zone file itself has not been updated, or there is a secondary server synchronization issue.
- **Different resolvers show different values:** Expected behavior during the transition window.

### Cache Flushing for Specific Resolvers

Major public resolvers provide tools to flush their specific cache for a record:
- Google: https://developers.google.com/speed/public-dns/cache
- Cloudflare: https://1.1.1.1/purge-cache/

This forces that specific resolver to re-query the authoritative server on next request. It does not affect any other resolver.

---

## TTL During Active Changes

When making a change, the TTL you need to wait is the **TTL in effect when resolvers last cached the record** — not the current TTL at the authoritative server.

If you reduce TTL from 3600 to 300 simultaneously with changing the A record, resolvers that cached the record 30 minutes ago (with TTL=3600) still have 30 more minutes on their cache. The new 300 TTL applies to the next fetch, not the current cached copy.

This is why pre-change TTL reduction requires a lead time of at least the current TTL duration. See the TTL strategy documentation for the full pre-migration procedure.

---

## Secondary Server Propagation

In a multi-nameserver setup (primary + secondaries), changes propagate between authoritative servers via:

1. **NOTIFY (RFC 1996):** The primary sends a NOTIFY to secondaries immediately after a zone update.
2. **IXFR/AXFR:** Secondaries retrieve the updated zone from the primary.

This propagation happens within seconds to minutes, depending on configuration and network latency. Once all secondaries have the updated zone, any resolver querying any of them receives the new record.

From a resolver caching perspective, it does not matter which authoritative nameserver is queried — they should all return identical data after zone transfer completes.

---

## Common Misconceptions

**"I changed the record but my browser still shows the old site."**
Your ISP's resolver has a cached copy. The browser is not querying DNS for every request; it also has its own DNS cache. Clearing the browser cache or flushing the OS resolver cache (`ipconfig /flushdns` on Windows, `sudo dscacheutil -flushcache` on macOS) clears local caches but does not affect your ISP's resolver.

**"My DNS provider says propagation takes 24 hours."**
They are citing the maximum possible window based on typical NS delegation TTLs. Changes to records within the zone (A, MX, TXT, etc.) propagate based on those records' individual TTLs, which may be hours shorter than the NS TTL.

**"The record is correct on all the propagation checker sites, but one user still sees the old value."**
That user's ISP resolver is not in the propagation checker's test set. It may have a cached copy, or it may floor TTLs. The user can try querying 8.8.8.8 or 1.1.1.1 directly as a diagnostic step.

---

## References

- RFC 1034 — Domain Names — Concepts and Facilities (caching model)
- RFC 1035 — Domain Names — Implementation and Specification
- RFC 1996 — A Mechanism for Prompt Notification of Zone Changes (NOTIFY)
- RFC 2308 — Negative Caching of DNS Queries
- RFC 8767 — Serving Stale Data to Improve DNS Resiliency
- ICANN CZDS (Centralized Zone Data Service): https://czds.icann.org/
- What is DNS propagation and how it really works: [DNS propagation explained](https://dnschkr.com/blog/what-is-dns-propagation)
- APNIC Blog — DNS Propagation is a myth: https://blog.apnic.net/2023/01/24/dns-propagation-is-a-myth/
