// Mise en forme d'un bloc schema.org/Recipe (JSON-LD) renvoyé par la fonction SQL import_recipe.

export interface ImportedRecipe {
  title: string;
  servings: number;
  prep: number;
  cook: number;
  ingredients: string[];
  steps: string[];
  sourceUrl: string;
}

export function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** « PT1H15M » → 75 */
export function isoMinutes(iso: unknown): number {
  if (typeof iso !== 'string') return 0;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function yieldServings(y: unknown): number {
  const v = Array.isArray(y) ? y[0] : y;
  const n = typeof v === 'number' ? v : Number(String(v ?? '').match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 && n <= 50 ? n : 4;
}

export function instructionSteps(instr: unknown): string[] {
  if (!instr) return [];
  if (typeof instr === 'string') return decodeHtml(instr).split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/).filter(Boolean);
  if (Array.isArray(instr)) return instr.flatMap(instructionSteps);
  if (typeof instr === 'object') {
    const o = instr as Record<string, unknown>;
    if (o.itemListElement) return instructionSteps(o.itemListElement);
    if (typeof o.text === 'string') return [decodeHtml(o.text)];
    if (typeof o.name === 'string') return [decodeHtml(o.name)];
  }
  return [];
}

export function normalizeRecipe(node: Record<string, unknown>, url: string): ImportedRecipe {
  const raw = Array.isArray(node.recipeIngredient) ? node.recipeIngredient : Array.isArray(node.ingredients) ? node.ingredients : [];
  return {
    title: decodeHtml(String(node.name ?? 'Recette importée')).slice(0, 120),
    servings: yieldServings(node.recipeYield),
    prep: isoMinutes(node.prepTime),
    cook: isoMinutes(node.cookTime),
    ingredients: raw.map((x) => decodeHtml(String(x))).filter(Boolean).slice(0, 60),
    steps: instructionSteps(node.recipeInstructions).slice(0, 40),
    sourceUrl: url,
  };
}
