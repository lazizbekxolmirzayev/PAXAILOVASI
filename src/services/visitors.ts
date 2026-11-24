// Visitor log: names typed on the main menu. Stored in this browser (no backend configured).
export interface Visitor { id: string; name: string; at: number; minutes: number }
const KEY = 'whatif.visitors.v1';

/** Play-time shown in the list: mostly 30–120 min, rarely 20–30 min. */
function rollMinutes(): number {
  if (Math.random() < 0.12) return 20 + Math.floor(Math.random() * 11);
  return 30 + Math.floor(Math.random() * 91);
}

export function listVisitors(): Visitor[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function save(v: Visitor[]) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } }

export function addVisitor(name: string): void {
  const n = name.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!n) return;
  save([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: n, at: Date.now(), minutes: rollMinutes() }, ...listVisitors()]);
}
export function removeVisitor(id: string): void { save(listVisitors().filter((v) => v.id !== id)); }
export function fmtMinutes(m: number): string { const h = Math.floor(m / 60), r = m % 60; return h ? `${h} soat ${r} daqiqa` : `${r} daqiqa`; }
