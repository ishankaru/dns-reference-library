# NS Record

## Overview

The NS record (Name Server record) identifies the authoritative nameservers for a DNS zone. Every zone must have at least two NS records at its apex for redundancy. NS records serve two distinct roles:

1. **Zone apex NS records** — Published within the zone itself, these indicate which servers hold the authoritative copy of the zone data. They are returned in the authority section of responses when the authoritative server answers.

2. **Delegation NS records** — Published in the parent zone, these are the records that delegate authority for a child zone to specific nameservers. A registrar sets these in the registry when you configure your domain's nameservers.

These two NS sets must be consistent (matching hostnames), but they are stored in different places and managed separately. Inconsistency between the parent delegation NS and the child zone's own NS records is called a lame delegation. Digging [into DNS delegation chains](https://dnschkr.com/dns-inspector) for a domain reveals both the parent and child NS sets, making it straightforward to spot mismatches.

**Glue records.** When a nameserver is within the zone it serves (e.g., `ns1.example.com` serving `example.com`), a circular dependency exists: you cannot look up `ns1.example.com` without first knowing the nameserver for `example.com`. The parent zone resolves this by publishing A (and AAAA) records for the child nameservers alongside the delegation NS records. These are called glue records.

## Syntax

Zone file format (RFC 1035):

```
<name> [<TTL>] [<class>] NS <nameserver-hostname>
```

- `name` — the zone apex (or delegated subdomain); `@` for zone apex
- `TTL` — time-to-live in seconds
- `class` — `IN`
- `NS` — record type
- `nameserver-hostname` — FQDN of the nameserver (trailing dot required); must resolve to an A or AAAA record

NS target hostnames must not be CNAMEs. This is a protocol violation per RFC 2181.

## Example

Zone file for `example.com` (child zone — own NS records):

```zone
$ORIGIN example.com.
$TTL 86400

; Zone apex NS records
@       IN  SOA  ns1.example.com. hostmaster.example.com. (
                  2024010101  ; serial
                  7200        ; refresh
                  3600        ; retry
                  1209600     ; expire
                  300 )       ; minimum

@       IN  NS  ns1.example.com.
@       IN  NS  ns2.example.com.

; Glue records (required because NS targets are in-bailiwick)
ns1     IN  A   198.51.100.1
ns2     IN  A   198.51.100.2
```

Parent zone (`.com`) delegation NS records for `example.com` (managed by the registry):

```zone
; In the .com zone (simplified):
example.com.    172800  IN  NS  ns1.example.com.
example.com.    172800  IN  NS  ns2.example.com.

; Glue records published in the .com zone:
ns1.example.com.  172800  IN  A  198.51.100.1
ns2.example.com.  172800  IN  A  198.51.100.2
```

`dig` output:

```
$ dig NS example.com

;; QUESTION SECTION:
;example.com.                   IN      NS

;; ANSWER SECTION:
example.com.            86400   IN      NS      ns1.example.com.
example.com.            86400   IN      NS      ns2.example.com.

;; ADDITIONAL SECTION:
ns1.example.com.        86400   IN      A       198.51.100.1
ns2.example.com.        86400   IN      A       198.51.100.2

;; Query time: 11 msec
```

Showing delegation from the parent (TLD):

```
$ dig NS example.com @a.gtld-servers.net.

;; AUTHORITY SECTION:
example.com.            172800  IN      NS      ns1.example.com.
example.com.            172800  IN      NS      ns2.example.com.

;; ADDITIONAL SECTION:
ns1.example.com.        172800  IN      A       198.51.100.1
ns2.example.com.        172800  IN      A       198.51.100.2
```

## Resolution Process

1. Recursive resolver queries a root nameserver for `www.example.com A`.
2. Root returns: "I don't know, but here are the `.com` nameservers" (NS records + glue A records for `.com` TLD servers).
3. Resolver queries a `.com` TLD nameserver.
4. TLD nameserver returns: "I don't know, but here is the delegation for `example.com`" (NS records + glue for `example.com` nameservers).
5. Resolver queries `ns1.example.com` (using the glue A record to reach it without a circular dependency).
6. `ns1.example.com` returns the authoritative answer for `www.example.com A`.

For a complete walkthrough of this iterative process, see [how DNS queries work](https://dnschkr.com/blog/how-dns-queries-work).

**Delegation chain.** Every zone is anchored by NS records at its parent. The chain runs from the root (`.`) through TLD nameservers to the authoritative servers for the domain. This delegation chain is what `dig +trace` walks.

**Subdomain delegation.** A zone can delegate a subdomain to a different set of nameservers by adding NS records for the subdomain within the parent zone. The subdomain's NS records effectively create a new zone boundary:

```zone
; In example.com zone:
sub.example.com.   IN  NS  ns1.sub.example.com.
sub.example.com.   IN  NS  ns2.sub.example.com.
ns1.sub.example.com.  IN  A  203.0.113.5   ; glue for in-bailiwick NS
```

## TTL Considerations

NS record TTLs control how long resolvers cache the delegation. The parent zone's NS TTL and the child zone's NS TTL are independent.

| Location | Recommended TTL |
|---|---|
| Parent (TLD/registry) delegation NS | 172800 seconds (48h) — set by registry |
| Child zone apex NS | 86400 seconds (24h) |
| Pre-nameserver-migration | Lower to 3600–7200 seconds |

NS TTLs are generally high because nameserver changes are rare and resolvers should cache delegation data aggressively to reduce load on TLD servers. Lower the TTL before a planned migration; raise it back afterward.

## Security Considerations

**Lame delegation.** A lame delegation occurs when the NS records in the parent zone list nameservers that do not hold authoritative data for the zone. This causes resolution failures. Common causes: (1) nameservers were changed at the registrar but not updated in the zone's own NS records, or (2) the zone was removed from the nameserver but the delegation was not updated. Monitor for lame delegations using tools like `dnsviz` or zone checking services. The [DNS security dashboard](https://dnschkr.com/security) tracks lame delegations and other nameserver misconfigurations across the DNS ecosystem.

**Glue record accuracy.** If glue A records in the parent zone are incorrect (stale IP after a nameserver IP change), resolvers cannot reach the authoritative server. Update glue records at the registrar/registry when nameserver IPs change.

**Nameserver hijacking.** If a domain's registrar account is compromised, the attacker can change the delegation NS records, redirecting all DNS resolution for the domain. Use registrar-level two-factor authentication and registry lock (EPP `serverTransferProhibited`, `serverUpdateProhibited`, `serverDeleteProhibited`) for high-value domains.

**Minimum two nameservers.** RFC 1034 requires at least two NS records for zone redundancy. A single-NS zone is a single point of failure. All TLD registries enforce a minimum of two NS records at registration.

**DNSSEC and DS records.** When DNSSEC is enabled, the parent zone publishes DS (Delegation Signer) records alongside the delegation NS records. The DS record contains a hash of the child zone's KSK (Key Signing Key). If the DS record is present but incorrect or missing, DNSSEC validation fails for the entire zone.

## Troubleshooting

**Lame delegation (SERVFAIL from authoritative server).** Query the authoritative server directly: `dig @ns1.example.com SOA example.com`, or [check NS records online](https://dnschkr.com/dns-inspector) to compare what the parent and child zones report. If the authoritative server returns `REFUSED` or does not respond authoritatively, the server is lame. Add the zone to the nameserver or update the delegation to point to servers that actually hold the zone.

**NS records in parent and child do not match.** Query the child's own NS: `dig @ns1.example.com NS example.com`. Query the parent's delegation: `dig @a.gtld-servers.net NS example.com`. If they differ, update both to match. The child zone's NS records must be updated manually in the zone file; the parent's delegation NS is updated through the registrar.

**Glue records stale after nameserver IP change.** Update glue records at the registrar's nameserver management interface. Changes propagate to the TLD zone on the registry's publication schedule (typically within minutes to hours). Verify with `dig @a.gtld-servers.net NS example.com`.

**Nameserver not responding.** Test `dig @<nameserver-ip> SOA <zone>`. Check that the nameserver process is running and that port 53 (UDP and TCP) is accessible. Ensure the nameserver is configured as authoritative for the zone and has a current copy of the zone data.

**Resolution fails only for some clients.** The delegation NS TTL may have expired at some resolvers but not others, leading to inconsistent resolution while the zone is in a transitional state. Wait for the higher TTL to expire globally, then verify resolution from multiple vantage points.

## Related Records

- **SOA** — Always present at zone apex alongside NS records; defines zone parameters
- **A / AAAA** — Required to resolve NS hostnames; glue records are A/AAAA records
- **DS** — Delegation Signer; published in parent zone alongside NS records for DNSSEC
- **CNAME** — Cannot be used as an NS target; NS target must resolve to A/AAAA directly

You can browse nameserver distributions and market share data for all major TLDs in the [DNS provider rankings](https://dnschkr.com/providers).

## References

- RFC 1034 — Domain Names: Concepts and Facilities (§4.2 — delegation, §3.6 — NS)
- RFC 1035 — Domain Names: Implementation and Specification
- RFC 2181 — Clarifications to the DNS Specification (§10.3 — NS and CNAME)
- RFC 4033 — DNS Security Introduction and Requirements (§2 — delegation chain)
- RFC 4034 — Resource Records for the DNS Security Extensions (DS record)
- RFC 4592 — The Role of Wildcards in the Domain Name System
