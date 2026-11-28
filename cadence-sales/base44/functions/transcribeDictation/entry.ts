import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// Secure server-side dictation. The audio arrives over HTTPS from the signed-in
// user's browser, is transcribed by OpenAI (gpt-4o-transcribe) with British
// English prompting, and is never written to storage or logged.
const MODEL = 'gpt-4o-transcribe';
const MAX_BYTES = 6 * 1024 * 1024; // ~3 minutes of low-bitrate speech
const MIN_BYTES = 1200;
const HOURLY_LIMIT = 30;
const DAILY_LIMIT = 120;
const ALLOWED_MIME = [
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav',
  'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/flac',
];

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/wave': 'wav', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/flac': 'flac',
};

function countSince(events: any[], iso: string) {
  return events.filter((e) => {
    const ts = e?.occurred_at || e?.created_at || e?.created_date;
    return typeof ts === 'string' && ts >= iso;
  }).length;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Please sign in to use dictation.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawAudio = typeof body?.audio_base64 === 'string' ? body.audio_base64 : '';
    const audio = rawAudio.replace(/^data:[^,]+,/, '');
    const mimeType = String(body?.mime_type || 'audio/webm').toLowerCase().split(';')[0].trim();

    if (!audio) return Response.json({ error: 'No audio was received.' }, { status: 400 });
    if (!ALLOWED_MIME.includes(mimeType)) {
      return Response.json({ error: 'That audio format is not supported.' }, { status: 415 });
    }

    let bytes: Uint8Array;
    try {
      const binary = atob(audio);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } catch {
      return Response.json({ error: 'The recording could not be read.' }, { status: 400 });
    }

    if (bytes.byteLength < MIN_BYTES) {
      return Response.json({ error: 'That recording was too short to transcribe.' }, { status: 400 });
    }
    if (bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: 'That recording is too long. Keep dictation under three minutes.' }, { status: 413 });
    }

    // Per-user usage limits: hourly and daily recording counts.
    const organisationId = user.data?.organisation_id || '';
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentEvents = await base44.asServiceRole.entities.UsageEvent
      .filter({ organisation_id: organisationId, user_id: user.id }, '-created_date', 400)
      .catch(() => []);
    const dictationEvents = (recentEvents || []).filter((e: any) => e?.metadata?.rate_limit_feature === 'dictation');

    if (countSince(dictationEvents, sinceHour) >= HOURLY_LIMIT) {
      return Response.json({
        error: `Dictation limit reached — ${HOURLY_LIMIT} recordings an hour. Try again shortly, or use browser dictation.`,
        limit: 'hourly',
      }, { status: 429 });
    }
    if (countSince(dictationEvents, sinceDay) >= DAILY_LIMIT) {
      return Response.json({
        error: `Daily dictation limit reached (${DAILY_LIMIT} recordings). It resets tomorrow — browser dictation still works.`,
        limit: 'daily',
      }, { status: 429 });
    }

    const apiKey = secrets.get('Candence_Voice');
    if (!apiKey) {
      console.error('transcribeDictation: Candence_Voice secret is not configured');
      return Response.json({ error: 'Dictation is not configured yet. Browser dictation still works.' }, { status: 503 });
    }

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), `dictation.${EXTENSIONS[mimeType] || 'webm'}`);
    form.append('model', MODEL);
    form.append('language', 'en');
    form.append('response_format', 'json');
    form.append(
      'prompt',
      'British English. Use British spelling and terms: organisation, programme, licence, analyse, prioritise, colour, £. Transcribe UK business names, job titles and phone numbers as spoken.',
    );

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(90000),
    });
    const payload = await response.json().catch(() => ({} as any));

    if (!response.ok) {
      const code = (payload as any)?.error?.code || '';
      const type = (payload as any)?.error?.type || '';
      console.error('transcribeDictation: OpenAI error', response.status, code || type || 'unknown');

      if (code === 'credit_balance_exhausted' || type === 'insufficient_quota') {
        return Response.json({
          error: 'The dictation account has no OpenAI credit left. Add billing credit to the OpenAI project behind Candence_Voice, or use browser dictation in the meantime.',
          reason: 'provider_quota',
        }, { status: 402 });
      }
      if (response.status === 429) {
        return Response.json({ error: 'The dictation service is busy. Try again in a moment, or use browser dictation.' }, { status: 429 });
      }
      if (response.status === 401 || response.status === 403) {
        return Response.json({ error: 'The dictation service rejected the stored key. Ask your administrator to check it.' }, { status: 502 });
      }
      return Response.json({ error: 'Transcription failed. Please try again, or use browser dictation.' }, { status: 502 });
    }

    const text = String((payload as any)?.text || '').trim();
    if (!text) {
      return Response.json({ error: 'No speech was detected in that recording.' }, { status: 422 });
    }

    // Record usage for the limits above (best effort — never blocks the result).
    await base44.asServiceRole.entities.UsageEvent.create({
      organisation_id: organisationId,
      user_id: user.id,
      event_type: 'integration_action',
      provider: 'openai',
      quantity: Math.max(1, Math.round(bytes.byteLength / 1024)),
      unit: 'kb',
      source_function: 'transcribeDictation',
      idempotency_key: `dictation:${user.id}:${Date.now()}`,
      metadata: { rate_limit_feature: 'dictation', model: MODEL, mime_type: mimeType },
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return Response.json({ text, model: MODEL, language: 'en-GB' });
  } catch (error: any) {
    console.error('transcribeDictation failed', error?.message || 'unknown');
    return Response.json({ error: 'Transcription failed. Please try again.' }, { status: 500 });
  }
}