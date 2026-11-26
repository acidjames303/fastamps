import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import LeadSheetFolder from "@/components/leadsheet/LeadSheetFolder";
import LeadSheetEditor from "@/components/leadsheet/LeadSheetEditor";
import { useAuth } from "@/lib/AuthContext";
import { canReviewLeadSheet } from "@/lib/leadSheet";

// Lead sheets: the caller's own drafts, and (for a BDM/admin) the review queue
// with bulk PDF/Word download for reporting.
export default function LeadSheets() {
  const { user } = useAuth();
  const [tab, setTab] = useState("mine");
  const [openId, setOpenId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [ready, setReady] = useState(false);

  const reviewer = canReviewLeadSheet(user?.app_role);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) setOpenId(id);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Lead sheets</h1>
        <p className="text-slate-500 mt-1">
          Client-ready lead sheets, drafted from the call or opportunity. Review the missing answers, approve, then download the branded PDF or Word file and send it yourself — nothing is emailed automatically.
        </p>
      </div>

      {openId ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setOpenId("")}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back to the folder
          </button>
          <LeadSheetEditor
            sheetId={openId}
            onChanged={() => setRefreshKey((key) => key + 1)}
          />
        </div>
      ) : (
        <>
          {reviewer && (
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              {[
                { key: "mine", label: "My lead sheets" },
                { key: "review", label: "For review" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    tab === item.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <LeadSheetFolder
            key={`${tab}-${refreshKey}`}
            scope={tab}
            showDateFilter
            onOpen={(id) => setOpenId(id)}
          />
        </>
      )}
    </div>
  );
}