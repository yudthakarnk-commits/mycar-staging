/* MYCAR staging-only PWA cache. Never cache production origins or other app scopes. */
const CACHE='mycar-staging-timeout-qa-20261123-v7';
const SHELL=['./','./index.html','./auth-config.js','./auth.js','./cloud-sync.js','./app.js','./sync-health.js','./restore-dry-run.js','./backup-preview.js','./rpc-restore-staging.js','./tng-import.js','./vehicle-photos.js','./manifest.webmanifest','./assets/auth.css','./assets/app.css','./assets/car-photos.css','./assets/tng-import.css','./assets/mobile-viewport-fix.css','./assets/sync-health.css','./assets/backup-preview.css'];
const SCOPE=new URL(self.registration.scope).pathname;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mycar-staging-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='MYCAR_SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin||!u.pathname.startsWith(SCOPE))return;
 event.respondWith((async()=>{
 const cache=await caches.open(CACHE);
 try{const r=await fetch(req,{cache:'no-store'});if(r.ok&&r.type==='basic')await cache.put(req,r.clone());return r;}
 catch(e){return (await cache.match(req,{ignoreSearch:true})) || (req.mode==='navigate'?await cache.match('./index.html'):Response.error()) || Response.error();}
 })());
});
