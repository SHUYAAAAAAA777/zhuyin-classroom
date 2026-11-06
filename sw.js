// 版本号要和 index.html 页尾的「版本」同步；改了页面就一起改这里，旧缓存才会被清掉。
const CACHE='zhuyin-v0054';
const CORE=['./','./index.html','./DF.png','./manifest.webmanifest'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;

  // 页面：优先线上最新版，成功就更新缓存；离线时用缓存
  const isPage=req.mode==='navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if(isPage){
    e.respondWith(
      fetch(req,{cache:'no-store'}).then(res=>{
        if(res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}); }
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // 音频（你的录音）：不经过 Service Worker，直接由浏览器自己载入，避免任何缓存机制影响播放
  if(url.pathname.endsWith('.mp3')) return;

  // 其他资源：线上优先，失败才用缓存
  e.respondWith(fetch(req).then(res=>{
    if(res.status===200){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
    }
    return res;
  }).catch(()=>caches.match(req)));
});
