
const CORE_ID = '1B4CA6eYG8Eo0iw5Jirqbtysel9nFAlp293rJITnFJiM';
const DELIVERY_ID = '18qKIsPQ3ltFuuLewgfDKwKlw9HvOsvK0jvUMHxD0ZfM';
const TZ = 'America/Argentina/Buenos_Aires';
const USERS_SHEET = 'Usuarios';
const PERMS_SHEET = 'Permisos';
const DELIVERIES_SHEET = 'Entregas';
const REMITO_FOLDER = 'Biomedical — Remitos App';

function doGet() {
  return json_({ok:true, service:'Biomedical API', version:'V7-integration'});
}
function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(p.action || '');
    if (action === 'activate') return json_(activate_(p));
    if (action === 'listDeliveries') return json_(listDeliveries_(p));
    if (action === 'searchDeliveries') return json_(searchDeliveries_(p));
    if (action === 'updateDelivery') return json_(updateDelivery_(p));
    if (action === 'uploadRemito') return json_(uploadRemito_(p));
    return json_({ok:false,error:'Acción desconocida'});
  } catch(err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function rows_(ssId,sheetName) {
  const sh=SpreadsheetApp.openById(ssId).getSheetByName(sheetName);
  if(!sh) throw new Error('No existe la hoja '+sheetName);
  const values=sh.getDataRange().getDisplayValues();
  if(!values.length) return {sh,headers:[],rows:[]};
  const headers=values[0].map(String);
  const rows=values.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map((r,i)=>{
    const o={_row:i+2}; headers.forEach((h,j)=>o[h]=r[j]||''); return o;
  });
  return {sh,headers,rows};
}
function user_(id) {
  const d=rows_(CORE_ID,USERS_SHEET);
  return d.rows.find(r=>String(r['Usuario ID']).trim()===String(id).trim()) || null;
}
function isYes_(v){return ['si','sí','yes','true','1'].includes(String(v).trim().toLowerCase())}
function isSuper_(u){return u && String(u['Rol']).trim().toLowerCase()==='super admin'}
function requireUser_(id){
  const u=user_(id); if(!u || !isYes_(u['Activo'])) throw new Error('Usuario inactivo o inexistente'); return u;
}
function activate_(p){
  const u=requireUser_(p.userId);
  if(String(u['Código de activación']).trim()!==String(p.code||'').trim()) throw new Error('Código incorrecto');
  const perms=rows_(CORE_ID,PERMS_SHEET).rows.filter(r=>r['Usuario ID']===u['Usuario ID'] && isYes_(r['Puede ver'])).map(r=>r['Sector ID']);
  return {ok:true,user:{id:u['Usuario ID'],name:u['Nombre'],role:u['Rol'],superAdmin:isSuper_(u),sectors:perms}};
}
function mapDelivery_(r){
  const dateTime=(d,t)=>d ? `${d}${t?' '+t:''}` : '';
  return {
    id:r['ID Entrega'], remito:r['N.º Remito'], state:normalizeState_(r['Estado']),
    materialId:r['Material ID'], material:r['Material'], cantidad:r['Cantidad'],
    sanatorio:r['Sanatorio / Institución'], paciente:r['Paciente'], medico:r['Médico / Cirujano'],
    assignedTo:r['Asignado a (Usuario ID)'], fecha:r['Fecha prevista'],
    exitAt:dateTime(r['Fecha salida'],r['Hora salida']), exitBy:r['Registró salida'],
    deliveredAt:dateTime(r['Fecha entrega'],r['Hora entrega']), receivedBy:r['Recibido por'],
    sector:r['Sector'], deliveredBy:r['Registró entrega'], note:r['Nota'], remitoPhoto:r['Foto remito URL']
  };
}
function normalizeState_(s){
  s=String(s||'').trim().toLowerCase();
  if(['retirado','out'].includes(s)) return 'out';
  if(['entregado','done','finalizado'].includes(s)) return 'done';
  return 'assigned';
}
function listDeliveries_(p){
  const u=requireUser_(p.userId);
  const d=rows_(DELIVERY_ID,DELIVERIES_SHEET).rows.map(mapDelivery_);
  return {ok:true,deliveries:isSuper_(u)?d:d.filter(x=>x.assignedTo===u['Usuario ID'] || x.deliveredBy===u['Nombre'])};
}
function searchDeliveries_(p){
  const u=requireUser_(p.userId); if(!isSuper_(u)) throw new Error('Sin permiso de búsqueda global');
  const q=String(p.query||'').trim().toLowerCase(), f=p.filters||{};
  let a=rows_(DELIVERY_ID,DELIVERIES_SHEET).rows.map(mapDelivery_);
  if(q) a=a.filter(x=>[x.remito,x.sanatorio,x.material,x.medico,x.paciente].some(v=>String(v||'').toLowerCase().includes(q)));
  if(f.state) a=a.filter(x=>x.state===f.state);
  if(f.userId) a=a.filter(x=>x.assignedTo===f.userId);
  return {ok:true,deliveries:a};
}
function updateDelivery_(p){
  const u=requireUser_(p.userId), d=rows_(DELIVERY_ID,DELIVERIES_SHEET);
  const row=d.rows.find(r=>r['ID Entrega']===p.id); if(!row) throw new Error('Entrega no encontrada');
  const mapped=mapDelivery_(row);
  if(!isSuper_(u) && mapped.assignedTo!==u['Usuario ID'] && mapped.deliveredBy!==u['Nombre']) throw new Error('Sin permiso para esta entrega');
  const patch=p.patch||{}, allowed=['state','receivedBy','sector','note','remitoPhoto'];
  Object.keys(patch).forEach(k=>{if(!allowed.includes(k)) delete patch[k]});
  const now=new Date(), vals={};
  if(patch.state==='out'){vals['Estado']='Retirado';vals['Fecha salida']=Utilities.formatDate(now,TZ,'dd/MM/yyyy');vals['Hora salida']=Utilities.formatDate(now,TZ,'HH:mm');vals['Registró salida']=u['Nombre'];}
  if(patch.state==='done'){vals['Estado']='Entregado';vals['Fecha entrega']=Utilities.formatDate(now,TZ,'dd/MM/yyyy');vals['Hora entrega']=Utilities.formatDate(now,TZ,'HH:mm');vals['Registró entrega']=u['Nombre'];}
  if('receivedBy' in patch) vals['Recibido por']=patch.receivedBy;
  if('sector' in patch) vals['Sector']=patch.sector;
  if('note' in patch) vals['Nota']=patch.note;
  if('remitoPhoto' in patch) vals['Foto remito URL']=patch.remitoPhoto;
  vals['Última actualización']=Utilities.formatDate(now,TZ,'dd/MM/yyyy HH:mm:ss');
  vals['Usuario última actualización']=u['Nombre']; vals['Estado sincronización']='Sincronizado';
  Object.keys(vals).forEach(h=>{const c=d.headers.indexOf(h); if(c>=0)d.sh.getRange(row._row,c+1).setValue(vals[h])});
  return {ok:true};
}
function uploadRemito_(p){
  const u=requireUser_(p.userId); if(!p.dataUrl) throw new Error('Falta imagen');
  const m=String(p.dataUrl).match(/^data:(image\/[^;]+);base64,(.+)$/); if(!m) throw new Error('Imagen inválida');
  const bytes=Utilities.base64Decode(m[2]), blob=Utilities.newBlob(bytes,m[1],p.fileName||(`${p.id}-${Date.now()}.jpg`));
  let it=DriveApp.getFoldersByName(REMITO_FOLDER), folder=it.hasNext()?it.next():DriveApp.createFolder(REMITO_FOLDER);
  const file=folder.createFile(blob); file.setDescription(`Remito ${p.id} subido por ${u['Nombre']}`);
  return {ok:true,url:file.getUrl()};
}
