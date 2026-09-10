#!/usr/bin/env node
'use strict';
/*
 * scripts/bake-overlay.js — Verse (« bake ») l'overlay d'édition dans la base
 * committée data/kg-base.json, avec la SÉMANTIQUE EXACTE du site :
 * kg-core.mergeGraph (l'overlay écrase la base par id, les tombstones
 * suppriment), puis réécrit la base. L'overlay redevient vide de sens une
 * fois versé — le purger est une étape séparée et explicite (--purge).
 *
 * Sources d'overlay, par ordre d'essai :
 *   --dump <fichier.json>   un export JSON (voir formats ci-dessous)
 *   TURSO_URL + TURSO_AUTH_TOKEN   l'overlay de production (tables
 *                           kg_overlay / kg_deletes, via l'API HTTP libSQL)
 *   local-kg-overlay.json   l'overlay fichier du dev local, s'il existe
 *
 * Formats de dump acceptés (détection automatique) :
 *   1. { entities:[…], facts:[…], relations:[…], aliases:[…], readings:[…],
 *        deletes:{ kind:[ids] } }                — la forme de load()
 *   2. { records:{ kind:{ id:record } }, deletes:{ kind:[ids] } }
 *                                               — la forme du fichier local
 *   3. { kg_overlay:[{kind,id,json}], kg_deletes:[{kind,id}] }
 *      ou simplement [ {kind,id,json}, … ]      — l'export brut des tables
 *      (ex. `SELECT kind,id,json FROM kg_overlay` en JSON)
 *
 * Usage :
 *   node scripts/bake-overlay.js --dry-run              # rapport, zéro écriture
 *   node scripts/bake-overlay.js                        # bake réel
 *   node scripts/bake-overlay.js --dump export.json     # bake depuis un export
 *   node scripts/bake-overlay.js --purge                # bake PUIS vide les
 *                                                       # tables Turso (exige la
 *                                                       # source Turso)
 *   [--base <fichier>] cible une autre base (tests).
 *
 * Après un bake réel : la base SQLite et l'index de recherche sont régénérés
 * automatiquement (kg:db + kg:index) ; committer data/kg-base.json,
 * data/kg-search-index.json et data/bakes/.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const kg = require(path.join(ROOT, 'lib', 'kg-core.js'));
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? (process.argv[i + 1] || true) : null; };
const DRY = process.argv.includes('--dry-run');
const PURGE = process.argv.includes('--purge');
const BASE = arg('base') || path.join(ROOT, 'data', 'kg-base.json');
const DUMP = arg('dump');
const STORES = kg.STORES; // entities, facts, relations, aliases, readings

/* ── 1. charger l'overlay ── */
function normaliserDump(brut) {
  const overlay = { entities: [], facts: [], relations: [], aliases: [], readings: [], deletes: {} };
  const lignes = Array.isArray(brut) ? brut : null;
  if (lignes || (brut.kg_overlay && Array.isArray(brut.kg_overlay))) {
    // format 3 : lignes brutes des tables
    for (const r of (lignes || brut.kg_overlay)) {
      const rec = typeof r.json === 'string' ? JSON.parse(r.json) : r.json;
      (overlay[r.kind] = overlay[r.kind] || []).push(rec);
    }
    for (const d of (brut.kg_deletes || [])) (overlay.deletes[d.kind] = overlay.deletes[d.kind] || []).push(d.id);
    return overlay;
  }
  if (brut.records) {
    // format 2 : fichier overlay local
    for (const kind of Object.keys(brut.records)) overlay[kind] = Object.values(brut.records[kind]);
    overlay.deletes = brut.deletes || {};
    return overlay;
  }
  // format 1 : la forme de load()
  for (const s of STORES) overlay[s] = brut[s] || [];
  overlay.deletes = brut.deletes || {};
  return overlay;
}

async function chargerOverlay() {
  if (DUMP) {
    console.log('source : dump ' + DUMP);
    return { overlay: normaliserDump(JSON.parse(fs.readFileSync(DUMP, 'utf8'))), source: 'dump' };
  }
  if (process.env.TURSO_URL && process.env.TURSO_AUTH_TOKEN) {
    console.log('source : Turso (' + process.env.TURSO_URL.replace(/\/\/([^.]+)\..*/, '//$1.…') + ')');
    const { createTursoOverlay } = require(path.join(ROOT, 'lib', 'kg-overlay-turso.js'));
    return { overlay: await createTursoOverlay(process.env.TURSO_URL, process.env.TURSO_AUTH_TOKEN).load(), source: 'turso' };
  }
  const local = path.join(ROOT, 'local-kg-overlay.json');
  if (fs.existsSync(local)) {
    console.log('source : overlay local ' + local);
    return { overlay: normaliserDump(JSON.parse(fs.readFileSync(local, 'utf8'))), source: 'fichier' };
  }
  console.error(
    '✗ Aucune source d\'overlay.\n' +
    '  Soit : définir TURSO_URL et TURSO_AUTH_TOKEN (variables d\'environnement de\n' +
    '  l\'environnement Claude Code, + autoriser le domaine de la base dans la\n' +
    '  politique réseau) ;\n' +
    '  soit : fournir un export avec --dump (SELECT kind,id,json FROM kg_overlay\n' +
    '  et SELECT kind,id FROM kg_deletes, en JSON — cf. en-tête du script).');
  process.exit(2);
}

/* ── 2. bake ── */
(async () => {
  const { overlay, source } = await chargerOverlay();
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));

  // rapport : nouveaux / écrasés / supprimés, par magasin
  let total = 0, totalDel = 0;
  const details = [];
  for (const s of STORES) {
    const ids = new Set((base[s] || []).map((r) => r.id));
    const recs = overlay[s] || [];
    const nouveaux = recs.filter((r) => !ids.has(r.id));
    const ecrases = recs.filter((r) => ids.has(r.id));
    const dels = (overlay.deletes[s] || []).filter((id) => ids.has(id));
    total += recs.length; totalDel += dels.length;
    if (recs.length || dels.length) {
      console.log(s.padEnd(10) + ' : ' + nouveaux.length + ' nouveau(x), ' + ecrases.length + ' écrasé(s), ' + dels.length + ' supprimé(s)');
      for (const r of ecrases.slice(0, 15)) details.push('  ~ ' + s + '/' + r.id + ' (' + (r.name || r.label || '') + ')');
      for (const r of nouveaux.slice(0, 15)) details.push('  + ' + s + '/' + r.id + ' (' + (r.name || r.label || '') + ')');
      for (const id of dels.slice(0, 15)) details.push('  − ' + s + '/' + id);
    }
  }
  for (const l of details.slice(0, 45)) console.log(l);
  if (total === 0 && totalDel === 0) { console.log('Overlay vide — rien à baker.'); return; }
  console.log('total : ' + total + ' enregistrement(s), ' + totalDel + ' suppression(s)');

  if (DRY) { console.log('— dry-run : rien n\'est écrit.'); return; }

  // audit : conserver l'overlay versé, tel quel, daté — à côté de la base
  // ciblée (un test avec --base n'écrit donc rien dans data/).
  const jour = new Date().toISOString().slice(0, 10);
  const dossierBakes = path.join(path.dirname(path.resolve(BASE)), 'bakes');
  fs.mkdirSync(dossierBakes, { recursive: true });
  const audit = path.join(dossierBakes, 'overlay-' + jour + '.json');
  fs.writeFileSync(audit, JSON.stringify(overlay, null, 1) + '\n');

  // fusion — la sémantique exacte du site
  const fusionne = kg.mergeGraph(base, overlay);
  const doc = { _meta: Object.assign({}, base._meta, {
    lastBake: { date: new Date().toISOString(), source, records: total, deletes: totalDel, audit: path.relative(ROOT, audit) },
  }) };
  for (const s of STORES) doc[s] = fusionne[s];
  fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');
  console.log('✔ base réécrite : ' + STORES.map((s) => s + ':' + doc[s].length).join(' '));
  console.log('  audit : ' + path.relative(ROOT, audit));

  // régénérations (seulement sur la vraie base)
  if (path.resolve(BASE) === path.resolve(ROOT, 'data', 'kg-base.json')) {
    execSync('npm run kg:db && npm run kg:index', { cwd: ROOT, stdio: 'inherit' });
  }

  /* ── 3. purge (explicite, après un bake réussi) ── */
  if (PURGE) {
    if (source !== 'turso') {
      console.log('⚠ --purge ignoré : la purge n\'opère que sur la source Turso.');
      console.log('  Pour purger à la main : DELETE FROM kg_overlay; DELETE FROM kg_deletes;');
      return;
    }
    const { createTursoExec } = require(path.join(ROOT, 'lib', 'turso-adapter.js'));
    const exec = createTursoExec(process.env.TURSO_URL, process.env.TURSO_AUTH_TOKEN);
    await exec('DELETE FROM kg_overlay', []);
    await exec('DELETE FROM kg_deletes', []);
    console.log('✔ overlay Turso purgé (kg_overlay, kg_deletes) — la base committée fait foi seule.');
  } else if (source === 'turso') {
    console.log('ℹ overlay Turso laissé en place (inoffensif : mêmes ids, mêmes contenus).');
    console.log('  Relancer avec --purge pour le vider une fois le bake committé et déployé.');
  }
})().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
