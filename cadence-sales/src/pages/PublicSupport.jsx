import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Cable, CreditCard, LockKeyhole, MessageSquareWarning } from "lucide-react";
import LegalPageLayout, { LegalSection } from "@/components/legal/LegalPageLayout";

const HELP = [
  { icon: BookOpen, title: "Getting started", body: "Create your organisation, invite the right roles, import a test list and complete one test call before adding live campaign data." },
  { icon: Cable, title: "Calling and enrichment", body: "Operations Admins can connect supported customer-owned providers during onboarding or skip the step and return to Integration Settings later." },
  { icon: CreditCard, title: "Trial and billing", body: "The seven-day trial becomes read-only when it expires. You can still sign in and export supported customer data before subscribing." },
  { icon: LockKeyhole, title: "Privacy and security", body: "Do not send passwords, API keys or sensitive call notes in a support request. Cadence support diagnostics exclude credentials and prospect notes." },
];

export default function PublicSupport() {
  return (
    <LegalPageLayout
      eyebrow="Help"
      title="Cadence Support"
      summary="Practical help for setting up your workspace, connecting your own providers and resolving problems without exposing confidential information."
    >
      <section className="grid gap-4 sm:grid-cols-2">
        {HELP.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <Icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </section>

      <LegalSection title="How to get support">
        <p>Sign in and open <strong>Support</strong> from the Cadence navigation. Select <strong>Report a problem</strong>, describe what happened and review the safe diagnostic information before submitting it.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/app" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500">Sign in to Cadence</Link>
          <Link to="/forgot-password" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">Reset password</Link>
        </div>
        <p>If you cannot sign in, use the password-reset route first. During the controlled pilot, your organisation administrator can also raise an access request for you from their signed-in workspace.</p>
      </LegalSection>

      <LegalSection title="What to include">
        <ul className="list-disc space-y-2 pl-5">
          <li>What you were trying to do and the page where it happened.</li>
          <li>What you expected and what happened instead.</li>
          <li>The approximate time of the problem and whether it can be repeated.</li>
          <li>A screenshot with personal information, phone numbers and API credentials removed.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Priority and incidents">
        <p><strong>Critical</strong> means the service is unavailable to the organisation, there is a suspected security or cross-organisation data incident, or a core calling safeguard has failed. Use High or Normal for problems that have a workaround.</p>
        <p>Cadence does not publish a guaranteed response or uptime service level unless one is agreed separately in writing. We prioritise suspected privacy and security incidents and may temporarily restrict affected functions while investigating.</p>
      </LegalSection>

      <LegalSection title="Provider support">
        <p>Cadence supplies the workflow, not calling minutes or enrichment data. Problems inside a connected Twilio, Yay.com, Lusha, FullEnrich or other customer-owned provider account may also need to be raised with that provider. Never send provider secrets through a support request.</p>
      </LegalSection>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <div className="flex items-center gap-2 font-semibold"><MessageSquareWarning className="h-4 w-4" /> Privacy requests</div>
        <p className="mt-2">For access, correction, restriction, objection or deletion requests relating to prospect data, contact the organisation that added the data first. Cadence will assist that organisation where we act as its processor.</p>
      </div>
    </LegalPageLayout>
  );
}
