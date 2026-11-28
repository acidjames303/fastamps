import { resolveTenant } from '../../shared/tenantAuth.ts';

// Reads the plain text out of a document a user uploaded, so an existing
// research pack can be filed against accounts without retyping it.
// PDF goes through the platform extractor; Word is unzipped locally because the
// extractor does not read .docx. Nothing is stored — the text is returned once.

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = ['pdf', 'docx', 'md', 'markdown', 'txt', 'text'];

const u16 = (view, offset) => view.getUint16(offset, true);
const u32 = (view, offset) => view.getUint32(offset, true);

// Minimal ZIP reader: a .docx is a zip whose word/document.xml holds the text.
async function readZipEntry(bytes, wanted) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 66000);
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = u16(view, eocd + 10);
  let pointer = u32(view, eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (pointer + 46 > bytes.length || u32(view, pointer) !== 0x02014b50) return null;
    const method = u16(view, pointer + 10);
    const compressedSize = u32(view, pointer + 20);
    const nameLength = u16(view, pointer + 28);
    const extraLength = u16(view, pointer + 30);
    const commentLength = u16(view, pointer + 32);
    const localOffset = u32(view, pointer + 42);
    const name = new TextDecoder().decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

    if (name === wanted) {
      const localNameLength = u16(view, localOffset + 26);
      const localExtraLength = u16(view, localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = bytes.subarray(start, start + compressedSize);
      if (method === 0) return data;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function xmlToText(xml) {
  return xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default async function (req) {
  try {
    const { base44, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const fileUri = String(body?.file_uri || '');
    const format = String(body?.format || '').toLowerCase().replace(/^\./, '');

    if (!fileUri) return Response.json({ error: 'A document is required.' }, { status: 400 });
    if (!ALLOWED.includes(format)) {
      return Response.json({ error: 'Only PDF, Word, Markdown or text documents can be read.' }, { status: 400 });
    }

    // A stale or foreign file reference is a bad request, not a crash.
    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 300,
    }).catch(() => null);
    if (!signed?.signed_url) {
      return Response.json({ error: 'That document could not be opened. Upload it again and retry.' }, { status: 400 });
    }

    const download = await fetch(signed.signed_url, { signal: AbortSignal.timeout(20000) });
    if (!download.ok) return Response.json({ error: 'That document could not be read.' }, { status: 400 });
    const bytes = new Uint8Array(await download.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: 'That document is too large to read (12MB limit).' }, { status: 400 });
    }

    let text = '';
    if (['md', 'markdown', 'txt', 'text'].includes(format)) {
      text = new TextDecoder().decode(bytes);
    } else if (format === 'docx') {
      const entry = await readZipEntry(bytes, 'word/document.xml');
      if (!entry) {
        return Response.json(
          { error: 'That Word file could not be read. Save it as PDF or Markdown and try again.' },
          { status: 400 },
        );
      }
      text = xmlToText(new TextDecoder().decode(entry));
    } else {
      const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: signed.signed_url,
        json_schema: { type: 'object', properties: { text: { type: 'string' } } },
      });
      if (extracted?.status === 'error') {
        return Response.json({ error: extracted?.details || 'That PDF could not be read.' }, { status: 400 });
      }
      const output = extracted?.output;
      text = typeof output === 'string' ? output : String(output?.text || '');
    }

    text = String(text || '').trim();
    if (!text) return Response.json({ error: 'No readable text found in that document.' }, { status: 400 });

    return Response.json({ text: text.slice(0, 400000), format, organisation_id: org.id });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not read that document.' }, { status: 500 });
  }
}