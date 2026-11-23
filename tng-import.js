/* MYCAR · Touch 'n Go monthly PDF importer
 * Runs in the browser only. PDF password and original file never leave the device.
 * Uses pinned Mozilla PDF.js to read (including password-protected) text-layer PDFs.
 * Shows a deduplicated preview and requires confirmation before writing.
 */
const MYCARTNG = (() => {
  const SOURCE = 'tng-wallet-statement-v1';
  const PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.min.mjs';
  const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
  const FIELDS = ['date','status','type','reference','description','details','amount','balance'];
  let pdfLibPromise = null, displayed = [], activeVehicleId = '', hasPreview=false, isBusy=false;
  const e = id => document.getElementById(id);

  function state(msg,error=false) {
    e('tng-message').textContent=msg;
    e('tng-message').classList.toggle('tng-error',!!error);
  }
  function showResults(show) { e('tng-results').hidden=!show; }
  function open() {
    if(!AuthManager.currentUser) return;
    activeVehicleId=dbData.activeVehicleId;
    const car=dbData.vehicles.find(v=>v.id===activeVehicleId);
    e('tng-selected-vehicle').textContent=car ? `${car.name} (${car.plate})` : 'No vehicle selected';
    e('tng-file').value='';e('tng-password').value='';
    displayed=[];hasPreview=false;showResults(false);state('Choose a monthly Touch ’n Go statement PDF.');
    e('tng-import-modal').hidden=false;
  }
  function close() {
    if(isBusy)return;
    e('tng-import-modal').hidden=true;
    e('tng-password').value='';
    // Forget parsed financial data when the importer is closed.
    displayed=[];hasPreview=false;showResults(false);
  }
  const normalize = value=>String(value??'').replace(/\s+/g,' ').trim();
  function parseDate(s) {
    const match=normalize(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!match) return '';
    const [_,day,month,year]=match, d=new Date(Date.UTC(+year,+month-1,+day));
    if(d.getUTCDate()!==+day||d.getUTCMonth()!==+month-1||d.getUTCFullYear()!==+year)return '';
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  }
  function money(text) {
    const match=String(text||'').match(/(?:^|\s)(-?)RM\s*([\d,]+\.\d{2})(?!\d)/i);
    if(!match)return null;
    const n=Number(match[2].replace(/,/g,''));
    return Number.isFinite(n)?Math.round(n*100)/100*(match[1]? -1:1):null;
  }
  function classify(type,description) {
    const both=normalize(type+' '+description);
    if(/parking/i.test(both))return 'parking';
    if(/\b(RFID|Toll|PayDirect|Highway)\b/i.test(type) || /^\s*(PLUS|ELITE|GRANDSEPADU|NPE|KESAS|AKLEH|DUKE|SILK|LEKAS)\s*-/i.test(description))return 'toll';
    return '';
  }
  function smallHash(text) {
    // Non-cryptographic stable identifier; includes timestamp, reference, vehicle context and amount.
    let a=2166136261,b=0x9747b28c;
    for(let i=0;i<text.length;i++){const x=text.charCodeAt(i);a=Math.imul(a^x,16777619);b=Math.imul(b^x,2246822519);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
  }

  // Page items must be PDF.js text-layer entries mapped to the visible page viewport.
  // Each has {str,x,y}. This also permits deterministic parser tests without a PDF reader.
  function parseVisualPages(pages) {
    const records=[];
    let fallbackHeaders=null;
    let unsupportedCount=0;
    for(const pageItems of pages){
      const items=pageItems.filter(i=>i && normalize(i.str) && Number.isFinite(i.x)&&Number.isFinite(i.y))
        .map(i=>({str:normalize(i.str),x:Number(i.x),y:Number(i.y)}))
        .sort((a,b)=>a.y-b.y||a.x-b.x);
      if(!items.length)continue;
      const lines=[];
      for(const item of items){
        let line=lines[lines.length-1];
        if(!line||Math.abs(line.y-item.y)>3.0){line={y:item.y,items:[]};lines.push(line);}
        line.items.push(item);
      }
      lines.forEach(line=>line.items.sort((a,b)=>a.x-b.x));
      for(const line of lines){
        const labels=line.items.map(i=>i.str.toLowerCase());
        if(labels.some(s=>s==='date')&&labels.some(s=>s==='status')&&labels.some(s=>s.includes('description'))&&labels.some(s=>s.includes('amount'))){
          const pick=(needle)=>line.items.find(i=>i.str.toLowerCase()===needle || i.str.toLowerCase().startsWith(needle+' '))?.x;
          const vals=[pick('date'),pick('status'),(pick('transaction type')??pick('transaction')),pick('reference'),pick('description'),pick('details'),pick('amount'),(pick('wallet balance')??pick('wallet'))];
          if(vals.filter(x=>Number.isFinite(x)).length>=6){
            const filled=vals.slice();
            // If one label is merged or missing, infer it from neighbours.
            for(let i=0;i<filled.length;i++)if(!Number.isFinite(filled[i])){
              const left=filled[i-1],right=filled[i+1];
              filled[i]=Number.isFinite(left)&&Number.isFinite(right)?(left+right)/2 : Number.isFinite(left)?left+55 : 0;
            }
            fallbackHeaders=filled;
          }
        }
      }
      const header=fallbackHeaders;
      const completed=[];let current=null;
      for(const line of lines){
        const visibleLine=line.items.map(i=>i.str).join(' ');
        if(/(?:This is a system generated email|further enquiry|operating hours|including public holidays|Thank you|\+603 5022 3888)/i.test(visibleLine)) continue;
        let row={};FIELDS.forEach(f=>row[f]='');
        // Determine columns by start x positions; preserve wrapped reference/description.
        if(header){
          for(const item of line.items){
            let column=0;
            for(let i=0;i<header.length;i++)if(item.x>=header[i]-5)column=i;
            const field=FIELDS[column];
            row[field]=[row[field],item.str].filter(Boolean).join(' ');
          }
        }else{
          // Fallback for pages without extractable column headings.
          const flat=line.items.map(i=>i.str).join(' ');
          const candidate=flat.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(Success|Failed|Pending)\s+(.*?)\s+(RM\s*[\d,.]+)/i);
          if(candidate){row.date=candidate[1];row.status=candidate[2];row.type=candidate[3];row.amount=candidate[4];}
          else row.reference=flat;
        }
        const isNew = parseDate(row.date) && /^(Success|Failed|Pending)$/i.test(row.status) && !/Transaction/i.test(row.date);
        if(isNew){if(current)completed.push(current);current=row;}
        else if(current){
          for(const key of FIELDS){
            if(row[key])current[key]=[current[key],row[key]].filter(Boolean).join(' ');
          }
        }
      }
      if(current)completed.push(current);
      // If the supplied TNG PDF is unrecognized, never fabricate transactions.
      for(const r of completed){
        const date=parseDate(r.date), status=normalize(r.status), category=classify(r.type,r.description);
        const cost=money(r.amount);
        if(!date || !/Success/i.test(status) || !category || !(cost>0)) {unsupportedCount++;continue;}
        const time=normalize(r.details).match(/\b\d{1,2}:\d{2}\s*[AP]M\b/i)?.[0]||'';
        const record={date,type:normalize(r.type),reference:normalize(r.reference),description:normalize(r.description),time,
          category,cost,source:SOURCE};
        records.push(record);
      }
    }
    return {records,unsupportedCount};
  }
  function detectDuplicates(records,vehicleId,existing) {
    const countByKey=new Map();
    const key=(date,category,cost)=>`${date}|${category}|${Math.round(Number(cost)*100)}`;
    for(const r of (existing.tax||[])){
      if(r.vehicleId!==vehicleId)continue;
      const cat=/parking/i.test(String(r.type))?'parking':(/toll|rfid|paydirect/i.test(String(r.type))?'toll':null);
      if(!cat)continue;
      const k=key(r.date,cat,r.cost);countByKey.set(k,(countByKey.get(k)||0)+1);
    }
    for(const r of (existing.other||[])){
      if(r.vehicleId!==vehicleId|| !/parking/i.test(String(r.description)))continue;
      const k=key(r.date,'parking',r.cost);countByKey.set(k,(countByKey.get(k)||0)+1);
    }
    const seenThisPdf=new Set(), consumed=new Map();
    return records.map((r,index)=>{
      const signature=[r.date,r.time,r.type,r.reference,r.description,r.category,r.cost.toFixed(2)].join('|').toLowerCase();
      const id=`tng_${r.date.replace(/-/g,'')}_${smallHash(signature)}`;
      const group=key(r.date,r.category,r.cost);
      const collision=seenThisPdf.has(id);
      seenThisPdf.add(id);
      const nth=(consumed.get(group)||0)+1;consumed.set(group,nth);
      const historical=(countByKey.get(group)||0)>=nth;
      const explicitId=(existing.tax||[]).some(x=>x.vehicleId===vehicleId&&x.id===id) ||(existing.other||[]).some(x=>x.vehicleId===vehicleId&&x.id===id);
      return {...r,id,duplicate:collision||historical||explicitId};
    });
  }
  async function loadLibrary() {
    if(!pdfLibPromise) pdfLibPromise=import(PDF_JS).then(lib=>{lib.GlobalWorkerOptions.workerSrc=PDF_WORKER;return lib;});
    return pdfLibPromise;
  }
  async function readPdf(file,password) {
    const pdfjs=await loadLibrary();
    const raw=await file.arrayBuffer();
    const task=pdfjs.getDocument({data:new Uint8Array(raw),password,isEvalSupported:false});
    const document=await task.promise;
    const pages=[];
    try {
      if(document.numPages>40)throw new Error('Statement is too long (over 40 pages). Please split the file.');
      for(let p=1;p<=document.numPages;p++){
        const page=await document.getPage(p), viewport=page.getViewport({scale:1});
        const content=await page.getTextContent();
        if(p===1) {
          const heading=content.items.map(i=>String(i.str||'')).join(' ').toLowerCase();
          if(!heading.includes('tng') || !heading.includes('transaction') || !heading.includes('history'))
            throw new Error('This file does not appear to be a Touch ’n Go eWallet transaction statement.');
        }
        pages.push(content.items.filter(i=>i.str&&i.transform).map(i=>{
          const tx=pdfjs.Util.transform(viewport.transform,i.transform);
          return {str:i.str,x:tx[4],y:tx[5]};
        }));
      }
    } finally {await document.destroy();}
    return parseVisualPages(pages);
  }
  async function analyze() {
    if(isBusy)return;
    const file=e('tng-file').files?.[0],password=e('tng-password').value;
    if(!file){state('Please select a PDF file.',true);return;}
    if(file.size>12*1024*1024){state('Maximum PDF size is 12 MB.',true);return;}
    if(!(file.type==='application/pdf'||/\.pdf$/i.test(file.name))){state('Please choose a PDF document.',true);return;}
    if(activeVehicleId!==dbData.activeVehicleId) {state('Selected vehicle changed. Close importer and reopen it.',true);return;}
    isBusy=true;e('tng-analyze').disabled=true;showResults(false);
    try {
      state('Reading PDF on your device…');
      const parsed=await readPdf(file,password);
      if(!parsed.records.length){state('No supported toll/parking records were found. Only text-layer TNG statements are supported; please check the file or password.',true);return;}
      displayed=detectDuplicates(parsed.records,activeVehicleId,dbData);
      const unique=displayed.filter(x=>!x.duplicate),duplicates=displayed.length-unique.length;
      const amount=unique.reduce((s,x)=>s+Math.round(x.cost*100),0)/100;
      e('tng-count-new').textContent=`New: ${unique.length} (RM${amount.toFixed(2)})`;
      e('tng-count-duplicate').textContent=`Already recorded: ${duplicates}`;
      e('tng-count-unsupported').textContent=`Unrecognized: ${parsed.unsupportedCount}`;
      const tbody=e('tng-rows');tbody.replaceChildren();
      for(const row of displayed.slice(0,250)){
        const tr=document.createElement('tr');
        const values=[row.date,row.category==='toll'?'Toll':'Parking',row.description,`RM${row.cost.toFixed(2)}`,row.duplicate?'Already in MYCAR':'NEW'];
        values.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===4)td.className=row.duplicate?'tng-duplicate':'tng-new';tr.append(td);});
        tbody.append(tr);
      }
      e('tng-save').disabled=unique.length===0;
      e('tng-save').textContent=`Import ${unique.length} new expense(s) · RM${amount.toFixed(2)}`;
      hasPreview=true;showResults(true);
      state(`${displayed.length} supported payment records found. Review before importing.`);
    }catch(err){
      displayed=[];hasPreview=false;
      const raw=String(err?.message||'');
      if(/password/i.test(raw))state('PDF password is incorrect or missing. Enter the correct password and retry.',true);
      else state('Unable to read PDF: '+raw.slice(0,220),true);
    }finally{isBusy=false;e('tng-analyze').disabled=false;e('tng-password').value='';}
  }
  function save() {
    if(isBusy || !hasPreview || !AuthManager.currentUser || activeVehicleId!==dbData.activeVehicleId)return;
    // Re-check against changes made by other screens during preview.
    const now=detectDuplicates(displayed,activeVehicleId,dbData).filter(x=>!x.duplicate);
    if(!now.length){state('All these transactions are already recorded. Nothing to import.');e('tng-save').disabled=true;return;}
    if(!confirm(`Import ${now.length} new toll/parking expenses to MYCAR? Existing entries will not be changed.`))return;
    for(const r of now){
      const detail=[`Touch 'n Go ${r.type}`,r.description,r.time,r.reference?`Ref: ${r.reference}`:''].filter(Boolean).join(' · ');
      if(r.category==='toll'){
        dbData.tax.push({id:r.id,vehicleId:activeVehicleId,date:r.date,type:'Toll Fee',cost:r.cost,expiry:'',notes:detail,time:r.time,importSource:SOURCE});
      }else{
        dbData.tax.push({id:r.id,vehicleId:activeVehicleId,date:r.date,type:'Parking Fee',cost:r.cost,expiry:'',notes:detail,time:r.time,importSource:SOURCE});
      }
    }
    saveData();refreshActiveView();
    const n=now.length;
    close();
    if(typeof showToast==='function')showToast(`${n} TNG expenses added. Waiting for cloud sync.`);
    MYCARCloud.syncNow();
  }
  function init(){
    e('tng-close').addEventListener('click',close);
    e('tng-import-modal').addEventListener('click',ev=>{if(ev.target===e('tng-import-modal'))close();});
    e('tng-analyze').addEventListener('click',analyze);
    e('tng-save').addEventListener('click',save);
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape' && !e('tng-import-modal').hidden)close();});
  }
  document.addEventListener('DOMContentLoaded',init);
  return {open,close,analyze,save,parseVisualPages,detectDuplicates};
})();
