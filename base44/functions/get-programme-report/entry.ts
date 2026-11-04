import { createClientFromRequest } from "npm:@base44/sdk";

const PAGE_SIZE = 500;
const REWARD_PER_INSTALL = 10;
const USAGE_FEE_PER_INSTALL = 5;
const REFERENCE_CHARGER_VALUE = 220;

function toDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function rangeStart(range: string) {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function inRange(record: Record<string, unknown>, start: Date | null, dateField = "created_date") {
  if (!start) return true;
  const date = toDate(record[dateField]) || toDate(record.created_date);
  return Boolean(date && date >= start);
}

async function listAll(entity: any) {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const page = await entity.list("-created_date", PAGE_SIZE, offset);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function dayKey(value: unknown) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function humanStatus(value: unknown) {
  const text = String(value || "Not recorded").replaceAll("_", " ").trim();
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ukDate(value: unknown, includeTime = false) {
  const date = toDate(value);
  if (!date) return "Not recorded";
  return date.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

function rangeFilename(range: string) {
  return range === "all" ? "all-time" : range.replace("d", "-days");
}

function asCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function normalizeDistributor(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(electrical|supplies|wholesale|wholesalers|limited|ltd|plc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function boughtAwayFromNomination(nominatedValue: unknown, actualValue: unknown) {
  const nominated = normalizeDistributor(nominatedValue);
  const actual = normalizeDistributor(actualValue);
  if (!nominated || !actual || actual === "not provided") return false;
  if (nominated.includes("multiple") || nominated.includes("not sure")) return false;
  return nominated !== actual && !nominated.includes(actual) && !actual.includes(nominated);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user?.email || user.role !== "admin") {
      return Response.json({ error: "FastAmps team access only." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const range = ["7d", "30d", "90d", "all"].includes(body.range) ? body.range : "30d";
    const start = rangeStart(range);

    const [allInstallers, allClaims, allVouchers] = await Promise.all([
      listAll(base44.asServiceRole.entities.Installer),
      listAll(base44.asServiceRole.entities.InstallClaim),
      listAll(base44.asServiceRole.entities.VoucherRequest),
    ]);

    const installers = allInstallers.filter((item) => !item.excluded_from_reporting && inRange(item, start));
    const claims = allClaims.filter((item) => !item.excluded_from_reporting && inRange(item, start));
    const vouchers = allVouchers.filter((item) => !item.excluded_from_reporting && inRange(item, start, "requested_date"));
    const approved = claims.filter((claim) => claim.status === "approved");
    const rejected = claims.filter((claim) => claim.status === "rejected");
    const pending = claims.filter((claim) => !["approved", "rejected"].includes(claim.status));

    const claimsByInstaller = new Map<string, number>();
    for (const claim of approved) {
      const email = String(claim.installer_email || "").toLowerCase();
      if (email) claimsByInstaller.set(email, (claimsByInstaller.get(email) || 0) + 1);
    }
    const activeInstallers = claimsByInstaller.size;
    const installerReportEmails = new Set([
      ...installers.map((installer) => String(installer.user_email || '').toLowerCase()).filter(Boolean),
      ...claims.map((claim) => String(claim.installer_email || '').toLowerCase()).filter(Boolean),
    ]);
    const repeatInstallers = [...claimsByInstaller.values()].filter((count) => count >= 2).length;
    const installationRewardCost = approved.reduce(
      (total, claim) => total + Number(claim.reward_amount || REWARD_PER_INSTALL),
      0,
    );
    const welcomeRewardCost = installers
      .filter((installer) => installer.welcome_reward_status)
      .reduce((total, installer) => total + Number(installer.welcome_reward_amount || 10), 0);
    const rewardCost = installationRewardCost + welcomeRewardCost;
    const usageFeeCost = approved.length * USAGE_FEE_PER_INSTALL;
    const programmeCost = rewardCost + usageFeeCost;
    const referenceOrderValue = approved.length * REFERENCE_CHARGER_VALUE;

    const trendMap = new Map<string, { date: string; registrations: number; submitted: number; approved: number }>();
    const addTrend = (date: string, field: "registrations" | "submitted" | "approved") => {
      if (!date) return;
      const row = trendMap.get(date) || { date, registrations: 0, submitted: 0, approved: 0 };
      row[field] += 1;
      trendMap.set(date, row);
    };
    installers.forEach((item) => addTrend(dayKey(item.created_date), "registrations"));
    claims.forEach((item) => addTrend(dayKey(item.created_date), "submitted"));
    approved.forEach((item) => addTrend(dayKey(item.created_date), "approved"));
    const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const installerProfileByEmail = new Map(
      allInstallers
        .filter((installer) => !installer.excluded_from_reporting && installer.user_email)
        .map((installer) => [String(installer.user_email).toLowerCase(), installer]),
    );
    const wholesalerMap = new Map<string, {
      wholesaler: string;
      branch: string;
      installers: Map<string, Record<string, unknown>>;
      claims: Record<string, unknown>[];
      submitted: number;
      approved: number;
    }>();
    const ensureWholesaler = (wholesalerValue: unknown, branchValue: unknown) => {
      const wholesaler = String(wholesalerValue || "Not provided").trim() || "Not provided";
      const branch = String(branchValue || "Not provided").trim() || "Not provided";
      const key = `${wholesaler.toLowerCase()}::${branch.toLowerCase()}`;
      if (!wholesalerMap.has(key)) {
        wholesalerMap.set(key, { wholesaler, branch, installers: new Map(), claims: [], submitted: 0, approved: 0 });
      }
      return wholesalerMap.get(key)!;
    };
    const addInstaller = (row: ReturnType<typeof ensureWholesaler>, installer: any, fallbackEmail = "") => {
      const email = String(installer?.user_email || fallbackEmail || "").toLowerCase();
      if (!email) return;
      row.installers.set(email, {
        id: installer?.id || "",
        name: installer?.full_name || email,
        email,
        business_name: installer?.business_name || "",
        nominated_wholesaler: installer?.nominated_wholesaler || "Not provided",
        nominated_branch: installer?.nominated_branch || "Not provided",
      });
    };
    installers.forEach((installer) => {
      const row = ensureWholesaler(installer.nominated_wholesaler, installer.nominated_branch);
      addInstaller(row, installer);
    });
    claims.forEach((claim) => {
      const row = ensureWholesaler(claim.wholesaler, claim.wholesaler_branch);
      const email = String(claim.installer_email || "").toLowerCase();
      const installer = installerProfileByEmail.get(email);
      const boughtElsewhere = boughtAwayFromNomination(installer?.nominated_wholesaler, claim.wholesaler);
      row.submitted += 1;
      if (claim.status === "approved") row.approved += 1;
      addInstaller(row, installer, email);
      row.claims.push({
        id: claim.id,
        installer_name: installer?.full_name || claim.installer_name || email || "Unknown installer",
        installer_email: email,
        serial_number: claim.serial_number || "Not recorded",
        status: claim.status || "submitted",
        purchase_wholesaler: claim.wholesaler || "Not provided",
        purchase_branch: claim.wholesaler_branch || "Not provided",
        purchase_recorded: Boolean(String(claim.wholesaler || "").trim()),
        nominated_wholesaler: installer?.nominated_wholesaler || "Not provided",
        nominated_branch: installer?.nominated_branch || "Not provided",
        bought_elsewhere: boughtElsewhere,
      });
    });
    const wholesalers = [...wholesalerMap.values()]
      .map((row) => ({
        wholesaler: row.wholesaler,
        branch: row.branch,
        installers: row.installers.size,
        linked_installers: [...row.installers.values()],
        claims: row.claims,
        submitted: row.submitted,
        approved: row.approved,
        bought_elsewhere: row.claims.filter((claim) => claim.bought_elsewhere).length,
      }))
      .sort((a, b) => b.approved - a.approved || b.submitted - a.submitted || b.installers - a.installers)
      .slice(0, 20);

    if (body.export_type === "installers") {
      const periodClaimEmails = new Set(claims.map((claim) => String(claim.installer_email || "").toLowerCase()).filter(Boolean));
      const installerRows = allInstallers.filter((installer) => {
        if (installer.excluded_from_reporting) return false;
        const email = String(installer.user_email || "").toLowerCase();
        return inRange(installer, start) || periodClaimEmails.has(email);
      });
      const periodClaimsByEmail = new Map<string, any[]>();
      claims.forEach((claim) => {
        const email = String(claim.installer_email || "").toLowerCase();
        if (!email) return;
        const rows = periodClaimsByEmail.get(email) || [];
        rows.push(claim);
        periodClaimsByEmail.set(email, rows);
      });
      return Response.json({
        filename: `FastAmps-installer-directory-${rangeFilename(range)}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: asCsv(
          ["Record type", "Registered", "Installer", "Business", "Mobile", "Email", "Region", "Nominated distributor", "Nominated branch", "Claims in period", "Approved in period", "Repeat installer in period", "Training verified", "HQ training completed", "Certificates received", "Referral code", "Referred by", "People referred", "Qualified referrals"],
          installerRows.map((installer) => {
            const installerClaims = periodClaimsByEmail.get(String(installer.user_email || "").toLowerCase()) || [];
            const approvedCount = installerClaims.filter((claim) => claim.status === "approved").length;
            return [
              installer.is_demo ? (installer.demo_label || "BETA-DEMO") : "Live",
              ukDate(installer.created_date, true),
              installer.full_name,
              installer.business_name,
              installer.mobile,
              installer.user_email,
              installer.region,
              installer.nominated_wholesaler || "Not provided",
              installer.nominated_branch || "Not provided",
              installerClaims.length,
              approvedCount,
              approvedCount >= 2 ? "Yes" : "No",
              installer.hq_training_completed || installer.certificates_received ? "Yes" : "No",
              installer.hq_training_completed ? "Yes" : "No",
              installer.certificates_received ? "Yes" : "No",
              installer.referral_code,
              installer.referred_by_name || installer.referred_by_email,
              installer.referrals || 0,
              installer.qualified_referrals || 0,
            ];
          }),
        ),
      });
    }

    if (body.export_type === "claims") {
      const allChargers = await listAll(base44.asServiceRole.entities.Charger);
      const chargerById = new Map(allChargers.map((charger) => [String(charger.id), charger]));
      const normaliseSupply = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
      const supplyComparison = (charger: any, claim: any) => {
        if (!charger?.supplied_to_name_raw) return "Supply not recorded";
        if (charger.supplied_to_type === "customer") return "Supplied direct to customer";
        if (!claim.wholesaler) return "Installer purchase not recorded";
        if (!["matched", "confirmed"].includes(charger.distribution_match_status)) return "Supply branch requires review";
        if (normaliseSupply(charger.distribution_wholesaler_name) !== normaliseSupply(claim.wholesaler)) return "Wholesaler differs - investigate";
        if (!claim.wholesaler_branch || !charger.distribution_branch_name) return "Wholesaler matches, branch unknown";
        return normaliseSupply(charger.distribution_branch_name) === normaliseSupply(claim.wholesaler_branch)
          ? "Supplied and purchase branches match" : "Branch differs - investigate";
      };
      return Response.json({
        filename: `FastAmps-installation-claims-${rangeFilename(range)}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: asCsv(
          ["Record type", "Submitted", "Installation date", "Installer", "Email", "Serial number", "Product", "Site postcode", "Nominated distributor", "Nominated branch", "Purchased from", "Purchase branch", "Purchase route check", "FastAmps supplied-to type", "FastAmps supplied-to name", "FastAmps supplied-to branch (original)", "Approved wholesaler", "Approved branch", "Distribution match status", "Supply vs purchase comparison", "Manufacturing batch ID", "Claim status", "Warranty status", "Reward value", "Reward status", "Reviewed by", "Reviewed at", "Review note"],
          claims.map((claim) => {
            const installer = installerProfileByEmail.get(String(claim.installer_email || "").toLowerCase());
            const purchaseRecorded = Boolean(String(claim.wholesaler || "").trim());
            const boughtElsewhere = boughtAwayFromNomination(installer?.nominated_wholesaler, claim.wholesaler);
            const charger = chargerById.get(String(claim.charger_record_id || ""));
            return [
              claim.is_demo ? (claim.demo_label || "BETA-DEMO") : "Live",
              ukDate(claim.created_date, true),
              ukDate(claim.install_date),
              claim.installer_name,
              claim.installer_email,
              claim.serial_number,
              claim.product_model,
              claim.site_postcode,
              installer?.nominated_wholesaler || "Not provided",
              installer?.nominated_branch || "Not provided",
              claim.wholesaler || "Not provided",
              claim.wholesaler_branch || "Not provided",
              !purchaseRecorded ? "Purchase not recorded" : boughtElsewhere ? "Bought elsewhere" : "Matches nomination",
              charger?.supplied_to_type || "Not provided",
              charger?.supplied_to_name_raw || "Not provided",
              charger?.supplied_to_branch_raw || "Not provided",
              charger?.distribution_wholesaler_name || "Not matched",
              charger?.distribution_branch_name || "Not matched",
              charger?.distribution_match_status || "Not provided",
              supplyComparison(charger, claim),
              charger?.source_batch_identifier || charger?.batch_reference || "Not provided",
              humanStatus(claim.status),
              humanStatus(claim.warranty_status),
              `£${Number(claim.reward_amount || 0).toFixed(2)}`,
              humanStatus(claim.reward_status),
              claim.reviewed_by_name || "Not reviewed",
              ukDate(claim.reviewed_at, true),
              claim.review_note || "",
            ];
          }),
        ),
      });
    }

    return Response.json({
      range,
      generated_at: new Date().toISOString(),
      summary: {
        registrations: installers.length,
        installer_report_rows: installerReportEmails.size,
        submitted: claims.length,
        approved: approved.length,
        rejected: rejected.length,
        pending: pending.length,
        active_installers: activeInstallers,
        repeat_installers: repeatInstallers,
        repeat_rate: activeInstallers ? Math.round((repeatInstallers / activeInstallers) * 100) : 0,
        approval_rate: claims.length ? Math.round((approved.length / claims.length) * 100) : 0,
        voucher_requests: vouchers.length,
        vouchers_sent: vouchers.filter((voucher) => voucher.status === "sent").length,
        installation_reward_cost: installationRewardCost,
        welcome_reward_cost: welcomeRewardCost,
        reward_cost: rewardCost,
        usage_fee_cost: usageFeeCost,
        programme_cost: programmeCost,
        reference_order_value: referenceOrderValue,
        reference_value_after_programme_cost: Math.max(referenceOrderValue - programmeCost, 0),
        reference_value_multiple: programmeCost
          ? Number((referenceOrderValue / programmeCost).toFixed(1))
          : 0,
        programme_cost_ratio: referenceOrderValue
          ? Number(((programmeCost / referenceOrderValue) * 100).toFixed(1))
          : 0,
      },
      funnel: [
        { label: "New registrations", value: installers.length },
        { label: "Installers with approved claims", value: activeInstallers },
        { label: "Approved installations", value: approved.length },
        { label: "Repeat installers", value: repeatInstallers },
      ],
      trend,
      wholesalers,
      assumptions: {
        reward_per_approved_install: REWARD_PER_INSTALL,
        welcome_reward_per_installer: 10,
        minimum_redemption_amount: 30,
        usage_fee_per_approved_install: USAGE_FEE_PER_INSTALL,
        reference_charger_value: REFERENCE_CHARGER_VALUE,
      },
    });
  } catch (error) {
    console.error("get-programme-report failed", error);
    return Response.json(
      { error: error?.message || "The programme report could not be generated." },
      { status: 500 },
    );
  }
});
