'use strict';
const el=id=>document.getElementById(id);
function ctx(){return {vehicle:{id:'qa',plate:el('qa-plate').value},records:[],id:'',key:'qa|'+el('qa-plate').value,refresh:()=>{el('qa-validation').textContent='Values applied; nothing saved.';}};}
el('receipt-file-input').addEventListener('change',e=>{const context=()=>ctx();context.key=ctx().key;MYCARReceiptUI.scan(e,context);});
el('qa-plate').addEventListener('change',()=>{MYCARReceiptUI.reset();el('receipt-file-input').value='';});
el('receipt-plate-confirm').addEventListener('input',()=>MYCARReceiptUI.plateChanged());
el('receipt-apply').addEventListener('click',()=>MYCARReceiptUI.apply());
el('qa-validate').addEventListener('click',()=>{const f={date:el('field-date').value,odometer:el('fuel-odometer').value,liters:el('fuel-liters').value,cost:el('fuel-cost').value,fuelType:el('fuel-type-name').value};el('qa-validation').textContent=MYCARReceipt.validateFuel(f)?'PASS — valid test values; no record saved.':'FAIL — check required fields.';});
el('qa-reset').addEventListener('click',()=>{MYCARReceiptUI.reset();for(const id of ['receipt-file-input','field-date','fuel-odometer','fuel-liters','fuel-cost','fuel-type-name','fuel-station'])el(id).value='';el('qa-validation').textContent='';});
(async()=>{try{
 el('receipt-file-input').disabled=true;
 const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
 await reg.update().catch(()=>{});
 const deadline=Date.now()+120000;
 while(Date.now()<deadline){
  const controller=navigator.serviceWorker.controller;
  const cacheName='mycar-receipt-qa:'+reg.scope+':cold-start-v2';
  if(controller&&controller.scriptURL===new URL('./service-worker.js',location.href).href&&(await caches.keys()).includes(cacheName)){
   const cache=await caches.open(cacheName);
   const names=['index.html','qa.js','fuel-receipt.js','fuel-receipt-ui.js','manifest.webmanifest','vendor/ocr/tesseract.min.js','vendor/ocr/worker.min.js','vendor/ocr/core/tesseract-core-lstm.wasm.js','vendor/ocr/core/tesseract-core-lstm.wasm','vendor/ocr/core/tesseract-core-simd-lstm.wasm.js','vendor/ocr/core/tesseract-core-simd-lstm.wasm','vendor/ocr/lang/eng.traineddata.gz'];
   if((await Promise.all(names.map(n=>cache.match(new URL(n,reg.scope).href)))).every(Boolean)&&!reg.installing&&!reg.waiting){el('qa-ready').textContent='Offline package verified — 12/12 files · cold-start-v2';el('receipt-file-input').disabled=false;return;}
  }
  await new Promise(r=>setTimeout(r,500));
 }
 throw Error('Offline package not verified; reconnect and reload.');
}catch(e){el('qa-ready').textContent='Offline setup failed: '+e.message;el('receipt-file-input').disabled=false;}})();