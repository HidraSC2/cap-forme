# Cap Forme

Application web installable (iPhone et ordinateur) pour la perte de poids : recettes avec macros et note nutritionnelle,
planning des repas, liste de courses chiffrée, compteur de macros, sport, pas et suivi du poids.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Sans configuration, tout fonctionne et les données restent dans le navigateur.

| Commande | Rôle |
|---|---|
| `npm test` | Tests des calculs (objectifs, courses, note nutritionnelle, lecture des ingrédients) |
| `npm run build` | Version de production dans `dist/` |
| `npm run ciqual` | Retélécharge la table Ciqual et recalcule les valeurs des ingrédients |
| `npm run prices` | Met à jour les prix depuis Open Prices (environ 3 minutes ; fait automatiquement chaque lundi) |
| `node scripts/report-recipes.mjs all` | Calories, macros et prix de chaque recette |
| `node scripts/report-nutriscore.mjs` | Note nutritionnelle de chaque recette, détail des points |

## Données

- **Valeurs nutritionnelles** : table Ciqual 2025 de l'Anses (Licence Ouverte 2.0), reliée à chaque ingrédient dans
  `src/data/ingredient-defs.ts`. Les macros et le prix d'une recette sont toujours calculés, jamais saisis.
- **Recettes** : 106 recettes originales dans `src/data/recipes.ts` (petits-déjeuners, plats, collations ; rapides,
  batch cooking, économiques, compatibles grossesse).
- **Prix** : relevés Open Prices (Open Food Facts, ODbL), médiane des 18 derniers mois en France, dans
  `src/generated/prices.json`. Un ingrédient sans relevé suffisant garde un prix moyen estimé. Chaque prix peut être
  corrigé dans l'application (écran Courses, toucher un article).
- **Note nutritionnelle** : algorithme Nutri-Score 2023 (aliments généraux) appliqué à 100 g de plat, avec les seuils de
  l'implémentation open source d'Open Food Facts. Pour une recette maison c'est une estimation : le Nutri-Score officiel
  concerne les produits emballés. Les produits du commerce affichent la note fournie par Open Food Facts.

## En ligne

- **Application** : https://hidrasc2.github.io/cap-forme/ (GitHub Pages). Le code source est dans le dépôt public
  [HidraSC2/cap-forme](https://github.com/HidraSC2/cap-forme).
- **Publication automatique** (`.github/workflows/deploy.yml`) : chaque envoi sur `main` lance les tests puis republie le site.
  Chaque lundi à 6 h, les prix sont d'abord mis à jour depuis Open Prices puis enregistrés dans le dépôt. Lancement manuel :
  onglet **Actions → Publication → Run workflow**. Si Open Prices répond mal, les prix précédents sont conservés.
- **Base de données** : projet Supabase `cap-forme` (organisation « Application perte de poids », région Stockholm),
  identifiant `jnofhruxbbagmcmzfgvc`. Adresse et clé publique dans `.env` (la clé publique est faite pour être exposée ;
  l'accès aux données est verrouillé par les règles de sécurité de la base).
- **Adresse de retour des e-mails de connexion** : réglée sur l'adresse du site (Supabase → Authentication → URL Configuration).

## Synchroniser le foyer

Tout le serveur tient dans `supabase/migrations/20261114000000_init.sql` (tables, règles d'accès, fonctions SQL) ;
il est déjà installé sur le projet. Pour un nouveau projet : l'exécuter dans **SQL Editor**, puis renseigner `.env`.

Dans l'application : **Profil → Synchronisation du foyer** → créer un compte, créer le foyer, puis donner le code du foyer à
l'autre personne. Sur un nouvel appareil, l'écran d'accueil propose « J'ai déjà un compte ou un foyer ».
Les données déjà saisies sur l'appareil sont envoyées dans le foyer à sa création.

## Installer sur l'iPhone

Ouvrir https://hidrasc2.github.io/cap-forme/ dans Safari → bouton Partager → **Sur l'écran d'accueil**.

## Pas et poids depuis Apple Santé

Une application web ne peut pas lire Apple Santé. Un Raccourci iOS s'en charge : une fois la synchronisation active,
**Profil → Apple Santé** génère un jeton personnel et donne les étapes. Le raccourci appelle la fonction SQL
`ingest_health` : `POST {URL}/rest/v1/rpc/ingest_health`, en-têtes `apikey` (clé publique) et
`Content-Type: application/json`, corps `{ "p_token": "...", "p_steps": 8421, "p_weight": 82.4 }`.

## Import de recette par lien

La fonction SQL `import_recipe` (membres connectés uniquement) lit la page et renvoie son bloc schema.org/Recipe ;
l'application le met en forme (`src/lib/recipe-import.ts`).

## Organisation du code

```
src/lib/        calculs purs et testés : objectifs, courses, note nutritionnelle, unités, grossesse, activité
src/data/       ingrédients, recettes, portions usuelles
src/store/      stockage local (localStorage) et synchronisation Supabase (« le plus récent gagne »)
src/pages/      écrans : Accueil, Recettes, Planning, Courses, Suivi, Profil
src/ui/         composants partagés
supabase/       schéma complet de la base (tables, règles d'accès, fonctions SQL)
scripts/        import Ciqual, prix Open Prices, publication, rapports de contrôle
```
