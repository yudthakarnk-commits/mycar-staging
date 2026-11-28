import { chromium,webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const results=[];
try {
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
  let browser,page;const requests=[],events=[];
  try{
   browser=await type.launch();page=await browser.newPage();
   page.on('console',msg=>{events.push({type:msg.type(),text:msg.text()});console.log(name,msg.text());});
   page.on('pageerror',err=>events.push({type:'pageerror',text:String(err)}));
   page.on('requestfailed',req=>events.push({type:'requestfailed',url:req.url(),error:req.failure()?.errorText}));
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(!/^https?:$/.test(u.protocol)||u.hostname==='127.0.0.1')return route.continue();const file=u.pathname.split('/').pop();if(u.hostname==='paddle-model-ecology.bj.bcebos.com'&&['PP-OCRv5_mobile_det_onnx_infer.tar','PP-OCRv5_mobile_rec_onnx_infer.tar'].includes(file)){console.log(name,'Serving local model',file);return route.fulfill({path:'public/models/'+file,contentType:'application/x-tar',headers:{'access-control-allow-origin':'*'}});}events.push({type:'blocked-external',url:u.origin+u.pathname});return route.abort();});
   page.on('request',r=>{const u=new URL(r.url());if(/^https?:$/.test(u.protocol)&&u.hostname!=='127.0.0.1')requests.push({method:r.method(),url:u.origin+u.pathname});});
   await page.goto('http://127.0.0.1:4173');
   await page.waitForFunction(()=>typeof window.runSynthetic==='function',{},{timeout:30000});
   const result=await Promise.race([page.evaluate(()=>window.runSynthetic()),new Promise((_,rej)=>{const t=setTimeout(()=>rej(Error('OCR timeout')),150000);t.unref();})]);
   const text=result.items.map(x=>x.text).join(' ').replace(/\s/g,'').toUpperCase();
   const pass=text.includes('22578')&&text.includes('126.00')&&text.includes('ABC1234');
   results.push({name,pass,...result,requests,events});
  }catch(e){let phase='unknown';try{phase=await Promise.race([page?.evaluate(()=>window.qaPhase),new Promise(r=>setTimeout(()=>r('unresponsive'),2000))]);}catch{}results.push({name,pass:false,error:String(e),phase,requests,events});}
  finally{await browser?.close();}
  await writeFile('results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
 }
}finally{server.kill();}
if(results.length!==2||results.some(r=>!r.pass))process.exitCode=1;
