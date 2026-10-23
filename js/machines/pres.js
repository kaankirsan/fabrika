// js/machines/pres.js — Rezistanslı Vulkanizasyon Presi (kauçuk levha pişirme).
//
// Videodan (resistance-video-01): ~5 m uzun pres; üst taç kirişinin altında
// sıra halinde krom hidrolik silindirler, yan kolonlar, alt/üst ısıtma
// tablaları, kablo kanalları ve hortumlar. Tablalar 4 bölgeye ayrılır, her
// bölge kendi PID döngüsüyle rezistans gücünü ayarlar (±%1).
//
// Enerji karşılaştırması: her bölge İKİ ısıl modelle paralel koşar (PID ve
// aç-kapa termostat); seçili mod sahneyi sürer, ikisinin kWh'i yan yana
// gösterilir. Fark sabit yazılmaz, modelden hesaplanır.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, mat, lamba, Ekran, Trend, PID, kuleLambasi, acilStop, pano, levha,
    clamp, lerp, damp, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const govde = mat(0x5f666d, { r: 0.55, m: 0.45, key: 'pres-govde' });
  const govdeKoyu = mat(0x464c52, { r: 0.6, m: 0.4, key: 'pres-koyu' });
  const yalitim = mat(0x2a2522, { r: 0.9, m: 0, key: 'pres-yalitim' });

  // ---------------------------------------------------------------- gövde
  const YATAK_UST = 0.7, ALT_TABLA_UST = 0.87, LEVHA_UST = 0.89;
  const ACIK = 1.29, KAPALI = LEVHA_UST; // üst tabla alt yüzünün yüksekliği
  box(5.0, YATAK_UST, 1.3, govde, 0, YATAK_UST / 2, 0, g);
  for (const sz of [-1, 1]) box(5.0, 0.06, 0.04, govdeKoyu, 0, YATAK_UST - 0.05, sz * 0.67, g); // flanş çizgisi
  for (const x of [-2.2, -0.75, 0.75, 2.2]) box(0.5, 0.08, 1.4, govdeKoyu, x, 0.04, 0, g);      // ayak plakaları
  box(4.9, 0.05, 1.15, yalitim, 0, YATAK_UST + 0.025, 0, g);

  // yan kolonlar (uç plakaları) + taç kirişi
  for (const sx of [-1, 1]) {
    box(0.3, 2.78, 1.4, govde, sx * 2.65, 1.39, 0, g);
    box(0.06, 2.4, 0.5, govdeKoyu, sx * 2.82, 1.4, 0, g); // dış takviye
  }
  box(5.6, 0.45, 1.35, govde, 0, 2.55, 0, g);
  for (let i = -3; i <= 3; i++) box(0.04, 0.4, 0.06, govdeKoyu, i * 0.8, 2.55, 0.69, g); // kiriş nervürleri

  // Taç üstünde beyaz buat (videonun ilk karesindeki kırmızı ışıklı kutu)
  box(0.62, 0.34, 0.26, M.beyaz, 0.6, 2.95, 0.42, g);
  const buatLamba = lamba(0xff2a1a, 1.5);
  cyl(0.03, 0.03, buatLamba, 0.82, 2.98, 0.56, g, { eksen: 'z', seg: 14 });

  // ---------------------------------------------------------------- hidrolik silindirler (2 sıra × 6)
  const silX = [-2.0, -1.2, -0.4, 0.4, 1.2, 2.0], silZ = [-0.32, 0.32];
  for (const x of silX) for (const z of silZ) {
    cyl(0.11, 0.45, govdeKoyu, x, 2.1, z, g, { seg: 20 });
    cyl(0.15, 0.04, govde, x, 2.305, z, g, { seg: 20 });
    cyl(0.12, 0.03, govde, x, 1.89, z, g, { seg: 20 });
  }

  // ---------------------------------------------------------------- bölge malzemeleri + tablalar
  const BOLGE = 4, BOLGE_W = 1.2;
  const bolgeX = (i) => -1.8 + i * BOLGE_W;
  const tablaMat = [];
  for (let i = 0; i < BOLGE; i++) {
    tablaMat.push(new THREE.MeshStandardMaterial({
      color: 0x4f5459, roughness: 0.42, metalness: 0.65, emissive: 0x000000, emissiveIntensity: 0,
    }));
    box(BOLGE_W - 0.02, 0.12, 1.1, tablaMat[i], bolgeX(i), YATAK_UST + 0.05 + 0.06, 0, g);
    // termokupl kafası (ön yüz) + kablo
    box(0.05, 0.05, 0.05, M.koyu, bolgeX(i) + 0.35, YATAK_UST + 0.11, 0.58, g);
    rod([bolgeX(i) + 0.35, YATAK_UST + 0.11, 0.6], [bolgeX(i) + 0.35, 0.3, 0.68], 0.008, M.siyah, g);
  }

  // üst (hareketli) tabla grubu: orijin = üst tabla alt yüzü
  const ram = new THREE.Group();
  g.add(ram);
  for (let i = 0; i < BOLGE; i++) {
    box(BOLGE_W - 0.02, 0.12, 1.1, tablaMat[i], bolgeX(i), 0.06, 0, ram);
    box(0.05, 0.05, 0.05, M.koyu, bolgeX(i) + 0.35, 0.06, 0.58, ram);
  }
  box(4.9, 0.03, 1.12, yalitim, 0, 0.135, 0, ram);
  box(5.0, 0.18, 1.2, govde, 0, 0.24, 0, ram);
  for (const sx of [-1, 1]) box(0.12, 0.3, 0.5, govdeKoyu, sx * 2.46, 0.24, 0, ram); // kılavuz pabuçları
  for (const x of silX) for (const z of silZ) {
    cyl(0.055, 0.75, M.krom, x, 0.33 + 0.375, z, ram, { seg: 16 });
    cyl(0.1, 0.05, govdeKoyu, x, 0.355, z, ram, { seg: 16 });
  }
  ram.position.y = ACIK;

  // kauçuk levha (ham: kahverengimsi gri → pişmiş: mat siyah)
  const levhaMat = new THREE.MeshStandardMaterial({ color: 0x4a423b, roughness: 0.95, metalness: 0 });
  const kaucuk = box(4.4, 0.02, 0.9, levhaMat, 0, ALT_TABLA_UST + 0.01, 0, g);
  const HAM = new THREE.Color(0x4a423b), PISMIS = new THREE.Color(0x121212);

  // ön boşaltma masası (rulolu)
  const masaZ = 1.18;
  box(4.6, 0.05, 0.7, govdeKoyu, 0, ALT_TABLA_UST - 0.03, masaZ, g);
  for (const x of [-2.1, 2.1]) for (const dz of [-0.28, 0.28]) box(0.06, ALT_TABLA_UST - 0.05, 0.06, govdeKoyu, x, (ALT_TABLA_UST - 0.05) / 2, masaZ + dz, g);
  for (let i = 0; i < 12; i++) cyl(0.025, 0.66, M.celik, -2.0 + i * 0.36, ALT_TABLA_UST - 0.005, masaZ, g, { eksen: 'z', seg: 10 });

  // ---------------------------------------------------------------- kablo kanalı, hortumlar, hidrolik ünite
  box(5.0, 0.08, 0.25, M.gri, 0, 1.75, -0.86, g);
  for (const sx of [-1, 1]) box(0.05, 0.05, 0.25, M.koyu, sx * 2.45, 1.75, -0.74, g);
  for (let i = 0; i < BOLGE; i++) {
    const x = bolgeX(i) - 0.3;
    rod([x, ALT_TABLA_UST - 0.06, -0.56], [x, ALT_TABLA_UST - 0.06, -0.82], 0.022, M.siyah, g);
    rod([x, ALT_TABLA_UST - 0.06, -0.82], [x, 1.71, -0.82], 0.022, M.siyah, g);
  }
  const hgX = 3.45, hgZ = -0.45;
  box(0.9, 0.6, 0.62, M.mavi, hgX, 0.3, hgZ, g);
  cyl(0.12, 0.36, M.mavi, hgX - 0.15, 0.78, hgZ, g, { eksen: 'x', seg: 18 });
  box(0.22, 0.14, 0.18, M.celik, hgX + 0.22, 0.67, hgZ, g);
  const manoMat = mat(0xf4f4f0, { r: 0.4, key: 'pres-mano' });
  cyl(0.05, 0.02, manoMat, hgX + 0.22, 0.82, hgZ + 0.1, g, { eksen: 'z', seg: 18 });
  rod([hgX + 0.22, 0.74, hgZ], [hgX + 0.22, 2.4, hgZ], 0.02, M.siyah, g);
  rod([hgX + 0.22, 2.4, hgZ], [2.82, 2.4, hgZ], 0.02, M.siyah, g);
  rod([hgX + 0.3, 0.74, hgZ - 0.05], [hgX + 0.3, 2.3, hgZ - 0.05], 0.02, M.siyah, g);
  rod([hgX + 0.3, 2.3, hgZ - 0.05], [2.82, 2.3, hgZ - 0.05], 0.02, M.siyah, g);

  // ışık perdesi dikmeleri (ön köşeler)
  for (const sx of [-1, 1]) {
    box(0.06, 1.7, 0.06, M.sari, sx * 2.45, 0.85, 0.78, g);
    box(0.03, 1.4, 0.02, M.siyah, sx * 2.45 - sx * 0.035, 0.95, 0.78, g);
  }

  // ---------------------------------------------------------------- pano + HMI
  const panoX = 3.45, panoZ = 0.55;
  pano(g, panoX, 0, panoZ, 0.8, 1.8, 0.35, 0);
  const ekran = new Ekran(0.56, 0.38, 640);
  ekran.mesh.position.set(panoX, 1.3, panoZ + 0.176 + 0.012);
  g.add(ekran.mesh);
  const kule = kuleLambasi(g, panoX + 0.25, 1.8, panoZ);
  acilStop(g, panoX - 0.25, 0.9, panoZ + 0.2);
  acilStop(g, 2.3, 0.5, 0.67);
  const isim = levha(['VULKANİZASYON PRESİ', '4 bölge · PID ±%1'], 1.4, 0.3, { bg: '#1d2a36', font: 60, px: 900 });
  isim.position.set(-1.4, 2.55, 0.73);
  g.add(isim);

  // ---------------------------------------------------------------- operatör + pişmiş levha istifi
  // Operatör (lib.operator — FK-1000 operatörüyle aynı model) panonun önünde HMI'yı izler;
  // pişmiş levha boşaltma masasına çıkınca gidip alır (katlanmış), sol uçtaki istif
  // paletine koyar, panoya döner. Alarm / ACİL'de panoya yürür.
  const op = lib.operator({ yelek: 0xff7a1a });
  g.add(op.group);
  const IST_X = -3.65, IST_Z = 1.5;
  box(1.1, 0.12, 1.0, M.ahsap, IST_X, 0.06, IST_Z, g);                       // istif paleti
  const istifKat = [];
  for (let i = 0; i < 12; i++) {
    const k = box(0.95, 0.035, 0.85, mat(0x151515, { r: 0.95, m: 0, key: 'pres-pismis' }), IST_X, 0.14 + i * 0.037, IST_Z, g);
    k.visible = false; istifKat.push(k);
  }
  // masada bekleyen pişmiş levha (ham levha prese geri girerken masada kalır)
  const bitmis = box(4.4, 0.02, 0.9, mat(0x121212, { r: 0.95, m: 0, key: 'pres-pismis-levha' }), 0, ALT_TABLA_UST + 0.022, masaZ, g);
  bitmis.visible = false;
  const tasinan = box(0.72, 0.12, 0.5, mat(0x151515, { r: 0.95, m: 0, key: 'pres-pismis' }), 0, 0.98, 0.42, op.group);
  tasinan.visible = false;
  const OP_PANO = [panoX, panoZ + 0.85], OP_KORIDOR = 2.05;
  // O.gorev: izle | al | tut | tasi | birak | don | alarm ; O.yol: yürünecek ara noktalar
  const O = { x: OP_PANO[0], z: OP_PANO[1], yon: Math.PI, hedefYon: Math.PI, gorev: 'izle', yol: [], t: 0, istif: 0 };
  const opGit = (gorev, yol) => { O.gorev = gorev; O.yol = yol; O.t = 0; };
  function opGuncelle(dt, t) {
    const alarm = adim === 'acil' || ariza >= 0;
    let yuruyor = false;
    if (O.yol.length) {
      const [hx, hz] = O.yol[0];
      const dx = hx - O.x, dz = hz - O.z, d = Math.hypot(dx, dz), a = 1.25 * dt;
      if (d <= a) { O.x = hx; O.z = hz; O.yol.shift(); }
      else { O.x += (dx / d) * a; O.z += (dz / d) * a; O.hedefYon = Math.atan2(dx, dz); yuruyor = true; }
    } else {
      O.t += dt;
      if (O.gorev === 'izle' || O.gorev === 'alarm') {
        O.hedefYon = Math.PI;                                       // panoya / HMI'ya dönük
        if (!alarm && O.gorev === 'alarm') O.gorev = 'izle';
        else if (!alarm && bitmis.visible) opGit('al', [[2.7, OP_KORIDOR], [0.3, OP_KORIDOR]]);
      } else if (O.gorev === 'al') {
        O.gorev = 'tut'; O.t = 0;
      } else if (O.gorev === 'tut') {
        O.hedefYon = Math.PI;                                       // masaya dönük, levhayı çeker
        if (O.t > 1.0) { bitmis.visible = false; tasinan.visible = true; opGit('tasi', [[IST_X, IST_Z + 0.95]]); }
      } else if (O.gorev === 'tasi') {
        O.gorev = 'birak'; O.t = 0;
      } else if (O.gorev === 'birak') {
        O.hedefYon = Math.PI;                                       // istif paletine dönük
        if (O.t > 0.8) {
          tasinan.visible = false;
          O.istif = (O.istif % 12) + 1;
          istifKat.forEach((k, i) => (k.visible = i < O.istif));
          opGit('don', [[2.7, OP_KORIDOR], OP_PANO.slice()]);
        }
      } else if (O.gorev === 'don') {
        O.gorev = 'izle';
      }
    }
    // alarm: levha taşımıyorsa hemen panoya yürür
    if (alarm && (O.gorev === 'izle' || O.gorev === 'al' || O.gorev === 'tut')) {
      if (O.gorev !== 'izle') opGit('alarm', [[2.7, OP_KORIDOR], OP_PANO.slice()]);
      else O.gorev = 'alarm';
    }
    op.poz(tasinan.visible ? 'tasi' : (O.gorev === 'tut' || O.gorev === 'alarm') && !O.yol.length ? 'on' : 'yan');
    let f = O.hedefYon - O.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    O.yon += f * (1 - Math.exp(-10 * dt));
    const zip = op.yuru(t, yuruyor);
    op.group.position.set(O.x, zip, O.z);
    op.group.rotation.y = O.yon;
  }

  // ---------------------------------------------------------------- ısıl model (her bölge × 2 mod)
  // Th: rezistans eleman sıcaklığı, T: tabla. Eleman tablaya kh ile ısı verir,
  // kendisi de ortama (doğrusal olmayan, radyasyon benzeri) ısı kaybeder —
  // aç-kapada eleman tam güçte çok ısınır, kayıp artar: farkın kaynağı bu.
  const TA = 25, PM = 400, KH = 0.3, KE = 0.1, KR = 100, KL = 0.3, CT = 4, CH = 0.6, KYUK = 0.06;
  const ZAMAN = 30;            // enerji sayacında zaman sıkıştırma (sim 1 s = 30 s)
  const BOLGE_KW = 15;         // bölge başına rezistans gücü
  const HIST = 6;              // aç-kapa termostat üst histerezis (°C)
  let sp = 170;
  const yeniModel = () => ({ T: TA, Th: TA, u: 0, on: false, E: 0, pid: new PID(0.05, 0.01, 0.12, 0, 1) });
  const bolgeler = Array.from({ length: BOLGE }, () => ({ pid: yeniModel(), onoff: yeniModel(), olcum: TA }));

  function modelAdim(z, u, dt, ariza, yuk) {
    const uu = ariza ? 0 : u;
    const le = KE * (z.Th - TA) * (1 + (z.Th - TA) / KR);
    z.Th += (dt * (PM * uu - KH * (z.Th - z.T) - le)) / CH;
    z.T += (dt * (KH * (z.Th - z.T) - KL * (z.T - TA) - yuk)) / CT;
    z.u = uu;
    z.E += (BOLGE_KW * uu * dt * ZAMAN) / 3600;
  }

  // ---------------------------------------------------------------- çevrim
  let mod = 'pid';              // pid | onoff
  let adim = 'isinma';          // isinma | kapaniyor | pisirme | aciliyor | bosaltma | durdu | acil
  let calis = true, durdurIstek = false;
  let adimT = 0, pisirmeSure = 25, kalan = 0, parca = 0;
  let ariza = -1;               // -1 yok, 0..3 bölge
  let levhaT = TA, kur = 0;     // levha sıcaklığı, pişme oranı 0..1
  let ramY = ACIK;

  const aktif = (b) => b[mod];
  // Kilit: TÜM bölgeler bantta değilse pres kapanmaz (arızalı bölge çevrimi durdurur)
  const bandta = () => bolgeler.every((b) => Math.abs(aktif(b).T - sp) <= sp * 0.01);
  const adimaGec = (a) => { adim = a; adimT = 0; };

  const trend = new Trend([
    { ad: 'B1', renk: '#39c5cf' }, { ad: 'B2', renk: '#f2c200' }, { ad: 'B3', renk: '#ff7b72' }, { ad: 'B4', renk: '#a371f7' },
    { ad: 'SP', renk: '#e6edf3', kesik: true, kalin: 1 },
  ], { uzunluk: 300, periyot: 0.2 });
  const ekranZ = throttle(4);
  const _c = new THREE.Color(), KOYU_KIRMIZI = new THREE.Color(0x7a0e00), TURUNCU = new THREE.Color(0xff5a00);

  function update(dt, t) {
    const kapali = adim === 'pisirme' || (adim === 'kapaniyor' && adimT > 2.5) || (adim === 'aciliyor' && adimT < 0.3);
    // levha ısınır (yalnız pres kapalıyken tablalarla temasta)
    const ortT = bolgeler.reduce((s, b) => s + aktif(b).T, 0) / BOLGE;
    if (kapali) levhaT += (dt * (ortT - levhaT)) / 8;
    const isitma = adim !== 'acil';
    for (let i = 0; i < BOLGE; i++) {
      const b = bolgeler[i];
      for (const k of ['pid', 'onoff']) {
        const z = b[k];
        let u = 0;
        if (isitma) {
          if (k === 'pid') u = z.pid.update(sp, z.T, dt);
          else { if (z.T < sp - sp * 0.01) z.on = true; if (z.T > sp + HIST) z.on = false; u = z.on ? 1 : 0; }
        }
        const yuk = kapali ? KYUK * Math.max(0, z.T - levhaT) : 0;
        modelAdim(z, u, dt, i === ariza, yuk);
      }
      b.olcum = damp(b.olcum, aktif(b).T + gurultu(0.08), 20, dt);
      // tabla rengi: gri → koyu kırmızı → turuncu
      const T = aktif(b).T;
      const f = clamp((T - 60) / 150, 0, 1);
      _c.copy(KOYU_KIRMIZI).lerp(TURUNCU, clamp((T - 150) / 80, 0, 1));
      tablaMat[i].emissive.copy(_c);
      tablaMat[i].emissiveIntensity = f * 1.15;
    }

    // adım makinesi
    adimT += dt;
    if (adim === 'isinma') {
      if (!calis) adimaGec('durdu');
      else if (bandta() && adimT > 1) adimaGec('kapaniyor');
    } else if (adim === 'kapaniyor') {
      ramY = lerp(ACIK, KAPALI, easeInOut(Math.min(1, adimT / 3)));
      if (adimT >= 3) { adimaGec('pisirme'); kalan = pisirmeSure; }
    } else if (adim === 'pisirme') {
      kalan = Math.max(0, kalan - dt);
      // pişme: levha sıcakken ilerler
      kur = clamp(kur + (dt / pisirmeSure) * clamp((levhaT - 100) / 60, 0, 1.2), 0, 1);
      if (kalan <= 0) adimaGec('aciliyor');
    } else if (adim === 'aciliyor') {
      ramY = lerp(KAPALI, ACIK, easeInOut(Math.min(1, adimT / 3)));
      if (adimT >= 3) adimaGec('bosaltma');
    } else if (adim === 'bosaltma') {
      // levha öne kayar (masa), yerine ham levha girer
      const k = Math.min(1, adimT / 4);
      if (k < 0.45) kaucuk.position.z = easeInOut(k / 0.45) * masaZ;
      else if (k < 0.55) { if (kur > 0) { kur = 0; levhaT = TA; parca++; bitmis.visible = true; } kaucuk.position.z = masaZ; }
      else kaucuk.position.z = masaZ * (1 - easeInOut((k - 0.55) / 0.45));
      if (k >= 1) { kaucuk.position.z = 0; if (durdurIstek || !calis) { durdurIstek = false; calis = false; adimaGec('durdu'); } else adimaGec('isinma'); }
    }
    ram.position.y = ramY;
    levhaMat.color.copy(HAM).lerp(PISMIS, kur);
    opGuncelle(dt, t);
    buatLamba.emissiveIntensity = adim === 'acil' ? (Math.sin(t * 9) > 0 ? 2.5 : 0.1) : adim === 'pisirme' ? 1.6 : 0.2;

    const d = durumBilgi();
    kule.set(d.seviye, t);
    const isinan = bolgeler.some((b) => aktif(b).T < sp - 15);
    trend.min = isinan ? 20 : sp - 15;
    trend.max = sp + 15;
    trend.ornekle(dt, [...bolgeler.map((b) => b.olcum), sp]);
    if (ekranZ(dt)) hmiCiz(d);
  }

  function hmiCiz(d) {
    ekran.ciz((x, W, H) => {
      x.fillStyle = '#e9eef2'; x.fillRect(0, 0, W, H);
      const hb = 52;
      x.fillStyle = '#163a5c'; x.fillRect(0, 0, W, hb);
      x.fillStyle = '#fff'; x.font = '700 26px "Space Grotesk", sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText('Bölge Sıcaklıkları', 18, hb / 2);
      x.textAlign = 'right'; x.font = '600 20px "JetBrains Mono", monospace';
      x.fillText(mod === 'pid' ? 'PID' : 'AÇ-KAPA', W - 18, hb / 2);
      // 4 sütun
      const ust = hb + 30, alt = H - 120, bw = 70, lo = 20, hi = 220;
      const yOf = (v) => alt - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (alt - ust);
      bolgeler.forEach((b, i) => {
        const cx = 90 + i * 145;
        x.fillStyle = '#cfd8e0'; x.fillRect(cx - bw / 2, ust, bw, alt - ust);
        const T = b.olcum, sapma = Math.abs(T - sp) / sp;
        x.fillStyle = i === ariza ? '#8b949e' : sapma <= 0.01 ? '#2ea043' : T < sp ? '#d29922' : '#f85149';
        x.fillRect(cx - bw / 2, yOf(T), bw, alt - yOf(T));
        x.fillStyle = '#0b2540'; x.font = '700 22px "JetBrains Mono", monospace'; x.textAlign = 'center';
        x.fillText(`${fmt(T, 1)}°`, cx, alt + 24);
        x.fillStyle = '#33414e'; x.font = '600 18px "Space Grotesk", sans-serif';
        x.fillText(`B${i + 1}${i === ariza ? ' !' : ''}`, cx, ust - 14);
      });
      x.strokeStyle = '#0b2540'; x.setLineDash([8, 6]); x.lineWidth = 2;
      x.beginPath(); x.moveTo(30, yOf(sp)); x.lineTo(W - 30, yOf(sp)); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#33414e'; x.font = '500 18px "Space Grotesk", sans-serif'; x.textAlign = 'left';
      x.fillText(`SP ${sp}°C · ${ADIMLAR[adim]}${adim === 'pisirme' ? ` · ${Math.ceil(kalan)} s` : ''} · parça ${parca}`, 22, H - 64);
      x.fillStyle = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' }[d.seviye];
      x.fillRect(0, H - 40, W, 40);
      x.fillStyle = '#fff'; x.font = '700 20px "Space Grotesk", sans-serif'; x.textAlign = 'center';
      x.fillText(d.metin, W / 2, H - 20);
    });
  }

  const ADIMLAR = {
    isinma: 'Isınma', kapaniyor: 'Pres kapanıyor', pisirme: 'Vulkanizasyon', aciliyor: 'Pres açılıyor',
    bosaltma: 'Boşaltma / yükleme', durdu: 'Beklemede', acil: 'Acil stop',
  };
  function durumBilgi() {
    if (adim === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (ariza >= 0) return { metin: `B${ariza + 1} REZİSTANS KOPUK (akım yok)`, seviye: 'alarm' };
    if (adim === 'durdu') return { metin: 'BEKLEMEDE · sıcaklık tutuluyor', seviye: 'bekliyor' };
    if (adim === 'isinma') return { metin: 'ISINMA', seviye: 'uyari' };
    if (adim === 'pisirme') return { metin: `VULKANİZASYON · ${Math.ceil(kalan)} s`, seviye: 'calisiyor' };
    return { metin: ADIMLAR[adim].toLocaleUpperCase('tr'), seviye: 'calisiyor' };
  }

  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { calis = true; durdurIstek = false; if (adim === 'durdu') adimaGec('isinma'); } },
      { metin: 'Durdur', tur: 'dur', tik: () => {
        if (adim === 'isinma') { calis = false; adimaGec('durdu'); } else if (adim !== 'durdu' && adim !== 'acil') durdurIstek = true;
      } },
    ] },
    { tip: 'secim', metin: 'Kontrol modu', secenekler: [['pid', 'PID (±%1)'], ['onoff', 'Aç-Kapa termostat']], get: () => mod,
      set: (v) => {
        // geçişte görünen model diğerinin durumunu devralır (sahne sıçramasın)
        const eski = mod; mod = v;
        bolgeler.forEach((b) => { b[v].T = b[eski].T; b[v].Th = b[eski].Th; b[v].pid.sifirla(); });
      } },
    { tip: 'kaydirici', metin: 'Sıcaklık setpoint', min: 120, max: 200, adim: 1, birim: '°C', get: () => sp, set: (v) => (sp = v) },
    { tip: 'kaydirici', metin: 'Pişirme süresi', min: 10, max: 90, adim: 5, birim: 's', get: () => pisirmeSure, set: (v) => (pisirmeSure = v) },
    { tip: 'baslik', metin: 'Arıza enjeksiyonu' },
    { tip: 'secim', metin: 'Rezistans kopuk', secenekler: [['-1', 'Yok'], ['0', 'Bölge 1'], ['1', 'Bölge 2'], ['2', 'Bölge 3'], ['3', 'Bölge 4']],
      get: () => String(ariza), set: (v) => (ariza = +v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => adimaGec('acil') },
      { metin: 'Reset', tik: () => { if (adim === 'acil') { calis = false; adimaGec('durdu'); } } },
    ] },
  ];

  const sapmaYuzde = () => {
    const s = bolgeler.filter((_, i) => i !== ariza).map((b) => Math.abs(b.olcum - sp) / sp * 100);
    return s.length ? Math.max(...s) : 0;
  };
  const toplamE = (k) => bolgeler.reduce((s, b) => s + b[k].E, 0);

  // performans: inen-kalkan üst tabla grubunun (koç) kendi içindeki sabit parçaları da birleştir
  if (lib.sabitle && new URLSearchParams(location.search).get('sabit') !== '0') lib.sabitle(ram, []);

  return {
    id: 'pres',
    ad: 'Rezistanslı Vulkanizasyon Presi',
    altBaslik: 'Isıtıcı PID ±%1 · kauçuk',
    kisa: 'Kauçuk levha pişiren hidrolik pres. Rezistanslı tablalar 4 bölgede ayrı PID ile ±%1 hassasiyette tutulur; aç-kapa kontrole göre enerji farkı canlı hesaplanır.',
    proje: 'resistance-automation',
    ayakIzi: [9.8, 5.8],
    ayakIziMerkez: [-0.5, 0.7],
    kamera: { poz: [3.4, 3.2, 7.0], hedef: [0.0, 1.15, 0.4] },
    mekanizmalar: [
      'Üst tabla (koç): 12 hidrolik silindirle 400 mm iner/kalkar, levhayı alt tablaya bastırır',
      '4 ısıtma bölgesi: tabla rengi sıcaklıkla gri → koyu kırmızı → turuncu',
      'Kauçuk levha: pişme ilerledikçe kahverengimsi griden mat siyaha döner',
      'Boşaltma: pişen levha ön rulolu masaya kayar, yerine ham levha girer',
      'Taç üstündeki buat lambası pişirmede yanar, acil stopta yanıp söner',
      'Operatör: pişen levha masaya çıkınca alır, katlayıp istif paletine koyar; arada panodaki HMI\'yı izler, alarmda panoya döner',
    ],
    cikarim: [
      'Videodaki uzun taç kirişi ve altındaki krom çubuk sırası → çok silindirli (2 × 6) üst koç kabul edildi; silindir sayısı TAHMİN.',
      'Yan kolonlar, alttaki koyu tabla ve hortum/kablo demetleri video karelerinden; ölçüler (~5 m boy, 1.3 m derinlik) oranlama ile TAHMİN.',
      'Taç üstündeki kırmızı ışıklı beyaz kutu (ilk kare) → buat + durum lambası.',
      '4 bölge ve ±%1 hedef portföy açıklamasından; bölge sayısı TAHMİN.',
      'TAHMİN: operatör iş akışı (levhayı masadan alıp istif paletine koyma, ham levha beslemesi pres tarafından) ve istif paletinin yeri; videoda operatör görünmüyor.',
      'Enerji karşılaştırması temsili bir ısıl modelden (eleman + tabla, iki kütle) hesaplanır; bu model ~%9–10 fark veriyor. Portföydeki %20 sahadaki ölçüm — teyit edilmeli. Sayaçta zaman ×30 sıkıştırılmıştır.',
    ],
    group: g,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (lib.sabitle)
    sabitHaric: () => [ram, kaucuk, bitmis, ...istifKat],   // koç, kayan levha, masadaki levha, istif katları
    update,
    kontroller,
    degerler: () => {
      const ep = toplamE('pid'), eo = toplamE('onoff');
      return [
        ['Adım', ADIMLAR[adim] + (adim === 'pisirme' ? ` (${Math.ceil(kalan)} s)` : '')],
        ...bolgeler.map((b, i) => [`Bölge ${i + 1}`, `${fmt(b.olcum, 1)} °C${i === ariza ? ' · ARIZA' : ''}`]),
        ['En büyük sapma', `%${fmt(sapmaYuzde(), 2)}`],
        ['Anlık güç', `${fmt(bolgeler.reduce((s, b) => s + aktif(b).u, 0) * BOLGE_KW, 1)} kW`],
        ['Enerji · PID', `${fmt(ep, 2)} kWh`],
        ['Enerji · Aç-Kapa', `${fmt(eo, 2)} kWh`],
        ['PID tasarrufu', eo > 0.5 ? `%${fmt((1 - ep / eo) * 100, 1)}` : '—'],
        ['Pişen parça', String(parca)],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
