
const USERS=[
 {id:'SOL',name:'Sol Demo',code:'2468',role:'Super Admin',superAdmin:true,sectors:['entrega_materiales','heridas']},
 {id:'DIEGO',name:'Diego Demo',code:'1357',role:'Operador',superAdmin:false,sectors:['entrega_materiales']},
 {id:'JORGE',name:'Jorge Demo',code:'9876',role:'Operador',superAdmin:false,sectors:['entrega_materiales']}
];

const DEMO_V6=[
 {id:'E-201',remito:'R-20482',material:'Kit de curación avanzada',cantidad:'1',sanatorio:'Sanatorio Parque',paciente:'María Gómez',medico:'Dr. Federico López',assignedTo:'SOL',state:'assigned',fecha:'2026-08-14',note:'Entregar directamente en recepción de quirófano.'},
 {id:'E-202',remito:'R-20483',material:'Apósito de presión negativa',cantidad:'2',sanatorio:'Sanatorio Británico',paciente:'Carlos Méndez',medico:'Dra. Laura Rossi',assignedTo:'SOL',state:'out',fecha:'2026-08-14',exitBy:'Sol Demo',exitAt:'2026-08-14T10:20:00'},
 {id:'E-203',remito:'R-20484',material:'Kit de curación avanzada',cantidad:'1',sanatorio:'Hospital Italiano',paciente:'Ana Martínez',medico:'Dr. Pablo Suárez',assignedTo:'DIEGO',state:'assigned',fecha:'2026-08-15',note:'Paciente ingresa por cirugía programada.'},
 {id:'E-204',remito:'R-20485',material:'Malla quirúrgica Demo',cantidad:'1',sanatorio:'Sanatorio de la Mujer',paciente:'Lucía Fernández',medico:'Dra. Carolina Díaz',assignedTo:'JORGE',state:'out',fecha:'2026-08-15',exitBy:'Jorge Demo',exitAt:'2026-08-15T09:10:00'},
 {id:'E-205',remito:'R-20479',material:'Apósito antimicrobiano',cantidad:'3',sanatorio:'Sanatorio Parque',paciente:'Roberto Silva',medico:'Dr. Federico López',assignedTo:'DIEGO',state:'done',fecha:'2026-08-12',exitBy:'Diego Demo',exitAt:'2026-08-12T13:10:00',deliveredBy:'Diego Demo',receivedBy:'Mariana Torres',sector:'Quirófano 2',note:'Remito firmado por coordinación.',deliveredAt:'2026-08-12T15:45:00'},
 {id:'E-206',remito:'R-20476',material:'Sistema de terapia de heridas',cantidad:'1',sanatorio:'Hospital Español',paciente:'Martín Acosta',medico:'Dr. Nicolás Vega',assignedTo:'SOL',state:'done',fecha:'2026-08-11',exitBy:'Sol Demo',exitAt:'2026-08-11T08:40:00',deliveredBy:'Sol Demo',receivedBy:'Paula Benítez',sector:'Internación 4B',note:'Dejar copia del remito en enfermería.',deliveredAt:'2026-08-11T11:05:00'}
];

let session=null,records=[],current=null,lastSync=null;
let detailReturn='myDeliveries';
let woundPatients=[], woundVisitsByPatient={}, currentWoundPatient=null, woundPatientScope='mine';

const $=id=>document.getElementById(id);
const userName=id=>(USERS.find(u=>u.id===id)||{}).name||id;
const fmt=v=>v?new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const stateName=s=>s==='assigned'?'Asignado':s==='out'?'Retirado':'Entregado';

async function init(){
 USERS.forEach(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;$('user').appendChild(o)});
 session=await idbGet(STORES.kv,'session');
 records=await idbGet(STORES.kv,'recordsV7real')||await idbGet(STORES.kv,'recordsV7');
 if(!records){records=structuredClone(DEMO_V6);await idbSet(STORES.kv,'recordsV7',records)}
 lastSync=await idbGet(STORES.kv,'lastSync');
 woundPatients=await idbGet(STORES.kv,'woundPatientsV8')||[];

 $('activate').onclick=activate;$('sync').onclick=sync;$('logout').onclick=logout;
 $('confirmDelivery').onclick=confirmDelivery;$('remitoPhoto').onchange=previewPhoto;
 $('recordSearch').oninput=renderRecords;$('stateFilter').onchange=renderRecords;$('userFilter').onchange=renderRecords;
 $('otherSearch').oninput=renderOtherMatches;
 $('woundPatientSearch').oninput=renderWoundPatients;
 $('saveWoundVisit').onclick=saveWoundVisit;
 $('wvPhotoBefore').onchange=e=>previewWoundPhoto(e,'wvBeforePreview');
 $('wvPhotoAfter').onchange=e=>previewWoundPhoto(e,'wvAfterPreview');
 document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.go));
 window.addEventListener('online',()=>{status();sync()});window.addEventListener('offline',status);

 await registerSW();
 setTimeout(()=>{$('splash').classList.add('hidden');route()},650);
}

async function registerSW(){
 if(!('serviceWorker'in navigator))return;
 try{
  const reg=await navigator.serviceWorker.register('./service-worker.js');
  reg.update();
  if(reg.waiting)showUpdate(reg);
  reg.addEventListener('updatefound',()=>{
   const nw=reg.installing;
   if(nw)nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
 }catch(e){}
}
function showUpdate(reg){$('updateBanner').classList.remove('hidden');$('updateNow').onclick=()=>reg.waiting&&reg.waiting.postMessage({type:'SKIP_WAITING'})}

function route(){
 if(session){$('activation').classList.add('hidden');$('shell').classList.remove('hidden');render();show('home')}
 else{$('activation').classList.remove('hidden');$('shell').classList.add('hidden')}
}
async function activate(){
 const userId=$('user').value, code=$('code').value.trim();
 try{
  if(API.configured && navigator.onLine){
   const device={id:crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now(),platform:navigator.userAgent};
   const res=await API.activate(userId,code,device);
   session={userId:res.user.id,name:res.user.name,role:res.user.role,superAdmin:res.user.superAdmin,sectors:res.user.sectors||[],deviceId:device.id,activatedAt:new Date().toISOString()};
  }else{
   const u=USERS.find(x=>x.id===userId&&x.code===code);
   if(!u) throw new Error('Usuario o código incorrecto.');
   session={...u,userId:u.id,deviceId:crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now(),activatedAt:new Date().toISOString()};
  }
  await idbSet(STORES.kv,'session',session);$('err').textContent='';route();await sync();
 }catch(e){$('err').className='error';$('err').textContent=e.message==='API_NOT_CONFIGURED'?'API todavía no configurada.':e.message}
}
async function logout(){if(confirm('¿Desvincular este dispositivo?')){await idbSet(STORES.kv,'session',null);session=null;route()}}
async function sync(){
 if(!session||!navigator.onLine||!API.configured){status();return}
 try{
  await flushQueue();
  await flushWoundQueue();
  const res=await API.deliveries(session.userId||session.id);
  records=res.deliveries||[];
  await idbSet(STORES.kv,'recordsV7real',records);
  lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSync',lastSync);
  renderAssigned();renderMyDeliveries();if($('records')?.classList.contains('active'))renderRecords();
  if(session.sectors.includes('heridas')||session.superAdmin){try{const wr=await API.woundPatients(session.userId||session.id);woundPatients=wr.patients||[];await idbSet(STORES.kv,'woundPatientsV8',woundPatients);renderAssigned();if($('woundPatients')?.classList.contains('active'))renderWoundPatients();}catch(e){console.warn('Wounds sync:',e)}}
 }catch(e){console.warn('Sync:',e)}
 status();
}
async function queueUpdate(id,patch){
 let q=await idbGet(STORES.kv,'syncQueueV7')||[];q.push({id,patch,at:new Date().toISOString()});await idbSet(STORES.kv,'syncQueueV7',q);
}
async function flushQueue(){
 let q=await idbGet(STORES.kv,'syncQueueV7')||[];if(!q.length)return;
 const left=[];for(const item of q){try{await API.updateDelivery(session.userId||session.id,item.id,item.patch)}catch(e){left.push(item)}}
 await idbSet(STORES.kv,'syncQueueV7',left);
}
async function remotePatch(id,patch){
 if(API.configured&&navigator.onLine){try{await API.updateDelivery(session.userId||session.id,id,patch);return}catch(e){}}
 await queueUpdate(id,patch);
}
function status(){
 if(!session)return;const on=navigator.onLine;
 $('conn').textContent=on?'Conectado':'Sin conexión';
 $('last').textContent=on?'Sincronizado · '+fmt(lastSync):'Modo offline · última sync '+fmt(lastSync);
 $('deviceStatus').textContent=on?'Conectado':'Sin conexión';$('deviceSync').textContent=fmt(lastSync);
}
function render(){
 $('hello').textContent=session.name.split(' ')[0];$('profileName').textContent=session.name;$('role').textContent=session.role;
 $('deviceId').textContent=session.deviceId.slice(0,10).toUpperCase();$('activatedAt').textContent=fmt(session.activatedAt);
 $('adminTools').classList.toggle('hidden',!session.superAdmin);
 $('modules').innerHTML=`<button class="module" onclick="show('materials')"><div class="module-icon">📦</div><div class="module-main"><strong>Control de Entrega de Materiales</strong><small>Seguimiento operativo</small></div><div class="arrow">›</div></button>`+((session.sectors.includes('heridas')||session.superAdmin)?`<button class="module" onclick="show('wounds')"><div class="module-icon green-icon">🩹</div><div class="module-main"><strong>Cuidado de Heridas</strong><small>Pacientes, visitas y evolución</small></div><div class="arrow">›</div></button>`:'');
 $('woundAdminTools').classList.toggle('hidden',!session.superAdmin);
 renderAssigned();status();
}
function detail(r){
 return `<div class="detail-grid">
 <div class="detail-row"><small>N.º de remito</small><strong>${r.remito}</strong></div>
 <div class="detail-row"><small>Material</small><strong>${r.material} · ${r.cantidad} unidad(es)</strong></div>
 <div class="detail-row"><small>Sanatorio</small><strong>${r.sanatorio}</strong></div>
 <div class="detail-row"><small>Paciente</small><strong>${r.paciente}</strong></div>
 <div class="detail-row"><small>Médico</small><strong>${r.medico}</strong></div>
 <div class="detail-row"><small>Asignado a</small><strong>${userName(r.assignedTo)}</strong></div>
 <div class="detail-row"><small>Estado</small><strong>${stateName(r.state)}</strong></div>
 ${r.exitBy?`<div class="detail-row"><small>Retirado por</small><strong>${r.exitBy} · ${fmt(r.exitAt)}</strong></div>`:''}
 ${r.deliveredBy?`<div class="detail-row"><small>Entregado por</small><strong>${r.deliveredBy} · ${fmt(r.deliveredAt)}</strong></div>`:''}
 ${r.receivedBy?`<div class="detail-row"><small>Recibido por / Sector</small><strong>${r.receivedBy} · ${r.sector||'—'}</strong></div>`:''}
 ${r.note?`<div class="detail-row"><small>Nota</small><strong>${r.note}</strong></div>`:''}
 </div>`;
}
function taskCard(r,{showAssigned=false,source='myDeliveries',viewOnly=false}={}){
 return `<div class="task-card ${viewOnly?'view-only':''}">
 <div class="task-top"><div><div class="task-title">${r.remito} · ${r.material}</div><div class="task-meta">${r.sanatorio}<br>${r.paciente} · ${r.medico}${showAssigned?`<br><strong>Asignado a: ${userName(r.assignedTo)}</strong>`:''}</div></div><span class="pill ${r.state==='out'?'out':r.state==='done'?'done':''}">${stateName(r.state)}</span></div>
 ${r.note?`<div class="note-box"><strong>Nota:</strong> ${r.note}</div>`:''}
 <div class="task-actions"><button class="secondary" onclick="openDetail('${r.id}','${source}',${viewOnly})">Ver detalle</button>
 ${!viewOnly?(r.state==='assigned'?`<button class="primary" onclick="markExit('${r.id}','${source}')">Marcar retirado</button>`:r.state==='out'?`<button class="primary" onclick="openDelivery('${r.id}','${source}')">Completar entrega</button>`:''):''}
 </div></div>`;
}
function renderAssigned(){
 const a=records.filter(r=>r.assignedTo===session.userId&&r.state!=='done');
 const wp=(session.sectors.includes('heridas')||session.superAdmin)?woundPatients:[];
 let html='';
 if(a.length){html+=`<div class="assigned-section-label">Entrega de materiales</div>`+a.map(r=>taskCard(r,{source:'assigned'})).join('')}
 if(wp.length){html+=`<div class="assigned-section-label">Cuidado de heridas</div>`+wp.map(p=>woundPatientCard(p,true)).join('')}
 $('assignedList').innerHTML=html||'<div class="empty">No tenés pendientes asignados.</div>';
}
function renderMyDeliveries(){
 const a=records.filter(r=>r.state==='done'&&r.deliveredBy===session.name);
 $('myDeliveriesList').innerHTML=a.length?a.map(r=>historyCard(r)).join(''):'<div class="empty">Todavía no tenés entregas realizadas.</div>';
}
function historyCard(r){
 return `<div class="task-card">
 <div class="task-top"><div><div class="task-title">${r.remito} · ${r.material}</div><div class="task-meta">${r.sanatorio}<br>${r.paciente} · ${r.medico}<br><strong>Entregado: ${fmt(r.deliveredAt)}</strong></div></div><span class="pill done">Entregado</span></div>
 ${r.note?`<div class="note-box"><strong>Nota:</strong> ${r.note}</div>`:''}
 <div class="task-actions"><button class="secondary" onclick="openDetail('${r.id}','myDeliveries',true)">Ver detalle</button><button class="primary" onclick="openNoteEditor('${r.id}')">${r.note?'Editar nota':'Agregar nota'}</button></div>
 </div>`;
}
function openNoteEditor(id){
 current=records.find(r=>r.id===id);
 $('historyNote').value=current.note||'';
 $('historyNoteContext').innerHTML=detail(current);
 show('historyNoteScreen');
}
async function saveHistoryNote(){
 if(!current)return;
 current.note=$('historyNote').value.trim();
 await save();await remotePatch(current.id,{note:current.note});
 show('myDeliveries');
}
function openDetail(id,from='myDeliveries',viewOnly=false){
 current=records.find(r=>r.id===id);detailReturn=from;
 $('detailBody').innerHTML=detail(current)+(viewOnly?'':`<div style="margin-top:14px">${current.state==='assigned'?`<button class="primary" onclick="markExit('${id}','${from}')">MARCAR COMO RETIRADO</button>`:current.state==='out'?`<button class="primary" onclick="openDelivery('${id}','${from}')">COMPLETAR ENTREGA</button>`:''}</div>`);
 show('detail');
}
async function markExit(id,from='myDeliveries'){
 const r=records.find(x=>x.id===id);if(!confirm(`¿Confirmar que retiraste el material del remito ${r.remito}?`))return;
 r.state='out';r.exitBy=session.name;r.exitAt=new Date().toISOString();await save();await remotePatch(id,{state:'out'});
 openDetail(id,from,false);
}
function openDelivery(id,from='myDeliveries'){
 current=records.find(r=>r.id===id);detailReturn=from;
 $('deliveryReadOnly').innerHTML=detail(current);$('receivedBy').value='';$('sector').value='';$('deliveryNote').value=current.note||'';
 $('remitoPhoto').value='';$('photoPreview').classList.add('hidden');show('delivery');
}
function previewPhoto(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{$('photoPreview').src=rd.result;$('photoPreview').classList.remove('hidden')};rd.readAsDataURL(f)}
async function confirmDelivery(){
 if(!current)return;const rec=$('receivedBy').value.trim(),sec=$('sector').value.trim(),f=$('remitoPhoto').files[0];
 if(!rec||!sec){alert('Completá Recibido por y Sector.');return}if(!f){alert('La foto del remito es obligatoria.');return}
 const rd=new FileReader();rd.onload=async()=>{current.state='done';current.receivedBy=rec;current.sector=sec;current.note=$('deliveryNote').value.trim();current.remitoPhoto=rd.result;current.deliveredBy=session.name;current.deliveredAt=new Date().toISOString();await save();
 let photoUrl='';
 if(API.configured&&navigator.onLine){try{const up=await API.uploadRemito(session.userId||session.id,current.id,rd.result,f.name);photoUrl=up.url}catch(e){console.warn(e)}}
 await remotePatch(current.id,{state:'done',receivedBy:rec,sector:sec,note:current.note,remitoPhoto:photoUrl});
 alert(navigator.onLine?'Entrega registrada.':'Entrega guardada sin conexión. Se sincronizará cuando vuelva Internet.');show(detailReturn==='otherDelivery'?'materials':detailReturn)};rd.readAsDataURL(f);
}
async function save(){await idbSet(STORES.kv,'recordsV7real',records);renderAssigned();renderMyDeliveries()}

/* Admin: execute another user's delivery */
function prepareOther(){
 $('otherSearch').value='';$('otherMatches').innerHTML='';$('otherPreview').innerHTML='<div class="muted" style="font-size:12px">Ingresá un número de remito o el nombre de un paciente.</div>';
}
function renderOtherMatches(){
 const q=$('otherSearch').value.trim().toLowerCase();$('otherPreview').innerHTML='';
 if(!q){$('otherMatches').innerHTML='';return}
 const a=records.filter(r=>r.assignedTo!==session.userId&&r.state!=='done'&&(r.remito.toLowerCase().includes(q)||r.paciente.toLowerCase().includes(q)));
 $('otherMatches').innerHTML=a.length?a.map(r=>`<div class="search-hit"><strong>${r.remito} · ${r.paciente}</strong><div class="task-meta">${r.sanatorio}<br>${r.material}<br>Asignado a: ${userName(r.assignedTo)} · ${stateName(r.state)}</div><button class="secondary" onclick="selectOther('${r.id}')">Seleccionar entrega</button></div>`).join(''):'<div class="empty">No encontramos una entrega pendiente.</div>';
}
function selectOther(id){
 current=records.find(r=>r.id===id);detailReturn='otherDelivery';$('otherMatches').innerHTML='';
 $('otherPreview').innerHTML=detail(current)+`<div style="margin-top:14px">${current.state==='assigned'?`<button class="primary" onclick="markExit('${id}','otherDelivery')">MARCAR COMO RETIRADO</button>`:`<button class="primary" onclick="openDelivery('${id}','otherDelivery')">COMPLETAR ENTREGA</button>`}</div>`;
}

/* Admin: global records = consultation only */
function prepareRecords(){
 if(!session.superAdmin)return;
 const uf=$('userFilter');
 if(uf.options.length<=1)uf.innerHTML='<option value="">Todos los usuarios</option>'+USERS.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
 renderRecords();
}
function renderRecords(){
 if(!session.superAdmin)return;
 const q=$('recordSearch').value.trim().toLowerCase(),st=$('stateFilter').value,us=$('userFilter').value;
 const a=records.filter(r=>(!q||[r.remito,r.sanatorio,r.material,r.medico,r.paciente].some(v=>(v||'').toLowerCase().includes(q)))&&(!st||r.state===st)&&(!us||r.assignedTo===us));
 $('recordCount').textContent=`${a.length} registro(s)`;
 $('recordsList').innerHTML=a.length?a.map(r=>taskCard(r,{showAssigned:true,source:'records',viewOnly:true})).join(''):'<div class="empty">No encontramos registros con esos criterios.</div>';
}


// ==================== CUIDADO DE HERIDAS V8 ====================
function authClass(s){s=(s||'').toUpperCase();return s.includes('REQUIERE')?'danger':s.includes('ÚLTIMA')?'warn':'ok'}
function woundPatientCard(p,compact=false){
 const remaining=Number.isFinite(Number(p.visitsRemaining))?p.visitsRemaining:'—';
 return `<div class="task-card wound-patient-card"><div class="task-top"><div><div class="task-title">${p.name||p.id}</div><div class="task-meta">${p.id}<br>${p.woundType||'Tipo de herida sin cargar'}${p.doctor?` · ${p.doctor}`:''}</div></div><span class="pill auth ${authClass(p.authStatus)}">${remaining} restante${remaining===1?'':'s'}</span></div><div class="auth-line ${authClass(p.authStatus)}">${p.authStatus||'SIN DATOS DE AUTORIZACIÓN'}</div><div class="task-actions"><button class="secondary" onclick="openWoundPatient('${p.id}')">Ver paciente</button>${compact?'':`<button class="primary" onclick="openWoundPatient('${p.id}',true)">Registrar visita</button>`}</div></div>`;
}
function openMyWoundPatients(){woundPatientScope='mine';$('woundPatientsTitle').textContent='Mis pacientes';$('woundPatientSearch').value='';show('woundPatients')}
function openAllWoundPatients(){if(!session.superAdmin)return;woundPatientScope='all';$('woundPatientsTitle').textContent='Todos los pacientes';$('woundPatientSearch').value='';show('woundPatients')}
function renderWoundPatients(){
 let a=woundPatients.slice();const q=($('woundPatientSearch').value||'').trim().toLowerCase();
 if(q)a=a.filter(p=>[p.id,p.name,p.doctor,p.insurance,p.nurse].some(v=>String(v||'').toLowerCase().includes(q)));
 $('woundPatientCount').textContent=`${a.length} paciente(s)`;
 $('woundPatientList').innerHTML=a.length?a.map(p=>woundPatientCard(p)).join(''):'<div class="empty">No encontramos pacientes.</div>';
}
async function openWoundPatient(id,startVisit=false){
 currentWoundPatient=woundPatients.find(p=>p.id===id);if(!currentWoundPatient)return;
 show('woundPatientDetail');renderWoundPatientHeader();
 let visits=woundVisitsByPatient[id]||await idbGet(STORES.kv,'woundVisits_'+id)||[];
 if(API.configured&&navigator.onLine){try{const r=await API.woundHistory(session.userId||session.id,id);currentWoundPatient=r.patient||currentWoundPatient;visits=r.visits||[];woundVisitsByPatient[id]=visits;await idbSet(STORES.kv,'woundVisits_'+id,visits)}catch(e){console.warn(e)}}
 renderWoundHistory(visits);if(startVisit)openNewWoundVisit();
}
function renderWoundPatientHeader(){
 const p=currentWoundPatient;$('woundPatientBody').innerHTML=`<div class="patient-hero"><div><small>${p.id}</small><h2>${p.name}</h2><div class="muted">${p.woundType||'Tipo de herida sin cargar'}</div></div><span class="pill auth ${authClass(p.authStatus)}">${p.visitsRemaining??'—'} restantes</span></div><div class="detail-grid"><div class="detail-row"><small>Obra social</small><strong>${p.insurance||'—'}</strong></div><div class="detail-row"><small>Médico tratante</small><strong>${p.doctor||'—'}</strong></div><div class="detail-row"><small>Enfermero responsable</small><strong>${p.nurse||'—'}</strong></div><div class="detail-row"><small>Frecuencia</small><strong>${p.frequency||'—'}</strong></div><div class="detail-row"><small>Autorización</small><strong>${p.visitsDone||0} realizadas · ${p.authorized||0} autorizadas</strong><div class="auth-line ${authClass(p.authStatus)}">${p.authStatus||'SIN DATOS'}</div></div>${p.notes?`<div class="detail-row"><small>Observaciones</small><strong>${p.notes}</strong></div>`:''}</div>`;
}
function renderWoundHistory(visits){
 const sorted=visits.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));renderWoundChart(sorted);
 const desc=sorted.slice().reverse();$('woundHistoryList').innerHTML=desc.length?desc.map(v=>`<div class="task-card visit-card"><div class="task-top"><div><div class="task-title">Visita ${v.visitNumber||''} · ${v.date||'—'}</div><div class="task-meta">${v.length||'—'} × ${v.width||'—'} cm · ${v.surface||'—'} cm²<br>Dolor: ${v.pain===''?'—':v.pain} · ${v.dressing||'Sin apósito cargado'}</div></div><span class="pill evolution ${String(v.evolution).toLowerCase()}">${v.evolution||'—'}</span></div>${v.notes?`<div class="note-box">${v.notes}</div>`:''}<div class="photo-links">${v.photoBefore?`<a href="${v.photoBefore}" target="_blank">Foto antes</a>`:''}${v.photoAfter?`<a href="${v.photoAfter}" target="_blank">Foto después</a>`:''}</div></div>`).join(''):'<div class="empty">Todavía no hay visitas registradas.</div>';
}
function renderWoundChart(visits){
 const pts=visits.filter(v=>Number(v.surface)>0);if(pts.length<2){$('woundChart').innerHTML='<div class="muted chart-empty">El gráfico aparecerá cuando haya al menos 2 visitas con medidas.</div>';return}
 const W=520,H=180,pad=28,max=Math.max(...pts.map(v=>Number(v.surface))),min=Math.min(...pts.map(v=>Number(v.surface))),range=Math.max(1,max-min);
 const coords=pts.map((v,i)=>{const x=pad+i*(W-2*pad)/(pts.length-1);const y=H-pad-((Number(v.surface)-min)/range)*(H-2*pad);return{x,y,v}});
 const line=coords.map(c=>`${c.x},${c.y}`).join(' ');$('woundChart').innerHTML=`<div class="chart-title">Evolución de superficie (cm²)</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la superficie de la herida"><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" class="axis"/><polyline points="${line}" class="trend"/>${coords.map(c=>`<circle cx="${c.x}" cy="${c.y}" r="5" class="point"><title>Visita ${c.v.visitNumber}: ${c.v.surface} cm²</title></circle>`).join('')}</svg><div class="chart-foot"><span>${pts[0].surface} cm²</span><span>${pts[pts.length-1].surface} cm²</span></div>`;
}
function openNewWoundVisit(){
 const p=currentWoundPatient;if(!p)return;show('woundVisitForm');$('woundVisitPatient').innerHTML=`<h3>${p.name}</h3><div class="muted">${p.id} · ${p.woundType||''}</div><div class="auth-line ${authClass(p.authStatus)}">${p.authStatus||''} · ${p.visitsRemaining??'—'} restantes</div>`;
 const now=new Date(),off=now.getTimezoneOffset();$('wvDate').value=new Date(now-off*60000).toISOString().slice(0,16);
 ['wvLength','wvWidth','wvPain','wvDressing','wvNotes'].forEach(id=>$(id).value='');['wvDepth','wvTissue','wvExudate','wvSmell'].forEach(id=>$(id).value='');$('wvPhotoBefore').value='';$('wvPhotoAfter').value='';$('wvBeforePreview').classList.add('hidden');$('wvAfterPreview').classList.add('hidden');
 const days=frequencyDays(p.frequency);if(days){const d=new Date();d.setDate(d.getDate()+days);$('wvNext').value=d.toISOString().slice(0,10)}else $('wvNext').value='';
 $('woundSaveStatus').classList.add('hidden');
}
function frequencyDays(f){f=String(f||'').toLowerCase();if(f.includes('diaria'))return 1;if(f.includes('48'))return 2;if(f.includes('semanal'))return 7;if(f.includes('quincenal'))return 14;return 0}
function previewWoundPhoto(e,id){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{$(id).src=rd.result;$(id).classList.remove('hidden')};rd.readAsDataURL(f)}
async function fileDataUrl(file){if(!file)return'';const raw=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});return compressDataUrl(raw,1280,.78)}
function compressDataUrl(src,max=1280,q=.78){return new Promise(res=>{const im=new Image();im.onload=()=>{let w=im.width,h=im.height;if(Math.max(w,h)>max){const k=max/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',q))};im.src=src})}
async function saveWoundVisit(){
 const length=Number($('wvLength').value),width=Number($('wvWidth').value),date=$('wvDate').value;if(!date||!length||!width){alert('Completá fecha, largo y ancho.');return}
 const btn=$('saveWoundVisit');btn.disabled=true;btn.textContent='GUARDANDO…';
 try{const visit={id:'VIS-APP-'+Date.now(),patientId:currentWoundPatient.id,date,length,width,depth:$('wvDepth').value,tissue:$('wvTissue').value,exudate:$('wvExudate').value,smell:$('wvSmell').value,pain:$('wvPain').value,dressing:$('wvDressing').value.trim(),notes:$('wvNotes').value.trim(),nextVisit:$('wvNext').value,photoBefore:await fileDataUrl($('wvPhotoBefore').files[0]),photoAfter:await fileDataUrl($('wvPhotoAfter').files[0])};
 if(!navigator.onLine||!API.configured){let q=await idbGet(STORES.kv,'woundQueueV8')||[];q.push(visit);await idbSet(STORES.kv,'woundQueueV8',q);$('woundSaveStatus').textContent='Visita guardada sin conexión. Se enviará al recuperar Internet.';$('woundSaveStatus').classList.remove('hidden');setTimeout(()=>show('woundPatientDetail'),900);return}
 await API.createWoundVisit(session.userId||session.id,visit);await sync();await openWoundPatient(currentWoundPatient.id);
 }catch(e){alert('No se pudo guardar la visita: '+e.message)}finally{btn.disabled=false;btn.textContent='GUARDAR VISITA'}
}
async function flushWoundQueue(){if(!navigator.onLine||!API.configured)return;let q=await idbGet(STORES.kv,'woundQueueV8')||[];if(!q.length)return;const left=[];for(const v of q){try{await API.createWoundVisit(session.userId||session.id,v)}catch(e){left.push(v)}}await idbSet(STORES.kv,'woundQueueV8',left)}

function show(name){
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(name).classList.add('active');
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name));
 if(name==='assigned')renderAssigned();if(name==='myDeliveries')renderMyDeliveries();if(name==='otherDelivery')prepareOther();if(name==='records')prepareRecords();if(name==='woundPatients')renderWoundPatients();
}
document.addEventListener('DOMContentLoaded',init);
