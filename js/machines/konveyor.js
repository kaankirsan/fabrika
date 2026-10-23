// js/machines/konveyor.js — Konveyör Hattı → Karton Kutulama (Kaan'ın tarifi, 2026-10-23).
//
// Akış: 3 besleme kolu → ~20 m tek ana hat (+X) → hat sonunda karton sarma /
// kutulama makinesi → çıkış konveyörü → paletleme.
//  - Operatörler paletteki ham ürünü (yassı mobilya paneli takımı) alıp ana hattan
//    dışarı çıkıntı yapan 3 kayışlı kola koyar. Kol sensörü ürünü görür; ana hatta
//    o noktada ya da yaklaşan ürün varsa kol beslemez, boşluk olunca pop-up kayışlı
//    transferle ana hatta aktarır (fermuar gibi birleşme, çarpışma yok).
//  - Kutulama makinesi hatla haberleşir: paketleme sürerken giriş stoperi kapalı,
//    ana hat sıfır basınçlı birikir (ürünler arası boşluk korunur); hat dolarsa
//    kollar beslemeyi keser.
//  - Çıkışta operatör kutuyu palete dizer; ham ürün paletleri bitince yenilenir.
//
// Fotoğraf/videodan (warehouse-img-01..04, warehouse-video-01): gri rulolu hat,
// rulo araları arasından yükselen yeşil kayışlı transferler, dik çıkan çok şeritli
// kayışlı kollar, Delta HMI. Ölçülerin çoğu TAHMİN (bkz. cikarim).

export function create(lib) {
  const {
    THREE, M, box, cyl, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop, pano, canvasTex,
    clamp, approach, fmt, throttle,
  } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ölçüler
  const X0 = -13.8, X1 = 6.2;              // ana hat: 20 m, akış +X
  const LZ = -2.4;                          // ana hat ekseni (z)
  const YR = 0.72, RR = 0.03;               // rulo merkez yüksekliği, yarıçap
  const YUST = YR + RR;                     // taşıma yüzeyi 0.75 m
  const IST = [-11, -6, -1];                // kolların ana hatta bağlandığı x (TAHMİN: 5 m aralık)
  const SERIT = [-0.8, -0.3, 0.3, 0.8];     // kayış şeritleri (rulo boşluklarına denk)
  const KOL0 = LZ + 0.64, KOL_SON = KOL0 + 2.2;
  const KL = 1.8, KH = 0.08, KD = 0.9;      // ham ürün: yassı panel takımı
  const BL = 1.86, BH = 0.11, BD = 0.96;    // karton kutu
  const KALK = 0.025, ARA = 0.3;            // pop-up kalkma; ana hatta ürünler arası boşluk
  const Z_STOP = KOL0 + KD / 2 + 0.05;      // kolda birleşme bekleme noktası (kol fotoseli)
  const Z_YUK = KOL_SON - KD / 2 - 0.04;    // operatörün ürünü koyduğu nokta
  const STOP_X = X1 - KL / 2 - 0.05;        // kutulama giriş stoperi önü
  const MX0 = X1, MX1 = X1 + 4.0, MST = MX0 + 2.0, MW = 1.9, MH = 2.15;   // kutulama makinesi
  const CX0 = MX1, CX1 = MX1 + 2.2, CIKIS_X = CX1 - BL / 2 - 0.03;       // çıkış konveyörü
  const PALET_CIKIS = { x: CX1 + 1.2, z: LZ };
  const PALET_KAP = 10, HAM_PALET = 12;
  const VK = 0.4, VIN = 1.0;                // kol kayış hızı, makine içi taşıma (m/s)
  const T_TR = 0.35 + (Z_STOP - LZ) / VK;   // kol → ana hat aktarma süresi

  const govde = mat(0xb9bfc5, { r: 0.4, m: 0.7, key: 'konv-govde' });
  const motorMat = mat(0x5b6a78, { r: 0.5, m: 0.4, key: 'konv-motor' });
  const hamMat = mat(0xe7e0d2, { r: 0.6, m: 0.05, key: 'ham-panel' });
  const hamKenar = mat(0x8a7356, { r: 0.7, m: 0, key: 'ham-kenar' });
  const bantMat = mat(0xd9c69b, { r: 0.7, key: 'koli-bant' });
  const makineMat = mat(0xdfe3e6, { r: 0.45, m: 0.3, key: 'kutulama' });
  const m4 = new THREE.Matrix4();

  function instKutu(w, h, d, material, konumlar) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), material, konumlar.length);
    konumlar.forEach(([x, y, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, y, z)));
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
    return im;
  }
  const camKutu = (w, h, d, x, y, z, p) => { const c = box(w, h, d, M.cam, x, y, z, p); c.castShadow = false; return c; };

  // ---------------------------------------------------------------- ana hat gövdesi
  for (const sz of [-1, 1]) box(X1 - X0, 0.09, 0.04, govde, (X0 + X1) / 2, YR - 0.025, LZ + sz * 0.64, g);
  box(0.06, 0.1, 1.32, M.sari, X0 - 0.03, YUST + 0.03, LZ, g);            // hat başı dayaması
  const ayak = [], taban = [], travers = [];
  for (let x = X0 + 0.25; x <= X1 - 0.2; x += 1.5) {
    for (const sz of [-1, 1]) { ayak.push([x, (YR - 0.07) / 2, LZ + sz * 0.6]); taban.push([x, 0.01, LZ + sz * 0.6]); }
    travers.push([x, 0.26, LZ]);
  }
  for (let x = CX0 + 0.3; x < CX1; x += 1.6) for (const sz of [-1, 1]) {
    ayak.push([x, (YR - 0.07) / 2, LZ + sz * 0.6]); taban.push([x, 0.01, LZ + sz * 0.6]);
  }
  instKutu(0.06, YR - 0.07, 0.06, govde, ayak);
  instKutu(0.12, 0.02, 0.12, M.koyu, taban);
  instKutu(0.04, 0.04, 1.2, govde, travers);
  // tahrik motorları: 4 bölge (Modbus RS-485 VFD)
  for (const x of [-12.2, -7.2, -2.2, 3.4]) {
    box(0.28, 0.2, 0.22, motorMat, x, 0.5, LZ + 0.3, g);
    cyl(0.08, 0.24, motorMat, x - 0.24, 0.5, LZ + 0.3, g, { eksen: 'x', seg: 18 });
    box(0.05, 0.22, 0.2, M.koyu, x + 0.17, 0.6, LZ + 0.3, g);
  }
  // çıkış konveyörü yan profilleri + uç dayaması
  for (const sz of [-1, 1]) box(CX1 - CX0, 0.09, 0.04, govde, (CX0 + CX1) / 2, YR - 0.025, LZ + sz * 0.64, g);
  box(0.06, 0.12, 1.32, M.sari, CX1 + 0.03, YUST + 0.04, LZ, g);

  // Rulolar (ana hat + makine içi + çıkış): tek InstancedMesh; dönüş koyu bantlı dokunun kaymasıyla görünür
  const ruloTex = canvasTex(64, 8, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#9aa1a8'); gr.addColorStop(0.5, '#d4d9dd'); gr.addColorStop(1, '#9aa1a8');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = '#4c535a'; x.fillRect(4, 0, 7, h);
    x.fillStyle = '#6c737a'; x.fillRect(36, 0, 4, h);
  }, { tekrar: [1, 1] });
  const ruloMat = new THREE.MeshStandardMaterial({ map: ruloTex, roughness: 0.32, metalness: 0.75 });
  const ruloGeo = new THREE.CylinderGeometry(RR, RR, 1.24, 14);
  ruloGeo.rotateX(Math.PI / 2);
  const ruloX = [];
  for (let x = X0 + 0.05; x < X1; x += 0.1) ruloX.push(x);
  for (let x = MX0 + 0.1; x < MX1 - 0.05; x += 0.1) ruloX.push(x);
  for (let x = CX0 + 0.05; x < CX1; x += 0.1) ruloX.push(x);
  const rulolar = new THREE.InstancedMesh(ruloGeo, ruloMat, ruloX.length);
  ruloX.forEach((x, i) => rulolar.setMatrixAt(i, m4.makeTranslation(x, YR, LZ)));
  rulolar.castShadow = true; rulolar.receiveShadow = true;
  g.add(rulolar);
  const somun = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1.36, 6).rotateX(Math.PI / 2), M.koyu, ruloX.length);
  ruloX.forEach((x, i) => somun.setMatrixAt(i, m4.makeTranslation(x, YR, LZ)));
  g.add(somun);

  // ---------------------------------------------------------------- kayış + fotosel yardımcıları
  function kayisDokusu() {
    return canvasTex(16, 64, (x, w, h) => {
      x.fillStyle = '#1f7a35'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2fa04a'; x.fillRect(0, 0, w, 22);
      x.fillStyle = '#155c27'; x.fillRect(0, 44, w, 4);
    }, { tekrar: [1, 1] });
  }
  // Üst yüzeyi doku kayan ince düzlem + altında alüminyum kiriş
  function kayis(parent, x, z0, z1, ustY, tex) {
    const L = z1 - z0;
    const geo = new THREE.PlaneGeometry(0.032, L);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * L) / 0.12);
    const p = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, ustY, (z0 + z1) / 2);
    p.receiveShadow = true;
    parent.add(p);
    box(0.034, 0.05, L, M.alu, x, ustY - 0.026, (z0 + z1) / 2, parent);
  }
  // Fotosel: a'da verici (sarı + LED), b'de reflektör, arada ışın çizgisi
  function fotosel(a, b) {
    box(0.02, 0.12, 0.02, M.koyu, a[0], a[1] - 0.06, a[2], g);
    box(0.045, 0.05, 0.045, M.sari, a[0], a[1], a[2], g);
    const led = lamba(0x33ff66, 1.5);
    box(0.014, 0.014, 0.014, led, a[0], a[1] + 0.03, a[2], g);
    box(0.02, 0.12, 0.02, M.koyu, b[0], b[1] - 0.06, b[2], g);
    box(0.04, 0.04, 0.04, M.kirmizi, b[0], b[1], b[2], g);
    const isinMat = new THREE.LineBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.7 });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), isinMat));
    return { isinMat, led };
  }
  function fotoselRenk(f, kesik, arizali, zaman) {
    f.isinMat.color.setHex(arizali ? 0x555555 : kesik ? 0xff3b30 : 0x33ff66);
    f.isinMat.opacity = arizali ? 0.25 : 0.75;
    f.led.color.setHex(arizali ? 0xff9900 : kesik ? 0xff3b30 : 0x33ff66);
    f.led.emissive.copy(f.led.color);
    f.led.emissiveIntensity = arizali ? (Math.sin(zaman * 10) > 0 ? 2 : 0.1) : 1.6;
  }

  // Palet (2.0 × 1.0 m) + üstünde yığın (tek kutu, ölçeklenir; çizgili doku katları gösterir)
  function paletKur(x, z, birimH, urunMat, uzun, derin) {
    box(2.0, 0.03, 1.0, M.ahsap, x, 0.125, z, g);
    for (const dz of [-0.42, 0, 0.42]) box(2.0, 0.1, 0.12, M.ahsap, x, 0.055, z + dz, g);
    const tex = canvasTex(8, 32, (c, w, h) => {
      c.fillStyle = '#' + urunMat.color.getHexString(); c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(60,40,20,.45)'; c.fillRect(0, h - 3, w, 3);
    }, { tekrar: [1, 1] });
    const yigin = new THREE.Mesh(new THREE.BoxGeometry(uzun, 1, derin),
      new THREE.MeshStandardMaterial({ map: tex, roughness: urunMat.roughness, metalness: 0 }));
    yigin.castShadow = true; yigin.receiveShadow = true;
    g.add(yigin);
    return {
      yigin,
      ayarla(n) {
        yigin.visible = n > 0;
        if (!n) return;
        yigin.scale.y = n * birimH;
        yigin.position.set(x, 0.14 + (n * birimH) / 2, z);
        tex.repeat.set(1, n);
      },
    };
  }

  // Operatör: ortak FK-1000 tipi model (yüz +Z); tasi = kollarının önünde taşınan ürün grubu
  function adam(x, z, renk = {}) {
    const model = lib.operator(renk);
    const a = model.group;
    a.position.set(x, 0, z);
    const tasi = new THREE.Group();
    tasi.position.set(0, 0.97, 0.55);   // 'tasi' pozunda eller ~y 1.0, z 0.49
    tasi.visible = false;
    a.add(tasi);
    g.add(a);
    return { grup: a, model, tasi, yon: 0 };
  }
  // Yön + poz + yürüme salınımı (yuruyor: konum değiştiren fazlarda)
  function yonDon(o, dt, yuruyor = false, isBasinda = false) {
    let fark = o.yon - o.grup.rotation.y;
    fark = Math.atan2(Math.sin(fark), Math.cos(fark));
    o.grup.rotation.y += fark * (1 - Math.exp(-9 * dt));
    o.model.poz(o.tasi.visible ? 'tasi' : isBasinda ? 'on' : 'yan');
    o.grup.position.y = o.model.yuru(zaman, yuruyor);
  }

  // ---------------------------------------------------------------- besleme kolları
  const kollar = IST.map((sx, s) => {
    const tex = kayisDokusu();
    // pop-up bölüm: ana hat içinde, pnömatikle kalkar
    const pop = new THREE.Group();
    g.add(pop);
    for (const dx of SERIT) kayis(pop, sx + dx, LZ - 0.6, LZ + 0.6, YUST - 0.015, tex);
    box(1.7, 0.03, 0.05, M.alu, sx, YUST - 0.075, LZ - 0.45, pop);
    box(1.7, 0.03, 0.05, M.alu, sx, YUST - 0.075, LZ + 0.45, pop);
    for (const dz of [-0.45, 0.45]) {
      cyl(0.03, 0.14, M.alu, sx, YUST - 0.2, LZ + dz, g, { seg: 14 });
      cyl(0.01, 0.06, M.krom, sx, YUST - 0.11, LZ + dz, pop, { seg: 10 });
    }
    // kol: 4 şeritli kayışlı konveyör, +Z'ye çıkıntı (operatör ucundan yükler)
    for (const dx of SERIT) kayis(g, sx + dx, KOL0, KOL_SON, YUST + KALK, tex);
    for (const z of [KOL0 + 0.3, (KOL0 + KOL_SON) / 2, KOL_SON - 0.15]) {
      box(1.9, 0.04, 0.05, govde, sx, YUST + KALK - 0.075, z, g);
      for (const sxx of [-1, 1]) {
        box(0.05, YUST + KALK - 0.095, 0.05, govde, sx + sxx * 0.92, (YUST + KALK - 0.095) / 2, z, g);
        box(0.1, 0.02, 0.1, M.koyu, sx + sxx * 0.92, 0.01, z, g);
      }
    }
    for (const sxx of [-1, 1]) box(0.03, 0.05, KOL_SON - KOL0, M.sari, sx + sxx * 0.99, YUST + KALK + 0.03, (KOL0 + KOL_SON) / 2, g);
    box(2.0, 0.05, 0.04, M.sari, sx, YUST + KALK + 0.03, KOL_SON + 0.03, g);   // operatör ucu dayaması
    box(0.22, 0.16, 0.18, motorMat, sx + 0.7, 0.45, KOL0 + 0.6, g);          // kol motoru
    // (1) kol fotoseli: bekleme noktasında ürün var mı (ışın X boyunca)
    const f1 = fotosel([sx - 1.04, YUST + KALK + 0.05, Z_STOP], [sx + 1.04, YUST + KALK + 0.05, Z_STOP]);
    // (2) birleşme fotoseli: kolun hemen önünde ana hatta ürün var mı (ışın Z boyunca)
    const fx = sx - KL / 2 - 0.25;
    const f2 = fotosel([fx, YUST + 0.05, LZ - 0.68], [fx, YUST + 0.05, LZ + 0.68]);
    // ham ürün paleti + besleme operatörü
    const palet = paletKur(sx - 1.75, KOL_SON + 0.95, KH, hamMat, KL, KD);
    const A = { x: sx - 0.55, z: KOL_SON + 0.95, yon: -Math.PI / 2 };   // paletten alma
    const B = { x: sx + 0.05, z: KOL_SON + 0.5, yon: Math.PI };         // kola koyma
    const op = adam(A.x, A.z, { baret: s % 2 ? 0xffffff : 0xffd400 });
    box(KL, KH, KD, hamMat, 0, 0, 0, op.tasi);
    op.faz = 'bekle'; op.t = 0; op.bekle = 1 + s * 1.3; op.A = A; op.B = B;
    return { sx, s, tex, pop, kalk: 0, transfer: null, trFaz: '', kilit: false, arizaT: 0, f1, f2, fx,
      teslim: 0, palet: HAM_PALET, paletT: 0, paletG: palet, op };
  });

  // ---------------------------------------------------------------- karton kutulama makinesi
  const mcx = (MX0 + MX1) / 2;
  box(MX1 - MX0, 0.6, MW, makineMat, mcx, 0.38, LZ, g);                        // alt gövde
  box(MX1 - MX0 + 0.01, 0.08, MW + 0.01, M.mavi, mcx, 0.64, LZ, g);            // mavi bant
  for (const x of [MX0, MST, MX1]) for (const sz of [-1, 1]) box(0.08, MH - 0.68, 0.08, makineMat, x, 0.68 + (MH - 0.68) / 2, LZ + (sz * MW) / 2, g);
  for (const sz of [-1, 1]) box(MX1 - MX0 + 0.08, 0.08, 0.08, makineMat, mcx, MH, LZ + (sz * MW) / 2, g);
  for (const x of [MX0, MX1]) box(0.08, 0.08, MW, makineMat, x, MH, LZ, g);
  // şeffaf koruma pencereleri (içi görünsün): ön, arka, üst, giriş/çıkış ağzı üstü
  for (const sz of [-1, 1]) camKutu(MX1 - MX0 - 0.1, MH - 0.76, 0.012, mcx, 0.7 + (MH - 0.76) / 2, LZ + (sz * MW) / 2, g);
  camKutu(MX1 - MX0 - 0.1, 0.012, MW - 0.1, mcx, MH, LZ, g);
  for (const x of [MX0, MX1]) camKutu(0.012, MH - 1.2, MW - 0.1, x, 1.2 + (MH - 1.2) / 2, LZ, g);
  // karton tabaka magazini (çatıda) + vakumlu besleme kafası
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.35, 0.04, M.koyu, MST + sx * 1.25, MH + 0.18, LZ + sz * 0.7, g);
  box(BL + 2 * BH + 0.1, 0.24, BD + 2 * BH + 0.06, M.karton, MST, MH + 0.18, LZ, g);
  const vakum = new THREE.Group();
  g.add(vakum);
  box(0.9, 0.04, 0.5, M.koyu, 0, 0, 0, vakum);
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.18, 0.18]) cyl(0.035, 0.05, M.kaucuk, sx, -0.04, sz, vakum, { seg: 12 });
  for (const sx of [-0.3, 0.3]) box(0.03, 0.8, 0.03, M.krom, sx, 0.42, 0, vakum);
  const vakumKarton = box(BL + 2 * BH, 0.004, BD + 2 * BH, M.karton, 0, -0.07, 0, vakum);
  const VAKUM_UST = MH - 0.16, VAKUM_ALT = YUST + 0.08;
  vakum.position.set(MST, VAKUM_UST, LZ);
  // bant / sıcak tutkal kafası
  const bantKafa = new THREE.Group();
  g.add(bantKafa);
  box(0.2, 0.14, 0.24, M.koyu, 0, 0, 0, bantKafa);
  cyl(0.07, 0.06, bantMat, 0, 0.12, 0, bantKafa, { eksen: 'z', seg: 18 });
  const tutkal = lamba(0xffa040, 0);
  box(0.05, 0.03, 0.05, tutkal, 0, -0.085, 0, bantKafa);
  const BANT_Y = YUST + BH + 0.14, BANT_PARK = MST - BL / 2 - 0.25;
  bantKafa.position.set(BANT_PARK, BANT_Y, LZ);
  // makine paneli (HMI + hazır lambası + acil stop) ve etiket
  box(0.42, 0.3, 0.06, M.koyu, MX0 + 0.45, 1.4, LZ + MW / 2 + 0.06, g);
  const mkEkran = new Ekran(0.36, 0.22, 384);
  mkEkran.mesh.position.set(MX0 + 0.45, 1.4, LZ + MW / 2 + 0.092);
  g.add(mkEkran.mesh);
  acilStop(g, MX0 + 0.82, 1.3, LZ + MW / 2 + 0.06, 0);
  const hazirLamba = lamba(0x2ee66b, 0.1);
  cyl(0.05, 0.08, hazirLamba, MX1 - 0.2, MH + 0.08, LZ + MW / 2 - 0.15, g, { seg: 16 });
  const lv = levha(['KARTON KUTULAMA'], 1.9, 0.2, { bg: '#1d5ea8', fg: '#fff', font: 80, px: 1024 });
  lv.position.set(mcx, MH - 0.16, LZ + MW / 2 + 0.012);
  g.add(lv);
  // giriş stoperi (makine meşgulken yükselir)
  const stoper = box(0.04, 0.09, 1.1, M.sari, X1 - 0.03, YUST - 0.06, LZ, g);

  // Karton açılımı: taban + 2 yan duvar (üst kapaklı) + 2 uç duvar; istasyonda düz başlar
  const karton = new THREE.Group();
  karton.position.set(MST, YUST + 0.002, LZ);
  g.add(karton);
  box(BL, 0.004, BD, M.karton, 0, 0, 0, karton);
  const yanlar = [-1, 1].map((sz) => {
    const p = new THREE.Group();
    p.position.set(0, 0, (sz * BD) / 2);
    karton.add(p);
    box(BL, 0.004, BH, M.karton, 0, 0, (sz * BH) / 2, p);
    const kapak = new THREE.Group();
    kapak.position.set(0, 0, sz * BH);
    p.add(kapak);
    box(BL, 0.004, BD / 2 + 0.01, M.karton, 0, 0, (sz * (BD / 2 + 0.01)) / 2, kapak);
    return { p, kapak, sz };
  });
  const uclar = [-1, 1].map((sx) => {
    const p = new THREE.Group();
    p.position.set((sx * BL) / 2, 0, 0);
    karton.add(p);
    box(BH, 0.004, BD, M.karton, (sx * BH) / 2, 0, 0, p);
    return { p, sx };
  });
  function kartonKatla(k1, k2) {
    for (const y of yanlar) { y.p.rotation.x = -y.sz * (Math.PI / 2) * k1; y.kapak.rotation.x = -y.sz * (Math.PI / 2) * k2; }
    for (const u of uclar) u.p.rotation.z = u.sx * (Math.PI / 2) * k1;
  }

  // ---------------------------------------------------------------- çıkış: palet + paletleme operatörü
  const paletCikis = paletKur(PALET_CIKIS.x, PALET_CIKIS.z, BH, M.karton, BL, BD);
  const palOp = adam(CX1 + 0.15, LZ + 1.1, { yelek: 0xff7a1a, baret: 0xffffff });
  box(BL, BH, BD, M.karton, 0, 0, 0, palOp.tasi);
  const YON_KONV = Math.atan2(CIKIS_X - (CX1 + 0.15), LZ - (LZ + 1.1));
  const YON_PALET = Math.atan2(PALET_CIKIS.x - (CX1 + 0.15), PALET_CIKIS.z - (LZ + 1.1));
  const pal = { faz: 'bekle', t: 0, n: 0, degisT: 0, u: null };

  // ---------------------------------------------------------------- ürün havuzu
  const HAVUZ = 22;
  const urunler = [];
  for (let i = 0; i < HAVUZ; i++) {
    const m = new THREE.Group();
    const ham = new THREE.Group();
    m.add(ham);
    box(KL, KH, KD, hamMat, 0, KH / 2, 0, ham);
    for (const k of [0.34, 0.67]) box(KL + 0.004, 0.004, KD + 0.004, hamKenar, 0, KH * k, 0, ham);
    const kutu = new THREE.Group();
    m.add(kutu);
    box(BL, BH, BD, M.karton, 0, BH / 2, 0, kutu);
    box(BL + 0.002, 0.002, 0.07, bantMat, 0, BH + 0.001, 0, kutu);
    box(0.3, 0.002, 0.18, M.beyaz, 0.5, BH + 0.002, 0.22, kutu);
    m.visible = false;
    g.add(m);
    urunler.push({ mesh: m, ham, kutu, durum: 'yok', x: 0, y: 0, z: 0, kol: 0, bekleT: 0, sikisik: false, duruyor: false });
  }
  const anaUzerinde = (u) => u.durum === 'ana' || u.durum === 'transfer';
  function uret(s) {
    const u = urunler.find((o) => o.durum === 'yok');
    if (!u) return false;
    Object.assign(u, { durum: 'kol', kol: s, x: IST[s], z: Z_YUK, y: KALK, bekleT: 0, sikisik: false });
    u.ham.visible = true; u.kutu.visible = false;
    u.mesh.rotation.y = 0;
    u.mesh.visible = true;
    return true;
  }

  // ---------------------------------------------------------------- pano + Delta HMI + kule
  const PX = X0 + 1.2, PZ = LZ - 1.25;
  box(0.08, 0.8, 0.08, M.koyu, PX, 0.4, PZ, g);
  box(0.3, 0.02, 0.3, M.koyu, PX, 0.01, PZ, g);
  pano(g, PX, 0.78, PZ, 0.62, 0.78, 0.22, 0);
  box(0.5, 0.31, 0.02, M.siyah, PX, 1.22, PZ + 0.115, g);
  const ekran = new Ekran(0.46, 0.27, 640);
  ekran.mesh.position.set(PX, 1.22, PZ + 0.127);
  g.add(ekran.mesh);
  acilStop(g, PX + 0.22, 0.92, PZ + 0.145, 0);
  const kule = kuleLambasi(g, PX, 1.56, PZ);

  // ---------------------------------------------------------------- mantık
  let durum = 'calisiyor';      // calisiyor | durdu | acil | alarm
  let alarmNeden = '';
  let hz = 40, cevrim = 8;      // VFD frekansı, kutulama çevrim süresi (s)
  let arizaliFotosel = -1, kutulamaAriza = false, paletOp = true;
  const opAcik = [true, true, true];
  let paketlenen = 0, sikT = 0, zaman = 0, sicak = false;
  let uyariMetin = '', uyariT = 0;
  const paketZaman = [];
  const mk = { faz: 'hazir', t: 0, urun: null };   // hazir | giris | katla1 | katla2 | bant | cikisBekle | cikis | besle
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };
  const hatHizi = () => (hz / 50) * 0.55;
  const calisir = () => durum === 'calisiyor';
  const kabul = () => mk.faz === 'hazir' && !kutulamaAriza && calisir();

  // Ana hatta bu kolun birleşme bölgesi boş mu, ve aktarma süresince oraya ürün yetişir mi?
  function anaBos(s, ben) {
    const a = IST[s] - KL / 2 - ARA, b = IST[s] + KL / 2 + ARA;
    const pencere = hatHizi() * T_TR + 0.2;
    for (const u of urunler) {
      if (u === ben || !anaUzerinde(u)) continue;
      if (u.x + KL / 2 > a - pencere && u.x - KL / 2 < b) return false;
    }
    return true;
  }
  // Kolun birleşme bölgesini HAREKET EDEN trafik mi kapatıyor? (duran kuyruk değil)
  function trafikKesiyor(s) {
    const a = IST[s] - KL / 2 - ARA, b = IST[s] + KL / 2 + ARA;
    const pencere = hatHizi() * T_TR + 0.2;
    return urunler.some((u) => anaUzerinde(u) && u.x + KL / 2 > a - pencere && u.x - KL / 2 < b && (u.durum === 'transfer' || !u.duruyor));
  }
  const makineAkiyor = () => calisir() && !kutulamaAriza && !(mk.faz === 'cikisBekle' && mk.t > 3);
  // Kolun yükleme ucu boş mu (operatör yeni ürün koyabilir mi)
  const yukBos = (s) => !urunler.some((u) => u.kol === s && (u.durum === 'kol' || u.durum === 'bekle') && u.z > Z_YUK - KD - 0.08);
  const bekleyen = (s) => urunler.find((u) => u.kol === s && u.durum === 'bekle');

  function kollarAdim(dt, vk) {
    for (const k of kollar) {
      const s = k.s;
      // kol üzerindeki ürünler ana hatta doğru (-Z) ilerler, bekleme noktasında durur
      const L = urunler.filter((u) => u.kol === s && (u.durum === 'kol' || u.durum === 'bekle')).sort((a, b) => a.z - b.z);
      let sinir = k.transfer && k.transfer.z > LZ ? Math.max(Z_STOP, k.transfer.z + KD + 0.08) : Z_STOP;
      for (const u of L) {
        if (u.durum === 'kol') {
          u.z = Math.max(sinir, u.z - vk * dt);
          if (u.z <= Z_STOP + 1e-4) { u.z = Z_STOP; u.durum = 'bekle'; u.bekleT = 0; }
        }
        sinir = u.z + KD + 0.08;
        u.y = KALK;
      }
    }
    // birleşme kararı: makineye en yakın koldan başla
    for (let s = 2; s >= 0; s--) {
      const k = kollar[s];
      const u = bekleyen(s);
      if (!u) { k.arizaT = 0; continue; }
      if (!calisir()) continue;
      if (arizaliFotosel === s) {   // PLC kol fotoselinden ürünü göremiyor → zaman aşımı, besleme kilidi
        k.arizaT += dt;
        if (k.arizaT > 3) k.kilit = true;
        continue;
      }
      u.bekleT += dt;
      if (k.transfer || k.kilit) continue;
      // harmoni: aşağı akışta uzun süredir bekleyen kol varsa yukarı akış ona boşluk bırakır.
      // Makine akıyorsa kuyruk erir ve sıra ona gelir; makine arızalıysa yukarı akış boş yeri doldurur.
      let oncelik = false;
      for (let j = s + 1; j < 3; j++) { const o = bekleyen(j); if (o && !kollar[j].kilit && o.bekleT > 4 && o.bekleT > u.bekleT && (trafikKesiyor(j) || makineAkiyor())) oncelik = true; }
      if (oncelik || !anaBos(s, u)) continue;
      u.durum = 'transfer'; u.x = IST[s];
      k.transfer = u; k.trFaz = 'kalk';
    }
    // aktarma: pop-up kalkar → ürün ana hatta kayar → pop-up iner
    for (const k of kollar) {
      const u = k.transfer;
      if (!u || !calisir()) continue;
      if (k.trFaz === 'kalk') { k.kalk = approach(k.kalk, 1, dt / 0.35); if (k.kalk >= 1) k.trFaz = 'tasi'; }
      else if (k.trFaz === 'tasi') { u.z = Math.max(LZ, u.z - vk * dt); if (u.z <= LZ + 1e-4) k.trFaz = 'in'; }
      else if (k.trFaz === 'in') {
        k.kalk = approach(k.kalk, 0, dt / 0.35);
        if (k.kalk <= 0) { u.durum = 'ana'; k.transfer = null; k.teslim++; }
      }
      u.y = u.z > KOL0 + 0.05 ? KALK : KALK * k.kalk;
    }
  }

  function anaAdim(dt, v) {
    const ana = urunler.filter((u) => u.durum === 'ana').sort((a, b) => b.x - a.x);
    for (const u of ana) {
      u.y = 0;
      u.duruyor = true;
      if (u.sikisik || v === 0) continue;
      let maxX = STOP_X;
      for (const o of urunler) if (o !== u && anaUzerinde(o) && o.x > u.x) maxX = Math.min(maxX, o.x - KL - ARA);
      if (maxX > u.x + 1e-5) { u.x = Math.min(u.x + v * dt, maxX); u.duruyor = false; }
    }
    // sıkışma: sıkışık ürün varken hat çalışıyorsa 2.5 sn sonra alarm
    if (calisir() && urunler.some((u) => u.sikisik && u.durum === 'ana')) {
      sikT += dt;
      if (sikT > 2.5) { durum = 'alarm'; alarmNeden = 'SIKIŞMA · ANA HAT'; }
    }
  }

  function makineAdim(dt) {
    // kabul: stoper önündeki ilk ürün içeri alınır
    if (kabul()) {
      const ilk = urunler.find((u) => u.durum === 'ana' && !u.sikisik && u.x >= STOP_X - 1e-3);
      if (ilk) { ilk.durum = 'makine'; mk.urun = ilk; mk.faz = 'giris'; mk.t = 0; }
    }
    if (!calisir() || kutulamaAriza) return;
    const u = mk.urun;
    mk.t += dt;
    const T1 = cevrim * 0.3, T2 = cevrim * 0.25, T3 = cevrim * 0.25;
    switch (mk.faz) {
      case 'giris':
        u.x = Math.min(MST, u.x + VIN * dt);
        u.y = u.x > MST - BL / 2 - KL / 2 ? 0.004 : 0;
        if (u.x >= MST) { mk.faz = 'katla1'; mk.t = 0; }
        break;
      case 'katla1':   // yan + uç duvarlar 90° kalkar
        kartonKatla(Math.min(1, mk.t / T1), 0);
        if (mk.t >= T1) { mk.faz = 'katla2'; mk.t = 0; }
        break;
      case 'katla2':   // üst kapaklar ürünün üstüne katlanır
        kartonKatla(1, Math.min(1, mk.t / T2));
        if (mk.t >= T2) { mk.faz = 'bant'; mk.t = 0; }
        break;
      case 'bant': {   // bant / sıcak tutkal kafası ek yeri boyunca geçer
        const k = Math.min(1, mk.t / T3);
        bantKafa.position.x = MST - BL / 2 + BL * k;
        tutkal.emissiveIntensity = 2.4;
        if (mk.t >= T3) {
          u.ham.visible = false; u.kutu.visible = true; u.y = 0;
          karton.visible = false; kartonKatla(0, 0);
          tutkal.emissiveIntensity = 0;
          paketlenen++; paketZaman.push(zaman);
          mk.faz = 'cikisBekle'; mk.t = 0;
        }
        break;
      }
      case 'cikisBekle':   // çıkış konveyöründe kutu varsa bekle (paletleme ile haberleşme)
        bantKafa.position.x = approach(bantKafa.position.x, BANT_PARK, dt * 1.5);
        if (!urunler.some((o) => o.durum === 'cikis' || o.durum === 'alin')) { mk.faz = 'cikis'; mk.t = 0; }
        break;
      case 'cikis':
        bantKafa.position.x = approach(bantKafa.position.x, BANT_PARK, dt * 1.5);
        u.x += VIN * dt;
        if (u.x >= CX0 + BL / 2 - 0.1) { u.durum = 'cikis'; mk.urun = null; mk.faz = 'besle'; mk.t = 0; }
        break;
      case 'besle': {   // vakum kafası magazinden yeni karton indirir
        const k = Math.min(1, mk.t / 1.4);
        const asagi = k < 0.5 ? k * 2 : 2 - k * 2;
        vakum.position.y = VAKUM_UST + (VAKUM_ALT - VAKUM_UST) * asagi;
        vakumKarton.visible = k < 0.5;
        if (k >= 0.5) karton.visible = true;
        if (k >= 1) { vakum.position.y = VAKUM_UST; mk.faz = 'hazir'; mk.t = 0; }
        break;
      }
    }
  }

  function cikisAdim(dt) {
    for (const u of urunler) {
      if (u.durum !== 'cikis') continue;
      if (calisir() && u.x < CIKIS_X) u.x = Math.min(CIKIS_X, u.x + VIN * dt);
      u.y = 0;
    }
    // paletleme operatörü
    const o = palOp;
    if (durum === 'acil') return;
    if (pal.degisT > 0) { pal.degisT -= dt; if (pal.degisT <= 0) pal.n = 0; }
    pal.t += dt;
    if (pal.faz === 'bekle') {
      o.yon = YON_KONV;
      const u = urunler.find((x) => x.durum === 'cikis' && x.x >= CIKIS_X - 1e-3);
      if (u && paletOp && pal.degisT <= 0) { u.durum = 'alin'; pal.u = u; pal.faz = 'al'; pal.t = 0; }
    } else if (pal.faz === 'al') {
      o.yon = YON_KONV;
      if (pal.t >= 0.9) { pal.u.mesh.visible = false; o.tasi.visible = true; pal.faz = 'koy'; pal.t = 0; }
    } else if (pal.faz === 'koy') {
      o.yon = YON_PALET;
      if (pal.t >= 1.1) {
        o.tasi.visible = false; pal.u.durum = 'yok'; pal.u = null;
        pal.n++;
        if (pal.n >= PALET_KAP) pal.degisT = 4;   // dolu palet çekilir, boş palet gelir
        pal.faz = 'bekle'; pal.t = 0;
      }
    }
  }

  function lerpPoz(o, P, Q, f) { o.grup.position.x = P.x + (Q.x - P.x) * f; o.grup.position.z = P.z + (Q.z - P.z) * f; }
  function operatorAdim(dt) {
    if (durum === 'acil') return;
    for (const k of kollar) {
      const o = k.op;
      o.t += dt;
      if (k.palet === 0) { k.paletT += dt; if (k.paletT > 8) { k.palet = HAM_PALET; k.paletT = 0; } }
      switch (o.faz) {
        case 'bekle':
          o.yon = o.A.yon;
          if (opAcik[k.s] && !k.kilit && k.palet > 0 && yukBos(k.s) && o.t > o.bekle) { o.faz = 'al'; o.t = 0; }
          break;
        case 'al':
          if (o.t >= 1.0) { k.palet--; o.tasi.visible = true; o.faz = 'git'; o.t = 0; }
          break;
        case 'git':
          o.yon = Math.atan2(o.B.x - o.A.x, o.B.z - o.A.z);
          lerpPoz(o, o.A, o.B, Math.min(1, o.t / 0.7));
          if (o.t >= 0.7) { o.faz = 'koy'; o.t = 0; }
          break;
        case 'koy':
          o.yon = o.B.yon;
          if (o.t >= 0.8 && yukBos(k.s)) {
            if (uret(k.s)) o.tasi.visible = false;
            o.faz = 'don'; o.t = 0;
          }
          break;
        case 'don':
          o.yon = Math.atan2(o.A.x - o.B.x, o.A.z - o.B.z);
          lerpPoz(o, o.B, o.A, Math.min(1, o.t / 0.7));
          if (o.t >= 0.7) { o.faz = 'bekle'; o.t = 0; o.bekle = 1.5 + Math.random() * 4; }
          break;
      }
    }
  }

  function adim(dt) {
    const v = calisir() ? hatHizi() : 0;
    const vk = calisir() ? VK : 0;
    kollarAdim(dt, vk);
    anaAdim(dt, v);
    makineAdim(dt);
    cikisAdim(dt);
    operatorAdim(dt);
    uyariT = Math.max(0, uyariT - dt);

    // görseller
    for (const u of urunler) if (u.durum !== 'yok' && u.mesh.visible) u.mesh.position.set(u.x, YUST + u.y, u.z);
    ruloTex.offset.x += (v / (2 * Math.PI * RR)) * dt;
    for (const k of kollar) {
      k.pop.position.y = k.kalk * KALK;
      const kolHareket = vk > 0 && (urunler.some((u) => u.kol === k.s && u.durum === 'kol') || k.trFaz === 'tasi');
      if (kolHareket) k.tex.offset.y -= (vk / 0.12) * dt;
      const kolDolu = urunler.some((u) => u.kol === k.s && (u.durum === 'bekle' || u.durum === 'transfer') && Math.abs(u.z - Z_STOP) < KD / 2);
      fotoselRenk(k.f1, kolDolu, arizaliFotosel === k.s, zaman);
      const anaDolu = urunler.some((u) => anaUzerinde(u) && u.z < KOL0 && Math.abs(u.x - k.fx) < KL / 2);
      fotoselRenk(k.f2, anaDolu, false, zaman);
      yonDon(k.op, dt, k.op.faz === 'git' || k.op.faz === 'don', k.op.faz === 'al' || k.op.faz === 'koy');
      k.paletG.ayarla(k.palet);
    }
    yonDon(palOp, dt, false, pal.faz === 'al' || pal.faz === 'koy');
    paletCikis.ayarla(pal.n);
    stoper.position.y = kabul() ? YUST - 0.07 : YUST + 0.02;
    hazirLamba.color.setHex(kutulamaAriza ? 0xff3b30 : 0x2ee66b);
    hazirLamba.emissive.copy(hazirLamba.color);
    hazirLamba.emissiveIntensity = kutulamaAriza ? (Math.sin(zaman * 9) > 0 ? 2.4 : 0.1) : kabul() ? 2.2 : 0.15;
    while (paketZaman.length && zaman - paketZaman[0] > 60) paketZaman.shift();
  }

  // ---------------------------------------------------------------- durum metinleri
  function mkDurum() {
    if (kutulamaAriza) return 'ARIZA · karton sıkıştı';
    return {
      hazir: 'HAZIR · ürün bekliyor', giris: 'ürün içeri alınıyor', katla1: 'yan kapaklar kalkıyor',
      katla2: 'üst kapaklar katlanıyor', bant: 'bant / tutkal', cikisBekle: 'ÇIKIŞ DOLU · bekliyor',
      cikis: 'kutu çıkıyor', besle: 'yeni karton besleniyor',
    }[mk.faz];
  }
  function kolDurum(s) {
    const k = kollar[s];
    if (k.kilit) return 'KİLİT';
    if (k.transfer) return 'aktarıyor';
    const u = bekleyen(s);
    if (u) return arizaliFotosel === s ? 'görmüyor' : `bekliyor ${fmt(u.bekleT, 0)} s`;
    return urunler.some((x) => x.kol === s && x.durum === 'kol') ? 'ilerliyor' : 'boş';
  }
  const hattaSayi = () => urunler.filter((u) => anaUzerinde(u)).length;
  function hatDolu() {
    const kuyruk = urunler.filter((u) => u.durum === 'ana' && !u.sikisik);
    const enGeri = kuyruk.reduce((m, u) => Math.min(m, u.x), Infinity);
    return kuyruk.length >= 6 && enGeri < IST[1] && [0, 1, 2].every((s) => { const u = bekleyen(s); return !u || u.bekleT > 8; });
  }

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'alarm') return { metin: alarmNeden, seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAT DURDU', seviye: 'bekliyor' };
    if (kutulamaAriza) return { metin: 'KUTULAMA ARIZASI · HAT BİRİKİYOR', seviye: 'uyari' };
    const kilitli = kollar.find((k) => k.kilit);
    if (kilitli) return { metin: `KOL ${kilitli.s + 1} FOTOSEL ARIZASI · BESLEME KİLİTLİ`, seviye: 'uyari' };
    if (mk.faz === 'cikisBekle' && mk.t > 2) return { metin: 'ÇIKIŞ DOLU · PALETLEME BEKLENİYOR', seviye: 'uyari' };
    if (hatDolu()) return { metin: 'HAT DOLU · KOLLAR BEKLİYOR', seviye: 'uyari' };
    return { metin: `ÇALIŞIYOR · ${paketZaman.length} kutu/dk`, seviye: 'calisiyor' };
  }

  // ---------------------------------------------------------------- Delta HMI: kollar → ana hat → kutulama
  function hmiCiz(x, W, H) {
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2b8de2'); gr.addColorStop(1, '#0b4a9a');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '700 17px "Space Grotesk", sans-serif';
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('BESLEME → KUTULAMA', 14, 17);
    x.textAlign = 'right'; x.fillText(`${hz} Hz · ${paketZaman.length} kutu/dk`, W - 14, 17);
    const L = 20, R = W - 150;
    const mx = (v) => L + ((v - X0) / (X1 - X0)) * (R - L);
    const yA = 50, hA = 50, kolUst = yA + hA, kolH = 120;
    const yesil = '#40b84a', kirmizi = '#d8392c', amber = '#e0a020';
    x.lineWidth = 2; x.strokeStyle = '#08305f';
    x.fillStyle = calisir() ? yesil : kirmizi;
    x.fillRect(L, yA, R - L, hA); x.strokeRect(L, yA, R - L, hA);
    // akış okları
    x.fillStyle = 'rgba(255,255,255,.5)';
    for (let px = L + 30; px < R - 20; px += 90) { x.beginPath(); x.moveTo(px, yA + hA / 2 - 7); x.lineTo(px + 12, yA + hA / 2); x.lineTo(px, yA + hA / 2 + 7); x.fill(); }
    // kollar
    IST.forEach((sx, s) => {
      const k = kollar[s];
      const u = bekleyen(s);
      x.fillStyle = k.kilit || !calisir() ? kirmizi : u && u.bekleT > 3 ? amber : yesil;
      x.fillRect(mx(sx) - 28, kolUst, 56, kolH); x.strokeRect(mx(sx) - 28, kolUst, 56, kolH);
      x.fillStyle = '#fff'; x.font = '700 14px "Space Grotesk", sans-serif'; x.textAlign = 'center';
      x.fillText(`KOL ${s + 1} · ${k.teslim}`, mx(sx), kolUst + kolH + 14);
      x.font = '500 12px "Space Grotesk", sans-serif';
      x.fillText(`palet ${k.palet}`, mx(sx), kolUst + kolH + 31);
      if (k.kilit) {
        const cx = mx(sx) + 46, cy = kolUst + 20;
        x.fillStyle = '#ffd21a'; x.beginPath(); x.moveTo(cx, cy - 15); x.lineTo(cx + 16, cy + 12); x.lineTo(cx - 16, cy + 12); x.closePath(); x.fill();
        x.fillStyle = '#111'; x.font = '800 17px sans-serif'; x.fillText('!', cx, cy + 3);
      }
    });
    // kutulama makinesi
    const m0 = R + 8, mw = W - 14 - m0;
    x.fillStyle = kutulamaAriza ? kirmizi : mk.faz === 'hazir' ? yesil : amber;
    x.fillRect(m0, yA - 10, mw, hA + 20); x.strokeRect(m0, yA - 10, mw, hA + 20);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 15px "Space Grotesk", sans-serif';
    x.fillText('KUTULAMA', m0 + mw / 2, yA + 10);
    x.font = '500 11px "Space Grotesk", sans-serif';
    x.fillText(mkDurum().slice(0, 20), m0 + mw / 2, yA + 32);
    x.font = '700 13px "Space Grotesk", sans-serif';
    x.fillText(`Paketlenen ${paketlenen}`, m0 + mw / 2, yA + hA + 32);
    x.fillText(`Palet ${pal.n}/${PALET_KAP}`, m0 + mw / 2, yA + hA + 52);
    // ürünler
    x.lineWidth = 1.5;
    for (const u of urunler) {
      if (u.durum === 'yok' || u.durum === 'alin' || u.durum === 'cikis') continue;
      x.fillStyle = u.kutu.visible ? '#c58a45' : '#f6e7c8'; x.strokeStyle = '#6b3a0c';
      if (u.durum === 'ana' || (u.durum === 'transfer' && u.z < KOL0)) {
        const w = (KL / (X1 - X0)) * (R - L);
        x.fillRect(mx(u.x) - w / 2, yA + 10, w, hA - 20); x.strokeRect(mx(u.x) - w / 2, yA + 10, w, hA - 20);
      } else if (u.durum === 'makine') {
        x.fillRect(m0 + mw / 2 - 22, yA + 40, 44, 12); x.strokeRect(m0 + mw / 2 - 22, yA + 40, 44, 12);
      } else {
        const h = (KD / (KOL_SON - KOL0)) * kolH;
        const fy = kolUst + ((u.z - KOL0) / (KOL_SON - KOL0)) * kolH;
        const y0 = clamp(fy - h / 2, kolUst, kolUst + kolH - h);
        x.fillRect(mx(IST[u.kol]) - 21, y0, 42, h); x.strokeRect(mx(IST[u.kol]) - 21, y0, 42, h);
      }
    }
    // alt şerit: çalış / dur / onay + durum
    const by = H - 26;
    x.fillStyle = '#1e9a3a'; x.beginPath(); x.arc(40, by, 15, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.fillRect(34, by - 7, 4, 14); x.fillRect(42, by - 7, 4, 14);
    x.fillStyle = '#d8392c'; x.beginPath(); x.arc(82, by, 15, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.fillRect(76, by - 6, 12, 12);
    const db = durumBilgi();
    x.fillStyle = { calisiyor: '#9ff0a8', uyari: '#ffd21a', alarm: '#ffb3ad', bekliyor: '#dbe7f3' }[db.seviye];
    x.font = '700 15px "Space Grotesk", sans-serif'; x.textAlign = 'right';
    x.fillText(db.metin, W - 14, by);
  }

  const trend = new Trend([{ ad: 'Hattaki ürün', renk: '#39c5cf' }, { ad: 'Kutu/dk', renk: '#f2c200' }],
    { min: 0, max: 12, uzunluk: 300, periyot: 0.25 });
  const ekranZ = throttle(5);

  function update(dt, t) {
    zaman += dt;
    adim(dt);
    const db = durumBilgi();
    kule.set(db.seviye, t);
    if (!sicak) return;
    trend.ornekle(dt, [hattaSayi(), paketZaman.length]);
    if (ekranZ(dt)) {
      ekran.ciz(hmiCiz);
      mkEkran.standart('Kutulama', [['Durum', mkDurum().split(' ·')[0]], ['Çevrim', `${cevrim} s`], ['Paket', String(paketlenen)]],
        kutulamaAriza ? { metin: 'ARIZA', seviye: 'alarm' } : { metin: kabul() ? 'HAZIR' : 'MEŞGUL', seviye: kabul() ? 'calisiyor' : 'uyari' });
    }
  }

  // Açılışta salon canlı görünsün: ~40 sn'lik akışı önceden koştur (hat dolu başlar)
  for (let i = 0; i < 800; i++) { zaman += 0.05; adim(0.05); }
  sicak = true;

  const elleKoy = (s) => () => {
    if (opAcik[s]) return uyar(`KOL ${s + 1} OPERATÖRÜ AÇIK · ÖNCE KAPAT`);
    const k = kollar[s];
    if (k.kilit) return uyar(`KOL ${s + 1} KİLİTLİ`);
    if (!yukBos(s)) return uyar(`KOL ${s + 1} YÜKLEME UCU DOLU`);
    if (k.palet <= 0) return uyar(`KOL ${s + 1} PALETİ BOŞ`);
    if (uret(s)) k.palet--;
  };
  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'kaydirici', metin: 'Hat hızı (VFD frekansı)', min: 10, max: 50, adim: 1, birim: 'Hz', get: () => hz, set: (v) => (hz = v) },
    { tip: 'kaydirici', metin: 'Kutulama çevrim süresi', min: 5, max: 20, adim: 1, birim: 's', get: () => cevrim, set: (v) => (cevrim = v) },
    { tip: 'baslik', metin: 'Besleme operatörleri' },
    ...[0, 1, 2].map((s) => ({ tip: 'anahtar', metin: `Kol ${s + 1} operatörü (paletten kola)`, get: () => opAcik[s], set: (v) => (opAcik[s] = v) })),
    { tip: 'butonlar', ogeler: [0, 1, 2].map((s) => ({ metin: `Kol ${s + 1}'e koy`, tik: elleKoy(s) })) },
    { tip: 'anahtar', metin: 'Paletleme operatörü (çıkış)', get: () => paletOp, set: (v) => (paletOp = v) },
    { tip: 'baslik', metin: 'Arıza enjeksiyonu' },
    { tip: 'anahtar', metin: 'Kutulama makinesi arızası (karton sıkıştı)', get: () => kutulamaAriza, set: (v) => (kutulamaAriza = v) },
    { tip: 'secim', metin: 'Arızalı kol fotoseli', secenekler: [['-1', 'Yok'], ['0', 'Kol 1'], ['1', 'Kol 2'], ['2', 'Kol 3']],
      get: () => String(arizaliFotosel),
      set: (v) => { arizaliFotosel = +v; kollar.forEach((k) => { if (k.s !== arizaliFotosel) { k.kilit = false; k.arizaT = 0; } }); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Ana hatta ürün sıkıştır', tik: () => {
        const aday = urunler.filter((u) => u.durum === 'ana' && !u.sikisik && u.x < STOP_X - 0.5);
        const u = aday[Math.floor(Math.random() * aday.length)];
        if (u) { u.sikisik = true; u.mesh.rotation.y = 0.09; sikT = 0; } else uyar('SIKIŞTIRILACAK HAREKETLİ ÜRÜN YOK');
      } },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if (durum !== 'acil' && durum !== 'alarm') return;
        for (const u of urunler) if (u.sikisik) { u.sikisik = false; u.mesh.rotation.y = 0; }
        sikT = 0; alarmNeden = ''; durum = 'durdu';
      } },
    ] },
  ];

  // performans: kalkan pop-up grupların kendi içindeki sabit parçaları da birleştir (grupla hareket eder)
  if (lib.sabitle && new URLSearchParams(location.search).get('sabit') !== '0') {
    kollar.forEach((k) => lib.sabitle(k.pop, []));
  }

  return {
    id: 'konveyor',
    ad: 'Konveyör Hattı',
    altBaslik: '3 besleme kolu · 20 m hat · kutulama',
    kisa: 'Operatörler ham ürünü 3 besleme koluna koyar; kollar ana hatta boşluk olunca kayışlı transferle birleştirir, 20 m hat ürünü karton kutulama makinesine taşır. Makine paketlerken yeni ürün almaz; çıkışta kutular palete dizilir. AC sürücüler Modbus RS-485, mantık Siemens PLC, izleme Delta HMI.',
    proje: 'warehouse',
    ayakIzi: [29.2, 6.6],
    ayakIziMerkez: [0.35, -0.95],
    kamera: { poz: [0.35, 18, 28], hedef: [0.35, 0, -1.2] },
    mekanizmalar: [
      'Besleme kolları (3×): 4 şeritli yeşil kayış ürünü ana hatta doğru taşır, kol fotoselinde bekletir',
      'Pop-up transfer: kayışlar rulo aralarından ~25 mm kalkar, ürünü 90° ana hatta aktarır, iner',
      'Ana hat ruloları (20 m, 4 VFD bölgesi): dönüş hızı frekansla orantılı; sıfır basınçlı birikim',
      'Kutulama: giriş stoperi, karton açılımında yan/uç duvarlar 90° kalkar, üst kapaklar katlanır, bant/tutkal kafası geçer; vakum kafası magazinden yeni karton indirir',
      'Fotoseller: kol bekleme + ana hat birleşme; ürün varken ışın kırmızı, arızalıda turuncu LED',
      'Operatörler: paletten kola ürün koyar (3 kişi), çıkışta kutuyu palete dizer; paletler bitince yenilenir',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: akış kollardan ana hatta (benim ilk modelim tersti); hat sonunda karton sarma/kutulama makinesi; kol sensörü ürünü görür, ana hatta ürün varsa beslemez; makine paketlerken yeni ürün almaz; ham ürün de, kutular da paletlerde.',
      'warehouse-img-02/03: gri rulolar, rulo aralarından çıkan yeşil kayışlar ve dik çıkan kayışlı kollar → pop-up kayışlı transfer + 4 şeritli besleme kolu.',
      'warehouse-video-01: uzun yassı mobilya panelleri elle hatta konuyor → ham ürün ~1.8 × 0.9 m, kutu ~1.86 × 0.96 × 0.11 m (TAHMİN).',
      'TAHMİN: ana hat 20 m (Kaan), kol aralığı 5 m, kol boyu 2.2 m (2 ürün sığar), birleşme önceliği (aşağı akışta uzun bekleyen kol öne geçer), birleşme fotoselinin konumu.',
      'TAHMİN: kutulama makinesinin iç düzeni (çatı magazini + vakum kafası, wrap-around katlama sırası, bant kafası), çevrim süresi 8 s, palet 10 kat. Süreler gösterim için hızlandırılmış olabilir.',
    ],
    group: g,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (lib.sabitle)
    sabitHaric: () => [
      ...kollar.map((k) => k.pop),                     // pop-up kayışlar (kalkar)
      ...kollar.map((k) => k.paletG.yigin), paletCikis.yigin,   // palet yığınları (ölçek/görünürlük)
      vakum, bantKafa, karton, stoper,                 // kutulama makinesi hareketli parçaları
      ...urunler.map((u) => u.mesh),                   // ürün / kutu havuzu
    ],
    update,
    kontroller,
    degerler: () => [
      ['VFD frekansı', `${hz} Hz · ${fmt(calisir() ? hatHizi() : 0, 2)} m/s`],
      ['Ana hattaki ürün', String(hattaSayi())],
      ['Kutulama', mkDurum()],
      ['Paketlenen', `${paketlenen} kutu · ${paketZaman.length}/dk`],
      ['Kol 1 / 2 / 3', [0, 1, 2].map(kolDurum).join(' · ')],
      ['Kola aktarılan', kollar.map((k) => k.teslim).join(' / ')],
      ['Ham ürün paletleri', kollar.map((k) => (k.palet ? k.palet : 'değişiyor')).join(' / ')],
      ['Çıkış paleti', pal.degisT > 0 ? 'değişiyor' : `${pal.n}/${PALET_KAP}`],
    ],
    trend,
    durum: durumBilgi,
  };
}
