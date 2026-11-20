// Base d'ingrédients. Fichier volontairement sans import : il est aussi lu par les scripts Node.
//
// [id, nom, rayon, code CIQUAL (ou valeurs manuelles [kcal, P, G, L, fibres, sucres, AG saturés, sel] pour 100 g), prix de repli €/kg, options]
// Options :
//   pc     poids d'une pièce (g)            pn    nom de la pièce (« gousse », « tranche »…)
//   cs     poids d'une cuillère à soupe (g) ml    densité (g par ml)
//   packs  conditionnements vendus (g)      by    'piece' = vendu à la pièce
//   tag    catégorie Open Prices (produits bruts, prix au kilo)
//   cat    catégorie Open Food Facts (produits emballés, prix ramené au kilo)
//   preg   [niveau, raison] pendant la grossesse : 'avoid' (à éviter) ou 'caution' (prudence)
//   pantry produit de placard, décoché par défaut dans la liste de courses
//   nobuy  jamais dans la liste de courses (eau)

export type IngOpts = {
  pc?: number; pn?: string; cs?: number; ml?: number; packs?: number[]; by?: 'piece';
  tag?: string; cat?: string; preg?: ['avoid' | 'caution', string]; pantry?: true; nobuy?: true;
};
export type IngDef = [string, string, string, number | number[], number, IngOpts?];

export const AISLES: Record<string, string> = {
  FL: 'Fruits & légumes',
  VP: 'Viandes & poissons',
  CF: 'Crèmerie & frais',
  ES: 'Épicerie salée',
  CS: 'Conserves',
  SU: 'Épicerie sucrée',
  BL: 'Boulangerie',
  SG: 'Surgelés',
  CE: 'Condiments & épices',
};

export const INGREDIENT_DEFS: IngDef[] = [
  // ── Fruits & légumes ─────────────────────────────────────────────
  ['tomate', 'Tomate', 'FL', 20276, 3.2, { pc: 120, tag: 'en:tomatoes' }],
  ['tomate-cerise', 'Tomates cerises', 'FL', 20172, 7, { pc: 15, packs: [250, 500], tag: 'en:cherry-tomatoes' }],
  ['carotte', 'Carotte', 'FL', 20009, 1.7, { pc: 100, tag: 'en:carrots' }],
  ['courgette', 'Courgette', 'FL', 20020, 2.9, { pc: 250, tag: 'en:zucchini' }],
  ['aubergine', 'Aubergine', 'FL', 20053, 3.5, { pc: 300, tag: 'en:aubergines' }],
  ['poivron', 'Poivron', 'FL', 20041, 4.2, { pc: 180, tag: 'en:bell-peppers' }],
  ['oignon', 'Oignon', 'FL', 20034, 2.2, { pc: 100, tag: 'en:onions' }],
  ['oignon-rouge', 'Oignon rouge', 'FL', 20238, 2.9, { pc: 100, tag: 'en:red-onions' }],
  ['echalote', 'Échalote', 'FL', 20097, 5.5, { pc: 25, tag: 'en:shallots' }],
  ['ail', 'Ail', 'FL', 11000, 9, { pc: 5, pn: 'gousse', packs: [50], tag: 'en:garlic' }],
  ['pomme-de-terre', 'Pommes de terre', 'FL', 4008, 1.6, { pc: 150, packs: [1000, 2500], tag: 'en:potatoes' }],
  ['patate-douce', 'Patate douce', 'FL', 4101, 3.2, { pc: 300, tag: 'en:sweet-potatoes' }],
  ['brocoli', 'Brocoli', 'FL', 20057, 3.8, { pc: 400, by: 'piece', tag: 'en:broccoli' }],
  ['chou-fleur', 'Chou-fleur', 'FL', 20016, 3, { pc: 900, by: 'piece', tag: 'en:cauliflowers' }],
  ['epinard', 'Épinards frais', 'FL', 20059, 9, { packs: [150, 300], tag: 'en:spinachs' }],
  ['champignon', 'Champignons de Paris', 'FL', 20056, 6, { pc: 20, packs: [250, 500], tag: 'en:mushrooms' }],
  ['concombre', 'Concombre', 'FL', 20019, 3, { pc: 350, by: 'piece', tag: 'en:cucumbers' }],
  ['salade', 'Salade (laitue)', 'FL', 20031, 4, { pc: 300, by: 'piece', tag: 'en:lettuces' }],
  ['roquette', 'Roquette', 'FL', 20217, 14, { packs: [100], tag: 'en:rocket' }],
  ['mache', 'Mâche', 'FL', 20099, 14, { packs: [150], tag: 'en:lamb-s-lettuce' }],
  ['poireau', 'Poireau', 'FL', 20039, 3.2, { pc: 180, tag: 'en:leeks' }],
  ['butternut', 'Courge butternut', 'FL', 20138, 2.4, { pc: 1000, by: 'piece', tag: 'en:butternut-squashes' }],
  ['chou-rouge', 'Chou rouge', 'FL', 20014, 2.2, { pc: 900, by: 'piece', tag: 'en:red-cabbages' }],
  ['betterave', 'Betterave cuite', 'FL', 20003, 4.5, { packs: [500], tag: 'en:beetroots' }],
  ['endive', 'Endive', 'FL', 20026, 3.5, { pc: 150, tag: 'en:endives' }],
  ['fenouil', 'Fenouil', 'FL', 20028, 3.5, { pc: 300, by: 'piece', tag: 'en:fennel' }],
  ['radis', 'Radis', 'FL', 20045, 5, { packs: [300], pn: 'botte', tag: 'en:radishes' }],
  ['avocat', 'Avocat', 'FL', 13004, 8.7, { pc: 150, by: 'piece', tag: 'en:avocados' }],
  ['citron', 'Citron', 'FL', 13009, 6, { pc: 80, by: 'piece', cs: 15, tag: 'en:lemons' }],
  ['citron-vert', 'Citron vert', 'FL', 13067, 8, { pc: 60, by: 'piece', cs: 15, tag: 'en:limes' }],
  ['orange', 'Orange', 'FL', 13034, 2.8, { pc: 180, tag: 'en:oranges' }],
  ['clementine', 'Clémentine', 'FL', 13024, 3.5, { pc: 60, tag: 'en:clementines' }],
  ['pomme', 'Pomme', 'FL', 13039, 2.8, { pc: 150, tag: 'en:apples' }],
  ['banane', 'Banane', 'FL', 13005, 2, { pc: 120, tag: 'en:bananas' }],
  ['poire', 'Poire', 'FL', 13037, 3.5, { pc: 160, tag: 'en:pears' }],
  ['kiwi', 'Kiwi', 'FL', 13021, 5.5, { pc: 80, by: 'piece', tag: 'en:kiwis' }],
  ['mangue', 'Mangue', 'FL', 13025, 6, { pc: 300, by: 'piece', tag: 'en:mangoes' }],
  ['fraise', 'Fraises', 'FL', 13014, 9, { packs: [250, 500], tag: 'en:strawberries' }],
  ['gingembre', 'Gingembre frais', 'FL', 11074, 9, { pc: 30, pn: 'morceau', cs: 10, tag: 'en:ginger' }],
  ['persil', 'Persil', 'FL', 11014, 40, { packs: [30], pn: 'botte', cs: 4 }],
  ['coriandre', 'Coriandre', 'FL', 11094, 40, { packs: [30], pn: 'botte', cs: 4 }],
  ['basilic', 'Basilic', 'FL', 11033, 40, { packs: [30], pn: 'botte', cs: 3 }],
  ['menthe', 'Menthe', 'FL', 11027, 40, { packs: [30], pn: 'botte', cs: 3 }],
  ['ciboulette', 'Ciboulette', 'FL', 11003, 40, { packs: [30], pn: 'botte', cs: 4 }],

  // ── Viandes & poissons ───────────────────────────────────────────
  ['blanc-poulet', 'Blanc de poulet', 'VP', 36017, 13, { pc: 150, pn: 'filet', cat: 'en:chicken-breasts' }],
  ['cuisse-poulet', 'Cuisses de poulet (désossées)', 'VP', 36024, 9, { pc: 180, cat: 'en:chicken-thighs' }],
  ['dinde-escalope', 'Escalope de dinde', 'VP', 36304, 14, { pc: 120, pn: 'escalope', cat: 'en:turkey-cutlets' }],
  ['boeuf-hache', 'Bœuf haché 5 %', 'VP', 6250, 14, { pc: 125, pn: 'steak', cat: 'en:ground-beef-steaks' }],
  ['boeuf-braiser', 'Bœuf à braiser', 'VP', 6231, 14, {}],
  ['porc-filet', 'Filet mignon de porc', 'VP', 28204, 12, {}],
  ['jambon-blanc', 'Jambon blanc', 'VP', 28900, 18, { pc: 40, pn: 'tranche', packs: [160], cat: 'en:white-hams' }],
  ['lardons', 'Lardons', 'VP', 28720, 11, { packs: [200], cat: 'en:lardons', preg: ['caution', 'Lardons : à consommer uniquement bien cuits.'] }],
  ['chorizo', 'Chorizo', 'VP', 30315, 16, { packs: [200], cat: 'en:chorizo', preg: ['caution', 'Charcuterie crue : uniquement bien cuite à cœur.'] }],
  ['saumon', 'Pavé de saumon', 'VP', 26036, 24, { pc: 130, pn: 'pavé', cat: 'en:salmon-fillets' }],
  ['saumon-fume', 'Saumon fumé', 'VP', 26037, 45, { pc: 30, pn: 'tranche', packs: [120], cat: 'en:smoked-salmons', preg: ['avoid', 'Poisson fumé : risque de listériose.'] }],
  ['cabillaud', 'Cabillaud', 'VP', 26043, 18, { pc: 130, pn: 'filet', cat: 'en:cod-fillets' }],
  ['crevette', 'Crevettes cuites décortiquées', 'VP', 10007, 20, { packs: [200], cat: 'en:shrimps', preg: ['caution', 'Crevettes vendues cuites : à recuire avant de les manger.'] }],

  // ── Crèmerie & frais ─────────────────────────────────────────────
  ['oeuf', 'Œufs', 'CF', 22000, 5.5, { pc: 55, by: 'piece', packs: [330, 660], cat: 'en:chicken-eggs' }],
  ['lait', 'Lait demi-écrémé', 'CF', 19041, 1.1, { ml: 1.03, packs: [1000], cat: 'en:semi-skimmed-milks' }],
  ['yaourt', 'Yaourt nature', 'CF', 19593, 2.2, { pc: 125, pn: 'pot', packs: [500, 1000], cat: 'en:plain-yogurts' }],
  ['yaourt-grec', 'Yaourt à la grecque', 'CF', 19860, 4.5, { pc: 150, pn: 'pot', cs: 30, packs: [500], cat: 'en:greek-style-yogurts' }],
  ['fromage-blanc', 'Fromage blanc 0 %', 'CF', 19644, 2.8, { cs: 30, packs: [500, 1000], cat: 'en:fromages-blancs' }],
  ['skyr', 'Skyr nature', 'CF', [63, 11, 4, 0.2, 0, 4, 0.1, 0.1], 5, { cs: 30, packs: [450], cat: 'en:skyrs' }],
  ['creme-legere', 'Crème légère 15 %', 'CF', 19436, 4.5, { ml: 1, cs: 15, packs: [200], cat: 'en:light-creams' }],
  ['creme-liquide', 'Crème liquide entière', 'CF', 19417, 6, { ml: 1, cs: 15, packs: [200], cat: 'en:liquid-creams' }],
  ['beurre', 'Beurre doux', 'CF', 16400, 11, { cs: 12, packs: [250], cat: 'en:unsalted-butters' }],
  ['parmesan', 'Parmesan', 'CF', 12120, 25, { cs: 6, packs: [100], cat: 'en:parmigiano-reggiano' }],
  ['emmental', 'Emmental râpé', 'CF', 12118, 10, { cs: 7, packs: [200], cat: 'en:grated-emmentaler' }],
  ['mozzarella', 'Mozzarella', 'CF', 19590, 9, { pc: 125, pn: 'boule', packs: [125], cat: 'en:mozzarella' }],
  ['feta', 'Feta', 'CF', 12061, 13, { packs: [200], cat: 'en:feta' }],
  ['chevre', 'Bûche de chèvre', 'CF', 12812, 14, { packs: [180], cat: 'en:goat-cheeses', preg: ['caution', 'Fromage à croûte fleurie : à éviter, ou à manger bien cuit.'] }],
  ['comte', 'Comté', 'CF', 12110, 20, { packs: [200], cat: 'en:comte' }],
  ['ricotta', 'Ricotta', 'CF', 19585, 7, { cs: 30, packs: [250], cat: 'en:ricotta' }],
  ['tofu', 'Tofu nature', 'CF', 20904, 10, { packs: [250], cat: 'en:plain-tofu' }],
  ['pate-brisee', 'Pâte brisée', 'CF', 23414, 6, { pc: 230, pn: 'rouleau', packs: [230], cat: 'en:shortcrust-pastry' }],
  ['pate-pizza', 'Pâte à pizza', 'CF', 37001, 6, { pc: 260, pn: 'rouleau', packs: [260], cat: 'en:pizza-dough' }],
  ['gnocchi', 'Gnocchi', 'CF', 26264, 5, { packs: [400], cat: 'en:gnocchi' }],
  ['houmous', 'Houmous', 'CF', 25621, 9, { cs: 20, packs: [175], cat: 'en:hummus' }],

  // ── Épicerie salée ───────────────────────────────────────────────
  ['pates', 'Pâtes', 'ES', 9810, 2, { packs: [500, 1000], cat: 'en:dry-pastas' }],
  ['pates-completes', 'Pâtes complètes', 'ES', [348, 13, 64, 2.5, 8, 3, 0.5, 0.01], 2.8, { packs: [500], cat: 'en:whole-wheat-pastas' }],
  ['riz-basmati', 'Riz basmati', 'ES', 9119, 3.2, { packs: [500, 1000], cat: 'en:basmati-rices' }],
  ['riz-complet', 'Riz complet', 'ES', 9102, 3, { packs: [500, 1000], cat: 'en:brown-rices' }],
  ['semoule', 'Semoule de couscous', 'ES', 9610, 2.4, { packs: [500], cat: 'en:couscous' }],
  ['quinoa', 'Quinoa', 'ES', 9340, 8, { packs: [500], cat: 'en:quinoa' }],
  ['boulgour', 'Boulgour', 'ES', 9690, 3.5, { packs: [500], cat: 'en:bulgur' }],
  ['lentille-verte', 'Lentilles vertes', 'ES', 20585, 4, { packs: [500], cat: 'en:green-lentils' }],
  ['lentille-corail', 'Lentilles corail', 'ES', 20535, 5, { packs: [500], cat: 'en:red-lentils' }],
  ['nouille', 'Nouilles aux œufs', 'ES', 9863, 6, { packs: [250], cat: 'en:egg-noodles' }],
  ['flocon-avoine', "Flocons d'avoine", 'ES', 32140, 2.6, { cs: 10, packs: [500], cat: 'en:rolled-oats' }],
  ['farine', 'Farine', 'ES', 9436, 1, { cs: 10, packs: [1000], cat: 'en:wheat-flours', pantry: true }],
  ['maizena', 'Fécule de maïs', 'ES', 9510, 5, { cs: 10, packs: [400], pantry: true }],
  ['chapelure', 'Chapelure', 'ES', 7500, 4, { cs: 8, packs: [250], pantry: true }],
  ['tortilla', 'Tortillas de blé', 'ES', 7815, 6, { pc: 60, pn: 'galette', by: 'piece', packs: [360], cat: 'en:wheat-tortillas' }],
  ['bouillon', 'Bouillon de légumes (cube)', 'ES', 11041, 15, { pc: 10, pn: 'cube', packs: [80], pantry: true }],

  // ── Conserves ────────────────────────────────────────────────────
  ['thon', 'Thon au naturel', 'CS', 26039, 14, { pc: 140, pn: 'boîte', packs: [140], cat: 'en:tunas-in-brine', preg: ['caution', 'Thon : à limiter pendant la grossesse (mercure).'] }],
  ['sardine', "Sardines à l'huile", 'CS', 26034, 13, { pc: 95, pn: 'boîte', packs: [95], cat: 'en:sardines-in-oil' }],
  ['maquereau', 'Maquereau au naturel', 'CS', 26123, 12, { pc: 120, pn: 'boîte', packs: [120], cat: 'en:mackerels' }],
  ['pois-chiche', 'Pois chiches (égouttés)', 'CS', 20532, 4.5, { pc: 265, pn: 'boîte', packs: [265], cat: 'en:canned-chickpeas' }],
  ['haricot-rouge', 'Haricots rouges (égouttés)', 'CS', 20524, 4.5, { pc: 255, pn: 'boîte', packs: [255], cat: 'en:red-kidney-beans' }],
  ['haricot-blanc', 'Haricots blancs (égouttés)', 'CS', 20511, 4.5, { pc: 265, pn: 'boîte', packs: [265], cat: 'en:white-beans' }],
  ['mais', 'Maïs doux', 'CS', 20066, 5, { pc: 140, pn: 'boîte', packs: [140, 285], cat: 'en:sweet-corn' }],
  ['tomate-concassee', 'Tomates concassées', 'CS', 20137, 2.5, { pc: 400, pn: 'boîte', packs: [400], cat: 'en:chopped-tomatoes' }],
  ['coulis-tomate', 'Coulis de tomate', 'CS', 20260, 2.4, { ml: 1, packs: [500], cat: 'en:tomato-purees' }],
  ['concentre-tomate', 'Concentré de tomate', 'CS', 20068, 6, { cs: 16, packs: [140], pantry: true }],
  ['lait-coco', 'Lait de coco', 'CS', 18041, 5, { ml: 1, packs: [400], cat: 'en:coconut-milks' }],
  ['olive', 'Olives noires', 'CS', 13032, 9, { pc: 4, packs: [160], cat: 'en:black-olives' }],

  // ── Boulangerie ──────────────────────────────────────────────────
  ['pain-complet', 'Pain complet', 'BL', 7110, 5, { pc: 30, pn: 'tranche', packs: [400], cat: 'en:wholemeal-breads' }],
  ['baguette', 'Baguette', 'BL', 7007, 4.4, { pc: 250, by: 'piece' }],
  ['pain-mie', 'Pain de mie complet', 'BL', 7111, 4, { pc: 28, pn: 'tranche', packs: [500], cat: 'en:wholemeal-sliced-breads' }],
  ['pain-burger', 'Pains burger complets', 'BL', 7262, 6, { pc: 55, by: 'piece', packs: [220], cat: 'en:hamburger-buns' }],
  ['pita', 'Pains pita', 'BL', 7180, 5, { pc: 70, by: 'piece', packs: [420], cat: 'en:pita-breads' }],

  // ── Surgelés ─────────────────────────────────────────────────────
  ['petits-pois', 'Petits pois surgelés', 'SG', 20084, 3.2, { packs: [1000], cat: 'en:frozen-peas' }],
  ['epinard-surgele', 'Épinards hachés surgelés', 'SG', 20083, 2.8, { packs: [1000], cat: 'en:frozen-spinachs' }],
  ['haricot-vert', 'Haricots verts surgelés', 'SG', 20070, 3, { packs: [1000], cat: 'en:frozen-green-beans' }],
  ['fruits-rouges', 'Fruits rouges surgelés', 'SG', 13997, 9, { packs: [500], cat: 'en:frozen-berries' }],

  // ── Condiments & épices ──────────────────────────────────────────
  ['huile-olive', "Huile d'olive", 'CE', 17270, 11, { ml: 0.92, cs: 13, packs: [690], cat: 'en:extra-virgin-olive-oils', pantry: true }],
  ['huile-sesame', 'Huile de sésame', 'CE', 17400, 20, { ml: 0.92, cs: 13, packs: [230], pantry: true }],
  ['vinaigre-balsamique', 'Vinaigre balsamique', 'CE', 11091, 8, { ml: 1.05, cs: 15, packs: [500], pantry: true }],
  ['vinaigre', 'Vinaigre de cidre', 'CE', 11090, 3, { ml: 1, cs: 15, packs: [750], pantry: true }],
  ['moutarde', 'Moutarde', 'CE', 11013, 5, { cs: 15, packs: [370], pantry: true }],
  ['sauce-soja', 'Sauce soja', 'CE', 11104, 10, { ml: 1.1, cs: 16, packs: [250], pantry: true }],
  ['pesto', 'Pesto', 'CE', 11179, 14, { cs: 15, packs: [190], cat: 'en:green-pestos' }],
  ['tahin', 'Tahin (purée de sésame)', 'CE', 15203, 14, { cs: 15, packs: [300], pantry: true }],
  ['curry', 'Curry en poudre', 'CE', 11005, 40, { cs: 6, packs: [40], pantry: true }],
  ['paprika', 'Paprika', 'CE', 11049, 40, { cs: 7, packs: [40], pantry: true }],
  ['cumin', 'Cumin', 'CE', 11042, 40, { cs: 6, packs: [40], pantry: true }],
  ['curcuma', 'Curcuma', 'CE', 11089, 40, { cs: 7, packs: [40], pantry: true }],
  ['herbes-provence', 'Herbes de Provence', 'CE', 11060, 50, { cs: 3, packs: [20], pantry: true }],
  ['cannelle', 'Cannelle', 'CE', 11025, 50, { cs: 6, packs: [40], pantry: true }],
  ['eau', 'Eau', 'CE', [0, 0, 0, 0, 0, 0, 0, 0], 0, { ml: 1, nobuy: true }],

  // ── Épicerie sucrée ──────────────────────────────────────────────
  ['sucre', 'Sucre', 'SU', 31016, 1.8, { cs: 12, packs: [1000], pantry: true }],
  ['miel', 'Miel', 'SU', 31008, 12, { cs: 20, packs: [250], pantry: true }],
  ['sirop-erable', "Sirop d'érable", 'SU', 31034, 28, { cs: 20, packs: [250], pantry: true }],
  ['chocolat-noir', 'Chocolat noir 70 %', 'SU', 31074, 14, { pc: 10, pn: 'carré', packs: [100], cat: 'en:dark-chocolates' }],
  ['cacao', 'Cacao non sucré', 'SU', 18100, 14, { cs: 6, packs: [250], pantry: true }],
  ['beurre-cacahuete', 'Beurre de cacahuète', 'SU', 15202, 9, { cs: 16, packs: [350], cat: 'en:peanut-butters' }],
  ['amande', 'Amandes', 'SU', 15000, 16, { cs: 10, packs: [200], cat: 'en:almonds' }],
  ['noix', 'Cerneaux de noix', 'SU', 15005, 18, { cs: 8, packs: [125], cat: 'en:walnut-kernels' }],
  ['noisette', 'Noisettes', 'SU', 15004, 18, { cs: 10, packs: [125], cat: 'en:hazelnuts' }],
  ['noix-cajou', 'Noix de cajou', 'SU', 15054, 16, { cs: 10, packs: [125], cat: 'en:cashew-nuts' }],
  ['graines-chia', 'Graines de chia', 'SU', 15047, 14, { cs: 10, packs: [250], cat: 'en:chia-seeds' }],
  ['graines-courge', 'Graines de courge', 'SU', 15064, 14, { cs: 10, packs: [200], cat: 'en:pumpkin-seeds' }],
  ['sesame', 'Graines de sésame', 'SU', 15010, 12, { cs: 9, packs: [100], pantry: true }],
  ['raisin-sec', 'Raisins secs', 'SU', 13046, 7, { cs: 12, packs: [250], cat: 'en:raisins' }],
  ['datte', 'Dattes dénoyautées', 'SU', 13011, 9, { pc: 8, packs: [250], cat: 'en:dates' }],
  ['levure', 'Levure chimique', 'SU', 11046, 20, { pc: 11, pn: 'sachet', packs: [66], pantry: true }],
  ['compote', 'Compote sans sucres ajoutés', 'SU', 13187, 3, { pc: 100, pn: 'pot', packs: [400], cat: 'en:apple-compotes' }],
  ['muesli', 'Muesli sans sucres ajoutés', 'SU', 32141, 6, { cs: 10, packs: [500], cat: 'en:mueslis' }],
];
