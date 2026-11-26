import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, RotateCcw, CircleAlert, MessageSquare, Check } from "lucide-react";
import DictateButton from "@/components/dialer/DictateButton";

// Talk a campaign through in plain English. Each reply returns an updated
// brief and ICP, so the salesperson never has to write the brief themselves.
const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    brief: { type: "string" },
    icp: { type: "string" },
    target_titles: { type: "array", items: { type: "string" } },
    missing_information: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "brief", "icp"],
};

const INSTRUCTIONS = `You are Cadence's prospecting assistant. A B2B salesperson is describing a calling campaign to you in conversation. Your job is to help them get it clear, then keep an up-to-date campaign brief they can run.

How to reply:
- 2 to 4 short sentences, plain English, no jargon, no headings, no bullet lists, no markdown.
- Ask at most two short questions in a turn, and only about things that genuinely change who gets called: what they sell, who the buyer is, company size and industry, geography, buying signals, and what disqualifies an account.
- Never invent facts about their business, their clients or their numbers. If something is unknown, leave it out.
- If they say "that's it" or similar, stop asking and confirm the brief is ready.

Return in the JSON:
- reply: what you say to them.
- brief: the best current campaign brief, as short labelled lines (What we sell / Who we call / Company profile / Geography / Buying signals / Disqualifiers). Include only what they have actually told you, carried forward from the current brief. Always return the whole brief, not just the new part.
- icp: one concise paragraph describing the ideal customer profile in the same terms.
- target_titles: up to 8 job titles worth calling, most senior or most relevant first.
- missing_information: up to 3 things still worth knowing. Empty when the brief is good enough to run.`;

const GREETING =
  "Tell me about the campaign in your own words — what you sell, who you want to reach, and where. I'll ask a couple of questions, write the brief as we go, and then Cadence can find the accounts.";

function buildPrompt(messages, proposal) {
  const transcript = messages
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Salesperson" : "Assistant"}: ${m.content}`)
    .join("\n");
  const current = proposal?.brief
    ? `\n\nCurrent brief:\n${proposal.brief}\n\nCurrent ICP:\n${proposal.icp || "(none yet)"}`
    : "";
  return `${INSTRUCTIONS}${current}\n\nConversation so far:\n${transcript}\n\nReply to the last message from the salesperson and return the updated brief.`;
}

export default function CampaignChat({ starting, onStart, initialBrief = "", initialIcp = "" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState(
    initialBrief ? { brief: initialBrief, icp: initialIcp, target_titles: [], missing: [] } : null,
  );
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("runSmartAction", {
        action_type: "campaign_chat",
        prompt: buildPrompt(next, proposal),
        response_json_schema: SCHEMA,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      if (!result?.reply) throw new Error("The assistant did not reply. Try again.");
      setMessages([...next, { role: "assistant", content: String(result.reply).trim() }]);
      setProposal({
        brief: String(result.brief || "").trim(),
        icp: String(result.icp || "").trim(),
        target_titles: Array.isArray(result.target_titles) ? result.target_titles.filter(Boolean).slice(0, 8) : [],
        missing: Array.isArray(result.missing_information) ? result.missing_information.filter(Boolean).slice(0, 3) : [],
      });
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not reach the assistant.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setProposal(null);
    setInput("");
    setError("");
  };

  const ready = !!proposal?.brief;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 max-h-80 overflow-y-auto space-y-3">
        <Bubble role="assistant">{GREETING}</Bubble>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>{m.content}</Bubble>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="e.g. We sell planned maintenance to UK food manufacturers. I want operations and engineering managers at sites with their own production lines."
          className="rounded-xl min-h-24 text-sm"
          disabled={busy || starting}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            Enter to send · Shift+Enter for a new line · each reply uses one Smart Action
          </p>
          <div className="flex items-center gap-2">
            {(messages.length > 0 || proposal) && (
              <Button variant="ghost" size="sm" onClick={reset} disabled={busy || starting} className="rounded-full text-slate-500">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Start over
              </Button>
            )}
            <DictateButton value={input} onChange={setInput} label="Dictate message" prominent />
            <Button onClick={send} disabled={!input.trim() || busy || starting} className="rounded-full bg-slate-900 hover:bg-slate-800">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {ready && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
            <MessageSquare className="w-4 h-4" /> Your campaign brief
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-line">{proposal.brief}</p>

          {proposal.icp && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-700/70 mb-1">Ideal customer profile</div>
              <p className="text-xs text-slate-600 whitespace-pre-line">{proposal.icp}</p>
            </div>
          )}

          {proposal.target_titles?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {proposal.target_titles.map((t) => (
                <span key={t} className="rounded-full bg-white border border-emerald-200 px-2.5 py-0.5 text-[11px] text-emerald-800">
                  {t}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-emerald-800/80">
            {proposal.missing?.length
              ? `Still worth telling me: ${proposal.missing.join(" · ")}`
              : "That is enough to run. Cadence will find the accounts and keep the ones that fit."}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onStart({ brief: proposal.brief, icp: proposal.icp, research: false })}
              disabled={starting || busy}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {starting ? "Finding accounts…" : "Find accounts"}
            </Button>
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" /> Up to 25 accounts, saved to a list you can research and
              enrich
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ role, children }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${
          mine ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
        }`}
      >
        {children}
      </div>
    </div>
  );
}