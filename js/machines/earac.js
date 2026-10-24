// js/machines/earac.js — Üniversite Elektrikli Araç Projesi (TEMSİLİ).
//
// Kaan üniversite elektrikli araç proje ekibinde yer aldı (CV: "üniversite elektrikli araç proje
// ekibi üyeliği"); aracın kendisinin fotoğrafı/ölçüsü yok. Temsili model: verimlilik yarışı
// (Efficiency Challenge) tipi tek kişilik aerodinamik araç — damla gövde, kabarcık kanopi,
// 4 teker, arka sağ tekerde göbek motoru. Şasi dinamometresinde: arka tekerler makaralarda,
// önde soğutma fanı, yanda dyno kontrol masası. Üst kabuk arkadan menteşeli kalkar; altta
// alüminyum şasi, koltuk, direksiyon, LiFePO4 pil paketi + BMS, motor sürücü, HV kabloları.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, pipe, mat, lamba, Ekran, Trend, levha, canvasTex,
    clamp, lerp, approach, damp, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const CX = 0.4, CZ = -0.3, CY = 0.11;   // araç merkezi (dyno üstünde, tekerler 11 cm yukarıda)

  // ---------------------------------------------------------------- dinamometre platformu
  const RA = -0.95, FA = 0.95;               // arka / ön aks (araç-yerel x)
  const gri = mat(0x5d656d, { r: 0.6, m: 0.5, key: 'ea-platform' });
  const PX0 = CX - 1.95, PX1 = CX + 1.85, PGAP0 = CX + RA - 0.32, PGAP1 = CX + RA + 0.32;
  box(PGAP0 - PX0, 0.08, 1.7, gri, (PX0 + PGAP0) / 2, 0.04, CZ, g);
  box(PX1 - PGAP1, 0.08, 1.7, gri, (PGAP1 + PX1) / 2, 0.04, CZ, g);
  box(PGAP1 - PGAP0, 0.01, 1.7, M.siyah, (PGAP0 + PGAP1) / 2, 0.005, CZ, g);   // makara çukuru
  for (const sz of [-1, 1]) box(PGAP1 - PGAP0, 0.08, 0.06, M.sari, (PGAP0 + PGAP1) / 2, 0.04, CZ + sz * 0.82, g);
  box(0.5, 0.04, 1.7, gri, PX0 - 0.25, 0.02, CZ, g).rotation.z = 0.15;      // rampa
  // makaralar: her arka tekerin altında iki makara
  const makaralar = [];
  for (const sz of [-1, 1]) for (const dx of [-0.13, 0.13]) {
    const m = cyl(0.085, 0.24, M.celik, CX + RA + dx, 0.025, CZ + sz * 0.42, g, { eksen: 'z', seg: 20 });
    makaralar.push(m);
  }
  for (const sz of [-1, 1]) {   // fren/volan ünitesi + kayış kapağı
    box(0.42, 0.34, 0.2, mat(0x23487a, { r: 0.5, m: 0.3, key: 'ea-dyno' }), CX + RA, 0.17, CZ + sz * 0.98, g);
    cyl(0.12, 0.06, M.koyu, CX + RA, 0.2, CZ + sz * 1.1, g, { eksen: 'z', seg: 20 });
  }
  // ön teker takozları
  for (const sz of [-1, 1]) box(0.34, 0.03, 0.16, M.sari, CX + FA, 0.095, CZ + sz * 0.53, g);

  // ---------------------------------------------------------------- araç (yerel: +X burun, zemin y=0)
  const arac = new THREE.Group();
  arac.position.set(CX, CY, CZ);
  g.add(arac);
  // damla gövde profili (yarıçap, burundan uzaklık): kesit dairesel, yükseklikte ×0.72
  const prof = [[0, 0], [0.2, 0.06], [0.32, 0.16], [0.42, 0.35], [0.48, 0.6], [0.5, 0.95], [0.49, 1.3], [0.45, 1.8], [0.36, 2.3], [0.24, 2.7], [0.12, 2.92], [0.02, 3.0]]
    .map(([r, a]) => new THREE.Vector2(r, a));
  const L = 3.0, YM = 0.42, SY = 0.72;
  function govdeYarisi(ust) {
    const geo = new THREE.LatheGeometry(prof, 36, ust ? 0 : Math.PI, Math.PI);
    geo.rotateZ(Math.PI / 2);          // eksen Y → −X (burun +X'te kalsın diye kaydırılır)
    geo.scale(1, SY, 1);
    geo.translate(L / 2, YM, 0);
    geo.computeVertexNormals();
    return geo;
  }
  const kabukTex = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#f2f4f6'; x.fillRect(0, 0, w, h);
    for (const u of [0.1, 0.9]) {   // iki yanda takım şeridi (lacivert + kırmızı ince)
      x.fillStyle = '#1d4f91'; x.fillRect(w * (u - 0.035), 0, w * 0.07, h);
      x.fillStyle = '#d0302a'; x.fillRect(w * (u + (u < 0.5 ? 0.045 : -0.06)), 0, w * 0.015, h);
    }
  });
  const kabukMat = new THREE.MeshStandardMaterial({ map: kabukTex, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide });
  const tabanMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
  const alt = new THREE.Mesh(govdeYarisi(false), tabanMat); alt.castShadow = true; alt.receiveShadow = true; arac.add(alt);
  // üst kabuk: arkadan menteşeli (pivot kuyrukta)
  const PIV = V(-1.42, YM, 0);
  const kabuk = new THREE.Group(); kabuk.position.copy(PIV); arac.add(kabuk);
  const ust = new THREE.Mesh(govdeYarisi(true), kabukMat); ust.position.set(-PIV.x, -PIV.y, 0); ust.castShadow = true; kabuk.add(ust);
  const kanopiMat = new THREE.MeshStandardMaterial({ color: 0x1c2b3a, transparent: true, opacity: 0.62, roughness: 0.05, metalness: 0.3, depthWrite: false });
  const kanopi = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), kanopiMat);
  kanopi.scale.set(0.62, 0.72, 0.36); kanopi.position.set(0.12 - PIV.x, 0.6 - PIV.y, 0);
  kabuk.add(kanopi);
  const numara = levha(['07'], 0.26, 0.26, { bg: '#ffffff', fg: '#1d4f91', font: 150, px: 256 });
  numara.position.set(0.55 - PIV.x, 0.5 - PIV.y, 0.497); numara.rotation.set(-0.2, 0.05, 0);
  kabuk.add(numara);

  // iç donanım (araç-yerel)
  const alu = M.alu;
  for (const s of [-1, 1]) {
    rod(V(-1.3, 0.13, s * 0.17), V(1.2, 0.13, s * 0.2), 0.015, alu, arac, 8);
    rod(V(-0.55, 0.13, s * 0.19), V(-0.55, 0.74, s * 0.13), 0.014, alu, arac, 8);   // devrilme çemberi
  }
  for (const x of [-1.2, -0.55, 0.2, 0.9]) rod(V(x, 0.13, -0.2), V(x, 0.13, 0.2), 0.012, alu, arac, 8);
  rod(V(-0.55, 0.74, -0.13), V(-0.55, 0.74, 0.13), 0.014, alu, arac, 8);
  const koltuk = mat(0x1e3c6e, { r: 0.85, key: 'ea-koltuk' });
  box(0.55, 0.04, 0.36, koltuk, -0.15, 0.19, 0, arac).rotation.z = -0.06;
  box(0.04, 0.46, 0.34, koltuk, -0.46, 0.4, 0, arac).rotation.z = -0.55;   // yatık sırtlık
  cyl(0.012, 0.42, M.koyu, 0.66, 0.37, 0, arac, { seg: 8 }).rotation.z = 1.05;   // direksiyon mili
  const dir = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), M.siyah);
  dir.position.set(0.47, 0.47, 0); dir.rotation.y = Math.PI / 2; dir.rotation.x = 0.5; arac.add(dir);
  for (const s of [-1, 1]) box(0.03, 0.08, 0.05, M.koyu, 1.05, 0.2, s * 0.07, arac);   // pedallar
  const pil = mat(0x2a2e33, { r: 0.6, m: 0.2, key: 'ea-pil' });
  box(0.44, 0.16, 0.34, pil, -0.88, 0.22, 0, arac);
  box(0.44, 0.01, 0.34, mat(0xef7d00, { r: 0.6, key: 'ea-hv' }), -0.88, 0.305, 0, arac);   // HV turuncu kapak
  box(0.18, 0.025, 0.12, mat(0x1f7a3a, { r: 0.5, key: 'ea-bms' }), -0.86, 0.32, 0.07, arac);  // BMS kartı
  for (let i = 0; i < 4; i++) box(0.02, 0.012, 0.02, M.koyu, -0.93 + i * 0.03, 0.34, 0.07, arac);
  box(0.24, 0.07, 0.14, alu, -1.18, 0.2, 0.08, arac);   // motor sürücü
  for (let i = -2; i <= 2; i++) box(0.24, 0.02, 0.006, alu, -1.18, 0.245, 0.08 + i * 0.024, arac);
  const hv = mat(0xff6a00, { r: 0.55, key: 'ea-hvkablo' });
  pipe([V(-0.66, 0.23, 0.12), V(-1.0, 0.22, 0.14), V(-1.06, 0.21, 0.1)], 0.012, hv, arac);
  pipe([V(-1.3, 0.2, 0.12), V(-1.1, 0.24, 0.3), V(RA, 0.25, 0.36)], 0.012, hv, arac);
  box(0.1, 0.05, 0.08, M.siyah, -1.2, 0.22, -0.12, arac);   // telemetri
  rod(V(-1.2, 0.25, -0.12), V(-1.2, 0.48, -0.12), 0.003, M.koyu, arac, 5);
  const dash = new Ekran(0.13, 0.075, 160);
  dash.mesh.position.set(0.6, 0.5, 0); dash.mesh.rotation.set(0, -Math.PI / 2, 0); dash.mesh.rotateX(-0.3);
  arac.add(dash.mesh);
  // KILL düğmesi (dışarıdan, sağ yanda)
  box(0.08, 0.08, 0.04, M.sari, 0.2, 0.4, 0.49, arac);
  cyl(0.028, 0.03, M.kirmizi, 0.2, 0.4, 0.52, arac, { eksen: 'z', seg: 16 });

  // tekerler (20"): arka sağda göbek motoru
  const R = 0.25;
  const gLas = new THREE.TorusGeometry(R - 0.025, 0.025, 8, 36), gJ = new THREE.TorusGeometry(R - 0.05, 0.01, 6, 36);
  function teker(motorlu) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(gLas, M.kaucuk), new THREE.Mesh(gJ, alu));
    w.children.forEach((c) => (c.castShadow = true));
    if (!motorlu) cyl(R - 0.06, 0.012, mat(0xd8dde2, { r: 0.3, m: 0.6, key: 'ea-disk' }), 0, 0, 0, w, { eksen: 'z', seg: 28 });   // aero jant kapağı (motorlu tekerde motor görünsün)
    else for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; rod(V(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0), V(Math.cos(a) * (R - 0.055), Math.sin(a) * (R - 0.055), 0), 0.003, M.celik, w, 4); }
    if (motorlu) { cyl(0.11, 0.07, M.koyu, 0, 0, 0, w, { eksen: 'z', seg: 26 }); cyl(0.07, 0.074, alu, 0, 0, 0, w, { eksen: 'z', seg: 20 }); }
    else cyl(0.03, 0.06, alu, 0, 0, 0, w, { eksen: 'z', seg: 12 });
    box(0.03, 0.02, 0.005, M.koyu, R - 0.12, 0, 0.007, w);   // dönüş görünsün diye jant işareti
    lib.sabitle(w);
    return w;
  }
  const tekerler = [];
  for (const [x, z, mt] of [[FA, 0.53, false], [FA, -0.53, false], [RA, 0.42, true], [RA, -0.42, false]]) {
    const w = teker(mt); w.position.set(x, R, z); arac.add(w); tekerler.push({ w, arka: x < 0 });
  }

  // ---------------------------------------------------------------- soğutma fanı, kontrol masası, tabela
  const FX = CX + 2.35;
  const fan = new THREE.Group(); fan.position.set(FX, 0.6, CZ); g.add(fan);
  const fanCerceve = new THREE.Group(); g.add(fanCerceve);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), M.koyu);
  halka.position.set(FX, 0.6, CZ); halka.rotation.y = Math.PI / 2; fanCerceve.add(halka);
  for (const s of [-1, 1]) rod(V(FX, 0.0, CZ + s * 0.35), V(FX, 0.6, CZ + s * 0.2), 0.02, M.koyu, fanCerceve, 8);
  box(0.3, 0.04, 0.9, M.koyu, FX, 0.02, CZ, fanCerceve);
  cyl(0.08, 0.14, M.koyu, FX + 0.06, 0.6, CZ, fanCerceve, { eksen: 'x', seg: 16 });
  for (let i = 0; i < 5; i++) {
    const k = box(0.02, 0.36, 0.11, mat(0x8fa3b5, { r: 0.4, m: 0.6, key: 'ea-fan' }), 0, 0.2, 0, fan);
    const p = new THREE.Group(); p.rotation.x = (i / 5) * Math.PI * 2; p.add(k); fan.add(p); k.rotation.y = 0.35;
  }
  lib.sabitle(fan);
  const DX = -3.3, DZ = 1.5;   // dyno kontrol masası
  box(1.4, 0.04, 0.7, M.siyah, DX, 0.76, DZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.74, 0.04, M.koyu, DX + sx * 0.65, 0.37, DZ + sz * 0.3, g);
  box(0.66, 0.42, 0.03, M.siyah, DX, 1.12, DZ - 0.25, g);
  const ekran = new Ekran(0.62, 0.38, 512);
  ekran.mesh.position.set(DX, 1.12, DZ - 0.234);
  g.add(ekran.mesh);
  box(0.36, 0.02, 0.24, M.koyu, DX + 0.45, 0.79, DZ + 0.05, g);   // laptop
  const dynoPano = new THREE.Group(); g.add(dynoPano);
  lib.pano(dynoPano, -3.6, 0, -1.5, 0.8, 1.6, 0.4, Math.PI / 2);
  const kule = lib.kuleLambasi(g, -3.6, 1.6, -1.5);
  const tabela = levha(['ÜNİVERSİTE ELEKTRİKLİ ARAÇ PROJESİ', 'temsili model · verimlilik yarışı aracı · şasi dinamometresi'], 3.4, 0.5, { bg: '#17324f', font: 62, px: 1200 });
  tabela.position.set(CX, 2.6, CZ - 1.9);
  g.add(tabela);
  for (const s of [-1, 1]) rod(V(CX + s * 1.5, 0, CZ - 1.9), V(CX + s * 1.5, 2.85, CZ - 1.9), 0.025, M.koyu, g, 8);
  // takım dolabı + şarj arabası
  box(0.7, 0.9, 0.45, M.kirmizi, 3.5, 0.45, -2.0, g);
  for (let i = 0; i < 4; i++) box(0.66, 0.012, 0.01, M.koyu, 3.5, 0.2 + i * 0.2, -1.77, g);
  box(0.5, 0.7, 0.4, M.pano, -2.0, 0.35, -2.0, g);
  box(0.3, 0.12, 0.02, mat(0x0d2a3a, { r: 0.3, key: 'ea-sarjek' }), -2.0, 0.6, -1.79, g);

  // ---------------------------------------------------------------- operatör (takım mühendisi)
  const op = lib.operator({ logo: false, yelek: 0x2a6fdb, gomlek: 0x1b1f27 });
  g.add(op.group);
  const MASA = [DX, DZ + 0.62];
  const opS = { x: MASA[0], z: MASA[1], yon: Math.PI, hx: MASA[0], hz: MASA[1], hyon: Math.PI, poz: 'on' };
  const opHedef = (x, z, yon, poz = 'on') => { opS.hx = x; opS.hz = z; opS.hyon = yon; opS.poz = poz; };
  const opVardi = () => Math.hypot(opS.hx - opS.x, opS.hz - opS.z) < 0.03;
  function opGuncelle(dt, t) {
    const dx = opS.hx - opS.x, dz = opS.hz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.25 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(yuruyor ? 'yan' : opS.poz);
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }

  // ---------------------------------------------------------------- dyno / araç modeli
  // m = 150 kg (araç ≈ 85 + sürücü ≈ 65), Crr 0.0055, CdA 0.13 m², motor+sürücü verimi %88, rejen %60.
  const KTL = 150, CRR = 0.0055, CDA = 0.13, ETA = 0.88;
  const PIL_WH = 1024;   // 16S LiFePO4 51.2 V 20 Ah (temsili)
  const PROF = { sabit: 'Sabit hız', parkur: 'Yarış parkuru döngüsü', rejen: 'Rejeneratif fren testi' };
  let profil = 'parkur', test = false, hedefHiz = 30, fanAcik = true, kill = false, demo = true, demoT = 0, demoAdim = 0;
  let kabukAcik = false, kabukK = 0, kabukIs = null;   // kabukIs: hedef durum (operatör yürüyüp kaldırır)
  let v = 0, a = 0, pMek = 0, pEl = 0, soc = 0.9, sicaklik = 27, profT = 0, mesafe = 0, enerji = 0;
  let volt = 52, akim = 0, rpm = 0, tork = 0;
  const parkurHiz = (t) => {   // 40 s döngü (km/h)
    const T = t % 40;
    if (T < 8) return 35 * (T / 8);
    if (T < 18) return 35;
    if (T < 22) return 35 - 17 * ((T - 18) / 4);
    if (T < 26) return 18;
    if (T < 32) return 18 + 14 * ((T - 26) / 6);
    if (T < 36) return 32;
    return 32 * (1 - (T - 36) / 4);
  };
  const rejenHiz = (t) => { const T = t % 14; return T < 5 ? 35 * (T / 5) : T < 7 ? 35 : 35 - 30 * ((T - 7) / 7); };

  function fizik(dt) {
    const hedef = kill || !test ? 0 : profil === 'sabit' ? hedefHiz : profil === 'parkur' ? parkurHiz(profT) : rejenHiz(profT);
    if (test && !kill) profT += dt;
    const v0 = v;
    const amax = profil === 'rejen' && hedef < v ? 1.6 : 1.2;   // km/h/s ölçeğinde değil: m/s²
    v = approach(v, hedef, amax * 3.6 * dt);
    if (kill) v = approach(v0, 0, 2.5 * 3.6 * dt);
    a = (v - v0) / 3.6 / Math.max(dt, 1e-4);
    const vm = v / 3.6;
    const F = CRR * KTL * 9.81 * (vm > 0.05 ? 1 : 0) + 0.5 * 1.2 * CDA * vm * vm + KTL * a;
    pMek = F * vm;
    pEl = kill ? 0 : pMek >= 0 ? pMek / ETA : pMek * 0.6;
    volt = 16 * (3.12 + 0.3 * soc) - (pEl / 51) * 0.03;
    akim = pEl / volt;
    soc = clamp(soc - (pEl * dt * 10) / (PIL_WH * 3600), 0, 1);   // ×10 hızlandırılmış
    sicaklik += (Math.abs(akim) * Math.abs(akim) * 0.0011 - (sicaklik - 26) * (fanAcik ? 0.05 : 0.012)) * dt * 3;
    rpm = (vm / (2 * Math.PI * R)) * 60;
    tork = rpm > 1 && !kill ? pMek / ((rpm * 2 * Math.PI) / 60) : 0;
    mesafe += (vm * dt) / 1000; enerji += (pEl * dt) / 3600;
    if (soc <= 0.03) test = false;
  }

  const trend = new Trend([
    { ad: 'Hız (km/h)', renk: '#39c5cf' }, { ad: 'Güç (W/10)', renk: '#f2c200' }, { ad: 'Pil sıcaklığı (°C)', renk: '#f85149' },
  ], { min: -20, max: 60, uzunluk: 300 });
  const ekranZ = throttle(4), dashZ = throttle(4);
  const verim = () => (v > 3 ? pEl / v : 0);   // Wh/km

  function kabukGuncelle(dt) {
    if (kabukIs !== null) {
      // operatör burna yürür, kabuğu kaldırır/indirir, masaya döner
      if (kabukIs.faz === 0) { opHedef(CX + 1.7, CZ + 0.75, -Math.PI * 0.6); if (opVardi()) kabukIs.faz = 1; }
      else if (kabukIs.faz === 1) {
        opS.poz = 'yukari';
        kabukK = approach(kabukK, kabukIs.hedef ? 1 : 0, dt / 2.2);
        if (kabukK === (kabukIs.hedef ? 1 : 0)) { kabukAcik = kabukIs.hedef; kabukIs = null; }
      }
    }
    kabuk.rotation.z = easeInOut(kabukK) * 0.95;
  }

  function demoGuncelle(dt) {
    demoT += dt;
    const sira = [
      () => { kabukIs = { hedef: true, faz: 0 }; return 12; },          // kabuğu aç, iç donanım
      () => { kabukIs = { hedef: false, faz: 0 }; return 7; },
      () => { profil = 'parkur'; profT = 0; test = true; return 42; },   // parkur döngüsü
      () => { test = false; return 5; },
      () => { profil = 'rejen'; profT = 0; test = true; return 30; },
      () => { test = false; if (soc < 0.4) soc = 0.95; return 6; },
    ];
    if (demoT >= (demoGuncelle.sure || 0)) { demoT = 0; demoGuncelle.sure = sira[demoAdim % sira.length](); demoAdim++; }
  }

  function update(dt, t) {
    if (demo && !kill) demoGuncelle(dt);
    fizik(dt);
    kabukGuncelle(dt);
    // tekerler + makaralar + fan
    const wv = (v / 3.6 / R) * dt;
    for (const tk of tekerler) if (tk.arka) tk.w.rotation.z -= wv;
    for (const m of makaralar) m.rotation.y += (v / 3.6 / 0.085) * dt;   // eksen z'ye yatık silindir: yerel Y
    if (fanAcik) fan.rotation.x += dt * 14;
    if (kabukIs === null) opHedef(MASA[0], MASA[1], Math.PI, 'on');
    opGuncelle(dt, t);
    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [v, pEl / 10, sicaklik]);
    if (ekranZ(dt)) {
      ekran.standart('Şasi Dinamometresi', [
        ['Profil', test ? PROF[profil] : 'beklemede'],
        ['Hız', `${fmt(v, 1)} km/h`],
        ['Güç / tork', `${fmt(pEl, 0)} W · ${fmt(tork, 1)} Nm`],
        ['Verim', v > 3 ? `${fmt(verim(), 2)} Wh/km` : '—'],
        ['Pil', `%${fmt(soc * 100, 0)} · ${fmt(sicaklik, 1)} °C`],
      ], d);
    }
    if (dashZ(dt)) {
      dash.ciz((x, W, H) => {
        x.fillStyle = '#05080b'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#7df9ff'; x.font = `700 ${Math.round(H * 0.5)}px "JetBrains Mono", monospace`;
        x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText(fmt(v, 0), W * 0.06, H * 0.42);
        x.font = `500 ${Math.round(H * 0.18)}px "Space Grotesk", sans-serif`; x.fillStyle = '#c9d1d9';
        x.fillText(`${fmt(pEl, 0)} W`, W * 0.56, H * 0.3);
        x.fillText(`%${fmt(soc * 100, 0)}`, W * 0.56, H * 0.6);
        x.fillStyle = kill ? '#f85149' : '#2ea043'; x.fillRect(0, H * 0.86, W, H * 0.14);
      });
    }
  }

  function durumBilgi() {
    if (kill) return { metin: 'KILL SWITCH · HV KESİK', seviye: 'alarm' };
    if (kabukIs) return { metin: kabukIs.hedef ? 'KABUK AÇILIYOR' : 'KABUK KAPANIYOR', seviye: 'calisiyor' };
    if (test && sicaklik > 42) return { metin: `PİL SICAKLIĞI YÜKSEK · ${fmt(sicaklik, 0)} °C`, seviye: 'uyari' };
    if (test) return { metin: `DYNO · ${PROF[profil]} · ${fmt(v, 0)} km/h · ${fmt(pEl, 0)} W`, seviye: 'calisiyor' };
    if (soc < 0.1) return { metin: 'PİL ZAYIF', seviye: 'uyari' };
    return { metin: `HAZIR · kabuk ${kabukAcik ? 'açık' : 'kapalı'}`, seviye: 'bekliyor' };
  }

  const elle = () => { demo = false; };
  const kontroller = [
    { tip: 'anahtar', metin: 'Kabuk açık (iç donanımı göster)', get: () => (kabukIs ? kabukIs.hedef : kabukAcik),
      set: (vv) => { elle(); kabukIs = { hedef: !!vv, faz: 0 }; } },
    { tip: 'secim', metin: 'Test profili', secenekler: Object.entries(PROF), get: () => profil, set: (vv) => { profil = vv; profT = 0; elle(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Dyno başlat', tur: 'basla', tik: () => { if (!kill) { test = true; profT = 0; } elle(); } },
      { metin: 'Durdur', tur: 'dur', tik: () => { test = false; elle(); } },
      { metin: 'Pil şarj (tam)', tik: () => { if (!test) soc = 1; elle(); } },
    ] },
    { tip: 'kaydirici', metin: 'Hız hedefi (sabit profil)', min: 0, max: 45, adim: 1, birim: 'km/h', get: () => hedefHiz, set: (vv) => (hedefHiz = vv) },
    { tip: 'anahtar', metin: 'Soğutma fanı', get: () => fanAcik, set: (vv) => (fanAcik = vv) },
    { tip: 'anahtar', metin: 'Otomatik demo (kabuk → parkur → rejen)', get: () => demo, set: (vv) => { demo = vv; demoT = 0; demoGuncelle.sure = 0; } },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'KILL SWITCH', tur: 'acil', tik: () => { kill = true; test = false; elle(); } },
      { metin: 'Reset', tik: () => { if (v < 0.5) kill = false; } },
    ] },
  ];

  return {
    id: 'earac',
    ad: 'Üniversite Elektrikli Araç Projesi',
    altBaslik: 'Temsili · verimlilik aracı · dyno',
    kisa: 'Üniversitede elektrikli araç proje ekibinde yer aldım; bu istasyon o projenin temsili modeli: tek kişilik aerodinamik verimlilik aracı şasi dinamometresinde. Kabuğu açıp pil paketi, BMS, motor sürücü ve göbek motorunu görebilir; sabit hız, yarış parkuru ve rejeneratif fren testlerinde hız, güç, verim (Wh/km) ve pil sıcaklığını izleyebilirsin.',
    proje: 'personal-projects',
    ayakIzi: [8.4, 5.6],
    ayakIziMerkez: [-0.25, -0.15],
    kamera: { poz: [2.3, 2.2, 4.6], hedef: [0.0, 0.55, -0.4] },
    mekanizmalar: [
      'Üst kabuk kuyruktaki menteşeden kalkar (operatör burundan kaldırır); altta şasi, koltuk, direksiyon, pil, BMS, sürücü, HV kablolar',
      'Dyno: arka tekerler iki makara üstünde döner, makaralar tekerin tersine; önde soğutma fanı',
      'Profiller: sabit hız (kaydırıcı), 40 s yarış parkuru döngüsü, rejeneratif fren (yavaşlarken güç negatife döner)',
      'Kokpit ekranı hız/güç/pil gösterir; dyno monitörü ve kule lambası durumla senkron',
      'KILL SWITCH: HV kesilir, araç makaralarda serbest yavaşlar',
    ],
    cikarim: [
      'TEMSİLİ: aracın fotoğrafı ya da ölçüleri yok. CV\'deki "üniversite elektrikli araç proje ekibi üyeliği" bilgisinden yola çıkıldı.',
      'Üniversite takımlarının yarıştığı verimlilik yarışı tipi tek kişilik araç seçildi: ≈3 m damla gövde, kabarcık kanopi, 20" tekerler, arka tekerde göbek motoru.',
      'Değerler tipik bir verimlilik aracına göre: 150 kg (sürücü dahil), Crr 0.0055, CdA 0.13 m² → 30 km/h\'de ≈ 120 W, ≈ 4 Wh/km; pil 16S LiFePO4 51.2 V 20 Ah.',
      'Pil tüketimi gösterim için ×10 hızlandırıldı.',
    ],
    group: g,
    sabitHaric: [kabuk, ...tekerler.map((t) => t.w), ...makaralar, fan, op.group],
    update,
    kontroller,
    degerler: () => [
      ['Profil', test ? PROF[profil] : 'beklemede'],
      ['Hız', `${fmt(v, 1)} km/h`],
      ['Motor gücü', `${fmt(pEl, 0)} W`],
      ['Tork / devir', `${fmt(tork, 1)} Nm · ${fmt(rpm, 0)} rpm`],
      ['Verim', v > 3 ? `${fmt(verim(), 2)} Wh/km` : '—'],
      ['Pil', `${fmt(volt, 1)} V · ${fmt(akim, 1)} A · %${fmt(soc * 100, 0)}`],
      ['Pil sıcaklığı', `${fmt(sicaklik, 1)} °C`],
      ['Test sayacı', `${fmt(mesafe, 2)} km · ${fmt(enerji, 1)} Wh`],
      ['Kabuk', kabukAcik ? 'açık' : 'kapalı'],
    ],
    trend,
    durum: durumBilgi,
  };
}
