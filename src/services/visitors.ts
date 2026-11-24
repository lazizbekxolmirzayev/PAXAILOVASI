// Visitor log: names typed on the main menu. Stored in this browser (no backend configured).
export interface Visitor { id: string; name: string; at: number; minutes: number }
const KEY = 'whatif.visitors.v1';

/** Play-time shown in the list: mostly 30–120 min, rarely 20–30 min. */
function rollMinutes(): number {
  if (Math.random() < 0.12) return 20 + Math.floor(Math.random() * 11);
  return 30 + Math.floor(Math.random() * 91);
}

// VITE_VISITORS_API = test-tizimi serverining manzili (masalan https://test-xxx.vercel.app). Bo'lmasa — shu brauzerda saqlanadi.
const API = ((import.meta.env.VITE_VISITORS_API as string | undefined) ?? '').replace(/\/+$/, '');
export const remoteVisitors = !!API;

function listLocal(): Visitor[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function save(v: Visitor[]) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } }

function addLocal(name: string): void {
  const n = name.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!n) return;
  save([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: n, at: Date.now(), minutes: rollMinutes() }, ...listLocal()]);
}
function removeLocal(id: string): void { save(listLocal().filter((v) => v.id !== id)); }

const PENDING = 'whatif.pending';
async function post(name: string): Promise<boolean> {
  try { const r = await fetch(`${API}/api/visitors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); return r.ok; } catch { return false; }
}
/** Sends the name; if the server is unreachable it is kept and retried on the next visit. */
export async function addVisitor(name: string): Promise<void> {
  if (!API) return addLocal(name);
  if (!(await post(name))) { try { localStorage.setItem(PENDING, name); } catch { /* ignore */ } }
}
export async function retryPending(): Promise<void> {
  if (!API) return;
  let n: string | null = null;
  try { n = localStorage.getItem(PENDING); } catch { /* ignore */ }
  if (n && (await post(n))) { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } }
}
export async function listVisitors(pin: string): Promise<Visitor[]> {
  if (!API) return listLocal();
  const r = await fetch(`${API}/api/visitors`, { headers: { 'X-Pin': pin } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
export async function removeVisitor(id: string, pin: string): Promise<void> {
  if (!API) return removeLocal(id);
  await fetch(`${API}/api/visitors/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Pin': pin } });
}
export function fmtMinutes(m: number): string { const h = Math.floor(m / 60), r = m % 60; return h ? `${h} soat ${r} daqiqa` : `${r} daqiqa`; }
