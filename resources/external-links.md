# External Resources

Curated links to authoritative DNS resources, registries, tools, and security databases. Every link here points to a primary source or a well-established community tool -- no blogspam, no affiliate links.

Last reviewed: February 2026.

---

## IANA (Internet Assigned Numbers Authority)

IANA manages the global DNS root zone, protocol parameter registries, and IP address allocation.

| Resource | URL | Description |
|----------|-----|-------------|
| Root Zone Database | https://www.iana.org/domains/root/db | Complete list of all TLDs in the root zone with delegation details and sponsoring organization. The authoritative source for what TLDs exist. |
| Root Zone File | https://www.iana.org/domains/root/files | The actual root zone file and root hints file used by recursive resolvers. |
| DNS Parameters Registry | https://www.iana.org/assignments/dns-parameters | All registered DNS record types (RRTYPEs), opcodes, RCODEs, EDNS options, and other protocol parameters. |
| RDAP Bootstrap | https://data.iana.org/rdap/ | Bootstrap files for RDAP (Registration Data Access Protocol), the replacement for WHOIS. Maps TLDs and IP ranges to their respective RDAP servers. |
| Special-Use Domain Names | https://www.iana.org/assignments/special-use-domain-names | Registry of domain names with special behavior (localhost, .onion, .test, .invalid, .example, etc.). |
| Root KSK Ceremonies | https://www.iana.org/dnssec/ceremonies | Documentation and recordings of DNSSEC root key signing ceremonies. |

## ICANN (Internet Corporation for Assigned Names and Numbers)

ICANN coordinates DNS policy, manages the root zone, and oversees the domain name registration ecosystem.

| Resource | URL | Description |
|----------|-----|-------------|
| Centralized Zone Data Service (CZDS) | https://czds.icann.org | Access to gTLD zone files for research purposes. Requires application and agreement to terms. Contains hundreds of millions of domain registrations. |
| ICANN WHOIS Lookup | https://lookup.icann.org | ICANN's official WHOIS lookup tool for domain registration data. |
| Registry Agreements | https://www.icann.org/resources/pages/registries/registries-agreements-en | Base and individual registry agreements for all gTLDs. Defines operational requirements and commitments. |
| New gTLD Program | https://newgtlds.icann.org | Information on the new gTLD program, including applied-for strings, evaluation status, and delegation dates. |
| ICANN Open Data | https://opendata.icann.org | Public datasets including registration data, DNS abuse metrics, and CZDS request statistics. |

## Root Server Operators

The 13 root server identities (A through M) are operated by 12 independent organizations. Together they handle the first step of every DNS resolution that reaches the root.

| Root | Operator | URL |
|------|----------|-----|
| Overview | Root Server Technical Operations Association | https://root-servers.org |
| A | Verisign | https://www.verisign.com/en_US/channel-resources/domain-registry-products/root-zone/index.xhtml |
| B | USC-ISI | https://b.root-servers.org |
| C | Cogent Communications | https://c.root-servers.org |
| D | University of Maryland | https://d.root-servers.org |
| E | NASA Ames Research Center | https://e.root-servers.org |
| F | Internet Systems Consortium (ISC) | https://www.isc.org/f-root/ |
| G | US DoD Network Information Center | https://g.root-servers.org |
| H | US Army Research Lab | https://h.root-servers.org |
| I | Netnod | https://www.netnod.se/dns/i-root |
| J | Verisign | https://www.verisign.com/en_US/channel-resources/domain-registry-products/root-zone/index.xhtml |
| K | RIPE NCC | https://www.ripe.net/analyse/dns/k-root |
| L | ICANN | https://www.dns.icann.org/imrs/ |
| M | WIDE Project | https://m.root-servers.org |

## Public DNS Resolvers

Major public recursive DNS resolvers. All support standard DNS (port 53), DNS over HTTPS (DoH), and DNS over TLS (DoT).

| Provider | Primary | Secondary | DoH Endpoint | Notes |
|----------|---------|-----------|-------------|-------|
| Google Public DNS | 8.8.8.8 | 8.8.4.4 | https://dns.google/dns-query | Largest public resolver by query volume. Supports EDNS Client Subnet. |
| Cloudflare | 1.1.1.1 | 1.0.0.1 | https://cloudflare-dns.com/dns-query | Privacy-focused. APNIC partnership. Also offers malware filtering (1.1.1.2) and family filtering (1.1.1.3). |
| Quad9 | 9.9.9.9 | 149.112.112.112 | https://dns.quad9.net/dns-query | Non-profit. Blocks known-malicious domains by default. Unfiltered available at 9.9.9.10. |
| OpenDNS (Cisco) | 208.67.222.222 | 208.67.220.220 | https://doh.opendns.com/dns-query | Content filtering options. Enterprise management available via Cisco Umbrella. |
| AdGuard DNS | 94.140.14.14 | 94.140.15.15 | https://dns.adguard-dns.com/dns-query | Blocks ads and trackers at the DNS level. Non-filtering mode available at 94.140.14.140. |

## DNS Visualization and Analysis Tools

Tools for inspecting, visualizing, and debugging DNS configurations.

| Tool | URL | Description |
|------|-----|-------------|
| DNSViz | https://dnsviz.net | DNSSEC chain of trust visualization. Shows the complete signing chain from root to leaf, highlights validation errors, and identifies misconfigured DNSSEC deployments. |
| DNS Looking Glass | https://dns.google | Google's public DNS diagnostic tool. Shows query results with full resolution path, DNSSEC validation status, and response metadata. |
| Zonemaster | https://zonemaster.net | AFNIC/IIS tool that performs comprehensive DNS configuration checks against best practices. Tests delegation, nameserver consistency, SOA parameters, and DNSSEC. |
| dnschkr | https://dnschkr.com | DNS record inspection, propagation checking, and TLD research tools. Includes a [directory of all TLDs](https://dnschkr.com/tlds) with provider analytics and security data, plus [IP geolocation lookup](https://dnschkr.com/ip-address-lookup) and [port scanning](https://dnschkr.com/port-scanner). |
| RIPE Atlas | https://atlas.ripe.net | Global network of measurement probes. Run DNS queries from thousands of vantage points worldwide. Useful for verifying propagation and diagnosing regional resolution issues. |
| intoDNS | https://intodns.com | Quick DNS health check for a domain. Tests nameserver configuration, SOA parameters, and common delegation errors. For a more comprehensive look into DNS health including full record inspection, propagation testing, and security analysis, see [dnschkr DNS Inspector](https://dnschkr.com/dns-inspector). |

## Security Resources

Threat intelligence, abuse reporting, and DNS security research.

| Resource | URL | Description |
|----------|-----|-------------|
| Spamhaus | https://www.spamhaus.org | Maintains DNS blocklists (DBL, SBL, XBL) used by mail servers worldwide. The Domain Block List (DBL) is specifically DNS-focused, tracking domains used for spam, phishing, and malware. |
| abuse.ch | https://abuse.ch | Swiss non-profit tracking malware, botnets, and ransomware. Operates URLhaus, ThreatFox, and MalBazaar. Publishes free threat intelligence feeds. |
| FIRST (Forum of Incident Response and Security Teams) | https://www.first.org | Global forum for incident response teams. Maintains the CVSS scoring system, TLP classification, and coordinates cross-border security incident response. |
| PhishTank | https://phishtank.org | Community-driven phishing URL database. Provides a free API for checking whether a URL is a known phishing site. |
| SANS Internet Storm Center | https://isc.sans.edu | Daily threat intelligence and analysis. Publishes DNS-related threat advisories, tracks scanning activity, and monitors emerging attack patterns. |
| Team Cymru | https://www.team-cymru.com | Provides IP-to-ASN mapping, bogon reference lists, and threat intelligence services. Their IP-to-ASN DNS service is widely used for automated lookups. |
| Interisle Consulting -- Phishing Landscape | https://interisle.net/phishing-landscape | Annual research report analyzing phishing across TLDs, registrars, and hosting providers. One of the most comprehensive public analyses of DNS-facilitated abuse. |
| Certificate Transparency Logs | https://certificate.transparency.dev | Publicly auditable logs of all TLS certificates issued by participating CAs. Useful for monitoring certificate issuance for your domains and detecting unauthorized certificates. |

## Regional Internet Registries (RIRs)

The five RIRs manage IP address allocation and maintain RDAP/WHOIS services for their respective regions.

| RIR | Region | RDAP Endpoint | URL |
|-----|--------|---------------|-----|
| ARIN | North America | https://rdap.arin.net/registry | https://www.arin.net |
| RIPE NCC | Europe, Middle East, Central Asia | https://rdap.db.ripe.net | https://www.ripe.net |
| APNIC | Asia-Pacific | https://rdap.apnic.net | https://www.apnic.net |
| LACNIC | Latin America, Caribbean | https://rdap.lacnic.net/rdap/ | https://www.lacnic.net |
| AFRINIC | Africa | https://rdap.afrinic.net/rdap/ | https://www.afrinic.net |

## DNS Software

Major open-source DNS server implementations.

| Software | URL | Description |
|----------|-----|-------------|
| BIND 9 | https://www.isc.org/bind/ | The original and most widely deployed DNS server. Authoritative and recursive. Maintained by ISC. |
| Unbound | https://nlnetlabs.nl/projects/unbound/ | Recursive resolver focused on security and performance. Widely used as a local or forwarding resolver. Maintained by NLnet Labs. |
| Knot DNS | https://www.knot-dns.cz | High-performance authoritative DNS server. Supports automatic DNSSEC signing, DDNS, and zone catalogs. Developed by CZ.NIC. |
| Knot Resolver | https://www.knot-resolver.cz | Modern recursive resolver with built-in DNSSEC validation, DNS-over-TLS/HTTPS support, and Lua scripting. Also by CZ.NIC. |
| PowerDNS | https://www.powerdns.com | Authoritative server with database backends (MySQL, PostgreSQL, LDAP). Separate recursor component. Supports DNSSEC, ALIAS records, and Lua scripting. |
| CoreDNS | https://coredns.io | Lightweight, plugin-based DNS server written in Go. Default DNS server in Kubernetes. Extensible through a chain of middleware plugins. |
| NSD | https://nlnetlabs.nl/projects/nsd/ | Authoritative-only DNS server. Designed for high performance and simplicity. Maintained by NLnet Labs. |

---

## Maintaining This List

Links break. Services change. If you find a dead link or know of a resource that belongs here, open a pull request. The bar for inclusion: the resource must be a primary source, an established community tool, or a recognized authority in its domain. For DNS-specific security research and zone-level findings across TLDs, see the [DNS security dashboard](https://dnschkr.com/security).
