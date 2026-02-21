# IANA Root Zone Database

## What It Is

The IANA Root Zone Database is the authoritative registry of all top-level domains. It is maintained by the Internet Assigned Numbers Authority (IANA), a function operated by ICANN under contract with the U.S. Department of Commerce (historically) and now under the Post-IANA Stewardship Transition frameworks established in 2016.

Every TLD that can be resolved on the public internet has an entry in the root zone database. If a string is not listed there, it does not exist in the global DNS. A searchable version with zone analytics and provider data is available in the [dnschkr TLD directory](https://dnschkr.com/tlds).

The database is publicly accessible at: https://www.iana.org/domains/root/db

## What the Database Contains

Each entry in the root zone database corresponds to a single TLD and includes:

### TLD String

The ASCII label of the TLD, including Punycode-encoded IDN TLDs (e.g., `xn--h2brj9c8c` for `.भारत`). The IANA database lists the ACE form; the display form is decoded separately.

### TLD Type

One of:
- `country-code` — two-letter ccTLD corresponding to ISO 3166-1
- `generic` — general-purpose gTLD
- `generic-restricted` — gTLD with eligibility restrictions (legacy category, now rarely used)
- `sponsored` — gTLD operated by a sponsoring community organization
- `infrastructure` — `.arpa` only
- `test` — used for standards testing (e.g., `.test`, `.example`)

### Registry Operator

The name of the organization responsible for operating the TLD. This may be a company name, a government agency, or an individual for some small ccTLDs. For gTLDs, this is the entity that signed the Registry Agreement with ICANN.

Examples:
- `.com` — VeriSign Global Registry Services
- `.org` — Public Interest Registry
- `.de` — DENIC eG
- `.app` — Charleston Road Registry Inc. (Google subsidiary)

### Administrative Contact

The administrative point of contact for the TLD delegation. Typically an individual or role at the registry operator organization. Contact details are listed for accountability purposes.

### Technical Contact

The technical point of contact responsible for nameserver operations and zone maintenance. May be the same as the administrative contact for smaller registries.

### WHOIS Server

The hostname of the registry's port-43 WHOIS server. Queries to this server return registration data for domains under the TLD.

Format example:
```
whois.verisign-grs.com       (for .com)
whois.nic.google             (for .google)
whois.denic.de               (for .de)
```

Not all TLDs have a WHOIS server listed. Some ccTLDs redirect to a national WHOIS system. As of 2023, WHOIS is being superseded by RDAP (see below).

### RDAP Server

The base URL of the registry's RDAP service. RDAP (Registration Data Access Protocol) is the modern replacement for port-43 WHOIS, returning structured JSON data rather than free-form text.

Format example:
```
https://rdap.verisign.com/com/v1/
https://rdap.nic.google/
https://rdap.denic.de/
```

IANA also maintains a bootstrap registry for RDAP at: https://data.iana.org/rdap/

### Nameservers

The authoritative nameservers for the TLD zone. These are the servers that root nameservers delegate to for queries under this TLD.

Example for `.com`:
```
a.gtld-servers.net
b.gtld-servers.net
c.gtld-servers.net
... (through m.gtld-servers.net)
```

Example for `.de`:
```
a.nic.de
f.nic.de
l.nic.de
n.nic.de
s.nic.de
z.nic.de
```

The number of nameservers per TLD varies. ICANN's Registry Agreement requires gTLDs to maintain at least 2 nameservers in geographically and topologically diverse locations. The root zone itself lists both the NS records and any required glue records (A/AAAA) for nameservers whose names fall within the delegated zone.

### DNSSEC DS Records

If the TLD is signed with DNSSEC, the root zone contains DS (Delegation Signer) records for the TLD's KSK (Key Signing Key). The root zone database entry links to the published DS record data.

As of early 2026, the vast majority of gTLDs are DNSSEC-signed. ccTLD adoption varies significantly by country. The [DNS rankings hub](https://dnschkr.com/rankings) tracks DNSSEC adoption rates and other security metrics across all TLDs.

## How to Access the Database

### Web Interface

The primary interface is at https://www.iana.org/domains/root/db — searchable by TLD string, browsable alphabetically.

Each TLD has a dedicated page at:
```
https://www.iana.org/domains/root/db/<tld>.html
```

Example:
```
https://www.iana.org/domains/root/db/com.html
https://www.iana.org/domains/root/db/de.html
https://www.iana.org/domains/root/db/xn--h2brj9c8c.html
```

### Zone File Download

The actual root zone file (containing all NS and glue records) is published by Verisign and available for download at:
```
https://www.internic.net/domain/root.zone
```

This is a standard DNS zone file format. It is updated typically twice per day. The file is approximately 2MB and contains entries for all ~1,500 TLDs.

### IANA WHOIS

IANA operates a WHOIS service for the root zone at:
```
whois.iana.org (port 43)
```

Query:
```
whois -h whois.iana.org .com
```

This returns the full IANA database record for the TLD including registry, contacts, nameservers, and WHOIS/RDAP pointers. You can also [inspect DNS records](https://dnschkr.com/dns-inspector) for any domain to see its full delegation chain in a visual interface.

## Root Zone Management Chain

The root zone is managed through a three-party chain:

### 1. IANA (ICANN)

IANA receives and evaluates requests to add, modify, or remove TLD delegations. Sources of requests:
- ICANN's New gTLD Program (for new gTLDs)
- National governments or NIRs (for ccTLD delegation changes)
- Registry operators (for nameserver or contact updates)

IANA validates the request against policy, verifies authorization, and approves the change.

### 2. ICANN Approves

For TLD-level changes (new delegations, transfers), ICANN's Board or designated staff must authorize the change. Routine updates (nameserver changes, contact updates) follow a streamlined process.

### 3. Verisign Publishes

Verisign, under its Cooperative Agreement with the U.S. National Telecommunications and Information Administration (NTIA) and its contract with ICANN, is the root zone maintainer. It receives the change from IANA, incorporates it into the root zone file, signs the updated zone with DNSSEC, and distributes it to the 13 root server operators.

The root zone is signed with the Root Zone DNSSEC Key Signing Key (KSK), managed by ICANN using an HSM (Hardware Security Module) maintained in two geographically separate key ceremonies.

### Root Server Distribution

The 13 root server designations (A through M) are operated by 12 independent organizations:

| Letter | Operator |
|---|---|
| A | Verisign |
| B | USC-ISI |
| C | Cogent Communications |
| D | University of Maryland |
| E | NASA Ames Research Center |
| F | Internet Systems Consortium |
| G | US Department of Defense |
| H | US Army Research Lab |
| I | Netnod |
| J | Verisign |
| K | RIPE NCC |
| L | ICANN |
| M | WIDE Project |

Each of these 13 designations is served by anycast infrastructure — hundreds of physical nodes worldwide. The actual root server infrastructure now exceeds 1,500 physical instances globally. For more on how these root servers bootstrap every DNS lookup, see [DNS root servers explained](https://dnschkr.com/blog/dns-root-servers-explained).

## Modifying Root Zone Data

Registry operators submit changes to their TLD's nameservers or DNSSEC records through IANA's online change request system:
```
https://www.iana.org/domains/root/submitting-changes
```

Changes are generally processed within 24–48 hours for routine nameserver updates. New delegations take longer due to evaluation requirements.

Unauthorized changes to the root zone are not possible through this system — all requests require authentication and authorization from the registered contacts for the TLD.

## References

- IANA Root Zone Database: https://www.iana.org/domains/root/db
- Root Zone File: https://www.internic.net/domain/root.zone
- IANA RDAP Bootstrap: https://data.iana.org/rdap/
- RFC 7480 — RDAP over HTTP: https://www.rfc-editor.org/rfc/rfc7480
- RFC 9083 — RDAP JSON Responses: https://www.rfc-editor.org/rfc/rfc9083
- Root DNSSEC KSK: https://data.iana.org/root-anchors/root-anchors.xml
- Verisign Root Zone Information: https://www.verisign.com/en_US/domain-names/dns/root-zone-management/index.xhtml
- ICANN Root Zone Management: https://www.icann.org/resources/pages/root-zone-management-2014-07-25-en
- Root Servers Technical Operations (RSSAC): https://www.icann.org/groups/rssac
