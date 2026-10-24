// js/machines/sunucu.js — Sunucu Odası · Web & Veri Altyapısı (C holü, Ar-Ge & BT bölümü).
//
// Kaan'ın isteği (2026-10-24): "web sunucu vb işleri için GitHub repolarıma bakıp oradan
// projeler koyabilirsin; sanal fabrikada web sunucular için de bir alan olsun".
//
// Portföydeki iş: 5+ web sunucusu kurulumu, Linux + Docker + Nginx (ters vekil, SSL/TLS),
// şirket sitesi 5 yıl %99 çalışma oranı, endüstriyel veri görselleştirme, özel e-posta.
// GitHub depolarından YÜKSEK SEVİYEDE (iç adres / parola / müşteri verisi yok):
//   dokamuh            → kurumsal WordPress sitesi (cPanel barındırma, yedek, bakım, SEO)
//   arkoz-web-sitesi   → çok sayfalı statik ürün sitesi (JSON-LD, çok dilli)
//   yandex-mail-agent  → IMAP → SQLite e-posta analiz paneli (artımlı senkron, HTTPS + kimlik)
//   doka-teklif-agent  → Excel şablonunu bozmadan teklif + PDF üretimi
//   ai-call-router     → Asterisk / PJSIP tabanlı TR/EN IVR çağrı yönlendirme
//   plc_pc             → PLC ↔ PC Modbus TCP veri köprüsü
//   pompa test / konteyner Flutter uygulamaları → GitHub Actions derleme + test hattı
//   fabrika, kaankirsan.github.io → GitHub Pages yayınları
//
// Oda TEMSİLİDİR: gerçek altyapı birkaç sunucu + paylaşımlı barındırmadır. Yerel çerçeve:
// cam oda x −9…3, z −4.6…2.4 (yükseltilmiş döşeme 0.3 m), sağında NOC (izleme masası +
// 3 ekranlı video duvarı). Önü (+Z) koridora bakar.

import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export function create(lib) {
  const { THREE, M, box, cyl, mat, lamba, levha, Ekran, Trend, kuleLambasi, canvasTex, clamp, approach, damp, fmt, gurultu } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ölçüler
  const RX0 = -9, RX1 = 3, RZ0 = -4.6, RZ1 = 2.4, RH = 3.0, FL = 0.3;   // cam oda + yükseltilmiş döşeme
  const RXC = (RX0 + RX1) / 2, RZC = (RZ0 + RZ1) / 2;
  const KAPI_X = -1.2, KAPI_W = 1.4, KAPI_H = 2.3;                     // otomatik kayar kapı (ön cam)
  const RAF = { w: 0.6, h: 2.0, d: 1.07 };
  const SIRA_L = -5.9, SIRA_R = -3.3;                                  // soğuk koridor podu (sıralar z boyunca)
  const RAF_Z = [-3.65, -3.05, -2.45, -1.85, -1.25];
  const POD_Z0 = -3.95, POD_Z1 = -0.95;
  const KOR_X0 = SIRA_L + RAF.d / 2, KOR_X1 = SIRA_R - RAF.d / 2;      // soğuk koridor −5.365 … −3.835
  const KOR_XC = (KOR_X0 + KOR_X1) / 2;

  const camMat = new THREE.MeshStandardMaterial({
    color: 0xa9c8d8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false,
  });
  const rafMat = mat(0x1a1e23, { r: 0.55, m: 0.45, key: 'sv-raf' });
  const cerceve = M.alu;
  const panelGri = mat(0x9aa1a8, { r: 0.6, m: 0.2, key: 'sv-panel' });
  const cihazAcik = mat(0xdfe3e6, { r: 0.5, m: 0.15, key: 'sv-cihaz' });
  const cihazKoyu = mat(0x2b3138, { r: 0.55, m: 0.3, key: 'sv-cihaz2' });

  // ---------------------------------------------------------------- yükseltilmiş döşeme (60 cm karolar)
  const karoTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b9bec2'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60 | 0},${95 + Math.random() * 60 | 0},${100 + Math.random() * 60 | 0},0.18)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = '#7e858b'; x.lineWidth = 6; x.strokeRect(0, 0, w, h);
    x.strokeStyle = '#d3d7da'; x.lineWidth = 2; x.strokeRect(5, 5, w - 10, h - 10);
  }, { tekrar: [(RX1 - RX0) / 0.6, (RZ1 - RZ0) / 0.6] });
  const doseme = box(RX1 - RX0, FL, RZ1 - RZ0, new THREE.MeshStandardMaterial({ map: karoTex, roughness: 0.55, metalness: 0.05 }), RXC, FL / 2, RZC, g);
  doseme.castShadow = false;
  // soğuk koridorda delikli karolar
  const delikTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#aeb4b9'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3b4248';
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { x.beginPath(); x.arc(6 + i * 10.4, 6 + j * 10.4, 3, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = '#7e858b'; x.lineWidth = 4; x.strokeRect(0, 0, w, h);
  }, { tekrar: [(KOR_X1 - KOR_X0) / 0.6, (POD_Z1 - POD_Z0) / 0.6] });
  const delikli = new THREE.Mesh(new THREE.PlaneGeometry(KOR_X1 - KOR_X0, POD_Z1 - POD_Z0),
    new THREE.MeshStandardMaterial({ map: delikTex, roughness: 0.5, metalness: 0.2 }));
  delikli.rotation.x = -Math.PI / 2;
  delikli.position.set(KOR_XC, FL + 0.003, (POD_Z0 + POD_Z1) / 2);
  delikli.receiveShadow = true;
  g.add(delikli);
  // kapı önü rampa (0.3 m → 0, 0.9 m boyunca)
  const rampa = box(KAPI_W + 0.2, 0.06, 0.95, panelGri, KAPI_X, FL / 2 - 0.01, RZ1 + 0.45, g);
  rampa.rotation.x = -Math.atan2(FL, 0.9);
  for (const s of [-1, 1]) box(0.05, 0.02, 0.95, M.sari, KAPI_X + s * (KAPI_W / 2 + 0.08), FL / 2 + 0.02, RZ1 + 0.45, g).rotation.x = -Math.atan2(FL, 0.9);

  // ---------------------------------------------------------------- cam duvarlar (tek birleşik mesh) + alüminyum kayıtlar
  // birden çok kutuyu tek geometriye birleştir (hareketli gruplarda tek çizim çağrısı)
  const kutular = (liste) => mergeGeometries(liste.map(([w, h, d, x, y, z]) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return b; }));
  const camParcalar = [];
  const camKutu = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); camParcalar.push(b); };
  const camH = RH - FL;
  // ön (z = RZ1): kapı boşluğu hariç
  const kL = KAPI_X - KAPI_W / 2, kR = KAPI_X + KAPI_W / 2;
  camKutu(kL - RX0, camH, 0.02, (RX0 + kL) / 2, FL + camH / 2, RZ1);
  camKutu(RX1 - kR, camH, 0.02, (kR + RX1) / 2, FL + camH / 2, RZ1);
  camKutu(KAPI_W, RH - FL - KAPI_H, 0.02, KAPI_X, FL + KAPI_H + (RH - FL - KAPI_H) / 2, RZ1);   // kapı üstü
  // yanlar
  camKutu(0.02, camH, RZ1 - RZ0, RX0, FL + camH / 2, RZC);
  camKutu(0.02, camH, RZ1 - RZ0, RX1, FL + camH / 2, RZC);
  // soğuk koridor tavanı + arka uç kapısı (sabit cam)
  camKutu(KOR_X1 - KOR_X0, 0.012, POD_Z1 - POD_Z0, KOR_XC, FL + RAF.h + 0.02, (POD_Z0 + POD_Z1) / 2);
  camKutu(KOR_X1 - KOR_X0, RAF.h, 0.015, KOR_XC, FL + RAF.h / 2, POD_Z0);
  const camMesh = new THREE.Mesh(mergeGeometries(camParcalar), camMat);
  camMesh.renderOrder = 2;
  g.add(camMesh);
  // arka duvar (dolu panel, z = RZ0)
  box(RX1 - RX0, RH, 0.12, panelGri, RXC, RH / 2, RZ0 - 0.06, g);
  // kayıtlar: dikmeler 1.2 m'de bir, alt/üst raylar
  const dikme = (x, z) => box(0.06, RH - FL, 0.06, cerceve, x, FL + (RH - FL) / 2, z, g);
  for (let x = RX0; x <= RX1 + 0.01; x += 1.2) { if (x > kL - 0.05 && x < kR + 0.05) continue; dikme(x, RZ1); }
  dikme(kL, RZ1); dikme(kR, RZ1);
  for (let z = RZ0 + 1.4; z < RZ1; z += 1.4) { dikme(RX0, z); dikme(RX1, z); }
  for (const y of [FL + 0.03, RH]) {
    box(RX1 - RX0 + 0.06, 0.07, 0.07, cerceve, RXC, y, RZ1, g);
    box(0.07, 0.07, RZ1 - RZ0, cerceve, RX0, y, RZC, g);
    box(0.07, 0.07, RZ1 - RZ0, cerceve, RX1, y, RZC, g);
  }
  box(KAPI_W + 0.1, 0.08, 0.1, cerceve, KAPI_X, FL + KAPI_H, RZ1, g);          // kapı lentosu
  box(KAPI_W * 2 + 0.1, 0.09, 0.08, cerceve, KAPI_X - KAPI_W / 2 + 0.05, FL + KAPI_H + 0.08, RZ1 + 0.08, g);   // kapı rayı / motor kutusu
  // tabela (ön üst kayıt)
  const tabela = levha(['SUNUCU ODASI', 'Web & Veri Altyapısı · Linux · Docker · Nginx'], 3.8, 0.54, { bg: '#0f2233', font: 86, px: 1100 });
  tabela.position.set(-3.6, RH + 0.4, RZ1 + 0.02);
  g.add(tabela);
  box(3.9, 0.62, 0.04, cihazKoyu, -3.6, RH + 0.4, RZ1 - 0.01, g);
  for (const dx of [-1.6, 1.6]) box(0.05, 0.42, 0.05, cerceve, -3.6 + dx, RH + 0.12, RZ1, g);
  const yetkili = levha(['⚠ YETKİLİ PERSONEL', 'Kartlı geçiş · Soğuk koridor'], 0.78, 0.28, { bg: '#f2d200', fg: '#111', font: 44, px: 620, kenar: '#111' });
  yetkili.position.set(kR + 0.45, FL + 1.55, RZ1 + 0.015);
  g.add(yetkili);
  // kart okuyucu
  box(0.08, 0.13, 0.03, cihazKoyu, kR + 0.15, FL + 1.25, RZ1 + 0.03, g);
  const kartLed = lamba(0x2ea043, 1.6);
  box(0.02, 0.02, 0.01, kartLed, kR + 0.15, FL + 1.29, RZ1 + 0.047, g);

  // otomatik kayar kapı (cam kanat + kayıtlar): kapalıyken boşlukta, açılırken sol sabit camın önüne kayar
  const kapi = new THREE.Group();
  kapi.position.set(KAPI_X, 0, RZ1 + 0.05);
  const kanat = new THREE.Mesh(new THREE.BoxGeometry(KAPI_W, KAPI_H - 0.02, 0.02), camMat);
  kanat.position.y = FL + KAPI_H / 2;
  kanat.renderOrder = 2;
  kapi.add(kanat);
  const kapiKayit = new THREE.Mesh(kutular([
    [0.05, KAPI_H, 0.05, -KAPI_W / 2, FL + KAPI_H / 2, 0], [0.05, KAPI_H, 0.05, KAPI_W / 2, FL + KAPI_H / 2, 0],
    [KAPI_W, 0.05, 0.05, 0, FL + 0.03, 0], [KAPI_W, 0.05, 0.05, 0, FL + KAPI_H - 0.03, 0],
    [0.03, 0.35, 0.04, KAPI_W / 2 - 0.12, FL + 1.05, 0.03],                                   // kol
  ]), cerceve);
  kapiKayit.castShadow = true;
  kapi.add(kapiKayit);
  g.add(kapi);
  let kapiAc = 0;

  // ---------------------------------------------------------------- raf ön yüzleri (canvas doku, iki çeşit) + LED konumları
  const U = 10, UST = 14, TW = 128, TH = 448;                     // doku: 42U × 10 px + kenarlar
  const yuzW = 0.56, yuzH = 1.86;
  function rafDuzeni(cesit) {
    const kalip = cesit === 'A'
      ? ['srv2', 'srv2', 'srv1', 'srv1', 'srv1', 'srv1', 'bos', 'srv2', 'srv2', 'srv1', 'srv1', 'sto', 'bos', 'srv1', 'srv1', 'srv2', 'bos']
      : ['sto', 'sto', 'bos', 'srv2', 'srv1', 'srv1', 'srv2', 'bos', 'sto', 'srv1', 'srv1', 'bos'];
    const H = { srv1: 1, srv2: 2, sto: 4, bos: 1, sw: 1 };
    const liste = []; let u = 2; let i = 0;
    while (true) {
      const tip = kalip[i % kalip.length]; i++;
      if (u + H[tip] > 39) break;
      liste.push({ u, h: H[tip], tip }); u += H[tip];
    }
    liste.push({ u: 40, h: 1, tip: 'sw' }, { u: 41, h: 1, tip: 'sw' });
    return liste;
  }
  function rafDoku(liste) {
    const ledler = [];
    const tex = canvasTex(TW, TH, (x) => {
      x.fillStyle = '#0d0f12'; x.fillRect(0, 0, TW, TH);
      x.fillStyle = '#2a2f36'; x.fillRect(0, 0, 9, TH); x.fillRect(TW - 9, 0, 9, TH);
      x.fillStyle = '#14171b';
      for (let k = 0; k < 42; k++) { x.fillRect(3, UST + k * U + 4, 3, 2); x.fillRect(TW - 6, UST + k * U + 4, 3, 2); }
      for (const b of liste) {
        const y = TH - UST - (b.u - 1 + b.h) * U, hh = b.h * U, x0 = 11, w = TW - 22;
        const vMerkez = (yy) => 1 - (yy) / TH;
        if (b.tip === 'bos') { x.fillStyle = '#121417'; x.fillRect(x0, y + 1, w, hh - 2); continue; }
        if (b.tip === 'sw') {
          x.fillStyle = '#3a4048'; x.fillRect(x0, y + 1, w, hh - 2);
          for (let p = 0; p < 12; p++) { x.fillStyle = '#16191d'; x.fillRect(x0 + 18 + p * 7, y + 2, 5, 3); x.fillRect(x0 + 18 + p * 7, y + 6, 5, 3); }
          for (let p = 0; p < 6; p++) ledler.push({ u: (x0 + 20 + p * 14) / TW, v: vMerkez(y + 1.5), tip: 'port' });
          continue;
        }
        x.fillStyle = b.tip === 'sto' ? '#20242a' : b.tip === 'srv2' ? '#1d2127' : '#24292f';
        x.fillRect(x0, y + 1, w, hh - 2);
        if (b.tip === 'sto') {
          for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { x.fillStyle = '#a9b0b6'; x.fillRect(x0 + 6 + c * 22, y + 4 + r * 11, 18, 8); x.fillStyle = '#e08a1e'; x.fillRect(x0 + 6 + c * 22, y + 4 + r * 11, 3, 8); }
        } else {
          const n = b.tip === 'srv2' ? 8 : 4, sat = b.tip === 'srv2' ? 2 : 1;
          for (let r = 0; r < sat; r++) for (let c = 0; c < n / sat; c++) { x.fillStyle = '#8d949b'; x.fillRect(x0 + 5 + c * 13, y + 2.5 + r * 9.5, 11, 6); }
          x.fillStyle = '#30363d'; for (let k = 0; k < 6; k++) x.fillRect(x0 + 62 + k * 4, y + 2, 2, hh - 4);
        }
        const yc = y + hh / 2;
        ledler.push({ u: (TW - 18) / TW, v: vMerkez(yc), tip: 'guc' }, { u: (TW - 13) / TW, v: vMerkez(yc), tip: 'akt' });
      }
    });
    return { tex, ledler };
  }
  const CESIT = { A: rafDoku(rafDuzeni('A')), B: rafDoku(rafDuzeni('B')) };
  // ağ rafı: yama paneli + anahtar ağırlıklı
  const AG = (() => {
    const liste = [];
    for (let u = 4; u <= 38; u += 2) liste.push({ u, h: 1, tip: 'sw' });
    for (let u = 5; u <= 37; u += 4) liste.push({ u, h: 1, tip: 'srv1' });
    return rafDoku(liste);
  })();

  // ---------------------------------------------------------------- raflar (instanced gövde + yüz) — sıra L ön yüzü +X, sıra R ön yüzü −X
  const raflar = [];   // { x, z, yon (+1: yüz +X, −1: yüz −X), cesit, servis }
  RAF_Z.forEach((z, i) => raflar.push({ x: SIRA_L, z, yon: 1, cesit: i % 2 ? 'B' : 'A' }));
  RAF_Z.forEach((z, i) => raflar.push({ x: SIRA_R, z, yon: -1, cesit: i % 2 ? 'A' : 'B' }));
  const govdeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(RAF.d, RAF.h, RAF.w), rafMat, raflar.length);
  govdeIM.castShadow = true; govdeIM.receiveShadow = true;
  const yuzGeo = new THREE.PlaneGeometry(yuzW, yuzH);
  const yuzMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x444444, emissiveIntensity: 0.6, roughness: 0.55, metalness: 0.3 });
  const yuzA = new THREE.InstancedMesh(yuzGeo, yuzMat(CESIT.A.tex), raflar.filter((r) => r.cesit === 'A').length);
  const yuzB = new THREE.InstancedMesh(yuzGeo, yuzMat(CESIT.B.tex), raflar.filter((r) => r.cesit === 'B').length);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const _yUp = new THREE.Vector3(0, 1, 0);
  const ledKayit = [];   // { raf, tip, m (Matrix4) }
  let ia = 0, ib = 0;
  const yuzMatrisi = (px, py, pz, ry) => { _q.setFromAxisAngle(_yUp, ry); return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), _q.clone(), _s); };
  const ledEkle = (yuzM, ledler, rafNo) => {
    for (const l of ledler) {
      const lm = yuzM.clone().multiply(new THREE.Matrix4().makeTranslation((l.u - 0.5) * yuzW, (l.v - 0.5) * yuzH, 0.008));
      ledKayit.push({ raf: rafNo, tip: l.tip, m: lm });
    }
  };
  raflar.forEach((r, i) => {
    _p.set(r.x, FL + RAF.h / 2, r.z); _q.identity();
    _m.compose(_p, _q, _s); govdeIM.setMatrixAt(i, _m);
    const fx = r.x + r.yon * (RAF.d / 2 + 0.004);
    const yM = yuzMatrisi(fx, FL + RAF.h / 2, r.z, r.yon > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (r.cesit === 'A') yuzA.setMatrixAt(ia++, yM); else yuzB.setMatrixAt(ib++, yM);
    ledEkle(yM, CESIT[r.cesit].ledler, i);
  });
  [govdeIM, yuzA, yuzB].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); g.add(m); });
  // raf üstü/arka detay: sıra arkasında (sıcak koridor) kablo yöneticileri, üstte kablo tavaları
  for (const xs of [SIRA_L - RAF.d / 2 - 0.02, SIRA_R + RAF.d / 2 + 0.02]) {
    box(0.04, RAF.h - 0.1, POD_Z1 - POD_Z0 - 0.1, cihazKoyu, xs, FL + RAF.h / 2, (POD_Z0 + POD_Z1) / 2, g);
  }
  const tavaSari = mat(0xf2b600, { r: 0.5, key: 'sv-tava' });
  for (const x of [SIRA_L, SIRA_R]) {
    box(0.3, 0.08, POD_Z1 - POD_Z0 + 0.6, tavaSari, x, FL + RAF.h + 0.42, (POD_Z0 + POD_Z1) / 2 - 0.3, g);
    box(0.45, 0.04, POD_Z1 - POD_Z0 + 1.6, M.siyah, x, FL + RAF.h + 0.62, (POD_Z0 + POD_Z1) / 2 - 0.8, g);
    for (const z of [POD_Z0 + 0.3, POD_Z1 - 0.3]) box(0.03, 0.62, 0.03, M.celik, x, FL + RAF.h + 0.31, z, g);
  }
  box(SIRA_R - SIRA_L + 2.2, 0.04, 0.45, M.siyah, -2.9, FL + RAF.h + 0.62, POD_Z0 - 0.35, g);   // ağ rafına giden enine tava
  // soğuk koridor ön uç kapısı: iki kanat (teknisyen yaklaşınca yana kayar)
  const pkapi = [-1, 1].map((s) => {
    const k = new THREE.Group();
    const w = (KOR_X1 - KOR_X0) / 2;
    const cm = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, RAF.h - 0.04, 0.015), camMat);
    cm.renderOrder = 2;
    k.add(cm);
    k.add(new THREE.Mesh(kutular([[0.035, RAF.h - 0.04, 0.035, s * (w / 2 - 0.02), 0, 0], [0.02, 0.2, 0.03, -s * (w / 2 - 0.08), 0, 0.02]]), cerceve));
    k.userData.x0 = KOR_XC + s * w / 2; k.userData.s = s;
    k.position.set(k.userData.x0, FL + RAF.h / 2, POD_Z1 + 0.03);
    g.add(k);
    return k;
  });
  for (const s of [-1, 1]) box(0.04, RAF.h, 0.06, cerceve, KOR_XC + s * (KOR_X1 - KOR_X0) / 2, FL + RAF.h / 2, POD_Z1 + 0.03, g);
  box(KOR_X1 - KOR_X0 + 0.06, 0.06, 0.06, cerceve, KOR_XC, FL + RAF.h, POD_Z1 + 0.03, g);
  const korLevha = levha(['SOĞUK KORİDOR', '18–27 °C · ASHRAE'], 1.3, 0.3, { bg: '#123a5a', font: 58, px: 700 });
  korLevha.position.set(KOR_XC, FL + RAF.h + 0.2, POD_Z1 + 0.06);
  g.add(korLevha);
  let pkapiAc = 0;

  // ---------------------------------------------------------------- ağ rafı (açık çerçeve, yama kabloları) + yedekleme kütüphanesi
  const AG_X = -1.45, AG_Z = -3.95;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, RAF.h, 0.05, M.siyah, AG_X + sx * 0.28, FL + RAF.h / 2, AG_Z + sz * 0.35, g);
  box(0.6, 0.05, 0.75, M.siyah, AG_X, FL + RAF.h, AG_Z, g);
  box(0.6, 0.05, 0.75, M.siyah, AG_X, FL + 0.05, AG_Z, g);
  const agYuz = new THREE.Mesh(yuzGeo, yuzMat(AG.tex));
  agYuz.position.set(AG_X, FL + RAF.h / 2, AG_Z + 0.36);
  g.add(agYuz);
  const agM = new THREE.Matrix4().compose(agYuz.position.clone(), new THREE.Quaternion(), _s);
  ledEkle(agM, AG.ledler, 100);
  // yama kablosu demetleri (renkli kavisli tüpler)
  const kabloRenk = [0x2f7bd6, 0xf2c200, 0x2ea043, 0xd9322a, 0x8b5cf6];
  const kabloGeo = mergeGeometries(kabloRenk.map((c, i) => {
    const y = FL + 0.6 + i * 0.28;
    const pts = [new THREE.Vector3(AG_X - 0.2, y, AG_Z + 0.4), new THREE.Vector3(AG_X, y - 0.12, AG_Z + 0.5), new THREE.Vector3(AG_X + 0.22, y - 0.02, AG_Z + 0.42)];
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.02, 6);
    const renk = new THREE.Color(c), n = tg.attributes.position.count, arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { arr[k * 3] = renk.r; arr[k * 3 + 1] = renk.g; arr[k * 3 + 2] = renk.b; }
    tg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return tg;
  }));
  g.add(new THREE.Mesh(kabloGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 })));
  // yedekleme kütüphanesi (teyp): pencereli dolap, içinde kartuş rafları + robot kol
  const YD_X = -0.2, YD_Z = -4.05, YD_W = 1.2, YD_D = 0.9;
  // içi görünsün: arka, yanlar, üst/alt, sağ yarıda ön (kontrol) panel; sol yarı camlı
  box(YD_W, RAF.h, 0.03, cihazKoyu, YD_X, FL + RAF.h / 2, YD_Z - YD_D / 2 + 0.015, g);
  for (const s of [-1, 1]) box(0.03, RAF.h, YD_D, cihazKoyu, YD_X + s * (YD_W / 2 - 0.015), FL + RAF.h / 2, YD_Z, g);
  for (const y of [FL + 0.015, FL + RAF.h - 0.015]) box(YD_W, 0.03, YD_D, cihazKoyu, YD_X, y, YD_Z, g);
  box(YD_W * 0.5, RAF.h, 0.03, cihazKoyu, YD_X + YD_W * 0.25, FL + RAF.h / 2, YD_Z + YD_D / 2 - 0.015, g);
  for (const y of [FL + 0.1, FL + RAF.h - 0.1]) box(YD_W * 0.5, 0.2, 0.03, cihazKoyu, YD_X - YD_W * 0.25, y, YD_Z + YD_D / 2 - 0.015, g);
  const ydIc = lamba(0xcfe8ff, 0.5);   // iç aydınlatma şeridi
  box(YD_W * 0.46, 0.02, 0.02, ydIc, YD_X - YD_W * 0.25, FL + RAF.h - 0.22, YD_Z + YD_D / 2 - 0.06, g);
  const ydCam = box(YD_W * 0.48, RAF.h * 0.8, 0.012, camMat, YD_X - YD_W * 0.24, FL + RAF.h * 0.5, YD_Z + YD_D / 2 + 0.006, g);
  ydCam.renderOrder = 2; ydCam.castShadow = false;
  const kartusMat = [mat(0x2f7bd6, { r: 0.6, key: 'sv-k1' }), mat(0xd9322a, { r: 0.6, key: 'sv-k2' }), mat(0xe6e8ea, { r: 0.6, key: 'sv-k3' })];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 2; c++) {
    box(0.02, 0.18, 0.5, M.celik, YD_X - YD_W * 0.46 + c * 0.42, FL + 0.32 + r * 0.22, YD_Z, g);
    for (let k = 0; k < 4; k++) box(0.04, 0.12, 0.09, kartusMat[(r + c + k) % 3], YD_X - YD_W * 0.42 + c * 0.42 + 0.04, FL + 0.32 + r * 0.22, YD_Z - 0.15 + k * 0.1, g);
  }
  const robot = new THREE.Group();
  box(0.05, RAF.h * 0.8, 0.05, M.celik, 0, 0, 0, robot);   // dikey ray
  const tasiyici = new THREE.Group();
  box(0.12, 0.14, 0.16, M.turuncu, 0, 0, 0, tasiyici);
  box(0.03, 0.12, 0.08, kartusMat[2], 0.07, 0, 0, tasiyici);
  robot.add(tasiyici);
  robot.position.set(YD_X - YD_W * 0.24, FL + RAF.h * 0.5, YD_Z + 0.2);
  g.add(robot);
  const ydLcd = levha(['YEDEK KÜTÜPHANESİ', 'LTO · 14 kartuş'], 0.42, 0.16, { bg: '#0c2a1c', fg: '#7ee2a8', font: 46, px: 320 });
  ydLcd.position.set(YD_X + YD_W * 0.25, FL + 1.45, YD_Z + YD_D / 2 + 0.008);
  g.add(ydLcd);
  ledEkle(new THREE.Matrix4().makeTranslation(YD_X + YD_W * 0.25, FL + 1.2, YD_Z + YD_D / 2), [
    { u: 0.3, v: 0.5, tip: 'guc' }, { u: 0.4, v: 0.5, tip: 'akt' }, { u: 0.5, v: 0.5, tip: 'akt' }, { u: 0.6, v: 0.5, tip: 'akt' },
  ].map((l) => ({ ...l, u: (l.u - 0.5) * 0.5 / yuzW + 0.5, v: 0.5 })), 101);

  // ---------------------------------------------------------------- UPS + akü dolabı (sol duvar, ön yüz +X)
  const UPS_X = -8.45;
  const upsZ = [-3.7, -2.9, -2.1];
  upsZ.forEach((z, i) => {
    box(0.8, 1.9, 0.74, i < 2 ? cihazAcik : cihazKoyu, UPS_X, FL + 0.95, z, g);
    box(0.012, 0.22, 0.5, cihazKoyu, UPS_X + 0.406, FL + 1.55, z, g);
    for (let k = 0; k < 6; k++) box(0.01, 0.02, 0.5, cihazKoyu, UPS_X + 0.405, FL + 0.4 + k * 0.1, z, g);
  });
  const upsLcd = new Ekran(0.3, 0.17, 256);
  upsLcd.mesh.rotation.y = Math.PI / 2;
  upsLcd.mesh.position.set(UPS_X + 0.414, FL + 1.55, upsZ[0]);
  g.add(upsLcd.mesh);
  const akuBar = new Ekran(0.09, 0.27, 48);
  akuBar.mesh.rotation.y = Math.PI / 2;
  akuBar.mesh.position.set(UPS_X + 0.41, FL + 1.3, upsZ[1]);
  g.add(akuBar.mesh);
  const upsLev = levha(['UPS 20 kVA · N+1', 'Akü dolabı'], 0.6, 0.16, { bg: '#1b2733', font: 50, px: 360 });
  upsLev.rotation.y = Math.PI / 2;
  upsLev.position.set(UPS_X + 0.41, FL + 1.85, upsZ[1]);
  g.add(upsLev);

  // ---------------------------------------------------------------- CRAC üniteleri (sağ duvar, ön yüz −X) + üst fanlar
  const CRAC_X = 2.45;
  const cracZ = [-3.4, -1.8];
  const cracLed = [];
  cracZ.forEach((z, i) => {
    box(0.9, 1.9, 0.9, cihazAcik, CRAC_X, FL + 0.95, z, g);
    box(0.012, 1.1, 0.78, cihazKoyu, CRAC_X - 0.456, FL + 0.75, z, g);           // emiş ızgarası
    for (let k = 0; k < 9; k++) box(0.014, 0.012, 0.76, M.celik, CRAC_X - 0.46, FL + 0.25 + k * 0.12, z, g);
    const lv = levha([`CRAC-${i + 1}`, 'Hassas klima'], 0.42, 0.14, { bg: '#123a5a', font: 50, px: 300 });
    lv.rotation.y = -Math.PI / 2;
    lv.position.set(CRAC_X - 0.458, FL + 1.62, z);
    g.add(lv);
    const lm = lamba(0x2ea043, 1.8);
    box(0.012, 0.03, 0.2, lm, CRAC_X - 0.458, FL + 1.45, z, g);
    cracLed.push(lm);
    for (const dz of [-0.2, 0.2]) cyl(0.17, 0.03, M.koyu, CRAC_X, FL + 1.915, z + dz, g, { seg: 20 });
  });
  const fanGeo = (() => {
    const parcalar = [new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12)];
    for (let k = 0; k < 5; k++) {
      const b = new THREE.BoxGeometry(0.13, 0.008, 0.05);
      b.translate(0.08, 0, 0); b.rotateX(0.35); b.rotateY((k / 5) * Math.PI * 2);
      parcalar.push(b);
    }
    return mergeGeometries(parcalar);
  })();
  const fanIM = new THREE.InstancedMesh(fanGeo, M.gri, 4);
  fanIM.castShadow = false;
  const fanPoz = [];
  cracZ.forEach((z) => { for (const dz of [-0.2, 0.2]) fanPoz.push(new THREE.Vector3(CRAC_X, FL + 1.94, z + dz)); });
  const fanAci = [0, 0.6, 1.3, 2.1];
  fanPoz.forEach((p, i) => { _q.setFromAxisAngle(_yUp, fanAci[i]); _m.compose(p, _q, _s); fanIM.setMatrixAt(i, _m); });
  fanIM.instanceMatrix.needsUpdate = true;
  fanIM.computeBoundingSphere();
  g.add(fanIM);
  // döşeme altı soğuk hava → koridorda yükselen parçacıklar
  const PN = 140;
  const pPos = new Float32Array(PN * 3), pHiz = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    pPos[i * 3] = KOR_X0 + 0.08 + Math.random() * (KOR_X1 - KOR_X0 - 0.16);
    pPos[i * 3 + 1] = FL + Math.random() * RAF.h;
    pPos[i * 3 + 2] = POD_Z0 + 0.1 + Math.random() * (POD_Z1 - POD_Z0 - 0.2);
    pHiz[i] = 0.5 + Math.random() * 0.6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(KOR_XC, FL + 1, (POD_Z0 + POD_Z1) / 2), 2.4);
  const hava = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x7fc6ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  g.add(hava);

  // ---------------------------------------------------------------- kule lambası (oda köşesi)
  const kule = kuleLambasi(g, RX1 - 0.15, RH + 0.04, RZ1 - 0.12);

  // ---------------------------------------------------------------- NOC: halı, video duvarı (3 ekran), izleme masası (4 monitör)
  const nocHali = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 6.4), mat(0x262e3a, { r: 0.95, key: 'sv-hali' }));
  nocHali.rotation.x = -Math.PI / 2;
  nocHali.position.set(8.7, 0.004, -0.4);
  nocHali.receiveShadow = true;
  g.add(nocHali);
  const VD = { x: 8.7, z: -3.0, y: 1.78, w: 2.4, h: 1.35, ara: 0.06 };
  box(3 * VD.w + 2 * VD.ara + 0.3, VD.h + 0.3, 0.12, M.siyah, VD.x, VD.y, VD.z - 0.08, g);
  for (const s of [-1, 1]) {
    box(0.12, VD.y + VD.h / 2, 0.12, M.koyu, VD.x + s * (1.5 * VD.w + VD.ara + 0.05), (VD.y + VD.h / 2) / 2, VD.z - 0.16, g);
    box(0.6, 0.06, 0.6, M.koyu, VD.x + s * (1.5 * VD.w + VD.ara + 0.05), 0.03, VD.z - 0.16, g);
  }
  const duvar = [-1, 0, 1].map((k) => {
    const e = new Ekran(VD.w, VD.h, 1024);
    e.mesh.position.set(VD.x + k * (VD.w + VD.ara), VD.y, VD.z);
    g.add(e.mesh);
    return e;
  });
  const nocLev = levha(['NOC · İZLEME MERKEZİ'], 2.6, 0.26, { bg: '#0f2233', font: 92, px: 1400 });
  nocLev.position.set(VD.x, VD.y + VD.h / 2 + 0.32, VD.z - 0.01);
  g.add(nocLev);
  // masa
  const MS = { x: 8.7, z: -0.95, w: 5.2, d: 0.8, y: 0.75 };
  box(MS.w, 0.05, MS.d, mat(0x3a4250, { r: 0.6, key: 'sv-masa' }), MS.x, MS.y, MS.z, g);
  for (const s of [-1, 1]) box(0.5, MS.y - 0.02, MS.d - 0.08, cihazKoyu, MS.x + s * (MS.w / 2 - 0.3), (MS.y - 0.02) / 2, MS.z, g);
  box(MS.w - 1.2, 0.5, 0.03, cihazKoyu, MS.x, 0.45, MS.z - MS.d / 2 + 0.05, g);
  const masaEkran = [-1.95, -0.65, 0.65, 1.95].map((dx) => {
    const e = new Ekran(0.6, 0.36, 384);
    e.mesh.position.set(MS.x + dx, MS.y + 0.36, MS.z - 0.12);
    e.mesh.rotation.x = -0.08;
    g.add(e.mesh);
    box(0.62, 0.38, 0.03, M.siyah, MS.x + dx, MS.y + 0.36, MS.z - 0.14, g);
    box(0.04, 0.2, 0.04, M.koyu, MS.x + dx, MS.y + 0.12, MS.z - 0.16, g);
    box(0.24, 0.015, 0.16, M.koyu, MS.x + dx, MS.y + 0.03, MS.z - 0.16, g);
    box(0.42, 0.018, 0.14, M.siyah, MS.x + dx, MS.y + 0.035, MS.z + 0.12, g);   // klavye
    return e;
  });

  // ---------------------------------------------------------------- operatörler (lib.operator; yüz +Z)
  const opN = lib.operator({ yelek: 0x2f7bd6, gomlek: 0x1f2a3a });
  opN.group.position.set(MS.x - 0.3, 0, MS.z + 0.72);
  opN.group.rotation.y = Math.PI;                      // yüzü masaya / video duvarına
  opN.poz('on');
  g.add(opN.group);
  const opT = lib.operator({ yelek: 0xff7a1a, gomlek: 0x6b7280 });
  g.add(opT.group);
  const TEK_BEKLE = { x: 1.2, z: 3.55, yon: Math.PI };  // kapının yanında bekler, odaya bakar
  const tek = { x: TEK_BEKLE.x, z: TEK_BEKLE.z, yon: TEK_BEKLE.yon, yol: [], yuruyor: false, iste: false, icerde: false, metin: 'NOC yanında' };
  const zeminY = (x, z) => {
    if (x > RX0 && x < RX1 && z > RZ0 && z <= RZ1) return FL;
    if (x > kL - 0.1 && x < kR + 0.1 && z > RZ1 && z < RZ1 + 0.9) return FL * (1 - (z - RZ1) / 0.9);
    return 0;
  };
  const YOL_GIR = [[KAPI_X, 3.5], [KAPI_X, 1.6], [KOR_XC, 0.25], [KOR_XC, -0.6], [KOR_X0 + 0.55, RAF_Z[2]]];
  const YOL_CIK = [[KOR_XC, -0.6], [KOR_XC, 0.25], [KAPI_X, 1.6], [KAPI_X, 3.5], [TEK_BEKLE.x, TEK_BEKLE.z]];
  const BAKIM_RAF = 2;   // sıra L, 3. raf

  // ---------------------------------------------------------------- servisler (yüksek seviye; iç ayrıntı yok)
  const SERVIS = [
    { id: 'nginx', ad: 'nginx-proxy', tur: 'Ters vekil · SSL/TLS', yer: 'docker', ms: 4, pay: 1.0 },
    { id: 'veri', ad: 'veri-panel', tur: 'Endüstriyel veri görselleştirme', yer: 'docker', ms: 18, pay: 0.34 },
    { id: 'plc', ad: 'plc-kopru', tur: 'PLC ↔ PC · Modbus TCP', yer: 'docker', ms: 9, pay: 0.12 },
    { id: 'mail', ad: 'mail-analiz', tur: 'IMAP → SQLite · panel', yer: 'servis', ms: 35, pay: 0.08 },
    { id: 'teklif', ad: 'teklif-otomasyonu', tur: 'Excel şablon → PDF', yer: 'servis', ms: 120, pay: 0.03 },
    { id: 'cagri', ad: 'cagri-yonlendirici', tur: 'Asterisk · TR/EN IVR', yer: 'VoIP', ms: 22, pay: 0.02 },
    { id: 'dokamuh', ad: 'dokamuh.com', tur: 'WordPress kurumsal site', yer: 'cPanel', ms: 140, pay: 0.25, dis: true },
    { id: 'arkoz', ad: 'arkozmakine.com', tur: 'Statik ürün sitesi · çok dilli', yer: 'cPanel', ms: 95, pay: 0.1, dis: true },
    { id: 'pages', ad: 'kaankirsan.github.io', tur: 'Portföy + Sanal Fabrika', yer: 'GitHub Pages', ms: 60, pay: 0.06, dis: true },
    { id: 'ci', ad: 'ci-hatti', tur: 'Flutter derleme · test', yer: 'GitHub Actions', ms: 0, pay: 0, dis: true },
    { id: 'yedek', ad: 'yedekleme', tur: 'Site + veritabanı yedeği', yer: 'cron', ms: 0, pay: 0 },
  ];
  SERVIS.forEach((s) => Object.assign(s, { durum: 'ok', tY: 0, lat: s.ms, cpu: 4 + Math.random() * 6 }));
  const SV = Object.fromEntries(SERVIS.map((s) => [s.id, s]));
  const YEREL = ['nginx', 'veri', 'plc', 'mail', 'teklif', 'cagri'];
  // raf → servis (LED durumu): 10 raf + ağ (100) + yedek (101)
  const RAF_SERVIS = ['nginx', 'veri', 'veri', 'plc', 'mail', 'teklif', 'cagri', 'yedek', 'genel', 'genel'];
  const rafServis = (r) => (r === 100 ? 'nginx' : r === 101 ? 'yedek' : RAF_SERVIS[r]);

  // ---------------------------------------------------------------- LED'ler (tek InstancedMesh, renk = durum + aktivite)
  const ledIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), ledKayit.length);
  ledKayit.forEach((l, i) => ledIM.setMatrixAt(i, l.m));
  ledIM.instanceMatrix.needsUpdate = true;
  const ledRenk = new THREE.Color();
  for (let i = 0; i < ledKayit.length; i++) ledIM.setColorAt(i, ledRenk.setRGB(0, 1.4, 0.3));
  ledIM.computeBoundingSphere();
  ledIM.castShadow = false;
  g.add(ledIM);

  // ---------------------------------------------------------------- benzetim durumu
  let yuk = 35;                 // yük testi (%)
  let cpu = 22, ram = 52, istek = 0, baglanti = 0, disk = 63, diskIO = 8;
  let tSoguk = 21.8, tSicak = 31, fan = [46, 46], crac = [true, true];
  let ups = 'sebeke', aku = 100, upsYuk = 8;
  let deploy = null;            // { sira:[id], i, t }
  let yedek = null;             // { t, sure }
  let senaryo = null;           // { tip, t, hedef }
  let senaryoSec = 'coktu', cokecek = 'veri';
  let bakim = false;
  let ciT = 18, ciNo = 214, ciDurum = 'başarılı', ciCalisiyor = 0;
  let sonDeploy = '—', sonYedek = 'dün 03:00 · doğrulandı';
  let erisim30 = 99.97;
  const olaylar = [];
  let simT = 0;
  const saat = (t) => { const s = Math.floor(9 * 3600 + 12 * 60 + t); return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };
  const olay = (metin, sev = 'bilgi') => { olaylar.unshift({ t: saat(simT), metin, sev }); if (olaylar.length > 14) olaylar.pop(); };
  const uyarT = { t: 0, metin: '' };
  const uyar = (m) => { uyarT.t = 3; uyarT.metin = m; };
  olay('izleme başladı · 11 servis', 'bilgi');
  olay('ci-hatti: derleme #213 başarılı', 'ok');
  olay('yedekleme (dün 03:00) doğrulandı · SHA256', 'ok');

  // grafik tamponları (2 Hz, 2 dk)
  const TAMPON = 240;
  const tb = { istek: [], cpu: [], ram: [], soguk: [], sicak: [] };
  for (let i = 0; i < TAMPON; i++) { tb.istek.push(1100 + Math.sin(i / 9) * 120); tb.cpu.push(22 + Math.sin(i / 11) * 3); tb.ram.push(52); tb.soguk.push(21.8); tb.sicak.push(31); }
  let ornekAcc = 0;

  // ---------------------------------------------------------------- senaryolar
  function deployBaslat() {
    if (deploy) { uyar('DEPLOY ZATEN SÜRÜYOR'); return; }
    if (senaryo && senaryo.tip === 'coktu') { uyar('ÖNCE ÇÖKEN SERVİS AYAĞA KALKSIN'); return; }
    deploy = { sira: YEREL.slice(), i: 0, t: 0 };
    olay('deploy başladı · sıralı yeniden başlatma (sıfır kesinti)', 'bilgi');
  }
  function yedekBaslat() {
    if (yedek) { uyar('YEDEKLEME ZATEN SÜRÜYOR'); return; }
    if (ups === 'aku') { uyar('AKÜDEYKEN YEDEKLEME ERTELENDİ'); return; }
    yedek = { t: 0, sure: 22 };
    SV.yedek.durum = 'calis';
    olay('yedekleme başladı · site dosyaları + veritabanı → yedek ünitesi', 'bilgi');
  }
  function senaryoBaslat() {
    if (senaryo) { uyar('BİR SENARYO ZATEN SÜRÜYOR'); return; }
    const tip = senaryoSec;
    senaryo = { tip, t: 0, hedef: cokecek };
    if (tip === 'coktu') {
      const s = SV[cokecek];
      s.durum = 'cok'; s.tY = 0;
      olay(`HATA: ${s.ad} yanıt vermiyor · sağlık kontrolü 3/3`, 'alarm');
      if (cokecek === 'nginx') olay('nginx yok → arkasındaki yerel servislere erişim kesildi', 'alarm');
      if (deploy) { deploy = null; olay('deploy durduruldu (arıza)', 'uyari'); }
    } else if (tip === 'sogutma') {
      crac[0] = false;
      olay('CRAC-1 kompresör arızası · durdu', 'alarm');
    } else if (tip === 'sebeke') {
      ups = 'aku';
      olay('ŞEBEKE KESİLDİ · UPS aküye geçti', 'alarm');
    } else if (tip === 'disk') {
      disk = 91;
      olay('disk %91 · veri birimi eşiği (%85) aşıldı', 'uyari');
    }
  }
  function senaryoSifirla() {
    if (!senaryo) return;
    if (senaryo.tip === 'coktu') { const s = SV[senaryo.hedef]; s.durum = 'ok'; }
    crac[0] = true; ups = 'sebeke'; if (disk > 80) disk = 64;
    senaryo = null;
    olay('senaryo sıfırlandı', 'bilgi');
  }

  // ---------------------------------------------------------------- güncelleme
  const _ld = { t: 0 };
  let ekranSira = 0, ekranAcc = 0, kucukAcc = 0, kucukSira = 0, upsAcc = 0, upsSira = 0;
  function update(dt, t) {
    simT = t;
    if (uyarT.t > 0) uyarT.t -= dt;

    // --- senaryo akışı
    if (senaryo) {
      senaryo.t += dt;
      const st = senaryo.t;
      if (senaryo.tip === 'coktu') {
        const s = SV[senaryo.hedef];
        if (s.durum === 'cok' && st > 5) { s.durum = 'yeni'; s.tY = 0; olay(`${s.ad}: otomatik yeniden başlatma (restart: unless-stopped)`, 'uyari'); }
        if (s.durum === 'yeni' && st > 8.5) { s.durum = 'ok'; olay(`${s.ad} yeniden ayakta · sağlık kontrolü geçti`, 'ok'); senaryo = null; }
        erisim30 = Math.max(99.9, erisim30 - dt * 0.0006);
      } else if (senaryo.tip === 'sogutma') {
        if (st > 3 && !senaryo.yedek) { senaryo.yedek = true; olay('CRAC-2 %100\'e çıktı (N+1 yedek)', 'uyari'); }
        if (st > 36) { crac[0] = true; olay('CRAC-1 servis edildi · normal çalışma', 'ok'); senaryo = null; }
      } else if (senaryo.tip === 'sebeke') {
        if (st > 10 && ups === 'aku') { ups = 'jen'; olay('jeneratör devrede · UPS şarjda', 'uyari'); }
        if (st > 30) { ups = 'sebeke'; olay('şebeke geri geldi · jeneratör soğumaya geçti', 'ok'); senaryo = null; }
      } else if (senaryo.tip === 'disk') {
        if (st > 8 && disk > 80) { disk = 64; olay('günlük döndürme + eski imajlar temizlendi · disk %64', 'ok'); senaryo = null; }
      }
    }

    // --- deploy: yerel servisler sırayla
    if (deploy) {
      deploy.t += dt;
      const id = deploy.sira[deploy.i];
      const s = SV[id];
      if (s.durum === 'ok' && deploy.t < 0.1) { s.durum = 'yeni'; s.tY = 0; olay(`deploy ${s.ad}: yeni imaj çekildi, kapsayıcı yenileniyor`, 'bilgi'); }
      if (deploy.t > 2.4) {
        s.durum = 'ok'; olay(`${s.ad} sağlık kontrolü ok`, 'ok');
        deploy.i++; deploy.t = 0;
        if (deploy.i >= deploy.sira.length) { sonDeploy = saat(t); olay('deploy tamamlandı · 6/6 servis', 'ok'); deploy = null; }
      }
    }
    // --- yedekleme
    if (yedek) {
      yedek.t += dt;
      if (yedek.t >= yedek.sure) { yedek = null; SV.yedek.durum = 'ok'; sonYedek = `bugün ${saat(t).slice(0, 5)} · doğrulandı`; olay('yedekleme tamam · doğrulama (SHA256) ok', 'ok'); }
    }
    // --- CI olayları (otomatik, canlılık için)
    ciT -= dt;
    if (ciT <= 0) {
      if (!ciCalisiyor) { ciCalisiyor = 8; ciNo++; SV.ci.durum = 'calis'; olay(`ci-hatti: derleme #${ciNo} başladı (analiz + test + Windows paketi)`, 'bilgi'); }
      ciT = 45 + Math.random() * 25;
    }
    if (ciCalisiyor > 0) { ciCalisiyor -= dt; if (ciCalisiyor <= 0) { ciCalisiyor = 0; SV.ci.durum = 'ok'; olay(`ci-hatti: derleme #${ciNo} başarılı`, 'ok'); } }

    // --- metrikler
    const nginxYok = SV.nginx.durum === 'cok';
    const hedefIstek = (180 + yuk * 26) * (1 + 0.08 * Math.sin(t * 0.37) + 0.04 * Math.sin(t * 1.9));
    istek = damp(istek, nginxYok ? hedefIstek * 0.35 : hedefIstek, 2, dt);
    baglanti = Math.round(istek * 0.42 + 8);
    const deployYuk = deploy ? 8 : 0, yedekYuk = yedek ? 10 : 0;
    cpu = damp(cpu, clamp(9 + yuk * 0.74 + deployYuk + yedekYuk + gurultu(2), 3, 99), 1.2, dt);
    ram = damp(ram, 46 + yuk * 0.28 + (yedek ? 6 : 0), 0.6, dt);
    diskIO = damp(diskIO, 6 + yuk * 0.2 + (yedek ? 160 : 0) + (deploy ? 40 : 0), 2, dt);
    if (!senaryo || senaryo.tip !== 'disk') disk = Math.min(79, disk + dt * 0.002 + (yedek ? dt * 0.03 : 0));
    // soğutma: CRAC fanları + soğuk/sıcak koridor
    const fanHedef = 40 + yuk * 0.45 + Math.max(0, tSoguk - 23) * 12;
    fan[0] = damp(fan[0], crac[0] ? clamp(fanHedef, 30, 100) : 0, 1.5, dt);
    fan[1] = damp(fan[1], senaryo && senaryo.tip === 'sogutma' && senaryo.yedek ? 100 : clamp(fanHedef, 30, 100), 1.0, dt);
    const kapasite = (crac[0] ? 1 : 0) * fan[0] / 100 + fan[1] / 100 * 1.15;
    const isi = 0.55 + yuk * 0.006;
    const soguHedef = 21.2 + yuk * 0.025 + clamp((isi - kapasite * 0.62) * 9, -0.6, 7);
    tSoguk = damp(tSoguk, soguHedef, 0.18, dt);
    tSicak = damp(tSicak, tSoguk + 8.5 + yuk * 0.07, 0.3, dt);
    // UPS
    upsYuk = 6 + yuk * 0.07 + (crac[0] ? 1.2 : 0) + 1.6;
    if (ups === 'aku') aku = Math.max(5, aku - dt * 0.6);
    else aku = Math.min(100, aku + dt * 0.3);
    // servis gecikme / cpu
    for (const s of SERVIS) {
      if (s.durum === 'yeni') s.tY += dt;
      const erisilemez = s.durum === 'cok' || (nginxYok && !s.dis && s.id !== 'nginx' && s.id !== 'cagri' && s.id !== 'yedek');
      s.erisilemez = erisilemez;
      if (s.ms) s.lat = erisilemez ? 0 : damp(s.lat, s.ms * (1 + yuk / 160) * (s.durum === 'yeni' ? 2.2 : 1) + gurultu(s.ms * 0.12), 3, dt);
      s.cpu = damp(s.cpu, erisilemez ? 0 : clamp(s.pay * (6 + yuk * 0.6) + 2 + gurultu(1.5), 0, 99), 1.5, dt);
    }

    // --- kapılar, teknisyen, operatör
    tekGuncelle(dt, t);
    const kapiYakin = Math.hypot(tek.x - KAPI_X, tek.z - RZ1) < 1.7;
    kapiAc = approach(kapiAc, kapiYakin ? 1 : 0, dt * 1.2);
    kapi.position.x = KAPI_X - kapiAc * (KAPI_W - 0.05);
    const korYakin = Math.hypot(tek.x - KOR_XC, tek.z - POD_Z1) < 1.4;
    pkapiAc = approach(pkapiAc, korYakin ? 1 : 0, dt * 1.4);
    for (const k of pkapi) k.position.x = k.userData.x0 + k.userData.s * pkapiAc * 0.62;
    kartLed.color.setHex(kapiAc > 0.02 ? 0x2ea043 : 0xd9322a); kartLed.emissive.copy(kartLed.color);
    // NOC operatörü: yazıyor (kollar hafif), alarmda video duvarına bakar
    opN.yuru(t, false);
    opN.kolSol.rotation.x = -0.6 + Math.sin(t * 13) * 0.04;
    opN.kolSag.rotation.x = -0.6 + Math.sin(t * 11 + 1) * 0.04;
    const alarm = durumBilgi().seviye === 'alarm';
    opN.group.rotation.y = damp(opN.group.rotation.y, Math.PI + (alarm ? 0.25 : 0), 3, dt);

    // --- fanlar, hava akışı, yedek robotu
    for (let i = 0; i < 4; i++) {
      const f = fan[i < 2 ? 0 : 1];
      fanAci[i] += dt * f * 0.42;
      _q.setFromAxisAngle(_yUp, fanAci[i]); _m.compose(fanPoz[i], _q, _s); fanIM.setMatrixAt(i, _m);
    }
    fanIM.instanceMatrix.needsUpdate = true;
    const akis = (fan[0] + fan[1]) / 200;
    for (let i = 0; i < PN; i++) {
      let y = pPos[i * 3 + 1] + dt * pHiz[i] * (0.25 + akis * 1.4);
      if (y > FL + RAF.h - 0.05) {
        y = FL + 0.02;
        pPos[i * 3] = KOR_X0 + 0.08 + Math.random() * (KOR_X1 - KOR_X0 - 0.16);
        pPos[i * 3 + 2] = POD_Z0 + 0.1 + Math.random() * (POD_Z1 - POD_Z0 - 0.2);
      }
      // raf ön yüzlerine doğru çekilir (sunucular soğuk havayı emer)
      const x = pPos[i * 3];
      pPos[i * 3] = x + (x < KOR_XC ? -1 : 1) * dt * 0.05 * akis;
      pPos[i * 3 + 1] = y;
    }
    pGeo.attributes.position.needsUpdate = true;
    hava.material.color.setHex(tSoguk > 25 ? 0xffb37f : 0x7fc6ff);
    if (yedek) {
      const k = Math.floor(yedek.t / 1.3);
      const hy = ((k * 37) % 7) / 6 - 0.5, hx = (k % 2) * 0.32 - 0.16;
      tasiyici.position.y = damp(tasiyici.position.y, hy * RAF.h * 0.62, 6, dt);
      tasiyici.position.x = damp(tasiyici.position.x, hx, 6, dt);
    } else {
      tasiyici.position.y = damp(tasiyici.position.y, -RAF.h * 0.36, 3, dt);
      tasiyici.position.x = damp(tasiyici.position.x, 0, 3, dt);
    }

    // --- LED'ler (~14 Hz)
    _ld.t += dt;
    if (_ld.t > 0.07) { _ld.t = 0; ledleriBoya(t); }
    for (let k = 0; k < 2; k++) {
      const c = !crac[k] ? 0xd9322a : fan[k] > 85 ? 0xf2a900 : 0x2ea043;
      cracLed[k].color.setHex(c); cracLed[k].emissive.setHex(c);
      cracLed[k].emissiveIntensity = !crac[k] ? (Math.sin(t * 8) > 0 ? 2.4 : 0.2) : 1.8;
    }
    const d = durumBilgi();
    kule.set(d.seviye === 'bekliyor' ? 'calisiyor' : d.seviye, t);

    // --- trend + tamponlar
    trend.ornekle(dt, [cpu, ram, (fan[0] + fan[1]) / 2]);
    ornekAcc += dt;
    if (ornekAcc >= 0.5) {
      ornekAcc = 0;
      const it = (a, v) => { a.push(v); if (a.length > TAMPON) a.shift(); };
      it(tb.istek, istek); it(tb.cpu, cpu); it(tb.ram, ram); it(tb.soguk, tSoguk); it(tb.sicak, tSicak);
    }

    // --- ekranlar: kare başına en çok bir canvas (duvar ~3 Hz, masa ~1 Hz, UPS ~1 Hz)
    ekranAcc += dt; kucukAcc += dt; upsAcc += dt;
    if (ekranAcc >= 0.11) {
      ekranAcc = 0;
      const e = ekranSira++ % 3;
      if (e === 0) duvar[0].ciz(cizServisler);
      else if (e === 1) duvar[1].ciz(cizKaynak);
      else duvar[2].ciz(cizMimari);
    } else if (kucukAcc >= 0.27) {
      kucukAcc = 0;
      const k = kucukSira++ % 4;
      masaEkran[k].ciz(MASA_CIZ[k]);
    } else if (upsAcc >= 0.5) {
      upsAcc = 0;
      if ((upsSira++ & 1) === 0) upsLcd.ciz(cizUps); else akuBar.ciz(cizAku);
    }
  }

  function tekGuncelle(dt, t) {
    if (bakim && !tek.icerde && !tek.yol.length && !tek.iste) { tek.iste = true; tek.yol = YOL_GIR.map((p) => p.slice()); tek.metin = 'odaya giriyor'; }
    if (!bakim && tek.icerde && !tek.yol.length) { tek.yol = YOL_CIK.map((p) => p.slice()); tek.icerde = false; tek.metin = 'odadan çıkıyor'; }
    tek.yuruyor = false;
    if (tek.yol.length) {
      const [hx, hz] = tek.yol[0];
      // kapı düzlemini kapı tam açılmadan geçme (giriş ve çıkış)
      const gecis = (zd, ac) => (tek.z - zd) * (hz - zd) < 0 && Math.abs(tek.z - zd) < 0.5 && ac < 0.9;
      const bekle = (gecis(RZ1, kapiAc) && Math.abs(tek.x - KAPI_X) < 0.8)
        || (gecis(POD_Z1, pkapiAc) && tek.x > KOR_X0 - 0.3 && tek.x < KOR_X1 + 0.3);
      if (!bekle) {
        const dx = hx - tek.x, dz = hz - tek.z, L = Math.hypot(dx, dz);
        const adim = dt * 1.15;
        if (L <= adim) { tek.x = hx; tek.z = hz; tek.yol.shift(); }
        else { tek.x += (dx / L) * adim; tek.z += (dz / L) * adim; tek.yon = Math.atan2(dx, dz); tek.yuruyor = true; }
      }
      if (!tek.yol.length) {
        if (tek.iste) { tek.iste = false; tek.icerde = true; tek.yon = -Math.PI / 2; tek.metin = `RAF-${BAKIM_RAF + 1} bakımında`; olay(`bakım: teknisyen RAF-${BAKIM_RAF + 1} başında (servis LED mavi)`, 'bilgi'); }
        else { tek.yon = TEK_BEKLE.yon; tek.metin = 'NOC yanında'; }
      }
    }
    opT.poz(tek.icerde && !tek.yol.length ? 'on' : 'yan');
    const bob = opT.yuru(t, tek.yuruyor);
    opT.group.position.set(tek.x, zeminY(tek.x, tek.z) + bob, tek.z);
    opT.group.rotation.y = damp(opT.group.rotation.y, tek.yon, 8, dt);
    if (tek.icerde && !tek.yol.length) {
      opT.kolSag.rotation.x = -0.9 + Math.sin(t * 3) * 0.12;
    }
  }

  function ledleriBoya(t) {
    const yogun = 0.15 + yuk / 120 + (deploy ? 0.2 : 0);
    for (let i = 0; i < ledKayit.length; i++) {
      const l = ledKayit[i];
      const sid = rafServis(l.raf);
      const s = SV[sid];
      const servisDur = s ? (s.durum === 'cok' ? 'cok' : s.durum === 'yeni' ? 'yeni' : (s.erisilemez ? 'erisim' : 'ok')) : 'ok';
      const bakimda = bakim && tek.icerde && l.raf === BAKIM_RAF;
      if (l.tip === 'guc') {
        if (bakimda) ledRenk.setRGB(0.2, 0.6, 2.6);
        else if (servisDur === 'cok') ledRenk.setRGB(Math.sin(t * 10) > 0 ? 2.6 : 0.2, 0.05, 0.05);
        else if (servisDur === 'yeni') ledRenk.setRGB(2.4, 1.4, 0.05);
        else if (servisDur === 'erisim') ledRenk.setRGB(2.2, 1.0, 0.05);
        else if (ups === 'aku') ledRenk.setRGB(1.6, 1.6, 0.1);
        else ledRenk.setRGB(0.05, 1.7, 0.35);
      } else {
        const p = servisDur === 'cok' ? 0 : servisDur === 'yeni' ? 0.5 : yogun * (l.tip === 'port' ? 1.2 : 1);
        const yan = Math.random() < p;
        if (!yan) ledRenk.setRGB(0.02, 0.05, 0.03);
        else if (servisDur === 'yeni') ledRenk.setRGB(2.2, 1.3, 0.05);
        else if (l.tip === 'port') ledRenk.setRGB(0.1, 2.0, 0.4);
        else ledRenk.setRGB(1.6, 1.8, 1.9);
      }
      ledIM.setColorAt(i, ledRenk);
    }
    ledIM.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- ekran çizimleri (koyu ISA-101 tarzı)
  const C = { bg: '#0b1118', panel: '#111a24', cizgi: '#1f2c3a', metin: '#dfe6ec', soluk: '#8b97a3', ok: '#2ea043', uyari: '#d29922', alarm: '#f85149', vurgu: '#39c5cf', mavi: '#58a6ff' };
  const F = (w, px) => `${w} ${px}px "Space Grotesk", sans-serif`;
  const FM = (w, px) => `${w} ${px}px "JetBrains Mono", monospace`;
  const yaz = (x, s, px, py, font, renk, hiza = 'left') => { x.font = font; x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle'; x.fillText(s, px, py); };
  const yuvarlak = (x, px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
  const baslik = (x, W, metin, sag) => {
    x.fillStyle = C.bg; x.fillRect(0, 0, W, 9999);
    x.fillStyle = '#0f2233'; x.fillRect(0, 0, W, 54);
    x.fillStyle = C.vurgu; x.fillRect(0, 52, W, 2);
    yaz(x, metin, 22, 28, F(700, 26), '#fff');
    yaz(x, sag, W - 22, 28, FM(500, 20), C.soluk, 'right');
  };
  const durumRenk = (s) => (s.durum === 'cok' ? C.alarm : s.durum === 'yeni' || s.erisilemez ? C.uyari : s.durum === 'calis' ? C.mavi : C.ok);
  const durumMetin = (s) => {
    if (s.durum === 'cok') return 'ÇÖKTÜ';
    if (s.durum === 'yeni') return s.id === 'nginx' ? 'YENİDEN YÜKLE' : 'YENİDEN BAŞLIYOR';
    if (s.erisilemez) return 'ERİŞİLEMEZ';
    if (s.id === 'ci') return s.durum === 'calis' ? `DERLENİYOR #${ciNo}` : `#${ciNo} BAŞARILI`;
    if (s.id === 'yedek') return yedek ? `ÇALIŞIYOR %${Math.round((yedek.t / yedek.sure) * 100)}` : 'PLANLI 03:00';
    return 'ÇALIŞIYOR';
  };

  function cizServisler(x, W, H) {
    baslik(x, W, 'SERVİS DURUMU', `docker · barındırma · ${saat(simT)}`);
    const y0 = 70, rh = 37;
    yaz(x, 'SERVİS', 30, y0 + 8, F(600, 16), C.soluk); yaz(x, 'TÜR', 270, y0 + 8, F(600, 16), C.soluk);
    yaz(x, 'YER', 560, y0 + 8, F(600, 16), C.soluk); yaz(x, 'DURUM', 700, y0 + 8, F(600, 16), C.soluk);
    yaz(x, 'ms', 930, y0 + 8, F(600, 16), C.soluk, 'right'); yaz(x, 'CPU', 1000, y0 + 8, F(600, 16), C.soluk, 'right');
    SERVIS.forEach((s, i) => {
      const y = y0 + 26 + i * rh;
      if (i % 2) { x.fillStyle = '#0e1620'; x.fillRect(12, y - 2, W - 24, rh); }
      const r = durumRenk(s);
      const yanip = s.durum === 'cok' && Math.sin(simT * 8) < 0;
      x.fillStyle = yanip ? '#3a0d0c' : r; x.beginPath(); x.arc(28, y + rh / 2 - 2, 7, 0, Math.PI * 2); x.fill();
      yaz(x, s.ad, 44, y + rh / 2 - 2, FM(600, 19), C.metin);
      yaz(x, s.tur, 270, y + rh / 2 - 2, F(500, 17), C.soluk);
      yaz(x, s.yer, 560, y + rh / 2 - 2, FM(500, 16), s.dis ? C.mavi : C.vurgu);
      yaz(x, durumMetin(s), 700, y + rh / 2 - 2, F(700, 16), r);
      yaz(x, s.ms && !s.erisilemez ? fmt(s.lat, 0) : '—', 930, y + rh / 2 - 2, FM(500, 17), C.metin, 'right');
      x.fillStyle = '#1b2733'; x.fillRect(946, y + rh / 2 - 8, 60, 12);
      x.fillStyle = s.cpu > 80 ? C.alarm : s.cpu > 60 ? C.uyari : C.vurgu; x.fillRect(946, y + rh / 2 - 8, 60 * clamp(s.cpu / 100, 0, 1), 12);
    });
    const yA = H - 52;
    x.fillStyle = '#0f2233'; x.fillRect(0, yA, W, 52);
    const calisan = SERVIS.filter((s) => s.durum !== 'cok' && !s.erisilemez).length;
    yaz(x, `${calisan}/${SERVIS.length} servis erişilebilir`, 22, yA + 26, F(700, 20), calisan === SERVIS.length ? C.ok : C.alarm);
    yaz(x, `Kurumsal site · 5 yıl · %99 çalışma oranı   |   Son 30 gün %${fmt(erisim30, 2)}`, W - 22, yA + 26, F(500, 18), C.metin, 'right');
  }

  const grafik = (x, px, py, w, h, seri, renk, etiket, birim, min, max) => {
    yuvarlak(x, px, py, w, h, 8); x.fillStyle = C.panel; x.fill(); x.strokeStyle = C.cizgi; x.lineWidth = 1.5; x.stroke();
    yaz(x, etiket, px + 14, py + 18, F(600, 16), C.soluk);
    const son = seri[seri.length - 1];
    yaz(x, `${fmt(son, birim === '°C' ? 1 : 0)} ${birim}`, px + w - 14, py + 18, FM(700, 20), renk, 'right');
    const gx = px + 12, gy = py + 34, gw = w - 24, gh = h - 44;
    x.strokeStyle = '#1b2733'; x.lineWidth = 1;
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(gx, gy + gh * k / 4); x.lineTo(gx + gw, gy + gh * k / 4); x.stroke(); }
    x.strokeStyle = renk; x.lineWidth = 2.2; x.beginPath();
    seri.forEach((v, i) => { const X = gx + (i / (seri.length - 1)) * gw, Y = gy + gh - clamp((v - min) / (max - min), 0, 1) * gh; i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
    x.stroke();
  };
  function cizKaynak(x, W, H) {
    baslik(x, W, 'TRAFİK & KAYNAK', `son 2 dk · ${saat(simT)}`);
    const kpi = [
      ['İstek/s', fmt(istek, 0), C.mavi], ['Bağlantı', String(baglanti), C.metin], ['CPU (küme)', `%${fmt(cpu, 0)}`, cpu > 85 ? C.alarm : cpu > 65 ? C.uyari : C.ok],
      ['RAM', `%${fmt(ram, 0)}`, C.metin], ['Soğuk koridor', `${fmt(tSoguk, 1)} °C`, tSoguk > 27 ? C.alarm : tSoguk > 25 ? C.uyari : C.ok],
      ['UPS', ups === 'sebeke' ? 'ŞEBEKE' : ups === 'aku' ? `AKÜ %${fmt(aku, 0)}` : 'JENERATÖR', ups === 'sebeke' ? C.ok : C.uyari],
    ];
    const kw = (W - 24 - 5 * 10) / 6;
    kpi.forEach(([e, v, r], i) => {
      const px = 12 + i * (kw + 10);
      yuvarlak(x, px, 66, kw, 74, 8); x.fillStyle = C.panel; x.fill();
      yaz(x, e, px + 12, 86, F(500, 15), C.soluk);
      yaz(x, v, px + 12, 118, FM(700, 26), r);
    });
    const gw = (W - 36) / 2, gh = (H - 170) / 2;
    grafik(x, 12, 152, gw, gh - 6, tb.istek, C.mavi, 'İstek / s', '', 0, 3200);
    grafik(x, 24 + gw, 152, gw, gh - 6, tb.cpu, '#f0883e', 'CPU (küme)', '%', 0, 100);
    grafik(x, 12, 152 + gh + 4, gw, gh - 6, tb.ram, '#a371f7', 'RAM', '%', 0, 100);
    grafik(x, 24 + gw, 152 + gh + 4, gw, gh - 6, tb.soguk, C.vurgu, `Soğuk koridor (sıcak: ${fmt(tSicak, 1)} °C)`, '°C', 16, 32);
  }

  // mimari akış: düğümler + paketler
  const DUGUM = {
    net: { x: 70, y: 150, w: 150, h: 64, ad: 'İnternet', alt: 'HTTPS · SIP' },
    fw: { x: 70, y: 290, w: 150, h: 64, ad: 'Güvenlik duvarı', alt: 'VPN · hız sınırı' },
    ngx: { x: 300, y: 290, w: 150, h: 64, ad: 'Nginx', alt: 'ters vekil · SSL', sid: 'nginx' },
    veri: { x: 540, y: 200, w: 170, h: 52, ad: 'veri-panel', alt: 'docker', sid: 'veri' },
    plc: { x: 540, y: 262, w: 170, h: 52, ad: 'plc-kopru', alt: 'docker', sid: 'plc' },
    mail: { x: 540, y: 324, w: 170, h: 52, ad: 'mail-analiz', alt: 'servis', sid: 'mail' },
    teklif: { x: 540, y: 386, w: 170, h: 52, ad: 'teklif-otomasyonu', alt: 'servis', sid: 'teklif' },
    db: { x: 790, y: 290, w: 170, h: 64, ad: 'Veritabanı', alt: 'SQLite · yedek', sid: 'yedek' },
    voip: { x: 300, y: 150, w: 150, h: 64, ad: 'Asterisk', alt: 'TR/EN IVR', sid: 'cagri' },
    cp: { x: 790, y: 120, w: 170, h: 70, ad: 'cPanel', alt: 'dokamuh.com · arkozmakine.com' },
    gh: { x: 300, y: 430, w: 150, h: 60, ad: 'GitHub', alt: 'Actions · Pages', sid: 'ci' },
  };
  const BAG = [['net', 'fw'], ['fw', 'ngx'], ['ngx', 'veri'], ['ngx', 'plc'], ['ngx', 'mail'], ['ngx', 'teklif'], ['veri', 'db'], ['mail', 'db'], ['net', 'voip'], ['net', 'cp'], ['net', 'gh']];
  const merkez = (d) => [d.x + d.w / 2, d.y + d.h / 2];
  function cizMimari(x, W, H) {
    baslik(x, W, 'MİMARİ · DEPLOY', deploy ? `deploy ${deploy.i + 1}/${deploy.sira.length}` : `son deploy ${sonDeploy}`);
    // docker grubu
    yuvarlak(x, 525, 186, 200, 266, 10); x.strokeStyle = '#2d4a63'; x.setLineDash([6, 5]); x.lineWidth = 2; x.stroke(); x.setLineDash([]);
    yaz(x, 'Linux · Docker', 535, 176, FM(500, 14), C.soluk);
    // bağlantılar + paketler
    const hiz = 0.25 + istek / 2500;
    for (const [a, b] of BAG) {
      const [x1, y1] = merkez(DUGUM[a]), [x2, y2] = merkez(DUGUM[b]);
      const kopuk = (DUGUM[b].sid && (SV[DUGUM[b].sid].durum === 'cok' || SV[DUGUM[b].sid].erisilemez)) || (DUGUM[a].sid && SV[DUGUM[a].sid].durum === 'cok');
      x.strokeStyle = kopuk ? '#5a1d1b' : '#24384c'; x.lineWidth = 3; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
      if (kopuk) continue;
      for (let k = 0; k < 3; k++) {
        const f = ((simT * hiz + k / 3 + (x1 + y2) * 0.001) % 1);
        x.fillStyle = C.vurgu; x.beginPath(); x.arc(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 4, 0, Math.PI * 2); x.fill();
      }
    }
    for (const d of Object.values(DUGUM)) {
      const s = d.sid ? SV[d.sid] : null;
      const r = s ? durumRenk(s) : C.mavi;
      yuvarlak(x, d.x, d.y, d.w, d.h, 9); x.fillStyle = C.panel; x.fill(); x.strokeStyle = r; x.lineWidth = s && s.durum === 'cok' && Math.sin(simT * 8) < 0 ? 1 : 2.5; x.stroke();
      yaz(x, d.ad, d.x + d.w / 2, d.y + d.h * 0.38, F(700, d.h > 60 ? 19 : 17), C.metin, 'center');
      yaz(x, d.alt, d.x + d.w / 2, d.y + d.h * 0.72, F(500, 13), C.soluk, 'center');
      if (s && s.durum === 'cok') yaz(x, '✕', d.x + d.w - 14, d.y + 14, F(700, 20), C.alarm, 'center');
    }
    // günlük
    const gy = 470;
    x.fillStyle = '#081018'; x.fillRect(470, gy, W - 482, H - gy - 12);
    olaylar.slice(0, 4).forEach((o, i) => {
      const r = o.sev === 'alarm' ? C.alarm : o.sev === 'uyari' ? C.uyari : o.sev === 'ok' ? C.ok : C.soluk;
      yaz(x, `${o.t}  ${o.metin}`.slice(0, 64), 480, gy + 18 + i * 22, FM(500, 14), r);
    });
  }

  // masa monitörleri: 0 = kapsayıcı listesi, 1 = çekirdekler, 2 = gecikme, 3 = olay günlüğü
  const terminal = (x, W, H, baslikM) => { x.fillStyle = '#0a0f14'; x.fillRect(0, 0, W, H); x.fillStyle = '#16212c'; x.fillRect(0, 0, W, 26); yaz(x, baslikM, 10, 13, FM(600, 13), C.soluk); };
  const MASA_CIZ = [
    (x, W, H) => {
      terminal(x, W, H, '$ docker compose ps');
      YEREL.forEach((id, i) => {
        const s = SV[id];
        yaz(x, s.ad.padEnd(20, ' '), 10, 46 + i * 30, FM(500, 15), C.metin);
        yaz(x, s.durum === 'cok' ? 'exited (1)' : s.durum === 'yeni' ? 'restarting' : 'running', W - 10, 46 + i * 30, FM(600, 15), durumRenk(s), 'right');
      });
    },
    (x, W, H) => {
      terminal(x, W, H, 'htop · 16 çekirdek');
      for (let k = 0; k < 16; k++) {
        const v = clamp(cpu + Math.sin(simT * 1.7 + k * 1.3) * 14 + gurultu(5), 1, 100);
        const col = k % 2, row = Math.floor(k / 2);
        const px = 10 + col * (W / 2), py = 38 + row * 24, w = W / 2 - 60;
        yaz(x, String(k).padStart(2, '0'), px, py + 7, FM(500, 12), C.soluk);
        x.fillStyle = '#1b2733'; x.fillRect(px + 24, py, w, 14);
        x.fillStyle = v > 85 ? C.alarm : v > 60 ? C.uyari : C.ok; x.fillRect(px + 24, py, w * v / 100, 14);
      }
    },
    (x, W, H) => {
      terminal(x, W, H, 'uptime · gecikme (ms)');
      ['dokamuh', 'arkoz', 'pages', 'veri'].forEach((id, i) => {
        const s = SV[id];
        yaz(x, s.ad, 10, 48 + i * 52, FM(600, 14), C.metin);
        yaz(x, s.erisilemez ? 'ERİŞİM YOK' : `${fmt(s.lat, 0)} ms`, W - 10, 48 + i * 52, FM(600, 14), s.erisilemez ? C.alarm : C.ok, 'right');
        x.strokeStyle = s.erisilemez ? C.alarm : C.vurgu; x.lineWidth = 1.6; x.beginPath();
        for (let k = 0; k < 40; k++) { const X = 10 + k * (W - 20) / 39, Y = 70 + i * 52 - (Math.sin(simT * 2 + k * 0.7 + i) * 0.5 + 0.5) * 12; k ? x.lineTo(X, Y) : x.moveTo(X, Y); }
        x.stroke();
      });
    },
    (x, W, H) => {
      terminal(x, W, H, 'journalctl -f');
      olaylar.slice(0, 8).forEach((o, i) => {
        const r = o.sev === 'alarm' ? C.alarm : o.sev === 'uyari' ? C.uyari : o.sev === 'ok' ? C.ok : C.soluk;
        yaz(x, `${o.t} ${o.metin}`.slice(0, 40), 10, 44 + i * 26, FM(500, 13), r);
      });
    },
  ];
  function cizUps(x, W, H) {
    x.fillStyle = '#0c2a1c'; x.fillRect(0, 0, W, H);
    yaz(x, ups === 'sebeke' ? 'ŞEBEKE' : ups === 'aku' ? 'AKÜDE' : 'JENERATÖR', 12, 24, FM(700, 22), ups === 'sebeke' ? '#7ee2a8' : '#ffd166');
    yaz(x, `Yük  ${fmt(upsYuk, 1)} kW`, 12, 62, FM(500, 18), '#7ee2a8');
    yaz(x, `Akü  %${fmt(aku, 0)}`, 12, 92, FM(500, 18), aku < 40 ? '#ff8a80' : '#7ee2a8');
    yaz(x, '230 V · 50 Hz', 12, 122, FM(500, 15), '#4fae7d');
  }

  function cizAku(x, W, H) {
    x.fillStyle = '#10161c'; x.fillRect(0, 0, W, H);
    const n = 5, h = (H - 12) / n;
    for (let k = 0; k < n; k++) {
      const dolu = aku > k * 20 + 5;
      const sonDilim = ups === 'aku' && k === Math.floor((aku - 1) / 20);
      x.fillStyle = !dolu ? '#1c2620' : sonDilim && Math.floor(simT * 2) % 2 ? '#3b5a43' : aku < 40 ? '#e0a020' : '#2ea043';
      x.fillRect(8, H - 6 - (k + 1) * h + 3, W - 16, h - 6);
    }
  }

  // ---------------------------------------------------------------- durum
  function durumBilgi() {
    if (senaryo && senaryo.tip === 'coktu') {
      const s = SV[senaryo.hedef];
      if (s.durum === 'cok') return { metin: s.id === 'nginx' ? 'NGINX ÇÖKTÜ · YEREL SERVİSLERE ERİŞİM YOK' : `${s.ad.toUpperCase()} ÇÖKTÜ · OTOMATİK YENİDEN BAŞLATMA BEKLENİYOR`, seviye: 'alarm' };
      return { metin: `${s.ad.toUpperCase()} YENİDEN BAŞLIYOR`, seviye: 'uyari' };
    }
    if (senaryo && senaryo.tip === 'sogutma') return { metin: tSoguk > 27 ? `SOĞUK KORİDOR ${fmt(tSoguk, 1)} °C · CRAC-1 ARIZALI` : `CRAC-1 ARIZALI · CRAC-2 %${fmt(fan[1], 0)} (N+1)`, seviye: tSoguk > 27 ? 'alarm' : 'uyari' };
    if (ups === 'aku') return { metin: `ŞEBEKE YOK · UPS AKÜDE %${fmt(aku, 0)}`, seviye: 'alarm' };
    if (ups === 'jen') return { metin: 'JENERATÖR DEVREDE · UPS ŞARJDA', seviye: 'uyari' };
    if (disk > 85) return { metin: `DİSK %${fmt(disk, 0)} · TEMİZLİK`, seviye: 'uyari' };
    if (uyarT.t > 0) return { metin: uyarT.metin, seviye: 'uyari' };
    if (bakim) return { metin: tek.icerde ? `BAKIM MODU · RAF-${BAKIM_RAF + 1}` : 'BAKIM MODU · TEKNİSYEN YOLDA', seviye: 'uyari' };
    if (deploy) return { metin: `DEPLOY · ${deploy.i + 1}/${deploy.sira.length} · ${SV[deploy.sira[deploy.i]].ad}`, seviye: 'calisiyor' };
    if (yedek) return { metin: `YEDEKLEME %${Math.round((yedek.t / yedek.sure) * 100)}`, seviye: 'calisiyor' };
    return { metin: `TÜM SERVİSLER ÇALIŞIYOR · ${fmt(istek, 0)} istek/s`, seviye: 'calisiyor' };
  }

  const trend = new Trend([{ ad: 'CPU %', renk: '#f0883e' }, { ad: 'RAM %', renk: '#a371f7' }, { ad: 'CRAC fan %', renk: '#39c5cf' }], { min: 0, max: 100, birim: '%' });

  // ---------------------------------------------------------------- kontroller
  const kontroller = [
    { tip: 'baslik', metin: 'Operasyon' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Deploy (sıralı yeniden başlatma)', tur: 'basla', tik: deployBaslat },
      { metin: 'Yedekleme başlat', tik: yedekBaslat },
    ] },
    { tip: 'kaydirici', metin: 'Yük testi (trafik)', min: 0, max: 100, adim: 5, birim: '%', get: () => yuk, set: (v) => { yuk = v; } },
    { tip: 'baslik', metin: 'Arıza senaryosu' },
    { tip: 'secim', metin: 'Senaryo', secenekler: [['coktu', 'Kapsayıcı çöküşü'], ['sogutma', 'Soğutma arızası (CRAC-1)'], ['sebeke', 'Elektrik kesintisi (UPS → jeneratör)'], ['disk', 'Disk doluluk uyarısı']],
      get: () => senaryoSec, set: (v) => { senaryoSec = v; } },
    { tip: 'secim', metin: 'Çökecek kapsayıcı', secenekler: [['veri', 'veri-panel'], ['plc', 'plc-kopru'], ['mail', 'mail-analiz'], ['nginx', 'nginx-proxy (hepsini etkiler)']],
      get: () => cokecek, set: (v) => { cokecek = v; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Senaryoyu başlat', tur: 'acil', tik: senaryoBaslat },
      { metin: 'Sıfırla', tik: senaryoSifirla },
    ] },
    { tip: 'baslik', metin: 'Bakım' },
    { tip: 'anahtar', metin: 'Bakım modu (teknisyen odaya girer)', get: () => bakim, set: (v) => { bakim = v; if (v) olay('bakım modu açıldı', 'bilgi'); else olay('bakım modu kapandı', 'bilgi'); } },
  ];

  // açılış: ekranlar boş görünmesin
  duvar[0].ciz(cizServisler); duvar[1].ciz(cizKaynak); duvar[2].ciz(cizMimari);
  masaEkran.forEach((e, k) => e.ciz(MASA_CIZ[k])); upsLcd.ciz(cizUps); akuBar.ciz(cizAku);
  tekGuncelle(0, 0);

  // Performans (lib.sabitle): hareket eden / görünürlüğü ya da malzemesi değişen düğümler birleştirilmez
  const sabitHaric = () => [kapi, ...pkapi, robot];

  return {
    id: 'sunucu',
    sabitHaric,
    ad: 'Sunucu Odası · Web & Veri Altyapısı',
    altBaslik: 'Linux · Docker · Nginx · NOC',
    kisa: 'Web ve veri altyapımın temsili sunucu odası: Linux üzerinde Docker kapsayıcıları, Nginx ters vekil + SSL, endüstriyel veri görselleştirme ve PLC veri köprüsü, e-posta analiz paneli, teklif otomasyonu ve Asterisk çağrı yönlendirme; kurumsal siteler (dokamuh.com, arkozmakine.com) ile GitHub Pages / Actions izleme ekranında. Soğuk koridor, CRAC, UPS ve yedek kütüphanesi çalışır; deploy, yük testi ve arıza senaryoları denenebilir.',
    proje: 'webserver-setup',
    ayakIzi: [24, 9.2],
    ayakIziMerkez: [2, -0.6],
    kamera: { poz: [-2.5, 6.8, 13.5], hedef: [1.2, 1.2, -1.4] },
    mekanizmalar: [
      'Soğuk koridor podu (2 × 5 raf): CRAC üniteleri yükseltilmiş döşemeden soğuk hava basar (mavi akış parçacıkları); fan hızı yük ve sıcaklıkla artar',
      'Raf LED\'leri: her raf bir servise bağlı; trafik arttıkça aktivite sıklaşır, deploy\'da sarı, çöküşte kırmızı yanıp söner, bakımda mavi',
      'Yedek kütüphanesi: yedekleme sırasında robot kol kartuşları raflar arasında taşır',
      'Otomatik kayar cam kapı ve soğuk koridor kapısı: teknisyen yaklaşınca açılır',
      'Teknisyen bakım modunda odaya girip ilgili rafta çalışır; NOC operatörü ekranları izler, alarmda video duvarına döner',
      'NOC video duvarı: servis durumu, trafik/kaynak grafikleri, mimari akış (paketler) ve deploy günlüğü canlı; masada kapsayıcı listesi, çekirdekler, gecikme ve günlük',
      'UPS: şebeke kesintisinde aküye geçer (akü seviyesi düşer), jeneratör devreye girince şarj olur; CRAC arızasında yedek ünite %100\'e çıkar (N+1)',
    ],
    cikarim: [
      'PORTFÖYDEKİ İŞ: 5+ web sunucusu kurulumu ve yönetimi; Linux üzerinde Docker kapsayıcıları, Nginx ile ters vekil / yük dengeleme ve SSL/TLS; şirket sitesi 5 yıl boyunca %99 çalışma oranı; endüstriyel veri görselleştirme platformu; özel e-posta sistemi.',
      'GITHUB DEPOLARINDAN (yalnız yüksek seviye): kurumsal WordPress sitesinin barındırma, yedek, bakım ve SEO yönetimi (dokamuh.com); çok sayfalı statik ürün sitesi, JSON-LD ve çok dilli yapı (arkozmakine.com); IMAP → SQLite e-posta analiz paneli (günlük artımlı senkron, HTTPS + kimlik doğrulama); Excel şablonunu bozmadan teklif üretip PDF\'e çeviren otomasyon; Asterisk / PJSIP tabanlı TR/EN IVR çağrı yönlendirme; PLC ↔ PC Modbus TCP veri köprüsü; Flutter uygulamaları için GitHub Actions derleme + test hattı; GitHub Pages yayınları (portföy, sanal fabrika).',
      'TEMSİLİ: oda, raf sayısı ve donanım (10 raf, soğuk koridor, 2 CRAC, UPS + akü, yedek kütüphanesi, NOC) görselleştirme içindir; gerçek altyapı birkaç sunucu ve paylaşımlı barındırmadır. Ekranlardaki trafik, CPU, sıcaklık ve gecikme değerleri benzetimdir; iç adres, parola ya da müşteri verisi gösterilmez.',
      'TAHMİN: senaryo süreleri (yeniden başlatma ~3 s, jeneratörün devreye girmesi ~10 s, CRAC arızasının giderilmesi ~35 s) gösterim için kısaltıldı.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => {
      const calisan = SERVIS.filter((s) => s.durum !== 'cok' && !s.erisilemez).length;
      return [
        ['Servisler', `${calisan}/${SERVIS.length} erişilebilir`],
        ['Trafik', `${fmt(istek, 0)} istek/s · ${baglanti} bağlantı`],
        ['CPU / RAM (küme)', `%${fmt(cpu, 0)} · %${fmt(ram, 0)}`],
        ['Soğuk / sıcak koridor', `${fmt(tSoguk, 1)} °C · ${fmt(tSicak, 1)} °C`],
        ['CRAC-1 / CRAC-2 fan', `${crac[0] ? '%' + fmt(fan[0], 0) : 'ARIZALI'} · %${fmt(fan[1], 0)}`],
        ['UPS', `${ups === 'sebeke' ? 'şebeke' : ups === 'aku' ? 'akü' : 'jeneratör'} · akü %${fmt(aku, 0)} · ${fmt(upsYuk, 1)} kW`],
        ['Disk (veri) / G/Ç', `%${fmt(disk, 0)} · ${fmt(diskIO, 0)} MB/s`],
        ['Yedekleme', yedek ? `%${Math.round((yedek.t / yedek.sure) * 100)} sürüyor` : sonYedek],
        ['Son deploy', sonDeploy],
        ['CI (GitHub Actions)', SV.ci.durum === 'calis' ? `#${ciNo} derleniyor` : `#${ciNo} ${ciDurum}`],
        ['Teknisyen', tek.metin],
        ['Çalışma oranı', '%99 · 5 yıl (kurumsal site)'],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
