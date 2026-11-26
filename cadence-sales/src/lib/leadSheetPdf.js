import { jsPDF } from "jspdf";
import { buildLeadSheetExport, formatLeadSheetDate, LEAD_SHEET_STATUSES } from "@/lib/leadSheet";

// Branded lead sheet PDF: the approved B2B Sales Leads proposal look (cream
// page, navy headings, blue accents) with genuine AcroForm text fields, so a
// BDM can edit the values in Acrobat or Word-compatible readers.
// Long notes wrap and paginate; every page carries the footer.

const NAVY = [30, 45, 71];
const BLUE = [59, 130, 246];
const BLUE_TINT = [234, 241, 254];
const CREAM = [249, 249, 247];
const BODY = [51, 51, 51];
const MUTED = [122, 130, 142];
const LINE = [222, 226, 232];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const LABEL_W = 46;
const VALUE_X = MARGIN + LABEL_W + 4;
const VALUE_W = PAGE_W - MARGIN - VALUE_X;
const BOTTOM = 266;

const LOGO_URL =
  "https://media.base44.com/images/public/6a7338f6106b1962aa31c00a/fd8d96449b16d6c01c22691cdbaa7692_B2B_SalesLeads_Logo.png"; // pragma: allowlist secret

export async function loadLeadSheetLogo() {
  try {
    const response = await fetch(LOGO_URL, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function creamPage(doc) {
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawMasthead(doc, logo, compact) {
  const top = compact ? 12 : 14;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, top, 36, 11);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text("B2B SALES LEADS", MARGIN, top + 7);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("B2B SALES LEADS", MARGIN, top + 7);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("LEAD SHEET", PAGE_W - MARGIN, top + 3, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text("UK & IRELAND MARKET DEVELOPMENT", PAGE_W - MARGIN, top + 7.5, { align: "right" });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, top + 14, PAGE_W - MARGIN, top + 14);
  return top + 20;
}

function drawStatusPill(doc, status, y) {
  const meta = LEAD_SHEET_STATUSES[status] || LEAD_SHEET_STATUSES.draft;
  const label = meta.label.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const width = doc.getTextWidth(label) + 8;
  doc.setFillColor(...BLUE_TINT);
  doc.roundedRect(PAGE_W - MARGIN - width, y - 4.2, width, 6.4, 1.6, 1.6, "F");
  doc.setTextColor(...NAVY);
  doc.text(label, PAGE_W - MARGIN - width / 2, y, { align: "center" });
}

function ensureSpace(doc, logo, y, needed) {
  if (y + needed <= BOTTOM) return y;
  doc.addPage();
  creamPage(doc);
  return drawMasthead(doc, logo, true);
}

function drawSectionHeading(doc, logo, y, number, title) {
  y = ensureSpace(doc, logo, y, 16);
  doc.setFillColor(...BLUE_TINT);
  doc.roundedRect(MARGIN, y - 4.4, 7.5, 7.5, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text(number, MARGIN + 3.75, y + 0.8, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(title.toUpperCase(), MARGIN + 11, y + 0.8);
  return y + 8;
}

// A boxed value that is a real editable AcroForm field. If the field API is
// unavailable, the value is drawn as text so the document is never blank.
function drawField(doc, { x, y, width, value, multiline, name }) {
  const text = value || "";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const lines = doc.splitTextToSize(text || " ", width - 4);
  const height = multiline ? Math.max(7, lines.length * 3.9 + 3.4) : 7;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 1.2, 1.2, "S");

  let placed = false;
  try {
    const field = new doc.AcroFormTextField();
    field.Rect = [x, y, width, height];
    field.fieldName = name;
    field.fontSize = 8.5;
    field.value = text;
    field.multiline = !!multiline;
    doc.addField(field);
    placed = true;
  } catch {
    placed = false;
  }

  if (!placed) {
    doc.setTextColor(...BODY);
    doc.text(lines.slice(0, Math.max(1, Math.floor(height / 3.9))), x + 2, y + 4.4);
  }

  return height;
}

function drawSheet(doc, sheet, logo, index, total) {
  creamPage(doc);
  let y = drawMasthead(doc, logo, false);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  const name = sheet.organisation_name || "Lead sheet";
  doc.text(doc.splitTextToSize(name, 130), MARGIN, y + 4);
  drawStatusPill(doc, sheet.status, y - 1);

  const meta = [
    sheet.date_called ? `Called ${formatLeadSheetDate(sheet.date_called)}` : "",
    sheet.caller_name ? `Prepared by ${sheet.caller_name}` : "",
    total > 1 ? `Sheet ${index + 1} of ${total}` : "",
  ].filter(Boolean).join("   ·   ");
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(meta, MARGIN, y + 10);
  }
  y += 18;

  const sections = buildLeadSheetExport(sheet);
  for (const section of sections) {
    y = drawSectionHeading(doc, logo, y, section.number, section.title);
    for (const row of section.rows) {
      const multiline = row.value.length > 60;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(row.value || " ", VALUE_W - 4);
      const height = multiline ? Math.max(7, lines.length * 3.9 + 3.4) : 7;
      y = ensureSpace(doc, logo, y, height + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(row.label.toUpperCase(), MARGIN, y + 4.2);
      const used = drawField(doc, {
        x: VALUE_X,
        y,
        width: VALUE_W,
        value: row.value,
        multiline,
        name: `ls${index + 1}_${row.key}`,
      });
      y += used + 3.2;
    }
    y += 3;
  }
}

function drawFooters(doc) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 280, PAGE_W - MARGIN, 280);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text("b2bsalesleads.co.uk", MARGIN, 285);
    doc.setTextColor(...MUTED);
    doc.text("UK & IRELAND MARKET DEVELOPMENT", PAGE_W / 2, 285, { align: "center" });
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, 285, { align: "right" });
  }
}

// Build one PDF for one or many lead sheets (each sheet starts on a new page).
export async function buildLeadSheetPdf(sheets) {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  const logo = await loadLeadSheetLogo();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: list.length === 1 ? `Lead sheet — ${list[0].organisation_name || "lead"}` : "Lead sheets",
    subject: "B2B Sales Leads lead sheet",
    author: "B2B Sales Leads",
  });

  list.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    drawSheet(doc, sheet, logo, index, list.length);
  });

  drawFooters(doc);
  return doc.output("blob");
}
