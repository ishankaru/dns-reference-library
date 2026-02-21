# Registry vs Registrar: Roles in the Domain Name System

## The Three-Party Model

Domain name distribution operates through a structured three-party model defined by ICANN:

- **Registry** — Operates the TLD, maintains the authoritative zone file.
- **Registrar** — Sells domain names to customers, communicates with the registry.
- **Registrant** — The customer who registers and holds a domain name.

This separation was formalized when ICANN was created in 1998 and Network Solutions' monopoly was ended. The model ensures competition at the retail level while maintaining a single authoritative data source per TLD.

## Registry Operators

### What a Registry Does

A registry operator holds a contract with ICANN (for gTLDs) or with the relevant national authority (for ccTLDs) to administer a TLD. Core responsibilities:

- Maintain the authoritative zone file for the TLD (e.g., all NS records for `.com` domains).
- Operate the authoritative nameservers for the TLD zone.
- Accept domain registration and modification commands from accredited registrars via EPP.
- Enforce registration policies (eligibility, naming restrictions, reserved names).
- Publish WHOIS/RDAP data in compliance with ICANN agreements.
- Implement DNSSEC signing on the TLD zone.

### Registry Examples

| Registry | TLDs Operated |
|---|---|
| Verisign | `.com`, `.net` |
| Public Interest Registry (PIR) | `.org`, `.ngo`, `.ong` |
| Donuts (now Newfold Digital) | `.email`, `.guru`, `.marketing`, 200+ others |
| Afilias (now Identity Digital) | `.info`, `.biz`, `.mobi`, 200+ others |
| Google Registry | `.app`, `.dev`, `.page`, `.google` |
| DENIC | `.de` |
| Nominet | `.uk` |
| AFNIC | `.fr` |

A single registry operator may operate multiple TLDs. Identity Digital, formed from the merger of Donuts and Afilias in 2021, operates more TLDs than any other registry. The [registry operators directory](https://dnschkr.com/companies) tracks which companies operate which TLDs and their combined market share.

### Registry Data Model

Registries maintain a database of:

- Domain names registered under their TLD.
- Nameserver assignments (NS records) for each domain.
- Glue records (A/AAAA for nameservers whose names fall within the delegated zone).
- Registrar sponsorship (which registrar is responsible for each domain).
- Registration and expiration dates.
- Domain status codes (EPP status flags, see RFC 5731).

## Registrars

### What a Registrar Does

A registrar is an ICANN-accredited company that:

- Sells domain registrations, renewals, and transfers to customers (registrants).
- Submits EPP commands to registries on behalf of registrants.
- Collects registrant contact data and provides it to the registry.
- Manages the customer relationship, billing, and domain lifecycle.
- Must maintain data escrow (daily backups of customer data deposited with an ICANN-designated escrow agent).

### Registrar Examples

| Registrar | Notable for |
|---|---|
| GoDaddy | Largest by domain count (~80M domains) |
| Namecheap | Popular retail, competitive pricing |
| Google Domains | Acquired by Squarespace in 2023 |
| Cloudflare Registrar | At-cost pricing, no markup |
| Name.com | Mid-size retail, reseller ecosystem |
| NameSilo | Low-cost bulk registrations |
| Network Solutions | Oldest ICANN-accredited registrar |

As of early 2026, there are approximately 3,000 ICANN-accredited registrars operating across all gTLDs. The [DNS providers directory](https://dnschkr.com/providers) shows market concentration among the largest hosting and registration providers.

### Resellers

Many companies sell domain names without being direct ICANN-accredited registrars. These are resellers operating under an accredited registrar's accreditation. The end customer's domain is still sponsored by the underlying registrar. Resellers have no direct relationship with the registry — all commands flow through the accredited registrar.

## EPP: Extensible Provisioning Protocol

Communication between registrars and registries uses EPP (Extensible Provisioning Protocol), defined in RFC 5730–5734.

EPP is an XML-based TCP/TLS protocol. Core commands:

| Command | Purpose |
|---|---|
| `<check>` | Query availability of a domain name |
| `<create>` | Register a new domain |
| `<delete>` | Delete a domain |
| `<info>` | Retrieve domain details (NS, statuses, dates) |
| `<renew>` | Extend registration period |
| `<transfer>` | Transfer sponsorship between registrars |
| `<update>` | Modify NS records, contacts, status flags |

EPP sessions use a challenge-response authentication. The registry provides each accredited registrar with EPP credentials.

### EPP Status Codes

Domains carry one or more EPP status flags that govern what operations are permitted:

| Status | Meaning |
|---|---|
| `ok` | Domain is active, no restrictions |
| `clientHold` | Registrar has placed domain on hold (DNS not published) |
| `serverHold` | Registry has placed domain on hold |
| `clientTransferProhibited` | Registrar has locked transfers |
| `serverTransferProhibited` | Registry has locked transfers |
| `clientDeleteProhibited` | Registrar has locked deletion |
| `pendingDelete` | Domain is in the deletion grace period |
| `redemptionPeriod` | Domain expired and in the redemption phase |

## Thick vs Thin WHOIS/RDAP

Registry data models differ in how much registrant data they store:

### Thin Registry

In a thin model, the registry stores only:
- Domain name
- Nameservers
- Registrar ID
- Registration/expiration dates

Registrant contact data (name, email, address) is stored exclusively by the registrar. A WHOIS query for a thin registry domain must query the registrar's own WHOIS server for contact details.

`.com` and `.net` historically operated as thin registries.

### Thick Registry

In a thick model, the registry stores the full registrant contact record in addition to the domain technical data. A single WHOIS/RDAP query to the registry returns all data.

ICANN's 2013 Registrar Accreditation Agreement (RAA) required all new gTLDs to operate as thick registries. In 2016, ICANN mandated that `.com` and `.net` transition to thick WHOIS — this migration was completed in 2020.

All gTLDs now operate as thick registries. Most ccTLDs also store full registrant data.

## The Registrant

The registrant is the entity (person or organization) that has registered a domain name. The registrant:

- Is listed as the domain owner in WHOIS/RDAP data.
- Has the right to use the domain during the registration period.
- Is responsible for providing accurate contact data (required under ICANN policy).
- Controls NS delegation and all DNS records via the registrar.

Domain names are not "owned" in a property law sense — they are licensed from the registry via the registrar for a defined term (typically 1–10 years), subject to the registry's policies and ICANN agreements. The [domain marketplaces directory](https://dnschkr.com/marketplaces) lists platforms where registrants buy and sell existing domain registrations on the secondary market.

## References

- RFC 5730 — Extensible Provisioning Protocol (EPP): https://www.rfc-editor.org/rfc/rfc5730
- RFC 5731 — EPP Domain Name Mapping: https://www.rfc-editor.org/rfc/rfc5731
- RFC 9083 — JSON Responses for RDAP: https://www.rfc-editor.org/rfc/rfc9083
- ICANN Registrar Accreditation Agreement (RAA 2013): https://www.icann.org/resources/pages/accreditation-2012-02-25-en
- ICANN Registry Agreement (Base): https://www.icann.org/resources/pages/registries/registries-agreements-en
- Thick WHOIS Transition: https://www.icann.org/resources/pages/thick-whois-en
