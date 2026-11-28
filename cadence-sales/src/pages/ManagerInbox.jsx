import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ManagerInboxPanel from "@/components/team/ManagerInboxPanel";
import LeadSheetFolder from "@/components/leadsheet/LeadSheetFolder";

export default function ManagerInbox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Opening the inbox from a caller's account carries that caller, and the
  // exact request if one was picked, so the manager lands on the right record.
  const callerUserId = params.get("caller") || "";
  const focusTaskId = params.get("task") || "";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Admin inbox</h1>
        <p className="text-slate-500 mt-1 max-w-3xl">
          Information requests from callers and the lead sheets waiting for review. Polish the draft, download the branded file, then send it yourself.
        </p>
      </div>

      <div className="grid gap-5 items-start lg:grid-cols-5">
        <div className="lg:col-span-3 min-w-0">
          <ManagerInboxPanel
            callerUserId={callerUserId}
            focusTaskId={focusTaskId}
            onClearCaller={() => navigate("/manager-inbox")}
          />
        </div>
        <div className="lg:col-span-2 min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <LeadSheetFolder
            scope="review"
            compact
            scroll
            onOpen={(id) => navigate(`/lead-sheets?id=${id}`)}
          />
        </div>
      </div>
    </div>
  );
}