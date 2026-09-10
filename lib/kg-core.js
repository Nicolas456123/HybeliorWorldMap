'use strict';
/*
 * lib/kg-core.js — Le cœur du graphe de connaissances canonique d'Hybélior.
 *
 * MODÈLE base ⊕ overlay (surcouche) :
 *   • data/kg-base.json = TOUTES les données saisies, committées dans le repo,
 *     servies directement — le site fonctionne sans backend.
 *   • overlay = uniquement ce qui est créé / édité / supprimé APRÈS coup
 *     (Turso en prod, un simple fichier JSON en dev). Un magasin id→enregistrement
 *     + des « tombstones » pour les suppressions.
 *   • Lecture = base ⊕ overlay fusionnés en mémoire ; écriture = overlay seul.
 *
 * Ce module est un moteur de graphe EN MÉMOIRE, en JavaScript pur — aucune base
 * de données, aucun SQL. Toute la logique (validation, cohérence, projections)
 * est écrite ici une seule fois et opère sur un objet `graph` :
 *
 *     graph = { entities:[], facts:[], relations:[], aliases:[], readings:[], byId:Map }
 *
 * Aucune dépendance externe. CommonJS.
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. CATALOGUES — l'ontologie fermée du monde
// ─────────────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  'personne', 'divinite', 'lignee', 'lieu', 'entite-politique', 'evenement', 'concept',
  'religion', 'espece', 'objet', 'terme', 'source', 'question', 'oeuvre', 'ere',
];
const LIEU_SCALES = ['monde', 'continent', 'region', 'nation', 'cite', 'ville', 'bourg', 'ruine', 'lieu-dit'];
const SOURCE_RANKS = ['texte-publie', 'bible', 'chronique-interne', 'note-travail'];
const FACT_TYPES = [
  'naissance', 'mort', 'regne', 'succession', 'couronnement', 'abdication',
  'fondation', 'chute', 'frontiere', 'bataille', 'traite',
  'apparition', 'disparition', 'evenement', 'autre',
];
const REL_TYPES = [
  'parent-de', 'conjoint-de', 'fratrie-de', 'descend-de',
  'gouverne', 'capitale-de', 'vassal-de', 'allie-de', 'en-guerre-avec', 'succede-a',
  'situe-dans', 'frontiere-avec',
  'incarne', 'pratique', 'venere', 'fonde', 'schisme-de',
  'membre-de', 'apparait-dans', 'source-de', 'mentionne', 'lie-a',
  'a-ne-pas-confondre-avec',
];
const REL_INVERSE = {
  'parent-de': 'enfant de', 'conjoint-de': 'conjoint de', 'fratrie-de': 'de la fratrie de',
  'descend-de': 'ancêtre de', 'gouverne': 'gouverné par', 'capitale-de': 'a pour capitale',
  'vassal-de': 'suzerain de', 'allie-de': 'allié de', 'en-guerre-avec': 'en guerre avec',
  'succede-a': 'précède', 'situe-dans': 'contient', 'frontiere-avec': 'frontalier de',
  'incarne': 'incarné par', 'pratique': 'pratiqué par', 'venere': 'vénéré par',
  'fonde': 'fondé par', 'schisme-de': 'a pour schisme', 'membre-de': 'compte pour membre',
  'apparait-dans': 'met en scène', 'source-de': 'attesté par', 'mentionne': 'mentionné par',
  'lie-a': 'lié à', 'a-ne-pas-confondre-avec': 'à ne pas confondre avec',
};
const STATUSES = ['canon', 'lecture-disputee', 'rumeur', 'retconne'];
const DISCLOSURES = ['public', 't1', 't2', 't3', 't4', 'interne'];
const PRECISIONS = ['exact', 'annee', 'decennie', 'siecle', 'estimation'];
const ALIAS_STATUSES = ['visible', 'predecessor', 'vanished', 'variante', 'desambig'];

const ID_PREFIX = {
  personne: 'per', divinite: 'div', lignee: 'lig', lieu: 'lie', 'entite-politique': 'pol',
  evenement: 'evt', concept: 'con', religion: 'rel', espece: 'esp',
  objet: 'obj', terme: 'ter', source: 'src', question: 'que', oeuvre: 'oeu', ere: 'ere',
};
// Préfixes d'id pour les enregistrements non-entités (stables base ⊕ overlay).
// 'lnk' pour les relations : distinct de 'rel' (religion) — pas de collision.
const REC_PREFIX = { facts: 'fac', relations: 'lnk', aliases: 'ali', readings: 'rea' };
const STORES = ['entities', 'facts', 'relations', 'aliases', 'readings'];

class KGError extends Error {
  constructor(message, code) { super(message); this.code = code || 'validation'; }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. GRAPHE EN MÉMOIRE — construction et fusion base ⊕ overlay
// ─────────────────────────────────────────────────────────────────────────

function emptyGraph() {
  return { entities: [], facts: [], relations: [], aliases: [], readings: [], byId: new Map() };
}

function reindex(g) {
  g.byId = new Map(g.entities.map(e => [e.id, e]));
  return g;
}

// base et overlay ont la même forme { entities, facts, relations, aliases, readings }.
// overlay porte en plus overlay.deletes = { entities:[ids], facts:[ids], ... }.
function mergeGraph(base, overlay) {
  base = base || {};
  overlay = overlay || {};
  const deletes = overlay.deletes || {};
  const g = emptyGraph();
  for (const store of STORES) {
    const map = new Map();
    for (const r of (base[store] || [])) map.set(r.id, r);
    for (const r of (overlay[store] || [])) map.set(r.id, r); // l'overlay écrase la base
    for (const id of (deletes[store] || [])) map.delete(id);   // tombstones
    g[store] = [...map.values()];
  }
  return reindex(g);
}

// Applique des ops { store, op:'put'|'delete', record?, id? } à un graphe EN PLACE.
// Utilisé par la migration (construction de la base) et pour les tests.
function applyOps(g, ops) {
  for (const op of ops) {
    const arr = g[op.store];
    if (op.op === 'put') {
      const i = arr.findIndex(r => r.id === op.record.id);
      if (i >= 0) arr[i] = op.record; else arr.push(op.record);
    } else if (op.op === 'delete') {
      const i = arr.findIndex(r => r.id === op.id);
      if (i >= 0) arr.splice(i, 1);
    }
  }
  return reindex(g);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }
function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isNaN(n) ? null : n; }
function str(v) { return v === null || v === undefined ? null : String(v); }
function uniq(a) { return [...new Set(a)]; }

function maxSuffix(ids, prefix) {
  let max = 0;
  for (const id of ids) {
    const m = new RegExp('^' + prefix + '-(\\d+)$').exec(id);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return max;
}
function nextEntityId(g, type) {
  const prefix = ID_PREFIX[type];
  if (!prefix) throw new KGError(`Type d'entité inconnu : ${type}`);
  return `${prefix}-${String(maxSuffix(g.entities.map(e => e.id), prefix) + 1).padStart(4, '0')}`;
}
function nextRecId(g, store) {
  const prefix = REC_PREFIX[store];
  return `${prefix}-${String(maxSuffix(g[store].map(r => r.id), prefix) + 1).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. DATES — double calendrier, précision variable (An 0 = l'Arrachement)
// ─────────────────────────────────────────────────────────────────────────

function formatYear(year, precision, circa) {
  if (year === null || year === undefined) return '—';
  const y = Number(year);
  const approx = circa ? '~' : (precision === 'estimation' ? '≈' : '');
  if (y === 0) return `${approx}An 0 (l'Arrachement)`;
  const abs = Math.abs(y);
  const suffix = y < 0 ? 'av.A' : 'ap.A';
  if (precision === 'siecle') {
    const siecle = Math.floor(abs / 100) + (abs % 100 === 0 ? 0 : 1);
    return `${approx}${siecle}ᵉ s. ${suffix}`;
  }
  return `${approx}${abs.toLocaleString('fr-FR')} ${suffix}`;
}
function formatRange(f) {
  const start = formatYear(f.start_year, f.start_precision, f.start_circa);
  if (f.end_year === null || f.end_year === undefined) return start;
  const fin = formatYear(f.end_year, f.end_precision, f.end_circa);
  // Une fourchette (data.fourchette) est une fenêtre d'incertitude, pas une
  // durée : « entre X et Y », jamais « X → Y ».
  if (f.data && f.data.fourchette) return `entre ${start} et ${fin}`;
  return `${start} → ${fin}`;
}
function sortKey(f) {
  const y = f.start_year === null || f.start_year === undefined ? -Infinity : Number(f.start_year);
  const s = f.seq === null || f.seq === undefined ? 0 : Number(f.seq);
  return [y, s];
}
function factCmp(a, b) {
  const [ay, as] = sortKey(a); const [by, bs] = sortKey(b);
  return ay - by || as - bs || String(a.id).localeCompare(String(b.id));
}

// ─────────────────────────────────────────────────────────────────────────
// 5. VALIDATION (contre le graphe fusionné)
// ─────────────────────────────────────────────────────────────────────────

function validateEntity(e) {
  if (!e || typeof e !== 'object') throw new KGError('Entité manquante');
  if (!ENTITY_TYPES.includes(e.type)) throw new KGError(`Type inconnu : ${e.type}`);
  if (!e.name || !String(e.name).trim()) throw new KGError('Le nom est obligatoire');
  if (e.status && !STATUSES.includes(e.status)) throw new KGError(`Statut inconnu : ${e.status}`);
  if (e.disclosure && !DISCLOSURES.includes(e.disclosure)) throw new KGError(`Divulgation inconnue : ${e.disclosure}`);
}
function requireEntity(g, id, label) {
  const e = g.byId.get(id);
  if (!e) throw new KGError(`${label || 'Entité'} inexistant(e) : ${id}`, 'ref');
  return e;
}

// ─────────────────────────────────────────────────────────────────────────
// 6. CONSTRUCTION DES ÉCRITURES — pures : valident + renvoient l'enregistrement
// ─────────────────────────────────────────────────────────────────────────

function buildEntity(g, input, when) {
  validateEntity(input);
  const ts = when || nowIso();
  const existing = input.id ? g.byId.get(input.id) : null;
  const id = input.id || nextEntityId(g, input.type);
  return {
    id, type: input.type, name: String(input.name).trim(),
    slug: str(input.slug), summary: str(input.summary), body: str(input.body),
    data: input.data || null,
    status: input.status || 'canon', disclosure: input.disclosure || 'interne',
    created_at: existing ? existing.created_at : ts, updated_at: ts,
  };
}

function buildAlias(g, a) {
  if (!a.value || !String(a.value).trim()) throw new KGError('Valeur du nom manquante');
  if (a.alias_status && !ALIAS_STATUSES.includes(a.alias_status)) throw new KGError(`Statut d'alias inconnu : ${a.alias_status}`);
  requireEntity(g, a.entity_id, 'Entité');
  // Clé naturelle (entity_id, value, era_id) pour un upsert idempotent.
  const existing = g.aliases.find(x => x.id === a.id
    || (x.entity_id === a.entity_id && x.value === String(a.value).trim() && (x.era_id || null) === (a.era_id || null)));
  return {
    id: (a.id || (existing && existing.id)) || nextRecId(g, 'aliases'),
    entity_id: a.entity_id, value: String(a.value).trim(),
    alias_status: a.alias_status || 'visible', era_id: str(a.era_id),
    from_year: num(a.from_year), to_year: num(a.to_year), meaning: str(a.meaning),
  };
}

function buildFact(g, f, when) {
  if (!FACT_TYPES.includes(f.fact_type)) throw new KGError(`Type de fait inconnu : ${f.fact_type}`);
  requireEntity(g, f.subject_id, 'Sujet');
  if (f.object_id) requireEntity(g, f.object_id, 'Objet');
  if (f.source_id) {
    const src = requireEntity(g, f.source_id, 'Source');
    if (src.type !== 'source') throw new KGError(`La source doit être de type « source » : ${f.source_id}`);
  }
  if (f.start_precision && !PRECISIONS.includes(f.start_precision)) throw new KGError(`Précision inconnue : ${f.start_precision}`);
  if (f.end_precision && !PRECISIONS.includes(f.end_precision)) throw new KGError(`Précision inconnue : ${f.end_precision}`);
  if (f.status && !STATUSES.includes(f.status)) throw new KGError(`Statut inconnu : ${f.status}`);
  const s = num(f.start_year), e = num(f.end_year);
  if (s !== null && e !== null && e < s) throw new KGError(`Incohérence temporelle : la fin (${e}) précède le début (${s}).`);
  const ts = when || nowIso();
  const existing = f.id ? g.facts.find(x => x.id === f.id) : null;
  const rec = {
    id: f.id || nextRecId(g, 'facts'),
    fact_type: f.fact_type, subject_id: f.subject_id, object_id: str(f.object_id),
    start_year: num(f.start_year), start_precision: f.start_precision || 'annee', start_circa: f.start_circa ? 1 : 0,
    end_year: num(f.end_year), end_precision: str(f.end_precision), end_circa: f.end_circa ? 1 : 0,
    era_id: str(f.era_id), seq: num(f.seq) || 0, label: str(f.label), detail: str(f.detail),
    data: f.data || null, source_id: str(f.source_id), status: f.status || 'canon',
    disclosure: f.disclosure || 'interne',
    created_at: existing ? existing.created_at : ts, updated_at: ts,
  };
  const warning = (rec.status === 'canon' && !rec.source_id) ? 'Fait canon sans source — provenance recommandée.' : null;
  return { rec, warning };
}

function buildRelation(g, r) {
  if (!REL_TYPES.includes(r.rel_type)) throw new KGError(`Relation inconnue : ${r.rel_type}`);
  if (!r.from_id || !r.to_id) throw new KGError('from_id et to_id sont obligatoires');
  if (r.from_id === r.to_id) throw new KGError('Une entité ne peut pas être en relation avec elle-même');
  requireEntity(g, r.from_id, 'Entité source');
  requireEntity(g, r.to_id, 'Entité cible');
  if (r.source_id) requireEntity(g, r.source_id, 'Source');
  if (r.status && !STATUSES.includes(r.status)) throw new KGError(`Statut inconnu : ${r.status}`);
  const sy = num(r.start_year);
  const existing = g.relations.find(x => x.id === r.id
    || (x.rel_type === r.rel_type && x.from_id === r.from_id && x.to_id === r.to_id && (x.start_year ?? null) === sy));
  return {
    id: (r.id || (existing && existing.id)) || nextRecId(g, 'relations'),
    rel_type: r.rel_type, from_id: r.from_id, to_id: r.to_id,
    start_year: sy, end_year: num(r.end_year), label: str(r.label),
    data: r.data || null, source_id: str(r.source_id), status: r.status || 'canon',
  };
}

function buildReading(g, r) {
  if (!r.text || !String(r.text).trim()) throw new KGError('Texte de la lecture manquant');
  const owner = requireEntity(g, r.question_id, 'Question');
  if (owner.type !== 'question') throw new KGError('Les lectures ne s\'attachent qu\'à une entité « question »');
  if (r.source_id) requireEntity(g, r.source_id, 'Source');
  const existing = r.id ? g.readings.find(x => x.id === r.id) : null;
  return {
    id: (r.id || (existing && existing.id)) || nextRecId(g, 'readings'),
    question_id: r.question_id, text: String(r.text).trim(),
    source_id: str(r.source_id), reading_status: r.reading_status || 'lecture-sourcee',
    ordinal: num(r.ordinal) || 0,
  };
}

// Refuse la suppression d'une entité encore référencée ; renvoie aussi les
// alias/lectures à supprimer en cascade.
function prepareEntityDelete(g, id) {
  requireEntity(g, id, 'Entité');
  const refs = g.facts.filter(f => f.subject_id === id || f.object_id === id || f.source_id === id).length
    + g.relations.filter(r => r.from_id === id || r.to_id === id || r.source_id === id).length;
  if (refs) throw new KGError(`Suppression refusée : encore référencée par ${refs} élément(s). Détache-les d'abord.`, 'referenced');
  const ops = [{ store: 'entities', op: 'delete', id }];
  for (const a of g.aliases.filter(x => x.entity_id === id)) ops.push({ store: 'aliases', op: 'delete', id: a.id });
  for (const rd of g.readings.filter(x => x.question_id === id)) ops.push({ store: 'readings', op: 'delete', id: rd.id });
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────
// 7. ROUTAGE DES ÉCRITURES — renvoie { ops, result } ; le magasin persiste
// ─────────────────────────────────────────────────────────────────────────

function prepareWrite(g, action, data, when) {
  data = data || {};
  switch (action) {
    case 'save-entity': { const rec = buildEntity(g, data, when); return { ops: [{ store: 'entities', op: 'put', record: rec }], result: { entity: rec } }; }
    case 'delete-entity': return { ops: prepareEntityDelete(g, data.id), result: { ok: true } };
    case 'save-alias': { const rec = buildAlias(g, data); return { ops: [{ store: 'aliases', op: 'put', record: rec }], result: { ok: true, alias: rec } }; }
    case 'delete-alias': return { ops: [{ store: 'aliases', op: 'delete', id: data.id }], result: { ok: true } };
    case 'save-fact': { const { rec, warning } = buildFact(g, data, when); return { ops: [{ store: 'facts', op: 'put', record: rec }], result: { fact: warning ? { ...rec, _warning: warning } : rec } }; }
    case 'delete-fact': return { ops: [{ store: 'facts', op: 'delete', id: data.id }], result: { ok: true } };
    case 'save-relation': { const rec = buildRelation(g, data); return { ops: [{ store: 'relations', op: 'put', record: rec }], result: { ok: true, relation: rec } }; }
    case 'delete-relation': return { ops: [{ store: 'relations', op: 'delete', id: data.id }], result: { ok: true } };
    case 'save-reading': { const rec = buildReading(g, data); return { ops: [{ store: 'readings', op: 'put', record: rec }], result: { ok: true, reading: rec } }; }
    case 'delete-reading': return { ops: [{ store: 'readings', op: 'delete', id: data.id }], result: { ok: true } };
    default: throw new KGError(`Action d'écriture inconnue : ${action}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 8. PROJECTIONS — une info écrite une fois, affichée partout
// ─────────────────────────────────────────────────────────────────────────

const nameOfIn = (g) => (id) => { const e = id && g.byId.get(id); return e ? e.name : id || null; };

function listEntities(g, opts) {
  opts = opts || {};
  let es = g.entities;
  if (opts.type) es = es.filter(e => e.type === opts.type);
  if (opts.search) {
    const s = String(opts.search).toLowerCase();
    const hit = new Set(g.aliases.filter(a => String(a.value).toLowerCase().includes(s)).map(a => a.entity_id));
    es = es.filter(e => String(e.name).toLowerCase().includes(s) || hit.has(e.id));
  }
  return es.map(e => ({ id: e.id, type: e.type, name: e.name, summary: e.summary, status: e.status, disclosure: e.disclosure, data: e.data || null }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }));
}
function getEntity(g, id) { return g.byId.get(id) || null; }
function getAliases(g, id) {
  return g.aliases.filter(a => a.entity_id === id)
    .sort((a, b) => (a.from_year == null) - (b.from_year == null) || (a.from_year ?? 0) - (b.from_year ?? 0));
}
function getReadings(g, qid) {
  return g.readings.filter(r => r.question_id === qid).sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0) || String(a.id).localeCompare(String(b.id)));
}

function getDossier(g, id) {
  const entity = g.byId.get(id);
  if (!entity) return null;
  const nameOf = nameOfIn(g);
  const facts = g.facts.filter(f => f.subject_id === id || f.object_id === id).map(f => ({
    ...f, dateLabel: formatRange(f), subjectName: nameOf(f.subject_id), objectName: nameOf(f.object_id),
    sourceName: nameOf(f.source_id), role: f.subject_id === id ? 'sujet' : 'objet',
  })).sort(factCmp);
  // Le label propre d'une relation (« capitale ancienne », « doublon probable
  // — à fusionner au bake »…) qualifie le type : il s'affiche à sa suite.
  const qualif = (base, r) => r.label ? `${base} · ${r.label}` : base;
  const relOut = g.relations.filter(r => r.from_id === id).map(r => ({
    ...r, direction: 'sortante', label: qualif(r.rel_type, r), otherId: r.to_id, otherName: nameOf(r.to_id), sourceName: nameOf(r.source_id),
  }));
  const relIn = g.relations.filter(r => r.to_id === id).map(r => ({
    ...r, direction: 'entrante', label: qualif(REL_INVERSE[r.rel_type] || r.rel_type, r), otherId: r.from_id, otherName: nameOf(r.from_id), sourceName: nameOf(r.source_id),
  }));
  const readings = entity.type === 'question' ? getReadings(g, id).map(r => ({ ...r, sourceName: nameOf(r.source_id) })) : [];
  return { entity, aliases: getAliases(g, id), facts, relations: [...relOut, ...relIn], readings };
}

function getChronologie(g, opts) {
  opts = opts || {};
  const nameOf = nameOfIn(g);
  let fs = g.facts;
  if (opts.fact_type) fs = fs.filter(f => f.fact_type === opts.fact_type);
  if (opts.era_id) fs = fs.filter(f => f.era_id === opts.era_id);
  if (opts.status) fs = fs.filter(f => f.status === opts.status);
  const from = num(opts.from_year), to = num(opts.to_year);
  if (from !== null) fs = fs.filter(f => f.start_year !== null && f.start_year >= from);
  if (to !== null) fs = fs.filter(f => f.start_year !== null && f.start_year <= to);
  return fs.map(f => ({ ...f, dateLabel: formatRange(f), subjectName: nameOf(f.subject_id), objectName: nameOf(f.object_id), sourceName: nameOf(f.source_id) })).sort(factCmp);
}

function getDirigeants(g, polityId) {
  const nameOf = nameOfIn(g);
  const regnes = g.facts.filter(f => f.fact_type === 'regne' && f.object_id === polityId).map(f => ({
    factId: f.id, rulerId: f.subject_id, rulerName: nameOf(f.subject_id),
    start_year: num(f.start_year), end_year: num(f.end_year), dateLabel: formatRange(f), seq: num(f.seq) || 0,
  })).sort((a, b) => (a.start_year ?? -Infinity) - (b.start_year ?? -Infinity) || a.seq - b.seq || String(a.factId).localeCompare(String(b.factId)));
  const anomalies = [];
  for (let i = 1; i < regnes.length; i++) {
    const prev = regnes[i - 1], cur = regnes[i];
    if (prev.end_year !== null && cur.start_year !== null) {
      if (cur.start_year < prev.end_year) anomalies.push({ type: 'chevauchement', detail: `${cur.rulerName} commence (${cur.start_year}) avant la fin de ${prev.rulerName} (${prev.end_year}).` });
      else if (cur.start_year - prev.end_year > 1) anomalies.push({ type: 'interregne', detail: `Trou de ${cur.start_year - prev.end_year} ans entre ${prev.rulerName} et ${cur.rulerName}.` });
    }
  }
  return { polityId, polityName: nameOf(polityId), regnes, anomalies };
}

function getArbre(g, id) {
  const center = g.byId.get(id);
  if (!center) return null;
  const parentsOf = (x) => g.relations.filter(r => r.rel_type === 'parent-de' && r.to_id === x).map(r => r.from_id);
  const childrenOf = (x) => g.relations.filter(r => r.rel_type === 'parent-de' && r.from_id === x).map(r => r.to_id);
  const conjointsOf = (x) => g.relations.filter(r => r.rel_type === 'conjoint-de' && (r.from_id === x || r.to_id === x)).map(r => r.from_id === x ? r.to_id : r.from_id);
  const parents = parentsOf(id), children = childrenOf(id), conjoints = conjointsOf(id);
  const grandparents = uniq(parents.flatMap(parentsOf));
  const grandchildren = uniq(children.flatMap(childrenOf));
  const siblings = uniq(parents.flatMap(childrenOf)).filter(s => s !== id);
  const life = {};
  for (const f of g.facts) if (f.fact_type === 'naissance' || f.fact_type === 'mort') (life[f.subject_id] = life[f.subject_id] || {})[f.fact_type] = f;
  const node = (x) => {
    const e = g.byId.get(x); const l = life[x] || {};
    const b = l.naissance ? formatYear(l.naissance.start_year, l.naissance.start_precision, l.naissance.start_circa) : null;
    const d = l.mort ? formatYear(l.mort.start_year, l.mort.start_precision, l.mort.start_circa) : null;
    return { id: x, name: e ? e.name : x, birth: b, death: d, lifeLabel: (b || d) ? `${b || '?'} – ${d || '?'}` : '' };
  };
  return {
    center: node(id), grandparents: grandparents.map(node), parents: parents.map(node),
    conjoints: conjoints.map(node), siblings: siblings.map(node), children: children.map(node), grandchildren: grandchildren.map(node),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 9. COHÉRENCE — le filet de sécurité rendu visible
// ─────────────────────────────────────────────────────────────────────────

function getConsistencyReport(g) {
  const issues = [];
  const nameOf = nameOfIn(g);
  const add = (severity, kind, message, refId) => issues.push({ severity, kind, message, refId });
  const has = (id) => g.byId.has(id);

  for (const f of g.facts) {
    if (!has(f.subject_id)) add('erreur', 'ref', `Fait ${f.id} : sujet inexistant (${f.subject_id}).`, f.subject_id);
    if (f.object_id && !has(f.object_id)) add('erreur', 'ref', `Fait ${f.id} : objet inexistant (${f.object_id}).`, f.object_id);
    if (f.source_id && !has(f.source_id)) add('erreur', 'ref', `Fait ${f.id} : source inexistante (${f.source_id}).`, f.source_id);
    if (f.end_year !== null && f.start_year !== null && f.end_year < f.start_year) add('erreur', 'temps', `Fait ${f.id} (${f.fact_type}) : fin ${f.end_year} avant début ${f.start_year}.`, f.subject_id);
    if ((f.status || 'canon') === 'canon' && !f.source_id) add('info', 'provenance', `Fait ${f.id} (${f.fact_type} sur ${nameOf(f.subject_id)}) : canon sans source.`, f.subject_id);
  }
  for (const r of g.relations) {
    if (!has(r.from_id)) add('erreur', 'ref', `Relation ${r.id} : source inexistante (${r.from_id}).`, r.from_id);
    if (!has(r.to_id)) add('erreur', 'ref', `Relation ${r.id} : cible inexistante (${r.to_id}).`, r.to_id);
  }
  for (const a of g.aliases) if (!has(a.entity_id)) add('erreur', 'ref', `Alias « ${a.value} » : entité inexistante (${a.entity_id}).`, a.entity_id);
  for (const rd of g.readings) if (!has(rd.question_id)) add('erreur', 'ref', `Lecture ${rd.id} : question inexistante (${rd.question_id}).`, rd.question_id);

  const bySubject = {};
  for (const f of g.facts) (bySubject[f.subject_id] = bySubject[f.subject_id] || []).push(f);
  for (const [sid, fs] of Object.entries(bySubject)) {
    const naissance = fs.find(f => f.fact_type === 'naissance');
    const mort = fs.find(f => f.fact_type === 'mort');
    if (naissance && mort && naissance.start_year !== null && mort.start_year !== null && mort.start_year < naissance.start_year) add('erreur', 'temps', `${nameOf(sid)} : mort (${mort.start_year}) avant naissance (${naissance.start_year}).`, sid);
    for (const r of fs.filter(f => f.fact_type === 'regne')) {
      if (naissance && r.start_year !== null && naissance.start_year !== null && r.start_year < naissance.start_year) add('avert', 'temps', `${nameOf(sid)} : règne commencé (${r.start_year}) avant sa naissance (${naissance.start_year}).`, sid);
      if (mort && r.end_year !== null && mort.start_year !== null && r.end_year > mort.start_year) add('avert', 'temps', `${nameOf(sid)} : règne fini (${r.end_year}) après sa mort (${mort.start_year}).`, sid);
    }
  }
  for (const p of g.entities.filter(e => e.type === 'entite-politique')) {
    for (const an of getDirigeants(g, p.id).anomalies) add(an.type === 'chevauchement' ? 'avert' : 'info', 'succession', `${p.name} — ${an.detail}`, p.id);
  }
  for (const e of g.entities.filter(x => x.type === 'question')) {
    if (e.data && e.data.protege) {
      const n = g.readings.filter(r => r.question_id === e.id).length;
      if (n < 2) add('avert', 'mystere', `Mystère protégé « ${e.name} » : ${n} lecture(s). Un mystère protégé doit conserver au moins deux lectures concurrentes.`, e.id);
    }
  }
  const counts = { erreur: issues.filter(i => i.severity === 'erreur').length, avert: issues.filter(i => i.severity === 'avert').length, info: issues.filter(i => i.severity === 'info').length };
  return { counts, issues };
}

function getStats(g) {
  const byType = {};
  for (const e of g.entities) byType[e.type] = (byType[e.type] || 0) + 1;
  return { entitiesByType: byType, entities: g.entities.length, facts: g.facts.length, relations: g.relations.length, aliases: g.aliases.length };
}

// LA PROJECTION « TIMELINE » : forme year-based de timeline-names.json depuis
// le graphe, pour la carte du site. Données non secrètes → lecture publique.
function getTimelineProjection(g) {
  const aliasBy = {};
  for (const a of g.aliases) (aliasBy[a.entity_id] = aliasBy[a.entity_id] || []).push(a);
  const timelineOf = (id, currentName) => (aliasBy[id] || [])
    .filter(a => a.from_year !== null && a.from_year !== undefined && a.to_year !== null && a.to_year !== undefined)
    .map(a => ({ name: a.value || currentName, startYear: Number(a.from_year), endYear: Number(a.to_year) }))
    .sort((x, y) => x.startYear - y.startYear);
  const eras = [], continentTimelines = [], countries = [];
  for (const e of g.entities) {
    const data = e.data || {};
    if (e.type === 'ere') eras.push({ id: e.id, label: e.name, name: e.name, description: e.summary, startYear: data.startYear, endYear: data.endYear });
    else if (e.type === 'lieu' && data.echelle === 'continent') continentTimelines.push({ currentName: e.name, timeline: timelineOf(e.id, e.name) });
    else if (e.type === 'entite-politique' && !data.disparue) countries.push({ currentName: e.name, continent: data.continent || null, timeline: timelineOf(e.id, e.name) });
  }
  eras.sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
  return { timelineData: { eras, continentTimelines, countries } };
}

// ─────────────────────────────────────────────────────────────────────────
// 10. ROUTAGE DES LECTURES
// ─────────────────────────────────────────────────────────────────────────

function getCatalog() {
  return {
    entityTypes: ENTITY_TYPES, lieuScales: LIEU_SCALES, sourceRanks: SOURCE_RANKS,
    factTypes: FACT_TYPES, relTypes: REL_TYPES, relInverse: REL_INVERSE,
    statuses: STATUSES, disclosures: DISCLOSURES, precisions: PRECISIONS, aliasStatuses: ALIAS_STATUSES,
  };
}

// Réseau : nœuds + liens filtrés par types de relations (et optionnellement par
// types d'entités aux extrémités) — pour les visualisations croisées du portail.
function getReseau(g, opts) {
  opts = opts || {};
  const rels = opts.rels ? new Set(String(opts.rels).split(',')) : null;
  const types = opts.types ? new Set(String(opts.types).split(',')) : null;
  const maxLinks = Math.min(+opts.limit || 900, 2000);
  const links = [];
  const touchés = new Set();
  for (const r of g.relations) {
    if (rels && !rels.has(r.rel_type)) continue;
    const a = g.byId.get(r.from_id), b = g.byId.get(r.to_id);
    if (!a || !b) continue;
    if (types && !types.has(a.type) && !types.has(b.type)) continue;
    links.push({ from: r.from_id, to: r.to_id, rel: r.rel_type });
    touchés.add(r.from_id); touchés.add(r.to_id);
    if (links.length >= maxLinks) break;
  }
  const degre = {};
  for (const l of links) { degre[l.from] = (degre[l.from] || 0) + 1; degre[l.to] = (degre[l.to] || 0) + 1; }
  const nodes = [...touchés].map((id) => {
    const e = g.byId.get(id);
    return { id, name: e.name, type: e.type, degre: degre[id] || 0 };
  });
  return { nodes, links, tronque: links.length >= maxLinks };
}

function readAction(g, action, query) {
  query = query || {};
  switch (action || 'list') {
    case 'catalog': return getCatalog();
    case 'list': return { entities: listEntities(g, { type: query.type, search: query.search }) };
    case 'entity': return { entity: getEntity(g, query.id) };
    case 'dossier': return { dossier: getDossier(g, query.id) };
    case 'chronologie': return { facts: getChronologie(g, { fact_type: query.fact_type, era_id: query.era_id, from_year: query.from_year, to_year: query.to_year, status: query.status }) };
    case 'dirigeants': return { dirigeants: getDirigeants(g, query.id) };
    case 'arbre': return { arbre: getArbre(g, query.id) };
    case 'coherence': return { report: getConsistencyReport(g) };
    case 'timeline': return getTimelineProjection(g);
    case 'reseau': return getReseau(g, { rels: query.rels, types: query.types, limit: query.limit });
    case 'stats': return { stats: getStats(g) };
    default: throw new KGError(`Action de lecture inconnue : ${action}`);
  }
}

module.exports = {
  ENTITY_TYPES, LIEU_SCALES, SOURCE_RANKS, FACT_TYPES, REL_TYPES, REL_INVERSE,
  STATUSES, DISCLOSURES, PRECISIONS, ALIAS_STATUSES, ID_PREFIX, REC_PREFIX, STORES, KGError,
  emptyGraph, mergeGraph, applyOps, reindex,
  nextEntityId, nextRecId,
  prepareWrite, readAction, getCatalog,
  listEntities, getEntity, getAliases, getReadings, getDossier, getChronologie,
  getDirigeants, getArbre, getConsistencyReport, getStats, getTimelineProjection, getReseau,
  formatYear, formatRange,
};
