// js/cevre.js — fabrika ortamı ve canlılık (A + B + C holü).
//
// Bina: çatı makasları + aşıklar + trapez sac çatı altı + ışıklık bantları + yüksek tavan LED
// armatürleri + havalandırma kanalları + ön kolonlar + ışık huzmeleri/toz. Hepsi "çatı" grubunda:
// kamera çatı seviyesinin altındayken görünür (genel bakışta tepeden görüş kapanmaz; VR'da hep açık).
// Duvar: sandviç panel deseni (duvar malzemesine gölgelendirici eki), kolon numaraları, yangın
// tüpleri, acil çıkış kapıları + ışıklı levhalar, elektrik panoları, kablo tavası, basınçlı hava hattı.
// Zemin/lojistik: palet rafları, hammadde ve sevkiyat alanları, bakım atölyesi, kalite kontrol,
// iki katlı ofis, mola köşesi, atık/geri dönüşüm, zemin bölge çizgileri ve yazıları, lastik izleri.
// Canlılık: güvercinler (tünek ↔ uçuş ↔ yerde gagalama; kamera/işçi yaklaşınca kaçar),
// holler arasında yürüyen işçi.
//
// Performans: tekrar eden her şey InstancedMesh (raf, palet, yük, tüp, armatür, makas, güvercin);
// tekil sabit parçalar hol başına lib.sabitle ile malzeme başına birleşir; VR'da uzak hol gizlenir.
// Yerleşim: makinelerin dünya kutuları + koridor + geçit + işçi rotası "dolu" sayılır; çakışan
// sahne parçası konmaz (makine yeri değişse de ortam makinenin içine girmez).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export function cevreKur({ lib, scene, camera, makineler = [], A, B, C = null, duvarMat = null }) {
  const { box, cyl, mat, M } = lib;
  const PI = Math.PI;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3();
  const YUKARI = new THREE.Vector3(0, 1, 0);
  let tohum = 20261024;
  const rnd = () => (tohum = (tohum * 16807) % 2147483647) / 2147483647;
  const ara = (a, b) => a + (b - a) * rnd();
  const secR = (d) => d[Math.floor(rnd() * d.length)];

  const kok = new THREE.Group(); kok.name = 'cevre'; scene.add(kok);
  const cati = new THREE.Group(); cati.name = 'cevre-cati'; kok.add(cati);
  const catiH = { A: new THREE.Group(), B: new THREE.Group(), C: new THREE.Group() };
  catiH.A.name = 'cevre-cati-A'; catiH.B.name = 'cevre-cati-B'; catiH.C.name = 'cevre-cati-C';
  cati.add(catiH.A, catiH.B, catiH.C);
  const parca = { A: new THREE.Group(), B: new THREE.Group(), C: new THREE.Group() };
  parca.A.name = 'cevre-A'; parca.B.name = 'cevre-B'; parca.C.name = 'cevre-C';
  kok.add(parca.A, parca.B, parca.C);
  const genel = new THREE.Group(); genel.name = 'cevre-ornek'; kok.add(genel);   // instanced, iki hol

  // ---------------------------------------------------------------- örnekleme yardımcısı
  const GB = new THREE.BoxGeometry(1, 1, 1);
  const GC = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  class Ornek {
    constructor(geo, malz, { golge = true, al = true, renkli = false } = {}) {
      Object.assign(this, { geo, malz, golge, al, renkli, L: [], C: [] });
    }
    ekle(m, renk) { this.L.push(m.clone()); if (this.renkli) this.C.push(new THREE.Color(renk ?? 0xffffff)); }
    kutu(x, y, z, w, h, d, ry = 0, renk) { _q.setFromAxisAngle(YUKARI, ry); this.ekle(_m.compose(_p.set(x, y, z), _q, _s.set(w, h, d)), renk); }
    // a→b doğrultusunda kiriş (kesit w×d; dikey düzlemdeki kirişlerde w = x yönü kalınlığı)
    kiris(a, b, w, d, renk) {
      _d.subVectors(b, a); const L = _d.length(); _q.setFromUnitVectors(YUKARI, _d.normalize());
      this.ekle(_m.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(w, L, d)), renk);
    }
    kur(parent, ad) {
      if (!this.L.length) return null;
      const im = new THREE.InstancedMesh(this.geo, this.malz, this.L.length);
      this.L.forEach((m, i) => im.setMatrixAt(i, m));
      if (this.renkli) this.C.forEach((c, i) => im.setColorAt(i, c));
      im.castShadow = this.golge; im.receiveShadow = this.al; im.name = ad || '';
      im.computeBoundingBox(); im.computeBoundingSphere();
      parent.add(im);
      return im;
    }
  }
  // Hol başına ayrı InstancedMesh (VR'da uzak holün örnekleri de gizlenebilsin): örneğin x'ine göre dağıtır
  class Cift {
    constructor(...a) { this.A = new Ornek(...a); this.B = new Ornek(...a); this.C = new Ornek(...a); }
    sec(x) { return x < B.x0 ? this.A : C && x >= C.x0 ? this.C : this.B; }
    kutu(x, ...r) { this.sec(x).kutu(x, ...r); }
    kiris(a, b, ...r) { this.sec((a.x + b.x) / 2).kiris(a, b, ...r); }
    ekle(m, renk) { _p.setFromMatrixPosition(m); this.sec(_p.x).ekle(m, renk); }
    // C holünün örnekleri, B'ye verilen grubun C karşılığına (parça / çatı) gider
    kur(gA, gB, ad) {
      this.A.kur(gA, ad + '-A'); this.B.kur(gB, ad + '-B');
      this.C.kur(gB === catiH.B ? catiH.C : gB === parca.B ? parca.C : gB, ad + '-C');
    }
  }

  // ---------------------------------------------------------------- malzemeler
  const R = { mavi: 0x1d5ea8, gri: 0x9aa3ab, acikGri: 0xb9c0c6, turuncu: 0xef7d00, sari: 0xf2c200, koyu: 0x3b4148 };
  const celikMat = mat(0xffffff, { r: 0.5, m: 0.35, key: 'cevre-celik' });           // örnek rengi ile boyanır
  const yukMat = mat(0xffffff, { r: 0.82, m: 0.02, key: 'cevre-yuk', detay: 'kaba' });
  const galvaniz = mat(0xaeb5ba, { r: 0.42, m: 0.8, key: 'cevre-galvaniz' });
  const havaMat = mat(0x2f7fc1, { r: 0.35, m: 0.55, key: 'cevre-hava' });
  const kapiMat = mat(0x3c4a52, { r: 0.55, m: 0.3, key: 'cevre-kapi' });
  const granit = mat(0x24272b, { r: 0.22, m: 0.05, key: 'cevre-granit' });
  const ekranMat = mat(0x0b1a29, { r: 0.3, m: 0.1, key: 'cevre-ekran', detay: false, ek: { emissive: 0x3f8fdc, emissiveIntensity: 1.15 } });
  const otomatMat = mat(0xfff0d8, { r: 0.4, key: 'cevre-otomat', detay: false, ek: { emissive: 0xffd9a0, emissiveIntensity: 0.95 } });
  const ledY = mat(0x2bd16a, { r: 0.3, key: 'cevre-led-y', detay: false, ek: { emissive: 0x2bd16a, emissiveIntensity: 2.4 } });
  const ledK = mat(0xe03a2a, { r: 0.3, key: 'cevre-led-k', detay: false, ek: { emissive: 0xe03a2a, emissiveIntensity: 2.4 } });
  const suMat = mat(0x6fb3e0, { r: 0.15, m: 0.05, key: 'cevre-su' });
  const bitkiMat = mat(0x3f7f3a, { r: 0.85, key: 'cevre-bitki', detay: 'kaba' });
  const solarMat = mat(0x14244a, { r: 0.18, m: 0.4, key: 'cevre-solar' });
  const ikazZemin = new THREE.MeshStandardMaterial({ map: lib.ikazDokusu([5, 1]), roughness: 0.65 });
  const cizgiMat = new Map();
  const cizgiM = (renk) => {
    if (!cizgiMat.has(renk)) cizgiMat.set(renk, new THREE.MeshStandardMaterial({ color: renk, roughness: 0.68 }));
    return cizgiMat.get(renk);
  };

  // ---------------------------------------------------------------- dolu alanlar (yerleşim denetimi)
  const dolu = [], cakisma = [];
  const isaretle = (x0, x1, z0, z1, ad) => dolu.push({ x0, x1, z0, z1, ad });
  const bosMu = (x0, x1, z0, z1) => !dolu.some((r) => x0 < r.x1 && x1 > r.x0 && z0 < r.z1 && z1 > r.z0);
  function yer(x0, x1, z0, z1, ad) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (!bosMu(x0, x1, z0, z1)) { cakisma.push(ad); return false; }
    isaretle(x0, x1, z0, z1, ad);
    return true;
  }
  {
    const _b = new THREE.Box3();
    for (const x of makineler) {
      _b.setFromObject(x.kok);
      if (!_b.isEmpty()) isaretle(_b.min.x - 0.8, _b.max.x + 0.8, _b.min.z - 0.8, _b.max.z + 0.8, 'makine:' + x.m.id);
    }
    // B holü makinelerinin senaryo boyunca taradığı alan (açılan panel dizisi, kamyon, forklift)
    const yerOf = (id) => makineler.find((x) => x.m.id === id)?.kok.position;
    const k = yerOf('konteyner'), b = yerOf('bigbag'), f = yerOf('fk1000');
    if (k) isaretle(k.x - 4.7, k.x + 35.3, B.z0, k.z + 8.9, 'konteyner-senaryo');
    if (b) isaretle(b.x - 7, b.x + 5.6, B.z0, b.z + 10.1, 'bigbag-senaryo');
    if (f) isaretle(f.x - 18.8, f.x + 19, f.z - 9.2, f.z + 10.8, 'fk1000-senaryo');
  }
  isaretle(A.x0, C ? C.x1 : B.x1, -2.5, 2.5, 'koridor');
  isaretle(B.x0 - 6, B.x0 + 6.5, B.gecit[0] - 0.5, B.gecit[1] + 0.5, 'gecit');
  if (C) {
    isaretle(C.x0 - 6, C.x0 + 6, C.gecit[0] - 0.5, C.gecit[1] + 0.5, 'gecit-C');
    // C holü içerik alanları (sunucu odası; e-bisiklet, İHA, elektrikli araç + arkalarındaki SCADA ayakları)
    isaretle(125, 155, -21, -5, 'alan-sunucu');
    isaretle(122.5, 159.5, 5.5, 18.5, 'alan-projeler');
  }

  // İşçi rotası (A batı ucundaki bakım tezgâhı ↔ A ön şeridi ↔ geçit ↔ B ofisi ↔ mola köşesi)
  const ROTA = [
    { p: [A.x0 + 1.8, 17.7], bekle: 14, bak: [-1, 0], poz: 'on' },
    { p: [A.x0 + 6.4, 19.6] },
    { p: [A.x1 - 9.5, 19.6] },
    { p: [A.x1 - 4.5, 9.0] },
    { p: [B.x0 + 5.6, 9.0] },
    { p: [B.x0 + 5.6, 25.7], bekle: 12, bak: [0, 1], poz: 'yan' },
    { p: [B.x0 + 11.6, 25.7] },
    { p: [B.x0 + 17.3, 27.6] },
    { p: [B.x0 + 17.3, 33.5], bekle: 16, bak: [0, 1], poz: 'on' },
  ];
  // ilk (tezgâha) ve son (kahve tezgâhına) parça bilerek bölgelerin içine girer: onlar işaretlenmez
  for (let i = 1; i < ROTA.length - 2; i++) {
    const [ax, az] = ROTA[i].p, [bx, bz] = ROTA[i + 1].p;
    isaretle(Math.min(ax, bx) - 0.55, Math.max(ax, bx) + 0.55, Math.min(az, bz) - 0.55, Math.max(az, bz) + 0.55, 'isci-rota');
  }

  // ---------------------------------------------------------------- doku atlası (levha, plaka, zemin yazısı)
  const AT = atlasKur();
  const isaretGeo = [], cikisGeo = [];
  function atlasDuzlem(ad, w, h) {
    const [x0, y0, x1, y1] = AT.hc[ad];
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / AT.W, 1 - (y1 - uv.getY(i) * (y1 - y0)) / AT.H);
    return g;
  }
  // duvar/kolon levhası: ry = yüzün baktığı yön (0 → +Z, π/2 → +X, −π/2 → −X, π → −Z)
  function levha(ad, w, h, x, y, z, ry = 0, liste = isaretGeo) {
    const g = atlasDuzlem(ad, w, h);
    g.rotateY(ry); g.translate(x, y, z);
    liste.push(g);
  }
  function zeminYazi(ad, w, h, x, z, ry = 0) {
    const g = atlasDuzlem(ad, w, h);
    g.rotateX(-PI / 2); g.rotateY(ry); g.translate(x, 0.008, z);
    isaretGeo.push(g);
  }

  // ---------------------------------------------------------------- yardımcılar
  // Duvara dayalı yerel çerçeve: u duvar boyunca, w duvar normali (iç yüz) yönünde
  const cerceve = (x, z, ry) => {
    const s = Math.sin(ry), c = Math.cos(ry);
    return (u, y, w) => [x + c * u + s * w, y, z - s * u + c * w];
  };
  function kutuR(g, w, h, d, malz, [x, y, z], ry = 0) {
    const m = box(w, h, d, malz, x, y, z, g);
    m.rotation.y = ry;
    return m;
  }
  function cizgi(g, x0, z0, x1, z1, w, renk) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w), cizgiM(renk));
    m.rotation.set(-PI / 2, 0, -Math.atan2(z1 - z0, x1 - x0));
    m.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    m.receiveShadow = true;
    g.add(m);
  }
  function bolge(g, x0, x1, z0, z1, renk, w = 0.1) {
    cizgi(g, x0 - w / 2, z0, x1 + w / 2, z0, w, renk); cizgi(g, x0 - w / 2, z1, x1 + w / 2, z1, w, renk);
    cizgi(g, x0, z0, x0, z1, w, renk); cizgi(g, x1, z0, x1, z1, w, renk);
  }
  const golgesiz = (m) => { m.castShadow = false; return m; };

  // Örnek toplayıcılar (iki hol ortak; her biri tek çizim)
  const rafIM = new Cift(GB, celikMat, { renkli: true });
  const paletGeo = (() => {
    const p = [];
    const b = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); p.push(g); };
    for (const x of [-0.35, 0, 0.35]) b(0.1, 0.1, 1.2, x, 0.05, 0);                    // kızaklar
    for (const z of [-0.55, -0.275, 0, 0.275, 0.55]) b(0.8, 0.022, 0.1, 0, 0.111, z);    // üst tahtalar
    return mergeGeometries(p);
  })();
  const paletIM = new Cift(paletGeo, M.ahsap);
  const yukIM = new Cift(GB, yukMat, { renkli: true });
  const tupGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.5, 14);
  tupGeo.translate(0, 1.0, 0);
  const tupIM = new Cift(tupGeo, M.kirmizi);
  const tupBasGeo = (() => {
    const a = new THREE.CylinderGeometry(0.028, 0.032, 0.09, 10); a.translate(0, 1.295, 0);
    const b = new THREE.BoxGeometry(0.13, 0.018, 0.03); b.translate(0.03, 1.345, 0);
    const c = new THREE.CylinderGeometry(0.009, 0.009, 0.42, 6); c.translate(0.095, 1.1, 0);   // hortum
    return mergeGeometries([a, b, c]);
  })();
  const tupBasIM = new Cift(tupBasGeo, M.siyah, { golge: false });
  // tekerlekli çöp kovası (gövde + koyu kapak köşe rengiyle, örnek rengi gövdeyi boyar)
  const kovaGeo = (() => {
    const boya = (g, r, gg, bb) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([r, gg, bb], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const g1 = boya(new THREE.BoxGeometry(0.58, 0.95, 0.72), 1, 1, 1); g1.translate(0, 0.52, 0);
    const g2 = boya(new THREE.BoxGeometry(0.62, 0.05, 0.78), 0.55, 0.55, 0.55); g2.translate(0, 1.02, 0.02);
    const g3 = boya(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), 0.08, 0.08, 0.08); g3.rotateZ(PI / 2); g3.scale(6.5, 1, 1); g3.translate(0, 0.1, -0.36);
    return mergeGeometries([g1, g2, g3]);
  })();
  const kovaIM = new Cift(kovaGeo, mat(0xffffff, { r: 0.6, key: 'cevre-kova', ek: { vertexColors: true } }), { renkli: true });

  // ================================================================= ÇATI
  const catiCelik = new Cift(GB, celikMat, { golge: false, al: false, renkli: true });
  const isiklikIM = new Cift(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({
    color: 0xeef6ff, emissive: 0xdcecff, emissiveIntensity: 1.35, roughness: 0.4, side: THREE.DoubleSide,
  }), { golge: false, al: false });
  const armGovde = new THREE.CylinderGeometry(0.2, 0.31, 0.2, 12);
  const armIM = new Cift(armGovde, mat(0x30353b, { r: 0.45, m: 0.6, key: 'cevre-armatur' }), { golge: false, al: false });
  const lensGeo = new THREE.CircleGeometry(0.27, 12); lensGeo.rotateX(PI / 2);   // aşağı bakar
  const lensIM = new Cift(lensGeo, mat(0xfff6e8, { r: 0.3, key: 'cevre-lens', detay: false, ek: { emissive: 0xfff3e2, emissiveIntensity: 2.6 } }), { golge: false, al: false });
  const askiIM = new Cift(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), M.siyah, { golge: false, al: false });
  const huzmeGeo = { A: [], B: [], C: [] }, tozBolge = [];
  const catiBilgi = [];
  // Sac çatı altı (trapez profil çizgileri): iki holde tek malzeme, UV metre/0.25
  const sacDoku = lib.canvasTex(64, 4, (x, w) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#8d9399'); g.addColorStop(0.18, '#c4c9ce'); g.addColorStop(0.42, '#cfd3d7');
    g.addColorStop(0.6, '#a3a9ae'); g.addColorStop(0.82, '#c0c5ca'); g.addColorStop(1, '#8d9399');
    x.fillStyle = g; x.fillRect(0, 0, w, 4);
  });
  sacDoku.wrapS = sacDoku.wrapT = THREE.RepeatWrapping;
  const sacMat = new THREE.MeshStandardMaterial({ map: sacDoku, color: 0xd2d6da, roughness: 0.55, metalness: 0.25,
    emissive: 0x262a2f, side: THREE.DoubleSide });
  const sacGeo = { A: [], B: [], C: [] };

  function catiKur(h) {
    const cg = catiH[h.ad];
    const zA = h.z0 + 0.38, zB = h.z1 - 0.38, L = zB - zA, zc = (zA + zB) / 2, n = h.panel;
    const yt = (z) => h.H + h.d * (1 - Math.abs(z - zc) / (L / 2));
    const ySac = (z) => yt(z) + h.ch / 2 + 0.16 + 0.03;
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    catiBilgi.push({ ...h, yt, ySac, zc });
    // makaslar (Pratt): alt + iki üst başlık, dikmeler, merkeze doğru diyagonaller
    for (const x of h.makasX) {
      catiCelik.kiris(P(x, h.H, zA), P(x, h.H, zB), h.ch, h.ch, R.mavi);
      catiCelik.kiris(P(x, h.H, zA), P(x, h.H + h.d, zc), h.ch, h.ch, R.mavi);
      catiCelik.kiris(P(x, h.H + h.d, zc), P(x, h.H, zB), h.ch, h.ch, R.mavi);
      for (let i = 1; i < n; i++) { const z = zA + (L * i) / n; catiCelik.kiris(P(x, h.H, z), P(x, yt(z), z), h.wb, h.wb, R.mavi); }
      for (let j = 0; j < n; j++) {
        const z0 = zA + (L * j) / n, z1 = zA + (L * (j + 1)) / n;
        if (j < n / 2) catiCelik.kiris(P(x, h.H, z0), P(x, yt(z1), z1), h.wb, h.wb, R.mavi);
        else catiCelik.kiris(P(x, yt(z0), z0), P(x, h.H, z1), h.wb, h.wb, R.mavi);
      }
    }
    // aşıklar (her panel noktasında, hol boyunca)
    for (let i = 0; i <= n; i++) {
      const z = zA + (L * i) / n;
      catiCelik.kutu((h.x0 + h.x1) / 2, yt(z) + h.ch / 2 + 0.08, z, h.x1 - h.x0 - 0.3, 0.16, 0.11, 0, R.acikGri);
    }
    // ön (açık) cephe kolonları + kenar kirişi: yalnız içerideyken görünür
    for (const x of h.makasX) catiCelik.kutu(x, h.H / 2, h.z1 - 0.38, 0.5, h.H, 0.5, 0, R.mavi);
    catiCelik.kutu((h.x0 + h.x1) / 2, h.H - 0.18, h.z1 - 0.38, h.x1 - h.x0, 0.36, 0.32, 0, R.mavi);
    // sac çatı: iki eğim
    for (const [za, zb] of [[h.z0, zc], [zc, h.z1]]) {
      const g = new THREE.BufferGeometry();
      const v = [h.x0, ySac(za), za, h.x1, ySac(za), za, h.x0, ySac(zb), zb, h.x1, ySac(zb), zb];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([h.x0 / 0.25, za, h.x1 / 0.25, za, h.x0 / 0.25, zb, h.x1 / 0.25, zb], 2));
      g.setIndex([0, 2, 1, 2, 3, 1]);
      g.computeVertexNormals();
      sacGeo[h.ad].push(g);
    }
    // ışıklık bantları (eğime paralel, sacın hemen altında, makas aralarında)
    const kenar = [h.x0, ...h.makasX, h.x1];
    const alfa = Math.atan2(h.d, L / 2);
    for (let i = 0; i < kenar.length - 1; i++) {
      const xa = kenar[i] + 1.1, xb = kenar[i + 1] - 1.1;
      if (xb - xa < 3) continue;
      for (const zs of h.isiklikZ) {
        const y = ySac(zs) - 0.04, egim = zs < zc ? PI / 2 - alfa : PI / 2 + alfa;
        isiklikIM.ekle(_m.compose(_p.set((xa + xb) / 2, y, zs), _q.setFromEuler(new THREE.Euler(egim, 0, 0)), _s.set(xb - xa, h.isiklikW, 1)));
        // ışık huzmesi: ışıklıktan güneş yönünde zemine inen soluk paralelyüz + toz bölgesi
        if (h.huzme.includes(i)) {
          const w2 = h.isiklikW / 2;
          const ust = [[xa, zs - w2], [xb, zs - w2], [xb, zs + w2], [xa, zs + w2]];
          const kay = [GUNES.x * y, GUNES.z * y];
          const alt = ust.map(([x, z]) => [x + kay[0], z + kay[1]]);
          const pos = [], uv = [];
          for (let k = 0; k < 4; k++) {
            const k2 = (k + 1) % 4;
            pos.push(...[ust[k][0], y, ust[k][1]], ...[ust[k2][0], y, ust[k2][1]], ...[alt[k2][0], 0.05, alt[k2][1]],
              ...[ust[k][0], y, ust[k][1]], ...[alt[k2][0], 0.05, alt[k2][1]], ...[alt[k][0], 0.05, alt[k][1]]);
            uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
          huzmeGeo[h.ad].push(g);
          tozBolge.push({ xa, xb, z: zs, w: h.isiklikW + 1.2, y, kay });
        }
      }
    }
    // yüksek tavan LED armatürleri (makas altı seviyesinin ~1.2 m altında; yüksek makinelerin üstüne düşenler atlanır)
    const yArm = h.H - 1.25;
    for (const z of h.armZ) for (let x = h.x0 + h.armX0; x < h.x1 - 2; x += h.armAra) {
      if (makineler.some((mk) => {
        const kb = mk.kutu; return kb && kb.max.y > yArm - 0.6 && x > kb.min.x - 0.6 && x < kb.max.x + 0.6 && z > kb.min.z - 0.6 && z < kb.max.z + 0.6;
      })) continue;
      armIM.kutu(x, yArm, z, 1, 1, 1);
      lensIM.kutu(x, yArm - 0.105, z, 1, 1, 1);
      const yUst = yt(z) + h.ch / 2 + 0.08;
      askiIM.kutu(x, (yUst + yArm) / 2, z, 1, yUst - yArm, 1);
    }
    // havalandırma kanalları (spiral galvaniz boru, makine sıralarının arkasında) + askılar + menfezler
    for (const z of h.kanalZ) {
      const y = h.H - 0.75, x0 = h.x0 + 1.2, x1 = h.x1 - 1.2;
      const k = cyl(0.36, x1 - x0, galvaniz, (x0 + x1) / 2, y, z, cg, { eksen: 'x', seg: 18 }); golgesiz(k);
      for (let x = x0 + 1.5; x < x1; x += 3) {
        const yUst = yt(z) + h.ch / 2;
        golgesiz(box(0.03, yUst - y - 0.36, 0.03, M.siyah, x, (yUst + y + 0.36) / 2, z, cg));
        golgesiz(box(0.06, 0.04, 0.82, galvaniz, x, y + 0.36, z, cg));
      }
      for (let x = x0 + 4; x < x1 - 2; x += 7.5) golgesiz(box(0.5, 0.18, 0.5, M.beyaz, x, y - 0.42, z, cg));
    }
    // arka saçak bandı ve alın (gable) duvarları: dış yarıda (duvar üstünün iç yarısı güvercin tüneği)
    golgesiz(box(h.x1 - h.x0, ySac(h.z0) - h.H + 0.06, 0.12, duvarMat || M.beyaz, (h.x0 + h.x1) / 2, (h.H + ySac(h.z0) + 0.06) / 2, h.z0 - 0.065, cg));
    for (const [xg, dis] of h.alin) {
      const s = new THREE.Shape();
      s.moveTo(h.z0, h.H); s.lineTo(h.z1, h.H); s.lineTo(h.z1, ySac(h.z1) + 0.06); s.lineTo(zc, ySac(zc) + 0.06); s.lineTo(h.z0, ySac(h.z0) + 0.06);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
      g.rotateY(-PI / 2);   // şekil x → dünya z, kalınlık dünya −x
      const m = new THREE.Mesh(g, duvarMat || M.beyaz);
      m.position.x = xg + dis * 0.0 + (dis > 0 ? 0.125 : -0.005);
      golgesiz(m); m.receiveShadow = false;
      cg.add(m);
    }
  }
  // güneş yönü (main.js: ışık (55,52,22) → hedef (27,0,0), yön (−28,−52,−22)): huzmeler zemine bu yönde iner
  const GUNES = (() => { const v = new THREE.Vector3(-28, -52, -22); return { x: v.x / -v.y, z: v.z / -v.y }; })();

  // makinelerin dünya kutuları (armatür/toz yerleşimi için)
  for (const mk of makineler) { mk.kutu = new THREE.Box3().setFromObject(mk.kok); }

  const kolonA = []; for (let x = A.x0 + 7.5; x <= A.x1 - 7; x += 15) kolonA.push(x);
  const kapiB = [...B.kapilar].sort((a, b) => a - b), kwB = B.kapiW / 2;
  const kolonBarka = []; for (let x = B.x0 + 6; x <= B.x1 - 4; x += 12) if (!kapiB.some((k) => Math.abs(x - k) < kwB + 1)) kolonBarka.push(x);
  const kolonBdogu = []; for (let z = B.z0 + 12; z <= B.z1 - 6; z += 12) if (!C || z <= C.gecit[0] - 1 || z >= C.gecit[1] + 1) kolonBdogu.push(z);
  const kolonC = []; if (C) for (let x = C.x0 + 5; x <= C.x1 - 4; x += 10) kolonC.push(x);   // main.js C kolonları
  const makasB = []; for (let x = B.x0 + 6; x <= B.x1 - 4; x += 12) makasB.push(x);

  catiKur({ ad: 'A', x0: A.x0, x1: A.x1, z0: A.z0, z1: A.z1, H: A.H, d: 1.6, panel: 16, ch: 0.2, wb: 0.08, makasX: kolonA,
    isiklikZ: [-9.5, 9.5], isiklikW: 1.8, huzme: [2, 4, 6, 8], armZ: [-15.5, -5.5, 5.5, 15.5], armX0: 4, armAra: 7.5,
    kanalZ: [-19.2, 19.2], alin: [[A.x0, -1]] });
  catiKur({ ad: 'B', x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1, H: B.H, d: 2.3, panel: 24, ch: 0.24, wb: 0.1, makasX: makasB,
    isiklikZ: [-21, 0, 21], isiklikW: 2.0, huzme: [1, 3, 5], armZ: [-27, -15, -3, 9, 21, 31], armX0: 4, armAra: 7.5,
    kanalZ: [-31.5, 32.5], alin: [[B.x0, -1], [B.x1, 1]] });
  if (C) catiKur({ ad: 'C', x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1, H: C.H, d: 1.6, panel: 16, ch: 0.2, wb: 0.08, makasX: kolonC,
    isiklikZ: [-10, 10], isiklikW: 1.8, huzme: [1, 3], armZ: [-17, -6, 6, 17], armX0: 4, armAra: 7.5,
    kanalZ: [-21.2, 21.2], alin: [[C.x1, 1]] });
  catiCelik.kur(catiH.A, catiH.B, 'cevre-makas');
  isiklikIM.kur(catiH.A, catiH.B, 'cevre-isiklik');
  armIM.kur(catiH.A, catiH.B, 'cevre-armatur'); lensIM.kur(catiH.A, catiH.B, 'cevre-lens'); askiIM.kur(catiH.A, catiH.B, 'cevre-aski');
  {
    const hd = lib.canvasTex(4, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,248,232,1)'); g.addColorStop(0.55, 'rgba(255,248,232,0.45)'); g.addColorStop(1, 'rgba(255,248,232,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
    const huzmeMat = new THREE.MeshBasicMaterial({
      map: hd, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    for (const h of C ? ['A', 'B', 'C'] : ['A', 'B']) {
      const sac = new THREE.Mesh(mergeGeometries(sacGeo[h]), sacMat);
      sac.name = 'cevre-sac-' + h;
      catiH[h].add(sac);
      if (!huzmeGeo[h].length) continue;
      const huzme = new THREE.Mesh(mergeGeometries(huzmeGeo[h]), huzmeMat);
      huzme.name = 'cevre-huzme-' + h; huzme.renderOrder = 2;
      catiH[h].add(huzme);
    }
  }
  // toz: ışık huzmelerinin içinde yavaşça süzülen parçacıklar
  const toz = (() => {
    const N = Math.min(900, tozBolge.length * 70);
    if (!N) return null;
    const pos = new Float32Array(N * 3), veri = [];
    for (let i = 0; i < N; i++) {
      const b = tozBolge[i % tozBolge.length], k = rnd();
      veri.push({ b, u: rnd(), v: rnd() - 0.5, k, h: ara(0.6, b.y - 0.8), hiz: ara(0.03, 0.09), faz: rnd() * 6.28 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const nokta = lib.canvasTex(32, 32, (x, w) => {
      const gr = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, w);
    });
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.028, map: nokta, color: 0xfff0d2, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false }));
    p.frustumCulled = false; p.name = 'cevre-toz';
    cati.add(p);
    return { p, pos, veri, N };
  })();
  if (toz) tozGuncelle(0, 0);
  function tozGuncelle(dt, t) {
    const { pos, veri } = toz;
    for (let i = 0; i < veri.length; i++) {
      const d = veri[i], b = d.b;
      d.h += d.hiz * dt * (0.4 + Math.sin(t * 0.3 + d.faz));
      if (d.h > b.y - 0.6) d.h = 0.5; else if (d.h < 0.4) d.h = b.y - 0.7;
      const f = d.h / b.y;                                // huzme eğimi boyunca kay
      pos[i * 3] = b.xa + d.u * (b.xb - b.xa) + b.kay[0] * (1 - f) + Math.sin(t * 0.21 + d.faz) * 0.35;
      pos[i * 3 + 1] = d.h;
      pos[i * 3 + 2] = b.z + d.v * b.w + b.kay[1] * (1 - f) + Math.cos(t * 0.17 + d.faz) * 0.35;
    }
    toz.p.geometry.attributes.position.needsUpdate = true;
  }

  // ================================================================= DUVAR
  if (duvarMat) duvarPaneli(duvarMat);
  const zA = A.z0 + 0.125, zBa = B.z0 + 0.125;   // arka duvar iç yüzleri
  // kolon numaraları (plakalar atlastan), A: video duvarının arkasında kalan kolonlar atlanır
  const VIDEO = { x0: -40.4, x1: -21.6 };
  kolonA.forEach((x, i) => { if (x < VIDEO.x0 - 0.3 || x > VIDEO.x1 + 0.3) levha(`A-${String(i + 1).padStart(2, '0')}`, 0.5, 0.25, x, 4.3, A.z0 + 0.38 + 0.26, 0); });
  kolonBarka.forEach((x, i) => levha(`B-${String(i + 1).padStart(2, '0')}`, 0.5, 0.25, x, 4.3, B.z0 + 0.38 + 0.26, 0));
  kolonBdogu.forEach((z, i) => levha(`B-${String(kolonBarka.length + i + 1).padStart(2, '0')}`, 0.5, 0.25, B.x1 - 0.38 - 0.26, 7.0, z, -PI / 2));

  // acil çıkış kapıları: kapı kanadı + kasa + panik bar + yeşil ışıklı levha
  function cikisKapisi(g, x, z, ry) {
    const P = cerceve(x, z, ry);
    kutuR(g, 1.0, 2.1, 0.05, kapiMat, P(0, 1.05, 0.03), ry);
    for (const u of [-0.54, 0.54]) kutuR(g, 0.08, 2.2, 0.1, M.gri, P(u, 1.1, 0.05), ry);
    kutuR(g, 1.16, 0.08, 0.1, M.gri, P(0, 2.18, 0.05), ry);
    golgesiz(kutuR(g, 0.8, 0.05, 0.06, M.celik, P(0, 1.0, 0.08), ry));
    golgesiz(kutuR(g, 0.62, 0.22, 0.08, M.beyaz, P(0, 2.5, 0.05), ry));
    const [lx, ly, lz] = P(0, 2.5, 0.092);
    levha('cikis', 0.56, 0.16, lx, ly, lz, ry, cikisGeo);
    const [fx, , fz] = P(0, 0, 0.9);
    zeminYazi('cikisZ', 1.2, 0.3, fx, fz, ry + PI / 2);   // ok kapıyı gösterir
  }
  cikisKapisi(parca.A, -76, zA, 0);
  cikisKapisi(parca.A, 14, zA, 0);
  cikisKapisi(parca.A, A.x0 + 0.125, 4.5, PI / 2);
  if (C) cikisKapisi(parca.C, C.x1 - 0.125, -1.5, -PI / 2);   // koridorun doğu ucu (C holü; B'deki yer artık geçit)
  else cikisKapisi(parca.B, B.x1 - 0.125, -1.5, -PI / 2);
  cikisKapisi(parca.B, 82, zBa, 0);

  // yangın tüpleri (kolon / duvar üstünde) + levha
  function tup(x, z, ry) {
    const P = cerceve(x, z, ry);
    const [tx, , tz] = P(0, 0, 0.11);
    tupIM.kutu(tx, 0, tz, 1, 1, 1, ry); tupBasIM.kutu(tx, 0, tz, 1, 1, 1, ry);
    const [lx, ly, lz] = P(0, 1.74, 0.012);
    levha('tup', 0.28, 0.28, lx, ly, lz, ry);
  }
  for (const x of [-98.5, -68.5, -8.5, 21.5]) if (kolonA.includes(x)) tup(x, A.z0 + 0.38 + 0.25, 0);
  for (const x of kolonBarka.filter((x, i) => i % 2 === 0)) tup(x, B.z0 + 0.38 + 0.25, 0);
  tup(B.x0 - 0.125, B.gecit[0] - 1.4, -PI / 2);
  tup(B.x0 + 0.125, B.gecit[1] + 1.4, PI / 2);
  tup(A.x0 + 0.125, 10.8, PI / 2);
  if (C) {
    tup(C.x1 - 0.125, 1.25, -PI / 2);
    tup(C.x0 + 0.125, C.gecit[1] + 1.4, PI / 2);                    // C geçidinin iki yanı
    tup(C.x0 - 0.125, C.gecit[0] - 1.4, -PI / 2);
    for (const x of kolonC.filter((x, i) => i % 2 === 1)) tup(x, C.z0 + 0.38 + 0.25, 0);
    cikisKapisi(parca.C, C.x0 + 22, C.z0 + 0.125, 0);                // kuzey duvarı
    levha('baret', 0.5, 0.5, C.x0 - 0.135, C.gecitH + 0.15, C.gecit[1] + 1.6, -PI / 2);
    levha('kulak', 0.5, 0.5, C.x0 + 0.135, C.gecitH + 0.15, C.gecit[0] - 1.6, PI / 2);
  } else tup(B.x1 - 0.125, 1.25, -PI / 2);

  // uyarı levhaları
  levha('baret', 0.5, 0.5, B.x0 - 0.135, B.gecitH + 0.15, B.gecit[0] - 1.6, -PI / 2);
  levha('kulak', 0.5, 0.5, B.x0 - 0.135, B.gecitH + 0.15, B.gecit[1] + 1.6, -PI / 2);
  levha('baret', 0.5, 0.5, B.x0 + 0.135, B.gecitH + 0.15, B.gecit[1] + 1.6, PI / 2);
  for (const k of kapiB) levha('forklift', 0.6, 0.6, k - kwB - 1.0, 2.2, zBa + 0.02, 0);

  // elektrik pano sırası (MCC): gövde, kapı derzi, kol, durum lambaları, küçük HMI, önünde ikaz şeridi
  function panoSirasi(g, x, z, ry, n) {
    const P = cerceve(x, z, ry);
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 0.82;
      kutuR(g, 0.8, 0.1, 0.5, M.koyu, P(u, 0.05, 0.25), ry);
      kutuR(g, 0.8, 2.0, 0.5, M.pano, P(u, 1.1, 0.25), ry);
      golgesiz(kutuR(g, 0.012, 1.9, 0.006, M.koyu, P(u + 0.4, 1.1, 0.503), ry));
      golgesiz(kutuR(g, 0.025, 0.15, 0.03, M.koyu, P(u + 0.31, 1.15, 0.515), ry));
      const lm = [ledY, i % 3 === 1 ? ledK : ledY, M.sari];
      lm.forEach((lmat, j) => golgesiz(kutuR(g, 0.035, 0.035, 0.02, lmat, P(u - 0.28 + j * 0.07, 1.86, 0.505), ry)));
      if (i === Math.floor(n / 2)) golgesiz(kutuR(g, 0.3, 0.22, 0.012, ekranMat, P(u - 0.05, 1.45, 0.505), ry));
      if (i % 2 === 0) { const [lx, ly, lz] = P(u - 0.12, 1.62, 0.507); levha('gerilim', 0.18, 0.18, lx, ly, lz, ry); }
    }
    const L = n * 0.82 + 0.3;
    const [ix, , iz] = P(0, 0, 0.5 + 0.45);
    const ik = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.75), ikazZemin);
    ik.rotation.set(-PI / 2, 0, ry); ik.position.set(ix, 0.006, iz); ik.receiveShadow = true;
    g.add(ik);
  }
  const panoYer = (x, z, ry, n, g, ad) => {
    const P = cerceve(x, z, ry), L = n * 0.82 + 0.3, [ax, , az] = P(-L / 2, 0, 0), [bx, , bz] = P(L / 2, 0, 1.3);
    if (yer(ax, bx, az, bz, ad)) panoSirasi(g, x, z, ry, n);
  };
  panoYer(-61.0, zA, 0, 5, parca.A, 'mcc-A1');
  panoYer(-1.0, zA, 0, 4, parca.A, 'mcc-A2');
  panoYer(B.x0 + 0.125, -24, PI / 2, 5, parca.B, 'mcc-B');

  // kablo tavası (galvaniz U), basınçlı hava hattı (mavi alüminyum) + kolon düşüşleri (şartlandırıcı + vana)
  function tava(g, x0, x1, z, y, eksen = 'x') {
    const L = x1 - x0, c = (x0 + x1) / 2;
    if (eksen === 'x') {
      golgesiz(box(L, 0.02, 0.4, galvaniz, c, y, z, g));
      golgesiz(box(L, 0.1, 0.02, galvaniz, c, y + 0.05, z - 0.19, g)); golgesiz(box(L, 0.1, 0.02, galvaniz, c, y + 0.05, z + 0.19, g));
    } else {
      golgesiz(box(0.4, 0.02, L, galvaniz, z, y, c, g));
      golgesiz(box(0.02, 0.1, L, galvaniz, z - 0.19, y + 0.05, c, g)); golgesiz(box(0.02, 0.1, L, galvaniz, z + 0.19, y + 0.05, c, g));
    }
  }
  tava(parca.A, A.x0 + 0.3, A.x1 - 0.3, A.z0 + 0.38 + 0.42, 8.35);
  for (const xd of [-61.0, -1.0]) golgesiz(box(0.3, 8.35 - 2.1, 0.08, galvaniz, xd, (8.35 + 2.1) / 2, A.z0 + 0.38 + 0.22, parca.A));
  tava(parca.B, B.x0 + 0.3, B.x1 - 0.3, B.z0 + 0.38 + 0.42, 8.4);
  tava(parca.B, B.z0 + 0.8, B.z1 - 0.3, B.x1 - 0.38 - 0.42, 8.4, 'z');
  if (C) tava(parca.C, C.x0 + 0.3, C.x1 - 0.3, C.z0 + 0.38 + 0.42, 7.4);
  golgesiz(box(0.08, 8.4 - 2.1, 0.3, galvaniz, B.x0 + 0.17, (8.4 + 2.1) / 2, -24, parca.B));
  function havaHatti(g, x0, x1, z, y, dususX) {
    const k = cyl(0.035, x1 - x0, havaMat, (x0 + x1) / 2, y, z, g, { eksen: 'x', seg: 10 }); golgesiz(k);
    for (const x of dususX) {
      golgesiz(cyl(0.022, y - 1.25, havaMat, x, (y + 1.25) / 2, z, g, { seg: 8 }));
      golgesiz(box(0.13, 0.26, 0.11, M.gri, x, 1.38, z + 0.03, g));          // şartlandırıcı (FRL)
      golgesiz(box(0.06, 0.06, 0.08, M.sari, x, 2.4, z + 0.02, g));          // küresel vana
    }
  }
  havaHatti(parca.A, A.x0 + 0.3, A.x1 - 0.3, A.z0 + 0.38 + 0.29, 3.4, [-83.1, -53.1, -8.1, 21.9, 36.9]);
  havaHatti(parca.B, B.x0 + 0.3, B.x1 - 0.3, B.z0 + 0.38 + 0.29, 6.6, kolonBarka.filter((x) => x !== 64).map((x) => x + 0.4));
  if (C) havaHatti(parca.C, C.x0 + 0.3, C.x1 - 0.3, C.z0 + 0.38 + 0.29, 3.4, [C.x0 + 15.4, C.x1 - 4.6]);

  // ================================================================= LOJİSTİK
  // seçici palet rafı: yerel +X boyunca göz (2.7 m), derinlik +Z (1.1 m, ön = koridor tarafı)
  const tunekler = { A: [], B: [] };
  function raf(hol, ox, oz, ry, goz, { katlar = [1.7, 3.3, 4.9], doluluk = 0.78 } = {}) {
    const D = 1.1, Hr = 6.0, BW = 2.7, L = goz * BW;
    const c = Math.cos(ry), s = Math.sin(ry);
    const W = (u, w) => [ox + c * u + s * w, oz - s * u + c * w];
    for (let i = 0; i <= goz; i++) {
      const u = i * BW;
      for (const w of [0.05, D - 0.05]) { const [x, z] = W(u, w); rafIM.kutu(x, Hr / 2, z, 0.09, Hr, 0.09, ry, R.mavi); }
      // yan çerçeve bağlantıları
      for (let k = 0; k < 6; k++) {
        const y0 = 0.25 + k * 0.95, y1 = y0 + 0.95;
        const [xa, za] = W(u, 0.05), [xb, zb] = W(u, D - 0.05);
        rafIM.kiris(new THREE.Vector3(xa, y0, za), new THREE.Vector3(xb, Math.min(y1, Hr - 0.1), zb), 0.035, 0.035, R.mavi);
        rafIM.kutu((xa + xb) / 2, y0, (za + zb) / 2, 0.035, 0.035, D - 0.1, ry, R.mavi);
      }
      if (i === 0 || i === goz) { const [x, z] = W(u, D + 0.08); rafIM.kutu(x, 0.2, z, 0.16, 0.4, 0.12, ry, R.sari); }   // köşe koruyucu
      if (i % 2 === 0) { const [x, z] = W(u, D - 0.05); tunekler[hol].push({ p: new THREE.Vector3(x, Hr, z), yaw: -ry + (rnd() < 0.5 ? 0 : PI) }); }
    }
    for (let j = 0; j < goz; j++) {
      const u0 = j * BW;
      for (const y of katlar) for (const w of [0.05, D - 0.05]) { const [x, z] = W(u0 + BW / 2, w); rafIM.kutu(x, y, z, BW - 0.09, 0.11, 0.05, ry, R.turuncu); }
      for (const y of [0, ...katlar.map((k) => k + 0.055)]) {
        for (let k = 0; k < 3; k++) {
          if (rnd() > doluluk) continue;
          const [x, z] = W(u0 + 0.5 + k * 0.85, D / 2);
          paletIM.kutu(x, y, z, 1, 1, 0.92, ry);
          yukUstune(x, y + 0.122, z, ry, y === 0 ? 1.3 : 1.15);
        }
      }
    }
    return L;
  }
  // palet üstü yük: koli / streçli yük / mavi kasa / sac paket
  const YUK = [0xb88a55, 0xc29665, 0xdfe3e6, 0xd6dadd, 0x2a5ca8, 0x8d9399, 0xa77c4e];
  function yukUstune(x, y, z, ry, hMax = 1.2, renk) {
    const r = renk ?? secR(YUK), h = ara(0.45, hMax);
    yukIM.kutu(x, y + h / 2, z, 0.76, h, 1.12, ry, r);
    if (r === 0xb88a55 || r === 0xc29665 || r === 0xa77c4e) yukIM.kutu(x, y + h + 0.012, z, 0.3, 0.024, 1.14, ry, 0xe8e2d0);   // bant
  }
  function paletYigini(x, z, ry, n = 1, renk, hMax = 1.2) {
    paletIM.kutu(x, 0, z, 1, 1, 1, ry);
    yukUstune(x, 0.122, z, ry, hMax, renk);
  }
  function bosPaletYigini(x, z, ry, n) { for (let i = 0; i < n; i++) paletIM.kutu(x, i * 0.122, z, 1, 0.85, 1, ry + (rnd() - 0.5) * 0.06); }

  // A holü arka duvar rafları (kolon araları); B holü doğu duvarı boyunca uzun raf hattı
  const rafYer = (hol, x0, x1, z0, z1, ad, f) => { if (yer(x0, x1, z0, z1, ad)) f(); };
  {
    const zr = A.z0 + 0.38 + 0.27;   // kolon ön yüzünün önü
    rafYer('A', -97.75, -84.25, zr, zr + 1.1, 'raf-A1', () => raf('A', -97.75, zr, 0, 5));
    rafYer('A', 22.25, 35.75, zr, zr + 1.1, 'raf-A2', () => raf('A', 22.25, zr, 0, 5));
    const xr = B.x1 - 0.38 - 0.27 - 0.08;   // kolon iç yüzünün önü (raf arkası)
    const ryB = -PI / 2;                     // yerel +X → dünya +Z, ön → −X
    // koridor ucunda C holü geçidi (z −8…8): raf hatları geçidin iki yanında biter (C yoksa çıkış kapısı)
    const gB = C ? 8 : 11, zB2 = C ? C.gecit[1] + 1.5 : 3.0;
    rafYer('B', xr - 1.1, xr, -33.3, -33.3 + gB * 2.7, 'raf-B1', () => raf('B', xr, -33.3, ryB, gB));
    rafYer('B', xr - 1.1, xr, zB2, zB2 + gB * 2.7, 'raf-B2', () => raf('B', xr, zB2, ryB, gB));
  }

  // A batı ucu — bakım atölyesi
  {
    const g = parca.A, xw = A.x0 + 0.125;
    if (yer(xw, A.x0 + 5.6, 11.0, 22.8, 'bakim')) {
      bolge(g, A.x0 + 0.3, A.x0 + 5.6, 11.0, 22.8, 0xf2c200);
      zeminYazi('bakim', 3.2, 0.8, A.x0 + 3.1, 11.7);
      for (const zc of [13.7, 17.7]) {   // iş tezgâhları: çelik iskelet + ahşap tabla + alt raf + çekmece bloğu
        box(0.8, 0.05, 3.4, M.ahsap, xw + 0.5, 0.9, zc, g);
        for (const [dx, dz] of [[0.08, -1.62], [0.72, -1.62], [0.08, 1.62], [0.72, 1.62]]) box(0.05, 0.88, 0.05, M.gri, xw + 0.1 + dx, 0.44, zc + dz, g);
        box(0.76, 0.03, 3.3, M.gri, xw + 0.5, 0.2, zc, g);
        box(0.62, 0.62, 0.5, M.mavi, xw + 0.5, 0.56, zc + 1.2, g);
        for (const dy of [0.36, 0.56, 0.76]) golgesiz(box(0.6, 0.01, 0.46, M.koyu, xw + 0.81, dy, zc + 1.2, g));
      }
      // mengene + takım kutusu
      box(0.16, 0.12, 0.26, M.mavi, xw + 0.65, 0.99, 12.6, g); box(0.1, 0.08, 0.1, M.koyu, xw + 0.65, 1.07, 12.45, g);
      box(0.45, 0.2, 0.22, M.kirmizi, xw + 0.45, 1.03, 18.6, g);
      // delikli takım panosu + aletler
      golgesiz(box(0.02, 1.2, 7.4, M.beyaz, xw + 0.012, 1.65, 15.7, g));
      for (let i = 0; i < 26; i++) {
        const z = 12.3 + i * 0.27, y = 1.25 + (i % 3) * 0.33;
        const tip = i % 4;
        if (tip === 0) golgesiz(box(0.02, 0.24, 0.035, M.celik, xw + 0.03, y, z, g));          // anahtar
        else if (tip === 1) { golgesiz(box(0.025, 0.2, 0.03, M.kirmizi, xw + 0.03, y - 0.04, z, g)); golgesiz(box(0.02, 0.05, 0.1, M.koyu, xw + 0.03, y + 0.08, z, g)); } // çekiç
        else if (tip === 2) golgesiz(box(0.02, 0.18, 0.025, M.sari, xw + 0.03, y, z, g));       // tornavida
        else golgesiz(box(0.02, 0.12, 0.09, M.koyu, xw + 0.03, y, z, g));                       // pense
      }
      // sütunlu matkap
      box(0.42, 0.06, 0.55, M.koyu, xw + 0.45, 0.03, 21.3, g);
      cyl(0.045, 1.6, M.celik, xw + 0.3, 0.86, 21.3, g, { seg: 12 });
      box(0.3, 0.32, 0.42, M.yesil, xw + 0.42, 1.6, 21.3, g);
      box(0.32, 0.03, 0.32, M.celik, xw + 0.45, 0.85, 21.3, g);
      cyl(0.03, 0.18, M.celik, xw + 0.5, 1.36, 21.3, g, { seg: 10 });
      // kırmızı takım dolabı (tekerlekli)
      box(0.7, 1.0, 0.46, M.kirmizi, A.x0 + 4.6, 0.62, 21.9, g);
      for (const dy of [0.35, 0.55, 0.75, 0.95]) golgesiz(box(0.66, 0.01, 0.005, M.koyu, A.x0 + 4.6, dy, 21.67, g));
      for (const dx of [-0.28, 0.28]) cyl(0.05, 0.04, M.kaucuk, A.x0 + 4.6 + dx, 0.06, 21.9, g, { eksen: 'z', seg: 10 });
      // A merdiveni (köşede, kapalı)
      for (const s of [-1, 1]) {
        const m = box(0.05, 2.0, 0.07, M.alu, A.x0 + 2.6 + s * 0.3, 0.98, 22.05, g); m.rotation.x = 0.16;
        const m2 = box(0.05, 2.0, 0.07, M.alu, A.x0 + 2.6 + s * 0.3, 0.98, 22.45, g); m2.rotation.x = -0.16;
      }
      for (let k = 0; k < 5; k++) golgesiz(box(0.6, 0.03, 0.08, M.alu, A.x0 + 2.6, 0.35 + k * 0.38, 21.98 - k * 0.06, g));
      tunekler.A.push({ p: new THREE.Vector3(A.x0 + 4.6, 1.12, 21.9), yaw: 0.4 });
    }
  }
  // A batı ucu — kalite kontrol + red tag alanı
  {
    const g = parca.A;
    if (yer(A.x0 + 10, A.x0 + 18.4, 12.0, 18.2, 'kalite')) {
      bolge(g, A.x0 + 10, A.x0 + 15.8, 12.0, 18.2, 0x2f6fd0);
      bolge(g, A.x0 + 16.0, A.x0 + 18.4, 12.2, 14.6, 0xd12a22);
      zeminYazi('kalite', 3.2, 0.8, A.x0 + 12.9, 12.7);
      zeminYazi('redtag', 2.0, 0.5, A.x0 + 17.2, 14.0);
      const cx = A.x0 + 12.4, cz = 15.6;
      box(1.6, 0.05, 0.9, M.gri, cx, 0.74, cz, g);
      for (const [dx, dz] of [[-0.74, -0.38], [0.74, -0.38], [-0.74, 0.38], [0.74, 0.38]]) box(0.06, 0.72, 0.06, M.gri, cx + dx, 0.36, cz + dz, g);
      box(1.5, 0.16, 0.85, granit, cx, 0.85, cz, g);
      box(0.18, 0.04, 0.14, M.alu, cx + 0.45, 0.95, cz - 0.1, g); cyl(0.02, 0.5, M.alu, cx + 0.5, 1.2, cz - 0.1, g, { seg: 8 });
      box(0.3, 0.12, 0.22, M.celik, cx - 0.3, 0.99, cz + 0.05, g);
      // ölçüm monitörü (ayaklı)
      box(0.4, 0.04, 0.4, M.koyu, cx + 1.6, 0.02, cz + 1.0, g);
      cyl(0.03, 1.3, M.koyu, cx + 1.6, 0.67, cz + 1.0, g, { seg: 8 });
      box(0.56, 0.36, 0.04, M.siyah, cx + 1.6, 1.42, cz + 1.0, g);
      golgesiz(box(0.52, 0.32, 0.01, ekranMat, cx + 1.6, 1.42, cz + 0.975, g));
      // muayene edilmiş parça rafı
      for (const y of [0.05, 0.6, 1.15, 1.7]) box(1.2, 0.03, 0.45, M.gri, cx - 1.4, y, 17.6, g);
      for (const dx of [-0.58, 0.58]) for (const dz of [-0.2, 0.2]) box(0.03, 1.75, 0.03, M.gri, cx - 1.4 + dx, 0.875, 17.6 + dz, g);
      for (let k = 0; k < 9; k++) yukIM.kutu(cx - 1.82 + (k % 3) * 0.42, 0.18 + Math.floor(k / 3) * 0.55, 17.6, 0.36, 0.22, 0.32, 0, secR([0x2a5ca8, 0x2a5ca8, 0xf2c200, 0x2f9e3a]));
      // red tag: kırmızı kova + karantina paleti
      kovaIM.kutu(A.x0 + 17.6, 0, 12.8, 1, 1, 1, PI, 0xc61f1c);
      paletYigini(A.x0 + 16.9, 13.9, PI / 2, 1, 0xa77c4e, 0.6);
    }
  }
  // A batı ucu — hammadde alanı (sac paketleri, rulo sac, profil demetleri)
  {
    const g = parca.A, x0 = A.x0 + 5, x1 = A.x0 + 22, z0 = 4.0, z1 = 9.6;
    if (yer(x0, x1, z0, z1, 'hammadde')) {
      bolge(g, x0, x1, z0, z1, 0x2f6fd0);
      zeminYazi('hammadde', 3.0, 0.75, x0 + 2.4, z0 + 0.55);
      for (let i = 0; i < 4; i++) {   // sac paketleri
        const x = x0 + 1.4 + i * 1.5;
        paletIM.kutu(x, 0, 6.9, 1.15, 1, 1.4, PI / 2);
        for (let k = 0; k < 6 + (i % 3); k++) yukIM.kutu(x, 0.14 + k * 0.045, 6.9, 1.65, 0.04, 1.1, 0, k % 2 ? 0x9aa3ab : 0x8d9399);
      }
      for (let i = 0; i < 3; i++) {   // rulo sac (göz yatay, ahşap beşikte)
        const x = x0 + 8.2 + i * 1.6;
        box(0.9, 0.36, 0.2, M.ahsap, x, 0.18, 6.45, g); box(0.9, 0.36, 0.2, M.ahsap, x, 0.18, 7.35, g);   // V beşik
        cyl(0.62, 0.7, M.celik, x, 0.8, 6.9, g, { eksen: 'x', seg: 26 });
        golgesiz(cyl(0.3, 0.72, M.koyu, x, 0.8, 6.9, g, { eksen: 'x', seg: 16 }));
      }
      for (let i = 0; i < 2; i++) {   // profil demetleri
        const z = 5.0 + i * 3.6;
        for (const xx of [x0 + 13.4, x0 + 15.6]) box(0.14, 0.12, 0.6, M.ahsap, xx, 0.06, z, g);
        for (let k = 0; k < 12; k++) box(3.2, 0.06, 0.06, M.celik, x0 + 14.5, 0.15 + Math.floor(k / 4) * 0.065, z - 0.11 + (k % 4) * 0.075, g);
      }
    }
  }
  // A holü arka duvar — KLT kasa rafı (alçak çelik raf)
  {
    const g = parca.A, x0 = -52.6, x1 = -41.4, z = A.z0 + 0.38 + 0.25;
    if (yer(x0, x1, z, z + 0.6, 'klt-raf')) {
      for (const y of [0.1, 0.62, 1.14, 1.66, 2.18]) box(x1 - x0, 0.03, 0.55, M.gri, (x0 + x1) / 2, y, z + 0.3, g);
      for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) for (const dz of [0.03, 0.57]) box(0.04, 2.25, 0.04, M.mavi, x, 1.125, z + dz, g);
      for (let k = 0; k < 4; k++) for (let i = 0; i < 14; i++) {
        if (rnd() < 0.15) continue;
        yukIM.kutu(x0 + 0.42 + i * 0.77, 0.115 + k * 0.52 + 0.13, z + 0.3, 0.6, 0.26, 0.4, 0, secR([0x2a5ca8, 0x2a5ca8, 0x2a5ca8, 0xd12a22, 0xf2c200, 0x8d9399]));
      }
      tunekler.A.push({ p: new THREE.Vector3(-47, 2.2, z + 0.3), yaw: -PI / 2 });
    }
  }
  // A holü ön şeridi (açık cephe) — alçak eşyalar: palet yığınları, çöp kovaları, transpalet
  {
    const g = parca.A;
    const ON = [
      [-62, 21.6, () => { bosPaletYigini(-62, 21.6, 0.02, 7); }],
      [-38.4, 21.7, () => { paletYigini(-38.4, 21.7, PI / 2, 1, 0xdfe3e6, 1.1); paletYigini(-37.0, 21.7, PI / 2, 1, 0xb88a55, 0.9); }],
      [-12.6, 22.1, () => { kovaIM.kutu(-12.6, 0, 22.1, 1, 1, 1, PI, 0x2a5ca8); kovaIM.kutu(-11.9, 0, 22.1, 1, 1, 1, PI, 0xf2c200); kovaIM.kutu(-11.2, 0, 22.1, 1, 1, 1, PI, 0x5b6670); }],
      [6.2, 21.7, () => { paletYigini(6.2, 21.7, PI / 2, 1, 0x2a5ca8, 0.8); bosPaletYigini(7.6, 21.7, 0, 4); }],
      [25.5, 21.9, () => { kovaIM.kutu(25.5, 0, 22.0, 1, 1, 1, PI, 0x2f9e3a); kovaIM.kutu(26.2, 0, 22.0, 1, 1, 1, PI, 0x5b6670); }],
    ];
    for (const [x, z, f] of ON) if (yer(x - 1.2, x + 2.0, z - 0.75, z + 0.75, 'on-serit')) f();
    if (yer(-73.6, -71.6, 21.0, 22.6, 'transpalet-A')) transpalet(g, -72.6, 21.8, 0);
  }
  // A holü makine araları — birkaç çöp kovası (sıra arkalarında)
  for (const [x, z, renk] of [[-53.0, 13.8, 0x5b6670], [-22.6, 13.6, 0x2a5ca8], [23.2, 13.6, 0x5b6670], [-82.3, -15.9, 0x5b6670], [22.9, -15.9, 0xf2c200]]) {
    if (yer(x - 0.4, x + 0.4, z - 0.45, z + 0.45, 'kova')) kovaIM.kutu(x, 0, z, 1, 1, 1, z > 0 ? PI : 0, renk);
  }

  // transpalet (el ile palet taşıyıcı): çatal, gövde, tutamak
  function transpalet(g, x, z, ry) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = ry; g.add(t);
    for (const dz of [-0.2, 0.2]) box(1.15, 0.07, 0.16, M.turuncu, 0.15, 0.06, dz, t);
    box(0.28, 0.32, 0.56, M.turuncu, -0.55, 0.2, 0, t);
    cyl(0.08, 0.1, M.kaucuk, -0.6, 0.08, 0, t, { eksen: 'z', seg: 12 });
    const kol = box(0.04, 1.1, 0.04, M.koyu, -0.75, 0.75, 0, t); kol.rotation.z = 0.25;
    box(0.04, 0.04, 0.34, M.koyu, -0.89, 1.28, 0, t);
  }

  // B holü — iki katlı ofis (kalite / planlama): alt kat camlı, üstte korkuluklu teras + merdiven
  const camGeo = [];
  {
    const g = parca.B, x0 = B.x0 + 1.5, x1 = B.x0 + 9.5, z0 = 26.6, z1 = 35.0, Hk = 3.0, Hd = 3.35;
    if (yer(B.x0 + 0.2, x1 + 0.2, z0 - 0.3, z1 + 0.3, 'ofis')) {
      const cam = (w, h, x, y, z, ry = 0) => { const gg = new THREE.PlaneGeometry(w, h); gg.rotateY(ry); gg.translate(x, y, z); camGeo.push(gg); };
      // dikmeler (2 m aralık) + alt dolu panel + cam + üst bant
      const kenarlar = [
        { a: [x0, z0], b: [x1, z0], ry: 0, n: [0, -1] }, { a: [x1, z0], b: [x1, z1], ry: PI / 2, n: [1, 0] },
        { a: [x0, z1], b: [x1, z1], ry: 0, n: [0, 1] }, { a: [x0, z0], b: [x0, z1], ry: PI / 2, n: [-1, 0] },
      ];
      const kapiX = (x0 + x1) / 2;
      for (const k of kenarlar) {
        const L = Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1]), nn = Math.round(L / 2);
        for (let i = 0; i <= nn; i++) {
          const f = i / nn, x = k.a[0] + (k.b[0] - k.a[0]) * f, z = k.a[1] + (k.b[1] - k.a[1]) * f;
          box(0.1, Hk, 0.1, M.koyu, x, Hk / 2, z, g);
        }
        for (let i = 0; i < nn; i++) {
          const f0 = i / nn, f1 = (i + 1) / nn;
          const xa = k.a[0] + (k.b[0] - k.a[0]) * f0, za = k.a[1] + (k.b[1] - k.a[1]) * f0;
          const xb = k.a[0] + (k.b[0] - k.a[0]) * f1, zb = k.a[1] + (k.b[1] - k.a[1]) * f1;
          const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = L / nn - 0.1;
          const kapiBolmesi = k.n[1] === -1 && Math.abs(cx - kapiX) < 1.05;
          if (kapiBolmesi) {
            kutuR(g, 1.0, 2.15, 0.05, kapiMat, [kapiX, 1.075, z0 - 0.01], 0);
            golgesiz(box(0.04, 0.3, 0.05, M.celik, kapiX + 0.38, 1.05, z0 - 0.05, g));
            const ww = (w - 1.0) / 2;
            for (const s of [-1, 1]) { kutuR(g, ww, 0.9, 0.06, M.beyaz, [kapiX + s * (0.5 + ww / 2), 0.45, z0], 0); cam(ww, 1.85, kapiX + s * (0.5 + ww / 2), 1.875, z0, 0); }
            kutuR(g, w, 0.65, 0.06, M.beyaz, [cx, 2.475, z0], 0);
            continue;
          }
          kutuR(g, w, 0.9, 0.06, M.beyaz, [cx, 0.45, cz], k.ry);
          cam(w, 1.9, cx, 1.85, cz, k.ry);
          kutuR(g, w, 0.2, 0.06, M.beyaz, [cx, 2.9, cz], k.ry);
        }
      }
      // döşeme / teras
      box(x1 - x0 + 0.2, 0.35, z1 - z0 + 0.2, M.gri, (x0 + x1) / 2, Hk + 0.175, (z0 + z1) / 2, g);
      // korkuluk (sarı): dikmeler + iki küpeşte; merdiven tarafında boşluk
      const Ry = Hd + 1.1;
      const korkuluk = (xa, za, xb, zb) => {
        const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 1.5));
        for (let i = 0; i <= n; i++) { const f = i / n; box(0.05, 1.1, 0.05, M.sari, xa + (xb - xa) * f, Hd + 0.55, za + (zb - za) * f, g); }
        for (const y of [Ry, Hd + 0.55]) {
          const m = box(L, 0.05, 0.05, M.sari, (xa + xb) / 2, y, (za + zb) / 2, g); m.rotation.y = -Math.atan2(zb - za, xb - xa);
        }
        tunekler.B.push({ p: new THREE.Vector3((xa + xb) / 2, Ry + 0.025, (za + zb) / 2), yaw: -Math.atan2(zb - za, xb - xa) + (rnd() < 0.5 ? 0 : PI) });
      };
      korkuluk(x0, z0, x1, z0); korkuluk(x1, z0, x1, z1); korkuluk(x0, z1, x1, z1); korkuluk(x0, z0 + 1.6, x0, z1);
      // merdiven (batı yanında, ortak duvar boyunca; güneyde sahanlık)
      const mx = B.x0 + 0.75, basZ = z1 - 0.3, tepeZ = z0 + 0.8, nb = 16;
      for (let i = 0; i < nb; i++) {
        const f = i / nb, z = basZ - (basZ - tepeZ) * f;
        box(0.95, 0.04, 0.32, M.gri, mx, Hd * (i + 1) / (nb + 1), z, g);
      }
      for (const s of [-1, 1]) {
        const L = Math.hypot(basZ - tepeZ, Hd), m = box(0.06, 0.24, L, M.sari, mx + s * 0.5, Hd / 2, (basZ + tepeZ) / 2, g);
        m.rotation.x = -Math.atan2(Hd, basZ - tepeZ);
        const k2 = box(0.04, 0.04, L, M.sari, mx + s * 0.5, Hd / 2 + 0.95, (basZ + tepeZ) / 2, g); k2.rotation.x = m.rotation.x;
      }
      box(1.2, 0.08, 1.4, M.gri, B.x0 + 0.85, Hd - 0.04, tepeZ - 0.3, g);
      // iç: iki masa + monitör + koltuk, dosya dolabı, beyaz tahta
      for (const [mx2, mz] of [[x0 + 2.2, z1 - 1.4], [x1 - 2.2, z1 - 1.4]]) {
        box(1.6, 0.04, 0.8, M.beyaz, mx2, 0.74, mz, g);
        for (const dx of [-0.75, 0.75]) box(0.05, 0.72, 0.7, M.gri, mx2 + dx, 0.36, mz, g);
        box(0.56, 0.34, 0.03, M.siyah, mx2, 1.06, mz + 0.25, g);
        golgesiz(box(0.52, 0.3, 0.01, ekranMat, mx2, 1.06, mz + 0.233, g));
        box(0.48, 0.08, 0.48, M.siyah, mx2, 0.46, mz - 0.6, g); box(0.48, 0.5, 0.06, M.siyah, mx2, 0.75, mz - 0.86, g);
        cyl(0.03, 0.4, M.koyu, mx2, 0.22, mz - 0.6, g, { seg: 8 });
      }
      box(0.5, 1.3, 0.6, M.gri, x1 - 0.4, 0.65, z0 + 0.6, g);
      golgesiz(box(1.8, 1.0, 0.03, M.beyaz, (x0 + x1) / 2 - 1, 1.6, z1 - 0.1, g));
      // üst kat terasında birkaç koli
      for (let i = 0; i < 3; i++) yukIM.kutu(x1 - 1.2 - i * 0.7, Hd + 0.2 + (i === 1 ? 0.0 : 0), z1 - 1.0, 0.6, 0.4, 0.5, 0.1 * i, 0xb88a55);
      levha('ofis', 3.2, 0.8, kapiX, 2.75, z0 - 0.04, PI);
    }
  }
  // B holü — mola köşesi
  {
    const g = parca.B, x0 = B.x0 + 11.5, x1 = B.x0 + 22.5, z0 = 28.4, z1 = 35.2;
    if (yer(x0, x1, z0, z1, 'mola')) {
      bolge(g, x0, x1, z0, z1, 0x2f9e3a);
      zeminYazi('mola', 3.0, 0.75, x0 + 3.0, z0 + 0.6);
      for (const tx of [x0 + 2.0, x1 - 2.0]) {   // masa + iki bank
        box(1.8, 0.05, 0.8, M.ahsap, tx, 0.74, 30.6, g);
        for (const dx of [-0.8, 0.8]) box(0.06, 0.72, 0.06, M.gri, tx + dx, 0.36, 30.6, g);
        for (const dz of [-0.75, 0.75]) { box(1.8, 0.05, 0.32, M.mavi, tx, 0.45, 30.6 + dz, g); for (const dx of [-0.75, 0.75]) box(0.05, 0.43, 0.05, M.gri, tx + dx, 0.22, 30.6 + dz, g); }
        box(0.12, 0.1, 0.08, M.beyaz, tx + 0.4, 0.82, 30.5, g);   // fincan/kutu
      }
      // içecek otomatı, su sebili, kahve tezgâhı
      box(1.0, 1.9, 0.8, M.koyu, x0 + 0.9, 0.95, z1 - 0.7, g);
      golgesiz(box(0.66, 1.3, 0.02, otomatMat, x0 + 0.8, 1.15, z1 - 1.11, g));
      golgesiz(box(0.16, 0.5, 0.02, M.siyah, x0 + 1.25, 1.2, z1 - 1.11, g));
      box(0.34, 1.0, 0.34, M.beyaz, x0 + 2.3, 0.5, z1 - 0.5, g);
      cyl(0.14, 0.42, suMat, x0 + 2.3, 1.21, z1 - 0.5, g, { seg: 14 });
      box(2.6, 0.9, 0.62, M.beyaz, x0 + 5.8, 0.45, z1 - 0.5, g);
      box(2.66, 0.04, 0.66, M.koyu, x0 + 5.8, 0.92, z1 - 0.5, g);
      box(0.4, 0.5, 0.4, M.siyah, x0 + 5.8, 1.19, z1 - 0.52, g);
      golgesiz(box(0.04, 0.04, 0.01, ledY, x0 + 5.9, 1.3, z1 - 0.72, g));
      // tabelalar ayak üstünde (ilk yardım, sigara içilmez) + saksı
      for (const [lx, ad] of [[x1 - 0.5, 'ilkyardim'], [x0 + 3.6, 'sigara']]) {
        box(0.05, 1.6, 0.05, M.gri, lx, 0.8, z1 - 0.35, g);
        box(0.36, 0.03, 0.36, M.gri, lx, 0.015, z1 - 0.35, g);
        levha(ad, 0.42, 0.42, lx, 1.75, z1 - 0.32, PI);
      }
      cyl(0.25, 0.45, M.koyu, x1 - 0.5, 0.225, z0 + 0.5, g, { r2: 0.2, seg: 14 });
      lib.sphere(0.42, bitkiMat, x1 - 0.5, 0.82, z0 + 0.5, g, 10);
    }
  }
  // B holü — sevkiyat hazırlık alanı (streçli paletler, sandıklar)
  {
    const g = parca.B, x0 = B.x0 + 10, x1 = B.x0 + 23, z0 = 6.0, z1 = 21.0;
    if (yer(x0, x1, z0, z1, 'sevkiyat')) {
      bolge(g, x0, x1, z0, z1, 0xf2c200);
      zeminYazi('sevkiyat', 3.2, 0.8, x0 + 2.6, z0 + 0.6);
      for (const z of [8.6, 13.2, 17.8]) {
        cizgi(g, x0 + 0.4, z + 1.3, x1 - 0.4, z + 1.3, 0.06, 0xf2c200);
        for (let i = 0; i < 5; i++) {
          if (rnd() < 0.15) continue;
          const x = x0 + 1.4 + i * 2.5;
          if (i === 3 && z === 13.2) { box(1.3, 1.1, 1.2, M.ahsap, x, 0.55 + 0.122, z, g); paletIM.kutu(x, 0, z, 1, 1, 1, 0); continue; }   // makine sandığı
          const r1 = rnd(), renk = r1 < 0.4 ? 0xd9e0e5 : r1 < 0.75 ? secR([0xb88a55, 0xc29665, 0xa77c4e]) : secR([0x2a5ca8, 0x8d9399]);
          paletYigini(x, z, 0, 1, renk, 1.35);
          if (rnd() < 0.3) { paletIM.kutu(x, 1.55, z, 1, 1, 1, 0); yukUstune(x, 1.67, z, 0, 0.75); }
        }
      }
      if (yer(x0 - 0.2, x0 + 1.4, 3.3, 5.6, 'transpalet-B')) transpalet(g, x0 + 0.7, 4.4, PI / 2);
    }
  }
  // B holü — atık / geri dönüşüm istasyonu
  {
    const g = parca.B, x0 = B.x0 + 1.5, x1 = B.x0 + 7.5, z0 = B.z0 + 1.4, z1 = B.z0 + 5.6;
    if (yer(x0, x1, z0, z1, 'atik')) {
      bolge(g, x0, x1, z0, z1, 0xf2c200);
      zeminYazi('atik', 3.2, 0.8, (x0 + x1) / 2, z1 - 1.1);
      [0x2a5ca8, 0xf2c200, 0x2f9e3a, 0x5b6670].forEach((renk, i) => kovaIM.kutu(x0 + 0.8 + i * 1.5, 0, z0 + 0.6, 1, 1, 1, 0, renk));
    }
  }
  // B holü güney şeridi — yedek güneş panelleri (FK-1000 bağlamı) + IBC su tankı
  {
    const g = parca.B;
    for (const x of [77, 79.2]) {
      if (!yer(x - 0.8, x + 0.8, 30.8, 33.6, 'solar-palet')) continue;
      paletIM.kutu(x, 0, 32.2, 1.4, 1, 1.7, 0);
      for (let k = 0; k < 14; k++) {
        yukIM.kutu(x, 0.15 + k * 0.042, 32.2, 1.04, 0.035, 2.0, 0, k % 2 ? 0xc5cad0 : 0x1a2b52);
      }
    }
    if (yer(91.6, 93.6, 31.8, 34.2, 'ibc')) {
      paletIM.kutu(92.6, 0, 33, 1.3, 1, 1.0, 0);
      box(1.0, 1.0, 1.15, M.beyaz, 92.6, 0.65, 33, g);
      for (const [dx, dz] of [[-0.52, -0.59], [0.52, -0.59], [-0.52, 0.59], [0.52, 0.59]]) box(0.03, 1.05, 0.03, M.celik, 92.6 + dx, 0.66, 33 + dz, g);
      for (const y of [0.4, 0.8, 1.17]) { box(1.06, 0.025, 0.025, M.celik, 92.6, y, 32.41, g); box(1.06, 0.025, 0.025, M.celik, 92.6, y, 33.59, g); box(0.025, 0.025, 1.2, M.celik, 92.08, y, 33, g); box(0.025, 0.025, 1.2, M.celik, 93.12, y, 33, g); }
      cyl(0.12, 0.06, M.siyah, 92.6, 1.2, 33, g, { seg: 12 });
      tunekler.B.push({ p: new THREE.Vector3(92.6, 1.2, 33.3), yaw: PI });
    }
  }
  // B holü raf koridoru — park etmiş forklift
  {
    const x = B.x1 - 6.4, z = 17;
    if (yer(x - 1.9, x + 1.6, z - 0.75, z + 0.75, 'forklift-park')) forklift(parca.B, x, z, PI);
  }
  function forklift(g, x, z, ry) {
    const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = ry; g.add(f);
    box(1.5, 0.55, 1.0, M.sari, 0, 0.55, 0, f);                     // şasi
    box(0.5, 0.55, 0.96, M.koyu, -0.55, 0.9, 0, f);                  // karşı ağırlık
    box(0.5, 0.06, 0.5, M.siyah, -0.05, 1.12, 0, f);                 // koltuk
    box(0.06, 0.5, 0.45, M.siyah, -0.28, 1.4, 0, f);
    for (const [dx, dz] of [[0.45, 0.45], [0.45, -0.45], [-0.5, 0.45], [-0.5, -0.45]]) box(0.05, 1.3, 0.05, M.koyu, dx, 1.8, dz, f);
    box(1.0, 0.05, 0.95, M.koyu, -0.02, 2.45, 0, f);                 // tavan koruması
    for (const dz of [-0.32, 0.32]) box(0.08, 2.4, 0.08, M.koyu, 0.82, 1.2, dz, f);   // direk
    box(0.06, 0.5, 0.8, M.koyu, 0.88, 0.35, 0, f);                  // çatal taşıyıcı
    for (const dz of [-0.25, 0.25]) box(1.1, 0.05, 0.12, M.koyu, 1.45, 0.06, dz, f);
    for (const [dx, dz, r] of [[0.45, 0.5, 0.3], [0.45, -0.5, 0.3], [-0.5, 0.5, 0.24], [-0.5, -0.5, 0.24]]) cyl(r, 0.22, M.kaucuk, dx, r, dz, f, { eksen: 'z', seg: 16 });
    cyl(0.07, 0.08, mat(0xff7a00, { key: 'cevre-tepe', detay: false, ek: { emissive: 0xff7a00, emissiveIntensity: 0.4 } }), -0.4, 2.52, 0, f, { seg: 10 });
  }

  // lastik izleri (koridor şeritleri, B raf koridoru, kamyon şeritleri) — tek saydam çizim
  {
    const izDoku = lib.canvasTex(64, 512, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const cx = 6 + Math.random() * (w - 12), a = 0.15 + Math.random() * 0.35;
        x.strokeStyle = `rgba(0,0,0,${a})`; x.lineWidth = 1 + Math.random() * 4;
        x.beginPath(); x.moveTo(cx, 0);
        for (let y = 0; y <= h; y += 32) x.lineTo(cx + Math.sin(y * 0.02 + i) * 3, y);
        x.stroke();
      }
    }, { srgb: false });
    izDoku.wrapS = izDoku.wrapT = THREE.RepeatWrapping;
    const geos = [];
    const serit = (x0, z0, x1, z1, w) => {
      const L = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(L, w);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * L / 6);
      g.rotateX(-PI / 2); g.rotateY(-Math.atan2(z1 - z0, x1 - x0)); g.translate((x0 + x1) / 2, 0.003, (z0 + z1) / 2);
      geos.push(g);
    };
    const izX1 = (C ? C.x1 : B.x1) - 8;
    serit(A.x0 + 6, -1, izX1, -1, 0.85); serit(A.x0 + 6, 1, izX1, 1, 0.85);
    serit(B.x1 - 6.4, B.z0 + 2, B.x1 - 6.4, B.z1 - 2, 1.6);
    for (const k of kapiB) serit(k, B.z0 + 0.3, k, B.z0 + 24, 2.6);
    const iz = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({
      color: 0x15161a, alphaMap: izDoku, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.95,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    iz.name = 'cevre-iz'; iz.renderOrder = 1;
    genel.add(iz);
  }

  // ---------------------------------------------------------------- örnekler + atlas mesh'leri + birleştirme
  for (const [o, ad] of [[rafIM, 'raf'], [paletIM, 'palet'], [yukIM, 'yuk'], [tupIM, 'tup'], [tupBasIM, 'tupbas'], [kovaIM, 'kova']]) o.kur(parca.A, parca.B, 'cevre-' + ad);
  {
    const atlasMat = new THREE.MeshStandardMaterial({ map: AT.t, roughness: 0.6, metalness: 0, alphaTest: 0.5 });
    const im = new THREE.Mesh(mergeGeometries(isaretGeo), atlasMat);
    im.name = 'cevre-levha'; im.receiveShadow = true;
    genel.add(im);
    const cm = new THREE.Mesh(mergeGeometries(cikisGeo), new THREE.MeshStandardMaterial({ map: AT.t, emissiveMap: AT.t, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.4 }));
    cm.name = 'cevre-cikis';
    genel.add(cm);
  }
  if (camGeo.length) {
    const c = new THREE.Mesh(mergeGeometries(camGeo), M.cam);
    c.name = 'cevre-cam'; c.renderOrder = 3;
    parca.B.add(c);
  }
  const birlesim = { A: lib.sabitle(parca.A), B: lib.sabitle(parca.B), C: lib.sabitle(parca.C),
    catiA: lib.sabitle(catiH.A), catiB: lib.sabitle(catiH.B), catiC: lib.sabitle(catiH.C) };
  // VR uzaklık kırpması için hol sınırları
  const BOLGE = [
    { g: [parca.A, catiH.A], x0: A.x0, x1: A.x1, z0: A.z0, z1: A.z1 },
    { g: [parca.B, catiH.B], x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 },
  ];
  if (C) BOLGE.push({ g: [parca.C, catiH.C], x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1 });

  // ================================================================= GÜVERCİNLER
  // Kuklalar sahnede değil: her kare kukla iskeleti pozlanır, dünya matrisleri 4 InstancedMesh'e
  // kopyalanır (gövde, bacak, iç kanat, dış kanat) → 12 kuş 4 çizim.
  const HOL = {
    A: { x0: A.x0 + 1.5, x1: A.x1 - 1.5, z0: A.z0 + 1.5, z1: A.z1 - 1.5, ucus: 8.55 },
    B: { x0: B.x0 + 1.5, x1: B.x1 - 1.5, z0: B.z0 + 1.5, z1: B.z1 - 1.5, ucus: 9.6 },
  };
  if (C) HOL.C = { x0: C.x0 + 1.5, x1: C.x1 - 1.5, z0: C.z0 + 1.5, z1: C.z1 - 1.5, ucus: 8.55 };
  // duvar üstü tünekleri (iç yarı)
  for (const x of [-100, -88, -79, -64, -49, -15, 2, 18, 31, 41]) tunekler.A.push({ p: new THREE.Vector3(x, A.H, A.z0 + 0.06), yaw: -PI / 2 });
  for (const z of [-17, -6, 12, 20]) tunekler.A.push({ p: new THREE.Vector3(A.x0 + 0.06, A.H, z), yaw: 0 });
  for (const x of [50, 68, 80, 92, 110, 116]) tunekler.B.push({ p: new THREE.Vector3(x, B.H, B.z0 + 0.06), yaw: -PI / 2 });
  for (const z of [-28, -16, 6, 18, 30]) tunekler.B.push({ p: new THREE.Vector3(B.x1 - 0.06, B.H, z), yaw: PI });
  if (C) {
    tunekler.C = [];
    for (const x of [124, 133, 142, 151, 157]) tunekler.C.push({ p: new THREE.Vector3(x, C.H, C.z0 + 0.06), yaw: -PI / 2 });
    for (const z of [-15, -4, 9, 19]) tunekler.C.push({ p: new THREE.Vector3(C.x1 - 0.06, C.H, z), yaw: PI });
  }
  const ZEMIN = {
    A: [[-90, 21.4, 1.3], [-20, 21.5, 1.6], [12, 21.5, 1.4], [-50, 21.4, 1.4], [-93, 10.8, 0.8]],
    B: [[B.x0 + 16, 24.2, 1.6], [100, 31.8, 1.8], [B.x1 - 6.4, -19, 1.4], [B.x0 + 4, -18, 1.2]],
  };
  if (C) ZEMIN.C = [[C.x0 + 4, 21.5, 1.2], [C.x1 - 3.5, -21.5, 1.2], [C.x1 - 3, 21, 1.2]];
  const NK = 12;
  const kukla0 = lib.guvercin();
  const gIM = {
    govde: new THREE.InstancedMesh(kukla0.govde.geometry, kukla0.govde.material, NK),
    bacak: new THREE.InstancedMesh(kukla0.bacak.geometry, kukla0.bacak.material, NK),
    ic: new THREE.InstancedMesh(kukla0.wingL.children.find((c) => c.isMesh).geometry, kukla0.govde.material, NK * 2),
    dis: new THREE.InstancedMesh(kukla0.wingL.userData.elbow.children[0].geometry, kukla0.govde.material, NK * 2),
  };
  for (const [ad, im] of Object.entries(gIM)) {
    im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.name = 'cevre-guvercin-' + ad;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    kok.add(im);
  }
  const _sifir = new THREE.Matrix4().makeScale(0, 0, 0);
  const kuslar = [];
  for (let i = 0; i < NK; i++) {
    const k = i === 0 ? kukla0 : lib.guvercin();
    k.group.rotation.order = 'YZX';
    const b = {
      k, hol: C ? (i < 7 ? 'A' : i < 10 ? 'B' : 'C') : (i < 8 ? 'A' : 'B'), durum: 'tunek', t: 0, sure: ara(3, 25), faz: rnd() * 6.28,
      p: new THREE.Vector3(), yaw: 0, egil: 0, tunek: null, yurHedef: null, gaga: 0, ucus: null,
      icL: k.wingL.children.find((c) => c.isMesh), icR: k.wingR.children.find((c) => c.isMesh),
      disL: k.wingL.userData.elbow.children[0], disR: k.wingR.userData.elbow.children[0],
    };
    if (i % 3 === 2) {
      const z = secR(ZEMIN[b.hol]);
      b.durum = 'yer'; b.p.set(z[0] + ara(-z[2], z[2]) * 0.6, 0, z[1] + ara(-z[2], z[2]) * 0.6); b.zemin = z;
      b.yaw = rnd() * 6.28; k.kapat();
    } else {
      const t2 = tunekSec(b);
      if (t2) { b.p.copy(t2.p); b.yaw = t2.yaw; }
      k.kapat();
    }
    kuslar.push(b);
  }
  function tunekSec(b, uzak = null) {
    const bos = tunekler[b.hol].filter((t) => !t.dolu && (!uzak || t.p.distanceTo(uzak) > 6));
    if (!bos.length) return null;
    const t = secR(bos);
    t.dolu = true; b.tunek = t;
    return t;
  }
  function birak(b) { if (b.tunek) { b.tunek.dolu = false; b.tunek = null; } }
  function ucur(b, hedef, tur, yaw = null) {
    const h = HOL[b.hol];
    const p0 = b.p.clone(), p3 = hedef.clone();
    const yat = Math.hypot(p3.x - p0.x, p3.z - p0.z);
    const cy = Math.max(Math.min(h.ucus, Math.max(p0.y, p3.y) + 2.5), Math.min(p0.y, p3.y) + 1.2);
    const p1 = new THREE.Vector3().lerpVectors(p0, p3, 0.28); p1.y = Math.max(cy, p0.y + 0.3);
    const p2 = new THREE.Vector3().lerpVectors(p0, p3, 0.72); p2.y = Math.max(cy, p3.y + 0.3);
    b.ucus = { p0, p1, p2, p3, T: Math.max(1.6, yat / 6.2 + 0.7), tur, yaw };
    b.durum = 'ucus'; b.t = 0;
  }
  const _b0 = new THREE.Vector3(), _b1 = new THREE.Vector3();
  const bez = (u, U, o) => {
    const a = 1 - u;
    return o.set(0, 0, 0).addScaledVector(U.p0, a * a * a).addScaledVector(U.p1, 3 * a * a * u).addScaledVector(U.p2, 3 * a * u * u).addScaledVector(U.p3, u * u * u);
  };
  function kacKontrol(b, cam, camY, isciP) {
    const esik = b.durum === 'yer' ? 4.2 : 2.6;
    const yakin = (camY < 4.5 && b.p.distanceTo(cam) < esik) || (isciP && b.durum === 'yer' && Math.hypot(b.p.x - isciP.x, b.p.z - isciP.z) < 2.6);
    if (!yakin) return false;
    birak(b);
    const t = tunekSec(b, b.p);
    if (t) ucur(b, t.p, 'tunek', t.yaw);
    return !!t;
  }
  function kusGuncelle(b, dt, t, cam, camY, isciP) {
    const k = b.k;
    b.t += dt;
    if (b.durum !== 'ucus' && kacKontrol(b, cam, camY, isciP)) return;
    if (b.durum === 'tunek') {
      // tünekte: ara sıra dönüş, tüy düzeltme (eğilme), kafa sallama
      const tur = (t * 0.7 + b.faz) % 9;
      b.egil = tur < 0.6 ? Math.sin(tur / 0.6 * PI) * 0.35 : 0;
      if (b.t > b.sure) {
        birak(b);
        if (rnd() < 0.45) { const z = secR(ZEMIN[b.hol]); b.zemin = z; ucur(b, new THREE.Vector3(z[0] + ara(-z[2], z[2]) * 0.6, 0, z[1] + ara(-z[2], z[2]) * 0.6), 'yer'); }
        else { const t2 = tunekSec(b, b.p); if (t2) ucur(b, t2.p, 'tunek', t2.yaw); else b.t = 0; }
      }
    } else if (b.durum === 'yer') {
      // yerde: kısa adımlarla dolaşma + gagalama
      if (!b.yurHedef || b.p.distanceTo(b.yurHedef) < 0.05) {
        const z = b.zemin;
        b.yurHedef = new THREE.Vector3(z[0] + ara(-z[2], z[2]), 0, z[1] + ara(-z[2], z[2]) * 0.7);
        b.gaga = ara(0.4, 2.2);
      }
      if (b.gaga > 0) {
        b.gaga -= dt;
        b.egil = Math.max(0, Math.sin(b.gaga * 9)) * 0.95;
      } else {
        _b0.subVectors(b.yurHedef, b.p); _b0.y = 0;
        const d = _b0.length(), adim = Math.min(d, 0.32 * dt);
        if (d > 1e-4) { b.p.addScaledVector(_b0, adim / d); b.yaw = Math.atan2(-_b0.z, _b0.x); }
        b.egil = Math.abs(Math.sin(t * 11 + b.faz)) * 0.18;
        if (d < 0.05) b.gaga = ara(0.6, 2.0);
      }
      if (b.t > b.sure) { const t2 = tunekSec(b); if (t2) ucur(b, t2.p, 'tunek', t2.yaw); else b.t = 0; }
    } else {
      const U = b.ucus, u = Math.min(1, b.t / U.T);
      bez(u, U, b.p);
      bez(Math.min(1, u + 0.02), U, _b1);
      _b1.sub(b.p);
      const yat = Math.hypot(_b1.x, _b1.z);
      if (yat > 1e-5) b.yaw = Math.atan2(-_b1.z, _b1.x);
      b.pitch = Math.atan2(_b1.y, yat + 1e-5) * 0.55;
      b.egil = 0;
      if (u < 0.3 || u > 0.82) k.kanat(t, b.faz, 0.85, 12.5);
      else if (Math.sin(u * 9 + b.faz) > 0.2) k.suzul(0.16);
      else k.kanat(t, b.faz, 0.6, 9.5);
      if (u >= 1) {
        k.kapat();
        b.pitch = 0;
        b.durum = U.tur; b.t = 0; b.yurHedef = null; b.gaga = 0;
        b.sure = U.tur === 'yer' ? ara(10, 24) : ara(8, 32);
        if (U.yaw != null) b.yaw = U.yaw;
      }
    }
    k.egil(b.egil);
    k.group.position.set(b.p.x, b.p.y + k.yerden, b.p.z);
    k.group.rotation.set(0, b.yaw, b.durum === 'ucus' ? (b.pitch || 0) : 0);
  }
  function kusYaz(i, b) {
    const k = b.k;
    k.group.updateMatrixWorld(true);
    gIM.govde.setMatrixAt(i, k.govde.matrixWorld);
    gIM.bacak.setMatrixAt(i, k.bacak.visible ? k.bacak.matrixWorld : _sifir);
    gIM.ic.setMatrixAt(i * 2, b.icL.matrixWorld); gIM.ic.setMatrixAt(i * 2 + 1, b.icR.matrixWorld);
    gIM.dis.setMatrixAt(i * 2, b.disL.matrixWorld); gIM.dis.setMatrixAt(i * 2 + 1, b.disR.matrixWorld);
  }

  // ================================================================= İŞÇİ
  const isci = lib.operator({ baret: 0xf5f5f5, yelek: 0xff8a1f });
  isci.group.name = 'cevre-isci';
  isci.poz('yan');
  lib.sabitle(isci.group, isci.group.children.filter((c) => c.isGroup));
  kok.add(isci.group);
  const IS = { i: 0, yon: 1, bekle: ROTA[0].bekle, p: new THREE.Vector3(ROTA[0].p[0], 0, ROTA[0].p[1]), yaw: Math.atan2(ROTA[0].bak[0], ROTA[0].bak[1]), hareket: false };
  isci.poz(ROTA[0].poz || 'on');
  function isciGuncelle(dt, t) {
    if (IS.bekle > 0) {
      IS.bekle -= dt; IS.hareket = false;
      const n = ROTA[IS.i];
      if (n.bak) IS.yaw = donus(IS.yaw, Math.atan2(n.bak[0], n.bak[1]), dt * 4);
      if (IS.bekle <= 0) {
        if (IS.i === ROTA.length - 1) IS.yon = -1; else if (IS.i === 0) IS.yon = 1;
        IS.i += IS.yon; isci.poz('yan');
      }
    } else {
      const n = ROTA[IS.i];
      _d.set(n.p[0] - IS.p.x, 0, n.p[1] - IS.p.z);
      const d = _d.length();
      IS.hareket = true;
      if (d < 0.05) {
        if (n.bekle) { IS.bekle = n.bekle; isci.poz(n.poz || 'on'); }
        else {
          if (IS.i === ROTA.length - 1) IS.yon = -1; else if (IS.i === 0) IS.yon = 1;
          IS.i += IS.yon;
        }
      } else {
        IS.p.addScaledVector(_d, Math.min(d, 1.3 * dt) / d);
        IS.yaw = donus(IS.yaw, Math.atan2(_d.x, _d.z), dt * 6);
      }
    }
    const bob = isci.yuru(t, IS.hareket);
    isci.group.position.set(IS.p.x, bob, IS.p.z);
    isci.group.rotation.y = IS.yaw;
  }
  function donus(a, b, k) {
    let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI;
    return a + d * Math.min(1, k);
  }

  // ================================================================= GÜNCELLEME
  const _cam = new THREE.Vector3();
  const CATI_ESIK = A.H - 1.6;   // armatürlerin altı: kamera bunun altındayken çatı görünür
  function update(dt, t, vrde = false) {
    camera.getWorldPosition(_cam);
    const camY = _cam.y;
    const ic = vrde || camY < CATI_ESIK;
    if (cati.visible !== ic) cati.visible = ic;
    if (ic && toz) tozGuncelle(dt, t);
    for (const b of BOLGE) {
      const dx = Math.max(b.x0 - _cam.x, 0, _cam.x - b.x1), dz = Math.max(b.z0 - _cam.z, 0, _cam.z - b.z1);
      const gor = !vrde || Math.hypot(dx, dz) < 24;   // VR sisi (uzak ≤ 34 m) içinde kalan hol
      for (const g of b.g) if (g.visible !== gor) g.visible = gor;
    }
    isciGuncelle(dt, t);
    for (let i = 0; i < kuslar.length; i++) { kusGuncelle(kuslar[i], dt, t, _cam, camY, IS.p); kusYaz(i, kuslar[i]); }
    for (const im of Object.values(gIM)) im.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);

  return {
    update, kok, cati, kuslar, isci: IS, cakisma, dolu, birlesim, tunekler,
    _sayac() { let n = 0; kok.traverseVisible((o) => { if (o.isMesh || o.isPoints) n++; }); return n; },
  };

  // ================================================================= dokular
  function atlasKur() {
    const W = 2048, H = 1024, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    const hc = {};
    const yaz = (s, cx, cy, boy, renk, kalin = 700, max = 0) => {
      x.font = `${kalin} ${boy}px "Space Grotesk", "Segoe UI", sans-serif`;
      x.fillStyle = renk; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (max) x.fillText(s, cx, cy, max); else x.fillText(s, cx, cy);
    };
    // 1) kolon plakaları 256×128 (sarı zemin, siyah çerçeve)
    const PL = [];
    for (let i = 1; i <= 10; i++) PL.push(`A-${String(i).padStart(2, '0')}`);
    for (let i = 1; i <= 12; i++) PL.push(`B-${String(i).padStart(2, '0')}`);
    PL.forEach((ad, i) => {
      const cx = (i % 8) * 256, cy = Math.floor(i / 8) * 128;
      x.fillStyle = '#f2c200'; x.fillRect(cx + 4, cy + 4, 248, 120);
      x.strokeStyle = '#111'; x.lineWidth = 7; x.strokeRect(cx + 12, cy + 12, 232, 104);
      yaz(ad, cx + 128, cy + 68, 66, '#111');
      hc[ad] = [cx + 4, cy + 4, cx + 252, cy + 124];
    });
    // 2) levhalar 256×256, y = 384
    const lv = (ad, i, ciz, s1, s2) => {
      const cx = i * 256, cy = 384;
      x.fillStyle = '#fafafa'; x.fillRect(cx + 4, cy + 4, 248, 248);
      x.strokeStyle = '#9aa0a6'; x.lineWidth = 3; x.strokeRect(cx + 6, cy + 6, 244, 244);
      ciz(cx, cy);
      yaz(s1, cx + 128, cy + 206, 30, '#111', 700, 236);
      if (s2) yaz(s2, cx + 128, cy + 234, 22, '#333', 600, 236);
      hc[ad] = [cx + 4, cy + 4, cx + 252, cy + 252];
    };
    const ucgen = (cx, cy) => {
      x.beginPath(); x.moveTo(cx + 128, cy + 22); x.lineTo(cx + 226, cy + 180); x.lineTo(cx + 30, cy + 180); x.closePath();
      x.fillStyle = '#f2c200'; x.fill(); x.lineJoin = 'round'; x.lineWidth = 11; x.strokeStyle = '#111'; x.stroke();
    };
    const daire = (cx, cy, renk) => { x.beginPath(); x.arc(cx + 128, cy + 100, 78, 0, PI * 2); x.fillStyle = renk; x.fill(); };
    const kare = (cx, cy, renk) => { x.fillStyle = renk; x.fillRect(cx + 46, cy + 20, 164, 164); };
    lv('forklift', 0, (cx, cy) => {
      ucgen(cx, cy); x.fillStyle = '#111';
      x.fillRect(cx + 94, cy + 120, 48, 26); x.fillRect(cx + 104, cy + 98, 7, 24); x.fillRect(cx + 104, cy + 95, 30, 6);
      x.fillRect(cx + 146, cy + 86, 7, 62); x.fillRect(cx + 146, cy + 143, 30, 5);
      for (const wx of [104, 134]) { x.beginPath(); x.arc(cx + wx, cy + 150, 9, 0, PI * 2); x.fill(); }
    }, 'DİKKAT', 'FORKLİFT ÇALIŞMA ALANI');
    lv('agv', 1, (cx, cy) => {
      ucgen(cx, cy); x.fillStyle = '#111';
      x.fillRect(cx + 90, cy + 128, 76, 20); x.fillRect(cx + 100, cy + 112, 56, 16);
      x.fillRect(cx + 106, cy + 100, 6, 12); x.beginPath(); x.arc(cx + 109, cy + 96, 7, 0, PI * 2); x.fill();
      for (const wx of [102, 154]) { x.beginPath(); x.arc(cx + wx, cy + 152, 7, 0, PI * 2); x.fill(); }
    }, 'DİKKAT', 'OTONOM ARAÇ (AGV) YOLU');
    lv('gerilim', 2, (cx, cy) => {
      ucgen(cx, cy); x.fillStyle = '#111'; x.beginPath();
      [[138, 66], [104, 128], [128, 128], [112, 172], [154, 108], [130, 108], [148, 66]].forEach(([a, b], i) => (i ? x.lineTo(cx + a, cy + b) : x.moveTo(cx + a, cy + b)));
      x.closePath(); x.fill();
    }, 'DİKKAT', 'YÜKSEK GERİLİM');
    lv('baret', 3, (cx, cy) => {
      daire(cx, cy, '#1d5ea8'); x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx + 128, cy + 114, 44, PI, 0); x.fill(); x.fillRect(cx + 74, cy + 112, 108, 13);
      x.fillStyle = '#1d5ea8'; x.fillRect(cx + 123, cy + 72, 10, 40);
    }, 'BARET TAKINIZ');
    lv('kulak', 4, (cx, cy) => {
      daire(cx, cy, '#1d5ea8'); x.strokeStyle = '#fff'; x.lineWidth = 11;
      x.beginPath(); x.arc(cx + 128, cy + 106, 42, PI * 1.05, PI * 1.95); x.stroke();
      x.fillStyle = '#fff';
      for (const ex of [86, 170]) { x.beginPath(); x.ellipse(cx + ex, cy + 116, 15, 24, 0, 0, PI * 2); x.fill(); }
    }, 'KULAKLIK TAKINIZ');
    lv('tup', 5, (cx, cy) => {
      kare(cx, cy, '#c61f1c'); x.fillStyle = '#fff';
      x.beginPath(); x.roundRect(cx + 108, cy + 70, 40, 100, 14); x.fill();
      x.fillRect(cx + 120, cy + 54, 16, 18); x.fillRect(cx + 112, cy + 48, 40, 8);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx + 150, cy + 52); x.quadraticCurveTo(cx + 180, cy + 60, cx + 170, cy + 110); x.stroke();
    }, 'YANGIN TÜPÜ');
    lv('ilkyardim', 6, (cx, cy) => {
      kare(cx, cy, '#1f9d4c'); x.fillStyle = '#fff';
      x.fillRect(cx + 106, cy + 52, 44, 100); x.fillRect(cx + 78, cy + 80, 100, 44);
    }, 'İLK YARDIM');
    lv('sigara', 7, (cx, cy) => {
      x.fillStyle = '#fff'; x.fillRect(cx + 70, cy + 92, 104, 18); x.fillStyle = '#e08a2a'; x.fillRect(cx + 154, cy + 92, 20, 18);
      x.strokeStyle = '#111'; x.lineWidth = 3; x.strokeRect(cx + 70, cy + 92, 104, 18);
      x.strokeStyle = '#555'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx + 64, cy + 86); x.bezierCurveTo(cx + 52, cy + 70, cx + 74, cy + 60, cx + 62, cy + 44); x.stroke();
      x.strokeStyle = '#c61f1c'; x.lineWidth = 18; x.beginPath(); x.arc(cx + 128, cy + 100, 72, 0, PI * 2); x.stroke();
      x.beginPath(); x.moveTo(cx + 77, cy + 49); x.lineTo(cx + 179, cy + 151); x.stroke();
    }, 'SİGARA İÇİLMEZ');
    // 3) zemin yazıları 512×128 (arka plan saydam → alphaTest ile boyanmış yazı)
    const zy = (ad, i, s, renk = '#f2c200') => {
      const cx = (i % 4) * 512, cy = 640 + Math.floor(i / 4) * 128;
      x.lineWidth = 6; x.strokeStyle = 'rgba(20,20,20,0.9)';
      x.font = `700 74px "Space Grotesk", "Segoe UI", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.strokeText(s, cx + 256, cy + 66, 480);
      yaz(s, cx + 256, cy + 66, 74, renk, 700, 480);
      hc[ad] = [cx + 4, cy + 4, cx + 508, cy + 124];
    };
    zy('bakim', 0, 'BAKIM ATÖLYESİ'); zy('kalite', 1, 'KALİTE KONTROL', '#e8eef5'); zy('hammadde', 2, 'HAMMADDE', '#e8eef5'); zy('sevkiyat', 3, 'SEVKİYAT');
    zy('mola', 4, 'MOLA ALANI', '#e8eef5'); zy('atik', 5, 'ATIK / GERİ DÖNÜŞÜM'); zy('redtag', 6, 'RED TAG', '#ff5a4a'); zy('agvdurak', 7, 'AGV DURAK');
    // 4) acil çıkış (ışıklı) + ofis tabelası + zemin çıkış oku, y = 896
    {
      const cx = 0, cy = 896;
      x.fillStyle = '#1f9d4c'; x.fillRect(cx + 4, cy + 4, 504, 120);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(cx + 20, cy + 22, 70, 84);
      x.lineCap = 'round'; x.lineWidth = 9;
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 128, cy + 34, 10, 0, PI * 2); x.fill();
      const ciz = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(cx + a, cy + b) : x.moveTo(cx + a, cy + b))); x.stroke(); };
      ciz([[124, 48], [114, 76]]); ciz([[114, 76], [130, 92], [126, 112]]); ciz([[114, 76], [98, 92], [86, 96]]);
      ciz([[122, 54], [140, 66], [150, 58]]); ciz([[122, 54], [104, 60], [98, 72]]);
      x.lineWidth = 8; ciz([[170, 64], [200, 64]]); ciz([[188, 52], [202, 64], [188, 76]]);
      yaz('ACİL ÇIKIŞ', cx + 350, cy + 66, 58, '#fff', 700, 280);
      hc.cikis = [cx + 4, cy + 4, cx + 508, cy + 124];
    }
    {
      const cx = 512, cy = 896;
      x.fillStyle = '#17324f'; x.fillRect(cx + 4, cy + 4, 504, 120);
      x.fillStyle = '#f2c200'; x.fillRect(cx + 4, cy + 108, 504, 16);
      yaz('KALİTE · PLANLAMA OFİSİ', cx + 256, cy + 58, 44, '#fff', 700, 480);
      hc.ofis = [cx + 4, cy + 4, cx + 508, cy + 124];
    }
    {
      const cx = 1024, cy = 896;
      x.fillStyle = '#1f9d4c';
      x.beginPath(); x.moveTo(cx + 40, cy + 50); x.lineTo(cx + 330, cy + 50); x.lineTo(cx + 330, cy + 24); x.lineTo(cx + 470, cy + 64);
      x.lineTo(cx + 330, cy + 104); x.lineTo(cx + 330, cy + 78); x.lineTo(cx + 40, cy + 78); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(20,20,20,0.85)'; x.lineWidth = 4; x.stroke();
      hc.cikisZ = [cx + 4, cy + 4, cx + 508, cy + 124];
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = lib.kalite.anisotropi;
    return { t, hc, W, H };
  }

  // Sandviç panel duvar: 1 m yüksekliğinde yatay paneller (derz + mikro nervür), 6 m'de bir dikey
  // ek yeri, altta 60 cm koyu beton kaide. Desen dünya koordinatından üretilir (UV gerekmez);
  // nervür kabartması yakında türev tabanlı bump ile, uzakta söner (titreşim yok).
  function duvarPaneli(m) {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPnlPos;\nvarying vec3 vPnlNrm;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPnlPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvPnlNrm = normalize( mat3( modelMatrix ) * objectNormal );');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPnlPos;\nvarying vec3 vPnlNrm;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float uz = length( vViewPosition );
  float yak = 1.0 - smoothstep( 10.0, 32.0, uz );
  float cizgiS = 1.0 - smoothstep( 40.0, 95.0, uz );
  float y = vPnlPos.y;
  float u = abs( vPnlNrm.x ) > 0.5 ? vPnlPos.z : vPnlPos.x;
  float py = fract( ( y - 0.6 ) );
  float derz = ( 1.0 - smoothstep( 0.0, 0.018, py ) * smoothstep( 0.0, 0.018, 1.0 - py ) ) * cizgiS;
  float pu = fract( u / 6.0 + 0.5 );
  float ek = ( 1.0 - smoothstep( 0.0, 0.0035, pu ) * smoothstep( 0.0, 0.0035, 1.0 - pu ) ) * cizgiS;
  float nerv = 0.5 + 0.5 * cos( 6.2831853 * ( y - 0.6 ) / 0.2 );
  float kaide = 1.0 - smoothstep( 0.585, 0.605, y );
  float ust = 1.0 - kaide;
  diffuseColor.rgb *= mix( 1.0, 0.8, max( derz, ek ) * ust ) * mix( 1.0, 0.975 + 0.05 * nerv, yak * ust );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.29, 0.30, 0.31 ), kaide * 0.9 );
  float hb = ( nerv * 0.0022 * yak - ( derz + ek ) * 0.0035 ) * ust;
  vec3 dpx = dFdx( - vViewPosition ), dpy = dFdy( - vViewPosition );
  vec3 r1 = cross( dpy, normal ), r2 = cross( normal, dpx );
  float det = dot( dpx, r1 );
  vec3 grad = sign( det ) * ( dFdx( hb ) * r1 + dFdy( hb ) * r2 );
  normal = normalize( abs( det ) * normal - grad );
}`);
    };
    m.customProgramCacheKey = () => 'duvarPanel1';
    m.needsUpdate = true;
  }
}
