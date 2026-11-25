// Visitor log: the first and last name typed on the first screen, one record per browser session: { id, name, at }.
// With VITE_VISITORS_API set, the list lives in the mockapi.io 'visitors' resource (shared with the PC Builder site);
// otherwise it is kept in this browser.
export interface Visitor { id: string; name: string; at: number }
const KEY = 'whatif.visitors.v1';
const PENDING = 'whatif.pending';

// VITE_VISITORS_API = full URL of the mockapi.io 'visitors' resource (https://xxxx.mockapi.io/visitors). Empty — stored in this browser.
const API = ((import.meta.env.VITE_VISITORS_API as string | undefined) ?? '').replace(/\/+$/, '');
export const remoteVisitors = !!API;

const clean = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 60);

interface Raw { id?: unknown; name?: unknown; at?: unknown }
function normalize(v: Raw): Visitor {
  return { id: String(v.id ?? ''), name: String(v.name ?? ''), at: Number(v.at) || 0 };
}

// ---------- local mode ----------
function readLocal(): Raw[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function addLocal(name: string, at: number): void {
  try { localStorage.setItem(KEY, JSON.stringify([{ id: `${at}-${Math.random().toString(36).slice(2, 7)}`, name, at }, ...readLocal()])); } catch { /* ignore */ }
}

// ---------- adding a visit ----------
async function post(name: string, at: number): Promise<boolean> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, at }) });
    return r.ok;
  } catch { return false; }
}

/** Logs a visit. If the server is unreachable the name is kept and retried on the next visit. */
export async function addVisitor(name: string): Promise<void> {
  const n = clean(name);
  if (!n) return;
  if (!API) return addLocal(n, Date.now());
  if (!(await post(n, Date.now()))) { try { localStorage.setItem(PENDING, n); } catch { /* ignore */ } }
}

export async function retryPending(): Promise<void> {
  let n: string | null = null;
  try { n = localStorage.getItem(PENDING); } catch { /* ignore */ }
  if (!n) return;
  const drop = () => { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } };
  if (!API) { addLocal(n, Date.now()); drop(); return; }
  if (await post(n, Date.now())) drop();
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
export interface Person { name: string; visits: number; lastAt: number }
export interface Summary { people: Person[]; visits: number }

/** Groups the visits by person (same name, any case/spacing), most recent visitor first. */
export function summarize(rows: Visitor[]): Summary {
  const by = new Map<string, Person>();
  let visits = 0;
  for (const v of rows) {
    const name = clean(v.name);
    if (!name) continue;
    visits++;
    const key = name.toLowerCase();
    const p = by.get(key) ?? { name, visits: 0, lastAt: -1 };
    p.visits++;
    if (v.at > p.lastAt) { p.lastAt = v.at; p.name = name; }
    by.set(key, p);
  }
  return { people: [...by.values()].sort((a, b) => b.lastAt - a.lastAt), visits };
}
