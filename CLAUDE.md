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

## Calage de la carte — CLOS (2026-09-10)

Les côtes/pays de `data/monde-contours.json` (refaits depuis le tracé de
l'auteur) sont validés : indirectement (631/633 villes cohérentes,
Velmaris à 1,2 unité de la côte) ET visuellement par l'auteur sur le vrai
fond (la carte s'affiche correctement dans son navigateur, contours
alignés). Le 403 sur `hybelior-tiles.nicolas-vollard.workers.dev` ne
concernait que la politique réseau de l'environnement Claude Code, jamais
le site — **ne plus retenter le curl à chaque session**. Si une
vérification au pixel devient un jour utile : ouvrir le domaine dans la
politique réseau, ou demander à l'auteur une capture de la carte zoomée
(côte de Solmaris / Velmaris).

Chantiers suivants (rappel) : cartes historiques par ère (jeux `era_id`
dans monde-contours) ; embeddings locaux pour la recherche sémantique.
(Marqueurs NML Azoria/Cestra : permutés, échangés le 2026-09-10 — §10
réglé, 0 conflit géo restant.)

**Bake overlay→base — CLOS (2026-09-10).** L'overlay kg de prod
(`kg_overlay`/`kg_deletes`) est **vide** : aucune édition post-hoc, la
base committée fait foi seule. `scripts/bake-overlay.js` reste prêt pour
l'avenir (`--dry-run` d'abord ; purge séparée `--purge`). **Accès Turso
depuis l'environnement : par « Identifiants API »** (hôte
`hybelior-map-nicolas456123.aws-eu-west-1.turso.io`, en-tête
Authorization Bearer) — c'est ce mécanisme qui ouvre l'hôte, PAS le champ
variables ; `TURSO_URL`/`TURSO_AUTH_TOKEN` restent en variables pour les
scripts. ⚠ `turso-adapter` : les entiers Hrana passent en chaîne
(corrigé). Découvert au passage : **la carte de l'accueil (`index.html` →
`js/map.js`) lit encore `coordinate_overrides`** — table synchronisée sur
les arbitrages par `scripts/sync-overrides-arbitrages.js` (NML échangés,
Folgrad→(393,91) ; et en sens inverse Mordock corrigé dans le graphe :
village de Mosrack, le mauvais homonyme avait été restauré ; NML Celethor
a reçu son marqueur (−57.3,−369.2)). Restent ~80 écarts uniformes de
5-7 unités (artefact d'import de mai, sans enjeu) — ne pas « corriger ».
Faits les 2026-09-10 : affichage `data.fourchette` et capitales
anciennes ; surfaces manquantes (Iskara, Ackerna, Valoria + Seraphia,
Baelor-Prime via la côte de son île — 30 pays au total). Restent non
extractibles de « Hybelior Pays.png » : Caeloria (territoire blanc,
îles célestes), Warenthor (aplat indiscernable), les No Man's Land ;
l'île de Baelor n'est qu'un blob de 33 unités² dans continents-trace.svg
(Thyldris tombe en mer) — à compléter dans le tracé si l'île doit
grandir.
