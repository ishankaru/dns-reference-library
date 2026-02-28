# AAAA Record

## Overview

The AAAA record (quad-A record) maps a fully qualified domain name to a single IPv6 address. It is the IPv6 counterpart to the A record. The name "AAAA" reflects that an IPv6 address is four times the length of an IPv4 address (128 bits vs 32 bits).

IPv6 deployment has accelerated significantly since 2016. Major CDN providers (Cloudflare, Akamai, Fastly), cloud platforms (AWS, GCP, Azure), and mobile networks all support dual-stack. Publishing AAAA records alongside A records allows IPv6-capable clients to prefer IPv6, reducing IPv4 address pressure and improving routing efficiency for networks where IPv6 peering is better.

## Syntax

Zone file format (RFC 3596):

```
<name> [<TTL>] [<class>] AAAA <IPv6-address>
```

- `name` — the hostname
- `TTL` — time-to-live in seconds
- `class` — `IN`
- `AAAA` — record type
- `IPv6-address` — colon-hexadecimal notation per RFC 5952, e.g. `2606:2800:220:1:248:1893:25c8:1946`

IPv6 addresses may use `::` to compress consecutive groups of zeros. Both forms are valid in zone files; RFC 5952 canonicalization prefers the compressed form.

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

@     IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
www   IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
api   IN  AAAA  2001:db8:cafe::1
api   IN  AAAA  2001:db8:cafe::2
```

`dig` output:

```
$ dig AAAA www.example.com

;; QUESTION SECTION:
;www.example.com.               IN      AAAA

;; ANSWER SECTION:
www.example.com.        3600    IN      AAAA    2606:2800:220:1:248:1893:25c8:1946

;; Query time: 8 msec
;; SERVER: 2606:4700:4700::1111#53(2606:4700:4700::1111)
```

## Resolution Process

AAAA resolution follows the same iterative process as A record resolution. The query type in the question section is `AAAA` (type 28). The authoritative server returns the AAAA RRset for the queried name.

**Dual-stack client behavior (Happy Eyeballs, RFC 8305).** When a client has both IPv4 and IPv6 connectivity:

1. The stub resolver issues both A and AAAA queries simultaneously (or with a very short stagger).
2. The client races TCP connections to the returned addresses.
3. IPv6 is preferred if a working IPv6 path exists. The preference delay before falling back to IPv4 is typically 250ms (configurable).
4. The successful connection wins; the losing attempt is torn down.

This means AAAA records are used when available and the network supports them, with automatic fallback to A records if the IPv6 path fails.

**Resolver behavior.** A resolver receiving both A and AAAA answers from the authoritative server caches them independently, each with their own TTL. There is no coupling between the A and AAAA TTLs for the same name.

## TTL Considerations

Use the same TTL for A and AAAA records pointing to the same host. Mismatched TTLs cause inconsistent behavior during updates: clients may receive a stale AAAA after the A record has already changed. See [what is DNS TTL](https://dnschkr.com/blog/what-is-dns-ttl) for more on how caching duration impacts record consistency.

| Scenario | Recommended TTL |
|---|---|
| Stable production server | 3600–86400 seconds |
| Planned IPv6 address migration | Lower to 300s 48h before change |
| Anycast CDN edge | 60–300 seconds |
| Failover (active-passive) | 60–300 seconds |

## Security Considerations

**IPv6-only attack surface.** Publishing AAAA records exposes an IPv6 interface on the host. Ensure firewall rules cover IPv6 as well as IPv4. Many operators configure IPv4 firewalls thoroughly but leave IPv6 open by default. `ip6tables` or equivalent must be configured explicitly.

**Prefix length exposure.** IPv6 AAAA records often reveal the host's /64 prefix, from which the interface identifier (EUI-64 or random) may be derived. This can enable scanning of adjacent addresses in the same subnet. Use privacy extensions (RFC 4941) or randomly assigned addresses where applicable. An [IP geolocation lookup](https://dnschkr.com/ip-address-lookup) can reveal additional metadata about exposed IPv6 addresses, including ASN and approximate location.

**DNSSEC applies equally.** AAAA records must be signed if DNSSEC is enabled on the zone. A signed A record with an unsigned AAAA (or vice versa) is a zone configuration error.

**Bogon IPv6 addresses.** Do not publish AAAA records pointing to link-local (`fe80::/10`), loopback (`::1`), documentation (`2001:db8::/32`), or ULA (`fc00::/7`) addresses in public DNS. These will not be reachable from the internet and cause connection failures.

## Troubleshooting

**AAAA record present but IPv6 not reachable.** The record is published correctly but the host has no IPv6 connectivity, or a firewall is blocking IPv6 traffic. Test with `curl -6 https://example.com` or `ping6 example.com` from a dual-stack host. Check that the server's network interface has the expected IPv6 address assigned and that the default gateway is reachable via IPv6.

**Clients not using IPv6 despite AAAA record.** The client network may have broken IPv6 (e.g., a router advertising a prefix but with no upstream IPv6 routing). Happy Eyeballs will fall back to IPv4 transparently. Use `curl -6` to force IPv6 and diagnose the path.

**AAAA record resolves but browser falls back to IPv4.** A common cause is IPv6 MTU issues or ICMPv6 being blocked, which prevents Path MTU Discovery. TCP connections begin but stall when large packets are sent. Ensure ICMPv6 type 2 (Packet Too Big) is allowed through all firewalls in the path.

**dig returns no AAAA but record is in zone.** Confirm the record was added to the correct zone and the authoritative server has reloaded. Query the authoritative server directly: `dig @ns1.example.com AAAA www.example.com`. Also verify there is no CNAME at the same name that should be resolving to the AAAA. You can [look up AAAA records online](https://dnschkr.com/dns-inspector) without needing command-line access.

**Different addresses returned to IPv4 vs IPv6 clients.** This is intentional in some CDN configurations (anycast). The authoritative server returns different answers based on the resolver's source IP (EDNS Client Subnet). This is expected; verify with `dig +subnet=0.0.0.0/0 AAAA example.com` vs `dig +subnet=2001:db8::/32 AAAA example.com`.

## Related Records

- **A** — IPv4 address record; published alongside AAAA for dual-stack operation
- **PTR** — Reverse DNS; IPv6 PTR records live in `ip6.arpa` (see PTR record reference)
- **CNAME** — Alias; works identically for both A and AAAA resolution
- **NS** — Nameservers may also have AAAA glue records for IPv6-capable resolvers

## References

- RFC 3596 — DNS Extensions to Support IP Version 6 (defines AAAA record)
- RFC 5952 — A Recommendation for IPv6 Address Text Representation
- RFC 8305 — Happy Eyeballs Version 2: Better Connectivity Using Concurrency
- RFC 4291 — IP Version 6 Addressing Architecture
- RFC 4941 — Privacy Extensions for Stateless Address Autoconfiguration in IPv6
- RFC 4033 — DNS Security Introduction and Requirements (DNSSEC)
