import { resolveTenant } from '../../shared/tenantAuth.ts';

// Turns the text of an uploaded email (PDF, Word, .eml, text) into a reusable
// template: strips mail-client header lines, keeps the wording and signature,
// and converts placeholders such as XXXX into {{first_name}} / {{company_name}}.
// Nothing is stored here; the caller reviews the result before saving.

const PLACEHOLDER = /\b(?:X{2,}|x{4,}|\[(?:first ?name|company(?: name)?|name)\]|<(?:first ?name|company(?: name)?)>)\b/;

// Safety net if the model leaves any run of X's behind.
function fallbackReplace(text: string): string {
  let out = text.replace(/\b(Hi|Hello|Dear|Hey)\s+X{2,}\b/gi, '$1 {{first_name}}');
  out = out.replace(/\bX{2,}\b/g, '{{company_name}}');
  return out;
}

export default async function (req: Request) {
  try {
    const { base44 } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim().slice(0, 30000);
    if (!text) return Response.json({ error: 'No email text to read.' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are turning a previously sent sales email into a reusable template.

The email text below was extracted from a PDF, Word file or saved email, so it may include mail-client header lines (From, To, Date, Subject), attachment names, and image/logo text.

Rules:
1. subject: the email's subject line without the "Subject:" label. Replace placeholders in it too.
2. body: the email body only, starting at the greeting. Remove From/To/Date lines, attachment filenames (e.g. "Flyer.pdf") and page-break debris. Keep all other wording EXACTLY as written, including bullet lists and paragraph breaks. Do not rewrite, shorten or improve it. Use plain text with blank lines between paragraphs and "- " for bullets.
2b. Signature: the body MUST end with the sender's sign-off and full signature block exactly as it appears in the email (e.g. "Kind regards," then name, job title, company, phone, mobile, email, website, postal address and any logo text). Copy every line of it, in order, even if it appears in a footer, sidebar or second page. If the signature is missing from where the body ends but the sender's contact details appear elsewhere in the document (letterhead, footer, header), place them at the end as the signature block. Never drop, merge or paraphrase the signature.
3. Placeholders: the author typed runs of X (e.g. XXXX) where the recipient's first name and the recipient's company name belong. Work out which is which from context: after "Hi/Hello/Dear" it is the first name -> {{first_name}}; elsewhere (e.g. "tenders for XXXX", "partner with XXXX") it is the company -> {{company_name}}. Also convert bracketed forms like [Name] or [Company]. Never convert real names such as the sender's own name or company.
4. If the greeting has a placeholder name, keep it as "Hi {{first_name}},".
5. name: a short template name (max 8 words) describing the email, e.g. "FastAmps | EV charger partner enquiry".
6. placeholders_found: list which of "first_name" and "company_name" you inserted.
7. signature_included: true only when the body you return contains the sign-off and signature block.

EMAIL TEXT:
"""
${text}
"""`,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          placeholders_found: { type: 'array', items: { type: 'string' } },
          signature_included: { type: 'boolean' },
        },
        required: ['subject', 'body'],
      },
    });

    const subject = fallbackReplace(String(result?.subject || '').trim());
    const emailBody = fallbackReplace(String(result?.body || '').trim());
    if (!emailBody) return Response.json({ error: 'Could not find an email body in that file.' }, { status: 422 });

    const found = ['first_name', 'company_name'].filter((key) =>
      `${subject}\n${emailBody}`.includes(`{{${key}}}`),
    );
    return Response.json({
      name: String(result?.name || '').trim().slice(0, 150),
      subject: subject.slice(0, 220),
      body_text: emailBody.slice(0, 10000),
      placeholders_found: found,
      signature_included: result?.signature_included !== false,
      leftover_placeholder: PLACEHOLDER.test(`${subject}\n${emailBody}`),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message || 'Could not read that email.' }, { status: 500 });
  }
}