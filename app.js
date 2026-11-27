const FIELD_DEFS={"delivery": {"receivedBy": ["receivedBy", "Recibido por", true], "sector": ["deliverySector", "Sector", true], "note": ["deliveryNote", "Nota", false], "remitoPhoto": ["remitoPhoto", "Foto del remito", true]}, "wound": {"date": ["wvDate", "Fecha de visita", true], "length": ["wvLength", "Largo (cm)", true], "width": ["wvWidth", "Ancho (cm)", true], "depth": ["wvDepth", "Profundidad", false], "tissue": ["wvTissue", "Tejido", false], "exudate": ["wvExudate", "Exudado", false], "smell": ["wvSmell", "Olor", false], "pain": ["wvPain", "Dolor (0–10)", false], "dressing": ["wvDressing", "Apósito / tratamiento", false], "notes": ["wvNotes", "Observaciones", false], "nextVisit": ["wvNext", "Próxima visita", false], "location": ["wvLocation", "Ubicación de la herida", false], "photoBefore": ["wvPhotoBefore", "Foto antes", false], "photoAfter": ["wvPhotoAfter", "Foto después", false]}};
let fieldRules={},syncBusy=false,lastAuto=0;
const $=id=>document.getElementById(id);

let session=null;
let publicUsers=[];
let deliveries=[];
let woundMine=[];
let woundAll=[];
let woundHistoryCache={};
let currentDelivery=null;
let currentPatient=null;
let deliveryReturn='deliveryAssigned';
let woundScope='mine';
let lastSync=null;

function userId(){return session?.userId||session?.id||''}
function fmt(v){
  if(!v)return '—';
  const s=String(v);
  if(/^\d{2}\/\d{2}\/\d{4}/.test(s))return s;
  const d=new Date(v);if(isNaN(d))return s;
  return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:s.includes('T')?'short':undefined}).format(d);
}
function dateOnly(v){if(!v)return '—';const s=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}return fmt(v)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function normalize(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function displayUser(id){return publicUsers.find(u=>u.id===id)?.name||id||'—'}
function stateName(s){return s==='assigned'?'Asignado':s==='out'?'Retirado':'Entregado'}
function authClass(s){const v=normalize(s);if(v.includes('requiere')||v.includes('sin autoriz'))return'danger';if(v.includes('ultima'))return'warn';return'ok'}
function hasSector(kind){
  if(!session)return false;if(session.superAdmin)return true;
  const a=(session.sectors||[]).map(normalize);
  if(kind==='materials')return a.some(x=>x.includes('entrega')||x.includes('material'));
  if(kind==='wounds')return a.some(x=>x.includes('herida')||x.includes('curacion'));
  return false;
}
function networkish(e){const m=String(e?.message||e||'').toLowerCase();return !navigator.onLine||m.includes('load failed')||m.includes('failed to fetch')||m.includes('network')||m.startsWith('http_5')}

async function init(){
  bindUI();
  await registerSW();
  await loadPublicUsers();
  session=await idbGet(STORES.kv,'sessionV8Clean');fieldRules=await idbGet(STORES.kv,'fieldRulesV9')||{};applyRules();
  lastSync=await idbGet(STORES.kv,'lastSyncV8Clean');
  deliveries=await idbGet(STORES.kv,'deliveriesV8Clean')||[];
  woundMine=await idbGet(STORES.kv,'woundMineV8Clean')||[];
  woundAll=await idbGet(STORES.kv,'woundAllV8Clean')||[];
  if(session?.authToken){API.setToken(session.authToken)}else{session=null}
  setTimeout(()=>{$('splash').classList.add('hidden');route()},450);
}

function bindUI(){
  $('activate').onclick=activateDevice;$('sync').onclick=syncAll;$('logout').onclick=logout;
  $('confirmDelivery').onclick=confirmDelivery;$('saveHistoryNoteBtn').onclick=saveHistoryNote;
  $('remitoPhoto').onchange=e=>previewFile(e.target.files[0],$('remitoPreview'));
  $('wvPhotoBefore').onchange=e=>previewFile(e.target.files[0],$('wvBeforePreview'));
  $('wvPhotoAfter').onchange=e=>previewFile(e.target.files[0],$('wvAfterPreview'));
  $('recordSearch').oninput=renderRecords;$('stateFilter').onchange=renderRecords;$('userFilter').onchange=renderRecords;
  $('otherSearch').oninput=renderOtherMatches;
  $('woundPatientSearch').oninput=renderWoundPatients;
  $('woundPickerSearch').oninput=renderWoundPicker;
  $('saveWoundVisit').onclick=saveWoundVisit;
  $('deliveryDetailBack').onclick=()=>show(deliveryReturn);
  $('deliveryFormBack').onclick=()=>openDeliveryDetail(currentDelivery?.id,deliveryReturn,false);
  $('woundPatientBack').onclick=()=>show('woundPatients');
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.go));
  setInterval(()=>{if(session&&!document.hidden&&navigator.onLine)autoSync()},60000);window.addEventListener('online',()=>{status();syncAll()});window.addEventListener('offline',status);document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoSync()});
}

async function registerSW(){
  if(!('serviceWorker'in navigator))return;
  try{const reg=await navigator.serviceWorker.register('./service-worker.js');reg.update();
    if(reg.waiting)showUpdate(reg);reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(nw)nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)})});
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
  }catch(e){console.warn('SW',e)}
}
function showUpdate(reg){$('updateBanner').classList.remove('hidden');$('updateNow').onclick=()=>reg.waiting&&reg.waiting.postMessage({type:'SKIP_WAITING'})}

async function loadPublicUsers(){
  try{if(navigator.onLine&&API.configured){const r=await API.users();publicUsers=r.users||[];await idbSet(STORES.kv,'publicUsersV8',publicUsers)}else publicUsers=await idbGet(STORES.kv,'publicUsersV8')||[]}
  catch(e){publicUsers=await idbGet(STORES.kv,'publicUsersV8')||[]}
  const sel=$('user');sel.innerHTML='<option value="">Seleccionar…</option>'+publicUsers.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
  if(!publicUsers.length){sel.innerHTML='<option value="">No se pudieron cargar usuarios</option>';$('activationError').className='error';$('activationError').textContent='Necesitás conexión a Biomedical API para la activación inicial.'}
}

function route(){
  if(session){$('activation').classList.add('hidden');$('shell').classList.remove('hidden');$('bottomNav').classList.remove('hidden');renderShell();show('home');syncAll()}
  else{$('activation').classList.remove('hidden');$('shell').classList.add('hidden');$('bottomNav').classList.add('hidden')}
}

async function activateDevice(){
  const uid=$('user').value,code=$('code').value.trim();$('activationError').textContent='';
  if(!uid||!code){$('activationError').className='error';$('activationError').textContent='Elegí un usuario e ingresá el código.';return}
  if(!navigator.onLine){$('activationError').className='error';$('activationError').textContent='La activación inicial necesita Internet.';return}
  const btn=$('activate');btn.disabled=true;btn.textContent='ACTIVANDO…';
  try{const device={id:crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now(),platform:navigator.userAgent};const r=await API.activate(uid,code,device);
    session={userId:r.user.id,name:r.user.name,role:r.user.role,superAdmin:r.user.superAdmin,sectors:r.user.sectors||[],authToken:r.authToken,deviceId:device.id,activatedAt:new Date().toISOString()};
    API.setToken(session.authToken);await idbSet(STORES.kv,'sessionV8Clean',session);route();
  }catch(e){$('activationError').className='error';$('activationError').textContent='No se pudo activar: '+e.message}
  finally{btn.disabled=false;btn.textContent='ACTIVAR'}
}

async function logout(){
  if((await idbGet(STORES.kv,'deliveryQueueV8Clean')||[]).length||(await idbGet(STORES.kv,'woundQueueV8Clean')||[]).length){alert('Hay registros pendientes. Sincronizá antes de desvincular.');return}if(!confirm('¿Desvincular este dispositivo?'))return;
  try{if(navigator.onLine&&session?.authToken)await API.revoke(userId())}catch(_){ }
  await idbDel(STORES.kv,'sessionV8Clean');session=null;API.setToken('');route();
}

function renderShell(){
  $('hello').textContent=(session.name||'').split(' ')[0];$('profileName').textContent=session.name;$('role').textContent=session.role;
  $('deviceId').textContent=(session.deviceId||'').slice(0,10).toUpperCase();$('activatedAt').textContent=fmt(session.activatedAt);
  $('deliveryAdminTools').classList.toggle('hidden',!session.superAdmin);$('woundAdminTools').classList.toggle('hidden',!session.superAdmin);
  const mods=[];
  if(hasSector('materials'))mods.push(`<button class="module" onclick="show('materials')"><div class="module-icon">📦</div><div class="module-main"><strong>Control de Entrega de Materiales</strong><small>Seguimiento operativo</small></div><div class="arrow">›</div></button>`);
  if(hasSector('wounds'))mods.push(`<button class="module" onclick="show('wounds')"><div class="module-icon green-icon">🩹</div><div class="module-main"><strong>Cuidado de Heridas</strong><small>Pacientes, visitas y evolución</small></div><div class="arrow">›</div></button>`);
  $('modules').innerHTML=mods.join('')||'<div class="empty">No tenés sectores habilitados.</div>';
  populateUserFilter();renderAssigned();status();
}
function populateUserFilter(){$('userFilter').innerHTML='<option value="">Todos los usuarios</option>'+publicUsers.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}

function status(){
  if(!session)return;const on=navigator.onLine;$('conn').textContent=on?'Conectado':'Sin conexión';$('deviceStatus').textContent=on?'Conectado':'Sin conexión';
  $('last').textContent=on?(lastSync?'Sincronizado · '+fmt(lastSync):'Pendiente de primera sincronización'):'Modo offline · última sync '+fmt(lastSync);$('deviceSync').textContent=fmt(lastSync);
}
function setSyncError(msg){const el=$('syncError');if(msg){el.textContent=msg;el.classList.remove('hidden');$('conn').textContent='Error de sincronización';$('conn').classList.add('sync-error')}else{el.classList.add('hidden');el.textContent='';$('conn').classList.remove('sync-error')}}

async function syncAll(){
  if(syncBusy)return;if(!session||!navigator.onLine||!API.configured){status();return} syncBusy=true;lastAuto=Date.now();
  const btn=$('sync');btn.disabled=true;btn.textContent='SINCRONIZANDO…';setSyncError('');
  try{
    const rules=await API.call('fieldRules',{userId:userId()});fieldRules=rules.rules;await idbSet(STORES.kv,'fieldRulesV9',fieldRules);applyRules();await flushDeliveryQueue();await flushWoundQueue();
    if(hasSector('materials')){const r=await API.deliveries(userId());deliveries=r.deliveries||[];await idbSet(STORES.kv,'deliveriesV8Clean',deliveries)}
    if(hasSector('wounds')){const m=await API.woundPatients(userId(),'mine');woundMine=m.patients||[];await idbSet(STORES.kv,'woundMineV8Clean',woundMine);if(session.superAdmin){const a=await API.woundPatients(userId(),'all');woundAll=a.patients||[];await idbSet(STORES.kv,'woundAllV8Clean',woundAll)}else woundAll=[]}
    lastSync=new Date().toISOString();await idbSet(STORES.kv,'lastSyncV8Clean',lastSync);renderAssigned();refreshCurrentScreen();status();
  }catch(e){console.error(e);setSyncError('No se pudo sincronizar: '+e.message)}
  finally{syncBusy=false;btn.disabled=false;btn.textContent='SINCRONIZAR AHORA';storageStatus().catch(()=>{})}
}
function refreshCurrentScreen(){const active=document.querySelector('.screen.active')?.id;if(active==='deliveryAssigned')renderDeliveryAssigned();if(active==='myDeliveries')renderMyDeliveries();if(active==='records')renderRecords();if(active==='woundPatients')renderWoundPatients();if(active==='woundVisitPicker')renderWoundPicker();if(active==='otherDelivery')renderOtherMatches();if(active==='woundPatientDetail'&&currentPatient){const fresh=[...woundMine,...woundAll].find(p=>p.id===currentPatient.id);if(fresh){currentPatient=fresh;renderPatientHeader()}}}

/* ==================== ENTREGAS ==================== */
function deliveryDetailHTML(r){return `<div class="detail-grid"><div class="detail-row"><small>N.º de remito</small><strong>${esc(r.remito)}</strong></div><div class="detail-row"><small>Material · ${esc(r.materialId||'Sin ID')}</small><strong>${esc(r.material)} · ${esc(r.cantidad)} unidad(es)</strong></div><div class="detail-row"><small>Sanatorio</small><strong>${esc(r.sanatorio)}</strong></div><div class="detail-row"><small>Paciente</small><strong>${esc(r.paciente)}</strong></div><div class="detail-row"><small>Médico</small><strong>${esc(r.medico)}</strong></div><div class="detail-row"><small>Asignado a</small><strong>${esc(displayUser(r.assignedTo))}</strong></div><div class="detail-row"><small>Estado</small><strong>${stateName(r.state)}</strong></div>${r.exitBy?`<div class="detail-row"><small>Retirado por</small><strong>${esc(r.exitBy)} · ${esc(fmt(r.exitAt))}</strong></div>`:''}${r.deliveredBy?`<div class="detail-row"><small>Entregado por</small><strong>${esc(r.deliveredBy)} · ${esc(fmt(r.deliveredAt))}</strong></div>`:''}${r.receivedBy?`<div class="detail-row"><small>Recibido por / Sector</small><strong>${esc(r.receivedBy)} · ${esc(r.sector||'—')}</strong></div>`:''}${r.note?`<div class="detail-row"><small>Nota</small><strong>${esc(r.note)}</strong></div>`:''}</div>`}
function deliveryCard(r,{showAssigned=false,source='deliveryAssigned',viewOnly=false}={}){return `<div class="task-card ${viewOnly?'view-only':''}"><div class="task-top"><div><div class="task-title">${esc(r.remito)} · ${esc(r.material)}</div><div class="task-meta">${esc(r.sanatorio)}<br>${esc(r.paciente)} · ${esc(r.medico)}${showAssigned?`<br><strong>Asignado a: ${esc(displayUser(r.assignedTo))}</strong>`:''}</div></div><span class="pill ${r.state==='out'?'out':r.state==='done'?'done':''}">${stateName(r.state)}</span></div>${r.note?`<div class="note-box"><strong>Nota:</strong> ${esc(r.note)}</div>`:''}<div class="task-actions"><button class="secondary" onclick="openDeliveryDetail('${esc(r.id)}','${source}',${viewOnly})">Ver detalle</button>${!viewOnly?(r.state==='assigned'?`<button class="primary" onclick="markDeliveryOut('${esc(r.id)}','${source}')">Marcar retirado</button>`:r.state==='out'?`<button class="primary" onclick="openDeliveryForm('${esc(r.id)}','${source}')">Completar entrega</button>`:''):''}</div></div>`}
function renderDeliveryAssigned(){const a=deliveries.filter(r=>r.assignedTo===userId()&&r.state!=='done');$('deliveryAssignedList').innerHTML=a.length?a.map(r=>deliveryCard(r,{source:'deliveryAssigned'})).join(''):'<div class="empty">No tenés entregas pendientes asignadas.</div>'}
function renderMyDeliveries(){const a=deliveries.filter(r=>r.state==='done'&&r.assignedTo===userId());$('myDeliveriesList').innerHTML=a.length?a.map(r=>`<div class="task-card"><div class="task-top"><div><div class="task-title">${esc(r.remito)} · ${esc(r.material)}</div><div class="task-meta">${esc(r.sanatorio)}<br>${esc(r.paciente)}<br><strong>Entregado: ${esc(fmt(r.deliveredAt))}</strong></div></div><span class="pill done">Entregado</span></div>${r.note?`<div class="note-box"><strong>Nota:</strong> ${esc(r.note)}</div>`:''}<div class="task-actions"><button class="secondary" onclick="openDeliveryDetail('${esc(r.id)}','myDeliveries',true)">Ver detalle</button><button class="primary" onclick="openNoteEditor('${esc(r.id)}')">${r.note?'Editar nota':'Agregar nota'}</button></div></div>`).join(''):'<div class="empty">Todavía no tenés entregas realizadas.</div>'}
function openDeliveryDetail(id,from='deliveryAssigned',viewOnly=false){currentDelivery=deliveries.find(r=>r.id===id);if(!currentDelivery)return;deliveryReturn=from;$('deliveryDetailBody').innerHTML=deliveryDetailHTML(currentDelivery)+(viewOnly?'':`<div style="margin-top:14px">${currentDelivery.state==='assigned'?`<button class="primary" onclick="markDeliveryOut('${esc(id)}','${from}')">MARCAR COMO RETIRADO</button>`:currentDelivery.state==='out'?`<button class="primary" onclick="openDeliveryForm('${esc(id)}','${from}')">COMPLETAR ENTREGA</button>`:''}</div>`);show('deliveryDetail')}
async function markDeliveryOut(id,from='deliveryAssigned'){const r=deliveries.find(x=>x.id===id);if(!r||r.state!=='assigned'||!confirm(`¿Confirmar que retiraste el material del remito ${r.remito}?`))return;const stamp=new Date().toISOString();try{await enqueueDelivery({type:'patch',id,patch:{state:'out',eventAt:stamp,operationId:crypto.randomUUID()}});Object.assign(r,{state:'out',assignedTo:userId(),exitBy:session.name,exitAt:stamp});await saveDeliveries();openDeliveryDetail(id,'deliveryAssigned',false);await syncAll()}catch(e){alert(e.message)}}
function openDeliveryForm(id,from='deliveryAssigned'){currentDelivery=deliveries.find(r=>r.id===id);if(!currentDelivery)return;deliveryReturn=from;$('deliveryReadOnly').innerHTML=deliveryDetailHTML(currentDelivery);$('receivedBy').value='';$('deliverySector').value='';$('deliveryNote').value=currentDelivery.note||'';$('remitoPhoto').value='';$('remitoPreview').classList.add('hidden');show('deliveryForm')}
async function confirmDelivery(){if(!currentDelivery)return;const btn=$('confirmDelivery');btn.disabled=true;btn.textContent='PROCESANDO FOTO…';try{const file=$('remitoPhoto').files[0];const photo=await imageDataUrl(file,'remito');const patch={state:'done',receivedBy:$('receivedBy').value.trim(),sector:$('deliverySector').value.trim(),note:$('deliveryNote').value.trim(),eventAt:new Date().toISOString(),operationId:crypto.randomUUID()};checkRules('delivery',{...patch,remitoPhoto:photo});const id=currentDelivery.id;await enqueueDelivery({type:'complete',id,patch,photoDataUrl:photo,fileName:file?.name});Object.assign(currentDelivery,{...patch,assignedTo:userId(),deliveredBy:session.name,deliveredAt:patch.eventAt});await saveDeliveries();show('myDeliveries');await syncAll();alert('Registro guardado en el dispositivo. Revisá el estado de sincronización.')}catch(e){alert('No se pudo guardar: '+e.message)}finally{btn.disabled=false;btn.textContent='CONFIRMAR ENTREGA'}}
function openNoteEditor(id){currentDelivery=deliveries.find(r=>r.id===id);if(!currentDelivery)return;$('historyNote').value=currentDelivery.note||'';$('historyNoteContext').innerHTML=deliveryDetailHTML(currentDelivery);show('historyNoteScreen')}
async function saveHistoryNote(){if(!currentDelivery)return;const note=$('historyNote').value.trim();try{if(navigator.onLine)await API.updateDelivery(userId(),currentDelivery.id,{note});else await enqueueDelivery({type:'patch',id:currentDelivery.id,patch:{note}});currentDelivery.note=note;await saveDeliveries();show('myDeliveries')}catch(e){if(networkish(e)){await enqueueDelivery({type:'patch',id:currentDelivery.id,patch:{note}});currentDelivery.note=note;await saveDeliveries();show('myDeliveries')}else alert('No se pudo guardar la nota: '+e.message)}}
function prepareOther(){$('otherSearch').value='';$('otherMatches').innerHTML='';$('otherPreview').innerHTML='<div class="muted" style="font-size:12px">Ingresá un número de remito o el nombre de un paciente.</div>'}
function renderOtherMatches(){if(!session.superAdmin)return;const q=normalize($('otherSearch').value);$('otherPreview').innerHTML='';if(!q){$('otherMatches').innerHTML='';return}const a=deliveries.filter(r=>r.assignedTo!==userId()&&r.state!=='done'&&(normalize(r.remito).includes(q)||normalize(r.paciente).includes(q)||normalize(r.materialId).includes(q)));$('otherMatches').innerHTML=a.length?a.map(r=>`<div class="search-hit"><strong>${esc(r.remito)} · ${esc(r.paciente)}</strong><div class="task-meta">${esc(r.sanatorio)}<br>${esc(r.material)}<br>Asignado a: ${esc(displayUser(r.assignedTo))} · ${stateName(r.state)}</div><button class="secondary" onclick="selectOtherDelivery('${esc(r.id)}')">Seleccionar entrega</button></div>`).join(''):'<div class="empty">No encontramos una entrega pendiente.</div>'}
function selectOtherDelivery(id){currentDelivery=deliveries.find(r=>r.id===id);deliveryReturn='otherDelivery';$('otherMatches').innerHTML='';$('otherPreview').innerHTML=deliveryDetailHTML(currentDelivery)+`<div style="margin-top:14px">${currentDelivery.state==='assigned'?`<button class="primary" onclick="markDeliveryOut('${esc(id)}','otherDelivery')">MARCAR COMO RETIRADO</button>`:`<button class="primary" onclick="openDeliveryForm('${esc(id)}','otherDelivery')">COMPLETAR ENTREGA</button>`}</div>`}
function renderRecords(){if(!session.superAdmin)return;const q=normalize($('recordSearch').value),st=$('stateFilter').value,us=$('userFilter').value;const a=deliveries.filter(r=>(!q||[r.remito,r.sanatorio,r.material,r.materialId,r.medico,r.paciente].some(v=>normalize(v).includes(q)))&&(!st||r.state===st)&&(!us||r.assignedTo===us));$('recordCount').textContent=`${a.length} registro(s)`;$('recordsList').innerHTML=a.length?a.map(r=>deliveryCard(r,{showAssigned:true,source:'records',viewOnly:true})).join(''):'<div class="empty">No encontramos registros con esos criterios.</div>'}
async function saveDeliveries(){await idbSet(STORES.kv,'deliveriesV8Clean',deliveries);renderDeliveryAssigned();renderMyDeliveries();renderAssigned()}
async function enqueueDelivery(item){const q=await idbGet(STORES.kv,'deliveryQueueV8Clean')||[];q.push({...item,owner:userId(),qid:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:new Date().toISOString()});await checkStorage(item);await idbSet(STORES.kv,'deliveryQueueV8Clean',q);storageStatus().catch(()=>{})}
async function flushDeliveryQueue(){const q=await idbGet(STORES.kv,'deliveryQueueV8Clean')||[];for(const item of q){try{if(item.owner&&item.owner!==userId())throw new Error('Registro pendiente de otro usuario');const patch={...item.patch,eventAt:item.patch.eventAt||item.createdAt,operationId:item.patch.operationId||item.qid};if(item.type==='complete'){let up;try{up=item.photoDataUrl?await API.uploadRemito(userId(),item.id,item.photoDataUrl,item.fileName||'remito.jpg',patch.operationId):null}catch(e){throw new Error('Subida de foto: '+e.message)}patch.remitoPhoto=up?.url||''}try{await API.updateDelivery(userId(),item.id,patch)}catch(e){throw new Error('Confirmación de entrega: '+e.message)};const latest=await idbGet(STORES.kv,'deliveryQueueV8Clean')||[];await idbSet(STORES.kv,'deliveryQueueV8Clean',latest.filter(x=>x.qid!==item.qid))}catch(e){throw new Error('Entrega pendiente: '+e.message)}}}

/* ==================== HERIDAS ==================== */
function patientsForScope(scope){return scope==='all'&&session.superAdmin?woundAll:woundMine.filter(activeTreatment)}
function woundCard(p,{picker=false}={}){const rem=Number.isFinite(Number(p.visitsRemaining))?Number(p.visitsRemaining):'—';return `<div class="task-card wound-patient-card ${picker?'wound-picker-card':''}"><div class="task-top"><div><div class="task-title">${esc(p.name||p.id)}</div><div class="task-meta">${esc(p.id)}<br>${esc(p.woundType||'Tipo de herida sin cargar')}${p.doctor?` · ${esc(p.doctor)}`:''}${p.nurse?`<br>Enfermero: ${esc(p.nurse)}`:''}</div></div><span class="pill auth ${authClass(p.authStatus)}">${esc(rem)} restante${rem===1?'':'s'}</span></div><div class="auth-line ${authClass(p.authStatus)}">${esc(p.authStatus||'SIN DATOS DE AUTORIZACIÓN')}</div><div class="task-actions">${picker?`<button class="primary" onclick="selectWoundForVisit('${esc(p.id)}')">REGISTRAR VISITA</button>`:`<button class="secondary" onclick="openWoundPatient('${esc(p.id)}')">Ver paciente</button>${activeTreatment(p)?`<button class="primary" onclick="openWoundPatient('${esc(p.id)}',true)">Registrar visita</button>`:''}`}</div></div>`}
function openWoundPatients(scope='mine'){woundScope=scope;$('woundPatientsTitle').textContent=scope==='all'?'Todos los pacientes':'Mis pacientes';$('woundPatientSearch').value='';show('woundPatients')}
function renderWoundPatients(){const q=normalize($('woundPatientSearch').value);let a=patientsForScope(woundScope).slice();if(q)a=a.filter(p=>[p.name,p.id,p.doctor,p.insurance,p.nurse].some(v=>normalize(v).includes(q)));$('woundPatientCount').textContent=`${a.length} paciente(s)`;$('woundPatientList').innerHTML=a.length?a.map(p=>woundCard(p)).join(''):'<div class="empty">No encontramos pacientes. Si esperabas ver pacientes, tocá “Sincronizar ahora” y revisá el mensaje de conexión.</div>'}
function openWoundVisitPicker(){$('woundPickerSearch').value='';$('woundPickerHelp').textContent=session.superAdmin?'Podés registrar una visita para cualquier paciente.':'Solo aparecen los pacientes que tenés asignados.';show('woundVisitPicker')}
function renderWoundPicker(){const q=normalize($('woundPickerSearch').value);let a=(session.superAdmin?woundAll:woundMine).filter(activeTreatment);if(q)a=a.filter(p=>[p.name,p.id,p.doctor,p.insurance].some(v=>normalize(v).includes(q)));$('woundPickerList').innerHTML=a.length?a.map(p=>woundCard(p,{picker:true})).join(''):'<div class="empty">No encontramos pacientes.</div>'}
function selectWoundForVisit(id){currentPatient=(session.superAdmin?woundAll:woundMine).find(p=>p.id===id);if(!currentPatient)return;openNewWoundVisit()}
async function openWoundPatient(id,startVisit=false){currentPatient=[...woundMine,...woundAll].find(p=>p.id===id);if(!currentPatient)return;show('woundPatientDetail');renderPatientHeader();let visits=await idbGet(STORES.kv,'woundHistory_'+id)||[];if(navigator.onLine){try{const r=await API.woundHistory(userId(),id);currentPatient=r.patient||currentPatient;visits=r.visits||[];woundHistoryCache[id]=visits;await idbSet(STORES.kv,'woundHistory_'+id,visits);renderPatientHeader()}catch(e){setSyncError('No se pudo cargar el historial: '+e.message)}}renderWoundHistory(visits);if(startVisit)openNewWoundVisit()}
function renderPatientHeader(){const p=currentPatient;if(!p)return;$('newVisitBtn').classList.toggle('hidden',!activeTreatment(p));$('finishBtn').classList.toggle('hidden',!activeTreatment(p)&&!session.superAdmin);$('finishBtn').textContent=activeTreatment(p)?'FINALIZAR TRATAMIENTO':'REACTIVAR TRATAMIENTO';$('woundPatientBody').innerHTML=`<div class="patient-hero"><div><small>${esc(p.id)}</small><h2>${esc(p.name)}</h2><div class="muted">${esc(p.woundType||'Tipo de herida sin cargar')}</div></div><span class="pill auth ${authClass(p.authStatus)}">${esc(p.visitsRemaining??'—')} restantes</span></div><div class="detail-grid"><div class="detail-row"><small>Estado: ${esc(p.treatmentStatus||'En tratamiento')}</small><small>Obra social</small><strong>${esc(p.insurance||'—')}</strong></div><div class="detail-row"><small>Médico tratante</small><strong>${esc(p.doctor||'—')}</strong></div><div class="detail-row"><small>Enfermero responsable</small><strong>${esc(p.nurse||'—')}</strong></div><div class="detail-row"><small>Frecuencia</small><strong>${esc(p.frequency||'—')}</strong></div><div class="detail-row"><small>Autorización</small><strong>${esc(p.visitsDone||0)} realizadas · ${esc(p.authorized||0)} autorizadas</strong><div class="auth-line ${authClass(p.authStatus)}">${esc(p.authStatus||'SIN DATOS')}</div></div>${p.expirationDate?`<div class="detail-row"><small>Vencimiento autorización</small><strong>${esc(dateOnly(p.expirationDate))}</strong></div>`:''}${p.notes?`<div class="detail-row"><small>Observaciones</small><strong>${esc(p.notes)}</strong></div>`:''}</div>`}
function renderWoundHistory(visits){const sorted=visits.slice().sort((a,b)=>(new Date(a.date).getTime()||0)-(new Date(b.date).getTime()||0));renderWoundChart(sorted);const desc=sorted.slice().reverse();$('woundHistoryList').innerHTML=desc.length?desc.map(v=>`<div class="task-card visit-card"><div class="task-top"><div><div class="task-title">Visita ${esc(v.visitNumber||'')} · ${esc(fmt(v.date))}</div><div class="task-meta">${esc(v.length||'—')} × ${esc(v.width||'—')} cm · ${esc(v.surface||'—')} cm²<br>Dolor: ${v.pain===''?'—':esc(v.pain)} · ${esc(v.dressing||'Sin apósito cargado')}<br>${esc(v.nurse||'')} · ${esc(v.location||'')} · ${esc(v.depth||'')}${v.tissue?` · ${esc(v.tissue)}`:''}${v.exudate?` · Exudado ${esc(v.exudate)}`:''}${v.smell?` · Olor ${esc(v.smell)}`:''}</div></div><span class="pill evolution ${normalize(v.evolution)}">${esc(v.evolution||'—')}</span></div>${v.notes?`<div class="note-box">${esc(v.notes)}</div>`:''}<div class="photo-links">${v.photoBefore?`<a href="${esc(v.photoBefore)}" target="_blank" rel="noopener">Foto antes</a>`:''}${v.photoAfter?`<a href="${esc(v.photoAfter)}" target="_blank" rel="noopener">Foto después</a>`:''}</div>${v.nextVisit?`<div class="task-meta" style="margin-top:8px"><strong>Próxima visita:</strong> ${esc(dateOnly(v.nextVisit))}</div>`:''}</div>`).join(''):'<div class="empty">Todavía no hay visitas registradas.</div>'}
function renderWoundChart(visits){const pts=visits.filter(v=>Number(v.surface)>0);if(pts.length<2){$('woundChart').innerHTML='<div class="muted chart-empty">El gráfico aparecerá cuando haya al menos 2 visitas con medidas.</div>';return}const W=320,H=150,pad=24,max=Math.max(...pts.map(v=>Number(v.surface))),min=Math.min(...pts.map(v=>Number(v.surface))),span=Math.max(max-min,0.01);const coords=pts.map((v,i)=>({v,x:pad+(i*(W-pad*2)/Math.max(pts.length-1,1)),y:pad+((max-Number(v.surface))*(H-pad*2)/span)}));$('woundChart').innerHTML=`<div class="chart-title">Evolución de superficie (cm²)</div><svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" class="axis"/><polyline points="${coords.map(c=>`${c.x},${c.y}`).join(' ')}" class="trend"/>${coords.map(c=>`<circle cx="${c.x}" cy="${c.y}" r="5" class="point"><title>Visita ${esc(c.v.visitNumber)}: ${esc(c.v.surface)} cm²</title></circle>`).join('')}</svg><div class="chart-foot"><span>${esc(pts[0].surface)} cm²</span><span>${esc(pts[pts.length-1].surface)} cm²</span></div>`}
function localDateTimeInput(d=new Date()){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function localDateInput(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function suggestedNextDate(freq){const f=normalize(freq);let days=0;if(f.includes('seman'))days=7;else if(f.includes('diari'))days=1;else if(f.includes('48'))days=2;else if(f.includes('72'))days=3;else if(f.includes('cada 2'))days=2;else if(f.includes('cada 3'))days=3;if(!days)return null;const d=new Date();d.setDate(d.getDate()+days);return d}
function openNewWoundVisit(){const p=currentPatient;if(!p||!activeTreatment(p))return;show('woundVisitForm');$('woundVisitPatient').innerHTML=`<h3>${esc(p.name)}</h3><div class="muted">${esc(p.id)} · ${esc(p.woundType||'')}</div><div class="auth-line ${authClass(p.authStatus)}">${esc(p.authStatus||'SIN DATOS')} · ${esc(p.visitsRemaining??'—')} restantes</div>`;$('wvDate').value=localDateTimeInput();const sug=suggestedNextDate(p.frequency);$('wvNext').value=sug?localDateInput(sug):'';$('wvNextHint').textContent=sug?`Sugerida según frecuencia: ${p.frequency}`:'';['wvLength','wvWidth','wvPain','wvDressing','wvNotes','wvLocation'].forEach(id=>$(id).value='');['wvDepth','wvTissue','wvExudate','wvSmell'].forEach(id=>$(id).value='');['wvPhotoBefore','wvPhotoAfter'].forEach(id=>$(id).value='');['wvBeforePreview','wvAfterPreview'].forEach(id=>$(id).classList.add('hidden'));$('woundSaveStatus').classList.add('hidden')}
async function saveWoundVisit(){
  if(!currentPatient)return;
  const length=$('wvLength').value;
  const width=$('wvWidth').value;
  const date=$('wvDate').value;
  

  const btn=$('saveWoundVisit');
  btn.disabled=true;btn.textContent='GUARDANDO…';

  let visit=null;
  try{
    visit={
      id:'VIS-APP-'+(crypto.randomUUID?crypto.randomUUID():Date.now()),
      patientId:currentPatient.id,
      date,
      length,
      width,
      depth:$('wvDepth').value,
      tissue:$('wvTissue').value,
      exudate:$('wvExudate').value,
      smell:$('wvSmell').value,
      pain:$('wvPain').value,
      dressing:$('wvDressing').value.trim(),
      notes:$('wvNotes').value.trim(),
      nextVisit:$('wvNext').value,location:$('wvLocation').value.trim(),
      photoBefore:await imageDataUrl($('wvPhotoBefore').files[0]),
      photoAfter:await imageDataUrl($('wvPhotoAfter').files[0])
    };

    checkRules('wound',visit);
    if(navigator.onLine){
      await enqueueWound(visit);await appendLocalWoundVisit(visit);await syncAll();if(!(await idbGet(STORES.kv,'woundQueueV8Clean')||[]).some(x=>x.id===visit.id))await openWoundPatient(visit.patientId);else show('woundPatientDetail');
    }else{
      await enqueueWound(visit);
      await appendLocalWoundVisit(visit);
      $('woundSaveStatus').textContent='Visita guardada offline. Se enviará al recuperar Internet.';
      $('woundSaveStatus').classList.remove('hidden');
      setTimeout(()=>show('woundPatientDetail'),700);
    }
  }catch(e){
    if(visit&&networkish(e)){
      try{
        await enqueueWound(visit);
        await appendLocalWoundVisit(visit);
        alert('Visita guardada offline. Se sincronizará luego.');
        show('woundPatientDetail');
      }catch(qe){alert('No se pudo guardar offline: '+qe.message)}
    }else{
      alert('No se pudo guardar la visita: '+e.message);
    }
  }finally{
    btn.disabled=false;btn.textContent='GUARDAR VISITA';
  }
}
async function appendLocalWoundVisit(v){const key='woundHistory_'+v.patientId;const arr=await idbGet(STORES.kv,key)||[];const surface=v.length===''||v.width===''?'':Number(v.length)*Number(v.width);if(arr.some(x=>x.id===v.id))return;arr.push({...v,photoBefore:'',photoAfter:'',surface,visitNumber:arr.length+1,evolution:'PENDIENTE DE SINCRONIZAR',origin:'APP OFFLINE'});await idbSet(STORES.kv,key,arr);renderWoundHistory(arr)}
async function enqueueWound(visit){const q=await idbGet(STORES.kv,'woundQueueV8Clean')||[];if(!q.some(x=>x.id===visit.id))q.push({...visit,owner:userId()});await checkStorage(visit);await idbSet(STORES.kv,'woundQueueV8Clean',q);storageStatus().catch(()=>{})}
async function flushWoundQueue(){const q=await idbGet(STORES.kv,'woundQueueV8Clean')||[];for(const v of q){if(v.owner&&v.owner!==userId())throw new Error('Visita pendiente de otro usuario');try{await API.createWoundVisit(userId(),v)}catch(e){throw new Error('Visita pendiente: '+e.message)};const hk='woundHistory_'+v.patientId;const hist=await idbGet(STORES.kv,hk)||[];await idbSet(STORES.kv,hk,hist.filter(x=>x.id!==v.id));const latest=await idbGet(STORES.kv,'woundQueueV8Clean')||[];await idbSet(STORES.kv,'woundQueueV8Clean',latest.filter(x=>x.id!==v.id))}}

function renderAssigned(){if(!session)return;let html='';if(hasSector('materials')){const d=deliveries.filter(r=>r.assignedTo===userId()&&r.state!=='done');if(d.length)html+=`<div class="assigned-section-label">Entrega de materiales</div>${d.map(r=>deliveryCard(r,{source:'assigned'})).join('')}`}if(hasSector('wounds')&&woundMine.length)html+=`<div class="assigned-section-label">Cuidado de heridas</div>${woundMine.filter(activeTreatment).map(p=>woundCard(p)).join('')}`;$('assignedList').innerHTML=html||'<div class="empty">No tenés pendientes asignados.</div>'}
const photoCache=new WeakMap();
async function previewFile(file,img){img.classList.add('hidden');img.removeAttribute('src');if(!file)return;try{const data=await imageDataUrl(file,img.id==='remitoPreview'?'remito':'wound');img.src=data;img.classList.remove('hidden')}catch(e){alert(e.message)}}
let photoWork=Promise.resolve();
function imageDataUrl(file,kind='wound'){if(!file)return Promise.resolve('');if(photoCache.has(file))return photoCache.get(file);const task=photoWork.catch(()=>{}).then(async()=>{if(!file.type.startsWith('image/'))throw new Error('Seleccioná una imagen válida');const url=URL.createObjectURL(file);let img;try{img=new Image();await new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error('Tiempo agotado al abrir foto')),15000);img.onload=()=>{clearTimeout(t);ok()};img.onerror=()=>{clearTimeout(t);no(new Error('Formato no compatible. Probá una foto JPG.'))};img.src=url});const scale=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));try{c.getContext('2d').drawImage(img,0,0,c.width,c.height);let data=c.toDataURL('image/jpeg',0.88);const target=kind==='remito'?700000:1400000;for(let q=0.82;data.length>target&&q>=0.70;q-=0.06)data=c.toDataURL('image/jpeg',q);if(!data.startsWith('data:image/jpeg'))throw new Error('No se pudo comprimir la foto');return data}finally{c.width=c.height=1}}finally{if(img)img.src='';URL.revokeObjectURL(url)}});photoWork=task.then(()=>{},()=>{});photoCache.set(file,task);task.catch(()=>photoCache.delete(file));return task}
function show(name){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const target=$(name);if(!target)return;target.classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name));if(name==='device')storageStatus().catch(()=>{});if(name==='assigned')renderAssigned();if(name==='deliveryAssigned')renderDeliveryAssigned();if(name==='myDeliveries')renderMyDeliveries();if(name==='otherDelivery')prepareOther();if(name==='records')renderRecords();if(name==='woundPatients')renderWoundPatients();if(name==='woundVisitPicker')renderWoundPicker();window.scrollTo(0,0);if(['home','assigned','materials','wounds','deliveryAssigned','myDeliveries','records','otherDelivery','woundPatients','woundVisitPicker'].includes(name))autoSync()}

document.addEventListener('DOMContentLoaded',init);

function autoSync(){if(Date.now()-lastAuto>15000)syncAll()}
function activeTreatment(p){return !p.treatmentStatus||normalize(p.treatmentStatus)==='en tratamiento'}
function applyRules(){Object.entries(FIELD_DEFS).forEach(([m,defs])=>Object.entries(defs).forEach(([k,[id,label,def]])=>{const el=$(id);if(!el)return;const required=fieldRules[m]?.[k]??def;el.required=required;const lab=el.closest('.field')?.querySelector('label');if(lab)lab.textContent=label+(required?' *':'')}))}
function checkRules(m,v){Object.entries(FIELD_DEFS[m]).forEach(([k,[id,label,def]])=>{if((fieldRules[m]?.[k]??def)&&String(v[k]??'').trim()==='')throw new Error('Campo obligatorio: '+label)})}
async function finishTreatment(){if(!currentPatient||!navigator.onLine){alert('Necesitás conexión');return}const states=['Alta por cierre de herida','Alta médica','Suspendido','Derivado','Finalizado por obra social'];let status='En tratamiento';if(activeTreatment(currentPatient)){const n=prompt('Motivo de finalización:\n'+states.map((s,i)=>(i+1)+'. '+s).join('\n'));if(n===null||!states[Number(n)-1])return;status=states[Number(n)-1]}if(!confirm('Confirmar: '+status))return;try{await API.call('finishTreatment',{userId:userId(),patientId:currentPatient.id,status});await syncAll();await openWoundPatient(currentPatient.id)}catch(e){alert(e.message)}}

async function storageStatus(){const d=await idbGet(STORES.kv,'deliveryQueueV8Clean')||[],w=await idbGet(STORES.kv,'woundQueueV8Clean')||[];const bytes=new Blob([JSON.stringify(d),JSON.stringify(w)]).size;const mb=bytes/1048576;const el=$('pendingStorage');if(el)el.textContent=`${mb.toFixed(1)} MB · ${d.length+w.length} pendientes`;const warn=$('storageWarning');if(warn)warn.textContent=mb>=100?'Alerta prioritaria: conectate y sincronizá.':mb>=50?'Conviene sincronizar pronto.':'';return mb}
async function checkStorage(item){const e=await navigator.storage?.estimate?.().catch(()=>null);const bytes=new Blob([JSON.stringify(item)]).size;if(e&&e.quota-e.usage<bytes*2)throw new Error('Espacio insuficiente. Sincronizá los pendientes antes de guardar.');}
