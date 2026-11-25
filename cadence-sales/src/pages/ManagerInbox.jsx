import React from "react";
import ManagerInboxPanel from "@/components/team/ManagerInboxPanel";

export default function ManagerInbox() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Admin inbox</h1>
        <p className="text-slate-500 mt-1">
          Information requests from callers. Polish the draft, save it to your mailbox, then send it yourself.
        </p>
      </div>
      <ManagerInboxPanel />
    </div>
  );
}
