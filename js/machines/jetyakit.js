// js/machines/jetyakit.js — Jet Yakıt Test Ünitesi (paslanmaz skid, ATEX).
//
// WinCC Unified ekranlarından (Ana ekran, Debi/Basınç Kontrol, Sıcaklıklar,
// Ayarlar) çıkan proses: Tank → pompa → basınç ayar (hat basıncı, fazlası
// bypass ile tanka) → filtre → oransal valf (basınç PID) → manifold → iki kol:
// hassas debi (Coriolis U-boru + oransal iğne valf, debi PID) ve normal debi
// (türbin sayaç + el vanası) → çıkış sıcaklığı → tanka dönüş.
// Basınç ve debi döngüleri lib.PID ile; Kp/Ki panelden ayarlanır.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, sphere, pipe, akisBorusu, mat, lamba, canvasTex, Ekran, Trend, PID,
    kuleLambasi, acilStop, pano, levha, clamp, damp, approach, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const DECK = 0.15;
  const SKID_X = 1.8, SKID_Z = 0.8;

  // ---------------------------------------------------------------- skid
  const skidMat = mat(0x6d747b, { r: 0.5, m: 0.6, key: 'jy-skid' });
  for (const sz of [-1, 1]) box(SKID_X * 2, 0.12, 0.1, skidMat, 0, 0.06, sz * (SKID_Z - 0.05), g);
  for (const x of [-SKID_X + 0.05, -0.6, 0.6, SKID_X - 0.05]) box(0.1, 0.12, SKID_Z * 2 - 0.2, skidMat, x, 0.06, 0, g);
  box(SKID_X * 2 - 0.1, 0.025, SKID_Z * 2 - 0.1, M.paslanmaz, 0, 0.135, 0, g);      // damlama teknesi
  for (const sz of [-1, 1]) box(SKID_X * 2 - 0.1, 0.05, 0.02, M.paslanmaz, 0, 0.17, sz * (SKID_Z - 0.06), g);
  for (const sx of [-1, 1]) box(0.02, 0.05, SKID_Z * 2 - 0.1, M.paslanmaz, sx * (SKID_X - 0.06), 0.17, 0, g);

  // ---------------------------------------------------------------- manometre (gerçek ibreli)
  const kadran = canvasTex(256, 256, (x, w) => {
    const c = w / 2;
    x.fillStyle = '#f7f7f2'; x.beginPath(); x.arc(c, c, c - 4, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 3;
    for (let i = 0; i <= 20; i++) {
      const a = (-0.75 + (1.5 * i) / 20) * Math.PI - Math.PI / 2;
      const r0 = i % 5 ? c - 26 : c - 40;
      x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      x.lineTo(c + Math.cos(a) * (c - 14), c + Math.sin(a) * (c - 14)); x.stroke();
    }
    x.strokeStyle = '#c62828'; x.lineWidth = 10;
    x.beginPath(); x.arc(c, c, c - 20, 0.55 * Math.PI - Math.PI / 2 + 0.2 * Math.PI, 0.75 * Math.PI - Math.PI / 2 + 0.25 * Math.PI); x.stroke();
    x.fillStyle = '#333'; x.font = '700 30px "Space Grotesk", sans-serif'; x.textAlign = 'center';
    x.fillText('bar', c, c + 62);
  });
  const kadranMat = new THREE.MeshStandardMaterial({ map: kadran, roughness: 0.4 });
  const ibreMat = mat(0xd32f2f, { r: 0.4, key: 'jy-ibre' });
  const ibreler = [];               // dönen ibre pivotları (sabitle() dışında kalır)
  function manometre(x, y, z, max) {
    const m = new THREE.Group();
    m.position.set(x, y, z);
    cyl(0.058, 0.035, M.krom, 0, 0, 0, m, { eksen: 'z', seg: 24 });
    const yuz = new THREE.Mesh(new THREE.CircleGeometry(0.05, 28), kadranMat);
    yuz.position.z = 0.0181; m.add(yuz);
    const pivot = new THREE.Group(); pivot.position.z = 0.02; m.add(pivot); ibreler.push(pivot);
    box(0.005, 0.042, 0.003, ibreMat, 0, 0.017, 0, pivot);
    g.add(m);
    let goster = 0;
    return {
      set(v, dt) {
        goster = damp(goster, clamp(v / max, 0, 1.02), 8, dt);
        pivot.rotation.z = (0.75 - 1.5 * goster) * Math.PI;
      },
    };
  }
  // sıcaklık transmiteri kafası
  const tKafa = (x, y, z) => { cyl(0.03, 0.05, M.gri, x, y, z, g, { seg: 14 }); cyl(0.008, 0.08, M.celik, x, y - 0.06, z, g, { seg: 8 }); };

  // ---------------------------------------------------------------- tank
  const TX = -1.25, TZ = -0.2, TR = 0.32;
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(0.04, 0.32, 0.04, M.paslanmaz, TX + dx * 0.2, DECK + 0.16, TZ + dz * 0.2, g);
  cyl(TR, 0.95, M.paslanmaz, TX, 0.925, TZ, g, { seg: 32 });
  cyl(0.1, 0.12, M.paslanmaz, TX, 1.46, TZ, g, { r2: TR, seg: 32 });
  cyl(TR, 0.1, M.paslanmaz, TX, 0.4, TZ, g, { r2: 0.1, seg: 32 });
  // seviye camı (dışarıdan görünen yakıt sütunu)
  const camZ = TZ + TR + 0.05;
  cyl(0.024, 0.85, M.cam, TX, 0.925, camZ, g, { seg: 14 });
  for (const y of [0.5, 1.35]) box(0.03, 0.03, 0.06, M.paslanmaz, TX, y, camZ - 0.03, g);
  const yakitMat = new THREE.MeshStandardMaterial({ color: 0xd9a21b, emissive: 0x6b4500, emissiveIntensity: 0.4, roughness: 0.2 });
  const sutun = cyl(0.016, 1, yakitMat, TX, 0.5, camZ, g, { seg: 12 });
  // seviye transmiteri + tank sıcaklığı + tank basıncı
  cyl(0.035, 0.12, M.gri, TX + 0.15, 1.52, TZ + 0.08, g, { seg: 14 });
  box(0.08, 0.06, 0.08, M.gri, TX + 0.15, 1.6, TZ + 0.08, g);
  tKafa(TX + TR + 0.04, 0.78, TZ);
  rod([TX - 0.12, 1.45, TZ + 0.1], [TX - 0.12, 1.62, TZ + 0.1], 0.01, M.celik, g);
  const mTank = manometre(TX - 0.12, 1.68, TZ + 0.1, 2);

  // ---------------------------------------------------------------- pompa + motor
  const PZ = 0.3, PY = 0.33;
  box(0.82, 0.04, 0.3, skidMat, -0.6, DECK + 0.02, PZ, g);
  const motorMat = mat(0x3d5a73, { r: 0.45, m: 0.4, key: 'jy-motor' });
  cyl(0.12, 0.36, motorMat, -0.75, PY, PZ, g, { eksen: 'x', seg: 24 });
  cyl(0.115, 0.06, M.koyu, -0.96, PY, PZ, g, { eksen: 'x', seg: 24 });
  box(0.12, 0.08, 0.13, motorMat, -0.75, PY + 0.15, PZ, g);                 // klemens kutusu (Ex d)
  box(0.3, 0.03, 0.26, motorMat, -0.75, PY - 0.12, PZ, g);
  // kaplin (dönen) + açık üstlü koruyucu
  const kaplin = new THREE.Group();
  kaplin.position.set(-0.505, PY, PZ); g.add(kaplin);
  cyl(0.045, 0.03, M.celik, -0.025, 0, 0, kaplin, { eksen: 'x', seg: 16 });
  cyl(0.045, 0.03, M.celik, 0.025, 0, 0, kaplin, { eksen: 'x', seg: 16 });
  box(0.07, 0.016, 0.03, M.sari, 0, 0.04, 0, kaplin);
  for (const sz of [-1, 1]) box(0.12, 0.13, 0.008, M.sari, -0.505, PY - 0.01, PZ + sz * 0.065, g);
  cyl(0.1, 0.16, M.paslanmaz, -0.36, PY, PZ, g, { eksen: 'x', seg: 24 });     // pompa gövdesi
  cyl(0.06, 0.06, M.paslanmaz, -0.36, PY + 0.11, PZ, g, { seg: 16 });

  // ---------------------------------------------------------------- hat elemanları
  const HY = 0.72;
  // basınç ayar valfi (el ayarlı, filtreden ÖNCE)
  box(0.14, 0.14, 0.14, M.paslanmaz, 0, HY, PZ, g);
  cyl(0.018, 0.14, M.celik, 0, HY + 0.14, PZ, g, { seg: 10 });
  box(0.14, 0.02, 0.02, M.kirmizi, 0, HY + 0.22, PZ, g);
  // filtre
  cyl(0.085, 0.42, M.paslanmaz, 0.3, 0.48, PZ, g, { seg: 24 });
  cyl(0.1, 0.08, M.paslanmaz, 0.3, HY + 0.01, PZ, g, { seg: 24 });
  // oransal basınç valfi (sarı bobin)
  box(0.14, 0.14, 0.14, M.paslanmaz, 0.65, HY, PZ, g);
  cyl(0.045, 0.13, M.sari, 0.65, HY + 0.135, PZ, g, { seg: 18 });
  box(0.05, 0.04, 0.05, M.siyah, 0.65, HY + 0.22, PZ, g);
  // manifold bloğu
  box(0.11, 0.11, 0.66, M.paslanmaz, 0.95, HY, 0.06, g);
  // hassas kol: oransal iğne valf
  box(0.07, 0.07, 0.07, M.paslanmaz, 1.1, HY, PZ, g);
  cyl(0.03, 0.08, M.sari, 1.1, HY + 0.075, PZ, g, { seg: 14 });
  // normal kol: el vanası (kolu açıklığı gösterir)
  box(0.08, 0.08, 0.08, M.paslanmaz, 1.08, HY, -0.15, g);
  const vanaKol = new THREE.Group(); vanaKol.position.set(1.08, HY + 0.06, -0.15); g.add(vanaKol);
  box(0.16, 0.012, 0.025, M.kirmizi, 0.07, 0, 0, vanaKol);
  // türbin debimetre
  cyl(0.042, 0.22, M.paslanmaz, 1.3, HY, -0.15, g, { eksen: 'x', seg: 18 });
  for (const dx of [-0.11, 0.11]) cyl(0.06, 0.02, M.paslanmaz, 1.3 + dx, HY, -0.15, g, { eksen: 'x', seg: 18 });
  cyl(0.012, 0.06, M.celik, 1.3, HY + 0.07, -0.15, g, { seg: 8 });
  cyl(0.05, 0.04, M.gri, 1.3, HY + 0.12, -0.15, g, { eksen: 'z', seg: 18 });
  const turbinEkran = new Ekran(0.06, 0.04, 96);
  turbinEkran.mesh.position.set(1.3, HY + 0.12, -0.129); g.add(turbinEkran.mesh);
  // Coriolis: çift U-boru (biri akış borusu) + gövde + transmiter
  const CX = 1.32, CR = 0.1, CY0 = 0.52;
  const uYol = (z) => {
    const p = [[1.22, HY, z], [1.22, CY0, z]];
    for (let i = 1; i < 8; i++) { const a = Math.PI + (Math.PI * i) / 8; p.push([CX + CR * Math.cos(a), CY0 + CR * Math.sin(a), z]); }
    p.push([1.42, CY0, z], [1.42, HY, z]);
    return p;
  };
  pipe(uYol(PZ + 0.035), 0.014, M.paslanmaz, g);
  box(0.28, 0.06, 0.12, M.paslanmaz, CX, HY + 0.02, PZ, g);
  cyl(0.065, 0.05, M.gri, CX, HY + 0.12, PZ, g, { eksen: 'z', seg: 22 });
  const corEkran = new Ekran(0.08, 0.05, 128);
  corEkran.mesh.position.set(CX, HY + 0.12, PZ + 0.026); g.add(corEkran.mesh);

  // boru rafı (arka) + dönüş hattı askıları
  for (const x of [-0.2, 0.6, 1.62]) box(0.05, 1.05 - DECK, 0.05, skidMat, x, (1.05 + DECK) / 2, -0.66, g);

  // ---------------------------------------------------------------- akış boruları
  const R1 = 0.022, R2 = 0.016;
  const emme = akisBorusu([[TX, 0.36, TZ], [TX, 0.26, TZ], [-0.18, 0.26, TZ], [-0.18, 0.26, PZ], [-0.18, PY, PZ], [-0.27, PY, PZ]], R1, g);
  const basma = akisBorusu([[-0.36, PY + 0.14, PZ], [-0.36, HY, PZ], [-0.07, HY, PZ]], R1, g);
  const hatB = akisBorusu([[0.07, HY, PZ], [0.215, HY, PZ]], R1, g);
  const hatC = akisBorusu([[0.385, HY, PZ], [0.58, HY, PZ]], R1, g);
  const hatD = akisBorusu([[0.72, HY, PZ], [0.9, HY, PZ]], R1, g);
  const bypass = akisBorusu([[0, HY - 0.07, PZ - 0.05], [0, 0.5, PZ - 0.05], [0, 0.5, -0.35], [-0.95, 0.5, -0.35]], R2, g);
  const kolH = akisBorusu([[1.0, HY, PZ], [1.22, HY, PZ], ...uYol(PZ - 0.005).slice(1), [1.62, HY, PZ], [1.62, 1.05, PZ], [1.62, 1.05, -0.15]], R2, g, { renk: '#ffd34d' });
  const kolN = akisBorusu([[1.0, HY, -0.15], [1.62, HY, -0.15], [1.62, 1.05, -0.15]], R2, g);
  const donus = akisBorusu([[1.62, 1.05, -0.15], [1.62, 1.05, -0.62], [-0.75, 1.05, -0.62], [-0.75, 1.6, -0.62], [TX, 1.6, -0.62], [TX, 1.6, TZ], [TX, 1.52, TZ]], R1, g);

  // manometreler (stub üstünde, öne bakar)
  rod([-0.45, 0.26, TZ], [-0.45, 0.58, TZ], 0.01, M.celik, g);
  const mEmme = manometre(-0.45, 0.62, TZ, 2);
  rod([0.13, HY, PZ], [0.13, 0.95, PZ], 0.01, M.celik, g);
  const mAyar = manometre(0.13, 0.99, PZ, 160);
  rod([0.48, HY, PZ], [0.48, 0.95, PZ], 0.01, M.celik, g);
  const mFiltre = manometre(0.48, 0.99, PZ, 160);
  rod([0.95, HY + 0.05, 0.36], [0.95, 0.95, 0.36], 0.01, M.celik, g);
  const mManifold = manometre(0.95, 0.99, 0.36, 40);
  tKafa(-0.36, 0.62, PZ + 0.04);                 // filtre öncesi sıcaklık
  tKafa(0.5, 1.12, -0.62);                        // çıkış sıcaklığı

  // ---------------------------------------------------------------- ATEX pano + HMI + güvenlik
  const PX = 2.45;
  pano(g, PX, 0, 0, 0.75, 1.75, 0.35, 0);
  const hmi = new Ekran(0.58, 0.37, 720);
  hmi.mesh.position.set(PX, 1.22, 0.188); g.add(hmi.mesh);
  const ex = levha(['Ex'], 0.1, 0.08, { bg: '#f2c200', fg: '#111', font: 80, kenar: '#111', px: 128 });
  ex.position.set(PX - 0.27, 1.6, 0.19); g.add(ex);
  const kule = kuleLambasi(g, PX + 0.24, 1.75, 0);
  const flasorMat = lamba(0xff2a1a, 0);
  cyl(0.05, 0.03, M.koyu, PX - 0.2, 1.765, 0, g, { seg: 16 });
  cyl(0.045, 0.09, flasorMat, PX - 0.2, 1.825, 0, g, { seg: 18 });
  acilStop(g, PX + 0.22, 0.95, 0.2);
  const isim = levha(['JET YAKIT TEST ÜNİTESİ', 'ATEX · Zone 1'], 0.9, 0.22, { bg: '#1d2a36', font: 62, px: 900 });
  isim.position.set(0.55, 1.32, -0.63); g.add(isim);
  // alev dedektörü (ön sol köşede direk üstünde, skide bakar)
  box(0.06, 2.3, 0.06, M.gri, -SKID_X - 0.15, 1.15, 0.75, g);
  const dedektor = new THREE.Group();
  dedektor.position.set(-SKID_X - 0.08, 2.25, 0.72); dedektor.rotation.set(-0.5, 0.75, 0); g.add(dedektor);
  box(0.12, 0.12, 0.16, M.kirmizi, 0, 0, 0, dedektor);
  const lensMat = lamba(0x66ccff, 0.2);
  cyl(0.035, 0.02, lensMat, 0, 0, 0.085, dedektor, { eksen: 'z', seg: 16 });
  // yangın söndürücü
  cyl(0.08, 0.5, M.kirmizi, -SKID_X - 0.35, 0.25, 0.35, g, { seg: 18 });
  cyl(0.02, 0.08, M.siyah, -SKID_X - 0.35, 0.54, 0.35, g, { seg: 8 });

  // ---------------------------------------------------------------- proses modeli
  let pompa = false, pPID = false, qPID = false, acil = false, yangin = false;
  let n = 0;                      // pompa hızı 0..1
  let pAyar = 0, pFiltre = 0, pMan = 0, pEmme = 0, pTank = 0;
  let qH = 0, qN = 0, uP = 0, uQ = 0;
  let spP = 17, spQ = 0.02, vanaN = 0.35;
  let tTank = 34, tCikis = 32, tFiltre = 35, seviye = 38;
  let bozT = 0, otoT = -1;
  const pidP = new PID(0.02, 0.06, 0, 0, 1);
  const pidQ = new PID(8, 25, 0, 0, 1);
  const AYAR_BAR = 96;            // basınç ayar valfinin tuttuğu hat basıncı

  const otomatik = () => { if (acil || yangin) return; otoT = 0; pompa = true; };
  otomatik();                     // açılışta salon canlı: pompa → basınç PID → debi PID

  const trendP = new Trend([{ ad: 'Manifold', renk: '#39c5cf' }, { ad: 'SP', renk: '#f2c200', kesik: true, kalin: 1.2 }], { min: 0, max: 30, uzunluk: 300 });
  const trendQ = new Trend([{ ad: 'Hassas debi mL/dk', renk: '#7ee787' }, { ad: 'SP', renk: '#f2c200', kesik: true, kalin: 1.2 }], { min: 0, max: 60, uzunluk: 300 });
  let trendSecim = 'p';
  const hmiZ = throttle(5);

  function trip() { pompa = false; pPID = false; qPID = false; otoT = -1; pidP.sifirla(); pidQ.sifirla(); }

  // ---------------------------------------------------------------- test operatörü
  // ATEX pano HMI'sının başında (yüzü panoya: π); pompa çalışırken ~30 sn'de bir skid
  // önündeki manometreleri kontrol edip döner; yangın alarmında skidden uzaklaşır,
  // ACİL'de panodaki acil stopa sağ eliyle uzanır.
  const op = lib.operator({ yelek: 0xff7a1a });
  g.add(op.group);
  const OPX = PX, OPZ = 0.8;
  const opS = { x: OPX, z: OPZ, yon: Math.PI, hx: OPX, hz: OPZ, hyon: Math.PI, poz: 'on' };
  const opHedef = (x, z, yon, poz) => { opS.hx = x; opS.hz = z; opS.hyon = yon; opS.poz = poz; };
  let kontrolT = 0, kontrolKalan = 0;
  function opGuncelle(dt, t) {
    const dx = opS.hx - opS.x, dz = opS.hz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.2 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(yuruyor ? 'yan' : opS.poz);
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }
  function opKarar(dt) {
    if (yangin) { kontrolKalan = 0; opHedef(PX + 0.45, 1.5, Math.atan2(-(PX + 0.45), -1.5), 'yan'); return; }
    if (acil) { kontrolKalan = 0; opHedef(PX + 0.52, 0.63, Math.PI, 'sag'); return; }
    kontrolT += dt;
    if (kontrolKalan <= 0 && kontrolT > 28 && pompa) { kontrolKalan = 6; kontrolT = 0; }
    if (kontrolKalan > 0) {
      opHedef(0.55, 1.15, Math.PI, 'on');                       // manometre sırasının önü
      if (Math.hypot(opS.x - 0.55, opS.z - 1.15) < 0.05) kontrolKalan -= dt;
    } else opHedef(OPX, OPZ, Math.PI, 'on');
  }

  function update(dt, t) {
    // otomatik başlatma sırası
    if (otoT >= 0) {
      otoT += dt;
      if (otoT > 2 && !pPID) { pPID = true; pidP.sifirla(); }
      if (otoT > 4.5 && !qPID) { qPID = true; pidQ.sifirla(); otoT = -1; }
    }
    n = approach(n, pompa ? 1 : 0, dt / 1.5);
    const boz = bozT > 0 ? 1 : 0;
    bozT = Math.max(0, bozT - dt);

    pAyar = damp(pAyar, AYAR_BAR * n * n * (1 - 0.3 * boz), 3, dt);
    pFiltre = Math.max(0, pAyar - (0.5 + 0.4 * n));
    uP = pPID && n > 0.5 ? pidP.update(spP, pMan, dt) : damp(uP, 0, 2, dt);
    pMan = damp(pMan, Math.max(0, uP * pFiltre - 4 * qN - 6 * boz), 2, dt);
    uQ = qPID && n > 0.5 ? pidQ.update(spQ, qH, dt) : damp(uQ, 0, 2, dt);
    qH = damp(qH, 0.06 * uQ * Math.sqrt(pMan / 17), 2.5, dt);
    qN = damp(qN, 1.6 * vanaN * Math.sqrt(pMan / 17), 3, dt);
    pEmme = 0.05 + 0.18 * n;
    pTank = 0.02 * n;
    seviye = damp(seviye, 38 - 1.2 * n, 0.5, dt);
    tTank = damp(tTank, 34 + 9 * n, 0.02, dt);
    tFiltre = tTank + 3.5 * n;
    tCikis = tTank - 5 * n;

    // görseller
    const asagi = qH + qN;
    emme.akis(n * 0.6, dt);
    basma.akis(n * 0.6, dt);
    bypass.akis(Math.max(0, n * 0.6 - asagi * 0.25), dt);
    for (const h of [hatB, hatC, hatD]) h.akis(asagi > 0.01 ? 0.1 + asagi * 0.3 : 0, dt);
    kolH.akis(qH > 0.001 ? 0.1 + (qH / 0.05) * 0.5 : 0, dt);
    kolN.akis(qN > 0.01 ? (qN / 2) * 0.8 : 0, dt);
    donus.akis(asagi > 0.01 ? 0.1 + asagi * 0.3 : 0, dt);
    kaplin.rotation.x += n * 30 * dt;
    vanaKol.rotation.y = -vanaN * Math.PI / 2;
    const f = seviye / 50;
    sutun.scale.y = 0.85 * f; sutun.position.y = 0.5 + (0.85 * f) / 2;
    mEmme.set(pEmme, dt); mAyar.set(pAyar, dt); mFiltre.set(pFiltre, dt); mManifold.set(pMan, dt); mTank.set(pTank, dt);
    flasorMat.emissiveIntensity = yangin ? (Math.sin(t * 14) > 0 ? 3 : 0.1) : 0;
    lensMat.emissive.setHex(yangin ? 0xff3b1a : 0x66ccff);
    lensMat.emissiveIntensity = yangin ? 2.5 : 0.25 + 0.15 * Math.sin(t * 2);
    opKarar(dt);
    opGuncelle(dt, t);

    const d = durumBilgi();
    kule.set(d.seviye, t);
    const pOlc = pMan + gurultu(0.04), qOlc = Math.max(0, qH + gurultu(0.00015));
    trendP.ornekle(dt, [pOlc, spP]);
    trendQ.ornekle(dt, [qOlc * 1000, spQ * 1000]);
    if (hmiZ(dt)) {
      hmiCiz(d, pOlc, qOlc);
      corEkran.ciz((x, W, H) => { x.fillStyle = '#0d2a1f'; x.fillRect(0, 0, W, H); x.fillStyle = '#7CFC9A'; x.font = '700 30px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(qOlc.toFixed(4), W / 2, H / 2); });
      turbinEkran.ciz((x, W, H) => { x.fillStyle = '#0d2a1f'; x.fillRect(0, 0, W, H); x.fillStyle = '#7CFC9A'; x.font = '700 26px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(qN.toFixed(2), W / 2, H / 2); });
    }
  }

  // WinCC Unified "Debi Kontrol" ekranının sadeleştirilmiş kopyası
  function hmiCiz(d, pOlc, qOlc) {
    hmi.ciz((x, W, H) => {
      x.fillStyle = '#fbfcfd'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1b1f24'; x.font = '700 30px "Space Grotesk", sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText(trendSecim === 'p' ? 'Basınç Kontrol' : 'Debi Kontrol', W - 20, 30);
      const dug = (tx, y, metin, aktifMi) => {
        x.fillStyle = aktifMi ? '#21c55d' : '#e53935'; x.fillRect(tx, y, 150, 30);
        x.fillStyle = '#fff'; x.font = '600 16px "Space Grotesk", sans-serif'; x.textAlign = 'center'; x.fillText(metin, tx + 75, y + 15);
      };
      dug(16, 14, pompa ? 'Pompa Çalışıyor' : 'Pompa Stop', pompa);
      dug(176, 14, pPID ? 'Basınç PID Start' : 'Basınç PID Stop', pPID);
      dug(336, 14, qPID ? 'Debi PID Start' : 'Debi PID Stop', qPID);
      const gs = [
        ['Hassas Debi', qOlc, 0.05, 'L/dk', 4], ['Normal Debi', qN, 2, 'L/dk', 2], ['Tank Sıcaklık', tTank, 80, '°C', 1], ['Çıkış Sıcaklık', tCikis, 80, '°C', 1],
        ['Manifold Basınç', pOlc, 30, 'bar', 1], ['Basınç Ayar Sonrası', pAyar, 160, 'bar', 1], ['Filtre Sonrası', pFiltre, 160, 'bar', 1], ['Tank Seviyesi', seviye, 50, 'L', 1],
      ];
      gs.forEach(([ad, v, max, birim, nd], i) => {
        const cx = 95 + (i % 4) * 177, cy = 150 + Math.floor(i / 4) * 150, r = 50;
        x.lineCap = 'butt';
        x.lineWidth = 16; x.strokeStyle = '#c8d1d9';
        x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2); x.stroke();
        x.strokeStyle = '#178a99';
        x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 0.8 + clamp(v / max, 0, 1) * Math.PI * 1.4); x.stroke();
        x.fillStyle = '#178a99'; x.font = '700 17px "JetBrains Mono", monospace'; x.textAlign = 'center';
        x.fillText(`${v.toFixed(nd)} ${birim}`, cx, cy + 4);
        x.fillStyle = '#4a5560'; x.font = '500 15px "Space Grotesk", sans-serif';
        x.fillText(ad, cx, cy + 52);
      });
      const alt = 40;
      x.fillStyle = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' }[d.seviye];
      x.fillRect(0, H - alt, W, alt);
      x.fillStyle = '#fff'; x.font = '700 20px "Space Grotesk", sans-serif'; x.fillText(d.metin, W / 2, H - alt / 2);
    });
  }

  function durumBilgi() {
    if (acil) return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (yangin) return { metin: 'YANGIN ALARMI · pompa tripte', seviye: 'alarm' };
    if (bozT > 0) return { metin: 'BOZUCU ETKİ · PID toparlıyor', seviye: 'uyari' };
    if (!pompa && n < 0.01) return { metin: 'POMPA DURUK', seviye: 'bekliyor' };
    if (pPID || qPID) return { metin: `PID KONTROL · ${pPID ? 'basınç' : ''}${pPID && qPID ? ' + ' : ''}${qPID ? 'debi' : ''}`, seviye: 'calisiyor' };
    return { metin: 'POMPA ÇALIŞIYOR · PID kapalı', seviye: 'calisiyor' };
  }

  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Otomatik', tur: 'basla', tik: otomatik },
      { metin: 'Pompa Start', tik: () => { if (!acil && !yangin) pompa = true; } },
      { metin: 'Pompa Stop', tur: 'dur', tik: trip },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Basınç PID Start', tik: () => { if (pompa) { pPID = true; pidP.sifirla(); } } },
      { metin: 'Basınç PID Stop', tur: 'dur', tik: () => (pPID = false) },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Debi PID Start', tik: () => { if (pompa) { qPID = true; pidQ.sifirla(); } } },
      { metin: 'Debi PID Stop', tur: 'dur', tik: () => (qPID = false) },
    ] },
    { tip: 'baslik', metin: 'Setpoint' },
    { tip: 'kaydirici', metin: 'Basınç ayar (manifold)', min: 0, max: 25, adim: 0.5, birim: 'bar', get: () => spP, set: (v) => (spP = v) },
    { tip: 'kaydirici', metin: 'Debi hedef (hassas)', min: 0, max: 0.05, adim: 0.001, birim: 'L/dk', get: () => spQ, set: (v) => (spQ = v) },
    { tip: 'kaydirici', metin: 'Normal debi vanası', min: 0, max: 100, adim: 5, birim: '%', get: () => Math.round(vanaN * 100), set: (v) => (vanaN = v / 100) },
    { tip: 'baslik', metin: 'PID ayarları (HMI → Ayarlar)' },
    { tip: 'kaydirici', metin: 'Basınç Kp', min: 0.002, max: 0.06, adim: 0.002, get: () => pidP.kp, set: (v) => (pidP.kp = v) },
    { tip: 'kaydirici', metin: 'Basınç Ki', min: 0, max: 0.3, adim: 0.01, get: () => pidP.ki, set: (v) => (pidP.ki = v) },
    { tip: 'kaydirici', metin: 'Debi Kp', min: 1, max: 30, adim: 1, get: () => pidQ.kp, set: (v) => (pidQ.kp = v) },
    { tip: 'kaydirici', metin: 'Debi Ki', min: 0, max: 80, adim: 1, get: () => pidQ.ki, set: (v) => (pidQ.ki = v) },
    { tip: 'secim', metin: 'Trend', secenekler: [['p', 'Manifold basıncı'], ['q', 'Hassas debi']], get: () => trendSecim,
      set: (v) => { trendSecim = v; nesne.trend = v === 'p' ? trendP : trendQ; } },
    { tip: 'baslik', metin: 'Test / güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Bozucu etki', tik: () => { if (pompa) bozT = 4; } },
      { metin: 'Yangın testi', tik: () => { yangin = true; trip(); } },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { acil = true; trip(); } },
      { metin: 'Reset', tik: () => { acil = false; yangin = false; } },
    ] },
  ];

  const nesne = {
    id: 'jetyakit',
    ad: 'Jet Yakıt Test Ünitesi',
    altBaslik: 'S7 + WinCC Unified · PID · ATEX',
    kisa: 'Jet yakıtı test skidi: Profinet üzerinden S7 PLC, WinCC Unified HMI. Oransal valflerle basınç (0.01 bar) ve hassas debi (0.0001 L/dk) PID kontrolü; patlama korumalı bileşenler ve yangın algılama.',
    proje: 'testing',
    ayakIzi: [6.4, 3.4],
    kamera: { poz: [1.5, 2.5, 5.0], hedef: [0.6, 0.85, -0.05] },
    mekanizmalar: [
      'Pompa motoru ve kaplin: çalışırken döner, hız rampayla yükselir',
      'Akış: boru içindeki parlak şeritler akış yönünde, debiyle orantılı hızda kayar',
      'Basınç ayar fazlası bypass hattından tanka döner',
      'Manometre ibreleri (5 adet) canlı basıncı gösterir',
      'Normal debi el vanasının kolu açıklık kadar döner; tank seviye camındaki yakıt sütunu oynar',
      'Yangın testinde flaşör çakar, alev dedektörü kırmızıya döner, pompa tripler',
      'Test operatörü: ATEX pano HMI\'sının başında; pompa çalışırken arada manometreleri kontrol eder, yangın alarmında skidden uzaklaşır, ACİL\'de acil stopa uzanır',
    ],
    cikarim: [
      'Proses sırası WinCC ekranlarındaki gösterge adlarından çıkarıldı: Pompa Öncesi, Basınç Ayar Sonrası, Filtre Sonrası, Manifold, Hassas/Normal Debi, Tank/Çıkış sıcaklığı.',
      'Basınç Ayar Sonrası (94.1 bar) > Filtre Sonrası (93.6 bar) → basınç ayar valfi filtreden ÖNCE kabul edildi; manifold ise SP 17 bar ile ayrı PID\'li oransal valften sonra.',
      'Hassas debi 0.009 L/dk mertebesi → Coriolis tipi U-boru sayaç TAHMİN; normal debi (0.6 L/dk) için türbin sayaç TAHMİN.',
      'Ayarlar sayfasındaki Gain/Ti/Td alanları → panelde Kp/Ki kaydırıcıları.',
      'Skid yerleşimi, tank hacmi (~50 L) ve boru güzergâhı tamamen TAHMİN (fiziksel fotoğraf yok).',
    ],
    group: g,
    // sabitle(): dönen kaplin, vana kolu, seviye sütunu (ölçek) ve manometre ibreleri hareketli
    sabitHaric: [kaplin, vanaKol, sutun, ...ibreler],
    update,
    kontroller,
    degerler: () => [
      ['Pompa', pompa ? `çalışıyor (%${fmt(n * 100, 0)})` : 'durdu'],
      ['Tank seviyesi', `${fmt(seviye, 1)} L`],
      ['Pompa öncesi', `${fmt(pEmme, 2)} bar`],
      ['Basınç ayar sonrası', `${fmt(pAyar, 1)} bar`],
      ['Filtre sonrası', `${fmt(pFiltre, 1)} bar`],
      ['Manifold (SP)', `${fmt(pMan, 2)} bar (${fmt(spP, 1)})`],
      ['Oransal valf', `%${fmt(uP * 100, 1)}`],
      ['Hassas debi (SP)', `${fmt(qH, 4)} L/dk (${fmt(spQ, 3)})`],
      ['Normal debi', `${fmt(qN, 2)} L/dk`],
      ['Tank / çıkış sıcaklığı', `${fmt(tTank, 1)} / ${fmt(tCikis, 1)} °C`],
    ],
    trend: trendP,
    durum: durumBilgi,
  };
  return nesne;
}
