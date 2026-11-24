// Lists English UI strings that are not covered by the dictionary (src/i18n/dict*.ts).
// Usage: node scripts/check-i18n.mjs [--raw]   (--raw also lists JSX text/attrs that are not passed through t())
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.tsx?$/.test(f.name) && !/\.test\./.test(f.name)) files.push(p); } })(root);

// dictionary keys (read through a tiny transpile of the dict files)
const dictKeys = new Map();
for (const f of files.filter((x) => /i18n[\\/]dict/.test(x))) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
  (function v(n) {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name)) && ts.isObjectLiteralExpression(n.initializer)) {
      const e = {};
      for (const p of n.initializer.properties) if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.isStringLiteralLike(p.initializer)) e[p.name.text] = p.initializer.text;
      if (e.uz !== undefined || e.ru !== undefined) dictKeys.set(n.name.text, e);
    }
    ts.forEachChild(n, v);
  })(sf);
}

const AUTO_TAGS = new Set(['Button', 'Panel', 'Badge', 'Tabs', 'Modal', 'Toggle', 'SectionTitle', 'Field', 'Stat', 'EmptyState']);
const ATTRS = new Set(['title', 'label', 'subtitle', 'placeholder', 'text', 'hint', 'aria-label', 'alt', 'k']);
const KEYS = new Set(['label', 'title', 'text', 'hint', 'legend', 'name', 'tag', 'desc', 'sub', 'note']);
const used = new Map(); // string -> files
const raw = [];
const add = (s, f) => { s = s.replace(/\s+/g, ' ').trim(); if (!/[A-Za-z]{2}/.test(s)) return; if (!used.has(s)) used.set(s, new Set()); used.get(s).add(path.relative(root, f)); };

for (const f of files) {
  if (/i18n[\\/]/.test(f) || /[\\/]data[\\/]/.test(f) || /[\\/]engine[\\/](?!rt)/.test(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['t', 'tr', 'okR', 'failR'].includes(n.expression.text) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) add(n.arguments[0].text, f);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['t', 'tr', 'okR', 'failR'].includes(n.expression.text) && n.arguments[0] && ts.isConditionalExpression(n.arguments[0])) { for (const b of [n.arguments[0].whenTrue, n.arguments[0].whenFalse]) if (ts.isStringLiteralLike(b)) add(b.text, f); }
    if (ts.isJsxText(n)) { const s = n.text.replace(/\s+/g, ' ').trim(); if (/[A-Za-z]{2}/.test(s)) { const tag = n.parent?.openingElement?.tagName?.getText?.() ?? ''; if (AUTO_TAGS.has(tag)) add(s, f); else raw.push([path.relative(root, f), sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, s]); } }
    if (ts.isJsxAttribute(n) && ATTRS.has(n.name.text) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const tag = n.parent?.parent?.tagName?.getText?.() ?? '';
      const s = n.initializer.text;
      if (['Panel', 'Badge', 'Tabs', 'Modal', 'Toggle', 'SectionTitle', 'Field', 'Stat', 'EmptyState', 'KV', 'Res', 'Button'].includes(tag) || tag === 'Select') add(s, f); else if (/[A-Za-z]{3}/.test(s) && /\s|^[A-Z]/.test(s)) raw.push([path.relative(root, f), sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, `${n.name.text}="${s}"`]);
    }
    if (ts.isPropertyAssignment(n) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && KEYS.has(n.name.text) && ts.isStringLiteralLike(n.initializer) && /\.tsx$/.test(f)) add(n.initializer.text, f);
    ts.forEachChild(n, v);
  })(sf);
}

const missing = [...used.entries()].filter(([s]) => !dictKeys.has(s) || !dictKeys.get(s).uz || !dictKeys.get(s).ru);
const showRaw = process.argv.includes('--raw');
console.log(`dictionary entries: ${dictKeys.size}; strings used: ${used.size}; missing: ${missing.length}; raw untranslated JSX: ${raw.length}`);
if (process.argv.includes('--list')) for (const [s, fs_] of missing) console.log(`MISSING  ${JSON.stringify(s)}  <- ${[...fs_].slice(0, 2).join(', ')}`);
if (showRaw) for (const [f, l, s] of raw) console.log(`RAW  ${f}:${l}  ${s}`);
process.exitCode = missing.length || (showRaw && raw.length) ? 1 : 0;
