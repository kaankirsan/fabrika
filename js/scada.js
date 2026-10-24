// js/scada.js — SCADA ekranları.
//   • Fabrika video duvarı (A holü arka duvarı): üstte SANAL FABRİKA başlığı + saat şeridi,
//     altında 4 karo: yerleşim haritası · tesis özeti + güç trendi · makine durum listesi ·
//     alarm / olay günlüğü.
//   • Her makinenin arkasında ayaklı makine ekranı: durum + süre, canlı değer karoları,
//     makinenin trendi, olay günlüğü, son 3 dk durum çizelgesi, üretim sayacı ve güç.
//
// Veri makine sözleşmesinden okunur (durum(), degerler(), trend, ayakIzi / ayakIziMerkez).
// Yerleşim çalışma anında hesaplanır: makine kökleri taşınırsa ya da `binalar`a yeni hol
// eklenirse harita kendiliğinden uyar. Güç değerleri makinenin kendi "güç ... kW" değeri
// yoksa nominal güç × durum katsayısından türetilir (temsili).
//
// Performans: makine ekranı yalnız kök grubunda ekranAktif !== false iken (main.js: yakın ve
// görüşte; VR'da yakın) ~2 Hz çizilir; kare başına en çok 2 makine ekranı + 1 duvar karosu
// çizilir, doku yüklemeleri karelere yayılır. Duvar görüş dışındaysa hiç çizilmez,
// uzaktayken seyrekleşir. Ayak + kasa parçaları ekran başına tek mesh'e birleştirilir.

import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const SEV = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' };
const SEV_AD = { calisiyor: 'ÇALIŞIYOR', uyari: 'UYARI', alarm: 'ALARM', bekliyor: 'BEKLİYOR' };
const OLAY_AD = { calisiyor: 'BİLGİ', uyari: 'UYARI', alarm: 'ALARM', bekliyor: 'DURUM' };
const SIRA = ['calisiyor', 'uyari', 'alarm', 'bekliyor'];
const R = {
  bg: '#0b1117', panel: '#121a22', panel2: '#17212b', cizgi: '#26323f', metin: '#dfe6ec',
  soluk: '#8b97a3', vurgu: '#39c5cf', sari: '#f2c200', baslik: '#0f2a45',
};
const F = (agirlik, px, mono = false) =>
  `${agirlik} ${px}px ${mono ? '"JetBrains Mono", ui-monospace, monospace' : '"Space Grotesk", "Segoe UI", sans-serif'}`;

// Çalışırken yaklaşık çekilen güç (kW); listede olmayan makine 7.5 kW sayılır
const NOMINAL = {
  kaynak: 18, konveyor: 6, pres: 32, vagon: 22, konteyner: 1.5, hedef: 4, jetyakit: 7.5, fikstur: 11,
  solarbot: 0.8, fk1000: 1.2, bigbag: 15, saft: 5.5, yangin: 30, sacpres: 22, sasi: 9, taslama: 7.5,
  disacma: 3, yikama: 4, pompatest: 5,
};
const DURUM_KAT = { calisiyor: 0.75, uyari: 0.5, alarm: 0.04, bekliyor: 0.12 };

// Üretim sayacı: makinenin değer tablosunda adet / üretim satırı aranır
const SAYAC_RE = /(üretim|adet|paketlenen|pişen|işlenen|yıkanan|test sayısı|tamamlanan|ok \/ nok|temizlenen leke)/i;
function sayac(deg) {
  for (const [k, v] of deg) {
    if (!SAYAC_RE.test(k)) continue;
    const s = String(v);
    if (/%|kw/i.test(s)) continue;
    const n = (s.match(/\d+/g) || []).map(Number);
    if (!n.length) continue;
    return /\//.test(k) ? n.slice(0, 2).reduce((a, b) => a + b, 0) : n[0];
  }
  for (const [, v] of deg) { const m = /yüklenen (\d+)/i.exec(String(v)); if (m) return +m[1]; }
  return null;
}

const iki = (n) => String(n).padStart(2, '0');
const saatYazi = (ms = Date.now()) => { const d = new Date(ms); return `${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`; };
const sureYazi = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600); return h ? `${h}:${iki(Math.floor(s / 60) % 60)}:${iki(s % 60)}` : `${iki(Math.floor(s / 60))}:${iki(s % 60)}`; };
const sayiYazi = (n) => (n == null ? '—' : Math.round(n).toLocaleString('tr-TR'));
const kisaDeger = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

// ------------------------------------------------------------------ canvas yardımcıları
function sigdir(x, s, maxW) {
  s = String(s);
  if (x.measureText(s).width <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (x.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + '…';
}
function yaz(x, s, X, Y, maxW, font, renk, hiza = 'left') {
  x.font = font; x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
  x.fillText(sigdir(x, s, maxW), X, Y);
}
// Önce yazı tipini küçült, yine sığmazsa kırp
function yazSigdir(x, s, X, Y, maxW, px, minPx, agirlik, mono, renk, hiza = 'left') {
  s = String(s);
  let p = px; x.font = F(agirlik, p, mono);
  while (p > minPx && x.measureText(s).width > maxW) { p -= 1; x.font = F(agirlik, p, mono); }
  x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
  x.fillText(sigdir(x, s, maxW), X, Y);
}
function kutu(x, X, Y, W, H, r, dolgu, cizgi, lw = 1.5) {
  x.beginPath(); x.roundRect(X, Y, W, H, r);
  if (dolgu) { x.fillStyle = dolgu; x.fill(); }
  if (cizgi) { x.strokeStyle = cizgi; x.lineWidth = lw; x.stroke(); }
}
function lambaCiz(x, X, Y, r, renk) {
  x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fillStyle = renk; x.fill();
  x.beginPath(); x.arc(X - r * 0.3, Y - r * 0.3, r * 0.35, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
}
// Seriler: [{ad, renk, veri, min?, max?}] — her seri kendi ölçeğinde (ayrı eksen) ya da ortak
function grafik(x, X, Y, W, H, seriler, { ortak = true, min = null, max = null, px = 14, uzunluk = 300 } = {}) {
  kutu(x, X, Y, W, H, 6, R.panel, R.cizgi);
  const pt = px + 16, pb = 8, pl = 10, pr = 10;
  const gx = X + pl, gy = Y + pt, gw = W - pl - pr, gh = H - pt - pb;
  x.strokeStyle = '#1d2833'; x.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = gy + gh * i / 4; x.beginPath(); x.moveTo(gx, y); x.lineTo(gx + gw, y); x.stroke(); }
  const olcek = (veri) => {
    let lo = min, hi = max;
    if (lo == null || hi == null) {
      let a = Infinity, b = -Infinity;
      (ortak ? seriler.map((s) => s.veri) : [veri]).forEach((d) => d.forEach((v) => { if (v < a) a = v; if (v > b) b = v; }));
      if (!Number.isFinite(a)) { a = 0; b = 1; }
      const pay = Math.max((b - a) * 0.12, 1e-6);
      lo = lo ?? a - pay; hi = hi ?? b + pay;
    }
    return [lo, hi];
  };
  seriler.forEach((s) => {
    const d = s.veri;
    if (!d || d.length < 2) return;
    const [lo, hi] = s.min != null ? [s.min, s.max] : olcek(d);
    x.strokeStyle = s.renk; x.lineWidth = px > 16 ? 3 : 2; x.setLineDash(s.kesik ? [6, 5] : []);
    x.beginPath();
    const n = Math.max(uzunluk, d.length);
    d.forEach((v, k) => {
      const px2 = gx + gw * (k + n - d.length) / (n - 1);
      const py = gy + gh * (1 - (v - lo) / (hi - lo || 1));
      k ? x.lineTo(px2, Math.max(gy, Math.min(gy + gh, py))) : x.moveTo(px2, py);
    });
    x.stroke();
  });
  x.setLineDash([]);
  // lejant: renk + ad + son değer
  let lx = X + pl;
  x.font = F(600, px); x.textBaseline = 'middle'; x.textAlign = 'left';
  for (const s of seriler) {
    const son = s.veri?.at(-1);
    const t = `${s.ad} ${son != null ? kisaDeger(son) : ''}`;
    const tw = x.measureText(t).width;
    if (lx + tw + 18 > X + W - pr) break;
    x.fillStyle = s.renk; x.fillRect(lx, Y + 6 + px / 2, 12, 4);
    x.fillStyle = '#c9d3dc'; x.fillText(t, lx + 16, Y + 8 + px / 2);
    lx += tw + 34;
  }
}

// ==================================================================
export function scadaKur({ THREE, lib, scene, camera, makineler, binalar = [], duvar = { x: -31, z: -22, ry: 0 } }) {
  const kasaMat = lib.M.koyu, duvarKasaMat = lib.M.siyah;
  const isikGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
  const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
  const simdi = () => performance.now() / 1000;
  const yanSon = () => Math.floor(performance.now() / 450) % 2 === 0;

  // ---------------------------------------------------------------- makine kayıtları
  const olaylar = [];   // tüm tesis: {ms, no, ad, metin, sev}
  const kayitlar = makineler.filter(Boolean).map((x, i) => {
    // Vardiya başından beri sayaçlar ve son 3 dk çizelgesi temsili bir geçmişle başlar
    // (çoğunlukla çalışma, arada kısa beklemeler); sonrası gerçek durumdan dolar.
    const toplam = 1800 + Math.random() * 600;
    const zc = new Array(180).fill('calisiyor');
    for (let b = 0, n = Math.floor(Math.random() * 3); b < n; b++) {
      const s = Math.floor(Math.random() * 170), L = 4 + Math.floor(Math.random() * 12);
      zc.fill(Math.random() < 0.8 ? 'bekliyor' : 'uyari', s, Math.min(180, s + L));
    }
    return {
      x, m: x.m, no: x.no ?? i + 1, sev: 'bekliyor', metin: '', anahtar: null, degisimT: simdi(),
      sonOlayT: -9, olaylar: [], zc, toplam, calis: toplam * (0.9 + Math.random() * 0.08),
      guc: 0, uretim: null, deg: [], cizAcc: 1 + i * 0.03, ekran: null, isik: null,
      w: 0.4 + Math.random() * 0.6, faz: Math.random() * 6.28,
    };
  });
  const etiket = (k) => `${iki(k.no)} ${k.m.ad}`;

  function olay(k, metin, sev) {
    const o = { ms: Date.now(), no: k.no, ad: k.m.ad, metin, sev };
    olaylar.unshift(o); if (olaylar.length > 80) olaylar.length = 80;
    k.olaylar.unshift(o); if (k.olaylar.length > 8) k.olaylar.length = 8;
  }

  // 4 Hz: durum geçişleri (sayılar değişince değil, metnin kalıbı ya da seviye değişince olay)
  function ornekle() {
    const T = simdi();
    for (const k of kayitlar) {
      let d;
      try { d = k.m.durum() || {}; } catch { d = { metin: 'DURUM OKUNAMADI', seviye: 'alarm' }; }
      const sev = SEV[d.seviye] ? d.seviye : 'bekliyor';
      const metin = String(d.metin ?? '');
      const anahtar = sev + '|' + metin.replace(/[\d.,:%]+/g, '#');
      if (anahtar !== k.anahtar) {
        // çok hızlı titreşen durumlar günlüğü boğmasın (seviye değişimi her zaman yazılır)
        if (k.anahtar == null || sev !== k.sev || T - k.sonOlayT > 1.2) { olay(k, metin, sev); k.sonOlayT = T; }
        k.anahtar = anahtar; k.degisimT = T;
      }
      k.sev = sev; k.metin = metin;
    }
  }

  // 1 Hz: değerler, güç, üretim sayacı, durum çizelgesi, tesis trendi
  const trendGuc = [], trendCalisan = [];
  let toplamGuc = 0, gesGuc = 0, kapasite = 0;
  function saniyelik() {
    const T = simdi();
    toplamGuc = 0; gesGuc = 0; kapasite = 0;
    for (const k of kayitlar) {
      let deg = [];
      try { deg = k.m.degerler() || []; } catch { /* yer tutucu / hatalı makine */ }
      k.deg = deg;
      k.uretim = sayac(deg);
      let p = null;
      for (const [e, v] of deg) {
        const s = String(v);
        const kw = /(-?[\d.]+)\s*kW(?!h)/i.exec(s);
        if (!kw) continue;
        if (/güç/i.test(e) && p == null) p = +kw[1];
        else if (/üretim/i.test(e)) gesGuc += +kw[1];
      }
      const nom = NOMINAL[k.m.id] ?? 7.5;
      if (p == null) p = nom * DURUM_KAT[k.sev] * (1 + 0.1 * Math.sin(T * k.w + k.faz) + (Math.random() - 0.5) * 0.06);
      k.guc = Math.max(0, p);
      toplamGuc += k.guc; kapasite += Math.max(nom, k.guc);
      k.zc.push(k.sev); if (k.zc.length > 180) k.zc.shift();
      k.toplam += 1; if (k.sev === 'calisiyor') k.calis += 1;
    }
    if (typeof andonMatrisleri === 'function') andonMatrisleri();
    trendGuc.push(toplamGuc); if (trendGuc.length > 300) trendGuc.shift();
    trendCalisan.push(sayim().calisiyor); if (trendCalisan.length > 300) trendCalisan.shift();
  }
  function sayim() {
    const c = { calisiyor: 0, uyari: 0, alarm: 0, bekliyor: 0 };
    for (const k of kayitlar) c[k.sev]++;
    return c;
  }
  const kullanilabilirlik = () => (kayitlar.reduce((a, k) => a + k.calis / k.toplam, 0) / Math.max(1, kayitlar.length)) * 100;
  const toplamUretim = () => kayitlar.reduce((a, k) => a + (k.uretim ?? 0), 0);

  // footprint köşeleri (dünya x,z) — harita her çizimde yeniden okur
  function koseler(k) {
    const { m, kok } = k.x;
    const [w, d] = m.ayakIzi || [6, 4];
    const [cx, cz] = m.ayakIziMerkez || [0, 0];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      _t.set(cx + a * w / 2, 0, cz + b * d / 2).applyMatrix4(kok.matrixWorld);
      return [_t.x, _t.z];
    });
  }

  // ---------------------------------------------------------------- makine ekranları
  // Box3.setFromObject gizli parçaları da sayar (gizli kamyon, kesit, yedek parça...): yalnız görünenler
  function gorunenKutu(kok) {
    const kutu = new THREE.Box3(), b = new THREE.Box3();
    kok.updateMatrixWorld(true);
    (function gez(o) {
      if (!o.visible) return;
      if (o.isMesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (o.isInstancedMesh) { o.computeBoundingBox?.(); b.copy(o.boundingBox || o.geometry.boundingBox); }
        else b.copy(o.geometry.boundingBox);
        kutu.union(b.applyMatrix4(o.matrixWorld));
      }
      o.children.forEach(gez);
    })(kok);
    return kutu;
  }
  function makineEkraniKur(k) {
    const { m, kok } = k.x;
    kok.updateMatrixWorld(true);
    const [w, d] = m.ayakIzi || [6, 4];
    const [cx, cz] = m.ayakIziMerkez || [0, 0];
    // makinenin kök çerçevesindeki kutusu (yalnız görünen parçalar; 0/π dönüşlerde birebir)
    const kb = gorunenKutu(m.group).applyMatrix4(new THREE.Matrix4().copy(kok.matrixWorld).invert());
    const zArka = Math.min(cz - d / 2, kb.min.z) - 0.5;
    const SW = w < 5.5 ? 2.4 : w < 9 ? 2.9 : 3.4, SH = SW * 9 / 16;
    const alt = Math.min(5.4, Math.max(2.7, kb.max.y + 0.3));
    const g = new THREE.Group();
    g.name = 'scada-ekran';
    g.position.set(cx, 0, zArka);
    kok.add(g);
    // iki yan direk + taban plakaları + kasa (tek malzeme → sabitle ile tek mesh).
    // Ekran çift yüzlü: arka yüz de aynı görüntüyü gösterir (öteki koridordan / genel bakıştan).
    const ay = SW / 2 + 0.115, boy = alt + SH + 0.24;
    for (const sx of [-ay, ay]) {
      lib.box(0.1, boy, 0.12, kasaMat, sx, boy / 2, -0.06, g);
      lib.box(0.34, 0.05, 0.6, kasaMat, sx, 0.025, -0.06, g);
    }
    lib.box(SW + 0.14, SH + 0.14, 0.1, kasaMat, 0, alt + SH / 2, -0.06, g);
    lib.box(SW + 0.33, 0.08, 0.12, kasaMat, 0, alt + SH + 0.24, -0.06, g);   // üst kiriş
    lib.sabitle(g);
    // ekran: ön yüz + aynı dokuyu gösteren π dönük arka yüz tek geometride (tek çizim çağrısı)
    const ekran = new lib.Ekran(SW, SH, 832);
    const on = ekran.mesh.geometry, arka = on.clone().rotateY(Math.PI).translate(0, 0, -0.12);
    ekran.mesh.geometry = mergeGeometries([on, arka]);
    on.dispose(); arka.dispose();
    ekran.mesh.position.set(0, alt + SH / 2, 0);
    g.add(ekran.mesh);
    // durum ışık çubuğu (andon): tüm makinelerinki tek InstancedMesh'te (bkz. andonlar)
    k.isikYer = { y: alt + SH + 0.13, z: -0.06, w: SW + 0.14 };
    k.ekran = ekran; k.grup = g;
    // görüş/uzaklık küresi ekranı da kapsasın (main.js ekranAktif + VR görünürlük testleri)
    if (k.x.kure) k.x.kure.union(new THREE.Box3().setFromObject(g).getBoundingSphere(new THREE.Sphere()));
  }

  function makineCiz(k) {
    const m = k.m;
    let deg = [];
    try { deg = m.degerler() || []; } catch { /* boş */ }
    const T = simdi();
    k.ekran.ciz((x, W, H) => {
      x.fillStyle = R.bg; x.fillRect(0, 0, W, H);
      // başlık
      x.fillStyle = R.baslik; x.fillRect(0, 0, W, 50);
      x.fillStyle = R.vurgu; x.fillRect(0, 50, W, 3);
      kutu(x, 12, 9, 54, 32, 6, R.sari);
      yaz(x, iki(k.no), 39, 26, 50, F(800, 22, true), '#111', 'center');
      yaz(x, m.ad.toLocaleUpperCase('tr'), 78, 26, W - 78 - 220, F(700, 23), '#fff');
      yaz(x, saatYazi(), W - 14, 26, 110, F(600, 19, true), R.metin, 'right');
      lambaCiz(x, W - 196, 26, 7, yanSon() ? '#3fb950' : '#1f5f2a');
      yaz(x, 'PLC', W - 184, 26, 50, F(700, 15), R.soluk);
      // durum satırı
      const renk = SEV[k.sev];
      kutu(x, 12, 62, 470, 40, 8, k.sev === 'alarm' && !yanSon() ? '#7d1f1c' : renk);
      yaz(x, k.metin || SEV_AD[k.sev], 247, 82, 450, F(700, 19), '#fff', 'center');
      yaz(x, 'DURUMDA', 498, 72, 150, F(600, 13), R.soluk);
      yaz(x, sureYazi(T - k.degisimT), 498, 92, 150, F(700, 18, true), R.metin);
      yaz(x, 'KULLANILABİLİRLİK', 640, 72, 180, F(600, 13), R.soluk);
      yaz(x, `%${(k.calis / k.toplam * 100).toFixed(1)}`, 640, 92, 180, F(700, 18, true), R.metin);
      // değer karoları (2 × 4)
      const n = Math.min(8, deg.length), kw2 = 231, kh = 69;
      for (let i = 0; i < n; i++) {
        const X = 12 + (i % 2) * (kw2 + 8), Y = 112 + Math.floor(i / 2) * (kh + 8);
        kutu(x, X, Y, kw2, kh, 6, R.panel, R.cizgi);
        x.fillStyle = R.vurgu; x.fillRect(X, Y + 8, 3, kh - 16);
        yaz(x, deg[i][0], X + 12, Y + 19, kw2 - 22, F(600, 14), R.soluk);
        yazSigdir(x, deg[i][1], X + 12, Y + 47, kw2 - 22, 22, 13, 700, true, '#fff');
      }
      if (!n) yaz(x, 'Değer yok', 247, 260, 300, F(500, 18), R.soluk, 'center');
      // trend
      const tr = m.trend;
      if (tr) {
        grafik(x, 494, 112, 326, 150, tr.seriler.map((s, i) => ({ ad: s.ad, renk: s.renk, veri: tr.veri[i], kesik: s.kesik })),
          { min: tr.min, max: tr.max, px: 13, uzunluk: tr.uzunluk });
      } else {
        kutu(x, 494, 112, 326, 150, 6, R.panel, R.cizgi);
        yaz(x, 'Trend yok', 657, 187, 300, F(500, 16), R.soluk, 'center');
      }
      // olaylar
      kutu(x, 494, 270, 326, 136, 6, R.panel, R.cizgi);
      yaz(x, 'OLAYLAR', 506, 285, 200, F(700, 13), R.soluk);
      k.olaylar.slice(0, 5).forEach((o, i) => {
        const Y = 307 + i * 21;
        x.fillStyle = SEV[o.sev]; x.fillRect(504, Y - 7, 4, 14);
        yaz(x, saatYazi(o.ms), 514, Y, 80, F(500, 13, true), R.soluk);
        yaz(x, o.metin, 590, Y, 222, F(600, 14), R.metin);
      });
      // son 3 dk durum çizelgesi + üretim / güç
      yaz(x, 'SON 3 DK', 12, 436, 80, F(700, 13), R.soluk);
      const bx = 84, by = 424, bw = 400, bh = 24;
      kutu(x, bx - 2, by - 2, bw + 4, bh + 4, 4, R.panel, R.cizgi);
      const zc = k.zc, sw = bw / 180;
      let i0 = 0;
      for (let i = 1; i <= zc.length; i++) {
        if (i === zc.length || zc[i] !== zc[i0]) {
          x.fillStyle = SEV[zc[i0]]; x.fillRect(bx + (180 - zc.length + i0) * sw, by, (i - i0) * sw + 0.5, bh);
          i0 = i;
        }
      }
      yaz(x, 'ÜRETİM', 498, 428, 90, F(700, 12), R.soluk);
      yaz(x, sayiYazi(k.uretim), 498, 448, 150, F(700, 19, true), '#fff');
      yaz(x, 'GÜÇ', 660, 428, 90, F(700, 12), R.soluk);
      yaz(x, `${k.guc.toFixed(1)} kW`, 660, 448, 160, F(700, 19, true), R.sari);
    });
  }

  // ---------------------------------------------------------------- fabrika video duvarı
  const DUV = (() => {
    const g = new THREE.Group();
    g.name = 'scada-duvar';
    g.position.set(duvar.x, 0, duvar.z);
    g.rotation.y = duvar.ry || 0;
    scene.add(g);
    const N = 4, TW = 4.5, TH = 3.5, ARA = 0.08, BH = 0.78, ALT = 2.1;
    const W = N * TW + (N - 1) * ARA;
    const ust = ALT + TH + ARA + BH;
    lib.box(W + 0.36, ust - ALT + 0.36, 0.34, duvarKasaMat, 0, (ALT + ust) / 2, -0.19, g);
    // durum LED şeridi (tesisin genel durumu) + iki taşıyıcı konsol
    const led = new THREE.Mesh(isikGeo, new THREE.MeshBasicMaterial({ color: SEV.calisiyor, toneMapped: false }));
    led.scale.set(W + 0.36, 1.4, 1); led.position.set(0, ALT - 0.24, -0.05);
    g.add(led);
    const bas = new lib.Ekran(W, BH, 2048);
    bas.mesh.position.set(0, ust - BH / 2, 0.005);
    g.add(bas.mesh);
    const karolar = [haritaCiz, ozetCiz, listeCiz, gunlukCiz].map((fn, i) => {
      const e = new lib.Ekran(TW, TH, 1024);
      e.mesh.position.set(-W / 2 + TW / 2 + i * (TW + ARA), ALT + TH / 2, 0.005);
      g.add(e.mesh);
      return { e, fn };
    });
    g.updateMatrixWorld(true);
    const kure = new THREE.Box3().setFromObject(g).getBoundingSphere(new THREE.Sphere());
    return { g, bas, karolar, led, kure };
  })();

  function karoBaslik(x, W, H, metin, sag) {
    x.fillStyle = R.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = R.baslik; x.fillRect(0, 0, W, 56);
    x.fillStyle = R.vurgu; x.fillRect(0, 56, W, 3);
    yaz(x, metin, 24, 29, W - 320, F(700, 28), '#fff');
    if (sag) yaz(x, sag, W - 24, 29, 300, F(600, 19, true), R.soluk, 'right');
  }

  function baslikCiz() {
    DUV.bas.ciz((x, W, H) => {
      const gr = x.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#0f2a45'); gr.addColorStop(0.5, '#123554'); gr.addColorStop(1, '#0f2a45');
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.fillStyle = R.vurgu; x.fillRect(0, H - 3, W, 3);
      // logo
      x.fillStyle = R.sari; x.fillRect(22, H * 0.2, H * 0.6, H * 0.6);
      x.fillStyle = '#0f2a45'; x.fillRect(22 + H * 0.3, H * 0.2 + 6, H * 0.3 - 6, H * 0.6 - 12);
      yaz(x, 'SANAL FABRİKA', 22 + H * 0.6 + 18, H * 0.5, 600, F(700, 46), '#fff');
      yaz(x, 'Kaan Kırşan · Otomasyon & Robotik', 22 + H * 0.6 + 400, H * 0.52, 520, F(500, 25), '#b8c7d6');
      const c = sayim();
      const ozet = `${c.calisiyor}/${kayitlar.length} ÇALIŞIYOR  ·  ${c.uyari} UYARI  ·  ${c.alarm} ALARM  ·  ${toplamGuc.toFixed(0)} kW`;
      yaz(x, ozet, 1390, H * 0.52, 700, F(600, 24, true), c.alarm ? '#ff8a80' : '#9fe3a9', 'center');
      const tarih = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
      yaz(x, saatYazi(), W - 22, H * 0.38, 220, F(700, 34, true), '#fff', 'right');
      yaz(x, tarih, W - 22, H * 0.78, 260, F(500, 17), '#b8c7d6', 'right');
    });
  }

  function haritaCiz(x, W, H) {
    karoBaslik(x, W, H, 'TESİS YERLEŞİMİ', 'CANLI · ' + saatYazi());
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const gen = (X, Z) => { x0 = Math.min(x0, X); x1 = Math.max(x1, X); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z); };
    binalar.forEach((b) => { gen(b.x0, b.z0); gen(b.x1, b.z1); });
    const kos = kayitlar.map((k) => koseler(k));
    kos.forEach((p) => p.forEach(([X, Z]) => gen(X, Z)));
    x0 -= 3; x1 += 3; z0 -= 3; z1 += 3;
    // altta hol özet kartları için yer bırak (harita en-boy oranına göre)
    const kartH = binalar.length ? 150 : 0;
    const top = 74, alt = 66 + kartH, kenar = 22;
    const s = Math.min((W - 2 * kenar) / (x1 - x0), (H - top - alt) / (z1 - z0));
    const ox = kenar + ((W - 2 * kenar) - (x1 - x0) * s) / 2 - x0 * s;
    const oz = top + ((H - top - alt) - (z1 - z0) * s) / 2 - z0 * s;
    const P = (X, Z) => [ox + X * s, oz + Z * s];
    // ızgara (10 m)
    x.strokeStyle = '#121b24'; x.lineWidth = 1;
    for (let X = Math.ceil(x0 / 10) * 10; X <= x1; X += 10) { const [a] = P(X, 0); x.beginPath(); x.moveTo(a, top); x.lineTo(a, H - alt); x.stroke(); }
    for (let Z = Math.ceil(z0 / 10) * 10; Z <= z1; Z += 10) { const [, b] = P(0, Z); x.beginPath(); x.moveTo(kenar, b); x.lineTo(W - kenar, b); x.stroke(); }
    // binalar
    binalar.forEach((b) => {
      const [a, c] = P(b.x0, b.z0), [e, f] = P(b.x1, b.z1);
      x.fillStyle = '#15202b'; x.fillRect(a, c, e - a, f - c);
      x.strokeStyle = '#46596c'; x.lineWidth = 3; x.strokeRect(a, c, e - a, f - c);
      yaz(x, b.ad, a + 10, c + 16, e - a - 20, F(700, 15), '#7d93a8');
    });
    // makineler
    const yan = yanSon();
    kayitlar.forEach((k, i) => {
      const p = kos[i].map(([X, Z]) => P(X, Z));
      x.beginPath(); p.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath();
      x.globalAlpha = k.sev === 'alarm' && !yan ? 0.35 : 0.88;
      x.fillStyle = SEV[k.sev]; x.fill();
      x.globalAlpha = 1;
      x.strokeStyle = '#0b1117'; x.lineWidth = 1.5; x.stroke();
      const mx = p.reduce((a, q) => a + q[0], 0) / 4, my = p.reduce((a, q) => a + q[1], 0) / 4;
      const bw = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
      const bh = Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
      yaz(x, iki(k.no), mx, my, bw + 20, F(800, Math.max(11, Math.min(18, bh * 0.7)), true), '#fff', 'center');
    });
    // izleyicinin konumu (kamera)
    camera.getWorldPosition(_v); camera.getWorldDirection(_d);
    const [cxp, czp] = P(_v.x, _v.z);
    if (cxp > kenar && cxp < W - kenar && czp > top && czp < H - alt) {
      const a = Math.atan2(_d.z, _d.x);
      x.beginPath(); x.moveTo(cxp, czp); x.arc(cxp, czp, 34, a - 0.45, a + 0.45); x.closePath();
      x.fillStyle = 'rgba(57,197,207,.28)'; x.fill();
      lambaCiz(x, cxp, czp, 7, R.vurgu);
      yaz(x, 'SİZ', cxp + 12, czp - 14, 60, F(700, 14), R.vurgu);
    }
    // hol özet kartları: makine sayısı, çalışan, güç, üretim (makine merkezi hangi holdeyse)
    if (kartH) {
      const hol = binalar.map((b) => ({ b, n: 0, cal: 0, kw: 0, ur: 0, al: 0 }));
      const dis = { b: { ad: 'DIŞ SAHA' }, n: 0, cal: 0, kw: 0, ur: 0, al: 0 };
      kayitlar.forEach((k, i) => {
        const mx = kos[i].reduce((a, q) => a + q[0], 0) / 4, mz = kos[i].reduce((a, q) => a + q[1], 0) / 4;
        const h = hol.find(({ b }) => mx >= b.x0 && mx <= b.x1 && mz >= b.z0 && mz <= b.z1) || dis;
        h.n++; h.kw += k.guc; h.ur += k.uretim ?? 0;
        if (k.sev === 'calisiyor') h.cal++; if (k.sev === 'alarm' || k.sev === 'uyari') h.al++;
      });
      const kartlar = dis.n ? [...hol, dis] : hol;
      const kw2 = (W - 2 * kenar - (kartlar.length - 1) * 14) / kartlar.length, ky = H - 66 - kartH + 8;
      kartlar.forEach((h, i) => {
        const X = kenar + i * (kw2 + 14);
        kutu(x, X, ky, kw2, kartH - 22, 10, R.panel, R.cizgi);
        x.fillStyle = h.al ? SEV.uyari : SEV.calisiyor; x.fillRect(X + 1, ky + 1, 6, kartH - 24);
        yaz(x, h.b.ad, X + 22, ky + 24, kw2 - 40, F(700, 20), '#fff');
        yaz(x, `${h.n} makine`, X + kw2 - 16, ky + 24, 140, F(600, 16), R.soluk, 'right');
        const sut = (kw2 - 30) / 3;
        [['ÇALIŞAN', `${h.cal}/${h.n}`, '#3fb950'], ['GÜÇ', `${h.kw.toFixed(0)} kW`, R.sari], ['ÜRETİM', sayiYazi(h.ur), '#fff']]
          .forEach(([ad, v, renk], j) => {
            const sx = X + 22 + j * sut;
            yaz(x, ad, sx, ky + 62, sut - 10, F(700, 14), R.soluk);
            yaz(x, v, sx, ky + 94, sut - 10, F(800, 30, true), renk);
          });
      });
    }
    // lejant
    const c = sayim();
    let lx = 24;
    SIRA.forEach((sv) => {
      lambaCiz(x, lx + 9, H - 33, 9, SEV[sv]);
      const t = `${SEV_AD[sv]} ${c[sv]}`;
      yaz(x, t, lx + 26, H - 33, 220, F(600, 19), R.metin);
      x.font = F(600, 19); lx += 26 + x.measureText(t).width + 30;
    });
  }

  function ozetCiz(x, W, H) {
    karoBaslik(x, W, H, 'TESİS ÖZETİ', 'VARDİYA 1 · ' + saatYazi());
    const c = sayim(), yan = yanSon();
    const kw = (W - 48 - 3 * 14) / 4;
    SIRA.forEach((sv, i) => {
      const X = 24 + i * (kw + 14);
      kutu(x, X, 74, kw, 148, 10, R.panel, R.cizgi);
      x.fillStyle = SEV[sv]; x.fillRect(X + 1, 75, kw - 2, 6);
      const renk = sv === 'alarm' && c.alarm && !yan ? '#7d1f1c' : (c[sv] ? SEV[sv] : '#4b5561');
      yaz(x, String(c[sv]), X + kw / 2, 140, kw - 10, F(800, 76, true), renk, 'center');
      yaz(x, SEV_AD[sv], X + kw / 2, 198, kw - 10, F(700, 19), R.soluk, 'center');
    });
    // ölçü kutuları
    const kutular = [
      ['TOPLAM GÜÇ', `${toplamGuc.toFixed(0)} kW`, R.sari, kapasite ? toplamGuc / kapasite : 0],
      ['KULLANILABİLİRLİK', `%${kullanilabilirlik().toFixed(1)}`, '#3fb950', kullanilabilirlik() / 100],
      ['TOPLAM ÜRETİM', `${sayiYazi(toplamUretim())} adet`, '#fff', null],
      ['GES ÜRETİMİ', `${gesGuc.toFixed(1)} kW`, R.vurgu, null],
    ];
    const mw = (W - 48 - 14) / 2, mh = 104;
    kutular.forEach(([ad, deger, renk, oran], i) => {
      const X = 24 + (i % 2) * (mw + 14), Y = 238 + Math.floor(i / 2) * (mh + 12);
      kutu(x, X, Y, mw, mh, 10, R.panel, R.cizgi);
      yaz(x, ad, X + 18, Y + 24, mw - 36, F(700, 17), R.soluk);
      yaz(x, deger, X + 18, Y + 62, mw - 36, F(800, 40, true), renk);
      if (oran != null) {
        kutu(x, X + 18, Y + mh - 16, mw - 36, 7, 3, '#0b1117');
        kutu(x, X + 18, Y + mh - 16, (mw - 36) * Math.max(0, Math.min(1, oran)), 7, 3, renk);
      }
    });
    grafik(x, 24, 478, W - 48, H - 478 - 22, [
      { ad: 'Toplam güç kW', renk: R.sari, veri: trendGuc },
      { ad: 'Çalışan makine', renk: '#3fb950', veri: trendCalisan, min: 0, max: Math.max(1, kayitlar.length) },
    ], { ortak: false, px: 18, uzunluk: 300 });
    yaz(x, 'son 5 dk', W - 36, 478 + 18, 120, F(500, 15), R.soluk, 'right');
  }

  function listeCiz(x, W, H) {
    karoBaslik(x, W, H, 'MAKİNE DURUMLARI', `${kayitlar.length} makine`);
    const cols = { no: 26, lamba: 84, ad: 104, durum: 470, kw: 868, ur: 1000 };
    const y0 = 66;
    yaz(x, 'NO', cols.no, y0 + 16, 60, F(700, 15), R.soluk);
    yaz(x, 'MAKİNE', cols.ad, y0 + 16, 300, F(700, 15), R.soluk);
    yaz(x, 'DURUM', cols.durum, y0 + 16, 300, F(700, 15), R.soluk);
    yaz(x, 'kW', cols.kw, y0 + 16, 80, F(700, 15), R.soluk, 'right');
    yaz(x, 'ÜRETİM', cols.ur, y0 + 16, 110, F(700, 15), R.soluk, 'right');
    const yb = y0 + 34, n = kayitlar.length;
    const rh = Math.min(44, (H - yb - 10) / Math.max(1, n));
    const px = Math.max(12, Math.min(22, rh * 0.52));
    const yan = yanSon();
    kayitlar.forEach((k, i) => {
      const Y = yb + i * rh;
      if (i % 2 === 0) { x.fillStyle = '#10171e'; x.fillRect(12, Y, W - 24, rh); }
      if (k.sev === 'alarm' && yan) { x.fillStyle = 'rgba(248,81,73,.22)'; x.fillRect(12, Y, W - 24, rh); }
      const ym = Y + rh / 2;
      yaz(x, iki(k.no), cols.no, ym, 50, F(700, px, true), R.sari);
      lambaCiz(x, cols.lamba, ym, Math.min(9, rh * 0.26), SEV[k.sev]);
      yaz(x, k.m.ad, cols.ad, ym, cols.durum - cols.ad - 14, F(600, px), R.metin);
      yaz(x, k.metin || SEV_AD[k.sev], cols.durum, ym, cols.kw - cols.durum - 70, F(500, px * 0.92), SEV[k.sev] === SEV.bekliyor ? R.soluk : '#c9d3dc');
      yaz(x, k.guc.toFixed(1), cols.kw, ym, 80, F(600, px * 0.92, true), R.sari, 'right');
      yaz(x, sayiYazi(k.uretim), cols.ur, ym, 110, F(600, px * 0.92, true), '#fff', 'right');
    });
  }

  function gunlukCiz(x, W, H) {
    karoBaslik(x, W, H, 'ALARM / OLAY GÜNLÜĞÜ', `${olaylar.length} kayıt`);
    const aktif = kayitlar.filter((k) => k.sev === 'alarm' || k.sev === 'uyari')
      .sort((a, b) => (a.sev === 'alarm' ? 0 : 1) - (b.sev === 'alarm' ? 0 : 1));
    let Y = 72;
    if (!aktif.length) {
      kutu(x, 24, Y, W - 48, 56, 8, '#12301b', '#2ea043');
      yaz(x, '✓  AKTİF ALARM YOK — tüm hatlar normal', W / 2, Y + 28, W - 80, F(700, 22), '#7ee08e', 'center');
      Y += 70;
    } else {
      const yan = yanSon();
      aktif.slice(0, 4).forEach((k) => {
        const al = k.sev === 'alarm';
        kutu(x, 24, Y, W - 48, 44, 8, al ? (yan ? '#5a1513' : '#3a0f0e') : '#3a2c0b', SEV[k.sev]);
        yaz(x, al ? 'ALARM' : 'UYARI', 40, Y + 22, 100, F(800, 18), SEV[k.sev]);
        yaz(x, `${etiket(k)} — ${k.metin}`, 140, Y + 22, W - 180 - 110, F(600, 18), '#fff');
        yaz(x, sureYazi(simdi() - k.degisimT), W - 40, Y + 22, 100, F(600, 17, true), R.metin, 'right');
        Y += 52;
      });
      if (aktif.length > 4) { yaz(x, `+${aktif.length - 4} aktif kayıt daha`, 40, Y + 6, 400, F(600, 16), R.soluk); Y += 24; }
      Y += 8;
    }
    x.fillStyle = R.cizgi; x.fillRect(24, Y, W - 48, 2);
    Y += 12;
    const rh = 33;
    const satir = Math.floor((H - Y - 10) / rh);
    olaylar.slice(0, satir).forEach((o, i) => {
      const ym = Y + i * rh + rh / 2;
      if (i % 2 === 0) { x.fillStyle = '#10171e'; x.fillRect(24, ym - rh / 2, W - 48, rh); }
      x.fillStyle = SEV[o.sev]; x.fillRect(24, ym - rh / 2 + 4, 5, rh - 8);
      yaz(x, saatYazi(o.ms), 40, ym, 110, F(500, 17, true), R.soluk);
      yaz(x, OLAY_AD[o.sev], 150, ym, 90, F(800, 15), SEV[o.sev] === SEV.bekliyor ? '#9aa5b1' : SEV[o.sev]);
      yaz(x, iki(o.no), 238, ym, 40, F(700, 17, true), R.sari);
      yaz(x, o.metin, 278, ym, W - 278 - 32, F(500, 18), R.metin);
    });
  }

  // ---------------------------------------------------------------- kurulum
  kayitlar.forEach((k) => {
    try { makineEkraniKur(k); } catch (e) { console.error(`[scada] ${k.m.id} ekranı kurulamadı`, e); }
  });
  // Andon ışık çubukları: tek InstancedMesh (renk = durum; alarmda yanıp söner). Matrisler ekran
  // grubunun dünya matrisinden saniyede bir tazelenir; makine VR'da gizlenince çubuğu da gizlenir.
  const andonlu = kayitlar.filter((k) => k.grup);
  const andon = new THREE.InstancedMesh(isikGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.max(1, andonlu.length));
  andon.name = 'scada-andon';
  andon.frustumCulled = false;
  andon.count = andonlu.length;
  andonlu.forEach((k, i) => andon.setColorAt(i, new THREE.Color(SEV.bekliyor)));
  scene.add(andon);
  const _am = new THREE.Matrix4(), _ao = new THREE.Matrix4(), _ac = new THREE.Color();
  function andonMatrisleri() {
    andonlu.forEach((k, i) => {
      const { y, z, w } = k.isikYer;
      _ao.makeScale(k.x.kok.visible ? w : 0, 1, 1).setPosition(0, y, z);
      _am.multiplyMatrices(k.grup.matrixWorld, _ao);
      andon.setMatrixAt(i, _am);
    });
    andon.instanceMatrix.needsUpdate = true;
  }
  function andonRenkleri(yan) {
    andonlu.forEach((k, i) => andon.setColorAt(i, _ac.set(k.sev === 'alarm' && !yan ? '#3a0d0c' : SEV[k.sev])));
    andon.instanceColor.needsUpdate = true;
  }
  scene.updateMatrixWorld();
  andonMatrisleri();
  ornekle();
  olaylar.unshift({ ms: Date.now(), no: 0, ad: 'SCADA', metin: 'SCADA sunucusu bağlandı · tüm PLC\'ler çevrim içi', sev: 'calisiyor' });
  saniyelik();

  // ---------------------------------------------------------------- döngü
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
  let ornekAcc = 0, sanAcc = 0, gorusAcc = 9, duvarAcc = 0, basAcc = 9, karoSira = 0, rr = 0, sira = 0;
  let duvarAktif = true, duvarUzak = false, sonYan = null;

  function duvarGorus() {
    camera.updateMatrixWorld();
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    camera.getWorldPosition(_v);
    const d = _v.distanceTo(DUV.kure.center);
    duvarAktif = d < 240 && _fr.intersectsSphere(DUV.kure);
    duvarUzak = d > 45;
  }

  function update(dt) {
    ornekAcc += dt; if (ornekAcc >= 0.25) { ornekAcc = 0; ornekle(); }
    sanAcc += dt; if (sanAcc >= 1) { sanAcc = 0; saniyelik(); }
    // andon ışıkları (alarmda yanıp söner) + duvar LED şeridi
    const yan = yanSon();
    if (yan !== sonYan || ornekAcc === 0) {
      sonYan = yan;
      let enKotu = 'calisiyor';
      for (const k of kayitlar) {
        if (k.sev === 'alarm') enKotu = 'alarm'; else if (k.sev === 'uyari' && enKotu !== 'alarm') enKotu = 'uyari';
      }
      andonRenkleri(yan);
      DUV.led.material.color.set(enKotu === 'alarm' && !yan ? '#3a0d0c' : SEV[enKotu]);
    }
    // Kare başına EN ÇOK BİR canvas çizimi + doku yüklemesi (sırayla: duvar başlığı 1 Hz,
    // duvar karosu yakında ~0.2 s / uzakta ~0.5 s'de bir, makine ekranı ~2 Hz).
    for (const k of kayitlar) k.cizAcc += dt;
    gorusAcc += dt; if (gorusAcc >= 0.25) { gorusAcc = 0; duvarGorus(); }
    if (duvarAktif) { basAcc += dt; duvarAcc += dt; }
    sira = (sira + 1) % 3;
    for (let j = 0; j < 3; j++) {
      const is = (sira + j) % 3;
      if (is === 0 && duvarAktif && basAcc >= 1) { basAcc = 0; baslikCiz(); return; }
      if (is === 1 && duvarAktif && duvarAcc >= (duvarUzak ? 0.5 : 0.2)) {
        duvarAcc = 0;
        const kr = DUV.karolar[karoSira++ % DUV.karolar.length];
        try { kr.e.ciz(kr.fn); } catch (e) { console.error('[scada] duvar', e); }
        return;
      }
      if (is === 2 && makineEkraniSirasi()) return;
    }
  }
  function makineEkraniSirasi() {
    const n = kayitlar.length;
    for (let j = 0; j < n; j++) {
      const k = kayitlar[(rr + j) % n];
      if (!k.ekran || k.cizAcc < 0.5) continue;
      const kok = k.x.kok;
      // yakın + görüşte ~2 Hz; uzakta ama görüşteyse (genel bakış) ~4 s'de bir, canlı görünsün
      const aktif = kok.visible && kok.userData.ekranAktif !== false;
      const uzakGorus = kok.visible && kok.userData.ekranGorus && k.cizAcc >= 4;
      if (!aktif && !uzakGorus && k.ekran._cizildi) continue;
      k.cizAcc = 0;
      rr = (rr + j + 1) % n;
      try { makineCiz(k); } catch (e) { console.error(`[scada] ${k.m.id} çizim`, e); k.ekran = null; }
      return true;
    }
    return false;
  }

  const api = { update, duvar: DUV, kayitlar, olaylar, _hepsiniCiz() { kayitlar.forEach((k) => k.ekran && makineCiz(k)); baslikCiz(); DUV.karolar.forEach((kr) => kr.e.ciz(kr.fn)); } };
  window.__scada = api;
  return api;
}
