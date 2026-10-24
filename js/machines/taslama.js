// js/machines/taslama.js — Yüzey Taşlama Makinesi (retrofit).
//
// Kaan'ın galerisinden: MKN-V09 (kırmızı-krem yüzey taşlama: manyetik tabla,
// koruyuculu taş kafası, el çarkları, "STOP" plakalı gövde) + MKN-F08
// (DOPSoft "TaşlamaHMI": Otomatik, Manyetik, Taşlama, Su, Hidrolik Pompa,
// Çevrim, Yağ, Hata Lambası, Finish/Dalma Tur Sayısı, Dalma Oranı).
// Eski makineye PLC + Delta HMI ile otomatik dalma → finish çevrimi eklenmiş.
//
// Hareketler: tabla X'te hidrolik salınır, her terste çapraz kızak (Z) bir adım
// besler; Z'de bir tam süpürme = 1 tur. Dalma turlarında her tur sonunda taş
// "dalma oranı" kadar iner; ardından dalmasız finish turları. Talaş görseli
// OLCEK kadar abartılır (0.02 mm gözle görülmez).

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, pano, canvasTex, levha,
    clamp, approach, damp, lerp, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const krem = mat(0xd8ceb2, { r: 0.65, m: 0.1, key: 'taslama-krem' });
  const koyuKrem = mat(0xb6ab8f, { r: 0.65, m: 0.1, key: 'taslama-koyukrem' });
  const kirmizi = mat(0x9e1b1f, { r: 0.5, m: 0.2, key: 'taslama-kirmizi' });

  // ---------------------------------------------------------------- ölçüler
  const GY = 0.85;            // gövde üstü
  const KY = GY + 0.12;       // çapraz kızak üstü
  const TY = KY + 0.12;       // tabla üstü
  const MY = TY + 0.06;       // manyetik tabla üstü
  const PK = 0.035;           // iş parçası kalınlığı
  const PL = 0.42, PW = 0.22; // iş parçası boy/en
  const PX = 0.1;             // parçanın tabla üstündeki x ofseti
  const R = 0.18;             // taş yarıçapı
  const XS = 0.42, ZS = 0.09; // tabla / çapraz strok yarıları
  const ADIM = 4;             // bir turdaki çapraz besleme adımı (gösterim için seyrek)
  const OLCEK = 60;           // talaş görsel abartması (mm → m × OLCEK/1000)

  // ---------------------------------------------------------------- gövde
  box(2.35, 0.08, 1.25, M.koyu, 0, 0.04, 0.05, g);
  box(2.3, GY - 0.08, 1.2, krem, 0, 0.08 + (GY - 0.08) / 2, 0.05, g);
  box(2.32, 0.03, 1.22, koyuKrem, 0, GY - 0.015, 0.05, g);
  box(0.7, 0.42, 0.18, krem, -0.75, 0.56, 0.72, g);                 // ön kumanda çıkıntısı
  const cark = (x, y, z, r) => {
    const c = new THREE.Group();
    c.position.set(x, y, z);
    g.add(c);
    cyl(r, 0.03, M.siyah, 0, 0, 0, c, { eksen: 'z', seg: 26 });
    cyl(r * 0.28, 0.05, M.krom, 0, 0, 0.02, c, { eksen: 'z', seg: 14 });
    cyl(0.012, 0.08, M.siyah, r * 0.72, 0, 0.05, c, { eksen: 'z', seg: 8 });
    return c;
  };
  const carkTabla = cark(-0.95, 0.62, 0.83, 0.12);
  const carkCapraz = cark(-0.58, 0.44, 0.83, 0.085);
  for (const [x, y] of [[-0.72, 0.7], [-0.58, 0.7], [-0.44, 0.7], [-0.8, 0.46]]) cyl(0.026, 0.04, M.siyah, x, y, 0.83, g, { eksen: 'z', seg: 14 });
  const stop = levha(['STOP'], 0.14, 0.05, { bg: '#c7c9c4', fg: '#222', font: 70, px: 256 });
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(-0.2, GY + 0.002, 0.6);
  g.add(stop);
  // kızak körükleri (sabit)
  box(0.95, 0.05, 0.22, M.koyu, 0, GY + 0.025, 0.6, g);
  box(0.95, 0.05, 0.18, M.koyu, 0, GY + 0.025, -0.48, g);

  // ---------------------------------------------------------------- çapraz kızak (Z) + tabla (X)
  const kizak = new THREE.Group();
  g.add(kizak);
  box(1.05, 0.12, 0.8, koyuKrem, 0, GY + 0.06, 0, kizak);
  const tabla = new THREE.Group();
  kizak.add(tabla);
  box(1.75, 0.12, 0.55, kirmizi, 0, KY + 0.06, 0, tabla);
  for (const sx of [-1, 1]) box(0.04, 0.16, 0.55, kirmizi, sx * 0.86, TY + 0.06, 0, tabla);     // uç sıçrama siperleri
  for (const sz of [-1, 1]) box(1.72, 0.05, 0.02, kirmizi, 0, TY + 0.025, sz * 0.27, tabla);
  const chuckTex = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#8b949c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#596168'; for (let i = 0; i < w; i += 10) x.fillRect(i, 0, 3, h);
  });
  box(1.3, 0.06, 0.44, new THREE.MeshStandardMaterial({ map: chuckTex, roughness: 0.4, metalness: 0.8 }), 0, TY + 0.03, 0, tabla);
  const parcaMat = new THREE.MeshStandardMaterial({ color: 0x5f656b, roughness: 0.8, metalness: 0.85 });
  const parca = box(PL, PK, PW, parcaMat, PX, MY + PK / 2, 0, tabla);

  // ---------------------------------------------------------------- kolon + taş kafası (dalma: Y)
  box(0.6, 1.45, 0.5, krem, 0, GY + 0.725, -0.6, g);
  box(0.62, 0.08, 0.52, kirmizi, 0, GY + 1.47, -0.6, g);
  box(0.14, 1.2, 0.03, M.koyu, 0, GY + 0.7, -0.335, g);              // dikey kızak körüğü
  const kafa = new THREE.Group();
  g.add(kafa);
  box(0.44, 0.36, 0.5, kirmizi, 0, 0.06, -0.33, kafa);
  box(0.3, 0.14, 0.24, krem, 0, 0.3, -0.42, kafa);                   // motor kapağı
  cyl(0.06, 0.2, M.koyu, 0, 0, -0.07, kafa, { eksen: 'z', seg: 16 }); // iş mili yuvası
  const korGeo = new THREE.CylinderGeometry(R + 0.035, R + 0.035, 0.1, 28, 1, false, Math.PI / 2, Math.PI);
  korGeo.rotateX(Math.PI / 2);                                       // üst yarım koruyucu
  const koruyucu = new THREE.Mesh(korGeo, kirmizi);
  koruyucu.castShadow = true;
  koruyucu.position.z = 0.02;
  kafa.add(koruyucu);
  box(0.16, 0.09, 0.005, M.beyaz, 0, 0.12, 0.074, kafa);             // etiket plakası
  const tasTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#9b9a93'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#64635d'; x.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2); x.stroke();
    }
  });
  const tas = new THREE.Group();
  tas.position.z = 0.02;
  kafa.add(tas);
  cyl(R, 0.05, new THREE.MeshStandardMaterial({ map: tasTex, roughness: 0.9 }), 0, 0, 0, tas, { eksen: 'z', seg: 32 });
  cyl(0.05, 0.07, M.celik, 0, 0, 0, tas, { eksen: 'z', seg: 16 });
  // soğutma suyu nozulu + su akışı
  rod([0.2, 0.08, 0.12], [0.2, -0.08, 0.12], 0.012, M.siyah, kafa);
  rod([0.2, -0.08, 0.12], [0.1, -0.15, 0.09], 0.012, M.siyah, kafa);
  const suMat = new THREE.MeshStandardMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
  const suAkis = rod([0.1, -0.15, 0.09], [0.035, -R + 0.01, 0.04], 0.008, suMat, kafa);
  suAkis.castShadow = false;

  // ---------------------------------------------------------------- kıvılcım
  const KN = 90;
  const kPos = new Float32Array(KN * 3).fill(-10), kHiz = new Float32Array(KN * 3), kOmur = new Float32Array(KN);
  const kGeo = new THREE.BufferGeometry();
  kGeo.setAttribute('position', new THREE.BufferAttribute(kPos, 3));
  const kivilcim = new THREE.Points(kGeo, new THREE.PointsMaterial({
    color: 0xffb347, size: 0.018, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  kivilcim.frustumCulled = false;
  g.add(kivilcim);
  let kSira = 0;

  // ---------------------------------------------------------------- retrofit panosu + HMI
  const PNX = 1.62, PNZ = 0.32;
  pano(g, PNX, 0, PNZ, 0.65, 1.7, 0.38, 0);
  const ekran = new Ekran(0.38, 0.23, 640);
  ekran.mesh.position.set(PNX, 1.3, PNZ + 0.21);
  g.add(ekran.mesh);
  box(0.42, 0.27, 0.02, M.siyah, PNX, 1.3, PNZ + 0.195, g);
  acilStop(g, PNX - 0.2, 0.95, PNZ + 0.2, 0);
  const kule = kuleLambasi(g, PNX + 0.22, 1.7, PNZ);
  rod([PNX - 0.3, 0.2, PNZ - 0.1], [1.15, 0.2, PNZ - 0.1], 0.02, M.siyah, g);

  // ---------------------------------------------------------------- parça rafı (ham / taşlanmış) + operatör
  // Parça değişiminde operatör taşlanmış parçayı manyetik tabladan alır, rafa koyar, ham
  // parçayı alıp tablaya yerleştirir; makine "parça değişimi" adımında onu bekler.
  // Taşlama sırasında panonun önünde HMI'ya bakar.
  const RAF = { x: -1.8, z: 0.25 }, RAF_Y = 0.8;
  box(0.56, 0.04, 0.62, M.gri, RAF.x, RAF_Y - 0.02, RAF.z, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, RAF_Y - 0.04, 0.04, M.koyu, RAF.x + sx * 0.25, (RAF_Y - 0.04) / 2, RAF.z + sz * 0.28, g);
  box(0.5, 0.03, 0.56, M.gri, RAF.x, 0.2, RAF.z, g);
  const hamMat = new THREE.MeshStandardMaterial({ color: 0x5f656b, roughness: 0.8, metalness: 0.85 });
  const bitmisMat = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, roughness: 0.12, metalness: 0.9 });
  const yigin = (z, m) => Array.from({ length: 6 }, (_, i) => {
    const p = box(PL, PK, PW, m, RAF.x, RAF_Y + PK / 2 + i * (PK + 0.003), z, g);
    return p;
  });
  const hamYigin = yigin(RAF.z + 0.15, hamMat), bitmisYigin = yigin(RAF.z - 0.15, bitmisMat);
  let hamSay = 5, bitmisSay = 3;
  const yiginCiz = () => {
    hamYigin.forEach((p, i) => (p.visible = i < hamSay));
    bitmisYigin.forEach((p, i) => (p.visible = i < bitmisSay));
  };
  yiginCiz();
  const op = lib.operator({ yelek: 0xff7a1a });
  g.add(op.group);
  const tasinan = box(PL, PK, PW, bitmisMat, 0, 1.03, 0.47, op.group);    // iki el arasında
  tasinan.visible = false;
  // izleme yeri panonun sağ önünde (varsayılan kamerada HMI'yı ve tablayı kapatmasın)
  const LANE = 1.15, TABLA_Z = 1.0;
  const IZLE = { x: 2.1, z: 0.95, bx: PNX, bz: PNZ + 0.21 };
  const RAF_DUR = { x: RAF.x, z: 0.92 };
  const opD = { x: IZLE.x, z: IZLE.z, yon: Math.PI, f: 'izle', t: 0, yol: [], bx: IZLE.bx, bz: IZLE.bz };
  let opBitti = false;
  const aciFark = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  // hedefe yol: x değişiyorsa önce koridor şeridine (LANE) çık, şeritte ilerle, sonra hedefe in
  function opGit(x, z, bx, bz) {
    opD.yol.length = 0;
    if (Math.abs(x - opD.x) > 0.3) { opD.yol.push([opD.x, LANE], [x, LANE]); }
    opD.yol.push([x, z]);
    opD.bx = bx; opD.bz = bz;
  }
  function yeniParca() {
    kaldirilan = 0; dalmaYapilan = 0; finishYapilan = 0; parcaSay++;
    sonCevrim = cevrimT;
  }

  // ---------------------------------------------------------------- durum
  let mod = 'oto';            // oto | man
  let durum = 'calisiyor';    // calisiyor | durdu | acil | alarm
  let alarmMetin = '';
  let faz = 'yaklas';         // yaklas | dalma | finish | cik | demag | degis
  let fazT = 0;
  let manyetik = true, tasMotor = true, su = true, hidrolik = true;
  let dalmaOrani = 0.02, dalmaTur = 5, finishTur = 2, tablaHiz = 20; // mm/tur, adet, adet, m/dk
  let tablaX = -0.2, tablaYon = 1, caprazZ = -ZS, caprazYon = 1;
  let bosluk = 0.05;          // taş altı ile yüzey arası (m)
  let kaldirilan = 0;         // mm (gerçek)
  let dalmaYapilan = 0, finishYapilan = 0, parcaSay = 41, cevrimT = 0, sonCevrim = 0;
  let tasHiz = 0, tasAci = 0;
  let temas = false;
  const jog = { x: 0, z: 0, y: 0 };

  const yuzey = () => MY + PK - Math.min(0.022, (kaldirilan / 1000) * OLCEK);
  const ilerleme = () => clamp((dalmaYapilan + finishYapilan * 1.5) / Math.max(1, dalmaTur + finishTur * 1.5), 0, 1);
  const ra = () => lerp(3.2, 0.4, ilerleme());
  const gec = (f) => { faz = f; fazT = 0; };
  const taslamaFazi = () => faz === 'dalma' || faz === 'finish';

  function turBitti() {
    if (!temasVar()) return;
    if (faz === 'dalma') {
      dalmaYapilan++; kaldirilan += dalmaOrani;
      if (dalmaYapilan >= dalmaTur) gec('finish');
    } else if (faz === 'finish') {
      finishYapilan++;
      if (finishYapilan >= finishTur) gec('cik');
    }
  }
  const temasVar = () => bosluk < 0.002;
  function ters() {
    caprazZ += caprazYon * ((2 * ZS) / ADIM);
    if (caprazZ >= ZS - 1e-6 || caprazZ <= -ZS + 1e-6) {
      caprazZ = clamp(caprazZ, -ZS, ZS);
      caprazYon *= -1;
      if (mod === 'oto') turBitti();
    }
  }
  function tablaSur(dt) {
    tablaX += (tablaYon * tablaHiz * dt) / 60;
    if (tablaX > XS) { tablaX = XS; tablaYon = -1; ters(); }
    else if (tablaX < -XS) { tablaX = -XS; tablaYon = 1; ters(); }
  }

  function otoCevrim(dt) {
    fazT += dt;
    const masaHareket = hidrolik && manyetik && (faz === 'yaklas' || ((faz === 'dalma' || faz === 'finish') && tasMotor));
    if (masaHareket) tablaSur(dt);
    if (faz === 'yaklas') {
      if (manyetik && tasMotor) bosluk = approach(bosluk, 0, 0.035 * dt);
      if (bosluk <= 0) { dalmaYapilan = 0; finishYapilan = 0; cevrimT = 0; gec('dalma'); }
    } else if (faz === 'cik') {
      bosluk = approach(bosluk, 0.05, 0.08 * dt);
      if (bosluk >= 0.05) gec('demag');
    } else if (faz === 'demag') {
      manyetik = false;
      if (fazT > 1.0) gec('degis');
    } else if (faz === 'degis') {
      // operatör taşlanmış parçayı alıp ham parçayı koyunca (opBitti) manyetik tutar, yeni çevrim
      if (opBitti) { opBitti = false; manyetik = true; gec('yaklas'); }
    }
    if (taslamaFazi()) cevrimT += dt;
  }

  function manuelSur(dt) {
    if (hidrolik && jog.x) { tablaX = clamp(tablaX + (jog.x * tablaHiz * dt) / 60, -XS, XS); }
    if (jog.z) caprazZ = clamp(caprazZ + jog.z * 0.05 * dt, -ZS, ZS);
    if (jog.y) bosluk = clamp(bosluk + jog.y * 0.03 * dt, 0, 0.12);
  }

  function kivilcimGuncelle(dt, uc) {
    if (temas) {
      const n = Math.ceil(dt * 260);
      for (let i = 0; i < n; i++) {
        const j = kSira++ % KN;
        kPos[j * 3] = uc.x; kPos[j * 3 + 1] = uc.y; kPos[j * 3 + 2] = uc.z + gurultu(0.02);
        kHiz[j * 3] = -(0.8 + Math.random() * 1.8); kHiz[j * 3 + 1] = Math.random() * 0.9; kHiz[j * 3 + 2] = gurultu(0.5);
        kOmur[j] = 0.15 + Math.random() * 0.3;
      }
    }
    for (let j = 0; j < KN; j++) {
      if (kOmur[j] <= 0) continue;
      kOmur[j] -= dt;
      kHiz[j * 3 + 1] -= 9.8 * dt;
      kPos[j * 3] += kHiz[j * 3] * dt; kPos[j * 3 + 1] += kHiz[j * 3 + 1] * dt; kPos[j * 3 + 2] += kHiz[j * 3 + 2] * dt;
      if (kOmur[j] <= 0) kPos[j * 3 + 1] = -10;
    }
    kGeo.attributes.position.needsUpdate = true;
  }

  const trend = new Trend([{ ad: 'Tabla X (mm)', renk: '#39c5cf' }, { ad: 'Talaş (µm)', renk: '#f2c200' }], { min: -450, max: 450, uzunluk: 300 });
  const ekranZ = throttle(5);
  const _uc = new THREE.Vector3();

  function update(dt, t) {
    if (durum === 'calisiyor') {
      if (mod === 'oto') {
        if (!manyetik && taslamaFazi()) { durum = 'alarm'; alarmMetin = 'MANYETİK KAPALI · TAŞLAMA DURDU'; }
        else otoCevrim(dt);
      } else manuelSur(dt);
    }
    if (durum === 'acil' || durum === 'alarm') bosluk = approach(bosluk, 0.05, 0.1 * dt);

    tasHiz = damp(tasHiz, tasMotor && durum !== 'acil' ? 60 : 0, 1.5, dt);
    tasAci -= tasHiz * dt;
    tas.rotation.z = tasAci;

    // poz: kızak Z, tabla X, kafa Y
    kizak.position.z = caprazZ;
    tabla.position.x = tablaX;
    const yz = yuzey();
    kafa.position.set(0, yz + bosluk + R, 0);
    parca.scale.y = (yz - MY) / PK;
    parca.position.y = MY + (yz - MY) / 2;
    const p = ilerleme();
    parcaMat.roughness = lerp(0.8, 0.12, p);
    parcaMat.color.setHex(0x5f656b).lerp(_renkParlak, p);
    carkTabla.rotation.z = tablaX * 9;
    carkCapraz.rotation.z = caprazZ * 40;

    const uzerinde = Math.abs(tablaX + PX) < PL / 2 + 0.02;
    temas = tasHiz > 20 && bosluk < 0.002 && uzerinde && durum === 'calisiyor';
    kivilcimGuncelle(dt, _uc.set(-0.03, yz + 0.002, 0.02));
    suAkis.visible = su && tasHiz > 5 && durum !== 'acil';
    operatorGuncelle(dt, t);

    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [tablaX * 1000, kaldirilan * 1000]);
    if (ekranZ(dt)) ekran.ciz((x, W, H) => hmiCiz(x, W, H, d, t));
  }
  const _renkParlak = new THREE.Color(0xc9cfd5);

  // Performans (lib.sabitle): hareket eden / görünürlüğü değişen nesneler + gizli düğümler
  // (altındaki görünür mesh'ler birleşirse görünür olur) + saydam mesh'ler (sıralama) birleştirilmez.
  const sabitHaric = () => {
    const h = [kizak, kafa, carkTabla, carkCapraz, ...hamYigin, ...bitmisYigin];
    g.traverse((o) => { if (!o.visible || (o.isMesh && !Array.isArray(o.material) && o.material.transparent)) h.push(o); });
    return h;
  };

  const OP_AD = {
    izle: 'HMI\'yı izliyor', tablaya: 'tablaya gidiyor', al: 'taşlanmış parçayı alıyor', rafa: 'parçayı rafa götürüyor',
    raf: 'rafa bırakıp ham parça alıyor', tablaya2: 'ham parçayı getiriyor', koy: 'parçayı tablaya koyuyor', izleye: 'panoya dönüyor',
  };
  // ---------------------------------------------------------------- operatör durum makinesi
  // izle → (demag/değişim) tablaya → al → rafa → raf (bırak + ham al) → tablaya → koy → izle
  function operatorGuncelle(dt, t) {
    const parcaX = tablaX + PX;
    let poz = 'yan';
    if (durum !== 'acil') {
      opD.t += dt;
      const vardi = opD.yol.length === 0;
      switch (opD.f) {
        case 'izle':
          poz = 'yan';
          if (mod === 'oto' && (faz === 'demag' || faz === 'degis')) { opD.f = 'tablaya'; opGit(parcaX, TABLA_Z, parcaX, caprazZ); }
          break;
        case 'tablaya':
          poz = 'yan';
          if (vardi && faz === 'degis') { opD.f = 'al'; opD.t = 0; }
          break;
        case 'al':
          poz = 'on';
          if (opD.t > 0.8) {
            parca.visible = false; tasinan.material = bitmisMat; tasinan.visible = true;
            opD.f = 'rafa'; opGit(RAF_DUR.x, RAF_DUR.z, RAF.x, RAF.z);
          }
          break;
        case 'rafa':
          poz = 'tasi';
          if (vardi) { opD.f = 'raf'; opD.t = 0; }
          break;
        case 'raf':
          poz = 'on';
          if (opD.t > 0.5 && tasinan.material === bitmisMat) {
            bitmisSay = bitmisSay >= 6 ? 1 : bitmisSay + 1;          // dolu yığın forkliftle alındı (varsayım)
            hamSay = hamSay <= 0 ? 5 : hamSay - 1;                    // ham yığın bitince yenilenir
            yiginCiz();
            tasinan.material = hamMat;
          }
          if (opD.t > 1.1) { opD.f = 'tablaya2'; opGit(parcaX, TABLA_Z, parcaX, caprazZ); }
          break;
        case 'tablaya2':
          poz = 'tasi';
          if (vardi) { opD.f = 'koy'; opD.t = 0; }
          break;
        case 'koy':
          poz = 'on';
          if (opD.t > 0.8) {
            tasinan.visible = false; parca.visible = true;
            yeniParca(); opBitti = true;
            opD.f = 'izleye'; opGit(IZLE.x, IZLE.z, IZLE.bx, IZLE.bz);
          }
          break;
        case 'izleye':
          poz = 'yan';
          if (vardi) opD.f = 'izle';
          break;
        default: break;
      }
    }
    // yol izleme
    let yuruyor = false, hedefYon = Math.atan2(opD.bx - opD.x, opD.bz - opD.z);
    if (opD.yol.length && durum !== 'acil') {
      const [hx, hz] = opD.yol[0];
      const ddx = hx - opD.x, ddz = hz - opD.z, dd = Math.hypot(ddx, ddz);
      if (dd < 0.02) { opD.x = hx; opD.z = hz; opD.yol.shift(); }
      else {
        const s = Math.min(dd, 1.1 * dt) / dd;
        opD.x += ddx * s; opD.z += ddz * s; yuruyor = true;
        if (dd > 0.15) hedefYon = Math.atan2(ddx, ddz);
      }
    }
    opD.yon += aciFark(hedefYon, opD.yon) * (1 - Math.exp(-7 * dt));
    op.poz(poz);
    const zip = op.yuru(t, yuruyor);
    op.group.position.set(opD.x, zip, opD.z);
    op.group.rotation.y = opD.yon;
  }

  // ---------------------------------------------------------------- HMI ("TaşlamaHMI" düzeni)
  function hmiCiz(x, W, H, d, t) {
    x.fillStyle = '#fcfcfc'; x.fillRect(0, 0, W, H);
    const yaz = (s, px, py, size, renk = '#111', kalin = 600, hiza = 'center') => {
      x.fillStyle = renk; x.font = `${kalin} ${size}px "Space Grotesk", sans-serif`;
      x.textAlign = hiza; x.textBaseline = 'middle'; x.fillText(s, px, py);
    };
    const kutu = (px, py, w, h, dolgu, cizgi = '#333') => {
      x.fillStyle = dolgu; x.fillRect(px, py, w, h);
      x.strokeStyle = cizgi; x.lineWidth = 2; x.strokeRect(px, py, w, h);
    };
    const KW = 104, KH = 66, X0 = 14, DX = 122;
    const etiket = (s, cx, y) => { kutu(cx - 52, y, 104, 22, '#fff', '#555'); yaz(s, cx, y + 11, 13, '#111', 700); };
    const hataVar = durum === 'alarm' || durum === 'acil';
    // 1. sıra: Otomatik, Manyetik, Taşlama, Su
    const ikon = (i, satir, etk, on, ciz) => {
      const cx = X0 + i * DX + KW / 2, y0 = 12 + satir * 118;
      x.setLineDash([4, 3]); x.strokeStyle = '#777'; x.lineWidth = 1.5; x.strokeRect(cx - KW / 2, y0, KW, KH); x.setLineDash([]);
      ciz(cx, y0 + KH / 2, on);
      etiket(etk, cx, y0 + KH + 6);
    };
    ikon(0, 0, mod === 'oto' ? 'Otomatik' : 'Manuel', true, (cx, cy) => {
      kutu(cx - 46, cy - 24, 92, 48, mod === 'oto' ? '#e8262a' : '#7a8088', '#fff');
      yaz(mod === 'oto' ? 'AUTO' : 'MAN', cx, cy + 1, 26, '#fff', 800);
    });
    ikon(1, 0, 'Manyetik', manyetik, (cx, cy, on) => {
      x.lineWidth = 14; x.strokeStyle = on ? '#d62a2a' : '#bbb';
      x.beginPath(); x.arc(cx, cy - 4, 18, Math.PI * 0.15, Math.PI * 1.15); x.stroke();
      x.fillStyle = on ? '#9aa3ab' : '#ddd'; x.fillRect(cx + 4, cy - 26, 14, 10);
    });
    ikon(2, 0, 'Taşlama', tasMotor, (cx, cy, on) => {
      x.fillStyle = on ? '#3b3d40' : '#bbb'; x.beginPath(); x.arc(cx, cy, 26, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 9, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(tasAci) * 24, cy + Math.sin(tasAci) * 24); x.stroke();
    });
    ikon(3, 0, 'Su', su, (cx, cy, on) => {
      x.fillStyle = on ? '#1f8fe0' : '#bbb';
      x.beginPath(); x.moveTo(cx, cy - 26); x.quadraticCurveTo(cx + 22, cy + 4, cx, cy + 22); x.quadraticCurveTo(cx - 22, cy + 4, cx, cy - 26); x.fill();
    });
    // 2. sıra: Hidrolik pompa, Çevrim, Yağ
    ikon(0, 1, 'Hidrolik Pompa', hidrolik, (cx, cy, on) => {
      kutu(cx - 30, cy - 22, 60, 44, on ? '#5b4fa3' : '#bbb', '#222');
      x.fillStyle = on ? '#f2c200' : '#999'; x.beginPath(); x.arc(cx, cy, 12, 0, Math.PI * 2); x.fill();
    });
    ikon(1, 1, 'Çevrim', mod === 'oto' && durum === 'calisiyor', (cx, cy, on) => {
      x.lineWidth = 8; x.strokeStyle = on ? '#e8262a' : '#bbb';
      const a = on ? t * 3 : 0;
      x.beginPath(); x.arc(cx, cy, 20, a, a + Math.PI * 0.8); x.stroke();
      x.beginPath(); x.arc(cx, cy, 20, a + Math.PI, a + Math.PI * 1.8); x.stroke();
    });
    ikon(2, 1, 'Yağ', hidrolik, (cx, cy, on) => {
      x.fillStyle = on ? '#3b3d40' : '#bbb'; x.fillRect(cx - 14, cy - 8, 28, 28);
      x.strokeStyle = on ? '#3b3d40' : '#bbb'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx + 14, cy - 4); x.lineTo(cx + 30, cy - 18); x.stroke();
      x.fillStyle = '#fff'; yaz('ö', cx, cy + 6, 16, '#fff', 800);
    });
    // sağ sütun: tarih/saat, hata lambası, doka
    const sx = X0 + 4 * DX - 6;
    kutu(sx, 12, 118, 30, '#fff', '#777'); yaz('24/10/26', sx + 59, 27, 14, '#222', 600);
    kutu(sx, 46, 118, 30, '#fff', '#777'); yaz(`${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`, sx + 59, 61, 14, '#222', 600);
    const yan = hataVar && Math.sin(t * 9) > 0;
    x.fillStyle = yan ? '#ff3b1f' : '#d9d9d9'; x.beginPath(); x.arc(sx + 59, 104, 20, Math.PI, 0); x.fill();
    x.fillRect(sx + 35, 104, 48, 10);
    etiket('HATA LAMBASI', sx + 59, 124);
    kutu(sx, 160, 118, 40, '#1b1b1b', '#000'); lib.dokaLogo(x, sx + 59, 180, 30, '#fff');
    // 3. sıra: sayaçlar
    const sayac = (i, etk, deger, yesil) => {
      const cx = X0 + i * DX + KW / 2 + (i === 2 ? 6 : 0), y0 = 252;
      etiket(etk, cx, y0);
      kutu(cx - 56, y0 + 28, 112, 46, yesil ? '#22d34a' : '#fff', '#333');
      yaz(deger, cx, y0 + 51, 20, '#111', 800);
    };
    sayac(0, 'Finish Tur', `${finishYapilan}/${finishTur}`, true);
    sayac(1, 'Dalma Tur', `${dalmaYapilan}/${dalmaTur}`, true);
    sayac(2, 'Dalma Oranı', `${fmt(dalmaOrani, 3)}`, false);
    // durum çubuğu
    const renk = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#e5302a', bekliyor: '#6e7681' }[d.seviye];
    x.fillStyle = renk; x.fillRect(0, H - 30, W, 30);
    yaz(d.metin, W / 2, H - 15, 15, '#fff', 700);
  }

  // ---------------------------------------------------------------- durum + arayüz
  const FAZ_AD = { yaklas: 'Taş yaklaşıyor', dalma: 'Dalma', finish: 'Finish', cik: 'Taş kalkıyor', demag: 'Manyetik bırakıyor', degis: 'Parça değişimi' };
  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'alarm') return { metin: alarmMetin, seviye: 'alarm' };
    if (durum === 'durdu') return { metin: 'HAZIR', seviye: 'bekliyor' };
    if (!hidrolik) return { metin: 'HİDROLİK POMPA KAPALI · TABLA DURDU', seviye: 'uyari' };
    if (!tasMotor && (mod === 'man' || taslamaFazi() || faz === 'yaklas')) return { metin: 'TAŞ MOTORU KAPALI', seviye: 'uyari' };
    if (!su && temas) return { metin: 'SOĞUTMA SUYU KAPALI', seviye: 'uyari' };
    if (mod === 'man') return { metin: temas ? 'MANUEL · TAŞLIYOR' : 'MANUEL', seviye: temas ? 'calisiyor' : 'bekliyor' };
    if (faz === 'dalma') return { metin: `OTOMATİK · DALMA ${dalmaYapilan + 1}/${dalmaTur}`, seviye: 'calisiyor' };
    if (faz === 'finish') return { metin: `OTOMATİK · FİNİSH ${finishYapilan + 1}/${finishTur}`, seviye: 'calisiyor' };
    return { metin: `OTOMATİK · ${FAZ_AD[faz].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
  }

  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik çevrim'], ['man', 'Manuel']], get: () => mod,
      set: (v) => { mod = v; if (v === 'oto') { gec(bosluk > 0.001 ? 'yaklas' : 'dalma'); } } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Çevrim Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') { durum = 'calisiyor'; if (mod === 'oto' && !taslamaFazi()) gec('yaklas'); } } },
      { metin: 'Dur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'anahtar', metin: 'Manyetik tabla', get: () => manyetik, set: (v) => (manyetik = v) },
    { tip: 'anahtar', metin: 'Taşlama motoru', get: () => tasMotor, set: (v) => (tasMotor = v) },
    { tip: 'anahtar', metin: 'Soğutma suyu', get: () => su, set: (v) => (su = v) },
    { tip: 'anahtar', metin: 'Hidrolik pompa (tabla)', get: () => hidrolik, set: (v) => (hidrolik = v) },
    { tip: 'baslik', metin: 'Çevrim ayarları' },
    { tip: 'kaydirici', metin: 'Dalma oranı', min: 0.005, max: 0.05, adim: 0.005, birim: 'mm/tur', get: () => dalmaOrani, set: (v) => (dalmaOrani = v) },
    { tip: 'kaydirici', metin: 'Dalma tur sayısı', min: 1, max: 20, adim: 1, birim: 'tur', get: () => dalmaTur, set: (v) => (dalmaTur = v) },
    { tip: 'kaydirici', metin: 'Finish tur sayısı', min: 0, max: 10, adim: 1, birim: 'tur', get: () => finishTur, set: (v) => (finishTur = v) },
    { tip: 'kaydirici', metin: 'Tabla hızı', min: 5, max: 25, adim: 1, birim: 'm/dk', get: () => tablaHiz, set: (v) => (tablaHiz = v) },
    { tip: 'baslik', metin: 'Manuel jog (mod: Manuel)' },
    { tip: 'basili', ogeler: [
      { metin: 'Tabla ◀', bas: () => (jog.x = -1), birak: () => (jog.x = 0) },
      { metin: 'Tabla ▶', bas: () => (jog.x = 1), birak: () => (jog.x = 0) },
      { metin: 'Çapraz ▲', bas: () => (jog.z = -1), birak: () => (jog.z = 0) },
      { metin: 'Çapraz ▼', bas: () => (jog.z = 1), birak: () => (jog.z = 0) },
    ] },
    { tip: 'basili', ogeler: [
      { metin: 'Taş yukarı', bas: () => (jog.y = 1), birak: () => (jog.y = 0) },
      { metin: 'Taş aşağı (dalma)', bas: () => (jog.y = -1), birak: () => (jog.y = 0) },
    ] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if (durum === 'acil' || (durum === 'alarm' && manyetik)) { durum = 'durdu'; if (mod === 'oto') gec('yaklas'); }
      } },
    ] },
  ];

  return {
    id: 'taslama',
    ad: 'Yüzey Taşlama Makinesi',
    altBaslik: 'Retrofit · Delta PLC/HMI · dalma çevrimi',
    kisa: 'Eski bir yüzey taşlama makinesine PLC ve Delta HMI eklenerek otomatik dalma ve finish çevrimi kuruldu: manyetik tabla tutar, hidrolik tabla salınır, çapraz besleme ilerler, taş her turda dalma oranı kadar iner.',
    proje: 'other-machines',
    ayakIzi: [5.0, 3.0],
    ayakIziMerkez: [0.15, 0],
    kamera: { poz: [1.9, 2.3, 3.3], hedef: [0.15, 1.1, 0] },
    mekanizmalar: [
      'Tabla (X): hidrolik salınım ±420 mm, her terste çapraz kızak bir adım besler',
      'Çapraz kızak (Z): parçanın enini 4 adımda süpürür; bir süpürme = 1 tur',
      'Taş kafası (Y): yaklaşır, her dalma turunda dalma oranı kadar iner, sonra kalkar',
      'Taşlama taşı döner; temasta kıvılcım, soğutma suyu akar, parça yüzeyi turlarla parlar',
      'El çarkları tabla ve çapraz kızakla birlikte döner',
      'Operatör: taşlama sırasında HMI\'ya bakar; parça değişiminde taşlanmış parçayı tabladan alıp rafa koyar, ham parçayı tablaya yerleştirir (makine onu bekler)',
    ],
    cikarim: [
      'MKN-V09: kırmızı-krem gövde, manyetik tabla, kırmızı koruyuculu taş kafası, el çarkları ve "STOP" plakası → klasik yüzey taşlama.',
      'MKN-F08 (DOPSoft "TaşlamaHMI"): Otomatik, Manyetik, Taşlama, Su, Hidrolik Pompa, Çevrim, Yağ, Hata Lambası, Finish/Dalma Tur Sayısı, Dalma Oranı → HMI ve çevrim mantığı bu ekrandan kuruldu.',
      'TAHMİN: makinenin ölçüleri, retrofit panosunun yeri, dalma/finish sırası (önce dalma turları, sonra dalmasız finish turları) ve kilit: manyetik kapalıyken taşlama durur.',
      'TAHMİN: talaş görseli 60 kat abartıldı; tur süreleri gösterim için gerçek tabla hızıyla ama kısa strokla.',
      'TAHMİN: ham / taşlanmış parça rafı makinenin solunda; parça değişimini operatör elle yapar ve "parça değişimi" adımı operatör parçayı koyana kadar sürer.',
    ],
    group: g,
    update,
    kontroller,
    sabitHaric,
    degerler: () => [
      ['Adım', mod === 'oto' ? FAZ_AD[faz] : 'Manuel'],
      ['Tabla X', `${fmt(tablaX * 1000, 0)} mm`],
      ['Çapraz Z', `${fmt(caprazZ * 1000, 0)} mm`],
      ['Dalma / finish', `${dalmaYapilan}/${dalmaTur} · ${finishYapilan}/${finishTur}`],
      ['Talaş (toplam)', `${fmt(kaldirilan, 3)} mm`],
      ['Yüzey pürüzlülüğü', `Ra ${fmt(ra(), 2)} µm`],
      ['Son çevrim', sonCevrim ? `${fmt(sonCevrim, 1)} s` : '—'],
      ['İşlenen parça', String(parcaSay)],
      ['Operatör', OP_AD[opD.f]],
    ],
    trend,
    durum: durumBilgi,
  };
}
