import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'dist')
namespace=sys.argv[2] if len(sys.argv)>2 else 'mycar-paddle-device-qa:'
assert namespace in ('mycar-paddle-device-qa:', 'mycar-paddle-integrated:')
files=sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name not in ('service-worker.js','offline-manifest.json'))
assert 'index.html' in files
assert len([p for p in files if p.startswith('models/') and p.endswith('.tar')])==2
h=hashlib.sha256()
for f in files:
    h.update(f.encode()); h.update(hashlib.sha256((root/f).read_bytes()).digest())
version=h.hexdigest()[:16]
files.append('offline-manifest.json')
manifest={'version':version,'cache':namespace+version,'files':files}
(root/'offline-manifest.json').write_text(json.dumps(manifest))
sw=r"""
const MANIFEST=__MANIFEST__;
const BASE=self.registration.scope, SCOPE=new URL(BASE).pathname;
const CACHE=MANIFEST.cache, PREFIX=CACHE.slice(0,CACHE.lastIndexOf(':')+1);
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const c=await caches.open(CACHE);
 for(const file of MANIFEST.files){
  const url=new URL(file,BASE).href;
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok)throw Error('Missing '+file);
  await c.put(url,response);
 }
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);
 await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(SCOPE))return;
 e.respondWith((async()=>{
  const c=await caches.open(CACHE);
  const url=e.request.mode==='navigate'&&(u.pathname===SCOPE||u.pathname===SCOPE+'index.html')?new URL('index.html',BASE).href:e.request;
  return await c.match(url,{ignoreSearch:true})||await fetch(e.request);
 })());
});
"""
(root/'service-worker.js').write_text(sw.replace('__MANIFEST__',json.dumps(manifest)))
print('Offline package generated:',version,len(files),'files')
