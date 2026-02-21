# The DNS Hierarchy

## The DNS Tree Structure

DNS names exist within a hierarchical tree rooted at a single unnamed node — the DNS root, conventionally written as a single dot (`.`). Every domain name in the global namespace is a path from some node in this tree back to the root, read right to left.

```
                            . (root)
                            |
          +---------+-------+---------+---------+
          |         |                 |         |
         com       net               org       arpa
          |         |                 |         |
      +---+---+     |              +--+--+   in-addr
      |       |  example        ietf   w3c
  example  google
      |       |
     www    mail
```

Reading from a leaf node to the root: `www.example.com.` labels are `www`, `example`, `com`, and the root (empty label). DNS names are typically written left-to-right (most specific to least specific), but the delegation hierarchy flows from the root downward.

---

## Levels of the Hierarchy

### Root (Level 0)

The root zone (`.`) is the apex of the tree. It delegates authority to all top-level domains. The root zone is served by the 13 root server identities and maintained by IANA. It contains no records for individual domain names — only NS records (with glue) delegating to TLD nameservers.

### Top-Level Domains (Level 1)

TLDs are the rightmost label in a domain name: `.com`, `.net`, `.uk`, `.de`, `.photography`. Each TLD is a delegation from the root zone to one or more nameservers operated by the **registry** for that TLD. A [complete list of all TLDs](https://dnschkr.com/tlds) with their registries, nameservers, and registration statistics is available for reference.

### Second-Level Domains (Level 2)

Second-level domains (SLDs) are the labels immediately to the left of the TLD: `example` in `example.com`, `bbc` in `bbc.co.uk`. Registrants purchase rights to register SLDs under TLDs from registrars. The registry maintains the authoritative zone data for the TLD and includes NS records for each registered SLD pointing to the registrant's nameservers.

Some country-code TLDs (ccTLDs) use a second level as a structural namespace component rather than a registrable name. For example, `.co.uk` and `.org.uk` are not registrable domains — they are structural second-level labels under `.uk`, and the registrable third-level labels sit below them (e.g., `bbc.co.uk`).

### Subdomains (Level 3 and Beyond)

Labels further left in the hierarchy are subdomains, controlled entirely by the SLD registrant. A registrant who owns `example.com` may create `mail.example.com`, `vpn.example.com`, or `a.b.c.d.example.com` without any involvement from the registry. Subdomain structure is a purely internal concern of the zone operator.

---

## Zone Cuts and Delegation

A **zone cut** (also called a delegation point) is where authority for a portion of the namespace transfers from one zone to another. At a zone cut, the parent zone holds NS records pointing to the child zone's authoritative nameservers, but the parent does not serve data below the cut.

```
com zone:
  example.com.    NS   ns1.example.com.
  example.com.    NS   ns2.example.com.
  ns1.example.com. A   203.0.113.1    (glue — see below)

example.com zone (separate zone, separate servers):
  example.com.    SOA  ns1.example.com. ...
  www.example.com. A   93.184.216.34
  mail.example.com. A  93.184.216.35
```

The com zone delegates `example.com` but does not serve `www.example.com`. That record lives only in the `example.com` zone.

**Identifying zone cuts**: When a recursive resolver receives a referral response (RCODE NOERROR, AA bit clear, empty answer section, NS records in the authority section), it has encountered a zone cut and must follow the delegation. You can observe this delegation chain in action using a [DNS inspector tool](https://dnschkr.com/dns-inspector) to query NS records at each level.

---

## TLD Categories

### Generic Top-Level Domains (gTLDs)

gTLDs are not tied to a specific country. They are divided into:

**Original gTLDs (pre-ICANN expansion)**
- `.com` — commercial (Verisign; ~160M registrations, largest TLD globally)
- `.net` — originally for network infrastructure; now unrestricted (~13M)
- `.org` — originally for non-commercial organisations; now unrestricted (~10M)
- `.edu` — accredited US post-secondary institutions (Educause)
- `.gov` — US federal government (CISA)
- `.mil` — US military (DoD)
- `.int` — international treaty organisations (IANA)

**New gTLDs (ICANN expansion programs)**
ICANN's 2012 New gTLD Program introduced over 1,200 new gTLDs. These include:
- Generic descriptive TLDs: `.photography`, `.technology`, `.consulting`, `.shop`
- Brand TLDs: `.google`, `.apple`, `.amazon`
- Community TLDs: `.bank`, `.law`, `.med`
- Geographic TLDs: `.nyc`, `.london`, `.berlin`
- IDN gTLDs: `.vermögensberatung`, `.닷컴` (xn--mk1bu44c)

A second ICANN New gTLD round was in preparation as of 2024, with delegations expected from 2026 onward.

### Country-Code Top-Level Domains (ccTLDs)

ccTLDs are two-letter TLDs corresponding to ISO 3166-1 alpha-2 country codes. Examples: `.de` (Germany), `.uk` (United Kingdom), `.jp` (Japan), `.cn` (China), `.au` (Australia).

Each ccTLD is delegated to an organisation designated by IANA as the registry for that country or territory. The policy and technical requirements for each ccTLD vary significantly — some require local presence (`.de` has no such requirement; `.au` requires an Australian entity), some restrict registrations to nationals, and some are operated commercially as open registries.

**Repurposed ccTLDs** (operated as open gTLDs commercially):
- `.io` (British Indian Ocean Territory) — popular with technology companies
- `.tv` (Tuvalu) — popular in media
- `.ai` (Anguilla) — popular in artificial intelligence / technology
- `.me` (Montenegro) — used for personal branding
- `.co` (Colombia) — used as a `.com` alternative

### Sponsored Top-Level Domains (sTLDs)

sTLDs are restricted gTLDs with a sponsoring organisation that sets eligibility rules. Examples: `.edu` (Educause for US higher education), `.gov` (CISA for US federal agencies), `.aero` (SITA for aviation industry), `.museum` (MuseDoma for museums). The distinction between sTLD and gTLD has become less rigid with the new gTLD program, where community applications used a similar model.

### Infrastructure TLD: .arpa

The `.arpa` TLD is the DNS infrastructure domain. It is not open for registration and is managed by IANA. Key uses:

**`in-addr.arpa`**: Reverse DNS for IPv4. The address `203.0.113.1` maps to the PTR record at `1.113.0.203.in-addr.arpa.` — the octets are reversed to allow hierarchical delegation of IP ranges.

**`ip6.arpa`**: Reverse DNS for IPv6. The address `2001:db8::1` maps to a PTR record at `1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa.` — each nibble of the address is reversed.

**`uri.arpa`, `urn.arpa`**: Used for URI/URN resolution schemes.

---

## The Registry-Registrar-Registrant Model

Domain registration uses a three-tier commercial structure:

### Registry

The registry is the organisation that operates the authoritative zone for a TLD. It maintains the master database of registered domain names within the TLD, updates the zone file, and manages the technical operation of the TLD's nameservers.

Examples: Verisign (`.com`, `.net`), Public Interest Registry (`.org`), DENIC (`.de`), Nominet (`.uk`). For profiles and market data on these operators, see the [domain registry operators directory](https://dnschkr.com/companies).

Registries do not sell domains directly to end users in most gTLDs (though some ccTLD registries do offer direct registration). Instead, they maintain a wholesale relationship with accredited registrars.

### Registrar

A registrar is an organisation accredited to sell domain registrations to end users (registrants). For gTLDs, accreditation is issued by ICANN. For ccTLDs, accreditation is managed by the registry itself.

Registrars communicate with registries via the Extensible Provisioning Protocol (EPP, RFC 5730), sending commands to create, update, transfer, and delete domain registrations. The registry processes these commands and updates the zone file accordingly.

Examples: GoDaddy, Namecheap, Google Domains (now Squarespace), Porkbun, Dynadot.

### Registrant

The registrant is the entity (person, organisation, or company) that registers and holds rights to a domain name. The registrant is the customer of the registrar. Registrant contact information is stored in RDAP/WHOIS records and is subject to ICANN's data accuracy requirements.

---

## Glue Records

Glue records are a solution to a circular dependency that arises at zone delegation boundaries.

### The Problem

Consider a zone delegated like this:

```
example.com.    NS   ns1.example.com.
example.com.    NS   ns2.example.com.
```

To resolve `www.example.com`, a recursive resolver needs the IP address of `ns1.example.com`. But `ns1.example.com` is itself within the `example.com` zone — and to find it, the resolver would need to query the `example.com` nameservers, whose addresses it is trying to discover. This is a circular dependency that cannot be resolved iteratively.

### The Solution: Glue Records

Glue records are A and AAAA records for nameservers, included in the **additional section** of the parent zone's referral responses. They are called "glue" because they glue together the delegation chain, breaking the circular dependency.

```
;; AUTHORITY SECTION:
example.com.    172800  IN  NS  ns1.example.com.
example.com.    172800  IN  NS  ns2.example.com.

;; ADDITIONAL SECTION (glue):
ns1.example.com.  172800  IN  A   203.0.113.1
ns2.example.com.  172800  IN  A   203.0.113.2
```

The parent zone (`.com` in this case) holds copies of the nameserver IP addresses. These copies must be kept in sync with the actual A/AAAA records in the child zone — if the registrant changes their nameserver IP addresses without updating the glue, resolution will break.

**When glue is required**: Glue is required whenever a nameserver's hostname falls within the zone it serves (or within a sibling zone served by the same set of nameservers). If a nameserver is in a different zone (e.g., `example.com` uses `ns1.registrar.com` as its nameserver), no glue is needed — `ns1.registrar.com` can be resolved independently.

RFC 9471 specifies that glue records must be included in referral responses when the nameserver is in-bailiwick (within the delegated zone or a child of it), and may be optionally included when out-of-bailiwick.

---

## References

- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) — Domain Names: Concepts and Facilities
- [RFC 1591](https://www.rfc-editor.org/rfc/rfc1591) — Domain Name System Structure and Delegation
- [RFC 2181](https://www.rfc-editor.org/rfc/rfc2181) — Clarifications to the DNS Specification
- [RFC 5730](https://www.rfc-editor.org/rfc/rfc5730) — Extensible Provisioning Protocol (EPP)
- [RFC 8499](https://www.rfc-editor.org/rfc/rfc8499) — DNS Terminology
- [RFC 9471](https://www.rfc-editor.org/rfc/rfc9471) — DNS Glue Requirements in Referral Responses
- [IANA TLD List](https://www.iana.org/domains/root/db) — Full list of delegated TLDs with registry information
- [ICANN New gTLD Program](https://newgtlds.icann.org/) — Details on the 2012 expansion and subsequent rounds

## See Also

- [TLD directory with registration data and pricing](https://dnschkr.com/tlds) — Browse all ~1,900 delegated TLDs
- [DNS hosting providers comparison](https://dnschkr.com/providers) — Authoritative DNS providers by market share
