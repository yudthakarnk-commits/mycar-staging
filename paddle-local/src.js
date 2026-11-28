import { PaddleOCR } from '@paddleocr/paddleocr-js';
import './parser.js';
import './paddle-parser.js';
const names=['PP-OCRv5_mobile_det_onnx_infer.tar','PP-OCRv5_mobile_rec_onnx_infer.tar'];
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,options)=>{
 const raw=typeof input==='string'||input instanceof URL?String(input):input.url;
 const u=new URL(raw,location.href);
 if(u.origin===location.origin)return nativeFetch(input,options);
 const name=u.pathname.split('/').pop();
 if(u.hostname==='paddle-model-ecology.bj.bcebos.com'&&names.includes(name)){
   if((options?.method||'GET').toUpperCase()!=='GET')throw Error('Unexpected model request');
   return nativeFetch(new URL('./models/'+name,location.href),options);
 }
 throw Error('External request blocked: '+u.origin);
};
const el=id=>document.getElementById(id);
const keys=['date','odometer','liters','price','total','plate','fuelType','station'];
let engine,initMs,results=[],truth={},busy=false;
window.qaPhase='ready';
async function initialize(){
 if(engine)return;
 window.qaPhase='initializing';
 const t=performance.now();
 engine=await PaddleOCR.create({lang:'en',ocrVersion:'PP-OCRv5',ortOptions:{backend:'wasm',numThreads:1}});
 initMs=performance.now()-t;
 window.qaPhase='ready';
}
async function predict(canvas){
 await initialize();
 window.qaPhase='predicting';
 const t=performance.now();
 const [result]=await engine.predict(canvas);
 const items=result.items.map(x=>({text:x.text,score:x.score}));
 const raw=items.map(x=>x.text).join('\n');
 const {normalized,parsed}=window.MYCARPaddleParser.parsePaddle(raw);
 window.qaPhase='complete';
 return {initMs,scanMs:performance.now()-t,items,raw,normalized,parsed,runtime:result.runtime};
}
window.runSynthetic=async(scale=1)=>{
 const canvas=document.createElement('canvas');canvas.width=Math.round(1000*scale);canvas.height=Math.round(620*scale);
 const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='white';ctx.fillRect(0,0,1000,620);ctx.fillStyle='black';ctx.font='40px monospace';
 ['SHELL SERVICE STATION','20NOV2026','VRN ABC1234','Odometer 22578','FuelSave 95','33.870ltr@RM3.720/ltr','TOTAL RM126.00'].forEach((line,i)=>ctx.fillText(line,25,60+75*i));
 return predict(canvas);
};
function canonical(k,v){
 if(v==null||v==='')return null;
 if(['odometer','liters','price','total'].includes(k)){const n=Number(v);return Number.isFinite(n)?n:null;}
 if(k==='plate')return String(v).replace(/[ -]/g,'').toUpperCase();
 return String(v).trim().toLowerCase();
}
function score(){
 const per=Object.fromEntries(keys.map(k=>[k,{correct:0,wrong:0,missing:0,unscored:0}]));
 for(const r of results)for(const k of keys){
  const expected=canonical(k,truth[r.name]?.[k]),actual=canonical(k,r.parsed?.[k]);
  per[k][expected===null?'unscored':actual===null?'missing':expected===actual?'correct':'wrong']++;
 }
 return per;
}
function render(){
 const per=score();
 const totals=Object.values(per).reduce((a,v)=>{for(const k in a)a[k]+=v[k];return a;},{correct:0,wrong:0,missing:0,unscored:0});
 const denom=totals.correct+totals.wrong+totals.missing;
 el('summary').textContent=results.length+' images processed; '+(denom?('accuracy '+(100*totals.correct/denom).toFixed(2)+'%; correct '+totals.correct+', wrong '+totals.wrong+', missing '+totals.missing):'No verified reference values supplied.');
 el('results').textContent=JSON.stringify({perField:per,results},null,2);
 el('export').disabled=!results.length||busy;
}
el('init').onclick=async()=>{if(busy)return;busy=true;el('init').disabled=true;el('status').textContent='Initializing…';try{await initialize();el('status').textContent='Ready · '+Math.round(initMs)+' ms';el('scan').disabled=false;}catch(e){el('status').textContent='Initialization failed: '+e.message;el('init').disabled=false;}finally{busy=false;}};
el('truth').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Expected object keyed by filename');truth=data;render();}catch(e){el('status').textContent='Reference error: '+e.message;}};
el('scan').onclick=async()=>{
 if(busy||!engine)return;
 const files=[...el('files').files];if(!files.length)return;
 if(new Set(files.map(f=>f.name)).size!==files.length){el('status').textContent='Duplicate filenames: rename before scanning.';return;}
 busy=true;el('scan').disabled=true;el('export').disabled=true;results=[];
 for(const [i,file] of files.entries()){
  el('status').textContent='Scanning '+(i+1)+' / '+files.length+'…';
  let bitmap;
  try{
   if(file.size>20*1024*1024)throw Error('Image exceeds 20 MB');
   bitmap=await createImageBitmap(file);
   const ratio=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   results.push({name:file.name,width:canvas.width,height:canvas.height,...await predict(canvas)});
  }catch(e){results.push({name:file.name,error:String(e)});}
  finally{bitmap?.close();}
  render();
  await new Promise(r=>setTimeout(r,0));
 }
 busy=false;el('scan').disabled=false;el('status').textContent='Completed '+results.length+' images';render();
};
el('export').onclick=()=>{const payload={engine:'PaddleOCR.js 0.4.2 / PP-OCRv5 English / WASM',parser:'V7 Paddle layout adapter + V6 core',reference:truth,perField:score(),results};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mycar-paddle-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
