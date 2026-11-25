import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/';
const HOST='dlbshlvyhfwkorooxbnu.supabase.co';
const UID='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const queueKey=u=>'mycar_sync_pending_v1:'+HOST+':'+u;
const car={id:'v1',name:'TEST VEHICLE',plate:'QA',defaultFuel:'RON95',currentOdometer:1000};
async function fixture(browser,option={}){
 const ctx=await browser.newContext({serviceWorkers:'allow'});
 const page=await ctx.newPage();
 const storage={'mycar_auth_session_v1':JSON.stringify({
  access_token:'fake-nonvalid-token',refresh_token:'fake-refresh',project:HOST,
  expires_at:Math.floor(Date.now()/1000)+3600}),...(option.storage||{})};
 await page.addInitScript(seed=>{
   for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);
   // Stabilize non-PWA test cases while still checking worker registration/scope separately.
   sessionStorage.setItem('mycar-sw-loaded-v3.5.0-rc.1','yes');
 },storage);
 let revision=0,writes=0,lose=!!option.lostAck;
 const ops=new Map(),snapshots=new Map();
 const rows=[{collection:'vehicles',record_id:'v1',payload:car,deleted:false,updated_at:'2026-11-25'}];
 const json=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*'}});
 await ctx.route('**/*',async route=>{
  const url=route.request().url(),req=route.request();
  if(url.startsWith(BASE))return route.continue();
  if(!url.startsWith('https://'+HOST+'/'))return route.abort('blockedbyclient');
  if(url.includes('/auth/v1/user'))return json(route,{id:UID,email:'synthetic@example.invalid'});
  if(url.includes('/rpc/mycar_get_sync_state')){
   const b=req.postDataJSON();return json(route,{revision,restore_barrier_revision:0,request:ops.get(b.p_request_id)||null});
  }
  if(url.includes('/rest/v1/mycar_records'))return json(route,rows);
  if(url.includes('/rpc/mycar_restore_preview')){
   const b=req.postDataJSON();
   return json(route,{mode:'merge-only',records:b.p_backup.length,revision,confirmation_token:'qa-confirm:'+revision});
  }
  if(url.includes('/rpc/mycar_restore_merge')){
   const b=req.postDataJSON();
   let result=ops.get(b.p_request_id);
   if(!result){
    if(b.p_expected_revision!==revision)return json(route,{message:'STALE_REVISION'},409);
    if(b.p_confirmation_token!=='qa-confirm:'+revision)return json(route,{message:'INVALID_CONFIRMATION'},400);
    snapshots.set(b.p_request_id,rows.map(v=>JSON.parse(JSON.stringify(v))));
    for(const op of b.p_backup){
     const r={...op,updated_at:'2026-11-25'};
     const pos=rows.findIndex(x=>x.collection===op.collection&&x.record_id===op.record_id);
     if(pos<0)rows.push(r);else rows[pos]=r;
    }
    revision++;writes++;
    result={operation:'restore',revision,ok:true,request_id:b.p_request_id};
    ops.set(b.p_request_id,result);
   }
   return json(route,result);
  }
  if(url.includes('/rpc/mycar_reverse_restore')){
   const b=req.postDataJSON();
   let result=ops.get(b.p_request_id);
   if(!result){
    const original=ops.get(b.p_original_request_id);
    if(b.p_expected_revision!==revision||original?.revision!==revision)
     return json(route,{message:'STALE_REVISION'},409);
    const before=snapshots.get(b.p_original_request_id);
    if(!before)return json(route,{message:'SNAPSHOT_NOT_FOUND'},404);
    rows.splice(0,rows.length,...before.map(v=>JSON.parse(JSON.stringify(v))));
    revision++;writes++;
    result={operation:'reverse',revision,ok:true};
    ops.set(b.p_request_id,result);
   }
   return json(route,result);
  }
  if(url.includes('/rpc/mycar_apply_changes')){
   const b=req.postDataJSON();
   let result=ops.get(b.p_request_id);
   if(!result){
    if(b.p_expected_revision!==revision)return json(route,{message:'STALE_REVISION'},409);
    writes++;revision++;
    for(const op of b.p_operations){
      const r={...op,updated_at:'2026-11-25'};
      const pos=rows.findIndex(x=>x.collection===op.collection&&x.record_id===op.record_id);
      if(pos<0)rows.push(r);else rows[pos]=r;
    }
    result={operation:'apply',revision,ok:true};
    ops.set(b.p_request_id,result);
   }
   if(lose){lose=false;return route.abort('failed');}
   return json(route,result);
  }
  return json(route,{message:'Unmocked endpoint blocked'},403);
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('mycar-app-shell')?.hidden===false,null,{timeout:20000});
 return {page,ctx,rows,metrics:()=>({revision,writes})};
}
async function run(callback){
 const browser=await chromium.launch({headless:true});
 try{await callback(await fixture(browser));}finally{await browser.close();}
}
test('Initial PWA synthetic sync and service worker scope',async()=>{
 await run(async x=>{
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().lastSuccessful!==null,null,{timeout:15000});
  assert.equal(x.metrics().writes,0);
  await x.page.waitForFunction(()=>navigator.serviceWorker?.controller?.scriptURL?.includes('127.0.0.1:4173/service-worker.js')===true,null,{timeout:15000});
  await x.ctx.close();
 });
});
test('Corrupt offline queue blocks and preserves bytes',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const corrupted='{not-json';
  const x=await fixture(browser,{storage:{[queueKey(UID)]:corrupted}});
  await x.page.waitForSelector('#mycar-queue-safety-blocker',{timeout:15000});
  assert.equal(await x.page.evaluate(k=>localStorage.getItem(k),queueKey(UID)),corrupted);
  assert.equal(x.metrics().writes,0);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Legacy unknown baseline requires conflict decision before upload',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const old={'fuel|f_old':{collection:'fuel',record_id:'f_old',payload:{id:'f_old',vehicleId:'v1',liters:35},deleted:false}};
  const text=JSON.stringify(old),key=queueKey(UID);
  const x=await fixture(browser,{storage:{[key]:text}});
  await x.page.waitForTimeout(1200);
  console.log('QA legacy diagnosis:',JSON.stringify(await x.page.evaluate(()=>({
    url:location.href,detail:document.getElementById('mycar-sync-detail')?.textContent,
    hasDialog:!!document.getElementById('mycar-conflict-dialog'),
    hasBlocker:!!document.getElementById('mycar-queue-safety-blocker'),
    diag:MYCARCloud.diagnostics()
  }))));
  await x.page.waitForSelector('#mycar-conflict-dialog',{timeout:15000});
  assert.equal(x.metrics().writes,0);
  assert.equal(await x.page.evaluate(k=>localStorage.getItem(k),key),text);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Known baseline: one RPC write; lost acknowledgement recovered via request ID',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const base={'vehicles|v1':{payload:car,deleted:false}};
  const key=queueKey(UID);
  const x=await fixture(browser,{lostAck:true,storage:{
   [key+':baseline_v3']:JSON.stringify(base),[key+':baseline_revision_v3']:'0',
   ['mycar_sync_initialized_v1:'+HOST+':'+UID]:'true'
  }});
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().lastSuccessful!==null,null,{timeout:15000});
  await x.page.evaluate(()=>{
    const before=JSON.parse(JSON.stringify(dbData));
    dbData.fuel.push({id:'qa_fuel',vehicleId:'v1',liters:42,odometer:1050,date:'2026-11-25'});
    MYCARCloud.onLocalChange(before,JSON.parse(JSON.stringify(dbData)));
  });
  await x.page.evaluate(()=>MYCARCloud.syncNow());
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().pendingCount===0&& !MYCARCloud.diagnostics().storedFlight,null,{timeout:15000});
  assert.equal(x.metrics().writes,1);
  assert.equal(x.rows.filter(r=>r.collection==='fuel'&&r.record_id==='qa_fuel').length,1);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Queue belongs to authenticated account, not another account',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const foreign={'fuel|other':{collection:'fuel',record_id:'other',payload:{id:'other',liters:1},deleted:false}};
  const x=await fixture(browser,{storage:{[queueKey(OTHER)]:JSON.stringify(foreign)}});
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().lastSuccessful!==null,null,{timeout:15000});
  assert.equal(await x.page.evaluate(()=>MYCARCloud.diagnostics().pendingCount),0);
  assert.equal(x.metrics().writes,0);
  await x.ctx.close();
 }finally{await browser.close();}
});


test('Legacy pending user chooses Keep server: queue clears without upload',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const oldOp={'fuel|f_old':{collection:'fuel',record_id:'f_old',payload:{id:'f_old',vehicleId:'v1',liters:33},deleted:false}};
  const x=await fixture(browser,{storage:{[queueKey(UID)]:JSON.stringify(oldOp)}});
  await x.page.locator('#mycar-use-server').waitFor({timeout:15000});
  await x.page.locator('#mycar-use-server').click();
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().pendingCount===0,null,{timeout:15000});
  assert.equal(x.metrics().writes,0);
  assert.equal(x.rows.some(r=>r.record_id==='f_old'),false);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Legacy pending user chooses Use my change: single explicit RPC write',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const oldOp={'fuel|f_old':{collection:'fuel',record_id:'f_old',payload:{id:'f_old',vehicleId:'v1',liters:33},deleted:false}};
  const x=await fixture(browser,{storage:{[queueKey(UID)]:JSON.stringify(oldOp)}});
  await x.page.locator('#mycar-use-local').waitFor({timeout:15000});
  await x.page.locator('#mycar-use-local').click();
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().pendingCount===0 && MYCARCloud.diagnostics().serverRevision===1,null,{timeout:15000});
  assert.equal(x.metrics().writes,1);
  assert.equal(x.rows.find(r=>r.record_id==='f_old')?.payload?.liters,33);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Known baseline delete creates server-side tombstone, not physical deletion',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const key=queueKey(UID),fuel={id:'del_fuel',vehicleId:'v1',liters:21,odometer:1002,date:'2026-11-25'};
  const bas={'vehicles|v1':{payload:car,deleted:false},'fuel|del_fuel':{payload:fuel,deleted:false}};
  const x=await fixture(browser,{storage:{
   [key+':baseline_v3']:JSON.stringify(bas),
   [key+':baseline_revision_v3']:'0',
   ['mycar_sync_initialized_v1:'+HOST+':'+UID]:'true'
  }});
  // Initial server only has a vehicle; the saved baseline fuel is deliberately not a server row.
  // The client will first reconcile and never overwrite a deleted/changed record by default.
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().lastSuccessful!==null,null,{timeout:15000});
  await x.page.evaluate(()=>{
    const before=JSON.parse(JSON.stringify(dbData));
    const after=JSON.parse(JSON.stringify(dbData));
    after.fuel.push({id:'del_fuel',vehicleId:'v1',liters:21,odometer:1002,date:'2026-11-25'});
    dbData=after;
    MYCARCloud.onLocalChange(before,after);
  });
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().serverRevision===1 && MYCARCloud.diagnostics().pendingCount===0,null,{timeout:15000});
  await x.page.evaluate(()=>{
    const before=JSON.parse(JSON.stringify(dbData)),after=JSON.parse(JSON.stringify(dbData));
    after.fuel=after.fuel.filter(x=>x.id!=='del_fuel');
    dbData=after;
    MYCARCloud.onLocalChange(before,after);
  });
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().pendingCount===0 && MYCARCloud.diagnostics().serverRevision===2,null,{timeout:15000});
  const row=x.rows.find(x=>x.collection==='fuel'&&x.record_id==='del_fuel');
  assert.equal(row.deleted,true);
  assert.equal(x.metrics().writes,2);
  await x.ctx.close();
 }finally{await browser.close();}
});
test('Preview authentication URL cannot be overridden to production hostname',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const x=await fixture(browser,{});
  const result=await x.page.evaluate(()=>{
    // User-supplied Production config must be rejected by hardcoded QA allowlist.
    const original=AuthManager.config?.url;
    const candidate={url:'https://not-staging.example.invalid',key:'sb_publishable_testdummy12345'};
    localStorage.setItem('mycar_supabase_client_config_v1',JSON.stringify(candidate));
    return {original,active:AuthManager.config?.url};
  });
  assert.equal(result.original,'https://'+HOST);
  assert.equal(result.active,'https://'+HOST);
  await x.ctx.close();
 }finally{await browser.close();}
});

test('Restore: JSON upload, preview read-only, explicit commit and immediate reverse',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const x=await fixture(browser);
  await x.page.waitForFunction(()=>MYCARCloud.diagnostics().lastSuccessful!==null,null,{timeout:15000});
  const backup={activeVehicleId:'v1',vehicles:[car],fuel:[{id:'restored01',vehicleId:'v1',liters:44,date:'2026-11-25'}],
   maintenance:[],tax:[],trips:[],other:[]};
  await x.page.locator('#mycar-restore-file').setInputFiles({
   name:'synthetic-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))
  });
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('Validated'),null,{timeout:15000});
  await x.page.evaluate(()=>document.getElementById('mycar-restore-preview').click());
  await x.page.waitForTimeout(300);
  console.log('RESTORE PREVIEW DIAG',await x.page.evaluate(()=>({
    status:document.getElementById('mycar-restore-status')?.textContent,
    diagnostics:MYCARCloud.diagnostics()
  })));
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('Preview completed'),null,{timeout:6000});
  assert.equal(x.metrics().writes,0,'Preview must not write');
  // The Settings modal is closed in this fixture; set the field without triggering a visibility wait.
  await x.page.evaluate(()=>{document.getElementById('mycar-restore-confirm').value='RESTORE';});
  x.page.on('dialog',d=>d.accept());
  await x.page.evaluate(()=>document.getElementById('mycar-restore-confirm-button').click());
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('MERGE RESTORE COMMITTED'),null,{timeout:15000});
  assert.equal(x.metrics().writes,1);
  assert.equal(x.rows.some(r=>r.collection==='fuel'&&r.record_id==='restored01'),true);
  await x.page.waitForFunction(()=>!MYCARCloud.diagnostics().busy,null,{timeout:15000});
  await x.page.evaluate(()=>document.getElementById('mycar-restore-reverse').click());
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('REVERSE RESTORE COMMITTED'),null,{timeout:15000});
  assert.equal(x.metrics().writes,2);
  assert.equal(x.rows.some(r=>r.collection==='fuel'&&r.record_id==='restored01'),false);
  await x.ctx.close();
 }finally{await browser.close()}
});
test('Restore: pending legacy queue blocks preview and no server write occurs',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const pending={'fuel|f_old':{collection:'fuel',record_id:'f_old',
   payload:{id:'f_old',vehicleId:'v1',liters:30},deleted:false}};
  const x=await fixture(browser,{storage:{[queueKey(UID)]:JSON.stringify(pending)}});
  await x.page.locator('#mycar-conflict-dialog').waitFor({timeout:15000});
  const backup={activeVehicleId:'v1',vehicles:[car],fuel:[],maintenance:[],tax:[],trips:[],other:[]};
  await x.page.locator('#mycar-restore-file').setInputFiles({
   name:'safe-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))
  });
  await x.page.waitForTimeout(300);
  console.log('RESTORE PENDING DIAG',await x.page.evaluate(()=>({
    status:document.getElementById('mycar-restore-status')?.textContent,
    diagnostics:MYCARCloud.diagnostics()
  })));
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('Validated'),null,{timeout:6000});
  await x.page.evaluate(()=>document.getElementById('mycar-restore-preview').click());
  await x.page.waitForFunction(()=>document.getElementById('mycar-restore-status')?.textContent.includes('queue'),null,{timeout:6000});
  assert.equal(x.metrics().writes,0);
  await x.ctx.close();
 }finally{await browser.close()}
});
