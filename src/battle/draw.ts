// Canvas renderer for the battle: procedurally animated soldiers with era-correct arms and armour,
// projectiles, particles, dynamic light and post-processing over the painted scenery (scenery.ts).
import type { BEra, Helmet, WeaponDef } from './data';
import { curWeapon, depthScale, GROUND_BOT, GROUND_TOP, groundY, unitHeight, VIEW_H, VIEW_W, WORLD_W, type BattleState, type Particle, type Projectile, type Unit } from './sim';
import { clamp, cnv, hexA, mix, shade, TAU, type Ctx } from './gfx';
import { buildBackdrop, PAR, type Backdrop } from './scenery';

let cache: { key: string; bd: Backdrop } | null = null;
// ------------------------------------------------------------------------------------------ soldiers
const STEEL = '#b9bec6', STEEL_D = '#7c828c', BRONZE = '#b8894a', GOLD = '#e2b340', LEATHER = '#6b4a2b', WOOD = '#7a5432';

let OUTLINE = true;
let SHADOW_LEN = 10;
let RIM = '#fff4d6';
/** Render quality tier, adjusted at runtime from measured frame times. */
export type Quality = 0 | 1 | 2; // 0 low, 1 medium, 2 high
let QUALITY: Quality = 2;
export function setQuality(q: Quality): void { QUALITY = q; }
// Pre-rendered soft sprites replace per-frame gradients (the main CPU cost in canvas 2D).
const blobCache = new Map<string, HTMLCanvasElement>();
function blob(color: string, kind: 'soft' | 'fire' | 'crater' = 'soft'): HTMLCanvasElement {
  const key = kind + color;
  let c = blobCache.get(key);
  if (c) return c;
  const [cv, g] = cnv(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (kind === 'fire') { gr.addColorStop(0, 'rgba(255,246,208,1)'); gr.addColorStop(0.35, hexA(color, 0.75)); gr.addColorStop(1, 'rgba(255,90,26,0)'); }
  else if (kind === 'crater') { gr.addColorStop(0, 'rgba(25,20,15,0.75)'); gr.addColorStop(0.7, 'rgba(45,36,26,0.4)'); gr.addColorStop(1, 'rgba(45,36,26,0)'); }
  else { gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(1, hexA(color, 0)); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  c = cv; blobCache.set(key, c); return c;
}
function limb(g: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  g.lineCap = 'round';
  if (OUTLINE) { g.strokeStyle = 'rgba(14,10,8,0.55)'; g.lineWidth = w + 1.3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function ik(sx: number, sy: number, hx: number, hy: number, L: number, bend: number): [number, number] {
  const dx = hx - sx, dy = hy - sy; const d = Math.min(Math.hypot(dx, dy), L * 1.98) || 0.01;
  const mx = sx + dx / 2, my = sy + dy / 2; const h = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
  return [mx - (dy / d) * h * bend, my + (dx / d) * h * bend];
}

function drawWeapon(g: Ctx, def: WeaponDef, x: number, y: number, ang: number, u: Unit, bayonet: boolean) {
  g.save(); g.translate(x, y); g.rotate(-ang);
  const metal = u.look.gold ? '#d9d2c2' : STEEL;
  const bronze = def.look === 'gladius' || (def.look === 'sword' && (u.look.helmet === 'crested' || u.look.helmet === 'galea'));
  switch (def.look) {
    case 'sword': case 'gladius': case 'rapier': {
      const L = def.look === 'gladius' ? 22 : def.look === 'rapier' ? 34 : 30;
      g.fillStyle = bronze && def.look !== 'gladius' ? BRONZE : metal;
      g.beginPath(); g.moveTo(2, -1.6); g.lineTo(L, -0.6); g.lineTo(L + 3, 0); g.lineTo(L, 0.6); g.lineTo(2, 1.6); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3, -0.5); g.lineTo(L, -0.2); g.stroke();
      g.fillStyle = u.look.gold ? GOLD : '#8a6a2a'; g.fillRect(0, -4, 2.2, 8);
      g.fillStyle = LEATHER; g.fillRect(-6, -1.2, 6, 2.4);
      if (def.look === 'rapier') { g.strokeStyle = GOLD; g.lineWidth = 0.8; g.beginPath(); g.arc(1, 0, 4, -1.4, 1.4); g.stroke(); }
      break;
    }
    case 'sabre': case 'dao': {
      g.fillStyle = metal; g.beginPath(); g.moveTo(2, -1.5); g.quadraticCurveTo(18, -2.5, 31, def.look === 'dao' ? -4 : -6); g.quadraticCurveTo(20, 0.5, 2, 1.5); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3, -1); g.quadraticCurveTo(18, -2, 29, def.look === 'dao' ? -3.5 : -5.5); g.stroke();
      g.fillStyle = u.look.gold ? GOLD : '#8a6a2a'; g.fillRect(0, -3, 2, 6);
      g.fillStyle = LEATHER; g.fillRect(-6, -1.2, 6, 2.4);
      break;
    }
    case 'spear': case 'lance': case 'halberd': {
      const L = def.look === 'lance' ? 78 : def.look === 'halberd' ? 64 : 66;
      g.strokeStyle = def.look === 'lance' ? mix(u.color, '#e8dcc0', 0.4) : WOOD; g.lineWidth = def.look === 'lance' ? 2.6 : 1.8; g.beginPath(); g.moveTo(-24, 0); g.lineTo(L - 22, 0); g.stroke();
      g.fillStyle = metal;
      g.beginPath(); g.moveTo(L - 22, -2.2); g.lineTo(L - 10, 0); g.lineTo(L - 22, 2.2); g.fill();
      if (def.look === 'halberd') { g.beginPath(); g.moveTo(L - 30, -1); g.lineTo(L - 26, -8); g.quadraticCurveTo(L - 22, -4, L - 20, -1); g.fill(); g.beginPath(); g.moveTo(L - 28, 1); g.lineTo(L - 25, 5); g.lineTo(L - 23, 1); g.fill(); }
      if (def.look === 'lance') { g.fillStyle = u.color; g.beginPath(); g.moveTo(L - 30, 0); g.lineTo(L - 42, -8); g.lineTo(L - 42, 0); g.fill(); }
      break;
    }
    case 'club': { g.fillStyle = WOOD; g.fillRect(0, -2, 30, 4); g.fillStyle = '#1d1d22'; for (let k = 8; k < 30; k += 4) { g.beginPath(); g.moveTo(k, -2); g.lineTo(k + 2, -4.5); g.lineTo(k + 4, -2); g.fill(); g.beginPath(); g.moveTo(k, 2); g.lineTo(k + 2, 4.5); g.lineTo(k + 4, 2); g.fill(); } break; }
    case 'axe': { g.strokeStyle = WOOD; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, 0); g.lineTo(28, 0); g.stroke(); g.fillStyle = metal; g.beginPath(); g.moveTo(22, 0); g.quadraticCurveTo(24, -9, 30, -10); g.lineTo(30, 4); g.quadraticCurveTo(24, 3, 22, 1.5); g.fill(); break; }
    case 'knife': { g.fillStyle = metal; g.beginPath(); g.moveTo(2, -1.4); g.lineTo(13, -0.4); g.lineTo(15, 0); g.lineTo(2, 1.4); g.fill(); g.fillStyle = '#222'; g.fillRect(-4, -1.4, 6, 2.8); break; }
    case 'bow': case 'longbow': {
      const R = def.look === 'longbow' ? 26 : 17;
      const recurve = def.look === 'bow';
      g.strokeStyle = recurve ? '#4a2c18' : WOOD; g.lineWidth = 2.2;
      const pull = u.drawing ? u.draw * 12 : 0;
      g.beginPath(); g.moveTo(-3, -R); if (recurve) { g.quadraticCurveTo(7, -R * 0.6, 4, 0); g.quadraticCurveTo(7, R * 0.6, -3, R); } else g.quadraticCurveTo(10, 0, -3, R); g.stroke();
      if (recurve) { g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.moveTo(3, -3); g.lineTo(3, 3); g.stroke(); }
      g.strokeStyle = 'rgba(240,230,210,0.9)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-3, -R); g.lineTo(-3 - pull, 0); g.lineTo(-3, R); g.stroke();
      if (u.drawing || u.cd <= 0) { g.strokeStyle = '#d8c8a8'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3 - pull, 0); g.lineTo(24 - pull, 0); g.stroke(); g.fillStyle = STEEL_D; g.beginPath(); g.moveTo(24 - pull, -1.5); g.lineTo(28 - pull, 0); g.lineTo(24 - pull, 1.5); g.fill(); g.fillStyle = '#c0392b'; g.fillRect(-3 - pull, -1.5, 4, 3); }
      break;
    }
    case 'crossbow': {
      g.fillStyle = WOOD; g.fillRect(-10, -2, 30, 4);
      g.strokeStyle = STEEL_D; g.lineWidth = 2; g.beginPath(); g.moveTo(16, -12); g.quadraticCurveTo(21, 0, 16, 12); g.stroke();
      g.strokeStyle = '#ddd'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(16, -12); g.lineTo(curWeapon(u).mag > 0 ? 6 : 14, 0); g.lineTo(16, 12); g.stroke();
      break;
    }
    case 'sling': { g.strokeStyle = '#8a6a44'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 6); g.stroke(); g.fillStyle = '#6b5a45'; g.beginPath(); g.arc(11, 7, 2, 0, TAU); g.fill(); break; }
    case 'javelin': { g.strokeStyle = WOOD; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-22, 0); g.lineTo(26, 0); g.stroke(); g.fillStyle = metal; g.beginPath(); g.moveTo(26, -1.6); g.lineTo(36, 0); g.lineTo(26, 1.6); g.fill(); break; }
    case 'grenade': { g.fillStyle = '#4a5a32'; g.beginPath(); g.ellipse(3, 0, 4, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#888'; g.fillRect(1, -4, 3, 2); break; }
    case 'arquebus': case 'musket': case 'rifle': {
      const L = def.look === 'arquebus' ? 40 : def.look === 'musket' ? 46 : 40;
      const recoil = -u.recoil * 4;
      g.translate(recoil, 0);
      g.fillStyle = def.look === 'rifle' ? '#5a3a20' : WOOD;
      g.beginPath(); g.moveTo(-12, 1); g.lineTo(-12, 5); g.lineTo(-2, 2.5); g.lineTo(L - 8, 1.6); g.lineTo(L - 8, -0.4); g.lineTo(-4, -0.6); g.closePath(); g.fill();
      g.fillStyle = def.look === 'rifle' ? '#2a2c30' : '#3d3f44'; g.fillRect(-2, -2, L, 2);
      g.fillStyle = def.look === 'rifle' ? '#202226' : '#a08a5a'; g.fillRect(2, -3, 5, 1.5);
      if (def.look !== 'rifle') { g.fillStyle = GOLD; g.fillRect(L - 10, -2.4, 2, 3); g.fillRect(4, -2.4, 1.5, 3); }
      if (bayonet || def.look === 'musket') { g.fillStyle = STEEL; g.beginPath(); g.moveTo(L - 2, -2.2); g.lineTo(L + 14, -1.4); g.lineTo(L - 2, -0.6); g.fill(); }
      if (def.look === 'arquebus' && u.reloadT <= 0) { g.strokeStyle = '#ff8a3d'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(4, -2); g.lineTo(2, -6); g.stroke(); }
      break;
    }
    case 'smg': {
      g.translate(-u.recoil * 2, 0);
      g.fillStyle = '#2a2c30'; g.fillRect(-6, -2.5, 30, 4); g.fillRect(-14, -1, 9, 3); g.fillRect(6, 1.5, 3, 9); g.fillStyle = '#3a3c40'; g.fillRect(22, -1.8, 6, 1.4);
      break;
    }
    case 'mg': {
      g.translate(-u.recoil * 2, 0);
      g.fillStyle = '#2a2c30'; g.fillRect(-12, -3, 44, 5); g.fillRect(-18, -1, 8, 4); g.fillStyle = '#4a4c50'; for (let k = 0; k < 6; k++) g.fillRect(4 + k * 4, -3.5, 2, 6); g.fillStyle = '#c8a24a'; g.fillRect(2, 2, 8, 2);
      g.strokeStyle = '#2a2c30'; g.lineWidth = 1; g.beginPath(); g.moveTo(26, 2); g.lineTo(30, 12); g.moveTo(26, 2); g.lineTo(22, 12); g.stroke();
      break;
    }
    case 'pistol': case 'revolver': case 'flintpistol': {
      g.translate(-u.recoil * 3, 0);
      g.fillStyle = def.look === 'flintpistol' ? WOOD : '#2a2c30'; g.beginPath(); g.moveTo(-1, -1); g.lineTo(-3, 6); g.lineTo(1, 6); g.lineTo(2, 1); g.fill();
      g.fillStyle = def.look === 'flintpistol' ? '#5a5a5a' : '#2a2c30'; g.fillRect(-1, -2.5, def.look === 'flintpistol' ? 15 : 12, 2.8);
      if (def.look === 'revolver') { g.fillStyle = '#44464a'; g.fillRect(1, -2.6, 4, 4); }
      if (def.look === 'flintpistol') { g.fillStyle = GOLD; g.fillRect(-1, -2.8, 3, 3.2); }
      break;
    }
  }
  g.restore();
}

function drawShield(g: Ctx, u: Unit, x: number, y: number, small: boolean) {
  const shape = u.look.shieldShape; if (shape === 'none') return;
  const k = small ? 0.75 : 1;
  g.save(); g.translate(x, y); g.scale(k, k);
  const face = u.look.gold ? mix(u.color, GOLD, 0.25) : u.color;
  const rim = u.look.helmet === 'crested' || u.look.helmet === 'galea' ? BRONZE : '#5a4632';
  g.lineWidth = 1.6; g.strokeStyle = rim;
  g.fillStyle = face;
  g.beginPath();
  if (shape === 'round') g.arc(0, 0, 10, 0, TAU);
  else if (shape === 'oval') g.ellipse(0, 0, 7, 12, 0, 0, TAU);
  else if (shape === 'scutum') { g.moveTo(-6, -15); g.quadraticCurveTo(0, -17, 6, -15); g.lineTo(6, 15); g.quadraticCurveTo(0, 17, -6, 15); g.closePath(); }
  else { g.moveTo(-7, -13); g.quadraticCurveTo(0, -15, 7, -13); g.lineTo(6, 2); g.quadraticCurveTo(3, 10, 0, 17); g.quadraticCurveTo(-3, 10, -6, 2); g.closePath(); }
  g.fill(); g.stroke();
  // emblem: boss, wings or bands
  g.fillStyle = u.look.gold ? GOLD : rim === BRONZE ? '#e0b060' : '#d8d2c0';
  if (shape === 'scutum') { g.fillRect(-6, -1.5, 12, 3); g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 0.7; for (const sy of [-9, 9]) { g.beginPath(); g.moveTo(-4, sy); g.quadraticCurveTo(0, sy - 3 * Math.sign(sy), 4, sy); g.stroke(); } }
  else if (shape === 'kite') { g.fillRect(-1.2, -12, 2.4, 26); g.fillRect(-6, -6, 12, 2.4); }
  else { g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 6.5, -2.4, -0.6); g.stroke(); }
  g.restore();
}

function drawHelmet(g: Ctx, h: Helmet, u: Unit, hx: number, hy: number) {
  const metal = u.look.gold ? GOLD : STEEL;
  const met = (c: string) => c;
  const plume = u.look.plume;
  g.lineWidth = 0.8;
  switch (h) {
    case 'crested': case 'galea': {
      g.fillStyle = met(u.look.gold ? GOLD : BRONZE);
      g.beginPath(); g.arc(hx, hy - 1, 7.2, Math.PI, 0); g.lineTo(hx + 7, hy + 3); g.lineTo(hx + 4, hy + 3); g.lineTo(hx + 4, hy + 1); g.lineTo(hx - 7.2, hy + 5); g.closePath(); g.fill();
      if (h === 'galea') { g.fillRect(hx - 8, hy + 1, 3, 4); g.fillStyle = shade(BRONZE, 0.7); g.fillRect(hx + 2, hy - 1, 2, 7); }
      if (plume) { g.fillStyle = plume; g.beginPath(); g.moveTo(hx - 8, hy - 6); g.quadraticCurveTo(hx - 2, hy - 15, hx + 6, hy - 7); g.quadraticCurveTo(hx, hy - 10, hx - 8, hy - 6); g.fill(); for (let i = -6; i < 6; i += 2) limb(g, hx + i, hy - 8 + Math.abs(i) * 0.3, hx + i - 0.5, hy - 12 + Math.abs(i) * 0.5, 1.2, shade(plume, 0.8)); }
      break;
    }
    case 'pileus': g.fillStyle = met(BRONZE); g.beginPath(); g.moveTo(hx - 6.5, hy - 1); g.quadraticCurveTo(hx, hy - 14, hx + 6.5, hy - 1); g.fill(); break;
    case 'spangen': case 'conical': {
      g.fillStyle = met(h === 'conical' ? (u.look.gold ? GOLD : '#9a8a6a') : metal);
      g.beginPath(); g.moveTo(hx - 7, hy); g.quadraticCurveTo(hx - 6, hy - 9, hx, hy - 13); g.quadraticCurveTo(hx + 6, hy - 9, hx + 7, hy); g.fill();
      if (h === 'spangen') { g.fillStyle = metal; g.fillRect(hx + 4.5, hy - 1, 1.6, 7); g.fillStyle = '#9aa0a8'; g.fillRect(hx - 7, hy + 1, 3, 7); } // nasal + mail
      else { g.fillStyle = u.color; g.fillRect(hx - 7.5, hy - 1, 15, 2); }
      break;
    }
    case 'greathelm': {
      g.fillStyle = met(metal); g.fillRect(hx - 7, hy - 8, 14, 15); g.beginPath(); g.arc(hx, hy - 8, 7, Math.PI, 0); g.fill();
      g.fillStyle = '#1a1a1a'; g.fillRect(hx + 1, hy - 3, 6, 1.6); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 3; k++) g.fillRect(hx + 3 + k * 1.4, hy + 1, 0.8, 3);
      if (u.look.gold) { g.fillStyle = GOLD; g.fillRect(hx - 1, hy - 15, 2, 22); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(hx + k * 4 - 1.5, hy - 15); g.lineTo(hx + k * 4, hy - 19); g.lineTo(hx + k * 4 + 1.5, hy - 15); g.fill(); } }
      if (plume) { g.fillStyle = plume; g.beginPath(); g.moveTo(hx - 2, hy - 15); g.quadraticCurveTo(hx - 14, hy - 22, hx - 16, hy - 6); g.quadraticCurveTo(hx - 10, hy - 14, hx - 2, hy - 12); g.fill(); }
      break;
    }
    case 'kettle': case 'morion': {
      g.fillStyle = met(metal);
      g.beginPath(); g.arc(hx, hy - 2, 6.4, Math.PI, 0); g.fill();
      if (h === 'morion') { g.beginPath(); g.moveTo(hx - 11, hy - 3); g.quadraticCurveTo(hx, hy + 1, hx + 11, hy - 3); g.quadraticCurveTo(hx, hy - 1, hx - 11, hy - 3); g.fill(); g.beginPath(); g.moveTo(hx - 6, hy - 6); g.quadraticCurveTo(hx, hy - 15, hx + 6, hy - 6); g.fill(); }
      else { g.fillRect(hx - 10, hy - 3, 20, 2); }
      if (plume) { g.fillStyle = plume; g.beginPath(); g.moveTo(hx - 3, hy - 10); g.quadraticCurveTo(hx - 12, hy - 18, hx - 14, hy - 8); g.quadraticCurveTo(hx - 8, hy - 13, hx - 3, hy - 8); g.fill(); }
      break;
    }
    case 'turbanhelm': {
      // spiked steel helmet wrapped in a turban, mail aventail (Timurid / Persian / Ottoman)
      g.fillStyle = '#e8e0cc'; g.beginPath(); g.ellipse(hx, hy - 1.5, 8.2, 4.2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.6; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(hx - 8, hy - 1 + k * 1.2); g.quadraticCurveTo(hx, hy - 3 + k * 1.6, hx + 8, hy - 2 + k * 1.2); g.stroke(); }
      g.fillStyle = met(metal); g.beginPath(); g.moveTo(hx - 5.5, hy - 4); g.quadraticCurveTo(hx - 5, hy - 10, hx, hy - 12); g.quadraticCurveTo(hx + 5, hy - 10, hx + 5.5, hy - 4); g.fill();
      g.fillRect(hx - 0.7, hy - 18, 1.4, 7);
      if (u.look.gold) { g.fillStyle = '#2f6f9c'; g.beginPath(); g.arc(hx + 2, hy - 7, 1.4, 0, TAU); g.fill(); g.fillStyle = GOLD; g.beginPath(); g.arc(hx - 2, hy - 6, 1, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(160,166,176,0.9)'; g.beginPath(); g.moveTo(hx - 7, hy + 1); g.lineTo(hx - 7, hy + 8); g.lineTo(hx - 2, hy + 8); g.lineTo(hx - 2, hy + 2); g.fill();
      if (plume) { g.fillStyle = plume; g.beginPath(); g.moveTo(hx, hy - 17); g.quadraticCurveTo(hx - 10, hy - 26, hx - 12, hy - 14); g.quadraticCurveTo(hx - 6, hy - 20, hx, hy - 15); g.fill(); }
      break;
    }
    case 'turban': { g.fillStyle = u.look.gold ? '#f4ead2' : '#e2d8c0'; g.beginPath(); g.ellipse(hx - 0.5, hy - 4, 8, 6.5, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.6; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(hx, hy - 3, 5 + k, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } if (u.look.gold) { g.fillStyle = '#b3261e'; g.beginPath(); g.arc(hx + 4, hy - 6, 1.6, 0, TAU); g.fill(); } break; }
    case 'fur': g.fillStyle = '#5a3e26'; g.beginPath(); g.ellipse(hx, hy - 3, 8, 5, 0, Math.PI, 0); g.fill(); g.fillStyle = u.color; g.beginPath(); g.moveTo(hx - 5, hy - 6); g.quadraticCurveTo(hx, hy - 15, hx + 4, hy - 6); g.fill(); break;
    case 'kabuto': {
      g.fillStyle = met(u.look.gold ? '#3a2a20' : '#2e2e34'); g.beginPath(); g.arc(hx, hy - 1, 7, Math.PI, 0); g.fill();
      g.beginPath(); g.moveTo(hx - 10, hy + 4); g.quadraticCurveTo(hx - 8, hy - 1, hx - 4, hy); g.lineTo(hx - 4, hy + 6); g.fill();
      g.fillStyle = u.look.gold ? GOLD : '#a08050'; g.beginPath(); g.moveTo(hx + 1, hy - 7); g.lineTo(hx + 7, hy - 15); g.lineTo(hx + 3, hy - 7); g.fill(); g.beginPath(); g.moveTo(hx - 1, hy - 7); g.lineTo(hx - 5, hy - 16); g.lineTo(hx - 3, hy - 7); g.fill();
      break;
    }
    case 'feather': { g.fillStyle = u.color; g.fillRect(hx - 7, hy - 4, 14, 3); const cols = [plume ?? '#2aa37a', '#d8a02c', '#b3261e', '#2aa37a', '#d8a02c']; for (let k = 0; k < (u.look.gold ? 7 : 4); k++) { g.fillStyle = cols[k % 5]; g.beginPath(); g.ellipse(hx - 4 + k * 1.6, hy - 11 - Math.sin(k) * 2, 1.6, 7, (k - 3) * 0.18, 0, TAU); g.fill(); } break; }
    case 'headband': g.fillStyle = u.color; g.fillRect(hx - 7, hy - 4, 14, 2.5); g.fillRect(hx - 9, hy - 3, 3, 6); break;
    case 'tricorne': g.fillStyle = '#1f1f24'; g.beginPath(); g.moveTo(hx - 10, hy - 3); g.lineTo(hx, hy - 12); g.lineTo(hx + 10, hy - 3); g.quadraticCurveTo(hx, hy - 6, hx - 10, hy - 3); g.fill(); break;
    case 'shako': {
      g.fillStyle = '#16161a'; g.beginPath(); g.moveTo(hx - 6, hy - 2); g.lineTo(hx - 7, hy - 16); g.lineTo(hx + 7, hy - 16); g.lineTo(hx + 6, hy - 2); g.fill();
      g.fillStyle = GOLD; g.beginPath(); g.arc(hx + 1, hy - 9, 2, 0, TAU); g.fill(); g.fillRect(hx - 7, hy - 4, 14, 1);
      g.fillStyle = '#111'; g.fillRect(hx + 1, hy - 3, 9, 1.6);
      if (plume) { g.fillStyle = plume; g.fillRect(hx - 1, hy - 23, 3, 8); }
      break;
    }
    case 'fez': g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(hx - 5.5, hy - 2); g.lineTo(hx - 4.5, hy - 12); g.lineTo(hx + 4.5, hy - 12); g.lineTo(hx + 5.5, hy - 2); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx, hy - 12); g.quadraticCurveTo(hx - 6, hy - 11, hx - 6, hy - 5); g.stroke(); break;
    case 'kepi': g.fillStyle = shade(u.color, 0.7); g.beginPath(); g.moveTo(hx - 6, hy - 2); g.lineTo(hx - 5, hy - 11); g.lineTo(hx + 6, hy - 10); g.lineTo(hx + 6, hy - 2); g.fill(); g.fillStyle = '#111'; g.fillRect(hx + 1, hy - 3, 8, 1.6); break;
    case 'helmet_round': case 'helmet_flared': {
      const c = mix(shade(u.color, 0.6), '#4d5a3a', 0.4);
      g.fillStyle = met(c); g.beginPath(); g.arc(hx, hy - 1, 7.4, Math.PI, 0); g.fill();
      if (h === 'helmet_flared') { g.beginPath(); g.moveTo(hx - 7.4, hy - 1); g.lineTo(hx - 9, hy + 4); g.lineTo(hx - 4, hy + 2); g.fill(); g.fillRect(hx + 3, hy - 1, 6, 1.6); }
      else { g.fillRect(hx - 9, hy - 1.5, 18, 2); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(hx + 5, hy); g.lineTo(hx + 4, hy + 6); g.stroke();
      break;
    }
    case 'cap': g.fillStyle = mix(shade(u.color, 0.55), '#6b6040', 0.55); g.beginPath(); g.arc(hx, hy - 2, 6.6, Math.PI, 0); g.fill(); g.fillRect(hx + 2, hy - 2.6, 8, 1.8); g.fillStyle = '#e0c040'; g.beginPath(); g.arc(hx + 1, hy - 5, 1.2, 0, TAU); g.fill(); g.fillStyle = mix(shade(u.color, 0.55), '#6b6040', 0.55); g.fillRect(hx - 8, hy - 2, 3, 7); break;
    case 'peaked': {
      g.fillStyle = shade(u.color, 0.45); g.beginPath(); g.moveTo(hx - 7, hy - 3); g.lineTo(hx - 8, hy - 9); g.quadraticCurveTo(hx, hy - 13, hx + 9, hy - 9); g.lineTo(hx + 7, hy - 3); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(hx + 2, hy - 3); g.quadraticCurveTo(hx + 8, hy - 3, hx + 10, hy - 1); g.lineTo(hx + 2, hy - 2); g.fill();
      g.fillStyle = GOLD; g.fillRect(hx - 7, hy - 4.5, 14, 1.2); g.beginPath(); g.arc(hx + 2, hy - 7.5, 1.6, 0, TAU); g.fill();
      break;
    }
    case 'crown': {
      g.fillStyle = met(GOLD); g.beginPath(); g.moveTo(hx - 6.5, hy - 2); g.lineTo(hx - 7, hy - 10); g.lineTo(hx - 4, hy - 6); g.lineTo(hx - 1.5, hy - 12); g.lineTo(hx + 1.5, hy - 6); g.lineTo(hx + 4.5, hy - 12); g.lineTo(hx + 7, hy - 6); g.lineTo(hx + 6.5, hy - 2); g.fill();
      g.fillStyle = '#b3261e'; g.beginPath(); g.arc(hx, hy - 4.5, 1.3, 0, TAU); g.fill(); g.fillStyle = '#2f6f9c'; g.beginPath(); g.arc(hx + 4, hy - 4.5, 1, 0, TAU); g.fill();
      break;
    }
    case 'none': break;
  }
}

function torso(g: Ctx, u: Unit, era: BEra) {
  const a = u.look.armor;
  const modernCloth = era === 'modern' ? mix(u.color, '#5d6440', 0.35) : u.color;
  const cloth = modernCloth, dark = shade(cloth, 0.62);
  // cape behind
  if (u.look.cape) {
    const flow = clamp(-u.vx * u.facing / 250, -0.3, 1) + Math.sin(u.walk * 0.7) * 0.08;
    g.fillStyle = u.look.gold ? shade(u.color, 0.75) : dark;
    g.beginPath(); g.moveTo(-3, -45); g.quadraticCurveTo(-14 - flow * 10, -30, -12 - flow * 18, -14 + flow * 4); g.lineTo(-4 - flow * 10, -12); g.quadraticCurveTo(-4, -30, 3, -44); g.fill();
    if (u.look.gold) { g.strokeStyle = GOLD; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-12 - flow * 18, -14 + flow * 4); g.lineTo(-4 - flow * 10, -12); g.stroke(); }
  }
  // long garments
  if (a === 'robe' || a === 'coat' || a === 'quilted') {
    g.fillStyle = a === 'coat' ? cloth : a === 'quilted' ? mix(cloth, '#d8cdb0', 0.35) : cloth;
    g.beginPath(); g.moveTo(-7, -42); g.lineTo(7, -42); g.lineTo(8, a === 'robe' ? -6 : -12); g.lineTo(-9, a === 'robe' ? -6 : -12); g.closePath(); g.fill();
  }
  const base = a === 'plate' ? STEEL : a === 'segmentata' ? '#a9aeb6' : a === 'mail' ? '#8e949c' : a === 'lamellar' ? (u.look.gold ? '#8a6a3a' : mix(cloth, '#5a4a3a', 0.5)) : a === 'linen' ? '#e8dfc6' : a === 'quilted' ? mix(cloth, '#d8cdb0', 0.45) : cloth;
  g.fillStyle = base;
  g.beginPath(); g.moveTo(-6.5, -45); g.quadraticCurveTo(0, -47.5, 7, -45); g.lineTo(6, -25); g.lineTo(-6, -25); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(-6.5, -34, 13, 9);
  if (OUTLINE) { g.strokeStyle = 'rgba(14,10,8,0.5)'; g.lineWidth = 0.9; g.stroke(); }
  g.strokeStyle = hexA(RIM, 0.45); g.lineWidth = 1.1; g.beginPath(); g.moveTo(u.facing > 0 ? 6.6 : -6.2, -44); g.lineTo(u.facing > 0 ? 5.7 : -5.7, -27); g.stroke();
  // texture details
  g.save(); g.beginPath(); g.moveTo(-6.5, -45); g.lineTo(7, -45); g.lineTo(6, -25); g.lineTo(-6, -25); g.closePath(); g.clip();
  g.fillStyle = 'rgba(10,8,20,0.16)'; g.fillRect(u.facing > 0 ? -7 : 0.5, -46, 7, 22); // shadow side
  if (a === 'plate' || a === 'segmentata' || a === 'mail' || (a === 'lamellar' && u.look.gold)) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(u.facing > 0 ? 2.5 : -4, -45, 1.6, 19); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(u.facing > 0 ? 4.6 : -5.8, -45, 0.9, 19); }
  if (a === 'tunic' || a === 'robe' || a === 'coat' || a === 'uniform' || a === 'quilted') { g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-3, -44); g.quadraticCurveTo(-1, -36, -3, -26); g.moveTo(3, -42); g.quadraticCurveTo(1.5, -35, 3.5, -27); g.stroke(); } // cloth folds
  if (a === 'mail') { g.strokeStyle = 'rgba(40,44,50,0.55)'; g.lineWidth = 0.5; for (let y = -45; y < -24; y += 2) for (let x = -7 + ((y / 2) % 2 ? 1 : 0); x < 8; x += 2) { g.beginPath(); g.arc(x, y, 0.9, 0, Math.PI); g.stroke(); } }
  if (a === 'lamellar') { g.strokeStyle = u.look.gold ? GOLD : 'rgba(20,16,12,0.6)'; g.lineWidth = 0.6; for (let y = -44; y < -24; y += 3) { g.beginPath(); g.moveTo(-7, y); g.lineTo(7, y); g.stroke(); for (let x = -6; x < 7; x += 2.2) { g.beginPath(); g.moveTo(x + (y % 2), y); g.lineTo(x + (y % 2), y + 3); g.stroke(); } } }
  if (a === 'segmentata') { g.strokeStyle = 'rgba(30,30,34,0.6)'; g.lineWidth = 0.7; for (let y = -40; y < -24; y += 3) { g.beginPath(); g.moveTo(-7, y); g.lineTo(7, y); g.stroke(); } g.fillStyle = BRONZE; g.fillRect(-1, -45, 2, 6); }
  if (a === 'plate') { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-2, -45, 1.4, 18); g.strokeStyle = 'rgba(20,20,24,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6, -33); g.quadraticCurveTo(0, -31, 6, -33); g.stroke(); if (u.look.gold) { g.strokeStyle = GOLD; g.lineWidth = 0.9; g.strokeRect(-5.5, -44.5, 11, 19); } }
  if (a === 'linen') { g.fillStyle = u.color; g.fillRect(-7, -38, 14, 2.4); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = -5; x < 6; x += 2.5) g.fillRect(x, -28, 1.2, 4); }
  if (a === 'quilted') { g.strokeStyle = 'rgba(80,60,40,0.4)'; g.lineWidth = 0.5; for (let x = -6; x < 7; x += 2.2) { g.beginPath(); g.moveTo(x, -45); g.lineTo(x, -24); g.stroke(); } }
  if (a === 'coat') { g.strokeStyle = '#efe9dc'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -45); g.lineTo(6, -27); g.moveTo(6, -45); g.lineTo(-6, -27); g.stroke(); g.fillStyle = GOLD; for (let y = -42; y < -26; y += 3.5) g.fillRect(3.5, y, 1.2, 1.2); }
  if (a === 'uniform') { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-5, -41, 4, 3.5); g.fillRect(1.5, -41, 4, 3.5); g.fillStyle = u.color; g.fillRect(-7, -40, 2.2, 4); }
  g.restore();
  // belt
  g.fillStyle = a === 'uniform' ? '#3a3226' : LEATHER; g.fillRect(-6.5, -28.5, 13, 2.6);
  g.fillStyle = u.look.gold ? GOLD : '#a08a5a'; g.fillRect(-1.2, -28.6, 2.4, 2.8);
  if (era === 'modern' && !u.isPlayer && u.role !== 'general') { g.fillStyle = '#4a3f2c'; g.fillRect(-7.5, -30, 3, 4); g.fillRect(4.5, -30, 3, 4); }
  // shoulder guards / pauldrons
  if (a === 'plate' || a === 'segmentata' || (a === 'lamellar' && u.look.gold)) { g.fillStyle = a === 'lamellar' ? GOLD : STEEL; g.beginPath(); g.ellipse(1, -44, 5, 3.2, 0.2, 0, TAU); g.fill(); }
  // skirt / pteruges
  if (a === 'linen' || a === 'segmentata' || a === 'tunic') { g.fillStyle = a === 'tunic' ? shade(cloth, 0.85) : u.color; g.fillRect(-6.5, -25, 13, 5); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = -6; x < 7; x += 2.2) g.fillRect(x, -25, 0.8, 5); }
  if (a === 'lamellar' || a === 'mail' || a === 'plate') { g.fillStyle = a === 'mail' ? '#7a8088' : shade(base, 0.8); g.beginPath(); g.moveTo(-7, -25); g.lineTo(7, -25); g.lineTo(8, -17); g.lineTo(-8, -17); g.fill(); }
}

function drawHorse(g: Ctx, u: Unit, s: BattleState, t: number) {
  const run = Math.abs(u.vx) > 40;
  const ph = u.walk * 1.4;
  const coat = ['#5a3b24', '#2c2622', '#8a6a4a', '#d8d0c4', '#6a4a30'][u.seed % 5];
  const bob = run ? Math.sin(ph * 2) * 2 : Math.sin(t * 2 + u.seed) * 0.4;
  g.save(); g.translate(0, bob);
  // legs
  const leg = (x: number, phase: number, back: boolean) => {
    const a = run ? Math.sin(ph + phase) * 0.7 : 0.05;
    const kx = x + Math.sin(a) * 12, ky = -22 + Math.cos(a) * 2;
    const k2 = run ? Math.max(0, Math.sin(ph + phase + 1)) * 0.9 : 0;
    const fx = kx + Math.sin(a - k2 * (back ? -1 : 1)) * 13, fy = ky + 13 * Math.cos(a - k2);
    limb(g, x, -34, kx, ky, 4.2, back ? shade(coat, 0.7) : coat);
    limb(g, kx, ky, fx, fy, 3, back ? shade(coat, 0.7) : coat);
    g.fillStyle = '#1a1612'; g.fillRect(fx - 2, fy - 1, 4, 3);
  };
  leg(-16, Math.PI, true); leg(16, 0, true);
  // body
  g.fillStyle = coat; g.beginPath(); g.ellipse(0, -42, 26, 11, 0, 0, TAU); g.fill();
  g.save(); g.clip(); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(-28, -40, 56, 12); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(-24, -53, 48, 4); g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(14, -46); g.quadraticCurveTo(18, -38, 14, -33); g.moveTo(-16, -48); g.quadraticCurveTo(-20, -40, -15, -33); g.stroke();
  // neck & head
  const nod = run ? Math.sin(ph * 2) * 0.08 : 0;
  g.save(); g.translate(20, -46); g.rotate(-0.85 + nod);
  g.fillStyle = coat; g.beginPath(); g.moveTo(-6, 6); g.lineTo(-4, -6); g.lineTo(20, -6); g.lineTo(22, 4); g.closePath(); g.fill();
  g.restore();
  g.save(); g.translate(32, -66); g.rotate(0.55 + nod);
  g.fillStyle = coat; g.beginPath(); g.ellipse(4, 0, 11, 5.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(0, -2, 0.9, 0, TAU); g.fill();
  g.fillStyle = coat; g.beginPath(); g.moveTo(-5, -4); g.lineTo(-3, -9); g.lineTo(-1, -4); g.fill();
  g.strokeStyle = '#3a2416'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-4, -3); g.lineTo(10, 2); g.lineTo(-6, 2); g.stroke();
  g.restore();
  // mane & tail
  g.strokeStyle = shade(coat, 0.45); g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(16, -52); g.quadraticCurveTo(22, -64, 28, -72); g.stroke();
  const tail = run ? Math.sin(ph) * 6 : Math.sin(t * 1.5 + u.seed) * 2;
  g.lineWidth = 3; g.beginPath(); g.moveTo(-25, -46); g.quadraticCurveTo(-36, -40 + tail, -34, -24 + tail); g.stroke();
  leg(-14, 0.3, false); leg(18, Math.PI + 0.3, false);
  // caparison in team colours
  g.fillStyle = u.look.gold ? mix(u.color, '#2a1a10', 0.15) : shade(u.color, 0.85);
  g.beginPath(); g.moveTo(-14, -52); g.lineTo(10, -52); g.lineTo(12, -36); g.quadraticCurveTo(0, -30, -16, -36); g.closePath(); g.fill();
  g.strokeStyle = u.look.gold ? GOLD : '#d8cdb0'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, -36); g.quadraticCurveTo(0, -30, -16, -36); g.stroke();
  g.fillStyle = '#3a2416'; g.fillRect(-8, -55, 14, 4);
  g.restore();
  void s;
}

function star(g: Ctx, x: number, y: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function drawUnit(g: Ctx, u: Unit, s: BattleState, t: number, markers = true) {
  const sc = depthScale(u.z);
  const sx = u.x - s.camX, sy = groundY(u.z);
  if (sx < -140 || sx > VIEW_W + 140) return;
  const era = s.cfg.era;
  // shadow
  g.fillStyle = `rgba(0,0,0,${0.26 * (u.dead ? 0.6 : 1)})`;
  const sl = SHADOW_LEN * sc * (u.horse ? 1.4 : 1) * (1 - Math.min(0.5, u.h / 200));
  g.beginPath(); g.ellipse(sx - sl * 0.5, sy, (u.horse ? 34 : 13) * sc + sl * 0.5, 3.6 * sc, 0, 0, TAU); g.fill();
  if (u.inspiredT > 0 && !u.dead) { g.strokeStyle = `rgba(253,224,130,${0.25 + 0.2 * Math.sin(t * 8)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(sx, sy, 18 * sc, 5 * sc, 0, 0, TAU); g.stroke(); }
  // settled corpses are rendered once into a sprite and blitted afterwards
  if (u.dead && u.deadT > 0.7 && u.h <= 0 && Math.abs(u.vx) < 5) {
    const fade = u.deadT > 20 ? clamp(1 - (u.deadT - 20) / 10, 0, 1) : 1;
    if (fade <= 0) return;
    if (cacheOwner !== s) { corpseCache.clear(); cacheOwner = s; }
    let c = corpseCache.get(u.id);
    if (!c) {
      const ks0 = sc * u.hScale; const W = Math.ceil(200 * ks0), H = Math.ceil(110 * ks0); const R = 1.6;
      const [cv, cg] = cnv(W * R, H * R);
      cg.scale(R, R); cg.translate(W / 2, H - 14 * ks0);
      drawBody(cg, u, s, t, era, ks0);
      c = { cv, ox: W / 2, oy: H - 14 * ks0, w: W, h: H };
      corpseCache.set(u.id, c);
      if (corpseCache.size > 160) { const first = corpseCache.keys().next().value; if (first !== undefined) corpseCache.delete(first); }
    }
    g.globalAlpha = fade; g.drawImage(c.cv, sx - c.ox, sy - c.oy, c.w, c.h); g.globalAlpha = 1;
    return;
  }
  g.save();
  g.translate(sx, sy - u.h);
  if (u.dead) {
    const fade = u.deadT > 20 ? clamp(1 - (u.deadT - 20) / 10, 0, 1) : 1;
    g.globalAlpha = fade;
    if (fade <= 0) { g.restore(); return; }
  }
  drawBody(g, u, s, t, era, sc * u.hScale);
  g.restore();
  drawUnitOverlays(g, u, s, t, markers, sc, sx, sy);
}
const corpseCache = new Map<number, { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }>();
let cacheOwner: BattleState | null = null;
export function resetBattleCaches(): void { corpseCache.clear(); }

function drawBody(g: Ctx, u: Unit, s: BattleState, t: number, era: BEra, ks: number) {
  g.scale(ks * u.facing, ks);

  const fall = u.dead ? Math.min(1, u.deadT / 0.45) : 0;
  if (u.charging && u.charge > 0.35 && !u.dead) {
    const k = (u.charge - 0.35) / 0.65;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 * k;
    const r = 34 + 10 * k; g.drawImage(blob('#ffc070', 'fire'), 10 - r, -34 - r, r * 2, r * 2); g.restore();
  }
  if (u.horse) {
    if (u.dead) { g.save(); g.rotate(-fall * 0.25); g.translate(0, fall * 10); drawHorse(g, { ...u, vx: 0 }, s, t); g.restore(); g.translate(-24 * fall, 0); g.rotate(u.fallDir * fall * Math.PI / 2); drawFoot(g, u, s, t, era, false); }
    else { drawHorse(g, u, s, t); g.translate(-2, -32); drawFoot(g, u, s, t, era, true); }
  } else {
    if (u.dead) { g.rotate(u.fallDir * fall * Math.PI / 2 + (u.h > 0 ? u.deadT * u.spin * u.facing : 0)); }
    else if (u.knockT > 0) {
      const k = u.knockT; const a = k > 0.85 ? (1.1 - k) / 0.25 : k < 0.3 ? k / 0.3 : 1;
      g.rotate(-a * Math.PI * 0.47);
    } else if (u.dodgeT > 0) {
      const k = 1 - u.dodgeT / 0.42; const dir = Math.sign(u.vx || u.facing) * u.facing;
      g.translate(0, -24); g.rotate(dir * k * TAU); g.scale(1, 0.82); g.translate(0, 24);
    }
    drawFoot(g, u, s, t, era, false);
  }
}

function drawUnitOverlays(g: Ctx, u: Unit, s: BattleState, t: number, markers: boolean, sc: number, sx: number, sy: number) {
  if (u.hitT > 0.06 && !u.dead) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; const r = 26 * sc; g.drawImage(blob('#ffffff'), sx - r, sy - u.h - unitHeight(u) * 0.55 - r, r * 2, r * 2); g.restore(); }
  if (!u.dead && (u.stunT > 0 || (u.knockT > 0 && u.knockT < 0.6))) {
    const top = sy - u.h - unitHeight(u) - 2;
    for (let i = 0; i < 3; i++) { const a = t * 6 + (i * TAU) / 3; g.fillStyle = '#fde68a'; star(g, sx + Math.cos(a) * 10 * sc, top + Math.sin(a) * 3 * sc, 2.6 * sc); }
  }
  // overhead markers
  if (!markers) return;
  if (!u.dead && (u.isPlayer || u.role === 'general')) {
    const top = sy - u.h - unitHeight(u) - 14 * sc;
    g.save(); g.translate(sx, top);
    if (u.isPlayer) { g.fillStyle = '#f6d37a'; g.beginPath(); g.moveTo(-6, -8); g.lineTo(0, 0); g.lineTo(6, -8); g.lineTo(0, -4); g.closePath(); g.fill(); }
    else { g.fillStyle = '#f87171'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-7, -7); g.lineTo(-3.5, -3.5); g.lineTo(0, -9); g.lineTo(3.5, -3.5); g.lineTo(7, -7); g.lineTo(7, 0); g.closePath(); g.fill(); }
    g.font = '600 11px "Cinzel", serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(u.name, 0, -14); g.fillStyle = u.isPlayer ? '#fde68a' : '#fecaca';
    g.fillText(u.name, 0, -14);
    if (!u.isPlayer) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-22, -32, 44, 4); g.fillStyle = '#ef4444'; g.fillRect(-22, -32, 44 * (u.hp / u.maxHp), 4); }
    g.restore();
  } else if (!u.dead && u.hp < u.maxHp && Math.abs(u.x - s.player.x) < 500) {
    const top = sy - u.h - unitHeight(u) - 6 * sc;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(sx - 12, top, 24, 2.5);
    g.fillStyle = u.team === 0 ? '#86efac' : '#f87171'; g.fillRect(sx - 12, top, 24 * (u.hp / u.maxHp), 2.5);
  }
}

/** Soldier on foot (or a rider's upper body when `mounted`). Local units: feet at 0, head ~ -51. */
function drawFoot(g: Ctx, u: Unit, s: BattleState, t: number, era: BEra, mounted: boolean) {
  const moving = !u.dead && (Math.abs(u.vx) > 12 || Math.abs(u.vz) > 0.02);
  const ph = u.walk;
  const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 : Math.sin(t * 2 + u.seed) * 0.4;
  const lean = mounted ? 0 : moving ? clamp((u.vx * u.facing) / 900, -0.08, 0.16) : 0;
  const skin = u.look.skin || '#d9a982';
  const era2 = era;
  const trouser = era2 === 'modern' ? mix(u.color, '#4d5236', 0.5) : era2 === 'industrial' ? '#e8e2d4' : u.look.armor === 'plate' ? STEEL_D : shade(u.color, 0.55);
  const boot = era2 === 'modern' || era2 === 'industrial' ? '#1e1a16' : LEATHER;
  // legs
  if (!mounted) {
    const legsAt = (phase: number, back: boolean) => {
      const a = moving ? Math.sin(ph + phase) * 0.62 : (back ? -0.08 : 0.1);
      const kx = Math.sin(a) * 12.5, ky = -26 + Math.cos(a) * 12.5;
      const bend = moving ? Math.max(0, Math.sin(ph + phase + 1.6)) * 0.9 : 0.05;
      const fx = kx + Math.sin(a - bend) * 12.5, fy = ky + Math.cos(a - bend) * 12.5;
      const col = back ? shade(trouser, 0.72) : trouser;
      limb(g, 0, -26 + bob, kx, ky + bob * 0.5, 4.6, col);
      limb(g, kx, ky + bob * 0.5, fx, Math.min(fy, -1), 3.8, col);
      g.fillStyle = back ? shade(boot, 0.8) : boot; g.beginPath(); g.ellipse(fx + 2, Math.min(fy, -1) + 0.6, 3.6, 1.8, 0, 0, TAU); g.fill();
      if (era2 === 'modern' || era2 === 'industrial' || era2 === 'renaissance') { g.fillStyle = back ? shade(boot, 0.8) : boot; g.save(); g.translate(kx, ky + bob * 0.5); g.rotate(-(a - bend)); g.fillRect(-2, 6, 4, 7); g.restore(); }
    };
    legsAt(Math.PI, true); legsAt(0, false);
  } else {
    limb(g, 0, -26, 9, -22, 4.6, trouser); limb(g, 9, -22, 7, -10, 3.8, trouser);
    g.fillStyle = boot; g.beginPath(); g.ellipse(9, -9, 3.6, 1.8, 0, 0, TAU); g.fill();
  }
  g.save(); g.translate(0, bob); g.rotate(lean);
  // weapon state & arm targets
  const w = curWeapon(u);
  const def = u.meleeMode ? u.melee : w.def;
  const isMelee = def.kind === 'melee';
  const shX = 1.5, shY = -43;
  let hx = 8, hy = -32, wa = 1.1; // front hand & weapon angle (radians, up positive)
  let bhx = -3, bhy = -31; // back hand
  let showBack = true; let backOnWeapon = false;
  const p = u.atkT > 0 && u.atkDur > 0 ? 1 - u.atkT / u.atkDur : 0;
  const aim = u.aim;
  const swing = u.atkKind === 'melee' || u.atkKind === 'heavy';
  const guard = u.blocking || u.blockT > 0;
  const bayonet = u.meleeMode && (w.def.look === 'musket' || w.def.look === 'rifle' || w.def.look === 'arquebus');
  if (u.dead) { hx = 10; hy = -34; wa = 0.2; }
  else if (isMelee || bayonet) {
    const thrust = def.look === 'spear' || def.look === 'lance' || def.look === 'halberd' || def.look === 'rapier' || def.look === 'knife' || bayonet;
    if (thrust) {
      const k = swing ? (p < 0.35 ? -p / 0.35 * 6 : p < 0.6 ? -6 + (p - 0.35) / 0.25 * 22 : 16 - (p - 0.6) / 0.4 * 16) : 0;
      hx = 6 + k; hy = -34; wa = guard ? 0.9 : def.look === 'halberd' && swing ? 0.6 - p * 1.2 : swing ? 0.05 : (u.horse ? 0.12 : def.look === 'knife' ? 0.3 : 0.38);
      if (def.twoHanded || bayonet) { backOnWeapon = true; bhx = hx - 10; bhy = hy + 1 + Math.sin(wa) * -8; }
      if (bayonet) { hx += 4; wa = swing ? 0.02 : guard ? 0.9 : 0.2; }
    } else {
      let al: number;
      const wind = u.atkKind === 'heavy' ? 0.45 : 0.35;
      if (swing) al = p < wind ? 0.3 + (p / wind) * (u.atkKind === 'heavy' ? 2.5 : 1.9) : p < wind + 0.27 ? (u.atkKind === 'heavy' ? 2.8 : 2.2) - ((p - wind) / 0.27) * (u.atkKind === 'heavy' ? 3.7 : 2.9) : -0.85 + ((p - wind - 0.27) / (0.73 - wind)) * 1.1;
      else if (u.charging) al = 0.3 + u.charge * 2.3 + Math.sin(t * 30) * 0.03 * u.charge;
      else al = guard ? 1.0 : 0.25 + Math.sin(t * 1.6 + u.seed) * 0.03;
      hx = shX + Math.cos(al) * 14; hy = shY - Math.sin(al) * 14 + 4;
      wa = swing || u.charging ? al + 0.35 : guard ? 0.15 : 1.25;
      if (guard) { hx = shX + 10; hy = shY - 4; }
    }
  } else if (def.kind === 'bow') {
    const a = u.drawing || u.atkT > 0 ? aim : (u.isPlayer ? aim * 0.5 : 0.25);
    hx = shX + Math.cos(a) * 16; hy = shY + 1 - Math.sin(a) * 16; wa = a;
    bhx = hx - Math.cos(a) * (6 + u.draw * 13); bhy = hy + Math.sin(a) * (6 + u.draw * 13);
  } else if (def.kind === 'gun' || def.kind === 'crossbow') {
    const reloading = u.reloadT > 0;
    const a = reloading ? 0.95 : aim;
    if (def.twoHanded || def.kind === 'crossbow') {
      hx = shX + Math.cos(a) * 15; hy = shY + 3 - Math.sin(a) * 15; wa = a;
      bhx = shX + Math.cos(a) * 3; bhy = shY + 5 - Math.sin(a) * 3;
      if (reloading) { const r = (u.reloadT * 3) % 1; bhx = hx - 6 + r * 8; bhy = hy - 10 - r * 6; }
      backOnWeapon = true;
    } else {
      hx = shX + Math.cos(a) * 17; hy = shY + 2 - Math.sin(a) * 17; wa = a;
      if (reloading) { hx = 8; hy = -36; wa = 1.2; bhx = 6; bhy = -38 + Math.sin(u.reloadT * 10) * 2; }
    }
  } else if (def.kind === 'throw' || def.kind === 'grenade' || def.kind === 'sling') {
    if (u.atkKind === 'throw') { const al = p < 0.4 ? 1.2 + p * 2.5 : 2.2 - (p - 0.4) * 5; hx = shX + Math.cos(al) * 15; hy = shY - Math.sin(al) * 15; wa = def.kind === 'throw' ? 0.25 : al; }
    else if (def.kind === 'throw') { hx = shX - 2; hy = shY - 12; wa = 0.12 + aim * 0.3; }
    else { hx = 7; hy = -30; wa = def.kind === 'sling' ? -1.2 + Math.sin(t * 9) * (u.isPlayer ? 0.3 : 2) : 0; }
  }
  // back arm (behind the torso)
  const sleeve = u.look.armor === 'plate' ? STEEL : u.look.armor === 'mail' ? '#8e949c' : era === 'modern' ? mix(u.color, '#5d6440', 0.35) : u.look.armor === 'lamellar' ? mix(u.color, '#5a4a3a', 0.4) : u.color;
  if (showBack && !backOnWeapon) {
    const [ex, ey] = ik(shX - 2, shY + 1, bhx, bhy, 9.5, -1);
    limb(g, shX - 2, shY + 1, ex, ey, 3.6, shade(sleeve, 0.7)); limb(g, ex, ey, bhx, bhy, 3.2, shade(sleeve, 0.7));
    g.fillStyle = shade(skin, 0.8); g.beginPath(); g.arc(bhx, bhy, 1.9, 0, TAU); g.fill();
  }
  const twoHandUse = def.twoHanded || def.kind === 'bow' || (def.kind === 'gun' && def.twoHanded) || def.kind === 'crossbow' || bayonet;
  if (u.shield && twoHandUse) drawShield(g, u, -6, -34, true); // slung on the back
  torso(g, u, era);
  // head
  const hx0 = 1.5, hy0 = -51;
  g.fillStyle = skin; g.fillRect(-1.2, -47.5, 3.6, 3);
  g.beginPath(); g.arc(hx0, hy0, 6.2, 0, TAU); g.fill();
  if (OUTLINE) { g.strokeStyle = 'rgba(14,10,8,0.5)'; g.lineWidth = 0.9; g.stroke(); }
  g.strokeStyle = hexA(RIM, 0.5); g.lineWidth = 1; g.beginPath(); g.arc(hx0, hy0, 5.6, u.facing > 0 ? -1.1 : Math.PI - 1.1 + 2.2 - 2.2, u.facing > 0 ? 1.1 : Math.PI + 1.1); g.stroke();
  g.fillStyle = shade(skin, 0.82); g.beginPath(); g.arc(hx0 - 1.2, hy0 + 0.8, 5, Math.PI * 0.6, Math.PI * 1.4); g.fill();
  g.fillStyle = shade(skin, 0.75); g.beginPath(); g.ellipse(hx0 - 1.6, hy0 + 0.6, 1.3, 1.8, 0, 0, TAU); g.fill(); // ear
  g.fillStyle = shade(skin, 0.88); g.beginPath(); g.moveTo(hx0 + 5.6, hy0 - 0.6); g.lineTo(hx0 + 7.4, hy0 + 1.6); g.lineTo(hx0 + 5.6, hy0 + 2); g.fill(); // nose
  if (!u.dead) {
    g.fillStyle = '#f4efe6'; g.fillRect(hx0 + 2.4, hy0 - 1.6, 2, 1.4);
    g.fillStyle = '#1a1410'; g.fillRect(hx0 + 3.3, hy0 - 1.6, 1.1, 1.4);
    g.strokeStyle = 'rgba(30,20,14,0.85)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx0 + 1.8, hy0 - 2.6 - (u.atkT > 0 || u.charging ? 0.6 : 0)); g.lineTo(hx0 + 4.8, hy0 - 2.2); g.stroke(); // brow
    g.strokeStyle = 'rgba(90,40,30,0.7)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(hx0 + 3.6, hy0 + 3.4); g.lineTo(hx0 + 5.4, hy0 + 3.2 + (u.atkT > 0 ? 0.8 : 0)); g.stroke(); // mouth
  } else { g.strokeStyle = '#1a1410'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(hx0 + 2.4, hy0 - 1); g.lineTo(hx0 + 4.4, hy0 - 1); g.stroke(); }
  if (u.look.beard) { g.fillStyle = u.isPlayer ? '#3a2a1e' : ['#2a1e14', '#4a3420', '#1a1612'][u.seed % 3]; g.beginPath(); g.moveTo(hx0 + 5.8, hy0 + 1); g.quadraticCurveTo(hx0 + 5, hy0 + 8, hx0 - 1, hy0 + 6.5); g.lineTo(hx0 - 3, hy0 + 2); g.fill(); }
  if (u.look.helmet === 'none' || u.look.helmet === 'headband' || u.look.helmet === 'feather') { g.fillStyle = '#1e1612'; g.beginPath(); g.arc(hx0 - 0.5, hy0 - 1.5, 6.3, Math.PI * 0.95, Math.PI * 1.95); g.fill(); }
  drawHelmet(g, u.look.helmet, u, hx0, hy0);
  // standard pole
  if (u.role === 'standard' && !u.dead) {
    g.strokeStyle = WOOD; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -20); g.lineTo(-6, -104); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.arc(-6, -106, 2.4, 0, TAU); g.fill();
    const wave = (k: number) => Math.sin(t * 6 - k * 0.25 + u.seed) * (1.5 + k * 0.12);
    g.fillStyle = u.color; g.beginPath(); g.moveTo(-6, -102);
    for (let k = 0; k <= 30; k += 3) g.lineTo(-6 - k, -102 + wave(k));
    for (let k = 30; k >= 0; k -= 3) g.lineTo(-6 - k, -80 + wave(k));
    g.closePath(); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(-20, -91 + wave(14), 4, 0, TAU); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -80); for (let k = 0; k <= 30; k += 3) g.lineTo(-6 - k, -80 + wave(k)); g.stroke();
  }
  // weapon & front arm
  const holdAngle = wa;
  if (backOnWeapon) {
    const [ex, ey] = ik(shX - 1, shY + 1, bhx, bhy, 9.5, -1);
    limb(g, shX - 1, shY + 1, ex, ey, 3.6, shade(sleeve, 0.8)); limb(g, ex, ey, bhx, bhy, 3.2, shade(sleeve, 0.8));
  }
  if (u.drawing && def.kind === 'bow') {
    const [ex, ey] = ik(shX, shY, bhx, bhy, 9.5, 1);
    limb(g, shX, shY, ex, ey, 3.6, shade(sleeve, 0.85)); limb(g, ex, ey, bhx, bhy, 3.2, shade(sleeve, 0.85));
  }
  drawWeapon(g, def, hx, hy, holdAngle, u, bayonet);
  const [ex, ey] = ik(shX + 1, shY, hx, hy, 9.5, 1);
  limb(g, shX + 1, shY, ex, ey, 3.8, sleeve); limb(g, ex, ey, hx, hy, 3.3, sleeve);
  g.fillStyle = u.look.armor === 'plate' ? STEEL_D : era === 'modern' ? skin : skin; g.beginPath(); g.arc(hx, hy, 2.1, 0, TAU); g.fill();
  if (backOnWeapon) { g.fillStyle = skin; g.beginPath(); g.arc(bhx, bhy, 1.9, 0, TAU); g.fill(); }
  // shield carried on the off arm in front of the body
  if (u.shield && !twoHandUse && u.role !== 'standard') drawShield(g, u, u.atkKind === 'bash' ? 5 + Math.sin(p * Math.PI) * 10 : guard ? 8 : 5, guard ? -39 : -33, false);
  g.restore();
}

// ------------------------------------------------------------------------------------------ projectiles & particles
function drawProjectile(g: Ctx, p: Projectile, s: BattleState) {
  const sx = p.x - s.camX; if (sx < -80 || sx > VIEW_W + 80) return;
  const gy = groundY(clamp(p.z, 0, 1)); const sc = depthScale(clamp(p.z, 0, 1));
  const sy = gy - p.h;
  const ang = p.stuck ? Math.atan2(-p.vh, p.vx) : Math.atan2(-p.vh, p.vx);
  if (!p.stuck && p.h > 4) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(sx, gy, 6 * sc, 1.4 * sc, 0, 0, TAU); g.fill(); }
  g.save(); g.translate(sx, p.stuck ? gy + 2 : sy); g.rotate(p.stuck ? clamp(ang, 0.3, 2.8) : ang); g.scale(sc, sc);
  switch (p.kind) {
    case 'arrow': case 'bolt': {
      const L = p.kind === 'bolt' ? 16 : 24;
      g.strokeStyle = '#c8b48a'; g.lineWidth = p.kind === 'bolt' ? 1.6 : 1.1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(p.stuck ? -4 : 0, 0); g.stroke();
      if (!p.stuck) { g.fillStyle = STEEL_D; g.beginPath(); g.moveTo(0, -1.6); g.lineTo(4, 0); g.lineTo(0, 1.6); g.fill(); }
      g.fillStyle = p.team === 0 ? '#e8e0c8' : '#a33'; g.beginPath(); g.moveTo(-L, 0); g.lineTo(-L + 5, -2.2); g.lineTo(-L + 6, 0); g.lineTo(-L + 5, 2.2); g.fill();
      break;
    }
    case 'javelin': g.strokeStyle = WOOD; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-34, 0); g.lineTo(p.stuck ? -6 : 0, 0); g.stroke(); if (!p.stuck) { g.fillStyle = STEEL; g.beginPath(); g.moveTo(0, -1.6); g.lineTo(9, 0); g.lineTo(0, 1.6); g.fill(); } break;
    case 'stone': g.fillStyle = '#6a5e4e'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill(); break;
    case 'ball': g.strokeStyle = 'rgba(255,230,180,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-26, 0); g.lineTo(0, 0); g.stroke(); g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill(); break;
    case 'bullet': { g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,200,90,0.25)'; g.beginPath(); g.moveTo(-38, 0); g.lineTo(-14, 0); g.stroke(); g.strokeStyle = 'rgba(255,230,150,0.95)'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(0, 0); g.stroke(); break; }
    case 'grenade': g.rotate(s.t * 10); g.fillStyle = '#3f4a2c'; g.beginPath(); g.ellipse(0, 0, 4, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#888'; g.fillRect(-1, -4.5, 3, 2); break;
    case 'cannonball': g.fillStyle = 'rgba(40,40,40,0.25)'; g.fillRect(-30, -3, 30, 6); g.fillStyle = '#1e1e20'; g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(-1.2, -1.4, 1.4, 0, TAU); g.fill(); break;
    case 'boulder': g.rotate(s.t * 3); g.fillStyle = '#6b6254'; g.beginPath(); for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; const r = 10 + ((k * 37) % 5); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(3, 3, 5, 0, TAU); g.fill(); break;
    case 'shell': g.strokeStyle = 'rgba(220,220,220,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-60, 0); g.lineTo(0, 0); g.stroke(); g.fillStyle = '#3a3a34'; g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, TAU); g.fill(); break;
  }
  g.restore();
}

function drawParticle(g: Ctx, p: Particle, s: BattleState) {
  const sx = p.x - s.camX; if (sx < -120 || sx > VIEW_W + 120) return;
  const sc = depthScale(clamp(p.z, 0, 1));
  const sy = groundY(clamp(p.z, 0, 1)) - p.h;
  const k = p.life / p.max;
  switch (p.kind) {
    case 'smoke': case 'dust': {
      const a = (p.kind === 'smoke' ? 0.5 : 0.35) * Math.min(1, k * 1.6) * (p.kind === 'dust' ? k : 1);
      const r = p.size * sc;
      g.globalAlpha = clamp(a, 0, 1); g.drawImage(blob(p.color), sx - r, sy - r, r * 2, r * 2); g.globalAlpha = 1; break;
    }
    case 'fire': case 'flash': case 'muzzle': case 'ember': {
      g.save(); g.globalCompositeOperation = 'lighter';
      const r = p.size * sc * (p.kind === 'flash' ? 1 + (1 - k) : 1);
      g.globalAlpha = clamp(k, 0, 1); g.drawImage(blob(p.color, 'fire'), sx - r, sy - r, r * 2, r * 2); g.globalAlpha = 1;
      if (p.kind === 'muzzle') { g.fillStyle = hexA('#fff2b0', k); g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + p.rot; const rr = i % 2 ? r * 0.25 : r * 0.9; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.6); } g.fill(); }
      g.restore(); break;
    }
    case 'spark': g.strokeStyle = hexA('#ffe08a', k); g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx * 0.02, sy + p.vh * 0.02); g.stroke(); break;
    case 'blood': g.fillStyle = hexA(p.color, Math.min(1, k * 2) * 0.75); g.beginPath(); g.arc(sx, sy, p.size * sc * 0.4, 0, TAU); g.fill(); break;
    case 'debris': g.fillStyle = hexA(p.color, Math.min(1, k * 2)); g.save(); g.translate(sx, sy); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); g.restore(); break;
    case 'ring': g.strokeStyle = hexA(p.color, k * 0.7); g.lineWidth = 3 * k + 0.5; g.beginPath(); g.ellipse(sx, sy, p.size * (1 - k) * 1.2 + 4, (p.size * (1 - k) * 1.2 + 4) * 0.35, 0, 0, TAU); g.stroke(); break;
    case 'leaf': break;
    case 'slash': {
      const r = p.size * sc; const dir = p.vx >= 0 ? 1 : -1;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(sx, sy); g.scale(dir, 1);
      g.strokeStyle = hexA(p.color, k * 0.85); g.lineWidth = 5 * k + 1; g.lineCap = 'round';
      g.beginPath(); g.arc(-r * 0.3, 8, r * 0.8, -1.9 + (1 - k) * 0.6, 0.6); g.stroke();
      g.strokeStyle = hexA('#ffffff', k * 0.6); g.lineWidth = 1.5; g.beginPath(); g.arc(-r * 0.3, 8, r * 0.8, -1.6 + (1 - k) * 0.6, 0.4); g.stroke();
      g.restore(); break;
    }
  }
}

// ------------------------------------------------------------------------------------------ frame
// ------------------------------------------------------------------------------------------ weather (screen space, purely visual)
type WKind = 'snow' | 'rain' | 'embers' | 'dust' | 'ash' | 'pollen';
interface WP { x: number; y: number; vx: number; vy: number; s: number; a: number; ph: number }
let weather: { key: string; kind: WKind; ps: WP[]; last: number; cam: number } | null = null;
function weatherKind(s: BattleState): WKind {
  const { terrain, time, era, seed } = s.cfg;
  if (terrain === 'snow') return 'snow';
  if (era === 'modern') return 'ash';
  if (time === 'overcast' && seed % 2 === 0) return 'rain';
  if (time === 'dusk') return 'embers';
  if (terrain === 'desert' || terrain === 'steppe') return 'dust';
  return 'pollen';
}
function drawWeather(g: Ctx, s: BattleState, t: number) {
  const key = `${s.cfg.seed}|${s.cfg.terrain}|${s.cfg.time}`;
  if (!weather || weather.key !== key) {
    const kind = weatherKind(s);
    const n = kind === 'rain' ? 260 : kind === 'snow' ? 220 : kind === 'dust' ? 90 : 70;
    const ps: WP[] = Array.from({ length: n }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, vx: 0, vy: 0, s: Math.random(), a: Math.random(), ph: Math.random() * 6 }));
    weather = { key, kind, ps, last: t, cam: s.camX };
  }
  const W = weather; const dt = clamp(t - W.last, 0, 0.05); W.last = t;
  const wind = s.wind;
  const camD = clamp(s.camX - W.cam, -200, 200) * 0.9; W.cam = s.camX;
  g.save();
  if (W.kind === 'embers') g.globalCompositeOperation = 'lighter';
  const lim = Math.floor(W.ps.length * (QUALITY === 2 ? 1 : QUALITY === 1 ? 0.6 : 0.3));
  for (let i = 0; i < lim; i++) {
    const p = W.ps[i];
    switch (W.kind) {
      case 'rain': p.vx = wind * 4 - 120; p.vy = 900 + p.s * 400; break;
      case 'snow': p.vx = wind * 1.2 + Math.sin(t + p.ph) * 20; p.vy = 30 + p.s * 50; break;
      case 'embers': p.vx = wind + Math.sin(t * 2 + p.ph) * 15; p.vy = -20 - p.s * 30; break;
      case 'dust': p.vx = 120 + wind * 3 + p.s * 80; p.vy = Math.sin(t + p.ph) * 10; break;
      case 'ash': p.vx = wind + Math.sin(t + p.ph) * 12; p.vy = 18 + p.s * 25; break;
      case 'pollen': p.vx = wind * 0.6 + Math.sin(t * 0.7 + p.ph) * 10; p.vy = Math.cos(t * 0.6 + p.ph) * 8; break;
    }
    p.x += p.vx * dt - camD; p.y += p.vy * dt;
    if (p.x < -20) p.x += VIEW_W + 40; if (p.x > VIEW_W + 20) p.x -= VIEW_W + 40;
    if (p.y > VIEW_H + 10) { p.y = -10; p.x = Math.random() * VIEW_W; } if (p.y < -12) p.y = VIEW_H + 8;
    switch (W.kind) {
      case 'rain': g.strokeStyle = `rgba(200,210,225,${0.25 + p.s * 0.25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02); g.stroke(); break;
      case 'snow': { g.fillStyle = `rgba(255,255,255,${(0.5 + p.s * 0.4).toFixed(2)})`; const r = 1 + p.s * 2.2; g.fillRect(p.x - r / 2, p.y - r / 2, r, r); break; }
      case 'embers': g.fillStyle = `rgba(255,${150 + Math.floor(p.s * 80)},80,${(0.35 + 0.35 * Math.sin(t * 5 + p.ph)).toFixed(2)})`; g.fillRect(p.x, p.y, 1.5 + p.s * 1.5, 1.5 + p.s * 1.5); break;
      case 'dust': g.fillStyle = `rgba(214,190,140,${0.06 + p.s * 0.08})`; g.beginPath(); g.ellipse(p.x, p.y, 18 + p.s * 30, 3 + p.s * 3, 0, 0, TAU); g.fill(); break;
      case 'ash': g.fillStyle = `rgba(70,66,62,${0.4 + p.s * 0.3})`; g.fillRect(p.x, p.y, 1.5 + p.s * 2, 1.5 + p.s * 1.5); break;
      case 'pollen': g.fillStyle = `rgba(255,248,210,${(0.25 + 0.25 * Math.sin(t * 2 + p.ph)).toFixed(2)})`; g.fillRect(p.x, p.y, 1.5 + p.s, 1.5 + p.s); break;
    }
  }
  if (W.kind === 'rain') { g.fillStyle = 'rgba(40,50,64,0.12)'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  g.restore();
}

function drawFires(g: Ctx, bd: Backdrop, s: BattleState, t: number, layer: 'mid' | 'near') {
  const par = layer === 'near' ? PAR.near : PAR.mid;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of bd.fires) {
    if (f.layer !== layer) continue;
    const x = f.x - s.camX * par; if (x < -60 || x > VIEW_W + 60) continue;
    const fl = 0.75 + 0.25 * Math.sin(t * 13 + f.x) * Math.sin(t * 7.3 + f.y);
    const r = 26 * f.s * fl * (layer === 'mid' ? 0.6 : 1);
    g.globalAlpha = 0.55 * (0.6 + bd.pal.night); g.drawImage(blob('#ff9a3a', 'fire'), x - r * 2, f.y - r * 2, r * 4, r * 4);
    g.globalAlpha = 0.9; g.drawImage(blob('#ffd27a', 'fire'), x - r * 0.35, f.y - r * 0.9, r * 0.7, r);
  }
  g.restore();
}

function drawPlane(g: Ctx, x: number, y: number) {
  g.save(); g.translate(x, y); g.fillStyle = '#2a2c30';
  g.beginPath(); g.ellipse(0, 0, 34, 5, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-4, 0); g.lineTo(-14, -26); g.lineTo(-4, -26); g.lineTo(10, 0); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-4, 0); g.lineTo(-14, 22); g.lineTo(-6, 22); g.lineTo(8, 0); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-30, 0); g.lineTo(-38, -12); g.lineTo(-33, 0); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-20, -6, 50, 1.5);
  g.restore();
}

function drawMinimap(g: Ctx, s: BattleState, t: number) {
  const W = 420, H = 30, x0 = (VIEW_W - W) / 2, y0 = 76;
  g.save();
  g.fillStyle = 'rgba(8,8,12,0.62)'; g.strokeStyle = 'rgba(217,182,92,0.55)'; g.lineWidth = 1;
  g.beginPath(); g.roundRect(x0, y0, W, H, 6); g.fill(); g.stroke();
  const mx = (x: number) => x0 + 6 + (x / WORLD_W) * (W - 12);
  const my = (z: number) => y0 + 5 + z * (H - 10);
  // camera window
  g.fillStyle = 'rgba(255,240,200,0.08)'; g.strokeStyle = 'rgba(255,240,200,0.35)';
  g.fillRect(mx(s.camX), y0 + 2, (VIEW_W / WORLD_W) * (W - 12), H - 4); g.strokeRect(mx(s.camX), y0 + 2, (VIEW_W / WORLD_W) * (W - 12), H - 4);
  for (const u of s.units) {
    if (u.dead) continue;
    const c = u.team === 0 ? '#7dd3fc' : '#f87171';
    if (u.role === 'general' && !u.isPlayer) { g.fillStyle = '#fca5a5'; star(g, mx(u.x), my(u.z), 4.5); continue; }
    if (u.role === 'standard') { g.fillStyle = u.team === 0 ? '#bae6fd' : '#fecaca'; g.fillRect(mx(u.x) - 1, my(u.z) - 5, 2, 6); g.fillRect(mx(u.x), my(u.z) - 5, 4, 3); continue; }
    if (u.isPlayer) continue;
    g.fillStyle = u.routing ? 'rgba(200,200,200,0.5)' : c; g.beginPath(); g.arc(mx(u.x), my(u.z), u.horse ? 2 : 1.5, 0, TAU); g.fill();
  }
  for (const k of s.strikes) { g.strokeStyle = `rgba(251,191,36,${0.5 + 0.5 * Math.sin(t * 10)})`; g.beginPath(); g.arc(mx(k.x), my(k.z), 5, 0, TAU); g.stroke(); }
  if (!s.player.dead) { g.fillStyle = '#fde68a'; star(g, mx(s.player.x), my(s.player.z), 5); }
  if (s.order === 'hold') { g.strokeStyle = 'rgba(147,197,253,0.8)'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(mx(s.holdX), y0 + 2); g.lineTo(mx(s.holdX), y0 + H - 2); g.stroke(); g.setLineDash([]); }
  g.restore();
}

// ------------------------------------------------------------------------------------------ frame
export function render(g: Ctx, s: BattleState, mouse: { x: number; y: number }, t: number): void {
  const key = `${s.cfg.seed}|${s.cfg.era}|${s.cfg.terrain}|${s.cfg.time}|${s.cfg.teams[0].culture}|${s.cfg.teams[1].culture}`;
  if (!cache || cache.key !== key) cache = { key, bd: buildBackdrop(s) };
  const bd = cache.bd;
  RIM = bd.pal.light; OUTLINE = QUALITY > 0; SHADOW_LEN = 6 + bd.pal.night * 70 + (s.cfg.time === 'dawn' ? 24 : 0);
  g.save();
  const shx = s.shake ? (Math.random() - 0.5) * s.shake : 0, shy = s.shake ? (Math.random() - 0.5) * s.shake : 0;
  g.translate(shx, shy);
  // camera zoom around the focus point
  g.translate(s.pivotX, s.pivotY); g.scale(s.zoom, s.zoom); g.translate(-s.pivotX, -s.pivotY);
  g.drawImage(bd.sky, 0, 0);
  const span = VIEW_W + 700;
  for (const c of bd.clouds) {
    const par = c.layer ? 0.06 : 0.03;
    const x = ((c.x + t * c.v - s.camX * par) % span + span) % span - 520;
    g.globalAlpha = c.a; g.drawImage(c.sprite, x, c.y); g.globalAlpha = 1;
  }
  // birds wheeling over the field
  g.strokeStyle = 'rgba(20,16,14,0.7)'; g.lineWidth = 1.2;
  for (const b of bd.birds) {
    const x = ((b.x + t * b.v - s.camX * 0.08) % (VIEW_W + 100) + VIEW_W + 100) % (VIEW_W + 100) - 50, y = b.y + Math.sin(t * 0.6 + b.ph) * 10;
    const f = Math.sin(t * 9 + b.ph) * 3;
    g.beginPath(); g.moveTo(x - 5, y - f); g.quadraticCurveTo(x - 2, y - 1, x, y); g.quadraticCurveTo(x + 2, y - 1, x + 5, y - f); g.stroke();
  }
  for (const pl of s.planes) drawPlane(g, pl.x, pl.y);
  g.drawImage(bd.far, -s.camX * PAR.far, 0);
  g.drawImage(bd.mid, -s.camX * PAR.mid, 0);
  drawFires(g, bd, s, t, 'mid');
  g.drawImage(bd.near, -s.camX * PAR.near, 0);
  drawFires(g, bd, s, t, 'near');
  const gy = GROUND_TOP - 12;
  g.save(); g.translate(-s.camX, 0);
  if (bd.groundTile) { g.fillStyle = bd.groundTile; g.fillRect(s.camX - 60, gy, VIEW_W + 120, VIEW_H - gy + 60); }
  g.restore();
  g.drawImage(bd.groundShade, -60, gy, VIEW_W + 120, VIEW_H - gy + 60);
  g.fillStyle = hexA(bd.pal.ground2, 0.3);
  for (const lz of [0.25, 0.62]) { const y = groundY(lz); g.beginPath(); g.ellipse(VIEW_W / 2, y, VIEW_W, 9 + lz * 8, 0, 0, TAU); g.fill(); }
  // dynamic light pools from fire, flashes and muzzle blasts
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of s.parts) {
    if (p.kind !== 'fire' && p.kind !== 'flash' && p.kind !== 'muzzle') continue;
    const sx = p.x - s.camX; if (sx < -200 || sx > VIEW_W + 200) continue;
    const k = p.life / p.max; const r = (p.kind === 'flash' ? 220 : p.kind === 'fire' ? 70 : 60) * depthScale(clamp(p.z, 0, 1));
    g.globalAlpha = clamp(k * (p.kind === 'flash' ? 0.5 : 0.18), 0, 1);
    g.drawImage(blob('#ffb050', 'fire'), sx - r, groundY(clamp(p.z, 0, 1)) - r * 0.3, r * 2, r * 0.6);
  }
  g.restore();
  // ground decals: craters and blood
  for (const d of s.decals) {
    const sx = d.x - s.camX; if (sx < -200 || sx > VIEW_W + 200) continue;
    const y = groundY(d.z); const sc = depthScale(d.z);
    if (d.kind === 'blood') {
      g.fillStyle = `rgba(80,8,8,${0.5 * Math.min(1, d.life / 8)})`;
      g.beginPath(); g.ellipse(sx, y, d.r * sc, d.r * sc * 0.28, d.rot * 0.1, 0, TAU); g.fill();
      continue;
    }
    const r = d.r * sc; g.drawImage(blob('#000', 'crater'), sx - r, y - r * 0.3, r * 2, r * 0.6);
  }
  // incoming strike markers
  for (const k of s.strikes) {
    if (k.t < -1.5) continue;
    const sx = k.x - s.camX, y = groundY(k.z), sc = depthScale(k.z);
    const pulse = 0.5 + 0.5 * Math.sin(t * 12);
    g.strokeStyle = `rgba(239,68,68,${0.45 + 0.4 * pulse})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(sx, y, 150 * sc, 40 * sc, 0, 0, TAU); g.stroke();
    g.setLineDash([6, 6]); g.beginPath(); g.ellipse(sx, y, 90 * sc, 24 * sc, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(sx - 12, y); g.lineTo(sx + 12, y); g.moveTo(sx, y - 6); g.lineTo(sx, y + 6); g.stroke();
  }
  // hold-the-line marker
  if (s.order === 'hold') { const sx = s.holdX - s.camX; g.strokeStyle = 'rgba(147,197,253,0.35)'; g.lineWidth = 2; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(sx, GROUND_TOP + 6); g.lineTo(sx + 30, VIEW_H); g.stroke(); g.setLineDash([]); }
  type Item = { z: number; f: () => void };
  const items: Item[] = [];
  for (const u of s.units) items.push({ z: u.z - (u.dead ? 0.002 : 0), f: () => drawUnit(g, u, s, t) });
  for (const pr of bd.props) {
    const sx = pr.x - s.camX; if (sx < -120 || sx > VIEW_W + 120) continue;
    items.push({ z: pr.z - 0.004, f: () => { const sc = depthScale(pr.z); g.drawImage(pr.sprite, sx - pr.ox * sc, groundY(pr.z) - pr.oy * sc, pr.w * sc, pr.h * sc); } });
  }
  for (const p of s.proj) items.push({ z: clamp(p.z, 0, 1) + 0.001, f: () => drawProjectile(g, p, s) });
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.f();
  for (const p of s.parts) drawParticle(g, p, s);
  if (s.rallyFx > 0 && !s.player.dead) {
    const k = s.rallyFx / 1.2; const sx = s.player.x - s.camX, sy = groundY(s.player.z);
    g.strokeStyle = `rgba(253,224,130,${k})`; g.lineWidth = 4 * k; g.beginPath(); g.ellipse(sx, sy, (1 - k) * 420 + 20, ((1 - k) * 420 + 20) * 0.3, 0, 0, TAU); g.stroke();
  }
  g.drawImage(bd.fg, -s.camX * PAR.fg, VIEW_H - 120 + 18);
  g.restore();
  // ---- screen space from here on
  drawWeather(g, s, t);
  g.save();
  g.drawImage(bd.vignette, 0, 0); // colour grade is baked into the vignette layer
  if (s.player.ads && !s.player.dead) { g.globalAlpha = 0.6; g.drawImage(bd.vignette, 0, 0); g.globalAlpha = 1; }
  if (QUALITY === 2) { g.globalAlpha = 0.5; const gx = Math.floor(Math.random() * 256), gyy = Math.floor(Math.random() * 256); g.drawImage(bd.grain, -gx, -gyy); }
  g.restore();
  // slow-motion tint & parry flash
  if (s.slowT > 0) { g.fillStyle = `rgba(20,30,50,${0.18 * Math.min(1, s.slowT)})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (s.parryFx > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,240,200,${s.parryFx * 0.5})`; g.fillRect(0, 0, VIEW_W, VIEW_H); g.restore(); }
  // low-health red edge
  if (!s.player.dead && s.player.hp < s.player.maxHp * 0.35) {
    const k = 1 - s.player.hp / (s.player.maxHp * 0.35);
    g.globalAlpha = clamp(k * (0.75 + 0.25 * Math.sin(t * 6)), 0, 1); g.drawImage(bd.redEdge, 0, 0); g.globalAlpha = 1;
  }
  // damage direction
  for (const d of s.dmgInd) {
    const a = Math.min(1, d.t / 0.5) * 0.75;
    g.globalAlpha = a; g.save(); if (d.side > 0) { g.translate(VIEW_W, 0); g.scale(-1, 1); } g.drawImage(bd.dmgEdge, 0, VIEW_H * 0.25, 90, VIEW_H * 0.5); g.restore(); g.globalAlpha = 1;
  }
  // cinematic letterbox
  const lb = s.intro > 0 ? Math.min(1, s.intro / 0.6) : s.over ? Math.min(1, s.overT / 1.2) : s.slowT > 0 ? 0.6 : 0;
  if (lb > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, VIEW_W, 64 * lb); g.fillRect(0, VIEW_H - 64 * lb, VIEW_W, 64 * lb); }
  if (s.intro <= 0 && !s.over) drawMinimap(g, s, t);
  if (!s.player.dead && !s.over && s.intro <= 0) drawCrosshair(g, s, mouse);
}

function drawCrosshair(g: Ctx, s: BattleState, m: { x: number; y: number }) {
  const u = s.player; const w = curWeapon(u); const def = w.def;
  g.save(); g.translate(m.x, m.y);
  g.strokeStyle = 'rgba(253,230,160,0.9)'; g.fillStyle = 'rgba(253,230,160,0.9)'; g.lineWidth = 1.5;
  if (def.kind === 'melee') { g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.beginPath(); g.arc(0, 0, 10, -0.6, 0.6); g.stroke(); g.beginPath(); g.arc(0, 0, 10, Math.PI - 0.6, Math.PI + 0.6); g.stroke(); }
  else if (def.kind === 'bow') { const r = 16 - u.draw * 8; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill(); if (u.drawing) { g.strokeStyle = '#fbbf24'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + u.draw * TAU); g.stroke(); } }
  else { const r = 6 + (def.spread ?? 0.03) * 120 + u.recoil * 8; for (let k = 0; k < 4; k++) { g.save(); g.rotate((k * Math.PI) / 2); g.beginPath(); g.moveTo(r, 0); g.lineTo(r + 7, 0); g.stroke(); g.restore(); } g.beginPath(); g.arc(0, 0, 1.4, 0, TAU); g.fill(); if (u.reloadT > 0) { g.strokeStyle = '#fbbf24'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, -Math.PI / 2 + (1 - u.reloadT / u.reloadDur) * TAU); g.stroke(); } }
  if (s.hitMark.t > 0) {
    const k = s.hitMark.t / (s.hitMark.kill ? 0.4 : 0.25);
    g.strokeStyle = s.hitMark.kill ? `rgba(239,68,68,${k})` : `rgba(255,255,255,${k})`; g.lineWidth = s.hitMark.kill ? 3 : 2;
    const r1 = 8, r2 = s.hitMark.kill ? 18 : 14;
    for (const a of [0.785, 2.356, 3.927, 5.498]) { g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke(); }
  }
  if (u.ads && def.kind !== 'melee') { g.strokeStyle = 'rgba(253,230,160,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.stroke(); }
  if (u.charging) { g.strokeStyle = u.charge > 0.35 ? '#fbbf24' : 'rgba(253,230,160,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, -Math.PI / 2 + u.charge * TAU); g.stroke(); }
  g.restore();
}

/** Renders a line-up of soldiers (menus, HUD portrait) with the same drawing code as the battle. */
export function drawLineup(c: HTMLCanvasElement, s: BattleState, units: Unit[], t: number, walking = false, markers = true): void {
  const g = c.getContext('2d')!; g.clearRect(0, 0, c.width, c.height);
  const k = c.height / 128;
  units.forEach((u, i) => {
    const posX = ((c.width / k) * (i + 0.5)) / units.length;
    const z = u.z;
    g.save(); g.scale(k, k); g.translate(0, -(groundY(z) - 120));
    const fake = { ...s, camX: u.x - posX, player: s.player } as BattleState;
    drawUnit(g, { ...u, vx: walking && !u.isPlayer ? 90 * u.facing : 0, walk: walking && !u.isPlayer ? t * 7 + i : u.walk, hp: u.maxHp }, fake, t, markers);
    g.restore();
  });
}
export { GROUND_BOT };
