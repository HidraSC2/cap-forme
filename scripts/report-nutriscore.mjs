// Note nutritionnelle de chaque recette : node scripts/report-nutriscore.mjs
const { BASE_RECIPES } = await import('../src/data/recipes.ts');
const { ingOf } = await import('../src/data/ingredients.ts');
const { recipeNutriScore } = await import('../src/lib/nutriscore.ts');
const count = {};
for (const r of BASE_RECIPES) {
  const n = recipeNutriScore(r, ingOf);
  count[n.grade] = (count[n.grade] ?? 0) + 1;
  const d = Object.fromEntries([...n.negative, ...n.positive].map((c) => [c.key, `${c.points}`]));
  console.log(`${n.grade} ${String(n.score).padStart(3)}  ${r.id.padEnd(28)} ${Math.round(n.kcal100)}kcal/100g  sel ${n.negative[3].value.toFixed(2)}  E${d.energy} S${d.sugars} AGS${d.sat} Na${d.salt} | FL${d.fvl} Fi${d.fiber} P${d.protein}`);
}
console.log(count);
