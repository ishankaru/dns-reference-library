# CNAME Record

## Overview

The CNAME record (Canonical Name record) creates an alias from one domain name to another. The target of a CNAME is called the canonical name, and it is what the resolver ultimately resolves to find an address record. CNAMEs are used to point multiple hostnames at the same host without duplicating A/AAAA records, making it easier to update IPs in one place.

Two critical constraints govern CNAME usage:

1. **A CNAME cannot coexist with any other record at the same owner name.** If `www.example.com` has a CNAME, it cannot also have an A, MX, TXT, or any other record type. This is an absolute DNS protocol restriction (RFC 1034 §3.6.2), not a convention.

2. **A CNAME cannot be placed at the zone apex (the bare domain).** The apex must have SOA and NS records; a CNAME cannot coexist with these. This is why `example.com` (without `www`) cannot be a CNAME.

**CNAME Flattening.** Many DNS providers (Cloudflare, Route 53 ALIAS, Netlify) implement a non-standard extension called CNAME flattening (also known as ALIAS or ANAME records). The nameserver resolves the CNAME chain authoritatively and returns the final A/AAAA records directly in the answer, making it appear as if the apex has an A record. This is a server-side workaround; the CNAME still does not appear in the response.

## Syntax

Zone file format (RFC 1034):

```
<alias-name> [<TTL>] [<class>] CNAME <canonical-name>
```

- `alias-name` — the name being aliased
- `TTL` — time-to-live in seconds
- `class` — `IN`
- `CNAME` — record type
- `canonical-name` — the target name; must be a fully qualified domain name (trailing dot) or relative to zone origin

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

; Alias www to the apex
www        IN  CNAME  example.com.

; Alias subdomain to a third-party service
blog       IN  CNAME  examplecom.ghost.io.

; Alias for CDN integration
static     IN  CNAME  d1234abcd.cloudfront.net.

; Chain (valid but discouraged)
images     IN  CNAME  static.example.com.
```

`dig` output showing full resolution:

```
$ dig CNAME www.example.com

;; QUESTION SECTION:
;www.example.com.               IN      CNAME

;; ANSWER SECTION:
www.example.com.        3600    IN      CNAME   example.com.

$ dig A www.example.com

;; QUESTION SECTION:
;www.example.com.               IN      A

;; ANSWER SECTION:
www.example.com.        3600    IN      CNAME   example.com.
example.com.            3600    IN      A       93.184.216.34
```

When a client queries for an A record at a CNAME, the resolver returns both the CNAME record and the resolved A record in the answer section.

## Resolution Process

1. Client queries for `A www.example.com`.
2. Recursive resolver finds a CNAME record at `www.example.com` pointing to `example.com.`.
3. The resolver restarts resolution with the canonical name: queries for `A example.com`.
4. The resolver returns both the CNAME record and the final A record in the answer section.
5. If the canonical name itself has a CNAME, the resolver follows the chain (up to resolver-defined limits, typically 8–10 hops, to prevent infinite loops).

**CNAME chains.** A CNAME may point to another CNAME. Each hop requires an additional DNS lookup, increasing latency. Chains longer than 2–3 hops are poor practice. Most resolvers impose a hop limit; exceeding it causes a `SERVFAIL`.

**CNAME and other record types.** An attempt to query any record type at a CNAME name results in the resolver following the CNAME and looking for that record type at the canonical name. This is why `MX www.example.com` (when `www` is a CNAME) actually looks up `MX example.com`.

## TTL Considerations

The TTL on a CNAME controls how long the alias mapping is cached. The TTL on the target A/AAAA record controls how long the resolved address is cached. These TTLs are independent and may differ.

For CDN integrations (e.g., CloudFront, Cloudflare), the CDN vendor typically controls the TTL on their A records. Set the CNAME TTL to match your desired update window for the alias itself — typically 300–3600 seconds.

For frequently changing targets (e.g., blue/green deployments where the CNAME target changes), lower the CNAME TTL to 60–300 seconds before the migration. Understanding [how DNS propagation works](https://dnschkr.com/blog/what-is-dns-propagation) is essential for timing CNAME changes during migrations.

## Security Considerations

**Subdomain takeover.** If a CNAME points to a service that is no longer provisioned (e.g., a deleted Heroku app, a removed S3 bucket), an attacker can claim that service endpoint and serve content under your domain. This is one of the most common and impactful DNS misconfigurations. Audit all CNAME records regularly and remove CNAMEs whose targets are decommissioned. The [DNS security dashboard](https://dnschkr.com/security) tracks dangling CNAMEs and other misconfiguration risks at scale.

**Dangling CNAME detection.** Automated tools (e.g., `subjack`, `nuclei` takeover templates) scan for dangling CNAMEs. Any unresolved CNAME in a public zone is a potential takeover target.

**CNAME and DNSSEC.** DNSSEC signs the CNAME record itself. The validator must also verify the chain: each hop in the CNAME chain must be signed if DNSSEC validation is required end-to-end. Cross-zone CNAME chains require that each zone in the chain is signed and that the resolver validates each signature.

**Information disclosure.** CNAME targets often reveal third-party service providers (e.g., `d1234.cloudfront.net` reveals AWS CloudFront usage). This is typically acceptable but relevant in threat modeling.

## Troubleshooting

**CNAME at apex not resolving.** A bare `CNAME example.com.` in the zone is a protocol violation. Use CNAME flattening (Cloudflare Proxied, Route 53 ALIAS, Netlify DNS) to work around the apex restriction. Alternatively, point the apex to a redirect service that forwards to `www`.

**Multiple record types at CNAME name.** If you add a CNAME to a name that already has an A record (or vice versa), most authoritative servers will reject the zone as invalid. The error is typically logged as a zone check failure. Remove the conflicting records before adding the CNAME.

**CNAME not followed during resolution.** Some older or misconfigured resolvers may return just the CNAME without following the chain. This is a resolver bug. Query a known-good resolver (`dig @1.1.1.1 A www.example.com`) to confirm the expected resolution path.

**Long CNAME chain causing SERVFAIL.** Trace the chain: `dig +trace CNAME alias.example.com` and follow each step, or use an [online DNS record checker](https://dnschkr.com/dns-inspector) to inspect the full CNAME chain visually. Flatten the chain by pointing the alias directly to the final canonical name or the nearest A record.

**Subdomain takeover verified.** Remove the dangling CNAME immediately. If the external service can be reclaimed (e.g., re-registering a Heroku app name), do so before removal to prevent the window of exposure. After removing the CNAME, verify with `dig CNAME <name>` that it returns NXDOMAIN.

## Related Records

- **A / AAAA** — The record types ultimately resolved via a CNAME chain
- **MX** — Cannot coexist with a CNAME; MX target is a hostname resolved separately
- **SOA / NS** — Cannot coexist with a CNAME at the same name
- **ALIAS / ANAME** — Non-standard zone-apex workaround implemented by some DNS providers

## References

- RFC 1034 — Domain Names: Concepts and Facilities (§3.6.2 — CNAME restrictions)
- RFC 1035 — Domain Names: Implementation and Specification
- RFC 2181 — Clarifications to the DNS Specification (§10.1 — CNAME and other data)
- RFC 7816 — DNS Query Name Minimisation to Improve Privacy
- draft-ietf-dnsop-aname — Address-specific DNS aliases (ANAME) [Expired; implemented variously by vendors]
