// js/machines/yangin.js — Yangın Tüpü Kovanı Hattı (derin çekme presi + sıvama makinesi).
//
// Kaan'ın tarifi (2026-10-23): MKN-V08 ve MKN-V02 aynı pres — 4 kolonlu, çift
// istasyonlu hidrolik pres yuvarlak sac diskten yangın tüpü KOVANININ ilk halini
// derin çekerek çıkarır; panosunda Delta HMI "Üretim Adedi, Pompa 1 / Pompa 2,
// Koç Aşağı İniyor". MKN-V06 ayrı makine: kovanın ilk halini SIVAR — yüzey
// pürüzünü giderir, kenardaki çıkıntıları (kulakları) kırpar, tüpün tam şeklini
// verir; HMI "SIVAMA SÜRESİ 1.0 SANİYE", 3 sarı acil stoplu pano, hidrolik ünite.
//
// Akış: disk stoğu → pres (iki istasyon aynı anda) → ara kasa → sıvama →
// bitmiş kovan paleti. Ölçüler, kalıp ve operatör akışı TAHMİN; süreler hızlandırıldı.

export function create(lib) {
  const {
    THREE, M, box, cyl, sphere, rod, pipe, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, pano, levha,
    clamp, lerp, damp, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ortak malzeme / kovan geometrisi
  const presGri = mat(0x5b6168, { r: 0.55, m: 0.45, key: 'yangin-pres' });
  const kovanMat = new THREE.MeshStandardMaterial({ color: 0x9ba2a9, roughness: 0.48, metalness: 0.85, side: THREE.DoubleSide });
  const bitmisMat = new THREE.MeshStandardMaterial({ color: 0xd3d8dc, roughness: 0.16, metalness: 1, side: THREE.DoubleSide });
  const yirtikMat = new THREE.MeshStandardMaterial({
    color: 0x9b4a3e, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide, emissive: 0xff2a10, emissiveIntensity: 0.6,
  });
  // Birim kovan: yarıçap 1, yükseklik 1, dip kapalı, ağız açık. Ölçek (r, h, r) ile şekillenir.
  const kovanGeo = new THREE.LatheGeometry(
    [[0, 0], [0.8, 0], [0.96, 0.03], [1, 0.09], [1, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  function kovan(parent, malzeme = kovanMat) {
    const m = new THREE.Mesh(kovanGeo, malzeme);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  // Kulaklar (derin çekmede ağızda oluşan dalgalı çıkıntılar) — birim kovanın ağzında
  function kulaklar(kov) {
    const k = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const e = box(0.55, 0.14, 0.08, kovanMat, Math.cos(a) * 1.0, 1.05, Math.sin(a) * 1.0, k);
      e.rotation.y = -a + Math.PI / 2;
    }
    kov.add(k);
    return k;
  }
  // Operatör: ortak lib.operator modeli (FK-1000 sahnesindeki gibi); yüz +Z.
  // el = önde iki elin arasında taşıma noktası ('tasi' pozunda eller burada buluşur)
  function isciKur(x, z, renk) {
    const op = lib.operator({ yelek: renk });
    const o = op.group;
    g.add(o);
    const el = new THREE.Group();
    el.position.set(0, 0.98, 0.44);
    o.add(el);
    return { g: o, op, x, z, yon: 0, adimlar: [], el, yuruyor: false, metin: 'bekliyor' };
  }

  // ---------------------------------------------------------------- 1) çift istasyonlu derin çekme presi
  const PX = -2.6, PZ = -0.4;
  const TY = 0.95;                 // tabla üstü
  const CY0 = 3.25;                // taç alt yüzü
  const DIE_Y = TY + 0.6;          // matris (kalıp) üst yüzü
  const PUNCH_L = 0.55;
  const RAM_UST = DIE_Y + 1.2;     // koç alt yüzü (açık)
  const RAM_TEMAS = DIE_Y + PUNCH_L;
  const ISTASYON = [-0.48, 0.48];
  const R0 = 0.09;                 // çekilmiş kovan yarıçapı

  box(2.3, TY - 0.05, 1.3, presGri, PX, (TY - 0.05) / 2, PZ, g);           // gövde / alt tabla
  box(2.2, 0.06, 1.2, M.celik, PX, TY - 0.02, PZ, g);                        // bolster plakası
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(0.06, CY0 - TY, M.krom, PX + sx * 0.95, (CY0 + TY) / 2, PZ + sz * 0.45, g, { seg: 18 });
    cyl(0.1, 0.12, M.koyu, PX + sx * 0.95, TY + 0.06, PZ + sz * 0.45, g, { seg: 18 });
  }
  box(2.4, 0.5, 1.3, presGri, PX, CY0 + 0.25, PZ, g);                       // taç
  cyl(0.24, 0.8, presGri, PX, CY0 + 0.9, PZ, g, { seg: 28 });               // ana silindir
  cyl(0.27, 0.08, M.koyu, PX, CY0 + 1.32, PZ, g, { seg: 28 });
  pipe([[PX + 0.2, CY0 + 1.2, PZ + 0.2], [PX + 0.9, CY0 + 1.2, PZ + 0.2], [PX + 0.9, CY0 + 0.5, PZ + 0.55]], 0.025, M.siyah, g);
  pipe([[PX - 0.2, CY0 + 0.6, PZ + 0.2], [PX - 1.0, CY0 + 0.6, PZ + 0.6], [PX - 1.0, 0.6, PZ + 0.7]], 0.025, M.siyah, g);

  // koç (hareketli): plaka + kolon burçları + iki zımba; mil tacına uzanır
  const ram = new THREE.Group();
  g.add(ram);
  box(2.05, 0.16, 1.05, presGri, PX, 0.08, PZ, ram);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.1, 0.22, M.koyu, PX + sx * 0.95, 0.08, PZ + sz * 0.45, ram, { seg: 16 });
  ISTASYON.forEach((dx) => {
    cyl(0.14, 0.08, M.koyu, PX + dx, -0.04, PZ, ram, { seg: 22 });
    cyl(0.086, PUNCH_L - 0.08, M.krom, PX + dx, -0.08 - (PUNCH_L - 0.08) / 2, PZ, ram, { seg: 22 });
  });
  const milGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 18);
  milGeo.translate(0, 0.5, 0);
  const mil = new THREE.Mesh(milGeo, M.krom);
  mil.position.set(PX, 0, PZ);
  mil.castShadow = true;
  g.add(mil);

  // matris (kalıp) istasyonları: halka + 3 ayak + sıyırıcı kılavuz milleri; çekilen kovan halkanın altında görünür
  ISTASYON.forEach((dx) => {
    cyl(0.2, 0.1, M.celik, PX + dx, DIE_Y - 0.05, PZ, g, { seg: 28 });
    cyl(0.1, 0.004, M.siyah, PX + dx, DIE_Y + 0.002, PZ, g, { seg: 24 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      box(0.05, DIE_Y - 0.1 - TY, 0.05, M.koyu, PX + dx + Math.cos(a) * 0.17, (DIE_Y - 0.1 + TY) / 2, PZ + Math.sin(a) * 0.17, g);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      cyl(0.014, 0.5, M.krom, PX + dx + Math.cos(a) * 0.25, DIE_Y + 0.25, PZ + Math.sin(a) * 0.25, g, { seg: 10 });
    }
  });
  // presteki iki parça: sac disk (blank) + çekilen kovan
  const presDisk = ISTASYON.map((dx) => cyl(0.17, 0.006, M.celik, PX + dx, DIE_Y + 0.004, PZ, g, { seg: 30 }));
  const presKovan = ISTASYON.map((dx) => {
    const k = kovan(g);
    k.position.set(PX + dx, DIE_Y, PZ);
    return { m: k, kulak: kulaklar(k) };
  });

  // pres panosu (MKN-V02): uzun dar pano, Delta HMI, R/S/T faz lambaları, seçici şalterler
  const PNX = PX + 1.6, PNZ = PZ + 0.55;
  pano(g, PNX, 0, PNZ, 0.55, 1.95, 0.3, 0);
  const presEkran = new Ekran(0.3, 0.19, 512);
  presEkran.mesh.position.set(PNX, 1.62, PNZ + 0.162);
  g.add(presEkran.mesh);
  box(0.36, 0.25, 0.02, M.siyah, PNX, 1.62, PNZ + 0.152, g);
  const faz = [0xe5302a, 0x2ea043, 0xe5302a].map((r, i) => {
    const m = lamba(r, 1.6);
    cyl(0.028, 0.03, m, PNX - 0.12 + i * 0.12, 1.3, PNZ + 0.16, g, { eksen: 'z', seg: 16 });
    return m;
  });
  for (let i = 0; i < 4; i++) {
    cyl(0.022, 0.03, M.siyah, PNX - 0.08 + (i % 2) * 0.16, 1.05 - Math.floor(i / 2) * 0.16, PNZ + 0.16, g, { eksen: 'z', seg: 12 });
    box(0.008, 0.032, 0.012, M.beyaz, PNX - 0.08 + (i % 2) * 0.16, 1.05 - Math.floor(i / 2) * 0.16, PNZ + 0.178, g);
  }
  acilStop(g, PNX, 0.72, PNZ + 0.17, 0);
  const kulePres = kuleLambasi(g, PNX + 0.18, 1.95, PNZ);

  // disk stoğu (paletli)
  const STOK = { x: -5.3, z: 1.1 };
  box(1.0, 0.12, 1.0, M.ahsap, STOK.x, 0.06, STOK.z, g);
  const stokYigin = [-0.24, 0.24].map((dx) => cyl(0.17, 1, M.celik, STOK.x + dx, 0.12, STOK.z, g, { seg: 30 }));

  // ara kasa (preslenen kovanlar) — mavi plastik kasa, 4×3 yuva
  const KASA = { x: 0.55, z: 1.15 }, KASA_KAP = 12;
  const kasaMat = mat(0x2563b0, { r: 0.7, m: 0.05, key: 'kasa' });
  box(0.9, 0.04, 0.66, kasaMat, KASA.x, 0.02, KASA.z, g);
  for (const sz of [-1, 1]) box(0.9, 0.36, 0.03, kasaMat, KASA.x, 0.18, KASA.z + sz * 0.33, g);
  for (const sx of [-1, 1]) box(0.03, 0.36, 0.66, kasaMat, KASA.x + sx * 0.45, 0.18, KASA.z, g);
  const kasaKovan = [];
  for (let i = 0; i < KASA_KAP; i++) {
    const k = kovan(g);
    k.position.set(KASA.x - 0.33 + (i % 4) * 0.22, 0.04, KASA.z - 0.21 + Math.floor(i / 4) * 0.21);
    k.scale.set(R0, 0.3, R0);
    k.visible = false;
    kasaKovan.push(k);
  }

  // ---------------------------------------------------------------- 2) sıvama makinesi (MKN-V06)
  const SX = 3.0, SZ = -0.5, BASE_Y = 0.91;
  box(1.0, 0.85, 0.85, presGri, SX, 0.425, SZ, g);
  for (const sx of [-1, 1]) box(0.12, 1.85, 0.12, presGri, SX + sx * 0.45, 0.85 + 0.925, SZ - 0.33, g);
  box(1.02, 0.16, 0.2, presGri, SX, 2.75, SZ - 0.3, g);                            // üst kiriş
  box(0.3, 0.16, 0.5, presGri, SX, 2.75, SZ - 0.1, g);                             // punta kolu
  cyl(0.08, 0.38, M.alu, SX, 2.5, SZ, g, { seg: 18 });                             // punta silindiri
  // 3 sarı acil stop kutusu (üst kirişte)
  for (const dx of [-0.32, 0, 0.32]) acilStop(g, SX + dx, 2.75, SZ - 0.19, 0);
  // dönen iş mili: ayna + mandrel + kovan
  cyl(0.16, 0.06, M.koyu, SX, BASE_Y - 0.03, SZ, g, { seg: 28 });
  const mili = new THREE.Group();
  mili.position.set(SX, 0, SZ);
  g.add(mili);
  cyl(0.11, 0.04, M.celik, 0, BASE_Y + 0.01, 0, mili, { seg: 6 });               // ayna (altıgen: dönüş görünsün)
  cyl(0.076, 0.36, M.krom, 0, BASE_Y + 0.2, 0, mili, { seg: 20 });                // mandrel
  const sivKovan = kovan(mili);
  sivKovan.rotation.x = Math.PI;                                                   // ağız aşağı, mandrele geçirilir
  const sivKulak = kulaklar(sivKovan);
  // punta (yukarıdan kovan dibine basar)
  const puntaGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 14);
  puntaGeo.translate(0, -0.5, 0);
  const puntaMil = new THREE.Mesh(puntaGeo, M.krom);
  puntaMil.position.set(SX, 2.31, SZ);
  g.add(puntaMil);
  const puntaPabuc = cyl(0.065, 0.05, M.celik, SX, 2.0, SZ, g, { seg: 18 });
  // sıvama makarası: sol kolonda dikey kızak + kol + makara
  box(0.05, 1.5, 0.05, M.krom, SX - 0.39, 1.6, SZ - 0.24, g);
  const makaraKol = new THREE.Group();
  g.add(makaraKol);
  box(0.14, 0.12, 0.12, M.koyu, SX - 0.39, 0, SZ - 0.24, makaraKol);
  box(0.26, 0.05, 0.05, M.celik, SX - 0.25, 0, SZ - 0.12, makaraKol).rotation.y = -0.65;
  const makara = cyl(0.045, 0.05, M.krom, 0, 0, 0, makaraKol, { seg: 16 });
  // kırpma bıçağı: sağdan radyal gelir
  const bicak = new THREE.Group();
  g.add(bicak);
  box(0.3, 0.05, 0.08, M.koyu, 0.15, 0, 0, bicak);
  box(0.05, 0.02, 0.06, M.krom, -0.02, 0, 0, bicak);
  // hurda kutusu + düşen kırpıntı halkası
  const HURDA = { x: SX + 0.78, z: SZ + 0.62 };
  box(0.4, 0.3, 0.32, M.koyu, HURDA.x, 0.15, HURDA.z, g);
  const hurdaDolu = box(0.36, 0.01, 0.28, M.celik, HURDA.x, 0.03, HURDA.z, g);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.008, 6, 24), kovanMat);
  halka.rotation.x = Math.PI / 2;
  halka.visible = false;
  g.add(halka);

  // hidrolik güç ünitesi (tank + yeşil motor + valf bloğu + manometre)
  const HU = { x: 4.75, z: -1.0 };
  box(0.85, 0.55, 0.6, mat(0x9ea5aa, { r: 0.6, m: 0.4, key: 'tank' }), HU.x, 0.275, HU.z, g);
  cyl(0.13, 0.42, mat(0x3f8f4b, { r: 0.5, m: 0.3, key: 'motor-yesil' }), HU.x + 0.15, 0.72, HU.z, g, { eksen: 'x', seg: 18 });
  for (let i = 0; i < 3; i++) box(0.09, 0.09, 0.2, M.mavi, HU.x - 0.25, 0.62 + i * 0.1, HU.z + 0.05, g);
  cyl(0.07, 0.025, M.beyaz, HU.x - 0.25, 1.0, HU.z + 0.12, g, { eksen: 'z', seg: 20 });
  pipe([[HU.x - 0.3, 0.7, HU.z + 0.2], [SX + 0.6, 0.7, SZ + 0.1], [SX + 0.5, 2.7, SZ - 0.2]], 0.018, M.siyah, g);

  // sıvama panosu + dokunmatik HMI ("SIVAMA SÜRESİ")
  const SPX = SX + 1.25, SPZ = SZ + 0.85;
  pano(g, SPX, 0, SPZ, 0.5, 1.15, 0.25, 0);
  const sivLamba = [0x2ea043, 0xf2a900, 0xe5302a].map((r, i) => {
    const m = lamba(r, 0.05);
    cyl(0.025, 0.03, m, SPX - 0.12 + i * 0.12, 0.8, SPZ + 0.135, g, { eksen: 'z', seg: 14 });
    return m;
  });
  const sivEkran = new Ekran(0.24, 0.16, 384);
  sivEkran.mesh.position.set(SX - 0.39, 1.55, SZ + 0.08);
  g.add(sivEkran.mesh);
  box(0.3, 0.22, 0.04, M.siyah, SX - 0.39, 1.55, SZ + 0.05, g);
  const kuleSiv = kuleLambasi(g, SPX + 0.15, 1.15, SPZ);

  // bitmiş kovan paleti (4×4)
  const PAL = { x: 5.35, z: 1.25 };
  box(1.0, 0.12, 1.0, M.ahsap, PAL.x, 0.06, PAL.z, g);
  const palKovan = [];
  for (let i = 0; i < 16; i++) {
    const k = kovan(g, bitmisMat);
    k.position.set(PAL.x - 0.36 + (i % 4) * 0.24, 0.12, PAL.z - 0.36 + Math.floor(i / 4) * 0.24);
    k.scale.set(0.085, 0.38, 0.085);
    k.visible = false;
    palKovan.push(k);
  }
  const lv = levha(['YANGIN TÜPÜ KOVANI', 'derin çekme → sıvama'], 1.6, 0.36, { bg: '#7a1712', fg: '#fff', font: 58, px: 640 });
  lv.position.set(PX, CY0 + 0.25, PZ + 0.66);
  g.add(lv);

  // operatörler + taşınan parçalar
  const op1 = isciKur(PX, PZ + 1.2, 0xff7a1a);
  const op2 = isciKur(SX, SZ + 1.3, 0xffd400);
  const elDisk = [-0.12, 0.12].map((dx) => cyl(0.17, 0.006, M.celik, dx, 0, 0, op1.el, { seg: 24 }));
  const elKovan1 = [-0.12, 0.12].map((dx) => { const k = kovan(op1.el); k.position.set(dx, -0.1, 0); k.scale.set(R0, 0.3, R0); return k; });
  const elKovan2 = kovan(op2.el);
  elKovan2.position.y = -0.15;
  const tasi = (liste, v) => liste.forEach((m) => (m.visible = v));
  tasi(elDisk, false); tasi(elKovan1, false); elKovan2.visible = false;

  const NOKTA = {
    stok: { x: STOK.x + 0.95, z: STOK.z, yon: -Math.PI / 2 },
    pres: { x: PX, z: PZ + 1.2, yon: Math.PI },
    kasa1: { x: KASA.x - 0.75, z: KASA.z + 0.1, yon: Math.PI / 2 },
    kasa2: { x: KASA.x + 0.75, z: KASA.z + 0.1, yon: -Math.PI / 2 },
    siv: { x: SX, z: SZ + 1.15, yon: Math.PI },
    palet: { x: PAL.x - 0.95, z: PAL.z, yon: Math.PI / 2 },
  };
  const yuru = (n) => ({ tip: 'yuru', x: n.x, z: n.z, son: n.yon });
  const is = (sure, yon, metin, bit, guncelle) => ({ tip: 'is', sure, yon, metin, bit, guncelle });

  function opGuncelle(o, dt, tm, aktif) {
    const a = o.adimlar[0];
    o.yuruyor = false;
    if (a && aktif) {
      if (a.tip === 'yuru') {
        const dx = a.x - o.x, dz = a.z - o.z, d = Math.hypot(dx, dz), adim = 1.4 * dt;
        if (d <= adim) { o.x = a.x; o.z = a.z; if (a.son != null) o.yon = a.son; o.adimlar.shift(); }
        else { o.x += (dx / d) * adim; o.z += (dz / d) * adim; o.yon = Math.atan2(dx, dz); o.yuruyor = true; }
        o.metin = 'yürüyor';
      } else {
        if (!a._b) { a._b = true; a._t = 0; }
        a._t += dt;
        if (a.yon != null) o.yon = a.yon;
        o.metin = a.metin;
        const k = Math.min(1, a._t / a.sure);
        a.guncelle?.(k);
        if (k >= 1) { o.adimlar.shift(); a.bit?.(); }
      }
    } else if (!a) o.metin = 'bekliyor';
    // poz: elde parça varken 'tasi', makineye koyup alırken 'on', yürürken/beklerken 'yan'
    const elDolu = o.el.children.some((c) => c.visible);
    o.op.poz(elDolu ? 'tasi' : a && a.tip === 'is' && aktif ? 'on' : 'yan');
    const zipla = o.op.yuru(tm, o.yuruyor);
    o.g.position.set(o.x, zipla, o.z);
    let f = o.yon - o.g.rotation.y;
    f = Math.atan2(Math.sin(f), Math.cos(f));
    o.g.rotation.y += f * (1 - Math.exp(-10 * dt));
  }

  // ---------------------------------------------------------------- hat mantığı
  let durum = 'calisiyor';        // calisiyor | durdu | acil | ariza
  let basinc = 160;               // Pompa 1 çekme basıncı ayarı (bar)
  let pompa2Ayar = 50;            // Pompa 2 hızlı yaklaşma (bar)
  let derinlikMm = 320;           // çekme derinliği (strok)
  let sivamaSure = 1.0;           // s
  let yirtilmaKurulu = false;
  let stok = 40, kasa = 4, bitmis = 0, uretim = 0, presAdet = 0, hurdaYirtik = 0, kirpinti = 0;
  let stokBosT = 0, mesaj = '';
  const derinlik = () => derinlikMm / 1000;

  const pres = { faz: 'bekle', t: 0, ramY: RAM_UST, p1: 0, p2: 0, gorev: false, parca: 'yok', cekK: 0, cikK: 0, yirtik: false, donBas: RAM_UST, kasaBekle: false };
  const PRES_FAZ = {
    bekle: 'Yükleme bekleniyor', yukle: 'Disk yükleniyor', yaklas: 'Koç Aşağı İniyor', cek: 'Derin Çekme',
    bekleme: 'Basınçta Bekleme', don: 'Koç Yukarı Çıkıyor', cikar: 'İtici: Kovan Çıkıyor', al: 'Kovan Alınıyor',
  };
  function presGec(f) { pres.faz = f; pres.t = 0; pres.gorev = false; }

  function presGuncelle(dt) {
    const P = pres;
    P.t += dt;
    switch (P.faz) {
      case 'bekle':
        if (stok >= 2 && !op1.adimlar.length) {
          op1.adimlar = [
            yuru(NOKTA.stok),
            is(0.6, NOKTA.stok.yon, 'stoktan disk alıyor', () => { stok -= 2; tasi(elDisk, true); }),
            yuru(NOKTA.pres),
            is(0.8, NOKTA.pres.yon, 'diskleri kalıplara koyuyor', () => { tasi(elDisk, false); P.parca = 'disk'; P.cekK = 0; P.cikK = 0; }),
          ];
          presGec('yukle');
        }
        break;
      case 'yukle':
        if (!op1.adimlar.length) presGec('yaklas');
        break;
      case 'yaklas': {
        const k = Math.min(1, P.t / 0.9);
        P.ramY = lerp(RAM_UST, RAM_TEMAS, easeInOut(k));
        if (k >= 1) { P.parca = 'cekiliyor'; presGec('cek'); }
        break;
      }
      case 'cek': {
        const k = Math.min(1, P.t / 1.6);
        P.cekK = k;
        P.ramY = RAM_TEMAS - k * derinlik();
        if (yirtilmaKurulu && k > 0.55) {
          yirtilmaKurulu = false; P.yirtik = true; durum = 'ariza'; mesaj = 'KALIPTA YIRTILMA';
          break;
        }
        if (k >= 1) presGec('bekleme');
        break;
      }
      case 'bekleme':
        if (P.t > 0.3) { P.parca = 'kovan'; P.donBas = P.ramY; presGec('don'); }
        break;
      case 'don': {
        const k = Math.min(1, P.t / 1.1);
        P.ramY = lerp(P.donBas, RAM_UST, easeInOut(k));
        if (k >= 1) presGec(P.parca === 'kovan' ? 'cikar' : 'bekle');
        break;
      }
      case 'cikar':
        P.cikK = Math.min(1, P.t / 0.6);
        if (P.cikK >= 1) presGec('al');
        break;
      case 'al':
        if (!P.gorev) {
          if (kasa + 2 > KASA_KAP) { P.kasaBekle = true; break; }
          P.kasaBekle = false;
          P.gorev = true;
          op1.adimlar = [
            is(0.6, NOKTA.pres.yon, 'kovanları alıyor', () => { P.parca = 'yok'; tasi(elKovan1, true); }),
            yuru(NOKTA.kasa1),
            is(0.6, NOKTA.kasa1.yon, 'ara kasaya koyuyor', () => { tasi(elKovan1, false); kasa += 2; presAdet += 2; }),
          ];
        } else if (!op1.adimlar.length) presGec('bekle');
        break;
    }
    // pompalar: Pompa 1 çekme basıncı, Pompa 2 hızlı yaklaşma/dönüş
    const p1h = P.faz === 'cek' ? basinc * (0.35 + 0.65 * Math.sin(Math.min(1, P.cekK * 1.25) * Math.PI / 2))
      : P.faz === 'bekleme' ? basinc : 4;
    const p2h = P.faz === 'yaklas' || P.faz === 'don' ? pompa2Ayar : P.faz === 'cikar' ? pompa2Ayar * 0.6 : 3;
    P.p1 = damp(P.p1, p1h, 10, dt);
    P.p2 = damp(P.p2, p2h, 10, dt);
  }

  const siv = { faz: 'bos', t: 0, gorev: false, k: 0, punta: 0, parca: false, kulak: true, halkaT: -1 };
  const SIV_FAZ = {
    bos: 'Kovan bekleniyor', tak: 'Kovan takılıyor', sik: 'Punta sıkıyor', sivama: 'Sıvama', kirp: 'Kenar kırpma',
    ac: 'Punta açılıyor', cikar: 'Kovan alınıyor',
  };
  function sivGec(f) { siv.faz = f; siv.t = 0; siv.gorev = false; }

  function sivGuncelle(dt) {
    const S = siv;
    S.t += dt;
    switch (S.faz) {
      case 'bos':
        if (kasa > 0 && !op2.adimlar.length) {
          op2.adimlar = [
            yuru(NOKTA.kasa2),
            is(0.6, NOKTA.kasa2.yon, 'ara kasadan kovan alıyor', () => { kasa--; elKovan2.material = kovanMat; elKovan2.visible = true; }),
            yuru(NOKTA.siv),
            is(0.7, NOKTA.siv.yon, 'kovanı mandrele takıyor', () => { elKovan2.visible = false; S.parca = true; S.k = 0; S.kulak = true; }),
          ];
          sivGec('tak');
        }
        break;
      case 'tak':
        if (!op2.adimlar.length) sivGec('sik');
        break;
      case 'sik':
        S.punta = Math.min(1, S.t / 0.5);
        if (S.punta >= 1) sivGec('sivama');
        break;
      case 'sivama':
        S.k = Math.min(1, S.t / sivamaSure);
        if (S.k >= 1) sivGec('kirp');
        break;
      case 'kirp':
        if (S.kulak && S.t >= 0.35) { S.kulak = false; S.halkaT = 0; kirpinti++; }
        if (S.t >= 0.7) sivGec('ac');
        break;
      case 'ac':
        S.punta = 1 - Math.min(1, S.t / 0.5);
        if (S.punta <= 0) sivGec('cikar');
        break;
      case 'cikar':
        if (!S.gorev) {
          S.gorev = true;
          op2.adimlar = [
            is(0.6, NOKTA.siv.yon, 'sıvanmış kovanı alıyor', () => { S.parca = false; elKovan2.material = bitmisMat; elKovan2.visible = true; }),
            yuru(NOKTA.palet),
            is(0.6, NOKTA.palet.yon, 'palete diziyor', () => { elKovan2.visible = false; bitmis++; uretim++; }),
          ];
        } else if (!op2.adimlar.length) sivGec('bos');
        break;
    }
  }

  // ---------------------------------------------------------------- görseller
  const _kovH = (k) => lerp(derinlik(), derinlik() * 1.18, k);
  function gorsel(dt, tm) {
    // pres
    ram.position.y = pres.ramY;
    mil.position.y = pres.ramY + 0.16;
    mil.scale.y = Math.max(0.01, CY0 - pres.ramY - 0.16);
    const h = Math.max(0.001, derinlik() * pres.cekK);
    for (let i = 0; i < 2; i++) {
      const d = presDisk[i], c = presKovan[i];
      d.visible = pres.parca === 'disk' || (pres.parca === 'cekiliyor' && pres.cekK < 0.98);
      const r = lerp(1, 0.56, pres.cekK);
      d.scale.set(r, 1, r);
      c.m.visible = pres.parca === 'cekiliyor' || pres.parca === 'kovan';
      c.m.scale.set(R0, h, R0);
      c.m.position.y = DIE_Y - h + pres.cikK * (h + 0.012);
      c.m.material = pres.yirtik ? yirtikMat : kovanMat;
      c.kulak.visible = pres.cekK > 0.85;
    }
    kasaKovan.forEach((k, i) => (k.visible = i < kasa));
    stokYigin.forEach((s, i) => {
      const n = Math.floor(stok / 2) + (i < stok % 2 ? 1 : 0);
      s.visible = n > 0;
      s.scale.y = Math.max(0.001, n * 0.006);
      s.position.y = 0.12 + (n * 0.006) / 2;
    });
    // sıvama
    const sr = lerp(R0, 0.085, siv.k), sh = _kovH(siv.k);
    sivKovan.visible = siv.parca;
    sivKovan.scale.set(sr, sh, sr);
    sivKovan.position.y = BASE_Y + sh;
    sivKovan.material = siv.k > 0.5 ? bitmisMat : kovanMat;
    sivKulak.visible = siv.kulak;
    const doner = durum === 'calisiyor' && (siv.faz === 'sivama' || siv.faz === 'kirp');
    if (doner) mili.rotation.y += 28 * dt;
    const puntaUst = 2.0, puntaAlt = BASE_Y + (siv.parca ? sh : 0.36) + 0.03;
    puntaPabuc.position.y = lerp(puntaUst, puntaAlt, easeInOut(siv.punta));
    puntaMil.scale.y = Math.max(0.01, 2.31 - puntaPabuc.position.y);
    const makaraY = siv.faz === 'sivama' ? BASE_Y + sh * (1 - siv.k) + 0.04 : BASE_Y + sh + 0.12;
    makaraKol.position.y = damp(makaraKol.position.y || makaraY, makaraY, 18, dt);
    makara.position.set(SX - (sr + 0.045), 0, SZ);
    if (doner) makara.rotation.y -= 40 * dt;
    const bk = siv.faz === 'kirp' ? Math.sin(Math.min(1, siv.t / 0.7) * Math.PI) : 0;
    bicak.position.set(SX + lerp(0.42, sr + 0.02, bk), BASE_Y + 0.025, SZ);
    if (siv.halkaT >= 0) {
      siv.halkaT += dt;
      const k = Math.min(1, siv.halkaT / 0.5);
      halka.visible = k < 1;
      halka.position.set(lerp(SX, HURDA.x, k), lerp(BASE_Y, 0.2, k) + Math.sin(k * Math.PI) * 0.15, lerp(SZ, HURDA.z, k));
      if (k >= 1) siv.halkaT = -1;
    }
    hurdaDolu.position.y = 0.03 + Math.min(0.24, (kirpinti + hurdaYirtik) * 0.004);
    palKovan.forEach((k, i) => { k.visible = bitmis > 0 && i < ((bitmis - 1) % 16) + 1; k.scale.y = _kovH(1); });
    elKovan2.scale.set(siv.parca ? sr : 0.085, _kovH(1), 0.085);
    elKovan1.forEach((k) => k.scale.set(R0, derinlik(), R0));
    // lambalar
    faz.forEach((m) => (m.emissiveIntensity = durum === 'acil' ? 0.2 : 1.6));
    sivLamba[0].emissiveIntensity = durum === 'calisiyor' && siv.faz !== 'bos' ? 2 : 0.05;
    sivLamba[1].emissiveIntensity = siv.faz === 'bos' || durum === 'durdu' ? 1.6 : 0.05;
    sivLamba[2].emissiveIntensity = durum === 'acil' || durum === 'ariza' ? (Math.sin(tm * 9) > 0 ? 2.4 : 0.1) : 0.05;
  }

  function presHmi(x, W, H) {
    x.fillStyle = '#cfd9e4'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#111'; x.fillRect(10, 10, 120, 40);
    x.fillStyle = '#fff'; x.font = '700 22px "Space Grotesk", sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText('⊐< doka', 20, 31);
    const ok = durum === 'calisiyor';
    x.fillStyle = ok ? '#30b94a' : durum === 'durdu' ? '#8a96a3' : '#e0402a';
    x.beginPath(); x.roundRect(W / 2 - 60, 16, 120, 28, 8); x.fill();
    x.fillStyle = '#fff'; x.font = '700 15px "Space Grotesk", sans-serif'; x.textAlign = 'center';
    x.fillText(ok ? 'OTOMATİK' : durum === 'durdu' ? 'HAZIR' : 'ALARM', W / 2, 31);
    const satir = (et, v, birim, y) => {
      x.fillStyle = '#1d2a36'; x.font = '600 21px "Space Grotesk", sans-serif'; x.textAlign = 'right';
      x.fillText(et, W * 0.47, y);
      x.fillStyle = '#9fc5ef'; x.fillRect(W * 0.5, y - 19, 110, 38);
      x.strokeStyle = '#4a6a8a'; x.lineWidth = 2; x.strokeRect(W * 0.5, y - 19, 110, 38);
      x.fillStyle = '#0b2540'; x.font = '700 22px "JetBrains Mono", monospace'; x.textAlign = 'center';
      x.fillText(String(v), W * 0.5 + 55, y + 1);
      x.fillStyle = '#1d2a36'; x.font = '600 19px "Space Grotesk", sans-serif'; x.textAlign = 'left';
      x.fillText(birim, W * 0.5 + 120, y);
    };
    satir('Üretim Adedi', presAdet, '', 92);
    satir('Pompa 1', Math.round(pres.p1), 'Bar', 148);
    satir('Pompa 2', Math.round(pres.p2), 'Bar', 204);
    const msj = durum === 'ariza' ? mesaj : durum === 'acil' ? 'ACİL STOP' : pres.kasaBekle ? 'Ara Kasa Dolu' : PRES_FAZ[pres.faz];
    x.fillStyle = durum === 'ariza' || durum === 'acil' ? '#e0402a' : '#f2a33a';
    x.fillRect(W * 0.14, H - 66, W * 0.72, 40);
    x.fillStyle = '#1d1306'; x.font = '700 21px "Space Grotesk", sans-serif'; x.textAlign = 'center';
    x.fillText(msj, W / 2, H - 46);
  }
  function sivHmi(x, W, H) {
    x.fillStyle = '#eef3f7'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#7fb8e8'; x.lineWidth = 4; x.strokeRect(6, 6, W - 12, H - 12);
    x.fillStyle = '#16324f'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 22px "Space Grotesk", sans-serif'; x.fillText('SIVAMA SÜRESİ', W / 2, 38);
    x.fillStyle = '#d7ebfb'; x.fillRect(W / 2 - 110, 64, 130, 52);
    x.strokeStyle = '#2f80c9'; x.lineWidth = 3; x.strokeRect(W / 2 - 110, 64, 130, 52);
    x.fillStyle = '#0b2540'; x.font = '700 30px "JetBrains Mono", monospace'; x.fillText(sivamaSure.toFixed(1), W / 2 - 45, 91);
    x.font = '600 18px "Space Grotesk", sans-serif'; x.fillText('SANİYE', W / 2 + 70, 91);
    x.fillStyle = '#33414e'; x.font = '600 16px "Space Grotesk", sans-serif';
    x.fillText(`Adet: ${uretim}   ·   ${SIV_FAZ[siv.faz]}`, W / 2, 150);
    x.fillStyle = durum === 'calisiyor' ? '#2ea043' : durum === 'durdu' ? '#8a96a3' : '#e0402a';
    x.fillRect(16, H - 48, W - 32, 30);
    x.fillStyle = '#fff'; x.font = '700 16px "Space Grotesk", sans-serif';
    x.fillText(durum === 'calisiyor' ? 'OTOMATİK' : durum === 'durdu' ? 'HAZIR' : durum === 'acil' ? 'ACİL STOP' : 'ARIZA', W / 2, H - 33);
  }

  const trend = new Trend([
    { ad: 'Koç (cm)', renk: '#39c5cf' },
    { ad: 'Pompa 1 (bar)', renk: '#f2c200' },
    { ad: 'Pompa 2 (bar)', renk: '#a371f7', kesik: true },
  ], { min: 0, max: 250, uzunluk: 300 });
  const ekranZ = throttle(5);

  function update(dt, tm) {
    if (durum === 'calisiyor') {
      presGuncelle(dt);
      sivGuncelle(dt);
      if (stok < 2) {
        stokBosT += dt;
        if (stokBosT > 3) { stok = 40; stokBosT = 0; }       // forklift yeni disk paleti getirir
      } else stokBosT = 0;
    } else {
      pres.p1 = damp(pres.p1, durum === 'ariza' ? pres.p1 : 0, 3, dt);
      pres.p2 = damp(pres.p2, 0, 3, dt);
    }
    const aktif = durum === 'calisiyor';
    opGuncelle(op1, dt, tm, aktif);
    opGuncelle(op2, dt, tm, aktif);
    gorsel(dt, tm);
    const d = durumBilgi();
    kulePres.set(d.seviye, tm);
    kuleSiv.set(d.seviye, tm);
    trend.ornekle(dt, [(RAM_UST - pres.ramY) * 100, pres.p1, pres.p2]);
    if (ekranZ(dt)) { presEkran.ciz(presHmi); sivEkran.ciz(sivHmi); }
  }

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'ariza') return { metin: mesaj || 'ARIZA', seviye: 'alarm' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (pres.kasaBekle) return { metin: 'ARA KASA DOLU · PRES BEKLİYOR', seviye: 'uyari' };
    return { metin: `OTOMATİK · ${PRES_FAZ[pres.faz].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
  }

  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'baslik', metin: 'Derin çekme presi (MKN-V08 / V02)' },
    { tip: 'kaydirici', metin: 'Çekme basıncı (Pompa 1)', min: 100, max: 220, adim: 5, birim: 'bar', get: () => basinc, set: (v) => (basinc = v) },
    { tip: 'kaydirici', metin: 'Hızlı yaklaşma (Pompa 2)', min: 30, max: 80, adim: 5, birim: 'bar', get: () => pompa2Ayar, set: (v) => (pompa2Ayar = v) },
    { tip: 'kaydirici', metin: 'Çekme derinliği (strok)', min: 250, max: 360, adim: 10, birim: 'mm', get: () => derinlikMm,
      set: (v) => { if (pres.faz === 'bekle' || pres.faz === 'yukle') derinlikMm = v; } },
    { tip: 'baslik', metin: 'Sıvama makinesi (MKN-V06)' },
    { tip: 'kaydirici', metin: 'Sıvama süresi', min: 0.5, max: 5, adim: 0.1, birim: 's', get: () => sivamaSure, set: (v) => (sivamaSure = v) },
    { tip: 'baslik', metin: 'Arıza / güvenlik' },
    { tip: 'anahtar', metin: 'Arıza: kalıpta yırtılma (sonraki basış)', get: () => yirtilmaKurulu, set: (v) => (yirtilmaKurulu = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if (durum === 'ariza') {
          // yırtık kovanlar hurdaya, koç yukarı döner
          pres.yirtik = false; pres.parca = 'yok'; pres.cekK = 0; hurdaYirtik += 2;
          pres.donBas = pres.ramY; presGec('don'); mesaj = '';
          durum = 'durdu';
        } else if (durum === 'acil') durum = pres.yirtik ? 'ariza' : 'durdu';
      } },
    ] },
  ];

  return {
    id: 'yangin',
    ad: 'Yangın Tüpü Kovanı Hattı',
    altBaslik: 'Çift ist. derin çekme · sıvama · Delta',
    kisa: 'Yangın tüpü kovanı üretimi: 4 kolonlu çift istasyonlu hidrolik pres sac diskten kovanın ilk halini derin çeker; sıvama makinesi kovanın yüzeyini düzeltir, kenar çıkıntılarını kırpar ve tam şeklini verir.',
    proje: 'other-machines',
    ayakIzi: [12.6, 4.4],
    ayakIziMerkez: [0, 0.15],
    kamera: { poz: [0.4, 5.6, 11.6], hedef: [0, 1.2, -0.2] },
    mekanizmalar: [
      'Pres koçu: hızlı iniş (Pompa 2) → derin çekme (Pompa 1) → bekleme → hızlı dönüş; iki zımba aynı anda iki kalıba girer',
      'Derin çekme: sac disk küçülerek kalıptan çekilir, altında kovan boyu uzar; ağızda kulaklar oluşur, itici kovanı yukarı çıkarır',
      'Sıvama: kovan ağzı aşağı mandrele takılır, punta dibinden sıkar, iş mili döner, makara kovan boyunca iner (boy uzar, çap düzelir, yüzey parlar)',
      'Kırpma bıçağı: radyal gelir, kulaklı kenar halkasını keser; halka hurda kutusuna düşer',
      'Operatörler: disk stoğu → pres → ara kasa; ara kasa → sıvama → bitmiş kovan paleti',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: MKN-V08 ile MKN-V02 aynı pres (yangın tüpü kovanını derin çekerek çıkarıyor); MKN-V06 ayrı makine — kovanın ilk halini sıvıyor, pürüzleri gideriyor, çıkıntıları kırpıyor, tam şeklini veriyor.',
      'MKN-V08 kareleri: 4 krom kolon, üst tabla, iki istasyonda yuvarlak kalıp + kılavuz milleri, operatör önden yüklüyor → çift istasyonlu pres. MKN-V02: Delta HMI "Üretim Adedi, Pompa 1/2 (bar), Koç Aşağı İniyor" + R/S/T lambaları → pano bu şekilde çizildi.',
      'MKN-V06 kareleri: hidrolik ünite (tank, yön valfleri, manometre, yeşil motor), 3 sarı acil stop kutusu, dikey ünite, "SIVAMA SÜRESİ 1.0 SANİYE" HMI.',
      'TAHMİN: kovan ölçüsü (Ø180 mm, ilk çekme ~320 mm, sıvamada %18 uzama), tek çekme kademesi, sıvamanın makara + mandrelle yapıldığı ve kırpmanın aynı makinede olduğu, stok/ara kasa/palet yerleri, iki operatör.',
      'TAHMİN: süreler hızlandırıldı; arıza senaryosu (kalıpta yırtılma) gösterim için eklendi.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => [
      ['Üretim (bitmiş kovan)', `${uretim} adet`],
      ['Preslenen kovan', `${presAdet} adet`],
      ['Pompa 1 / Pompa 2', `${fmt(pres.p1, 0)} / ${fmt(pres.p2, 0)} bar`],
      ['Koç konumu', `${fmt((RAM_UST - pres.ramY) * 1000, 0)} mm`],
      ['Pres', pres.kasaBekle ? 'ara kasa dolu' : PRES_FAZ[pres.faz]],
      ['Ara kasa', `${kasa}/${KASA_KAP}`],
      ['Sıvama', `${SIV_FAZ[siv.faz]} · ${sivamaSure.toFixed(1)} s`],
      ['Disk stoğu', `${stok}`],
      ['Hurda (yırtık / kırpıntı)', `${hurdaYirtik} / ${kirpinti}`],
    ],
    trend,
    durum: durumBilgi,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (koç/mil, presteki disk ve
    // kovanlar, kasa/stok/palet içerikleri, sıvama mili, punta, makara, bıçak, hurda göstergesi)
    sabitHaric: [
      ram, mil, ...presDisk, ...presKovan.map((c) => c.m), ...kasaKovan, ...stokYigin,
      mili, puntaMil, puntaPabuc, makaraKol, bicak, hurdaDolu, halka, ...palKovan,
    ],
  };
}
