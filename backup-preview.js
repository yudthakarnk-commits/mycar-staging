/* MYCAR v3.4.4 Phase 2A/2B: read-only backup validation and comparison.
 * Deliberately does NOT expose any restore/write method.
 */
(function (root) {
  'use strict';
  const COLLECTIONS = ['fuel', 'maintenance', 'tax', 'trips', 'other'];
  const ID = /^[A-Za-z0-9_-]{1,128}$/;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const maxIssues = 30;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validId = value => typeof value === 'string' && ID.test(value);
  function validate(data) {
    const errors = [];
    const warnings = [];
    const error = message => { if (errors.length < maxIssues) errors.push(message); };
    const warning = message => { if (warnings.length < maxIssues) warnings.push(message); };
    if (!isObject(data)) return { valid: false, errors: ['Backup must be a JSON object.'], warnings, counts: null };
    if (data.type === 'MYCAR_PERIOD_REPORT_NOT_FOR_RESTORE') {
      return {valid: false, errors: ['Month-range report cannot be restored. Export All records instead.'], warnings, counts: null};
    }
    if (!Array.isArray(data.vehicles) || data.vehicles.length < 1) error('At least one vehicle is required.');
    for (const name of COLLECTIONS) if (!Array.isArray(data[name])) error(`${name} must be an array.`);
    if (errors.length) return {valid: false, errors, warnings, counts: null};
    const ids = new Set();
    for (const [i,v] of data.vehicles.entries()) {
      if (!isObject(v) || !validId(v.id) || typeof v.name !== 'string' || !v.name.trim()) {
        error(`vehicles[${i}]: invalid ID or name.`); continue;
      }
      if (ids.has(v.id)) error(`Duplicate vehicle ID: ${v.id}`);
      ids.add(v.id);
    }
    if (data.activeVehicleId != null && !ids.has(data.activeVehicleId)) warning('Active vehicle is not in vehicle list.');
    let count = data.vehicles.length;
    for (const name of COLLECTIONS) {
      const seen = new Set();
      for (const [i, rec] of data[name].entries()) {
        count++;
        if (!isObject(rec) || !validId(rec.id) || !validId(rec.vehicleId)) {
          error(`${name}[${i}]: missing/invalid ID or vehicleId.`); continue;
        }
        if (seen.has(rec.id)) error(`Duplicate ${name} ID: ${rec.id}`);
        seen.add(rec.id);
        if (!ids.has(rec.vehicleId)) error(`${name}[${i}]: vehicleId does not exist.`);
        if (own(rec,'cost') && (typeof rec.cost !== 'number' || !Number.isFinite(rec.cost) || rec.cost < 0)) {
          error(`${name}[${i}]: cost must be a nonnegative finite number.`);
        }
        if (own(rec,'date') && (typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date))) {
          warning(`${name}[${i}]: unexpected date format.`);
        }
      }
    }
    if (count > 100000) error('Backup exceeds the supported 100,000 records limit.');
    return {valid: errors.length === 0, errors, warnings,
      counts: Object.fromEntries(['vehicles',...COLLECTIONS].map(k => [k,data[k].length]))};
  }
  function compare(fileData, currentData) {
    const fileResult = validate(fileData);
    if (!fileResult.valid) return {valid: false, validation: fileResult};
    const currentResult = validate(currentData);
    if (!currentResult.valid) return {valid: true, validation: fileResult, currentValid: false, comparisons: null};
    const comparisons = {};
    for (const name of ['vehicles', ...COLLECTIONS]) {
      const existing = new Map(currentData[name].map(r => [r.id,r]));
      let newItems=0, identical=0, changed=0;
      for (const r of fileData[name]) {
        if (!existing.has(r.id)) newItems++;
        else if (canonical(r) === canonical(existing.get(r.id))) identical++;
        else changed++;
      }
      comparisons[name] = {inFile:fileData[name].length, onDevice:currentData[name].length, newItems, identical, changed};
    }
    return {valid:true, validation:fileResult, currentValid:true, comparisons};
  }
  function canonical(value) {
    if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
    if (isObject(value)) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
    return JSON.stringify(value);
  }
  function buildUI(target) {
    target.innerHTML = '';
    const heading = document.createElement('strong'); heading.textContent='Backup verification — Preview only';
    const status = document.createElement('p'); status.className='mycar-backup-preview__status';
    const output = document.createElement('div'); output.className='mycar-backup-preview__results';
    const note=document.createElement('p'); note.textContent='Read-only: no records will be imported, deleted, updated, or synced.';
    target.append(heading,status,output,note);
    return {status,output};
  }
  function line(container, text, className='') {
    const p=document.createElement('p'); p.textContent=text; p.className=className;container.append(p);
  }
  async function inspect(event) {
    const input=event?.target; const file=input?.files?.[0]; if (!file) return;
    const target=document.getElementById('mycar-backup-preview');
    if (!target) { input.value=''; return; }
    target.hidden=false;
    const {status,output}=buildUI(target);
    try {
      if (file.size>MAX_FILE_BYTES) throw new Error('File exceeds 10 MB limit.');
      const raw=await file.text();
      const parsed=JSON.parse(raw);
      // Global lexical `dbData` is defined by the existing classic app.js script.
      const current = typeof dbData !== 'undefined' ? dbData : null;
      const result= current ? compare(parsed,current) : {valid:false,validation:validate(parsed),currentValid:false};
      status.textContent = result.validation.valid ? `Valid structure: ${file.name}` : `Not safe to restore: ${file.name}`;
      status.dataset.valid=String(result.validation.valid);
      if (result.validation.counts) line(output, Object.entries(result.validation.counts).map(([k,v])=>`${k}: ${v}`).join(' | '));
      for (const issue of result.validation.errors) line(output,`ERROR — ${issue}`,'mycar-backup-preview__error');
      for (const issue of result.validation.warnings) line(output,`CHECK — ${issue}`,'mycar-backup-preview__warning');
      if (result.validation.valid && current && root.MYCARRestoreDryRun) {
  const dryRun = root.MYCARRestoreDryRun.plan(parsed, current);

  if (dryRun.valid) {
    line(output, 'RESTORE DRY RUN — PREVIEW ONLY');

    for (const [name, x] of Object.entries(dryRun.changes)) {
      line(
        output,
        `${name}: ${x.add} new | ${x.identical} identical | ` +
        `${x.changed} changed | ${x.absentFromBackup} absent from backup`
      );
    }

    line(
      output,
      'No data has been restored or modified. ' +
      'Records absent from backup will NOT be deleted.',
      'mycar-backup-preview__warning'
    );
  } else {
    line(
      output,
      'Dry Run unavailable: validation failed.',
      'mycar-backup-preview__error'
    );
  }
}
      if (result.comparisons) {
        line(output,'Comparison against records on this device (same IDs can have changed values):');
        for (const [name,x] of Object.entries(result.comparisons))
          line(output,`${name}: ${x.inFile} in file | ${x.newItems} new | ${x.identical} identical | ${x.changed} changed IDs`);
        line(output,'This is NOT an account ownership verification; JSON backups have no signed account binding.','mycar-backup-preview__warning');
      } else if (result.validation.valid) {
        line(output,'Cannot compare with current signed-in data. Do not restore.','mycar-backup-preview__warning');
      }
    } catch (error) {
      status.textContent='Could not inspect backup';status.dataset.valid='false';
      line(output,error instanceof SyntaxError?'Invalid JSON file.':error.message,'mycar-backup-preview__error');
    } finally { input.value=''; }
  }
  const api={validate,compare,inspect};
  root.MYCARBackupPreview=api;
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof window !== 'undefined' ? window : globalThis);
