# SERVFAIL: Server Failure Response Code

## What SERVFAIL Means

SERVFAIL is DNS response code 2 (RCODE 2). When a resolver returns SERVFAIL, it is reporting that it was unable to complete the query — it could not obtain a valid answer from the authoritative servers for the zone.

SERVFAIL is returned by the recursive resolver, not by the authoritative server. It means the resolver encountered a failure while trying to get the answer on the client's behalf. You can use a [DNS record lookup tool](https://dnschkr.com/dns-inspector) to quickly check whether a domain is returning SERVFAIL from multiple vantage points. Getting [into DNS diagnostics](https://dnschkr.com/dns-inspector) early helps isolate whether the failure is DNSSEC-related, a timeout, or a zone configuration error.

The raw response in a DNS packet:

```
;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 12345
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 0
```

## Primary Causes

### 1. DNSSEC Validation Failure

The most common cause of SERVFAIL on validating resolvers. When a resolver performs DNSSEC validation and the chain of trust cannot be verified, the resolver must return SERVFAIL rather than serving potentially forged or tampered data.

DNSSEC validation failures occur when:

- The zone's RRSIG (Resource Record Signature) has expired.
- The DNSKEY referenced in the DS record no longer matches the zone's actual signing key (key rollover done incorrectly).
- The zone is signed but the DS record in the parent zone is missing or wrong.
- The signature covers records that no longer match the current zone content.
- The zone was signed with an algorithm not supported by the resolver.

Identifying DNSSEC failure:

```bash
# Without DNSSEC validation (bypasses the validation step)
dig A example.com @8.8.8.8 +cd

# If +cd (checking disabled) returns an answer but normal query returns SERVFAIL,
# the issue is DNSSEC validation.

# Check DNSSEC chain
dig DS example.com @8.8.8.8
dig DNSKEY example.com @ns1.example.com
```

Online validators:
- https://dnsviz.net/ — full DNSSEC chain visualization
- https://dnssec-debugger.verisignlabs.com/
- [DNS security findings](https://dnschkr.com/security) — aggregated DNSSEC and zone security data across TLDs

### 2. Upstream Resolver Timeout

The recursive resolver could not reach any of the authoritative nameservers for the zone within the timeout window. This happens when:

- All authoritative nameservers are unreachable (network partition, DDoS, server failure).
- Nameservers are configured but not responding (firewall blocking UDP/TCP 53).
- Nameservers respond with REFUSED instead of valid answers.
- Too many retransmission attempts fail to elicit a response.

The resolver typically retries several times before returning SERVFAIL. The total timeout before giving up is typically 30 seconds.

Debugging:

```bash
# Query the authoritative nameservers directly
dig NS example.com +short       # Find authoritative servers
dig A example.com @ns1.example.com +time=5

# Check if the nameserver responds at all
dig SOA example.com @ns1.example.com
```

### 3. Misconfigured Zone

The authoritative zone itself may be syntactically or logically invalid, causing nameservers to refuse to serve it or to return errors:

- Missing SOA record (zone is invalid without exactly one SOA at apex).
- Missing NS records at zone apex.
- NS records pointing to CNAME targets (not permitted per RFC 2181).
- Circular CNAME chains.
- Missing glue records for in-bailiwick nameservers.
- Zone file syntax errors causing the nameserver to fail to load the zone.

When a nameserver fails to load a zone, it typically falls back to serving SERVFAIL for all queries under that zone.

Check zone validity:

```bash
# If you have access to the zone file
named-checkzone example.com /path/to/zone.db

# Verify SOA and NS at apex
dig SOA example.com @ns1.example.com
dig NS example.com @ns1.example.com
```

### 4. Lame Delegation

A lame delegation occurs when the parent zone's NS records for a domain point to nameservers that are not configured to answer authoritatively for that zone.

Example: The registry has `ns1.example.com` and `ns2.example.com` listed as the nameservers for `example.com`, but when queried, those servers return REFUSED or SERVFAIL rather than authoritative answers.

Causes:
- Nameservers changed at the DNS provider but not updated at the registrar.
- Domain transferred to a new registrar but the NS records in the registry were not updated.
- DNS hosting provider deleted the zone configuration.
- Nameserver hostnames changed and old names are still delegated.

Testing for lame delegation:

```bash
# Step 1: Get NS records from the registry (TLD zone) — not from cache
dig NS example.com @a.gtld-servers.net +norecurse

# Step 2: Query each listed nameserver directly
dig A example.com @ns1.example.com
dig A example.com @ns2.example.com

# If either returns REFUSED or SERVFAIL while the other side has the records,
# this is a lame delegation.
```

### 5. Too Many CNAME Hops

RFC 1034 does not specify a maximum CNAME chain length, but resolvers impose their own limits (commonly 8–16 hops). Exceeding this limit causes SERVFAIL.

```bash
dig CNAME example.com @8.8.8.8
```

## Debugging Workflow

### Step 1: Isolate the query path with dig +trace

`dig +trace` starts resolution from the root, showing each delegation step. A SERVFAIL during trace output identifies exactly where the failure occurs:

```bash
dig A example.com +trace +all
```

Look for:
- Which delegation step fails.
- Whether an authoritative server returns REFUSED, SERVFAIL, or does not respond.
- Whether DNSSEC signatures are present and valid at each level.

### Step 2: Test with DNSSEC validation disabled

```bash
dig A example.com @8.8.8.8 +cd
```

If this returns an answer, the zone data exists but fails DNSSEC validation. Proceed with DNSSEC-specific diagnostics.

### Step 3: Check the authority section

```bash
dig A example.com @8.8.8.8 +authority
```

The AUTHORITY section of a SERVFAIL response sometimes contains SOA records indicating what zone rejected the query and why.

### Step 4: Query each authoritative nameserver independently

```bash
for ns in $(dig NS example.com +short); do
  echo "--- $ns ---"
  dig A example.com @$ns +norecurse
done
```

This identifies if one nameserver is operational while others are failing, or if all are returning errors. The [dig command tutorial](https://dnschkr.com/blog/dig-command-guide) covers these diagnostic techniques in more detail.

### Step 5: Check DNSSEC specifically

```bash
# Check for RRSIG expiration
dig A example.com @ns1.example.com +dnssec

# The RRSIG record shows signature validity window:
# example.com.  3600  IN  RRSIG  A 13 2 3600 20240201000000 20240101000000 ...
#                                                ^ expiry         ^ inception
```

## References

- RFC 1035 — DNS Response Codes: https://www.rfc-editor.org/rfc/rfc1035
- RFC 4034 — DNSSEC Resource Records (RRSIG, DNSKEY, DS): https://www.rfc-editor.org/rfc/rfc4034
- RFC 4035 — DNSSEC Protocol Modifications (validation): https://www.rfc-editor.org/rfc/rfc4035
- RFC 2181 — Clarifications to the DNS Specification (CNAME at NS): https://www.rfc-editor.org/rfc/rfc2181
- DNSViz (DNSSEC visualizer): https://dnsviz.net/
- Verisign DNSSEC Debugger: https://dnssec-debugger.verisignlabs.com/
