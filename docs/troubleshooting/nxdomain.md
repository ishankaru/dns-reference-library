# NXDOMAIN: Non-Existent Domain

## What NXDOMAIN Means

NXDOMAIN is DNS response code 3 (RCODE 3). It means the queried domain name does not exist in the DNS namespace — no zone is authoritative for that name, or the authoritative zone explicitly confirms the name has no records of any type.

The authoritative nameserver for the zone returns NXDOMAIN. The recursive resolver then caches and forwards this negative response to the client. For a comprehensive explanation of what triggers this response and how to handle it, see [what is NXDOMAIN](https://dnschkr.com/blog/what-is-nxdomain).

Raw dig output for an NXDOMAIN:

```
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 54321
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 0

;; AUTHORITY SECTION:
example.com.   3600   IN   SOA   ns1.example.com. admin.example.com. ...
```

The SOA in the AUTHORITY section is the negative proof: it comes from the zone that is authoritative for the name, confirming the name does not exist.

## NXDOMAIN vs NOERROR with Empty Answer

These are two different negative responses and the distinction matters:

### NXDOMAIN (RCODE 3)

The queried name does not exist at all. No records of any type exist for this name in the zone.

```bash
dig A nonexistent.example.com
# status: NXDOMAIN
```

### NOERROR with Empty Answer Section

The queried name exists (there are records for it) but not of the requested type. The name is real, the record type is absent.

```bash
dig AAAA ipv4only.example.com
# status: NOERROR
# ANSWER: 0     (no AAAA record)
# AUTHORITY: 1  (SOA proving no AAAA exists)
```

This distinction is important when debugging:
- NXDOMAIN: the name itself is wrong or the domain does not exist.
- NOERROR/empty: the name is correct but the specific record type is missing.

## Common Causes of NXDOMAIN

### 1. Typographical Error

The most frequent cause. A single character difference (transposition, wrong TLD, missing hyphen) produces a completely different name in DNS.

```bash
dig A gogle.com       # NXDOMAIN — not google.com
dig A example.cmo     # NXDOMAIN — wrong TLD
dig A my-domain.net   # potentially NXDOMAIN if hyphen wrong
```

Always verify the exact domain string being queried before assuming a DNS problem. The [DNS inspector](https://dnschkr.com/dns-inspector) lets you check any domain's records instantly to confirm whether the name resolves.

### 2. Expired Domain

Domain registrations have an expiration date. After expiration, the registrar moves the domain through grace periods:

| Phase | Duration | State |
|---|---|---|
| Auto-renewal grace period | 0–45 days post-expiry | EPP status `autoRenewPeriod`; domain may still resolve |
| Redemption grace period | 30 days after deletion | EPP status `redemptionPeriod`; domain deleted from registry zone; NXDOMAIN |
| Pending delete | 5 days | EPP status `pendingDelete`; NXDOMAIN |
| Available | After pending delete | Can be re-registered by anyone |

Once a domain enters the redemption period, its NS records are removed from the TLD zone and it returns NXDOMAIN. The original registrant can still recover the domain (for a redemption fee, typically $50–$200), but must act before the pending delete period ends.

### 3. Missing Record (Not Missing Domain)

A common confusion: the domain exists but the specific hostname has no records. If `example.com` exists but `mail.example.com` has no A record, querying `mail.example.com` returns NXDOMAIN if there is no wildcard or CNAME covering it.

```bash
dig A mail.example.com    # NXDOMAIN — subdomain not configured
dig A example.com         # NOERROR — apex exists
```

Check whether the parent zone exists:

```bash
dig SOA example.com       # If this returns NOERROR, the zone exists
dig A mail.example.com    # If NXDOMAIN, the subdomain record is just missing
```

### 4. DNS Hosting Zone Not Created

A domain may be registered and delegated to a DNS provider's nameservers, but if the zone has not been created on the DNS provider's side, all queries return NXDOMAIN (or SERVFAIL/REFUSED depending on how the provider handles missing zones).

This is a common issue when:
- Setting up a new domain with a managed DNS provider.
- Migrating nameservers to a new provider before creating the zone.
- Accidentally deleting the zone on the provider.

Verification:

```bash
# Query the authoritative nameservers directly
dig A example.com @ns1.dnsprovider.com
# If REFUSED or SERVFAIL: zone not created
# If NXDOMAIN: zone exists but record not added
```

### 5. NXDOMAIN Hijacking by ISPs and Resolvers

Some ISPs and public resolvers intercept NXDOMAIN responses and redirect the client to a search page or advertising portal. Instead of returning a proper NXDOMAIN, they return a synthetic A record pointing to their own servers.

This practice is sometimes called DNS hijacking, NXDOMAIN redirection, or "Infosys DNS search."

Affected ISPs have included:
- Comcast (returns a search redirect for mistyped domains)
- AT&T (similar behavior)
- Various national ISPs in countries with government-mandated filtering

Detection:

```bash
# A legitimate NXDOMAIN returns no A records
# If you get an A record for a clearly non-existent name, hijacking is occurring
dig A definitlynotreal12345.com @your-isp-resolver

# Compare with a known-clean resolver
dig A definitlynotreal12345.com @1.1.1.1
```

NXDOMAIN hijacking breaks applications that rely on NXDOMAIN as a negative signal and can interfere with DNS-based software updates, search-as-you-type domain lookups, and split-horizon DNS configurations.

To avoid hijacking: use a resolver that returns honest NXDOMAIN — Cloudflare 1.1.1.1, Google 8.8.8.8, and Quad9 9.9.9.9 do not hijack NXDOMAIN responses. You can also [check DNS propagation](https://dnschkr.com/dns-propagation-checker) across multiple resolvers simultaneously to detect inconsistent responses that may indicate hijacking.

## Debugging NXDOMAIN

### Step 1: Verify the queried name

Before any DNS investigation, confirm the exact string being queried. Many "DNS failures" are simply typos in the domain name.

### Step 2: Check if the TLD exists

```bash
dig NS com @a.root-servers.net +norecurse   # .com TLD exists
dig NS cmo @a.root-servers.net +norecurse   # .cmo TLD: NXDOMAIN
```

### Step 3: Check if the SLD is delegated

```bash
# Query the TLD nameserver for the domain's NS records
dig NS example.com @a.gtld-servers.net +norecurse
# NXDOMAIN here means the domain is not registered
# NOERROR with NS records means it exists
```

### Step 4: Check if the specific record exists

```bash
# Query the authoritative nameserver directly
dig A www.example.com @ns1.example.com
```

### Step 5: Check domain registration status

```bash
whois example.com                           # Check expiration date
# Or use RDAP:
curl https://rdap.verisign.com/com/v1/domain/example.com
```

## References

- RFC 1035 — DNS Response Codes (NXDOMAIN = RCODE 3): https://www.rfc-editor.org/rfc/rfc1035
- RFC 2308 — Negative Caching of DNS Queries: https://www.rfc-editor.org/rfc/rfc2308
- RFC 5731 — EPP Domain Name Mapping (domain status codes): https://www.rfc-editor.org/rfc/rfc5731
- ICANN RAA 2013 — Expired domain grace periods: https://www.icann.org/resources/pages/accreditation-2012-02-25-en
- SSAC SAC 036 — NXDOMAIN Substitution Considered Harmful: https://www.icann.org/groups/ssac/documents/sac-036-en.pdf
