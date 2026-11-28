// CSV export for Prospecting phone audit: Import mobile vs Lusha mobile side by side.

function digits(value) {
  let d = String(value || "").replace(/[^\d]/g, "");
  if (d.startsWith("0044")) d = "44" + d.slice(4);
  if (d.startsWith("0") && d.length === 11) d = "44" + d.slice(1);
  return d;
}

function cell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export const PHONE_AUDIT_HEADERS = [
  "Company",
  "Contact",
  "Job title",
  "Import mobile",
  "Primary mobile",
  "Lusha",
  "Direct dial",
  "Switchboard",
  "Phone source",
  "Phone status",
  "Enrichment status",
  "Has additive Lusha",
];

export function buildProspectPhoneAuditRows(prospects = []) {
  const rows = [];
  for (const prospect of prospects || []) {
    const people = Array.isArray(prospect.contacts) && prospect.contacts.length
      ? prospect.contacts.map((person) => ({
        name: person.name || "",
        title: person.title || "",
        mobile: person.mobile || person.phone || "",
        lusha_mobile: person.lusha_mobile || "",
        direct_dial: person.direct_dial || "",
        phone_source: person.phone_source || prospect.phone_source || "",
        phone_status: person.phone_status || prospect.phone_status || "",
      }))
      : [{
        name: prospect.full_name || "",
        title: prospect.job_title || "",
        mobile: prospect.mobile || prospect.phone || "",
        lusha_mobile: prospect.lusha_mobile || "",
        direct_dial: prospect.direct_dial || "",
        phone_source: prospect.phone_source || "",
        phone_status: prospect.phone_status || "",
      }];

    for (const person of people) {
      const primary = person.mobile || "";
      // Never copy a company-level lusha_mobile onto every sibling contact —
      // that produced false "additive" rows sharing one number (e.g. SSE Thermal).
      let lusha = person.lusha_mobile || "";
      if (!lusha && prospect.lusha_mobile) {
        const isPrimaryPerson = people.length === 1
          || (person.name
            && prospect.full_name
            && String(person.name).trim().toLowerCase() === String(prospect.full_name).trim().toLowerCase());
        if (isPrimaryPerson) lusha = prospect.lusha_mobile;
      }
      const source = person.phone_source || "";
      // Import column: primary when provenance is import, or primary when a different Lusha sits beside it.
      let importMobile = "";
      if (source === "import") importMobile = primary;
      else if (lusha && primary && digits(lusha) !== digits(primary)) importMobile = primary;
      else if (source && source !== "lusha" && primary) importMobile = primary;

      const lushaCol = lusha || (source === "lusha" ? primary : "");
      const additive = !!(lusha && primary && digits(lusha) !== digits(primary));

      rows.push([
        prospect.company_name || "",
        person.name || "",
        person.title || "",
        importMobile,
        primary,
        lushaCol,
        person.direct_dial || prospect.direct_dial || "",
        prospect.landline || prospect.company_phone || "",
        source || "No recorded source",
        person.phone_status || "",
        prospect.enrichment_status || "",
        additive ? "Yes" : "No",
      ]);
    }
  }
  return rows;
}

export function downloadProspectPhoneAuditCsv(prospects = [], filename = "cadence-phone-audit.csv") {
  const rows = buildProspectPhoneAuditRows(prospects);
  const csv = "\ufeff" + [PHONE_AUDIT_HEADERS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
