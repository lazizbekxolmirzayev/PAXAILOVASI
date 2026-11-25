import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Visitor } from './visitors';

// The real play clock needs a browser; here it is replaced by a stub that lets the test "save" by hand.
let sync: ((sec: number) => void) | null = null;
let startedAt: number | null = null;
vi.mock('./playtime', () => ({
  startPlayClock: (start: number, onSync: (sec: number) => void) => { startedAt = start; sync = onSync; return { seconds: () => start, stop: () => { sync = null; } }; },
}));

const fire = (sec: number) => { sync?.(sec); };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } } as Storage;
}

interface Call { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[] = [];
let respond: (c: Call) => { ok: boolean; json?: unknown } = () => ({ ok: true, json: { id: '7' } });

async function load(api: string) {
  vi.resetModules();
  vi.stubEnv('VITE_VISITORS_API', api);
  return import('./visitors');
}

beforeEach(() => {
  calls = []; sync = null; startedAt = null;
  respond = (c) => (c.method === 'POST' ? { ok: true, json: { id: '7' } } : { ok: true, json: {} });
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const call: Call = { url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null };
    calls.push(call);
    const r = respond(call);
    return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.json } as Response;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const v = (name: string, at: number, playSec: number | null): Visitor => ({ id: `${name}${at}`, name, at, playSec });

describe('summarize', () => {
  it('groups visits by person and adds up only measured play time', async () => {
    const { summarize } = await load('');
    const s = summarize([
      v('Ali Valiyev', 300, 600),
      v('ali  valiyev', 200, 1200),      // same person: other case and spacing
      v('Vali Aliyev', 100, null),       // visit from before play time was measured
      v('  ', 50, 999),                  // no name: ignored
    ]);
    expect(s.visits).toBe(3);
    expect(s.people.map((p) => [p.name, p.visits, p.playSec])).toEqual([['Ali Valiyev', 2, 1800], ['Vali Aliyev', 1, null]]);
    expect(s.playSec).toBe(1800); // the unmeasured visit adds nothing — no guessing
  });

  it('puts the most recent visitor first and uses the latest spelling of the name', async () => {
    const { summarize } = await load('');
    const s = summarize([v('olim karimov', 10, 60), v('Zarina Yusupova', 20, 0), v('Olim Karimov', 30, 60)]);
    expect(s.people.map((p) => p.name)).toEqual(['Olim Karimov', 'Zarina Yusupova']);
    expect(s.people[0]?.lastAt).toBe(30);
  });

  it('is empty without visits', async () => {
    const { summarize } = await load('');
    expect(summarize([])).toEqual({ people: [], visits: 0, playSec: 0 });
  });
});

describe('splitDuration', () => {
  it('rounds down to whole minutes', async () => {
    const { splitDuration } = await load('');
    expect(splitDuration(59)).toEqual({ h: 0, m: 0 });
    expect(splitDuration(125)).toEqual({ h: 0, m: 2 });
    expect(splitDuration(3 * 3600 + 25 * 60 + 59)).toEqual({ h: 3, m: 25 });
    expect(splitDuration(-5)).toEqual({ h: 0, m: 0 });
  });
});

describe('remote list (mockapi)', () => {
  it('creates one record per visit with no invented play time, then updates it from the clock', async () => {
    const { addVisitor } = await load('https://x.test/visitors');
    await addVisitor('  Ali   Valiyev ');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://x.test/visitors', method: 'POST' });
    expect(calls[0]?.body).toMatchObject({ name: 'Ali Valiyev', minutes: 0, playSec: 0 });
    expect(startedAt).toBe(0);

    fire(125);
    await Promise.resolve();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ url: 'https://x.test/visitors/7', method: 'PUT' });
    expect(calls[1]?.body).toMatchObject({ name: 'Ali Valiyev', minutes: 2, playSec: 125 });
  });

  it('keeps the name and retries later when the server is down; that retry carries no play time', async () => {
    respond = () => ({ ok: false });
    const { addVisitor, retryPending } = await load('https://x.test/visitors');
    await addVisitor('Ali Valiyev');
    expect(startedAt).toBeNull();
    expect(localStorage.getItem('whatif.pending')).toBe('Ali Valiyev');

    respond = () => ({ ok: true, json: { id: '9' } });
    await retryPending();
    expect(localStorage.getItem('whatif.pending')).toBeNull();
    const last = calls[calls.length - 1];
    expect(last?.method).toBe('POST');
    expect(last?.body).not.toHaveProperty('playSec');
    expect(startedAt).toBeNull();
  });

  it('after a reload in the same browser session it continues the same record', async () => {
    const first = await load('https://x.test/visitors');
    await first.addVisitor('Ali Valiyev');
    fire(90);
    await Promise.resolve();
    const putsBefore = calls.filter((c) => c.method === 'PUT').length;

    sync = null; startedAt = null;
    const second = await load('https://x.test/visitors'); // "reload": fresh module, same sessionStorage
    second.resumeVisit();
    expect(startedAt).toBe(90);
    fire(150);
    await Promise.resolve();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1); // no second record
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(putsBefore + 1);
    expect(calls[calls.length - 1]?.url).toBe('https://x.test/visitors/7');
  });

  it('reads rows: only a real playSec counts; the old random "minutes" are ignored', async () => {
    respond = () => ({
      ok: true,
      json: [
        { id: '1', name: 'Old Demo', at: 100, minutes: 95 },                 // made before measuring (random minutes)
        { id: '2', name: 'Real One', at: 200, minutes: 3, playSec: 190 },
        { id: '3', name: 'Zero', at: 300, minutes: 0, playSec: '0' },
      ],
    });
    const { listVisitors } = await load('https://x.test/visitors');
    const rows = await listVisitors();
    expect(rows.map((r) => [r.name, r.playSec])).toEqual([['Zero', 0], ['Real One', 190], ['Old Demo', null]]);
  });
});

describe('local list (no server configured)', () => {
  it('measures play time in this browser too', async () => {
    const { addVisitor, listVisitors } = await load('');
    await addVisitor('Ali Valiyev');
    fire(75);
    const rows = await listVisitors();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Ali Valiyev', playSec: 75 });
    expect(calls).toHaveLength(0);
  });
});
