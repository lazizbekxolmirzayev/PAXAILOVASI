// Vercel Function (Node.js runtime): voice-over for the scenario "story" cinematic, powered by ElevenLabs.
//
//  * The API key lives only in the server environment (ELEVENLABS_API_KEY). It never reaches the browser.
//  * Only whitelisted narration can be voiced (api/_story-text.js, generated from the scenario texts). The browser sends a
//    scenario id + shot number + language + a hash of the text, never free text, so this endpoint cannot be used as a
//    general text-to-speech service, and a changed text never serves stale audio.
//  * Answers are immutable and cached by Vercel's CDN (and the browser), so a clip is generated (and billed) once.
//
// Environment variables (all optional except the first):
//   ELEVENLABS_API_KEY      your ElevenLabs API key
//   ELEVENLABS_VOICE_ID     voice for every language (default: George, a storyteller voice from the default library)
//   ELEVENLABS_VOICE_UZ / _RU / _EN   per-language voice override
//   ELEVENLABS_MODEL        default eleven_v3 (lists Uzbek, Russian and English); eleven_v4 is tried as a fallback
import TEXTS from './_story-text.js';

const LANGS = ['uz', 'ru', 'en'];
const API = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_MODEL = 'eleven_v3';
const FALLBACK_MODEL = 'eleven_v4';
const TIMEOUT_MS = 25000;
const MEMO_MAX = 24;
const memo = new Map();

/** 32-bit FNV-1a (hex). Must stay identical to src/story/hash.ts (a test checks it). */
export function textHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function fail(res, status, error, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify({ error }));
}

async function synthesize(text, lang, key) {
  const voice = process.env[`ELEVENLABS_VOICE_${lang.toUpperCase()}`] || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const primary = process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;
  const models = [primary, primary === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL];
  let last = { status: 0, detail: 'no attempt' };
  for (const model of models) {
    for (const withLang of [true, false]) {
      let r;
      try {
        r = await fetch(`${API}/${encodeURIComponent(voice)}`, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify(withLang ? { text, model_id: model, language_code: lang } : { text, model_id: model }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        return { ok: false, status: 0, detail: String(e && e.message ? e.message : e) };
      }
      if (r.ok) {
        const audio = Buffer.from(await r.arrayBuffer());
        if (audio.length > 0) return { ok: true, audio };
        last = { status: 502, detail: 'empty audio' };
        continue;
      }
      const detail = (await r.text().catch(() => '')).slice(0, 300);
      last = { status: r.status, detail };
      // 400/404/422: this model or the language hint was not accepted — try the next combination. Anything else is final.
      if (![400, 404, 422].includes(r.status)) return { ok: false, ...last };
    }
  }
  return { ok: false, ...last };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed', { Allow: 'GET' });
    const params = new URL(req.url || '/', 'http://localhost').searchParams;
    const keys = [...params.keys()];
    if (keys.some((k) => k !== 'id' && k !== 'lang' && k !== 'h') || new Set(keys).size !== keys.length) return fail(res, 400, 'bad_request');
    const id = params.get('id') || '';
    const lang = params.get('lang') || '';
    const h = params.get('h') || '';
    if (!LANGS.includes(lang)) return fail(res, 400, 'bad_lang');

    const dot = id.lastIndexOf('.');
    const scenario = dot > 0 ? id.slice(0, dot) : '';
    const n = dot > 0 && /^\d{1,2}$/.test(id.slice(dot + 1)) ? Number(id.slice(dot + 1)) : -1;
    const text = Object.prototype.hasOwnProperty.call(TEXTS, scenario) ? TEXTS[scenario][lang]?.[n] : undefined;
    if (!text) return fail(res, 404, 'unknown_clip');
    if (h !== textHash(text)) return fail(res, 404, 'stale_clip');

    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return fail(res, 503, 'tts_not_configured');

    const memoKey = `${scenario}.${n}:${lang}:${h}`;
    let audio = memo.get(memoKey);
    if (!audio) {
      const out = await synthesize(text, lang, key);
      if (!out.ok) {
        console.error('[tts] ElevenLabs request failed', out.status, out.detail);
        if (out.status === 401 || out.status === 403) return fail(res, 502, 'upstream_auth');
        if (out.status === 402 || out.status === 429) return fail(res, 503, 'upstream_quota');
        return fail(res, 502, 'upstream_error');
      }
      audio = out.audio;
      memo.set(memoKey, audio);
      if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(audio);
  } catch (e) {
    console.error('[tts] unexpected', e);
    fail(res, 500, 'server_error');
  }
}
