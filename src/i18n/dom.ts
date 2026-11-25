// Translates leftover plain-English text in the page (text nodes and placeholder / title / aria-label attributes)
// by exact match against the dictionary, so every page follows the selected language. React-rendered strings that
// already went through t() are not in the dictionary as translated text and are left alone.
import { DICT } from './dict';
import { useLang, type Lang } from './index';
import { lookupFullName } from './names';

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE']);
const textState = new WeakMap<Text, { src: string; out: string }>();
const attrState = new WeakMap<Element, Record<string, { src: string; out: string }>>();

function lookup(raw: string, lang: Lang): string | null {
  if (lang === 'en') return null;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  if (!m || !m[2]) return null;
  const key = m[2].replace(/\s+/g, ' ');
  const out = DICT[key]?.[lang] ?? lookupFullName(lang, key);
  return out ? m[1] + out + m[3] : null;
}

function doText(n: Text, lang: Lang): void {
  const parent = n.parentElement;
  if (!parent || SKIP.has(parent.tagName)) return;
  const cur = n.nodeValue ?? '';
  const st = textState.get(n);
  if (st && cur === st.out) {
    // our own translation is in place: re-translate from the source for the (possibly new) language
    const out = lookup(st.src, lang);
    const next = out ?? st.src;
    if (next !== cur) { n.nodeValue = next; textState.set(n, { src: st.src, out: next }); }
    return;
  }
  const out = lookup(cur, lang);
  if (out !== null) { n.nodeValue = out; textState.set(n, { src: cur, out }); } else if (st) textState.delete(n);
}

function doAttrs(el: Element, lang: Lang): void {
  let rec = attrState.get(el);
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    const st = rec?.[a];
    if (st && cur === st.out) {
      const out = lookup(st.src, lang);
      const next = out ?? st.src;
      if (next !== cur) { el.setAttribute(a, next); rec![a] = { src: st.src, out: next }; }
      continue;
    }
    const out = lookup(cur, lang);
    if (out !== null) { if (!rec) { rec = {}; attrState.set(el, rec); } rec[a] = { src: cur, out }; el.setAttribute(a, out); } else if (rec?.[a]) delete rec[a];
  }
}

function sweep(root: Node, lang: Lang): void {
  if (root.nodeType === Node.TEXT_NODE) { doText(root as Text, lang); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = root.nodeType === Node.ELEMENT_NODE ? root : walker.nextNode();
  if (root.nodeType === Node.ELEMENT_NODE) doAttrs(root as Element, lang);
  while ((n = walker.nextNode())) { if (n.nodeType === Node.TEXT_NODE) doText(n as Text, lang); else doAttrs(n as Element, lang); }
}

export function installDomTranslator(): void {
  if (typeof document === 'undefined') return;
  let queue = new Set<Node>();
  let raf = 0;
  const flush = () => {
    raf = 0;
    const lang = useLang.getState().lang;
    const items = queue; queue = new Set();
    for (const n of items) if (n.isConnected) sweep(n, lang);
  };
  const schedule = (n: Node) => { queue.add(n); if (!raf) raf = requestAnimationFrame(flush); };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => schedule(n));
      else if (m.type === 'characterData') schedule(m.target);
      else if (m.type === 'attributes') schedule(m.target);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  useLang.subscribe(() => schedule(document.body));
  schedule(document.body);
}
