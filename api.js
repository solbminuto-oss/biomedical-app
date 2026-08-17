
const API = {
  get url(){ return (window.BIOMEDICAL_CONFIG && window.BIOMEDICAL_CONFIG.API_URL || '').trim(); },
  get configured(){ return /^https:\/\/script\.google\.com\/macros\/s\//.test(this.url); },
  async call(action,payload={}){
    if(!this.configured) throw new Error('API_NOT_CONFIGURED');
    const body={action,...payload};
    const r=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'});
    if(!r.ok) throw new Error('HTTP_'+r.status);
    const data=await r.json();
    if(!data.ok) throw new Error(data.error||'API_ERROR');
    return data;
  },
  activate(userId,code,device){ return this.call('activate',{userId,code,device}); },
  deliveries(userId){ return this.call('listDeliveries',{userId}); },
  updateDelivery(userId,id,patch){ return this.call('updateDelivery',{userId,id,patch}); },
  search(userId,query,filters={}){ return this.call('searchDeliveries',{userId,query,filters}); },
  uploadRemito(userId,id,dataUrl,fileName){ return this.call('uploadRemito',{userId,id,dataUrl,fileName}); },
  woundPatients(userId){ return this.call('listWoundPatients',{userId}); },
  woundHistory(userId,patientId){ return this.call('woundHistory',{userId,patientId}); },
  createWoundVisit(userId,visit){ return this.call('createWoundVisit',{userId,visit}); }
};
