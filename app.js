
        let dbData = {
            activeVehicleId: 'v1',
            vehicles: [],
            fuel: [],
            maintenance: [],
            tax: [],
            trips: [],
            other: []
        };

        let STORAGE_KEY = null; // Assigned only after a server-verified login
        let lastSavedSnapshot = null;
        const SVG_ICON_PATHS = {"fa-gas-pump":{"w":512,"h":512,"path":"M32 64C32 28.7 60.7 0 96 0L256 0c35.3 0 64 28.7 64 64l0 192 8 0c48.6 0 88 39.4 88 88l0 32c0 13.3 10.7 24 24 24s24-10.7 24-24l0-154c-27.6-7.1-48-32.2-48-62l0-64L384 64c-8.8-8.8-8.8-23.2 0-32s23.2-8.8 32 0l77.3 77.3c12 12 18.7 28.3 18.7 45.3l0 13.5 0 24 0 32 0 152c0 39.8-32.2 72-72 72s-72-32.2-72-72l0-32c0-22.1-17.9-40-40-40l-8 0 0 144c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 512c-17.7 0-32-14.3-32-32s14.3-32 32-32L32 64zM96 80l0 96c0 8.8 7.2 16 16 16l128 0c8.8 0 16-7.2 16-16l0-96c0-8.8-7.2-16-16-16L112 64c-8.8 0-16 7.2-16 16z"},"fa-wrench":{"w":512,"h":512,"path":"M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7L336 192c-8.8 0-16-7.2-16-16l0-57.4c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L297.5 310.5c17 6.2 35.4 9.5 54.5 9.5zM80 408a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"},"fa-file-invoice-dollar":{"w":384,"h":512,"path":"M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 80c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16L80 96c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-64 0c-8.8 0-16-7.2-16-16zm128 72c8.8 0 16 7.2 16 16l0 17.3c8.5 1.2 16.7 3.1 24.1 5.1c8.5 2.3 13.6 11 11.3 19.6s-11 13.6-19.6 11.3c-11.1-3-22-5.2-32.1-5.3c-8.4-.1-17.4 1.8-23.6 5.5c-5.7 3.4-8.1 7.3-8.1 12.8c0 3.7 1.3 6.5 7.3 10.1c6.9 4.1 16.6 7.1 29.2 10.9l.5 .1s0 0 0 0s0 0 0 0c11.3 3.4 25.3 7.6 36.3 14.6c12.1 7.6 22.4 19.7 22.7 38.2c.3 19.3-9.6 33.3-22.9 41.6c-7.7 4.8-16.4 7.6-25.1 9.1l0 17.1c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-17.8c-11.2-2.1-21.7-5.7-30.9-8.9c0 0 0 0 0 0c-2.1-.7-4.2-1.4-6.2-2.1c-8.4-2.8-12.9-11.9-10.1-20.2s11.9-12.9 20.2-10.1c2.5 .8 4.8 1.6 7.1 2.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c13.6 4.6 24.6 8.4 36.3 8.7c9.1 .3 17.9-1.7 23.7-5.3c5.1-3.2 7.9-7.3 7.8-14c-.1-4.6-1.8-7.8-7.7-11.6c-6.8-4.3-16.5-7.4-29-11.2l-1.6-.5s0 0 0 0c-11-3.3-24.3-7.3-34.8-13.7c-12-7.2-22.6-18.9-22.7-37.3c-.1-19.4 10.8-32.8 23.8-40.5c7.5-4.4 15.8-7.2 24.1-8.7l0-17.3c0-8.8 7.2-16 16-16z"},"fa-route":{"w":512,"h":512,"path":"M512 96c0 50.2-59.1 125.1-84.6 155c-3.8 4.4-9.4 6.1-14.5 5L320 256c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c53 0 96 43 96 96s-43 96-96 96l-276.4 0c8.7-9.9 19.3-22.6 30-36.8c6.3-8.4 12.8-17.6 19-27.2L416 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0c-53 0-96-43-96-96s43-96 96-96l39.8 0c-21-31.5-39.8-67.7-39.8-96c0-53 43-96 96-96s96 43 96 96zM117.1 489.1c-3.8 4.3-7.2 8.1-10.1 11.3l-1.8 2-.2-.2c-6 4.6-14.6 4-20-1.8C59.8 473 0 402.5 0 352c0-53 43-96 96-96s96 43 96 96c0 30-21.1 67-43.5 97.9c-10.7 14.7-21.7 28-30.8 38.5l-.6 .7zM128 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM416 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"},"fa-receipt":{"w":384,"h":512,"path":"M14 2.2C22.5-1.7 32.5-.3 39.6 5.8L80 40.4 120.4 5.8c9-7.7 22.3-7.7 31.2 0L192 40.4 232.4 5.8c9-7.7 22.3-7.7 31.2 0L304 40.4 344.4 5.8c7.1-6.1 17.1-7.5 25.6-3.6s14 12.4 14 21.8l0 464c0 9.4-5.5 17.9-14 21.8s-18.5 2.5-25.6-3.6L304 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L192 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L80 471.6 39.6 506.2c-7.1 6.1-17.1 7.5-25.6 3.6S0 497.4 0 488L0 24C0 14.6 5.5 6.1 14 2.2zM96 144c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 144zM80 352c0 8.8 7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 336c-8.8 0-16 7.2-16 16zM96 240c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 240z"}};
        function iconSVG(iconClass, className='') {
          const icon=SVG_ICON_PATHS[iconClass];
          if(!icon) return '';
          const paths=Array.isArray(icon.path)?icon.path:[icon.path];
          return `<svg aria-hidden="true" focusable="false" class="app-icon ${className}" viewBox="0 0 ${icon.w} ${icon.h}" xmlns="http://www.w3.org/2000/svg">${paths.map(p=>`<path fill="currentColor" d="${p}"></path>`).join('')}</svg>`;
        }


        function localToday() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        }
        function uniqueId(prefix='id') {
            return prefix+'_'+(globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`);
        }
        function newEmptyData() {
            return {
                activeVehicleId: 'v1',
                vehicles: [{ id:'v1', name:'My Car', plate:'-', defaultFuel:'RON95', currentOdometer:0, tireMileageLimit:40000, lastTireChangeOdometer:0 }],
                fuel:[], maintenance:[], tax:[], trips:[], other:[]
            };
        }
        function isValidBackup(data) {
            const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
            return !!data && typeof data === 'object' && Array.isArray(data.vehicles) && data.vehicles.length > 0 &&
                data.vehicles.every(v => v && safeId(v.id) && typeof v.name === 'string') &&
                ['fuel','maintenance','tax','trips','other'].every(k => Array.isArray(data[k]) && data[k].every(v => v && safeId(v.id) && safeId(v.vehicleId)));
        }
        function upsertRecord(collection, entry) {
            const idx=dbData[collection].findIndex(x => x.id === entry.id);
            if (idx === -1) dbData[collection].push(entry);
            else dbData[collection][idx]=entry;
        }
        // MYCAR 3.4 currency display layer; all persisted costs remain MYR.
        const MYCARCurrency = (() => {
          const KEY='mycar_display_currency_v1';
          const CACHE='mycar_fx_rates_myr_v1';
          const CURRENCIES={MYR:'RM',THB:'฿',USD:'$'};
          let selected='MYR',rates={MYR:1},rateDate='',fetchedAt='',stale=false,busy=false;
          try {const cached=JSON.parse(localStorage.getItem(CACHE)||'null');
            if(cached&&Number.isFinite(cached.rates?.THB)&&cached.rates.THB>0&&Number.isFinite(cached.rates?.USD)&&cached.rates.USD>0){rates={MYR:1,THB:cached.rates.THB,USD:cached.rates.USD};rateDate=cached.date||'';fetchedAt=cached.fetchedAt||'';stale=(fetchedAt!==new Date().toISOString().slice(0,10));}
            const pref=localStorage.getItem(KEY);if(CURRENCIES[pref]&&rates[pref])selected=pref;
          }catch(e){console.warn('FX preference cache unavailable',e);}
          function format(value){
            const n=Number(value)||0;
            const converted=n*(selected==='MYR'?1:rates[selected]);
            return CURRENCIES[selected]+converted.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
          }
          function updateUI(){
            const sel=document.getElementById('mycar-currency-select');if(sel){sel.value=selected;sel.disabled=busy;}
            const note=document.getElementById('mycar-currency-note');
            if(note){
              if(busy)note.textContent='Checking current exchange rates…';
              else if(selected==='MYR')note.textContent='Original MYR values. No conversion. Stored records remain MYR.';
              else note.textContent=(stale?'Cached rate · ':'Reference rate · ')+
                 '1 MYR = '+rates[selected].toFixed(4)+' '+selected+
                 (rateDate?' · Updated '+rateDate:'')+'. Stored costs remain MYR.';
            }
            document.querySelectorAll('[data-money-code]').forEach(el=>{el.textContent=selected;});
          }
          async function getRates(force=false){
            if(!force && fetchedAt===new Date().toISOString().slice(0,10) && rates.THB && rates.USD)return true;
            const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),8500);
            try{
              const response=await fetch('https://open.er-api.com/v6/latest/MYR',{signal:ctl.signal,cache:'no-store'});
              if(!response.ok)throw new Error('FX service HTTP '+response.status);
              const data=await response.json();
              if(data.result!=='success'||data.base_code!=='MYR')throw new Error('Invalid FX base currency');
              if(!['USD','THB'].every(k=>Number.isFinite(data.rates?.[k])&&data.rates[k]>0))throw new Error('Missing FX rates');
              rates={MYR:1,THB:data.rates.THB,USD:data.rates.USD};
              rateDate=data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
              stale=false;fetchedAt=new Date().toISOString().slice(0,10);
              try{localStorage.setItem(CACHE,JSON.stringify({rates,date:rateDate,fetchedAt}));}catch(e){}
              return true;
            }catch(err){console.warn('Exchange rate retrieval failed',err);return false;}
            finally{clearTimeout(timer);}
          }
          async function choose(code){
            if(!CURRENCIES[code]||busy)return;
            if(code==='MYR'){
              selected='MYR';try{localStorage.setItem(KEY,selected);}catch(e){}
              updateUI();if(typeof refreshActiveView==='function')refreshActiveView();return;
            }
            busy=true;updateUI();
            const ok=await getRates();
            busy=false;
            if(!ok && !rates[code]){
              alert('Exchange rates are unavailable. Currency remains '+selected+'. Please reconnect and try again.');
              updateUI();return;
            }
            if(!ok)stale=true;
            selected=code;try{localStorage.setItem(KEY,selected);}catch(e){}
            updateUI();if(typeof refreshActiveView==='function')refreshActiveView();
          }
          function init(){updateUI();if(selected!=='MYR')getRates().then(ok=>{if(ok){updateUI();if(typeof refreshActiveView==='function')refreshActiveView();}});}
          return {format,choose,init,current:()=>selected,rate:()=>rates[selected]};
        })();
        const money=value=>MYCARCurrency.format(value);
        window.MYCARCurrency=MYCARCurrency;

        const fmtCount=value=>Number(value||0).toLocaleString('en-US',{maximumFractionDigits:1});
        function fuelIntervals(vehicleId) {
          const fuels=dbData.fuel.filter(f=>f.vehicleId===vehicleId && Number(f.odometer)>0)
            .sort((a,b)=>Number(a.odometer)-Number(b.odometer) || String(a.date).localeCompare(String(b.date)));
          const result=[];
          let last=null;
          for(const item of fuels){
            const odo=Number(item.odometer),liters=Number(item.liters);
            const distance=last && odo>Number(last.odometer)?odo-Number(last.odometer):null;
            const rate=distance!==null && liters>0 && item.fuelType!=='EV Charging'?distance/liters:null;
            result.push({item,distance,rate});
            last=item;
          }
          return result;
        }
        function getEfficiencyForPeriod(vehicleId) {
          // Estimated only: without verified full-to-full fills, this ratio is not actual consumption.
          const eligible=fuelIntervals(vehicleId).filter(x=>x.rate!==null && filterByDate(x.item.date));
          const km=eligible.reduce((s,x)=>s+x.distance,0);
          const liters=eligible.reduce((s,x)=>s+Number(x.item.liters),0);
          return liters>0 ? (km/liters).toFixed(1) : '—';
        }
        function estimateFuelForm() {
          const panel=document.getElementById('fuel-estimate-panel');
          if(!panel || document.getElementById('form-type')?.value!=='fuel')return;
          const date=document.getElementById('field-date')?.value||'';
          const id=document.getElementById('form-id')?.value;
          const odo=Number(document.getElementById('fuel-odometer')?.value);
          const liters=Number(document.getElementById('fuel-liters')?.value);
          const prev=dbData.fuel.filter(f=>f.vehicleId===getActiveVehicle().id && f.id!==id && Number(f.odometer)>0 && Number(f.odometer)<odo && String(f.date)<=date)
            .sort((a,b)=>Number(b.odometer)-Number(a.odometer))[0];
          const km=prev && odo>Number(prev.odometer) ? odo-Number(prev.odometer):null;
          document.getElementById('fuel-est-distance').textContent=km===null?'—':fmtCount(km)+' km';
          document.getElementById('fuel-est-efficiency').textContent=km!==null && liters>0 ? (km/liters).toFixed(1)+' km/L':'—';
        }
        let currentTrendSelection = '';
        function showMonthlyTrendDetail(month) {
          const detail=document.getElementById('mycar-v33-selected');
          const buttons=document.querySelectorAll('#mycar-monthly-trends .mycar-v33-month');
          buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.month===month)));
          const point=window.mycarTrendData?.find(d=>d.month===month);
          if(!detail||!point)return;
          currentTrendSelection=month;
          const period=new Date(month+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
          detail.textContent=period+'  ·  Distance: '+fmtCount(point.km)+' km  ·  Expenses: '+money(point.cost);
        }
        function renderMonthlyTrends() {
          const target=document.getElementById('mycar-monthly-trends');if(!target)return;
          const car=getActiveVehicle(),{year,month}=getFilterCriteria();
          const series=new Map();
          const getMonth=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(0,7):null;
          const eligible=d=>{const m=getMonth(d);return !!m && (year==='all'||m.slice(0,4)===year) && (month==='all'||Number(m.slice(5))-1===Number(month));};
          for(const key of ['fuel','maintenance','tax','trips','other']){
            for(const entry of dbData[key]){
              if(entry.vehicleId!==car.id||!eligible(entry.date))continue;
              const m=getMonth(entry.date);
              if(!series.has(m))series.set(m,{month:m,km:0,cost:0});
              const r=series.get(m);r.cost+=Number(entry.cost)||0;
              if(key==='trips')r.km+=Math.max(0,Number(entry.distance)||0);
            }
          }
          const data=[...series.values()].sort((a,b)=>a.month.localeCompare(b.month));
          window.mycarTrendData=data;
          if(!data.length){target.innerHTML='<div class="mycar-trend-empty">No monthly records for this period.</div>';return;}
          // Dual normalized scales are intentional: RM and km have different units.
          const maxCost=Math.max(1,...data.map(d=>d.cost));
          const maxKm=Math.max(1,...data.map(d=>d.km));
          const W=Math.max(310,Math.min(820,72+data.length*62)),H=195;
          const startX=42,endX=W-16,top=20,baseline=158,height=baseline-top;
          const step=(endX-startX)/data.length;
          // Grouped bar chart: each unit (RM/km) has its own normalized maximum.
          // Two colors and adjacent bars distinguish the units; numeric values are
          // available by tapping or keyboard-selecting a month.
          const barWidth=Math.max(8,Math.min(18,step*.27));
          const gap=Math.max(2,Math.min(6,step*.08));
          const marks=data.map((d,i)=>{
            const center=startX+(i+.5)*step;
            const expenseHeight=Math.max(0,d.cost/maxCost*height);
            const distanceHeight=Math.max(0,d.km/maxKm*height);
            const expenseX=center-gap/2-barWidth;
            const distanceX=center+gap/2;
            const label=d.month.slice(5)+'/'+d.month.slice(2,4);
            const info=d.month+'; distance '+fmtCount(d.km)+' km; expenses '+money(d.cost);
            return `<g class="mycar-v33-month" data-month="${d.month}" role="button" tabindex="0" aria-label="${info}" aria-pressed="false"><rect x="${expenseX.toFixed(1)}" y="${(baseline-expenseHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${expenseHeight.toFixed(1)}" rx="3" fill="#0f766e"/><rect x="${distanceX.toFixed(1)}" y="${(baseline-distanceHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${distanceHeight.toFixed(1)}" rx="3" fill="#f59e0b"/><rect class="mycar-v33-hit" x="${(center-step*.46).toFixed(1)}" y="${top}" width="${(step*.92).toFixed(1)}" height="${baseline-top+8}" fill="transparent"/><text x="${center.toFixed(1)}" y="177" font-size="10" text-anchor="middle" fill="#64748b">${label}</text></g>`;
          }).join('');
          target.innerHTML=`<div class="mycar-v33-legend"><span><i class="mycar-v33-key" style="background:#0f766e"></i>Expenses (${MYCARCurrency.current()})</span><span><i class="mycar-v33-key" style="background:#f59e0b"></i>Trip distance (km)</span></div><div class="mycar-v33-chart"><svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none" role="group" aria-label="Monthly grouped bar chart: green expenses in RM, amber trip distance in km; tap a month for exact values"><line x1="${startX}" y1="${baseline}" x2="${endX}" y2="${baseline}" stroke="#cbd5e1"/><line x1="${startX}" y1="${top}" x2="${startX}" y2="${baseline}" stroke="#cbd5e1" opacity=".6"/><text x="${startX-4}" y="15" fill="#0f766e" font-size="10" text-anchor="start">${MYCARCurrency.current()} ${Math.round(maxCost*MYCARCurrency.rate()).toLocaleString('en-US')}</text><text x="${endX}" y="15" fill="#b45309" font-size="10" text-anchor="end">${Math.round(maxKm).toLocaleString('en-US')} km</text>${marks}</svg></div><div id="mycar-v33-selected" role="status" aria-live="polite" class="mycar-v33-selected">Tap a month for values.</div>`;
          for(const node of target.querySelectorAll('.mycar-v33-month')){
            node.addEventListener('click',()=>showMonthlyTrendDetail(node.dataset.month));
            node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showMonthlyTrendDetail(node.dataset.month);}});
          }
          showMonthlyTrendDetail(data.some(d=>d.month===currentTrendSelection)?currentTrendSelection:data[data.length-1].month);
        }
        let pendingInstallPrompt = null;
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            pendingInstallPrompt = event;
            document.getElementById('install-app-btn')?.classList.remove('hidden');
        });
        window.addEventListener('appinstalled', () => {
            pendingInstallPrompt = null;
            document.getElementById('install-app-btn')?.classList.add('hidden');
        });
        async function installMYCAR() {
            if (!pendingInstallPrompt) return;
            pendingInstallPrompt.prompt();
            await pendingInstallPrompt.userChoice;
            pendingInstallPrompt=null;
            document.getElementById('install-app-btn')?.classList.add('hidden');
        }
        if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
            // A new worker takes control after install. Reload once so a standalone
            // Android PWA gets the new shell without sign-out, reinstall or cache clear.
            let changedController=false;
            navigator.serviceWorker.addEventListener('controllerchange',()=>{
                if(changedController)return;
                changedController=true;
                const versionKey='mycar-sw-loaded-v3.5.0-rc.1';
                const editorOpen=['app-modal','vehicle-modal','tng-import-modal'].some(id=>{
                    const element=document.getElementById(id);
                    return !!element && !element.classList.contains('hidden') && !element.hidden;
                });
                if(!editorOpen && sessionStorage.getItem(versionKey)!=='yes'){
                    sessionStorage.setItem(versionKey,'yes');
                    window.location.reload();
                } else if (editorOpen && typeof showToast==='function') {
                    showToast('App update ready. Finish your record, then reopen MYCAR.');
                }
            });
            window.addEventListener('load',async()=>{
                try {
                    const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
                    await registration.update();
                    // Check on foreground return; throttle via browser's update logic.
                    document.addEventListener('visibilitychange',()=>{
                        if(!document.hidden && navigator.onLine) registration.update().catch(console.warn);
                    });
                }catch(error){console.warn('App update check failed',error);}
            });
        }


        async function checkMYCARUpdates() {
            if (!navigator.onLine) { showToast('Connect to internet to check for updates'); return; }
            try {
                const registration=await navigator.serviceWorker?.getRegistration();
                if (registration) await registration.update();
            } catch(error) {console.warn('Update check failed',error);}
            // Changing the query string bypasses the old cache-first v3 worker.
            const url=new URL(window.location.href);
            url.searchParams.set('v','3.5.0-rc.1');
            window.location.assign(url.href);
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            const msgEl = document.getElementById('toast-msg');
            if (!toast || !msgEl) return;
            msgEl.textContent = msg;
            toast.classList.remove('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                toast.classList.add('opacity-0', 'pointer-events-none');
            }, 2500);
        }

        function initYearFilter() {
            const yearSelect = document.getElementById('filter-year');
            if (!yearSelect) return;
            const currentYear=new Date().getFullYear();
            const years = new Set(Array.from({length:6},(_,i)=>currentYear-i));
            for (const col of ['fuel','maintenance','tax','trips','other'])
                for (const entry of dbData[col] || []) {
                    const y=Number(String(entry.date||'').slice(0,4));
                    if (y >= 1900 && y <= currentYear+5) years.add(y);
                }
            yearSelect.innerHTML='<option value="all">All Years</option>'+
                [...years].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('');
        }

        function loadData() {
            if (!STORAGE_KEY || !AuthManager.currentUser) return;
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                const parsed = saved ? JSON.parse(saved) : null;
                dbData = isValidBackup(parsed) ? parsed : newEmptyData();
                lastSavedSnapshot = JSON.parse(JSON.stringify(dbData));
            } catch (error) {
                console.warn('Could not read saved data', error);
                dbData = newEmptyData();
                lastSavedSnapshot = JSON.parse(JSON.stringify(dbData));
            }
        }

        function saveData() {
            if (!STORAGE_KEY || !AuthManager.currentUser) return;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData));
                if(lastSavedSnapshot) MYCARCloud.onLocalChange(lastSavedSnapshot,dbData);
                lastSavedSnapshot = JSON.parse(JSON.stringify(dbData));
            } catch(error) { alert('Unable to store changes locally. Export a backup and check storage settings.'); console.error(error); }
        }

        function getActiveVehicle() {
            let veh = dbData.vehicles.find(v => v.id === dbData.activeVehicleId);
            if (!veh && dbData.vehicles.length > 0) {
                dbData.activeVehicleId = dbData.vehicles[0].id;
                veh = dbData.vehicles[0];
            }
            return veh || { id: 'v1', name: 'My Car', plate: '-', defaultFuel: 'RON95', currentOdometer: 0, tireMileageLimit: 40000, lastTireChangeOdometer: 0 };
        }

        function updateVehicleSelector() {
            const select = document.getElementById('header-vehicle-select');
            const plateEl = document.getElementById('header-vehicle-plate');
            const vehLabel = document.getElementById('active-veh-label');
            if (!select) return;

            let html = '';
            dbData.vehicles.forEach(v => {
                html += `<option value="${v.id}" ${v.id === dbData.activeVehicleId ? 'selected' : ''}>${escapeHTML(v.name)}</option>`;
            });
            select.innerHTML = html;

            const activeVeh = getActiveVehicle();
            if (plateEl) plateEl.textContent = `Plate: ${activeVeh.plate || '-'}`;
            if (vehLabel) vehLabel.textContent = activeVeh.name;
        }

        function switchActiveVehicle(id) {
            dbData.activeVehicleId = id;
            saveData();
            updateVehicleSelector();
            refreshActiveView();
            showToast("Switched vehicle");
        }

        let currentActiveTab = 'dashboard';

        function switchTab(tabId) {
            currentActiveTab = tabId;
            document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById(`tab-${tabId}`);
            if (target) target.classList.remove('hidden');

            ['dashboard', 'fuel', 'maintenance', 'tax', 'trips'].forEach(t => {
                const navBtn = document.getElementById(`nav-${t}`);
                if (!navBtn) return;
                if (t === tabId) {
                    navBtn.className = "flex flex-col items-center space-y-1 text-emerald-600 transition flex-1 py-1";
                } else {
                    navBtn.className = "flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-600 transition flex-1 py-1";
                }
            });

            refreshActiveView();
            // The five tabs share #main-content as their scroll container.
            // Always open a selected tab at its heading, regardless of the prior tab position.
            const scrollRegion = document.getElementById('main-content');
            if (scrollRegion) {
                scrollRegion.scrollTop = 0;
                scrollRegion.scrollLeft = 0;
            }
        }

        function changeFilter() {
            refreshActiveView();
        }

        function getFilterCriteria() {
            const monthEl = document.getElementById('filter-month');
            const yearEl = document.getElementById('filter-year');
            return {
                month: monthEl ? monthEl.value : 'all',
                year: yearEl ? yearEl.value : 'all'
            };
        }

        function filterByDate(itemDate) {
            if (!itemDate) return true;
            const { month, year } = getFilterCriteria();
            const [itemY,monthNum] = String(itemDate).slice(0,10).split('-');
            const itemM = String(Number(monthNum)-1);

            if (month !== 'all' && itemM !== month) return false;
            if (year !== 'all' && itemY !== year) return false;
            return true;
        }

        function refreshActiveView() {
            updateRemindersBanner();
            updateDashboard();
            renderFuelList();
            renderMaintenanceList();
            renderTaxList();
            renderTripList();
            renderOtherList();
            renderRecentActivities();
        }

        function updateRemindersBanner() {
            const banner = document.getElementById('reminders-banner');
            if (!banner) return;
            const activeVeh = getActiveVehicle();
            let html = '';

            // Check Tax expiry
            const taxes = dbData.tax.filter(t => t.vehicleId === activeVeh.id && t.expiry);
            // Most recent renewal by expense category supersedes older expiries.
            const latestByType = Object.values(taxes.reduce((acc,t) => {
                if (!acc[t.type] || String(t.date) > String(acc[t.type].date)) acc[t.type] = t;
                return acc;
            }, Object.create(null)));
            latestByType.forEach(t => {
                const expDate = new Date(t.expiry + 'T00:00:00');
                const today = new Date(localToday() + 'T00:00:00');
                const diffDays = Math.round((expDate - today) / 86400000);
                if (diffDays <= 30) {
                    html += `
                        <div class="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs text-amber-800">
                            <div class="flex items-center space-x-2">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-amber-600" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480L40 480c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24l0 112c0 13.3 10.7 24 24 24s24-10.7 24-24l0-112c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"></path></svg>
                                <span><strong>${escapeHTML(t.type)}</strong> expires in ${diffDays < 0 ? `EXPIRED ${Math.abs(diffDays)} days ago` : (diffDays === 0 ? 'TODAY' : diffDays + ' days')} (${escapeHTML(t.expiry)})</span>
                            </div>
                            <button onclick="switchTab('tax')" class="font-bold underline">View</button>
                        </div>
                    `;
                }
            });

            // Check Tire Mileage
            const tireDelta = activeVeh.currentOdometer - (activeVeh.lastTireChangeOdometer || 0);
            const tireLimit = activeVeh.tireMileageLimit || 40000;
            if (activeVeh.lastTireChangeOdometer > 0 && tireDelta >= tireLimit - 3000) {
                html += `
                    <div class="bg-rose-50 border border-rose-200 p-3 rounded-2xl flex items-center justify-between text-xs text-rose-800">
                        <div class="flex items-center space-x-2">
                            <svg aria-hidden="true" focusable="false" class="app-icon text-rose-600" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"></path></svg>
                            <span><strong>Tire Alert:</strong> Driven ${tireDelta} km since last change. Recommended check/replacement soon!</span>
                        </div>
                        <button onclick="switchTab('maintenance')" class="font-bold underline">Service</button>
                    </div>
                `;
            }

            banner.innerHTML = html;
        }

        function updateDashboard() {
            const activeVeh = getActiveVehicle();
            const fuels = dbData.fuel.filter(f => f.vehicleId === activeVeh.id && filterByDate(f.date));
            const maints = dbData.maintenance.filter(m => m.vehicleId === activeVeh.id && filterByDate(m.date));
            const taxes = dbData.tax.filter(t => t.vehicleId === activeVeh.id && filterByDate(t.date));
            const trips = dbData.trips.filter(tr => tr.vehicleId === activeVeh.id && filterByDate(tr.date));
            const others = dbData.other.filter(o => o.vehicleId === activeVeh.id && filterByDate(o.date));

            const totalFuel = fuels.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
            const totalMaint = maints.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
            const totalTax = taxes.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
            const totalOther = others.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0) + trips.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);

            const grandTotal = totalFuel + totalMaint + totalTax + totalOther;

            const totalDistance = trips.reduce((acc, cur) => acc + (Number(cur.distance) || 0), 0);
            // Cumulative odometer is NOT the same as the sum of logged journeys.
            // Show the latest measured odometer within the selected period. For all-time
            // views, include the stored current odometer when it is the latest reading.
            const readings = [
              ...fuels.map(x => ({date:x.date, odo:Number(x.odometer)})),
              ...maints.map(x => ({date:x.date, odo:Number(x.odometer)})),
              ...trips.map(x => ({date:x.date, odo:Number(x.endOdometer)}))
            ].filter(x => x.date && x.odo > 0 && Number.isFinite(x.odo));
            readings.sort((a,b) => a.date.localeCompare(b.date) || a.odo-b.odo);
            const recordedOdo=readings.length ? readings[readings.length-1].odo : null;
            const criteria=getFilterCriteria();
            const allPeriods=criteria.year==='all' && criteria.month==='all';
            const odometer=allPeriods ? Math.max(Number(activeVeh.currentOdometer)||0,recordedOdo||0) : recordedOdo;
            const avgEff = getEfficiencyForPeriod(activeVeh.id);

            const sumCostEl = document.getElementById('sum-total-cost');
            const sumDistEl = document.getElementById('sum-total-distance');
            const sumEffEl = document.getElementById('sum-avg-efficiency');

            if (sumCostEl) sumCostEl.textContent = money(grandTotal);
            if (sumDistEl) sumDistEl.textContent = odometer == null ? '—' : `${odometer.toLocaleString('en-US')} km`;
            const tripSumEl = document.getElementById('sum-trip-distance');
            if (tripSumEl) tripSumEl.textContent = `Logged trips: ${totalDistance.toLocaleString('en-US')} km`;
            if (sumEffEl) sumEffEl.textContent = avgEff === '—' ? '—' : `${avgEff} km/L (est.)`;

            const cfCost = document.getElementById('card-fuel-cost');
            const cfCount = document.getElementById('card-fuel-count');
            if (cfCost) cfCost.textContent = money(totalFuel);
            if (cfCount) cfCount.textContent = `${fuels.length} logs`;

            const cmCost = document.getElementById('card-maint-cost');
            const cmCount = document.getElementById('card-maint-count');
            if (cmCost) cmCost.textContent = money(totalMaint);
            if (cmCount) cmCount.textContent = `${maints.length} logs`;

            const ctCost = document.getElementById('card-tax-cost');
            const ctCount = document.getElementById('card-tax-count');
            if (ctCost) ctCost.textContent = money(totalTax + others.reduce((sum, item) => sum + (Number(item.cost) || 0), 0));
            if (ctCount) ctCount.textContent = `${taxes.length + others.length} logs`;

            const coCost = document.getElementById('card-other-cost');
            const coCount = document.getElementById('card-other-count');
            if (coCost) coCost.textContent = `${totalDistance.toLocaleString('en-US')} km`;
            if (coCount) coCount.textContent = `${trips.length} trips`;
            renderMonthlyTrends();
        }

        function renderFuelList() {
            const container = document.getElementById('fuel-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();
            const list = dbData.fuel.filter(f => f.vehicleId === activeVeh.id && filterByDate(f.date)).sort((a,b) => new Date(b.date) - new Date(a.date));

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No fuel records found for this period.</div>`;
                return;
            }

            let html = '';
            const intervalMap=new Map(fuelIntervals(activeVeh.id).map(x=>[x.item.id,x]));
            list.forEach(item => {
                const interval=intervalMap.get(item.id);
                const estimate=interval?.distance!=null ? ` · ${fmtCount(interval.distance)} km${interval.rate!=null?' · ~'+interval.rate.toFixed(1)+' km/L':''}` : '';
                html += `
                    <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-sm" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32 64C32 28.7 60.7 0 96 0L256 0c35.3 0 64 28.7 64 64l0 192 8 0c48.6 0 88 39.4 88 88l0 32c0 13.3 10.7 24 24 24s24-10.7 24-24l0-154c-27.6-7.1-48-32.2-48-62l0-64L384 64c-8.8-8.8-8.8-23.2 0-32s23.2-8.8 32 0l77.3 77.3c12 12 18.7 28.3 18.7 45.3l0 13.5 0 24 0 32 0 152c0 39.8-32.2 72-72 72s-72-32.2-72-72l0-32c0-22.1-17.9-40-40-40l-8 0 0 144c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 512c-17.7 0-32-14.3-32-32s14.3-32 32-32L32 64zM96 80l0 96c0 8.8 7.2 16 16 16l128 0c8.8 0 16-7.2 16-16l0-96c0-8.8-7.2-16-16-16L112 64c-8.8 0-16 7.2-16 16z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(item.fuelType || 'RON95')} • ${item.liters} L</h4>
                                <p class="text-[10px] text-slate-500">${item.date} | ${escapeHTML(item.notes||item.station||'')} (${fmtCount(item.odometer)} km)${estimate}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="font-bold text-slate-900 text-sm">${money(item.cost)}</span>
                            <button onclick="editItem('fuel', '${item.id}')" title="Edit" aria-label="Edit record" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteItem('fuel', '${item.id}')" class="text-slate-400 hover:text-rose-600 text-xs w-7 h-7 inline-flex items-center justify-center">
                                <svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function renderMaintenanceList() {
            const container = document.getElementById('maintenance-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();
            const list = dbData.maintenance.filter(m => m.vehicleId === activeVeh.id && filterByDate(m.date)).sort((a,b) => new Date(b.date) - new Date(a.date));

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No maintenance records found.</div>`;
                return;
            }

            let html = '';
            list.forEach(item => {
                html += `
                    <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-sm" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7L336 192c-8.8 0-16-7.2-16-16l0-57.4c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L297.5 310.5c17 6.2 35.4 9.5 54.5 9.5zM80 408a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(isTollExpense(item.type)?'Toll Fee':isParkingExpense(item.type)?'Parking':item.type)}</h4>
                                <p class="text-[10px] text-slate-500">${item.date} | ${escapeHTML(item.garage || 'Workshop')} (${item.odometer} km)</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="font-bold text-slate-900 text-sm">${money(item.cost)}</span>
                            <button onclick="editItem('maintenance', '${item.id}')" title="Edit" aria-label="Edit record" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteItem('maintenance', '${item.id}')" class="text-slate-400 hover:text-rose-600 text-xs w-7 h-7 inline-flex items-center justify-center">
                                <svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function renderTaxList() {
            const container = document.getElementById('tax-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();
            const list = dbData.tax.filter(t => t.vehicleId === activeVeh.id && filterByDate(t.date)).sort((a,b) => new Date(b.date) - new Date(a.date));

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No expenses found for this period.</div>`;
                return;
            }

            let html = '';
            list.forEach(item => {
                html += `
                    <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-sm" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 80c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16L80 96c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-64 0c-8.8 0-16-7.2-16-16zm128 72c8.8 0 16 7.2 16 16l0 17.3c8.5 1.2 16.7 3.1 24.1 5.1c8.5 2.3 13.6 11 11.3 19.6s-11 13.6-19.6 11.3c-11.1-3-22-5.2-32.1-5.3c-8.4-.1-17.4 1.8-23.6 5.5c-5.7 3.4-8.1 7.3-8.1 12.8c0 3.7 1.3 6.5 7.3 10.1c6.9 4.1 16.6 7.1 29.2 10.9l.5 .1s0 0 0 0s0 0 0 0c11.3 3.4 25.3 7.6 36.3 14.6c12.1 7.6 22.4 19.7 22.7 38.2c.3 19.3-9.6 33.3-22.9 41.6c-7.7 4.8-16.4 7.6-25.1 9.1l0 17.1c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-17.8c-11.2-2.1-21.7-5.7-30.9-8.9c0 0 0 0 0 0c-2.1-.7-4.2-1.4-6.2-2.1c-8.4-2.8-12.9-11.9-10.1-20.2s11.9-12.9 20.2-10.1c2.5 .8 4.8 1.6 7.1 2.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c13.6 4.6 24.6 8.4 36.3 8.7c9.1 .3 17.9-1.7 23.7-5.3c5.1-3.2 7.9-7.3 7.8-14c-.1-4.6-1.8-7.8-7.7-11.6c-6.8-4.3-16.5-7.4-29-11.2l-1.6-.5s0 0 0 0c-11-3.3-24.3-7.3-34.8-13.7c-12-7.2-22.6-18.9-22.7-37.3c-.1-19.4 10.8-32.8 23.8-40.5c7.5-4.4 15.8-7.2 24.1-8.7l0-17.3c0-8.8 7.2-16 16-16z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(item.type)}</h4>
                                <p class="text-[10px] text-slate-500">${escapeHTML(item.date)}${isTermExpense(item.type) && item.expiry ? ' | Expires: '+escapeHTML(item.expiry):''}${item.time?' · '+escapeHTML(item.time):''}${item.notes?' · '+escapeHTML(item.notes):''}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="font-bold text-slate-900 text-sm">${money(item.cost)}</span>
                            <button onclick="editItem('tax', '${item.id}')" title="Edit" aria-label="Edit record" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteItem('tax', '${item.id}')" class="text-slate-400 hover:text-rose-600 text-xs w-7 h-7 inline-flex items-center justify-center">
                                <svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function renderTripList() {
            const container = document.getElementById('trip-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();
            const list = dbData.trips.filter(tr => tr.vehicleId === activeVeh.id && filterByDate(tr.date)).sort((a,b) => new Date(b.date) - new Date(a.date));

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No trip logs found.</div>`;
                return;
            }

            let html = '';
            list.forEach(item => {
                html += `
                    <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-sm" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 96c0 50.2-59.1 125.1-84.6 155c-3.8 4.4-9.4 6.1-14.5 5L320 256c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c53 0 96 43 96 96s-43 96-96 96l-276.4 0c8.7-9.9 19.3-22.6 30-36.8c6.3-8.4 12.8-17.6 19-27.2L416 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0c-53 0-96-43-96-96s43-96 96-96l39.8 0c-21-31.5-39.8-67.7-39.8-96c0-53 43-96 96-96s96 43 96 96zM117.1 489.1c-3.8 4.3-7.2 8.1-10.1 11.3l-1.8 2-.2-.2c-6 4.6-14.6 4-20-1.8C59.8 473 0 402.5 0 352c0-53 43-96 96-96s96 43 96 96c0 30-21.1 67-43.5 97.9c-10.7 14.7-21.7 28-30.8 38.5l-.6 .7zM128 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM416 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(item.purpose)}</h4>
                                <p class="text-[10px] text-slate-500">${item.date} | ${item.distance} km (${item.startOdometer} ➔ ${item.endOdometer})</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <button onclick="editItem('trips', '${item.id}')" title="Edit" aria-label="Edit record" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteItem('trips', '${item.id}')" class="text-slate-400 hover:text-rose-600 text-xs w-7 h-7 inline-flex items-center justify-center">
                                <svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function renderOtherList() {
            const container = document.getElementById('other-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();
            const list = dbData.other.filter(o => o.vehicleId === activeVeh.id && filterByDate(o.date)).sort((a,b) => new Date(b.date) - new Date(a.date));

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No other expenses found.</div>`;
                return;
            }

            let html = '';
            list.forEach(item => {
                html += `
                    <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                                <svg aria-hidden="true" focusable="false" class="app-icon text-sm" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M14 2.2C22.5-1.7 32.5-.3 39.6 5.8L80 40.4 120.4 5.8c9-7.7 22.3-7.7 31.2 0L192 40.4 232.4 5.8c9-7.7 22.3-7.7 31.2 0L304 40.4 344.4 5.8c7.1-6.1 17.1-7.5 25.6-3.6s14 12.4 14 21.8l0 464c0 9.4-5.5 17.9-14 21.8s-18.5 2.5-25.6-3.6L304 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L192 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L80 471.6 39.6 506.2c-7.1 6.1-17.1 7.5-25.6 3.6S0 497.4 0 488L0 24C0 14.6 5.5 6.1 14 2.2zM96 144c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 144zM80 352c0 8.8 7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 336c-8.8 0-16 7.2-16 16zM96 240c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 240z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(item.description)}</h4>
                                <p class="text-[10px] text-slate-500">${item.date} | ${escapeHTML(item.notes || '-')}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="font-bold text-slate-900 text-sm">${money(item.cost)}</span>
                            <button onclick="editItem('other', '${item.id}')" title="Edit" aria-label="Edit record" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteItem('other', '${item.id}')" class="text-slate-400 hover:text-rose-600 text-xs w-7 h-7 inline-flex items-center justify-center">
                                <svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function renderRecentActivities() {
            const container = document.getElementById('recent-activities-list');
            if (!container) return;
            const activeVeh = getActiveVehicle();

            let all = [];
            dbData.fuel.filter(f => f.vehicleId === activeVeh.id).forEach(x => all.push({...x, cat: 'fuel'}));
            dbData.maintenance.filter(m => m.vehicleId === activeVeh.id).forEach(x => all.push({...x, cat: 'maintenance'}));
            dbData.tax.filter(t => t.vehicleId === activeVeh.id).forEach(x => all.push({...x, cat: 'tax'}));
            dbData.trips.filter(tr => tr.vehicleId === activeVeh.id).forEach(x => all.push({...x, cat: 'trips'}));
            dbData.other.filter(o => o.vehicleId === activeVeh.id).forEach(x => all.push({...x, cat: 'other'}));

            all.sort((a,b) => new Date(b.date) - new Date(a.date));
            const recent = all.slice(0, 4);

            if (recent.length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">No activities recorded yet.</p>`;
                return;
            }

            let html = '';
            recent.forEach(item => {
                let title = item.fuelType || item.type || item.purpose || item.description || 'Expense';
                let costStr = item.cost ? `${money(item.cost)}` : `${item.distance || 0} km`;
                let iconClass = item.cat === 'fuel' ? 'fa-gas-pump text-orange-600 bg-orange-100' :
                                item.cat === 'maintenance' ? 'fa-wrench text-blue-600 bg-blue-100' :
                                item.cat === 'tax' ? 'fa-file-invoice-dollar text-purple-600 bg-purple-100' :
                                item.cat === 'trips' ? 'fa-route text-rose-600 bg-rose-100' : 'fa-receipt text-slate-600 bg-slate-100';

                html += `
                    <div class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold ${iconClass}">
                                ${iconSVG(iconClass.split(' ')[0], 'text-xs')}
                            </div>
                            <div>
                                <p class="text-xs font-bold text-slate-800">${escapeHTML(title)}</p>
                                <p class="text-[10px] text-slate-400">${item.date}</p>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-slate-900">${costStr}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        const isTermExpense = type => /road tax|insurance/i.test(String(type||''));
        const isTollExpense = type => /toll|rfid|smarttag/i.test(String(type||''));
        const isParkingExpense = type => /parking/i.test(String(type||''));
        function updateExpenseFields() {
          const select=document.getElementById('tax-type');if(!select)return;
          const type=select.value;
          const term=isTermExpense(type),quick=isTollExpense(type)||isParkingExpense(type);
          const expiry=document.getElementById('tax-expiry-group');
          const time=document.getElementById('tax-time-group');
          const again=document.getElementById('expense-add-another');
          expiry.hidden=!term;time.hidden=!quick;again.hidden=!quick;
          if(!term)document.getElementById('tax-expiry').value='';
          const label=document.getElementById('tax-notes-label'),field=document.getElementById('tax-notes');
          if(isTollExpense(type)){label.textContent='Toll plaza / route';field.placeholder='e.g. Kapar Barrier / PLUS';}
          else if(isParkingExpense(type)){label.textContent='Parking location';field.placeholder='e.g. Mall car park / zone';}
          else if(term){label.textContent='Provider / policy reference';field.placeholder='e.g. JPJ / insurance company';}
          else {label.textContent='Expense description / notes';field.placeholder='Describe the expense';}
          const title=document.getElementById('modal-title');
          title.textContent=(document.getElementById('form-id').value?'Edit ':'Add ')+(quick?(isParkingExpense(type)?'Parking':'Toll'):'Vehicle Expense')+' Record';
        }
        function saveAndAddAnotherExpense() {
          if(document.getElementById('form-type').value!=='tax')return;
          const type=document.getElementById('tax-type').value;
          const date=document.getElementById('field-date').value;
          if(!document.getElementById('entry-form').reportValidity())return;
          const saved=handleFormSubmit({preventDefault(){}});
          if(saved===false)return;
          openModal('tax');
          document.getElementById('field-date').value=date;
          document.getElementById('tax-type').value=type;
          updateExpenseFields();
          document.getElementById('tax-cost').focus();
        }
        function openModal(type) {
            const modal = document.getElementById('app-modal');
            const titleEl = document.getElementById('modal-title');
            const formTypeEl = document.getElementById('form-type');
            const dateEl = document.getElementById('field-date');
            if (!modal) return;

            document.getElementById('entry-form').reset();
            document.getElementById('form-id').value='';
            document.getElementById('trip-start-odo').dataset.autoStart='';
            formTypeEl.value = type;
            dateEl.value = localToday();
            document.getElementById('receipt-preview').classList.add('hidden');
            document.getElementById('receipt-status').classList.add('hidden');

            document.querySelectorAll('.form-section').forEach(sec => sec.classList.add('hidden'));
            const activeSec = document.getElementById(`fields-${type === 'trip' ? 'trip' : type}`);
            if (activeSec) activeSec.classList.remove('hidden');

            titleEl.textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1)} Record`;

            // Pre-fill active vehicle fuel type if fuel modal
            if (type === 'fuel') {
                const activeVeh = getActiveVehicle();
                const fuelSel = document.getElementById('fuel-type-name');
                if (fuelSel && activeVeh.defaultFuel) {
                    fuelSel.value = activeVeh.defaultFuel;
                }
                const odoIn = document.getElementById('fuel-odometer');
                if (odoIn && activeVeh.currentOdometer) {
                    odoIn.value = activeVeh.currentOdometer;
                }
                estimateFuelForm();
            }

            if(type==='tax') {document.getElementById('tax-type').value='Toll Pass / RFID / SmartTAG';updateExpenseFields();}
            if (type === 'trip') fillSuggestedTripStart(true);
            modal.classList.remove('hidden');
        }

        // For a new journey, use the most recent preceding journey's END odometer.
        // Never overwrite a manually edited start value or an existing record.
        function fillSuggestedTripStart(force=false) {
            const id=document.getElementById('form-id').value;
            if(id) return;
            const field=document.getElementById('trip-start-odo');
            if(!field) return;
            if(!force && field.value && field.dataset.autoStart!=='yes') return;
            const date=document.getElementById('field-date').value;
            const car=getActiveVehicle();
            const previous=dbData.trips.filter(t => t.vehicleId===car.id && t.date<=date && Number(t.endOdometer)>0)
                .sort((a,b)=> b.date.localeCompare(a.date) || Number(b.endOdometer)-Number(a.endOdometer))[0];
            if(previous) {
                field.value=previous.endOdometer;
                field.dataset.autoStart='yes';
                document.getElementById('trip-start-hint').textContent=`Auto-filled from previous trip (${previous.date}).`;
            } else {
                if(field.dataset.autoStart==='yes') field.value='';
                field.dataset.autoStart='';
                document.getElementById('trip-start-hint').textContent='No earlier trip found. Enter starting odometer manually.';
            }
        }

        function closeModal() {
            const modal = document.getElementById('app-modal');
            if (modal) modal.classList.add('hidden');
        }

        function openVehicleModal() {
            document.getElementById('vehicle-form').reset();
            document.getElementById('veh-id').value='';
            document.getElementById('veh-form-title').textContent='Add New Vehicle';
            renderVehicleManagementList();
            const modal = document.getElementById('vehicle-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeVehicleModal() {
            const modal = document.getElementById('vehicle-modal');
            if (modal) modal.classList.add('hidden');
        }

        function openLogoModal() {
            const modal = document.getElementById('logo-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeLogoModal() {
            const modal = document.getElementById('logo-modal');
            if (modal) modal.classList.add('hidden');
        }

        function openSettingsModal() {
            MYCARCurrency.init();
            const modal = document.getElementById('settings-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeSettingsModal() {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.classList.add('hidden');
        }

        function previewReceipt(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            const status=document.getElementById('receipt-status');
            const preview=document.getElementById('receipt-preview');
            if (!file.type.startsWith('image/')) {
                status.textContent='Choose an image file.';
                status.classList.remove('hidden');
                return;
            }
            const reader=new FileReader();
            reader.onload=()=> {
                preview.src=reader.result;
                preview.classList.remove('hidden');
                status.textContent='Photo preview only. Verify and enter actual values manually; photos are not stored.';
                status.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
        function editItem(collection,id) {
            const item=dbData[collection]?.find(x=>x.id===id);
            if (!item) return;
            const type=collection==='trips' ? 'trip' : collection;
            openModal(type);
            document.getElementById('form-id').value=id;
            document.getElementById('modal-title').textContent='Edit '+type+' Record';
            const put=(field,value)=>{const el=document.getElementById(field);if(el) el.value=value ?? '';};
            put('field-date',item.date);
            if(type==='fuel') {
                put('fuel-odometer',item.odometer); put('fuel-liters',item.liters);
                put('fuel-cost',item.cost); put('fuel-type-name',item.fuelType);
                put('fuel-station',item.station||item.notes||'');
                estimateFuelForm();
            } else if(type==='maintenance') {
                put('maint-odometer',item.odometer); put('maint-cost',item.cost); put('maint-type',item.type);
                put('maint-garage',item.garage); put('maint-notes',item.notes);
            } else if(type==='tax') {
                // Preserve imported types when editing older statements.
            const typeSelect=document.getElementById('tax-type');
            if(item.type && !Array.from(typeSelect.options).some(o=>o.value===item.type)) {
              const opt=new Option(item.type,item.type);typeSelect.add(opt);
            }
            put('tax-type',item.type); put('tax-cost',item.cost); put('tax-expiry',item.expiry); put('tax-notes',item.notes);
            put('tax-time',item.time);updateExpenseFields();
            } else if(type==='trip') {
                put('trip-purpose',item.purpose);put('trip-start-odo',item.startOdometer);
                put('trip-end-odo',item.endOdometer);put('trip-notes',item.notes);
            } else if(type==='other') {
                put('other-desc',item.description);put('other-cost',item.cost);put('other-notes',item.notes);
            }
        }

        function handleFormSubmit(event) {
            event.preventDefault();
            const type = document.getElementById('form-type').value;
            const date = document.getElementById('field-date').value;
            const activeVeh = getActiveVehicle();
            const id = document.getElementById('form-id').value || uniqueId();

            if (type === 'fuel') {
                const odo = Number(document.getElementById('fuel-odometer').value) || 0;
                const liters = Number(document.getElementById('fuel-liters').value) || 0;
                const cost = Number(document.getElementById('fuel-cost').value) || 0;
                const fuelType = document.getElementById('fuel-type-name').value;
                const station = document.getElementById('fuel-station').value;

                if (!(odo > 0 && liters > 0 && cost >= 0)) { alert('Enter an odometer, positive litres, and a valid cost.'); return; }
                upsertRecord('fuel', { id, vehicleId: activeVeh.id, date, odometer: odo, liters, cost, fuelType, station, notes: station });
                if (odo > activeVeh.currentOdometer) {
                    activeVeh.currentOdometer = odo;
                }
                activeVeh.defaultFuel = fuelType;
            } else if (type === 'maintenance') {
                const odo = Number(document.getElementById('maint-odometer').value) || 0;
                const cost = Number(document.getElementById('maint-cost').value) || 0;
                const mType = document.getElementById('maint-type').value;
                const garage = document.getElementById('maint-garage').value;
                const notes = document.getElementById('maint-notes').value;

                upsertRecord('maintenance', { id, vehicleId: activeVeh.id, date, odometer: odo, cost, type: mType, garage, notes });
                if (mType === 'Tire Replacement') {
                    activeVeh.lastTireChangeOdometer = odo;
                }
                if (odo > activeVeh.currentOdometer) {
                    activeVeh.currentOdometer = odo;
                }
            } else if (type === 'tax') {
                const tType = document.getElementById('tax-type').value;
                const cost = Number(document.getElementById('tax-cost').value) || 0;
                const expiry = isTermExpense(tType) ? document.getElementById('tax-expiry').value : '';
                const notes = document.getElementById('tax-notes').value.trim();
                const time = (isTollExpense(tType)||isParkingExpense(tType)) ? document.getElementById('tax-time').value : '';
                if(!Number.isFinite(cost)||cost<=0){alert('Please enter a positive expense amount.');return false;}
                // Unique record ID per toll gate, including multiple payments on one date.
                upsertRecord('tax', { id, vehicleId: activeVeh.id, date, type: tType, cost, expiry, notes, time });
            } else if (type === 'trip') {
                const purpose = document.getElementById('trip-purpose').value;
                const startOdo = Number(document.getElementById('trip-start-odo').value) || 0;
                const endOdo = Number(document.getElementById('trip-end-odo').value) || 0;
                const notes = document.getElementById('trip-notes').value;
                if (!(endOdo >= startOdo && endOdo > 0)) { alert('End odometer must be greater than or equal to start odometer.'); return; }
                const distance = endOdo-startOdo;

                upsertRecord('trips', { id, vehicleId: activeVeh.id, date, purpose, startOdometer: startOdo, endOdometer: endOdo, distance, notes, cost: 0 });
                if (endOdo > activeVeh.currentOdometer) {
                    activeVeh.currentOdometer = endOdo;
                }
            } else if (type === 'other') {
                const desc = document.getElementById('other-desc').value;
                const cost = Number(document.getElementById('other-cost').value) || 0;
                const notes = document.getElementById('other-notes').value;

                upsertRecord('other', { id, vehicleId: activeVeh.id, date, description: desc, cost, notes });
            }

            saveData();
            closeModal();
            updateVehicleSelector();
            refreshActiveView();
            showToast("Record saved successfully");
            return true;
        }

        function deleteItem(collection, id) {
            if (!confirm("Are you sure you want to delete this record?")) return;
            dbData[collection] = dbData[collection].filter(x => x.id !== id);
            saveData();
            refreshActiveView();
            showToast("Record deleted");
        }

        function renderVehicleManagementList() {
            const container = document.getElementById('vehicle-list-container');
            if (!container) return;

            let html = '';
            dbData.vehicles.forEach(v => {
                const isSelected = v.id === dbData.activeVehicleId;
                html += `
                    <div class="bg-slate-50 border ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'} p-3 rounded-2xl flex items-center justify-between">
                        <div>
                            <h4 class="font-bold text-slate-800 text-xs">${escapeHTML(v.name)} ${isSelected ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded ml-1">Active</span>' : ''}</h4>
                            <p class="text-[10px] text-slate-500">Plate: ${escapeHTML(v.plate)} | Fuel: ${escapeHTML(v.defaultFuel)} | Odo: ${v.currentOdometer} km</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${!isSelected ? `<button onclick="switchActiveVehicle('${v.id}')" class="text-[10px] bg-slate-900 text-white px-2 py-1 rounded-lg font-bold">Select</button>` : ''}
                            <button onclick="editVehicle('${v.id}')" aria-label="Edit vehicle" title="Edit vehicle" class="text-emerald-600 hover:text-emerald-800 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path></svg></button>
                            <button onclick="deleteVehicle('${v.id}')" class="text-rose-500 hover:text-rose-700 text-xs w-7 h-7 inline-flex items-center justify-center"><svg aria-hidden="true" focusable="false" class="app-icon " viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg></button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function editVehicle(id) {
            const veh=dbData.vehicles.find(v=>v.id===id);
            if (!veh) return;
            document.getElementById('veh-form-title').textContent='Edit Vehicle';
            document.getElementById('veh-id').value=id;
            for (const [field,value] of Object.entries({
                'veh-name':veh.name,'veh-plate':veh.plate,'veh-fuel':veh.defaultFuel,
                'veh-odo':veh.currentOdometer,'veh-tire-limit':veh.tireMileageLimit,
                'veh-last-tire-odo':veh.lastTireChangeOdometer
            })) document.getElementById(field).value=value ?? '';
        }
        function handleVehicleSubmit(event) {
            event.preventDefault();
            const name = document.getElementById('veh-name').value;
            const plate = document.getElementById('veh-plate').value;
            const fuel = document.getElementById('veh-fuel').value;
            const odo = Number(document.getElementById('veh-odo').value) || 0;
            const tireLimit = Number(document.getElementById('veh-tire-limit').value) || 40000;
            const lastTireOdo = Number(document.getElementById('veh-last-tire-odo').value) || 0;

            if (odo < 0 || tireLimit <= 0 || lastTireOdo < 0 || lastTireOdo > odo) {
                alert('Please check odometer and tyre mileage values.'); return;
            }
            const id = document.getElementById('veh-id').value || uniqueId('v');
            const data={ id, name:name.trim(), plate:plate.trim(), defaultFuel:fuel, currentOdometer:odo, tireMileageLimit:tireLimit, lastTireChangeOdometer:lastTireOdo };
            const index=dbData.vehicles.findIndex(v=>v.id===id);
            if(index>=0) dbData.vehicles[index]=data;
            else dbData.vehicles.push(data);
            dbData.activeVehicleId = id;

            saveData();
            updateVehicleSelector();
            closeVehicleModal();
            refreshActiveView();
            showToast("New vehicle added");

            document.getElementById('vehicle-form').reset();
            document.getElementById('veh-id').value='';
            document.getElementById('veh-form-title').textContent='Add New Vehicle';
        }

        function deleteVehicle(id) {
            if (dbData.vehicles.length <= 1) {
                alert("You must keep at least one vehicle in the system.");
                return;
            }
            if (!confirm("Delete this vehicle and all its associated logs?")) return;
            dbData.vehicles = dbData.vehicles.filter(v => v.id !== id);
            dbData.fuel = dbData.fuel.filter(f => f.vehicleId !== id);
            dbData.maintenance = dbData.maintenance.filter(m => m.vehicleId !== id);
            dbData.tax = dbData.tax.filter(t => t.vehicleId !== id);
            dbData.trips = dbData.trips.filter(tr => tr.vehicleId !== id);
            dbData.other = dbData.other.filter(o => o.vehicleId !== id);

            if (dbData.activeVehicleId === id) {
                dbData.activeVehicleId = dbData.vehicles[0].id;
            }

            saveData();
            updateVehicleSelector();
            renderVehicleManagementList();
            refreshActiveView();
            showToast("Vehicle deleted");
        }

        function downloadTextFile(text, filename, mime) {
            const blob=new Blob([text],{type:mime});
            const url=URL.createObjectURL(blob);
            const anchor=document.createElement('a');
            anchor.href=url; anchor.download=filename;
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            setTimeout(()=>URL.revokeObjectURL(url), 3000);
        }
        function toggleMYCARExportPeriod() {
          const select=document.getElementById('mycar-export-scope');
          document.getElementById('mycar-export-range').hidden=select.value!=='range';
        }
        function selectedExportData() {
          const scope=document.getElementById('mycar-export-scope')?.value||'all';
          if(scope==='all')return {data:dbData,label:'all',isFull:true};
          const from=document.getElementById('mycar-export-start').value;
          const to=document.getElementById('mycar-export-end').value;
          if(!/^\d{4}-\d{2}$/.test(from)||!/^\d{4}-\d{2}$/.test(to)||from>to)throw new Error('Select a valid From and To month.');
          const data={...dbData,vehicles:dbData.vehicles.map(v=>({...v}))};
          for(const col of ['fuel','maintenance','tax','trips','other'])data[col]=dbData[col].filter(x=>typeof x.date==='string' && x.date.slice(0,7)>=from && x.date.slice(0,7)<=to);
          return {data,label:from+'_to_'+to,isFull:false};
        }
        function exportJSON() {
          let selection;try{selection=selectedExportData();}catch(e){alert(e.message);return;}
          // Date-scoped JSON is clearly a report, not a safe restore/replacement backup.
          const payload=selection.isFull?selection.data:{type:'MYCAR_PERIOD_REPORT_NOT_FOR_RESTORE',range:selection.label,generatedAt:new Date().toISOString(),records:selection.data};
          downloadTextFile(JSON.stringify(payload,null,2),`mycar_${selection.isFull?'backup':'report'}_${selection.label}_${localToday()}.json`,'application/json');
          showToast(selection.isFull?'Full JSON backup downloaded':'Period JSON report downloaded');
        }
        function exportCSV() {
          let selection;try{selection=selectedExportData();}catch(e){alert(e.message);return;}
          const data=selection.data;
          const rows=[['Category','Date','Vehicle','Plate','Details','Cost(RM)','Odometer(km)','Distance(km)','Litres','Notes']];
          const vehicleName=id=>data.vehicles.find(v=>v.id===id) || {name:'Unknown',plate:''};
          const add=(category,entry,details,notes,odo='',distance='',litres='')=>{
              const v=vehicleName(entry.vehicleId);
              rows.push([category,entry.date,v.name,v.plate,details,entry.cost ?? 0,odo,distance,litres,notes]);
          };
          data.fuel.forEach(f=>add('Fuel',f,f.fuelType,f.notes||f.station||'',f.odometer,'',f.liters));
          data.maintenance.forEach(m=>add('Maintenance',m,m.type,(m.garage||'')+' '+(m.notes||''),m.odometer));
          data.tax.forEach(t=>add('Expenses',t,t.type,(t.notes||'')+(isTermExpense(t.type)&&t.expiry?' | Expiry: '+t.expiry:'')+(t.time?' | Time: '+t.time:'')));
          data.trips.forEach(t=>add('Trip',t,t.purpose,t.notes,t.endOdometer,t.distance));
          data.other.forEach(o=>add('Other',o,o.description,o.notes));
          const safeCSV=value=>{
              const str=String(value??'');
              const cell=typeof value==='number' ? str : (/^[=+@-]/.test(str.trimStart()) ? "'"+str : str);
              return '"'+cell.replace(/"/g,'""')+'"';
          };
          const csv='\uFEFF'+rows.map(row=>row.map(safeCSV).join(',')).join('\r\n');
          downloadTextFile(csv,`mycar_report_${selection.label}_${localToday()}.csv`,'text/csv;charset=utf-8');
          showToast('CSV report downloaded');
        }

        function importJSON(event) {
            // Direct local replacement is unsafe with revision-aware cloud sync.
            if (event?.target) event.target.value='';
            alert('Direct JSON replacement is disabled. Use Verify Backup & Dry Run, then the controlled RPC Restore workflow after backend verification.');
        }

        function initializeMYCARAfterLogin(user) {
            MYCARCurrency.init();
            // Namespaced by backend project + verified user UUID. No automatic legacy-data migration.
            STORAGE_KEY = `mycar_auth_v1:${AuthManager.projectId}:${user.id}`;
            dbData = newEmptyData();
            loadData();
            initYearFilter();
            updateVehicleSelector();
            switchTab('dashboard');
            document.getElementById('account-email').textContent = user.email || user.id;
            const legacyBtn = document.getElementById('import-legacy-btn');
            if (legacyBtn) legacyBtn.classList.toggle('hidden', !localStorage.getItem('mycar_app_data_v2'));
            document.getElementById('mycar-app-shell').hidden = false;
            document.getElementById('auth-screen').hidden = true;
            MYCARCloud.start(user,{
                getData:()=>JSON.parse(JSON.stringify(dbData)),
                applyData:(updated)=>{
                    // Cloud updates must not be queued again as local edits.
                    if(!isValidBackup(updated)) {
                        // An empty cloud account starts with a default vehicle.
                        if(updated?.vehicles?.length===0) return;
                        throw new Error('Unexpected cloud data format.');
                    }
                    dbData=updated;
                    lastSavedSnapshot=JSON.parse(JSON.stringify(dbData));
                    localStorage.setItem(STORAGE_KEY,JSON.stringify(dbData));
                    const yearEl=document.getElementById('filter-year');
                    const year=yearEl?.value;
                    initYearFilter();
                    if(yearEl && [...yearEl.options].some(opt=>opt.value===year)) yearEl.value=year;
                    updateVehicleSelector();
                    refreshActiveView();
                }
            });
            window.MYCARRestore?.refreshReverseButton?.();
        }

        function lockMYCARAfterLogout() {
            MYCARCloud.stop();
            closeSettingsModal();
            dbData = newEmptyData();
            STORAGE_KEY = null;
            lastSavedSnapshot = null;
            document.getElementById('mycar-app-shell').hidden = true;
            document.getElementById('auth-screen').hidden = false;
        }

        function importLegacyMYCARData() {
            if (!AuthManager.currentUser || !STORAGE_KEY) return;
            const old = localStorage.getItem('mycar_app_data_v2');
            if (!old) return showToast('No older records found on this device');
            try {
                const parsed = JSON.parse(old);
                if (!isValidBackup(parsed)) return alert('Older records are not in a supported backup format.');
                if (!confirm('Import previous MYCAR records to this account? This will REPLACE the current account records on this device. Your older records will not be deleted. Export a backup first.')) return;
                dbData = parsed;
                saveData();
                initYearFilter();
                updateVehicleSelector();
                refreshActiveView();
                closeSettingsModal();
                showToast('Previous MYCAR records imported');
            } catch (error) { alert('Unable to read older MYCAR records.'); }
        }

        // No data is read or exposed until Supabase has validated the account.
        window.addEventListener('DOMContentLoaded', () => {
            for(const id of ['field-date','fuel-odometer','fuel-liters']) {
                document.getElementById(id)?.addEventListener('input',estimateFuelForm);
                document.getElementById(id)?.addEventListener('change',estimateFuelForm);
            }
            AuthManager.init({onLogin: initializeMYCARAfterLogin, onLogout: lockMYCARAfterLogout});
            document.getElementById('field-date').addEventListener('change', () => {
                if (document.getElementById('form-type').value==='trip') fillSuggestedTripStart(false);
            });
            document.getElementById('trip-start-odo').addEventListener('input',e => {
                if(e.isTrusted) {
                    e.target.dataset.autoStart='';
                    document.getElementById('trip-start-hint').textContent='Manual starting odometer (will not be overwritten).';
                }
            });
        });
    