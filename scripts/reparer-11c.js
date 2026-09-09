#!/usr/bin/env node
/**
 * Réparations structurelles du §11.c
 * (Docs/Lore/Incohérences et chantiers — à résoudre.md, passe 2026-09-09).
 *
 * Sept familles de réparations, chacune tracée (`data.reparation`, labels
 * absorbés conservés dans `data.fusion`) et justifiée par une source :
 * l'organisation des fiches Pays/<continent>/ fait autorité pour les
 * rattachements, la présence/absence dans les fiches pour les fusions.
 *
 *  A. Fusions d'entités en double (Dhalvoria, Feylor, Zarnith, Frosthal,
 *     Fédération de Morveth, Empire d'Evertia).
 *  B. Dédoublonnage des faits de règne/naissance/mort dupliqués par les
 *     deux passes d'import (labels absorbés, jamais perdus).
 *  C. Doubles rattachements continentaux (les fiches tranchent) + Windora.
 *  D. Les trois No Man's Land homogénéisés en entités politiques non-état.
 *  E. Les cinq capitales-seed situées et qualifiées (capitale ancienne).
 *  F. Les 13 règnes orphelins rattachés à leur royaume/tribu.
 *  G. Balisage des homonymies restantes (a-ne-pas-confondre-avec) et des
 *     doublons de facettes (lie-a « à fusionner au bake »).
 *
 * Idempotent : tout est gardé par des vérifications d'état ; une passe qui
 * ne trouve rien à faire n'écrit rien.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', 'kg-base.json');
const doc = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const ents = new Map(doc.entities.map((e) => [e.id, e]));
const facts = new Map(doc.facts.map((f) => [f.id, f]));
const rels = new Map(doc.relations.map((r) => [r.id, r]));
const NOW = '2026-09-09T00:00:00.000Z';
const REP = (n) => '§11.c-' + n + ' (2026-09-09)';
let ops = 0;
const fait = (m) => { ops++; console.log('✓ ' + m); };
const echec = (m) => { console.error('✗ ' + m + ' — rien n\'est écrit'); process.exit(1); };
const nomDe = (id) => (ents.get(id) || { name: id }).name;

let prochainLnk = Math.max(...doc.relations.map((r) => +r.id.slice(4))) + 1;
const nouvelleRel = (rel_type, from_id, to_id, label) => {
  const r = { id: 'lnk-' + String(prochainLnk++).padStart(4, '0'), rel_type, from_id, to_id,
    start_year: null, end_year: null, label: label || null, data: null, source_id: null, status: 'canon' };
  doc.relations.push(r); rels.set(r.id, r);
  return r;
};
const relExiste = (rel_type, a, b) => doc.relations.some((r) => r.rel_type === rel_type &&
  ((r.from_id === a && r.to_id === b) || (r.from_id === b && r.to_id === a)));

/* ═══ A. Fusions d'entités ═══ */
const entitesTouchees = new Set();

function fusionner(sourceId, cibleId, motif) {
  if (!ents.has(sourceId)) return false; // déjà fusionné
  const source = ents.get(sourceId), cible = ents.get(cibleId);
  if (!cible) echec('cible de fusion absente : ' + cibleId);
  // relations : re-brancher
  for (const r of doc.relations) {
    if (r.from_id === sourceId) r.from_id = cibleId;
    if (r.to_id === sourceId) r.to_id = cibleId;
  }
  // boucles sur soi puis doublons exacts (type + extrémités)
  const vues = new Set(); const aJeter = new Set();
  for (const r of doc.relations) {
    if (r.from_id === r.to_id) { aJeter.add(r.id); continue; }
    const k = r.rel_type + '|' + r.from_id + '|' + r.to_id;
    const kSym = r.rel_type + '|' + r.to_id + '|' + r.from_id;
    const sym = ['a-ne-pas-confondre-avec', 'frontiere-avec', 'allie-de', 'en-guerre-avec', 'fratrie-de', 'conjoint-de'].includes(r.rel_type);
    if (vues.has(k) || (sym && vues.has(kSym))) { aJeter.add(r.id); continue; }
    vues.add(k);
  }
  if (aJeter.size) doc.relations = doc.relations.filter((r) => !aJeter.has(r.id));
  for (const id of aJeter) rels.delete(id);
  // faits : re-sujets
  for (const f of doc.facts) {
    if (f.subject_id === sourceId) { f.subject_id = cibleId; f.updated_at = NOW; }
    if (f.object_id === sourceId) { f.object_id = cibleId; f.updated_at = NOW; }
  }
  // alias : re-brancher (sans doublonner)
  for (const a of doc.aliases) if (a.entity_id === sourceId) a.entity_id = cibleId;
  // résumé : ne jamais écraser, compléter si vide
  if (!cible.summary && source.summary) cible.summary = source.summary;
  cible.data = Object.assign({}, cible.data, { reparation: motif + ' — absorbe ' + sourceId + ' (' + source.name + ')' });
  cible.updated_at = NOW;
  doc.entities = doc.entities.filter((e) => e.id !== sourceId);
  ents.delete(sourceId);
  entitesTouchees.add(cibleId);
  fait(motif + ' : ' + source.name + ' (' + sourceId + ') fusionné dans ' + cible.name + ' (' + cibleId + '), ' + aJeter.size + ' relation(s) dédoublonnée(s)');
  return true;
}

fusionner('evt-0166', 'pol-0041', REP(1) + ' : la nation Dhalvoria vivait dans un événement');
fusionner('evt-0164', 'lie-0739', REP(1) + ' : le village de Feylor vivait dans un événement');
fusionner('evt-0163', 'lie-0746', REP(1) + ' : le village de Zarnith vivait dans un événement');
fusionner('evt-0165', 'lie-0767', REP(1) + ' : la forteresse de Frosthal vivait dans un événement');
if (ents.has('evt-0126')) { // coquille vide, aucun fait ni relation
  const nb = doc.relations.filter((r) => r.from_id === 'evt-0126' || r.to_id === 'evt-0126').length +
    doc.facts.filter((f) => f.subject_id === 'evt-0126' || f.object_id === 'evt-0126').length;
  if (nb > 0) echec('evt-0126 n\'est plus une coquille vide (' + nb + ' attaches)');
  doc.entities = doc.entities.filter((e) => e.id !== 'evt-0126');
  ents.delete('evt-0126');
  fait(REP(2) + ' : evt-0126 (double vide de la Fédération de Morveth pol-0081) supprimé');
}
if (ents.has('pol-0119')) {
  // avant la fusion : sortir Thalmaris/Sylvara de la nation (elles sont des
  // nations sœurs du continent lie-0008, cf. Pays/Evertia/), et re-brancher
  // la Fédération des Lisières sur le continent.
  doc.relations = doc.relations.filter((r) => !(r.rel_type === 'situe-dans' && r.to_id === 'pol-0116' && (r.from_id === 'pol-0031' || r.from_id === 'pol-0032')));
  const lisieres = doc.relations.find((r) => r.rel_type === 'situe-dans' && r.from_id === 'pol-0071' && r.to_id === 'pol-0116');
  if (lisieres) lisieres.to_id = 'lie-0008';
  fusionner('pol-0119', 'pol-0116', REP(7) + ' : Empire d\'Evertia = la nation Evertia (même capitale Caëspia, même Impératrice)');
  doc.aliases.push({ id: 'ali-0200', entity_id: 'pol-0116', value: 'Empire d\'Evertia', alias_status: 'variante', era_id: null, from_year: null, to_year: null, meaning: 'nom impérial de la nation Evertia' });
  fait(REP(7) + ' : Thalmaris et Sylvara sorties de la nation Evertia (nations sœurs du continent) ; alias « Empire d\'Evertia » posé');
}

/* ═══ B. Dédoublonnage des faits (règne, naissance, mort) ═══ */
// La fuite de l'apprenti de Tessar est un événement, pas une 4e attestation de mort.
{
  const f = facts.get('fac-0943');
  if (f && f.fact_type === 'mort') {
    f.data = Object.assign({}, f.data, { reparation: REP(3) + ' : la fuite de l\'apprenti est un événement, pas une attestation de mort', avant_type: 'mort' });
    f.fact_type = 'evenement'; f.updated_at = NOW;
    fait('fac-0943 : mort → evenement (fuite de l\'apprenti de Tessar)');
  }
}
{
  const groupes = new Map();
  for (const f of doc.facts) {
    if (!['regne', 'naissance', 'mort'].includes(f.fact_type) || !f.subject_id) continue;
    const k = f.subject_id + '|' + f.fact_type;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(f);
  }
  const finCompatible = (a, b) => a === b || (a == null && b === 10200) || (a === 10200 && b == null) || a == null || b == null;
  const objCompatible = (a, b) => a === b || a == null || b == null;
  const aSupprimer = new Set();
  let fusions = 0;
  for (const [, fs] of groupes) {
    if (fs.length < 2) continue;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (aSupprimer.has(a.id)) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (aSupprimer.has(b.id)) continue;
        if (a.start_year !== b.start_year) continue;
        if (!finCompatible(a.end_year, b.end_year) || !objCompatible(a.object_id, b.object_id)) continue;
        // gardien : celui qui a un object_id, sinon le libellé le plus riche
        let garde = a, jete = b;
        if (!a.object_id && b.object_id) { garde = b; jete = a; }
        else if ((a.label || '').length < (b.label || '').length) { garde = b; jete = a; }
        garde.object_id = garde.object_id || jete.object_id;
        // fin de règne : la convention dominante est la fin ouverte pour un
        // règne en cours ; une fin datée ≠ 10200 est de l'information.
        if (garde.end_year !== jete.end_year) {
          const dates = [garde.end_year, jete.end_year];
          garde.end_year = dates.includes(10200) && dates.includes(null) ? null
            : (garde.end_year != null ? garde.end_year : jete.end_year);
          if (garde.end_year == null) { garde.end_precision = null; garde.end_circa = 0; }
        }
        const fusion = (garde.data && garde.data.fusion) || [];
        fusion.push({ id: jete.id, label: jete.label });
        garde.data = Object.assign({}, garde.data, { fusion, reparation: REP(3) });
        garde.updated_at = NOW;
        aSupprimer.add(jete.id);
        entitesTouchees.add(garde.subject_id);
        fusions++;
      }
    }
  }
  if (aSupprimer.size) {
    doc.facts = doc.facts.filter((f) => !aSupprimer.has(f.id));
    for (const id of aSupprimer) facts.delete(id);
    fait(REP(3) + ' : ' + fusions + ' faits en double fusionnés (règnes/naissances/morts, libellés absorbés dans data.fusion)');
  }
}

/* ═══ C. Doubles rattachements continentaux — les fiches Pays/ tranchent ═══ */
const RATTACHEMENTS_FAUX = [
  ['pol-0007', 'lie-0009', 'Tyndara est d\'Onara (Pays/Onara/Tyndara.md)'],
  ['pol-0017', 'lie-0010', 'Haldria est d\'Endora (Pays/Endora/Haldria.md)'],
  ['pol-0022', 'lie-0004', 'Caeloria est d\'Azoria (Pays/Azoria/Caeloria.md)'],
  ['pol-0033', 'lie-0011', 'Vytharia est d\'Ilthara (Pays/Ilthara/Vytharia.md) ; l\'île de Nysaria est de Celethor'],
  ['pol-0034', 'lie-0011', 'Lunasar est d\'Ilthara (Pays/Ilthara/Lunasar.md)'],
  ['pol-0035', 'lie-0011', 'Mirathi est d\'Ilthara (Pays/Ilthara/Mirathi.md)'],
  ['pol-0040', 'lie-0013', 'Torkam est d\'Alkaran (Pays/Alkaran/Torkam.md, canon « Torkam → Alkaran »)'],
  ['lie-0053', 'lie-0348', 'le Temple des Flammes Éternelles est sur Ilnara ; Pyracine est un hameau attaché au Temple, pas son contenant'],
  ['lie-0053', 'lie-0273', 'Lorenthia est le village du Temple, pas son contenant'],
  ['lie-0053', 'lie-0615', 'aucune fiche ne met de Temple des Flammes à Haliandris (Myrtam) — erreur d\'extraction'],
  ['lie-0354', 'pol-0031', 'Windora est une région d\'Astravia (arbitrage du 2026-07-18) — reliquat non purgé'],
];
{
  let n = 0;
  doc.relations = doc.relations.filter((r) => {
    if (r.rel_type !== 'situe-dans') return true;
    const faux = RATTACHEMENTS_FAUX.find(([a, b]) => r.from_id === a && r.to_id === b);
    if (!faux) return true;
    n++; rels.delete(r.id);
    console.log('   − ' + r.id + ' ' + nomDe(faux[0]) + ' → ' + nomDe(faux[1]) + ' (' + faux[2] + ')');
    return false;
  });
  if (n) fait(REP(4) + ' : ' + n + ' rattachements situe-dans contradictoires supprimés');
}
for (const id of ['pol-0033', 'pol-0034', 'pol-0035']) {
  const e = ents.get(id);
  if (e.data && e.data.continent === 'Nysaria') {
    e.data.continent = 'Ilthara';
    e.data.reparation = REP(4) + ' : continent Nysaria → Ilthara (fiches Pays/Ilthara/)';
    e.updated_at = NOW;
    fait(id + ' (' + e.name + ') : data.continent Nysaria → Ilthara');
  }
}
{
  const w = ents.get('lie-0354'); // Windora
  if (w && /Thalmaris/.test(w.summary || '')) {
    w.summary = 'Région venteuse d\'Astravia, aux formations rocheuses qui chantent avec le vent, à l\'origine d\'une tradition musicale et instrumentale.';
    w.data = Object.assign({}, w.data, { reparation: REP(5) + ' : arbitrage Windora → Astravia (2026-07-18) appliqué jusqu\'au résumé' });
    w.updated_at = NOW;
    fait(REP(5) + ' : résumé de Windora aligné sur l\'arbitrage (Astravia)');
  }
}

/* ═══ D. No Man's Land : trois entités, un seul typage ═══ */
for (const id of ['lie-0242', 'lie-0298']) {
  const e = ents.get(id);
  if (e && e.type === 'lieu') {
    e.type = 'entite-politique';
    e.data = Object.assign({}, e.data, { genre: 'non-etat', reparation: REP(6) + ' : le canon compte les No Man\'s Land parmi les 47 nations — aligné sur pol-0109' });
    e.updated_at = NOW;
    fait(REP(6) + ' : ' + e.name + ' (' + id + ') retypé entite-politique (genre non-etat)');
  }
}

/* ═══ E. Capitales-seed : les situer, qualifier les anciennes ═══ */
const CAPITALES = [
  ['lie-0014', 'pol-0001'], ['lie-0015', 'pol-0010'], ['lie-0016', 'pol-0021'],
  ['lie-0017', 'pol-0025'], ['lie-0018', 'pol-0031'],
];
for (const [ville, pays] of CAPITALES) {
  if (!relExiste('situe-dans', ville, pays) && !doc.relations.some((r) => r.rel_type === 'situe-dans' && r.from_id === ville)) {
    nouvelleRel('situe-dans', ville, pays);
    fait(REP(8) + ' : ' + nomDe(ville) + ' située dans ' + nomDe(pays));
  }
}
const ANCIENNES = [
  ['lnk-0003', 'capitale ancienne', null],                    // Lithanel (Altram a Trelios)
  ['lnk-0041', 'capitale ancienne, engloutie An 0', 0],       // Navoria (Mosrack a Folgrad)
  ['lnk-0050', 'capitale ancienne', null],                    // Everthor-Prime (Thalmaris a Ostarith)
];
for (const [id, label, fin] of ANCIENNES) {
  const r = rels.get(id);
  if (r && r.rel_type === 'capitale-de' && !r.label) {
    r.label = label;
    if (fin != null) r.end_year = fin;
    fait(REP(8) + ' : ' + id + ' (' + nomDe(r.from_id) + ') qualifiée « ' + label + ' »');
  }
}

/* ═══ F. Règnes orphelins : rattacher au royaume, à la tribu, au lieu ═══ */
const OBJETS = [
  ['fac-0152', 'lig-0070'], // Mirathi Voix-d'Ambre → tribu Jentar
  ['fac-0153', 'lig-0071'], // Myrind → tribu Folinor
  ['fac-0182', 'lie-0889'], ['fac-0564', 'lie-0889'], ['fac-0562', 'lie-0889'], // Krenneth ×2 → Kryostra
  ['fac-0567', 'lie-0770'], ['fac-0568', 'lie-0770'], // Rann, Vyssa → Glacoria
  ['fac-0569', 'lie-0741'], ['fac-0570', 'lie-0741'], // Brennar, Myrael → Thyldor
  ['fac-0572', 'lie-0732'], // Vorastes → Galdryn
  ['fac-0573', 'lie-0765'], // Vael Vegnaurson → Mythralis
  ['fac-0583', 'lie-0759'], // La Tisseuse → Eridorn
];
for (const [fid, oid] of OBJETS) {
  const f = facts.get(fid);
  if (!f) continue; // absorbé par le dédoublonnage
  if (f.object_id === oid) continue;
  if (f.object_id) echec(fid + ' porte déjà un objet ' + f.object_id);
  if (!ents.has(oid)) echec('objet absent : ' + oid);
  f.object_id = oid; f.updated_at = NOW;
  f.data = Object.assign({}, f.data, { reparation: REP(10) + ' : règne rattaché à ' + nomDe(oid) });
  fait(fid + ' (' + nomDe(f.subject_id) + ') rattaché à ' + nomDe(oid));
}
{
  const f = facts.get('fac-1072'); // La Tyrannie des Cendres : un événement, pas un règne
  if (f && f.fact_type === 'regne') {
    f.fact_type = 'evenement';
    f.object_id = f.object_id || 'pol-0058';
    f.data = Object.assign({}, f.data, { reparation: REP(10) + ' : un événement de Drahk\'Nor, pas un règne', avant_type: 'regne' });
    f.updated_at = NOW;
    fait('fac-1072 (La Tyrannie des Cendres) : regne → evenement, rattaché à Drahk\'Nor');
  }
}

/* ═══ G. Balisage des homonymies restantes ═══ */
// doublons de facettes (même référent sous deux types) → lie-a « à fusionner »
const FACETTES = [
  ['con-0031', 'ter-0144', 'doublon probable (Vael\'Ur) — à fusionner au bake'],
  ['obj-0012', 'con-0147', 'doublon probable (Le Cœur de Cendra) — à fusionner au bake'],
  ['ter-0048', 'con-0128', 'doublon probable (Les Chamanes des Brumes) — à fusionner au bake'],
  ['rel-0018', 'ter-0139', 'doublon probable (Les Verithani) — à fusionner au bake'],
  ['ter-0128', 'con-0150', 'doublon probable (l\'Étranger des Heures) — à fusionner au bake'],
  ['con-0151', 'obj-0069', 'doublon probable (Le Fragment #3) — à fusionner au bake'],
  ['con-0014', 'evt-0015', 'le concept et l\'événement — deux facettes voulues de l\'Arrachement'],
  ['evt-0001', 'con-0141', 'l\'événement et le concept — deux facettes voulues de la Résonance'],
];
for (const [a, b, label] of FACETTES) {
  if (!ents.has(a) || !ents.has(b)) continue;
  if (relExiste('lie-a', a, b)) continue;
  nouvelleRel('lie-a', a, b, label);
  fait(REP(9) + ' : lie-a « ' + label.slice(0, 50) + '… »');
}
// homonymies vraies (référents distincts) → a-ne-pas-confondre-avec
{
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘]/g, '\'').replace(/\s+/g, ' ').trim();
  const parNom = new Map();
  for (const e of doc.entities) {
    const k = strip(e.name);
    if (!parNom.has(k)) parNom.set(k, []);
    parNom.get(k).push(e);
  }
  let n = 0;
  for (const [, liste] of parNom) {
    if (liste.length < 2) continue;
    if (new Set(liste.map((e) => e.type)).size < 2) continue;
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i].id, b = liste[j].id;
      if (relExiste('a-ne-pas-confondre-avec', a, b) || relExiste('lie-a', a, b)) continue;
      nouvelleRel('a-ne-pas-confondre-avec', a, b);
      console.log('   + a-ne-pas-confondre-avec : ' + liste[i].name + ' [' + liste[i].type + '] ↔ ' + liste[j].name + ' [' + liste[j].type + ']');
      n++;
    }
  }
  if (n) fait(REP(9) + ' : ' + n + ' homonymies balisées a-ne-pas-confondre-avec');
}

/* ═══ Périodes dérivées des entités touchées (règle du pipeline) ═══ */
for (const id of ['pol-0041', 'lie-0739', 'lie-0746', 'lie-0767', 'pol-0116', ...entitesTouchees]) {
  const e = ents.get(id);
  if (!e) continue;
  let debut = Infinity, fin = -Infinity;
  for (const f of doc.facts) {
    if (f.start_year == null) continue;
    if (f.subject_id !== id && f.object_id !== id) continue;
    debut = Math.min(debut, f.start_year);
    fin = Math.max(fin, f.end_year != null ? f.end_year : f.start_year);
  }
  if (!Number.isFinite(debut)) continue;
  const p = e.data && e.data.periode;
  if (p && p.methode !== 'fait-date') continue;
  if (p && p.debut === debut && p.fin === fin) continue;
  e.data = Object.assign({}, e.data, { periode: { debut, fin, confiance: 'haute', methode: 'fait-date' } });
  e.updated_at = NOW;
  console.log('  ↻ période de ' + e.name + ' (' + id + ') : ' + (p ? p.debut + '→' + p.fin : '∅') + ' ⇒ ' + debut + '→' + fin);
}

/* ═══ écriture ═══ */
if (ops === 0) {
  console.log('Rien à faire : les réparations du §11.c sont déjà appliquées.');
} else {
  fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');
  console.log('\n' + ops + ' réparation(s) — data/kg-base.json réécrit : ' +
    doc.entities.length + ' entités, ' + doc.facts.length + ' faits, ' +
    doc.relations.length + ' relations, ' + doc.aliases.length + ' alias.');
}
