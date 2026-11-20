// Tableau de contrôle des recettes : node scripts/report-recipes.mjs
const { BASE_RECIPES } = await import('../src/data/recipes.ts');
const { ingOf, basePrice } = await import('../src/data/ingredients.ts');
const { recipePerServing, recipeCostPerServing } = await import('../src/lib/nutrition.ts');
const bounds = { pdj: [200, 520], plat: [280, 720], collation: [60, 330] };
for (const r of BASE_RECIPES) {
  const m = recipePerServing(r, ingOf);
  const cost = recipeCostPerServing(r, ingOf, (id) => basePrice(id).eurKg);
  const [lo, hi] = bounds[r.meal];
  const flag = m.kcal < lo || m.kcal > hi || (r.meal === 'plat' && m.p < 15) ? '  <<<' : '';
  if (process.argv[2] !== 'all' && !flag) continue;
  console.log(`${r.id.padEnd(30)} ${r.meal.padEnd(9)} ${String(Math.round(m.kcal)).padStart(4)} kcal  P${String(Math.round(m.p)).padStart(3)} G${String(Math.round(m.c)).padStart(3)} L${String(Math.round(m.f)).padStart(3)}  ${cost.toFixed(2)} €${flag}`);
}
