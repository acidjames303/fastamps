import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { buildLeadSheetExport, formatLeadSheetDate, LEAD_SHEET_STATUSES } from "@/lib/leadSheet";

// Branded, genuinely editable Word lead sheet — same navy/blue proposal look as
// the PDF, with the approved logo, tables that grow with long notes and a
// page-numbered footer. One document can carry several sheets.

const NAVY = "1E2D47";
const BLUE = "3B82F6";
const BODY = "333333";
const MUTED = "7A828E";
const LINE = "DEE2E8";
const CREAM = "F9F9F7";
const FONT = "Arial";

const LOGO_URL =
  "https://media.base44.com/images/public/6a7338f6106b1962aa31c00a/fd8d96449b16d6c01c22691cdbaa7692_B2B_SalesLeads_Logo.png"; // pragma: allowlist secret

async function loadLogoBytes() {
  try {
    const response = await fetch(LOGO_URL, { mode: "cors" });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function sectionHeading(section) {
  return new Paragraph({
    spacing: { before: 260, after: 110 },
    children: [
      new TextRun({ text: `${section.number}  `, bold: true, color: BLUE, size: 17, font: FONT }),
      new TextRun({ text: section.title.toUpperCase(), bold: true, color: NAVY, size: 20, font: FONT }),
    ],
  });
}

function rowTable(section) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...cellBorders, insideHorizontal: border, insideVertical: border },
    rows: section.rows.map((row) => new TableRow({
      children: [
        new TableCell({
          width: { size: 32, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: CREAM },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          borders: cellBorders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: row.label.toUpperCase(), color: MUTED, size: 15, font: FONT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 68, type: WidthType.PERCENTAGE },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          borders: cellBorders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: row.value || " ", color: BODY, size: 18, font: FONT })],
            }),
          ],
        }),
      ],
    })),
  });
}

function sheetBlocks(sheet, index, total) {
  const status = (LEAD_SHEET_STATUSES[sheet.status] || LEAD_SHEET_STATUSES.draft).label;
  const meta = [
    sheet.date_called ? `Called ${formatLeadSheetDate(sheet.date_called)}` : "",
    sheet.caller_name ? `Prepared by ${sheet.caller_name}` : "",
    `Status: ${status}`,
    total > 1 ? `Sheet ${index + 1} of ${total}` : "",
  ].filter(Boolean).join("   ·   ");

  const blocks = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: sheet.organisation_name || "Lead sheet",
          bold: true,
          color: NAVY,
          size: 34,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: meta, color: MUTED, size: 16, font: FONT })],
    }),
  ];

  for (const section of buildLeadSheetExport(sheet)) {
    blocks.push(sectionHeading(section));
    blocks.push(rowTable(section));
  }
  return blocks;
}

export async function buildLeadSheetDocx(sheets) {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  const logo = await loadLogoBytes();

  const headerChildren = [];
  if (logo) {
    headerChildren.push(new Paragraph({
      children: [new ImageRun({ data: logo, transformation: { width: 150, height: 46 }, type: "png" })],
    }));
  }
  headerChildren.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 40, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 4 } },
    children: [
      new TextRun({ text: "LEAD SHEET", bold: true, color: NAVY, size: 15, font: FONT }),
      new TextRun({ text: "    UK & IRELAND MARKET DEVELOPMENT", color: MUTED, size: 13, font: FONT }),
    ],
  }));

  const children = [];
  list.forEach((sheet, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...sheetBlocks(sheet, index, list.length));
  });

  const doc = new Document({
    creator: "B2B Sales Leads",
    title: list.length === 1 ? `Lead sheet — ${list[0].organisation_name || "lead"}` : "Lead sheets",
    styles: {
      default: { document: { run: { font: FONT, size: 18, color: BODY } } },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } },
      },
      headers: { default: new Header({ children: headerChildren }) },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "b2bsalesleads.co.uk", color: NAVY, size: 14, font: FONT }),
                new TextRun({ text: "   |   ", color: MUTED, size: 14, font: FONT }),
                new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: MUTED, size: 14, font: FONT }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}
