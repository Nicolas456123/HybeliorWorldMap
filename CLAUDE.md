# Hybélior — guide de session

Projet de worldbuilding dark-fantasy de Nicolas (français). Le site EST la
source de vérité (les Docs/ sont voués à disparaître). Lecture libre, mot de
passe uniquement pour l'édition.

## Architecture (l'essentiel)

- **Graphe de connaissances** : `data/kg-base.json` (2734 entités, committé,
  source de vérité) ⊕ overlay Turso (éditions post-hoc). Moteur :
  `lib/kg-core.js`. Base SQLite locale `data/hybelior.db` (gitignorée,
  reconstruite par `npm run kg:db`), recherche FTS5 `lib/kg-store-sqlite.js`.
- **Le Monde** (`monde.html` + `js/monde.js`) : portail d'exploration —
  portes, fiches, carte vivante, Visions croisées (graphes de force en
  constellations nommées), Fresque du temps. Vanilla JS, canvas.
- **Carte vivante** : fond = tuiles DZI `https://hybelior-tiles.nicolas-vollard.workers.dev/HybeliorMap.dzi`,
  repère monde→image : `px = (monde + [527.5, 535]) / 1047 · largeur_image`.
  Contours des côtes et pays : `data/monde-contours.json`, produit par le
  pipeline `scripts/extract-trace-contours.js` (côtes depuis
  `continents-trace.svg`, le tracé de l'auteur, cadrage « Hybelior Pays.png »,
  calage RANSAC px₂₆₅₃ = 2.64937·monde + (1347.6, 1342.4)) →
  `scripts/extract-pays.js` → `scripts/snap-pays-cotes.js`.
  ⚠ `canon-stitched.jpg` est MAL CADRÉE vs les vraies tuiles — ne jamais
  s'en servir comme référence de calage. `Atlas-Lore.svg` idem (déprécié).

## Conventions de travail

- Répondre et committer en français. Pousser sur `main` (fast-forward
  vérifié) ET sur la branche de travail désignée.
- Boucle de vérification : `npx eslint js/monde.js`, serveur local
  `PORT=30xx node server.js`, captures Playwright
  (executablePath `/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
  `NODE_PATH=<repo>/node_modules`), envoyer les captures à l'utilisateur.
- Jamais de reseed du graphe sans `KG_RESEED=1` (destructif).
- Le registre des incohérences du lore :
  `Docs/Lore/Incohérences et chantiers — à résoudre.md`.

## REPRISE EN COURS (2026-07-20) — calage de la carte sur le vrai fond

Contexte : les côtes/pays de `data/monde-contours.json` ont été refaits
depuis le tracé de l'auteur et validés indirectement (631/633 villes
cohérentes, Velmaris à 1,2 unité de la côte). Il reste à VÉRIFIER sur les
vraies tuiles. L'utilisateur a autorisé le domaine des tuiles dans la
politique réseau de l'environnement ; l'ancienne session (container
antérieur au réglage) restait bloquée en 403.

À faire immédiatement dans cette session :
1. Tester : `curl -sS https://hybelior-tiles.nicolas-vollard.workers.dev/HybeliorMap.dzi`
   (doit renvoyer le XML DZI ; noter Width/Height).
2. Assembler un niveau ~4000 px des tuiles en `fond-reference.jpg`
   (tuiles `{base}/HybeliorMap_files/{niveau}/{x}_{y}.{format}`,
   overlap 1 px à rogner en haut/gauche sauf bord).
3. Superposer `data/monde-contours.json` + villes du graphe via
   `px = (monde + [527.5, 535]) / 1047 · largeur` ; vérifier visuellement
   (Velmaris doit être SUR la côte) et envoyer l'image de contrôle.
4. S'il y a un écart : ajuster par recalage affine robuste sur champ de
   distance au trait de côte (technique déjà éprouvée), re-souder les pays,
   re-vérifier, committer. Committer aussi `fond-reference.jpg` (+ un JSON
   des métadonnées DZI) comme référence locale durable.
5. Si le curl est encore en 403 : le domaine n'est pas (bien) autorisé —
   demander à l'utilisateur de vérifier l'orthographe exacte du domaine
   dans la politique réseau.

Chantiers suivants (rappel) : surfaces manquantes d'Iskara, Ackerna,
Baelor-Prime, Valoria (graines extract-pays) ; arbitrage No man's land
Azoria/Cestra (marqueurs permutés — Caeloria→Azoria est réglé, §11.c) ;
cartes historiques par ère (jeux `era_id` dans monde-contours) ; bake
overlay→base ; embeddings locaux pour la recherche sémantique ;
affichage `data.fourchette` (règnes-fenêtres) et capitales anciennes.
