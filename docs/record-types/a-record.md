# A Record

## Overview

The A record (Address record) maps a fully qualified domain name (FQDN) to a single IPv4 address. It is the most queried record type in the DNS system and is fundamental to name resolution on the internet. Every time a browser resolves a hostname before making an HTTP connection, an A record lookup is involved.

A records live in the authoritative zone file for a domain. Multiple A records can exist for the same name, enabling primitive load distribution via round-robin DNS. This is distinct from anycast, where multiple physical hosts share one IP at the routing level.

## Syntax

Zone file format (RFC 1035):

```
<name> [<TTL>] [<class>] A <IPv4-address>
```

- `name` — the hostname (relative to the zone origin if not terminated with a dot, FQDN if terminated)
- `TTL` — time-to-live in seconds; inherits `$TTL` directive if omitted
- `class` — almost always `IN` (Internet); can be omitted when class is inherited
- `A` — record type
- `IPv4-address` — dotted-decimal notation, e.g. `93.184.216.34`

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

@          IN  A  93.184.216.34
www        IN  A  93.184.216.34
api        IN  A  203.0.113.10
api        IN  A  203.0.113.11
mail       IN  A  198.51.100.5
```

The `@` symbol represents the zone origin (`example.com.`). The two `api` A records implement round-robin DNS.

`dig` output:

```
$ dig A www.example.com

;; QUESTION SECTION:
;www.example.com.               IN      A

;; ANSWER SECTION:
www.example.com.        3600    IN      A       93.184.216.34

;; Query time: 12 msec
;; SERVER: 1.1.1.1#53(1.1.1.1)
;; MSG SIZE  rcvd: 60
```

Round-robin response for `api.example.com`:

```
;; ANSWER SECTION:
api.example.com.        3600    IN      A       203.0.113.11
api.example.com.        3600    IN      A       203.0.113.10
```

Resolvers and clients rotate through the RRset differently; the ordering cannot be relied on for load balancing guarantees.

## Resolution Process

1. Client stub resolver queries its configured recursive resolver for `www.example.com A`.
2. Recursive resolver checks its cache. On a miss, it begins iterative resolution.
3. Resolver queries a root nameserver → receives NS referral for `.com`.
4. Resolver queries a `.com` TLD nameserver → receives NS referral for `example.com` plus glue A records for the authoritative nameservers.
5. Resolver queries an authoritative nameserver for `example.com` → receives the A RRset.
6. Recursive resolver caches the answer for the TTL duration and returns it to the client.
7. The client connects to the returned IP address.

If a CNAME record exists at the queried name, the resolver follows the chain until it reaches an A record (or returns [NXDOMAIN](https://dnschkr.com/blog/what-is-nxdomain) if none exists).

## TTL Considerations

| Scenario | Recommended TTL |
|---|---|
| Static production host | 3600–86400 seconds |
| CDN or load-balanced origin | 300–600 seconds |
| Planned migration (pre-change) | Lower to 300 seconds 48h before |
| Post-migration | Raise back to 3600+ after propagation |
| Geographic failover (active-passive) | 60–300 seconds |

Low TTLs increase query volume against authoritative nameservers. Very high TTLs (>24h) slow recovery from misconfigurations and IP changes. For most static sites, 3600 seconds is a reasonable default. Monitoring dashboards or failover systems that need fast convergence should use 60–300 seconds. For a deeper look at how caching duration affects record updates, see [DNS TTL explained](https://dnschkr.com/blog/what-is-dns-ttl).

## Security Considerations

**DNS Hijacking.** An attacker who can modify zone data or intercept queries can return a fraudulent A record, redirecting traffic to a malicious host. DNSSEC mitigates this by signing RRsets; resolvers that validate signatures will reject tampered responses.

**Cache Poisoning.** Without DNSSEC validation, a Kaminsky-style attack can inject a false A record into a recursive resolver's cache. Randomized source ports (RFC 5452) and 0x20 encoding raise the attack cost but do not eliminate it. DNSSEC validation is the definitive defense.

**IP Address Exposure.** A records directly expose the IP address of the origin server. If the origin sits behind a CDN or DDoS protection service (e.g., Cloudflare), publishing the real origin IP allows attackers to bypass the CDN. Ensure origin IPs are not discoverable via historical DNS data, certificate transparency logs, or MX records pointing to the same host.

**TTL as Attack Surface.** Extremely low TTLs can be abused in DNS rebinding attacks, where a malicious site rapidly changes its A record to an internal IP after the victim's browser has loaded the page.

## Troubleshooting

**No A record returned (NXDOMAIN).** The name does not exist in the zone. Check the zone file for typos in the record name. Verify the zone is loaded correctly on the authoritative server (`rndc reload` for BIND, `pdnsutil check-zone` for PowerDNS).

**Wrong IP returned from cache.** A stale cached record is being served. Wait for the TTL to expire, or use `dig +nocache` / query the authoritative nameserver directly: `dig @ns1.example.com A www.example.com`.

**Round-robin not distributing evenly.** Many resolvers and clients cache the full RRset and re-sort it. This is expected behavior; round-robin DNS is not a load balancer. Use a proper load balancer or health-check-aware DNS (e.g., AWS Route 53 health checks, Cloudflare Load Balancing) for production traffic distribution.

**IPv6 clients getting A records.** Clients with both IPv4 and IPv6 connectivity use the Happy Eyeballs algorithm (RFC 8305) to race AAAA and A lookups. If AAAA is missing, clients fall back to A. Add AAAA records for dual-stack support.

**Record not visible after publish.** TTL of old record has not expired at the querying resolver. Verify at the authoritative nameserver first: `dig @<authoritative-ns> A <hostname>`. If correct there, propagation is in progress. You can [check A records for any domain](https://dnschkr.com/dns-inspector) to verify the current address mapping, or use a [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) to monitor rollout across global resolvers.

## Related Records

- **AAAA** — IPv6 equivalent of the A record
- **CNAME** — Alias that resolves to an A (or AAAA) record
- **PTR** — Reverse mapping from IP to hostname (requires corresponding `in-addr.arpa` zone)
- **NS** — Delegates authority; glue records are A records for nameserver hostnames
- **SOA** — Defines zone parameters; always present in a zone that contains A records

## References

- RFC 1035 — Domain Names: Implementation and Specification (defines A record, §3.4.1)
- RFC 1034 — Domain Names: Concepts and Facilities
- RFC 5452 — Measures for Making DNS More Resilient Against Forged Answers
- RFC 8305 — Happy Eyeballs Version 2: Better Connectivity Using Concurrency
- RFC 4033 — DNS Security Introduction and Requirements (DNSSEC)
