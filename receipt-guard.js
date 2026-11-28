(function(root){
'use strict';
const plate=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
function check(r,c,manual){
 const errors=[],warnings=[];
 if(!c?.account||!c.vehicle)return {errors:['No active vehicle/account.'],warnings};
 const p=plate(c.vehicle.plate),q=plate(r.plate);
 if(!p||!(q||plate(manual))||p!==(q||plate(manual)))errors.push('Receipt plate does not match selected vehicle.');
 const d=new Date(r.date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==r.date||r.date>c.today)errors.push('Invalid or future receipt date.');
 for(const k of ['odometer','liters','price','total'])if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<=0)errors.push('Missing or invalid '+k+'.');
 if(!Number.isSafeInteger(r.odometer))errors.push('Invalid receipt odometer.');
 if(!['RON95','RON97','Diesel'].includes(r.fuelType))errors.push('Unrecognized fuel type.');
 if([r.liters,r.price,r.total].every(Number.isFinite)&&Math.abs(r.liters*r.price-r.total)>0.015)errors.push('Volume × price differs from total.');
 const own=(c.records||[]).filter(x=>x.vehicleId===c.vehicle.id&&x.id!==c.id);
 if(own.some(x=>x.date===r.date&&Number(x.odometer)===r.odometer&&Math.abs(Number(x.cost)-r.total)<0.01))errors.push('Possible duplicate fuel record.');
 if(own.some(x=>Number(x.odometer)>0&&((x.date<r.date&&Number(x.odometer)>r.odometer)||(x.date>r.date&&Number(x.odometer)<r.odometer))))errors.push('Odometer conflicts with dated fuel history.');
 if(Number(c.vehicle.currentOdometer)>0&&r.odometer>Number(c.vehicle.currentOdometer)+5000)warnings.push('Odometer exceeds current reading by over 5,000 km; verify carefully.');
 return {errors,warnings};
}
root.MYCARReceiptGuard={check,plate};
})(typeof window!=='undefined'?window:globalThis);
