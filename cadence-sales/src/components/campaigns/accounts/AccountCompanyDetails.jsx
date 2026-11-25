import React from "react";
import { Building2, Globe, Linkedin, Mail, MapPin, Phone, ExternalLink } from "lucide-react";

const ENTITY_LABEL = {
  limited_company: "Limited company",
  llp: "LLP",
  sole_trader: "Sole trader",
  partnership: "Partnership",
  public_limited: "Public limited company",
  charity: "Charity",
  unknown: "",
};

// The company behind an account: address, size, industry and the ways to reach it.
export default function AccountCompanyDetails({ account }) {
  const website = account.website || (account.domain ? `https://${account.domain}` : "");
  const rows = [
    { icon: MapPin, label: "Address", value: account.location },
    { icon: Building2, label: "Industry", value: account.industry },
    { icon: Building2, label: "Size", value: account.employee_range ? `${account.employee_range} employees` : "" },
    { icon: Phone, label: "Switchboard", value: account.phone },
    { icon: Mail, label: "Generic email", value: account.generic_email },
    { icon: Building2, label: "Company type", value: ENTITY_LABEL[account.business_entity_type] || "" },
  ].filter((r) => (r.value || "").trim());

  const hasLinks = website || account.linkedin;

  if (!rows.length && !hasLinks) {
    return <p className="text-sm text-slate-400">No company details recorded for this account yet.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">Company details</div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start gap-2 text-sm">
              <r.icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span className="text-slate-400 text-xs w-24 shrink-0 pt-0.5">{r.label}</span>
              <span className="text-slate-700">{r.value}</span>
            </div>
          ))}
        </div>
        {hasLinks && (
          <div className="flex flex-wrap gap-4 pt-1">
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <Globe className="w-3.5 h-3.5" /> {account.domain || website}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {account.linkedin && (
              <a
                href={account.linkedin}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}