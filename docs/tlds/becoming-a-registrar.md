# Becoming an ICANN-Accredited Registrar

## Overview

To sell domain names directly to registrants under gTLDs, a company must obtain ICANN accreditation and enter into a Registrar Accreditation Agreement (RAA) with ICANN. Without accreditation, a company can only resell domains through an existing accredited registrar.

Accreditation grants the right to register domains across all gTLDs where the registrar separately negotiates registry access. It does not automatically grant access to all TLDs — each registry maintains its own registrar approval process. You can see the [full list of registry operators](https://dnschkr.com/companies) and the TLDs they manage.

## Eligibility Requirements

An applicant must:

- Be a legal entity (corporation, LLC, or equivalent) in good standing in its jurisdiction.
- Demonstrate financial stability sufficient to operate a registrar business.
- Have no outstanding judgments or regulatory sanctions related to domain names or internet services.
- Operate technical infrastructure meeting ICANN's specifications (EPP client capability, WHOIS/RDAP server, DNS resolution).
- Agree to full compliance with the RAA and ICANN's consensus policies.

There is no geographic restriction — registrars can be incorporated anywhere. ICANN has accredited registrars in over 60 countries.

## Fees

| Fee | Amount (USD) |
|---|---|
| Application fee (non-refundable) | $3,500 |
| Annual accreditation fee | $4,000 |
| Per-transaction variable fee | ~$0.18/domain registration (assessed quarterly) |

The variable transaction fee is calculated based on total domain-years registered and is capped at specific thresholds for large registrars. Fee schedules are published at: https://www.icann.org/resources/pages/registrar-fees-2012-02-25-en

## The Registrar Accreditation Agreement (RAA)

The RAA is the binding contract between ICANN and each accredited registrar. The current version is the 2013 RAA. Key obligations it imposes:

### Registrant Data Accuracy

Registrars must maintain accurate registrant contact data and have documented procedures for investigating inaccuracy complaints. Failure to act on verified inaccuracy complaints can result in accreditation termination.

### Data Escrow

Registrars must deposit daily escrow files with an ICANN-designated Data Escrow Provider (currently Iron Mountain). Escrow files contain all active and deleted domain records, enabling data recovery if the registrar ceases operations. Escrow must occur within 2 business days of each registration event.

### WHOIS/RDAP Service

Registrars must operate:
- A publicly accessible port-43 WHOIS service responding within 24 hours of any registration event.
- An RDAP server compliant with RFC 7480 and RFC 9083.
- Both services must be available with at least 99.0% monthly uptime.

### Abuse Contact and Response

Registrars must maintain a published abuse contact email address. They must respond to abuse complaints within 24 hours and take appropriate action. ICANN conducts registrar compliance audits and can issue breach notices for non-compliance.

### DNSSEC Support

Since 2013, registrars must support DNSSEC at the registrant level — specifically, they must accept DS (Delegation Signer) record submissions from registrants and pass them to registries via EPP.

### Transfer Policy Compliance

Registrars must implement ICANN's Inter-Registrar Transfer Policy (IRTP), including:
- Responding to transfer requests within 5 calendar days.
- Honoring FOA (Form of Authorization) from gaining registrar.
- Not imposing unauthorized transfer locks.

## Technical Requirements

### EPP Client

The registrar must implement an RFC 5730-compliant EPP client capable of communicating with each registry's EPP server. In practice, this means:

- TLS 1.2+ transport.
- Parsing registry-specific EPP extensions (each registry may define custom extensions).
- Handling session management (greeting, login, logout).
- Processing all core EPP commands: check, create, delete, info, renew, transfer, update.

### WHOIS Server

Must listen on TCP port 43, respond to queries in a defined format, and be publicly accessible from any IP. Response time must be under 2 seconds for 95% of queries.

### RDAP Server

Must be accessible at the registrar's RDAP base URL (published in IANA's RDAP bootstrap registry), return RFC 9083-compliant JSON responses, and support at minimum domain lookup queries.

### DNS Infrastructure

The registrar is not required to operate DNS hosting — they can integrate with third-party DNS providers. However, if the registrar offers nameserver management (as most do), the DNS infrastructure must be available and reliable.

## Application Process

### Step 1: Review the RAA

Download and review the 2013 RAA in full before applying. Pay particular attention to Section 2 (obligations), Section 3 (compliance), and the Data Retention Specification.

URL: https://www.icann.org/resources/pages/accreditation-2012-02-25-en

### Step 2: Submit Application

Applications are submitted through ICANN's online portal. Required information:

- Legal name, jurisdiction of incorporation, corporate registration number.
- Ownership structure and parent/subsidiary relationships.
- Proposed technical infrastructure (EPP, WHOIS, RDAP, DNS).
- Financial statements (last 2 years audited accounts or equivalent).
- Proof of good standing in jurisdiction of incorporation.
- Contact information for technical, administrative, and abuse contacts.

### Step 3: ICANN Review

ICANN reviews the application for completeness, financial adequacy, and technical capability. This phase typically takes 4–8 weeks. ICANN may request additional documentation.

### Step 4: Background Checks

ICANN conducts background checks on principal officers and shareholders holding >10% of the entity. Any unresolved legal issues related to domain fraud, cybersquatting, or internet abuse will result in rejection.

### Step 5: Execute the RAA

If approved, ICANN sends the RAA for signature. Both parties must execute it. Upon execution, ICANN issues accreditation.

### Step 6: Registry Access

Accreditation does not automatically provide access to all registries. The registrar must separately apply to each registry for EPP access and execute a registry-registrar agreement (RRA) with each. Major registries such as Verisign (.com/.net) and PIR (.org) have standard RRAs. Some registries impose additional financial requirements or technical certifications. The [DNS providers directory](https://dnschkr.com/providers) shows which providers hold the largest share of delegated domains across these registries.

### Total Timeline

From application submission to first domain registration: approximately 3–6 months, assuming no application deficiencies and standard registry onboarding.

## Reseller Alternative

If full accreditation is not warranted, operating as a reseller under an accredited registrar is substantially faster and cheaper. Resellers:

- Do not sign the RAA directly with ICANN.
- Are subject to the policies of the underlying registrar.
- Cannot set their own registry relationships.
- Are not listed in ICANN's accredited registrar database.

Several accredited registrars offer white-label reseller programs (e.g., OpenSRS by Tucows, ResellerClub, CentralNic Reseller). The [TLD directory](https://dnschkr.com/tlds) includes pricing data from major registrars for each extension.

## Maintaining Accreditation

After accreditation, ongoing obligations include:

- Paying the $4,000 annual fee and variable transaction fees.
- Completing annual compliance self-assessments.
- Responding to ICANN audit requests within specified timeframes.
- Notifying ICANN of material changes (ownership, bankruptcy, key personnel).
- Maintaining data escrow continuity without interruption.

ICANN can suspend or terminate accreditation for material breach of the RAA, failure to pass audits, or patterns of abuse facilitation.

## References

- ICANN Registrar Accreditation Agreement (2013): https://www.icann.org/resources/pages/accreditation-2012-02-25-en
- ICANN Registrar Fee Schedule: https://www.icann.org/resources/pages/registrar-fees-2012-02-25-en
- ICANN Accredited Registrar List: https://www.icann.org/registrar-reports/accredited-list.html
- RFC 5730 — EPP: https://www.rfc-editor.org/rfc/rfc5730
- RFC 7480 — RDAP HTTP: https://www.rfc-editor.org/rfc/rfc7480
- ICANN Inter-Registrar Transfer Policy: https://www.icann.org/resources/pages/transfer-policy-2016-06-01-en
- ICANN Data Escrow Specification: https://www.icann.org/resources/pages/de-2013-12-02-en
