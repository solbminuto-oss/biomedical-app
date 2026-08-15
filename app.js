
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

 $('activate').onclick=activate;$('sync').onclick=sync;$('logout').onclick=logout;
 $('confirmDelivery').onclick=confirmDelivery;$('remitoPhoto').onchange=previewPhoto;
 $('recordSearch').oninput=renderRecords;$('stateFilter').onchange=renderRecords;$('userFilter').onchange=renderRecords;
 $('otherSearch').oninput=renderOtherMatches;
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
  const res=await API.deliveries(session.userId||session.id);
  records=res.deliveries||[];
  await idbSet(STORES.kv,'recordsV7real',records);
  lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSync',lastSync);
  renderAssigned();renderMyDeliveries();if($('records')?.classList.contains('active'))renderRecords();
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
 $('modules').innerHTML=`<button class="module" onclick="show('materials')"><div class="module-icon">📦</div><div class="module-main"><strong>Control de Entrega de Materiales</strong><small>Seguimiento operativo</small></div><div class="arrow">›</div></button>`+(session.sectors.includes('heridas')?`<button class="module"><div class="module-icon green-icon">🩹</div><div class="module-main"><strong>Cuidado de Heridas</strong><small>Próximamente</small></div><div class="arrow">›</div></button>`:'');
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
 $('assignedList').innerHTML=a.length?a.map(r=>taskCard(r,{source:'assigned'})).join(''):'<div class="empty">No tenés entregas pendientes asignadas.</div>';
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
function show(name){
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(name).classList.add('active');
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name));
 if(name==='assigned')renderAssigned();if(name==='myDeliveries')renderMyDeliveries();if(name==='otherDelivery')prepareOther();if(name==='records')prepareRecords();
}
document.addEventListener('DOMContentLoaded',init);
