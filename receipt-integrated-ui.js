(function(){
'use strict';
const el=id=>document.getElementById(id),VERSION='mycar-paddle-integrated-v9-1',ORIGIN=location.origin;
let frame=null,ready=null,pending=null,generation=0,seq=0,result=null,applied=null,url=null;
const fields={'field-date':'date','fuel-odometer':'odometer','fuel-liters':'liters','fuel-cost':'total','fuel-type-name':'fuelType','fuel-station':'station'};
const context=()=>window.MYCARReceiptContext?.();
const same=(a,b)=>!!a&&!!b&&a.account===b.account&&a.vehicle.id===b.vehicle.id&&a.vehicle.plate===b.vehicle.plate&&a.id===b.id;
function status(s){el('receipt-status').textContent=s;el('receipt-status').classList.remove('hidden');}
function destroy(){for(const x of [ready,pending])if(x){clearTimeout(x.timer);x.reject(Error('OCR cancelled'));}ready=pending=null;frame?.remove();frame=null;}
function clearReview(){result=null;el('receipt-review').hidden=true;el('receipt-review').textContent='';el('receipt-plate-box').hidden=true;el('receipt-plate-confirm').value='';el('receipt-confirm').checked=false;el('receipt-confirm-box').hidden=true;el('receipt-apply').hidden=true;el('receipt-apply').disabled=true;}
function reset(){generation++;destroy();clearReview();applied=null;if(url)URL.revokeObjectURL(url);url=null;el('receipt-preview').removeAttribute('src');el('receipt-preview').classList.add('hidden');el('receipt-status').classList.add('hidden');el('receipt-status').textContent='';el('receipt-file-input').value='';}
window.addEventListener('pagehide',reset);
window.addEventListener('message',e=>{
 if(!frame||e.origin!==ORIGIN||e.source!==frame.contentWindow||e.data?.version!==VERSION)return;
 const d=e.data;
 if(d.type==='ready'&&ready){const x=ready;ready=null;clearTimeout(x.timer);x.resolve();return;}
 if(!pending||d.id!==pending.id)return;
 if(d.type==='progress'){status(String(d.message).slice(0,180));return;}
 if(d.type==='result'||d.type==='error'){const x=pending;pending=null;clearTimeout(x.timer);d.type==='error'?x.reject(Error(String(d.message))):x.resolve(d.value);}
});
async function ensure(){
 if(frame&&!ready)return;
 if(frame)throw Error('OCR is already starting');
 frame=document.createElement('iframe');frame.hidden=true;frame.title='Local receipt OCR';frame.setAttribute('sandbox','allow-scripts allow-same-origin');
 const promise=new Promise((resolve,reject)=>{ready={resolve,reject,timer:setTimeout(()=>{ready=null;reject(Error('OCR runtime did not load'));},20000)};});
 frame.src=new URL('./paddle-integrated/?bridge=1',location.href).href;document.body.appendChild(frame);await promise;
}
async function request(type,file){
 const token=generation;await ensure();if(token!==generation||!frame)throw Error('OCR cancelled');if(pending)throw Error('OCR busy');
 const id=++seq;return new Promise((resolve,reject)=>{pending={id,resolve,reject,timer:setTimeout(()=>{pending=null;destroy();reject(Error('OCR request timed out'));},type==='prepare'?200000:65000)};frame.contentWindow.postMessage({version:VERSION,id,type,file},ORIGIN);});
}
function review(){
 if(!result)return;const c=context();if(!same(c,result.c)){reset();return;}
 const r=result.r,g=window.MYCARReceiptGuard.check(r,c,el('receipt-plate-confirm').value),list=el('receipt-review');list.textContent='';
 for(const [label,key] of [['Date','date'],['Odometer','odometer'],['Litres','liters'],['RM/litre','price'],['Total RM','total'],['Plate','plate'],['Fuel','fuelType'],['Station','station']]){
 const line=document.createElement('div');line.textContent=label+': '+(r[key]??'Not recognized');list.appendChild(line);}
 const notice=(message,kind)=>{const line=document.createElement('div');line.className='receipt-notice receipt-notice-'+kind;line.textContent=message;list.appendChild(line);};
 for(const w of g.errors)notice('Blocked: '+w,'error');
 for(const w of g.warnings)notice(w,'warning');
 const rawWarnings=Array.isArray(r.warnings)?r.warnings:[];
 if(rawWarnings.some(w=>/detected in one OCR pass only\.$/.test(w)))notice('Single OCR pass: compare all recognized values with the receipt.','info');
 for(const w of new Set(rawWarnings.filter(w=>!/detected in one OCR pass only\.$/.test(w))))notice(w,'warning');
 list.hidden=false;el('receipt-plate-box').hidden=!!r.plate;el('receipt-confirm-box').hidden=false;el('receipt-apply').hidden=false;el('receipt-apply').disabled=!!g.errors.length||!el('receipt-confirm').checked;
}
async function scan(event){
 const file=event.target.files?.[0];if(!file)return;const c=context();if(!c){status('Open a signed-in Fuel Record first.');return;}
 // Keep an already applied guard until the form is closed or new valid values are applied.
 const prior=applied;reset();applied=prior;const token=generation;
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){status('Choose an image under 20 MB or enter manually.');return;}
 url=URL.createObjectURL(file);el('receipt-preview').src=url;el('receipt-preview').classList.remove('hidden');status('Loading local PaddleOCR V9…');
 try{const r=await request('scan',file);if(token!==generation||!same(context(),c))return;result={r,c};review();status('Compare every value with the receipt. Nothing has been saved.');}
 catch(e){if(token===generation){destroy();status('OCR unavailable: '+e.message+'. Enter values manually.');}}
}
async function prepare(){
 if(pending||ready){status('OCR is busy.');return;}const c=context(),token=generation;if(!c)return;
 status('Preparing offline package…');try{const v=await request('prepare');if(token===generation&&same(context(),c))status(String(v));}catch(e){if(token===generation){destroy();status('Offline package not ready: '+e.message);}}
}
function apply(){
 if(!result)return;const c=context();if(!same(c,result.c)){reset();return;}
 const manual=el('receipt-plate-confirm').value,r=result.r,g=window.MYCARReceiptGuard.check(r,c,manual);
 if(g.errors.length||!el('receipt-confirm').checked){review();return;}
 for(const [id,key] of Object.entries(fields)){if(key==='station'){if(!el(id).value&&r[key])el(id).value=r[key];}else el(id).value=String(r[key]??'');}
 applied={c,r:{...r,plate:r.plate||manual}};clearReview();c.refresh();status('Applied to form only. Review again and tap Save Record manually.');
}
function beforeSave(c){
 if(!applied)return true;
 if(!same(c,applied.c)){status('Vehicle or account changed. Close and reopen the form.');return false;}
 const r={...applied.r,date:el('field-date').value,odometer:Number(el('fuel-odometer').value),liters:Number(el('fuel-liters').value),total:Number(el('fuel-cost').value),fuelType:el('fuel-type-name').value};
 const g=window.MYCARReceiptGuard.check(r,c,'');
 if(g.errors.length){status(g.errors.join(' ')+' Correct values or reopen for manual entry.');return false;}
 return window.confirm('Save reviewed receipt values? '+g.warnings.join(' '));
}
el('receipt-plate-confirm').addEventListener('input',review);el('receipt-confirm').addEventListener('change',review);
el('receipt-apply').addEventListener('click',apply);el('receipt-offline').addEventListener('click',prepare);
window.MYCARIntegratedOCR={scan,reset,beforeSave};
})();
