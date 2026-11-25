import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { PROVIDER_LABELS } from "@/lib/providerConfig";
import PhoneCoverageOptions from "@/components/prospecting/enrich/PhoneCoverageOptions";
import RunEstimatePanel from "@/components/prospecting/enrich/RunEstimatePanel";
import {
  ALL_PROVIDERS,
  PROVIDER_KEY_MAP,
  buildRunEstimate,
  startButtonLabel,
  validateRun,
} from "@/lib/enrichmentRun";

const SEARCH_METHODS = [
  {
    key: "free",
    label: "Free inference",
    detail: "No provider or Smart Action calls. Reuses stored names, organisation data and known email formats.",
    cost: "No external calls",
  },
  {
    key: "public",
    label: "Public research",
    detail: "Adds public web research without calling Apollo, Lusha or FullEnrich.",
    cost: "May use Smart Actions",
  },
  {
    key: "providers",
    label: "Connected providers",
    detail: "Reveals missing details for named contacts from the providers you select.",
    cost: "May use provider credits",
  },
];

const SEARCH_DEPTHS = [
  { key: "standard", label: "Standard", detail: "Best ICP contact first (still widens when other-known is on)" },
  { key: "expanded", label: "Expanded", detail: "Mobiles for every already-known contact (recommended)" },
  { key: "exhaustive", label: "Exhaustive", detail: "Maximum search across known people" },
];

function applyMaximumSearchPreset(setters) {
  const {
    setFindOptions,
    setSearchMethod,
    setSearchDepth,
    setPhoneCoverage,
    setFindStrongerDecisionMaker,
    setExistingInfoMode,
    setConfirmOpen,
  } = setters;
  setFindOptions(["decision_maker", "personal_email", "direct_phone", "company_information"]);
  setSearchMethod("providers");
  setSearchDepth("exhaustive");
  setPhoneCoverage({ best: true, otherKnown: true, discover: true });
  setFindStrongerDecisionMaker(true);
  setExistingInfoMode("newer");
  setConfirmOpen(false);
}

const FIND_OPTIONS = [
  {
    key: "decision_maker",
    label: "Best decision-maker",
    detail: "Finds the strongest contact matching the list's ICP",
  },
  {
    key: "personal_email",
    label: "Personal work email",
    detail: "Finds or infers an individual's work email",
  },
  {
    key: "direct_phone",
    label: "Direct or mobile number",
    detail: "Mobile and direct dial for a named contact",
  },
  {
    key: "company_information",
    label: "Company information",
    detail: "Includes company phone, website, industry, size and location",
  },
];

function RadioCard({ checked, label, detail, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        checked
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/10"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
            checked ? "border-emerald-600" : "border-slate-300"
          }`}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">{label}</span>
            {badge && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  checked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {badge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{detail}</span>
        </span>
      </div>
    </button>
  );
}

export default function SelectiveEnrichDialog({
  open,
  onClose,
  selectedProspects,
  allProspects,
  listId,
  connectedProviders,
  intent = "general",
  onStarted,
}) {
  const phoneIntent = intent === "phone";

  // Mobile-first defaults: prospecting normally looks for the best contact,
  // their work email and a dialable mobile/direct number. When Lusha is
  // connected the dialog switches to provider search automatically.
  const [findOptions, setFindOptions] = useState(
    phoneIntent ? ["direct_phone"] : ["decision_maker", "personal_email", "direct_phone"],
  );
  // Default to connected providers when Lusha is available — credits are not the constraint.
  const [searchMethod, setSearchMethod] = useState("providers");
  const [searchDepth, setSearchDepth] = useState("expanded");
  const [phoneCoverage, setPhoneCoverage] = useState({ best: true, otherKnown: true, discover: false });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [existingInfoMode, setExistingInfoMode] = useState("missing");
  const [findStrongerDecisionMaker, setFindStrongerDecisionMaker] = useState(intent === "better");
  const [includeAlternativeEmail, setIncludeAlternativeEmail] = useState(false);
  const [companyFields, setCompanyFields] = useState(["company_phone", "company_intelligence"]);
  const [inferEmailPattern, setInferEmailPattern] = useState(true);
  const [manualPatternEmail, setManualPatternEmail] = useState("");
  const [manualPatternType, setManualPatternType] = useState("firstinitiallastname");
  const [enabledProviders, setEnabledProviders] = useState(null);
  const [freePhoneAcknowledged, setFreePhoneAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const startInFlightRef = useRef(false);
  const intentAppliedRef = useRef(false);

  const prospects = selectedProspects.length ? selectedProspects : allProspects;
  const connectedList = useMemo(
    () => ALL_PROVIDERS.filter((provider) => !!connectedProviders?.[PROVIDER_KEY_MAP[provider]]),
    [connectedProviders],
  );

  useEffect(() => {
    if (!open) {
      intentAppliedRef.current = false;
      setConfirmOpen(false);
      return;
    }
    setErr("");
    if (enabledProviders === null && connectedList.length) {
      // Lusha is the default phone source. Other connected providers remain
      // available as explicit fallbacks without being called automatically.
      setEnabledProviders(connectedList.includes("lusha") ? ["lusha"] : [...connectedList]);
    }
    // With unlimited Lusha, open on Connected providers whenever Lusha is linked.
    if (connectedList.includes("lusha")) {
      setSearchMethod((current) => (current === "free" ? "providers" : current));
    }
  }, [open, connectedList]);

  const requestedFields = useMemo(() => {
    const fields = [];
    if (findOptions.includes("decision_maker")) fields.push("decision_maker_role");
    if (findOptions.includes("personal_email")) {
      fields.push("personal_email");
      if (includeAlternativeEmail) fields.push("alternative_email");
    }
    if (findOptions.includes("direct_phone")) fields.push("mobile", "direct_dial");
    if (findOptions.includes("company_information")) fields.push(...companyFields);
    return [...new Set(fields)];
  }, [findOptions, includeAlternativeEmail, companyFields]);

  const estimate = useMemo(
    () =>
      buildRunEstimate({
        prospects,
        requestedFields,
        searchMethod,
        searchDepth,
        phoneCoverage,
        connectedProviders,
      }),
    [prospects, requestedFields, searchMethod, searchDepth, phoneCoverage, connectedProviders],
  );

  const validation = validateRun({ requestedFields, searchMethod, connectedList });
  const phoneInFreeMode = estimate.phoneSelected && searchMethod !== "providers";
  const showFreePhoneWarning = phoneInFreeMode && !freePhoneAcknowledged;

  const toggleFindOption = (key) => {
    const next = findOptions.includes(key)
      ? findOptions.filter((item) => item !== key)
      : [...findOptions, key];
    setFindOptions(next);
    setConfirmOpen(false);
    setFreePhoneAcknowledged(false);
    // Selecting a field never changes the chosen search method.
  };

  const selectMethod = (method) => {
    setSearchMethod(method);
    setConfirmOpen(false);
    setErr("");
    setFreePhoneAcknowledged(false);
    if (method === "free") setInferEmailPattern(true);
  };

  const start = async () => {
    if (validation.blocked) {
      setErr(validation.message);
      return;
    }
    if (showFreePhoneWarning) {
      setErr("Choose how to continue: reuse the numbers you already hold, or switch to connected providers.");
      return;
    }
    // Never spend provider credits without an explicit confirmation.
    if (searchMethod === "providers" && !confirmOpen) {
      setConfirmOpen(true);
      setErr("");
      return;
    }
    if (!prospects.length) {
      setErr("No prospects selected.");
      return;
    }
    if (startInFlightRef.current) return;

    startInFlightRef.current = true;
    setStarting(true);
    setErr("");

    try {
      const idempotencyKey = `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const strictZeroCredit = searchMethod === "free";
      const providerFreeMode = searchMethod !== "providers";
      const effectiveProviders =
        searchMethod === "providers" ? enabledProviders || connectedList : [];
      const discoverContacts = !!phoneCoverage.discover;

      const response = await base44.functions.invoke("startEnrichmentJob", {
        prospect_list_id: listId,
        prospect_ids: prospects.map((prospect) => prospect.id),
        requested_fields: requestedFields,
        only_missing_fields: existingInfoMode === "missing",
        check_newer_info: existingInfoMode === "newer",
        force_refresh:
          existingInfoMode === "newer" ||
          searchDepth === "exhaustive" ||
          discoverContacts,
        email_only:
          requestedFields.length > 0 &&
          requestedFields.every((field) =>
            ["personal_email", "alternative_email", "decision_maker_role"].includes(field),
          ),
        single_best_contact: searchDepth === "standard" && !phoneCoverage.otherKnown,
        widen_mobile_search: phoneCoverage.otherKnown || searchDepth !== "standard",
        search_depth: searchDepth,
        find_stronger_decision_maker: findStrongerDecisionMaker || discoverContacts,
        infer_email_pattern: inferEmailPattern,
        provider_free_mode: providerFreeMode,
        strict_zero_credit: strictZeroCredit,
        manual_pattern_email: prospects.length === 1 ? manualPatternEmail : "",
        manual_pattern_type:
          prospects.length === 1 && manualPatternEmail ? manualPatternType : "",
        selected_providers: effectiveProviders,
        idempotency_key: idempotencyKey,
      });

      const data = response.data || response;
      if (data.error) throw new Error(data.error);
      if (!data.session_id) {
        throw new Error("Could not start enrichment — no session was created.");
      }

      onStarted(data);
      onClose();
    } catch (error) {
      setErr(
        error?.response?.data?.error ||
          error?.message ||
          "Could not start enrichment. Please try again.",
      );
    } finally {
      setStarting(false);
      startInFlightRef.current = false;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-4 sm:max-h-[calc(100vh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-none items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Enrich {prospects.length} record{prospects.length === 1 ? "" : "s"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-medium text-slate-600">{estimate.recordsToProcess}</span> need
              information · {estimate.cached} already contain the requested data
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close enrichment"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-950">Maximum search</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                  Find ICP people, personal emails and mobiles for every already-known contact —
                  then discover more relevant people if needed. One clear full-power run.
                </p>
              </div>
              <Button
                type="button"
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 shrink-0"
                onClick={() =>
                  applyMaximumSearchPreset({
                    setFindOptions,
                    setSearchMethod,
                    setSearchDepth,
                    setPhoneCoverage,
                    setFindStrongerDecisionMaker,
                    setExistingInfoMode,
                    setConfirmOpen,
                  })
                }
              >
                <Search className="w-4 h-4 mr-1.5" />
                Use Maximum search
              </Button>
            </div>
            {searchDepth === "exhaustive" && phoneCoverage.otherKnown && phoneCoverage.discover && searchMethod === "providers" && (
              <p className="mt-3 text-[11px] font-medium text-emerald-800">
                Maximum search is selected — review the estimate below, then start.
              </p>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              What do you want to find?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIND_OPTIONS.map((option) => {
                const checked = findOptions.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleFindOption(option.key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {findOptions.includes("personal_email") && inferEmailPattern && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
                <span>
                  Known company email formats will be used first at no cost. Inferred emails remain
                  marked unverified.
                </span>
              </div>
            )}

            {showFreePhoneWarning && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    Free inference cannot retrieve new phone numbers. Cadence will only reuse phone
                    numbers already stored in your organisation.
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setFreePhoneAcknowledged(true)}
                    variant="outline"
                    className="rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  >
                    Continue with existing data only
                  </Button>
                  <Button
                    onClick={() => selectMethod("providers")}
                    disabled={!connectedList.length}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-500"
                  >
                    Use connected providers
                  </Button>
                </div>
                {!connectedList.length && (
                  <p className="mt-2 text-xs text-amber-700">
                    No provider is connected yet — connect one in Settings to retrieve new numbers.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              How should Cadence search?
            </p>
            <div className="space-y-2">
              {SEARCH_METHODS.map((method) => (
                <RadioCard
                  key={method.key}
                  checked={searchMethod === method.key}
                  label={method.label}
                  detail={method.detail}
                  badge={method.cost}
                  onClick={() => selectMethod(method.key)}
                />
              ))}
            </div>
            {searchMethod === "providers" && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Connected providers
                </p>
                {connectedList.length ? (
                  <div className="space-y-2">
                    {connectedList.map((provider) => {
                      const checked = (enabledProviders || connectedList).includes(provider);
                      return (
                        <label key={provider} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              setConfirmOpen(false);
                              setEnabledProviders((current) => {
                                const active = current || [...connectedList];
                                return value === true
                                  ? [...new Set([...active, provider])]
                                  : active.filter((item) => item !== provider);
                              });
                            }}
                          />
                          {PROVIDER_LABELS[provider] || provider}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    No providers are connected. Connect one in Settings to use this method.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Search depth
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SEARCH_DEPTHS.map((depth) => (
                <RadioCard
                  key={depth.key}
                  checked={searchDepth === depth.key}
                  label={depth.label}
                  detail={depth.detail}
                  onClick={() => {
                    setSearchDepth(depth.key);
                    setConfirmOpen(false);
                  }}
                />
              ))}
            </div>
            {searchDepth === "exhaustive" && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                Exhaustive search uses every source permitted by the selected search method and
                spending limits. It cannot enable a provider or Smart Action by itself.
              </div>
            )}
          </section>

          {estimate.phoneSelected && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Phone coverage
              </p>
              <PhoneCoverageOptions
                value={phoneCoverage}
                onChange={(next) => {
                  setPhoneCoverage(next);
                  setConfirmOpen(false);
                }}
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Connected providers reveal details for named contacts — they do not discover every
                employee at a company.
              </p>
            </section>
          )}

          <section>
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">Advanced options</span>
                <span className="block text-xs text-slate-500">
                  Refresh rules, stronger contact, known email patterns and company fields
                </span>
              </span>
              {advancedOpen ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {advancedOpen && (
              <div className="mt-3 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Existing information
                  </p>
                  <div className="space-y-2">
                    <RadioCard
                      checked={existingInfoMode === "missing"}
                      label="Fill missing information only"
                      detail="Recommended. Existing information is never overwritten."
                      onClick={() => setExistingInfoMode("missing")}
                    />
                    <RadioCard
                      checked={existingInfoMode === "newer"}
                      label="Check existing information for updates"
                      detail="Possible conflicts are sent to review."
                      onClick={() => setExistingInfoMode("newer")}
                    />
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <Checkbox
                      checked={findStrongerDecisionMaker}
                      onCheckedChange={(value) => {
                        setFindStrongerDecisionMaker(value === true);
                        if (value === true && !findOptions.includes("decision_maker")) {
                          setFindOptions((current) => [...current, "decision_maker"]);
                        }
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        Find a stronger decision-maker
                      </span>
                      <span className="block text-xs text-slate-500">
                        Replace the primary contact only when Cadence finds a stronger ICP match.
                      </span>
                    </span>
                  </label>
                </div>

                {findOptions.includes("personal_email") && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Email options
                    </p>
                    <label className="flex cursor-pointer items-start gap-2">
                      <Checkbox
                        checked={inferEmailPattern}
                        disabled={searchMethod === "free"}
                        onCheckedChange={(value) => setInferEmailPattern(value === true)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Use known email formats first
                        </span>
                        <span className="block text-xs text-slate-500">
                          Always enabled for Free inference. Generated addresses are unverified.
                        </span>
                      </span>
                    </label>
                    <label className="mt-2 flex cursor-pointer items-start gap-2">
                      <Checkbox
                        checked={includeAlternativeEmail}
                        onCheckedChange={(value) => setIncludeAlternativeEmail(value === true)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Include a secondary email
                        </span>
                        <span className="block text-xs text-slate-500">
                          Search for an alternative only when the primary email is unavailable.
                        </span>
                      </span>
                    </label>

                    {prospects.length === 1 && (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="text-sm font-medium text-slate-900">Know one company email?</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Add a confirmed example to infer other named contacts without provider calls.
                        </p>
                        <input
                          type="email"
                          value={manualPatternEmail}
                          onChange={(event) => setManualPatternEmail(event.target.value)}
                          placeholder="e.g. emurphy@company.co.uk"
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        />
                        <select
                          value={manualPatternType}
                          onChange={(event) => setManualPatternType(event.target.value)}
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="firstinitiallastname">First initial + surname</option>
                          <option value="firstname.lastname">First name.surname</option>
                          <option value="firstname">First name</option>
                          <option value="firstnamelastinitial">First name + surname initial</option>
                          <option value="firstnamelastname">First name + surname</option>
                          <option value="lastname.firstname">Surname.first name</option>
                          <option value="lastnamefirstname">Surname + first name</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {findOptions.includes("company_information") && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Company fields
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        ["company_phone", "Company phone"],
                        ["company_intelligence", "Industry, size, location and website"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={companyFields.includes(key)}
                            onCheckedChange={() =>
                              setCompanyFields((current) =>
                                current.includes(key)
                                  ? current.filter((item) => item !== key)
                                  : [...current, key],
                              )
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <RunEstimatePanel estimate={estimate} searchMethod={searchMethod} />

          {validation.blocked && validation.message && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              {validation.message}
            </div>
          )}

          {confirmOpen && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Confirm this paid run</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                This run may make up to {estimate.maxLushaLookups} Lusha lookup
                {estimate.maxLushaLookups === 1 ? "" : "s"}
                {estimate.maxOtherProviderLookups > 0
                  ? ` and up to ${estimate.maxOtherProviderLookups} other-provider lookup${estimate.maxOtherProviderLookups === 1 ? "" : "s"}`
                  : ""}
                {estimate.maxSmartActions > 0
                  ? `, and up to ${estimate.maxSmartActions} Smart Action${estimate.maxSmartActions === 1 ? "" : "s"}`
                  : ""}
                . Existing numbers are reused before any lookup.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={start} disabled={starting} className="rounded-full bg-emerald-600 hover:bg-emerald-500">
                  {starting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                  Confirm and start
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full text-emerald-900 hover:bg-emerald-100"
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              {err}
            </div>
          )}
        </div>

        <div className="flex flex-none items-center gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
          <Button onClick={onClose} variant="ghost" className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={start}
            disabled={starting || validation.blocked || estimate.recordsToProcess === 0}
            className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {starting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : searchMethod === "free" ? (
              <RefreshCw className="mr-1 h-4 w-4" />
            ) : (
              <Search className="mr-1 h-4 w-4" />
            )}
            {starting ? "Preparing enrichment session" : startButtonLabel(searchMethod)}
          </Button>
        </div>
      </div>
    </div>
  );
}