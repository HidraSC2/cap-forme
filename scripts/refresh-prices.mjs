// Met à jour les prix au kilo à partir d'Open Prices (Open Food Facts, licence ODbL).
// Usage : node scripts/refresh-prices.mjs   → écrit src/generated/prices.json
// Pour chaque ingrédient : médiane des relevés récents en France. Sans assez de relevés, l'application
// retombe sur le prix moyen de repli défini dans src/data/ingredient-defs.ts.
import { readFileSync, writeFileSync } from 'node:fs';
const { INGREDIENT_DEFS } = await import('../src/data/ingredient-defs.ts');

const API = 'https://prices.openfoodfacts.org/api/v1/prices';
const UA = 'CapForme/0.1 (planificateur de repas personnel)';
const MIN_SAMPLES = 3;
const SINCE = new Date(Date.now() - 548 * 86_400_000).toISOString().slice(0, 10); // 18 mois
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPrices(params) {
  const qs = new URLSearchParams({ currency: 'EUR', size: '100', order_by: '-date', date__gte: SINCE, ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } });
      if (res.ok) return (await res.json()).items ?? [];
      if (res.status < 500 && res.status !== 429) return [];
    } catch { /* nouvelle tentative */ }
    await sleep(1500 * (attempt + 1));
  }
  return [];
}

const inFrance = (it) => it.location?.osm_address_country_code === 'FR';
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const prices = {};
let done = 0;
for (const [id, , , , fallback, o = {}] of INGREDIENT_DEFS) {
  const samples = [];
  if (o.tag) {
    for (const it of (await fetchPrices({ category_tag: o.tag })).filter(inFrance)) {
      if (it.price_is_discounted) continue;
      if (it.price_per === 'KILOGRAM') samples.push(it.price);
      else if (it.price_per === 'UNIT' && o.pc) samples.push((it.price / o.pc) * 1000);
    }
    await sleep(250);
  }
  if (o.cat && samples.length < MIN_SAMPLES) {
    for (const it of (await fetchPrices({ product__categories_tags__contains: o.cat })).filter(inFrance)) {
      const q = it.product?.product_quantity;
      const unit = (it.product?.product_quantity_unit ?? 'g').toLowerCase();
      if (it.price_is_discounted || !q || !['g', 'ml'].includes(unit)) continue;
      samples.push((it.price / (q * (unit === 'ml' ? (o.ml ?? 1) : 1))) * 1000);
    }
    await sleep(250);
  }
  // Écarte les relevés aberrants ou mal catégorisés (plus de 3× ou moins du tiers du prix de repli).
  const sane = samples.filter((p) => p >= fallback / 3 && p <= fallback * 3);
  if (sane.length >= MIN_SAMPLES) prices[id] = { eurKg: Math.round(median(sane) * 100) / 100, n: sane.length };
  done++;
  process.stdout.write(`\r${done}/${INGREDIENT_DEFS.length} ingrédients — ${Object.keys(prices).length} prix trouvés`);
}
// Garde-fou : si le service répond mal (panne, coupure), on garde les prix précédents plutôt que de les perdre.
const previous = JSON.parse(readFileSync('src/generated/prices.json', 'utf8'));
const before = Object.keys(previous.prices ?? {}).length;
if (Object.keys(prices).length < before * 0.6) {
  console.log(`
Seulement ${Object.keys(prices).length} prix trouvés contre ${before} la dernière fois : prix précédents conservés.`);
  process.exit(0);
}
writeFileSync('src/generated/prices.json', JSON.stringify({ updated: new Date().toISOString().slice(0, 10), prices }, null, 1));
console.log(`\nOpen Prices : ${Object.keys(prices).length}/${INGREDIENT_DEFS.length} ingrédients → src/generated/prices.json`);
