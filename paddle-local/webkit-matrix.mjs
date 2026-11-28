import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const results=[];
const expected={date:'2026-11-20',odometer:22578,liters:33.87,price:3.72,total:126,plate:'ABC1234',fuelType:'RON95',station:'Shell'};
const timeout=(p,ms)=>{let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Timeout '+ms+' ms')),ms);})]).finally(()=>clearTimeout(t));};
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4173')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Server unavailable');
 for(const [name,type,scale] of [['Chromium',chromium,1],['WebKit',webkit,1],['WebKit',webkit,0.75],['WebKit',webkit,0.5]]){
  let browser,page;const events=[],external=[];let phase='launch';const start=Date.now();
  try{
   browser=await type.launch();page=await browser.newPage();
   page.on('console',m=>{events.push({type:m.type(),text:m.text().slice(0,500)});});
   page.on('pageerror',e=>events.push({type:'pageerror',text:String(e).slice(0,500)}));
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(/^https?:$/.test(u.protocol)&&u.hostname!=='127.0.0.1'){external.push(u.origin+u.pathname);return route.abort();}return route.continue();});
   phase='navigation';await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>typeof window.runSynthetic==='function',{},{timeout:30000});
   const env=await page.evaluate(()=>({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,crossOriginIsolated,wasm:typeof WebAssembly!=='undefined'}));
   phase='initialization/prediction';const result=await timeout(page.evaluate(s=>window.runSynthetic(s),scale),180000);
   const checks=Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,result.parsed[k]===v]));
   results.push({name,scale,pass:Object.values(checks).every(Boolean)&&external.length===0,checks,env,...result,external,events,elapsedMs:Date.now()-start});
  }catch(e){try{phase=await timeout(page.evaluate(()=>window.qaPhase),2000);}catch{}results.push({name,scale,pass:false,phase,error:String(e),external,events,elapsedMs:Date.now()-start});}
  finally{try{if(browser)await timeout(browser.close(),10000);}catch{}}
  await writeFile('webkit-matrix.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
 }
}finally{server.kill();}
if(results.length!==4||!results[0].pass||!results.slice(1).some(r=>r.pass))process.exitCode=1;
