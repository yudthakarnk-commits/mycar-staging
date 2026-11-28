import './receipt-guard.js';
import assert from 'node:assert/strict';
const c={account:'test',vehicle:{id:'v1',plate:'ABC1234',currentOdometer:23000},today:'2026-11-28',id:'',records:[{id:'a',vehicleId:'v1',date:'2026-10-17',odometer:20495,cost:169},{id:'b',vehicleId:'v1',date:'2026-11-05',odometer:22070,cost:141}]};
const r={date:'2026-10-25',odometer:21081,liters:37.96,price:4.32,total:163.99,plate:'ABC1234',fuelType:'RON95',station:'Shell'};
const tests=[
[r,c,'',false],[{...r,odometer:663505},c,'',true],[{...r,plate:'XYZ1234'},c,'',true],[{...r,plate:null},c,'',true],[{...r,plate:null},c,'ABC1234',false],[{...r,plate:null},c,'XYZ1234',true],[{...r,total:170},c,'',true],[{...r,date:'2026-02-31'},c,'',true],[{...r,date:'2026-12-01'},c,'',true],[{...r,liters:null},c,'',true],[r,{...c,records:[...c.records,{...r,id:'d',vehicleId:'v1',cost:r.total}]},'',true],[r,{...c,records:[...c.records,{...r,id:'d',vehicleId:'v2',cost:r.total}]},'',false],[r,{...c,account:''},'',true],[{...r,odometer:21081.5},c,'',true]];
for(const [x,y,m,blocked] of tests)assert.equal(globalThis.MYCARReceiptGuard.check(x,y,m).errors.length>0,blocked);
console.log('Receipt guard passed: '+tests.length);
