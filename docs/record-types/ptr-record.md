# PTR Record

## Overview

The PTR record (Pointer record) maps an IP address back to a hostname, implementing reverse DNS lookup. While A and AAAA records resolve names to addresses, PTR records resolve addresses to names. PTR records live in special reverse DNS zones under the `in-addr.arpa.` domain (IPv4) and `ip6.arpa.` domain (IPv6).

PTR records serve several practical purposes:

- **Email deliverability** — Mail servers check that the sending IP has a valid PTR record, and that the PTR hostname resolves back to the same IP (Forward-Confirmed Reverse DNS, FCrDNS)
- **Network diagnostics** — `traceroute`, `ping`, and SNMP tools use PTR records to display hostnames in output
- **Log analysis** — System logs are more readable when IPs resolve to meaningful hostnames
- **Abuse investigation** — PTR records identify the operator of an IP address; an [IP location lookup](https://dnschkr.com/ip-address-lookup) can provide additional context like ASN, organization, and geolocation

PTR delegation is controlled by the IP address owner (the ISP or hosting provider), not the domain name owner. To set PTR records for an IP address, you must either control the reverse DNS zone for that block or request the change from the IP block owner.

## Syntax

Zone file format (RFC 1035):

```
<reversed-ip>.in-addr.arpa.     [<TTL>] [<class>] PTR <hostname>
<reversed-nibbles>.ip6.arpa.    [<TTL>] [<class>] PTR <hostname>
```

**IPv4 reverse zones.** The IP address is reversed and appended to `in-addr.arpa.`:
- IP `198.51.100.34` → zone `100.51.198.in-addr.arpa.` → record name `34.100.51.198.in-addr.arpa.`
- The zone is typically delegated at the `/24` boundary (`100.51.198.in-addr.arpa.`) by the upstream ISP

**IPv6 reverse zones.** The full 128-bit IPv6 address is expanded, each nibble reversed, and appended to `ip6.arpa.`:
- IP `2001:db8::1` (expanded: `2001:0db8:0000:0000:0000:0000:0000:0001`)
- Nibbles reversed: `1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2`
- Full PTR name: `1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa.`

**CLASSLESS PTR delegation (RFC 2317).** When an ISP delegates a subnet smaller than `/24` (e.g., `/28`) to a customer, the zone cannot be delegated at a clean octet boundary. RFC 2317 defines a CNAME-based scheme:

```zone
; In the ISP's zone (100.51.198.in-addr.arpa.):
34.100.51.198.in-addr.arpa.  IN  CNAME  34.16-31.100.51.198.in-addr.arpa.
35.100.51.198.in-addr.arpa.  IN  CNAME  35.16-31.100.51.198.in-addr.arpa.

; Delegated zone (customer controls):
16-31.100.51.198.in-addr.arpa.  IN  NS  ns1.customer.example.
```

## Example

IPv4 reverse zone file (`100.51.198.in-addr.arpa.`):

```zone
$ORIGIN 100.51.198.in-addr.arpa.
$TTL 3600

@   IN  SOA  ns1.example.com. hostmaster.example.com. (
                2024031501  7200  1800  1209600  300 )

@   IN  NS  ns1.example.com.
@   IN  NS  ns2.example.com.

; PTR records for /24 block
1   IN  PTR  ns1.example.com.
2   IN  PTR  ns2.example.com.
10  IN  PTR  mail1.example.com.
20  IN  PTR  web1.example.com.
```

`dig` output for reverse lookup:

```
$ dig -x 198.51.100.20

;; QUESTION SECTION:
;20.100.51.198.in-addr.arpa.    IN      PTR

;; ANSWER SECTION:
20.100.51.198.in-addr.arpa.  3600  IN  PTR  web1.example.com.

;; Query time: 15 msec
```

IPv6 PTR lookup:

```
$ dig -x 2001:db8::1

;; QUESTION SECTION:
;1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa.   IN   PTR

;; ANSWER SECTION:
1.0.0.0...8.b.d.0.1.0.0.2.ip6.arpa.  3600  IN  PTR  server1.example.com.
```

## Resolution Process

**PTR query flow.** When an application requests a reverse lookup for IP `198.51.100.20`:

1. The resolver constructs the query name: `20.100.51.198.in-addr.arpa.`
2. The resolver queries the root → `.arpa.` → `in-addr.arpa.` → `100.51.198.in-addr.arpa.`
3. The authoritative server for `100.51.198.in-addr.arpa.` returns the PTR record.
4. The resolver returns the hostname `web1.example.com.` to the application.

**FCrDNS (Forward-Confirmed Reverse DNS).** Many mail servers, spam filters, and security tools perform FCrDNS validation:

1. Look up PTR record for the connecting IP → get hostname (e.g., `mail.example.com`)
2. Look up A record for that hostname → get IP (e.g., `198.51.100.10`)
3. Verify that the IP from step 2 matches the original IP from step 1

FCrDNS validation passes only when both directions agree. A valid PTR that points to a hostname whose A record points to a different IP will fail FCrDNS. This is a common cause of email rejection.

**Delegation.** IP address blocks are delegated hierarchically. `in-addr.arpa.` is managed by IANA. Regional Internet Registries (ARIN, RIPE, APNIC, LACNIC, AFRINIC) manage reverse zones for their allocated blocks and delegate sub-zones to ISPs, which in turn delegate to customers.

## TTL Considerations

| Scenario | Recommended TTL |
|---|---|
| Stable server IP | 3600–86400 seconds |
| Pre-IP-change preparation | Lower to 300–600 seconds 48h before |
| Floating IPs / short-lived instances | 60–300 seconds |

PTR records typically change less frequently than A records. However, they must be updated when the corresponding A record changes. Inconsistent A and PTR TTLs can cause FCrDNS failures during transitions if the A record propagates before the PTR record is updated.

## Security Considerations

**PTR does not authenticate anything.** Anyone who controls a reverse DNS zone can publish any PTR hostname. Receiving a PTR of `mail.example.com` does not prove the server belongs to `example.com`. FCrDNS adds a layer of validation but is still trivially bypassed by an attacker who controls both the IP's PTR record and the forward A record. PTR is a hint, not an authentication mechanism. For more on DNS-based attack vectors, see the [DNS attacks guide](https://dnschkr.com/blog/dns-attacks-guide).

**Email and PTR reputation.** Major email providers (Google, Microsoft) check PTR records as part of spam scoring. An IP without a PTR record, or with a generic ISP-assigned PTR (e.g., `host-198-51-100-10.provider.net`), receives a lower trust score than one with a meaningful, FCrDNS-validated PTR. Set PTR records for all IPs used for email sending.

**IPv6 PTR coverage.** Many IPv6 deployments do not configure PTR records for host addresses. This is an operational oversight. If hosts are used for outbound email or services that are diagnosed using hostnames, configure PTR records for all active IPv6 addresses.

**PTR zone transfer exposure.** Like forward zones, reverse zones should restrict AXFR to known secondaries. Unrestricted AXFR of a reverse zone reveals all IP-to-hostname mappings for an entire subnet, which can expose internal network topology.

## Troubleshooting

**No PTR record (reverse lookup fails).** The reverse DNS zone may not be delegated to you. Contact your ISP or hosting provider to either delegate the reverse zone to your nameservers or set the PTR directly through their management interface. Verify delegation: `dig NS 100.51.198.in-addr.arpa.`

**PTR does not match A record (FCrDNS failure).** Query both: `dig -x <ip>` and `dig A <ptr-hostname>`. The A record returned must include the original IP. If they do not match, update the PTR to point to a hostname whose A record resolves back to that IP.

**Email rejected with "no reverse DNS".** The sending IP has no PTR record. This is a hard block from many mail systems. Set the PTR through the IP owner (VPS control panel, hosting support ticket, ISP request form). After setting, verify: `dig -x <sending-ip>`. You can also use an [IP address lookup tool](https://dnschkr.com/whats-my-ip-address) to confirm your sending IP and its current reverse DNS entry.

**PTR record exists but is not propagated.** The reverse zone's SOA serial may not have been incremented, or the secondary nameservers have not refreshed. Query the authoritative server directly: `dig @<auth-ns> -x <ip>`. If the record is there, wait for TTL expiration at the querying resolver.

**Classless delegation (sub-/24) not working.** Verify the ISP has set up the CNAME delegation in their zone. Use `dig <reversed-ip>.in-addr.arpa. CNAME` to see the CNAME, then query the target zone. If the CNAME does not exist, contact the ISP.

## Related Records

- **A** — Forward lookup; PTR must FCrDNS-validate against the corresponding A record
- **AAAA** — IPv6 forward lookup; PTR in `ip6.arpa.` must validate against AAAA
- **NS** — Reverse zones require NS records at their apex like any other zone
- **SOA** — Reverse zones have their own SOA record

## References

- RFC 1035 — Domain Names: Implementation and Specification (§3.5 — in-addr.arpa)
- RFC 3596 — DNS Extensions to Support IP Version 6 (§2.5 — ip6.arpa)
- RFC 2317 — Classless IN-ADDR.ARPA Delegation
- RFC 7043 — Resource Records for EUI-48 and EUI-64 Addresses in the DNS
- RFC 5321 — Simple Mail Transfer Protocol (§4.1.4 — reverse DNS in email)
- RFC 1912 — Common DNS Operational and Configuration Errors
