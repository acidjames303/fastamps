import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// OAuth redirect target for Gmail / Outlook connect.
export default function EmailConnectCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "working", message: "Connecting your mailbox…" });

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const oauthState = params.get("state");
      const err = params.get("error");
      const errDesc = params.get("error_description");

      if (err) {
        setState({ status: "error", message: errDesc || err || "Authorization was cancelled." });
        return;
      }
      if (!code || !oauthState) {
        setState({ status: "error", message: "Missing authorization code. Try connecting again." });
        return;
      }

      // Provider is encoded only in the pending connection; try both.
      const redirectUri = `${window.location.origin}/email-connect/callback`;
      let lastError = "";
      for (const provider of ["gmail", "outlook"]) {
        try {
          const res = await base44.functions.invoke("manageEmailMailbox", {
            action: "complete_connect",
            provider,
            code,
            state: oauthState,
            redirect_uri: redirectUri,
          });
          const data = res.data || res;
          if (data.ok) {
            setState({
              status: "ok",
              message: `Connected ${data.email_address || provider}. You can close this and save drafts to your mailbox.`,
            });
            return;
          }
        } catch (e) {
          lastError = e.message || lastError;
        }
      }
      setState({ status: "error", message: lastError || "Could not finish connecting." });
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center">
        {state.status === "working" && <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />}
        {state.status === "ok" && <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-4" />}
        {state.status === "error" && <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-4" />}
        <h1 className="font-display text-xl font-semibold text-slate-900">
          {state.status === "ok" ? "Mailbox connected" : state.status === "error" ? "Connection failed" : "Connecting…"}
        </h1>
        <p className="text-sm text-slate-500 mt-3">{state.message}</p>
        <Button
          type="button"
          className="rounded-full mt-6"
          onClick={() => navigate(state.status === "ok" ? "/profile" : "/profile")}
        >
          Back to profile
        </Button>
      </div>
    </div>
  );
}
