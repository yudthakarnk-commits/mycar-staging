/* MYCAR photo cards: use freely licensed Wikimedia reference photos, or the user's own photo.
 * This module adds no new database tables: optional vehicle.photo* fields are stored in
 * the existing per-user vehicle payload (protected by the existing RLS policies).
 */
const MYCARVehiclePhotos = (() => {
  const WIKI_API='https://commons.wikimedia.org/w/api.php';
  const PHOTO_CACHE = new Map();
  const COROLLA_CUTOUT_URL='./assets/toyota-corolla-cross-3q.webp';
  const COROLLA_CUTOUT={url:COROLLA_CUTOUT_URL,source:'',credit:'Illustrative vehicle image',license:'',label:'Corolla Cross · transparent 3/4 view',isCutout:true};
  const IMAGE_FIELDS = ['photoUrl','photoSource','photoCredit','photoLicense'];
  let picker=null, pickerRequest=0, shownCar='', inMigration=false;
  const e = id => document.getElementById(id);
  const normalize = text => String(text||'').replace(/\b(?:19|20)\d\d\b/g,'').replace(/\s+/g,' ').trim();
  const isModel = name => normalize(name).split(' ').filter(Boolean).length>=2 && normalize(name).toLowerCase()!=='my car';
  const fileFromWikimedia = url => {try { const u=new URL(url);return u.protocol==='https:' && (u.hostname==='upload.wikimedia.org' || u.hostname==='commons.wikimedia.org');}catch{return false;}};
  const safePhoto = url => typeof url==='string' && (url===COROLLA_CUTOUT_URL || fileFromWikimedia(url) || /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]{20,250000}$/.test(url));
  const normalizePlate = v => String(v||'').replace(/\s+/g,'').toUpperCase();

  // A known visual *reference*, not a claim about the owner's exact paint/trim.
  // CC BY 2.0, photographer S5A-0043; Wikimedia Commons, photographed in 2025.
  const COROLLA_PHOTO = {
    url:'https://commons.wikimedia.org/wiki/Special:FilePath/(MYS-Kuala_Lumpur)_Private_Toyota_Corolla_Cross_SB993_2025-01-28.jpg?width=640',
    source:'https://commons.wikimedia.org/wiki/File:(MYS-Kuala_Lumpur)_Private_Toyota_Corolla_Cross_SB993_2025-01-28.jpg',
    credit:'S5A-0043', license:'CC BY 2.0', label:'Toyota Corolla Cross (reference)'
  };

  const getVehicle=()=> typeof dbData!=='undefined' ? dbData.vehicles.find(v=>v.id===dbData.activeVehicleId)||dbData.vehicles[0]:null;
  const getFixedSource = vehicle => /^Toyota Corolla Cross(?:\s+20\d\d)?$/i.test(String(vehicle?.name||'').trim()) ? COROLLA_PHOTO : null;

  // Narrow, reversible user-requested correction of imported VQG8991 data only.
  // Does not change odo, distance, liters, dates, cost or other vehicles.
  function repairImportedVQG8991() {
    if (inMigration || !AuthManager.currentUser || typeof dbData ==='undefined') return false;
    const vehicle=dbData.vehicles.find(v=>normalizePlate(v.plate)==='VQG8991');
    if(!vehicle) return false;
    let modified=0;
    if(vehicle.name==='Toyota Corolla Cross 2025'){vehicle.name='Toyota Corolla Cross';modified++;}
    if(vehicle.defaultFuel==='Petrol (grade unspecified)'){vehicle.defaultFuel='RON95';modified++;}
    for(const item of dbData.fuel){
      if(item.vehicleId===vehicle.id && item.fuelType==='Petrol (grade unspecified)') {
        item.fuelType='RON95'; modified++;
      }
    }
    if(!modified) return false;
    inMigration=true;
    try {
      saveData(); // creates queued per-record updates for cloud sync
      updateVehicleSelector();
      if(typeof showToast==='function') showToast('VQG8991 name and RON95 corrected');
    } finally {inMigration=false;}
    return true;
  }

  function photoFromVehicle(v) {
    const corolla=!!getFixedSource(v);
    // An existing v3 default Wikimedia reference is superseded visually by the
    // clean, locally hosted 3/4 cutout, without changing the user's vehicle row.
    const oldDefault=corolla && (v?.photoUrl===COROLLA_PHOTO.url || v?.photoSource===COROLLA_PHOTO.source);
    if (corolla && (!v?.photoUrl || oldDefault)) return COROLLA_CUTOUT;
    if (safePhoto(v?.photoUrl)) return {url:v.photoUrl,source:v.photoSource||'',credit:v.photoCredit||'Your chosen photo',license:v.photoLicense||'',label:'Saved photo',isCutout:v.photoUrl===COROLLA_CUTOUT_URL};
    return getFixedSource(v) || PHOTO_CACHE.get(normalize(v?.name).toLowerCase())?.[0] || null;
  }
  function showImage(photo, vehicle) {
    const img=e('mycar-car-photo-img'), placeholder=e('mycar-car-photo-placeholder'), credit=e('mycar-photo-attribution');
    if(!img||!placeholder||!credit) return;
    if (!photo || !safePhoto(photo.url)) {
      img.hidden=true; img.removeAttribute('src');placeholder.hidden=false;credit.hidden=true;credit.replaceChildren();return;
    }
    img.onload=()=>{if(shownCar===vehicle.id){img.hidden=false;placeholder.hidden=true;}};
    img.onerror=()=>{if(shownCar===vehicle.id){img.hidden=true;placeholder.hidden=false;credit.hidden=true;}};
    img.alt=photo.isCutout?`Three-quarter illustration of ${vehicle.name}`:`Vehicle reference photo for ${vehicle.name}`;
    img.classList.toggle('is-cutout',!!photo.isCutout || photo.url===COROLLA_CUTOUT_URL);
    if(img.getAttribute('src')!==photo.url){img.hidden=false;placeholder.hidden=true;img.src=photo.url;}
    else if(img.complete && img.naturalWidth>0){img.hidden=false;placeholder.hidden=true;}
    credit.replaceChildren();
    // Creative cutouts and the user's own photos do not need a large caption.
    // When showing a Creative Commons image, preserve compact attribution.
    if(photo.source && fileFromWikimedia(photo.source)){
      const a=document.createElement('a');a.href=photo.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent=[photo.credit,photo.license].filter(Boolean).join(' · ')||'Wikimedia Commons';
      a.title='Image attribution and licence';credit.append(a);credit.hidden=false;
    } else credit.hidden=true;
  }

  function render() {
    if(!e('mycar-car-photo-button') || typeof dbData==='undefined' || !AuthManager.currentUser) return;
    if(!inMigration && repairImportedVQG8991()) { /* The caller will render again on the next refresh. */ }
    const vehicle=getVehicle();if(!vehicle) return;
    shownCar=vehicle.id;
    const photo=photoFromVehicle(vehicle);
    showImage(photo,vehicle);
    const key=normalize(vehicle.name).toLowerCase();
    if(!photo && isModel(vehicle.name) && !PHOTO_CACHE.has(key)) findPhotos(vehicle.name).then(()=>{
      if(shownCar===vehicle.id && !vehicle.photoUrl) showImage(photoFromVehicle(vehicle),vehicle);
    }).catch(()=>{});
  }

  async function findPhotos(name) {
    const model=normalize(name);if(!isModel(model)) return [];
    const key=model.toLowerCase();
    if(PHOTO_CACHE.has(key)) return PHOTO_CACHE.get(key);
    const terms=model.toLowerCase().split(/\s+/).filter(Boolean);
    const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:model+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'35',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'640',format:'json',origin:'*'});
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
    try {
      const response=await fetch(WIKI_API+'?'+params,{signal:controller.signal});
      if(!response.ok) throw new Error('Photo search is temporarily unavailable.');
      const data=await response.json();
      const matches=Object.values(data?.query?.pages||{}).map(p=>{
        const meta=p.imageinfo?.[0], title=String(p.title||'').replace(/^File:/,'');
        if(!meta || !fileFromWikimedia(meta.thumburl||meta.url)) return null;
        const filename=title.toLowerCase();
        if(!terms.every(term=>filename.includes(term))) return null;
        if(/\b(interior|engine|dashboard|steering|logo|badge|brochure|drawing|illustration|scale model)\b/.test(filename)) return null;
        const license=String(meta.extmetadata?.LicenseShortName?.value||'');
        const author=String(meta.extmetadata?.Artist?.value||meta.extmetadata?.Credit?.value||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
        if(!/CC|public domain|PD|zero/i.test(license)) return null;
        let score=terms.reduce((acc,t)=>acc+(filename.includes(t)?3:0),0);
        if(/202[3-6]/.test(filename)) score+=2;
        if(/(front|three.quarter|side|left)/.test(filename)) score+=1;
        const url=meta.thumburl||meta.url;
        return {url,source:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(p.title.replace(/ /g,'_')),credit:author || 'Artist: see source',license:license.replace(/<[^>]+>/g,'').slice(0,45),label:title.replace(/\.(jpe?g|png|webp)$/i,'').slice(0,110),score};
      }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,16);
      PHOTO_CACHE.set(key,matches);
      return matches;
    } finally {clearTimeout(timeout);}
  }

  function getPicker() {
    if(picker) return picker;
    picker=document.createElement('div');picker.className='mycar-photo-overlay';picker.hidden=true;
    picker.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="mycar-photo-title" class="mycar-photo-panel">
      <button type="button" class="mycar-photo-close" aria-label="Close picture chooser">×</button>
      <h3 id="mycar-photo-title">Vehicle picture</h3>
      <p class="hint">Choose a model reference photo from Wikimedia Commons. Please check the shape and generation; a reference photo may differ from your exact trim or colour.</p>
      <div class="mycar-photo-search"><input id="mycar-photo-query" aria-label="Model to search" placeholder="Toyota Corolla Cross"><button type="button" id="mycar-photo-search-btn">Search</button></div>
      <div id="mycar-photo-status" class="hint" aria-live="polite"></div>
      <div id="mycar-photo-results" class="mycar-photo-results"></div>
      <label class="mycar-photo-upload">Use my own vehicle photo instead <input type="file" id="mycar-own-photo" accept="image/png,image/jpeg,image/webp"></label>
      <div class="mycar-photo-foot"><span>Chosen photos sync with your MYCAR account.</span><button id="mycar-photo-clear" type="button">Use automatic photo</button></div>
    </section>`;
    document.body.append(picker);
    picker.querySelector('.mycar-photo-close').addEventListener('click',closePicker);
    picker.addEventListener('click',evt=>{if(evt.target===picker)closePicker();});
    picker.querySelector('#mycar-photo-search-btn').addEventListener('click',()=>loadCandidates());
    picker.querySelector('#mycar-photo-query').addEventListener('keydown',evt=>{if(evt.key==='Enter'){evt.preventDefault();loadCandidates();}});
    picker.querySelector('#mycar-photo-clear').addEventListener('click',()=>saveSelection(null));
    picker.querySelector('#mycar-own-photo').addEventListener('change',handleOwnPhoto);
    return picker;
  }
  function openPicker() {
    if(!AuthManager.currentUser) return;
    const car=getVehicle();if(!car)return;
    const dialog=getPicker();dialog.hidden=false;
    dialog.querySelector('#mycar-photo-query').value=normalize(car.name);
    loadCandidates();
  }
  function closePicker(){if(picker)picker.hidden=true;}
  async function loadCandidates() {
    const dialog=getPicker();const status=dialog.querySelector('#mycar-photo-status');const holder=dialog.querySelector('#mycar-photo-results');
    const query=dialog.querySelector('#mycar-photo-query').value.trim();const myRequest=++pickerRequest;
    holder.replaceChildren();status.textContent='Searching Wikimedia Commons images…';
    let matches=[];
    const car=getVehicle();
    if(car && normalize(query).toLowerCase() === normalize(car.name).toLowerCase() && getFixedSource(car)) matches.push(COROLLA_CUTOUT,getFixedSource(car));
    try{matches.push(...await findPhotos(query));}
    catch(err){if(myRequest!==pickerRequest)return;status.textContent='Search is unavailable (internet may be offline). You can upload your own photo.';}
    if(myRequest!==pickerRequest||dialog.hidden)return;
    matches=matches.filter((p,i,a)=>a.findIndex(x=>x.url===p.url)===i).slice(0,10);
    if(!matches.length && !status.textContent.includes('unavailable')) status.textContent='No verified photo matches. Try a simpler make/model name or use your own photo.';
    else if(matches.length) status.textContent=`${matches.length} reference image(s). Tap the one that looks like your car.`;
    for(const photo of matches){
      const button=document.createElement('button');button.type='button';button.className='mycar-photo-option';
      const img=document.createElement('img');img.src=photo.url;img.alt=photo.label||'Model photo';img.loading='lazy';
      const label=document.createElement('small');label.textContent=photo.label||'Model reference';
      button.append(img,label);button.addEventListener('click',()=>saveSelection(photo));holder.append(button);
    }
  }
  function saveSelection(photo) {
    const car=getVehicle();if(!car || !AuthManager.currentUser)return;
    for(const k of IMAGE_FIELDS) delete car[k];
    if(photo){
      if(!safePhoto(photo.url))return;
      car.photoUrl=photo.url;
      car.photoSource=photo.source||'';
      car.photoCredit=photo.credit||'Wikimedia Commons';
      car.photoLicense=photo.license||'';
    }
    saveData();render();closePicker();
    if(typeof showToast==='function')showToast(photo?'Vehicle photo saved':'Automatic photo restored');
  }
  async function handleOwnPhoto(event) {
    const file=event.target.files?.[0];if(!file)return;
    const dialog=getPicker(),status=dialog.querySelector('#mycar-photo-status');
    if(!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size>8*1024*1024){status.textContent='Choose a JPG, PNG or WebP photo under 8 MB.';return;}
    try {
      const uri=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onerror=()=>reject(new Error('Unable to open image'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);
      });
      const pic=await new Promise((resolve,reject)=>{const obj=new Image();obj.onload=()=>resolve(obj);obj.onerror=()=>reject(new Error('Not a valid photo'));obj.src=uri;});
      const scale=Math.min(1,720/pic.width,440/pic.height),w=Math.max(1,Math.round(pic.width*scale)),h=Math.max(1,Math.round(pic.height*scale));
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(pic,0,0,w,h);
      let data='';
      for(const quality of [.72,.60,.48]) {
        data=c.toDataURL('image/jpeg',quality);
        if(data.length<=240000) break;
      }
      if(data.length>240000){
        const smaller=document.createElement('canvas');
        smaller.width=Math.max(1,Math.round(w*.75));smaller.height=Math.max(1,Math.round(h*.75));
        smaller.getContext('2d').drawImage(c,0,0,smaller.width,smaller.height);
        data=smaller.toDataURL('image/jpeg',.52);
      }
      if(data.length>250000) throw new Error('Photo is too detailed. Please choose a smaller image.');
      saveSelection({url:data,source:'',credit:'My vehicle photo',license:''});
    }catch(err){status.textContent=err.message||'Could not process photo.';}
    event.target.value='';
  }

  function init() {
    const originalDashboard=window.updateDashboard;
    if(typeof originalDashboard!=='function')return;
    window.updateDashboard=function(){ originalDashboard();render(); };
    const originalVehicleSelector=window.updateVehicleSelector;
    if(typeof originalVehicleSelector==='function')window.updateVehicleSelector=function(){originalVehicleSelector();render();};
    // Keyboard-only users can dismiss the selector with Escape.
    document.addEventListener('keydown',evt=>{if(evt.key==='Escape'&&picker&&!picker.hidden)closePicker();});
  }
  document.addEventListener('DOMContentLoaded',init);
  return {render,openPicker,repairImportedVQG8991};
})();
