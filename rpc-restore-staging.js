/* MYCAR STAGING — Transactional Merge Restore UI v1.
 * Not production. No automatic restore, deletion, or fallback to legacy imports.
 * Files are converted to at most 500 records and sent only to the STAGING RPC.
 */
(function(){
'use strict';
const PROJECT='https://dlbshlvyhfwkorooxbnu.supabase.co';
const COLS=['vehicles','fuel','maintenance','tax','trips','other'];
const ID=/^[A-Za-z0-9_-]{1,128}$/;
let prepared=null, preview=null, busy=false;
const byId=id=>document.getElementById(id);
const label=(text,color)=>{const x=byId('mycar-restore-status');if(x){x.textContent=text;x.style.color=color||'#1e3a8a';}};
const key=()=> 'mycar_staging_restore_v1:'+AuthManager.projectId+':'+AuthManager.currentUser.id;
function ready(){
 if(AuthManager.config?.url!==PROJECT || !AuthManager.currentUser?.id)
  throw Error('Restore is restricted to a signed-in MYCAR-STAGING account.');
 if(MYCARCloud.pendingCount!==0)throw Error('Pending offline records exist. Resolve all pending changes first.');
 const d=MYCARCloud.diagnostics();
 if(!d.active||d.busy||d.conflictWaiting||d.storedFlight||d.restoreMaintenance)
  throw Error('Sync is not idle or a conflict is unresolved. Retry when fully Synced.');
 if(navigator.onLine===false)throw Error('Offline: Restore requires a network connection.');
}
async function call(name,payload){
 if(AuthManager.config?.url!==PROJECT)throw Error('Not connected to staging.');
 const token=await AuthManager.getAccessToken();
 const response=await fetch(PROJECT+'/rest/v1/rpc/'+name,{
  method:'POST',cache:'no-store',headers:{
   'apikey':AuthManager.config.key,'Authorization':'Bearer '+token,
   'Accept':'application/json','Content-Type':'application/json'
  },body:JSON.stringify(payload)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.error||'RPC failed ('+response.status+')');
 return data;
}
function convert(file){
 if(!file||typeof file!=='object'||Array.isArray(file) || file.type==='MYCAR_PERIOD_REPORT_NOT_FOR_RESTORE')
  throw Error('Select a full MYCAR JSON backup, not a monthly report.');
 for(const col of COLS)if(!Array.isArray(file[col]))throw Error('Missing '+col+' collection.');
 if(!file.vehicles.length)throw Error('Backup needs at least one vehicle.');
 const vehicleIds=new Set(), rows=[], seen=new Set();
 for(const item of file.vehicles){
  if(!item||typeof item!=='object'||Array.isArray(item)||!ID.test(item.id)||typeof item.name!=='string'||!item.name.trim())
   throw Error('Invalid vehicle ID or name.');
  if(vehicleIds.has(item.id))throw Error('Duplicate vehicle ID: '+item.id);
  vehicleIds.add(item.id);
 }
 for(const col of COLS)for(const item of file[col]){
  if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!ID.test(item.id))
   throw Error('Invalid record in '+col);
  if(col!=='vehicles' && (!ID.test(item.vehicleId)||!vehicleIds.has(item.vehicleId)))
   throw Error('Unknown vehicle in '+col+' / '+item.id);
  const k=col+'|'+item.id;
  if(seen.has(k))throw Error('Duplicate record: '+k);
  seen.add(k);
  rows.push({collection:col,record_id:item.id,payload:item,deleted:false});
 }
 if(rows.length>500)throw Error('Restore RPC allows a maximum of 500 records.');
 if(JSON.stringify(rows).length>850000)throw Error('Backup is too large for staging RPC (850 KB client limit).');
 return rows;
}
function controls(working){
 busy=working;
 for(const id of ['mycar-restore-file','mycar-restore-preview','mycar-restore-commit','mycar-restore-reverse'])
  if(byId(id))byId(id).disabled=working;
}
async function chooseFile(event){
 prepared=null;preview=null;
 byId('mycar-restore-commit').hidden=true;
 byId('mycar-restore-confirm').value='';
 byId('mycar-restore-summary').textContent='';
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>1000000)throw Error('Backup file must be under 1 MB.');
  const data=JSON.parse(await file.text());
  prepared=convert(data);
  label('Validated '+prepared.length+' records locally. Click Preview on server. No data has changed.');
 }catch(e){label('Backup rejected: '+e.message,'#b91c1c');}
 event.target.value='';
}
async function doPreview(){
 if(!prepared) return label('Choose a valid full JSON backup first.','#b91c1c');
 controls(true);
 try{
  readyForPreview();
  preview=await MYCARCloud.exclusiveRestore(()=>call('mycar_restore_preview',{p_backup:prepared}));
  if(preview.mode!=='merge-only'||!Number.isSafeInteger(Number(preview.revision))||!preview.confirmation_token)
   throw Error('Unexpected restore preview response.');
  byId('mycar-restore-summary').textContent=
   'MERGE ONLY · '+preview.records+' records · Revision '+preview.revision+
   '. Records absent from the backup and existing tombstones remain untouched. '+
   'Existing matching IDs will be updated. A private pre-restore snapshot is created on commit.';
  byId('mycar-restore-commit').hidden=false;
  label('Preview completed. Type RESTORE and confirm explicitly to make server changes.');
 }catch(e){preview=null;byId('mycar-restore-commit').hidden=true;label(e.message,'#b91c1c')}
 finally{controls(false);}
}
function readyForPreview(){
 if(AuthManager.config?.url!==PROJECT || !AuthManager.currentUser?.id)throw Error('Sign in to MYCAR-STAGING.');
 const d=MYCARCloud.diagnostics();
 if(!d.active||d.busy||d.pendingCount||d.storedFlight||d.conflictWaiting||d.restoreMaintenance)
  throw Error('Wait for the Sync queue to be empty and idle before Restore.');
 if(navigator.onLine===false)throw Error('Requires an online connection.');
}
async function resolvedWrite(name,params){
 const requestId=params.p_request_id;
 try{return await call(name,params);}
 catch(e){
  let state=null;
  try{state=await call('mycar_get_sync_state',{p_request_id:requestId});}
  catch(_){}
  if(state?.request?.operation===(name==='mycar_restore_merge'?'restore':'reverse'))return state.request;
  throw e;
 }
}
async function commitRestore(){
 if(!prepared||!preview) return label('Preview the backup again.','#b91c1c');
 if(byId('mycar-restore-confirm').value.trim()!=='RESTORE')
  return label('Type RESTORE to confirm this staging merge.','#b91c1c');
 if(!window.confirm('MYCAR-STAGING ONLY: merge '+prepared.length+' records into your server account? Existing records not in the file will NOT be removed.'))
  return;
 controls(true);
 try{
  readyForPreview();
  const id=crypto.randomUUID();
  const result=await MYCARCloud.exclusiveRestore(async()=>{
   const current=await call('mycar_get_sync_state',{p_request_id:null});
   if(Number(current.revision)!==Number(preview.revision))
    throw Error('STALE_REVISION: server changed after Preview. Preview the backup again.');
   return resolvedWrite('mycar_restore_merge',{
    p_expected_revision:preview.revision,p_request_id:id,p_backup:prepared,
    p_confirmation_token:preview.confirmation_token
   });
  });
  if(result?.operation!=='restore'||!result.ok)throw Error('Unexpected restore response: do not retry with a new request ID.');
  localStorage.setItem(key(),JSON.stringify({requestId:id,revision:result.revision,createdAt:new Date().toISOString()}));
  prepared=null;preview=null;
  byId('mycar-restore-commit').hidden=true;
  byId('mycar-restore-confirm').value='';
  byId('mycar-restore-summary').textContent='';
  label('MERGE RESTORE COMMITTED · revision '+result.revision+
    '. Private snapshot saved. Reverse is possible only before another server write.');
  byId('mycar-restore-reverse').hidden=false;
 }catch(e){label('Restore NOT confirmed: '+e.message+'. Do not use a second backup until status is checked.','#b91c1c');}
 finally{controls(false);}
}
async function reverseRestore(){
 let original;
 try{readyForPreview(); original=JSON.parse(localStorage.getItem(key())||'null');
  if(!original?.requestId||!Number.isSafeInteger(Number(original.revision)))throw Error('No locally confirmed restore to reverse.');
 }catch(e){return label(e.message,'#b91c1c')}
 if(!window.confirm('Reverse the LAST staging restore? This restores the exact server snapshot, including tombstones. It is refused if the account changed since Restore.'))
  return;
 controls(true);
 try{
  const reqId=crypto.randomUUID();
  const result=await MYCARCloud.exclusiveRestore(async()=>{
   const st=await call('mycar_get_sync_state',{p_request_id:original.requestId});
   if(st?.request?.operation!=='restore' || Number(st.revision)!==Number(original.revision))
    throw Error('Reverse requires the immediate restore revision. Another write may have occurred.');
   return resolvedWrite('mycar_reverse_restore',{
    p_expected_revision:original.revision,p_request_id:reqId,p_original_request_id:original.requestId
   });
  });
  if(result?.operation!=='reverse'||!result.ok)throw Error('Unexpected reverse result; check operation status.');
  localStorage.removeItem(key());
  byId('mycar-restore-reverse').hidden=true;
  label('REVERSE RESTORE COMMITTED · revision '+result.revision+'. Original server snapshot restored.');
 }catch(e){label('Reverse NOT confirmed: '+e.message,'#b91c1c');}
 finally{controls(false);}
}
function init(){
 const box=byId('mycar-rpc-restore');if(!box)return;
 byId('mycar-restore-file').addEventListener('change',chooseFile);
 byId('mycar-restore-preview').addEventListener('click',doPreview);
 byId('mycar-restore-commit').addEventListener('click',commitRestore);
 byId('mycar-restore-reverse').addEventListener('click',reverseRestore);
 const msg='RPC Merge Restore (STAGING): Preview first. Never clear data or delete records to test Restore.';
 label(msg);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
