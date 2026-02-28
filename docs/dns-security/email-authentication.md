# Email Authentication: SPF, DKIM, DMARC, and BIMI

Email authentication is a set of DNS-based protocols that allow domain owners to specify which mail infrastructure is authorized to send on their behalf and how receivers should handle messages that fail authentication. Together, SPF, DKIM, DMARC, and BIMI form a layered system for combating spoofing, phishing, and brand impersonation.

---

## SPF — Sender Policy Framework (RFC 7208)

SPF allows a domain owner to publish a list of IP addresses authorized to send mail claiming to be from that domain. Receiving mail servers check this list during the SMTP session.

### How SPF Works

1. The sending server connects to the receiving server and presents a MAIL FROM address (envelope from, also called the return-path).
2. The receiving server extracts the domain from the envelope from address.
3. It queries DNS for a TXT record at that domain.
4. It evaluates the SPF record against the connecting IP address.
5. The result (pass, fail, softfail, neutral, none, temperror, permerror) is passed to the mail handling system.

SPF checks the **envelope from** (MAIL FROM), not the From header visible to the recipient. This is a critical distinction — SPF passing does not mean the visible From address is authentic.

### SPF Record Syntax

An SPF record is a TXT record at the domain's apex. You can verify your SPF, DKIM, and DMARC records using a [DNS record lookup tool](https://dnschkr.com/dns-inspector) to query TXT records for any domain:

```
v=spf1 ip4:192.0.2.0/24 ip6:2001:db8::/32 include:_spf.google.com -all
```

**Mechanisms:**
- `ip4:` — IPv4 address or CIDR range
- `ip6:` — IPv6 address or CIDR range
- `a` — A records of the domain
- `mx` — MX records of the domain
- `include:domain` — Include another domain's SPF policy
- `ptr` — PTR lookup (deprecated, avoid)
- `exists:` — Custom per-IP policy (rare)

**Qualifiers (prefix to mechanism):**
- `+` (default) — Pass
- `-` — Fail (hard fail)
- `~` — Softfail (accept but mark)
- `?` — Neutral (no policy statement)

**The `all` mechanism:** Must appear last. `-all` means reject all unlisted senders. `~all` means softfail unlisted senders (common during migration). `+all` negates the policy entirely and should never be used.

**Modifiers:**
- `redirect=domain` — Replace entire policy with another domain's SPF record
- `exp=domain` — Human-readable explanation for failures

### SPF Limitations

**DNS lookup limit:** SPF evaluates a maximum of 10 DNS lookups (for mechanisms like `include:`, `a`, `mx`). Exceeding this limit produces a permerror. Complex policies with many includes frequently hit this limit. SPF flattening (replacing includes with raw IPs) is a common workaround but creates maintenance burden.

**Forwarding breaks SPF:** When mail is forwarded, the forwarding server's IP is not in the original sender's SPF record. SPF fails for forwarded mail. DMARC's alignment model, SRS (Sender Rewriting Scheme), and ARC (Authenticated Received Chain) address this.

**Envelope vs. header:** SPF validates the envelope from, not the header from. A spoofed From header can pass SPF if the envelope domain has a valid SPF record.

---

## DKIM — DomainKeys Identified Mail (RFC 6376)

DKIM adds a cryptographic signature to outgoing messages. The signature is inserted as a header and can be verified by receivers using the public key published in DNS. Unlike SPF, DKIM survives forwarding because it signs the message itself, not the transmission path.

### How DKIM Works

1. The sending mail server generates an RSA or Ed25519 signature over a canonical form of specified message headers and the message body.
2. The signature is inserted as a `DKIM-Signature` header in the message.
3. The receiving server extracts the signing domain (`d=`) and selector (`s=`) from the DKIM-Signature header.
4. It queries DNS for the public key: `<selector>._domainkey.<domain>` TXT record.
5. It verifies the signature against the public key.
6. If verification passes, the message is confirmed to originate from a server with access to the corresponding private key for that domain.

### DKIM-Signature Header

```
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
    d=example.com; s=mail2024;
    h=from:to:subject:date:message-id:content-type;
    bh=base64bodyhash==;
    b=base64signature==
```

**Key fields:**
- `a=` — Algorithm (rsa-sha256, ed25519-sha256)
- `c=` — Canonicalization (relaxed/relaxed is standard; simple/simple is strict)
- `d=` — Signing domain
- `s=` — Selector (allows multiple keys per domain)
- `h=` — Headers included in signature
- `bh=` — Body hash
- `b=` — Signature value

### DNS DKIM Record

```
mail2024._domainkey.example.com.  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."
```

**Fields:**
- `v=DKIM1` — Version
- `k=` — Key type (rsa, ed25519)
- `p=` — Base64-encoded public key
- `t=s` — Testing mode (receivers should not reject based on signature failure)
- `t=y` — Subdomaining restricted

### Selectors

Selectors allow a domain to publish multiple DKIM keys simultaneously. This enables key rotation without downtime: publish the new key under a new selector, update the signing configuration, then retire the old selector after the old messages have moved through delivery queues.

Selectors also allow different services to sign with different keys. `google._domainkey` for Google Workspace, `smtp._domainkey` for an SMTP relay, etc.

### Key Rotation Best Practices

- Rotate DKIM keys at least annually; quarterly for high-value domains
- Use 2048-bit RSA or Ed25519
- Keep retired selector DNS records live for 48 hours after stopping use (to allow in-transit messages to verify)
- Never reuse selectors

---

## DMARC — Domain-based Message Authentication, Reporting and Conformance (RFC 7489)

DMARC builds on SPF and DKIM by adding alignment requirements and a policy that instructs receivers how to handle failing messages. It also introduces a reporting mechanism that allows domain owners to receive data about who is sending mail claiming to be from their domain.

### DMARC Alignment

DMARC introduces the concept of **identifier alignment**: the domain used in SPF and/or DKIM must align with the RFC 5322 From header domain (the "organizational domain"). This closes the loophole where SPF or DKIM pass for a different domain than what the user sees in their mail client.

**SPF alignment:** The envelope from domain must match the From header domain.
**DKIM alignment:** The `d=` value in the DKIM-Signature must match the From header domain.

Alignment can be:
- **Strict** (`aspf=s`, `adkim=s`) — Exact domain match required
- **Relaxed** (`aspf=r`, `adkim=r`) — Organizational domain match (default). `mail.example.com` aligns with `example.com` under relaxed.

A DMARC pass requires that at least one authentication mechanism (SPF or DKIM) passes AND aligns.

### DMARC Record Syntax

Published as a TXT record at `_dmarc.<domain>`:

```
_dmarc.example.com.  TXT  "v=DMARC1; p=reject; sp=reject; rua=mailto:dmarc-agg@example.com; ruf=mailto:dmarc-forensic@example.com; pct=100; adkim=r; aspf=r"
```

**Policy tags:**
- `p=` — Policy for the domain: `none` (monitor only), `quarantine` (spam folder), `reject` (refuse delivery)
- `sp=` — Subdomain policy (defaults to `p=` if omitted)
- `pct=` — Percentage of messages to apply policy to (1–100). Used for gradual rollout.
- `adkim=` — DKIM alignment mode (r=relaxed, s=strict)
- `aspf=` — SPF alignment mode

**Reporting tags:**
- `rua=` — Aggregate report destination (mailto: URI, typically processed by a DMARC analytics service)
- `ruf=` — Forensic (failure) report destination (individual failing message data)
- `fo=` — Forensic report options: `0` (report if all mechanisms fail), `1` (report if any mechanism fails), `d` (DKIM failure only), `s` (SPF failure only)
- `ri=` — Reporting interval in seconds (default 86400 — daily)

### DMARC Policy Rollout Sequence

Organizations should not jump directly to `p=reject` without monitoring. The standard rollout:

1. `p=none; rua=mailto:...` — Monitor for 2–4 weeks. Review aggregate reports to identify all legitimate sending sources.
2. `p=quarantine; pct=10` — Apply quarantine policy to 10% of failing messages. Increase pct gradually.
3. `p=quarantine; pct=100` — Full quarantine. Monitor for false positives.
4. `p=reject; pct=100` — Full reject. Receivers refuse DMARC-failing messages.

### Aggregate Reports (rua)

Aggregate reports are XML documents sent (typically daily) by participating receivers. They contain:
- Total message counts by result
- Source IP addresses
- Authentication results (SPF, DKIM, DMARC)
- Disposition applied

Aggregate reports are informational, not PII-sensitive, and are appropriate for archiving and trend analysis.

### Forensic Reports (ruf)

Forensic reports contain data about individual failing messages, potentially including headers and message excerpts. Due to privacy concerns, many receivers have stopped sending forensic reports. They are useful for diagnosing specific failures but cannot be relied upon as a complete failure feed.

### DMARC and Mailing Lists

Mailing list software typically modifies message bodies (adding footers) and sometimes alters From headers, breaking DKIM signatures. This causes DMARC failures for list-distributed mail from domains with `p=reject`. The email industry addressed this via:
- **ARC (Authenticated Received Chain, RFC 8617):** Preserves authentication results across hops. Mailing list software stamps an ARC seal; downstream receivers can evaluate the chain.
- **List munging:** Some lists rewrite From to the list address, which avoids DMARC failures but breaks reply-to behavior.

---

## BIMI — Brand Indicators for Message Identification

BIMI is a standard that allows domain owners to publish a verified logo in DNS, which participating mail clients display alongside authenticated messages. It extends DMARC to the UI layer.

### Requirements

1. The domain must have a DMARC policy of `p=quarantine` or `p=reject` (not `p=none`)
2. A VMC (Verified Mark Certificate) issued by an authorized certificate authority (DigiCert or Entrust as of 2026) is required for full support in major clients
3. The logo must be in SVG format (Tiny P/S profile) hosted at an HTTPS URL

### BIMI Record

Published at `default._bimi.<domain>`:

```
default._bimi.example.com.  TXT  "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/bimi.pem"
```

- `l=` — URL to the SVG logo
- `a=` — URL to the VMC (Authority Evidence Location)

### Client Support (as of 2026)

Gmail, Yahoo Mail, Fastmail, Apple Mail (partial), and several other clients support BIMI with VMC. Microsoft Outlook/Exchange 365 has its own logo system (BIMI-compatible in some configurations).

---

## Authentication Chain Summary

| Protocol | What It Validates | Where It Checks | Survives Forwarding |
|----------|------------------|-----------------|---------------------|
| SPF | Sending IP authorization | Envelope From domain | No |
| DKIM | Message signature | From header domain (via d= alignment) | Yes |
| DMARC | Alignment + policy | From header domain | Depends on ARC |
| BIMI | Logo display | From header domain | N/A |

A properly deployed email authentication stack requires all three (SPF, DKIM, DMARC) to be effective. DMARC without DKIM relies on SPF, which breaks on forwarding. DKIM without DMARC provides integrity but no policy enforcement. After configuring these records, use a [DNS propagation checker](https://dnschkr.com/dns-propagation-checker) to verify they are visible from resolvers worldwide before relying on them for enforcement.

---

## References

- RFC 7208 — Sender Policy Framework (SPF) for Authorizing Use of Domains in Email
- RFC 6376 — DomainKeys Identified Mail (DKIM) Signatures
- RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (DMARC)
- RFC 8617 — The Authenticated Received Chain (ARC) Protocol
- RFC 8463 — A New Cryptographic Signature Method for DomainKeys Identified Mail (DKIM) using Ed25519
- BIMI Group specification: https://bimigroup.org/specification/
- M3AAWG DMARC Deployment Guide: https://www.m3aawg.org/published-documents
- Google Postmaster Tools: https://postmaster.google.com/
- Real-world email authentication adoption data across millions of domains: [DNS security findings dashboard](https://dnschkr.com/security)
- DMARC.org: https://dmarc.org/
