#!/usr/bin/env node
'use strict';
/*
 * scripts/extract-pays.js — Extrait les SURFACES NATIONALES depuis
 * « Docs/GDD/02 - Monde/Cartes/Hybelior Pays.png » (aplats par pays).
 *
 * Calage : RANSAC sur les capitales (points rouges de la carte) vs leurs
 * positions monde — px = s·monde + t, vérifié à 23/27 capitales < 6 px.
 *
 * Segmentation (Chromium headless, aucune dépendance) :
 *   1. masque terre/océan ;
 *   2. graine par nation = capitale (ou marqueur pays), couleur échantillonnée
 *      autour (médiane, en ignorant rouge/blanc des points et étiquettes) ;
 *   3. Voronoï contraint par couleur : chaque pixel terre dont la couleur
 *      matche une ou plusieurs nations est assigné à la graine la plus proche
 *      parmi elles ; les pixels restants (frontières, rivières, étiquettes)
 *      sont comblés par dilatations successives ;
 *   4. composante connexe contenant la graine → contour (Moore) → Douglas-
 *      Peucker → repère monde → data/monde-contours.json (niveau 'pays').
 *
 * Usage :  node scripts/extract-pays.js [--tol 26] [--dilat 14]
 *
 * Pipeline complet (côtes → pays → soudure) :
 *   node scripts/extract-trace-contours.js && node scripts/extract-pays.js \
 *     && node scripts/snap-pays-cotes.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'Docs/GDD/02 - Monde/Cartes/Hybelior Pays.png');
const opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? +process.argv[i + 1] : d; };
const TOL = opt('tol', 26);
const DILAT = opt('dilat', 14);
// transfo RANSAC (S = 2653) : px = SCL·x_monde + TX
const S = 2653, SCL = 2.64937, TX = 1347.6, TY = 1342.4;

(async () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kg-base.json'), 'utf8'));
  const byId = {}; for (const e of base.entities) byId[e.id] = e;
  // graine par nation : capitale positionnée, sinon marqueur pays
  const capDe = {};
  for (const r of base.relations) {
    if (r.rel_type !== 'capitale-de') continue;
    const cap = byId[r.from_id];
    if (cap && cap.data && cap.data.coord_x != null) capDe[r.to_id] = cap;
  }
  // institutions, ligues, conseils… n'ont pas de territoire à extraire
  const SANS_TERRITOIRE = new Set(['institution', 'ligue', 'guilde', 'conseil', 'mouvement', 'faction', 'organisation']);
  const nations = base.entities
    .filter((e) => e.type === 'entite-politique' && ((e.data && e.data.coord_x != null) || capDe[e.id]))
    .filter((e) => !(e.data && SANS_TERRITOIRE.has(e.data.genre)))
    .map((e) => {
      const g = capDe[e.id] || e;
      // candidats de graine, du plus sûr au moins sûr : capitale, marqueur
      // pays, puis villes positionnées de la nation — l'échantillonneur
      // choisit le premier dont la couleur locale est franche (une capitale
      // posée sur une bande de terrain ou un halo d'étiquette ment).
      const candidats = [{ src: capDe[e.id] ? 'capitale' : 'marqueur', wx: +g.data.coord_x, wy: +g.data.coord_y }];
      if (capDe[e.id] && e.data && e.data.coord_x != null) candidats.push({ src: 'marqueur', wx: +e.data.coord_x, wy: +e.data.coord_y });
      for (const r of base.relations) {
        if (r.rel_type !== 'situe-dans' || r.to_id !== e.id || candidats.length >= 8) continue;
        const v = byId[r.from_id];
        if (v && v.type === 'lieu' && v.data && v.data.coord_x != null) candidats.push({ src: v.name, wx: +v.data.coord_x, wy: +v.data.coord_y });
      }
      return { id: e.id, nom: e.name, wx: +g.data.coord_x, wy: +g.data.coord_y, viaCap: !!capDe[e.id], candidats };
    });
  console.log('nations avec graine :', nations.length);

  const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
  const exe = fs.readdirSync('/opt/pw-browsers').filter((d) => /^chromium[-_]?\d/.test(d))
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const b64 = fs.readFileSync(IMG).toString('base64');

  const res = await page.evaluate(async ({ b64, nations, S, SCL, TX, TY, TOL, DILAT }) => {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = 'data:image/png;base64,' + b64; });
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, S, S);
    const d = cx.getImageData(0, 0, S, S).data;
    const rgb = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const ocean = rgb(1300 * S + 10);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const estRouge = (c) => c[0] > 150 && c[1] < 90 && c[2] < 90;
    const estBlanc = (c) => c[0] > 225 && c[1] > 225 && c[2] > 225;
    const estTerre = (i) => dist(rgb(i), ocean) > 40;

    // couleur de graine : médiane ITÉRÉE hors rouge/blanc/océan — médiane du
    // disque, puis médiane des seuls pixels proches d'elle (vire halo de
    // pastille et étiquettes sans dépendre d'une quantification fragile).
    // Le CENTRE (r≤6) prime quand il est franc : un marqueur posé par
    // l'auteur sur son aplat est la meilleure vérité, même dans une poche
    // (cas Elarian, dont l'entour capte la forêt voisine).
    function medianeIteree(px, py, r1) {
      const pix = [];
      for (let dy = -r1; dy <= r1; dy++) for (let dx = -r1; dx <= r1; dx++) {
        if (dx * dx + dy * dy > r1 * r1) continue;
        const c = rgb((py + dy) * S + (px + dx));
        if (estRouge(c) || estBlanc(c) || dist(c, ocean) <= 40) continue;
        pix.push(c);
      }
      if (!pix.length) return null;
      let med = [0, 1, 2].map((k) => pix.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(pix.length / 2)]);
      const proches = pix.filter((c) => dist(c, med) <= 40);
      if (proches.length >= 8) med = [0, 1, 2].map((k) => proches.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(proches.length / 2)]);
      const dedans = pix.filter((c) => dist(c, med) <= TOL).length;
      return { couleur: med, homog: dedans / pix.length, n: pix.length };
    }
    function echantillonner(wx, wy) {
      const px = Math.round(SCL * wx + TX), py = Math.round(SCL * wy + TY);
      if (px < 21 || py < 21 || px >= S - 21 || py >= S - 21) return null;
      const centre = medianeIteree(px, py, 6);
      if (centre && centre.n >= 25 && centre.homog >= 0.7) return { px, py, ...centre };
      const disque = medianeIteree(px, py, 20);
      if (!disque || disque.n < 30) return null;
      return { px, py, ...disque };
    }
    // Vote pondéré entre candidats : la couleur portée par le plus de
    // candidats (capitale/marqueur ×2, villes ×1) est celle de la nation —
    // un candidat isolé sur une étiquette ou un terrain ne peut plus mentir.
    const graines = [];
    for (const n of nations) {
      const echs = [];
      for (const cand of n.candidats) {
        const e = echantillonner(cand.wx, cand.wy);
        if (e) echs.push({ ...e, src: cand.src, poids: (cand.src === 'capitale' || cand.src === 'marqueur') ? 2 : 1, rang: echs.length });
      }
      if (!echs.length) continue;
      let meilleur = null;
      for (const e of echs) {
        const groupe = echs.filter((o) => dist(o.couleur, e.couleur) <= TOL);
        const score = groupe.reduce((s, o) => s + o.poids, 0);
        if (!meilleur || score > meilleur.score) meilleur = { score, porteur: groupe[0] };
      }
      const g = meilleur.porteur;
      graines.push({ ...n, px: g.px, py: g.py, couleur: g.couleur, srcGraine: g.src });
    }

    // assignation : la graine la plus proche EN COULEUR d'abord — la distance
    // géographique ne départage que les quasi-ex-æquo (≤ 6 de la meilleure).
    // Sans cette priorité, deux familles de teintes voisines (ex. 121,116,97
    // et 119,135,113, distantes de 25 pour TOL 26) se volent des pixels à
    // travers toute la carte et découpent des bissectrices rectilignes.
    const label = new Int16Array(S * S).fill(-1);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        if (!estTerre(i)) { label[i] = -2; continue; }     // océan
        const c = rgb(i);
        if (estRouge(c) || estBlanc(c)) continue;           // points/étiquettes → dilatation
        let dcMin = 1e9;
        for (let g = 0; g < graines.length; g++) {
          const dc = dist(c, graines[g].couleur);
          if (dc < dcMin) dcMin = dc;
        }
        if (dcMin > TOL) continue;
        let best = -1, dBest = 1e15;
        for (let g = 0; g < graines.length; g++) {
          if (dist(c, graines[g].couleur) > dcMin + 6) continue;
          const dd = (x - graines[g].px) ** 2 + (y - graines[g].py) ** 2;
          if (dd < dBest) { dBest = dd; best = g; }
        }
        if (best >= 0) label[i] = best;
      }
    }
    // dilatations : combler frontières/rivières/étiquettes
    for (let pass = 0; pass < DILAT; pass++) {
      const copie = label.slice();
      for (let y = 1; y < S - 1; y++) {
        for (let x = 1; x < S - 1; x++) {
          const i = y * S + x;
          if (copie[i] !== -1) continue;
          const v = [copie[i - 1], copie[i + 1], copie[i - S], copie[i + S]].filter((l) => l >= 0);
          if (v.length) label[i] = v[0];
        }
      }
    }
    // composante connexe contenant la graine, par nation
    const masques = [];
    for (let g = 0; g < graines.length; g++) {
      let seedI = graines[g].py * S + graines[g].px;
      // sauvetage : la graine peut tomber pile sur une rivière, une pastille
      // ou une étiquette comblée par un voisin — on rejoint alors le pixel de
      // SA couleur le plus proche (spirale, rayon 60).
      if (label[seedI] !== g) {
        let trouve = -1;
        for (let r = 1; r <= 60 && trouve < 0; r++) {
          for (let dy = -r; dy <= r && trouve < 0; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = graines[g].px + dx, y = graines[g].py + dy;
            if (x < 0 || y < 0 || x >= S || y >= S) continue;
            if (label[y * S + x] === g) { trouve = y * S + x; break; }
          }
        }
        if (trouve >= 0) seedI = trouve;
      }
      if (label[seedI] !== g) { masques.push(null); continue; }
      const dans = new Uint8Array(S * S);
      const pile = [seedI]; dans[seedI] = 1;
      let aire = 0;
      while (pile.length) {
        const i = pile.pop(); aire++;
        const x = i % S;
        for (const j of [i - 1, i + 1, i - S, i + S]) {
          if (j < 0 || j >= S * S || dans[j] || label[j] !== g) continue;
          const jx = j % S; if (Math.abs(jx - x) > 1) continue;
          dans[j] = 1; pile.push(j);
        }
      }
      masques.push({ dans, aire });
    }
    // contour Moore sur chaque masque
    function contour(dans) {
      // point de départ : pixel le plus haut-gauche
      let start = -1;
      for (let i = 0; i < S * S; i++) if (dans[i]) { start = i; break; }
      if (start < 0) return [];
      const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const D = (x, y) => (x < 0 || y < 0 || x >= S || y >= S) ? 0 : dans[y * S + x];
      let x = start % S, y = (start / S) | 0, dir = 6;
      const pts = []; let n = 0;
      const x0 = x, y0 = y;
      do {
        pts.push([x, y]);
        let trouve = false;
        for (let k = 0; k < 8; k++) {
          const dd = (dir + 6 + k) % 8;
          const nx = x + DIRS[dd][0], ny = y + DIRS[dd][1];
          if (D(nx, ny)) { x = nx; y = ny; dir = dd; trouve = true; break; }
        }
        if (!trouve || ++n > 200000) break;
      } while (x !== x0 || y !== y0);
      return pts;
    }
    return graines.map((g, i) => ({
      id: g.id, nom: g.nom, viaCap: g.viaCap, srcGraine: g.srcGraine, couleur: g.couleur,
      aire: masques[i] ? masques[i].aire : 0,
      contour: masques[i] ? contour(masques[i].dans) : [],
    }));
  }, { b64, nations, S, SCL, TX, TY, TOL, DILAT });
  await browser.close();

  // simplification + monde
  function simplifier(pts, eps) {
    if (pts.length < 4) return pts;
    const garder = new Uint8Array(pts.length);
    garder[0] = garder[pts.length - 1] = 1;
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

  // plancher à 1 200 px (~170 unités²) : en dessous, c'est un éclat
  // d'étiquette ou de texture, pas un territoire — les vraies petites îles
  // passent par le repli « côte d'île » ci-dessous.
  const masses = res
    .filter((r) => r.contour.length > 20 && r.aire > 1200)
    .map((r) => ({
      nom: r.nom, niveau: 'pays', aire: r.aire,
      points: simplifier(r.contour, 1.6).map(enMonde),
    }))
    .filter((m) => m.points.length >= 5);

  const OUT = path.join(ROOT, 'data', 'monde-contours.json');
  const doc = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const jeu = doc.jeux.find((j) => j.era_id === null);

  // Repli « côte d'île » : une nation sans aplat sur la carte Pays (île non
  // colorée, ex. Baelor-Prime) dont un candidat de graine tombe dans une
  // petite masse côtière SANS NOM reprend cette côte comme surface.
  const dedans = (pt, poly) => {
    let ok = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, ya] = poly[a], [xb, yb] = poly[b];
      if ((ya > pt[1]) !== (yb > pt[1]) && pt[0] < (xb - xa) * (pt[1] - ya) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  };
  const petitesIles = jeu.masses.filter((m) => m.niveau === 'continent' && !m.nom && m.aire <= 3000);
  const extraites = new Set(masses.map((m) => m.nom));
  const prises = new Set();
  for (const n of nations) {
    if (extraites.has(n.nom)) continue;
    let ile = null;
    for (const cand of n.candidats) {
      ile = petitesIles.find((m) => !prises.has(m) && dedans([cand.wx, cand.wy], m.points));
      if (ile) break;
    }
    if (!ile) continue;
    prises.add(ile);
    masses.push({ nom: n.nom, niveau: 'pays', aire: ile.aire, source: 'cote-ile', points: ile.points.map((p) => p.slice()) });
    console.log(`  île : ${n.nom} reprend la côte de son île (aire ${ile.aire})`);
  }

  jeu.masses = jeu.masses.filter((m) => m.niveau !== 'pays').concat(masses);
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n');

  console.log(`✔ ${masses.length} surfaces nationales extraites`);
  for (const m of masses.sort((a, b) => b.aire - a.aire).slice(0, 40)) console.log('  ', m.nom.padEnd(24), String(m.points.length).padStart(4), 'sommets');
  const dansMasses = new Set(masses.map((m) => m.nom));
  const rates = res.filter((r) => !dansMasses.has(r.nom)).map((r) => r.nom);
  if (rates.length) console.log('non extraites :', rates.join(', '));
})();
