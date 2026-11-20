// Aide à l'association ingrédient → code CIQUAL : node scripts/find-ciqual.mjs "poulet filet cru" "riz blanc cru"
import { readFileSync } from 'node:fs';
const T = JSON.parse(readFileSync('src/generated/ciqual.json', 'utf8'));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
for (const q of process.argv.slice(2)) {
  const toks = norm(q).split(/\s+/);
  const hits = T.filter((r) => { const n = ' ' + norm(r[1]); return toks.every((t) => n.includes(t.startsWith('=') ? ' ' + t.slice(1) : t)); })
    .sort((a, b) => a[1].length - b[1].length).slice(0, 3);
  console.log(`# ${q}` + (hits.length ? '' : '  ✗'));
  for (const h of hits) console.log(`  ${h[0]} ${h[1]} | ${h[2]}kcal P${h[3]} G${h[4]} L${h[5]}`);
}
