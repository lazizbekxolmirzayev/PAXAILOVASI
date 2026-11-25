import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Visitor } from './visitors';

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
  calls = [];
  respond = () => ({ ok: true, json: { id: '7' } });
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const call: Call = { url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null };
    calls.push(call);
    const r = respond(call);
    return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.json } as Response;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const v = (name: string, at: number): Visitor => ({ id: `${name}${at}`, name, at });

describe('summarize', () => {
  it('groups visits by person, ignoring case and spacing', async () => {
    const { summarize } = await load('');
    const s = summarize([v('Ali Valiyev', 300), v('ali  valiyev', 200), v('Vali Aliyev', 100), v('  ', 50)]);
    expect(s.visits).toBe(3);
    expect(s.people.map((p) => [p.name, p.visits])).toEqual([['Ali Valiyev', 2], ['Vali Aliyev', 1]]);
  });

  it('puts the most recent visitor first and uses the latest spelling of the name', async () => {
    const { summarize } = await load('');
    const s = summarize([v('olim karimov', 10), v('Zarina Yusupova', 20), v('Olim Karimov', 30)]);
    expect(s.people.map((p) => p.name)).toEqual(['Olim Karimov', 'Zarina Yusupova']);
    expect(s.people[0]?.lastAt).toBe(30);
  });

  it('is empty without visits', async () => {
    const { summarize } = await load('');
    expect(summarize([])).toEqual({ people: [], visits: 0 });
  });
});

describe('remote list (mockapi)', () => {
  it('sends one record per visit with just the name and the time — no play time of any kind', async () => {
    const { addVisitor } = await load('https://x.test/visitors/');
    await addVisitor('  Ali   Valiyev ');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://x.test/visitors', method: 'POST' });
    expect(Object.keys(calls[0]?.body ?? {}).sort()).toEqual(['at', 'name']);
    expect(calls[0]?.body?.name).toBe('Ali Valiyev');
  });

  it('keeps the name and retries it later when the server is down', async () => {
    respond = () => ({ ok: false });
    const { addVisitor, retryPending } = await load('https://x.test/visitors');
    await addVisitor('Ali Valiyev');
    expect(localStorage.getItem('whatif.pending')).toBe('Ali Valiyev');

    respond = () => ({ ok: true, json: { id: '9' } });
    await retryPending();
    expect(localStorage.getItem('whatif.pending')).toBeNull();
    expect(calls[calls.length - 1]).toMatchObject({ method: 'POST' });
    expect(calls[calls.length - 1]?.body?.name).toBe('Ali Valiyev');
  });

  it('reads rows newest first and ignores any extra fields', async () => {
    respond = () => ({
      ok: true,
      json: [
        { id: 1, name: 'Old One', at: 100, minutes: 95 },
        { id: '2', name: 'New One', at: '300', playSec: 50 },
        { id: '3', name: 'Middle', at: 200 },
      ],
    });
    const { listVisitors } = await load('https://x.test/visitors');
    const rows = await listVisitors();
    expect(rows).toEqual([{ id: '2', name: 'New One', at: 300 }, { id: '3', name: 'Middle', at: 200 }, { id: '1', name: 'Old One', at: 100 }]);
  });

  it('reports a server error', async () => {
    respond = () => ({ ok: false });
    const { listVisitors } = await load('https://x.test/visitors');
    await expect(listVisitors()).rejects.toThrow('500');
  });
});

describe('local list (no server configured)', () => {
  it('stores the visits in this browser', async () => {
    const { addVisitor, listVisitors } = await load('');
    await addVisitor('Ali Valiyev');
    const rows = await listVisitors();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Ali Valiyev');
    expect(calls).toHaveLength(0);
  });
});
