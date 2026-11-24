import React from "react";
import LegalPageLayout, { LegalSection, LegalTable } from "@/components/legal/LegalPageLayout";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Notice"
      summary="This notice explains how Cadence handles personal information when you visit the website, create an account, use the service or contact support."
    >
      <LegalSection title="1. Who is responsible for your information">
        <p><strong>Cadence</strong> is the service operator and data controller for account registration, subscription administration, service security, usage and support information.</p>
        <p>Your customer organisation is normally the data controller for prospect, contact, company, campaign, call-note and outcome information that its authorised users add to Cadence. For that information, Cadence normally acts as a processor on the organisation’s documented instructions.</p>
        <p>Questions can be raised through the public Support page or, when signed in, through <strong>Support → Report a problem</strong>. The full legal name and service address of the operator must also appear on the applicable order, invoice or commercial agreement before a paid subscription is accepted.</p>
      </LegalSection>

      <LegalSection title="2. Information we process">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Account information:</strong> name, work email, user identifier, role, organisation and authentication records.</li>
          <li><strong>Customer content:</strong> prospect and company records, campaign membership, call outcomes, notes, follow-ups, suppression records and reports.</li>
          <li><strong>Provider information:</strong> provider type, connection status and encrypted credentials or tokens where the organisation chooses to connect a provider.</li>
          <li><strong>Billing information:</strong> plan, subscription status, transaction references and limited billing metadata. Payment-card details are handled by the payment provider and are not intended to be stored by Cadence.</li>
          <li><strong>Usage and security information:</strong> page, browser, timestamps, audit events, correlation identifiers, feature use and error information.</li>
          <li><strong>Support information:</strong> ticket content, replies and safe diagnostics. Support reports are designed not to include credentials or prospect notes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Where information comes from">
        <p>Information may come from you, your organisation administrator, authorised colleagues, imported files, connected customer-owned providers and public business sources selected by the customer. Customers must have a lawful basis for information they upload, enrich or use for prospecting.</p>
      </LegalSection>

      <LegalSection title="4. Purposes and lawful bases">
        <LegalTable
          headers={["Purpose", "Typical information", "UK GDPR lawful basis"]}
          rows={[
            ["Provide accounts, subscriptions and the requested service", "Account, organisation, usage and billing records", "Performance of a contract or steps requested before entering one"],
            ["Operate, secure and improve Cadence", "Security logs, diagnostics, audit and limited usage data", "Legitimate interests in providing a reliable and secure business service"],
            ["Customer prospecting workflow", "Customer content and connected-provider results", "Processed on the customer controller’s documented instructions"],
            ["Billing, tax, fraud prevention and legal compliance", "Subscription, transaction and audit records", "Contract, legitimate interests and legal obligation"],
            ["Service and product communications", "Account and work contact details", "Contract or legitimate interests; consent where required"],
            ["Respond to support and rights requests", "Account, ticket, diagnostics and relevant records", "Contract, legitimate interests and legal obligation"],
          ]}
        />
        <p>Where we rely on legitimate interests, we consider whether the processing is necessary, proportionate and reasonably expected. You may object to processing based on legitimate interests. The right to object to direct marketing is absolute.</p>
      </LegalSection>

      <LegalSection title="5. Calling, prospecting and compliance">
        <p>Cadence provides suppression, frequency and outcome controls designed to support responsible UK prospecting. The customer organisation remains responsible for its lawful basis, target selection, screening, scripts, calling times, direct-marketing rules and compliance with UK GDPR, the Data Protection Act 2018 and PECR.</p>
        <p>Cadence does not authorise unlawful automated calling, concealment of caller identity, use of suppressed records, or continued direct marketing after a valid objection.</p>
      </LegalSection>

      <LegalSection title="6. Dictation">
        <p>The notes Dictate button uses the browser’s speech-recognition capability. Cadence does not intentionally send that audio to a Cadence transcription service or charge a Smart Action for dictation. The browser or operating-system provider may process speech through its own service. Users should check their browser’s terms and avoid dictating special-category or unnecessary sensitive information.</p>
      </LegalSection>

      <LegalSection title="7. Sharing and service providers">
        <p>Information is shared only where needed to operate the service, follow customer instructions, meet legal obligations or protect the service. Relevant categories include Base44 hosting and application services, payment processing, error and security services, and customer-selected telephony, enrichment or CRM providers.</p>
        <p>Connecting a customer-owned provider instructs Cadence to transmit the information needed for that operation. Provider charges and the provider’s own terms and privacy practices remain separate.</p>
      </LegalSection>

      <LegalSection title="8. International transfers">
        <p>Some service providers may process information outside the UK. Where this is a restricted transfer, Cadence will use an available lawful mechanism, such as UK adequacy regulations, the UK International Data Transfer Agreement or the UK Addendum to approved EU Standard Contractual Clauses, together with a transfer-risk assessment and appropriate safeguards where required.</p>
      </LegalSection>

      <LegalSection title="9. Retention">
        <p>We keep information only for as long as reasonably necessary for the purpose collected, the customer contract, security, dispute resolution and legal obligations. Retention is determined by the type of record, customer instructions, account status and applicable law.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Customer content remains available in read-only form after trial expiry so the customer can export it, until subscription, deletion or offboarding instructions are completed.</li>
          <li>Support and security records may be retained after account closure where needed to investigate incidents or establish legal claims.</li>
          <li>Backups are protected and removed through the applicable backup lifecycle rather than used for ordinary business access.</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <p>Depending on the circumstances, UK data-protection law gives you rights of access, correction, erasure, restriction, portability, objection and rights relating to solely automated decisions. These rights are not absolute.</p>
        <p>For customer prospect data, contact the organisation that added the record. Cadence will assist the organisation where required. You may also complain to the UK Information Commissioner’s Office at <a className="text-emerald-700 underline" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk/make-a-complaint</a>.</p>
      </LegalSection>

      <LegalSection title="11. Security and changes">
        <p>Cadence uses organisation separation, role-based access, encrypted provider credentials, audit records and restricted support diagnostics. No internet service can guarantee absolute security. Notify us promptly through Support if you suspect unauthorised access or cross-organisation disclosure.</p>
        <p>We may update this notice when the service, providers or law changes. Material changes will be communicated through the service or account contact where appropriate.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
