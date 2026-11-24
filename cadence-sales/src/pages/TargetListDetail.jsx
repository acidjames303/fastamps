import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ArrowLeft, PhoneCall, Plus, Trash2, Loader2, Building2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { assignCompaniesToList, computeListMetrics, fetchListCompanyIds } from "@/lib/targetLists";
import CompanyFilterBar from "@/components/targetlists/CompanyFilterBar";
import CampaignExportButton from '@/components/campaigns/CampaignExportButton';
import DataReadinessPanel from '@/components/campaigns/DataReadinessPanel';
import ReviewQueuePanel from '@/components/campaigns/ReviewQueuePanel';
import {
  EMPTY_FILTERS, filterCompanies, filtersActive, summariseCompanyContacts,
} from "@/lib/companyContactFilters";

const METRICS = [
  { key: "companies", label: "Companies" },
  { key: "contacts", label: "Contacts" },
  { key: "callReady", label: "Call-ready" },
  { key: "callsAttempted", label: "Calls attempted" },
  { key: "answeredCalls", label: "Answered" },
  { key: "conversations", label: "Conversations" },
  { key: "interested", label: "Interested" },
  { key: "opportunities", label: "Opportunities" },
  { key: "badNumbers", label: "Bad numbers" },
];

export default function TargetListDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [members, setMembers] = useState([]); // member companies
  const [allCompanies, setAllCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOffer, setEditOffer] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [l, m, companyIds, all] = await Promise.all([
      base44.entities.Campaign.get(id).catch(() => null),
      computeListMetrics(id),
      fetchListCompanyIds(id),
      base44.entities.Company.filter({ organisation_id: user.organisation_id, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500),
    ]);
    setList(l);
    setMetrics(m);
    const memberCompanies = all.filter((c) => companyIds.includes(c.id));
    setMembers(memberCompanies);
    setAllCompanies(all);
    // Contact numbers decide whether a company is callable and whether it has a
    // mobile, so they load with the list rather than when a row is opened.
    const ids = memberCompanies.map((c) => c.id);
    const rows = ids.length
      ? await base44.entities.Contact.filter(
        { organisation_id: user.organisation_id, company_id: { $in: ids } },
        "-created_date",
        2000,
      ).catch(() => [])
      : [];
    setContacts(rows);
  };

  useEffect(() => { load(); }, [id]);

  const addCompany = async (companyId) => {
    setBusy(true);
    setError("");
    try {
      await assignCompaniesToList(id, [companyId], user.organisation_id, user.id);
      await load();
    } catch (e) {
      setError(e.message || "Could not add company.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setEditName(list.name || "");
    setEditOffer(list.offer || "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.entities.Campaign.update(id, { name: editName.trim(), offer: editOffer.trim() });
      setEditing(false);
      await load();
    } catch (e) {
      setError(e.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };



  const removeMember = async (memberCompanyId) => {
    // Find the TargetListMember row(s) for this company in this list and delete.
    try {
      const rows = await base44.entities.TargetListMember.filter({ target_list_id: id, company_id: memberCompanyId });
      await Promise.all(rows.map((r) => base44.entities.TargetListMember.delete(r.id)));
      await load();
    } catch (e) {
      setError(e.message || "Could not remove company.");
    }
  };

  if (!list) return <p className="text-slate-400">Loading target list…</p>;

  const memberIds = new Set(members.map((c) => c.id));
  const results = query
    ? allCompanies.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  const contactsByCompany = new Map();
  contacts.forEach((contact) => {
    if (!contact.company_id) return;
    if (!contactsByCompany.has(contact.company_id)) contactsByCompany.set(contact.company_id, []);
    contactsByCompany.get(contact.company_id).push(contact);
  });
  const statsFor = (companyId) => summariseCompanyContacts(contactsByCompany.get(companyId) || []);
  const industries = [...new Set(members.map((c) => c.industry).filter(Boolean))].sort();
  const filterActive = filtersActive(filters);
  const visibleMembers = filterCompanies(members, statsFor, filters);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/campaigns" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Target lists
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-3 max-w-2xl">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="List name"
                  className="rounded-xl border-slate-200 text-2xl font-display font-semibold h-12"
                />
                <textarea
                  value={editOffer}
                  onChange={(e) => setEditOffer(e.target.value)}
                  placeholder="Offer / description (optional)"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={saving || !editName.trim()} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                    Save
                  </Button>
                  <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="rounded-full border-slate-300">
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">{list.name}</h1>
                  {list.offer && <p className="text-slate-500 mt-2 max-w-2xl">{list.offer}</p>}
                </div>
                <button onClick={startEdit} className="mt-2 text-slate-400 hover:text-slate-900 shrink-0" title="Edit name and info">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          {!editing && (
            <div className="flex flex-wrap gap-2">
              <CampaignExportButton campaignId={id} />
              <Link to={`/campaign-delivery/${id}`}><Button variant="outline">Campaign overview</Button></Link>
              <Link to={`/dialer?list=${list.id}`}>
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-500 h-11 px-6">
                  <PhoneCall className="w-4 h-4 mr-2" /> Start dialing
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
              <p className="text-2xl font-display font-semibold text-slate-900">{metrics[m.key] ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      <DataReadinessPanel campaignId={id} />
      <ReviewQueuePanel campaignId={id} onChanged={load} />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Companies in this list</h2>
          <p className="text-xs text-slate-400 mt-1">{members.length} linked · one company can sit in many lists.</p>
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 mt-4">No companies linked yet — add some below.</p>
          ) : (
            <>
              <CompanyFilterBar
                filters={filters}
                setFilters={setFilters}
                industries={industries}
                total={members.length}
                shown={visibleMembers.length}
                active={filterActive}
                onClear={() => setFilters(EMPTY_FILTERS)}
              />
              {visibleMembers.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-6 text-center">
                  <p className="text-sm text-slate-500">No companies match these filters.</p>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-xs text-emerald-700 hover:text-emerald-800 mt-2"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {visibleMembers.map((c) => {
                    const stats = statsFor(c.id);
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-2.5 hover:border-emerald-200 transition-colors">
                        <Link to={`/dialer?list=${list.id}&company=${c.id}`} className="flex items-center gap-2 min-w-0 flex-1 group/row">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate group-hover/row:text-emerald-600">{c.name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.industry || "—"} · {c.employee_range || "size n/a"}</p>
                            <p className={`text-xs truncate ${stats.mobiles > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                              {stats.mobiles > 0
                                ? `${stats.mobiles} mobile${stats.mobiles === 1 ? "" : "s"}`
                                : "No mobile"}
                              {" · "}
                              {stats.people} contact{stats.people === 1 ? "" : "s"}
                              {stats.called ? " · called" : ""}
                            </p>
                          </div>
                          <PhoneCall className="w-4 h-4 text-slate-300 group-hover/row:text-emerald-600 ml-auto shrink-0" />
                        </Link>
                        <button onClick={() => removeMember(c.id)} className="text-slate-400 hover:text-rose-500 shrink-0" title="Remove from list">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Add companies</h2>
          <p className="text-xs text-slate-400 mt-1">Search your existing companies to link them.</p>
          <div className="relative mt-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company name…"
              className="rounded-xl border-slate-200"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.industry || "—"}</p>
                  </div>
                  {memberIds.has(c.id) ? (
                    <span className="text-xs text-emerald-600 shrink-0">Already linked</span>
                  ) : (
                    <Button onClick={() => addCompany(c.id)} disabled={busy} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {query && results.length === 0 && <p className="text-sm text-slate-400 mt-3">No matching companies. Import or prospect more first.</p>}
          {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}
          <div className="mt-5 flex gap-2">
            <Link to="/import" className="flex-1">
              <Button variant="outline" className="rounded-full border-slate-300 w-full">Import companies</Button>
            </Link>
            <Link to="/prospecting" className="flex-1">
              <Button variant="outline" className="rounded-full border-slate-300 w-full">Prospect</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}