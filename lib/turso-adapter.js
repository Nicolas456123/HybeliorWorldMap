'use strict';
/*
 * lib/turso-adapter.js — Adaptateur de stockage Turso (libSQL) pour le graphe.
 *
 * Fournit `exec(sql, args) -> { rows }` attendu par lib/kg-core.js, adossé à
 * l'API HTTP Turso /v2/pipeline. Restaure le typage JS des cellules (entier,
 * flottant, null) pour que les lignes soient IDENTIQUES à celles de node:sqlite.
 * Utilisé en production par api/kg.js (et par la migration si les creds sont là).
 */

function toTursoArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') {
    // Le protocole Hrana exige la valeur des entiers EN CHAÎNE (int64) ;
    // un nombre nu est refusé en 400 par /v2/pipeline.
    return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  }
  return { type: 'text', value: String(v) };
}

function fromTursoCell(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer' || cell.type === 'float') {
    const n = Number(cell.value);
    return Number.isNaN(n) ? cell.value : n;
  }
  return cell.value;
}

function createTursoExec(url, token) {
  if (!url || !token) throw new Error('Turso non configuré (url / token manquants).');
  const base = url.replace('libsql://', 'https://');

  return async (sql, args) => {
    const body = {
      requests: [
        { type: 'execute', stmt: { sql, args: (args || []).map(toTursoArg) } },
        { type: 'close' },
      ],
    };
    const res = await fetch(`${base}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Turso error: ${res.status}`);
    const data = await res.json();
    const result = data.results && data.results[0] && data.results[0].response && data.results[0].response.result;
    if (!result) return { rows: [] };
    const cols = result.cols.map(c => c.name);
    const rows = result.rows.map(row => {
      const obj = {};
      row.forEach((cell, i) => { obj[cols[i]] = fromTursoCell(cell); });
      return obj;
    });
    return { rows };
  };
}

module.exports = { createTursoExec };
