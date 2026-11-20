// Convertit la table CIQUAL (ANSES, Licence Ouverte 2.0) en JSON compact.
// Source : https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY
// Usage : node scripts/build-ciqual.mjs   (télécharge le fichier s'il est absent)
import XLSX from 'xlsx';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const RAW = 'data/raw/ciqual/ciqual-2025.xlsx';
const URL = 'https://entrepot.recherche.data.gouv.fr/api/access/datafile/666260';

if (!existsSync(RAW)) {
  mkdirSync('data/raw/ciqual', { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Téléchargement CIQUAL impossible : ${res.status}`);
  writeFileSync(RAW, Buffer.from(await res.arrayBuffer()));
}

const wb = XLSX.readFile(RAW);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
const head = rows[0].map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
const col = (re) => {
  const i = head.findIndex((h) => re.test(h));
  if (i < 0) throw new Error(`Colonne introuvable : ${re}`);
  return i;
};
const C = {
  code: col(/^alim_code$/), name: col(/^alim_nom_fr$/), grp: col(/^alim_grp_nom_fr$/),
  kcal: col(/^Energie, Règlement.*kcal/), p: col(/^Protéines, N x facteur de Jones/),
  c: col(/^Glucides/), f: col(/^Lipides/), fiber: col(/^Fibres/), alcohol: col(/^Alcool/),
  sugars: col(/^Sucres \(/), sat: col(/^AG saturés/), salt: col(/^Sel chlorure/),
};
// "12,5" → 12.5 ; "< 0,3" → 0.3 ; "traces" → 0 ; "-" → null
const num = (v) => {
  if (v == null) return null;
  const s = String(v).replace('<', '').replace(',', '.').trim();
  if (s === '-' || s === '') return null;
  if (/trace/i.test(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n) => Math.round(n * 10) / 10;

const out = [];
const extra = new Map(); // code → [sucres, AG saturés, sel] (pour la note nutritionnelle)
for (const row of rows.slice(1)) {
  const code = Number(row[C.code]);
  const name = String(row[C.name] ?? '').replace(/\s+/g, ' ').trim();
  if (!code || !name) continue;
  const p = num(row[C.p]) ?? 0, c = num(row[C.c]) ?? 0, f = num(row[C.f]) ?? 0;
  const fiber = num(row[C.fiber]) ?? 0, alcohol = num(row[C.alcohol]) ?? 0;
  let kcal = num(row[C.kcal]);
  if (kcal == null) kcal = 4 * p + 4 * c + 9 * f + 2 * fiber + 7 * alcohol;
  const grp = String(row[C.grp] ?? '').replace(/\s+/g, ' ').trim();
  // [code, nom, kcal, protéines, glucides, lipides, fibres, groupe] pour 100 g
  out.push([code, name, Math.round(kcal), r1(p), r1(c), r1(f), r1(fiber), grp]);
  extra.set(code, [r1(num(row[C.sugars]) ?? 0), Math.round((num(row[C.sat]) ?? 0) * 100) / 100, Math.round((num(row[C.salt]) ?? 0) * 100) / 100]);
}
writeFileSync('src/generated/ciqual.json', JSON.stringify(out));
console.log(`CIQUAL : ${out.length} aliments → src/generated/ciqual.json`);

// ── Macros des ingrédients de l'application (src/data/ingredient-defs.ts) ──
const { INGREDIENT_DEFS } = await import('../src/data/ingredient-defs.ts');
const byCode = new Map(out.map((r) => [r[0], r]));
const macros = {};
const missing = [];
for (const [id, , , ref] of INGREDIENT_DEFS) {
  if (Array.isArray(ref)) {
    if (ref.length !== 8) throw new Error(`${id} : 8 valeurs manuelles attendues`);
    macros[id] = ref;
    continue;
  }
  const row = byCode.get(ref);
  if (!row) { missing.push(`${id} (${ref})`); continue; }
  macros[id] = [...row.slice(2, 7), ...extra.get(ref)];
}
if (missing.length) throw new Error(`Codes CIQUAL introuvables : ${missing.join(', ')}`);
writeFileSync('src/generated/ing-macros.json', JSON.stringify(macros, null, 0));
console.log(`Ingrédients : ${Object.keys(macros).length} → src/generated/ing-macros.json`);
