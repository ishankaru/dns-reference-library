# SOA Record

## Overview

The SOA record (Start of Authority record) is the first record in every DNS zone file. It identifies the primary authoritative nameserver for the zone, provides the email address of the zone administrator, and specifies timing parameters that govern zone synchronization between primary and secondary nameservers.

Every zone has exactly one SOA record, always at the zone apex. Its presence signals that a nameserver is authoritative for a zone. Resolvers that receive a negative response (NXDOMAIN or NOERROR with empty answer) use the SOA's minimum TTL field to determine how long to cache the negative response (RFC 2308).

The SOA is closely tied to the zone transfer mechanisms:
- **AXFR** (Authoritative Zone Transfer) — full zone transfer from primary to secondary
- **IXFR** (Incremental Zone Transfer, RFC 1995) — transfers only changed records since a given serial

Secondaries use the serial number to detect whether the primary has newer data. The SOA timing fields (refresh, retry, expire) govern the polling schedule.

## Syntax

Zone file format (RFC 1035):

```
<zone-apex> [<TTL>] [<class>] SOA <primary-ns> <admin-email> (
    <serial>
    <refresh>
    <retry>
    <expire>
    <minimum>
)
```

Field descriptions:

| Field | Description |
|---|---|
| `primary-ns` | FQDN of the primary (master) nameserver |
| `admin-email` | Zone administrator email; `@` replaced with `.` (e.g., `hostmaster.example.com.` = `hostmaster@example.com`) |
| `serial` | 32-bit unsigned integer; must increment on every zone change for IXFR/AXFR to work |
| `refresh` | Seconds between secondary polling attempts to check for zone changes |
| `retry` | Seconds to wait before retrying after a failed refresh attempt |
| `expire` | Seconds after which a secondary stops serving the zone if it cannot reach the primary |
| `minimum` | Originally minimum TTL for records in zone; now used as negative caching TTL (RFC 2308) |

The parentheses allow the SOA record to span multiple lines in the zone file; they are not part of the wire format.

## Example

Zone file:

```zone
$ORIGIN example.com.
$TTL 3600

@   IN  SOA  ns1.example.com. hostmaster.example.com. (
                2024031501   ; serial (YYYYMMDDNN format)
                7200         ; refresh: check for updates every 2 hours
                1800         ; retry: retry after 30 minutes on failure
                1209600      ; expire: stop serving after 14 days without primary contact
                300 )        ; minimum (negative cache TTL): cache NXDOMAIN for 5 minutes

@   IN  NS  ns1.example.com.
@   IN  NS  ns2.example.com.
```

`dig` output:

```
$ dig SOA example.com

;; QUESTION SECTION:
;example.com.                   IN      SOA

;; ANSWER SECTION:
example.com.  3600  IN  SOA  ns1.example.com. hostmaster.example.com. (
                              2024031501 ; serial
                              7200       ; refresh
                              1800       ; retry
                              1209600    ; expire
                              300 )      ; minimum

;; Query time: 9 msec
```

Checking serial at authoritative nameserver:

```
$ dig @ns1.example.com SOA example.com +short
ns1.example.com. hostmaster.example.com. 2024031501 7200 1800 1209600 300
```

## Resolution Process

**Zone transfer (secondary polling).** Secondary nameservers periodically check whether the primary has newer zone data:

1. Secondary queries the primary for `SOA <zone>` over TCP (or UDP if small enough).
2. Secondary compares the returned serial number to its own cached serial.
3. If the primary's serial is greater (RFC 1982 serial number arithmetic), the secondary initiates a zone transfer.
4. For IXFR: secondary sends `IXFR <zone> <current-serial>` to the primary. The primary returns only changed records since that serial, or falls back to AXFR if the incremental data is not available.
5. For AXFR: the primary returns the entire zone. The transfer begins and ends with the SOA record.
6. On success, the secondary updates its copy and sets its serial to match.
7. If the primary cannot be reached, the secondary retries every `retry` seconds. If unreachable for `expire` seconds, the secondary stops responding as authoritative for the zone.

**Negative caching.** When a resolver receives an [NXDOMAIN](https://dnschkr.com/blog/what-is-nxdomain) (name does not exist) or NODATA (name exists but no records of requested type) response, it caches this negative result. The cache duration is `min(SOA minimum, response TTL)` per RFC 2308. The SOA minimum field in modern usage should be set low enough to limit negative cache duration (300–900 seconds is typical) without being so low it generates excessive re-queries for non-existent names.

**NOTIFY.** RFC 1996 defines the DNS NOTIFY mechanism: when the primary receives a zone update, it sends an unsolicited NOTIFY message to all secondaries listed in the zone's NS records. Secondaries that receive NOTIFY immediately poll the primary's SOA rather than waiting for the refresh interval. This dramatically reduces zone propagation delays — from minutes to seconds in most configurations.

## TTL Considerations

The SOA record's own TTL controls how long resolvers cache the SOA itself. This is separate from the SOA `minimum` field.

| Field | Recommended Value | Rationale |
|---|---|---|
| SOA record TTL | 3600 seconds | Rarely changes; no need to cache briefly |
| `refresh` | 7200–14400 seconds | For managed DNS or NOTIFY-capable servers; lower only if latency-sensitive |
| `retry` | 1800–3600 seconds | Should be less than `refresh` |
| `expire` | 604800–1209600 seconds (7–14 days) | Secondaries should survive extended primary outages |
| `minimum` (negative TTL) | 300–900 seconds | Balance between reducing spam lookups and fast propagation of new records |

**Serial number conventions.** The most common format is `YYYYMMDDNN` where `NN` is a two-digit daily increment (00–99). This allows up to 100 zone changes per day and makes the serial human-readable. Avoid using Unix timestamps as serials; they can exceed `2^31` when comparing serials under RFC 1982 arithmetic, causing secondary servers to misinterpret whether the primary has newer data.

When performing automated updates, autoincrement the serial by 1. Never decrement a serial — secondaries will not pull an update if the serial appears smaller (modulo RFC 1982 wrap-around).

## Security Considerations

**AXFR restriction.** Full zone transfers expose the entire zone contents. Restrict AXFR to known secondary IPs using ACLs in the nameserver configuration:

```
# BIND named.conf
allow-transfer { 198.51.100.2; 198.51.100.3; };
```

Without ACLs, any client can enumerate every record in the zone via AXFR (`dig AXFR example.com @ns1.example.com`). This is a significant information disclosure risk.

**TSIG authentication.** Use TSIG (Transaction Signature, RFC 2845) to authenticate zone transfers between primary and secondary nameservers. TSIG uses shared HMAC-MD5 (deprecated) or HMAC-SHA256/SHA512 keys to sign and verify transfer messages, preventing zone data injection by a man-in-the-middle.

**Serial number rollover.** RFC 1982 defines serial number comparison for 32-bit unsigned integers. The effective range before comparison ambiguity is `2^31` increments. Daily `YYYYMMDDNN` serials will not roll over for decades, but Unix timestamp serials approaching `2^31` (~2038) could cause issues.

**Admin email exposure.** The administrator email address in the SOA is publicly readable. Use a role address (e.g., `hostmaster@`, `dns-admin@`) rather than a personal address to reduce spam targeting.

## Troubleshooting

**Secondary not updating after zone change.** First verify the primary's serial was incremented: `dig @primary-ns SOA zone`. Then check the secondary: `dig @secondary-ns SOA zone`. You can also [query SOA records online](https://dnschkr.com/dns-inspector) to compare serial numbers across nameservers. If the serial matches the old value, the NOTIFY may not have reached the secondary, or the secondary is still within the `refresh` window. Force a manual zone transfer or reduce the `refresh` interval temporarily.

**Secondary serving stale data past `expire`.** The secondary has been unable to reach the primary for the duration of the `expire` interval and has stopped responding authoritatively. Restore connectivity to the primary or provision a replacement secondary. The secondary will resume once it successfully completes an AXFR.

**Serial number went backward.** A zone file was restored from backup with an older serial, or a new zone file was generated with a reset serial. Secondaries will not pull updates because their serial appears equal or greater. Manually set the serial higher than any secondary's current serial and reload the primary.

**AXFR refused ("Transfer failed").** The primary's ACL is blocking the secondary's IP. Add the secondary to the `allow-transfer` list in the primary's configuration.

**Negative cache duration too long.** If `minimum` is set to 86400 (1 day), resolvers will cache NXDOMAIN for 24 hours. When a new record is added at a previously non-existent name, clients may see the old NXDOMAIN for up to a day. Lower the `minimum` value to 300–900 seconds. For more on how TTL and caching interact during record changes, see [DNS TTL explained](https://dnschkr.com/blog/what-is-dns-ttl).

## Related Records

- **NS** — Always present alongside SOA at zone apex; defines authoritative nameservers
- **AXFR / IXFR** — Zone transfer query types that use the SOA serial for synchronization
- **DNSKEY** — DNSSEC signing key records at the zone apex (alongside SOA and NS)
- **DS** — Delegation Signer in parent zone; links to the child zone's KSK

To explore SOA parameters and zone configurations across the TLD landscape, see the [TLD directory](https://dnschkr.com/tlds).

## References

- RFC 1035 — Domain Names: Implementation and Specification (§3.3.13 — SOA RDATA)
- RFC 1034 — Domain Names: Concepts and Facilities
- RFC 1995 — Incremental Zone Transfer in DNS (IXFR)
- RFC 1996 — A Mechanism for Prompt Notification of Zone Changes (NOTIFY)
- RFC 2308 — Negative Caching of DNS Queries (DNS NCACHE)
- RFC 2845 — Secret Key Transaction Authentication for DNS (TSIG)
- RFC 1982 — Serial Number Arithmetic
