// js/lib.js — makinelerin ortak yapı taşları.
//
// Birimler: metre, saniye, radyan. Dünya Y-yukarı; makinenin ÖNÜ (operatör /
// HMI tarafı) yerel +Z yönüdür, zemin y=0.
//
// Makine modülü sözleşmesi (main.js bunu bekler) — her js/machines/<id>.js:
//   export function create(lib) {
//     return {
//       id, ad, kisa, proje,              // proje = portföydeki project-details anahtarı
//       altBaslik,                        // sol listede küçük satır (ör. "S7-1200 · Servo")
//       ayakIzi: [genislikX, derinlikZ],  // zemin işareti için (m)
//       ayakIziMerkez?: [x, z],           // işaret makine orijininden kaymışsa (ör. konteynerin açık dizisi)
//       kamera?: { poz:[x,y,z], hedef:[x,y,z] },   // makine yerel çerçevesinde
//       mekanizmalar: [metin...],         // hareketli parçalar
//       cikarim: [metin...],              // fotoğraf/videodan neyi nasıl çıkardım
//       group,                            // THREE.Group (kök y=0 zemin)
//       update(dt, t),                    // her kare
//       kontroller: [...],                // aşağıdaki UI tanımları
//       degerler() -> [[etiket, deger]],  // canlı değer tablosu
//       trend: Trend | null,
//       durum() -> { metin, seviye: 'calisiyor'|'uyari'|'alarm'|'bekliyor' }
//       sabitHaric?: [Object3D...] | () => [...]   // verilirse main, BUNLAR DIŞINDAKİ
//                                        // parçaları sabitle() ile birleştirir (performans).
//                                        // Hareket eden / gizlenip gösterilen / malzemesi
//                                        // değiştirilen her nesne (ya da üst grubu) listede olmalı.
//     };
//   }
// Kontrol tanımları (main.js çizer, get() ile 4 Hz senkronlar):
//   {tip:'baslik', metin}
//   {tip:'butonlar', ogeler:[{metin, tik:fn, tur:'basla'|'dur'|'acil'|''}]}
//   {tip:'basili', ogeler:[{metin, bas:fn, birak:fn}]}      // jog (basılı tut)
//   {tip:'kaydirici', metin, min, max, adim, birim, get, set}
//   {tip:'secim', metin, secenekler:[[deger, metin]...], get, set}
//   {tip:'anahtar', metin, get, set}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export { THREE };

// ------------------------------------------------------------------ sabit parça birleştirme
// Performans (görüntü birebir aynı): makinenin HİÇ hareket etmeyen parçaları malzeme
// başına tek mesh'e birleştirilir → yüzlerce çizim çağrısı birkaç düzineye iner.
// haric: hareket eden / görünürlüğü değişen / malzemesi değiştirilen nesneler (alt
// ağaçlarıyla birlikte atlanır). userData.hareketli = true olan düğümler de atlanır
// (lib.operator bunu kendiliğinden işaretler). Ekran (HMI) mesh'leri, InstancedMesh,
// çok malzemeli ve çocuklu mesh'ler, çizgi/nokta/sprite birleştirilmez.
// Küçük parçalar (yarıçap < 10 cm) gölge atmayan kovaya düşer (main.js kuralıyla aynı).
export function sabitle(kok, haric = []) {
  const atla = new Set(haric.filter(Boolean));
  kok.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(kok.matrixWorld).invert();
  const kovalar = new Map();
  const _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
  let once = 0;
  const gez = (o) => {
    // gizli düğümün alt ağacı atlanır (birleştirilirse görünür olurdu)
    if (o !== kok && (atla.has(o) || o.userData.hareketli || o.userData.ayri || !o.visible)) return;
    if (o.isMesh) once++;
    // saydam malzemeler birleştirilmez: çizim sırası nesne konumuna göre sıralanır, değişmesin
    const saydam = o.isMesh && !Array.isArray(o.material) && (o.material.transparent || o.material.transmission > 0);
    if (o.isMesh && !saydam && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.children.length === 0
        && o.geometry.attributes.position && !o.geometry.morphAttributes.position) {
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      rel.decompose(_p, _q, _s);
      const golge = o.castShadow && g.boundingSphere.radius * Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z)) >= 0.1;
      const adlar = Object.keys(g.attributes).sort().join(',');
      const anahtar = `${o.material.uuid}|${golge}|${o.receiveShadow}|${g.index ? 1 : 0}|${adlar}|${o.renderOrder}|${rel.determinant() < 0}`;
      let k = kovalar.get(anahtar);
      if (!k) kovalar.set(anahtar, (k = { mat: o.material, golge, al: o.receiveShadow, ro: o.renderOrder, list: [] }));
      k.list.push({ o, rel });
    }
    for (const c of [...o.children]) gez(c);
  };
  gez(kok);
  let birlesen = 0, yeni = 0;
  for (const k of kovalar.values()) {
    if (k.list.length < 2) continue;
    const geos = k.list.map(({ o, rel }) => { const gg = o.geometry.clone(); gg.applyMatrix4(rel); return gg; });
    let m;
    try { m = mergeGeometries(geos, false); } catch (e) { m = null; }
    geos.forEach((gg) => gg.dispose());
    if (!m) continue;
    const mesh = new THREE.Mesh(m, k.mat);
    mesh.castShadow = k.golge; mesh.receiveShadow = k.al; mesh.renderOrder = k.ro;
    mesh.name = 'sabit';
    kok.add(mesh);
    for (const { o } of k.list) o.parent?.remove(o);
    birlesen += k.list.length; yeni++;
  }
  return { once, birlesen, yeni };
}

// ------------------------------------------------------------------ matematik
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Kare hızından bağımsız üstel yaklaşma
export const damp = (cur, hedef, k, dt) => cur + (hedef - cur) * (1 - Math.exp(-k * dt));
// Sabit hızla hedefe yürüme (servo eksen gibi); hedefe varınca tam hedefi döner
export function approach(cur, hedef, adim) {
  const d = hedef - cur;
  return Math.abs(d) <= adim ? hedef : cur + Math.sign(d) * adim;
}
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const fmt = (v, n = 1) => (Number.isFinite(v) ? v.toFixed(n) : '—');

// Saniyede n kez true dönen sayaç (HMI ekranı, trend örnekleme için)
export function throttle(hz) {
  let acc = 1e9;
  return (dt) => {
    acc += dt;
    if (acc >= 1 / hz) { acc = 0; return true; }
    return false;
  };
}

// Basit ardışık adım makinesi: adimlar = [{sure, basla?, guncelle?(k 0..1, dt)}]
// Döngüsel otomatik çevrimleri okunur yazmak için.
export class Sira {
  constructor(adimlar, { dongu = true } = {}) {
    this.adimlar = adimlar; this.dongu = dongu; this.i = 0; this.t = 0; this.bitti = false;
    this.adimlar[0]?.basla?.();
  }
  get ad() { return this.adimlar[this.i]?.ad ?? ''; }
  update(dt) {
    if (this.bitti) return;
    const a = this.adimlar[this.i];
    this.t += dt;
    const k = a.sure > 0 ? Math.min(1, this.t / a.sure) : 1;
    a.guncelle?.(k, dt);
    const bitti = a.bekle ? a.bekle() : k >= 1;
    if (bitti) {
      this.i++; this.t = 0;
      if (this.i >= this.adimlar.length) {
        if (!this.dongu) { this.bitti = true; this.i = this.adimlar.length - 1; return; }
        this.i = 0;
      }
      this.adimlar[this.i].basla?.();
    }
  }
  sifirla() { this.i = 0; this.t = 0; this.bitti = false; this.adimlar[0]?.basla?.(); }
}

// ------------------------------------------------------------------ malzemeler
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + (o.r ?? '') + '|' + (o.m ?? '') + '|' + (o.key ?? '');
  if (!o.yeni && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.6, metalness: o.m ?? 0.1, ...(o.ek || {}),
  });
  if (!o.yeni) matCache.set(key, m);
  return m;
}

export const M = {
  celik: mat(0x9aa3ab, { r: 0.35, m: 0.85 }),
  krom: mat(0xe9edf0, { r: 0.1, m: 1 }),
  alu: mat(0xc5cad0, { r: 0.38, m: 0.8 }),
  paslanmaz: mat(0xb9c0c6, { r: 0.22, m: 0.95 }),
  koyu: mat(0x2b2e33, { r: 0.7, m: 0.25 }),
  siyah: mat(0x151617, { r: 0.8, m: 0.1 }),
  kaucuk: mat(0x1b1b1b, { r: 0.95, m: 0 }),
  beyaz: mat(0xe8eae6, { r: 0.55, m: 0.1 }),
  gri: mat(0x8d9399, { r: 0.6, m: 0.25 }),
  pano: mat(0xd4d7d2, { r: 0.5, m: 0.2 }),      // RAL 7035 elektrik panosu
  sari: mat(0xf2c200, { r: 0.5, m: 0.1 }),
  turuncu: mat(0xef7d00, { r: 0.5, m: 0.1 }),
  kirmizi: mat(0xc61f1c, { r: 0.42, m: 0.15 }),
  mavi: mat(0x1d5ea8, { r: 0.5, m: 0.25 }),
  yesil: mat(0x2f9e3a, { r: 0.5, m: 0.15 }),
  karton: mat(0xb88a55, { r: 0.92, m: 0 }),
  ahsap: mat(0x9c7444, { r: 0.85, m: 0 }),
  cam: new THREE.MeshStandardMaterial({
    color: 0x9fc3d6, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false,
  }),
};

// Yanıp sönen / renk değiştiren lambalar için HER SEFERİNDE yeni malzeme
export function lamba(renk, parlaklik = 0) {
  return new THREE.MeshStandardMaterial({
    color: renk, emissive: renk, emissiveIntensity: parlaklik, roughness: 0.3, metalness: 0,
  });
}

// ------------------------------------------------------------------ primitifler
const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
function bitir(mesh, parent, x, y, z) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

// Kutu: merkez (x,y,z)
export function box(w, h, d, material, x = 0, y = 0, z = 0, parent = null) {
  const g = geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  return bitir(new THREE.Mesh(g, material), parent, x, y, z);
}

// Silindir: varsayılan eksen Y. o.eksen 'x' | 'z' ile yatırılır; o.r2 = alt yarıçap
export function cyl(r, h, material, x = 0, y = 0, z = 0, parent = null, o = {}) {
  const seg = o.seg ?? 24, r2 = o.r2 ?? r;
  const g = geo(`c${r}|${r2}|${h}|${seg}|${o.acik ? 1 : 0}`,
    () => new THREE.CylinderGeometry(r, r2, h, seg, 1, !!o.acik));
  const m = bitir(new THREE.Mesh(g, material), parent, x, y, z);
  if (o.eksen === 'x') m.rotation.z = Math.PI / 2;
  else if (o.eksen === 'z') m.rotation.x = Math.PI / 2;
  return m;
}

export function sphere(r, material, x = 0, y = 0, z = 0, parent = null, seg = 20) {
  const g = geo(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)));
  return bitir(new THREE.Mesh(g, material), parent, x, y, z);
}

const _Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const toV = (p) => (p.isVector3 ? p : _a.clone().fromArray(p));

// a'dan b'ye uzanan dikdörtgen kesitli kiriş (profil, lama, kutu profil)
export function beam(a, b, w, d, material, parent = null) {
  const A = toV(a).clone(), B = toV(b).clone();
  _d.subVectors(B, A);
  const len = _d.length();
  const m = box(w, len, d, material, 0, 0, 0, parent);
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_Y, _d.normalize());
  return m;
}

// a'dan b'ye uzanan silindir (boru parçası, rot, mil)
export function rod(a, b, r, material, parent = null, seg = 16) {
  const A = toV(a).clone(), B = toV(b).clone();
  _d.subVectors(B, A);
  const len = _d.length();
  const m = cyl(r, len, material, 0, 0, 0, parent, { seg });
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_Y, _d.normalize());
  return m;
}

// Alüminyum sigma profil: kare kesitli kiriş + köşe birleşimleri yok (kabataslak)
export const profil = (a, b, s = 0.045, parent = null, material = M.alu) => beam(a, b, s, s, material, parent);

// Boru hattı: noktalar arası silindirler + dirsek küreleri
export function pipe(noktalar, r, material, parent = null) {
  const g = new THREE.Group();
  const P = noktalar.map((p) => (p.isVector3 ? p : new THREE.Vector3().fromArray(p)));
  for (let i = 0; i < P.length - 1; i++) rod(P[i], P[i + 1], r, material, g, 14);
  for (let i = 1; i < P.length - 1; i++) sphere(r * 1.05, material, P[i].x, P[i].y, P[i].z, g, 12);
  if (parent) parent.add(g);
  return g;
}

// ------------------------------------------------------------------ akış borusu
// Paslanmaz boru; akış varken içinden geçen sıvıyı gösteren parlayan şeritler
// akış yönünde kayar. Tüm akış boruları TEK dokuyu paylaşır; her hattın hızı
// ayrı olsun diye akisBorusu() kendi doku kopyasını alır.
function seritDokusu(renk) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 8, 64);
  const gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.35, renk);
  gr.addColorStop(0.55, renk);
  gr.addColorStop(0.9, 'rgba(0,0,0,1)');
  x.fillStyle = gr; x.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function akisBorusu(noktalar, r, parent = null, { renk = '#ffb020', aralik = 0.35 } = {}) {
  const tex = seritDokusu(renk);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb9c0c6, roughness: 0.25, metalness: 0.9,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0,
  });
  const g = new THREE.Group();
  const P = noktalar.map((p) => (p.isVector3 ? p : new THREE.Vector3().fromArray(p)));
  let birikim = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const len = P[i].distanceTo(P[i + 1]);
    const geom = new THREE.CylinderGeometry(r, r, len, 14, 1);
    // v koordinatını metre/aralik ölçeğine çevir + hat boyunca sürekli ofset
    const uv = geom.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, birikim / aralik + uv.getY(k) * (len / aralik));
    birikim += len;
    const m = new THREE.Mesh(geom, material);
    m.castShadow = true; m.receiveShadow = true;
    _d.subVectors(P[i + 1], P[i]);
    m.position.addVectors(P[i], P[i + 1]).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_Y, _d.normalize());
    g.add(m);
  }
  for (let i = 1; i < P.length - 1; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 12, 8), material);
    s.position.copy(P[i]); g.add(s);
  }
  if (parent) parent.add(g);
  return {
    group: g,
    // hiz: m/s (0 = akış yok). Şeritler a→b yönünde kayar.
    akis(hiz, dt) {
      material.emissiveIntensity = damp(material.emissiveIntensity, hiz > 0.001 ? 1.4 : 0, 6, dt);
      tex.offset.y -= (hiz / aralik) * dt;
    },
  };
}

// ------------------------------------------------------------------ dokular
export function canvasTex(w, h, ciz, { tekrar = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  ciz(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (tekrar) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(tekrar[0], tekrar[1]); }
  t.anisotropy = 4;
  return t;
}

// Sarı-siyah ikaz şeridi
export function ikazDokusu(tekrar = [4, 1]) {
  return canvasTex(128, 32, (x, w, h) => {
    x.fillStyle = '#f2c200'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#151515';
    for (let i = -2; i < 6; i++) {
      x.beginPath();
      x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 16 + h, 0); x.lineTo(i * 32 + h, 0);
      x.closePath(); x.fill();
    }
  }, { tekrar });
}

// Tel örgü (çit paneli) — alfa kanallı
let _orguTex = null;
export function orguDokusu() {
  if (_orguTex) return _orguTex;
  _orguTex = canvasTex(64, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#2a2d31'; x.lineWidth = 5;
    x.strokeRect(0, 0, w, h);
  }, { tekrar: [1, 1] });
  return _orguTex;
}

// Güvenlik çiti: noktalar boyunca dikme + tel örgü panel. bosluk: [i] indeksli
// kenarları boş bırakır (kapı / giriş için).
export function cit(noktalar, h = 2.0, parent = null, { bosluk = [] } = {}) {
  const g = new THREE.Group();
  const orgu = orguDokusu();
  const pm = new THREE.MeshStandardMaterial({
    map: orgu, color: 0x3a3f45, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4,
  });
  const P = noktalar.map((p) => new THREE.Vector3(p[0], 0, p[1]));
  for (let i = 0; i < P.length - 1; i++) {
    if (bosluk.includes(i)) continue;
    const a = P[i], b = P[i + 1];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.ceil(len / 2));
    for (let k = 0; k < n; k++) {
      const p0 = a.clone().lerp(b, k / n), p1 = a.clone().lerp(b, (k + 1) / n);
      const pw = p0.distanceTo(p1);
      const geom = new THREE.PlaneGeometry(pw - 0.06, h - 0.25);
      const uv = geom.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * pw / 0.05, uv.getY(j) * (h - 0.25) / 0.05);
      const pnl = new THREE.Mesh(geom, pm);
      pnl.position.set((p0.x + p1.x) / 2, h / 2 + 0.08, (p0.z + p1.z) / 2);
      pnl.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
      pnl.castShadow = true;
      g.add(pnl);
      // çerçeve
      beam([p0.x, h - 0.04, p0.z], [p1.x, h - 0.04, p1.z], 0.03, 0.03, M.sari, g);
      beam([p0.x, 0.08, p0.z], [p1.x, 0.08, p1.z], 0.03, 0.03, M.sari, g);
    }
  }
  // dikmeler
  P.forEach((p, i) => {
    const kenarVar = !bosluk.includes(i) || !bosluk.includes(i - 1);
    if (kenarVar) box(0.05, h, 0.05, M.sari, p.x, h / 2, p.z, g);
  });
  // ara dikmeler
  for (let i = 0; i < P.length - 1; i++) {
    if (bosluk.includes(i)) continue;
    const a = P[i], b = P[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
    for (let k = 1; k < n; k++) {
      const p = a.clone().lerp(b, k / n);
      box(0.05, h, 0.05, M.sari, p.x, h / 2, p.z, g);
    }
  }
  if (parent) parent.add(g);
  return g;
}

// ------------------------------------------------------------------ yazı / etiket
export function yaziDokusu(satirlar, { w = 512, h = 128, bg = '#10151c', fg = '#e6edf3', font = 44, hiza = 'center', kenar = null } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (kenar) { x.strokeStyle = kenar; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); }
    x.fillStyle = fg; x.textBaseline = 'middle'; x.textAlign = hiza;
    const L = Array.isArray(satirlar) ? satirlar : [satirlar];
    L.forEach((s, i) => {
      const f = i === 0 ? font : font * 0.62;
      x.font = `${i === 0 ? 700 : 500} ${f}px "Space Grotesk", "Segoe UI", sans-serif`;
      const y = h * (i + 0.5) / L.length;
      x.fillText(s, hiza === 'center' ? w / 2 : 24, y);
    });
  });
}

// Düz levha üstüne yazı (tabela, makine etiketi)
export function levha(satirlar, wM, hM, o = {}) {
  const px = o.px ?? 512;
  const tex = yaziDokusu(satirlar, { w: px, h: Math.round(px * hM / wM), ...o });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  return m;
}

// ------------------------------------------------------------------ HMI ekranı
// Makine üstündeki dokunmatik panel; canvas'a çizilir, doku olarak basılır.
export class Ekran {
  constructor(wM, hM, px = 512) {
    this.W = px; this.H = Math.round(px * hM / wM);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.userData.ayri = true;   // sabitle() birleştirmesin (görünürlük filtresi kök grubu bulmalı)
  }
  // Performans: makine görüş dışında / uzaktaysa (main.js kök grubuna ekranAktif=false
  // yazar) canvas çizimi ve GPU doku yüklemesi atlanır; yaklaşınca bir sonraki tikte çizilir.
  ciz(fn) {
    if (!this._kok) { let k = this.mesh; while (k && !k.userData.makine) k = k.parent; if (k) this._kok = k; }
    if (this._kok && this._kok.userData.ekranAktif === false && this._cizildi) return;
    this._cizildi = true;
    fn(this.ctx, this.W, this.H); this.tex.needsUpdate = true;
  }
  // Standart HMI görünümü: başlık, satırlar, durum çubuğu
  standart(baslik, satirlar, durum = null) {
    this.ciz((x, W, H) => hmiCiz(x, W, H, baslik, satirlar, durum));
  }
}

const SEVIYE_RENK = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' };
export function hmiCiz(x, W, H, baslik, satirlar, durum) {
  x.fillStyle = '#e9eef2'; x.fillRect(0, 0, W, H);
  const hb = Math.round(H * 0.16);
  x.fillStyle = '#163a5c'; x.fillRect(0, 0, W, hb);
  x.fillStyle = '#fff'; x.font = `700 ${Math.round(hb * 0.52)}px "Space Grotesk", sans-serif`;
  x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(baslik, W * 0.04, hb / 2);
  const alt = durum ? Math.round(H * 0.14) : 0;
  const n = Math.max(1, satirlar.length);
  const rh = (H - hb - alt) / n;
  satirlar.forEach(([k, v], i) => {
    const y = hb + rh * (i + 0.5);
    if (i % 2) { x.fillStyle = '#dde4ea'; x.fillRect(0, hb + rh * i, W, rh); }
    x.fillStyle = '#33414e'; x.font = `500 ${Math.round(rh * 0.42)}px "Space Grotesk", sans-serif`;
    x.textAlign = 'left'; x.fillText(k, W * 0.05, y);
    x.fillStyle = '#0b2540'; x.font = `700 ${Math.round(rh * 0.46)}px "JetBrains Mono", monospace`;
    x.textAlign = 'right'; x.fillText(String(v), W * 0.95, y);
  });
  if (durum) {
    x.fillStyle = SEVIYE_RENK[durum.seviye] || '#6e7681';
    x.fillRect(0, H - alt, W, alt);
    x.fillStyle = '#fff'; x.font = `700 ${Math.round(alt * 0.5)}px "Space Grotesk", sans-serif`;
    x.textAlign = 'center'; x.fillText(durum.metin, W / 2, H - alt / 2);
  }
}

// ------------------------------------------------------------------ trend
// Sağ paneldeki grafik bunu çizer. min/max verilmezse otomatik ölçek.
export class Trend {
  constructor(seriler, { uzunluk = 300, min = null, max = null, periyot = 0.1, birim = '' } = {}) {
    this.seriler = seriler;          // [{ad, renk}]
    this.veri = seriler.map(() => []);
    this.uzunluk = uzunluk; this.min = min; this.max = max; this.birim = birim;
    this._z = throttle(1 / periyot);
  }
  ornekle(dt, degerler) {
    if (!this._z(dt)) return;
    degerler.forEach((v, i) => {
      const d = this.veri[i];
      d.push(v);
      if (d.length > this.uzunluk) d.shift();
    });
  }
  temizle() { this.veri.forEach((d) => (d.length = 0)); }
}

// ------------------------------------------------------------------ PID
export class PID {
  constructor(kp, ki, kd = 0, min = 0, max = 1) {
    Object.assign(this, { kp, ki, kd, min, max });
    this.i = 0; this.onceki = null;
  }
  update(sp, pv, dt) {
    const e = sp - pv;
    this.i = clamp(this.i + this.ki * e * dt, this.min, this.max);  // anti-windup
    const d = this.onceki == null || dt <= 0 ? 0 : (pv - this.onceki) / dt;
    this.onceki = pv;
    return clamp(this.kp * e + this.i - this.kd * d, this.min, this.max);
  }
  sifirla() { this.i = 0; this.onceki = null; }
}

// Basit gürültü (ölçüm titreşimi)
export const gurultu = (a) => (Math.random() * 2 - 1) * a;

// ------------------------------------------------------------------ saha donanımı
// Kule lambası (kırmızı/sarı/yeşil). set('calisiyor'|'uyari'|'alarm'|'bekliyor', t)
export function kuleLambasi(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(0.012, 0.25, M.koyu, 0, 0.125, 0, g, { seg: 10 });
  const renkler = [0x2ea043, 0xf2a900, 0xe5302a];
  const lambalar = renkler.map((r, i) => {
    const m = lamba(r, 0);
    cyl(0.035, 0.07, m, 0, 0.29 + i * 0.075, 0, g, { seg: 16 });
    return m;
  });
  cyl(0.036, 0.02, M.koyu, 0, 0.255 + 3 * 0.075, 0, g, { seg: 16 });
  parent.add(g);
  return {
    group: g,
    set(seviye, t = 0) {
      const yan = (i, v) => { lambalar[i].emissiveIntensity = v; };
      yan(0, seviye === 'calisiyor' ? 2.2 : 0.04);
      yan(1, seviye === 'uyari' || seviye === 'bekliyor' ? (seviye === 'uyari' ? 2.2 : 0.6) : 0.04);
      yan(2, seviye === 'alarm' ? (Math.sin(t * 9) > 0 ? 2.6 : 0.1) : 0.04);
    },
  };
}

// Acil stop butonu (sarı kutu + kırmızı mantar)
export function acilStop(parent, x, y, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  box(0.09, 0.09, 0.07, M.sari, 0, 0, 0, g);
  cyl(0.03, 0.03, M.kirmizi, 0, 0, 0.05, g, { eksen: 'z', seg: 18 });
  parent.add(g);
  return g;
}

// Kablo zinciri (enerji zinciri): yerel X boyunca yatar, kıvrım yerel +Y'ye.
// Alt kol sabit uçtan (xf, y=0) kıvrıma, üst kol kıvrımdan hareketli uca (xm, y=2R).
// Hareketli uç Δ kayınca kıvrım Δ/2 kayar (gerçek zincir kinematiği).
// s >= strok/2 olmalı; d = kıvrımın hangi yönde olduğu (+1 / -1).
export function kabloZinciri({ adet = 44, R = 0.07, s = 0.6, d = 1, link = [0.045, 0.032, 0.075], material = M.siyah } = {}) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(link[0], link[1], link[2]), material, adet);
  im.castShadow = true; im.receiveShadow = true;
  im.frustumCulled = false;
  const g = new THREE.Group();
  g.add(im);
  const L = 2 * s + Math.PI * R;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const Z = new THREE.Vector3(0, 0, 1);
  return {
    group: g,
    guncelle(xf, xm) {
      const xb = (xf + xm) / 2 + d * s;
      const l1 = Math.abs(xb - xf);
      for (let i = 0; i < adet; i++) {
        const u = ((i + 0.5) / adet) * L;
        let ang;
        if (u < l1) { p.set(xf + d * u, 0, 0); ang = 0; }
        else if (u < l1 + Math.PI * R) {
          const a = (u - l1) / R;
          p.set(xb + d * R * Math.sin(a), R - R * Math.cos(a), 0); ang = d * a;
        } else { const v = u - l1 - Math.PI * R; p.set(xb - d * v, 2 * R, 0); ang = d * Math.PI; }
        q.setFromAxisAngle(Z, ang);
        im.setMatrixAt(i, m4.compose(p, q, sc));
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// Zemine çizilen iz (hedefin / torcun geçtiği yol): son n nokta
export function iz(n = 600, renk = 0x39c5cf, parent = null) {
  const pos = new Float32Array(n * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setDrawRange(0, 0);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: renk, transparent: true, opacity: 0.85 }));
  line.frustumCulled = false;
  if (parent) parent.add(line);
  let say = 0;
  return {
    line,
    ekle(x, y, z) {
      if (say < n) say++;
      else pos.copyWithin(0, 3);
      const i = (say - 1) * 3;
      pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
      geom.attributes.position.needsUpdate = true;
      geom.setDrawRange(0, say);
    },
    temizle() { say = 0; geom.setDrawRange(0, 0); },
  };
}

// ------------------------------------------------------------------ operatör
// dokamuh.com sahnesindeki (FK-1000) operatörün ortak sürümü: lacivert gömlek, reflektif
// bantlı ikaz yeleği, sırtta DOKA logosu, baret (siperlik + sırt), açılı kollar, botlar.
// Yerel eksen: ayaklar y=0, YÜZ +Z yönüne bakar (makine kodu rotation.y ile çevirir).
// Seçenekler: yelek (renk), gomlek (renk), baret (renk), kaynakci (baret yerine kaynak
// maskesi + deri önlük), logo (false = logo yok), kumanda (sağ elde sarı telsiz kumanda).
// Dönüş: { group, elSol, elSag, kolSol, kolSag, poz(ad), yuru(t, hareketli), dur() }
//   poz: 'yan' (kollar yanda) | 'on' (önde tutuyor) | 'yukari' (yukarı uzanıyor) | 'tasi' (önde kucakta)
//   elSol / elSag: kola bağlı Object3D — taşınan parça bunlara eklenebilir.
let _logoTex = null;
function operatorLogo() {
  if (_logoTex) return _logoTex;
  _logoTex = canvasTex(512, 360, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 360);
    x.strokeStyle = '#0a1530'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 344);
    x.fillStyle = '#0a1530'; x.font = 'bold 140px "Arial Black", Arial'; x.textAlign = 'center';
    x.fillText('DOKA', 256, 200);
    x.font = 'bold 44px Arial'; x.fillStyle = '#1c3a78';
    x.fillText('MÜHENDİSLİK', 256, 260);
    x.fillStyle = '#d97757'; x.fillRect(140, 290, 232, 6);
  });
  return _logoTex;
}
const _opGeo = {};
const og = (k, f) => _opGeo[k] || (_opGeo[k] = f());
export function operator({ yelek = 0xffd400, gomlek = 0x1a3a78, baret = 0xffd400, kaynakci = false, logo = true, kumanda = false } = {}) {
  const g = new THREE.Group();
  g.userData.hareketli = true;   // sabitle() operatörü birleştirmesin
  const vestMat = mat(yelek, { r: 0.55, key: 'op-yelek', ek: { emissive: new THREE.Color(yelek).multiplyScalar(0.12) } });
  const shirtMat = mat(gomlek, { r: 0.85, key: 'op-gomlek' });
  const skin = mat(0xd9a07a, { r: 0.9, key: 'op-ten' });
  const dark = mat(0x222328, { r: 0.85, key: 'op-pantolon' });
  const bootMat = mat(0x111114, { r: 0.9, key: 'op-bot' });
  const refMat = mat(0xe8e8e8, { r: 0.4, key: 'op-ref', ek: { emissive: 0x888888, emissiveIntensity: 0.25 } });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };

  // gövde: gömlek + yelek (+ kaynakçıda deri önlük) + reflektif bantlar
  add(og('shirt', () => new THREE.BoxGeometry(0.46, 0.72, 0.26)), shirtMat, 0, 1.05, 0);
  if (kaynakci) {
    add(og('onluk', () => new THREE.BoxGeometry(0.5, 0.86, 0.3)), mat(0x6b4a2e, { r: 0.9, key: 'op-onluk' }), 0, 0.98, 0);
  } else {
    add(og('vest', () => new THREE.BoxGeometry(0.5, 0.62, 0.3)), vestMat, 0, 1.08, 0);
    add(og('band', () => new THREE.BoxGeometry(0.52, 0.05, 0.32)), refMat, 0, 1.2, 0);
    add(og('band', () => new THREE.BoxGeometry(0.52, 0.05, 0.32)), refMat, 0, 0.92, 0);
    if (logo) {
      const lp = add(og('logo', () => new THREE.PlaneGeometry(0.34, 0.24)),
        mat(0xffffff, { r: 0.7, key: 'op-logo', ek: { map: operatorLogo(), emissive: 0xffffff, emissiveMap: operatorLogo(), emissiveIntensity: 0.25 } }), 0, 1.1, -0.161);
      lp.rotation.y = Math.PI; lp.castShadow = false;
    }
  }
  // baş + baret (ya da kaynak maskesi)
  add(og('head', () => new THREE.SphereGeometry(0.16, 16, 16)), skin, 0, 1.55, 0);
  if (kaynakci) {
    const maske = add(og('maske', () => new THREE.BoxGeometry(0.3, 0.32, 0.12)), mat(0x1e2226, { r: 0.6, key: 'op-maske' }), 0, 1.56, 0.12);
    maske.rotation.x = -0.12;
    add(og('cam', () => new THREE.BoxGeometry(0.16, 0.06, 0.01)), mat(0x1a4d2e, { r: 0.1, m: 0.5, key: 'op-maskecam', ek: { emissive: 0x0a2a14, emissiveIntensity: 0.6 } }), 0, 1.6, 0.185);
    add(og('kafa', () => new THREE.SphereGeometry(0.175, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat(0x1e2226, { r: 0.6, key: 'op-maske' }), 0, 1.58, -0.01);
  } else {
    const hat = mat(baret, { r: 0.45, key: 'op-baret' });
    add(og('helmet', () => new THREE.SphereGeometry(0.19, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2)), hat, 0, 1.6, 0);
    add(og('brim', () => new THREE.CylinderGeometry(0.22, 0.22, 0.022, 20)), hat, 0, 1.6, 0);
    add(og('ridge', () => new THREE.BoxGeometry(0.04, 0.1, 0.4)), hat, 0, 1.65, 0);
  }
  // kollar: omuzdan dönen gruplar; el noktası kol ucunda
  const kol = (sx) => {
    const k = new THREE.Group(); k.position.set(sx * 0.3, 1.25, 0); g.add(k);
    const m = new THREE.Mesh(og('arm', () => new THREE.BoxGeometry(0.11, 0.5, 0.13)), shirtMat);
    m.position.set(0, -0.24, 0); m.castShadow = true; k.add(m);
    const el = new THREE.Mesh(og('hand', () => new THREE.BoxGeometry(0.09, 0.09, 0.1)), skin);
    el.position.set(0, -0.52, 0); k.add(el);
    const uc = new THREE.Object3D(); uc.position.set(0, -0.55, 0.02); k.add(uc);
    return { k, uc };
  };
  const L = kol(-1), R = kol(1);
  // bacaklar (iki ayrı bacak: yürürken salınır) + botlar
  const bacak = (sx) => {
    const b = new THREE.Group(); b.position.set(sx * 0.105, 0.72, 0); g.add(b);
    const m = new THREE.Mesh(og('leg', () => new THREE.BoxGeometry(0.2, 0.72, 0.24)), dark);
    m.position.y = -0.36; m.castShadow = true; b.add(m);
    const bot = new THREE.Mesh(og('boot', () => new THREE.BoxGeometry(0.21, 0.08, 0.3)), bootMat);
    bot.position.set(0, -0.68, 0.03); b.add(bot);
    return b;
  };
  const bL = bacak(-1), bR = bacak(1);
  // sağ elde sarı vinç tipi telsiz kumanda (FK-1000 operatöründeki gibi)
  if (kumanda) {
    const r = new THREE.Group();
    box(0.32, 0.07, 0.12, mat(0xffd400, { r: 0.45, key: 'op-kumanda' }), 0, 0.035, 0, r);
    box(0.32, 0.04, 0.13, M.siyah, 0, -0.015, 0, r);
    for (const [x, z, c] of [[-0.115, 0.025, 0x2bbf6a], [-0.115, -0.025, 0xd9322a], [-0.045, 0.025, 0x18191c], [-0.045, -0.025, 0x18191c], [0.035, 0.025, 0x18191c], [0.035, -0.025, 0x18191c], [0.11, 0.025, 0x18191c], [0.11, -0.025, 0x18191c]]) {
      box(0.028, 0.018, 0.03, mat(c, { r: 0.6, key: 'op-btn' + c }), x, 0.078, z, r);
    }
    cyl(0.022, 0.1, M.siyah, -0.21, 0.04, 0, r, { eksen: 'x', seg: 12 });
    // kolun 'on' pozundaki öne eğimini (-0.55) telafi et: kumanda yatay, anten öne
    r.rotation.set(0.35, Math.PI / 2, 0);
    r.position.set(-0.04, 0.0, 0.08);
    R.uc.add(r);
  }
  const POZ = { yan: [0.08, 0.08], on: [-0.55, -0.55], yukari: [-2.4, -2.4], tasi: [-1.1, -1.1], sag: [0.08, -0.9] };
  let hedef = POZ.on;
  L.k.rotation.x = hedef[0]; R.k.rotation.x = hedef[1];
  return {
    group: g, elSol: L.uc, elSag: R.uc, kolSol: L.k, kolSag: R.k,
    poz(ad) { hedef = POZ[ad] || POZ.on; L.k.rotation.x = hedef[0]; R.k.rotation.x = hedef[1]; },
    // her kare çağrılır: hareketliyken bacak/kol salınımı + hafif zıplama, değilse durur
    yuru(t, hareketli) {
      const s = hareketli ? Math.sin(t * 8.4) : 0;
      bL.rotation.x = s * 0.45; bR.rotation.x = -s * 0.45;
      L.k.rotation.x = hedef[0] + (hedef === POZ.yan ? -s * 0.35 : 0);
      R.k.rotation.x = hedef[1] + (hedef === POZ.yan ? s * 0.35 : 0);
      return hareketli ? Math.abs(Math.sin(t * 8.4)) * 0.03 : 0;   // gövde zıplaması (y ofseti)
    },
  };
}

// Elektrik panosu (+ isteğe bağlı HMI ekranı ön yüzde)
export function pano(parent, x, y, z, w = 0.8, h = 1.2, d = 0.3, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  box(w, h, d, M.pano, 0, h / 2, 0, g);
  box(w * 0.96, h * 0.96, 0.01, mat(0xc9ccc7, { r: 0.45, m: 0.2 }), 0, h / 2, d / 2 + 0.005, g);
  box(0.02, 0.12, 0.02, M.koyu, w * 0.4, h / 2, d / 2 + 0.02, g); // kol
  parent.add(g);
  return g;
}
