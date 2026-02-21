# ccTLD vs gTLD: Country-Code and Generic Top-Level Domains

## Overview

Every TLD in the root zone falls into one of two primary categories: country-code TLDs (ccTLDs) and generic TLDs (gTLDs). The distinction is structural, not commercial — it determines how the TLD was delegated, who governs it, and what policy framework applies. You can [browse all TLDs](https://dnschkr.com/tlds) and filter by type to see the full list of each category.

## Country-Code TLDs (ccTLDs)

### Definition

ccTLDs are two-letter TLDs corresponding to an entry in ISO 3166-1 alpha-2, the international standard for country and territory codes. Each delegation represents a country, territory, or geographic area with international recognition.

There are approximately 250 ccTLDs. The exact count varies as ISO 3166-1 is updated and as territories gain or lose recognition.

### Examples

| ccTLD | Territory |
|---|---|
| `.us` | United States |
| `.de` | Germany |
| `.uk` | United Kingdom |
| `.cn` | China |
| `.jp` | Japan |
| `.br` | Brazil |
| `.au` | Australia |
| `.io` | British Indian Ocean Territory |
| `.ai` | Anguilla |
| `.tv` | Tuvalu |

`.uk` is an exception: the ISO 3166-1 code for the United Kingdom is `GB`, but `.uk` was delegated before the standard was formalized and has been grandfathered.

### Governance

ccTLDs are delegated to a designated manager — typically the national internet registry (NIR) or a government-designated body for that territory. The manager operates the registry under the policy frameworks of ICANN and their own local regulations.

ccTLD managers are not required to sign the same agreements as gTLD registries. They operate under a set of principles articulated in RFC 1591 and subsequent ICANN policies, but with significant autonomy. Some ccTLDs (e.g., `.de`, `.nl`) operate entirely outside the ICANN gTLD framework and have bilateral agreements.

### Restrictions

Many ccTLDs restrict registrations to residents, citizens, or entities with a local presence:

- `.de` — No local presence requirement (open), but registrant must designate a local administrative contact.
- `.fr` — Requires registrant to be a European Economic Area entity.
- `.jp` — Requires Japan presence.
- `.eu` — Requires EU/EEA/European Commission residency or establishment.

Others operate as open registries:

- `.io` — Widely used by technology companies regardless of connection to the British Indian Ocean Territory.
- `.ai` — Heavily used by artificial intelligence companies.
- `.tv` — Widely used by video/streaming services.
- `.co` — Colombia's ccTLD, marketed globally as a ".com alternative".

### IDN ccTLDs

Over 60 ccTLDs are internationalized. These represent countries where the native script is non-Latin. Examples:

| Unicode | Punycode | Territory |
|---|---|---|
| `.中国` | `.xn--fiqs8s` | China (Simplified) |
| `.مصر` | `.xn--wgbh1c` | Egypt |
| `.한국` | `.xn--3e0b707e` | Korea |
| `.россия` | `.xn--h2brj9c8c` | Russia (variant) |

## Generic TLDs (gTLDs)

### Definition

gTLDs are TLDs that are not country-code TLDs. They are intended for general use across the internet without geographic restriction. The governance framework for gTLDs is defined by ICANN's Registry Agreement.

As of early 2026, there are over 1,200 gTLDs in the root zone. The [largest TLDs by domain count](https://dnschkr.com/rankings/tld-size) show how registration volumes compare across these extensions.

### Legacy gTLDs

The original gTLDs predate the modern ICANN framework:

| gTLD | Created | Original Intent |
|---|---|---|
| `.com` | 1985 | Commercial entities |
| `.net` | 1985 | Network infrastructure providers |
| `.org` | 1985 | Non-profit organizations |
| `.edu` | 1985 | US higher education (restricted) |
| `.gov` | 1985 | US government (restricted) |
| `.mil` | 1985 | US military (restricted) |
| `.int` | 1988 | International treaty organizations |

`.edu`, `.gov`, and `.mil` remain effectively restricted to their original purposes. `.com`, `.net`, and `.org` are unrestricted in practice. You can look up the [registry operators behind these TLDs](https://dnschkr.com/companies) to see who manages each extension.

### Sponsored TLDs (sTLDs)

Sponsored TLDs are a subclass of gTLD operated by a specific sponsoring organization that represents a defined community. Registrations are restricted to members of that community:

| sTLD | Sponsor | Community |
|---|---|---|
| `.edu` | EDUCAUSE | Accredited US post-secondary institutions |
| `.gov` | U.S. General Services Administration | US federal, state, and local government |
| `.mil` | US Department of Defense | US military |
| `.aero` | SITA | Aviation industry |
| `.coop` | DotCooperation LLC | Cooperative enterprises |
| `.museum` | Museum Domain Management Association | Museums |
| `.tel` | Telnic | Individuals and businesses publishing contact data |

### New gTLD Program

#### 2012 Application Round

ICANN's New gTLD Program opened for applications in January 2012. Over 1,900 applications were received. After evaluation, objection, and delegation, approximately 1,200 new gTLD strings were added to the root zone between 2013 and 2017.

These new gTLDs include:

- Geographic strings: `.london`, `.nyc`, `.tokyo`, `.berlin`
- Industry strings: `.bank`, `.legal`, `.accountant`, `.pharmacy`
- Brand TLDs: `.google`, `.apple`, `.amazon`, `.barclays`
- Community TLDs: `.ngo`, `.lgbt`, `.catholic`
- Generic descriptors: `.app`, `.dev`, `.blog`, `.shop`, `.store`

Application fee in 2012: USD $185,000 per string.

#### 2026 Application Round

ICANN opened the next new gTLD application round in 2026. Key changes from 2012:

- Revised Applicant Guidebook addressing lessons from the 2012 round.
- Community priority evaluation process changes.
- Geographic name protections updated.
- Updated internationalized label evaluation (ULE) framework for IDN strings.

### Brand TLDs

A brand TLD (also called a "dot-brand") is a gTLD whose string matches a trademark or corporate name. The registry operator restricts registrations to the brand owner's own use. Examples:

- `.google` — Operated by Google
- `.amazon` — Operated by Amazon
- `.microsoft` — Operated by Microsoft
- `.barclays` — Operated by Barclays Bank

Brand TLDs are not for public sale. They function as controlled namespaces (e.g., `careers.google`, `fire.amazon`). The [DNS security findings](https://dnschkr.com/security) page tracks how these various TLD types differ in abuse rates and DNSSEC adoption.

## Key Differences Summary

| Attribute | ccTLD | gTLD |
|---|---|---|
| Length | 2 characters | 3+ characters |
| Basis | ISO 3166-1 alpha-2 | ICANN application |
| Count | ~250 | ~1,200+ |
| Governance | National registry / bilateral ICANN agreement | ICANN Registry Agreement |
| Residency requirement | Varies (often yes) | Generally no |
| Application fee | N/A (delegated, not purchased) | $185,000 (2012 round) |
| Examples | `.de`, `.uk`, `.jp`, `.io` | `.com`, `.net`, `.app`, `.bank` |

## References

- RFC 1591 — Domain Name System Structure and Delegation (1994)
- ISO 3166-1 — Country Codes: https://www.iso.org/iso-3166-country-codes.html
- ICANN New gTLD Program — Applicant Guidebook: https://newgtlds.icann.org/en/applicants/agb
- IANA Root Zone Database: https://www.iana.org/domains/root/db
- ICANN Registry Agreements: https://www.icann.org/resources/pages/registries/registries-agreements-en
