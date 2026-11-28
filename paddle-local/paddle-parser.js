(function(root){
'use strict';
function parsePaddle(raw){
 const normalized=String(raw).replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean).join('\n').replace(/^0dometer\b/gim,'Odometer').replace(/^T0TAL\b/gim,'TOTAL').replace(/(\b\d{1,2}[A-Z0]{3}\d{4})(?=\d{1,2}:\d{2}(?:AM|PM)\b)/gi,'$1 ');
 const lines=normalized.split('\n'), extra=[], skip=new Set();
 const plate=v=>/^[A-Z]{1,4}[ -]?\d{1,4}[A-Z]?$/i.test(v||'');
 const odo=v=>/^\d{1,7}$/.test(v||'');
 const money=v=>/^RM[ \t]*\d+[.,]\d{2}$/i.test(v||'');
 const label=(i,s)=>(lines[i]||'').toLowerCase()===s;
 for(let i=0;i<lines.length;i++){
  if(plate(lines[i])&&label(i+1,'vrn')&&odo(lines[i+2])&&label(i+3,'odometer')&&odo(lines[i+4])&&label(i+5,'auth code')){
   extra.push('VRN '+lines[i],'Odometer '+lines[i+2]);skip.add(i+1);skip.add(i+3);
  }
  if(label(i,'vrn')&&label(i+1,'odometer')&&plate(lines[i+2])&&odo(lines[i+3])&&label(i+4,'auth code')){
   extra.push('VRN '+lines[i+2],'Odometer '+lines[i+3]);skip.add(i);skip.add(i+1);
  }
 }
 for(let i=0;i<lines.length;i++){
  if(!skip.has(i)&&label(i,'vrn')&&plate(lines[i+1]))extra.push('VRN '+lines[i+1]);
  if(!skip.has(i)&&label(i,'odometer')&&odo(lines[i+1]))extra.push('Odometer '+lines[i+1]);
  if(label(i,'total')&&money(lines[i+1]))extra.push('TOTAL '+lines[i+1]);
  if(money(lines[i])&&label(i+1,'card')&&money(lines[i+2])&&label(i+3,'total')&&lines[i].replace(',','.').toUpperCase()===lines[i+2].replace(',','.').toUpperCase())extra.push('TOTAL '+lines[i+2]);
 }
 const parsed=root.MYCARReceipt.merge([root.MYCARReceipt.parse(normalized+'\n'+extra.join('\n'))]);
 if(parsed.station&&parsed.station.startsWith('Shell')&&!/\bR\s*&\s*R\b|\bKAWASAN REHAT\b/i.test(normalized))parsed.station='Shell';
 return {normalized,parsed};
}
root.MYCARPaddleParser={parsePaddle};
})(typeof window!=='undefined'?window:globalThis);
