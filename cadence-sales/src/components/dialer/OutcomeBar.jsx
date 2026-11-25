import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListChecks } from "lucide-react";

const OUTCOMES = [
  { key: "no_pickup", label: "No pickup" },
  { key: "busy", label: "Busy" },
  { key: "voicemail", label: "Voicemail" },
  { key: "no_reply", label: "No reply" },
  { key: "callback", label: "Call back" },
  { key: "lead", label: "Lead" },
  { key: "send_info", label: "Send info" },
  { key: "future_potential", label: "Future potential" },
  { key: "identify_new_contact", label: "Identify new contact" },
  { key: "duplicate", label: "Duplicate record" },
  { key: "not_suitable", label: "Not suitable" },
  { key: "no_sales_calls", label: "No sales calls" },
  { key: "pa_screened", label: "PA Screened" },
  { key: "customer_service_number", label: "Customer Service Number" },
  { key: "not_interested", label: "Not interested" },
  { key: "dnc", label: "Do Not Call" },
];

export function getOutcomeLabel(key) {
  return OUTCOMES.find((o) => o.key === key)?.label || key;
}

export default function OutcomeBar({ value, onChange, disabled }) {
  const selectedLabel = value ? getOutcomeLabel(value) : "Select call response";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="rounded-full w-full h-11 justify-between border-slate-300 text-slate-700"
        >
          <span className="flex items-center">
            <ListChecks className="w-4 h-4 mr-2" /> {selectedLabel}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
        {OUTCOMES.map(({ key, label }) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => onChange(key)}
            className={`cursor-pointer justify-start ${value === key ? "bg-accent" : ""} ${
              key === "dnc" || key === "no_sales_calls"
                ? "text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                : "text-slate-700"
            }`}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}