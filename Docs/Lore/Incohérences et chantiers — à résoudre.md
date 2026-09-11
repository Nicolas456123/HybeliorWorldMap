---
tags: [lore, méta, incohérences, chantiers, cohérence, graphe, à-résoudre]
type: lore
status: living
date: 2026-07-17
last_review: 2026-09-09
needs_review_for: []
---

# Incohérences et chantiers — à résoudre

> [!abstract] À quoi sert cette page
> Registre **vivant** des incohérences et des trous relevés en construisant le **graphe de connaissance** du site (la base de vérité unique, `data/kg-base.json`). Ces points **ne sont pas des mystères protégés** : ce sont des divergences accidentelles entre sources, des décomptes qui ne concordent pas, ou des rattachements manquants — des choses à **trancher** ou à **compléter** plus tard.
>
> Cette page **complète** deux pages de référence, sans les redoubler :
> - [[Canon — décisions et mystères protégés]] — ce qui **fait foi** et ce qu'il ne faut **jamais** harmoniser ;
> - [[Glossaire des homonymies]] — les mots à plusieurs sens, déjà glosés.
>
> Ici : uniquement le **reste à faire**. Chaque entrée porte un **statut** (`ouvert` / `en cours` / `arbitré`) et, quand c'est possible, une **résolution suggérée**.

---

## Avant tout — ce qu'on ne « corrige » PAS

Ces flous sont **délibérés** : les toucher serait l'erreur. Rappel, avec renvoi.

- **Le double (triple) calendrier lui-même** — an 251 du Sillage = ~10 200 ap.A ; « quinze siècles » (T2) et « dix mille ans » (T3) sont des usages *conformes* du temps profond. Voir [[Canon — décisions et mystères protégés]] §*Le double calendrier*. Ce qui suit (§1) n'est **pas** ce mystère : c'est le fait, purement **matériel**, que les fiches ne **taguent pas** quel calendrier chaque date emploie.
- **Les lectures de l'Arrachement, la cause du Fléau et de « l'Heure », l'auteur de la Guerre de l'Ombre, le sort d'Aldric Valthen, le Panghor/la Profondeur Première, le Mangeur de Temps** — mystères protégés (Canon, Partie 2). Le graphe les garde **au conditionnel** (entités `question`, lectures multiples) ; ne pas les résoudre.
- **Les homonymies voulues** (Délié, Vide, Souffle, Cardinal, Céleste, Heure, Ancrage, Mirathi/Mirathis, Panghor, les deux Portes de Fer, les deux Lunaris…) — voir [[Glossaire des homonymies]]. On glose, on ne fusionne pas.

---

## 1. Datation des dirigeants et des événements régionaux — trois calendriers non tagués

**Statut : largement résolu (2026-08-05).** Voir la *Résolution appliquée* en fin de section.

Les fiches `Docs/Lore/Histoires/` mêlent **trois systèmes de datation** sans jamais dire lequel s'applique à une date donnée :

1. **ap.A / av.A** — calendrier absolu (An 0 = l'Arrachement). Ex. « an 9 900 ap.A », « ~4 750 av.A ».
2. **du Sillage** — an 0–255 (≈ 9 949–10 204 ap.A ; décalage +9 949). Ex. « an 251 du Sillage ».
3. **« an X » local** — le décompte propre de Galenor et d'autres royaumes, en petits nombres (0–255) **indiscernables** du Sillage à l'œil nu.

**Conséquence dans le graphe.** Importer une date brute placerait un roi *actuel* ~10 000 ans trop tôt et déclencherait des faux « règne avant naissance ». Le pipeline applique donc un **garde-fou de datation** (`scripts/aggregate-lore.js`) : il ne garde une année de règne/événement que si elle est **clairement en temps profond absolu** (`|an| > 300`) ; sinon la date est mise à `null` et **préservée dans le libellé**.

- **76** dates de règne/événement mises à `null` (ambiguës) lors du dernier import.
- **52** règnes sur 52 sont aujourd'hui **non datés** sur la frise absolue (dates locales conservées dans le libellé, ex. « règne 244–252 du Sillage »).
- **47** événements régionaux sur 86 sont datés (temps profond) ; **39** restent non datés.

**Effet visible.** Impossible d'**ordonner** une liste de succession par polité tant que les règnes sont non datés → l'onglet *Dirigeants* montre les rois d'un royaume **sans ordre chronologique fiable**.

**Résolution suggérée.** Ajouter, à **chaque date** des fiches Histoires, un **tag de calendrier explicite** (`ap.A` / `Sillage` / `local:<royaume>`). Une passe de conversion (Sillage → ap.A via +9 949 ; local → ap.A via l'ancrage du royaume) donnerait alors des dates absolues sûres, et l'on pourrait relâcher le garde-fou `|an| > 300`. À faire fiche par fiche, ou dans l'Atelier.

### Résolution appliquée (2026-08-05) — `scripts/dater-faits.js`

Le tag de calendrier a été posé **dans le graphe** plutôt que fiche par fiche :
le script relit le libellé de chaque fait non daté, y reconnaît la date, la
convertit en année absolue et **inscrit le calendrier employé** dans
`fact.data.calendrier` — donc auditable et réversible.

**L'ancrage des décomptes régionaux a été prouvé, pas supposé.** Le canon pose
« an 251 du Sillage = ~10 200 ap.A » (décalage +9 949) ; et les fiches de
**dix** continents situent toutes le présent narratif en « l'an 251 »
(« vingt-neuf ans en cette an 251 » à Caeloria, « soixante ans en l'an 251 »,
Kessa de Velathor morte « en l'an 251 » à Trinoria). Les décomptes locaux
partagent donc l'époque du Sillage : un seul décalage vaut pour tous.

**Exception traitée :** « An 0 » qui désigne l'**Arrachement** lui-même
(Mont Cendra, cataclysme cosmique) reste à l'an 0 absolu — il ne s'agit pas
d'un décompte local. 12 faits concernés.

Résultat : **335 → 675 faits datés** (31 % → 62 %).

| | avant | après |
|---|---|---|
| règnes datés | **0** / 189 | **65** / 189 (dont 23 avec début *et* fin) |
| personnes avec au moins une date | 30 | **147** |
| événements datés | 59 | **101** |
| lieux datés | 5 | **42** |

Contrôle : **0** incohérence mort/naissance introduite ; aucune date hors des
bornes du monde (les 5 valeurs extrêmes sont les faits cosmologiques
préexistants, Origine du cosmos et Ère I).

### Passe 2 (2026-08-05) — situer TOUT ce qui peut l'être

Objectif de l'auteur : pouvoir **comparer** les événements. Une date
approximative vaut mieux que pas de date, à condition de dire ce qu'elle vaut.

Trois sources, du plus sûr au plus lâche, chacune tracée dans le graphe :

1. **Lecture du corpus** (`data/datation-corpus.json`) — douze agents ont lu
   les fiches continent par continent pour les 402 faits et 360 personnes que
   le graphe seul ne situait pas, puis des relecteurs sceptiques ont contrôlé
   les datations non certaines : **9 rejetées, 55 corrigées**. Chaque entrée
   garde sa **citation** et sa **fiche d'origine** — tout est révisable.
2. **Propagation relationnelle** (`scripts/inferer-dates.js`) — successions,
   filiations (27 ans par génération), conjoints, fondations, appartenances.
3. **Mise en ordre** — un enfant ne peut pas être actif avant son parent ; la
   date la moins assurée cède. 21 replacements.

| | avant la passe 1 | après la passe 2 |
|---|---|---|
| faits datés | 335 / 1097 (31 %) | **1092 / 1097 (100 %)** |
| — dont date ferme | 335 | 404 |
| — dont date approchée | 0 | 688 |
| personnes situées | 30 / 898 | **548 / 898** |
| nations situées | 86 / 123 | **109 / 123** |
| entités avec une période | 0 | **958** |

Chaque entité porte désormais `data.periode = { debut, fin, confiance,
methode, indice }`, affichée sur sa fiche (« daté par le corpus » /
« estimation » / « situé par recoupement »). La Fresque distingue le cercle
plein (attesté) du cercle creux (approché).

**Trois points d'honnêteté.**

- **Les années « du Sillage » négatives sont traitées comme absolues.** Le
  corpus écrit « ~-800 du Sillage » pour des schismes religieux qu'il situe
  *avant* l'Arrachement ; les lire en +9 949 les placerait dans l'ère
  actuelle. Les positives gardent le décalage. La projection est donc
  *hybride* — mais narrativement juste : les schismes anciens tombent dans
  l'Âge du Lien, les règnes actuels dans l'ère VII. C'est le paradoxe canon
  du double calendrier qui affleure ; il n'est pas résolu, seulement projeté.
- **688 dates sur 1092 sont des approximations.** Elles portent toutes leur
  méthode et leur niveau de confiance : ne pas les citer comme des dates
  fermes sans vérifier l'indice.
- **Une contradiction du lore est apparue** (dates attestées des deux côtés,
  donc rien à corriger automatiquement) : *Sœur Asra Krasv-Velmaris* (10 179)
  succède à *Sœur Velna Brum-Velmaris* (10 181) — la successeuse précède
  celle à qui elle succède. À arbitrer.

**Reste — 5 faits sans aucune date possible** (le règne « Lunarch » de Myrind,
le Schisme de la Septième, la révélation de Yelthari, une convention des
ermites-astronomes) : le corpus ne dit rien, même indirectement. À écrire.

### Passe 3 (2026-08-26) — le récit versé au graphe (les 38 Chroniques)

Les Chroniques de l'Exilé (5 actes, 910 jours) n'existaient dans le graphe
que par leurs personnages : **aucun événement narratif** n'y figurait. Les 38
chapitres ont été relus et 189 événements en ont été extraits dans
`data/evenements-recit.json` (fichier relisible/corrigeable à la main), puis
versés par `scripts/injecter-recit.js` (idempotent, clé `oeuvre:chapitre:titre`).

- **Ancrage temporel** (bible v2, §4.0bis) : départ fin an 248, retour jour
  910 au début de l'an 251 → `an(jour) = 248 + ⌊(305 + jour − 1)/365⌋`,
  toutes dates *circa/estimation*, calendrier tagué `sillage`.
- **Au-delà du voyage** : ~40 jalons hors-itinéraire datés par le texte
  (disparition d'Aldric, éveil de Velathor, réouverture du chenal du nord an
  247, expédition altram an 243, anomalies magnétiques de Cestra an ~220,
  plongée du père de Selendris an ~220, Édit de Celestia an −450…).
- **14 personnages secondaires créés** (Ossian, Wenna Corth, Hesken, Torhal,
  Vessane, Halen…) — déclarés dans le fichier d'événements, jamais créés
  d'office depuis un nom non résolu.
- Le graphe passe à **2 748 entités, 1 286 faits (1 285 datés), 3 269
  relations** ; 766/912 personnes situées.

**Contradiction du lore mise au jour — la chronologie de Noravia.**
`Histoires/Cestra/Noravia.md` (registres du Conseil novien) date le départ
d'Aldric de **l'an 220** et le passage de Sorin de **l'an 231** (« 12-19 du
IIIe mois 231 », reparti « sans avoir tenté d'aller au glacier »). Les
Chroniques v2 posent Sorin à Noravia vers **l'an 250** (jours 825-847), *qui
monte au surplomb du Jumeau*, et un Aldric parti « il y a vingt ans »
(~230) — mais Solvanes, à Lunasar, parle de « trente pleines saisons »
(~220 ?). Deux faits attestés cohabitent donc sur la fiche de Sorin
(fac-0645 : passage en 231 ; faits du récit : passage en 250). **À arbitrer
par l'auteur** : soit Noravia.md précède la bible v2 et doit être rebasée
(220→~230 pour Aldric, 231→250 pour Sorin, et Sorin monte bel et bien au
glacier), soit le registre novien est volontairement faux dans la fiction.

---

## 2. Nombre de continents — 13 dans le graphe, « douze » au canon

**Statut : ouvert (arbitrage d'auteur requis).**

Le [[Canon — décisions et mystères protégés]] pose **« Douze continents partout »** (« treize », voire « quatorze », explicitement corrigé). Or le graphe contient **13** entités `lieu` d'échelle *continent* :

> Alkaran · Azoria · Baelor · Celethor · Cendara · Cestra · Endora · Evertia · Galenor · Ilthara · Nysaria · Onara · Ulinor

Un de ces treize est de trop **par rapport au canon**, ou bien l'un d'eux est en réalité une **nation/région** promue à tort au rang de continent (candidats plausibles : *Baelor*, *Celethor*, *Nysaria*). 

**Résolution suggérée.** Trancher lesquels sont les douze continents canoniques ; rétrograder l'intrus en `entite-politique` ou `lieu`/région. À décider par l'auteur.

---

## 3. Décompte des polités — 59 dans le graphe, 47 nations au canon

**Statut : ouvert (à réconcilier).**

Le graphe compte **59** `entite-politique` ; le canon fixe **47 nations (dont 3 « No Man's Land »)** (décision L1). L'écart s'explique en partie parce que le graphe range dans le même type les **nations actuelles** *et* les **civilisations historiques** (17 civ + 42 nations), qui ne sont pas comptées ensemble par le canon — mais l'alignement n'a pas été vérifié.

**Résolution suggérée.** Distinguer dans le graphe `nation` (actuelle) et `civilisation` (historique) via un champ `data.genre`, puis vérifier que le compte des `nation` retombe sur **47**.

---

## 4. Noms hérités non corrigés — Caeloria / Torkam encore présents comme polités

**Statut : ouvert (vérifier fiche par fiche).**

Le canon acte : **« Table Chronologie corrigée : Caeloria → Azoria ; Torkam → Alkaran »**. Or le graphe contient encore des `entite-politique` nommées **Caeloria** et **Torkam** (Torkam porte même **3** faits de règne). Deux cas de figure à démêler :

- soit ce sont des **résidus** de l'ancien étiquetage (à renommer Azoria / Alkaran) ;
- soit **Caeloria** (nation actuelle, siège du Cardinal-Élu) et un éventuel royaume **Torkam** sont des entités **légitimes distinctes** des continents Azoria/Alkaran, et la coïncidence est bénigne.

**Résolution suggérée.** Vérifier dans les fiches Histoires si « Torkam » y désigne le continent (→ Alkaran) ou une nation propre ; idem pour Caeloria. Renommer ou conserver en conséquence.

---

## 5. Dirigeants non rattachés à leur royaume — 8 règnes orphelins

**Statut : ouvert (mineur). Recompte 2026-09-09 : 13 règnes orphelins — voir §11.c-10.**

44 des 52 règnes sont reliés à leur polité (`object_id`) ; **8** ne le sont pas, faute d'une entité-polité au nom correspondant :

> Valtheria la Forgée · Hadran le Sage · Veldris l'Ancien · Valren de Nalithos · Orlan IV de Nalithos · Mirathi Voix-d'Ambre · Myrind · Krenneth-le-Jeune

Leur royaume est nommé dans le **libellé** (ex. « Thane d'Astraneth (Valoria) », « de Nalithos ») mais ce royaume n'existe pas comme entité, ou sous un autre nom.

**Résolution suggérée.** Créer les polités manquantes (Nalithos, Astraneth/Valoria…) ou corriger le nom cible, puis rattacher les 8 règnes.

---

## 6. Géographie — rattachement `situe-dans` en grande partie comblé

**Statut : largement résolu par le balayage (reste un tail).**

Les lieux importés de la sauvegarde carte n'avaient **aucune** relation `situe-dans`. Le **balayage des fiches Pays** (un agent par continent) a rattaché la géographie via les fiches elles-mêmes (chaque nation → son continent, chaque cité/village → sa nation) : **326 lieux existants** ont été reliés à leur nation/continent (`geo.reused` = 326) et l'ensemble porte désormais **~1000 relations `situe-dans`**.

**Reste ouvert :** les lieux de la sauvegarde carte **non nommés** dans une fiche Pays restent orphelins (tail de villages mineurs) ; leur rattachement fin demandera de vrais **polygones de frontières** (Turso de prod) ou une assignation dans l'Atelier. Quelques conflits de rattachement sont aussi remontés en note (ex. *Iskara* rattachée à *Endora* dans la base Access d'origine mais à *Alkaran* dans les fiches — cf. §9).

---

## 7. Doublons d'entités entre fiches — noms non canonisés

**Statut : partiellement géré.**

Un même événement/personnage peut être nommé **différemment** d'une fiche à l'autre. Cas rencontrés et traités automatiquement au dernier import :

- **« L'Arrachement »** apparaissait comme entité dans deux lots (chronologie + dirigeants) → dédoublonné au profit de la version **datée** de la chronologie.
- Trois événements « orphelins » (fait sans entité au nom exact — *dernier voyage d'Etheira*, *Codification du Sang*, *Réduction du Cri du Cairn*) → rattachés ou recréés, pour ne rien perdre.

**Risque résiduel.** D'autres quasi-doublons peuvent subsister (variantes d'orthographe, titre long vs court). 

**Résolution suggérée.** Tenir un **registre de noms canoniques + alias** (le graphe gère déjà les alias : `save-alias`) et y verser les variantes au fil de l'eau.

---

## 8. Rappels mineurs (déjà cadrés ailleurs)

- **Graphie `Era` / `Ère` / `Ere`** — écrire **« Ère »** dans les textes ; « Era N » toléré comme **cote de fichier** seulement. Voir [[Glossaire des homonymies]] §*Graphie*.
- **Apostrophes droites `'` vs courbes `’`** — **déjà géré** par le pipeline (normalisation `’‘ → '` à la résolution des noms) ; ne cause plus d'échec de rattachement. Ne pas « corriger » à la main dans les sources, c'est inutile.
- **Collision de préfixes d'ID `rel-`** (religion vs relation) — **déjà géré** (les relations utilisent le préfixe `lnk-`).

---

## 9. Constats du balayage exhaustif du corpus (380 notes d'agents)

**Statut : matière brute à trier.** En balayant tout le corpus (Pays, Religions, Chronologie, GDD/Monde, Chroniques, Romans, puis Histoires continent par continent), les ~30 agents d'extraction ont remonté **380 notes d'incohérence**, versées telles quelles dans **`data/lore-notes.json`** (source, texte). Répartition approximative :

| Thème | ~n | Nature |
|---|---|---|
| **Homonymies / variantes de noms** | 116 | un même nom pour deux référents, ou un référent orthographié différemment selon les fiches |
| **Datation (trois calendriers)** | 84 | confirme le §1 — dates locales/du Sillage vs ap.A absolu, mêlées sans tag |
| **Rattachement géographique** | 69 | complète le §6 — nation/région d'un lieu ambiguë ou contradictoire |
| **Mystères laissés ouverts** | 45 | **normal** — les agents ont *correctement* refusé de trancher (Profondeur Première, sort d'Aldric Valthen…) ; à ne pas « résoudre » |
| **Continents (12 vs 13)** | 41 | recoupe le §2 |
| **Successions** | 6 | trous/chevauchements dans des listes de règnes |

Cas concrets à traiter en priorité (échantillon) :

- **Doublon de religion** : le graphe porte **« Taciti »** ET **« Les Silencieux (Taciti) »** comme deux religions distinctes — à fusionner.
- **Nom écrit de trois façons** : *« No Man's Land Azoria » / « No Man's Land d'Azoria » / « No-Man's-Land azorien »* — à canoniser (+ alias).
- **Variantes de dirigeants** : *« Nareth la Sage » = « Grande Chamane Nareth »*, *« Nymera » / « Nyméra »*, *« Yrelda la Forgée » = « Yrelda… »* — candidats alias.
- **Homonymies proches** à surveiller : *Kaeloria* (ville d'Iskara) vs *Caeloria* (nation) ; *Thalorin* (ville **et** prince héritier de Haldria) ; *Karendis*, *Pyrevane*, *Thyros* (chacun désigne à la fois un lieu et une personne/titre).
- **Rattachement contradictoire** : *Iskara* rattachée à *Endora* dans la base Access d'origine, à *Alkaran* dans les fiches (idem *Myrtam/Skaldoria*).
- **Double « Défense de la Porte de Fer »** : deux datations concurrentes (~8790 ap.A vs autre) — à réconcilier.
- **Statut de divinité sectaire** : *Ferros* (« Forgeron Légendaire, rang Céleste ») est une **croyance des Filii Fornacis**, pas le panthéon canonique — à marquer `lecture-disputee` plutôt que fait (idem plusieurs Célestes/divinités locales ajoutés par les fiches religieuses).

**Résolution suggérée.** Trier `data/lore-notes.json` en trois piles : (a) **alias** à créer (variantes de noms) ; (b) **fusions** d'entités (vrais doublons) ; (c) **arbitrages d'auteur** (continents, calendriers, statut des divinités locales). Les mystères (thème « ouverts ») restent **hors périmètre** — on n'y touche pas.

---

## 10. Positions vs rattachements — les conflits carte/fiches (cas Folgrad)

**Statut : RÉSOLU (2026-09-10) — 0 conflit restant sur 226 villes.** Le
dernier lot (la famille « No Man's Land ») est tombé d'un coup : sur la
carte d'origine, les étiquettes des marqueurs **NML Azoria** et **NML
Cestra** étaient **permutées** — le marqueur « Azoria » posé en lisière
sud du continent Cestra (−473, −398), le marqueur « Cestra » au cœur du
continent Azoria (231, 384 — position retrouvée par triangulation sur les
distances de `geo-conflits.json`, erreur < 1 unité), au milieu des treize
villes que les fiches rattachent au NML d'Azoria. Arbitrage (délégué,
2026-09-10) : **échange des deux marqueurs**, appliqué par
`scripts/arbitrer-nml.js` (tracé `data.arbitrage`, anciennes valeurs
conservées) ; aucun re-rattachement nécessaire — les lieux des deux NML
étaient déjà du bon côté du monde. `geo-conflits.json` régénéré : **0
conflit**. Le texte d'origine suit, comme trace.

**Nouveau cas découvert le 2026-09-11 (par les cartes d'ère) — Haldria.**
Le marqueur de Haldria (−271, 172) — et donc sa surface extraite — vit en
plein **Ilthara**, quand ses fiches (`Pays/Endora/Haldria.md`) la disent
d'**Endora**. Invisible aux contrôles : Haldria n'a aucune ville
positionnée pour trancher. Arbitrage d'auteur : déplacer le bloc carte
vers Endora (marqueur + re-extraction de surface), OU acter que la carte
a raison (et corriger fiches + rattachement). En attendant, la surface
« Haldria » (et le Protectorat d'Haldros / le Saint-Empire d'Endara des
cartes d'ère qui en héritent) s'affiche à l'ouest.

La carte vivante a rendu visible une contradiction entre **deux sources de l'auteur** : la position des points sur la carte d'origine (sauvegarde du 3 mai) et le rattachement des fiches. Cas découvert : **Folgrad**, capitale de **Mosrack** (Onara) selon les fiches, mais posée sur la carte **à 21 unités du marqueur d'Ulinor** (et à 381 du marqueur de Mosrack).

Vérification systématique (242 villes rattachées et positionnées, comparées aux **marqueurs de pays de la carte d'origine**) : **93,4 % cohérentes**, 16 conflits, trois causes distinctes :

| Cause | Cas | Correction |
|---|---|---|
| Confusion « No Man's Land » (trois graphies) par les agents d'extraction | 13 villes rattachées au NML d'**Azoria** mais posées près de ceux de **Cestra**/Caeloria/Baelor | à re-rattacher quand les entités NML par continent existeront |
| Conflit **carte vs fiche** dans les sources | **Folgrad** (Mosrack/Onara vs zone Ulinor), **Windora** (Thalmaris vs Astravia) | **arbitrage d'auteur** : déplacer le point sur la carte OU corriger la fiche |
| Homonymes en double dans la sauvegarde carte (12 noms : 2×Kryndor, 2×Ackerna…) — la restauration de coordonnées prenait la première entrée | **Kryndor** (Ventera) avait reçu les coordonnées du Kryndor d'Elarian | **corrigé** : résolution par proximité au marqueur du pays (`fix-geo-conflits.js`) |

Corrections déjà appliquées : **42 ancres** pays/continents importées des marqueurs officiels de la carte (les sphères et libellés de la carte vivante s'alignent sur la vraie géographie) ; l'étape 10 du parcours de Sorin (Folgrad) est **ré-ancrée sur le marqueur de Mosrack** (vérité des fiches) en attendant l'arbitrage.

---

## 11. Passe d'analyse systématique du graphe (2026-09-09)

**Statut : matière neuve, triée en quatre familles.** Relecture programmatique
complète de `data/kg-base.json` (2 748 entités, 1 286 faits, 3 269 relations) :
intégrité référentielle, chronologie, généalogie, successions, doublons,
géographie. Bonne nouvelle d'abord : **0 rupture d'intégrité** (aucun fait ni
relation ne pointe vers une entité fantôme, aucun cycle `situe-dans`, aucune
mort avant naissance sur dates fermes, aucune paire alliés-et-en-guerre).
Tout ce qui suit est daté, sourcé par identifiant de fait, et corrigeable.

### 11.a Erreurs mécaniques de datation — corrigées (2026-09-09)

**Statut : résolu.** Voir la *Résolution appliquée* en fin de section ; le
tableau ci-dessous est conservé comme trace de ce qui était faux.

Le libellé de chaque fait dit une chose, l'année absolue inscrite en dit une
autre. Neuf cas sûrs, décelés en recomparant l'année du graphe à l'année
Sillage écrite dans le libellé (154 faits vérifiables, 9 divergents) :

| Fait | Sujet | Année inscrite | Ce que dit le libellé | Année attendue |
|---|---|---|---|---|
| `fac-0931` | L'Invasion Avortée | 10 201 | « trois siècles **avant** l'an 252 » | ~9 900 (cohérent avec `fac-0195`/`fac-0542`) |
| `fac-0598` | La Schismature des Forges | 10 179 | l'événement court Sillage 121–137 | 10 070–10 086 (cf. `fac-0942`/`fac-0962`) |
| `fac-0646` | Expédition Valkren | 9 963 | « départ consigné **14 du IIe mois 188** » — le jour du mois a été lu comme année Sillage | 10 137 (cf. `fac-0974`/`fac-0987`) |
| `fac-0205` | L'Édit de Celestia | **−700** | « ~7 siècles avant le Sillage » lu comme année absolue négative — place l'Édit avant l'Arrachement | ~9 250 |
| `fac-0276` | mort de Lethanis Vor-Ostrun | 10 121→10 138 | c'est sa période de charge (+172–+189) ; elle meurt « en +193 » | 10 142 (cf. `fac-0191`/`fac-0550`) |
| `fac-0280` | mort de Mara Telventh | 10 101 | 10 101 = +152, le **début** de sa charge ; elle meurt « en +178 » | 10 127 |
| `fac-0288` | mort de Veska Drennar | 10 083 | 10 083 = +134, sa **canonisation** ; elle meurt « en Sillage 109 » | 10 058 (cf. `fac-0438`) |
| `fac-0565` | mort d'Ingrid Frelvar | 10 146 | 10 146 = sa **naissance** (an 197) ; elle « meurt en l'an 263 » | 10 212 |
| `fac-0693` | règne d'Elyndra III | début 10 199 | 10 199 = son **abdication** (« en 250 ») ; « environ trois décennies de règne » | ~10 169→10 199 (cf. `fac-0233`, cohérent) |

S'y ajoute `fac-0953` (déclin des Phénix de Feu) daté 9 952 (≈ Sillage 3)
alors que tout le libellé vit vers l'an 220–251 du Sillage (registre depuis
Sillage 70, dernier passage an 240) — origine de la valeur inexpliquée.

**Résolution appliquée (2026-09-09) — `scripts/corriger-faits-11a.js`.**
Les dix faits portent désormais l'année que leur propre libellé énonce ;
chaque ancienne valeur est conservée dans `data.correction` (auditable,
réversible), et le script est idempotent (valeurs attendues vérifiées avant
écriture). Les périodes dérivées de sept entités ont été recalées avec la
règle exacte du pipeline (min/max des faits datés) : l'Invasion Avortée
(9 900), la Schismature (10 070–10 086), l'Expédition Valkren (10 137),
l'Édit de Celestia (9 250–9 500 — la fourchette du §11.b-2 reste à
arbitrer), Veska Drennar (fin 10 058), Ingrid Frelvar (10 146–10 212 ; sa
naissance ne vit que dans le libellé de `fac-0565`, conservée en début de
période), les Phénix de Feu (déclin dès ~10 170). L'audit libellé-vs-année
re-passé ne laisse que des faux positifs de lecture (années « 9 605 ap.A »
attrapées comme « Sillage 9 », années de contexte) et les contradictions
attestées du §11.b (Tessar, Kyra), qui relèvent de l'arbitrage, pas de la
correction.

### 11.b Contradictions du lore — arbitrées (2026-09-09, par délégation)

**Statut : résolu.** L'auteur a délégué l'arbitrage (« tranche au plus
logique ») ; les douze verdicts, motivés, sont enregistrés dans l'interface
d'arbitrage et appliqués au graphe par **`scripts/arbitrer-11b.js`**
(idempotent, gardé par les valeurs attendues, provenance `data.correction` /
`data.arbitrage` sur chaque fait touché). Verdicts :

1. **Tessar Veynd** — né en **Sillage 88** (le récit précis — lieu, famille,
   âge à la mort — l'emporte sur « vers 75 », dérivé d'un âge estimé au
   sermon) ; mort en **137**, la fuite de l'apprenti « en 138 » suit une
   mort de fin d'année.
2. **Édit de Celestia** — promulgué par le **Premier Conclave, an −450 du
   Sillage (9 499 ap.A)** : deux sources indépendantes convergent (fiche
   religieuse ~9 500, récit an −450). `fac-0299`/`0399`/`0205` recalés ;
   `fac-1234` (la promulgation, typée fondation *de Caeloria*) retypé
   événement.
3. **Kyra** — c'étaient **trois** personnes : la fille d'Aldren Voss
   (Glintaris, † à 11 ans, garde `per-0200`, renommée « Kyra (de
   Glintaris) »), la forgeronne d'Ardentris fille de Velya (`per-0913`),
   l'épouse d'Aldren de Thalor (`per-0914`). Faits, liens familiaux et
   conjugaux répartis ; alias « Kyra » posés en désambiguïsation ;
   `a-ne-pas-confondre-avec` en triangle.
4. **Civilisations antiques** — **les fiches font foi** : les 16 faits-seed
   sans libellé (table du premier import) supprimés ; les huit périodes
   recalées sur les dates des fiches (Alkarath −16 000→−11 500, Endara
   −9 000→−5 000, Ithalorn −7 000→−3 500…).
5. **Kethvar** — deux temps : le **peuplement** (Loi de Pierre, ~−2 000,
   `fac-0505` retypé événement) et la **fondation nationale** (~9 700).
6. **Pyrevane** — **trait canon conservé** (« existe sans avoir été
   instituée ») : l'émergence de ~−14 500 devient un événement, la
   fondation politique reste ~9 800 ; le paradoxe vit dans les libellés.
7. **Mirathi** — fondée par le **Sanctuaire (~9 400)** ; l'érection en
   province de Vytharia (~9 800) devient un événement.
8. **Elarath 9 996, Solmaris 9 961** — le récit fondateur propre fait foi
   (« l'an 47 » de la fragmentation de Morveth ; la Première Veillée) ;
   les estimations de succession (~9 800) recalées.
9. **Skaldoria** — fondée ~9 400 ; l'accord du Ralthyn (9 560) est une
   **réorganisation confédérale** (retypé événement).
10. **Ligue des Marchands** — institution propre (`pol-0124`, dans
    Tyndara) : `fac-1028` déplacé, Selyra la fonde, Fablioris en capitale.
11. **Velmaris** — il y a **deux Velmaris** : la ville du soufre reste à
    Solmaris ; le **village de pêcheurs de perles du Lagosaim (Seraphia)**,
    découvert dans la fiche Seraphia, devient `lie-0969` et reprend le lien
    vers Seraphia. La ville-étalon du calage carte est donc bien à Solmaris.
12. **Règnes multiséculaires** — **fenêtres d'incertitude**, pas des durées
    (aucun n'est canonisé « longévité inexpliquée », contrairement à
    Verithan) : les huit faits marqués `data.fourchette = true`. ⚠ Chantier
    d'affichage : la Fresque et les fiches doivent apprendre à ne pas
    rendre une fourchette comme une durée de règne.

**Observation de bordure (hors arbitrage).** Les ~40 paires de fondations
restantes suivent le motif *précurseur* voulu (« Province sud de Tharnok »,
« Berceau de l'Eau »…) : des faits d'histoire profonde du territoire, typés
`fondation` par l'import d'origine. Même remède que 5/7/9 si l'auteur le
souhaite — les retyper `evenement` en masse — mais c'est une décision de
**modèle**, pas de lore ; laissée ouverte.

Le texte d'origine des douze points est conservé ci-dessous comme trace.

1. **Tessar Veynd, deux naissances.** « Né vers 75 » (quarante-six ans au
   sermon de 121 — `fac-0187`/`fac-0596`) vs « né en Sillage 88 » (mort à
   49 ans en 137 — `fac-0273`/`fac-0274`). Les deux traditions sont
   *internement* cohérentes (75+46=121 ; 88+49=137) et incompatibles entre
   elles. Mort en 137 vs 138 (`fac-0943` : l'apprenti fuit « immédiatement
   après la mort » en 138) — divergence mineure liée.
2. **L'Édit de Celestia, trois datations.** ~9 350 ap.A (`fac-0299`/`fac-0399`),
   ~9 500 « par le Premier Conclave » (`fac-0516`), « sept siècles avant le
   Sillage » ≈ 9 250 (`fac-0205`) — et le récit (passe 3) le situe « an −450 »
   ≈ 9 499. Deux époques candidates : ~9 250–9 350 ou ~9 500.
3. **Kyra (`per-0200`) est deux personnes fusionnées.** Fille d'Aldren Voss,
   morte à **11 ans** d'une fièvre inexpliquée au temple d'Ignis Aeternum de
   Glintaris (`fac-0437`, 10 165) — et forgeronne à Ardentris, fille de la
   prêtresse Velya, morte à **19 ans** de la Maladie des Poumons (`fac-0880`).
   Parents, lieux, âges et causes incompatibles : à **scinder** en deux
   entités homonymes.
4. **Civilisations antiques : la table-seed contredit les fiches.** Chaque
   grande civilisation porte une fondation/chute **sans libellé** (seed du
   premier import chronologique) *et* une fondation/chute **libellée**
   (fiches Histoires), qui divergent :
   | Civilisation | Fondation seed / fiches | Chute seed / fiches |
   |---|---|---|
   | Confédération d'Alkarath | −15 000 / −16 000 | **−2 000 / −11 500** |
   | Khalifat de Solvenar | −12 000 / −11 000 | **−4 000 / −7 500** |
   | Saint-Empire d'Endara | −10 000 / −9 000 | **0 / −5 000** (+ fait de chute en double) |
   | Royaume des Songes d'Ithalorn | **−10 000 / −7 000** | −2 000 / −3 500 |
   | Ligue Marchande d'Everthor | −5 000 / −5 000 | 0 / −1 500 |
   | Tharnok | 100 / 600 | 3 000 / 3 200 |
   | Forgon | 150 / 400 | 3 500 / 4 000 |
   | Drahk'Nor | 200 / 800 | 4 800 / 4 800 |
   La Fresque affiche les **deux** jeux. Trancher lequel fait foi (les faits
   libellés sont traçables aux fiches ; les seeds venaient de la table
   chronologique), puis supprimer l'autre.
5. **Kethvar, deux fondations à 11 700 ans d'écart.** ~9 700 ap.A
   (successeur de la Thalassocratie Azor-Kerev) vs ~−2 000 (« forgerons
   issus d'une migration des plateaux d'Alkaran… durant l'Âge du Lien »).
6. **Pyrevane** : fondation ~9 800 (successeur de la Ligue des Villes
   Libres) vs émergence ~−14 500 (fragmentation du Dominat de Pyrevaste) —
   possiblement voulu (« existe sans avoir été instituée ») ; à confirmer et
   à glossairer si c'est le cas.
7. **Mirathi** : « province de Vytharia ~9 800 » vs « Sanctuaire de Mirathi
   fondé ~9 400 par des rêveurs vythariens dissidents ».
8. **Elarath** : fondation ~9 800 vs fragmentation de Morveth « an 47 »
   (= 9 996). **Solmaris** : ~9 800 vs 9 961 (Première Veillée). Même motif :
   la date « succession de la civilisation mère » et la date « récit fondateur
   propre » cohabitent sans hiérarchie.
9. **Skaldoria** : fondation ~9 400 vs confédération clanique de 9 560
   (accord du Ralthyn, après la Bataille du Fjord Gelé) — peut-être deux
   événements légitimes (nation puis confédération) ; à dire explicitement.
10. **Tyndara** porte la fondation de la **Ligue des Marchands** (Selyra la
    Calculatrice, Fablioris, datée 9 977) comme un fait de fondation de
    Tyndara elle-même (fondée ~8 400) — rattachement à vérifier.
11. **Velmaris dans deux nations.** La ville-étalon du calage carte est
    `situe-dans` **Solmaris** (`lnk-2065`, conforme au résumé « port ouest de
    Solmaris ») *et* **Seraphia** (`lnk-2586`). Soit un rattachement erroné,
    soit deux Velmaris homonymes (le couvent des sœurs Brum-Velmaris /
    Krasv-Velmaris, « Velmaris-Haut » ?) — à trancher, avec incidence sur la
    carte.
12. **Durées de règne extrêmes non distinguées des fourchettes.** Haldros le
    Navigateur 8 200→9 300 (1 100 ans), Faelorn et Amaryl 700 ans, Warenthos
    600, Ashgrim le Calciné 400 (« règne non daté » !), Theldryn III 300,
    Vytha 200. Certaines sont des **fenêtres d'incertitude** encodées dans
    début/fin, d'autres peut-être des longévités voulues (Verithan, ~600 ans,
    est lui **explicitement** canonisé « longévité inexpliquée »). Le modèle
    ne permet pas de les distinguer → marquer les fourchettes (`data`) ou
    élaguer.

### 11.c Structure du graphe — réparé (2026-09-09)

**Statut : résolu**, par **`scripts/reparer-11c.js`** (idempotent, tout
tracé en `data.reparation`, libellés des faits fusionnés conservés dans
`data.fusion`). Sauvegarde avant/après dans l'historique git. Bilan :

- **Fusions** : la nation Dhalvoria récupère tout ce que portait
  l'événement homonyme (dont sa vraie fondation ~9 900) ; Feylor, Zarnith
  et Frosthal redeviennent des lieux (résumés et faits transférés,
  Frosthal rattachée à Elarian) ; le double vide de la Fédération de
  Morveth supprimé ; **l'Empire d'Evertia et la nation Evertia ne font
  plus qu'un** (même capitale Caëspia, même Impératrice — alias posé), et
  Thalmaris/Sylvara redeviennent des nations sœurs du continent.
- **79 faits en double fusionnés** (règnes, naissances, morts des deux
  passes d'import) ; la fuite de l'apprenti de Tessar retypée événement.
  Restent 3 paires *voulues* (objets différents = deux rôles, ex. Brenna
  cheffe du Clan du Loup et fondatrice de la Confédération).
- **11 rattachements continentaux tranchés par les fiches `Pays/`** :
  Tyndara→Onara, Haldria→Endora, **Caeloria→Azoria** (chantier CLAUDE.md
  réglé), Vytharia/Lunasar/Mirathi→Ilthara (l'île de Nysaria restant à
  Celethor), **Torkam→Alkaran**, le Temple des Flammes Éternelles ramené
  à Ilnara seule, Windora purgée de son reliquat Thalmaris (résumé
  compris). **0 entité à cheval sur deux continents** (57 avant).
- **No Man's Land homogénéisés** : Celethor et Cestra retypés
  `entite-politique` genre non-état, comme Azoria (le canon les compte
  parmi les 47 nations). ⚠ La permutation suspectée des *marqueurs* NML
  Azoria/Cestra reste un arbitrage d'auteur (CLAUDE.md).
- **Capitales-seed** : les cinq situées dans leur nation ; Lithanel,
  Navoria (engloutie An 0, fin posée) et Everthor-Prime qualifiées
  « capitale ancienne » face aux capitales actuelles des fiches (Trelios,
  Folgrad, Ostarith).
- **0 règne orphelin** (13 avant) : rattachés à Kryostra, Glacoria,
  Thyldor, Galdryn, Mythralis, Eridorn, et aux tribus Jentar/Folinor
  (lignées — assumé) ; la Tyrannie des Cendres retypée événement de
  Drahk'Nor.
- **0 homonymie non balisée** (30 avant) : 17 `a-ne-pas-confondre-avec`
  posés ; les doublons de facettes (Vael'Ur, Cœur de Cendra, Chamanes des
  Brumes, Verithani, Étranger des Heures, Fragment #3) reliés `lie-a`
  « à fusionner au bake » ; l'Arrachement et la Résonance balisés
  « concept + événement, facettes voulues ».

**Restes assumés** : les faits-précurseurs typés `fondation` (~40, motif
voulu — cf. fin du §11.b) ; les doublons de fondation à date égale
(Tharnok, Forgon, Drahk'Nor, Lunasar… — attestations multiples, bake).

**Affichage appliqué (2026-09-10).** La Fresque dessine désormais une
fourchette (`data.fourchette`) en cercle creux à mi-fenêtre avec
moustaches — plus jamais en trait de règne — et son infobulle dit
« entre X et Y · fenêtre d'incertitude » ; `dateLabel` (fiches, Atelier
Dirigeants) dit « entre X et Y » ; et le label propre d'une relation
(« capitale ancienne, engloutie An 0 »…) qualifie son type sur les fiches
au lieu d'être écrasé (`lib/kg-core.js`).

Le texte d'origine est conservé ci-dessous comme trace.

#### Texte d'origine (avant réparation)

1. **La nation Dhalvoria vit dans un événement.** `evt-0166` (« Dhalvoria »)
   porte la capitale (Dhalvora, `lnk-2855`), neuf villes `situe-dans`, deux
   religions pratiquées, une vénération, une frontière avec la Confédération
   tribale d'Ulinor et la **succession de la Ligue Yurrak** (`lnk-0448`) —
   pendant que la vraie polité `pol-0041` ne porte qu'un fait. Même famille :
   **Feylor** (`evt-0164`, cible de `gouverne` et `fonde` !), **Zarnith**
   (`evt-0163`, `situe-dans` le No Man's Land Celethor), **Frosthal**
   (`evt-0165`) — des événements nommés comme leurs lieux homonymes
   (`lie-0739`/`lie-0746`/`lie-0767`) et devenus porte-relations de lieux.
   À retyper ou re-brancher sur les bonnes entités.
2. **Fédération de Morveth en double** : `evt-0126` (décrite comme « la
   confédération de douze cités » — une entité, pas un événement) vs
   `pol-0081`. Fusionner ou faire de l'événement la *fondation* de la polité.
3. **52 dirigeants portent deux faits de règne quasi identiques** (45 paires
   aux dates strictement égales, 7 divergentes) — reliquat de deux passes
   d'import (séries `fac-01xx`–`02xx` vs `fac-04xx`+). Dédoublonner lors du
   bake ; les 7 divergentes sont surtout « fin 10 200 (présent) vs fin
   ouverte », sauf Elyndra III (cf. 11.a).
4. **Doubles rattachements `situe-dans` contradictoires** — les racines des
   57 entités « à deux continents » : **Tyndara** → Galenor *et* Onara ;
   **Haldria** → Endora *et* Ilthara ; **Caeloria** → Celethor *et* Azoria
   (chantier connu) ; **Vytharia/Lunasar/Mirathi** → Nysaria *et* Ilthara
   (leur `data.continent` dit encore Nysaria) ; **Torkam** → Ulinor *et*
   Alkaran (§4) ; **Temple des Flammes Éternelles** → quatre parents
   (Ilnara, Pyracine, Haliandris, Lorenthia) ; **Mont Cendra** → Cendara et
   La Grande Île. Clans à cheval (Halgren, Hesgarn, Ours, Vass) : peut-être
   voulu, à confirmer. Un arbitrage par nation suffit à assainir toute la
   descendance.
5. **Windora : arbitrage appliqué à moitié.** L'arbitrage 2026-07-18 (« région
   d'Astravia ») a bien posé `lnk-2134` → Astravia et l'échelle `region`,
   mais l'ancien `lnk-2433` → Thalmaris **subsiste**, et le résumé de la
   fiche dit toujours « région venteuse de l'est de **Thalmaris** ».
6. **Trois No Man's Land, deux typages.** NML Azoria = `entite-politique`
   (`pol-0109`, genre non-état) ; NML Celethor et NML Cestra = `lieu`
   d'échelle region (`lie-0242`, `lie-0298`). Le canon les compte parmi les
   47 nations : homogénéiser (et créer les entités NML par continent
   attendues par le §10).
7. **Evertia en triple.** `lie-0008` (échelle **continent**, pourtant décrit
   « archipel-forteresse, l'Île aux Merveilles ») + `pol-0116` (nation
   « extérieure à Cendara », sans géographie) + `pol-0119` (Empire
   d'Evertia). Thalmaris et Sylvara sont `situe-dans` les **deux** premiers ;
   Valmora et Lithéa dans `pol-0116` *et* `pol-0119`. À démêler — et le cas
   pèse sur le §2 (si Evertia est une île, le compte des continents descend
   à dix).
8. **Cinq capitales hors géographie** : Lithanel, Drahk, Orivanel, Navoria
   (engloutie An 0) et Everthor-Prime (`lie-0014`–`lie-0018`) sont
   `capitale-de` sans aucun `situe-dans`.
9. **29 homonymies non balisées** (aucun `a-ne-pas-confondre-avec`) :
   Evertia, Ackerna, Warenthor, Skaldoria, Noravia, Trinoria, Valoria,
   Ryldor (polité vs lieu) ; Thaldris, Thyros, Selvorn, Aerith, Yltheris,
   Korven (personne vs lieu) ; Jentar, Folinor, Xyria (lignée vs lieu) ;
   L'Arrachement (concept vs événement), La Résonance, Vael'Ur, Le Cœur de
   Cendra, Les Chamanes des Brumes, Les Verithani, l'Étranger des Heures,
   Le Fragment #3 (concept/terme/objet — probablement de **vrais doublons**
   à fusionner plutôt que des homonymes) ; Zarnith, Feylor, Frosthal,
   Dhalvoria, Fédération de Morveth (cf. points 1–2).
10. **Le décompte des règnes orphelins passe de 8 à 13** (§5) — s'y sont
    ajoutés Krenneth de Kryostra, Rann et Vyssa (Glacoria), Brennar et
    Myrael (Thyldor), Vorastes (Galdryn), Vael Vegnaurson (Mythralis), La
    Tisseuse d'Eridorn ; et un fait de règne porté par un **événement** (La
    Tyrannie des Cendres, `evt-0161`). Trois des anciens cas visent des
    tribus typées `lignee` (Jentar, Folinor, Clan du Loup) — décider si une
    lignée peut être gouvernée ou s'il faut des polités tribales.

### 11.d Points recontrôlés, inchangés

- Les **13 villes** rattachées au No Man's Land d'Azoria mais posées près de
  Caeloria (§10) : le recalcul spatial complet (226 villes vérifiées)
  retombe exactement sur ces 13 — rien de neuf n'a dérivé.
- **§2 continents** : 11 continents d'échelle dans le graphe ; la prose
  (bible v2, Chroniques 33–37, Era 7…) dit toujours « douze ». Toujours à
  trancher dans les textes (et cf. 11.c-7 pour Evertia).
- **§3 nations vs civilisations** : `data.genre` n'est posé que sur 46/123
  polités (dont 6 « nation ») — le recompte canon (47) reste impossible.
- **Sœur Asra / Sœur Velna** (passe 2) et **la chronologie de Noravia /
  Sorin** (passe 3) : toujours à arbitrer, rien de neuf.
- Les **5 faits sans aucune date possible** (Lunarch de Myrind, Schisme de
  la Septième…) : toujours à écrire.

---

## Arbitrages actés par l'auteur (2026-07-18)

Quatre points tranchés en interface interactive, appliqués au graphe :

| Point | Arbitrage | Application |
|---|---|---|
| **Folgrad** (carte vs fiche) | **La fiche a raison** : capitale de Mosrack (Onara) | point repositionné au marqueur Mosrack (393, 91) ; surface nationale de Mosrack extraite ; étape 10 de Sorin re-pointée sur Folgrad |
| **Windora** (Thalmaris vs Astravia) | **Région d'Astravia** | `situe-dans` → Astravia, échelle passée à `region` |
| **Continents (12 vs 13)** | **Baelor et Nysaria sont de grandes îles**, pas des continents | rétrogradés (échelle `region`, marqués île) → **11 continents canoniques**. ⚠ Reste à réconcilier : la prose (romans, Chroniques) dit « douze continents » — onze + les deux grandes îles ne font pas douze ; à trancher dans les textes. |
| **Taciti / Les Silencieux (Taciti)** | **L'une est une branche de l'autre** | reliées par `lie-a` (« branche de ») ; les deux entités conservées |

Le §2 (nombre de continents) et les lignes Folgrad/Windora du §10 sont donc **réglés** ; `data/geo-conflits.json` régénéré (restent 14 cas, tous de la famille « No Man's Land »).

---

## Annexe — d'où viennent ces constats

- Notes brutes du balayage : **`data/lore-notes.json`** (380 entrées `{ source, note }`, versionné).
- Rapport d'agrégation régénérable : `data/.lore-aggregate-report.json` (produit par `node scripts/aggregate-lore.js`, non versionné).
- Rapport de cohérence du graphe : projection *Cohérence* de l'Atelier (`getConsistencyReport`) — **0 erreur** (les points ci-dessus sont des **trous**, **doublons** ou **arbitrages**, pas des ruptures d'intégrité référentielle).
- Base de vérité : `data/kg-base.json` — **2 748** entités, 1 286 faits, 3 269 relations après la passe 3 (contre 1 097 entités avant le balayage).

## Renvois

- [[Canon — décisions et mystères protégés]] — ce qui fait foi ; ce qu'on ne touche pas.
- [[Glossaire des homonymies]] — les mots à plusieurs sens.
- [[Lexique du Lien à travers les Ères]] — la chaîne Vide → Tisse → non-Lié → « Délié ».
