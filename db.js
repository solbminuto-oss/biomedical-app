
const DB_NAME='biomedical-core-v1',DB_VERSION=1,STORES={kv:'kv',queue:'syncQueue'};
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORES.kv))d.createObjectStore(STORES.kv);if(!d.objectStoreNames.contains(STORES.queue))d.createObjectStore(STORES.queue,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbSet(s,k,v){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite');t.objectStore(s).put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});}
async function idbGet(s,k){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(s,'readonly'),r=t.objectStore(s).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
