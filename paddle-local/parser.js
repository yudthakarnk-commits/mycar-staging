(function(root){
'use strict';
function parse(text){
 const s=String(text).replace(/\r/g,'').replace(/[ \t]+/g,' ');
 const warnings=[];
 const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 // Accept only complete, labelled or structurally recognizable date tokens.
 // Only normalize 0 in an otherwise exact known month token; never change day/year.
 const dates=[...s.matchAll(/\b(\d{1,2})[ \t]*([A-Z0]{3})[ \t]*(\d{4})\b/gi)].map(d=>{
 const rawMonth=d[2].toUpperCase(),month=rawMonth.replace(/0/g,'O');
 const m=months.indexOf(month)+1,day=+d[1],year=+d[3];
 if(m&&rawMonth!==month)warnings.push('Review OCR formatting: month ('+rawMonth+' → '+month+').');
 return m&&year>=2000&&year<=2099&&day>0&&day<=new Date(Date.UTC(year,m,0)).getUTCDate()?year+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0'):null;
 }).filter(Boolean);
 function unique(values,label){
 const v=[...new Set(values.filter(x=>x!==null))];
 if(v.length>1){warnings.push('Conflicting '+label+' values; enter manually.');return null;}
 return v[0]??null;
 }
 const date=unique(dates,'date');
 // Decimal comma/space are allowed only with the explicit decimal precision for that field.
 // No substitution of letters for digits, no inference from amount / price.
 function decimal(raw,min,max,label){
 const v=raw.trim();
 const m=v.match(/^(\d+)[ \t]*([.,])[ \t]*(\d+)$/);
 if(!m||m[3].length<min||m[3].length>max)return null;
 if(m[2]===','||/[ \t]/.test(v))warnings.push('Review OCR formatting: '+label+' ('+v+').');
 const n=Number(m[1]+'.'+m[3]);return Number.isFinite(n)&&n>0?n:null;
 }
 // Extract independently anchored volume and price, even if the other field is unreadable.
 const unit=String.raw`(?:[l1i][ \t]*t[ \t]*r|litres?|L)`;
 const volPattern=new RegExp(String.raw`(?:^|\s)(\d+[ \t]*[.,][ \t]*\d{3})[ \t]*`+unit+String.raw`(?=[ \t]*(?:@|$)|[ \t]+RM\b)`,'gim');
 const pricePattern=new RegExp(String.raw`@[ \t]*RM[ \t]*(\d+[ \t]*[.,][ \t]*\d{2,3})[ \t]*\/[ \t]*`+unit+String.raw`\b`,'gim');
 const liters=unique([...s.matchAll(volPattern)].map(m=>decimal(m[1],3,3,'litres')),'litres');
 const price=unique([...s.matchAll(pricePattern)].map(m=>decimal(m[1],2,3,'unit price')),'unit price');
 const totals=[...s.matchAll(/^[ \t]*TOTAL[ \t]*:?[ \t]*(?:RM[ \t]*)?(\d+[ \t]*[.,][ \t]*\d{2})[ \t]*$/gim)];
 const total=unique(totals.map(m=>decimal(m[1],2,2,'total')),'total');
 const odometer=unique([...s.matchAll(/^[ \t]*Odo[ \t]*me[ \t]*ter[ \t]+(\d+|\d{1,3}(?:,\d{3})+)[ \t]*$/gim)].map(m=>{const n=Number(m[1].replace(/,/g,''));return Number.isSafeInteger(n)&&n>0?n:null;}),'odometer');
 // Normalize spacing/case for comparison, never substitute characters from the selected vehicle.
 const plateValues=[...s.matchAll(/^[ \t]*(?:V[ \t]*R[ \t]*N|VEHICLE[ \t]+(?:NO\.?|REG(?:ISTRATION)?(?:[ \t]+NO\.?)?)|REG[ \t]+NO\.?)[ \t]*[:=]?[ \t]+([A-Z0-9 -]+)[ \t]*$/gim)].map(m=>m[1].trim()).filter(v=>/[A-Z]/i.test(v)&&/\d/.test(v)&&v.replace(/[ -]/g,'').length<=12);
 const plateKeys=[...new Set(plateValues.map(v=>v.replace(/[ -]/g,'').toUpperCase()))];
 const plate=plateKeys.length>1?(warnings.push('Conflicting plate values; enter manually.'),null):plateValues[0]??null;
 const types=[];
 if(/FuelSave[ \t]*95|\bRON[ \t]*95\b/i.test(s))types.push('RON95');
 if(/\bRON[ \t]*97\b|V-Power[ \t]*97/i.test(s))types.push('RON97');
 if(/\bDiesel\b/i.test(s))types.push('Diesel');
 const fuelType=unique(types,'fuel type');
 // Only use explicit brand evidence; generic fuel type is not a station name.
 const shell=/\bSHELL[ \t]+(?:SERVICE[ \t]+(?:STATION|SIATLON)|MCA|CARD)\b|\bSHELLCARD\b|^[ \t]*SHELL[ \t]*$/im.test(s);
 const station=shell&&/SEREMBAN/i.test(s)?'Shell R&R Seremban'+(/ARAH UTARA/i.test(s)?' (Northbound)':''):shell?'Shell':null;
 if(!date||!odometer||!liters||!price||total===null||!fuelType)warnings.push('Missing or unclear receipt fields; verify manually.');
 if(liters!==null&&price!==null&&total!==null&&Math.abs(liters*price-total)>0.015)warnings.push('Volume × price differs from total.');
 return {date,odometer,liters,price,total,plate,fuelType,station,warnings};
}
function assess(r,vehicle,records,id){
 const warnings=[...r.warnings],norm=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
 const mismatch=!!(r.plate&&norm(r.plate)!==norm(vehicle.plate));
 if(mismatch)warnings.push('Receipt plate does not match selected vehicle.');
 if(!r.plate)warnings.push('Receipt plate not recognized.');
 const own=records.filter(x=>x.vehicleId===vehicle.id&&x.id!==id);
 if(r.date&&r.odometer&&r.total!==null&&own.some(x=>x.date===r.date&&Number(x.odometer)===r.odometer&&Math.abs(Number(x.cost)-r.total)<0.01))warnings.push('Possible duplicate fuel record.');
 if(r.date&&r.odometer&&own.some(x=>(x.date<r.date&&Number(x.odometer)>r.odometer)||(x.date>r.date&&Number(x.odometer)<r.odometer)))warnings.push('Odometer conflicts with dated fuel history.');
 return {warnings,mismatch};
}
function merge(results){
 const keys=['date','odometer','liters','price','total','plate','fuelType','station'];
 const out={},warnings=[];
 for(const k of keys){
  const raw=results.map(r=>r[k]).filter(v=>v!=null);
  const norm=v=>k==='plate'?String(v).replace(/[ -]/g,'').toUpperCase():v;
  const values=[...new Set(raw.map(norm))];
  out[k]=values.length===1?raw[0]:null;
  if(values.length>1||results.some(r=>r.warnings.some(w=>w.toLowerCase().startsWith('conflicting '+({liters:'litres',price:'unit price',fuelType:'fuel type'}[k]||k)+' ')))){out[k]=null;warnings.push('Conflicting '+k+' across OCR passes; enter manually.');}
  else if(values.length===1&&raw.filter(v=>norm(v)===values[0]).length===1)warnings.push('Review '+k+': detected in one OCR pass only.');
 }
 for(const r of results)for(const w of r.warnings)if(w.startsWith('Review OCR formatting'))warnings.push(w);
 if(keys.some(k=>out[k]===null))warnings.push('Missing or conflicting receipt fields; enter manually.');
 if(out.liters!==null&&out.price!==null&&out.total!==null&&Math.abs(out.liters*out.price-out.total)>0.015){warnings.push('Volume × price differs from total; enter litres and total manually.');out.liters=null;out.total=null;}
 out.warnings=[...new Set(warnings)];return out;
}
function validateFuel(f){
 const present=v=>typeof v==='string'&&v.trim()!=='';
 const valid=(v,min,strict)=>present(v)&&Number.isFinite(Number(v))&&(strict?Number(v)>min:Number(v)>=min);
 const m=String(f.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 const dateOK=!!m&&+m[1]>=1&&+m[2]>=1&&+m[2]<=12&&+m[3]>=1&&+m[3]<=new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate();
 return dateOK&&valid(f.odometer,0,true)&&valid(f.liters,0,true)&&valid(f.cost,0,false)&&['RON95','RON97','Diesel','EV Charging'].includes(f.fuelType);
}
root.MYCARReceipt={parse,assess,merge,validateFuel};if(typeof module!=='undefined')module.exports=root.MYCARReceipt;
})(typeof window!=='undefined'?window:globalThis);
