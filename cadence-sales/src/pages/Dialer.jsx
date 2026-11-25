import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import BriefPanel from "@/components/dialer/BriefPanel";
import CallHistoryPanel from "@/components/dialer/CallHistoryPanel";
import OutcomePanel from "@/components/dialer/OutcomePanel";
import CallTimer from "@/components/dialer/CallTimer";
import RemoveControl from "@/components/dialer/RemoveControl";
import AddContactDialog from "@/components/dialer/AddContactDialog";
import LastCallNotesCard from "@/components/dialer/LastCallNotesCard";
import TargetListGuide from "@/components/dialer/TargetListGuide";
import DialerSettingsDialog from "@/components/dialer/DialerSettingsDialog";
import { Button } from "@/components/ui/button";
import { Phone, SkipForward, SkipBack, PhoneOff, ExternalLink, ListChecks, Mic, Mail, Keyboard, Settings2 } from "lucide-react";
import { readAudioSettings, saveAudioSettings } from "@/lib/dialerSettings";
import { useAuth } from "@/lib/AuthContext";
import useTwilioDevice from "@/hooks/useTwilioDevice";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchListCompanyIds, resolveWorkingListId } from "@/lib/targetLists";
import { readDialPosition, saveDialPosition, clearDialPosition } from "@/lib/dialPosition";
import { setActiveCampaign, getActiveCampaign } from "@/lib/campaignContext";
import { Link } from "react-router-dom";
import MobileCallBar from "@/components/dialer/MobileCallBar";
import DialPad from "@/components/dialer/DialPad";
import QueueFilterToggle from "@/components/dialer/QueueFilterToggle";
import { isUkMobile } from "@/lib/companyContactFilters";
import { resolvePrimaryOutcomeCode } from "@/lib/outcomeRules";

// Safety net: one entry per company, so duplicate rows never inflate the queue
// count or get dialled twice.
const dedupeByName = (rows) => {
  const seen = new Set();
  return rows.filter((c) => {
    const key = String(c.name || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function Dialer() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // Removing a contact record is a manager/admin function — SDRs (bdm) cannot
  // delete records unless their manager (sales_manager) or an admin does it.
  const canRemoveRecord = ['platform_owner', 'organisation_admin', 'sales_manager'].includes(user?.app_role);
  const urlParams = new URLSearchParams(window.location.search);
  const listId = urlParams.get("list") || "";
  const isSession = urlParams.get("session") === "true";
  const contactParam = urlParams.get("contact") || "";
  const companyParam = urlParams.get("company") || "";

  const [companies, setCompanies] = useState(null); // company-first queue
  const [index, setIndex] = useState(0);
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [targetList, setTargetList] = useState(null);
  const [state, setState] = useState("idle"); // idle | ready | in_call
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [sessionMap, setSessionMap] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState(null);
  const [twilioLoaded, setTwilioLoaded] = useState(false);
  const [dialing, setDialing] = useState(false);
  const [callSid, setCallSid] = useState(null);
  const [agentInput, setAgentInput] = useState("");
  const [editingAgent, setEditingAgent] = useState(false);
  const [irSentNotice, setIrSentNotice] = useState("");
  const [dncNotice, setDncNotice] = useState("");
  const [suppressedCount, setSuppressedCount] = useState(0);
  const [lastSavedLog, setLastSavedLog] = useState(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [addedNotice, setAddedNotice] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [enablingDialer, setEnablingDialer] = useState(false);
  const [queueKey, setQueueKey] = useState(null);
  const [mobileOnly, setMobileOnly] = useState(false);
  const [mobileCompanyIds, setMobileCompanyIds] = useState(() => new Set());
  const [scanningMobiles, setScanningMobiles] = useState(true);
  const [audioSettings, setAudioSettings] = useState(readAudioSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pendingContactRef = useRef(contactParam);
  const callStartRef = useRef(null);
  const callEndRef = useRef(null);
  const callProviderRef = useRef("manual");
  const browserMode = !isMobile && !!twilioStatus?.browserVoice;
  const voice = useTwilioDevice(browserMode, audioSettings);

  // Live activity heartbeat so BDMs see who’s dialling / logging notes.
  useEffect(() => {
    const pulse = (status, detail = "") => {
      base44.functions.invoke("heartbeatActivity", { status, detail }).catch(() => {});
    };
    let status = "idle";
    if (state === "in_call" || dialing) status = "in_call";
    else if (saving || callEnded) status = "logging";
    const detail = company?.name || selectedContact?.full_name || "";
    pulse(status, detail);
    const id = setInterval(() => pulse(status, detail), 20000);
    return () => {
      clearInterval(id);
      pulse("offline", "");
    };
  }, [state, dialing, saving, callEnded, company?.name, selectedContact?.full_name]);

  const isCalledToday = (c) => {
    if (!c?.last_called) return false;
    const d = new Date(c.last_called);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const loadQueue = async () => {
    setCompanies(null);
    setError("");
    try {
      // Arriving from Contacts with a specific person: open their campaign queue
      // positioned on them, so the call history shows and dialling carries on
      // through the rest of the campaign from that point.
      if (contactParam && !isSession) {
        const contact = await base44.entities.Contact.get(contactParam).catch(() => null);
        const coId = contact?.company_id || "";
        let ctxListId = listId;
        if (!ctxListId && coId) {
          const memberships = await base44.entities.TargetListMember
            .filter({ company_id: coId }, "-created_date", 20).catch(() => []);
          ctxListId = memberships?.[0]?.target_list_id || "";
        }
        if (!ctxListId) {
          const co = coId ? await base44.entities.Company.get(coId).catch(() => null) : null;
          setTargetList(null);
          setCompanies(co ? [co] : []);
          setIndex(0);
          setCompany(co || null);
          return;
        }
        const [tl, memberIds] = await Promise.all([
          base44.entities.Campaign.get(ctxListId).catch(() => null),
          fetchListCompanyIds(ctxListId),
        ]);
        const idSet = new Set(memberIds);
        const all = await base44.entities.Company.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500);
        const q = dedupeByName(all.filter((c) => idSet.has(c.id)));
        if (!q.length) {
          const co = coId ? await base44.entities.Company.get(coId).catch(() => null) : null;
          setTargetList(tl);
          setCompanies(co ? [co] : []);
          setIndex(0);
          setCompany(co || null);
          return;
        }
        const pos = coId ? q.findIndex((c) => c.id === coId) : -1;
        const at = pos >= 0 ? pos : 0;
        setTargetList(tl);
        setQueueKey(`list_${ctxListId}`);
        setCompanies(q);
        setIndex(at);
        setCompany(q[at] || null);
        return;
      }
      // Work the list the caller is dialling, never the whole company pool.
      const activeListId = listId || (isSession ? "" : await resolveWorkingListId().catch(() => ""));
      let queue;
      let queueKey = activeListId ? `list_${activeListId}` : "all";
      // Calling session: use the priority-ordered queue from prepareCallingSession.
      if (isSession) {
        const raw = sessionStorage.getItem("calling_session");
        const session = raw ? JSON.parse(raw) : null;
        const sq = (session?.queue || session?.data?.queue) || [];
        if (sq.length) {
          const orderedIds = sq.map((r) => r.company_id).filter(Boolean);
          const all = await base44.entities.Company.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500);
          const byId = new Map(all.map((c) => [c.id, c]));
          queue = dedupeByName(orderedIds.map((id) => byId.get(id)).filter(Boolean));
          queueKey = `session_${listId || "all"}`;
          setSessionMap(new Map(sq.map((item) => [item.company_id, item])));
          if (listId) setTargetList(await base44.entities.Campaign.get(listId).catch(() => null));
        }
      }
      if (!queue && activeListId) {
        const [tl, memberIds] = await Promise.all([
          base44.entities.Campaign.get(activeListId).catch(() => null),
          fetchListCompanyIds(activeListId),
        ]);
        setTargetList(tl);
        const idSet = new Set(memberIds);
        const all = await base44.entities.Company.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500);
        queue = dedupeByName(all.filter((c) => idSet.has(c.id)));
      } else if (!queue) {
        setTargetList(null);
        queue = dedupeByName(await base44.entities.Company.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500));
      }
      // Resume where this caller left off in this queue, unless a specific
      // company was requested from a list or contact view.
      const requestedIdx = companyParam ? queue.findIndex((c) => c.id === companyParam) : -1;
      const savedId = requestedIdx >= 0 ? "" : readDialPosition(user?.id, queueKey);
      const savedIdx = savedId ? queue.findIndex((c) => c.id === savedId) : -1;
      const idx = requestedIdx >= 0 ? requestedIdx : savedIdx >= 0 ? savedIdx : 0;
      setQueueKey(queueKey);
      setCompanies(queue);
      setIndex(idx);
      setCompany(queue[idx] || null);
    } catch (e) {
      setError(e.message || "Could not load your queue.");
      setCompanies([]);
    }
  };

  useEffect(() => { loadQueue(); }, [listId]);

  // Keep sticky campaign chrome in sync with the list the dialer is working.
  useEffect(() => {
    if (targetList?.id) {
      setActiveCampaign(targetList);
      return;
    }
    if (listId && !getActiveCampaign()?.id) {
      setActiveCampaign({ id: listId, name: "Campaign" });
    }
  }, [targetList?.id, targetList?.name, listId]);

  // Remember the caller's place in this queue, so returning to the Dialer picks
  // up on the company they were on. Cleared once the queue is finished.
  useEffect(() => {
    if (!queueKey || !companies?.length) return;
    if (company?.id) saveDialPosition(user?.id, queueKey, company.id);
    else clearDialPosition(user?.id, queueKey);
  }, [company?.id, queueKey, companies?.length, user?.id]);

  // Which queue accounts actually have a mobile on one of their contacts. This
  // is what the Mobiles-only toggle filters on, using the same deterministic UK
  // mobile rule as the campaign lists, so a landline never counts.
  useEffect(() => {
    if (!companies?.length) {
      setMobileCompanyIds(new Set());
      setScanningMobiles(false);
      return;
    }
    let cancelled = false;
    setScanningMobiles(true);
    (async () => {
      const ids = companies.map((c) => c.id).filter(Boolean);
      const rows = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const part = await base44.entities.Contact
          .filter({ company_id: { $in: chunk } }, "-created_date", 2000)
          .catch(() => []);
        rows.push(...(part || []));
      }
      const withMobile = new Set();
      rows.forEach((c) => {
        if (isUkMobile(c.mobile) || isUkMobile(c.phone)) withMobile.add(c.company_id);
      });
      if (cancelled) return;
      setMobileCompanyIds(withMobile);
      setScanningMobiles(false);
    })();
    return () => { cancelled = true; };
  }, [companies]);

  // The queue the caller works: the full queue, or only mobile-ready accounts.
  const activeQueue = mobileOnly
    ? (companies || []).filter((c) => mobileCompanyIds.has(c.id))
    : (companies || []);

  // Turning the filter on or off keeps the caller on the same account when it
  // is still in view, otherwise moves to the first one that is.
  useEffect(() => {
    if (!companies?.length) return;
    // A finished queue with no filter on stays finished — never jump back to
    // the first account when the mobile scan completes.
    if (!mobileOnly && !company?.id) return;
    const list = mobileOnly
      ? companies.filter((c) => mobileCompanyIds.has(c.id))
      : companies;
    const pos = company?.id ? list.findIndex((c) => c.id === company.id) : -1;
    if (pos >= 0) {
      if (pos !== index) setIndex(pos);
      return;
    }
    setIndex(0);
    setCompany(list[0] || null);
  }, [mobileOnly, mobileCompanyIds]);

  // Load Twilio connection status + agent number for click-to-dial. The profile
  // and connection reads are independent, so a failure in one never makes the
  // dialer think calling is unconfigured.
  const loadTwilioStatus = useCallback(async () => {
    if (!user?.id) return;
    setTwilioLoaded(false);
    try {
      const res = await base44.functions.invoke("getOrgConnectionStatus", {});
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      const conn = data.connected || {};
      const connected = !!(conn.TWILIO_ACCOUNT_SID && conn.TWILIO_AUTH_TOKEN && conn.TWILIO_FROM_NUMBER);
      const browserVoice = !!data.browserVoice;
      const twilioFromNumber = data.twilioFromNumber || "";
      const profiles = await base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []);
      const profile = profiles?.[0];
      const agentNumber = profile?.telephony_identity || "";
      // Don't use the Twilio number as the agent number — that loops.
      const safeAgent = agentNumber && agentNumber !== twilioFromNumber ? agentNumber : "";
      setTwilioStatus({ connected, browserVoice, fromNumber: twilioFromNumber, agentNumber: safeAgent, checkFailed: false });
    } catch {
      // Keep whatever we last knew; flag it so Dial never silently hands the
      // caller off to the browser's own phone dialler.
      setTwilioStatus((prev) => ({
        connected: prev?.connected || false,
        browserVoice: prev?.browserVoice || false,
        fromNumber: prev?.fromNumber || "",
        agentNumber: prev?.agentNumber || "",
        checkFailed: true,
      }));
    } finally {
      setTwilioLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => { loadTwilioStatus(); }, [loadTwilioStatus]);

  // On mobile, auto-prompt for the agent phone number so Twilio can ring them.
  useEffect(() => {
    if (isMobile && twilioLoaded && twilioStatus?.connected && !twilioStatus?.agentNumber) {
      setEditingAgent(true);
    }
  }, [isMobile, twilioLoaded, twilioStatus]);

  // Sync the browser Voice SDK status into the dialer state machine.
  useEffect(() => {
    if (!browserMode) return;
    if (voice.status === "in_call") {
      setState("in_call");
      setCallEnded(false);
      callStartRef.current = Date.now();
      callEndRef.current = null;
      setDialing(false);
    } else if (voice.status === "connecting" || voice.status === "ringing") {
      setDialing(true);
    } else if (voice.status === "ended") {
      setState("ready");
      setCallEnded(true);
      callEndRef.current = Date.now();
      setDialing(false);
    }
  }, [voice.status, browserMode]);

  // Switch this desk to calling from the browser, which is what lets the
  // on-screen keypad send tones into a live call.
  const enableInAppDialer = async () => {
    setEnablingDialer(true);
    setError("");
    try {
      const res = await base44.functions.invoke("setupBrowserVoice", {});
      const data = res.data || res;
      if (data.error) { setError(data.error); return; }
      setTwilioStatus((s) => ({ ...s, browserVoice: true }));
    } catch (e) {
      setError(e.message || "Could not enable in-app calling.");
    } finally {
      setEnablingDialer(false);
    }
  };

  const saveAgentNumber = async () => {
    const num = agentInput.trim();
    if (!num) return;
    setError("");
    try {
      const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
      if (profiles[0]) {
        await base44.entities.UserProfile.update(profiles[0].id, { telephony_identity: num });
      }
      setTwilioStatus((s) => ({ ...s, agentNumber: num }));
      setAgentInput("");
      setEditingAgent(false);
    } catch {
      setError("Could not save your phone number — check your permissions.");
    }
  };

  // When the current company changes, load its decision-makers + the single
  // reusable CompanyIntelligence record. Never generates research on open.
  useEffect(() => {
    setState("idle");
    setCallEnded(false);
    setContacts([]);
    setSelectedContact(null);
    setIntelligence(null);
    callStartRef.current = null;
    callEndRef.current = null;
    callProviderRef.current = "manual";
    setCallSid(null);
    setShowKeypad(false);
    if (company) {
      setState("ready");
      loadCompanyContext(company);
    }
  }, [company?.id]);

  const loadCompanyContext = async (co) => {
    setLoading(true);
    try {
      const [list, ci] = await Promise.all([
        base44.entities.Contact.filter({ company_id: co.id, id: { $ne: '6afae4e89382d5a14f4bcae0' } }, "-updated_date", 50).catch(() => []),
        base44.entities.CompanyIntelligence.filter({ company_id: co.id }).catch(() => []),
      ]);
      // Anyone flagged do not call has had their details removed, so they stay
      // out of the calling list entirely and can never be dialled.
      const blocked = (list || []).filter((c) => c.do_not_call || c.anonymised_at || c.deleted_at);
      setSuppressedCount(blocked.length);
      const callable = (list || []).filter((c) => !c.do_not_call && !c.anonymised_at && !c.deleted_at);
      // Sort dialable decision-makers first, then least-recently-called.
      const sorted = callable.slice().sort((a, b) => {
        const aBad = ["bad", "dnc"].includes(a.number_status) || !a.phone ? 1 : 0;
        const bBad = ["bad", "dnc"].includes(b.number_status) || !b.phone ? 1 : 0;
        if (aBad !== bBad) return aBad - bBad;
        const ta = a.last_called ? new Date(a.last_called).getTime() : 0;
        const tb = b.last_called ? new Date(b.last_called).getTime() : 0;
        return ta - tb;
      });
      setContacts(sorted);
      setIntelligence(ci && ci[0] ? ci[0] : null);
      // Auto-select the first dialable decision-maker, unless a specific contact was requested.
      const wanted = pendingContactRef.current;
      pendingContactRef.current = "";
      const first = sorted.find((c) => !["bad", "dnc"].includes(c.number_status) && c.phone) || sorted[0] || null;
      const matched = wanted ? sorted.find((c) => c.id === wanted) : null;
      setSelectedContact(matched || first);
    } catch {
      // non-fatal — dialing still works without context
    } finally {
      setLoading(false);
    }
  };

  // Moving past the last account loops back to the first one in the same queue,
  // so a caller always has the next account waiting without leaving the dialer.
  const advance = (list = activeQueue, i = index) => {
    if (!list.length) return;
    const next = i + 1 >= list.length ? 0 : i + 1;
    setIndex(next);
    setCompany(list[next] || null);
  };

  const toE164 = (raw) => {
    let n = (raw || "").replace(/[^\d+]/g, "");
    if (n.startsWith("+")) return n;
    if (n.startsWith("00")) return "+" + n.slice(2);
    // UK national format: leading 0 → +44
    if (n.startsWith("0")) return "+44" + n.slice(1);
    return "+" + n;
  };

  const dial = async () => {
    if (!selectedContact?.phone) return;
    setError("");
    // Browser Voice SDK: call from the computer's mic/speaker directly.
    if (browserMode) {
      setDialing(true);
      try {
        await voice.connect(toE164(selectedContact.phone));
        callProviderRef.current = "twilio";
      } catch (e) {
        setError(e.message || "Browser call failed.");
        setDialing(false);
      }
      return;
    }
    // Twilio click-to-dial: rings the rep first, then bridges to the contact.
    if (twilioStatus?.connected) {
      if (!twilioStatus.agentNumber) {
        setEditingAgent(true);
        setError("Enter your real phone number below so Twilio can ring you first.");
        return;
      }
      setDialing(true);
      try {
        const res = await base44.functions.invoke("twilioCall", {
          action: "dial",
          destination: selectedContact.phone.replace(/\s+/g, ""),
          agent: twilioStatus.agentNumber,
        });
        const data = res.data || res;
        if (data.error) {
          setError(data.error);
          return;
        }
        setCallSid(data.call_uuid || null);
        callProviderRef.current = "twilio";
        setState("in_call");
        setCallEnded(false);
        callStartRef.current = Date.now();
        callEndRef.current = null;
      } catch (e) {
        setError(e.message || "Twilio dial failed.");
      } finally {
        setDialing(false);
      }
      return;
    }
    // The connection check itself failed — never hand the caller off to the
    // browser's phone dialler, which cannot place a call from this screen.
    if (twilioStatus?.checkFailed) {
      setError("Couldn't check your calling connection. Click Retry on the calling status, then dial again — no call has been placed.");
      return;
    }
    // Fallback: native tel: protocol (only when Twilio is definitely NOT connected)
    window.location.href = `tel:${selectedContact.phone.replace(/\s+/g, "")}`;
    callProviderRef.current = "manual";
    setState("in_call");
    setCallEnded(false);
    callStartRef.current = Date.now();
    callEndRef.current = null;
  };

  const hangUp = async () => {
    if (browserMode) { voice.disconnect(); return; }
    if (callSid) {
      try {
        await base44.functions.invoke("twilioCall", { action: "hangup", call_sid: callSid });
      } catch {
        // non-fatal — call may have already ended
      }
      setCallSid(null);
    }
    setState("ready");
    setCallEnded(true);
    callEndRef.current = Date.now();
  };

  const handleOutcome = async (data) => {
    const contact = selectedContact;
    if (!contact) return;
    setSaving(true);
    setError("");
    const duration = callStartRef.current
      ? Math.round(((callEndRef.current || Date.now()) - callStartRef.current) / 1000)
      : 0;
    const sessionItem = sessionMap.get(company?.id);
    try {
      const res = await base44.functions.invoke("completeCallOutcome", {
        task_id: sessionItem?.task_id || "",
        company_id: company?.id || "",
        contact_id: contact.id,
        campaign_id: listId || "",
        outcome: data.outcome,
        notes: data.notes || "",
        client_notes: data.client_notes || "",
        internal_notes: data.internal_notes || "",
        info_request_topic: data.info_request_topic || "",
        territory: data.territory || "",
        account_manager_name: data.account_manager_name || "",
        account_manager_email: data.account_manager_email || "",
        next_action_type: data.next_action_type || "",
        next_action_at: data.next_action_at || "",
        qualification: data.qualification || null,
        conversation_type: data.conversation_type || "",
        started_at: callStartRef.current ? new Date(callStartRef.current).toISOString() : "",
        ended_at: callEndRef.current ? new Date(callEndRef.current).toISOString() : new Date().toISOString(),
        duration_seconds: duration,
        call_provider: callProviderRef.current,
      });
      const callLogId = (res?.data || res)?.call_log_id || "";
      if (callLogId) {
        setLastSavedLog({
          id: callLogId,
          contact_name: contact.full_name || "",
          client_notes: data.client_notes || "",
          internal_notes: data.internal_notes || "",
          notes: [data.client_notes, data.internal_notes].filter(Boolean).join("\n\n"),
        });
      }

      if ((data.outcome === "connected_information_requested" || data.outcome === "connected_send_info")) {
        setIrSentNotice("Information request sent to the admin inbox.");
      }

      if (resolvePrimaryOutcomeCode(data.outcome) === "do_not_call") {
        setDncNotice(`${contact.full_name || "This contact"} was flagged do not call — their details have been removed and they can no longer be dialled.`);
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
        setSuppressedCount((n) => n + 1);
      }

      advance();
      return true;
    } catch (e) {
      setError(e.message || "Could not save call outcome.");
      setState("ready");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // A contact named during the call has been saved — refresh this company's
  // people and put them in the dialling seat.
  const handleContactAdded = async (result) => {
    const added = result?.contact;
    if (!added || !company) return;
    await loadCompanyContext(company);
    const fresh = await base44.entities.Contact.get(added.id).catch(() => added);
    setContacts((prev) =>
      prev.some((c) => c.id === fresh.id) ? prev.map((c) => (c.id === fresh.id ? fresh : c)) : [fresh, ...prev]
    );
    setSelectedContact(fresh);
    setAddedNotice("");
    const found = [];
    if (result?.found?.phone) found.push(`phone ${result.found.phone}`);
    if (result?.found?.email) found.push(`email ${result.found.email}`);
    const notes = (result?.messages || []).filter(Boolean).join(" ");
    if (found.length) {
      setAddedNotice(`${fresh.full_name} added — found ${found.join(" and ")}.`);
    } else if (fresh.phone || fresh.email) {
      setAddedNotice(`${fresh.full_name} added — ready to dial.`);
    } else {
      setAddedNotice(`${fresh.full_name} added — no phone or email yet.${notes ? ` ${notes}` : ""}`);
    }
  };

  // A corrected contact keeps its place in the queue and in the dialling seat.
  const handleContactSaved = (updated) => {
    if (!updated?.id) return;
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelectedContact((cur) => (cur?.id === updated.id ? { ...cur, ...updated } : cur));
    setAddedNotice(`${updated.full_name} updated.`);
  };

  const removeContact = async (reason) => {
    const contact = selectedContact;
    if (!contact) return;
    setError("");
    setSaving(true);
    try {
      await base44.functions.invoke("removeDialerContact", {
        contact_id: contact.id,
        company_id: company?.id || "",
        campaign_id: listId || "",
        removal_reason: reason,
      });
      const remaining = contacts.filter((c) => c.id !== contact.id);
      setContacts(remaining);
      setSelectedContact(remaining[0] || null);
      if (remaining.length === 0) advance();
    } catch (e) {
      setError(e.message || "Could not remove record.");
    } finally {
      setSaving(false);
    }
  };

  if (!companies) return <p className="text-slate-400">Loading your queue…</p>;

  if (companies.length === 0)
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          {listId ? "No companies in this target list" : "No companies yet"}
        </h1>
        <p className="text-slate-500 mt-2">
          {listId ? "Add companies to this target list to start dialing its decision-makers." : "Import data or push prospects from Prospecting to build your queue."}
        </p>
        <div className="flex gap-2 justify-center mt-6">
          {listId && (
            <Link to="/campaigns">
              <Button variant="outline" className="rounded-full border-slate-300">
                <ListChecks className="w-4 h-4 mr-2" /> Back to target lists
              </Button>
            </Link>
          )}
          <Link to="/import">
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700">Import data</Button>
          </Link>
        </div>
      </div>
    );

  if (!company && mobileOnly)
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
        <h1 className="font-display text-2xl font-semibold text-slate-900">No mobile accounts left in this queue</h1>
        <p className="text-slate-500 mt-2">
          Only accounts with a mobile number are shown. Turn the filter off to work the rest of the {companies.length} accounts.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <Button onClick={() => setMobileOnly(false)} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            Show all accounts
          </Button>
          <Button onClick={loadQueue} variant="outline" className="rounded-full border-slate-300">Reload queue</Button>
        </div>
      </div>
    );

  if (!company)
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Queue complete</h1>
        <Button onClick={loadQueue} className="rounded-full mt-6 bg-emerald-600 hover:bg-emerald-700">Reload queue</Button>
      </div>
    );

  const onCall = browserMode ? voice.status === "in_call" : state === "in_call";
  const contact = selectedContact;
  const companyLink = company.website
    ? (/^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`)
    : `https://www.google.com/search?q=${encodeURIComponent(company.name)}`;

  return (
    <div className="grid lg:grid-cols-5 gap-4 md:gap-6">
      <div className="lg:col-span-2 space-y-4">
        {targetList && <TargetListGuide targetList={targetList} />}

        <div className="rounded-3xl bg-slate-900 text-white p-7">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              {mobileOnly ? "Mobile account" : "Company"} {index + 1} of {activeQueue.length}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <QueueFilterToggle
                active={mobileOnly}
                onToggle={() => setMobileOnly((v) => !v)}
                mobileCount={(companies || []).filter((c) => mobileCompanyIds.has(c.id)).length}
                scanning={scanningMobiles}
              />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Dialer settings"
                title="Dialer settings"
                className="text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="font-display text-3xl font-semibold mt-3">
            <a href={companyLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline inline-flex items-center gap-1 align-middle">
              {company.name}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </p>
          <p className="text-slate-400 mt-1">
            {contact ? (
              <>
                {contact.full_name}{contact.job_title ? ` · ${contact.job_title}` : ""}
              </>
            ) : (
              "No decision-maker selected"
            )}
          </p>
          {suppressedCount > 0 && (
            <p className="text-xs text-amber-300 mt-1">
              {suppressedCount} {suppressedCount === 1 ? "contact" : "contacts"} marked do not call · details removed
            </p>
          )}
          <p className="text-emerald-400 mt-1 text-lg font-medium">
            {contact?.phone || "—"}
          </p>
          {contact?.email && (
            <a
              href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(`Following up — ${company.name}`)}`}
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-sky-300 hover:text-sky-200 underline underline-offset-2"
            >
              <Mail className="w-3.5 h-3.5" /> Email follow-up
            </a>
          )}

          {/* Call mode status */}
          {browserMode ? (
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
              <Mic className="w-3 h-3" /> Browser mic · {onCall ? "in call" : dialing ? (voice.status === "ringing" ? "ringing…" : "connecting call…") : voice.ready ? "ready" : "connecting…"}
            </span>
          ) : twilioStatus?.connected ? (
            twilioStatus.agentNumber && !editingAgent ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
                  <Phone className="w-3 h-3" /> Twilio rings you at {twilioStatus.agentNumber}
                </span>
                <button
                  onClick={() => { setEditingAgent(true); setAgentInput(twilioStatus.agentNumber); }}
                  className="text-xs text-slate-400 underline hover:text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-slate-400 mb-2">Enter your real phone — Twilio rings you first, then dials the contact:</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    placeholder="e.g. 01923 729132"
                    className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
                  />
                  <Button onClick={saveAgentNumber} disabled={!agentInput.trim()}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs h-8 px-3">
                    Save
                  </Button>
                </div>
              </div>
            )
          ) : twilioStatus?.checkFailed ? (
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-medium">
              Couldn't check your calling connection
              <button onClick={loadTwilioStatus} className="underline hover:text-amber-200">Retry</button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-white/5 text-slate-400 text-xs">
              tel: mode · <Link to="/settings" className="underline hover:text-white">connect Twilio</Link>
            </span>
          )}
          {!browserMode && !isMobile && twilioStatus?.connected && !twilioStatus?.browserVoice && (
            <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-3">
              <p className="text-xs text-slate-400">
                Call from this screen to use the on-screen keypad for menu options — no phone needed.
              </p>
              <Button
                onClick={enableInAppDialer}
                disabled={enablingDialer}
                className="mt-2 w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs h-8"
              >
                {enablingDialer ? "Setting up…" : "Enable in-app dialer"}
              </Button>
            </div>
          )}
          {contact && (contact.call_count || 0) > 0 && (
            <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-medium">
              Called {contact.call_count}×{isCalledToday(contact) ? " · today" : ""}
            </span>
          )}

          {onCall && (
            <div className="mt-4 flex items-center gap-2 text-emerald-400">
              <CallTimer startRef={callStartRef} />
            </div>
          )}

          <div className="flex gap-3 mt-7">
            <Button
              variant="ghost"
              onClick={() => {
                const prev = index - 1;
                if (prev >= 0) { setIndex(prev); setCompany(activeQueue[prev]); }
              }}
              disabled={index === 0}
              className="rounded-full h-12 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            {!onCall && !dialing ? (
              <Button
                onClick={dial}
                disabled={!contact?.phone || state === "idle" || !twilioLoaded || (!browserMode && twilioStatus?.connected && !twilioStatus.agentNumber)}
                className="rounded-full flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium disabled:opacity-40"
              >
                <><Phone className="w-4 h-4 mr-2" /> {browserMode ? "Dial via browser" : twilioStatus?.connected ? "Dial via Twilio" : "Dial"}</>
              </Button>
            ) : (
              <Button
                onClick={hangUp}
                variant="ghost"
                className="rounded-full flex-1 h-12 text-red-300 hover:text-red-200 hover:bg-red-500/10 border border-red-500/20"
              >
                <><PhoneOff className="w-4 h-4 mr-2" /> End call</>
              </Button>
            )}
            <Button variant="ghost" onClick={() => advance()} className="rounded-full h-12 text-slate-300 hover:text-white hover:bg-white/10">
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
          {contact && (
            <div className="mt-4">
              <Button
                onClick={() => setShowKeypad((open) => !open)}
                className="w-full rounded-xl h-11 bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                <Keyboard className="w-4 h-4 mr-2" />
                {showKeypad ? "Hide keypad" : "Keypad"}
              </Button>
              {showKeypad && (
                <div className="mt-3">
                  {browserMode ? (
                    <>
                      <DialPad onSend={voice.sendDigits} disabled={!onCall} />
                      {!onCall && (
                        <p role="status" className="mt-2 text-xs text-slate-400">
                          {dialing ? "Connecting… the keypad will be available when the call is answered." : "Start a call to use the keypad for menu options."}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
                      {isMobile
                          ? "On a call bridged to your phone, press the numbers on the phone itself."
                          : twilioStatus?.connected
                            ? "Enable the in-app dialer above, then call from here to use these keys."
                            : "Connect Twilio in Settings to call from here with these keys."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {(error || voice.error) && <p className="text-amber-300 text-xs mt-3">{error || voice.error}</p>}
        </div>

        {addedNotice && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
            {addedNotice}
          </p>
        )}
        {irSentNotice && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
            {irSentNotice}
          </p>
        )}
        {dncNotice && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            {dncNotice}
          </p>
        )}
        {lastSavedLog && (
          <LastCallNotesCard log={lastSavedLog} onDismiss={() => setLastSavedLog(null)} />
        )}
        <OutcomePanel
          contact={contact}
          company={company}
          disabled={onCall || !contact}
          saving={saving}
          onSave={handleOutcome}
        />
        {canRemoveRecord && <RemoveControl onRemove={removeContact} disabled={onCall || !contact} />}
      </div>

      <div className="lg:col-span-3 space-y-4">
        <BriefPanel
          company={company}
          intelligence={intelligence}
          contacts={contacts}
          selectedContact={selectedContact}
          onSelectContact={setSelectedContact}
          onAddContact={() => setAddContactOpen(true)}
          onEditContact={setEditingContact}
          loading={loading}
        />
        <CallHistoryPanel contact={selectedContact} company={company} />
      </div>

      <DialerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={audioSettings}
        onSave={(next) => {
          setAudioSettings(saveAudioSettings(next));
          voice.applyLevels(next);
          setSettingsOpen(false);
        }}
      />

      <AddContactDialog
        open={addContactOpen || !!editingContact}
        contact={editingContact}
        onClose={() => { setAddContactOpen(false); setEditingContact(null); }}
        company={company}
        campaignId={listId}
        onAdded={handleContactAdded}
        onSaved={handleContactSaved}
      />

      {(onCall || dialing) && isMobile && (
        <MobileCallBar
          contact={contact}
          company={company}
          onHangUp={hangUp}
          callStartRef={callStartRef}
          dialing={dialing}
        />
      )}
    </div>
  );
}