#!/usr/bin/env node
'use strict';
/*
 * scripts/sync-overrides-arbitrages.js — Synchronise les arbitrages de
 * position entre le graphe (data/kg-base.json) et la table Turso
 * `coordinate_overrides`, encore lue par la carte de l'accueil
 * (index.html → js/map.js → /api/overrides). Découvert lors du chantier
 * bake (2026-09-10) : l'overlay kg est vide, mais cette table héritée
 * divergeait du graphe sur nos arbitrages — et avait raison sur un cas.
 *
 * Vers TURSO (le graphe fait foi — arbitrages actés) :
 *   - No man's land Azoria / Cestra : marqueurs échangés (arbitrage §10) ;
 *   - Folgrad : capitale de Mosrack au marqueur (393, 91) (arbitrage 2026-07-18).
 * Vers le GRAPHE (Turso + fiches font foi) :
 *   - Mordock : la restauration de mai avait pris le MAUVAIS homonyme de la
 *     carte (−413.6, −100.8, sans fiche) ; le vrai Mordock est le village de
 *     forgerons de Mosrack (fiche Pays/Onara/Mosrack.md, région Mondack) à
 *     (330.7, 35.6) → coord corrigée, échelle bourg, rattaché à Mosrack ;
 *   - No man's land Celethor : reçoit son marqueur de la carte d'origine
 *     (−57.3, −369.2), qu'il n'avait jamais eu.
 * Les ~80 petits écarts uniformes (~5-7 unités, artefact d'import de mai)
 * sont laissés tels quels. Idempotent ; audit avant/après dans data/bakes/.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'data', 'kg-base.json');
const NOW = '2026-09-10T00:00:00.000Z';
const QUI = 'sync arbitrages carte, 2026-09-10';

(async () => {
  /* ── graphe ── */
  const doc = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const ents = new Map(doc.entities.map((e) => [e.id, e]));
  let changeGraphe = false;

  const mordock = ents.get('lie-0670');
  if (mordock && Math.abs(mordock.data.coord_x - 330.7) > 0.5) {
    mordock.data = Object.assign({}, mordock.data, {
      coord_x: 330.7, coord_y: 35.6, echelle: 'bourg',
      reparation: 'la restauration de mai avait pris le mauvais homonyme de la carte (−413.6, −100.8, sans fiche) ; le vrai Mordock est le village de Mosrack (' + QUI + ')',
      coord_avant: { coord_x: mordock.data.coord_x, coord_y: mordock.data.coord_y },
    });
    mordock.updated_at = NOW;
    if (!doc.relations.some((r) => r.rel_type === 'situe-dans' && r.from_id === 'lie-0670')) {
      const libre = 'lnk-' + String(Math.max(...doc.relations.map((r) => +r.id.slice(4))) + 1).padStart(4, '0');
      doc.relations.push({ id: libre, rel_type: 'situe-dans', from_id: 'lie-0670', to_id: 'pol-0025',
        start_year: null, end_year: null, label: null, data: null, source_id: null, status: 'canon' });
    }
    console.log('✓ graphe : Mordock (lie-0670) → (330.7, 35.6), échelle bourg, rattaché à Mosrack');
    changeGraphe = true;
  }

  const nmlCelethor = ents.get('lie-0242');
  if (nmlCelethor && nmlCelethor.data.coord_x == null) {
    nmlCelethor.data = Object.assign({}, nmlCelethor.data, {
      coord_x: -57.3, coord_y: -369.2,
      reparation: 'marqueur repris de la carte d\'origine (coordinate_overrides) — jamais importé (' + QUI + ')',
    });
    nmlCelethor.updated_at = NOW;
    console.log('✓ graphe : No Man\'s Land Celethor (lie-0242) reçoit son marqueur (−57.3, −369.2)');
    changeGraphe = true;
  }

  if (changeGraphe) fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');
  else console.log('graphe : déjà à jour');

  /* ── Turso ── */
  if (!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('⚠ Turso non configuré — la moitié Turso de la synchro n\'a pas tourné.');
    return;
  }
  const { createTursoExec } = require(path.join(ROOT, 'lib', 'turso-adapter.js'));
  const exec = createTursoExec(process.env.TURSO_URL, process.env.TURSO_AUTH_TOKEN);

  const CIBLES = [
    { name: "No man's land Azoria", storage: 'paysElements', x: 231.3, y: 384.1, motif: 'arbitrage §10 : marqueurs NML permutés, échangés' },
    { name: "No man's land Cestra", storage: 'paysElements', x: -472.7, y: -398.4, motif: 'arbitrage §10 : marqueurs NML permutés, échangés' },
    { name: 'Folgrad', storage: 'capitalesElements', x: 393, y: 91, motif: 'arbitrage 2026-07-18 : capitale de Mosrack, au marqueur' },
  ];
  const noms = CIBLES.map((c) => c.name);
  const avant = (await exec(
    `SELECT name, storage, coord_x, coord_y FROM coordinate_overrides WHERE name IN (${noms.map(() => '?').join(',')})`, noms)).rows;

  let changeTurso = false;
  for (const c of CIBLES) {
    const ligne = avant.find((r) => r.name === c.name && r.storage === c.storage);
    if (!ligne) { console.log('⚠ ligne absente de Turso : ' + c.name + ' [' + c.storage + '] — sautée'); continue; }
    if (Math.abs(ligne.coord_x - c.x) <= 0.5 && Math.abs(ligne.coord_y - c.y) <= 0.5) continue;
    await exec('UPDATE coordinate_overrides SET coord_x = ?, coord_y = ? WHERE name = ? AND storage = ?', [c.x, c.y, c.name, c.storage]);
    console.log('✓ turso : ' + c.name + ' [' + c.storage + '] (' + ligne.coord_x.toFixed(1) + ',' + ligne.coord_y.toFixed(1) + ') → (' + c.x + ',' + c.y + ') — ' + c.motif);
    changeTurso = true;
  }
  if (!changeTurso) console.log('turso : déjà à jour');
  else {
    const jour = new Date().toISOString().slice(0, 10);
    const dossier = path.join(ROOT, 'data', 'bakes');
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, 'coordinate-overrides-sync-' + jour + '.json'),
      JSON.stringify({ note: 'lignes avant la synchro des arbitrages vers coordinate_overrides', avant, appliquees: CIBLES }, null, 1) + '\n');
    console.log('  audit : data/bakes/coordinate-overrides-sync-' + jour + '.json');
  }
})().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
