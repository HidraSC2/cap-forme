// Lecture d'une ligne d'ingrédient libre (« 200 g de pâtes », « 2 c. à soupe d'huile d'olive ») et
// rapprochement avec la base d'ingrédients.
import type { Ingredient, Qty } from './types.ts';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

const FRACTIONS: Record<string, string> = { '½': '0.5', '¼': '0.25', '¾': '0.75', '⅓': '0.33', '⅔': '0.67' };

const UNITS: [RegExp, Qty['unit'], number][] = [
  [/^(kg|kilos?|kilogrammes?)\b/, 'g', 1000],
  [/^(g|gr|grammes?)\b/, 'g', 1],
  [/^(l|litres?)\b/, 'ml', 1000],
  [/^(dl)\b/, 'ml', 100],
  [/^(cl)\b/, 'ml', 10],
  [/^(ml)\b/, 'ml', 1],
  [/^(c\.?\s?a\.?\s?s\.?|cas|cs|cuilleres?\s+a\s+soupe|c\.?\s+a\s+soupe|cuil\.?\s+a\s+soupe)(?=\s|$)/, 'cs', 1],
  [/^(c\.?\s?a\.?\s?c\.?|cac|cc|cuilleres?\s+a\s+cafe|c\.?\s+a\s+cafe|cuil\.?\s+a\s+cafe)(?=\s|$)/, 'cc', 1],
  [/^(pincees?)\b/, 'g', 0.5],
  [/^(tranches?|gousses?|boites?|sachets?|pots?|bottes?|pieces?|brins?|feuilles?|branches?|carres?|paves?|filets?|escalopes?|steaks?|boules?|rouleaux?|cubes?|morceaux?)\b/, 'pc', 1],
];

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'en', 'au', 'aux', 'a', 'et', 'ou', 'frais', 'fraiche', 'fraiches',
  'emince', 'emincee', 'coupe', 'coupee', 'coupes', 'petit', 'petite', 'petits', 'petites', 'gros', 'grosse', 'grosses', 'bio', 'environ', 'bien', 'mur', 'mure', 'mures',
  'murs', 'pele', 'pelee', 'rape', 'rapee', 'sec', 'seche', 'cuit', 'cuite', 'cru', 'crue', 'entier', 'entiere', 'moyen', 'moyenne', 'moyens', 'belle', 'beau', 'bon', 'bonne',
  'pour', 'selon', 'gout', 'facultatif', 'nature', 'surgele', 'surgeles', 'surgelees', 'conserve']);

/** Autres appellations courantes d'un ingrédient de la base. */
const ALIASES: Record<string, string[]> = {
  'blanc-poulet': ['poulet', 'filet poulet', 'escalope poulet', 'aiguillette poulet'],
  'cuisse-poulet': ['haut cuisse poulet', 'pilon poulet'],
  'dinde-escalope': ['dinde', 'filet dinde'],
  'boeuf-hache': ['steak hache', 'viande hachee', 'boeuf hache', 'hache boeuf'],
  'boeuf-braiser': ['boeuf bourguignon', 'paleron', 'boeuf'],
  'porc-filet': ['porc', 'roti porc', 'filet porc'],
  'jambon-blanc': ['jambon', 'jambon cuit'],
  saumon: ['saumon', 'filet saumon'],
  cabillaud: ['poisson blanc', 'colin', 'lieu', 'merlu', 'dos cabillaud'],
  crevette: ['crevettes', 'gambas'],
  pates: ['pate', 'spaghetti', 'spaghettis', 'penne', 'tagliatelle', 'tagliatelles', 'coquillette', 'coquillettes', 'fusilli', 'macaroni', 'farfalle', 'linguine', 'rigatoni'],
  'riz-basmati': ['riz', 'riz blanc', 'riz thai', 'riz long'],
  semoule: ['couscous', 'semoule ble'],
  'creme-legere': ['creme', 'creme fraiche', 'creme epaisse', 'creme legere'],
  'creme-liquide': ['creme liquide', 'creme fleurette', 'creme entiere'],
  emmental: ['gruyere', 'gruyere rape', 'fromage rape', 'emmental'],
  'huile-olive': ['huile', 'huile olive'],
  'tomate-concassee': ['tomates pelees', 'pulpe tomate', 'tomates concassees', 'tomates boite', 'tomates concassee'],
  'coulis-tomate': ['sauce tomate', 'passata', 'puree tomate', 'coulis tomates'],
  'pomme-de-terre': ['pommes terre', 'pomme terre', 'patate', 'patates'],
  'haricot-vert': ['haricots verts'],
  'petits-pois': ['petit pois', 'pois'],
  epinard: ['epinards', 'pousses epinard', 'pousses epinards'],
  champignon: ['champignons', 'champignons paris'],
  salade: ['laitue', 'salade verte', 'batavia'],
  oeuf: ['oeufs', 'oeuf'],
  lait: ['lait', 'lait demi ecreme'],
  yaourt: ['yaourts', 'yaourt', 'yogourt'],
  'yaourt-grec': ['yaourt grec', 'yaourt grecque'],
  farine: ['farine ble', 'farine'],
  maizena: ['maizena', 'fecule', 'fecule mais'],
  bouillon: ['cube bouillon', 'bouillon legumes', 'bouillon volaille', 'bouillon cube'],
  'pois-chiche': ['pois chiches'],
  'haricot-rouge': ['haricots rouges'],
  'haricot-blanc': ['haricots blancs'],
  'lentille-verte': ['lentilles', 'lentilles vertes'],
  'lentille-corail': ['lentilles corail'],
  'flocon-avoine': ['flocons avoine', 'avoine'],
  'chocolat-noir': ['chocolat', 'chocolat noir', 'chocolat patissier'],
  sucre: ['sucre', 'sucre poudre', 'sucre roux', 'cassonade'],
  beurre: ['beurre', 'beurre doux'],
  citron: ['jus citron', 'citron jaune'],
  poivron: ['poivrons', 'poivron rouge', 'poivron vert', 'poivron jaune'],
  curry: ['curry', 'poudre curry'],
  'sauce-soja': ['sauce soja', 'soja sauce'],
  'vinaigre-balsamique': ['balsamique'],
  tortilla: ['tortillas', 'wrap', 'wraps', 'galettes ble'],
  'pain-mie': ['pain mie'],
  'pain-complet': ['pain', 'pain campagne', 'pain cereales'],
  thon: ['thon', 'thon boite'],
};

const stem = (t: string) => (t.length > 3 ? t.replace(/(s|x)$/, '') : t);
const tokens = (s: string) => norm(s).replace(/[^a-z0-9% ]+/g, ' ').split(/\s+/).filter((t) => t.length > 1 && /^[a-z]/.test(t) && !STOP.has(t)).map(stem);

export interface ParsedLine {
  raw: string;
  qty: Qty;
  name: string;
  match: Ingredient | null;
}

export function parseQtyText(text: string): { qty: Qty; rest: string } {
  let s = norm(text).trim();
  for (const [k, v] of Object.entries(FRACTIONS)) s = s.replaceAll(k, v);
  s = s.replace(/^(\d+)\s*\/\s*(\d+)/, (_, a, b) => String(Number(a) / Number(b))).replace(/^(\d+),(\d+)/, '$1.$2');
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\s*(?:-|a)\s*\d+(?:\.\d+)?)?\s*/);
  let n = 1;
  if (m) { n = Number(m[1]); s = s.slice(m[0].length); }
  for (const [re, unit, factor] of UNITS) {
    const u = s.match(re);
    if (u) return { qty: { n: Math.round(n * factor * 100) / 100, unit }, rest: s.slice(u[0].length).replace(/^\s*(d'|de |du |des )/, '').trim() };
  }
  return { qty: { n, unit: 'pc' }, rest: s.replace(/^(d'|de |du |des )/, '').trim() };
}

export function matchIngredient(name: string, ingredients: Ingredient[]): Ingredient | null {
  const want = new Set(tokens(name));
  if (!want.size) return null;
  let best: { ing: Ingredient; score: number } | null = null;
  for (const ing of ingredients) {
    const variants = [ing.name, ing.id.replace(/-/g, ' '), ...(ALIASES[ing.id] ?? [])];
    for (const v of variants) {
      const have = tokens(v);
      if (!have.length) continue;
      const common = have.filter((t) => want.has(t)).length;
      if (common === 0) continue;
      // Tous les mots de l'appellation doivent se retrouver dans la ligne ; on préfère l'appellation la plus précise.
      const score = common / have.length + common / want.size;
      if (common === have.length && (!best || score > best.score)) best = { ing, score };
    }
  }
  return best && best.score >= 1.3 ? best.ing : null;
}

export function parseLine(raw: string, ingredients: Ingredient[]): ParsedLine {
  const { qty, rest } = parseQtyText(raw);
  const name = rest.replace(/\(.*?\)/g, ' ').trim();
  return { raw: raw.trim(), qty, name, match: matchIngredient(name, ingredients) };
}
