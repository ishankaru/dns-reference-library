# DNS-Based Blacklists (DNSBL)

A DNSBL (DNS-Based Blacklist, also called DNS Blocklist or RBL — Real-time Blacklist) is a list of IP addresses or domain names published via DNS. Clients query the DNSBL using a DNS lookup; the presence or absence of a record in the response indicates whether the queried entity appears on the list.

DNSBLs are the primary mechanism used by mail servers to identify and reject spam, though they are also used for malware C2 domain blocking, phishing site detection, and content filtering.

---

## How DNSBLs Work

### IP-Based Lookup (Most Common)

To check an IP address against a DNSBL, the octets of the IP are reversed and appended to the DNSBL's zone name as a subdomain. A DNS A record query is issued; the presence of a response indicates listing.

**Example:** Checking `192.0.2.1` against `zen.spamhaus.org`:

1. Reverse the IP octets: `1.2.0.192`
2. Append the zone: `1.2.0.192.zen.spamhaus.org`
3. Query for an A record at that name
4. If an A record is returned (typically `127.x.x.x`), the IP is listed
5. If NXDOMAIN is returned, the IP is not listed

**Response codes:** Most DNSBLs encode the listing reason in the returned A record. Different `127.x.x.x` values indicate different listing categories.

**Example (Spamhaus ZEN):**
- `127.0.0.2` — listed in SBL (Spamhaus Block List)
- `127.0.0.3` — listed in SBL CSS (Compromised Server Spam)
- `127.0.0.4`–`127.0.0.7` — listed in XBL (Exploits Block List)
- `127.0.0.10`–`127.0.0.11` — listed in PBL (Policy Block List, dynamic/residential IPs)

### Domain-Based Lookup (DNSBL-URI or URIBL)

URI blocklists check domain names found in message bodies (hyperlinks) rather than sending IPs. The domain is looked up directly against the DNSBL zone.

**Example:** Checking `malicious.example` against `dbl.spamhaus.org`:

1. Query: `malicious.example.dbl.spamhaus.org`
2. Response A record indicates listing reason

URI blocklists are used to catch spam that routes through clean IPs but links to listed domains.

---

## Major DNSBLs

### Spamhaus

Spamhaus is the most widely used DNSBL provider. It maintains several distinct lists:

**SBL (Spamhaus Block List)** — Manually curated list of IP addresses operated by spam senders, spam services, and spam support organizations. Listings are researched and maintained by Spamhaus staff.

**XBL (Exploits Block List)** — IP addresses of hijacked machines infected with malware (bots, trojans, worms) sending spam or hosting C2. Aggregates CBL (Composite Blocking List) data.

**PBL (Policy Block List)** — IP ranges designated by ISPs as end-user addresses not expected to send outbound SMTP directly. Listing on PBL is not a spam accusation — it reflects IP allocation type.

**DBL (Domain Block List)** — Domain names used in spam, phishing, and malware. URI-based lookup.

**ZEN (Combined List)** — Single query returning results from SBL, XBL, and PBL. Most mail servers use ZEN as their primary Spamhaus query.

**HELO/EHLO** — Domains used in invalid HELO strings.

### SORBS (Spam and Open Relay Blocking System)

SORBS maintains lists for open relays, open proxies, spam sources, and exploit-confirmed systems. SORBS has historically been criticized for aggressive listing policies, slow delisting, and paid delisting fees for some categories.

**Key zones:**
- `dnsbl.sorbs.net` — Combined zone
- `spam.dnsbl.sorbs.net` — Confirmed spam senders
- `http.dnsbl.sorbs.net` — Open HTTP proxies
- `socks.dnsbl.sorbs.net` — Open SOCKS proxies
- `zombie.dnsbl.sorbs.net` — Networks hijacked by botnets

### Barracuda Reputation Block List (BRBL)

Free for email filtering use. Lists IPs from which Barracuda Networks has directly observed spam. Lookup zone: `b.barracudacentral.org`.

Barracuda requires registration for high-volume querying and offers a commercial reputation service.

### SpamCop Blocking List (SCBL)

Operated by Cisco Talos (formerly by SpamCop). Based on spam trap hits and user spam reports. Known for aggressive, short-lived listings that expire quickly if spam activity stops. Zone: `bl.spamcop.net`.

### Passive Spam Block List (PSBL)

Community-operated. Simple listing policy based on spam trap hits. Zone: `psbl.surriel.com`.

### UCEPROTECT

Tiered system (levels 1–3) ranging from individual IP listings to entire ASes. Level 3 is controversial — it lists entire ASes for spam originating from any customer, making it too broad for most use cases. Zone: `dnsbl.uceprotect.net`.

---

## Integration in Mail Servers

### Postfix

```postfix
smtpd_recipient_restrictions =
    permit_mynetworks,
    reject_rbl_client zen.spamhaus.org,
    reject_rbl_client bl.spamcop.net,
    permit
```

### Exim

```exim
deny    dnslists = zen.spamhaus.org
        message  = Rejected: $sender_host_address listed in $dnslist_domain
```

### SpamAssassin

SpamAssassin uses DNSBL results as scoring inputs rather than hard blocks, allowing multiple signals to contribute to a composite spam score. Rules prefixed with `RCVD_IN_` check the relay chain; `URIBL_` rules check body links.

---

## Listing Procedures

### How IPs Get Listed

- **Spam trap hits:** DNSBLs operate email addresses (spam traps) that have never been used legitimately. Mail to these addresses is definitionally spam. Repetitive spam trap hits result in listing.
- **Spam reports:** Users or systems forward spam to the DNSBL operator for analysis.
- **Botnet/exploit detection:** The XBL and similar lists aggregate feeds from botnet monitoring, honeypots, and exploit databases.
- **ISP policy submission:** ISPs submit their dynamic/residential IP ranges to PBL voluntarily to prevent direct SMTP from those ranges.

### How IPs Get Delisted

Delisting procedures vary significantly by list:

- **Automatic expiry:** Some lists (SCBL, SpamCop) automatically expire listings if spam activity stops within a defined window (24–48 hours for SpamCop).
- **Self-service removal:** Spamhaus, Barracuda, and others offer web-based removal tools for IPs that have been remediated. The process involves verifying the source of spam has been addressed.
- **Manual review:** SBL listings require Spamhaus staff review. IPs listed for operating spam infrastructure are not removed until the underlying issue is resolved.
- **Paid delisting:** Some lists (historically SORBS) charged fees for expedited delisting. This practice is widely criticized as extortion-adjacent behavior.

---

## False Positives

False positives occur when legitimate senders are blocked due to DNSBL listing. Common causes:

**Shared IP ranges:** Hosting providers, email service providers, and cloud platforms assign IP addresses that may have previously sent spam. A new tenant inheriting a listed IP faces blocks immediately. You can [check your IP address](https://dnschkr.com/whats-my-ip-address) to identify which provider and ASN your outbound mail traffic originates from.

**IPv6 space:** Many DNSBLs have limited IPv6 coverage. Some default to blocking all IPv6 that has no forward-confirmed reverse DNS (FCrDNS), which can affect legitimate senders that have not set up PTR records.

**Overly broad listings:** Lists like UCEPROTECT Level 3 list entire ASes. Legitimate businesses using affected ISPs are blocked regardless of their own behavior.

**PBL mismatches:** IPs miscategorized as dynamic/residential that are actually used for mail server hosting.

**Remediation steps for senders:**
1. Identify which DNSBL has listed the IP using multi-DNSBL lookup tools (MXToolbox, Debouncer). You can also use an [IP geolocation lookup](https://dnschkr.com/ip-location) to check the IP's ASN and hosting context
2. Understand the listing reason from the DNSBL's lookup page
3. Remediate the underlying cause (remove malware, close open relay, stop spam)
4. Submit delisting request via the DNSBL's removal process
5. Monitor post-delisting for re-listing

---

## Operational Considerations for DNSBL Users

**Query volume and caching:** High-volume mail servers must cache DNSBL responses locally or use a local recursive resolver. Querying external DNSBL servers for every inbound message creates latency and may hit query rate limits. You can verify that your mail server's DNS records (SPF, DKIM, DMARC) are correctly configured using a [DNS record checker](https://dnschkr.com/dns-inspector).

**Spamhaus data plane subscription:** Spamhaus rate-limits public DNS queries. Organizations processing more than 100,000 queries per day should use the Spamhaus Data Query Service (DQS) — a subscription-based service with dedicated query infrastructure.

**Whitelisting:** Legitimate business partners, transactional mail providers, and internal systems should be whitelisted before enabling DNSBL checks to prevent false positive disruption.

**Monitoring:** DNSBL checks that incorrectly block mail are operationally invisible without logging. Mail logs should record DNSBL rejection reasons for diagnosis.

**Multiple lists:** Using multiple DNSBLs additively (reject if listed on any) is more aggressive than scoring (reject only if score exceeds threshold). SpamAssassin's weighted approach is appropriate where false positive risk is a concern.

---

## References

- RFC 5782 — DNS Blacklists and Whitelists
- Spamhaus DNSBL documentation: https://www.spamhaus.org/faq/section/DNSBL%20Usage
- Spamhaus ZEN zone description: https://www.spamhaus.org/zen/
- Barracuda Central lookup: https://www.barracudacentral.org/lookups
- SpamCop help: https://www.spamcop.net/fom-serve/cache/291.html
- MXToolbox Blacklist Check: https://mxtoolbox.com/blacklists.aspx
- Postfix DNSBL configuration: https://www.postfix.org/postconf.5.html#smtpd_recipient_restrictions
- CAIDA AS Rank (for AS-level reputation context): https://asrank.caida.org/
