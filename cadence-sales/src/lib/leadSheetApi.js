import { base44 } from "@/api/base44Client";
import { leadSheetFileBaseName } from "@/lib/leadSheet";
import { buildLeadSheetPdf } from "@/lib/leadSheetPdf";
import { buildLeadSheetDocx } from "@/lib/leadSheetDocx";

// Client calls for lead sheets. Every mutation goes through the backend
// function, which re-checks the tenant and the caller's role; generated files
// are uploaded to private storage (stored privately — anyone with the link can
// only open them through a short-lived signed URL).

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke("manageLeadSheet", { action, ...payload });
  return response?.data || response;
}

export async function createLeadSheetDraft(payload) {
  return invoke("create", payload);
}

export async function saveLeadSheet(id, fields) {
  return invoke("save", { id, fields });
}

export async function submitLeadSheet(id, fields = {}) {
  return invoke("submit", { id, fields });
}

export async function reviewLeadSheet(id, decision, reason = "") {
  return invoke(decision === "approve" ? "approve" : "return", { id, reason });
}

export async function markLeadSheetSent(id) {
  return invoke("mark_sent", { id });
}

export async function attachLeadSheetFile(id, kind, fileUri) {
  return invoke("attach_file", { id, file_kind: kind, file_uri: fileUri });
}

export async function listLeadSheets(params = {}) {
  const response = await base44.functions.invoke("listLeadSheets", params);
  return response?.data || response;
}

export async function downloadLeadSheetFile(fileUri) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
    file_uri: fileUri,
    expires_in: 300,
  });
  const link = document.createElement("a");
  link.href = signed_url;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

// Generate the branded PDF and/or Word document for one or many sheets, store
// it privately and record it against each sheet.
export async function generateLeadSheetFiles(sheets, kinds = ["pdf"]) {
  const list = (Array.isArray(sheets) ? sheets : [sheets]).filter(Boolean);
  if (!list.length) return [];
  const results = [];

  for (const kind of kinds) {
    const blob = kind === "docx" ? await buildLeadSheetDocx(list) : await buildLeadSheetPdf(list);
    const suffix = list.length > 1 ? `-and-${list.length - 1}-more` : "";
    const name = `${leadSheetFileBaseName(list[0])}${suffix}.${kind}`;
    const file = new File([blob], name, {
      type: kind === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
    });
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    for (const sheet of list) {
      await attachLeadSheetFile(sheet.id, kind, file_uri);
    }
    results.push({ kind, file_uri, name });
  }

  return results;
}

export async function downloadLeadSheets(sheets, kinds = ["pdf"]) {
  const files = await generateLeadSheetFiles(sheets, kinds);
  for (const file of files) await downloadLeadSheetFile(file.file_uri);
  return files;
}