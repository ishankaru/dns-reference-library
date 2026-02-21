# DNS Issues Affecting Email Delivery

## Overview

Email delivery depends on multiple DNS record types working together correctly. A failure in any layer — MX records for routing, SPF for sender authorization, DKIM for message signing, or DMARC for policy enforcement — can result in messages being rejected, quarantined, or silently dropped.

This document covers the most common DNS-related email failures and how to diagnose them. You can verify MX, SPF, DKIM, and DMARC records for any domain using the [DNS record inspector](https://dnschkr.com/dns-inspector).

## MX Records

### How MX Records Work

The MX (Mail Exchanger) record specifies which servers accept inbound email for a domain. When another mail server sends to `user@example.com`, it:

1. Queries the MX records for `example.com`.
2. Connects to the mail server with the lowest priority value.
3. Delivers the message via SMTP.

An MX record has two fields: priority (integer) and exchange (hostname):

```
example.com.   3600   IN   MX   10   mail1.example.com.
example.com.   3600   IN   MX   20   mail2.example.com.
```

Lower priority number = higher preference. Servers with equal priority are used in round-robin.

### Common MX Problems

**Missing MX record:** If no MX record exists, some sending servers fall back to attempting delivery to the A record of the domain itself. This is permitted by RFC 5321 but unreliable. Most modern senders reject or defer with no MX record.

```bash
dig MX example.com +short
# If empty: no MX configured
```

**MX pointing to a CNAME:** RFC 2181 prohibits MX records from pointing to a CNAME target. The MX exchange value must resolve to an A/AAAA record directly. This configuration causes delivery failures with many sending servers.

```
; WRONG — MX pointing to CNAME
example.com.   IN   MX   10   mail.mailprovider.com.
mail.mailprovider.com.   IN   CNAME   mailcluster.internal.

; CORRECT — MX pointing to hostname with direct A record
example.com.   IN   MX   10   mx.mailprovider.com.
mx.mailprovider.com.   IN   A   1.2.3.4
```

**Lowest priority server offline:** If the highest-priority MX server (lowest number) is unreachable, sending servers wait for the delivery timeout (typically 24–72 hours, retrying throughout) before trying the next priority. Verify all listed MX servers are reachable on TCP port 25.

**MX records not updated after migration:** When migrating to a new mail provider, the old MX records must be replaced. If old and new both exist with different priorities, mail may split between both systems.

### Verifying MX Records

```bash
# Current MX records from cached resolver
dig MX example.com

# Direct query to authoritative server (bypasses cache)
dig MX example.com @ns1.example.com

# Verify MX resolves to an A record (not CNAME)
dig A $(dig MX example.com +short | awk '{print $2}')

# Test SMTP connectivity to the MX host
telnet mail.example.com 25
# or
openssl s_client -connect mail.example.com:587 -starttls smtp
```

## SPF Records

### What SPF Does

SPF (Sender Policy Framework) specifies which IP addresses are authorized to send email claiming to be from a domain. Receiving servers check the SPF record of the envelope sender domain to decide whether to accept the message.

SPF is a TXT record at the domain apex:

```
example.com.   3600   IN   TXT   "v=spf1 include:_spf.google.com ip4:203.0.113.0/24 -all"
```

### Common SPF Problems

**Syntax errors:** SPF has strict syntax. Common mistakes:

```
; WRONG — missing v=spf1 prefix
"spf1 include:_spf.google.com -all"

; WRONG — multiple SPF TXT records (only one v=spf1 record allowed)
"v=spf1 include:mailprovider1.com ~all"
"v=spf1 include:mailprovider2.com ~all"

; CORRECT — merge into a single record
"v=spf1 include:mailprovider1.com include:mailprovider2.com ~all"
```

Multiple `v=spf1` TXT records on the same domain causes a permanent error (PermError) which is treated as a policy failure by most receivers.

**DNS lookup limit exceeded:** SPF evaluation is limited to 10 DNS lookups per evaluation (RFC 7208). Each `include:`, `a:`, `mx:`, and `redirect=` mechanism costs one lookup. Complex SPF records with many includes can exceed this limit, causing PermError.

```bash
# Audit SPF lookup count
dig TXT example.com +short | grep spf
# Then trace each include: recursively
```

Tools for SPF flattening and lookup counting:
- https://mxtoolbox.com/spf.aspx
- https://www.spf-record.de/

**Overly permissive `-all` vs `~all` vs `?all`:**
- `-all` (fail): reject messages from unauthorized senders. Strictest.
- `~all` (softfail): tag messages as suspicious but deliver. Common during testing.
- `?all` (neutral): no policy. Equivalent to no SPF for most receivers.
- `+all` (pass all): authorizes all senders; effectively disables SPF.

## DKIM Records

### What DKIM Does

DKIM (DomainKeys Identified Mail) signs outgoing messages with a private key. The corresponding public key is published as a TXT record under a selector subdomain. Receiving servers retrieve the public key and verify the message signature.

DKIM public key record format:

```
selector._domainkey.example.com.   TXT   "v=DKIM1; k=rsa; p=MIGfMA0GCSqGS..."
```

### Common DKIM Problems

**Wrong or missing selector:** Each DKIM signature in a message header references a specific selector. If the selector does not exist in DNS, the signature cannot be verified and DKIM fails.

```bash
# Check a specific selector (e.g., "google" is Google Workspace's default selector)
dig TXT google._domainkey.example.com

# Extract selector from a message header
# The DKIM-Signature header contains s=<selector>; d=<domain>
```

**Key rotation not completed:** When rotating DKIM keys, the new public key must be published in DNS before the mail servers start signing with the new private key. If signing begins before the DNS record propagates, messages will fail DKIM verification. Use the [DNS propagation checker](https://dnschkr.com/propagation-checker) to confirm the new TXT record is visible globally before switching signing keys.

Safe key rotation procedure:
1. Generate new key pair.
2. Publish new public key under a new selector name.
3. Wait for DNS propagation (TTL of the DKIM record).
4. Configure mail server to sign with new private key using new selector.
5. After 1–2 weeks (to allow old messages in transit to clear), remove the old selector record.

**Key too short or wrong format:**

Per RFC 8301, DKIM keys shorter than 1024 bits should be treated as failing. Keys shorter than 2048 bits are deprecated for new deployments. Most modern mail providers use 2048-bit or 4096-bit RSA keys, or Ed25519.

```bash
# Retrieve and inspect public key
dig TXT selector._domainkey.example.com +short
# p= field is the base64-encoded public key
```

**TXT record too long for a single string:** RSA 2048-bit keys encoded in base64 exceed the 255-character limit for a single DNS TXT string. The record must be split into multiple quoted strings within the same TXT record:

```
selector._domainkey.example.com.   TXT   "v=DKIM1; k=rsa; p=MIIBIjANBgkq"
                                         "hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE"
                                         "A...rest-of-key..."
```

DNS resolvers concatenate adjacent quoted strings automatically. Misconfigured systems that put this in a single >255-char string cause DKIM parsing failures.

## DMARC Records

### What DMARC Does

DMARC (Domain-based Message Authentication, Reporting and Conformance) builds on SPF and DKIM. It tells receiving servers what to do when SPF or DKIM fails, and where to send reports.

DMARC is a TXT record at `_dmarc.<domain>`:

```
_dmarc.example.com.   TXT   "v=DMARC1; p=reject; rua=mailto:dmarc@example.com; pct=100"
```

Key tags:
- `p=` — policy: `none` (monitor only), `quarantine`, or `reject`
- `rua=` — aggregate report destination
- `ruf=` — forensic report destination
- `pct=` — percentage of messages to apply policy to (1–100)
- `adkim=` — DKIM alignment: `r` (relaxed) or `s` (strict)
- `aspf=` — SPF alignment: `r` (relaxed) or `s` (strict)

### Common DMARC Problems

**SPF/DKIM alignment failure:** DMARC requires that either SPF or DKIM passes AND the domain is aligned with the `From:` header domain.

- SPF alignment: the `MAIL FROM` (envelope sender) domain must match the `From:` header domain.
- DKIM alignment: the `d=` value in the DKIM signature must match the `From:` header domain.

If a third-party sending service (e.g., Mailchimp, Zendesk) sends on behalf of your domain but the message goes through their infrastructure, SPF alignment fails because their IP is not in your SPF record. The solution is to either add their sending IPs/includes to your SPF record or configure DKIM signing with your domain's key via their platform.

**`p=reject` before SPF/DKIM are confirmed working:** Setting `p=reject` before thoroughly validating that all outbound mail is correctly signed and authorized will cause legitimate mail to be rejected. Start with `p=none`, monitor DMARC reports for 2–4 weeks, then move to `p=quarantine`, then `p=reject`.

## Email Provider Migration Scenarios

### Migrating to Google Workspace (formerly G Suite)

1. Add Google's MX records (replacing existing ones):
   ```
   @ MX 1  aspmx.l.google.com.
   @ MX 5  alt1.aspmx.l.google.com.
   @ MX 5  alt2.aspmx.l.google.com.
   @ MX 10 alt3.aspmx.l.google.com.
   @ MX 10 alt4.aspmx.l.google.com.
   ```
2. Add SPF: `"v=spf1 include:_spf.google.com ~all"`
3. Generate DKIM key in Google Admin console; add the TXT record under `google._domainkey`.
4. Add DMARC: start with `p=none`.
5. Verify using Google's domain verification TXT record.

### Migrating to Microsoft 365 (Exchange Online)

1. Replace MX records with `<tenant>.mail.protection.outlook.com` (priority 0 or 10).
2. SPF: `"v=spf1 include:spf.protection.outlook.com -all"`
3. DKIM: Enable in Microsoft 365 Defender; Microsoft publishes the key automatically under `selector1._domainkey` and `selector2._domainkey`.
4. DMARC: Add `_dmarc` record separately — Microsoft does not add it automatically.

## Diagnostic Commands

```bash
# Check all email-related DNS records at once
dig MX example.com +short
dig TXT example.com +short | grep spf
dig TXT google._domainkey.example.com +short
dig TXT _dmarc.example.com +short

# Test SMTP connection to MX
telnet $(dig MX example.com +short | sort -n | head -1 | awk '{print $2}') 25

# Check SPF for a sending IP using nslookup
nslookup -type=txt example.com
```

Online tools for comprehensive email DNS validation:
- [dnschkr DNS inspector](https://dnschkr.com/dns-inspector) — look up MX, TXT (SPF/DKIM/DMARC), and all other record types
- https://mxtoolbox.com/SuperTool.aspx
- https://mail-tester.com/
- https://dmarcian.com/dmarc-inspector/
- https://toolbox.googleapps.com/apps/checkmx/

## References

- RFC 5321 — Simple Mail Transfer Protocol (MX usage): https://www.rfc-editor.org/rfc/rfc5321
- RFC 7208 — Sender Policy Framework (SPF): https://www.rfc-editor.org/rfc/rfc7208
- RFC 6376 — DomainKeys Identified Mail (DKIM): https://www.rfc-editor.org/rfc/rfc6376
- RFC 8301 — DKIM Key Size Deprecation: https://www.rfc-editor.org/rfc/rfc8301
- RFC 7489 — DMARC: https://www.rfc-editor.org/rfc/rfc7489
- RFC 2181 — Clarifications to DNS Specification (no CNAME at MX): https://www.rfc-editor.org/rfc/rfc2181
