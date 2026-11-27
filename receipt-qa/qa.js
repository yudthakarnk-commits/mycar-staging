'use strict';
const el=id=>document.getElementById(id);
function ctx(){return {vehicle:{id:'qa',plate:el('qa-plate').value},records:[],id:'',key:'qa|'+el('qa-plate').value,refresh:()=>{el('qa-validation').textContent='Values applied; nothing saved.';}};}
el('receipt-file-input').addEventListener('change',e=>{const context=()=>ctx();context.key=ctx().key;MYCARReceiptUI.scan(e,context);});
el('qa-plate').addEventListener('change',()=>{MYCARReceiptUI.reset();el('receipt-file-input').value='';});
el('receipt-plate-confirm').addEventListener('input',()=>MYCARReceiptUI.plateChanged());
el('receipt-apply').addEventListener('click',()=>MYCARReceiptUI.apply());
el('qa-validate').addEventListener('click',()=>{const f={date:el('field-date').value,odometer:el('fuel-odometer').value,liters:el('fuel-liters').value,cost:el('fuel-cost').value,fuelType:el('fuel-type-name').value};el('qa-validation').textContent=MYCARReceipt.validateFuel(f)?'PASS — valid test values; no record saved.':'FAIL — check required fields.';});
el('qa-reset').addEventListener('click',()=>{MYCARReceiptUI.reset();for(const id of ['receipt-file-input','field-date','fuel-odometer','fuel-liters','fuel-cost','fuel-type-name','fuel-station'])el(id).value='';el('qa-validation').textContent='';});
(async()=>{try{await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});await navigator.serviceWorker.ready;el('qa-ready').textContent='Offline page ready. Scan one image online first.';}catch(e){el('qa-ready').textContent='Offline page setup failed: '+e.message;}})();