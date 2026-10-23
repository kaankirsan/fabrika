// js/machines/solarbot.js — SolarBot: otonom güneş paneli temizleme robotu.
//
// Fotoğraf/videodan: alçak profilli (~0.75 × 0.65 m) alüminyum şasi, iki yanda
// palet, arkada kısa direkte OAK-D derinlik kamerası, üstte kontrol kutusu ve
// köşelerde sarı tamponlar; bir versiyonda önde fırça/sıyırıcı var.
// Burada 25° eğimli bir panel masasının üstünde zikzak (boustrophedon) şeritlerle
// ilerler; fırçanın geçtiği yerde panel üstündeki toz katmanı silinir.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, rod, mat, lamba, canvasTex, Ekran, Trend, kuleLambasi, acilStop,
    clamp, approach, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const EGIM = (25 * Math.PI) / 180;
  const sE = Math.sin(EGIM), cE = Math.cos(EGIM);
  const LX = 6.0, LZ = 3.4;          // panel yüzeyi (eğim boyunca LZ)
  const PW = 1.0, PH = 1.7;          // tek panel (dikey yerleşim) → 6 × 2 panel
  const HC = 1.42;                   // yüzey merkez yüksekliği
  const OX = 0.4, OZ = -0.2;         // masa ofseti (şarj platformu solda kalsın)

  // Yüzey grubu: yerel XZ panel düzlemi; +Z eğimden aşağı (öne), normal +Y
  const yuzey = new THREE.Group();
  yuzey.position.set(OX, HC, OZ);
  yuzey.rotation.x = EGIM;
  g.add(yuzey);
  // yüzey yerel (x, y, z) → makine (g) çerçevesi
  const yuzeyNokta = (x, y, z) => [OX + x, HC + y * cE - z * sE, OZ + y * sE + z * cE];

  // ---------------------------------------------------------------- paneller
  const S1 = 256; // px/m
  const panelTex = canvasTex(Math.round(LX * S1), Math.round(LZ * S1), (x) => {
    x.fillStyle = '#9aa1a8'; x.fillRect(0, 0, LX * S1, LZ * S1);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const x0 = i * PW * S1 + 3, y0 = j * PH * S1 + 3, w = PW * S1 - 6, h = PH * S1 - 6;
      x.fillStyle = '#c3c9ce'; x.fillRect(x0, y0, w, h);                      // alüminyum çerçeve
      const gr = x.createLinearGradient(x0, y0, x0 + w, y0 + h);
      gr.addColorStop(0, '#1b2c4d'); gr.addColorStop(0.5, '#13213c'); gr.addColorStop(1, '#1d3156');
      x.fillStyle = gr; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      x.strokeStyle = 'rgba(150,170,205,.35)'; x.lineWidth = 1;
      for (let c = 1; c < 6; c++) { const px = x0 + 6 + ((w - 12) * c) / 6; x.beginPath(); x.moveTo(px, y0 + 6); x.lineTo(px, y0 + h - 6); x.stroke(); }
      for (let r = 1; r < 10; r++) { const py = y0 + 6 + ((h - 12) * r) / 10; x.beginPath(); x.moveTo(x0 + 6, py); x.lineTo(x0 + w - 6, py); x.stroke(); }
      x.strokeStyle = 'rgba(200,210,225,.18)';                               // bara çizgileri
      for (let c = 0; c < 6; c++) for (const k of [0.33, 0.66]) {
        const px = x0 + 6 + ((w - 12) * (c + k)) / 6; x.beginPath(); x.moveTo(px, y0 + 6); x.lineTo(px, y0 + h - 6); x.stroke();
      }
    }
  });
  box(LX + 0.04, 0.035, LZ + 0.04, M.alu, 0, -0.0225, 0, yuzey);
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(LX, LZ),
    new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.18, metalness: 0.35, polygonOffset: true, polygonOffsetFactor: -1 }));
  panelMesh.rotation.x = -Math.PI / 2;
  panelMesh.receiveShadow = true;
  yuzey.add(panelMesh);

  // ---------------------------------------------------------------- toz katmanı (silinebilir)
  const TS = 1024 / LX; // px/m
  const TW = 1024, THt = Math.round(LZ * TS);
  const tozKaynak = document.createElement('canvas');      // tam kirli hali (yeniden kirletmek için)
  tozKaynak.width = TW; tozKaynak.height = THt;
  {
    const x = tozKaynak.getContext('2d');
    const id = x.createImageData(TW, THt);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = Math.random();
      id.data[i] = 168 + n * 22; id.data[i + 1] = 148 + n * 20; id.data[i + 2] = 112 + n * 16;
      id.data[i + 3] = 125 + n * 60;
    }
    x.putImageData(id, 0, 0);
    for (let k = 0; k < 60; k++) {                          // lekeler
      const cx = Math.random() * TW, cy = Math.random() * THt, r = 20 + Math.random() * 90;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(110,88,58,.45)'); gr.addColorStop(1, 'rgba(110,88,58,0)');
      x.fillStyle = gr; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    x.strokeStyle = 'rgba(95,78,52,.25)'; x.lineWidth = 2;  // eğim boyunca yağmur izleri
    for (let k = 0; k < 140; k++) {
      const sx = Math.random() * TW, sy = Math.random() * THt * 0.7;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + gurultu(4), sy + 30 + Math.random() * 120); x.stroke();
    }
  }
  const tozCanvas = document.createElement('canvas');
  tozCanvas.width = TW; tozCanvas.height = THt;
  const tozCtx = tozCanvas.getContext('2d');
  tozCtx.drawImage(tozKaynak, 0, 0);
  const tozTex = new THREE.CanvasTexture(tozCanvas);
  tozTex.colorSpace = THREE.SRGBColorSpace;
  const tozMesh = new THREE.Mesh(new THREE.PlaneGeometry(LX, LZ), new THREE.MeshStandardMaterial({
    map: tozTex, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  tozMesh.rotation.x = -Math.PI / 2;
  tozMesh.position.y = 0.004;
  tozMesh.receiveShadow = true;
  yuzey.add(tozMesh);
  let tozKirli = false;

  // Temizlik kapsamı: 10 cm hücreli ızgara (yüzde hesabı için)
  const GX = 60, GZ = 34;
  const temiz = new Uint8Array(GX * GZ);
  let temizSay = 0;

  // ---------------------------------------------------------------- taşıyıcı konstrüksiyon
  const KX = [-2.7, -0.9, 0.9, 2.7];
  for (const xp of KX) {
    box(0.06, 0.08, LZ - 0.1, M.celik, xp, -0.08, 0, yuzey);                // aşık (eğim boyunca)
    const on = yuzeyNokta(xp, -0.12, 1.2), ar = yuzeyNokta(xp, -0.12, -1.2);
    beam([on[0], 0, on[2]], on, 0.08, 0.08, M.celik, g);
    beam([ar[0], 0, ar[2]], ar, 0.08, 0.08, M.celik, g);
    beam([on[0], 0.25, on[2]], [ar[0], ar[1] - 0.35, ar[2]], 0.05, 0.05, M.celik, g); // çapraz
    box(0.28, 0.12, 0.28, M.gri, on[0], 0.06, on[2], g);
    box(0.28, 0.12, 0.28, M.gri, ar[0], 0.06, ar[2], g);
  }
  for (const zl of [-0.85, 0.85]) box(LX, 0.05, 0.05, M.celik, 0, -0.045, zl, yuzey); // kuşaklar

  // Şarj / park platformu (masanın sol üst ucunda; şeritler arası transfer noktası)
  const Z0 = -1.36, DZ = 0.544, SERIT = 6, XL = 2.55, XD = -3.42;
  const plaka = mat(0xb5bcc2, { r: 0.45, m: 0.8, key: 'plaka' });
  box(0.84, 0.03, 0.74, plaka, -3.43, -0.012, Z0, yuzey);
  box(0.1, 0.18, 0.5, M.koyu, -3.88, 0.07, Z0, yuzey);                     // şarj kutusu
  const sarjLed = lamba(0x2ea043, 0.3);
  box(0.02, 0.04, 0.12, sarjLed, -3.82, 0.12, Z0, yuzey);
  for (const dz of [-0.12, 0.12]) box(0.06, 0.02, 0.05, mat(0xc07a3a, { r: 0.3, m: 0.9, key: 'bakir' }), -3.8, 0.02, Z0 + dz, yuzey);
  {
    const p = yuzeyNokta(-3.43, -0.03, Z0);
    beam([p[0], 0, p[2]], p, 0.07, 0.07, M.celik, g);
    box(0.25, 0.1, 0.25, M.gri, p[0], 0.05, p[2], g);
    beam(yuzeyNokta(-3.0, -0.03, Z0), yuzeyNokta(-2.7, -0.12, Z0 + 0.3), 0.05, 0.05, M.celik, g);
  }

  // ---------------------------------------------------------------- robot
  const robot = new THREE.Group();
  yuzey.add(robot);
  const RY = 0.004;
  const paletDoku = () => {
    const t = canvasTex(64, 16, (x, w, h) => {
      x.fillStyle = '#161616'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#3b3b3b'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, h);
    }, { tekrar: [10, 1] });
    return t;
  };
  const texSol = paletDoku(), texSag = paletDoku();
  for (const [sz, tex] of [[-0.33, texSol], [0.33, texSag]]) {
    box(0.8, 0.085, 0.085, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, RY + 0.043, sz, robot);
    for (const sx of [-0.38, 0.38]) cyl(0.045, 0.095, M.koyu, sx, RY + 0.045, sz, robot, { eksen: 'z', seg: 16 });
  }
  // gövde: beyaz alüminyum, üst yüzde kırmızı çıkartma
  box(0.72, 0.06, 0.56, mat(0xdfe3e6, { r: 0.4, m: 0.5, key: 'sbgovde' }), 0, RY + 0.115, 0, robot);
  const cikartma = canvasTex(512, 400, (x, w, h) => {
    x.fillStyle = '#e4e7ea'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(w * 0.5, h * 0.5); x.rotate(-0.5);
    x.fillStyle = '#d1302a'; x.font = '800 64px "Space Grotesk", sans-serif'; x.textAlign = 'center';
    x.fillText('SOLARBOT', 0, 20);
    x.restore();
    x.fillStyle = '#d1302a';
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(30 + i * 34, 60); x.lineTo(60 + i * 34, 20); x.lineTo(76 + i * 34, 20); x.lineTo(46 + i * 34, 60); x.fill(); }
    x.fillStyle = '#5b6f8f'; x.font = '500 18px "JetBrains Mono", monospace';
    for (let i = 0; i < 4; i++) x.fillText('ROS 2 · OAK-D · LiFePO4 24V', 30, 320 + i * 20);
  });
  const ust = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.54), new THREE.MeshStandardMaterial({ map: cikartma, roughness: 0.5, metalness: 0.2 }));
  ust.rotation.x = -Math.PI / 2;
  ust.position.y = RY + 0.146;
  robot.add(ust);
  for (const sx of [-0.37, 0.37]) for (const sz of [-0.28, 0.28]) box(0.05, 0.05, 0.05, M.sari, sx, RY + 0.095, sz, robot); // tamponlar
  // kontrol kutusu + kablo
  box(0.3, 0.07, 0.2, M.koyu, -0.04, RY + 0.18, 0.02, robot);
  box(0.26, 0.012, 0.03, M.siyah, -0.04, RY + 0.22, 0.02, robot);
  const durumLed = lamba(0x2ea043, 1.5);
  box(0.03, 0.02, 0.03, durumLed, 0.08, RY + 0.22, -0.06, robot);
  rod([-0.19, RY + 0.18, 0.05], [-0.22, RY + 0.26, 0.0], 0.008, M.siyah, robot);
  // ön + arka dönen fırça ve kapakları (Kaan: robotun önünde ve arkasında fırça var)
  const FX = 0.42;
  const fircaTex = canvasTex(64, 32, (x, w, h) => {
    x.fillStyle = '#2b2f36'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5d6673'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, h);
  }, { tekrar: [3, 6] });
  const fircaMat = new THREE.MeshStandardMaterial({ map: fircaTex, roughness: 0.95 });
  const fircalar = [FX, -FX].map((fx) => {
    const f = new THREE.Group();
    f.position.set(fx, RY + 0.06, 0);
    robot.add(f);
    cyl(0.058, 0.64, fircaMat, 0, 0, 0, f, { eksen: 'z', seg: 18 });
    box(0.16, 0.025, 0.68, M.koyu, fx, RY + 0.13, 0, robot);
    for (const sz of [-0.34, 0.34]) box(0.14, 0.09, 0.015, M.koyu, fx, RY + 0.09, sz, robot);
    return f;
  });
  // OAK-D kamera direği + görüş konisi
  rod([-0.25, RY + 0.14, 0], [-0.25, RY + 0.44, 0], 0.012, M.alu, robot);
  const kam = new THREE.Group();
  kam.position.set(-0.24, RY + 0.46, 0);
  kam.rotation.z = -0.38;
  robot.add(kam);
  box(0.032, 0.032, 0.11, M.siyah, 0, 0, 0, kam);
  for (const dz of [-0.035, 0, 0.035]) cyl(0.007, 0.006, mat(0x3a5a8a, { r: 0.1, m: 0.6, key: 'lens' }), 0.017, 0, dz, kam, { eksen: 'x', seg: 10 });
  const koni = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 24, 1, true), new THREE.MeshBasicMaterial({
    color: 0x39c5cf, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
  }));
  koni.rotation.z = Math.PI / 2;           // ucu kamerada, açıklığı +X
  koni.position.x = 0.67;
  kam.add(koni);

  // ---------------------------------------------------------------- yer istasyonu (tablet + kule lambası)
  const ist = new THREE.Group();
  ist.position.set(-3.5, 0, 2.35);
  g.add(ist);
  cyl(0.03, 1.3, M.koyu, 0, 0.65, 0, ist, { seg: 12 });
  cyl(0.22, 0.03, M.koyu, 0, 0.015, 0, ist, { seg: 20 });
  const ekran = new Ekran(0.34, 0.22, 512);
  // tablet: çerçeve + önünde ekran (aynı eğimli kart grubunda, çakışma olmasın)
  const tablet = new THREE.Group();
  tablet.position.set(0, 1.12, 0.05);
  tablet.rotation.x = -0.35;
  ist.add(tablet);
  box(0.37, 0.25, 0.02, M.siyah, 0, 0, 0, tablet);
  ekran.mesh.position.set(0, 0, 0.012);
  tablet.add(ekran.mesh);
  const kule = kuleLambasi(ist, 0, 1.3, 0);
  acilStop(ist, 0, 0.82, 0.05, 0);

  // ---------------------------------------------------------------- operatör
  // Yer istasyonundaki tabletin başında robotu izler (yüzü tablete: π). Manuel modda
  // sağ elde telsiz kumanda görünür ve yüzünü robota döner. Robot şarja dönünce tablet
  // direğinin yanından dolaşıp şarj platformunun altına gider, bakar, geri döner.
  const op = lib.operator({ kumanda: true });
  g.add(op.group);
  const opKumanda = op.elSag.children[0];
  const IST = [-3.5, 2.8], ARA = [-4.05, 2.75], SARJ = [-3.8, -0.45];
  const sarjYon = Math.atan2(-3.03 - SARJ[0], -1.43 - SARJ[1]);   // platform (makine çerçevesinde)
  const opS = { x: IST[0], z: IST[1], yon: Math.PI, hx: IST[0], hz: IST[1], hyon: Math.PI, poz: 'on' };
  const opHedef = (p, yon, poz) => { opS.hx = p[0]; opS.hz = p[1]; opS.hyon = yon; opS.poz = poz; };
  let opYer = 'ist', opBakT = 0, opBuSarj = false;
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
    const vardi = Math.hypot(opS.x - opS.hx, opS.z - opS.hz) < 0.03;
    const manuel = mod === 'man';
    if (durum !== 'sarj') opBuSarj = false;
    const geriDon = durum === 'acil' || manuel;               // uzaktaysa istasyona dön
    opKumanda.visible = manuel;
    if (opYer === 'ist') {
      const yon = manuel ? Math.atan2(OX + R.x - opS.x, OZ + R.z * cE - opS.z) : Math.PI;
      opHedef(IST, yon, 'on');
      if (durum === 'sarj' && !manuel && !opBuSarj) { opBuSarj = true; opYer = 'git1'; }
    } else if (opYer === 'git1') {
      opHedef(ARA, Math.PI, 'yan');
      if (geriDon) opYer = 'don2'; else if (vardi) opYer = 'git2';
    } else if (opYer === 'git2') {
      opHedef(SARJ, sarjYon, 'on');
      if (geriDon) opYer = 'don1'; else if (vardi) { opBakT = 0; opYer = 'bak'; }
    } else if (opYer === 'bak') {
      opBakT += dt;
      if (geriDon || opBakT > 5 || durum !== 'sarj') opYer = 'don1';
    } else if (opYer === 'don1') {
      opHedef(ARA, 0, 'yan');
      if (vardi) opYer = 'don2';
    } else if (opYer === 'don2') {
      opHedef(IST, Math.PI, 'on');
      if (vardi) opYer = 'ist';
    }
  }

  // ---------------------------------------------------------------- hareket + görev mantığı
  const R = { x: XD, z: Z0, h: 0, v: 0, w: 0 };
  let mod = 'oto';          // oto | man
  let durum = 'temizlik';   // temizlik | donus | sarj | durdu | acil
  let batarya = 72;
  let hizMax = 0.32;
  let fircaAcik = true;
  let dusukBat = false;
  let kenarT = 0, sarjBekle = 0, kirletT = 0, yoloGuven = 97.2;
  const cmd = { v: 0, w: 0 };

  function anaRota() {
    const w = [[-XL, Z0]];
    for (let i = 0; i < SERIT; i++) {
      const zi = Z0 + i * DZ, xe = i % 2 === 0 ? XL : -XL;
      w.push([xe, zi]);
      if (i < SERIT - 1) w.push([xe, zi + DZ]);
    }
    return w;
  }
  const donusRotasi = () => [[-XL, R.z], [-XL, Z0], [XD, Z0]];
  let rota = anaRota(), wi = 0, kaldigi = 0;

  const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const izinli = (x, z) => (Math.abs(x) <= 2.66 && Math.abs(z) <= 1.47) || (x >= -3.8 && x <= -2.6 && Math.abs(z - Z0) <= 0.32);
  const panelde = () => Math.abs(R.x) <= 3.0;

  // Noktaya git: önce yerinde dön (paletli), sonra düz sür. Varınca true.
  function noktayaGit(p) {
    const dx = p[0] - R.x, dz = p[1] - R.z, d = Math.hypot(dx, dz);
    if (d < 0.025) { cmd.v = 0; cmd.w = 0; return true; }
    const e = sar(Math.atan2(-dz, dx) - R.h);
    if (Math.abs(e) > 0.06) { cmd.v = 0; cmd.w = clamp(e * 3, -1.1, 1.1); }
    else { cmd.v = Math.min(hizMax, d * 1.5 + 0.05); cmd.w = e * 2.5; }
    return false;
  }

  function fircaSil() { for (const fx of [FX, -FX]) fircaIzi(fx); }
  function fircaIzi(fx) {
    const bx = R.x + Math.cos(R.h) * fx, bz = R.z - Math.sin(R.h) * fx;
    tozCtx.save();
    tozCtx.globalCompositeOperation = 'destination-out';
    tozCtx.translate((bx + LX / 2) * TS, (bz + LZ / 2) * TS);
    tozCtx.rotate(-R.h);
    tozCtx.fillRect(-0.09 * TS, -0.33 * TS, 0.18 * TS, 0.66 * TS);
    tozCtx.restore();
    tozKirli = true;
    // kapsam ızgarası
    const c = Math.cos(R.h), s = Math.sin(R.h);
    const i0 = Math.max(0, Math.floor((bx + 3 - 0.4) / 0.1)), i1 = Math.min(GX - 1, Math.floor((bx + 3 + 0.4) / 0.1));
    const j0 = Math.max(0, Math.floor((bz + 1.7 - 0.4) / 0.1)), j1 = Math.min(GZ - 1, Math.floor((bz + 1.7 + 0.4) / 0.1));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = j * GX + i;
      if (temiz[k]) continue;
      const cx = -3 + (i + 0.5) * 0.1 - bx, cz = -1.7 + (j + 0.5) * 0.1 - bz;
      if (Math.abs(cx * c - cz * s) <= 0.1 && Math.abs(cx * s + cz * c) <= 0.33) { temiz[k] = 1; temizSay++; }
    }
  }
  const temizYuzde = () => (temizSay / (GX * GZ)) * 100;

  function kirlet() { kirletT = 2.5; temiz.fill(0); temizSay = 0; }

  function update(dt, t) {
    cmd.v = 0; cmd.w = 0;
    if (durum === 'acil') { R.v = 0; R.w = 0; }
    else if (mod === 'man') {
      cmd.v = man.v * hizMax; cmd.w = man.w * 0.9;
    } else if (durum === 'temizlik') {
      if (batarya < 15) { dusukBat = true; kaldigi = wi; rota = donusRotasi(); wi = 0; durum = 'donus'; }
      else if (noktayaGit(rota[wi])) {
        wi++;
        if (wi >= rota.length) { rota = donusRotasi(); wi = 0; durum = 'donus'; kaldigi = 0; }
      }
    } else if (durum === 'donus') {
      if (noktayaGit(rota[wi])) {
        wi++;
        if (wi >= rota.length) { durum = 'sarj'; sarjBekle = 0; R.h = sar(R.h); }
      }
    } else if (durum === 'sarj') {
      sarjBekle += dt;
      if (batarya >= 95 && sarjBekle > 4) {
        if (temizYuzde() > 90 && kirletT <= 0) kirlet();        // panel yeniden tozlanır, yeni tur
        else if (kirletT <= 0) {
          rota = anaRota(); wi = dusukBat ? Math.max(0, kaldigi - 1) : 0;
          dusukBat = false; durum = 'temizlik';
        }
      }
    }

    // hız/dönüş: ivme sınırlı
    if (durum !== 'acil') {
      R.v = approach(R.v, cmd.v, 0.8 * dt);
      R.w = approach(R.w, cmd.w, 3.0 * dt);
    }
    const nh = R.h + R.w * dt;
    const nx = R.x + R.v * Math.cos(nh) * dt, nz = R.z - R.v * Math.sin(nh) * dt;
    if (izinli(nx, nz)) { R.h = nh; R.x = nx; R.z = nz; }
    else { R.v = 0; R.h = nh; kenarT = 1.2; }
    kenarT = Math.max(0, kenarT - dt);
    robot.position.set(R.x, 0, R.z);
    robot.rotation.y = R.h;

    // palet dokuları ve fırça
    const vL = R.v - R.w * 0.33, vR = R.v + R.w * 0.33;
    texSol.offset.x -= vL * dt * 12.5;
    texSag.offset.x -= vR * dt * 12.5;
    const fircaDon = fircaAcik && durum !== 'acil' && durum !== 'sarj';
    if (fircaDon) { fircalar[0].rotation.z -= 16 * dt; fircalar[1].rotation.z += 16 * dt; }
    if (fircaDon && panelde() && (Math.abs(R.v) > 0.005 || Math.abs(R.w) > 0.02)) fircaSil();

    // yeniden tozlanma (şarjdayken)
    if (kirletT > 0) {
      kirletT -= dt;
      tozCtx.globalCompositeOperation = 'source-over';
      tozCtx.globalAlpha = 1 - Math.exp(-dt * 1.6);
      tozCtx.drawImage(tozKaynak, 0, 0);
      tozCtx.globalAlpha = 1;
      tozKirli = true;
      if (kirletT <= 0) { tozCtx.drawImage(tozKaynak, 0, 0); }
    }
    if (tozKirli && dokuZ(dt)) { tozTex.needsUpdate = true; tozKirli = false; }

    // batarya
    const hareket = Math.abs(R.v) > 0.005 || Math.abs(R.w) > 0.02;
    if (durum === 'sarj' && R.x < -3.0) batarya = Math.min(100, batarya + 2.5 * dt);
    else batarya = Math.max(0, batarya - dt * ((hareket ? 0.24 : 0.02) + (fircaDon ? 0.08 : 0)));
    if (batarya <= 0) { R.v = 0; cmd.v = 0; }
    sarjLed.emissiveIntensity = durum === 'sarj' ? 1.2 + Math.sin(t * 4) * 0.8 : 0.2;
    if (yoloZ(dt)) yoloGuven = panelde() ? 95.5 + Math.random() * 3.8 : 0;
    koni.material.opacity = durum === 'acil' ? 0.02 : 0.08;
    opKarar(dt);
    opGuncelle(dt, t);

    const d = durumBilgi();
    durumLed.emissiveIntensity = d.seviye === 'alarm' ? (Math.sin(t * 9) > 0 ? 2.5 : 0.1) : 1.5;
    durumLed.color.setHex(d.seviye === 'alarm' ? 0xe5302a : d.seviye === 'uyari' ? 0xf2a900 : 0x2ea043);
    durumLed.emissive.copy(durumLed.color);
    kule.set(d.seviye, t);
    trend.ornekle(dt, [batarya, temizYuzde()]);
    if (ekranZ(dt)) {
      ekran.standart('SolarBot · Kontrol', [
        ['Batarya', `%${fmt(batarya, 0)}`],
        ['Temiz alan', `%${fmt(temizYuzde(), 0)}`],
        ['Hız', `${fmt(Math.abs(R.v), 2)} m/s`],
        ['Şerit', seritNo()],
      ], d);
    }
  }
  const dokuZ = throttle(12), yoloZ = throttle(2), ekranZ = throttle(4);
  const seritNo = () => (panelde() ? `${clamp(Math.round((R.z - Z0) / DZ) + 1, 1, SERIT)} / ${SERIT}` : 'park');

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (batarya <= 0) return { metin: 'BATARYA BİTTİ', seviye: 'alarm' };
    if (kenarT > 0) return { metin: 'KENAR SENSÖRÜ · DURDU', seviye: 'uyari' };
    if (mod === 'man') return { metin: 'MANUEL SÜRÜŞ', seviye: Math.abs(R.v) + Math.abs(R.w) > 0.01 ? 'calisiyor' : 'bekliyor' };
    if (durum === 'temizlik') return { metin: 'OTONOM TEMİZLİK', seviye: 'calisiyor' };
    if (durum === 'donus') return dusukBat ? { metin: 'DÜŞÜK BATARYA · ŞARJA DÖNÜŞ', seviye: 'uyari' } : { metin: 'ŞARJ İSTASYONUNA DÖNÜŞ', seviye: 'calisiyor' };
    if (durum === 'sarj') return { metin: kirletT > 0 ? 'ŞARJDA · PANEL TOZLANIYOR' : `ŞARJDA %${fmt(batarya, 0)}`, seviye: 'bekliyor' };
    return { metin: 'HAZIR', seviye: 'bekliyor' };
  }

  const man = { v: 0, w: 0 };
  const trend = new Trend([{ ad: 'Batarya %', renk: '#2ea043' }, { ad: 'Temiz %', renk: '#39c5cf' }], { min: 0, max: 100, uzunluk: 300, periyot: 0.25 });

  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otonom'], ['man', 'Manuel (kumanda)']], get: () => mod,
      set: (v) => { mod = v; man.v = man.w = 0; if (v === 'oto' && durum !== 'acil') { rota = anaRota(); wi = 0; durum = 'temizlik'; } } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Temizliği başlat', tur: 'basla', tik: () => {
        if (durum === 'acil') return;
        mod = 'oto'; rota = anaRota(); wi = 0; durum = 'temizlik';
      } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum !== 'acil') { durum = 'durdu'; } } },
      { metin: 'Şarja dön', tik: () => { if (durum !== 'acil') { mod = 'oto'; rota = donusRotasi(); wi = 0; durum = 'donus'; } } },
    ] },
    { tip: 'baslik', metin: 'Manuel sürüş (mod: Manuel)' },
    { tip: 'basili', ogeler: [
      { metin: '◀ Sol', bas: () => (man.w = 1), birak: () => (man.w = 0) },
      { metin: '▲ İleri', bas: () => (man.v = 1), birak: () => (man.v = 0) },
      { metin: '▼ Geri', bas: () => (man.v = -0.6), birak: () => (man.v = 0) },
      { metin: 'Sağ ▶', bas: () => (man.w = -1), birak: () => (man.w = 0) },
    ] },
    { tip: 'kaydirici', metin: 'Azami hız', min: 0.1, max: 0.5, adim: 0.02, birim: 'm/s', get: () => hizMax, set: (v) => (hizMax = v) },
    { tip: 'anahtar', metin: 'Fırça motoru', get: () => fircaAcik, set: (v) => (fircaAcik = v) },
    { tip: 'anahtar', metin: 'OAK-D görüş konisini göster', get: () => koni.visible, set: (v) => (koni.visible = v) },
    { tip: 'butonlar', ogeler: [{ metin: 'Paneli kirlet', tik: kirlet }] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; R.v = 0; R.w = 0; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') durum = 'durdu'; } },
    ] },
  ];

  return {
    id: 'solarbot',
    ad: 'SolarBot',
    altBaslik: 'Otonom panel temizleme · ROS 2 · YOLO',
    kisa: 'Güneş paneli masasında otonom çalışan paletli temizleme robotu: OAK-D derinlik kamerası ile engel/kenar algılama, YOLO ile panel tespiti, zikzak kapsama yolu, Smart BMS\'li LiFePO4 batarya ve otomatik şarja dönüş.',
    proje: 'solarbot',
    ayakIzi: [8.4, 5.8],
    kamera: { poz: [-1.6, 4.4, 6.4], hedef: [0.3, 1.25, -0.3] },
    mekanizmalar: [
      'Paletler: sol/sağ palet ayrı hızda döner (diferansiyel sürüş, yerinde dönüş)',
      'Ön ve arka fırça: ters yönde döner, ikisi de geçtiği yerdeki toz katmanını siler',
      'Zikzak kapsama: 6 şerit boyunca git, şerit değiştir, geri dön',
      'Batarya %15 altına inince şarj platformuna döner, dolunca kaldığı şeritten devam eder',
      'OAK-D kamera: direk üstünde, öne-aşağı bakar (görüş konisi)',
      'Operatör: yer istasyonu tabletinin başında izler; manuel modda telsiz kumandayla robota döner, robot şarja dönünce platforma yürüyüp bakar',
    ],
    cikarim: [
      'solarbot-img-02/04/05 ve video-03: düz, alçak alüminyum şasi; iki yanda dar palet; arkada direkte kamera; köşelerde sarı tamponlar; üstte koyu kontrol kutusu ve kablo → gövde ölçüsü ~0.75 × 0.65 m alındı.',
      'solarbot-video-02: elde tutulan uzun siyah kamera → OAK-D (3 lensli) olarak direğe kondu.',
      'solarbot-img-07: önünde fırça/sıyırıcı olan paletli versiyon; KAAN\'IN DÜZELTMESİ: robotun önünde VE arkasında dönen fırça var → iki fırça.',
      'solarbot-img-01 (BMS) ve -06 (pano): LiFePO4 8S 24V batarya ve Smart BMS → batarya modeli ve şarja dönüş davranışı.',
      'TAHMİN: panel masası ölçüsü (6 × 2 panel, 25°), şarj/park platformu ve zikzak yol; videolarda robot atölye zemininde test ediliyor, panel üstü görüntüsü yok.',
    ],
    group: g,
    // sabitle(): robot (paletler, fırçalar, kamera konisi) hareketli; toz/panel tek mesh, operatör kendiliğinden atlanır
    sabitHaric: [robot],
    update,
    kontroller,
    degerler: () => [
      ['Batarya', `%${fmt(batarya, 0)}`],
      ['Temizlenen alan', `%${fmt(temizYuzde(), 1)}`],
      ['Hız', `${fmt(Math.abs(R.v), 2)} m/s`],
      ['Şerit', seritNo()],
      ['Panel tespiti (YOLO)', yoloGuven ? `%${fmt(yoloGuven, 1)}` : '—'],
      ['Konum (x, z)', `${fmt(R.x, 2)}, ${fmt(R.z, 2)} m`],
    ],
    trend,
    durum: durumBilgi,
  };
}
