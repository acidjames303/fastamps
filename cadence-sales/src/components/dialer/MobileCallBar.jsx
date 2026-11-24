import React from "react";
import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import CallTimer from "@/components/dialer/CallTimer";

// Fixed bottom bar shown during an active call on mobile. Keeps the End call
// button always visible and tappable regardless of scroll position.
export default function MobileCallBar({ contact, company, onHangUp, callStartRef, dialing }) {
  return (
    <div
      className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-400 font-medium">
          {dialing ? "Connecting…" : "In call"}
        </p>
        <p className="text-sm font-medium truncate">
          {contact?.full_name || company?.name || "Unknown"}
        </p>
        {callStartRef?.current && !dialing && (
          <div className="text-xs text-slate-400">
            <CallTimer startRef={callStartRef} />
          </div>
        )}
      </div>
      <Button
        onClick={onHangUp}
        className="rounded-full bg-red-500 hover:bg-red-400 text-white px-6 h-12 flex-shrink-0"
      >
        <PhoneOff className="w-5 h-5 mr-2" /> End
      </Button>
    </div>
  );
}