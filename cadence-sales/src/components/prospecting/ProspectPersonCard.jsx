import React from "react";
import { BadgeCheck, Mail, Phone, Smartphone } from "lucide-react";
import { isUkMobileNumber } from "@/lib/enrichmentRun";

// One named person from enrichment — everything visible, no collapse.
export default function ProspectPersonCard({ contact }) {
  const name = contact?.name || "Unknown person";
  const title = contact?.title || "";
  const mobile = [contact?.mobile, contact?.phone].find((n) => isUkMobileNumber(n)) || "";
  const direct = contact?.direct_dial
    || ([contact?.phone, contact?.mobile].find((n) => n && !isUkMobileNumber(n)) || "");
  const email = contact?.email || "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 space-y-1.5">
      <div>
        <p className="text-sm font-semibold text-slate-900 leading-snug">{name}</p>
        {title ? <p className="text-xs text-slate-500 mt-0.5">{title}</p> : null}
      </div>

      <div className="space-y-1">
        {mobile ? (
          <a
            href={`tel:${mobile.replace(/\s+/g, "")}`}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
          >
            <Smartphone className="w-3.5 h-3.5 flex-none" />
            <span>Mobile · {mobile}</span>
          </a>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <Smartphone className="w-3.5 h-3.5 flex-none" />
            No mobile yet
          </p>
        )}

        {direct ? (
          <a
            href={`tel:${direct.replace(/\s+/g, "")}`}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:underline"
          >
            <Phone className="w-3.5 h-3.5 flex-none" />
            <span>Direct · {direct}</span>
          </a>
        ) : null}

        {email ? (
          <a
            href={`mailto:${email}?subject=Following up from our call`}
            className="flex items-start gap-1.5 text-xs text-blue-700 hover:underline break-all"
          >
            <Mail className="w-3.5 h-3.5 flex-none mt-0.5" />
            <span>
              {email}
              {contact.email_status === "verified" && (
                <BadgeCheck className="w-3.5 h-3.5 inline ml-1 text-emerald-600 align-text-bottom" />
              )}
              {contact.email_status === "inferred" && (
                <span className="ml-1 text-amber-600 no-underline">· inferred, unverified</span>
              )}
            </span>
          </a>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Mail className="w-3.5 h-3.5 flex-none" />
            No email yet
          </p>
        )}
      </div>
    </div>
  );
}
