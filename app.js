
const USERS=[
 {id:'SOL',name:'Sol Demo',code:'2468',role:'Super Admin',superAdmin:true,sectors:['entrega_materiales','heridas']},
 {id:'DIEGO',name:'Diego Demo',code:'1357',role:'Operador',superAdmin:false,sectors:['entrega_materiales']},
 {id:'JORGE',name:'Jorge Demo',code:'9876',role:'Operador',superAdmin:false,sectors:['entrega_materiales']}
];
const BASE=[
 {id:'E-101',remito:'R-10482',material:'Kit de curación avanzada',cantidad:'1',sanatorio:'Sanatorio Parque',paciente:'María Gómez',medico:'Dr. Federico López',assignedTo:'SOL',state:'assigned',fecha:'2026-08-14'},
 {id:'E-102',remito:'R-10483',material:'Apósito de presión negativa',cantidad:'2',sanatorio:'Sanatorio Británico',paciente:'Carlos Méndez',medico:'Dra. Laura Rossi',assignedTo:'SOL',state:'out',fecha:'2026-08-14',exitBy:'Sol Demo',exitAt:'2026-08-14T10:20:00'},
 {id:'E-103',remito:'R-10484',material:'Kit de curación avanzada',cantidad:'1',sanatorio:'Hospital Italiano',paciente:'Ana Martínez',medico:'Dr. Pablo Suárez',assignedTo:'DIEGO',state:'assigned',fecha:'2026-08-15'},
 {id:'E-104',remito:'R-10485',material:'Malla quirúrgica Demo',cantidad:'1',sanatorio:'Sanatorio de la Mujer',paciente:'Lucía Fernández',medico:'Dra. Carolina Díaz',assignedTo:'JORGE',state:'assigned',fecha:'2026-08-15'},
 {id:'E-105',remito:'R-10479',material:'Apósito antimicrobiano',cantidad:'3',sanatorio:'Sanatorio Parque',paciente:'Roberto Silva',medico:'Dr. Federico López',assignedTo:'DIEGO',state:'done',fecha:'2026-08-12',exitBy:'Diego Demo',deliveredBy:'Diego Demo',receivedBy:'Mariana Torres',sector:'Quirófano 2',deliveredAt:'2026-08-12T15:45:00'}
];
let session=null,records=[],current=null,lastSync=null;
const $=id=>document.getElementById(id);
const userName=id=>(USERS.find(u=>u.id===id)||{}).name||id;
const fmt=v=>v?new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const stateName=s=>s==='assigned'?'Asignado':s==='out'?'Retirado':s==='done'?'Entregado':'';
async function init(){
 USERS.forEach(u=>{let o=document.createElement('option');o.value=u.id;o.textContent=u.name;$('user').appendChild(o)});
 session=await idbGet(STORES.kv,'session');records=await idbGet(STORES.kv,'recordsV4')||structuredClone(BASE);lastSync=await idbGet(STORES.kv,'lastSync');
 $('activate').onclick=activate;$('sync').onclick=sync;$('logout').onclick=logout;$('confirmDelivery').onclick=confirmDelivery;$('remitoPhoto').onchange=preview;$('recordSearch').oninput=renderRecords;$('stateFilter').onchange=renderRecords;$('userFilter').onchange=renderRecords;$('otherRemito').onchange=openOtherSelected;
 document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.go));
 window.addEventListener('online',()=>{status();sync()});window.addEventListener('offline',status);
 await registerSW();setTimeout(()=>{$('splash').classList.add('hidden');route()},650);
}
async function registerSW(){
 if(!('serviceWorker'in navigator))return;
 try{
   const reg=await navigator.serviceWorker.register('./service-worker.js');
   if(reg.waiting)showUpdate(reg);
   reg.addEventListener('updatefound',()=>{const nw=reg.installing;nw&&nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)})});
   navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
 }catch(e){}
}
function showUpdate(reg){$('updateBanner').classList.remove('hidden');$('updateNow').onclick=()=>reg.waiting&&reg.waiting.postMessage({type:'SKIP_WAITING'})}
function route(){if(session){$('activation').classList.add('hidden');$('shell').classList.remove('hidden');render();show('home')}else{$('activation').classList.remove('hidden');$('shell').classList.add('hidden')}}
async function activate(){const u=USERS.find(x=>x.id===$('user').value&&x.code===$('code').value.trim());if(!u){$('err').className='error';$('err').textContent='Usuario o código incorrecto.';return}session={...u,deviceId:crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now(),activatedAt:new Date().toISOString()};await idbSet(STORES.kv,'session',session);route()}
async function logout(){if(confirm('¿Desvincular este dispositivo?')){await idbSet(STORES.kv,'session',null);session=null;route()}}
async function sync(){if(navigator.onLine){lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSync',lastSync)}status()}
function status(){if(!session)return;const on=navigator.onLine;$('conn').textContent=on?'Conectado':'Sin conexión';$('last').textContent=on?'Sincronizado · '+fmt(lastSync):'Modo offline · última sync '+fmt(lastSync);$('deviceStatus').textContent=on?'Conectado':'Sin conexión';$('deviceSync').textContent=fmt(lastSync)}
function render(){
 $('hello').textContent=session.name.split(' ')[0];$('profileName').textContent=session.name;$('role').textContent=session.role;$('deviceId').textContent=session.deviceId.slice(0,10).toUpperCase();$('activatedAt').textContent=fmt(session.activatedAt);
 $('adminOption').classList.toggle('hidden',!session.superAdmin);$('recordsOption').classList.toggle('hidden',!session.superAdmin);
 const mods=$('modules');mods.innerHTML=`<button class="module" onclick="show('materials')"><div class="module-icon">📦</div><div class="module-main"><strong>Control de Entrega de Materiales</strong><small>Seguimiento operativo</small></div><div class="arrow">›</div></button>`+(session.sectors.includes('heridas')?`<button class="module"><div class="module-icon green-icon">🩹</div><div class="module-main"><strong>Cuidado de Heridas</strong><small>Próximamente</small></div><div class="arrow">›</div></button>`:'');
 renderAssigned();status();
}
function ownActive(){return records.filter(r=>r.assignedTo===session.userId&&r.state!=='done')}
function taskCard(r,admin=false){return `<div class="task-card"><div class="task-top"><div><div class="task-title">${r.remito} · ${r.material}</div><div class="task-meta">${r.sanatorio}<br>${r.paciente} · ${r.medico}${admin?`<br><strong>Asignado a: ${userName(r.assignedTo)}</strong>`:''}</div></div><span class="pill ${r.state==='out'?'out':r.state==='done'?'done':''}">${stateName(r.state)}</span></div><div class="task-actions"><button class="secondary" onclick="openDetail('${r.id}')">Ver detalle</button>${r.state==='assigned'?`<button class="primary" onclick="markExit('${r.id}')">Marcar retirado</button>`:r.state==='out'?`<button class="primary" onclick="openDelivery('${r.id}')">Completar entrega</button>`:''}</div></div>`}
function renderAssigned(){const a=ownActive();$('assignedList').innerHTML=a.length?a.map(r=>taskCard(r)).join(''):`<div class="empty">No tenés entregas pendientes asignadas.</div>`}
function renderMyDeliveries(){const a=records.filter(r=>r.assignedTo===session.userId);$('myDeliveriesList').innerHTML=a.length?a.map(r=>taskCard(r)).join(''):'<div class="empty">No hay entregas.</div>'}
function detail(r){return `<div class="detail-grid"><div class="detail-row"><small>N.º de remito</small><strong>${r.remito}</strong></div><div class="detail-row"><small>Material</small><strong>${r.material} · ${r.cantidad} unidad(es)</strong></div><div class="detail-row"><small>Sanatorio</small><strong>${r.sanatorio}</strong></div><div class="detail-row"><small>Paciente</small><strong>${r.paciente}</strong></div><div class="detail-row"><small>Médico</small><strong>${r.medico}</strong></div><div class="detail-row"><small>Asignado a</small><strong>${userName(r.assignedTo)}</strong></div><div class="detail-row"><small>Estado</small><strong>${stateName(r.state)}</strong></div>${r.exitBy?`<div class="detail-row"><small>Retirado por</small><strong>${r.exitBy} · ${fmt(r.exitAt)}</strong></div>`:''}${r.deliveredBy?`<div class="detail-row"><small>Entregado por</small><strong>${r.deliveredBy} · ${fmt(r.deliveredAt)}</strong></div>`:''}${r.receivedBy?`<div class="detail-row"><small>Recibido por</small><strong>${r.receivedBy} · ${r.sector||''}</strong></div>`:''}</div>`}
function openDetail(id){current=records.find(r=>r.id===id);$('detailBody').innerHTML=detail(current)+`<div style="margin-top:14px">${current.state==='assigned'?`<button class="primary" onclick="markExit('${id}')">MARCAR COMO RETIRADO</button>`:current.state==='out'?`<button class="primary" onclick="openDelivery('${id}')">COMPLETAR ENTREGA</button>`:''}</div>`;show('detail')}
async function markExit(id){const r=records.find(x=>x.id===id);if(!confirm(`¿Confirmar que retiraste el material del remito ${r.remito}?`))return;r.state='out';r.exitBy=session.name;r.exitAt=new Date().toISOString();await save();openDetail(id)}
function openDelivery(id){current=records.find(r=>r.id===id);$('deliveryReadOnly').innerHTML=detail(current);$('receivedBy').value='';$('sector').value='';$('remitoPhoto').value='';$('photoPreview').classList.add('hidden');show('delivery')}
function preview(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{$('photoPreview').src=rd.result;$('photoPreview').classList.remove('hidden')};rd.readAsDataURL(f)}
async function confirmDelivery(){if(!current)return;const rec=$('receivedBy').value.trim(),sec=$('sector').value.trim(),f=$('remitoPhoto').files[0];if(!rec||!sec){alert('Completá Recibido por y Sector.');return}if(!f){alert('La foto del remito es obligatoria.');return}const rd=new FileReader();rd.onload=async()=>{current.state='done';current.receivedBy=rec;current.sector=sec;current.remitoPhoto=rd.result;current.deliveredBy=session.name;current.deliveredAt=new Date().toISOString();await save();alert('Entrega registrada.');show('myDeliveries')};rd.readAsDataURL(f)}
async function save(){await idbSet(STORES.kv,'recordsV4',records);renderAssigned();renderMyDeliveries()}
function prepareOther(){const sel=$('otherRemito');sel.innerHTML='<option value="">Elegir remito asignado a otro usuario…</option>'+records.filter(r=>r.assignedTo!==session.userId&&r.state!=='done').map(r=>`<option value="${r.id}">${r.remito} — ${userName(r.assignedTo)} — ${r.sanatorio}</option>`).join('');$('otherPreview').innerHTML=''}
function openOtherSelected(){const id=$('otherRemito').value;if(!id){$('otherPreview').innerHTML='';return}const r=records.find(x=>x.id===id);$('otherPreview').innerHTML=detail(r)+`<div style="margin-top:14px">${r.state==='assigned'?`<button class="primary" onclick="markExit('${r.id}')">RETIRAR ESTE MATERIAL</button>`:`<button class="primary" onclick="openDelivery('${r.id}')">COMPLETAR ENTREGA</button>`}</div>`}
function prepareRecords(){const uf=$('userFilter');uf.innerHTML='<option value="">Todos los usuarios</option>'+USERS.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');renderRecords()}
function renderRecords(){if(!session?.superAdmin)return;const q=$('recordSearch').value.trim().toLowerCase(),st=$('stateFilter').value,us=$('userFilter').value;const arr=records.filter(r=>(!q||[r.remito,r.sanatorio,r.material,r.medico,r.paciente].some(v=>(v||'').toLowerCase().includes(q)))&&(!st||r.state===st)&&(!us||r.assignedTo===us));$('recordCount').textContent=`${arr.length} registro(s)`;$('recordsList').innerHTML=arr.length?arr.map(r=>taskCard(r,true)).join(''):'<div class="empty">No encontramos registros con esos criterios.</div>'}
function show(name){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(name).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name));if(name==='assigned')renderAssigned();if(name==='myDeliveries')renderMyDeliveries();if(name==='otherDelivery')prepareOther();if(name==='records')prepareRecords()}
document.addEventListener('DOMContentLoaded',init);
