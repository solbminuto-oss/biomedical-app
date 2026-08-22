const DB_NAME='biomedical-v8-clean';
const DB_VERSION=1;
const STORES={kv:'kv'};
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORES.kv))d.createObjectStore(STORES.kv)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbSet(store,key,value){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})}
async function idbGet(store,key){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readonly');const r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbDel(store,key){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})}
