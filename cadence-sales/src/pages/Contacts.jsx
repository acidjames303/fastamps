import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ContactRow from "@/components/contacts/ContactRow";
import ContactDetailModal from "@/components/contacts/ContactDetailModal";
import ContactDeleteDialog from "@/components/contacts/ContactDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Download, X, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AddToListMenu from "@/components/targetlists/AddToListMenu";
import ContextHelp from "@/components/help/ContextHelp";
import { useAuth } from "@/lib/AuthContext";

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [organising, setOrganising] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detailContact, setDetailContact] = useState(null);
  const [deleteContact, setDeleteContact] = useState(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState(
    () => new URLSearchParams(window.location.search).get("campaign") || "all"
  );
  const [campaignScope, setCampaignScope] = useState(null);
  const navigate = useNavigate();

  const isAdmin = ["platform_owner", "organisation_admin"].includes(user?.app_role);

  // Contacts whose details were erased after a do-not-call request are not
  // listed — only the suppression record and audit trail remain.
  const load = () => base44.entities.Contact.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e89382d5a14f4bcae0' } }, "-updated_date", 500)
    .then((rows) => setContacts((rows || []).filter((c) => !c.anonymised_at && !c.deleted_at)));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    base44.entities.Campaign.list("-created_date", 100).then((rows) => setCampaigns(rows || [])).catch(() => {});
  }, []);

  // Choosing a campaign narrows the list to the companies and people inside it.
  useEffect(() => {
    if (campaignId === "all") { setCampaignScope(null); return; }
    let alive = true;
    setCampaignScope({ companies: new Set(), contacts: new Set() });
    base44.entities.TargetListMember.filter({ target_list_id: campaignId }, "-created_date", 500)
      .then((rows) => {
        if (!alive) return;
        setCampaignScope({
          companies: new Set((rows || []).map((r) => r.company_id).filter(Boolean)),
          contacts: new Set((rows || []).map((r) => r.contact_id).filter(Boolean)),
        });
      })
      .catch(() => { if (alive) setCampaignScope({ companies: new Set(), contacts: new Set() }); });
    return () => { alive = false; };
  }, [campaignId]);

  const toggleSelect = (id, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const selectAll = (checked, list) => {
    if (checked) setSelected(new Set((list || filtered || []).map((c) => c.id)));
    else setSelected(new Set());
  };

  const organise = async () => {
    setOrganising(true);
    const selectedContacts = contacts.filter((c) => selected.has(c.id));
    const targets = (selectedContacts.length > 0 ? selectedContacts : contacts.filter((c) => !c.cluster))
      .slice(0, 60);
    if (targets.length) {
      const response = await base44.functions.invoke("runSmartAction", {
        action_type: "contact_organisation",
        prompt: `Categorise these B2B records. For each, assign a "cluster" (a short label grouping companies that are similar by industry/size/model) and a "profile_type" (the buyer profile of the person, e.g. "Owner-operator", "Ops decision maker", "Technical gatekeeper").
Records:
${targets.map((c) => `${c.id} | ${c.full_name} | ${c.job_title} | ${c.company} | ${c.industry} | ${c.employee_range}`).join("\n")}`,
        response_json_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, cluster: { type: "string" }, profile_type: { type: "string" } },
              },
            },
          },
        },
      });
      const res = response.data?.result ?? response.result ?? {};
      const updates = (res.results || []).map((r) => ({ id: r.id, cluster: r.cluster, profile_type: r.profile_type }));
      if (updates.length) await base44.entities.Contact.bulkUpdate(updates);
      setSelected(new Set());
      await load();
    }
    setOrganising(false);
  };

  const briefSummary = (text) => {
    if (!text) return "";
    try { const o = JSON.parse(text); return o.summary || ""; } catch { return text; }
  };

  const exportCsv = () => {
    const rows = [["Name", "Title", "Company", "Phone", "Email", "Industry", "Company size", "Location", "Turnover estimate", "Cluster", "Profile", "Number status", "Call status", "Last called", "What they do", "Notes"]];
    contacts.forEach((c) =>
      rows.push([
        c.full_name, c.job_title, c.company, c.phone, c.email, c.industry,
        c.employee_range, c.location, c.turnover_estimate, c.cluster, c.profile_type,
        c.number_status, c.call_status, c.last_called ? new Date(c.last_called).toLocaleString() : "",
        briefSummary(c.ai_brief), c.notes,
      ])
    );
    const csv = rows.map((r) => r.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadence-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      if (bulkDelete) {
        const ids = [...selected];
        for (const id of ids) {
          await base44.entities.Contact.delete(id);
        }
        setBulkDelete(false);
        setSelected(new Set());
      } else if (deleteContact) {
        await base44.entities.Contact.delete(deleteContact.id);
        setDeleteContact(null);
        setSelected((prev) => { const n = new Set(prev); n.delete(deleteContact.id); return n; });
      }
      await load();
    } catch (e) {
      // non-fatal
    } finally {
      setDeleting(false);
    }
  };

  // Opening a person goes straight to their campaign queue in the Dialer, with
  // their call history on screen, so calling carries on from that point.
  const openInDialer = (c) => {
    const params = new URLSearchParams({ contact: c.id });
    if (campaignId !== "all") params.set("list", campaignId);
    if (c.company_id) params.set("company", c.company_id);
    navigate(`/dialer?${params.toString()}`);
  };

  if (!contacts) return <p className="text-slate-400">Loading data…</p>;

  const selectedContacts = contacts.filter((c) => selected.has(c.id));

  const industries = [...new Set(contacts.map((c) => c.industry).filter(Boolean))].sort();

  const filtered = contacts.filter((c) => {
    const matchQ = !q || `${c.full_name} ${c.company} ${c.phone} ${c.industry}`.toLowerCase().includes(q.toLowerCase());
    const matchF =
      filter === "all" ||
      (filter === "bad" && c.number_status === "bad") ||
      (filter === "good" && c.number_status === "good") ||
      (filter === "unclustered" && !c.cluster);
    const matchIndustry = industryFilter === "all" || c.industry === industryFilter;
    const matchCampaign =
      !campaignScope ||
      campaignScope.companies.has(c.company_id) ||
      campaignScope.contacts.has(c.id);
    return matchQ && matchF && matchIndustry && matchCampaign;
  });

  const filters = [
    { key: "all", label: "All" },
    { key: "good", label: "Verified" },
    { key: "bad", label: "Bad numbers" },
    { key: "unclustered", label: "Needs organising" },
  ];

  const selectedCompanyIds = [...new Set(
    contacts.filter((c) => selected.has(c.id)).map((c) => c.company_id).filter(Boolean)
  )];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Data</h1>
          <p className="text-slate-500 mt-2">
            {campaignId === "all"
              ? `${contacts.length} records`
              : `${filtered.length} of ${contacts.length} records · ${campaigns.find((x) => x.id === campaignId)?.name || "campaign"}`} · grouped by company similarity and buyer profile. <ContextHelp title="Why a contact is blocked">A contact may be blocked due to a do-not-call request, suppression list match, or invalid number. Blocked contacts are skipped in the dialer to maintain compliance.</ContextHelp></p>
        </div>
        <div className="flex gap-2 items-center">
          <AddToListMenu
            companyIds={selected.size > 0 ? selectedCompanyIds : [...new Set(filtered.map((c) => c.company_id).filter(Boolean))]}
            label={selected.size > 0 ? `Add ${selected.size} to list` : "Add to list"}
            onDone={() => setSelected(new Set())}
          />
          <Button variant="outline" onClick={exportCsv} className="rounded-full border-slate-300">
            <Download className="w-4 h-4 mr-2" /> Export sheet
          </Button>
          <Button onClick={organise} disabled={organising} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            {organising ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {selected.size > 0 ? `Organise ${selected.size}` : "Organise batch"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company, number…"
          className="rounded-full bg-white border-slate-200 max-w-sm"
        />
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filter === f.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Industry filter */}
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm bg-white border border-slate-200 text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option value="all">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
        {/* Campaign filter — see the contacts working inside one campaign */}
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm bg-white border border-slate-200 text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selected.size > 0 && (
          <div className="inline-flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setBulkDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
              >
                <Trash2 className="w-3 h-3" /> Delete {selected.size}
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X className="w-3 h-3" /> {selected.size} selected · Clear
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-7 gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-widest text-slate-400 items-center">
          <span className="w-4">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
              onChange={(e) => selectAll(e.target.checked, filtered)}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
          </span>
          <span>Person</span><span>Company</span><span>Industry</span><span>Batch</span><span>Profile</span><span>Number</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-slate-400 text-sm">No records match.</p>
        ) : (
          filtered.slice(0, 200).map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              selected={selected.has(c.id)}
              onSelect={toggleSelect}
              onClick={openInDialer}
              onEdit={setDetailContact}
              onDeleteRequest={setDeleteContact}
              isAdmin={isAdmin}
              campaignId={campaignId === "all" ? "" : campaignId}
            />
          ))
        )}
      </div>

      <ContactDetailModal
        key={detailContact?.id || 'none'}
        contact={detailContact}
        open={!!detailContact}
        onOpenChange={(open) => { if (!open) setDetailContact(null); }}
        onSaved={load}
      />
      <ContactDeleteDialog
        contact={deleteContact}
        contacts={bulkDelete ? selectedContacts : null}
        open={!!deleteContact || bulkDelete}
        onOpenChange={(open) => { if (!open) { setDeleteContact(null); setBulkDelete(false); } }}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}