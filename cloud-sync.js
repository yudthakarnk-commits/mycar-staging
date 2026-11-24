/* MYCAR per-user cloud synchronization (Supabase PostgREST, no secret keys).
 * A record is one row; deletions are durable tombstones. Other devices poll
 * changes every 15 seconds and on focus; pending offline edits upload on reconnect.
 * Conflicts are never automatically resolved by last-write-wins.
 */
const MYCARCloud = (() => {
  const COLLECTIONS = ['vehicles','fuel','maintenance','tax','trips','other'];
  const POLL_MS = 15000;
  let active = false, userId = '', projectId = '', timer = null, busy = false;
  let pending = {}, queueKey = '', initializedKey = '', didInitialize = false;
  let bridge = null, generation = 0, lastSuccessful = null;
  let serverRevision = null, knownRemote = null, currentRemote = null, conflictKey = null;
  let knownRevision=null, restoreBarrierRevision=0;
  let lastError = null, lastRpcCheck = null, lastRpcWrite = null, restoreMaintenance = false;
  const QA_TARGET='id_43d90c55-caa8-4c80-9489-f9b95fa4a856';
  let qaLostAckArmed=false, qaLostAckResult=null;
  let qaBeforeCommitArmed=false, qaBeforeCommitResult=null;
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
  const baselineKey=()=>queueKey+':baseline_v3';
  const baselineRevisionKey=()=>queueKey+':baseline_revision_v3';
  function asMap(rows) {
    const out={};
    for(const row of rows)out[keyOf(row.collection,row.record_id)]={payload:row.deleted?{}:row.payload,deleted:!!row.deleted};
    return out;
  }
  const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  function queueEntry(collection, id, payload, deleted) {
    if(!COLLECTIONS.includes(collection)||!isSafeRecord({id})) return;
    const key=keyOf(collection,id),old=pending[key];
    pending[key]={collection,record_id:id,payload:deleted?{}:clone(payload),deleted:!!deleted,
      baseKnown:old ? old.baseKnown===true : knownRemote!==null,
      base:old ? old.base : (knownRemote===null?null:clone(knownRemote[key]??null)),
      baseRevision:old?.baseRevision??knownRevision??serverRevision};
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
    try {
      // STAGING-only, one-shot fault before dispatch. No request leaves the browser.
      // The ordinary saved-flight retry path must recover the same request ID.
      if(name==='mycar_apply_changes' && qaBeforeCommitArmed &&
         AuthManager.config?.url==='https://dlbshlvyhfwkorooxbnu.supabase.co' &&
         payload?.p_operations?.length===1 &&
         payload.p_operations[0].collection==='fuel' &&
         payload.p_operations[0].record_id===QA_TARGET){
        qaBeforeCommitArmed=false;
        qaBeforeCommitResult={stage:'blocked-before-dispatch',requestId:payload.p_request_id,
          beforeRevision:payload.p_expected_revision,at:new Date().toISOString()};
        throw new Error('STAGING_QA_SIMULATED_DROP_BEFORE_DISPATCH');
      }
      const data=await request(AuthManager.config.url+'/rest/v1/rpc/'+name,{method:'POST',body:payload});
      if(name==='mycar_get_sync_state')lastRpcCheck={ok:true,at:new Date().toISOString()};
      if(name==='mycar_apply_changes'){
        lastRpcWrite={ok:true,at:new Date().toISOString()};
        // Explicit, one-shot STAGING QA injection: the RPC already returned a
        // successful committed result, but we deliberately withhold its ack.
        // This tests the real sync-flight recovery path without cutting Wi-Fi.
        if(qaLostAckArmed && payload?.p_operations?.length===1 &&
           payload.p_operations[0].collection==='fuel' &&
           payload.p_operations[0].record_id===QA_TARGET &&
           data?.operation==='apply' && data?.ok===true){
          qaLostAckArmed=false;
          qaLostAckResult={stage:'ack-simulated-lost',requestId:payload.p_request_id,
            beforeRevision:payload.p_expected_revision,commitRevision:data.revision,
            at:new Date().toISOString()};
          throw new Error('STAGING_QA_SIMULATED_LOST_ACK_AFTER_COMMIT');
        }
      }
      return data;
    } catch(error) {
      const code=String(error?.message||error);
      if(name==='mycar_get_sync_state')lastRpcCheck={ok:false,error:code,at:new Date().toISOString()};
      if(name==='mycar_apply_changes')lastRpcWrite={ok:false,error:code,at:new Date().toISOString()};
      throw error;
    }
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
  function conflictFor(remote) {
    for(const [key,op] of Object.entries(pending)){
      const base=Number(op.baseRevision);
      const crossedRestoreBarrier=restoreBarrierRevision>0 &&
        (!Number.isSafeInteger(base) || base<restoreBarrierRevision);
      if(op.baseKnown!==true || crossedRestoreBarrier || !same(op.base,remote[key]??null))
        return {key,op,reason:crossedRestoreBarrier?'Old offline change predates a server Restore.':null};
    }
    return null;
  }
  function showConflict(c) {
    conflictKey=c.key;
    let div=document.getElementById('mycar-conflict-dialog');
    if(!div){
      div=document.createElement('div');div.id='mycar-conflict-dialog';
      Object.assign(div.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'#071527da',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'});
      const box=document.createElement('div');
      Object.assign(box.style,{background:'white',color:'#111827',maxWidth:'460px',width:'100%',borderRadius:'14px',padding:'20px',fontFamily:'system-ui,sans-serif'});
      box.innerHTML='<h2 style="font-size:20px;font-weight:700">Sync conflict</h2><p id="mycar-conflict-text"></p><p style="font-size:12px">Your unsent change is retained until you choose.</p><button type="button" id="mycar-use-server" style="padding:10px;background:#ddd;margin:8px">Keep server</button><button type="button" id="mycar-use-local" style="padding:10px;background:#047857;color:white;margin:8px">Use my change</button>';
      div.appendChild(box);document.body.appendChild(div);
      box.querySelector('#mycar-use-server').onclick=()=>resolveConflict(false);
      box.querySelector('#mycar-use-local').onclick=()=>resolveConflict(true);
    }
    div.style.display='flex';
    div.querySelector('#mycar-conflict-text').textContent=c.op.collection+' / '+c.op.record_id+
      (c.reason?' — '+c.reason:c.op.baseKnown?' changed on the server.':' has unknown original version (previous offline queue).');
    notify('Conflict · choose a version','error');
  }
  function resolveConflict(useLocal){
    if(!conflictKey)return;
    const key=conflictKey,op=pending[key];
    if(op){
      if(useLocal){op.baseKnown=true;op.base=clone(currentRemote?.[key]??null);op.baseRevision=serverRevision;}
      else delete pending[key];
      saveQueue();
    }
    saveFlight(null);conflictKey=null;
    const d=document.getElementById('mycar-conflict-dialog');if(d)d.style.display='none';
    schedule(0);
  }
  function addAllLocalToQueue(local) {
    for(const collection of COLLECTIONS)
      for(const record of local[collection]||[]) if(isSafeRecord(record)) queueEntry(collection,record.id,record,false);
    saveQueue();
  }
  async function flushQueue(expectedGeneration) {
    if (serverRevision === null) throw new Error('Account revision unavailable');
    let flight=readFlight();
    // Check a preexisting request before any conflict decision. It may already be committed.
    if(flight){
      const status=await rpc('mycar_get_sync_state',{p_request_id:flight.requestId});
      if(status?.request?.operation==='apply'){
        serverRevision=Number(status.request.revision);
        for(const [key,sent] of flight.entries){
          if(pending[key] && same(pending[key].payload,sent.payload) && pending[key].deleted===sent.deleted)delete pending[key];
        }
        saveQueue();saveFlight(null);
        return;
      }
      // Never replay an unconfirmed old request without preserving its original revision.
    }
    const collision=conflictFor(currentRemote||{});
    if(collision){showConflict(collision);return;}
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
        if(status?.request?.operation==='apply'){
          result=status.request;
          if(qaLostAckResult?.stage==='ack-simulated-lost' &&
             qaLostAckResult.requestId===flight.requestId){
            qaLostAckResult={...qaLostAckResult,stage:'status-recovered',
              recoveredRevision:result.revision,at:new Date().toISOString()};
          }
        }
        else {
          if(String(error.message||'').includes('STALE_REVISION')){
            // The server rejected this revision; retain pending edits but release the stale flight.
            saveFlight(null);
          }
          throw error;
        }
      }
      if (!active||generation!==expectedGeneration) return;
      serverRevision=Number(result.revision);
      if(qaBeforeCommitResult?.stage==='blocked-before-dispatch' &&
         qaBeforeCommitResult.requestId===flight.requestId){
        qaBeforeCommitResult={...qaBeforeCommitResult,stage:'retry-committed',
          commitRevision:result.revision,at:new Date().toISOString()};
      }
      // Acknowledged writes become the new server baseline for subsequent local edits.
      if(currentRemote){
        for(const [,sent] of flight.entries){
          const k=keyOf(sent.collection,sent.record_id);
          currentRemote[k]={payload:sent.deleted?{}:clone(sent.payload),deleted:!!sent.deleted};
        }
      }
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
    if(!active || busy || restoreMaintenance || !bridge || !AuthManager.currentUser || AuthManager.currentUser.id!==userId) return;
    if(typeof navigator.onLine==='boolean' && !navigator.onLine) {notify('Offline · changes saved locally','offline');return;}
    const expectedGeneration=generation;
    busy=true;
    lastError=null;
    notify(currentPendingCount()?'Uploading changes…':'Checking cloud…','working');
    try {
      const beforeState=await rpc('mycar_get_sync_state',{p_request_id:null});
      const remote=await fetchRows();
      const afterState=await rpc('mycar_get_sync_state',{p_request_id:null});
      if(Number(beforeState.revision)!==Number(afterState.revision))
        throw new Error('Cloud changed during download; retry sync');
      serverRevision=Number(afterState.revision);
      restoreBarrierRevision=Number(afterState.restore_barrier_revision||0);
      currentRemote=asMap(remote);
      if(!active || generation!==expectedGeneration) return;
      const local=bridge.getData();
      if(!didInitialize && remote.length===0 && !currentPendingCount()) addAllLocalToQueue(local);
      const merged=stateFromRows(remote,local,pending);
      bridge.applyData(merged);
      if(currentPendingCount()) await flushQueue(expectedGeneration);
      if(conflictKey) return; // Do not report successful sync while waiting for a decision.
      if(!currentPendingCount()){
        if(qaLostAckResult?.stage==='status-recovered'){
          qaLostAckResult={...qaLostAckResult,
            stage:qaLostAckResult.commitRevision===qaLostAckResult.recoveredRevision &&
                  qaLostAckResult.commitRevision===qaLostAckResult.beforeRevision+1 &&
                  !readFlight()?'pass':'needs-review',
            pendingAfter:currentPendingCount(),revisionAfter:serverRevision,
            at:new Date().toISOString()};
        }
        if(qaBeforeCommitResult?.stage==='retry-committed'){
          qaBeforeCommitResult={...qaBeforeCommitResult,
            stage:qaBeforeCommitResult.commitRevision===qaBeforeCommitResult.beforeRevision+1 &&
                  !readFlight()?'pass':'needs-review',
            pendingAfter:currentPendingCount(),revisionAfter:serverRevision,
            at:new Date().toISOString()};
        }
        knownRemote=clone(currentRemote);
        localStorage.setItem(baselineKey(),JSON.stringify(knownRemote));
        knownRevision=serverRevision;
        localStorage.setItem(baselineRevisionKey(),String(knownRevision));
      }
      if(!active || generation!==expectedGeneration) return;
      localStorage.setItem(initializedKey,'true');
      didInitialize=true;
      lastSuccessful=new Date();
      notify(currentPendingCount()?`${currentPendingCount()} edits pending`:'Synced · '+lastSuccessful.toLocaleTimeString(),'success');
    } catch(error) {
      if(active && generation===expectedGeneration) {
        lastError=String(error.message||'Unknown sync error');
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
    try{const old=JSON.parse(localStorage.getItem(baselineKey())||'null');knownRemote=old&&typeof old==='object'&&!Array.isArray(old)?old:null;}
    catch(_){knownRemote=null;}
    const rev=localStorage.getItem(baselineRevisionKey());
    knownRevision=rev!==null && Number.isSafeInteger(Number(rev))?Number(rev):null;
    currentRemote=null;conflictKey=null;restoreBarrierRevision=0;
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
    lastSuccessful=null;lastError=null;lastRpcCheck=null;lastRpcWrite=null;
    qaLostAckArmed=false;qaLostAckResult=null;
    qaBeforeCommitArmed=false;qaBeforeCommitResult=null;
    serverRevision=null;knownRemote=null;knownRevision=null;currentRemote=null;conflictKey=null;restoreBarrierRevision=0;restoreMaintenance=false;
    const d=document.getElementById('mycar-conflict-dialog');if(d)d.remove();
    busy=false;
  }
  window.addEventListener('online',()=>{if(active)schedule(0);});
  window.addEventListener('offline',()=>{if(active)notify('Offline · changes saved locally','offline');});
  window.addEventListener('focus',()=>{if(active)schedule(0);});
  document.addEventListener('visibilitychange',()=>{if(active && !document.hidden)schedule(0);});
  function diagnostics(){
    return {
      clientVersion:'staging-conflict-v3-diagnostics',
      active,online:navigator.onLine,busy,restoreMaintenance,
      pendingCount:currentPendingCount(),
      unknownBaseCount:Object.values(pending).filter(op=>op.baseKnown!==true).length,
      serverRevision,restoreBarrierRevision,baselineKnown:knownRemote!==null,baselineRevision:knownRevision,
      conflictWaiting:!!conflictKey, storedFlight:!!readFlight(),
      lastRpcCheck,lastRpcWrite,lastError,
      qaLostAckArmed,qaLostAckResult,qaBeforeCommitArmed,qaBeforeCommitResult,
      lastSuccessful:lastSuccessful?.toISOString()||null,
      projectMatchesStaging:AuthManager.config?.url==='https://dlbshlvyhfwkorooxbnu.supabase.co'
    };
  }
  async function exclusiveRestore(action, options={}) {
    if(!active || restoreMaintenance || busy || !bridge || !AuthManager.currentUser || AuthManager.currentUser.id!==userId)
      throw new Error('Sync is busy or this account is not ready. Wait until Synced and retry.');
    if(navigator.onLine===false)throw new Error('Restore requires an online connection.');
    if(currentPendingCount()!==0 || readFlight() || conflictKey)
      throw new Error('Pending edits or unresolved sync are present. Resolve them before Restore; nothing was changed.');
    if(typeof action!=='function')throw new Error('Invalid restore operation');
    restoreMaintenance=true;
    if(timer)clearTimeout(timer);
    timer=null;
    try{
      const value=await action();
      // Restore/reverse commit changes cloud state outside the ordinary sync flight.
      // Clear only the cached baseline (not an offline queue) and refresh from server.
      if(options.mutates!==false){
        serverRevision=null;currentRemote=null;knownRemote=null;
        localStorage.removeItem(baselineKey());
        localStorage.removeItem(baselineRevisionKey());
        knownRevision=null;
        localStorage.setItem(initializedKey,'true');
        didInitialize=true;
      }
      return value;
    }finally{
      restoreMaintenance=false;
      if(active)schedule(0);
    }
  }
  function armLostAckTest(){
    if(AuthManager.config?.url!=='https://dlbshlvyhfwkorooxbnu.supabase.co'||
       !active||busy||restoreMaintenance||currentPendingCount()||conflictKey||readFlight()||
       serverRevision===null||!navigator.onLine||qaBeforeCommitArmed)
      throw new Error('STAGING must be online, idle, and fully synced with zero pending records.');
    if(!currentRemote?.[keyOf('fuel',QA_TARGET)] || currentRemote[keyOf('fuel',QA_TARGET)].deleted)
      throw new Error('The designated staging test Fuel record is missing.');
    qaBeforeCommitArmed=false;
    qaLostAckArmed=true;
    qaLostAckResult={stage:'armed',beforeRevision:serverRevision,at:new Date().toISOString()};
    return 'Test armed for the 10,409 km Fuel record only. Edit and save this record once.';
  }
  function cancelLostAckTest(){
    qaLostAckArmed=false;
    if(qaLostAckResult?.stage==='armed')qaLostAckResult={stage:'cancelled',at:new Date().toISOString()};
  }
  function armBeforeCommitTest(){
    if(AuthManager.config?.url!=='https://dlbshlvyhfwkorooxbnu.supabase.co'||
       !active||busy||restoreMaintenance||currentPendingCount()||conflictKey||readFlight()||
       serverRevision===null||!navigator.onLine||qaLostAckArmed)
      throw new Error('STAGING must be online, idle, and fully synced with zero pending records.');
    if(!currentRemote?.[keyOf('fuel',QA_TARGET)] || currentRemote[keyOf('fuel',QA_TARGET)].deleted)
      throw new Error('The designated staging test Fuel record is missing.');
    qaBeforeCommitArmed=true;
    qaBeforeCommitResult={stage:'armed',beforeRevision:serverRevision,at:new Date().toISOString()};
    return 'Before-dispatch simulation armed. Edit and save the 10,409 km Fuel record once.';
  }
  function cancelBeforeCommitTest(){
    qaBeforeCommitArmed=false;
    if(qaBeforeCommitResult?.stage==='armed')
      qaBeforeCommitResult={stage:'cancelled',at:new Date().toISOString()};
  }
  return {start,stop,syncNow,onLocalChange,diagnostics,exclusiveRestore,armLostAckTest,cancelLostAckTest,
    armBeforeCommitTest,cancelBeforeCommitTest,
    get pendingCount(){return currentPendingCount();}};
})();
