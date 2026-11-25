// Visitor log with real play time.
// With VITE_VISITORS_API set, the list lives in the mockapi.io 'visitors' resource (shared with the PC Builder site);
// otherwise it is kept in this browser. One record per browser session: { id, name, at, minutes, playSec }.
// `playSec` is measured by the play clock (services/playtime.ts). Records without it — made before play time was measured,
// or by other sites — have NO known play time: they are shown as "—" and never added to a total.
import { startPlayClock, type PlayClock } from './playtime';

export interface Visitor { id: string; name: string; at: number; playSec: number | null }
const KEY = 'whatif.visitors.v1';
const PENDING = 'whatif.pending';
const SESSION = 'whatif.visit.v2';

// VITE_VISITORS_API = full URL of the mockapi.io 'visitors' resource (https://xxxx.mockapi.io/visitors). Empty — stored in this browser.
const API = ((import.meta.env.VITE_VISITORS_API as string | undefined) ?? '').replace(/\/+$/, '');
export const remoteVisitors = !!API;

const clean = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 60);
const HEADERS = { 'Content-Type': 'application/json' };

// ---------- normalising what the server (or localStorage) returns ----------
interface Raw { id?: unknown; name?: unknown; at?: unknown; playSec?: unknown }
function normalize(v: Raw): Visitor {
  const p = v.playSec === null || v.playSec === undefined || v.playSec === '' ? NaN : Number(v.playSec);
  return { id: String(v.id ?? ''), name: String(v.name ?? ''), at: Number(v.at) || 0, playSec: Number.isFinite(p) ? Math.max(0, Math.floor(p)) : null };
}

// ---------- local mode ----------
interface LocalRow extends Raw { minutes?: number }
function readLocal(): LocalRow[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeLocal(rows: LocalRow[]) { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ } }
function addLocal(name: string, at: number): string {
  const id = `${at}-${Math.random().toString(36).slice(2, 7)}`;
  writeLocal([{ id, name, at, minutes: 0, playSec: 0 }, ...readLocal()]);
  return id;
}
function updateLocal(id: string, sec: number) {
  writeLocal(readLocal().map((r) => (String(r.id) === id ? { ...r, minutes: Math.floor(sec / 60), playSec: sec } : r)));
}

// ---------- the visit of this browser session ----------
interface Session { id: string; name: string; at: number; sec: number }
function readSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null') as Partial<Session> | null;
    return s && s.id && typeof s.name === 'string' && typeof s.at === 'number' ? { id: String(s.id), name: s.name, at: s.at, sec: Number(s.sec) || 0 } : null;
  } catch { return null; }
}
function writeSession(s: Session) { try { sessionStorage.setItem(SESSION, JSON.stringify(s)); } catch { /* ignore */ } }

let clock: PlayClock | null = null;

async function save(s: Session, sec: number): Promise<void> {
  s.sec = sec;
  writeSession(s);
  if (!API) return updateLocal(s.id, sec);
  try {
    // The whole record is sent, so it does not matter whether the server merges or replaces on PUT.
    await fetch(`${API}/${encodeURIComponent(s.id)}`, { method: 'PUT', headers: HEADERS, keepalive: true, body: JSON.stringify({ name: s.name, at: s.at, minutes: Math.floor(sec / 60), playSec: sec }) });
  } catch { /* the next sync sends the up-to-date number again */ }
}

function begin(s: Session) {
  clock?.stop();
  writeSession(s);
  clock = startPlayClock(s.sec, (sec) => { void save(s, sec); });
}

/** Called on every app start: after a reload inside the same browser session the clock goes on with the same record. */
export function resumeVisit(): void {
  if (clock) return;
  const s = readSession();
  if (s) begin(s);
}

// ---------- adding a visit ----------
async function post(name: string, at: number, measured: boolean): Promise<string | null> {
  try {
    const body = measured ? { name, at, minutes: 0, playSec: 0 } : { name, at, minutes: 0 };
    const r = await fetch(API, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const row = (await r.json().catch(() => null)) as { id?: unknown } | null;
    return row && row.id !== undefined && row.id !== null ? String(row.id) : ''; // '' = saved, but we cannot update it later
  } catch { return null; }
}

/** Logs a visit and starts measuring its play time. If the server is unreachable the name is kept and retried on the next visit. */
export async function addVisitor(name: string): Promise<void> {
  const n = clean(name);
  if (!n) return;
  const at = Date.now();
  if (!API) { begin({ id: addLocal(n, at), name: n, at, sec: 0 }); return; }
  const id = await post(n, at, true);
  if (id === null) { try { localStorage.setItem(PENDING, n); } catch { /* ignore */ } return; }
  if (id) begin({ id, name: n, at, sec: 0 });
}

/** A visit that could not be sent earlier. Its play time was not measured, so it is stored without one. */
export async function retryPending(): Promise<void> {
  let n: string | null = null;
  try { n = localStorage.getItem(PENDING); } catch { /* ignore */ }
  if (!n) return;
  const drop = () => { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } };
  if (!API) {
    const rows = readLocal();
    writeLocal([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: n, at: Date.now(), minutes: 0 }, ...rows]);
    drop();
    return;
  }
  if ((await post(n, Date.now(), false)) !== null) drop();
}

// ---------- reading ----------
export async function listVisitors(): Promise<Visitor[]> {
  if (!API) return readLocal().map(normalize).sort((a, b) => b.at - a.at);
  const r = await fetch(API);
  if (!r.ok) throw new Error(String(r.status));
  const rows = (await r.json()) as Raw[];
  return rows.map(normalize).sort((a, b) => b.at - a.at);
}

// ---------- statistics ----------
export interface Person { name: string; visits: number; lastAt: number; /** null = no measured visit yet */ playSec: number | null }
export interface Summary { people: Person[]; visits: number; playSec: number }

/** Groups the visits by person (same name, any case/spacing). Only measured visits add to the play time. */
export function summarize(rows: Visitor[]): Summary {
  const by = new Map<string, Person>();
  let visits = 0;
  for (const v of rows) {
    const name = clean(v.name);
    if (!name) continue;
    visits++;
    const key = name.toLowerCase();
    const p = by.get(key) ?? { name, visits: 0, lastAt: -1, playSec: null };
    p.visits++;
    if (v.at > p.lastAt) { p.lastAt = v.at; p.name = name; }
    if (v.playSec !== null) p.playSec = (p.playSec ?? 0) + v.playSec;
    by.set(key, p);
  }
  const people = [...by.values()].sort((a, b) => b.lastAt - a.lastAt);
  return { people, visits, playSec: people.reduce((a, p) => a + (p.playSec ?? 0), 0) };
}

/** Whole hours and minutes of a number of seconds (minutes are rounded down; under a minute is 0 h 0 min). */
export function splitDuration(sec: number): { h: number; m: number } {
  const total = Math.max(0, Math.floor(sec / 60));
  return { h: Math.floor(total / 60), m: total % 60 };
}
