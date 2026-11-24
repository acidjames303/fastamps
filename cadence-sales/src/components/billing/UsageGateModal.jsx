import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LockKeyhole, LogOut, LifeBuoy, Gauge } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const EXEMPT_PATHS = ["/usage-billing", "/expired", "/support"];

export default function UsageGateModal() {
  const { workspaceAccess, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const required = workspaceAccess?.subscription_required;
  const exempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  if (!required || exempt) return null;

  const reason = workspaceAccess?.reason;
  const isUsageLimit = reason === "usage_limit_reached";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-lg w-full rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-8 text-center">
          <LockKeyhole className="w-10 h-10 text-white mx-auto mb-3" />
          <h2 className="font-display text-2xl font-semibold text-white">
            {isUsageLimit ? "You've reached your AI allowance" : "This workspace is paused"}
          </h2>
          <p className="text-emerald-50 text-sm mt-2 leading-relaxed">
            {isUsageLimit
              ? "You've used all the Smart Actions included for this workspace. Your data is safe — check your usage or contact support to continue."
              : "Your workspace needs attention before it can be used. Your data is safe — check your usage or contact support."}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <Button
            onClick={() => navigate("/usage-billing")}
            className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-base font-medium"
          >
            <Gauge className="w-4 h-4 mr-2" /> View usage
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => navigate("/support")}
              className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <LifeBuoy className="w-3.5 h-3.5" /> Contact support
            </button>
            <button
              onClick={() => logout(true)}
              className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}