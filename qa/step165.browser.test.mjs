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
 await page.addInitScript(seed=>{for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v)},storage);
 let revision=0,writes=0,lose=!!option.lostAck;
 const ops=new Map();
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
  await x.page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:15000});
  assert.match(await x.page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),/127\.0\.0\.1:4173\/service-worker\.js/);
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
  const old={'fuel|f_old':{collection:'fuel',record_id:'f_old',payload:{id:'f_old',liters:35},deleted:false}};
  const text=JSON.stringify(old),key=queueKey(UID);
  const x=await fixture(browser,{storage:{[key]:text}});
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
