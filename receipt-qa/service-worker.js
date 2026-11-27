const PREFIX='mycar-receipt-qa:'+self.registration.scope+':',CACHE=PREFIX+'cold-start-v2';
const BASE=self.registration.scope,SCOPE=new URL(BASE).pathname;
const SHELL=['index.html','qa.js','fuel-receipt.js','fuel-receipt-ui.js','manifest.webmanifest','vendor/ocr/tesseract.min.js','vendor/ocr/worker.min.js','vendor/ocr/core/tesseract-core-lstm.wasm.js','vendor/ocr/core/tesseract-core-lstm.wasm','vendor/ocr/core/tesseract-core-simd-lstm.wasm.js','vendor/ocr/core/tesseract-core-simd-lstm.wasm','vendor/ocr/lang/eng.traineddata.gz'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);for(const name of SHELL){const url=new URL(name,BASE).href;const res=await fetch(url,{cache:'reload'});if(!res.ok)throw Error('Missing '+name);await c.put(url,res);}await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const req=e.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(SCOPE))return;e.respondWith((async()=>{
 const c=await caches.open(CACHE);
 if(req.mode==='navigate'&&(u.pathname===SCOPE||u.pathname===SCOPE+'index.html')){const page=await c.match(new URL('index.html',BASE).href);if(page)return page;}
 const hit=await c.match(req,{ignoreSearch:true});if(hit)return hit;
 try{return await fetch(req);}catch(err){return new Response('Receipt QA resource unavailable offline',{status:503,headers:{'Content-Type':'text/plain'}});}
 })());});
