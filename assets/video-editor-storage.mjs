// Best-effort local media cache. JSON projects remain portable edit decisions;
// originals must still be kept because browsers can evict site storage.
let database;
function openDatabase() {
 if(database)return database;
 database=new Promise(resolve=>{
  if(!globalThis.indexedDB){resolve(null);return;}
  const request=indexedDB.open('wezzet-video-editor',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>resolve(null);
  request.onblocked=()=>resolve(null);
 });
 return database;
}
const key=m=>JSON.stringify([m.name,m.size,m.lastModified||0]);
export async function cacheMedia(media,file,peaks=null) {
 try{
  const db=await openDatabase();if(!db)return false;
  return await new Promise(resolve=>{
   const tx=db.transaction('media','readwrite');
   tx.objectStore('media').put({key:key(media),file,peaks,metadata:{width:media.width,height:media.height,hasAudio:media.hasAudio}});
   tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);
  });
 }catch{return false;}
}
export async function cachedMedia(media) {
 try{
  const db=await openDatabase();if(!db)return null;
  return await new Promise(resolve=>{
   const tx=db.transaction('media','readonly'),request=tx.objectStore('media').get(key(media));
   request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);
  });
 }catch{return null;}
}
