
const USERS=[
{id:'U-DEMO-1',name:'Sol Demo',code:'2468',role:'Administración',sectors:['entrega_materiales','heridas']},
{id:'U-DEMO-2',name:'Diego Demo',code:'1357',role:'Operador',sectors:['entrega_materiales']}
];
const DEMO_TASKS=[
{id:'ENT-001',material:'Kit quirúrgico Demo A',cantidad:'1',destino:'Sanatorio Demo',paciente:'Paciente de prueba',medico:'Dr. Ejemplo',state:'assigned',assignedTo:'U-DEMO-1'},
{id:'ENT-002',material:'Material Demo B',cantidad:'2',destino:'Clínica Demo',paciente:'Paciente demo 2',medico:'Dra. Ejemplo',state:'out',assignedTo:'U-DEMO-1'},
{id:'ENT-003',material:'Material Demo C',cantidad:'1',destino:'Hospital Demo',paciente:'Paciente demo 3',medico:'Dr. Ejemplo',state:'assigned',assignedTo:'U-DEMO-2'}
];
let session=null,lastSync=null,tasks=[],currentTask=null;
const $=x=>document.getElementById(x);
function fmt(v){return v?new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'}
async function init(){
 if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./service-worker.js')}catch(e){}}
 USERS.forEach(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;$('user').appendChild(o)});
 session=await idbGet(STORES.kv,'session');lastSync=await idbGet(STORES.kv,'lastSync');
 tasks=await idbGet(STORES.kv,'demoTasks')||DEMO_TASKS;
 $('activate').onclick=activate;$('sync').onclick=sync;$('logout').onclick=logout;
 document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>show(n.dataset.go));
 $('remito').addEventListener('change',previewPhoto);
 $('confirmDelivery').onclick=confirmDelivery;
 window.addEventListener('online',()=>{status();sync()});window.addEventListener('offline',status);
 setTimeout(()=>{$('splash').classList.add('hidden');route()},700);
}
function route(){if(session){$('activation').classList.add('hidden');$('shell').classList.remove('hidden');render();show('home')}else{$('activation').classList.remove('hidden');$('shell').classList.add('hidden')}}
async function activate(){const u=USERS.find(x=>x.id===$('user').value&&x.code===$('code').value.trim());if(!u){$('err').className='error';$('err').textContent='Usuario o código de activación incorrecto.';return}session={...u,deviceId:(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()),activatedAt:new Date().toISOString()};await idbSet(STORES.kv,'session',session);if(navigator.onLine){lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSync',lastSync)}route()}
async function logout(){if(confirm('¿Querés desvincular este dispositivo?')){await idbSet(STORES.kv,'session',null);session=null;route()}}
async function sync(){if(!session)return;if(navigator.onLine){lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSync',lastSync)}status()}
function status(){if(!session)return;const on=navigator.onLine;$('conn').textContent=on?'Conectado':'Sin conexión';$('conn').style.color=on?'#169c55':'#b36a00';$('last').textContent=on?'Sincronizado · '+fmt(lastSync):'Trabajando offline · última sync '+fmt(lastSync);$('deviceStatus').textContent=on?'Conectado':'Sin conexión';$('deviceSync').textContent=fmt(lastSync)}
function render(){
 $('hello').textContent=session.name.split(' ')[0];$('profileName').textContent=session.name;$('role').textContent=session.role;$('deviceId').textContent=session.deviceId.slice(0,10).toUpperCase();$('activatedAt').textContent=fmt(session.activatedAt);
 const m=$('modules');m.innerHTML='';
 if(session.sectors.includes('entrega_materiales'))m.insertAdjacentHTML('beforeend',`<button class="module" onclick="show('materials')"><div class="module-icon">📦</div><div class="module-main"><strong>Control de Entrega<br>de Materiales</strong><small>Seguimiento operativo</small></div><div class="arrow">›</div></button>`);
 if(session.sectors.includes('heridas'))m.insertAdjacentHTML('beforeend',`<button class="module green" onclick="show('wounds')"><div class="module-icon">🩹</div><div class="module-main"><strong>Cuidado de Heridas</strong><small>Próximamente</small></div><div class="arrow">›</div></button>`);
 renderAssigned();renderSectorTasks();status();
}
function userTasks(includeDone=false){return tasks.filter(t=>t.assignedTo===session.userId && (includeDone||t.state!=='done'))}
function stateLabel(s){return s==='assigned'?'Asignado':s==='out'?'Salida registrada':'Entregado'}
function taskHTML(t,sector=false){return `<div class="task-card"><div class="task-top"><div><div class="task-title">${t.material}</div><div class="task-meta">${t.destino}<br>${t.paciente}</div></div><span class="state-pill ${t.state==='out'?'out':t.state==='done'?'done':''}">${stateLabel(t.state)}</span></div><div class="task-actions"><button class="secondary" onclick="openTask('${t.id}')">Ver detalle</button>${t.state==='assigned'?`<button class="primary" onclick="registerExit('${t.id}')">Registrar salida</button>`:t.state==='out'?`<button class="primary" onclick="openDelivery('${t.id}')">Registrar entrega</button>`:''}</div></div>`}
function renderAssigned(){const w=$('assignedList'),mine=userTasks(false);w.innerHTML=mine.length?mine.map(t=>taskHTML(t)).join(''):`<div class="placeholder"><div class="placeholder-icon">✓</div><h2>Todo al día</h2><p>No tenés nada asignado pendiente.</p></div>`}
function renderSectorTasks(){const w=$('sectorTaskList');if(!w)return;const mine=tasks.filter(t=>t.assignedTo===session.userId);w.innerHTML=mine.length?mine.map(t=>taskHTML(t,true)).join(''):'<div class="notice">No hay entregas de prueba.</div>'}
function openTask(id){currentTask=tasks.find(t=>t.id===id);$('detailTitle').textContent=currentTask.id;$('detailBody').innerHTML=detailRows(currentTask)+`<div style="margin-top:14px">${currentTask.state==='assigned'?`<button class="primary" onclick="registerExit('${id}')">REGISTRAR SALIDA</button>`:currentTask.state==='out'?`<button class="primary" onclick="openDelivery('${id}')">REGISTRAR ENTREGA</button>`:`<div class="notice" style="margin:0">Entrega finalizada.</div>`}</div>`;show('detail')}
function detailRows(t){return `<div class="detail-grid"><div class="detail-row"><small>Material</small><strong>${t.material} · Cantidad ${t.cantidad}</strong></div><div class="detail-row"><small>Destino</small><strong>${t.destino}</strong></div><div class="detail-row"><small>Paciente</small><strong>${t.paciente}</strong></div><div class="detail-row"><small>Médico / Cirujano</small><strong>${t.medico}</strong></div><div class="detail-row"><small>Estado</small><strong>${stateLabel(t.state)}</strong></div></div>`}
async function registerExit(id){const t=tasks.find(x=>x.id===id);if(!confirm(`¿Confirmar la salida de ${t.material}?`))return;t.state='out';t.exitAt=new Date().toISOString();t.exitBy=session.name;await idbSet(STORES.kv,'demoTasks',tasks);render();openTask(id)}
function openDelivery(id){currentTask=tasks.find(t=>t.id===id);$('deliveryInfo').innerHTML=detailRows(currentTask);$('receivedBy').value='';$('notes').value='';$('remito').value='';$('preview').classList.add('hidden');$('preview').src='';show('delivery')}
function previewPhoto(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('preview').src=r.result;$('preview').classList.remove('hidden')};r.readAsDataURL(f)}
async function confirmDelivery(){if(!currentTask)return;const receiver=$('receivedBy').value.trim(),file=$('remito').files[0];if(!receiver){alert('Ingresá quién recibe el material.');return}if(!file){alert('La foto del remito es obligatoria.');return}const r=new FileReader();r.onload=async()=>{currentTask.state='done';currentTask.deliveredAt=new Date().toISOString();currentTask.deliveredBy=session.name;currentTask.receivedBy=receiver;currentTask.notes=$('notes').value.trim();currentTask.remito=r.result;await idbSet(STORES.kv,'demoTasks',tasks);render();alert('Entrega registrada correctamente.');show('assigned')};r.readAsDataURL(file)}
function show(name){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$(name).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name));if(name==='assigned')renderAssigned();if(name==='materials')renderSectorTasks()}
document.addEventListener('DOMContentLoaded',init);
