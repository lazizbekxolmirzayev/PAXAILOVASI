// The "story" script behind a scenario's historical-background cinematic.
// Pure data + helpers (no React, no zustand) so the very same text can be used by the browser AND by the
// build step that produces api/_story-text.js (the whitelist the text-to-speech function is allowed to voice).
import { DICT } from '../i18n/dict';
import type { ScenarioDefinition } from '../types/game';

export type Lang = 'en' | 'ru' | 'uz';
export const LANG_IDX: Record<Lang, 0 | 1 | 2> = { en: 0, ru: 1, uz: 2 };
/** [English, Русский, O'zbekcha] — same order as the i18n dictionary. */
export type Tri = readonly [en: string, ru: string, uz: string];

export type VisualKey = 'art' | 'battle' | 'samarkand' | 'winter' | 'otrar' | 'dawn' | 'ruins';
export type Cam = 'in' | 'out' | 'left' | 'right';

export interface Beat {
  /** Narration + subtitle text (documented history only). */
  text: Tri;
  visual: VisualKey;
  cam: Cam;
  /** Optional chapter card ("1402 · Ankara") shown at the start of the shot; uses only facts stated in `text`. */
  chapter?: { kicker?: Tri; title: Tri };
  /** Route sketch overlay (Anatolia → India) on the empire shot. */
  route?: boolean;
  /** The content note about loss of life — shown/narrated last, in a sombre scene. */
  note?: boolean;
}

let INDEX: Map<string, Tri> | null = null;
function dictIndex(): Map<string, Tri> {
  if (!INDEX) {
    INDEX = new Map();
    for (const [en, ru, uz] of DICT) INDEX.set(en, [en, ru, uz]);
  }
  return INDEX;
}
/** Look an English source string up in the dictionary (missing languages fall back to English, like tr()). */
export function tri(en: string): Tri {
  const hit = dictIndex().get(en) ?? dictIndex().get(en.trim());
  return hit ? [en, hit[1] || en.trim(), hit[2] || en.trim()] : [en, en, en];
}
export const pick = (t: Tri, lang: Lang): string => t[LANG_IDX[lang]];
/** True when the text really exists in this language (not an English fallback), i.e. it is worth voicing. */
export const isTranslated = (t: Tri, lang: Lang): boolean => lang === 'en' || t[LANG_IDX[lang]] !== t[0];

// ---------------------------------------------------------------------------------------------
// Hand-made storyboard for "Timur's Eastern Campaign". The narration is the documented background text, only
// split at sentence boundaries so every sentence can get its own picture (a test checks the split is lossless).
// ---------------------------------------------------------------------------------------------
const TIMUR: (def: ScenarioDefinition) => Beat[] = (def) => [
  {
    text: [
      'By 1404 Timur (Tamerlane) had built an empire from Anatolia to the borders of India.',
      'К 1404 году Тимур (Тамерлан) создал империю от Анатолии до границ Индии.',
      "1404-yilga kelib Temur Anatoliyadan Hindiston chegaralarigacha cho'zilgan imperiya barpo etdi.",
    ],
    visual: 'art', cam: 'in', route: true,
    chapter: { kicker: ['1404', '1404', '1404'], title: ['An empire from Anatolia to India', 'Империя от Анатолии до Индии', 'Anatoliyadan Hindistongacha imperiya'] },
  },
  {
    text: [
      'In 1402 he crushed the Ottomans at Ankara and captured Sultan Bayezid I, plunging the Ottoman state into a decade-long civil war (the Interregnum).',
      'В 1402 году он разгромил османов при Анкаре и пленил султана Баязида I, ввергнув Османское государство в десятилетнюю гражданскую войну (Междуцарствие).',
      "1402-yilda u Anqarada Usmonlilarni tor-mor keltirib, Sulton Boyazid I ni asir oldi va Usmonli davlatini o'n yillik fuqarolar urushiga (Saltanatsizlik davri) tashladi.",
    ],
    visual: 'battle', cam: 'in',
    chapter: { kicker: ['1402', '1402', '1402'], title: tri('Battle of Ankara') },
  },
  {
    text: [
      'Returning to Samarkand, Timur assembled a large army for a winter campaign against the Ming dynasty, whose Yongle Emperor had usurped the throne in 1402 and had treated Timurid envoys as tributaries.',
      'Вернувшись в Самарканд, Тимур собрал большую армию для зимнего похода против династии Мин, чей император Юнлэ узурпировал трон в 1402 году и обращался с тимуридскими послами как с данниками.',
      "Samarqandga qaytgan Temur 1402-yilda taxtni egallab olgan va Temuriy elchilarga xiroj to'lovchilardek munosabatda bo'lgan Min imperatori Yunlega qarshi qishki yurish uchun katta qo'shin to'pladi.",
    ],
    visual: 'samarkand', cam: 'right',
    chapter: { kicker: ['A winter campaign', 'Зимний поход', 'Qishki yurish'], title: ['Samarkand', 'Самарканд', 'Samarqand'] },
  },
  {
    text: [
      'The army marched north-east in the bitter winter of 1404–05.',
      'Армия двинулась на северо-восток суровой зимой 1404–05 годов.',
      "Qo'shin 1404–05-yillarning qahraton qishida shimoli-sharqqa yo'l oldi.",
    ],
    visual: 'winter', cam: 'left',
    chapter: { kicker: ['1404–05', '1404–05', '1404–05'], title: ['The bitter winter', 'Суровая зима', 'Qahraton qish'] },
  },
  {
    text: [
      'At Otrar, on the Syr Darya, Timur fell ill and died on 18 February 1405, aged about 68.',
      'В Отраре на Сырдарье Тимур заболел и умер 18 февраля 1405 года в возрасте около 68 лет.',
      "Sirdaryo bo'yidagi O'trorda Temur kasallanib, 1405-yil 18-fevralda taxminan 68 yoshida vafot etdi.",
    ],
    visual: 'otrar', cam: 'in',
    chapter: { kicker: ['18 February 1405', '18 февраля 1405', '1405-yil 18-fevral'], title: ['Otrar', 'Отрар', "O'tror"] },
  },
  {
    text: [
      'The campaign was abandoned and his succession dissolved into conflict among his sons and grandsons.',
      'Поход был отменён, а наследование обернулось борьбой между его сыновьями и внуками.',
      "Yurish to'xtatildi, taxt vorisligi esa o'g'illari va nevaralari o'rtasidagi kurashga aylandi.",
    ],
    visual: 'dawn', cam: 'out',
    chapter: { title: ['A divided succession', 'Борьба за наследие', "Taxt uchun kurash"] },
  },
  ...(def.sensitivity
    ? [{
        text: tri(def.sensitivity), visual: 'ruins', cam: 'out', note: true,
        chapter: { kicker: ['A note', 'Примечание', 'Eslatma'], title: ['The human cost', 'Человеческая цена', 'Inson qurbonlari'] },
      } satisfies Beat]
    : []),
];

const BOARDS: Record<string, (def: ScenarioDefinition) => Beat[]> = { 'timur-east': TIMUR };

/** The shots of a scenario's cinematic, in order. Built-ins with a storyboard use it; everything else gets one shot per paragraph. */
export function buildBeats(def: ScenarioDefinition): Beat[] {
  const board = !def.custom ? BOARDS[def.id] : undefined;
  if (board) return board(def);
  const cams: Cam[] = ['in', 'left', 'out', 'right'];
  const beats: Beat[] = def.background.map((p, i) => ({ text: tri(p), visual: 'art', cam: cams[i % cams.length] }));
  if (def.sensitivity) beats.push({ text: tri(def.sensitivity), visual: 'ruins', cam: 'out', note: true });
  return beats;
}

/** Text spoken for one language, one entry per shot (this is what the TTS whitelist is made of). */
export function narration(def: ScenarioDefinition, lang: Lang): string[] {
  return buildBeats(def).map((b) => pick(b.text, lang));
}
