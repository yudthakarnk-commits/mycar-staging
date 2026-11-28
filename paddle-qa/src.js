import { PaddleOCR } from '@paddleocr/paddleocr-js';
window.runSynthetic = async () => {
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=620;
 const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,620);ctx.fillStyle='black';ctx.font='40px monospace';
 ['SHELL SERVICE STATION','20NOV2026','VRN ABC1234','Odometer 22578','FuelSave 95','33.870ltr@RM3.720/ltr','TOTAL RM126.00'].forEach((line,i)=>ctx.fillText(line,25,60+75*i));
 const start=performance.now();
 const engine=await PaddleOCR.create({lang:'en',ocrVersion:'PP-OCRv5',ortOptions:{backend:'wasm',numThreads:1}});
 const initialized=performance.now();
 const [result]=await engine.predict(canvas);
 return {initMs:initialized-start,scanMs:performance.now()-initialized,items:result.items.map(x=>({text:x.text,score:x.score})),runtime:result.runtime};
};