// Portions usuelles proposées quand on ajoute un aliment à part (grammes).
const HINTS: [RegExp, [label: string, g: number][]][] = [
  [/croissant/, [['1 croissant', 60]]],
  [/pain au chocolat|chocolatine/, [['1 pain au chocolat', 70]]],
  [/brioche/, [['1 tranche', 40]]],
  [/pain de mie/, [['1 tranche', 28], ['2 tranches', 56]]],
  [/baguette|pain blanc|pain de tradition/, [['¼ de baguette', 60], ['½ baguette', 125]]],
  [/^pain/, [['1 tranche', 30], ['2 tranches', 60]]],
  [/biscotte/, [['1 biscotte', 8], ['3 biscottes', 24]]],
  [/biscuit|sable|cookie|madeleine/, [['1 pièce', 12], ['3 pièces', 36]]],
  [/chocolat.*tablette|chocolat noir|chocolat au lait/, [['1 carré', 10], ['1 barre', 25]]],
  [/barre/, [['1 barre', 40]]],
  [/yaourt|fromage blanc|petit suisse|skyr/, [['1 pot', 125], ['1 grand pot', 200]]],
  [/^lait|boisson.*(soja|amande|avoine)/, [['1 verre', 200], ['1 bol', 300]]],
  [/cafe|the,|^the /, [['1 tasse', 150]]],
  [/jus|soda|cola|limonade|sirop/, [['1 verre', 200], ['1 canette', 330]]],
  [/biere/, [['1 demi', 250], ['1 bouteille', 330]]],
  [/^vin |champagne|cidre/, [['1 verre', 125]]],
  [/oeuf/, [['1 œuf', 55], ['2 œufs', 110]]],
  [/beurre|margarine/, [['1 noisette', 10], ['1 c. à soupe', 15]]],
  [/huile|mayonnaise|vinaigrette/, [['1 c. à soupe', 13]]],
  [/confiture|miel|pate a tartiner/, [['1 c. à café', 10], ['1 c. à soupe', 20]]],
  [/fromage|camembert|comte|emmental|brie|roquefort|chevre/, [['1 portion', 30], ['2 portions', 60]]],
  [/jambon/, [['1 tranche', 40], ['2 tranches', 80]]],
  [/saucisson|chorizo/, [['5 rondelles', 25]]],
  [/pizza/, [['1 part', 130], ['1 pizza', 400]]],
  [/quiche|tarte/, [['1 part', 130]]],
  [/burger|sandwich|kebab|wrap|panini/, [['1 pièce', 220]]],
  [/frites/, [['1 portion', 150]]],
  [/chips|biscuit aperitif|cacahuete|amande|noix|noisette|pistache/, [['1 poignée', 30]]],
  [/glace|sorbet/, [['1 boule', 60], ['2 boules', 120]]],
  [/pates.*cuit|riz.*cuit|semoule.*cuit|quinoa.*cuit/, [['1 assiette', 200]]],
  [/pomme de terre|puree/, [['1 portion', 200]]],
  [/banane/, [['1 banane', 120]]],
  [/pomme|poire|peche|orange/, [['1 fruit', 150]]],
  [/clementine|kiwi|abricot|prune/, [['1 fruit', 60]]],
  [/steak|escalope|filet|pave/, [['1 portion', 125]]],
  [/soupe|potage|veloute/, [['1 bol', 300]]],
  [/gateau|cake|brownie|muffin|crepe|gaufre/, [['1 part', 70]]],
  [/sucre/, [['1 morceau', 5], ['1 c. à café', 5]]],
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function portionHints(name: string): [string, number][] {
  const n = norm(name);
  const hit = HINTS.find(([re]) => re.test(n));
  return [...(hit ? hit[1] : []), ['50 g', 50], ['100 g', 100], ['150 g', 150]];
}
