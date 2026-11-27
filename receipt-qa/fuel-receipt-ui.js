(function(){
'use strict';
let generation=0, url=null, result=null, busy=false, loader=null, retainedWorker=null, retainedFactory=null;
let loggerToken=-1;
async function releaseWorker(){const w=retainedWorker;retainedWorker=null;retainedFactory=null;if(w)try{await bounded(w.terminate(),5000,'OCR worker termination');}catch(e){}}
window.addEventListener('pagehide',()=>{generation++;void releaseWorker();});
const el=id=>document.getElementById(id);
const OCR_ROOT=new URL('./vendor/ocr/',document.baseURI).href;
function reset(){
 generation++;result=null;
 url=null;
 el('receipt-preview').removeAttribute('src');el('receipt-preview').classList.add('hidden');
 el('receipt-status').classList.add('hidden');el('receipt-status').textContent='';
 el('receipt-review').hidden=true;el('receipt-review').textContent='';
 el('receipt-plate-box').hidden=true;el('receipt-plate-confirm').value='';
 el('receipt-apply').hidden=true;el('receipt-apply').disabled=true;
}
function bounded(promise,ms,label,onTimeout){
 let timer;
 return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>{try{onTimeout?.();}catch(e){}reject(new Error(label+' timed out'));},ms);})]).finally(()=>clearTimeout(timer));
}
function status(s){el('receipt-status').textContent=s;el('receipt-status').classList.remove('hidden');}
async function enhance(source){
 const image=new Image();image.src=source;await image.decode();
 const scale=Math.min(2,2400/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];const v=Math.max(0,Math.min(255,(gray-128)*1.35+128));d[i]=d[i+1]=d[i+2]=v;}
 ctx.putImageData(pixels,0,0);return canvas;
}
function normalizedPlate(s){return String(s||'').replace(/[^a-z0-9]/gi,'').toUpperCase();}
function plateChanged(){
 if(!result)return;const c=result.context();if(!c||c.key!==result.key){reset();return;}
 const manual=normalizedPlate(el('receipt-plate-confirm').value);
 el('receipt-apply').disabled=!!result.needsPlate&&(!manual||manual!==normalizedPlate(c.vehicle.plate));
}
// Explicitly warm the same-origin runtime from the controlled page.
const OCR_FILES=['tesseract.min.js','worker.min.js','core/tesseract-core-lstm.wasm.js','core/tesseract-core-lstm.wasm','core/tesseract-core-simd-lstm.wasm.js','core/tesseract-core-simd-lstm.wasm','lang/eng.traineddata.gz'];
let runtimeReady=false;
async function prepareRuntime(){
 if(runtimeReady)return;
 // Sequential fetches limit peak memory on mobile; the scoped service worker caches responses.
 for(const name of OCR_FILES){
  const controller=new AbortController();
  const response=await bounded(fetch(OCR_ROOT+name,{signal:controller.signal}),20000,'OCR asset '+name,()=>controller.abort());
  if(!response.ok)throw new Error('OCR asset '+name+' HTTP '+response.status);
  await bounded(response.arrayBuffer(),20000,'OCR asset body '+name,()=>controller.abort());
 }
 runtimeReady=true;
}
function load(){
 if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
 if(loader)return loader;
 loader=new Promise((resolve,reject)=>{
 const script=document.createElement('script');script.src=OCR_ROOT+'tesseract.min.js';
 script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('OCR unavailable'));
 script.onerror=()=>reject(new Error('OCR download failed'));document.head.appendChild(script);
 }).catch(e=>{loader=null;throw e;});return loader;
}
async function scan(event,context){
 const file=event.target.files?.[0];if(!file)return;reset();
 if(busy){status('Previous scan is finishing. Choose the photo again.');return;}
 if(!file.type.startsWith('image/')||file.size>15*1024*1024){status('Choose an image under 15 MB, or enter values manually.');return;}
 const token=generation;
 busy=true;let worker,completed=false;loggerToken=token;
 try{
 const original=new Uint8Array(await bounded(file.arrayBuffer(),10000,'Image file read'));
 if(token!==generation)return;
 let binary='';
 for(let i=0;i<original.length;i+=16384)binary+=String.fromCharCode(...original.subarray(i,i+16384));
 url='data:'+file.type+';base64,'+btoa(binary);
 el('receipt-preview').src=url;el('receipt-preview').classList.remove('hidden');
 status('Loading local OCR…');await prepareRuntime();if(token!==generation)return;const lib=await bounded(load(),20000,'OCR script');if(token!==generation)return;
 if(retainedWorker&&retainedFactory!==lib.createWorker)await releaseWorker();
 if(retainedWorker){worker=retainedWorker;}else{
 let expired=false;const creation=lib.createWorker('eng',1,{workerPath:OCR_ROOT+'worker.min.js',corePath:OCR_ROOT+'core/tesseract-core-lstm.wasm.js',langPath:OCR_ROOT+'lang/',workerBlobURL:false,logger:m=>{if(loggerToken===generation&&m.status==='recognizing text')status('Reading receipt '+Math.round(m.progress*100)+'%');}});
 creation.then(w=>{if(expired)Promise.resolve(w.terminate()).catch(()=>{});},()=>{});
 worker=await bounded(creation,45000,'OCR worker initialization',()=>{expired=true;});
 retainedWorker=worker;retainedFactory=lib.createWorker;
 }
 if(token!==generation)return;
 let input=original;try{input=await bounded(enhance(url),10000,'Image decode');}catch(e){}if(token!==generation)return;
 const passes=[];
 async function recognize(source,mode){
  if(token!==generation)return;
  await bounded(worker.setParameters({tessedit_pageseg_mode:mode}),10000,'OCR parameters');
  const bytes=source instanceof Uint8Array?source:Uint8Array.from(atob(source.toDataURL('image/png').split(',')[1]),ch=>ch.charCodeAt(0));
  const {data}=await bounded(worker.recognize(bytes),30000,'OCR recognition');
  if(token===generation)passes.push(window.MYCARReceipt.parse(data.text));
 }
 await recognize(input,'6');if(token!==generation)return;
 status('Cross-checking original receipt…');
 await recognize(original,'3');if(token!==generation)return;
 let r=window.MYCARReceipt.merge(passes);
 if(input!==original&&['date','odometer','liters','price','total','plate'].some(k=>r[k]===null)){
  status('Reading receipt with alternative layout…');
  await recognize(input,'11');if(token!==generation)return;
  r=window.MYCARReceipt.merge(passes);
 }
 if(input!==original&&['date','odometer','liters','price','total','plate'].some(k=>r[k]===null)){
  // Overlapping bands retain labels; do not infer fields from crop position.
  const regions=[[0,0.60],[0.35,1]];
  for(const [top,bottom] of regions){
   if(token!==generation)return;
   const crop=document.createElement('canvas');
   const y=Math.floor(input.height*top),height=Math.ceil(input.height*bottom)-y;
   crop.width=input.width;crop.height=height;
   crop.getContext('2d').drawImage(input,0,y,input.width,height,0,0,input.width,height);
   status('Checking receipt sections…');
   await recognize(crop,'6');
   crop.width=0;crop.height=0;
  }
  r=window.MYCARReceipt.merge(passes);
 }
 const c=context();if(!c||c.key!==context.key){status('Form changed. Select receipt again.');return;}
 const check=window.MYCARReceipt.assess(r,c.vehicle,c.records,c.id);
 const fields=[['Date',r.date],['Odometer',r.odometer],['Litres',r.liters],['RM/litre',r.price],['Total RM',r.total],['Plate',r.plate],['Fuel',r.fuelType],['Station',r.station]];
 const review=el('receipt-review');review.textContent='';
 for(const [name,value] of fields){const line=document.createElement('div');line.textContent=name+': '+(value??'Not recognized');review.appendChild(line);}
 for(const warning of check.warnings){const line=document.createElement('div');line.textContent='Warning: '+warning;review.appendChild(line);}
 review.hidden=false;const needsPlate=check.mismatch||!r.plate;result={r,context,key:c.key,needsPlate};el('receipt-plate-box').hidden=!needsPlate;el('receipt-apply').hidden=false;el('receipt-apply').disabled=needsPlate;
 status('Review recognized values against the photo. Nothing has been saved.');completed=true;
 }catch(e){console.warn('MYCAR OCR failed:',e?.name||'Error',e?.message||String(e));if(token===generation)status('OCR unavailable or image unreadable. Enter values manually.');}
 finally{if(!completed){if(worker===retainedWorker)await releaseWorker();else if(worker)try{await bounded(worker.terminate(),5000,'OCR worker termination');}catch(e){}}busy=false;}
}
function apply(){
 if(!result)return;const {r,context,key}=result;const c=context();
 if(!c||c.key!==key){reset();return;}
 const confirmed=normalizedPlate(el('receipt-plate-confirm').value);
 if(result.needsPlate&&(!confirmed||confirmed!==normalizedPlate(c.vehicle.plate))){status('Enter the plate printed on the receipt. It must match the selected vehicle.');return;}
 const check=window.MYCARReceipt.assess(result.needsPlate?{...r,plate:confirmed}:r,c.vehicle,c.records,c.id);
 if(!window.confirm('Apply recognized values to the form? Verify all fields before Save. '+check.warnings.join(' ')))return;
 const map={'field-date':r.date,'fuel-odometer':r.odometer,'fuel-liters':r.liters,'fuel-cost':r.total,'fuel-type-name':r.fuelType,'fuel-station':r.station};
 for(const [id,value] of Object.entries(map)){if(value!==null&&value!==undefined)el(id).value=value;else if(['field-date','fuel-odometer','fuel-liters','fuel-cost','fuel-type-name'].includes(id))el(id).value='';}
 c.refresh();status('Values applied. Check all fields, then Save manually.');el('receipt-apply').disabled=true;result=null;
}
window.MYCARReceiptUI={reset,scan,apply,plateChanged};
})();
