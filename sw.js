// 版本号要和 index.html 页尾的「版本」同步；改了页面就一起改这里，旧缓存才会被清掉。
const CACHE='zhuyin-v0046';
const CORE=['./','./index.html','./DF.png','./manifest.webmanifest'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// 缓存里存的是完整档案；浏览器播放音频会带 Range，要自己切出 206 回应（Safari 尤其需要）
function rangeResponse(req,res){
  const h=req.headers.get('range');
  if(!h) return Promise.resolve(res);
  return res.arrayBuffer().then(buf=>{
    const total=buf.byteLength;
    const m=/bytes=(\d*)-(\d*)/.exec(h)||[];
    let start=m[1]?parseInt(m[1],10):0;
    let end=m[2]?parseInt(m[2],10):total-1;
    if(!m[1] && m[2]){ start=Math.max(0,total-parseInt(m[2],10)); end=total-1; }
    end=Math.min(end,total-1);
    if(start>end) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
    return new Response(buf.slice(start,end+1),{
      status:206,statusText:'Partial Content',
      headers:{
        'Content-Type':res.headers.get('Content-Type')||'audio/mpeg',
        'Content-Range':'bytes '+start+'-'+end+'/'+total,
        'Content-Length':String(end-start+1)
      }
    });
  });
}

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

  // 音频：缓存优先（网址带 ?v=AUDIO_VER，换录音时改版本号即可更新），离线也能发音
  if(url.pathname.endsWith('.mp3')){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const key=url.href;
      const hit=await cache.match(key);
      if(hit) return rangeResponse(req,hit);
      const res=await fetch(req);
      if(res.status===200){
        e.waitUntil(cache.put(key,res.clone()).catch(()=>{}));
      }else if(res.status===206){
        // 播放器通常只拿片段；另外悄悄抓一份完整档存起来
        e.waitUntil(fetch(key).then(r=>r.status===200?cache.put(key,r):null).catch(()=>{}));
      }
      return res;
    })());
    return;
  }

  // 其他资源：线上优先，失败才用缓存
  e.respondWith(fetch(req).then(res=>{
    if(res.status===200){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
    }
    return res;
  }).catch(()=>caches.match(req)));
});
