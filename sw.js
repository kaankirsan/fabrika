// sw.js — Sanal Fabrika çevrimdışı önbelleği: Quest uygulaması internetsiz de açılsın.
//
// Yalnız uygulamada kaydolur (index.html, ?uygulama=1). Strateji "önce ağ, olmazsa önbellek":
//  - İnternet varken her istek ağdan gelir (en güncel sürüm) ve önbelleğe yazılır.
//  - İnternet yoksa (ya da ağ ZAMAN_ASIMI içinde yanıt vermezse) son kaydedilen sürüm açılır.
// SW ilk kurulduğunda sayfanın o ana dek indirdiği dosyalar ondan geçmemiştir; fabrika yüklenince
// main.js kullandığı bütün dosyaların listesini gönderir ('onbellege-al'), SW eksikleri kaydeder.
// Böylece internetli İLK açılıştan sonra uygulama tamamen internetsiz çalışır. Dosya listesi elle
// tutulmaz: yeni makine / dosya eklenince kendiliğinden önbelleğe girer.
// Strateji değişirse ONBELLEK adını artırın (eskiler activate'te silinir).

const ONBELLEK = 'fabrika-v1';
const ZAMAN_ASIMI = 4000;   // ms: Wi-Fi bağlı ama internet yoksa beklemeden önbelleğe dön
const KOK = new URL('./', self.location).pathname;   // /fabrika/

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad.startsWith('fabrika-') && ad !== ONBELLEK) await caches.delete(ad);
    await self.clients.claim();
  })());
});

const kapsamda = (url) => url.origin === self.location.origin && url.pathname.startsWith(KOK);

function zamanli(soz, ms) {
  return new Promise((coz, red) => {
    const t = setTimeout(() => red(new Error('zaman aşımı')), ms);
    soz.then((v) => { clearTimeout(t); coz(v); }, (e) => { clearTimeout(t); red(e); });
  });
}

async function onceAg(istek) {
  const c = await caches.open(ONBELLEK);
  try {
    const yanit = await zamanli(fetch(istek), ZAMAN_ASIMI);
    if (yanit.ok && yanit.type === 'basic') c.put(istek, yanit.clone()).catch(() => {});
    return yanit;
  } catch (hata) {
    const k = (await c.match(istek, { ignoreVary: true }))
      || (await c.match(istek, { ignoreVary: true, ignoreSearch: true }));
    if (k) return k;
    throw hata;
  }
}

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET' || istek.headers.has('range')) return;
  const url = new URL(istek.url);
  if (!kapsamda(url)) return;   // ziyaret sayacı vb. dış istekler tarayıcıya kalır (internetsiz sessizce düşer)
  e.respondWith(onceAg(istek));
});

// Sayfanın kullandığı dosyalar: önbellekte olmayanlar indirilir (çoğu tarayıcının HTTP önbelleğinden gelir)
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.tip !== 'onbellege-al' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(ONBELLEK);
    let yeni = 0;
    for (const u of new Set(d.urls)) {
      let url;
      try { url = new URL(u, self.location); } catch { continue; }
      if (!kapsamda(url)) continue;
      if (await c.match(url.href, { ignoreVary: true })) continue;
      try {
        const y = await fetch(url.href, { cache: 'force-cache' });
        if (y.ok && y.type === 'basic') { await c.put(url.href, y); yeni++; }
      } catch { /* internet yok: sonraki açılışta */ }
    }
    const istemci = e.source;
    istemci?.postMessage?.({ tip: 'onbellek-hazir', yeni, toplam: (await c.keys()).length });
  })());
});
