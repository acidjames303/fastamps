import React from "react";
import LegalPageLayout, { LegalSection, LegalTable } from "@/components/legal/LegalPageLayout";

export default function DataProcessingTerms() {
  return (
    <LegalPageLayout
      title="Data Processing Terms"
      summary="These UK GDPR Article 28 terms apply when Cadence processes personal data on behalf of a customer organisation using the service."
    >
      <LegalSection title="1. Status and scope">
        <p>These Data Processing Terms form part of the agreement between the customer organisation as <strong>Controller</strong> and the Cadence service operator as <strong>Processor</strong>. They apply to personal data placed in Cadence by or for the customer, including prospect, contact, campaign, call, outcome, note, suppression and follow-up information.</p>
        <p>Cadence is separately a controller for its own account, subscription, security and business-administration information as described in the Privacy Notice.</p>
      </LegalSection>

      <LegalSection title="2. Processing details">
        <LegalTable
          headers={["Item", "Description"]}
          rows={[
            ["Subject matter", "Hosting and operating the customer’s prospecting, calling, follow-up, reporting and connected-provider workflow."],
            ["Duration", "For the agreement and any documented export, retention or deletion period, subject to legal retention and protected backup cycles."],
            ["Nature and purpose", "Collection, storage, organisation, retrieval, display, transmission to customer-selected providers, reporting, support, security, export and deletion."],
            ["Personal-data types", "Names, work contact details, job roles, company links, campaign membership, call outcomes, notes, follow-up dates, suppression information, user identifiers, audit and provider result data."],
            ["Data subjects", "Customer authorised users, business prospects, customer contacts, client contacts and other people whose business information the Controller lawfully adds."],
            ["Special-category data", "Not intended or required. The Controller must not add special-category or criminal-offence data unless separately agreed with appropriate safeguards."],
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Controller instructions">
        <p>The Processor will process personal data only on the Controller’s documented instructions, including the agreement, authorised use of features and later written instructions, unless UK law requires otherwise. Where legally permitted, the Processor will inform the Controller before processing required by law.</p>
        <p>The Processor will notify the Controller if, in its reasonable opinion, an instruction infringes UK data-protection law and may pause the affected processing while the parties resolve it.</p>
      </LegalSection>

      <LegalSection title="4. Controller obligations">
        <p>The Controller determines the purposes and lawful basis of prospecting and remains responsible for transparency, data accuracy, minimisation, suppression, direct-marketing rules, rights requests and instructions to its authorised users.</p>
        <p>The Controller must not instruct unlawful processing and must configure retention, roles, provider connections and exports appropriately for its operations.</p>
      </LegalSection>

      <LegalSection title="5. Confidentiality">
        <p>The Processor will ensure that people authorised to process customer personal data are bound by confidentiality obligations and receive access only where necessary for their role, support, security or legal duties.</p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>Taking account of the state of the art, implementation cost, processing context and risk, the Processor will maintain appropriate technical and organisational measures. These include, as appropriate:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>organisation-scoped access controls and role-based permissions;</li>
          <li>authentication, encrypted transport and protected provider credentials;</li>
          <li>audit records, correlation identifiers and restricted support diagnostics;</li>
          <li>suppression and duplicate-prevention controls;</li>
          <li>backup, incident response, change control and vulnerability remediation procedures; and</li>
          <li>regular review and testing proportionate to the service and risks.</li>
        </ul>
        <p>No security measure eliminates all risk. The Controller must protect its accounts, devices, exports and provider credentials.</p>
      </LegalSection>

      <LegalSection title="7. Sub-processors">
        <p>The Controller gives general written authorisation for the Processor to use sub-processors necessary to provide Cadence. Relevant categories include application hosting, infrastructure, payment, error/security monitoring and customer-selected calling, enrichment or CRM services.</p>
        <p>The Processor will maintain a current sub-processor record, provide it on request or through the service, and give reasonable notice of a material new sub-processor where practicable. The Controller may object on reasonable data-protection grounds. The parties will work in good faith on an alternative; if none is reasonably available, the affected service may be terminated.</p>
        <p>The Processor will impose written data-protection obligations offering an equivalent level of protection and remains responsible for its sub-processors’ performance of those obligations.</p>
      </LegalSection>

      <LegalSection title="8. International transfers">
        <p>The Processor will not make a restricted transfer except on the Controller’s instructions and using a valid UK transfer mechanism. This may include UK adequacy regulations, the UK International Data Transfer Agreement or the UK Addendum to approved EU Standard Contractual Clauses, together with required transfer-risk assessment and supplementary measures.</p>
      </LegalSection>

      <LegalSection title="9. Data-subject requests">
        <p>Taking account of the nature of processing, the Processor will provide reasonable technical and organisational assistance to help the Controller respond to requests for access, correction, erasure, restriction, portability, objection and automated-decision rights.</p>
        <p>If the Processor receives a request clearly concerning Controller data, it will not respond substantively except on the Controller’s instructions or where required by law, and will direct or forward the request where reasonably possible.</p>
      </LegalSection>

      <LegalSection title="10. Breaches, DPIAs and regulators">
        <p>The Processor will notify the Controller without undue delay after becoming aware of a personal-data breach affecting Controller data and provide available information needed for the Controller’s assessment and notifications. Notification is not an admission of fault.</p>
        <p>The Processor will provide reasonable assistance with security obligations, data-protection impact assessments, prior consultation and regulator enquiries, taking account of the nature of processing and information available.</p>
      </LegalSection>

      <LegalSection title="11. Return and deletion">
        <p>At the Controller’s choice and subject to the service’s export functionality, the Processor will return or delete Controller personal data after the end of services and delete remaining copies, unless UK law requires retention. Protected backups may remain until overwritten through the ordinary backup cycle and will remain secured and unavailable for ordinary use.</p>
        <p>The Controller is responsible for requesting and completing its available exports before the applicable access period ends.</p>
      </LegalSection>

      <LegalSection title="12. Information and audits">
        <p>The Processor will make available information reasonably necessary to demonstrate compliance with these terms and allow proportionate audits or inspections by the Controller or its independent auditor.</p>
        <p>Unless a breach or regulator requires otherwise, audits must be requested on reasonable notice, occur no more than once annually, avoid unnecessary disruption and protect other customers’ confidentiality and security. The Controller bears its audit costs; additional Processor assistance may be charged at reasonable rates agreed in advance.</p>
      </LegalSection>

      <LegalSection title="13. Priority and liability">
        <p>If these terms conflict with the main agreement on protection of Controller personal data, these Data Processing Terms take priority. Liability is governed by the main agreement, subject to rights and liabilities that cannot lawfully be limited.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
