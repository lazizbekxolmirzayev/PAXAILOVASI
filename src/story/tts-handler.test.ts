// Tests of the Vercel function that turns the whitelisted narration into speech (api/tts.js), with ElevenLabs mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { textHash } from './hash';

type Handler = (req: unknown, res: unknown) => Promise<void>;
const loadHandler = async (): Promise<Handler> => {
  vi.resetModules(); // a fresh in-memory cache for every test
  return ((await import(/* @vite-ignore */ '../../api/tts.js' as string)) as { default: Handler }).default;
};
const loadTexts = async (): Promise<Record<string, Record<string, string[]>>> =>
  ((await import(/* @vite-ignore */ '../../api/_story-text.js' as string)) as { default: Record<string, Record<string, string[]>> }).default;

interface Out { status: number; headers: Record<string, string>; body: Buffer | string }
async function call(handler: Handler, url: string, method = 'GET'): Promise<Out> {
  const out: Out = { status: 0, headers: {}, body: '' };
  const res = {
    statusCode: 200,
    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = String(v); },
    end: (b?: Buffer | string) => { out.status = res.statusCode; out.body = b ?? ''; },
  };
  await handler({ method, url }, res);
  return out;
}
const json = (o: Out) => JSON.parse(String(o.body)) as { error: string };

const AUDIO = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 1, 2, 3]);
const okAudio = () => new Response(AUDIO, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
const status = (code: number, text = '') => new Response(text, { status: code });

const ENV_KEYS = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_VOICE_UZ', 'ELEVENLABS_VOICE_RU', 'ELEVENLABS_VOICE_EN', 'ELEVENLABS_MODEL'];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const clipUrl = async (scenario = 'timur-east', i = 0, lang = 'uz') => {
  const t = (await loadTexts())[scenario]![lang]![i]!;
  return { url: `/api/tts?id=${scenario}.${i}&lang=${lang}&h=${textHash(t)}`, text: t };
};

describe('api/tts.js — request validation', () => {
  it('only answers GET', async () => {
    const h = await loadHandler();
    const { url } = await clipUrl();
    const r = await call(h, url, 'POST');
    expect(r.status).toBe(405);
    expect(r.headers.allow).toBe('GET');
  });

  it('rejects unexpected or repeated parameters — free text can never be sent', async () => {
    const h = await loadHandler();
    const { url } = await clipUrl();
    expect((await call(h, `${url}&text=hello`)).status).toBe(400);
    expect((await call(h, `${url}&lang=ru`)).status).toBe(400);
    expect((await call(h, `${url}&voice=abc`)).status).toBe(400);
  });

  it('rejects unknown languages, unknown or out-of-range clips and prototype keys', async () => {
    const h = await loadHandler();
    const { url } = await clipUrl();
    expect(json(await call(h, url.replace('lang=uz', 'lang=fr'))).error).toBe('bad_lang');
    expect(json(await call(h, '/api/tts?id=nope.0&lang=uz&h=00000000')).error).toBe('unknown_clip');
    expect(json(await call(h, '/api/tts?id=timur-east.99&lang=uz&h=00000000')).error).toBe('unknown_clip');
    expect(json(await call(h, '/api/tts?id=timur-east&lang=uz&h=00000000')).error).toBe('unknown_clip');
    expect(json(await call(h, '/api/tts?id=constructor.0&lang=uz&h=00000000')).error).toBe('unknown_clip');
    expect(json(await call(h, '/api/tts?id=__proto__.0&lang=en&h=00000000')).error).toBe('unknown_clip');
  });

  it('refuses a clip whose text hash does not match (changed text is never served stale)', async () => {
    const h = await loadHandler();
    const r = await call(h, '/api/tts?id=timur-east.0&lang=uz&h=deadbeef');
    expect(r.status).toBe(404);
    expect(json(r).error).toBe('stale_clip');
  });

  it('says so plainly when no ElevenLabs key is configured (and never calls out)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const h = await loadHandler();
    const { url } = await clipUrl();
    const r = await call(h, url);
    expect(r.status).toBe(503);
    expect(json(r).error).toBe('tts_not_configured');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('api/tts.js — speech', () => {
  it('asks ElevenLabs for exactly the whitelisted text and returns immutable, cacheable audio', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const f = vi.fn(async () => okAudio());
    vi.stubGlobal('fetch', f);
    const h = await loadHandler();
    const { url, text } = await clipUrl('timur-east', 1, 'ru');
    const r = await call(h, url);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('audio/mpeg');
    expect(r.headers['cache-control']).toContain('immutable');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(r.body as Buffer).equals(AUDIO)).toBe(true);

    expect(f).toHaveBeenCalledTimes(1);
    const [endpoint, init] = f.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(endpoint).toBe('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb');
    expect(init.method).toBe('POST');
    expect(init.headers['xi-api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({ text, model_id: 'eleven_v3', language_code: 'ru' });
  });

  it('the key is never part of what the browser receives', async () => {
    process.env.ELEVENLABS_API_KEY = 'super-secret-key';
    vi.stubGlobal('fetch', vi.fn(async () => status(401, 'invalid key super-secret-key')));
    const h = await loadHandler();
    const { url } = await clipUrl();
    const r = await call(h, url);
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.headers) + String(r.body)).not.toContain('super-secret-key');
  });

  it('generates a clip once, then serves it from memory', async () => {
    process.env.ELEVENLABS_API_KEY = 'k';
    const f = vi.fn(async () => okAudio());
    vi.stubGlobal('fetch', f);
    const h = await loadHandler();
    const { url } = await clipUrl('waterloo', 0, 'en');
    expect((await call(h, url)).status).toBe(200);
    expect((await call(h, url)).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('honours the voice and model environment variables (per-language voice wins)', async () => {
    process.env.ELEVENLABS_API_KEY = 'k';
    process.env.ELEVENLABS_VOICE_ID = 'voice-all';
    process.env.ELEVENLABS_VOICE_UZ = 'voice-uz';
    process.env.ELEVENLABS_MODEL = 'eleven_v4';
    const f = vi.fn(async () => okAudio());
    vi.stubGlobal('fetch', f);
    const h = await loadHandler();
    const uz = await clipUrl('timur-east', 0, 'uz');
    const en = await clipUrl('timur-east', 0, 'en');
    await call(h, uz.url);
    await call(h, en.url);
    const calls = f.mock.calls as unknown as [string, { body: string }][];
    expect(calls[0]![0]).toMatch(/\/voice-uz$/);
    expect(calls[1]![0]).toMatch(/\/voice-all$/);
    expect(JSON.parse(calls[0]![1].body).model_id).toBe('eleven_v4');
  });

  it('falls back to another language hint / model when ElevenLabs does not accept the first', async () => {
    process.env.ELEVENLABS_API_KEY = 'k';
    const f = vi.fn()
      .mockResolvedValueOnce(status(422, 'language_code not supported'))
      .mockResolvedValueOnce(status(422, 'model does not support'))
      .mockResolvedValueOnce(okAudio());
    vi.stubGlobal('fetch', f);
    const h = await loadHandler();
    const { url } = await clipUrl();
    const r = await call(h, url);
    expect(r.status).toBe(200);
    const bodies = (f.mock.calls as unknown as [string, { body: string }][]).map((c) => JSON.parse(c[1].body) as Record<string, string>);
    expect(bodies.map((b) => [b.model_id, b.language_code])).toEqual([['eleven_v3', 'uz'], ['eleven_v3', undefined], ['eleven_v4', 'uz']]);
  });

  it('does not retry on authentication problems, and maps quota problems to 503', async () => {
    process.env.ELEVENLABS_API_KEY = 'k';
    const f401 = vi.fn(async () => status(401, 'unauthorized'));
    vi.stubGlobal('fetch', f401);
    let h = await loadHandler();
    const { url } = await clipUrl();
    let r = await call(h, url);
    expect(r.status).toBe(502);
    expect(json(r).error).toBe('upstream_auth');
    expect(f401).toHaveBeenCalledTimes(1);

    vi.stubGlobal('fetch', vi.fn(async () => status(429, 'too many')));
    h = await loadHandler();
    r = await call(h, url);
    expect(r.status).toBe(503);
    expect(json(r).error).toBe('upstream_quota');
  });

  it('turns a network failure into a clean 502 instead of crashing', async () => {
    process.env.ELEVENLABS_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
    const h = await loadHandler();
    const { url } = await clipUrl();
    const r = await call(h, url);
    expect(r.status).toBe(502);
    expect(json(r).error).toBe('upstream_error');
  });
});
