/* MYCAR v3.4.5 — pure, read-only restore planning.
 * No browser storage, Supabase calls, or mutation of input records.
 * This module does NOT implement Restore.
 */
(function (root) {
  'use strict';
  const COLLECTIONS = ['vehicles', 'fuel', 'maintenance', 'tax', 'trips', 'other'];
  const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const safeId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
  const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']'
    : isObj(x) ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}'
    : JSON.stringify(x);
  function inspectShape(data) {
    const errors = [];
    if (!isObj(data) || data.type === 'MYCAR_PERIOD_REPORT_NOT_FOR_RESTORE')
      return {valid:false, errors:['A complete MYCAR backup object is required (not a month-range report).']};
    const vehicles = new Set();
    for (const col of COLLECTIONS) {
      if (!Array.isArray(data[col])) {errors.push('Missing or invalid array: ' + col); continue;}
      if (col === 'vehicles' && data[col].length === 0) errors.push('At least one vehicle is required.');
      const seen = new Set();
      for (const [i, rec] of data[col].entries()) {
        if (!isObj(rec) || !safeId(rec.id)) {errors.push(`${col}[${i}] has invalid ID`); continue;}
        if (seen.has(rec.id)) errors.push(`${col}[${i}] duplicate ID ${rec.id}`);
        seen.add(rec.id);
        if (col === 'vehicles') {
          vehicles.add(rec.id);
          if (typeof rec.name !== 'string' || !rec.name.trim()) errors.push(`${col}[${i}] invalid name`);
        } else if (!safeId(rec.vehicleId)) errors.push(`${col}[${i}] invalid vehicleId`);
        if (own(rec, 'cost') && (typeof rec.cost !== 'number' || !Number.isFinite(rec.cost) || rec.cost < 0))
          errors.push(`${col}[${i}] invalid cost`);
      }
    }
    for (const col of COLLECTIONS.slice(1)) for (const [i, rec] of (Array.isArray(data[col]) ? data[col] : []).entries())
      if (isObj(rec) && safeId(rec.vehicleId) && !vehicles.has(rec.vehicleId)) errors.push(`${col}[${i}] refers to a missing vehicle`);
    return {valid:errors.length===0,errors};
  }
  function plan(backup, current) {
    const b = inspectShape(backup), c = inspectShape(current);
    if (!b.valid || !c.valid) return {valid:false, backupErrors:b.errors, currentErrors:c.errors, changes:null};
    const changes = {};
    for (const col of COLLECTIONS) {
      const originals = new Map(current[col].map(x => [x.id, x]));
      const incoming = new Set();
      let add = 0, identical = 0, changed = 0, absentFromBackup = 0;
      for (const rec of backup[col]) {
        incoming.add(rec.id);
        if (!originals.has(rec.id)) add++;
        else if (canonical(rec) === canonical(originals.get(rec.id))) identical++;
        else changed++;
      }
      for (const rec of current[col]) if (!incoming.has(rec.id)) absentFromBackup++;
      changes[col] = {inBackup:backup[col].length, onDevice:current[col].length, add, identical, changed, absentFromBackup};
    }
    return {valid:true, backupErrors:[], currentErrors:[], changes,
      warning:'PREVIEW ONLY. No records were imported or modified. Absent-from-backup items are not deleted.'};
  }
  const api = Object.freeze({inspectShape,plan});
  root.MYCARRestoreDryRun = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
