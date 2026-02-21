# MX Record

## Overview

The MX record (Mail Exchange record) specifies the mail server(s) responsible for accepting email on behalf of a domain. When a sending mail server (MTA) needs to deliver email to `user@example.com`, it queries for `MX example.com` and connects to the returned mail server(s) on port 25 (SMTP).

MX records include a priority value (also called preference): lower numbers indicate higher priority. If the highest-priority server is unavailable, the sending MTA retries against lower-priority servers, providing fault tolerance without requiring the sender to know anything about the recipient's infrastructure.

**Null MX (RFC 7505).** A domain that does not accept email should publish a null MX record to explicitly signal this:

```
example.com.  IN  MX  0  .
```

This prevents sending MTAs from attempting delivery, falling back to A record lookup (a legacy behavior), or generating bounce loops. Without a null MX, some senders fall back to attempting SMTP against the domain's A record.

## Syntax

Zone file format (RFC 5321, RFC 1035):

```
<name> [<TTL>] [<class>] MX <priority> <mail-server-hostname>
```

- `name` — the domain receiving mail (typically the zone apex)
- `TTL` — time-to-live in seconds
- `class` — `IN`
- `MX` — record type
- `priority` — 16-bit unsigned integer (0–65535); lower is higher priority
- `mail-server-hostname` — FQDN of the mail server (trailing dot); must resolve to an A or AAAA record

Important: the mail server hostname **must not** be an IP address, and **must not** be a CNAME. These are protocol violations per RFC 2181 §10.3. Use an A/AAAA record at the mail server hostname.

## Example

Zone file entries:

```zone
$ORIGIN example.com.
$TTL 3600

; Primary and backup mail servers
@   IN  MX  10  mail1.example.com.
@   IN  MX  20  mail2.example.com.
@   IN  MX  30  mail3.example.com.

; A records for the mail servers
mail1  IN  A  198.51.100.10
mail2  IN  A  198.51.100.20
mail3  IN  A  198.51.100.30

; Hosted email provider (G Suite / Google Workspace)
; @  IN  MX  1   aspmx.l.google.com.
; @  IN  MX  5   alt1.aspmx.l.google.com.
; @  IN  MX  5   alt2.aspmx.l.google.com.
; @  IN  MX  10  alt3.aspmx.l.google.com.
; @  IN  MX  10  alt4.aspmx.l.google.com.

; Null MX (no mail accepted)
; @  IN  MX  0   .
```

`dig` output:

```
$ dig MX example.com

;; QUESTION SECTION:
;example.com.                   IN      MX

;; ANSWER SECTION:
example.com.            3600    IN      MX      10 mail1.example.com.
example.com.            3600    IN      MX      20 mail2.example.com.
example.com.            3600    IN      MX      30 mail3.example.com.

;; ADDITIONAL SECTION:
mail1.example.com.      3600    IN      A       198.51.100.10
mail2.example.com.      3600    IN      A       198.51.100.20
mail3.example.com.      3600    IN      A       198.51.100.30

;; Query time: 14 msec
```

The additional section contains the A records for the MX targets, pre-fetched by the authoritative server to save the sender additional lookups (glue-like behavior).

## Resolution Process

1. Sending MTA extracts the recipient domain from the envelope address (`RCPT TO:<user@example.com>`).
2. MTA queries its configured resolver for `MX example.com`.
3. Resolver returns the MX RRset, ordered by priority.
4. MTA sorts MX records by priority (ascending). For records with equal priority, the MTA randomizes order (for load distribution).
5. MTA resolves the highest-priority mail server hostname to an A or AAAA record.
6. MTA attempts SMTP connection (port 25) to the resolved IP.
7. On connection failure or temporary error (4xx SMTP code), MTA tries the next MX record in priority order.
8. If all MX servers fail, the MTA queues the message for retry (RFC 5321 §4.5.4.1 recommends retrying for at least 4–5 days).

**Fallback to A record (legacy behavior).** If a domain has no MX records, some legacy MTAs attempt SMTP delivery to the domain's A record. RFC 5321 §5 permits this but it is unreliable. Publishing a null MX explicitly disables this fallback.

## TTL Considerations

MX records control mail delivery routing. Changes to MX records must be timed carefully:

| Scenario | Recommended TTL |
|---|---|
| Stable mail configuration | 3600–14400 seconds |
| Pre-migration (48h before change) | Lower to 300–600 seconds |
| During mail provider migration | 300 seconds |
| Post-migration (stable) | Raise back to 3600+ seconds |

Sending MTAs cache MX lookups for the TTL duration. If you migrate mail providers with a high TTL (e.g., 86400s), mail may be delivered to the old provider for up to 24 hours after you update the records. Pre-lowering the TTL 48 hours before a migration is essential.

## Security Considerations

**SPF, DKIM, and DMARC.** MX records alone do not authenticate email. Publish SPF (TXT record), DKIM (TXT record under `_domainkey` subdomain), and DMARC (TXT record at `_dmarc` subdomain) to prevent spoofing and enable delivery policy enforcement. For a detailed analysis of email authentication adoption rates, see [email authentication: SPF, DKIM, and DMARC](https://dnschkr.com/blog/email-authentication-spf-dkim-dmarc).

**MX pointing to CNAME (protocol violation).** RFC 2181 prohibits CNAME targets for MX records. Some senders reject delivery to domains where the MX points to a CNAME. This is a zone configuration error that causes silent delivery failures.

**Open relay via backup MX.** Low-priority (high number) MX servers are sometimes targeted by spammers who bypass the primary server and exploit a misconfigured backup that relays for the domain. Ensure all MX-listed servers enforce proper recipient validation.

**SMTP STARTTLS / MTA-STS.** MX records do not enforce encrypted delivery. Publish an MTA-STS policy (`_mta-sts.example.com` TXT + HTTPS policy file) to require STARTTLS when delivering to your domain's mail servers. DANE (TLSA records) provides a cryptographically binding mechanism for mail server certificate pinning.

**Null MX and spoofing.** A domain without any MX record (and without a null MX) is ambiguous. Some tools and spam filters treat no-MX domains as suspicious. Publishing a null MX clearly signals that the domain is not a mail sender, which can improve deliverability for sibling domains.

## Troubleshooting

**Email not delivered; sender receives "no MX record" bounce.** [Look up MX records](https://dnschkr.com/dns-inspector) for the domain to confirm what is published. If no MX record exists and the A record is not intended as a mail host, publish either a valid MX or a null MX.

**Mail delivered to old provider after MX change.** The sending MTA has cached the old MX record. The cache expires at the previous TTL. Verify the new MX at the authoritative server: `dig @ns1.example.com MX example.com`. If correct there, propagation is in progress — use a [global DNS propagation checker](https://dnschkr.com/propagation-checker) to see which resolvers have picked up the new MX. Wait for the old TTL to expire.

**MX points to CNAME; intermittent delivery failures.** Replace the CNAME target with the actual hostname. Add an A record for that hostname directly in the zone.

**All MX servers listed with priority 0 or equal.** Equal priorities distribute load randomly across all servers. This is valid but means no failover ordering. If one server should be preferred, assign different priorities.

**Backup MX accepting mail but not forwarding.** A backup MX (secondary mail server) that accepts mail must be configured to relay to the primary. If it is accepting and dropping mail rather than forwarding, messages will be lost. Verify the backup MX relay configuration.

**Null MX not honored by sender.** Not all MTAs implement RFC 7505. Some legacy senders still fall back to A record delivery even when a null MX is present. This is an MTA bug at the sender. Nothing can be done at the recipient's DNS level; null MX is the correct approach and major MTAs (Postfix >=3.0, Exim >=4.87) honor it.

## Related Records

- **A / AAAA** — Required to resolve MX hostname targets; cannot use IPs directly in MX
- **TXT** — SPF records at zone apex; DKIM records at `_domainkey` subdomain; DMARC at `_dmarc`
- **TLSA** — DANE certificate binding for SMTP; published at `_25._tcp.<mail-server-hostname>`
- **SOA** — Defines zone; MX is typically at zone apex alongside SOA

## References

- RFC 1035 — Domain Names: Implementation and Specification (original MX definition)
- RFC 5321 — Simple Mail Transfer Protocol (SMTP; MX lookup process §5)
- RFC 7505 — A "Null MX" No Delivery Resource Record
- RFC 2181 — Clarifications to the DNS Specification (§10.3 — MX and CNAME)
- RFC 7208 — Sender Policy Framework (SPF) for Authorizing Use of Domains in Email
- RFC 6376 — DomainKeys Identified Mail (DKIM) Signatures
- RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (DMARC)
- RFC 8461 — SMTP MTA Strict Transport Security (MTA-STS)
