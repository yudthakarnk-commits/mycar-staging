/* MYCAR staging-only PWA cache. Never cache production origins or other app scopes. */
const CACHE_PREFIX='mycar-rc:'+self.registration.scope+':';
const CACHE=CACHE_PREFIX+'3.5.0-rc.1';
const SHELL=['./','./index.html','./auth-config.js?v=3.5.0-rc.1','./auth.js?v=3.5.0-rc.1','./cloud-sync.js?v=3.5.0-rc.1','./app.js?v=3.5.0-rc.1','./sync-health.js?v=3.5.0-rc.1','./restore-dry-run.js?v=3.5.0-rc.1','./backup-preview.js?v=3.5.0-rc.1','./rpc-restore.js?v=3.5.0-rc.1','./tng-import.js?v=3.5.0-rc.1','./vehicle-photos.js?v=3.5.0-rc.1','./manifest.webmanifest','./assets/auth.css?v=3.5.0-rc.1','./assets/app.css?v=3.5.0-rc.1','./assets/car-photos.css?v=3.5.0-rc.1','./assets/tng-import.css?v=3.5.0-rc.1','./assets/mobile-viewport-fix.css?v=3.5.0-rc.1','./assets/sync-health.css?v=3.5.0-rc.1','./assets/backup-preview.css?v=3.5.0-rc.1'];
const SCOPE=new URL(self.registration.scope).pathname;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
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
