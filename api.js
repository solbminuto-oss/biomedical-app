const API={
  token:'',
  get url(){return (window.BIOMEDICAL_CONFIG?.API_URL||'').trim()},
  get configured(){return /^https:\/\/script\.google\.com\/macros\/s\//.test(this.url)},
  setToken(token){this.token=token||''},
  async call(action,payload={},auth=true){
    if(!this.configured)throw new Error('API_NOT_CONFIGURED');
    const body={action,...payload};
    if(auth){if(!this.token)throw new Error('SESSION_REQUIRED');body.authToken=this.token}
    const r=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow',cache:'no-store'});
    if(!r.ok)throw new Error('HTTP_'+r.status);
    let data;try{data=await r.json()}catch(_){throw new Error('RESPUESTA_API_INVALIDA')}
    if(!data.ok)throw new Error(data.error||'API_ERROR');
    return data;
  },
  users(){return this.call('listActiveUsers',{},false)},
  activate(userId,code,device){return this.call('activate',{userId,code,device},false)},
  revoke(userId){return this.call('revokeSession',{userId})},
  deliveries(userId){return this.call('listDeliveries',{userId})},
  searchDeliveries(userId,query,filters={}){return this.call('searchDeliveries',{userId,query,filters})},
  updateDelivery(userId,id,patch){return this.call('updateDelivery',{userId,id,patch})},
  uploadRemito(userId,id,dataUrl,fileName){return this.call('uploadRemito',{userId,id,dataUrl,fileName})},
  woundPatients(userId,scope='mine'){return this.call('listWoundPatients',{userId,scope})},
  woundHistory(userId,patientId){return this.call('woundHistory',{userId,patientId})},
  createWoundVisit(userId,visit){return this.call('createWoundVisit',{userId,visit})}
};
