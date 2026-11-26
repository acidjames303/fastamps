import * as XLSX from "xlsx";

// Spreadsheet exports vary wildly: title rows above the header, "Account name"
// instead of "Company", the real table on sheet two. These helpers read every
// sheet and match columns loosely so real files always land as accounts.

const normaliseKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const NAME_KEYS = [
  "companyname", "company", "accountname", "account", "organisationname", "organisation",
  "organizationname", "organization", "businessname", "business", "clientname", "client",
  "customername", "customer", "tradingname", "legalname", "groupname", "employer",
  "brandname", "brand", "sitename", "site", "priorityaccount", "targetaccount", "name",
];

const CONTACT_NAME_KEYS = [
  "contactname", "contactfullname", "fullname", "decisionmaker", "leadname", "personname", "contactperson",
];
const FIRST_NAME_KEYS = ["firstname", "forename", "givenname"];
const LAST_NAME_KEYS = ["lastname", "surname", "familyname"];
const TITLE_KEYS = ["jobtitle", "jobrole", "title", "position", "role", "job"];
const EMAIL_KEYS = ["email", "emailaddress", "workemail", "businessemail", "contactemail"];
const PHONE_KEYS = [
  "phone", "phonenumber", "telephone", "tel", "mobile", "mobilenumber", "directdial", "landline", "contactnumber",
];
const INDUSTRY_KEYS = ["industry", "sector", "vertical", "category", "businesssector", "sic"];
const SIZE_KEYS = ["employeerange", "employeecount", "employees", "headcount", "companysize", "staff", "size"];
const LOCATION_KEYS = [
  "location", "city", "town", "county", "region", "area", "address", "address1", "addressline1", "fulladdress", "postcode", "postalcode",
];
const WEBSITE_KEYS = ["website", "companywebsite", "web", "url", "domain"];
const LINKEDIN_KEYS = ["linkedin", "linkedinurl", "linkedinprofile"];

const COMPANY_SUFFIX = /\b(ltd|limited|plc|llp|inc|gmbh|group|holdings|partners|solutions|services|systems|associates)\b/i;

const HEADER_HINTS = ["company", "account", "organis", "organization", "client", "business", "customer", "name", "site"];

function pick(row, keys) {
  for (const key of keys) {
    const value = row.get(key);
    if (value) return value;
  }
  return "";
}

function guessName(row) {
  for (const [key, value] of row) {
    if (!value || value.includes("@") || /^https?:/i.test(value)) continue;
    if (key.length > 24) continue;
    if (COMPANY_SUFFIX.test(value)) return value;
  }
  return "";
}

function bareDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

// Collapse rows into one account per company, keeping any named contacts the
// file already had (the provider step reveals their details).
export function toAccounts(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const map = new Map();
  const headers = new Set();
  const nameKeys = options.nameColumn
    ? [normaliseKey(options.nameColumn), ...NAME_KEYS]
    : NAME_KEYS;

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = new Map();
    for (const [key, value] of Object.entries(raw)) {
      headers.add(key);
      const text = String(value ?? "").trim();
      if (text && !row.has(normaliseKey(key))) row.set(normaliseKey(key), text);
    }

    const name = pick(row, nameKeys) || (options.nameColumn ? "" : guessName(row));
    if (!name) continue;

    const website = pick(row, WEBSITE_KEYS);
    const domain = bareDomain(website);
    const key = (domain || name).toLowerCase();
    let account = map.get(key);
    if (!account) {
      account = {
        company_name: name,
        domain,
        website: website || (domain ? `https://${domain}` : ""),
        industry: pick(row, INDUSTRY_KEYS),
        employee_range: pick(row, SIZE_KEYS),
        location: pick(row, LOCATION_KEYS),
        contacts: [],
      };
      map.set(key, account);
    }

    const contactName =
      pick(row, CONTACT_NAME_KEYS) ||
      [pick(row, FIRST_NAME_KEYS), pick(row, LAST_NAME_KEYS)].filter(Boolean).join(" ");
    if (contactName && contactName.split(/\s+/).length >= 2) {
      const exists = account.contacts.some((c) => c.name.toLowerCase() === contactName.toLowerCase());
      if (!exists) {
        const email = pick(row, EMAIL_KEYS);
        account.contacts.push({
          name: contactName,
          title: pick(row, TITLE_KEYS),
          email,
          phone: pick(row, PHONE_KEYS),
          linkedin: pick(row, LINKEDIN_KEYS),
          email_status: email ? "provider_returned" : "unknown",
        });
      }
    }
  }

  return { accounts: [...map.values()], headers: [...headers] };
}

function looksLikeHeader(cells) {
  const filled = cells.filter((cell) => String(cell ?? "").trim());
  if (filled.length < 2) return false;
  return filled.some((cell) => {
    const key = normaliseKey(cell);
    return HEADER_HINTS.some((hint) => key.includes(hint));
  });
}

// Turn a sheet grid into row objects, skipping any title rows above the header.
function gridToRows(grid) {
  const rows = (grid || []).filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()),
  );
  if (!rows.length) return [];

  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i += 1) {
    if (looksLikeHeader(rows[i])) {
      headerIndex = i;
      break;
    }
  }
  // No obvious label row: the widest row near the top is the header (title and
  // note rows above it are narrow).
  if (headerIndex === -1) {
    headerIndex = 0;
    let widest = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
      const filled = rows[i].filter((cell) => String(cell ?? "").trim()).length;
      if (filled > widest) { widest = filled; headerIndex = i; }
    }
  }

  const headers = rows[headerIndex].map((cell, i) => String(cell ?? "").trim() || `Column ${i + 1}`);
  return rows.slice(headerIndex + 1).map((cells) => {
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    return row;
  });
}

// Best candidate for the company-name column when auto-detection found none.
export function guessCompanyColumn(headers, rows) {
  let best = { column: "", score: 0 };
  for (const header of headers || []) {
    const values = (rows || []).map((row) => String(row?.[header] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    const usable = values.filter(
      (value) => !value.includes("@") && !/^https?:/i.test(value) && !/^\d+([.,]\d+)?%?$/.test(value),
    );
    if (!usable.length) continue;
    const withSuffix = usable.filter((value) => COMPANY_SUFFIX.test(value)).length;
    const score =
      usable.length / values.length +
      (NAME_KEYS.includes(normaliseKey(header)) ? 1 : 0) +
      (withSuffix / usable.length) * 0.5;
    if (score > best.score) best = { column: header, score };
  }
  return best.column;
}

// Every sheet in the file, as plain row objects. JSON files are read directly.
export async function readSpreadsheet(file) {
  const name = String(file?.name || "").toLowerCase();

  if (name.endsWith(".json")) {
    const data = JSON.parse(await file.text());
    const rows = Array.isArray(data)
      ? data
      : data?.records || data?.rows || data?.companies || data?.accounts || [data];
    return [{ name: "JSON", rows: (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === "object") }];
  }

  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  return (workbook.SheetNames || []).map((sheetName) => ({
    name: sheetName,
    rows: gridToRows(
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false, defval: "" }),
    ),
  }));
}

/**
 * Merge every worksheet into one account list (deduped by company/domain).
 * Importers previously kept only the single "best" sheet and dropped the rest.
 */
export function accountsFromSheets(sheets, options = {}) {
  const list = Array.isArray(sheets) ? sheets : [];
  const allRows = [];
  const sheetStats = [];
  for (const sheet of list) {
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const parsed = toAccounts(rows, options);
    sheetStats.push({
      name: sheet?.name || "Sheet",
      rows: rows.length,
      accounts: parsed.accounts.length,
    });
    allRows.push(...rows);
  }
  const merged = toAccounts(allRows, options);
  return {
    ...merged,
    rows: allRows,
    sheetsRead: list.length,
    sheetStats,
  };
}

/** Merge account lists from multiple files, keeping contacts under one company. */
export function mergeAccountLists(lists) {
  const map = new Map();
  for (const list of Array.isArray(lists) ? lists : []) {
    for (const account of Array.isArray(list) ? list : []) {
      const key = (account?.domain || account?.company_name || "").toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...account,
          contacts: Array.isArray(account.contacts) ? [...account.contacts] : [],
        });
        continue;
      }
      for (const field of ["website", "industry", "employee_range", "location"]) {
        if (!existing[field] && account[field]) existing[field] = account[field];
      }
      const seen = new Set(
        (existing.contacts || []).map((c) => `${c.email || ""}|${c.name || ""}|${c.phone || ""}`),
      );
      for (const contact of account.contacts || []) {
        const stamp = `${contact.email || ""}|${contact.name || ""}|${contact.phone || ""}`;
        if (seen.has(stamp)) continue;
        existing.contacts.push(contact);
        seen.add(stamp);
      }
    }
  }
  return [...map.values()];
}