
const USERS=[{id:'U-DEMO-1',name:'Sol Demo',code:'2468',role:'Administración',sectors:['entrega_materiales','heridas']},{id:'U-DEMO-2',name:'Diego Demo',code:'1357',role:'Operador',sectors:['entrega_materiales']}];
let session=null,lastSync=null;const $=x=>document.getElementById(x);
function fmt(v){return v?new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'}
async function init(){
 if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./service-worker.js')}catch(e){}}
 USERS.forEach(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;$('user').appendChild(o)});
 session=await idbGet(STORES.kv,'session');lastSync=await idbGet(STORES.kv,'lastSync');
 setTimeout(()=>{$('splash').classList.add('hidden');route()},900);
 $('activate').onclick=activate;$('sync').onclick=sync;$('logout').onclick=logout;
 document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>show(n.dataset.go));
 window.addEventListener('online',()=>{status();sync()});window.addEventListener('offline',status);
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
 status();
}
function show(name){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$(name).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===name))}
document.addEventListener('DOMContentLoaded',init);
