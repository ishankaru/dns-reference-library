# DNS Zone Files

A zone file is a text representation of a DNS zone — the complete set of resource records for which a nameserver is authoritative. Zone files follow the format defined in RFC 1035, with extensions added by RFC 2308 (negative caching) and RFC 1101 (network name encoding).

Zone files are used by authoritative DNS servers (BIND, NSD, Knot DNS) to load zone data into memory at startup, and are the canonical export format for zone transfers and backups. To query the records produced from zone files on any authoritative server, use a [DNS record checker](https://dnschkr.com/dns-inspector).

---

## Zone File Structure

A zone file consists of:
1. Optional control directives (`$ORIGIN`, `$TTL`, `$INCLUDE`, `$GENERATE`)
2. Resource records in master file format

Blank lines are ignored. Text after a semicolon (`;`) to end of line is a comment.

```zone
; Zone file for example.com
$ORIGIN example.com.
$TTL 3600

; SOA record
@   IN  SOA  ns1.example.com. hostmaster.example.com. (
                2024020101 ; serial
                7200       ; refresh
                3600       ; retry
                604800     ; expire
                300        ; negative cache TTL
            )

; Nameservers
@   IN  NS   ns1.example.com.
@   IN  NS   ns2.example.com.

; A records
@       IN  A       203.0.113.10
www     IN  A       203.0.113.10
mail    IN  A       203.0.113.20

; AAAA
@       IN  AAAA    2001:db8::1

; MX
@       IN  MX  10  mail.example.com.

; TXT
@       IN  TXT     "v=spf1 ip4:203.0.113.20 -all"

; CNAME
ftp     IN  CNAME   www.example.com.
```

---

## Directives

### $ORIGIN

Sets the current origin — the domain name appended to any unqualified (non-absolute) name in subsequent records. An absolute name ends with a period (`.`). A relative name does not.

```zone
$ORIGIN example.com.
; "www" expands to "www.example.com."
; "www.example.com." is already absolute, unchanged
```

If `$ORIGIN` is not set, the server uses the zone name from its configuration. Changing `$ORIGIN` mid-file affects only subsequent records.

### $TTL

Sets the default TTL for all subsequent records that do not have an explicit TTL. RFC 2308 made `$TTL` mandatory as the first record in a zone file (before any resource record). Without it, TTL behavior is implementation-defined.

```zone
$TTL 3600
; All following records default to 3600 seconds unless overridden
```

Per-record TTL overrides are specified as the second field before the class:
```zone
www  60  IN  A  203.0.113.10   ; TTL of 60 seconds
```

### $INCLUDE

Reads another file and inserts its contents at the current position. Useful for splitting large zones into logical sections.

```zone
$INCLUDE /etc/bind/zones/example.com.mail
```

### $GENERATE

Creates a range of records from a template. Used for PTR records in large reverse zones.

```zone
$GENERATE 1-254 $.0.0.10.in-addr.arpa. PTR host-$.example.com.
```

---

## SOA Record

The SOA (Start of Authority) record is mandatory and must appear first in a zone file. It defines the zone's primary nameserver, administrative contact, and timing parameters that govern zone behavior.

```zone
example.com.  IN  SOA  ns1.example.com. hostmaster.example.com. (
    2024020101   ; serial
    7200         ; refresh
    3600         ; retry
    604800       ; expire
    300          ; minimum (negative cache TTL)
)
```

**Fields:**

- **MNAME** (`ns1.example.com.`) — Primary master nameserver. Secondary servers query this server for zone updates. You can look up the SOA record for any domain via the [DNS inspector tool](https://dnschkr.com/dns-inspector) to see which nameserver is designated as the primary.
- **RNAME** (`hostmaster.example.com.`) — Administrative contact email with `@` replaced by `.`. `hostmaster.example.com.` maps to `hostmaster@example.com`.
- **Serial** — 32-bit unsigned integer. Secondary servers compare this value to detect zone changes. Must be incremented on every change. Convention: YYYYMMDDNN (date + sequence).
- **Refresh** — How often (seconds) secondary servers check the primary for updates by comparing serials.
- **Retry** — How long a secondary waits before retrying if a refresh attempt fails.
- **Expire** — If a secondary cannot contact the primary for this duration, it stops serving the zone (treats itself as no longer authoritative).
- **Minimum** — Per RFC 2308, this field is now used as the negative cache TTL (NCTTL): how long resolvers cache NXDOMAIN responses for this zone.

**Serial number overflow:** The serial is a 32-bit unsigned integer (max 4,294,967,295). Date-based serials work until 2147483647 (2038-like limit for this format). RFC 1982 defines serial arithmetic for comparing serials with potential wraparound.

---

## Resource Record Format

Each resource record line follows this format:

```
[name] [ttl] [class] type rdata
```

- **Name:** Owner name. `@` means the current `$ORIGIN`. Omitting the name repeats the previous record's owner.
- **TTL:** Optional. If omitted, uses `$TTL` directive value.
- **Class:** `IN` (Internet) is almost universal. `CH` (Chaosnet) and `HS` (Hesiod) are historical curiosities.
- **Type:** Record type (A, AAAA, MX, NS, CNAME, TXT, PTR, SOA, CAA, SRV, etc.)
- **Rdata:** Record-type-specific data

**Name resolution rules:**
- Names ending in `.` are absolute (fully qualified): `ns1.example.com.`
- Names not ending in `.` are relative and have `$ORIGIN` appended: `ns1` becomes `ns1.example.com.`

---

## Zone Transfers

Zone transfers replicate zone data from a primary nameserver to secondary nameservers. There are two types:

### AXFR (Authoritative Transfer)

A full zone transfer. The secondary requests the complete zone from the primary. The primary sends every resource record in the zone followed by the SOA record.

```bash
# Manual AXFR using dig
dig @ns1.example.com example.com AXFR
```

AXFR is initiated when:
- A secondary server starts up and has no local copy
- The secondary detects the primary's serial has increased (via refresh polling)
- An administrator triggers it manually

**Security:** AXFR exposes the complete zone contents. Zone transfers should be restricted to known secondary server IPs.

**BIND configuration:**
```bind
zone "example.com" {
    type master;
    file "/etc/bind/zones/example.com";
    allow-transfer { 198.51.100.2; 198.51.100.3; };
    also-notify { 198.51.100.2; 198.51.100.3; };
};
```

### IXFR (Incremental Transfer) — RFC 1995

Incremental zone transfer. The secondary sends its current serial to the primary; the primary sends only the changes since that serial. This dramatically reduces bandwidth for large zones with infrequent changes.

If the primary does not have IXFR data going back to the secondary's serial (e.g., after a zone reload), it falls back to AXFR.

### NOTIFY — RFC 1996

When a zone is updated, the primary sends NOTIFY messages to secondary servers, prompting them to check the serial and initiate a transfer if needed. This reduces propagation latency from the full refresh interval to seconds.

NOTIFY messages are sent to the servers listed in `also-notify` and in the zone's NS records.

**TSIG (Transaction Signature):** Zone transfers and NOTIFY messages should be authenticated using TSIG (RFC 2845), which adds HMAC-based authentication to DNS messages. Without TSIG, anyone with network access to the transfer port can receive a full AXFR.

---

## Dynamic DNS Updates (RFC 2136)

RFC 2136 defines a protocol for updating zone data dynamically without modifying zone files directly or restarting nameservers. This is used by DHCP servers, Let's Encrypt certbot, and applications that need programmatic DNS record management.

### Update Process

1. The client sends a DNS UPDATE message to the primary nameserver.
2. The message contains prerequisites (conditions that must be true before applying changes) and an update section (records to add or delete).
3. The server applies the update atomically and increments the SOA serial.
4. The server optionally sends NOTIFY to secondaries.

### Update Message Structure

```
Zone: example.com IN SOA
Prerequisite: www.example.com A must not exist
Update: Add www.example.com A 203.0.113.99 TTL 300
```

### Authentication

Dynamic updates must be authenticated. Without authentication, any client on the network can modify zone data. Authentication methods:

- **TSIG (RFC 2845):** HMAC-MD5, HMAC-SHA256, or HMAC-SHA512 shared key
- **SIG(0) (RFC 2931):** Public-key based; rarely deployed
- **GSS-TSIG:** Kerberos-based; used in Active Directory DNS integration

### BIND dynamic update configuration:

```bind
zone "example.com" {
    type master;
    file "/var/lib/bind/example.com.db";
    allow-update { key "dhcp-update-key"; };
};

key "dhcp-update-key" {
    algorithm hmac-sha256;
    secret "base64secrethere==";
};
```

BIND stores dynamic updates in a separate journal file (`.jnl`) and periodically freezes the zone to write updates back to the zone file.

---

## References

- RFC 1034 — Domain Names — Concepts and Facilities
- RFC 1035 — Domain Names — Implementation and Specification (zone file format)
- RFC 1995 — Incremental Zone Transfer in DNS (IXFR)
- RFC 1996 — A Mechanism for Prompt Notification of Zone Changes (NOTIFY)
- RFC 2136 — Dynamic Updates in the Domain Name System (DNS UPDATE)
- RFC 2308 — Negative Caching of DNS Queries (DNS NCACHE) — SOA minimum field
- RFC 2845 — Secret Key Transaction Authentication for DNS (TSIG)
- BIND 9 Administrator Reference Manual: https://bind9.readthedocs.io/
- Browse all top-level domain zones and their registry operators: [TLD directory](https://dnschkr.com/tlds)
- Knot DNS documentation: https://www.knot-dns.cz/documentation/
