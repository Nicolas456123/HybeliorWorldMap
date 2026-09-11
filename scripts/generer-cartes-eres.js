#!/usr/bin/env node
'use strict';
/*
 * scripts/generer-cartes-eres.js — CARTES HISTORIQUES PAR ÈRE.
 *
 * Ajoute à data/monde-contours.json un jeu de surfaces par ère ciblée :
 * le territoire de chaque polité HISTORIQUE est l'union des surfaces des
 * nations actuelles qui en descendent. La filiation vient du graphe
 * (relations succede-a) complétée par les héritages territoriaux attestés
 * dans les faits-précurseurs (« Province sud de Tharnok », « Saint-Empire
 * d'Endara (province sud) »…) — chaque complément est cité.
 *
 * À une année de référence Y (une par ère), chaque pays moderne remonte sa
 * chaîne d'ancêtres jusqu'au premier état VIVANT à Y (vie d'un état :
 * de sa fondation la plus récente à sa chute ou à la fondation la plus
 * ancienne de ses successeurs directs). Les pays sans ancêtre vivant à Y
 * restent terra incognita — on ne peint que l'attesté.
 *
 * Union géométrique par raster (Chromium headless, comme extract-pays) :
 * remplissage des polygones membres, fermeture morphologique (soude les
 * frontières internes), masque terre (côtes du jeu actuel), contour Moore,
 * Douglas-Peucker, repère monde.
 *
 * La carte vivante consomme le résultat SANS modification de code : son
 * curseur temporel choisit déjà le jeu de l'ère courante
 * (js/monde.js · surfacesPourEre / dessinerSurfaces).
 *
 * Usage : node scripts/generer-cartes-eres.js   (idempotent — remplace les
 * jeux d'ère générés, ne touche jamais au jeu era_id:null)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const kg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kg-base.json'), 'utf8'));
const OUT = path.join(ROOT, 'data', 'monde-contours.json');
const doc = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const jeuActuel = doc.jeux.find((j) => j.era_id === null);
if (!jeuActuel) { console.error('✗ jeu era_id:null introuvable'); process.exit(1); }

const byId = new Map(kg.entities.map((e) => [e.id, e]));
const byName = new Map(kg.entities.filter((e) => e.type === 'entite-politique').map((e) => [e.name, e]));

/* ── 1. généalogie : succede-a du graphe + héritages territoriaux attestés ── */
const parents = new Map(); // id → [ids des prédécesseurs]
const lier = (aId, bId) => {
  if (!aId || !bId) return;
  if (!parents.has(aId)) parents.set(aId, []);
  if (!parents.get(aId).includes(bId)) parents.get(aId).push(bId);
};
for (const r of kg.relations) {
  if (r.rel_type !== 'succede-a') continue;
  const a = byId.get(r.from_id), b = byId.get(r.to_id);
  if (a && b && a.type === 'entite-politique' && b.type === 'entite-politique') lier(r.from_id, r.to_id);
}
// Héritages territoriaux attestés par les faits-précurseurs (libellés cités)
const COMPLEMENTS = [
  ['Kharazir', "Hegemonie d'Aethran", '« Hegemonie d\'Aethran (province nord portuaire) »'],
  ['Ventera', "Hegemonie d'Aethran", '« Hegemonie d\'Aethran (plaines centrales) »'],
  ['Seraphia', 'Galenthis', '« Cites academiques de Galenthis »'],
  ['Tyndara', 'Galenthis', '« Marche de Tyndara (dans Galenthis) »'],
  ['Haldria', "Saint-Empire d'Endara", '« Saint-Empire d\'Endara (province sud) » + fac-0413'],
  ['Avalor', "Saint-Empire d'Endara", 'fac-0413 : « Avalor, Haldria et Sanvara descendent de cette théocratie »'],
  ['Sanvara', "Saint-Empire d'Endara", 'fac-0413'],
  ['Endrath', 'Haldria', '« Region montagneuse de Haldria »'],
  ['Caeloria', "Sanctuaire d'Orivane", '« Iles du Sanctuaire d\'Orivane »'],
  ['Halcyon', 'Astravia', '« Province ouest d\'Astravia »'],
  ['Myrtam', 'Forgon', '« Terres interieures de Forgon »'],
  ['Elarath', 'Myrtam', '« Province de Myrtam »'],
  ['Warenthor', "Drahk'Nor", '« Marche de Drahk\'Nor (Warenthor-Reth) »'],
  ['Ferrath', 'Altram', '« Mines Libres d\'Altram (Ferrath-Veth) »'],
  ['Pyrevane', 'Arkhen', '« Province volcanique d\'Arkhen »'],
  // Héritage présumé (confiance basse, à confirmer par l'auteur) : l'Union
  // des Flammes est la seule polité antique de Cendara (successeur du
  // Dominat de Pyrevaste) — la Ligue des Villes Libres en reprend l'aire.
  ['Ligue des Villes Libres', 'Union des Flammes', 'héritage géographique présumé (Cendara) — à confirmer'],
];
for (const [a, b, src] of COMPLEMENTS) {
  const ea = byName.get(a), eb = byName.get(b);
  if (!ea || !eb) { console.log('⚠ complément ignoré (entité absente) : ' + a + ' → ' + b); continue; }
  lier(ea.id, eb.id);
  void src;
}

/* ── 2. vie de chaque état : [fondation la plus récente, fin] ── */
const fondations = new Map(), chutes = new Map();
for (const f of kg.facts) {
  if (!f.subject_id || f.start_year == null) continue;
  if (f.fact_type === 'fondation') {
    const cur = fondations.get(f.subject_id);
    if (cur == null || f.start_year > cur) fondations.set(f.subject_id, f.start_year);
  }
  if (f.fact_type === 'chute') {
    const cur = chutes.get(f.subject_id);
    if (cur == null || f.start_year < cur) chutes.set(f.subject_id, f.start_year);
  }
}
const successeurs = new Map(); // id → [ids]
for (const [a, bs] of parents) for (const b of bs) {
  if (!successeurs.has(b)) successeurs.set(b, []);
  successeurs.get(b).push(a);
}
// Bornes PROPRES d'un état : uniquement ses FAITS de fondation et de chute.
// Jamais data.periode : les périodes des états intermédiaires sont dérivées
// des fondations de leurs successeurs et ne datent pas leur naissance.
const fondationPropre = (id) => fondations.get(id) ?? null;
const chutePropre = (id) => chutes.get(id) ?? null;
// Fin d'un état : sa chute, ou la fondation la plus ancienne d'un successeur.
function finDe(id) {
  const bornes = [];
  const c = chutePropre(id);
  if (c != null) bornes.push(c);
  for (const s of (successeurs.get(id) || [])) {
    const f = fondationPropre(s);
    if (f != null) bornes.push(f);
  }
  return bornes.length ? Math.min(...bornes) : null;
}
// Un état sans fondation connue est présumé né à la chute de son propre
// prédécesseur ; à défaut, dans une FENÊTRE DE VEILLE bornée avant sa fin
// (les protectorats et ligues qui précèdent immédiatement les nations).
const FENETRE_VEILLE = 1000;
function vivant(id, Y) {
  const fin = finDe(id);
  if (fin != null && Y >= fin) return false;
  let debut = fondationPropre(id);
  if (debut == null) {
    const chutesPreds = (parents.get(id) || []).map(chutePropre).filter((c) => c != null);
    if (chutesPreds.length) debut = Math.max(...chutesPreds);
  }
  if (debut != null) return Y >= debut;
  return fin != null && Y >= fin - FENETRE_VEILLE;
}

/* ── 3. pour chaque ère : chaque pays moderne → son état vivant à Y ── */
const ERES = [
  { era_id: 'era3_lien_empires', Y: -6000, titre: 'Âge du Lien (~6 000 av.A)' },
  { era_id: 'era5_grande_nuit', Y: 2000, titre: 'Grande Nuit (~2 000 ap.A)' },
  { era_id: 'era6_nations', Y: 9000, titre: 'Veille des nations (~9 000 ap.A)' },
];
const paysModernes = jeuActuel.masses.filter((m) => m.niveau === 'pays');

function ancetreVivant(nom, Y) {
  const e = byName.get(nom);
  if (!e) return null;
  const fp = fondationPropre(e.id);
  if (fp != null && Y >= fp && (finDe(e.id) == null || Y < finDe(e.id))) return e; // la nation existe déjà
  // remontée en largeur : l'état vivant à Y le plus PROCHE du présent du
  // territoire l'emporte.
  const vus = new Set([e.id]);
  let front = parents.get(e.id) || [];
  for (let prof = 0; prof < 8 && front.length; prof++) {
    for (const id of front) if (vivant(id, Y)) return byId.get(id);
    const next = [];
    for (const id of front) for (const g of parents.get(id) || []) {
      if (vus.has(g)) continue;
      vus.add(g); next.push(g);
    }
    front = next;
  }
  return null;
}

const plans = [];
for (const ere of ERES) {
  const groupes = new Map(); // nom d'état → [masses pays modernes]
  const orphelins = [];
  for (const m of paysModernes) {
    const etat = ancetreVivant(m.nom, ere.Y);
    if (!etat) { orphelins.push(m.nom); continue; }
    if (!groupes.has(etat.name)) groupes.set(etat.name, []);
    groupes.get(etat.name).push(m);
  }
  plans.push({ ...ere, groupes, orphelins });
  console.log('═ ' + ere.titre + ' (' + ere.era_id + ', Y=' + ere.Y + ')');
  for (const [etat, membres] of groupes) console.log('   ' + etat + ' ← ' + membres.map((m) => m.nom).join(', '));
  if (orphelins.length) console.log('   (terra incognita : ' + orphelins.join(', ') + ')');
}

/* ── 4. union raster des membres, par état ── */
(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
  const exe = fs.readdirSync('/opt/pw-browsers').filter((d) => /^chromium[-_]?\d/.test(d))
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const S = 2653, SCL = 2.64937, TX = 1347.6, TY = 1342.4;
  const continents = jeuActuel.masses.filter((m) => m.niveau === 'continent');
  const travail = plans.map((p) => ({
    era_id: p.era_id,
    etats: [...p.groupes.entries()].map(([nom, membres]) => ({ nom, polys: membres.map((m) => m.points) })),
  }));

  const res = await page.evaluate(({ travail, continents, S, SCL, TX, TY }) => {
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const tracer = (poly) => {
      cx.beginPath();
      poly.forEach(([wx, wy], i) => {
        const px = SCL * wx + TX, py = SCL * wy + TY;
        i ? cx.lineTo(px, py) : cx.moveTo(px, py);
      });
      cx.closePath();
    };
    // masque terre : les côtes du jeu actuel
    cx.clearRect(0, 0, S, S);
    for (const m of continents) { tracer(m.points); cx.fillStyle = '#fff'; cx.fill(); }
    const dTerre = cx.getImageData(0, 0, S, S).data;
    const terre = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) terre[i] = dTerre[i * 4 + 3] > 120 ? 1 : 0;

    function morph(masque, passes, valeur) {   // dilate (valeur=1) / érode (valeur=0)
      for (let p = 0; p < passes; p++) {
        const copie = masque.slice();
        for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
          const i = y * S + x;
          if (copie[i] === valeur) continue;
          if (copie[i - 1] === valeur || copie[i + 1] === valeur || copie[i - S] === valeur || copie[i + S] === valeur) masque[i] = valeur;
        }
      }
    }
    function contourMoore(dans) {
      let start = -1;
      for (let i = 0; i < S * S; i++) if (dans[i]) { start = i; break; }
      if (start < 0) return [];
      const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const D = (x, y) => (x < 0 || y < 0 || x >= S || y >= S) ? 0 : dans[y * S + x];
      let x = start % S, y = (start / S) | 0, dir = 6, n = 0;
      const pts = []; const x0 = x, y0 = y;
      do {
        pts.push([x, y]);
        let ok = false;
        for (let k = 0; k < 8; k++) {
          const dd = (dir + 6 + k) % 8;
          const nx = x + DIRS[dd][0], ny = y + DIRS[dd][1];
          if (D(nx, ny)) { x = nx; y = ny; dir = dd; ok = true; break; }
        }
        if (!ok || ++n > 300000) break;
      } while (x !== x0 || y !== y0);
      return pts;
    }
    const sortie = [];
    for (const jeu of travail) {
      const masses = [];
      for (const etat of jeu.etats) {
        cx.clearRect(0, 0, S, S);
        for (const poly of etat.polys) { tracer(poly); cx.fillStyle = '#fff'; cx.fill(); }
        const d = cx.getImageData(0, 0, S, S).data;
        const m = new Uint8Array(S * S);
        for (let i = 0; i < S * S; i++) m[i] = d[i * 4 + 3] > 120 ? 1 : 0;
        morph(m, 4, 1);                       // fermeture : soude les frontières internes
        morph(m, 4, 0);
        for (let i = 0; i < S * S; i++) if (!terre[i]) m[i] = 0;   // masque terre
        // composantes ≥ 400 px, chacune son contour
        const vu = new Uint8Array(S * S);
        for (let i0 = 0; i0 < S * S; i0++) {
          if (!m[i0] || vu[i0]) continue;
          const pile = [i0]; vu[i0] = 1;
          const comp = new Uint8Array(S * S);
          let aire = 0;
          while (pile.length) {
            const i = pile.pop(); comp[i] = 1; aire++;
            const x = i % S;
            for (const j of [i - 1, i + 1, i - S, i + S]) {
              if (j < 0 || j >= S * S || vu[j] || !m[j]) continue;
              if (Math.abs((j % S) - x) > 1) continue;
              vu[j] = 1; pile.push(j);
            }
          }
          if (aire < 400) continue;
          masses.push({ nom: etat.nom, aire, contour: contourMoore(comp) });
        }
      }
      sortie.push({ era_id: jeu.era_id, masses });
    }
    return sortie;
  }, { travail, continents, S, SCL, TX, TY });
  await browser.close();

  /* ── 5. simplification, repère monde, écriture ── */
  function simplifier(pts, eps) {
    if (pts.length < 4) return pts;
    const garder = new Uint8Array(pts.length); garder[0] = garder[pts.length - 1] = 1;
    const pile = [];
    const ferme = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < eps * 2;
    if (ferme) {
      let far = 1, dmax = -1;
      for (let j = 1; j < pts.length - 1; j++) { const dd = Math.hypot(pts[j][0] - pts[0][0], pts[j][1] - pts[0][1]); if (dd > dmax) { dmax = dd; far = j; } }
      garder[far] = 1; pile.push([0, far], [far, pts.length - 1]);
    } else pile.push([0, pts.length - 1]);
    while (pile.length) {
      const [a, b] = pile.pop();
      if (b - a < 2) continue;
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
      let dmax = 0, idx = a;
      for (let j = a + 1; j < b; j++) {
        const dd = Math.abs((pts[j][0] - x1) * (y2 - y1) - (pts[j][1] - y1) * (x2 - x1)) / L;
        if (dd > dmax) { dmax = dd; idx = j; }
      }
      if (dmax > eps) { garder[idx] = 1; pile.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, j) => garder[j]);
  }
  const enMonde = ([px, py]) => [Math.round((px - TX) / SCL * 100) / 100, Math.round((py - TY) / SCL * 100) / 100];

  const idsGeneres = new Set(ERES.map((e) => e.era_id));
  doc.jeux = doc.jeux.filter((j) => j.era_id === null || !idsGeneres.has(j.era_id));
  for (const jeu of res) {
    const ere = ERES.find((e) => e.era_id === jeu.era_id);
    const masses = jeu.masses
      .filter((m) => m.contour.length > 20)
      .map((m) => ({ nom: m.nom, niveau: 'pays', aire: m.aire, source: 'heritage-succession', points: simplifier(m.contour, 1.8).map(enMonde) }))
      .filter((m) => m.points.length >= 5);
    doc.jeux.push({
      era_id: jeu.era_id,
      source: 'generer-cartes-eres.js — union des pays héritiers (succede-a + faits-précurseurs), référence ' + ere.Y,
      reference_year: ere.Y,
      masses: continents.map((m) => ({ ...m })).concat(masses),
    });
    console.log('✔ ' + jeu.era_id + ' : ' + masses.length + ' surface(s) — ' + [...new Set(masses.map((m) => m.nom))].join(', '));
  }
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n');
  console.log('✔ data/monde-contours.json réécrit (' + doc.jeux.length + ' jeux)');
})().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
