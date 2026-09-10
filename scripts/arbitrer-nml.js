#!/usr/bin/env node
/**
 * Arbitrage des marqueurs No Man's Land permutés (registre §10, dossier
 * « §10 — carte » de l'interface d'arbitrage ; délégué à Claude par
 * l'auteur, session du 2026-09-10).
 *
 * Constat : sur la carte d'origine, le marqueur étiqueté « No Man's Land
 * Azoria » est posé en lisière sud du continent Cestra (−472.7, −398.4),
 * et le marqueur étiqueté « No Man's Land Cestra » au cœur du continent
 * Azoria (231, 384 — retrouvé par triangulation sur les distances de
 * geo-conflits, erreur < 1 unité), au milieu des treize villes que les
 * fiches rattachent au NML d'Azoria. Verdict : étiquettes permutées à la
 * pose — on échange les deux positions. Aucun re-rattachement : les lieux
 * des deux NML sont déjà du bon côté du monde.
 *
 * Applique l'échange (tracé dans data.arbitrage, anciennes valeurs
 * conservées) puis régénère data/geo-conflits.json avec la vérification
 * spatiale d'origine (ville rattachée+positionnée vs marqueurs de
 * polités : conflit si d_nation > 2.5 × d_meilleure et l'écart > 40).
 * Idempotent.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'data', 'kg-base.json');
const doc = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const ents = new Map(doc.entities.map((e) => [e.id, e]));
const NOW = '2026-09-10T00:00:00.000Z';
const QUI = 'délégation de l\'auteur, 2026-09-10';

const nmlAzoria = ents.get('pol-0109');
const nmlCestra = ents.get('lie-0298');
if (!nmlAzoria || !nmlCestra) { console.error('✗ entités NML introuvables'); process.exit(1); }

const POS_CESTRA = { x: -472.7, y: -398.4 };   // l'ancien marqueur « Azoria », en lisière de Cestra
const POS_AZORIA = { x: 231, y: 384 };          // l'ancien marqueur « Cestra », au cœur d'Azoria

let change = false;
if (Math.abs(nmlAzoria.data.coord_x - POS_AZORIA.x) > 0.5) {
  if (Math.abs(nmlAzoria.data.coord_x - POS_CESTRA.x) > 0.5) {
    console.error('✗ pol-0109 : coordonnées inattendues (' + nmlAzoria.data.coord_x + ') — rien n\'est écrit');
    process.exit(1);
  }
  nmlAzoria.data = Object.assign({}, nmlAzoria.data, {
    coord_x: POS_AZORIA.x, coord_y: POS_AZORIA.y,
    arbitrage: '§10 : marqueurs NML permutés sur la carte d\'origine — échangés (' + QUI + ')',
    marqueur_avant: { coord_x: POS_CESTRA.x, coord_y: POS_CESTRA.y },
  });
  nmlAzoria.updated_at = NOW;
  console.log('✓ No Man\'s Land Azoria : marqueur (−472.7, −398.4) → (231, 384), au cœur de ses treize villes');
  change = true;
}
if (nmlCestra.data.coord_x == null) {
  nmlCestra.data = Object.assign({}, nmlCestra.data, {
    coord_x: POS_CESTRA.x, coord_y: POS_CESTRA.y,
    arbitrage: '§10 : marqueur récupéré de l\'échange — il était étiqueté « Azoria » sur la carte d\'origine (' + QUI + ')',
  });
  nmlCestra.updated_at = NOW;
  console.log('✓ No Man\'s Land Cestra : reçoit le marqueur (−472.7, −398.4), en lisière sud de Cestra');
  change = true;
}

if (change) fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');

/* ── régénération de data/geo-conflits.json ── */
const ancres = doc.entities.filter((e) => e.type === 'entite-politique' && e.data && e.data.coord_x != null);
const parents = new Map();
for (const r of doc.relations) if (r.rel_type === 'situe-dans') {
  if (!parents.has(r.from_id)) parents.set(r.from_id, []);
  parents.get(r.from_id).push(r.to_id);
}
function nationDe(id) {
  const vus = new Set([id]);
  let front = parents.get(id) || [];
  for (let d = 0; d < 10 && front.length; d++) {
    const next = [];
    for (const p of front) {
      const e = ents.get(p);
      if (e && e.type === 'entite-politique') return p;
      if (!vus.has(p)) { vus.add(p); next.push(...(parents.get(p) || [])); }
    }
    front = next;
  }
  return null;
}
const conflits = [];
let verifiees = 0;
for (const e of doc.entities) {
  if (e.type !== 'lieu' || !e.data || e.data.coord_x == null) continue;
  if (!['ville', 'bourg', 'cite', 'lieu-dit'].includes(e.data.echelle)) continue;
  const natId = nationDe(e.id);
  if (!natId) continue;
  const nat = ents.get(natId);
  if (!nat.data || nat.data.coord_x == null) continue;
  verifiees++;
  const dNat = Math.hypot(e.data.coord_x - nat.data.coord_x, e.data.coord_y - nat.data.coord_y);
  let meilleure = null, dBest = Infinity;
  for (const a of ancres) {
    const d = Math.hypot(e.data.coord_x - a.data.coord_x, e.data.coord_y - a.data.coord_y);
    if (d < dBest) { dBest = d; meilleure = a; }
  }
  if (meilleure && meilleure.id !== natId && dNat > 2.5 * dBest && dNat - dBest > 40) {
    conflits.push({
      lieu_id: e.id, lieu: e.name, nation_fiche: nat.name,
      d_nation: Math.round(dNat), pose_pres_de: meilleure.name.toLowerCase(), d_reel: Math.round(dBest),
    });
  }
}
const OUT = path.join(ROOT, 'data', 'geo-conflits.json');
fs.writeFileSync(OUT, JSON.stringify({
  _note: 'Villes dont la position (carte de l\'auteur) contredit le rattachement (fiches). À arbitrer : corriger la position sur la carte OU le rattachement dans la fiche. Généré par scripts/arbitrer-nml.js (marqueurs NML échangés le 2026-09-10) — même vérification que fix-geo-conflits.js.',
  conflits,
}, null, 1) + '\n');
console.log('✓ geo-conflits.json régénéré : ' + verifiees + ' villes vérifiées, ' + conflits.length + ' conflit(s) restant(s)');
for (const c of conflits) console.log('   -', c.lieu, '(' + c.nation_fiche + ') posée près de', c.pose_pres_de, 'd=' + c.d_reel);
