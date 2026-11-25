import React from "react";
import LegalPageLayout, { LegalSection } from "@/components/legal/LegalPageLayout";

export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      summary="These terms govern business use of Cadence, including the trial, subscriptions, customer-owned provider connections and acceptable use."
    >
      <LegalSection title="1. Business service and agreement">
        <p>Cadence is a business-to-business prospecting and calling workflow. It is not intended for personal or consumer use. By creating or using an account, you confirm that you are at least 18, are acting wholly or mainly for business purposes and have authority to bind the customer organisation.</p>
        <p>The agreement consists of these Terms, the applicable order or subscription selection, the Privacy Notice and, where Cadence processes customer personal data, the Data Processing Terms.</p>
        <p>The full legal name, service address and any company or tax registration details of the supplier must appear on the customer’s order, invoice or commercial agreement before a paid subscription is accepted.</p>
      </LegalSection>

      <LegalSection title="2. What Cadence provides">
        <p>Cadence provides a workspace for prospect lists, company briefings, calling through connected providers, outcomes, notes, follow-ups, reporting, exports and related controls. Features may depend on plan, role, configuration, browser and connected providers.</p>
        <p>Cadence is not a telephony carrier, enrichment-data seller, legal adviser or CRM replacement. Calling, enrichment and CRM services connected by the customer are supplied under separate provider terms and charges.</p>
      </LegalSection>

      <LegalSection title="3. Trial">
        <p>The standard trial lasts seven days and currently includes one Operations Admin, two SDR accounts and the trial Smart Action allowance shown at registration or subscription. No payment card is required unless the checkout clearly states otherwise.</p>
        <p>At expiry, the workspace may become read-only. Supported exports remain available so the customer can retrieve its data. Trial access may be refused, suspended or ended where accounts are duplicated, abused or used unlawfully.</p>
      </LegalSection>

      <LegalSection title="4. Subscriptions, payment and cancellation">
        <p>Paid subscriptions renew monthly unless the order states otherwise. Prices, included seats, storage and Smart Actions are those displayed at checkout, exclusive of VAT where applicable. Provider usage charges are not included.</p>
        <p>The customer authorises the payment provider to collect recurring charges. A subscription can be cancelled through the available account or billing process. Cancellation stops future renewal and access continues until the end of the paid period unless the account is terminated for breach.</p>
        <p>Fees already paid are non-refundable except where the agreement, an order or applicable law requires otherwise. Cadence will give reasonable notice of material price changes applying to a future renewal.</p>
      </LegalSection>

      <LegalSection title="5. Smart Actions and fair use">
        <p>Smart Actions measure specified Cadence-powered research or processing operations. Ordinary list viewing, calls through the customer’s provider, manual notes, outcomes and follow-up management are not intended to each consume a Smart Action.</p>
        <p>The current allowance and the operation that consumes it must be shown in the service. Cached company information should be reused where valid. Cadence may prevent duplicate requests, rate-limit abusive activity and require an upgrade or separately agreed capacity for sustained usage beyond the plan.</p>
      </LegalSection>

      <LegalSection title="6. Accounts and customer responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>Keep login and provider credentials confidential and use individual user accounts.</li>
          <li>Assign the correct roles and promptly remove access for people who leave.</li>
          <li>Ensure uploaded information is accurate, relevant, lawfully obtained and used only for permitted business purposes.</li>
          <li>Maintain calling, enrichment and CRM provider accounts and pay their charges.</li>
          <li>Export information needed by the customer before deletion or the end of any post-expiry access period.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You must not use Cadence to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>break UK GDPR, the Data Protection Act 2018, PECR, sanctions, consumer-protection law or other applicable law;</li>
          <li>call or market to people who have objected or should be suppressed;</li>
          <li>conduct unlawful automated calling, impersonation, harassment or misleading communications;</li>
          <li>upload unnecessary special-category, criminal-offence, payment-card, password or highly sensitive information;</li>
          <li>probe security, bypass organisation separation, share accounts, introduce malware or disrupt the service;</li>
          <li>copy, resell, reverse engineer or provide unauthorised access to the service except where law prevents restriction.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Customer data and intellectual property">
        <p>The customer retains its rights in customer data and grants Cadence the limited right to host, copy, transmit and otherwise process it only to provide, secure and support the service and follow lawful instructions.</p>
        <p>Cadence and its licensors retain rights in the software, design, documentation, service improvements and branding. No ownership of customer prospect lists, notes or confidential campaign information transfers to Cadence.</p>
        <p>Feedback may be used to improve the service provided it does not identify the customer or disclose customer confidential information without permission.</p>
      </LegalSection>

      <LegalSection title="9. Availability, changes and support">
        <p>Cadence will use reasonable care and skill in providing the service. Unless a separate service level is agreed, the service is provided without a guaranteed uptime or response time and may be unavailable for maintenance, security work, provider failure or circumstances outside reasonable control.</p>
        <p>We may change features where reasonably required for security, law, provider compatibility or product improvement. We will avoid materially reducing paid core functionality during a current paid period without reasonable notice where practicable.</p>
      </LegalSection>

      <LegalSection title="10. Confidentiality and data protection">
        <p>Each party must protect the other party’s confidential information and use it only for the agreement, except where disclosure is required by law or to approved professional advisers and providers under duties of confidence.</p>
        <p>Each party must comply with applicable data-protection law. The Data Processing Terms apply where Cadence acts as processor for customer personal data.</p>
      </LegalSection>

      <LegalSection title="11. Liability">
        <p>Nothing excludes liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any liability that cannot lawfully be excluded.</p>
        <p>Subject to that, neither party is liable for indirect or consequential loss, or loss of profit, revenue, anticipated savings, goodwill or business opportunity. Cadence’s aggregate liability arising in any 12-month period is limited to the subscription fees paid or payable by the customer for that period. These limitations are intended to apply only to the extent reasonable and permitted by law.</p>
        <p>The customer remains responsible for prospecting decisions, call content, lawful basis, connected providers and business outcomes. Cadence does not guarantee contact accuracy, meetings, sales or campaign results.</p>
      </LegalSection>

      <LegalSection title="12. Suspension and termination">
        <p>Cadence may suspend access where reasonably necessary to protect security, prevent unlawful use, address non-payment or investigate a material breach. Where practicable, the customer will be notified and given an opportunity to remedy the issue.</p>
        <p>Either party may terminate for an unremedied material breach after reasonable written notice, or immediately for insolvency or a serious security or unlawful-use breach. On termination, access ends subject to any stated read-only export period, legal retention and the Data Processing Terms.</p>
      </LegalSection>

      <LegalSection title="13. General">
        <p>Neither party is liable for delay caused by events outside reasonable control. The customer may not transfer the agreement without written consent; Cadence may transfer it as part of a genuine business transfer provided customer protections are not materially reduced.</p>
        <p>If part of these Terms is unenforceable, the remainder continues. Delay in enforcing a right is not a waiver. These Terms and referenced documents form the entire agreement and do not create a partnership or agency.</p>
        <p>English law governs the agreement and the courts of England and Wales have exclusive jurisdiction, unless the parties agree otherwise in writing.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
