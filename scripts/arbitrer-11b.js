#!/usr/bin/env node
/**
 * Application des douze arbitrages du §11.b
 * (Docs/Lore/Incohérences et chantiers — à résoudre.md, passe 2026-09-09).
 *
 * Les arbitrages ont été délégués à Claude par l'auteur (« tranche au plus
 * logique », session du 2026-09-09) ; ils sont enregistrés dans l'interface
 * d'arbitrage (artifact « Arbitrages d'Hybélior ») et récapitulés dans le
 * registre. Chaque application porte sa provenance :
 *  - date recalée   → `data.correction  = { date, motif, avant }`
 *  - fait retypé    → `data.arbitrage` (+ l'ancien type dans `avant_type`)
 *  - fait « fourchette » → `data.fourchette = true` + `data.arbitrage`
 *  - suppressions et créations listées ci-dessous et journalisées.
 * Idempotent : une opération déjà appliquée est sautée ; une valeur
 * inattendue (le graphe a bougé) fait échouer la passe sans rien écrire.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', 'kg-base.json');
const doc = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const facts = new Map(doc.facts.map((f) => [f.id, f]));
const rels = new Map(doc.relations.map((r) => [r.id, r]));
const ents = new Map(doc.entities.map((e) => [e.id, e]));
const NOW = '2026-09-09T00:00:00.000Z';
const QUI = 'délégation de l\'auteur, 2026-09-09';
let ops = 0;
const fait = (msg) => { ops++; console.log('✓ ' + msg); };
const echec = (msg) => { console.error('✗ ' + msg + ' — rien n\'est écrit'); process.exit(1); };

/* ── outils ── */
function recaler(id, attendu, nouveau, motif) {
  const f = facts.get(id);
  if (!f) echec(id + ' introuvable');
  if (f.start_year === nouveau) return; // déjà fait
  if (f.start_year !== attendu) echec(id + ' : start_year ' + f.start_year + ' ≠ attendu ' + attendu);
  f.data = Object.assign({}, f.data, {
    correction: { date: '2026-09-09', motif, avant: { start_year: f.start_year } },
  });
  f.start_year = nouveau;
  f.updated_at = NOW;
  fait(id + ' : ' + attendu + ' → ' + nouveau + ' (' + motif + ')');
}
function retyper(id, versType, motif) {
  const f = facts.get(id);
  if (!f) echec(id + ' introuvable');
  if (f.fact_type === versType) return;
  if (f.fact_type !== 'fondation') echec(id + ' : type ' + f.fact_type + ' ≠ fondation');
  f.data = Object.assign({}, f.data, { arbitrage: motif + ' (' + QUI + ')', avant_type: f.fact_type });
  f.fact_type = versType;
  f.updated_at = NOW;
  fait(id + ' : fondation → ' + versType + ' (' + motif + ')');
}

/* ── §11.b-1 · Tessar Veynd : né en Sillage 88, mort en 137 ──
 * Le récit précis (lieu, famille, âge à la mort) l'emporte sur « né vers
 * 75 », dérivé d'un âge estimé au sermon ; la fuite de l'apprenti « en
 * 138 » suit une mort fin 137. */
recaler('fac-0187', 10024, 10037, '§11.b-1 : naissance arbitrée en Sillage 88');
recaler('fac-0596', 10024, 10037, '§11.b-1 : naissance arbitrée en Sillage 88');
recaler('fac-0943', 10087, 10086, '§11.b-1 : mort arbitrée en Sillage 137, la fuite de l\'apprenti déborde sur 138');

/* ── §11.b-2 · Édit de Celestia : promulgué an −450 du Sillage (9 499) ──
 * Deux sources indépendantes convergent : le Premier Conclave « vers
 * 9 500 » (fiche religieuse) et le récit (an −450 = 9 499). */
recaler('fac-0299', 9350, 9499, '§11.b-2 : Édit arbitré au Premier Conclave (~an −450 du Sillage)');
recaler('fac-0399', 9350, 9499, '§11.b-2 : Édit arbitré au Premier Conclave (~an −450 du Sillage)');
recaler('fac-0205', 9250, 9499, '§11.b-2 : Édit arbitré au Premier Conclave (~an −450 du Sillage)');

/* ── §11.b-3 · Kyra : trois personnes, pas une ── */
if (!ents.has('per-0913')) {
  const p200 = ents.get('per-0200');
  if (p200.name === 'Kyra') { p200.name = 'Kyra (de Glintaris)'; p200.updated_at = NOW; }
  const gabarit = { slug: null, body: null, status: 'canon', disclosure: 'interne', created_at: NOW, updated_at: NOW };
  const kyraArdentris = Object.assign({
    id: 'per-0913', type: 'personne', name: 'Kyra (d\'Ardentris)',
    summary: 'Forgeronne à Ardentris, fille de la prêtresse Velya du cratère de Falnorath (Myrtam) ; morte à dix-neuf ans de la Maladie des Poumons — sa mère refusa la crémation volcanique et l\'enterra.',
    data: { periode: { debut: 10149, fin: 10200, confiance: 'haute', methode: 'fait-date' }, arbitrage: '§11.b-3 : scindée de per-0200 (' + QUI + ')' },
  }, gabarit);
  const kyraThalor = Object.assign({
    id: 'per-0914', type: 'personne', name: 'Kyra (de Thalor)',
    summary: 'Épouse d\'Aldren de Thalor et mère de leurs deux fils ; l\'eau de vérité de la cascade révéla à son mari ce que ses proches taisaient, avant qu\'il ne se réforme pour « mériter » la vérité.',
    data: { arbitrage: '§11.b-3 : scindée de per-0200 (' + QUI + ')' },
  }, gabarit);
  doc.entities.push(kyraArdentris, kyraThalor);
  ents.set('per-0913', kyraArdentris); ents.set('per-0914', kyraThalor);

  const f880 = facts.get('fac-0880');
  if (f880.subject_id !== 'per-0200') echec('fac-0880 : sujet inattendu ' + f880.subject_id);
  f880.subject_id = 'per-0913'; f880.updated_at = NOW;
  const l1753 = rels.get('lnk-1753'); // Velya parent-de Kyra
  if (l1753.to_id !== 'per-0200') echec('lnk-1753 : cible inattendue');
  l1753.to_id = 'per-0913';
  const l1834 = rels.get('lnk-1834'); // Kyra lie-a Maladie des Poumons
  if (l1834.from_id !== 'per-0200') echec('lnk-1834 : source inattendue');
  l1834.from_id = 'per-0913';
  const l1268 = rels.get('lnk-1268'); // Aldren (de Thalor) conjoint-de Kyra
  if (l1268.to_id !== 'per-0200') echec('lnk-1268 : cible inattendue');
  l1268.to_id = 'per-0914';

  const relGabarit = { start_year: null, end_year: null, label: null, data: null, source_id: null, status: 'canon' };
  doc.relations.push(
    Object.assign({ id: 'lnk-3270', rel_type: 'a-ne-pas-confondre-avec', from_id: 'per-0200', to_id: 'per-0913' }, relGabarit),
    Object.assign({ id: 'lnk-3271', rel_type: 'a-ne-pas-confondre-avec', from_id: 'per-0200', to_id: 'per-0914' }, relGabarit),
    Object.assign({ id: 'lnk-3272', rel_type: 'a-ne-pas-confondre-avec', from_id: 'per-0913', to_id: 'per-0914' }, relGabarit),
  );
  doc.aliases.push(
    { id: 'ali-0196', entity_id: 'per-0200', value: 'Kyra', alias_status: 'desambig', era_id: null, from_year: null, to_year: null, meaning: 'fille d\'Aldren Voss, Glintaris' },
    { id: 'ali-0197', entity_id: 'per-0913', value: 'Kyra', alias_status: 'desambig', era_id: null, from_year: null, to_year: null, meaning: 'forgeronne d\'Ardentris, fille de Velya' },
    { id: 'ali-0198', entity_id: 'per-0914', value: 'Kyra', alias_status: 'desambig', era_id: null, from_year: null, to_year: null, meaning: 'épouse d\'Aldren de Thalor' },
  );
  fait('§11.b-3 : Kyra scindée en trois (per-0200 Glintaris · per-0913 Ardentris · per-0914 Thalor), faits et liens répartis');
}

/* ── §11.b-4 · Civilisations antiques : les fiches font foi ──
 * Suppression des huit paires de faits-seed (sans libellé, table du
 * premier import) là où un fait libellé de même type existe. */
const SEEDS = ['fac-0047','fac-0048','fac-0049','fac-0050','fac-0051','fac-0052','fac-0053','fac-0054','fac-0055','fac-0056','fac-0069','fac-0070','fac-0071','fac-0072','fac-0073','fac-0074'];
const aSupprimer = new Set();
for (const id of SEEDS) {
  const f = facts.get(id);
  if (!f) continue; // déjà supprimé
  if (f.label) echec(id + ' porte un libellé — ce n\'est pas un seed');
  aSupprimer.add(id);
}
if (aSupprimer.size) {
  doc.facts = doc.facts.filter((f) => !aSupprimer.has(f.id));
  for (const id of aSupprimer) facts.delete(id);
  fait('§11.b-4 : ' + aSupprimer.size + ' faits-seed supprimés (les dates des fiches font foi)');
}

/* ── §11.b-5/6/7/9 · fondations doubles : le second récit devient un événement ── */
retyper('fac-0505', 'evenement', '§11.b-5 : peuplement ancien de Kethvar (Loi de Pierre) ; la fondation nationale reste ~9 700');
retyper('fac-0587', 'evenement', '§11.b-6 : émergence de Pyrevane, trait canon (« existe sans avoir été instituée ») ; la fondation politique reste ~9 800');
retyper('fac-0393', 'evenement', '§11.b-7 : érection de Mirathi en province de Vytharia ; la fondation est le Sanctuaire (~9 400)');
retyper('fac-0895', 'evenement', '§11.b-9 : réorganisation confédérale de Skaldoria (accord du Ralthyn) ; la fondation reste ~9 400');

/* ── §11.b-8 · Elarath 9 996, Solmaris 9 961 : le récit fondateur fait foi ── */
recaler('fac-0390', 9800, 9996, '§11.b-8 : « l\'an 47 » de la fragmentation de Morveth fait foi');
recaler('fac-0391', 9800, 9961, '§11.b-8 : la Première Veillée fait foi');

/* ── §11.b-10 · La Ligue des Marchands devient une institution propre ── */
if (!ents.has('pol-0124')) {
  const ligue = {
    id: 'pol-0124', type: 'entite-politique', name: 'Ligue des Marchands',
    slug: null,
    summary: 'Ligue marchande fondée par Selyra la Calculatrice, qui choisit Fablioris pour capitale (baie neutre contrôlée par l\'eau) ; institution tyndarienne.',
    body: null,
    data: { genre: 'ligue', periode: { debut: 9977, fin: null, confiance: 'haute', methode: 'fait-date' }, arbitrage: '§11.b-10 : détachée de Tyndara (' + QUI + ')' },
    status: 'canon', disclosure: 'interne', created_at: NOW, updated_at: NOW,
  };
  doc.entities.push(ligue); ents.set('pol-0124', ligue);
  const f1028 = facts.get('fac-1028');
  if (f1028.subject_id !== 'pol-0007') echec('fac-1028 : sujet inattendu ' + f1028.subject_id);
  f1028.subject_id = 'pol-0124'; f1028.updated_at = NOW;
  const relGabarit = { start_year: null, end_year: null, label: null, data: null, source_id: null, status: 'canon' };
  doc.relations.push(
    Object.assign({ id: 'lnk-3273', rel_type: 'fonde', from_id: 'per-0125', to_id: 'pol-0124' }, relGabarit),
    Object.assign({ id: 'lnk-3274', rel_type: 'situe-dans', from_id: 'pol-0124', to_id: 'pol-0007' }, relGabarit),
    Object.assign({ id: 'lnk-3275', rel_type: 'capitale-de', from_id: 'lie-0614', to_id: 'pol-0124' }, relGabarit),
  );
  fait('§11.b-10 : Ligue des Marchands créée (pol-0124), fac-1028 déplacé, Selyra/Fablioris reliées');
}

/* ── §11.b-11 · Deux Velmaris : la ville du soufre (Solmaris) et le
 * village de pêcheurs de perles du Lagosaim (Seraphia). ── */
if (!ents.has('lie-0969')) {
  const velmarisSeraphia = {
    id: 'lie-0969', type: 'lieu', name: 'Velmaris (Seraphia)',
    slug: null,
    summary: 'Village de pêcheurs de perles du Lagosaim (Seraphia), plongeant pour des perles nacrées d\'ornement religieux ; les tatouages fonctionnels des plongeurs codent zone, profondeur et qualité de chaque plongeon réussi.',
    body: null,
    data: { echelle: 'bourg', arbitrage: '§11.b-11 : homonyme détaché de la Velmaris de Solmaris (' + QUI + ')' },
    status: 'canon', disclosure: 'interne', created_at: NOW, updated_at: NOW,
  };
  doc.entities.push(velmarisSeraphia); ents.set('lie-0969', velmarisSeraphia);
  const l2586 = rels.get('lnk-2586');
  if (!l2586) echec('lnk-2586 introuvable');
  if (l2586.from_id !== 'lie-0214' || l2586.to_id !== 'pol-0006') echec('lnk-2586 : extrémités inattendues');
  l2586.from_id = 'lie-0969'; // le lien vers Seraphia appartient au village
  const relGabarit = { start_year: null, end_year: null, label: null, data: null, source_id: null, status: 'canon' };
  doc.relations.push(
    Object.assign({ id: 'lnk-3276', rel_type: 'situe-dans', from_id: 'lie-0969', to_id: 'lie-0394' }, relGabarit), // Lagosaim
    Object.assign({ id: 'lnk-3277', rel_type: 'a-ne-pas-confondre-avec', from_id: 'lie-0214', to_id: 'lie-0969' }, relGabarit),
  );
  doc.aliases.push(
    { id: 'ali-0199', entity_id: 'lie-0969', value: 'Velmaris', alias_status: 'desambig', era_id: null, from_year: null, to_year: null, meaning: 'village de pêcheurs de perles du Lagosaim (Seraphia)' },
  );
  fait('§11.b-11 : Velmaris (Seraphia) créée (lie-0969), lnk-2586 re-branché ; la ville du soufre reste à Solmaris');
}

/* ── §11.b-12 · Sept règnes multiséculaires : fenêtres d'incertitude ── */
for (const id of ['fac-0227','fac-0654','fac-0605','fac-0784','fac-0789','fac-0791','fac-0795','fac-0797']) {
  const f = facts.get(id);
  if (!f) echec(id + ' introuvable');
  if (f.data && f.data.fourchette) continue;
  f.data = Object.assign({}, f.data, {
    fourchette: true,
    arbitrage: '§11.b-12 : fenêtre d\'incertitude, pas une durée de règne (' + QUI + ')',
  });
  f.updated_at = NOW;
  fait(id + ' : marqué fourchette (' + (ents.get(f.subject_id) || {}).name + ')');
}

/* ── périodes dérivées : règle du pipeline (min/max des faits datés) ── */
const TOUCHES = ['per-0094','evt-0098','per-0200','pol-0045','pol-0046','pol-0047','pol-0048','pol-0049','pol-0056','pol-0057','pol-0058','pol-0027','pol-0030','pol-0007'];
for (const id of TOUCHES) {
  const e = ents.get(id);
  if (!e || !e.data || !e.data.periode || e.data.periode.methode !== 'fait-date') continue;
  let debut = Infinity, fin = -Infinity;
  for (const f of doc.facts) {
    if (f.start_year == null) continue;
    if (f.subject_id !== id && f.object_id !== id) continue;
    debut = Math.min(debut, f.start_year);
    fin = Math.max(fin, f.end_year != null ? f.end_year : f.start_year);
  }
  if (!Number.isFinite(debut)) continue;
  // Kyra de Glintaris : née ~10 154 (« morte à 11 ans » en 10 165, fac-0437)
  if (id === 'per-0200') debut = Math.min(debut, 10154);
  const p = e.data.periode;
  if (p.debut !== debut || p.fin !== fin) {
    console.log('  ↻ période de ' + e.name + ' (' + id + ') : ' + p.debut + '→' + p.fin + ' ⇒ ' + debut + '→' + fin);
    p.debut = debut; p.fin = fin;
    e.updated_at = NOW;
  }
}

if (ops === 0) {
  console.log('Rien à faire : les douze arbitrages sont déjà appliqués.');
} else {
  fs.writeFileSync(BASE, JSON.stringify(doc, null, 1) + '\n');
  console.log('\n' + ops + ' opération(s) — data/kg-base.json réécrit : ' +
    doc.entities.length + ' entités, ' + doc.facts.length + ' faits, ' +
    doc.relations.length + ' relations, ' + doc.aliases.length + ' alias.');
}
