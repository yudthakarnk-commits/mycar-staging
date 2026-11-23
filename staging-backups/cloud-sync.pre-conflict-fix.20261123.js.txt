/* MYCAR per-user cloud synchronization (Supabase PostgREST, no secret keys).
 * A record is one row; deletions are durable tombstones. Other devices poll
 * changes every 15 seconds and on focus; pending offline edits upload on reconnect.
 * Simultaneous edits to the same record are last-write-wins.
 */
const MYCARCloud = (() => {
  const COLLECTIONS = ['vehicles','fuel','maintenance','tax','trips','other'];
  const POLL_MS = 15000;
  let active = false, userId = '', projectId = '', timer = null, busy = false;
  let pending = {}, queueKey = '', initializedKey = '', didInitialize = false;
  let bridge = null, generation = 0, lastSuccessful = null;
  let serverRevision = null;
  const keyOf = (type,id) => type+'|'+id;
  const clone = value => JSON.parse(JSON.stringify(value));
  const isSafeRecord = (item) => !!item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(item.id);
  function notify(message, state='idle') {
    const target=document.getElementById('mycar-sync-status');
    if(target) {
      // Fixed-size status dot: update accessibility metadata, never flowing header text.
      target.dataset.syncState=state;
      target.title=message+' (tap to sync)';
      target.setAttribute('aria-label',message+'. Tap to sync now.');
    }
    const details=document.getElementById('mycar-sync-detail');
    if(details) details.textContent=message+(lastSuccessful ? ' · Last sync '+lastSuccessful.toLocaleString() : '');
  }
  function readQueue() {
    try {
      const value=JSON.parse(localStorage.getItem(queueKey)||'{}');
      if(value && typeof value==='object' && !Array.isArray(value)) return value;
    } catch(error) { console.warn('Cannot parse sync queue',error); }
    return {};
  }
  function saveQueue() { localStorage.setItem(queueKey,JSON.stringify(pending)); }
  function queueEntry(collection, id, payload, deleted) {
    if(!COLLECTIONS.includes(collection)||!isSafeRecord({id})) return;
    pending[keyOf(collection,id)]={collection,record_id:id,payload:deleted?{}:clone(payload),deleted:!!deleted};
  }
  // Called by app.js after writing its local cache.
  function onLocalChange(before, after) {
    if(!active || !before || !after) return;
    for (const collection of COLLECTIONS) {
      const oldMap=new Map((before[collection]||[]).filter(isSafeRecord).map(r=>[r.id,r]));
      const newMap=new Map((after[collection]||[]).filter(isSafeRecord).map(r=>[r.id,r]));
      for (const [id, record] of newMap) {
        if(!oldMap.has(id) || JSON.stringify(oldMap.get(id))!==JSON.stringify(record)) queueEntry(collection,id,record,false);
      }
      for (const id of oldMap.keys()) if(!newMap.has(id)) queueEntry(collection,id,{},true);
    }
    saveQueue();
    notify(`${Object.keys(pending).length} change(s) pending sync`,'pending');
    schedule(200);
  }
  function baseUrl() {
    const cfg=AuthManager.config;
    if(!cfg?.url || !cfg?.key) throw new Error('Connect Supabase in the login screen first.');
    return cfg.url+'/rest/v1/mycar_records';
  }
  async function request(url, {method='GET',body=null,prefer=null}={}) {
    const token=await AuthManager.getAccessToken();
    const cfg=AuthManager.config;
    const headers={'apikey':cfg.key,'Authorization':'Bearer '+token,'Accept':'application/json'};
    if(body!==null) headers['Content-Type']='application/json';
    if(prefer) headers['Prefer']=prefer;
    let response;
    try { response=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'}); }
    catch(error){throw new Error('Network connection unavailable. Changes are saved on this device.');}
    let data={};
    const text=await response.text();
    try { data=text?JSON.parse(text):{}; } catch { data={}; }
    if(!response.ok) {
      if(response.status===404 || data.code==='42P01' || data.code==='PGRST205')
        throw new Error('Cloud table not found. Run MYCAR_SCHEMA.sql in the new Supabase project.');
      const error=new Error(data.message||data.msg||data.error_description||`Cloud request failed (${response.status})`);
      error.status=response.status;
      throw error;
    }
    return data;
  }
  async function rpc(name, payload) {
    return request(AuthManager.config.url+'/rest/v1/rpc/'+name,{method:'POST',body:payload});
  }
  function flightKey() { return queueKey+':flight_v2'; }
  function readFlight() {
    try { return JSON.parse(localStorage.getItem(flightKey())||'null'); }
    catch { throw new Error('Stored sync flight is corrupted. Manual recovery required.'); }
  }
  function saveFlight(flight) {
    if (flight) localStorage.setItem(flightKey(),JSON.stringify(flight));
    else localStorage.removeItem(flightKey());
  }
  async function fetchRows() {
    const rows=[];const perPage=500;
    for(let offset=0;offset<100000;offset+=perPage) {
      const qs=new URLSearchParams({select:'collection,record_id,payload,deleted,updated_at',user_id:'eq.'+userId,order:'updated_at.asc',limit:String(perPage),offset:String(offset)});
      const part=await request(baseUrl()+'?'+qs.toString());
      if(!Array.isArray(part)) throw new Error('Unexpected response from cloud database.');
      rows.push(...part);
      if(part.length<perPage) return rows;
    }
    throw new Error('Cloud data limit reached. Contact an administrator before continuing.');
  }
  function stateFromRows(rows, local, queue) {
    const merged={activeVehicleId:local?.activeVehicleId||'v1'};
    for (const key of COLLECTIONS) merged[key]=[];
    const maps=Object.fromEntries(COLLECTIONS.map(key=>[key,new Map()]));
    for(const row of rows) {
      if(!COLLECTIONS.includes(row.collection) || !isSafeRecord({id:row.record_id})) continue;
      if(row.deleted) maps[row.collection].delete(row.record_id);
      else if(isSafeRecord(row.payload) && row.payload.id===row.record_id)
        maps[row.collection].set(row.record_id,row.payload);
    }
    for(const op of Object.values(queue)) {
      if(!COLLECTIONS.includes(op.collection)||!isSafeRecord({id:op.record_id})) continue;
      if(op.deleted) maps[op.collection].delete(op.record_id);
      else if(isSafeRecord(op.payload) && op.payload.id===op.record_id)
        maps[op.collection].set(op.record_id,op.payload);
    }
    for(const col of COLLECTIONS) merged[col]=[...maps[col].values()];
    if(merged.vehicles.length && !merged.vehicles.some(v=>v.id===merged.activeVehicleId))
      merged.activeVehicleId=merged.vehicles[0].id;
    return merged;
  }
  function currentPendingCount(){return Object.keys(pending).length;}
  function addAllLocalToQueue(local) {
    for(const collection of COLLECTIONS)
      for(const record of local[collection]||[]) if(isSafeRecord(record)) queueEntry(collection,record.id,record,false);
    saveQueue();
  }
  async function flushQueue(expectedGeneration) {
    if (serverRevision === null) throw new Error('Account revision unavailable');
    let flight=readFlight();
    for (let attempt=0;attempt<100;attempt++) {
      if (!active||generation!==expectedGeneration) return;
      if (!flight) {
        const chunk=Object.entries(pending).slice(0,50);
        if (!chunk.length) return;
        flight={
          requestId:crypto.randomUUID(),
          expectedRevision:serverRevision,
          entries:chunk,
          operations:chunk.map(([,op])=>({
            collection:op.collection,record_id:op.record_id,
            payload:op.payload,deleted:op.deleted
          }))
        };
        saveFlight(flight);
      }
      let result;
      try {
        result=await rpc('mycar_apply_changes',{
          p_expected_revision:flight.expectedRevision,
          p_request_id:flight.requestId,
          p_operations:flight.operations
        });
      } catch(error) {
        let status=null;
        try { status=await rpc('mycar_get_sync_state',{p_request_id:flight.requestId}); }
        catch (_) { /* Keep flight for retry. */ }
        if(status?.request?.operation==='apply') result=status.request;
        else throw error;
      }
      if (!active||generation!==expectedGeneration) return;
      serverRevision=Number(result.revision);
      for (const [key,sent] of flight.entries) {
        if(JSON.stringify(pending[key])===JSON.stringify(sent)) delete pending[key];
      }
      saveQueue();
      saveFlight(null);
      flight=null;
    }
    throw new Error('Sync exceeds safe batch limit; remaining edits retained');
  }
  async function syncNow() {
    if(!active || busy || !bridge || !AuthManager.currentUser || AuthManager.currentUser.id!==userId) return;
    if(typeof navigator.onLine==='boolean' && !navigator.onLine) {notify('Offline · changes saved locally','offline');return;}
    const expectedGeneration=generation;
    busy=true;
    notify(currentPendingCount()?'Uploading changes…':'Checking cloud…','working');
    try {
      const beforeState=await rpc('mycar_get_sync_state',{p_request_id:null});
      const remote=await fetchRows();
      const afterState=await rpc('mycar_get_sync_state',{p_request_id:null});
      if(Number(beforeState.revision)!==Number(afterState.revision))
        throw new Error('Cloud changed during download; retry sync');
      serverRevision=Number(afterState.revision);
      if(!active || generation!==expectedGeneration) return;
      const local=bridge.getData();
      if(!didInitialize && remote.length===0 && !currentPendingCount()) addAllLocalToQueue(local);
      const merged=stateFromRows(remote,local,pending);
      bridge.applyData(merged);
      if(currentPendingCount()) await flushQueue(expectedGeneration);
      if(!active || generation!==expectedGeneration) return;
      localStorage.setItem(initializedKey,'true');
      didInitialize=true;
      lastSuccessful=new Date();
      notify(currentPendingCount()?`${currentPendingCount()} edits pending`:'Synced · '+lastSuccessful.toLocaleTimeString(),'success');
    } catch(error) {
      if(active && generation===expectedGeneration) {
        notify('Sync error · '+(error.message||'Try again'),'error');
        console.error('MYCAR cloud synchronization failed',error);
      }
    } finally { busy=false; }
  }
  function schedule(delay=POLL_MS) {
    if(timer) clearTimeout(timer);
    if(!active) return;
    timer=setTimeout(async()=>{await syncNow();schedule(POLL_MS);},delay);
  }
  function start(user, callbacks) {
    stop();
    if(!user?.id) return;
    userId=user.id;
    projectId=AuthManager.projectId;
    if(!projectId) return;
    bridge=callbacks;
    queueKey=`mycar_sync_pending_v1:${projectId}:${userId}`;
    initializedKey=`mycar_sync_initialized_v1:${projectId}:${userId}`;
    pending=readQueue();
    didInitialize=localStorage.getItem(initializedKey)==='true';
    active=true;
    generation++;
    notify('Connecting…','working');
    schedule(0);
  }
  function stop() {
    generation++;
    active=false;
    if(timer) clearTimeout(timer);
    timer=null;
    bridge=null;
    userId='';projectId='';queueKey='';initializedKey='';pending={};didInitialize=false;
    lastSuccessful=null;
    serverRevision=null;
    busy=false;
  }
  window.addEventListener('online',()=>{if(active)schedule(0);});
  window.addEventListener('offline',()=>{if(active)notify('Offline · changes saved locally','offline');});
  window.addEventListener('focus',()=>{if(active)schedule(0);});
  document.addEventListener('visibilitychange',()=>{if(active && !document.hidden)schedule(0);});
  return {start,stop,syncNow,onLocalChange,get pendingCount(){return currentPendingCount();}};
})();
