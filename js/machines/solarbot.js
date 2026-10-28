// js/machines/solarbot.js — SolarBot: otonom güneş paneli temizleme robotu (doka).
//
// Prototip fotoğraf/videolarından: alçak profilli (~0.7 × 0.7 m) gövde, iki yanda palet,
// arkada direkte OAK-D derinlik kamerası, önde ve arkada dönen fırça. Kaporta biçimi Kaan'ın
// verdiği referans görsele göre (gövdeye bitişik ön/arka fırça kutuları); renkler, kayar LED'ler
// ve siyah fırçalar FK-1000 V3 ile aynı; üstte siyah plakada resmi doka logosu.
// Burada 25° eğimli bir panel masasının üstünde zikzak (boustrophedon) şeritlerle
// ilerler; fırçanın geçtiği yerde panel üstündeki toz katmanı silinir.

export function create(lib) {
  const {
    THREE, M, box, cyl, sphere, beam, rod, mat, lamba, canvasTex, Ekran, Trend, kuleLambasi, acilStop,
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

  // Şarj / park platformu (masanın sol üst ucunda; şeritler arası transfer noktası).
  // Şerit aralığı: fırça boyu 0.74 m → ilk ve son şeritte fırça ucu panel kenarına denk gelir.
  const Z0 = -1.32, DZ = 0.528, SERIT = 6, XL = 2.55, XD = -3.42;
  const plaka = mat(0xb5bcc2, { r: 0.45, m: 0.8, key: 'plaka' });
  box(1.18, 0.03, 0.86, plaka, -3.59, -0.012, Z0, yuzey);
  // şarj istasyonu: robot platformda yerinde dönerken süpürdüğü dairenin (r ≈ 0.63 m) dışında
  box(0.1, 0.2, 0.56, M.koyu, -4.12, 0.08, Z0, yuzey);
  const sarjLed = lamba(0x2ea043, 0.3);
  box(0.02, 0.04, 0.14, sarjLed, -4.06, 0.14, Z0, yuzey);
  const bakir = mat(0xc07a3a, { r: 0.3, m: 0.9, key: 'bakir' });
  for (const dz of [-0.12, 0.12]) box(0.3, 0.006, 0.04, bakir, XD, 0.006, Z0 + dz, yuzey);   // zemin şarj kontakları (robotun altında)
  {
    const p = yuzeyNokta(-3.5, -0.03, Z0);
    beam([p[0], 0, p[2]], p, 0.07, 0.07, M.celik, g);
    box(0.25, 0.1, 0.25, M.gri, p[0], 0.05, p[2], g);
    beam(yuzeyNokta(-3.0, -0.03, Z0), yuzeyNokta(-2.7, -0.12, Z0 + 0.3), 0.05, 0.05, M.celik, g);
  }

  // ---------------------------------------------------------------- robot
  // Kaporta biçimi Kaan'ın verdiği referansa göre (gövdeye bitişik ön/arka fırça kutusu, arkada
  // kamera direği); renkler ve LED'ler FK-1000 V3 ile aynı: gri tabla, paslanmaz ray, siyah bant
  // ve fırçalar, üstte kayan kırmızı-turuncu LED şeritleri, mavi kenar sensörleri, siyah plakada
  // doka logosu. Robot yerel ekseni: +x ileri, y yukarı, z yan (−z sol).
  const robot = new THREE.Group();
  robot.name = 'solarbotRobot';
  yuzey.add(robot);
  const RY = 0.004;
  const gri = mat(0xa9adb2, { r: 0.55, m: 0.35, key: 'sbTabla' });     // FK-1000 deckMat
  const inox = mat(0xc9ced3, { r: 0.28, m: 0.9, key: 'sbInox' });      // FK-1000 inoxMat
  const siyah = mat(0x18191c, { r: 0.8, m: 0.1, key: 'sbSiyah' });     // FK-1000 kMat
  const kabuk = (geo) => {   // ExtrudeGeometry parçaları (robot.add + gölge)
    const m = new THREE.Mesh(geo, gri);
    m.castShadow = m.receiveShadow = true;
    robot.add(m);
    return m;
  };

  // paletler: gövdenin yan altında, uçları yuvarlak
  const paletDoku = () => canvasTex(64, 16, (x, w, h) => {
    x.fillStyle = '#161616'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3b3b3b'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, h);
  }, { tekrar: [6.25, 1] });            // 0.08 m / tekrar (update'teki 12.5 katsayısı)
  const texSol = paletDoku(), texSag = paletDoku();
  for (const [sz, tex] of [[-0.29, texSol], [0.29, texSag]]) {
    box(0.5, 0.1, 0.085, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, RY + 0.05, sz, robot);
    for (const sx of [-0.25, 0.25]) cyl(0.05, 0.085, M.kaucuk, sx, RY + 0.05, sz, robot, { eksen: 'z', seg: 18 });
  }
  box(0.56, 0.03, 0.4, M.koyu, 0, RY + 0.06, 0, robot);               // alt şasi (paletler arası)

  // gövde kabuğu: kalça çatı kesiti (ön/arka eğimli, üstü düz), yanlar büyük pahla yuvarlatılmış.
  // Pah 0.035 → dış ölçü 0.67 (x) × 0.69 (z), alt 0.05, üst 0.20 m.
  {
    const s = new THREE.Shape();
    s.moveTo(0.3, 0.085); s.lineTo(0.3, 0.1); s.lineTo(0.17, 0.165); s.lineTo(-0.17, 0.165);
    s.lineTo(-0.3, 0.1); s.lineTo(-0.3, 0.085); s.closePath();
    const gg = new THREE.ExtrudeGeometry(s, { depth: 0.62, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 5 });
    gg.translate(0, RY, -0.31);
    kabuk(gg);
  }
  for (const sx of [-1, 1]) box(0.014, 0.022, 0.62, inox, sx * 0.339, RY + 0.066, 0, robot);   // gövde alt paslanmaz ray
  // yan tutamaklar
  for (const sz of [-1, 1]) {
    rod([-0.1, RY + 0.115, sz * 0.372], [0.1, RY + 0.115, sz * 0.372], 0.008, siyah, robot, 10);
    for (const hx of [-0.1, 0.1]) box(0.022, 0.022, 0.03, siyah, hx, RY + 0.115, sz * 0.357, robot);
  }
  // üst plaka: siyah, beyaz doka logosu (logo önden okunur: soldan sağa −z yönünde)
  const plakaTex = canvasTex(512, 185, (x, w, h) => {
    x.fillStyle = '#18191c'; x.fillRect(0, 0, w, h);
    lib.dokaLogo(x, w / 2, h / 2, 118, { zemin: null });   // plaka zaten siyah
  });
  box(0.13, 0.006, 0.36, siyah, 0.07, RY + 0.203, 0, robot);
  const plakaYuz = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.13), new THREE.MeshStandardMaterial({ map: plakaTex, roughness: 0.5, metalness: 0.1 }));
  plakaYuz.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  plakaYuz.position.set(0.07, RY + 0.2065, 0);
  robot.add(plakaYuz);
  // kayar LED şeritleri (FK-1000 V3'teki gibi): üstte iki yanda, boyuna; her şeritte parlak bir
  // bölüm o yandaki paletin gittiği yöne kayar (düz giderken ikisi aynı, dönerken zıt yöne)
  const ledSerit = (sz) => {
    box(0.32, 0.012, 0.028, mat(0x0a0a0a, { r: 0.5, m: 0.5, key: 'sbLedYuva' }), 0, RY + 0.206, sz, robot);
    const m = new THREE.MeshStandardMaterial({ color: 0xff4a24, emissive: 0xff3a1a, emissiveIntensity: 0.3 });
    const seg = box(0.07, 0.01, 0.02, m, 0, RY + 0.2085, sz, robot);
    return { seg, m, faz: 0 };
  };
  const ledSol = ledSerit(-0.265), ledSag = ledSerit(0.265);
  // ön eğimde ürün adı
  {
    const yaziTex = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = '#18191c'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if ('letterSpacing' in x) x.letterSpacing = '8px';
      x.font = '700 62px "Space Grotesk", "Segoe UI", sans-serif';
      x.fillText('SOLARBOT', w / 2 + 4, h / 2 + 2);
    });
    const egim = Math.atan2(0.0784, 0.157);   // pahlı ön eğim: (0.335, 0.122) → (0.178, 0.20)
    const eg = new THREE.Group();
    eg.position.set(0.225 + Math.sin(egim) * 0.0012, RY + 0.177 + Math.cos(egim) * 0.0012, 0);   // eğimin üst %70'i: alçak açıdan fırça kutusu örtmesin
    eg.rotation.z = -egim;
    robot.add(eg);
    const yazi = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshStandardMaterial({
      map: yaziTex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    yazi.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    eg.add(yazi);
  }

  // ön + arka fırça kutusu (Kaan: robotun önünde ve arkasında, gövdeye bitişik fırça var).
  // Kutu kesiti x-y'de çizilip z boyunca uzatılır; fırça mili kutunun altında, kıllar etekten taşar.
  const FX = 0.415, FB = 0.42, BL = 0.78;   // kutu ekseni, fırça mili ekseni, kutu boyu (m)
  const kapakSekli = (sg) => {
    const P = [[-0.075, 0.125], [0.075, 0.125], [0.075, 0.15], [0.048, 0.178], [-0.075, 0.178]];  // dış yüz +x, üst dış köşe pahlı
    const s = new THREE.Shape();
    s.moveTo(sg * P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) s.lineTo(sg * P[i][0], P[i][1]);
    s.closePath();
    return s;
  };
  // kıllar (siyah, FK-1000 V3'teki gibi): sık kıl göbeği (çizgili doku, dönüşü gösterir) + çevresinde
  // helis dizilmiş ince tutamlar (boy/eğim hafif rastgele → uçlar düzensiz, tek InstancedMesh / fırça)
  const NZ = 64, NA = 18;
  const tutamGeo = new THREE.BoxGeometry(0.0065, 0.032, 0.0075);
  tutamGeo.translate(0, 0.016, 0);                       // taban mil yüzeyinde, uç dışa
  const tutamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
  const gobekTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#141518'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(70,74,82,${0.25 + Math.random() * 0.35})`; x.fillRect(Math.random() * w, 0, 1 + Math.random() * 2, h); }
  }, { tekrar: [3, 10] });
  const gobekMat = new THREE.MeshStandardMaterial({ map: gobekTex, roughness: 0.9, metalness: 0 });
  const sensorKutu = mat(0x2c4a94, { r: 0.45, m: 0.2, key: 'sbSensor' });   // FK-1000 modMat
  const sensorOn = new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xff3030, emissiveIntensity: 0.25 });
  const sensorArka = sensorOn.clone();
  const _s = new THREE.Vector3();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const fircalar = [1, -1].map((sg) => {
    const cx = sg * FX;
    const kg = new THREE.ExtrudeGeometry(kapakSekli(sg), { depth: BL - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    kg.translate(cx, RY, -(BL - 0.008) / 2);
    kabuk(kg);
    box(0.15, 0.013, BL - 0.01, inox, cx, RY + 0.1165, 0, robot);        // paslanmaz ray
    box(0.15, 0.05, BL - 0.01, siyah, cx, RY + 0.085, 0, robot);         // siyah etek (alt kenar 0.06 → altında ≈6 cm kıl görünür)
    for (const ez of [-1, 1]) {
      box(0.158, 0.148, 0.012, gri, cx, RY + 0.109, ez * (BL / 2 + 0.004), robot);                     // uç kapağı (mili taşır)
      cyl(0.016, 0.012, M.alu, sg * FB, RY + 0.058, ez * (BL / 2 + 0.014), robot, { eksen: 'z', seg: 14 }); // mil yatağı
      // mavi kenar sensörü modülü (FK-1000 V3'teki gibi), üstünde LED
      box(0.025, 0.035, 0.05, sensorKutu, sg * (FX + 0.0875), RY + 0.15, ez * 0.3, robot);
      sphere(0.008, sg > 0 ? sensorOn : sensorArka, sg * (FX + 0.0875), RY + 0.172, ez * 0.3, robot, 10);
    }
    // gövdeye bağlantı: iki alüminyum braket (kutu üstü → gövde eğimi)
    for (const bz of [-0.2, 0.2]) beam([sg * 0.395, RY + 0.186, bz], [sg * 0.3, RY + 0.143, bz], 0.008, 0.045, M.alu, robot);
    for (let i = 0; i < 6; i++) cyl(0.005, 0.016, inox, sg * (FX - 0.062), RY + 0.053, -0.3 + i * 0.12, robot, { seg: 8 }); // püskürtme memeleri
    // dönen fırça
    const f = new THREE.Group();
    f.position.set(sg * FB, RY + 0.058, 0);
    robot.add(f);
    cyl(0.05, BL - 0.03, gobekMat, 0, 0, 0, f, { eksen: 'z', seg: 18 });
    const kil = new THREE.InstancedMesh(tutamGeo, tutamMat, NZ * NA);
    let i = 0;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NA; j++, i++) {
      const a = ((j + Math.random() * 0.35) / NA) * Math.PI * 2 + k * 0.29;
      _p.set(Math.cos(a) * 0.034, Math.sin(a) * 0.034, -0.37 + (k + 0.3 + Math.random() * 0.4) * (0.74 / NZ));
      _q.setFromEuler(_e.set((Math.random() - 0.5) * 0.25, 0, a - Math.PI / 2 + (Math.random() - 0.5) * 0.3));   // +y dışa (radyal)
      _s.set(1, 0.88 + Math.random() * 0.24, 1);
      kil.setMatrixAt(i, _m4.compose(_p, _q, _s));
      kil.setColorAt(i, _c.setHSL(0.6, 0.05, 0.07 + Math.random() * 0.08));
    }
    kil.castShadow = true; kil.receiveShadow = true;
    f.add(kil);
    return f;
  });

  // su hattı: arka fırça kutusunun ucundaki rakordan direk dibine siyah hortum
  {
    const V = (x, y, z) => new THREE.Vector3(x, RY + y, z);
    const yol = new THREE.CatmullRomCurve3([
      V(-0.39, 0.193, -0.37), V(-0.39, 0.193, -0.22), V(-0.36, 0.186, -0.12), V(-0.31, 0.16, -0.07),
      V(-0.24, 0.18, -0.04), V(-0.17, 0.21, -0.015), V(-0.142, 0.214, -0.004),
    ]);
    const h = new THREE.Mesh(new THREE.TubeGeometry(yol, 40, 0.009, 8), siyah);
    h.castShadow = h.receiveShadow = true;
    robot.add(h);
    cyl(0.013, 0.032, inox, -0.39, RY + 0.193, -0.38, robot, { eksen: 'z', seg: 12 });   // rakor
  }

  // kamera direği (arkada, ortada): flanş, gri konik direk, durum LED halkası, siyah OAK-D başlığı
  const MX = -0.11;
  cyl(0.032, 0.03, inox, MX, RY + 0.215, 0, robot, { seg: 20 });
  cyl(0.022, 0.32, gri, MX, RY + 0.39, 0, robot, { seg: 20, r2: 0.027 });
  cyl(0.036, 0.07, gri, MX, RY + 0.585, 0, robot, { seg: 20, r2: 0.022 });
  const durumLed = lamba(0x2ea043, 1.5);
  cyl(0.029, 0.014, durumLed, MX, RY + 0.53, 0, robot, { seg: 20 });
  const kam = new THREE.Group();
  kam.position.set(MX, RY + 0.655, 0);
  kam.rotation.z = -0.42;                  // öne-aşağı bakar
  robot.add(kam);
  box(0.075, 0.06, 0.14, siyah, 0, 0, 0, kam);
  box(0.09, 0.012, 0.15, gri, 0.006, 0.036, 0, kam);                    // güneşlik
  box(0.004, 0.032, 0.115, M.koyu, 0.0385, 0, 0, kam);                 // OAK-D ön yüzü
  for (const dz of [-0.04, 0, 0.04]) cyl(0.008, 0.006, mat(0x3a5a8a, { r: 0.1, m: 0.6, key: 'lens' }), 0.041, 0, dz, kam, { eksen: 'x', seg: 12 });
  const koni = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 24, 1, true), new THREE.MeshBasicMaterial({
    color: 0x39c5cf, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
  }));
  koni.rotation.z = Math.PI / 2;           // ucu kamerada, açıklığı +X
  koni.position.x = 0.67;
  kam.add(koni);
  // robotun sabit parçaları malzeme başına birleşir (fırçalar döner, LED bölümleri kayar)
  lib.sabitle(robot, [...fircalar, ledSol.seg, ledSag.seg]);

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
  // kenar sensörü: gövde merkezi panel içinde (fırça ucu kenarı ≈ 2 cm aşar), platformda şarj kutusuna değmez
  const izinli = (x, z) => (Math.abs(x) <= 2.66 && Math.abs(z) <= 1.36) || (x >= -3.46 && x <= -2.6 && Math.abs(z - Z0) <= 0.32);
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

  function fircaSil() { for (const fx of [FB, -FB]) fircaIzi(fx); }
  function fircaIzi(fx) {
    const bx = R.x + Math.cos(R.h) * fx, bz = R.z - Math.sin(R.h) * fx;
    tozCtx.save();
    tozCtx.globalCompositeOperation = 'destination-out';
    tozCtx.translate((bx + LX / 2) * TS, (bz + LZ / 2) * TS);
    tozCtx.rotate(-R.h);
    tozCtx.fillRect(-0.09 * TS, -0.37 * TS, 0.18 * TS, 0.74 * TS);   // kıllı boy 0.74 m
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
      if (Math.abs(cx * c - cz * s) <= 0.1 && Math.abs(cx * s + cz * c) <= 0.37) { temiz[k] = 1; temizSay++; }
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
    const vL = R.v - R.w * 0.29, vR = R.v + R.w * 0.29;
    texSol.offset.x -= vL * dt * 12.5;
    texSag.offset.x -= vR * dt * 12.5;
    // kayar LED'ler (FK-1000 V3 mantığı): parlak bölüm o yandaki paletin yönünde kayar, durunca söner
    for (const [L, v] of [[ledSol, vL], [ledSag, vR]]) {
      const kos = Math.abs(v) > 0.01 && durum !== 'acil';
      if (kos) L.faz += Math.sign(v) * 0.45 * dt;
      const ph = ((L.faz % 0.25) + 0.25) % 0.25;
      L.seg.position.x = -0.125 + ph;
      L.m.emissiveIntensity = durum === 'acil' ? 0.05 : kos ? 1.8 + Math.sin(t * 4) * 0.4 : 0.3;
    }
    // kenar sensörleri: gidilen yöndeki kutunun LED'i yanar, kenar algılanınca turuncu yanıp söner
    for (const [sm, on] of [[sensorOn, R.v > 0.005], [sensorArka, R.v < -0.005]]) {
      const yanip = on && kenarT > 0 && Math.sin(t * 14) > 0;
      sm.emissive.setHex(yanip ? 0xffaa30 : 0xff3030);
      sm.emissiveIntensity = durum === 'acil' ? 0.05 : on ? (kenarT > 0 ? (yanip ? 2.4 : 0.3) : 0.8) : 0.25;
    }
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
    kisa: 'Güneş paneli masasında otonom çalışan paletli temizleme robotu: önünde ve arkasında gövdeye bitişik dönen fırça kutuları, OAK-D derinlik kamerası ile engel/kenar algılama, YOLO ile panel tespiti, zikzak kapsama yolu, Smart BMS\'li LiFePO4 batarya ve otomatik şarja dönüş.',
    proje: 'solarbot',
    ayakIzi: [8.4, 5.8],
    kamera: { poz: [-1.6, 4.4, 6.4], hedef: [0.3, 1.25, -0.3] },
    durus: { poz: [0.4, 7.2], bak: [0.3, 1.5, -0.6] },   // yürüyüş: eğimli masanın tamamı ve robot görünsün diye geride
    mekanizmalar: [
      'Paletler: sol/sağ palet ayrı hızda döner (diferansiyel sürüş, yerinde dönüş)',
      'Ön ve arka fırça kutusu: gövdeye braketle bağlı; içindeki siyah kıllı fırçalar ters yönde döner, ikisi de geçtiği yerdeki tozu 0.74 m genişlikte siler',
      'Kayar LED şeritleri (FK-1000 V3\'teki gibi): üstte iki yanda; parlak bölüm o yandaki paletin yönünde kayar — düz giderken ikisi aynı yöne, yerinde dönerken zıt yöne',
      'Mavi kenar sensörleri: gidilen yöndeki fırça kutusunun LED\'leri yanar, kenar algılanınca turuncu yanıp söner',
      'Zikzak kapsama: 6 şerit boyunca git, şerit değiştir, geri dön',
      'Batarya %15 altına inince şarj platformuna döner, dolunca kaldığı şeritten devam eder',
      'OAK-D kamera: direk üstünde, öne-aşağı bakar (görüş konisi)',
      'Operatör: yer istasyonu tabletinin başında izler; manuel modda telsiz kumandayla robota döner, robot şarja dönünce platforma yürüyüp bakar',
    ],
    cikarim: [
      'solarbot-img-02/04/05 ve video-03 (prototip): alçak gövde, iki yanda palet, arkada direkte kamera, yan tutamak, önde beyaz su borusu → ölçüler (~0.7 × 0.7 m gövde, 0.78 m fırça kutusu) ve yerleşim buradan.',
      'KAAN\'IN DÜZELTMESİ (referans görsel): fırçalar gövdeye bitişik ön/arka fırça kutularında, kamera başlığı konik direğin üstünde → kaporta biçimi bu görsele göre (prototipteki açık şasi ve sarı tamponlar yerine).',
      'KAAN\'IN DÜZELTMESİ (renk ve marka): renkler FK-1000 V3 ile aynı — gri tabla, paslanmaz ray, siyah etek ve siyah fırçalar; turuncu ayrıntılar yerine FK-1000 V3\'teki gibi kayar LED şeritleri ve mavi kenar sensörleri; üstteki plakada firmanın resmi doka logosu.',
      'solarbot-video-02: elde tutulan uzun siyah kamera → OAK-D (3 lensli) olarak direğe kondu.',
      'solarbot-img-07: önünde fırça/sıyırıcı olan paletli versiyon; KAAN\'IN DÜZELTMESİ: robotun önünde VE arkasında dönen fırça var → iki fırça.',
      'solarbot-img-01 (BMS) ve -06 (pano): LiFePO4 8S 24V batarya ve Smart BMS → batarya modeli ve şarja dönüş davranışı.',
      'TAHMİN: panel masası ölçüsü (6 × 2 panel, 25°), şarj/park platformu ve zikzak yol; videolarda robot atölye zemininde test ediliyor, panel üstü görüntüsü yok.',
    ],
    group: g,
    // sabitle(): robot hareketli (kendi sabit parçaları create içinde birleşti); toz/panel tek mesh, operatör kendiliğinden atlanır
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
