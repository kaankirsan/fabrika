// js/machines/iha.js — Üniversite İHA Projesi (TEMSİLİ).
//
// Kaan üniversitede İHA projelerine katkı verdi (CV: "insansız hava aracı projelerine katkı",
// portföy: "İHA Takım Üyesi"); aracın tipi/ölçüsü elimizde yok. Kafes içinde iyi canlanan,
// üniversite takımlarında yaygın ≈1 m sınıfı X-quad seçildi: ağ kafes, iniş pedi, bağlı
// (tether) hover testi, yer istasyonu (laptop telemetri) ve pilot. Modlar: motor testi,
// bağlı hover (ALT_HOLD), pusula/IMU kalibrasyonu, kafes içi rota (LOITER + waypoint);
// failsafe (bağlantı kaybında otomatik iniş) ve KILL (motor kesme).

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, mat, lamba, Ekran, Trend, levha, canvasTex, orguDokusu, profil,
    clamp, lerp, approach, damp, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---------------------------------------------------------------- uçuş kafesi (ağ + alüminyum profil)
  const KX0 = -1.7, KX1 = 3.3, KZ0 = -2.7, KZ1 = 1.7, KH = 3.2;
  const PAD = V((KX0 + KX1) / 2, 0, (KZ0 + KZ1) / 2);   // iniş pedi merkezi (0.8, −0.5)
  const agMat = new THREE.MeshStandardMaterial({
    map: orguDokusu(), color: 0x26322b, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, metalness: 0,
  });
  const agPanel = (x0, z0, x1, z1, y0, y1) => {   // dikey ya da yatay ağ (uv: 4 cm göz)
    const yatay = y0 === y1;
    const w = yatay ? Math.abs(x1 - x0) : Math.hypot(x1 - x0, z1 - z0), h = yatay ? Math.abs(z1 - z0) : y1 - y0;
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * w / 0.04, uv.getY(j) * h / 0.04);
    const m = new THREE.Mesh(geo, agMat);
    if (yatay) { m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); }
    else { m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const KAPI = [0.35, 1.35];   // ön yüzde kapı (x aralığı)
  agPanel(KX0, KZ1, KAPI[0], KZ1, 0.05, KH);
  agPanel(KAPI[1], KZ1, KX1, KZ1, 0.05, KH);
  agPanel(KAPI[0], KZ1, KAPI[1], KZ1, 2.15, KH);       // kapı üstü
  agPanel(KX1, KZ1, KX1, KZ0, 0.05, KH);
  agPanel(KX1, KZ0, KX0, KZ0, 0.05, KH);
  agPanel(KX0, KZ0, KX0, KZ1, 0.05, KH);
  agPanel(KX0, KZ0, KX1, KZ1, KH, KH);                // tavan ağı
  const kP = 0.05;
  for (const x of [KX0, KX1, KAPI[0], KAPI[1], (KX0 + KAPI[0]) / 2, (KAPI[1] + KX1) / 2]) profil([x, 0, KZ1], [x, KH, KZ1], kP, g);
  for (const x of [KX0, KX1, (KX0 + KX1) / 2]) profil([x, 0, KZ0], [x, KH, KZ0], kP, g);
  for (const z of [(KZ0 + KZ1) / 2]) { profil([KX0, 0, z], [KX0, KH, z], kP, g); profil([KX1, 0, z], [KX1, KH, z], kP, g); }
  for (const y of [0.04, KH]) {
    profil([KX0, y, KZ0], [KX1, y, KZ0], kP, g); profil([KX0, y, KZ1], [KX1, y, KZ1], kP, g);
    profil([KX0, y, KZ0], [KX0, y, KZ1], kP, g); profil([KX1, y, KZ0], [KX1, y, KZ1], kP, g);
  }
  profil([KAPI[0], 2.15, KZ1], [KAPI[1], 2.15, KZ1], kP, g);
  // kafes zemini: kauçuk + iniş pedi (H)
  box(KX1 - KX0 - 0.1, 0.02, KZ1 - KZ0 - 0.1, mat(0x2a2f2c, { r: 0.95, key: 'iha-zemin' }), PAD.x, 0.01, PAD.z, g);
  const padTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#1b1e22'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f2c200'; x.lineWidth = 14; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#f5f5f5'; x.font = '700 150px "Space Grotesk", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('H', w / 2, h / 2 + 8);
  });
  const pad = cyl(0.62, 0.012, new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.8 }), PAD.x, 0.026, PAD.z, g, { seg: 40 });
  pad.receiveShadow = true;
  box(0.08, 0.04, 0.08, M.koyu, PAD.x, 0.05, PAD.z + 0.7, g);   // tether çapası (pedin önünde)
  const ANKRAJ = V(PAD.x, 0.07, PAD.z + 0.7);
  const tabela = levha(['ÜNİVERSİTE İHA PROJESİ', 'temsili model · bağlı hover ve kafes içi uçuş testi'], 3.0, 0.5, { bg: '#17324f', font: 64, px: 1024 });
  tabela.position.set(PAD.x, KH + 0.4, KZ1 + 0.03);
  g.add(tabela);
  rod(V(PAD.x - 1.3, KH, KZ1), V(PAD.x - 1.3, KH + 0.5, KZ1), 0.02, M.koyu, g, 6);
  rod(V(PAD.x + 1.3, KH, KZ1), V(PAD.x + 1.3, KH + 0.5, KZ1), 0.02, M.koyu, g, 6);

  // ---------------------------------------------------------------- İHA (yerel: +X burun, kollar köşegen)
  const karbon = mat(0x1a1c1f, { r: 0.35, m: 0.3, key: 'iha-karbon' });
  const kirmiziK = mat(0xc8302a, { r: 0.4, m: 0.2, key: 'iha-kirmizi' });
  const iha = new THREE.Group();        // konum + sapma (yaw)
  const govde = new THREE.Group();      // yunuslama/yatış
  iha.add(govde);
  g.add(iha);
  iha.scale.setScalar(1.5);   // ≈ 1 m sınıfı (15" pervane): modelin ölçüsü 650 mm'ye göre kuruldu, ×1.5
  box(0.2, 0.012, 0.2, karbon, 0, 0.09, 0, govde);
  box(0.16, 0.012, 0.16, karbon, 0, 0.045, 0, govde);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {   // ara direkler
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    cyl(0.006, 0.045, M.alu, Math.cos(a) * 0.075 + s * 0.01, 0.068, Math.sin(a) * 0.075, govde, { seg: 6 });
  }
  const MOTOR = [];   // [x, z, yön]
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const mx = Math.cos(a) * 0.325, mz = Math.sin(a) * 0.325;
    rod(V(Math.cos(a) * 0.06, 0.068, Math.sin(a) * 0.06), V(mx, 0.068, mz), 0.011, i < 2 ? kirmiziK : karbon, govde, 10);   // ön kollar kırmızı
    cyl(0.03, 0.036, M.koyu, mx, 0.094, mz, govde, { seg: 16 });
    cyl(0.026, 0.012, M.alu, mx, 0.118, mz, govde, { seg: 16 });
    MOTOR.push([mx, mz, i % 2 ? 1 : -1]);
  }
  box(0.16, 0.05, 0.065, mat(0xf2c200, { r: 0.6, key: 'iha-lipo' }), -0.01, 0.123, 0, govde);   // LiPo (6S)
  for (const x of [-0.05, 0.03]) box(0.012, 0.054, 0.072, M.siyah, x, 0.123, 0, govde);          // kayış
  rod(V(-0.07, 0.096, 0), V(-0.07, 0.2, 0), 0.004, M.koyu, govde, 6);                            // GPS direği
  cyl(0.035, 0.012, M.beyaz, -0.07, 0.205, 0, govde, { seg: 16 });
  box(0.05, 0.012, 0.04, mat(0x2b6cd8, { r: 0.4, key: 'iha-fc' }), 0.04, 0.1, 0, govde);          // uçuş kontrolcüsü
  for (const s of [-1, 1]) {   // iniş takımı (iki kızak)
    rod(V(0.05, 0.04, s * 0.06), V(0.07, -0.08, s * 0.13), 0.006, karbon, govde, 6);
    rod(V(-0.05, 0.04, s * 0.06), V(-0.07, -0.08, s * 0.13), 0.006, karbon, govde, 6);
    rod(V(-0.13, -0.08, s * 0.13), V(0.13, -0.08, s * 0.13), 0.008, karbon, govde, 8);
  }
  box(0.04, 0.035, 0.04, M.siyah, 0.11, 0.02, 0, govde);   // gimbal kamera
  cyl(0.012, 0.01, mat(0x0a1a2a, { r: 0.1, m: 0.6, key: 'iha-lens' }), 0.132, 0.02, 0, govde, { eksen: 'x', seg: 12 });
  // pervaneler (10"): düşük devirde pal, yüksekte bulanık disk
  const palMat = mat(0x111214, { r: 0.5, key: 'iha-pal' });
  const diskMat = new THREE.MeshBasicMaterial({ color: 0x2a2c30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const gDisk = new THREE.CircleGeometry(0.127, 28);   // (×1.5 → 15") gDisk.rotateX(-Math.PI / 2);
  const pervane = MOTOR.map(([mx, mz]) => {
    const p = new THREE.Group(); p.position.set(mx, 0.128, mz); govde.add(p);
    const pal = box(0.254, 0.004, 0.022, palMat, 0, 0, 0, p);
    pal.castShadow = false;
    const d = new THREE.Mesh(gDisk, diskMat); d.position.y = 0.002; d.visible = false; p.add(d);
    return { p, pal, d };
  });
  // seyir ledleri: ön yeşil, arka kırmızı (yanıp söner) + durum ledi (FC)
  const ledOn = lamba(0x2bdc5a, 1.5), ledArka = lamba(0xff3030, 1.5), ledDurum = lamba(0x2b8cff, 1.5);
  MOTOR.forEach(([mx, mz], i) => box(0.016, 0.01, 0.016, i < 2 ? ledOn : ledArka, mx, 0.072, mz, govde));
  box(0.014, 0.008, 0.014, ledDurum, 0.06, 0.11, 0.012, govde);
  lib.sabitle(govde, pervane.map((x) => x.p));
  // bağlama ipi (tether): çapadan gövdeye, boyu ölçeklenir
  const ip = cyl(0.004, 1, mat(0xff7a1a, { r: 0.7, key: 'iha-ip' }), 0, 0, 0, g, { seg: 6 });
  ip.castShadow = false;

  // ---------------------------------------------------------------- yer istasyonu + pil şarj
  const MX = -3.35, MZ = 2.2;   // masa
  box(1.3, 0.04, 0.7, M.siyah, MX, 0.74, MZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, M.koyu, MX + sx * 0.6, 0.36, MZ + sz * 0.3, g);
  box(0.36, 0.02, 0.25, M.koyu, MX + 0.15, 0.77, MZ - 0.05, g);
  const ekran = new Ekran(0.34, 0.22, 512);
  ekran.mesh.position.set(MX + 0.15, 0.89, MZ - 0.18);
  ekran.mesh.rotation.x = -0.18;
  g.add(ekran.mesh);
  box(0.36, 0.24, 0.012, M.koyu, MX + 0.15, 0.89, MZ - 0.188, g).rotation.x = -0.18;
  // telemetri anteni (tripod) + yedek pervaneler
  rod(V(MX - 0.5, 0.76, MZ - 0.2), V(MX - 0.5, 1.3, MZ - 0.2), 0.008, M.koyu, g, 6);
  box(0.06, 0.12, 0.02, M.beyaz, MX - 0.5, 1.36, MZ - 0.2, g);
  for (let i = 0; i < 3; i++) box(0.254, 0.004, 0.022, palMat, MX - 0.3 + i * 0.05, 0.765, MZ + 0.2, g).rotation.y = i * 0.5;
  // LiPo şarj masası: şarj cihazı + yanmaz torbalar + yangın tüpü
  const SX = -3.4, SZ = -1.7;
  box(1.0, 0.04, 0.55, M.koyu, SX, 0.74, SZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, M.koyu, SX + sx * 0.45, 0.36, SZ + sz * 0.23, g);
  box(0.24, 0.1, 0.18, M.siyah, SX - 0.25, 0.81, SZ, g);
  const sarjEkran = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), lamba(0x39c5cf, 0.9));
  sarjEkran.position.set(SX - 0.25, 0.83, SZ + 0.091); g.add(sarjEkran);
  for (let i = 0; i < 2; i++) box(0.2, 0.08, 0.12, mat(0xb3261e, { r: 0.85, key: 'iha-torba' }), SX + 0.1 + i * 0.24, 0.8, SZ, g);
  const yedekPil = box(0.16, 0.05, 0.065, mat(0xf2c200, { r: 0.6, key: 'iha-lipo' }), SX + 0.3, 0.79, SZ + 0.15, g);
  cyl(0.08, 0.5, M.kirmizi, SX + 0.75, 0.25, SZ + 0.1, g, { seg: 14 });

  // ---------------------------------------------------------------- pilot (RC kumanda elinde)
  const op = lib.operator({ logo: false, yelek: 0x9ee03a, gomlek: 0x24304a });
  g.add(op.group);
  const rc = new THREE.Group();
  box(0.2, 0.12, 0.05, M.siyah, 0, 0, 0, rc);
  for (const s of [-1, 1]) cyl(0.008, 0.03, M.koyu, s * 0.05, 0.0, 0.035, rc, { eksen: 'z', seg: 8 });
  rod(V(0.08, 0.06, 0), V(0.1, 0.2, -0.02), 0.004, M.koyu, rc, 6);
  rc.position.set(0, 1.0, 0.3); rc.rotation.x = -0.5;
  op.group.add(rc);
  const PILOT = { x: -2.35, z: 2.55 };
  const opS = { x: PILOT.x, z: PILOT.z, yon: 2.3, hx: PILOT.x, hz: PILOT.z, hyon: 2.3, poz: 'on', rota: [], tasi: false };
  const opHedef = (x, z, yon, poz = 'on') => { opS.hx = x; opS.hz = z; opS.hyon = yon; opS.poz = poz; };
  const opRota = (noktalar, yon, poz = 'on') => {   // ara noktalar sırayla, sonuncusu hedef
    opS.rota = noktalar.slice(0, -1).map((n) => n.slice());
    const [x, z] = noktalar[noktalar.length - 1];
    opHedef(x, z, yon, poz);
  };
  const opVardi = () => !opS.rota.length && Math.hypot(opS.hx - opS.x, opS.hz - opS.z) < 0.03;
  function opGuncelle(dt, t) {
    let tx = opS.hx, tz = opS.hz;
    if (opS.rota.length) {
      [tx, tz] = opS.rota[0];
      if (Math.hypot(tx - opS.x, tz - opS.z) < 0.06) { opS.rota.shift(); [tx, tz] = opS.rota.length ? opS.rota[0] : [opS.hx, opS.hz]; }
    }
    const dx = tx - opS.x, dz = tz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.25 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(opS.tasi ? 'tasi' : yuruyor ? 'yan' : opS.poz);
    rc.visible = !opS.tasi;
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }
  const iha_yon = () => Math.atan2(iha.position.x - opS.x, iha.position.z - opS.z);   // pilot aracı izler

  // ---------------------------------------------------------------- uçuş mantığı
  const MODLAR = { motor: 'Motor testi (yerde)', hover: 'Bağlı hover (ALT_HOLD)', kalib: 'Pusula / IMU kalibrasyonu', rota: 'Kafes içi rota (LOITER + WP)' };
  const WP = [[1.3, 1.1], [1.3, -1.1], [-1.3, -1.1], [-1.3, 1.1]];   // pede göre (x, z)
  let mod = 'hover', armed = false, faz = 'yerde';   // yerde | kalkis | havada | inis | dusus
  let gaz = 55, failsafe = false, kill = false, demo = true, demoT = 0, demoAdim = 0;
  let soc = 0.92, kalibK = 0, motorTestT = 0, wpI = 0, pilIs = null;
  const s = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, roll: 0, pitch: 0 };
  const rpm = [0, 0, 0, 0];
  let akim = 0, volt = 25.2;
  const hedefIrtifa = () => 0.5 + 1.5 * (gaz / 100);
  const havada = () => s.y > 0.03;

  const arm = () => { if (!kill && !failsafe && soc > 0.12 && !pilIs) armed = true; };
  const disarm = () => { if (!havada()) { armed = false; faz = 'yerde'; } };
  const kalkis = () => { if (armed && (mod === 'hover' || mod === 'rota') && faz === 'yerde') { faz = 'kalkis'; wpI = 0; } };
  const inis = () => { if (havada() || faz === 'kalkis') faz = 'inis'; };

  function fizik(dt, t) {
    // hedef konum (pede göre) → ivme → yatış/yunuslama
    let hx = 0, hz = 0, hy = 0;
    if (faz === 'kalkis' || faz === 'havada') {
      hy = mod === 'rota' ? 1.6 : hedefIrtifa();
      if (faz === 'kalkis' && s.y > hy - 0.08) faz = 'havada';
      if (mod === 'rota' && faz === 'havada') {
        const w = WP[wpI];
        hx = w[0]; hz = w[1];
        if (Math.hypot(hx - s.x, hz - s.z) < 0.12) wpI = (wpI + 1) % WP.length;
      } else if (mod === 'hover') { hx = 0.06 * Math.sin(t * 0.7); hz = 0.05 * Math.sin(t * 0.9 + 1); }   // hafif sürüklenme
    } else if (faz === 'inis') {
      hy = 0; hx = s.x * 0.9; hz = s.z * 0.9;
      if (s.y <= 0.002) { faz = 'yerde'; armed = false; }
    }
    if (faz === 'dusus') {
      s.vy -= 9.81 * dt; s.y += s.vy * dt;
      if (s.y <= 0) { s.y = 0; s.vy = Math.abs(s.vy) > 1 ? -s.vy * 0.25 : 0; if (s.vy === 0) faz = 'yerde'; }
      s.vx *= 0.98; s.vz *= 0.98;
    } else if (faz !== 'yerde') {
      const vmax = mod === 'rota' ? 0.85 : 0.5;
      const ax = clamp((hx - s.x) * 2.2 - s.vx * 1.8, -2, 2), az = clamp((hz - s.z) * 2.2 - s.vz * 1.8, -2, 2);
      s.vx = clamp(s.vx + ax * dt, -vmax, vmax); s.vz = clamp(s.vz + az * dt, -vmax, vmax);
      const vyH = clamp((hy - s.y) * 1.6, -0.45, 0.6);
      s.vy = approach(s.vy, vyH, 1.5 * dt);
      s.y = Math.max(0, s.y + s.vy * dt);
      if (faz === 'inis' && s.y < 0.004) s.y = 0;
      // burun gidiş yönüne (rota) / pilota dönük kalır (hover)
      const v = Math.hypot(s.vx, s.vz);
      if (mod === 'rota' && v > 0.15) {
        let fy = Math.atan2(-s.vz, s.vx) - s.yaw; fy = Math.atan2(Math.sin(fy), Math.cos(fy));
        s.yaw += fy * (1 - Math.exp(-2.5 * dt));
      }
      // gövde çerçevesinde ivme → yunuslama (+X burun) / yatış
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const aF = ax * c - az * sn, aY = ax * sn + az * c;   // ileri / yan (yerel −Z)
      s.pitch = damp(s.pitch, clamp(-aF * 0.14, -0.35, 0.35), 8, dt);
      s.roll = damp(s.roll, clamp(aY * 0.14, -0.35, 0.35), 8, dt);
    } else {
      s.vx = s.vz = s.vy = 0; s.pitch = damp(s.pitch, 0, 8, dt); s.roll = damp(s.roll, 0, 8, dt);
      s.x = damp(s.x, 0, 1.5, dt); s.z = damp(s.z, 0, 1.5, dt);
    }
    if (mod === 'kalib' && armed === false && kalibK > 0 && kalibK < 1) s.yaw += dt * 0.55;   // yavaş tam tur
  }

  function motorlar(dt) {
    // hover devri ≈ 4300 rpm (≈ 5 kg, 15" pervane); motor testi sırayla M1..M4 sonra hepsi
    const hov = 4300;
    for (let i = 0; i < 4; i++) {
      let h = 0;
      if (kill || !armed) h = 0;
      else if (mod === 'motor') {
        const adim = Math.floor(motorTestT / 1.6);
        h = adim < 4 ? (adim === i ? 1200 + 60 * gaz : 900) : 1200 + 60 * gaz;
      } else if (faz === 'kalkis' || faz === 'havada' || faz === 'inis') {
        const ek = (faz === 'kalkis' ? 380 : faz === 'inis' ? -260 : 0) + (i < 2 ? -1 : 1) * s.pitch * 1800 + (i % 3 === 0 ? 1 : -1) * s.roll * 1800;
        h = hov + ek + gurultu(25);
      } else h = 1000;   // armed + yerde: rölanti
      rpm[i] = approach(rpm[i], Math.max(0, h), (kill ? 9000 : 6000) * dt);
    }
    const ort = (rpm[0] + rpm[1] + rpm[2] + rpm[3]) / 4;
    akim = 0.8 + 1.28e-9 * Math.pow(ort, 2.9);   // 4 motor toplamı: ≈ 45 A hover (4300 rpm)
    volt = 6 * (3.45 + 0.75 * soc) - akim * 0.012;
    soc = Math.max(0, soc - (akim * dt * 8) / (10 * 3600));     // 6S 10 Ah, ×8 hızlandırılmış
    // pervane görünümü
    pervane.forEach((pv, i) => {
      const w = (rpm[i] / 60) * Math.PI * 2 * MOTOR[i][2];
      if (rpm[i] < 1600) { pv.pal.visible = true; pv.p.rotation.y += Math.min(w * dt, 1.1); }
      else pv.pal.visible = false;
      pv.d.visible = rpm[i] > 700;
    });
    diskMat.opacity = clamp((ort - 700) / 3000, 0, 0.42);
  }

  // pil değişimi: pilot şarj masasından yedek pili alıp araca götürür
  // (kafesin batı duvarını dolaşır, ön kapıdan girer)
  const KAPI_X = (KAPI[0] + KAPI[1]) / 2;
  function pilGuncelle(dt) {
    if (!pilIs) return;
    if (pilIs.faz === 0) {
      if (!pilIs.r) { opRota([[SX + 0.3, SZ + 0.62]], Math.PI); pilIs.r = true; }
      if (opVardi()) { pilIs.faz = 1; pilIs.k = 0; pilIs.r = false; }
    } else if (pilIs.faz === 1) {
      pilIs.k += dt;
      if (pilIs.k > 0.6) { yedekPil.visible = false; opS.tasi = true; pilIs.faz = 2; }
    } else if (pilIs.faz === 2) {
      if (!pilIs.r) { opRota([[KX0 - 0.55, SZ + 0.62], [KX0 - 0.55, KZ1 + 0.65], [KAPI_X, KZ1 + 0.65], [KAPI_X, KZ1 - 0.5], [PAD.x, PAD.z + 0.62]], Math.PI); pilIs.r = true; }
      if (opVardi()) { pilIs.faz = 3; pilIs.k = 0; pilIs.r = false; opS.tasi = false; opS.poz = 'on'; }
    } else if (pilIs.faz === 3) {
      pilIs.k += dt;
      if (pilIs.k > 1.4) { soc = 1; pilIs.faz = 4; }
    } else if (pilIs.faz === 4) {
      if (!pilIs.r) { opRota([[KAPI_X, KZ1 - 0.5], [KAPI_X, KZ1 + 0.65], [PILOT.x, PILOT.z]], 2.3); pilIs.r = true; }
      if (opVardi()) { yedekPil.visible = true; pilIs = null; }
    }
  }

  const trend = new Trend([
    { ad: 'İrtifa (dm)', renk: '#39c5cf' }, { ad: 'Akım (A)', renk: '#f2c200' }, { ad: 'Pil (%)', renk: '#2ea043' },
  ], { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(4);
  const _v = V();

  function demoGuncelle(dt) {
    // motor testi → bağlı hover → iniş → kafes içi rota → iniş → (pil zayıfsa değiştir) → baştan
    demoT += dt;
    const sira = [
      () => { mod = 'motor'; arm(); motorTestT = 0; return 9; },
      () => { disarm(); return 1.5; },
      () => { mod = 'hover'; gaz = 45; arm(); kalkis(); return 16; },
      () => { inis(); return 6; },
      () => { mod = 'rota'; arm(); kalkis(); return 26; },
      () => { inis(); return 7; },
      () => { mod = 'kalib'; kalibK = 0.001; return 13; },
      () => { if (soc < 0.6) pilIs = { faz: 0, k: 0 }; return soc < 0.6 ? 12 : 1; },
    ];
    if (demoT >= (demoGuncelle.sure || 0)) {
      demoT = 0;
      demoGuncelle.sure = sira[demoAdim % sira.length]();
      demoAdim++;
    }
  }

  function update(dt, t) {
    if (demo && !kill && !failsafe) demoGuncelle(dt);
    if (mod === 'motor' && armed) motorTestT += dt; else motorTestT = 0;
    if (mod === 'kalib' && kalibK > 0 && kalibK < 1 && !armed) kalibK = Math.min(1, kalibK + dt / 12);
    if (soc < 0.15 && havada() && faz !== 'inis' && faz !== 'dusus') faz = 'inis';   // düşük pil → iniş
    if (failsafe && (havada() || faz === 'kalkis') && faz !== 'dusus') faz = 'inis';
    fizik(dt, t);
    motorlar(dt);
    pilGuncelle(dt);

    iha.position.set(PAD.x + s.x, 0.165 + s.y, PAD.z + s.z);
    iha.rotation.y = s.yaw;
    govde.rotation.set(s.roll, 0, s.pitch);
    // tether: yalnız bağlı hover modunda
    ip.visible = mod === 'hover' || mod === 'motor';
    if (ip.visible) {
      _v.set(iha.position.x, iha.position.y - 0.03, iha.position.z);
      const L = _v.distanceTo(ANKRAJ);
      ip.position.addVectors(_v, ANKRAJ).multiplyScalar(0.5);
      ip.scale.set(1, Math.max(0.01, L), 1);
      ip.quaternion.setFromUnitVectors(_Y, _v.sub(ANKRAJ).normalize());
    }
    // ledler: seyir ledleri yanıp söner, durum ledi mod rengi
    const blink = Math.sin(t * 6) > 0;
    ledOn.emissiveIntensity = armed ? (blink ? 2.4 : 0.3) : 0.3;
    ledArka.emissiveIntensity = armed ? (blink ? 0.3 : 2.4) : 0.3;
    ledDurum.color.set(kill ? 0xff3030 : failsafe ? 0xffb000 : mod === 'kalib' && kalibK < 1 && kalibK > 0 ? 0xffd400 : armed ? 0x2bdc5a : 0x2b8cff);
    ledDurum.emissive.copy(ledDurum.color);
    sarjEkran.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 2);

    if (!pilIs) { opS.rota.length = 0; opHedef(PILOT.x, PILOT.z, iha_yon(), 'on'); }
    opGuncelle(dt, t);

    const ort = (rpm[0] + rpm[1] + rpm[2] + rpm[3]) / 4;
    trend.ornekle(dt, [s.y * 10, akim, soc * 100]);
    const d = durumBilgi();
    if (ekranZ(dt)) {
      ekran.standart('Yer İstasyonu · Telemetri', [
        ['Mod', mod === 'motor' ? 'MOTOR TEST' : mod === 'hover' ? 'ALT_HOLD (bağlı)' : mod === 'kalib' ? 'KALİBRASYON' : `LOITER · WP ${wpI + 1}/4`],
        ['Durum', kill ? 'KILL' : armed ? 'ARMED' : 'DISARMED'],
        ['İrtifa', `${fmt(s.y, 2)} m`],
        ['Pil', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
        ['Akım / RPM', `${fmt(akim, 1)} A · ${fmt(ort, 0)}`],
        ['Roll / Pitch', `${fmt((s.roll * 180) / Math.PI, 1)}° / ${fmt((-s.pitch * 180) / Math.PI, 1)}°`],
      ], d);
    }
  }
  const _Y = V(0, 1, 0);

  function durumBilgi() {
    if (kill) return { metin: havada() || faz === 'dusus' ? 'KILL · MOTORLAR KESİK · DÜŞÜŞ' : 'KILL · MOTORLAR KESİK', seviye: 'alarm' };
    if (failsafe) return { metin: havada() ? 'FAILSAFE · BAĞLANTI YOK · OTOMATİK İNİŞ' : 'FAILSAFE · BAĞLANTI YOK', seviye: 'uyari' };
    if (soc < 0.15) return { metin: `PİL ZAYIF · %${fmt(soc * 100, 0)}`, seviye: 'uyari' };
    if (pilIs) return { metin: 'PİL DEĞİŞİMİ', seviye: 'bekliyor' };
    if (mod === 'kalib' && kalibK > 0 && kalibK < 1) return { metin: `KALİBRASYON · %${fmt(kalibK * 100, 0)}`, seviye: 'calisiyor' };
    if (faz === 'kalkis') return { metin: 'KALKIŞ', seviye: 'calisiyor' };
    if (faz === 'inis') return { metin: 'İNİŞ', seviye: 'calisiyor' };
    if (faz === 'havada') return { metin: mod === 'rota' ? `ROTA · WP ${wpI + 1}/4 · ${fmt(s.y, 1)} m` : `BAĞLI HOVER · ${fmt(s.y, 2)} m`, seviye: 'calisiyor' };
    if (armed && mod === 'motor') return { metin: `MOTOR TESTİ · ${Math.floor(motorTestT / 1.6) < 4 ? 'M' + (Math.floor(motorTestT / 1.6) + 1) : 'HEPSİ'}`, seviye: 'calisiyor' };
    if (armed) return { metin: 'ARMED · YERDE', seviye: 'uyari' };
    return { metin: mod === 'kalib' && kalibK >= 1 ? 'KALİBRASYON TAMAM · DISARMED' : 'DISARMED · HAZIR', seviye: 'bekliyor' };
  }

  const elle = () => { demo = false; };
  const kontroller = [
    { tip: 'secim', metin: 'Uçuş modu', secenekler: Object.entries(MODLAR), get: () => mod,
      set: (v) => { if (havada()) return; mod = v; elle(); if (v === 'kalib') kalibK = 0.001; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'ARM', tur: 'basla', tik: () => { elle(); arm(); } },
      { metin: 'DISARM', tur: 'dur', tik: () => { elle(); disarm(); } },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Kalkış', tik: () => { elle(); kalkis(); } },
      { metin: 'İniş', tik: () => { elle(); inis(); } },
      { metin: 'Pil değiştir', tik: () => { elle(); if (!armed && !pilIs) pilIs = { faz: 0, k: 0 }; } },
    ] },
    { tip: 'kaydirici', metin: 'Gaz / hover irtifası', min: 0, max: 100, adim: 5, birim: '%', get: () => gaz, set: (v) => (gaz = v) },
    { tip: 'anahtar', metin: 'Otomatik demo (test sırası)', get: () => demo, set: (v) => { demo = v; demoT = 0; demoGuncelle.sure = 0; } },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'anahtar', metin: 'Bağlantı kaybı (failsafe testi)', get: () => failsafe, set: (v) => { failsafe = v; elle(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'KILL (motor kes)', tur: 'acil', tik: () => { kill = true; armed = false; if (havada()) faz = 'dusus'; elle(); } },
      { metin: 'Reset', tik: () => { if (!havada()) { kill = false; faz = 'yerde'; } } },
    ] },
  ];

  return {
    id: 'iha',
    ad: 'Üniversite İHA Projesi',
    altBaslik: 'Temsili · X-quad · bağlı hover',
    kisa: 'Üniversitede katkı verdiğim insansız hava aracı projelerinin temsili modeli: ağ kafes içinde ≈1 m sınıfı X-quad (15" pervane), yer istasyonu telemetrisi ve pilot. Motor testi, bağlı (tether) hover, pusula/IMU kalibrasyonu ve kafes içi rota uçuşu; bağlantı kaybında otomatik iniş (failsafe) ve KILL ile motor kesme.',
    proje: 'personal-projects',
    ayakIzi: [9.4, 7.8],
    ayakIziMerkez: [-0.1, -0.1],
    kamera: { poz: [1.9, 2.4, 5.9], hedef: [0.5, 1.05, -0.55] },
    mekanizmalar: [
      'Dört motor/pervane: devir gaza ve uçuş fazına göre; düşük devirde pal görünür, yüksekte bulanık disk',
      'Bağlı hover: turuncu tether ipi çapadan araca uzanır; irtifa gaz kaydırıcısıyla 0.5–2 m',
      'Kafes içi rota: 4 waypoint arasında burun gidiş yönüne döner, ivmeye göre yatar/yunuslar',
      'Motor testi: M1→M4 sırayla, sonra hepsi birlikte',
      'Kalibrasyon: araç pedde yavaşça tam tur döner, durum ledi sarı',
      'Failsafe: bağlantı kesilince otomatik iniş; KILL: motorlar anında durur, havadaysa düşer',
      'Pilot RC kumandayla aracı izler; pil değişiminde şarj masasından yedek LiPo\'yu getirir',
    ],
    cikarim: [
      'TEMSİLİ: İHA\'nın tipi ve ölçüleri elimizde yok. CV\'deki "insansız hava aracı projelerine katkı" bilgisinden yola çıkıldı.',
      'Kafes içinde güvenli test edilebilen ve iyi canlanan ≈1 m sınıfı X-quad seçildi; sabit kanat ya da VTOL istenirse değiştirilebilir.',
      'Değerler tipik 6S 10 Ah LiPo, 15" pervane ve ≈5 kg kalkış ağırlığına göre: hover ≈ 4300 rpm, ≈ 45 A.',
      'Pil tüketimi gösterim için ×8 hızlandırıldı (hover ≈ 12 dk → ≈ 90 s).',
    ],
    group: g,
    sabitHaric: [iha, ip, yedekPil, sarjEkran],
    update,
    kontroller,
    degerler: () => {
      const ort = (rpm[0] + rpm[1] + rpm[2] + rpm[3]) / 4;
      return [
        ['Mod', MODLAR[mod]],
        ['Durum', kill ? 'KILL' : armed ? 'ARMED' : 'DISARMED'],
        ['İrtifa', `${fmt(s.y, 2)} m`],
        ['Pil (6S)', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
        ['Akım', `${fmt(akim, 1)} A`],
        ['Motor devri (ort.)', `${fmt(ort, 0)} rpm`],
        ['IMU roll / pitch / yaw', `${fmt((s.roll * 180) / Math.PI, 1)}° / ${fmt((-s.pitch * 180) / Math.PI, 1)}° / ${fmt((((s.yaw * 180) / Math.PI) % 360 + 360) % 360, 0)}°`],
        ['Bağlantı', failsafe ? 'YOK (failsafe)' : 'telemetri + RC'],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
