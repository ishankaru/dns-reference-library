# SRV Record

## Overview

The SRV record (Service record) specifies the location and parameters of servers providing a specific service for a domain. It extends DNS to allow clients to discover service endpoints — including port number, protocol, priority, and weight — without requiring the service location to be hardcoded into client software or distributed through out-of-band configuration.

SRV records are used by:

- **SIP** (Session Initiation Protocol) — VoIP and messaging (RFC 3263)
- **XMPP** (Jabber) — Instant messaging federation (RFC 6120)
- **LDAP** — Directory service discovery (RFC 2782)
- **Kerberos** — Authentication service location
- **Microsoft Active Directory** — Domain controller discovery, replication
- **CalDAV / CardDAV** — Calendar and address book service discovery
- **Minecraft** — Game server discovery
- **Matrix** — Federated messaging server discovery

## Syntax

Zone file format (RFC 2782):

```
_<service>._<proto>.<name> [<TTL>] [<class>] SRV <priority> <weight> <port> <target>
```

- `_service` — the symbolic service name from IANA's service name registry (e.g., `_sip`, `_xmpp-client`, `_ldap`); prefixed with underscore to avoid conflicts with real hostnames
- `_proto` — transport protocol, prefixed with underscore: `_tcp` or `_udp` (occasionally `_sctp`)
- `name` — the domain name offering the service
- `priority` — 16-bit unsigned integer; lower value = higher priority; clients try lower priority first
- `weight` — 16-bit unsigned integer; for records with equal priority, weight determines proportional load distribution; 0 means no preference
- `port` — TCP or UDP port number (0–65535)
- `target` — FQDN of the server providing the service; must resolve to A or AAAA; use `.` (dot) to signal that the service is not available at this domain

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

; SIP over TCP — two servers, one primary, one fallback
_sip._tcp   IN  SRV  10  60  5060  sipserver1.example.com.
_sip._tcp   IN  SRV  20  0   5060  sipserver2.example.com.

; XMPP client-to-server connections
_xmpp-client._tcp  IN  SRV  5  0  5222  xmpp.example.com.

; XMPP server-to-server federation
_xmpp-server._tcp  IN  SRV  5  0  5269  xmpp.example.com.

; LDAP over TCP
_ldap._tcp  IN  SRV  0  100  389  ldap1.example.com.
_ldap._tcp  IN  SRV  0  50   389  ldap2.example.com.

; Service explicitly not available (null target)
_ftp._tcp   IN  SRV  0  0  0  .

; A records for SRV targets
sipserver1  IN  A  198.51.100.10
sipserver2  IN  A  198.51.100.20
xmpp        IN  A  198.51.100.30
ldap1       IN  A  198.51.100.40
ldap2       IN  A  198.51.100.50
```

`dig` output:

```
$ dig SRV _sip._tcp.example.com

;; QUESTION SECTION:
;_sip._tcp.example.com.         IN      SRV

;; ANSWER SECTION:
_sip._tcp.example.com.  3600    IN      SRV     10 60 5060 sipserver1.example.com.
_sip._tcp.example.com.  3600    IN      SRV     20 0  5060 sipserver2.example.com.

;; ADDITIONAL SECTION:
sipserver1.example.com. 3600    IN      A       198.51.100.10
sipserver2.example.com. 3600    IN      A       198.51.100.20

;; Query time: 12 msec
```

## Resolution Process

SRV-aware clients follow this lookup and selection algorithm (RFC 2782 §3):

1. Client constructs the SRV query name: `_<service>._<proto>.<domain>`.
2. Client queries DNS for the SRV RRset.
3. If the response is NXDOMAIN, the service does not exist at this domain. The client may fall back to a default port on the domain's A record if the application protocol allows it.
4. If the response contains a record with target `.`, the service is explicitly unavailable. The client must not attempt to connect.
5. Client groups SRV records by priority (ascending). Within each priority group:
   - All records with weight 0 are shuffled randomly.
   - For records with non-zero weights, the selection probability for each record is proportional to its weight divided by the sum of all weights in the group. This is a weighted random selection — a record with weight 60 is selected twice as often as one with weight 30.
6. Client resolves the selected target's A/AAAA record and connects on the specified port.
7. On connection failure, the client tries the next record in the same priority group (random re-selection). After exhausting a priority group, the client moves to the next priority level.

**Load distribution with weights.** For `_ldap._tcp` in the example above, both records have priority 0. `ldap1` has weight 100 and `ldap2` has weight 50. Clients will select `ldap1` approximately 2/3 of the time and `ldap2` approximately 1/3 of the time.

## TTL Considerations

| Scenario | Recommended TTL |
|---|---|
| Stable service endpoint | 3600–14400 seconds |
| Active-passive failover | 60–300 seconds |
| Frequent endpoint changes | 60–300 seconds |
| Service migration (pre-change) | Lower to 300 seconds 48h before |

SRV records for stable infrastructure (e.g., corporate LDAP servers) can use high TTLs. For services with dynamic backends or planned maintenance windows, lower TTLs ensure clients discover the change quickly. After updating SRV records, [check DNS propagation globally](https://dnschkr.com/dns-propagation-checker) to confirm the new endpoints are visible across resolvers.

## Security Considerations

**SRV does not authenticate the target.** A client discovering a service via SRV has no guarantee that the target host is the legitimate server for that service. TLS with certificate validation (verifying that the server's certificate matches the domain name or a SANs entry) is the defense layer. DANE (TLSA records) can cryptographically bind a certificate to a specific SRV target. The broader landscape of [DNS security threats](https://dnschkr.com/blog/dns-attacks-guide) includes several attack vectors that exploit unauthenticated service discovery.

**Underscore labels and DNS.** Underscore-prefixed labels (`_sip`, `_xmpp-client`) do not appear in regular hostname resolution and are not subject to hostname syntax rules. This is intentional per RFC 8552, which formalizes the "Underscored Naming" convention. Never use underscored labels for hostnames; they are reserved for service discovery and similar conventions.

**Active Directory SRV exposure.** Active Directory relies heavily on SRV records for domain controller discovery. These records (`_kerberos._tcp.dc._msdcs.<domain>`, `_ldap._tcp.dc._msdcs.<domain>`) are published in public DNS when AD is configured with a public domain name. This discloses internal infrastructure details (DC hostnames, ports). Use a split-horizon DNS or a dedicated internal domain (`.internal`, `.local`, or a private subdomain) to keep AD SRV records off public DNS.

**SRV and DNSSEC.** SRV records can and should be signed when DNSSEC is enabled on the zone. An attacker who can tamper with a SRV record can redirect service traffic to a malicious endpoint. DNSSEC-validated SRV prevents this.

## Troubleshooting

**Service not discovered; client uses default port.** Query `dig SRV _<service>._tcp.<domain>`, or use a [DNS record lookup tool](https://dnschkr.com/dns-inspector) to query SRV records without command-line access. If no record exists, the client falls back to the default port on the A record. Add the SRV record in the zone if service discovery is required.

**Service reported as unavailable (target is `.`).** A null target SRV record explicitly signals no service. Check whether this record was published intentionally or is a stale/erroneous entry.

**Uneven load distribution.** If all SRV records have the same priority and equal weight (or weight 0), clients randomize selection equally. To favor one server, assign higher weight; to mark a server as backup, assign higher priority number.

**Client connects to wrong port.** Verify the port field in the SRV record: `dig SRV _<service>._<proto>.<domain>`. The port in the SRV record overrides any default the client application may have. Ensure the target server is listening on the port specified in the SRV record.

**Target hostname does not resolve.** The SRV record points to a hostname with no A or AAAA record, or a CNAME (which is a protocol violation for SRV targets). Verify: `dig A <srv-target>`. Add the A record or correct the SRV target.

**Kerberos or AD authentication failure.** Run `dig SRV _kerberos._tcp.<domain>` and `dig SRV _ldap._tcp.dc._msdcs.<domain>` to verify DC discovery records. Missing or incorrect SRV records are a common cause of domain join and authentication failures.

## Related Records

- **A / AAAA** — Required to resolve SRV target hostnames
- **CNAME** — Must not be used as SRV targets (RFC 2782 §4); use direct A records
- **TLSA** — DANE; binds TLS certificates to services discovered via SRV
- **TXT** — DKIM uses underscore-prefixed names in a similar convention to SRV

## References

- RFC 2782 — A DNS RR for specifying the location of services (DNS SRV)
- RFC 3263 — Session Initiation Protocol (SIP): Locating SIP Servers (SRV for SIP)
- RFC 6120 — Extensible Messaging and Presence Protocol (XMPP) (SRV for XMPP)
- RFC 2251 — Lightweight Directory Access Protocol v3 (LDAP; SRV discovery)
- RFC 4120 — The Kerberos Network Authentication Service (SRV for Kerberos)
- RFC 8552 — Scoped Interpretation of DNS Resource Records through "Underscore" Naming
- RFC 7673 — Using DNS-Based Authentication of Named Entities (DANE) with SRV Records
