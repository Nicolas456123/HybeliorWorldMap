#!/usr/bin/env node
/**
 * Correction des dix erreurs mécaniques de datation du §11.a
 * (Docs/Lore/Incohérences et chantiers — à résoudre.md, passe 2026-09-09).
 *
 * Chaque fait corrigé porte l'année que son PROPRE libellé énonce ; l'ancienne
 * valeur est conservée dans `data.correction` (auditable, réversible).
 * Le script est idempotent : un fait déjà corrigé est sauté ; un fait dont la
 * valeur courante n'est ni l'ancienne ni la nouvelle fait échouer la passe
 * (le graphe a bougé entre-temps → re-vérifier avant de forcer).
 *
 * Les périodes dérivées (`data.periode`, méthode `fait-date`) des entités
 * touchées sont recalculées avec la règle exacte du pipeline
 * (scripts/inferer-dates.js, passe 1) : min(start) / max(end ?? start) sur
 * les faits datés où l'entité est sujet ou objet.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', 'kg-base.json');
const doc = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const parId = new Map(doc.facts.map((f) => [f.id, f]));
const AUJOURDHUI = '2026-09-09T00:00:00.000Z';

// { id, avant: {start, end}, apres: {start, end, startPrec, startCirca, endPrec, endCirca}, motif }
const CORRECTIONS = [
  { id: 'fac-0931', avant: { start: 10201, end: null }, apres: { start: 9900, end: null, startPrec: 'estimation', startCirca: 1 },
    motif: '« trois siècles avant l\'an 252 » : l\'année de référence avait été prise pour l\'année de l\'événement (cf. fac-0195/fac-0542, ~9 900)' },
  { id: 'fac-0598', avant: { start: 10179, end: null }, apres: { start: 10070, end: 10086, startPrec: 'annee', startCirca: 0, endPrec: 'annee', endCirca: 0 },
    motif: 'la Schismature court Sillage 121-137 (cf. fac-0942/fac-0962) ; 10 179 ne correspond à rien dans le libellé' },
  { id: 'fac-0646', avant: { start: 9963, end: null }, apres: { start: 10137, end: null, startPrec: 'annee', startCirca: 0 },
    motif: '« départ consigné 14 du IIe mois 188 » : le jour du mois (14) avait été lu comme année Sillage ; l\'année est 188 (cf. fac-0974/fac-0987)' },
  { id: 'fac-0205', avant: { start: -700, end: null }, apres: { start: 9250, end: null, startPrec: 'estimation', startCirca: 1 },
    motif: '« ~7 siècles avant le Sillage » lu comme année absolue négative ; 9 949 − 700 ≈ 9 250 ap.A' },
  { id: 'fac-0276', avant: { start: 10121, end: 10138 }, apres: { start: 10142, end: null, startPrec: 'annee', startCirca: 0 },
    motif: 'la période inscrite était sa charge (+172-+189) ; le libellé dit « morte en +193 » = 10 142 (cf. fac-0191/fac-0550)' },
  { id: 'fac-0280', avant: { start: 10101, end: 10127 }, apres: { start: 10127, end: null, startPrec: 'annee', startCirca: 0 },
    motif: 'le début inscrit était sa prise de charge (+152) ; le libellé dit « morte en +178 » = 10 127' },
  { id: 'fac-0288', avant: { start: 10083, end: null }, apres: { start: 10058, end: null, startPrec: 'annee', startCirca: 0 },
    motif: '10 083 = Sillage 134, sa canonisation ; le libellé dit « morte en Sillage 109 » = 10 058 (cf. fac-0438)' },
  { id: 'fac-0565', avant: { start: 10146, end: null }, apres: { start: 10212, end: null, startPrec: 'annee', startCirca: 0 },
    motif: '10 146 = an 197, sa naissance ; le libellé dit « meurt en l\'an 263 » = 10 212' },
  { id: 'fac-0693', avant: { start: 10199, end: null }, apres: { start: 10169, end: 10199, startPrec: 'estimation', startCirca: 1, endPrec: 'annee', endCirca: 0 },
    motif: '10 199 = son abdication (« en 250 ») ; « environ trois décennies de règne » jusqu\'à l\'abdication → ~10 169-10 199 (cf. fac-0233)' },
  { id: 'fac-0953', avant: { start: 9952, end: null }, apres: { start: 10170, end: null, startPrec: 'estimation', startCirca: 1 },
    motif: '« déclin documenté depuis 30 ans » par rapport au présent (an 251) → ~an 221 = ~10 170 ; 9 952 (≈ Sillage 3) ne correspond à rien' },
];

let appliquees = 0, deja = 0;
const sujetsTouches = new Set();

for (const c of CORRECTIONS) {
  const f = parId.get(c.id);
  if (!f) { console.error(`✗ ${c.id} introuvable`); process.exit(1); }
  const dejaFait = f.start_year === c.apres.start && (f.end_year ?? null) === (c.apres.end ?? null);
  if (dejaFait) { deja++; sujetsTouches.add(f.subject_id); continue; }
  if (f.start_year !== c.avant.start || (f.end_year ?? null) !== (c.avant.end ?? null)) {
    console.error(`✗ ${c.id} : valeurs inattendues (${f.start_year}→${f.end_year}), le graphe a bougé — rien n'est écrit`);
    process.exit(1);
  }
  f.data = Object.assign({}, f.data, {
    correction: { date: '2026-09-09', motif: '§11.a', avant: { start_year: c.avant.start, end_year: c.avant.end } },
  });
  f.start_year = c.apres.start;
  f.start_precision = c.apres.startPrec;
  f.start_circa = c.apres.startCirca;
  f.end_year = c.apres.end ?? null;
  f.end_precision = c.apres.end != null ? c.apres.endPrec : null;
  f.end_circa = c.apres.end != null ? c.apres.endCirca : 0;
  f.updated_at = AUJOURDHUI;
  sujetsTouches.add(f.subject_id);
  appliquees++;
  console.log(`✓ ${c.id} : ${c.avant.start}${c.avant.end != null ? '→' + c.avant.end : ''} ⇒ ${c.apres.start}${c.apres.end != null ? '→' + c.apres.end : ''}`);
}

// ── périodes dérivées : même règle que inferer-dates.js (passe 1) ─────────
const parEntite = new Map(doc.entities.map((e) => [e.id, e]));
for (const id of sujetsTouches) {
  const e = parEntite.get(id);
  if (!e || !e.data || !e.data.periode || e.data.periode.methode !== 'fait-date') continue;
  let debut = Infinity, fin = -Infinity;
  for (const f of doc.facts) {
    if (f.start_year == null) continue;
    if (f.subject_id !== id && f.object_id !== id) continue;
    debut = Math.min(debut, f.start_year);
    fin = Math.max(fin, f.end_year != null ? f.end_year : f.start_year);
  }
  if (!Number.isFinite(debut)) continue;
  // Cas particulier : la naissance d'Ingrid Frelvar (« née vers an 197 » =
  // 10 146) n'existe que dans le libellé de fac-0565 — on la garde comme
  // début de période plutôt que de réduire sa vie à l'année de sa mort.
  if (id === 'per-0386') debut = Math.min(debut, 10146);
  const p = e.data.periode;
  if (p.debut !== debut || p.fin !== fin) {
    console.log(`  ↻ période de ${e.name} (${id}) : ${p.debut}→${p.fin} ⇒ ${debut}→${fin}`);
    p.debut = debut;
    p.fin = fin;
    e.updated_at = AUJOURDHUI;
  }
}

if (appliquees === 0 && deja === CORRECTIONS.length) {
  console.log('Rien à faire : les dix faits sont déjà corrigés.');
} else {
  fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n${appliquees} fait(s) corrigé(s), ${deja} déjà en place — data/kg-base.json réécrit.`);
}
