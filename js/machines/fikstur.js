// js/machines/fikstur.js — Blok Döndürme Fikstürü (motor bloğu · pergel vinç · CNC).
//
// Döngü (Kaan'ın tarifi, 2026-10-23): amaç motor bloğunu CNC makinesine
// yerleştirirken döndürmek. Vinç yukarıdan ham bloğu fikstüre koyar (0°) →
// dayama sıkıştırır, blok 90° devrilir → vinç devrilmiş bloğu alır (→ CNC) →
// fikstür eski haline (0°) döner → vinç yeni bloğu koyar … Pergel vinç tek
// kaynak: ham blok paleti / fikstür / CNC tablası / çıkış paleti arasında taşır.
//
// Fotoğraflardan (other-machines-img-03/04/05): masa yüksekliğinde beyaz
// çerçeveli, siyah panelli kabin; üstünde L biçimli beyaz devirme beşiği.
// Beşik arka kenardaki menteşe ekseni etrafında 90° döner; ortadaki büyük
// pnömatik silindir tahrik eder, yanlarda yardımcı amortisörler. Beşikteki
// iki pnömatik dayama bloğu V-çenelere sıkıştırır. Koruma (Kaan'ın düzeltmesi):
// yalnız arka yan tel çit; ön, sol ve sağ yan ışık perdesi. Sağda buton kutusu.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, pano, levha,
    canvasTex, orguDokusu, clamp, approach, lerp, fmt, throttle, easeInOut,
  } = lib;

  const g = new THREE.Group();
  const KW = 1.5, KD = 0.9, KH = 0.95;     // kabin
  const HY = 0.98, HZ = -0.32;              // menteşe ekseni (X boyunca)
  const BAZ = 0.72;                         // beşik taban uzunluğu (+Z)

  // ---------------------------------------------------------------- kabin
  const beyaz = M.beyaz;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.06, KH, 0.06, beyaz, sx * (KW / 2 - 0.03), KH / 2, sz * (KD / 2 - 0.03), g);
  for (const y of [0.15, KH - 0.04]) {
    for (const sz of [-1, 1]) box(KW, 0.07, 0.06, beyaz, 0, y, sz * (KD / 2 - 0.03), g);
    for (const sx of [-1, 1]) box(0.06, 0.07, KD, beyaz, sx * (KW / 2 - 0.03), y, 0, g);
  }
  // siyah paneller (ön, arka, yanlar)
  const panelMat = mat(0x17181a, { r: 0.55, m: 0.15, key: 'fikstur-panel' });
  box(KW - 0.14, 0.66, 0.015, panelMat, 0, 0.53, KD / 2 - 0.005, g);
  box(KW - 0.14, 0.66, 0.015, panelMat, 0, 0.53, -KD / 2 + 0.005, g);
  for (const sx of [-1, 1]) box(0.015, 0.66, KD - 0.14, panelMat, sx * (KW / 2 - 0.005), 0.53, 0, g);
  // perçin sırası (ön panel) — kabataslak ama fotoğraftaki karakter
  for (let i = 0; i < 9; i++) for (const y of [0.24, 0.84]) cyl(0.006, 0.006, M.celik, -0.66 + i * 0.165, y, KD / 2 + 0.005, g, { eksen: 'z', seg: 8 });
  // üst tabla: içi koyu, kenarlarda çelik kızaklar
  box(KW - 0.16, 0.02, KD - 0.16, M.koyu, 0, KH - 0.1, 0, g);
  for (const sx of [-1, 1]) box(0.04, 0.012, KD - 0.1, M.celik, sx * (KW / 2 - 0.1), KH + 0.0, 0, g);
  // menteşe yatakları + mil
  for (const sx of [-1, 1]) box(0.08, 0.08, 0.1, M.koyu, sx * 0.7, HY - 0.02, HZ, g);
  cyl(0.02, KW - 0.1, M.celik, 0, HY, HZ, g, { eksen: 'x', seg: 14 });

  // ---------------------------------------------------------------- devirme beşiği (L)
  const besik = new THREE.Group();
  besik.position.set(0, HY, HZ);
  g.add(besik);
  // taban: 4 boyuna kiriş + 3 traverse
  for (const x of [-0.62, -0.21, 0.21, 0.62]) {
    box(0.07, 0.05, BAZ, beyaz, x, 0.025, BAZ / 2, besik);
    box(0.03, 0.006, BAZ - 0.12, M.siyah, x, 0.052, BAZ / 2, besik); // kanal
    // V-çene (sabit dayama) — iki eğik çelik parça
    const v = new THREE.Group();
    v.position.set(x, 0.1, BAZ - 0.03);
    box(0.09, 0.1, 0.05, M.celik, 0, 0, 0, v);
    for (const s of [-1, 1]) {
      const p = box(0.035, 0.06, 0.05, M.krom, s * 0.032, 0.07, 0, v);
      p.rotation.z = s * -0.55;
    }
    besik.add(v);
  }
  for (const z of [0.04, BAZ / 2, BAZ - 0.06]) box(1.32, 0.05, 0.07, beyaz, 0, 0.025, z, besik);
  // dik kol (arka): direkler + kirişler
  for (const sx of [-1, 1]) box(0.08, 0.52, 0.08, beyaz, sx * 0.62, 0.26, -0.02, besik);
  box(1.32, 0.08, 0.08, beyaz, 0, 0.5, -0.02, besik);
  box(1.32, 0.06, 0.06, beyaz, 0, 0.27, -0.02, besik);
  // pnömatik dayamalar (2 adet): gövde dik kolun arkasında, mil +Z'ye
  const dayamalar = [-0.32, 0.32].map((x) => {
    box(0.1, 0.1, 0.03, M.celik, x, 0.12, 0.03, besik);                       // flanş
    cyl(0.038, 0.24, M.alu, x, 0.12, -0.13, besik, { eksen: 'z', seg: 18 });    // gövde
    box(0.085, 0.085, 0.03, M.alu, x, 0.12, -0.25, besik);                     // arka kapak
    const milGeo = new THREE.CylinderGeometry(0.013, 0.013, 1, 12);
    milGeo.rotateX(Math.PI / 2); milGeo.translate(0, 0, 0.5);
    const mil = new THREE.Mesh(milGeo, M.krom);
    mil.position.set(x, 0.12, 0.045); mil.castShadow = true;
    besik.add(mil);
    const pabuc = box(0.14, 0.08, 0.02, M.celik, x, 0.12, 0.07, besik);
    // mavi hava hortumları (gövdeden dik kola)
    beam([x - 0.025, 0.16, -0.2], [x - 0.025, 0.42, -0.06], 0.012, 0.012, M.mavi, besik);
    beam([x + 0.025, 0.16, -0.08], [x + 0.025, 0.42, -0.06], 0.012, 0.012, M.mavi, besik);
    return { mil, pabuc };
  });

  // ---------------------------------------------------------------- pnömatik tahrik + amortisörler
  function teleskop(parent, rG, Lg, rR, matG, matR) {
    const grp = new THREE.Group();
    parent.add(grp);
    cyl(rG, Lg, matG, 0, Lg / 2, 0, grp, { seg: 18 });
    cyl(rG * 1.25, 0.04, M.koyu, 0, 0.02, 0, grp, { seg: 18 });
    const rg = new THREE.CylinderGeometry(rR, rR, 1, 12);
    rg.translate(0, 0.5, 0);
    const rodM = new THREE.Mesh(rg, matR);
    rodM.castShadow = true;
    rodM.position.y = Lg * 0.9;
    grp.add(rodM);
    const d = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    return {
      grup: grp,
      guncelle(A, B) {
        grp.position.copy(A);
        d.subVectors(B, A);
        const L = d.length();
        grp.quaternion.setFromUnitVectors(Y, d.multiplyScalar(1 / L));
        rodM.scale.y = Math.max(0.01, L - Lg * 0.9);
      },
    };
  }
  const anaSil = teleskop(g, 0.05, 0.5, 0.02, M.alu, M.krom);
  const amortisor = [-1, 1].map(() => teleskop(g, 0.022, 0.32, 0.01, M.celik, M.krom));
  for (const sx of [-1, 1]) box(0.04, 0.06, 0.06, M.koyu, sx * 0.79, 0.62, 0.22, g); // amortisör pimi
  box(0.12, 0.05, 0.1, M.koyu, 0, 0.33, 0.15, g); // ana silindir alt pimi
  const _A = new THREE.Vector3(), _B = new THREE.Vector3();
  const besikNokta = (x, yl, zl, a, out) => out.set(x, HY + yl * Math.cos(a) + zl * Math.sin(a), HZ - yl * Math.sin(a) + zl * Math.cos(a));

  // ---------------------------------------------------------------- ışık perdesi (3 yan) + tel çit (arka)
  // Kaan: yalnız bir yan çitle kapalı, diğer üç yan ışık perdesiyle korunur. Köşe aynalı tek perde
  // olarak modellendi (TAHMİN): verici arka-sol → ayna ön-sol → ayna ön-sağ → alıcı arka-sağ.
  const PX = 1.0, PZ = 0.5, PZA = -0.95;
  const aynaMat = mat(0xd8dde2, { r: 0.08, m: 1, key: 'ayna' });
  const kolon = (x, z, ayna, yuzX, yuzZ) => {
    box(0.16, 1.95, 0.16, M.turuncu, x, 0.975, z, g);
    box(0.22, 0.03, 0.22, M.turuncu, x, 0.015, z, g);
    if (ayna) {
      const a = box(0.13, 0.95, 0.01, aynaMat, x, 1.38, z, g);   // 45° köşe aynası
      a.rotation.y = Math.atan2(yuzX, yuzZ);
    } else box(Math.abs(yuzX) > 0 ? 0.012 : 0.05, 0.95, Math.abs(yuzZ) > 0 ? 0.012 : 0.05, M.siyah, x + yuzX * 0.085, 1.38, z + yuzZ * 0.085, g);
  };
  kolon(-PX, PZA, false, 0, 1);              // verici (sol perdeye bakar)
  kolon(-PX, PZ, true, 1, -1);               // ön-sol ayna
  kolon(PX, PZ, true, -1, -1);               // ön-sağ ayna
  kolon(PX, PZA, false, 0, 1);               // alıcı
  const isinPoz = [];
  for (let y = 0.95; y <= 1.84; y += 0.05) {
    isinPoz.push(-PX, y, PZA + 0.09, -PX, y, PZ);          // sol yan
    isinPoz.push(-PX, y, PZ, PX, y, PZ);                    // ön
    isinPoz.push(PX, y, PZ, PX, y, PZA + 0.09);             // sağ yan
  }
  const isinGeo = new THREE.BufferGeometry();
  isinGeo.setAttribute('position', new THREE.Float32BufferAttribute(isinPoz, 3));
  const isinMat = new THREE.LineBasicMaterial({ color: 0x3fdc6a, transparent: true, opacity: 0.25 });
  const isinlar = new THREE.LineSegments(isinGeo, isinMat);
  g.add(isinlar);
  // tel koruma: sarı çerçeve + mavi örgü (yanlar ve arka)
  const orgu = orguDokusu();
  const orguMat = new THREE.MeshStandardMaterial({
    map: orgu, color: 0x2f6fc4, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3,
  });
  function telPanel(a, b, y0, y1) {
    const [x0, z0] = a, [x1, z1] = b;
    const len = Math.hypot(x1 - x0, z1 - z0), h = y1 - y0;
    const geo = new THREE.PlaneGeometry(len, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.05, uv.getY(i) * h / 0.05);
    const p = new THREE.Mesh(geo, orguMat);
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    p.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(p);
    for (const y of [y0, y1]) beam([x0, y, z0], [x1, y, z1], 0.035, 0.035, M.sari, g);
    for (const [x, z] of [a, b]) box(0.035, h, 0.035, M.sari, x, (y0 + y1) / 2, z, g);
  }
  telPanel([-0.9, PZA - 0.02], [0.9, PZA - 0.02], 0.1, 1.9);   // yalnız arka yan tel çit

  // ---------------------------------------------------------------- buton kutusu (img-03)
  const BKX = 1.42, BKZ = 0.78;
  box(0.05, 1.0, 0.05, M.koyu, BKX, 0.5, BKZ, g);
  box(0.3, 0.03, 0.3, M.koyu, BKX, 0.015, BKZ, g);
  const kutu = new THREE.Group();
  kutu.position.set(BKX, 1.12, BKZ);
  kutu.rotation.x = -0.35;
  g.add(kutu);
  box(0.46, 0.3, 0.1, M.pano, 0, 0, 0, kutu);
  const ETIKET = [['SİSTEM', 'OTOMATİK', 'MOTOR', 'HATA'], ['DAYAMA', 'DAYAMA', 'BLOK', 'BLOK']];
  const ALT = [['', '', 'START-STOP', 'RESET'], ['İLERİ', 'GERİ', '0° DÖN', '90° DÖN']];
  const yuz = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), new THREE.MeshStandardMaterial({
    map: canvasTex(440, 280, (x, w, h) => {
      x.fillStyle = '#d6d9d4'; x.fillRect(0, 0, w, h);
      x.textAlign = 'center'; x.fillStyle = '#111';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
        const cx = 60 + c * 107, cy = 82 + r * 120;
        x.fillStyle = '#f4f4f0'; x.fillRect(cx - 40, cy + 30, 80, 30);
        x.fillStyle = '#111'; x.font = '700 14px "Space Grotesk", sans-serif';
        x.fillText(ETIKET[r][c], cx, cy + 43);
        x.font = '600 11px "Space Grotesk", sans-serif';
        x.fillText(ALT[r][c], cx, cy + 56);
      }
    }), roughness: 0.6,
  }));
  yuz.position.z = 0.051;
  kutu.add(yuz);
  const butonRenk = [[0x1f6fd6, 0xef7d00, 0x22a046, 0xe02a24], [0x1f6fd6, 0x1f6fd6, 0x1f6fd6, 0x1f6fd6]];
  const butonlar = butonRenk.map((satir, r) => satir.map((renk, c) => {
    const m = lamba(renk, 0.05);
    const x = -0.22 + (60 + c * 107) / 1000, y = 0.14 - (82 + r * 120) / 1000;
    cyl(0.03, 0.02, M.koyu, x, y, 0.06, kutu, { eksen: 'z', seg: 18 });
    cyl(0.024, 0.02, m, x, y, 0.075, kutu, { eksen: 'z', seg: 18 });
    return m;
  }));
  acilStop(kutu, 0, 0.19, 0.0, 0).rotation.x = -Math.PI / 2 + 0.35;

  // ---------------------------------------------------------------- elektrik panosu + HMI + kule
  const pnl = pano(g, -1.75, 0, -0.75, 0.7, 1.8, 0.4, 0);
  const ekran = new Ekran(0.3, 0.19, 512);
  ekran.mesh.position.set(-1.75, 1.32, -0.75 + 0.21);
  g.add(ekran.mesh);
  box(0.33, 0.22, 0.02, M.siyah, -1.75, 1.32, -0.75 + 0.2, g);
  const kule = kuleLambasi(g, -1.75, 1.8, -0.75);
  // şartlandırıcı (FRL) panoya yakın
  box(0.06, 0.2, 0.06, M.mavi, -1.36, 1.0, -0.75, g);
  box(0.06, 0.2, 0.06, M.alu, -1.29, 1.0, -0.75, g);
  cyl(0.03, 0.015, M.beyaz, -1.36, 1.14, -0.72, g, { eksen: 'z', seg: 16 });
  void pnl;

  // ---------------------------------------------------------------- motor bloğu (kabataslak dökme demir)
  // Pivot = geometrik merkez. "Dik": üst yüz (silindir delikleri) +Y. "Yatık": beşikle
  // 90° devrilmiş hali (rotation.x = −π/2): yerel +Z yüzü yukarı bakar (CNC bu yüzü işler).
  const dokum = mat(0x4b4e51, { r: 0.72, m: 0.55, key: 'dokum' });
  const dokumKoyu = mat(0x232527, { r: 0.8, m: 0.4, key: 'dokum-koyu' });
  const islenmisMat = mat(0xd8dde2, { r: 0.16, m: 1, key: 'islenmis' });
  const BW = 0.65, BH = 0.4, BD = 0.42;     // dik konumda X × Y × Z
  const halkaGeo = new THREE.TorusGeometry(0.03, 0.009, 6, 14);
  const GOZ_DIK = [[-0.28, BH / 2 + 0.03, 0], [0.28, BH / 2 + 0.03, 0]].map((p) => new THREE.Vector3(...p));
  const GOZ_YATIK = [[-0.28, 0, BD / 2 + 0.03], [0.28, 0, BD / 2 + 0.03]].map((p) => new THREE.Vector3(...p));
  function motorBlok() {
    const dis = new THREE.Group();
    const ic = new THREE.Group();
    ic.position.y = -BH / 2;
    dis.add(ic);
    box(BW - 0.06, 0.13, BD - 0.08, dokum, 0, 0.065, 0, ic);                 // karter eteği
    box(BW, BH - 0.13, BD, dokum, 0, 0.13 + (BH - 0.13) / 2, 0, ic);        // gövde
    for (let i = 0; i < 4; i++) cyl(0.062, 0.012, dokumKoyu, -0.225 + i * 0.15, BH + 0.001, 0, ic, { seg: 18 }); // silindirler
    for (const x of [-0.2, 0.2]) box(0.12, 0.09, 0.03, dokum, x, 0.22, -(BD / 2 + 0.012), ic); // yan bosajlar
    box(0.03, 0.22, 0.3, dokum, BW / 2 + 0.015, 0.24, 0, ic);               // ön kapak çıkıntısı
    for (const x of [-0.28, 0.28]) {                                         // kaldırma halkaları
      const h1 = new THREE.Mesh(halkaGeo, M.celik); h1.position.set(x, BH + 0.03, 0); ic.add(h1);
      const h2 = new THREE.Mesh(halkaGeo, M.celik); h2.position.set(x, BH / 2, BD / 2 + 0.03); h2.rotation.x = Math.PI / 2; ic.add(h2);
    }
    const yuzey = box(BW - 0.12, BH - 0.08, 0.006, islenmisMat, 0, BH / 2, BD / 2 + 0.003, ic); // CNC'de işlenen yüz
    yuzey.visible = false;
    dis.visible = false;
    g.add(dis);
    return { grup: dis, yuzey, durum: 'yok', islenmis: false, slot: -1, tasima: 'dik' };
  }
  const havuz = Array.from({ length: 9 }, motorBlok);
  // Bloğu bir ebeveyne yerleştir (dünya → yerel geçişi attach ile, sonra kesin poz)
  function tak(b, parent, x, y, z, yatik) {
    parent.attach(b.grup);
    b.grup.position.set(x, y, z);
    b.grup.rotation.set(yatik ? -Math.PI / 2 : 0, 0, 0);
    b.grup.visible = true;
  }

  // ---------------------------------------------------------------- paletler (ham blok / işlenmiş blok)
  const PALET_Y = 0.12;
  const STOK = { x: -2.4, z: -2.6 }, CIKIS = { x: 1.9, z: -4.0 };
  const STOK_SLOT = [[-0.38, -0.27], [0.38, -0.27], [0, 0.3]];
  const CIKIS_SLOT = [[-0.36, -0.27], [0.36, -0.27], [0, 0.27]];
  function palet(x, z, w, d, yazi) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    g.add(p);
    for (const dz of [-d / 2 + 0.06, 0, d / 2 - 0.06]) box(w, 0.08, 0.1, M.ahsap, 0, 0.04, dz, p);
    for (let k = 0; k < 6; k++) box(0.12, 0.04, d, M.ahsap, -w / 2 + 0.06 + (k * (w - 0.12)) / 5, 0.1, 0, p);
    const lv = levha([yazi], 0.9, 0.16, { bg: '#151b22', fg: '#f2c200', font: 60, px: 512 });
    lv.rotation.x = -Math.PI / 2;
    lv.position.set(0, 0.006, d / 2 + 0.2);
    p.add(lv);
  }
  palet(STOK.x, STOK.z, 1.6, 1.2, 'HAM BLOK');
  palet(CIKIS.x, CIKIS.z, 1.5, 1.1, 'İŞLENMİŞ');

  // ---------------------------------------------------------------- CNC işleme merkezi (dikey, kabataslak)
  const CX = 3.0, CZ = -2.2;
  const TABLA_UST = 0.94;
  const TABLA_YUK = { x: 0.5, z: 0.45 }, TABLA_IS = { x: 0, z: -0.3 };   // cnc yerel
  const cncG = new THREE.Group();
  cncG.position.set(CX, 0, CZ);
  g.add(cncG);
  const cncGri = mat(0xd9dcdf, { r: 0.5, m: 0.2, key: 'cnc' });
  const cncKoyu = mat(0x2d3640, { r: 0.6, m: 0.3, key: 'cnc-koyu' });
  box(2.0, 0.85, 1.8, cncGri, 0, 0.425, 0, cncG);                       // alt gövde
  box(2.02, 0.06, 1.82, cncKoyu, 0, 0.86, 0, cncG);                     // bel bandı
  box(2.0, 1.45, 0.06, cncGri, 0, 1.6, -0.87, cncG);                    // arka duvar
  for (const sx of [-1, 1]) box(0.06, 1.45, 1.8, cncGri, sx * 0.97, 1.6, 0, cncG);
  box(2.0, 0.06, 0.95, cncGri, 0, 2.33, -0.425, cncG);                  // sabit çatı (arka)
  box(1.0, 0.06, 0.92, cncGri, -0.5, 2.33, 0.44, cncG);                 // sabit çatı (ön sol)
  box(1.0, 1.45, 0.06, cncGri, -0.5, 1.6, 0.87, cncG);                  // ön sabit panel
  const cncYazi = levha(['VMC · CNC'], 0.6, 0.14, { bg: '#2d3640', fg: '#fff', font: 64, px: 384 });
  cncYazi.position.set(-0.5, 2.15, 0.905);
  cncG.add(cncYazi);
  // kayar kapı: ön sağ panel + çatı şeridi birlikte sola kayar → tabla üstü vinç için açılır
  const kapi = new THREE.Group();
  cncG.add(kapi);
  box(0.06, 1.45, 0.05, cncKoyu, 0.03, 1.6, 0.92, kapi);
  box(0.06, 1.45, 0.05, cncKoyu, 0.97, 1.6, 0.92, kapi);
  box(1.0, 0.12, 0.05, cncKoyu, 0.5, 2.27, 0.92, kapi);
  box(1.0, 0.3, 0.05, cncKoyu, 0.5, 1.03, 0.92, kapi);
  box(0.88, 0.9, 0.02, M.cam, 0.5, 1.72, 0.92, kapi);
  box(1.0, 0.05, 0.92, cncGri, 0.5, 2.39, 0.44, kapi);
  box(0.03, 0.3, 0.04, M.siyah, 0.12, 1.5, 0.96, kapi);
  // iş mili kolonu + kafa (Z ekseni) + dönen takım
  box(0.55, 1.3, 0.4, cncKoyu, 0, 1.65, -0.62, cncG);
  const kafa = new THREE.Group();
  kafa.position.set(0, 1.95, TABLA_IS.z);
  cncG.add(kafa);
  box(0.32, 0.32, 0.36, cncKoyu, 0, 0.16, -0.06, kafa);
  cyl(0.075, 0.14, M.celik, 0, -0.07, 0, kafa, { seg: 18 });
  const takim = new THREE.Group();
  takim.position.y = -0.14;
  kafa.add(takim);
  cyl(0.035, 0.08, M.koyu, 0, -0.04, 0, takim, { seg: 14 });
  cyl(0.022, 0.12, M.krom, 0, -0.14, 0, takim, { seg: 12 });
  box(0.07, 0.014, 0.014, M.sari, 0.015, -0.195, 0, takim);             // kesici uç (dönüş görünsün)
  // tabla (X/Y eksenleri: yükleme konumu ↔ işleme konumu)
  const tabla = new THREE.Group();
  cncG.add(tabla);
  box(0.8, 0.08, 0.55, M.celik, 0, TABLA_UST - 0.04, 0, tabla);
  for (const k of [-1, 0, 1]) box(0.78, 0.006, 0.02, M.siyah, 0, TABLA_UST + 0.001, k * 0.15, tabla);
  box(0.6, 0.06, 0.45, cncKoyu, 0, TABLA_UST - 0.11, 0, tabla);
  // iç aydınlatma + kontrol paneli + kule lambası
  const isikMat = lamba(0xfff1cf, 0.05);
  box(0.6, 0.02, 0.12, isikMat, 0, 2.28, 0.0, cncG).castShadow = false;
  const kontrolG = new THREE.Group();
  kontrolG.position.set(1.18, 1.55, 0.72);
  kontrolG.rotation.y = -0.6;
  cncG.add(kontrolG);
  box(0.34, 0.48, 0.08, cncKoyu, 0, 0, 0, kontrolG);
  const cncEkran = new Ekran(0.28, 0.18, 384);
  cncEkran.mesh.position.set(0, 0.08, 0.042);
  kontrolG.add(cncEkran.mesh);
  acilStop(kontrolG, 0.1, -0.16, 0.05, 0);
  box(0.05, 0.75, 0.05, cncKoyu, 1.18, 0.95, 0.72, cncG);
  const cncKule = kuleLambasi(cncG, 0.85, 2.36, -0.75);

  // ---------------------------------------------------------------- pergel (kolonlu) vinç
  const VC = { x: 0.3, z: -2.5 }, BOM_Y = 4.4, BOM_L = 4.4;
  const PALANGA_ALT = BOM_Y - 0.6, KANCA_UST = 3.55, SAPAN = 0.5;
  const vincSari = mat(0xf2b700, { r: 0.5, m: 0.25, key: 'vinc' });
  box(0.8, 0.05, 0.8, M.koyu, VC.x, 0.025, VC.z, g);
  cyl(0.16, BOM_Y + 0.25, vincSari, VC.x, (BOM_Y + 0.25) / 2, VC.z, g, { seg: 20 });
  const bom = new THREE.Group();
  bom.position.set(VC.x, BOM_Y, VC.z);
  g.add(bom);
  cyl(0.23, 0.12, M.koyu, 0, 0.12, 0, bom, { seg: 20 });                     // döner yatak
  box(0.16, 0.28, BOM_L, vincSari, 0, 0, BOM_L / 2 + 0.1, bom);               // I kiriş
  box(0.26, 0.03, BOM_L, vincSari, 0, -0.155, BOM_L / 2 + 0.1, bom);          // alt başlık (araba yolu)
  beam([0, -0.15, 1.5], [0, -1.35, 0.15], 0.1, 0.1, vincSari, bom);          // payanda
  box(0.26, 0.26, 0.06, M.kirmizi, 0, 0, BOM_L + 0.13, bom);                 // uç stoperi
  const araba = new THREE.Group();
  bom.add(araba);
  box(0.32, 0.08, 0.28, M.koyu, 0, -0.21, 0, araba);
  box(0.24, 0.3, 0.32, mat(0x6f7882, { r: 0.5, m: 0.4, key: 'palanga' }), 0, -0.41, 0, araba);
  cyl(0.06, 0.05, M.koyu, 0, -0.58, 0, araba, { seg: 14 });
  // kanca: döner (swivel) — yükün yönü bomla birlikte dönmez; makine çerçevesinde
  const kanca = new THREE.Group();
  g.add(kanca);
  box(0.12, 0.16, 0.08, vincSari, 0, 0.1, 0, kanca);
  const kancaUcu = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI * 1.5), M.celik);
  kancaUcu.position.y = -0.02;
  kancaUcu.rotation.z = Math.PI * 0.75;
  kanca.add(kancaUcu);
  const zincir = cyl(0.012, 1, M.koyu, 0, 0, 0, g, { seg: 6 });
  const sapan = [0, 1].map(() => cyl(0.007, 1, M.siyah, 0, 0, 0, g, { seg: 5 }));

  // ---------------------------------------------------------------- vinç operatörü (telsiz kumandalı)
  // Işık perdesinin dışındaki güvenli şeritte (z = OPZ) yükü izleyerek yürür, yüzü kancaya/yüke
  // döner; iş yokken buton kutusunun yanında fikstüre bakar. "Işık perdesi kesildi" anahtarı
  // açılınca ön perdeye gidip sol koluyla uzanır — perdeyi kesen el budur.
  const op = lib.operator({ kumanda: true });
  g.add(op.group);
  const OPZ = 1.35, OP_PARK_X = 0.55, PERDE_EL = { x: -0.15, z: PZ + 0.45 };
  const opD = { x: OP_PARK_X, z: OPZ, yon: Math.PI };
  const aciFark = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  // ---------------------------------------------------------------- mantık
  let aci = 0, hedefAci = 0;       // derece
  let dayama = 0, hedefDayama = 0; // 0 geri .. 1 ileri
  let mod = 'oto';                 // oto | manuel
  let durum = 'calisiyor';         // calisiyor | durdu | perde | acil | hava
  let perde = false, havaArizasi = false;
  let hava = 6.1, cevrim = 0, sonCevrim = 0, sonCikis = 0, zaman = 0;
  let uyariMetin = '', uyariT = 0;
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };
  const ACI_HIZ = 60;              // °/s
  const DAY_HIZ = 1.8;             // 1/s
  let besikBlok = null;            // beşikteki motor bloğu
  let fFaz = 'bekle_blok';         // bekle_blok | sikistir | don90 | gevset | bekle_alim | don0
  const FAZ_AD = {
    bekle_blok: 'Blok bekleniyor (0°)', sikistir: 'Dayama ileri', don90: 'Blok 90° dönüyor',
    gevset: 'Dayama geri', bekle_alim: 'Vinç bekleniyor (90°)', don0: 'Fikstür 0°\'a dönüyor',
  };

  const vardi = () => Math.abs(aci - hedefAci) < 0.05 && Math.abs(dayama - hedefDayama) < 0.005;
  const besikSabit = (a) => Math.abs(aci - a) < 0.05 && Math.abs(hedefAci - a) < 0.05 && dayama < 0.02 && hedefDayama === 0;

  // Vinç durumu: kanca noktası (sapanların bağlandığı yer) makine çerçevesinde
  const vinc = { phi: 0.35, r: 1.0, y: KANCA_UST, gorev: null, yuk: null, metin: 'boşta' };
  const kx = () => VC.x + vinc.r * Math.sin(vinc.phi);
  const kz = () => VC.z + vinc.r * Math.cos(vinc.phi);
  const PARK = { x: VC.x + Math.sin(0.35), z: VC.z + Math.cos(0.35) };
  const vincBesikUstunde = () => Math.hypot(kx(), kz() - (HZ + 0.1)) < 0.9 && vinc.y < 2.75;
  const vincCncUstunde = () => Math.hypot(kx() - (CX + TABLA_YUK.x), kz() - (CZ + TABLA_YUK.z)) < 0.9 && vinc.y < 2.7;

  function gorevKur(ad, kay, hed) {
    const adimlar = [{ tip: 'y', hedef: KANCA_UST }, { tip: 'xz', x: kay.x, z: kay.z }];
    if (kay.hy != null) {
      adimlar.push({ tip: 'y', hedef: kay.hy, bekle: kay.bekle }, { tip: 'dur', sure: 0.6, son: kay.islem }, { tip: 'y', hedef: KANCA_UST });
    }
    if (hed) adimlar.push({ tip: 'xz', x: hed.x, z: hed.z }, { tip: 'y', hedef: hed.hy, bekle: hed.bekle },
      { tip: 'dur', sure: 0.6, son: hed.islem }, { tip: 'y', hedef: KANCA_UST });
    vinc.gorev = { ad, adim: 0, t: 0, adimlar };
  }
  const parkGorevi = () => gorevKur('Park', { x: PARK.x, z: PARK.z });

  function vincGuncelle(dt) {
    const G = vinc.gorev;
    if (!G) { vinc.metin = 'boşta'; return; }
    const a = G.adimlar[G.adim];
    let bitti = false;
    vinc.metin = G.ad;
    if (a.tip === 'y') {
      if (a.bekle && !a.bekle()) { vinc.metin = `${G.ad} · bekliyor`; return; }
      vinc.y = approach(vinc.y, a.hedef, clamp(Math.abs(a.hedef - vinc.y) * 2.5, 0.08, 0.6) * dt);
      bitti = vinc.y === a.hedef;
    } else if (a.tip === 'xz') {
      const tphi = Math.atan2(a.x - VC.x, a.z - VC.z), tr = Math.hypot(a.x - VC.x, a.z - VC.z);
      const dphi = Math.atan2(Math.sin(tphi - vinc.phi), Math.cos(tphi - vinc.phi));
      const sp = clamp(Math.abs(dphi) * 2, 0.05, 0.55) * dt;
      vinc.phi += clamp(dphi, -sp, sp);
      vinc.r = approach(vinc.r, tr, clamp(Math.abs(tr - vinc.r) * 2.5, 0.06, 0.6) * dt);
      bitti = Math.abs(dphi) < 0.003 && vinc.r === tr;
      if (bitti) vinc.phi = tphi;
    } else {
      G.t += dt;
      bitti = G.t >= a.sure;
      if (bitti) { G.t = 0; a.son?.(); }
    }
    if (bitti && ++G.adim >= G.adimlar.length) vinc.gorev = null;
  }

  // ---- görevler (vinç tek kaynak)
  const stokBlok = () => { for (const b of havuz) if (b.durum === 'stok') return b; return null; };
  const cikisBos = () => {
    for (let s = 0; s < CIKIS_SLOT.length; s++) if (!havuz.some((b) => b.durum === 'cikis' && b.slot === s)) return s;
    return -1;
  };
  const kancayaAl = (b, tasima) => { kanca.attach(b.grup); b.durum = 'kanca'; b.tasima = tasima; vinc.yuk = b; };

  function gorevStokBesik() {
    const b = stokBlok();
    const [sx, sz] = STOK_SLOT[b.slot];
    b.durum = 'rezerve';
    gorevKur('Ham blok → fikstür',
      { x: STOK.x + sx, z: STOK.z + sz, hy: PALET_Y + BH + 0.03 + SAPAN, islem: () => kancayaAl(b, 'dik') },
      { x: 0, z: HZ + 0.45, hy: HY + 0.055 + BH + 0.03 + SAPAN, bekle: () => besikSabit(0),
        islem: () => { tak(b, besik, 0, 0.055 + BH / 2, 0.45, false); b.durum = 'besik'; besikBlok = b; vinc.yuk = null; } });
  }
  function gorevBesikCnc() {
    const b = besikBlok;
    gorevKur('Devrik blok → CNC',
      { x: 0, z: HZ - (0.055 + BH / 2), hy: HY + 0.45 + BD / 2 + 0.03 + SAPAN, bekle: () => besikSabit(90),
        islem: () => { kancayaAl(b, 'yatik'); besikBlok = null; } },
      { x: CX + TABLA_YUK.x, z: CZ + TABLA_YUK.z, hy: TABLA_UST + BD + 0.03 + SAPAN, bekle: () => cncD.durum === 'bos' && !cncD.blok,
        islem: () => { tak(b, tabla, 0, TABLA_UST + BD / 2, 0, true); b.durum = 'cnc'; cncD.blok = b; vinc.yuk = null; } });
  }
  function gorevCncCikis() {
    const b = cncD.blok, s = cikisBos();
    const [sx, sz] = CIKIS_SLOT[s];
    gorevKur('İşlenmiş blok → çıkış paleti',
      { x: CX + TABLA_YUK.x, z: CZ + TABLA_YUK.z, hy: TABLA_UST + BD + 0.03 + SAPAN, bekle: () => cncD.durum === 'bitti',
        islem: () => { kancayaAl(b, 'yatik'); cncD.blok = null; } },
      { x: CIKIS.x + sx, z: CIKIS.z + sz, hy: PALET_Y + BD + 0.03 + SAPAN,
        islem: () => {
          tak(b, g, CIKIS.x + sx, PALET_Y + BD / 2, CIKIS.z + sz, true);
          b.durum = 'cikis'; b.slot = s; vinc.yuk = null;
          cevrim++; if (sonCikis) sonCevrim = zaman - sonCikis; sonCikis = zaman;
        } });
  }

  const KOSUL = {
    stokBesik: () => besikSabit(0) && !besikBlok && !!stokBlok(),
    besikCnc: () => aci > 89.95 && !!besikBlok && besikSabit(90) && cncD.durum === 'bos' && !cncD.blok,
    cncCikis: () => cncD.durum === 'bitti' && !!cncD.blok && cikisBos() >= 0,
  };
  function vincOto() {
    if (vinc.gorev && vinc.gorev.ad !== 'Park') return;
    if (KOSUL.cncCikis()) return gorevCncCikis();
    if (fFaz === 'bekle_alim' && KOSUL.besikCnc()) return gorevBesikCnc();
    if (fFaz === 'bekle_blok' && KOSUL.stokBesik()) return gorevStokBesik();
    if (!vinc.gorev && Math.hypot(kx() - PARK.x, kz() - PARK.z) > 0.01) parkGorevi();
  }

  // ---- fikstür otomatik sırası
  function fiksturOto() {
    const v = vardi();
    switch (fFaz) {
      case 'bekle_blok': if (besikBlok && !vincBesikUstunde() && v) { fFaz = 'sikistir'; hedefDayama = 1; } break;
      case 'sikistir': if (v) { fFaz = 'don90'; hedefAci = 90; } break;
      case 'don90': if (v) { fFaz = 'gevset'; hedefDayama = 0; } break;
      case 'gevset': if (v) fFaz = 'bekle_alim'; break;
      case 'bekle_alim': if (!besikBlok && !vincBesikUstunde()) { fFaz = 'don0'; hedefAci = 0; hedefDayama = 0; } break;
      case 'don0': if (v) fFaz = 'bekle_blok'; break;
      default: break;
    }
  }
  function otoyaGec() {
    if (aci > 45) {
      if (besikBlok) { fFaz = 'gevset'; hedefAci = 90; hedefDayama = 0; } else { fFaz = 'don0'; hedefAci = 0; hedefDayama = 0; }
    } else if (besikBlok) { fFaz = 'sikistir'; hedefAci = 0; hedefDayama = 1; } else { fFaz = 'don0'; hedefAci = 0; hedefDayama = 0; }
  }

  // ---- CNC durum makinesi (ayrı makine: perde/hava fikstürü durdurur, CNC'yi değil; ACİL hepsini)
  const cncD = { durum: 'bos', t: 0, blok: null, kapi: 1, tabla: 0, mil: 0, milAci: 0 };
  let cncSure = 10;
  const CNC_AD = {
    bos: 'boş · kapı açık', kapan: 'kapı kapanıyor', ice: 'tabla içeri', isleme: 'işleniyor',
    disa: 'tabla dışarı', ac: 'kapı açılıyor', bitti: 'bitti · blok alınacak',
  };
  function cncGuncelle(dt) {
    if (durum === 'acil') return;
    const c = cncD;
    switch (c.durum) {
      case 'bos':
        c.kapi = approach(c.kapi, 1, dt / 1.2); c.tabla = approach(c.tabla, 0, dt / 1.4);
        if (c.blok && !vincCncUstunde()) c.durum = 'kapan';
        break;
      case 'kapan': c.kapi = approach(c.kapi, 0, dt / 1.2); if (c.kapi === 0) c.durum = 'ice'; break;
      case 'ice': c.tabla = approach(c.tabla, 1, dt / 1.4); if (c.tabla === 1) { c.durum = 'isleme'; c.t = 0; } break;
      case 'isleme':
        c.t += dt;
        if (c.t >= cncSure) { c.blok.islenmis = true; c.blok.yuzey.visible = true; c.durum = 'disa'; }
        break;
      case 'disa': c.tabla = approach(c.tabla, 0, dt / 1.4); if (c.tabla === 0) c.durum = 'ac'; break;
      case 'ac': c.kapi = approach(c.kapi, 1, dt / 1.2); if (c.kapi === 1) c.durum = 'bitti'; break;
      case 'bitti': if (!c.blok) c.durum = 'bos'; break;
      default: break;
    }
    const islem = c.durum === 'isleme';
    c.mil = islem ? clamp(Math.min(c.t, cncSure - c.t) / 0.8, 0, 1) : 0;
    if (islem) c.milAci += dt * 55;
  }

  // ---- palet bakımı: stok bitince yeni ham bloklar, çıkış dolunca palet alınır (forklift varsayımı)
  let stokT = 0, cikisT = 0;
  function paletBakim(dt) {
    let stokta = 0, cikista = 0;
    for (const b of havuz) { if (b.durum === 'stok' || b.durum === 'rezerve') stokta++; if (b.durum === 'cikis') cikista++; }
    if (stokta === 0) {
      stokT += dt;
      if (stokT > 4) {
        stokT = 0;
        for (let s = 0; s < STOK_SLOT.length; s++) {
          const b = havuz.find((x) => x.durum === 'yok');
          if (!b) break;
          hamYap(b, s);
        }
      }
    } else stokT = 0;
    if (cikista >= CIKIS_SLOT.length) {
      cikisT += dt;
      if (cikisT > 4) { cikisT = 0; for (const b of havuz) if (b.durum === 'cikis') { b.durum = 'yok'; b.grup.visible = false; } }
    } else cikisT = 0;
  }
  function hamYap(b, s) {
    b.islenmis = false; b.yuzey.visible = false;
    const [sx, sz] = STOK_SLOT[s];
    tak(b, g, STOK.x + sx, PALET_Y + BH / 2, STOK.z + sz, false);
    b.durum = 'stok'; b.slot = s;
  }

  // ---- başlangıç: stokta 3 ham blok, beşikte 1 blok, CNC'de işlenmekte olan 1 blok, çıkışta 1 işlenmiş
  for (let s = 0; s < 3; s++) hamYap(havuz[s], s);
  tak(havuz[3], besik, 0, 0.055 + BH / 2, 0.45, false); havuz[3].durum = 'besik'; besikBlok = havuz[3];
  tak(havuz[4], tabla, 0, TABLA_UST + BD / 2, 0, true); havuz[4].durum = 'cnc'; cncD.blok = havuz[4];
  Object.assign(cncD, { durum: 'isleme', t: 3, kapi: 0, tabla: 1 });
  tak(havuz[5], g, CIKIS.x + CIKIS_SLOT[0][0], PALET_Y + BD / 2, CIKIS.z + CIKIS_SLOT[0][1], true);
  Object.assign(havuz[5], { durum: 'cikis', slot: 0, islenmis: true }); havuz[5].yuzey.visible = true;

  const trend = new Trend([{ ad: 'Açı °', renk: '#39c5cf' }, { ad: 'Dayama %', renk: '#f2c200' }, { ad: 'Kanca %', renk: '#e8735a' }],
    { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(5), cncEkranZ = throttle(3);
  const hareketVar = () => durum === 'calisiyor';
  const _P = new THREE.Vector3(), _Q = new THREE.Vector3(), _D = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);

  function update(dt, t) {
    zaman = t;
    if (hareketVar()) {
      if (mod === 'oto') { fiksturOto(); vincOto(); }
      vincGuncelle(dt);
    }
    cncGuncelle(dt);
    paletBakim(dt);
    uyariT = Math.max(0, uyariT - dt);

    // pnömatik eksenler: güvenli duruşta valfler kapalı, olduğu yerde kalır. Kanca beşik üstündeyken dönüş kilitli.
    const onceA = aci, onceD = dayama;
    if (hareketVar()) {
      if (!vincBesikUstunde()) {
        aci = approach(aci, hedefAci, ACI_HIZ * dt * (0.35 + 0.65 * Math.sin(Math.PI * clamp(Math.abs(aci - hedefAci) / 90 + 0.15, 0, 1))));
      }
      dayama = approach(dayama, hedefDayama, DAY_HIZ * dt);
    }
    const tuketim = Math.abs(aci - onceA) / Math.max(dt, 1e-3) / 60 * 0.6 + Math.abs(dayama - onceD) / Math.max(dt, 1e-3) * 0.25;
    const hedefHava = havaArizasi ? 3.2 : 6.2;
    hava += ((hedefHava - hava) * 1.2 - tuketim * 0.8) * dt + (Math.random() - 0.5) * 0.01;
    if (havaArizasi && hava < 4.0 && durum === 'calisiyor') durum = 'hava';

    // fikstür görselleri
    const a = (aci * Math.PI) / 180;
    besik.rotation.x = -a;
    for (const d of dayamalar) { d.mil.scale.z = 0.03 + dayama * 0.17; d.pabuc.position.z = 0.075 + dayama * 0.165; }
    anaSil.guncelle(_A.set(0, 0.35, 0.15), besikNokta(0, -0.03, 0.42, a, _B));
    amortisor.forEach((s, i) => {
      const sx = i ? 1 : -1;
      s.guncelle(_A.set(sx * 0.79, 0.62, 0.22), besikNokta(sx * 0.7, 0.03, 0.3, a, _B));
    });
    isinMat.color.setHex(perde ? 0xff3b30 : 0x3fdc6a);
    isinMat.opacity = perde ? 0.75 : 0.22;

    // vinç görselleri: bom dönüşü, araba, kanca, zincir, sapanlar
    bom.rotation.y = vinc.phi;
    araba.position.z = vinc.r;
    kanca.position.set(kx(), vinc.y, kz());
    const zAlt = vinc.y + 0.18;
    zincir.position.set(kanca.position.x, (zAlt + PALANGA_ALT) / 2, kanca.position.z);
    zincir.scale.y = Math.max(0.01, PALANGA_ALT - zAlt);
    const yuk = vinc.yuk;
    sapan.forEach((s, i) => {
      s.visible = !!yuk;
      if (!yuk) return;
      yuk.grup.updateWorldMatrix(true, false);
      _P.copy(yuk.tasima === 'dik' ? GOZ_DIK[i] : GOZ_YATIK[i]).applyMatrix4(yuk.grup.matrixWorld);
      g.worldToLocal(_P);
      _Q.set(kanca.position.x, vinc.y - 0.04, kanca.position.z);
      _D.subVectors(_P, _Q);
      const L = _D.length();
      s.position.addVectors(_P, _Q).multiplyScalar(0.5);
      s.quaternion.setFromUnitVectors(_Y, _D.multiplyScalar(1 / L));
      s.scale.y = L;
    });

    // vinç operatörü: hedef nokta + bakış yönü
    let hx = opD.x, hz = opD.z, bakX = 0, bakZ = HZ;
    if (perde) { hx = PERDE_EL.x; hz = PERDE_EL.z; bakX = hx; bakZ = hz - 1; }
    else if (durum !== 'acil') {
      const aktif = vinc.gorev && vinc.gorev.ad !== 'Park';
      hx = aktif ? clamp(kx(), -2.6, 3.3) : OP_PARK_X; hz = OPZ;
      if (aktif) { bakX = kx(); bakZ = kz(); }
    }
    const ddx = hx - opD.x, ddz = hz - opD.z, dd = Math.hypot(ddx, ddz);
    const yuruyor = dd > 0.03;
    if (yuruyor) { const s = Math.min(dd, 1.1 * dt) / dd; opD.x += ddx * s; opD.z += ddz * s; }
    const hedefYon = yuruyor && dd > 0.3 ? Math.atan2(ddx, ddz) : Math.atan2(bakX - opD.x, bakZ - opD.z);
    opD.yon += aciFark(hedefYon, opD.yon) * (1 - Math.exp(-6 * dt));
    op.poz('on');
    const zip = op.yuru(t, yuruyor);
    if (perde && !yuruyor) op.kolSol.rotation.x = -1.5;            // sol el ön perdeyi keser
    op.group.position.set(opD.x, zip, opD.z);
    op.group.rotation.y = opD.yon;

    // CNC görselleri
    kapi.position.x = -1.0 * cncD.kapi;
    const isl = cncD.durum === 'isleme';
    const m = easeInOut(cncD.mil);
    tabla.position.set(
      lerp(TABLA_YUK.x, TABLA_IS.x, cncD.tabla) + (isl ? m * 0.17 * Math.sin(cncD.t * 1.3) : 0), 0,
      lerp(TABLA_YUK.z, TABLA_IS.z, cncD.tabla) + (isl ? m * 0.07 * Math.sin(cncD.t * 2.6) : 0));
    kafa.position.y = 1.95 - 0.24 * m;
    takim.rotation.y = cncD.milAci;
    isikMat.emissiveIntensity = isl ? 1.8 : 0.05;
    const cncSev = durum === 'acil' ? 'alarm' : isl || ['kapan', 'ice', 'disa', 'ac'].includes(cncD.durum) ? 'calisiyor' : cncD.durum === 'bitti' ? 'uyari' : 'bekliyor';
    cncKule.set(cncSev, t);
    if (cncEkranZ(dt)) {
      cncEkran.standart('CNC · VMC', [
        ['Durum', CNC_AD[cncD.durum]],
        ['Program', 'O1207 BLOK-YÜZ'],
        ['Kalan', isl ? `${fmt(cncSure - cncD.t, 1)} s` : '—'],
      ], { metin: cncSev === 'calisiyor' ? 'ÇALIŞIYOR' : cncSev === 'uyari' ? 'BLOK HAZIR' : cncSev === 'alarm' ? 'ACİL' : 'HAZIR', seviye: cncSev });
    }

    // buton lambaları
    const yan = (r, c, v) => { butonlar[r][c].emissiveIntensity = v ? 2.2 : 0.05; };
    const blink = Math.sin(t * 8) > 0;
    yan(0, 0, durum !== 'acil');
    yan(0, 1, mod === 'oto');
    yan(0, 2, durum === 'calisiyor');
    yan(0, 3, (durum === 'perde' || durum === 'acil' || durum === 'hava') && blink);
    yan(1, 0, dayama > 0.98); yan(1, 1, dayama < 0.02);
    yan(1, 2, aci < 0.5); yan(1, 3, aci > 89.5);

    const db = durumBilgi();
    kule.set(db.seviye, t);
    trend.ornekle(dt, [aci / 0.9, dayama * 100, (vinc.y / KANCA_UST) * 100]);
    if (ekranZ(dt)) {
      ekran.standart('Blok Döndürme · PLC', [
        ['Blok açısı', `${fmt(aci, 1)}°`],
        ['Dayama', dayama > 0.98 ? 'İLERİ' : dayama < 0.02 ? 'GERİ' : 'HAREKET'],
        ['Vinç', vinc.gorev ? vinc.gorev.ad.split(' ')[0] : 'boşta'],
        ['CNC', CNC_AD[cncD.durum].split(' ·')[0]],
      ], db);
    }
  }

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'perde') return { metin: 'IŞIK PERDESİ KESİLDİ', seviye: 'alarm' };
    if (durum === 'hava') return { metin: 'HAVA BASINCI DÜŞÜK', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (Math.abs(aci - hedefAci) > 0.05 && vincBesikUstunde()) return { metin: 'KANCA BEŞİK ÜSTÜNDE · DÖNÜŞ KİLİTLİ', seviye: 'uyari' };
    if (durum === 'durdu') return { metin: mod === 'manuel' ? 'MANUEL · HAZIR' : 'HAZIR', seviye: 'bekliyor' };
    if (mod === 'manuel') return { metin: vinc.gorev ? `MANUEL · ${vinc.gorev.ad.toLocaleUpperCase('tr')}` : 'MANUEL', seviye: 'calisiyor' };
    return { metin: `OTOMATİK · ${FAZ_AD[fFaz].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
  }

  // Manuel komutlar yalnız manuel modda ve alarmsızken
  const manuel = (fn) => () => {
    if (mod !== 'manuel') { uyar('MANUEL MODA GEÇ'); return; }
    if (!(durum === 'durdu' || durum === 'calisiyor')) return;
    durum = 'calisiyor';
    fn();
  };
  const vincElle = (gorev, kosul, uyari) => manuel(() => {
    if (vinc.gorev && vinc.gorev.ad !== 'Park') { uyar('VİNÇ MEŞGUL'); return; }
    if (!kosul()) { uyar(uyari); return; }
    gorev();
  });
  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik çevrim'], ['manuel', 'Manuel']], get: () => mod,
      set: (v) => { mod = v; if (v === 'manuel') { hedefAci = aci; hedefDayama = dayama; } else otoyaGec(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Start', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Stop', tur: 'dur', tik: () => { if (durum === 'calisiyor') { durum = 'durdu'; } } },
    ] },
    { tip: 'baslik', metin: 'Manuel fikstür (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Dayama ileri', tik: manuel(() => { if (aci < 0.5 || aci > 89.5) hedefDayama = 1; }) },
      { metin: 'Dayama geri', tik: manuel(() => { if (aci < 0.5 || aci > 89.5) hedefDayama = 0; }) },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Blok 90° dön', tik: manuel(() => { if (dayama > 0.98) hedefAci = 90; else uyar('ÖNCE DAYAMA İLERİ'); }) },
      { metin: 'Blok 0° dön', tik: manuel(() => { if (!besikBlok || dayama > 0.98) hedefAci = 0; else uyar('BLOK SIKIŞIK DEĞİL'); }) },
    ] },
    { tip: 'baslik', metin: 'Vinç (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Vinç: ham blok → fikstür', tik: vincElle(gorevStokBesik, KOSUL.stokBesik, 'FİKSTÜR 0° · BOŞ · DAYAMA GERİ OLMALI') },
      { metin: 'Vinç: fikstür → CNC', tik: vincElle(gorevBesikCnc, KOSUL.besikCnc, 'BLOK 90° · DAYAMA GERİ · CNC BOŞ OLMALI') },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Vinç: CNC → çıkış paleti', tik: vincElle(gorevCncCikis, KOSUL.cncCikis, 'CNC İŞİ BİTMEDİ / PALET DOLU') },
      { metin: 'Vinç: park', tik: vincElle(parkGorevi, () => true, '') },
    ] },
    { tip: 'kaydirici', metin: 'CNC işleme süresi', min: 5, max: 40, adim: 1, birim: 's', get: () => cncSure, set: (v) => (cncSure = v) },
    { tip: 'baslik', metin: 'Güvenlik / arıza' },
    { tip: 'anahtar', metin: 'Işık perdesi kesildi (operatör eli)', get: () => perde,
      set: (v) => { perde = v; if (v && durum !== 'acil') durum = 'perde'; } },
    { tip: 'anahtar', metin: 'Arıza: hava basıncı düşük', get: () => havaArizasi, set: (v) => { havaArizasi = v; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if ((durum === 'acil' || durum === 'perde' || durum === 'hava') && !perde && hava > 4.5) durum = 'durdu';
      } },
    ] },
  ];

  const say = (d) => { let n = 0; for (const b of havuz) if (b.durum === d) n++; return n; };

  return {
    id: 'fikstur',
    ad: 'Blok Döndürme Fikstürü',
    altBaslik: 'Motor bloğu · pergel vinç · CNC',
    kisa: 'Motor bloğunu CNC\'ye yerleştirmeden önce 90° deviren pnömatik fikstür. Pergel vinç ham bloğu yukarıdan fikstüre koyar, devrilmiş bloğu CNC\'ye, işlenmiş bloğu çıkış paletine taşır. Arka yan tel çitle, ön ve iki yan ışık perdesiyle korunur.',
    proje: 'other-machines',
    ayakIzi: [8.2, 6.4],
    ayakIziMerkez: [0.4, -1.8],
    kamera: { poz: [-4.6, 6.9, 6.6], hedef: [0.6, 1.7, -1.7] },
    mekanizmalar: [
      'Devirme beşiği: arka menteşe ekseni etrafında 0° ↔ 90°; motor bloğu dik konulur, yan yatmış alınır',
      'Pnömatik dayamalar (2×): bloğu V-çenelere sıkıştırır; 90°\'de gevşer, vinç bloğu alır',
      'Ana pnömatik silindir + yan amortisörler beşikle birlikte açılıp kapanır',
      'Pergel vinç: bom dönüşü, araba (radyal), zincirli palanga ile kanca iniş/çıkış; döner kanca + 2 sapan',
      'CNC (VMC): kayar kapı + çatı şeridi açılır (vinç girişi), tabla yükleme ↔ işleme konumu, iş mili iner ve döner',
      'Paletler: ham blok stoğu biter → yenilenir; çıkış paleti dolar → alınır',
      'Kilitler: kanca beşik üstündeyken beşik dönmez; beşik dönerken vinç beşiğe inmez; CNC kapısı kanca çıkmadan kapanmaz',
      'Vinç operatörü: telsiz kumandayla perdenin dışındaki güvenli şeritte yükü izleyerek yürür; perde kesildiğinde sol eli ön perdeye uzanır',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: iş parçası motor bloğu; vinç yukarıdan bloğu fikstüre koyar → blok devrilir → vinç devrilmiş bloğu alır → fikstür eski haline döner → yeni blok konur. Amaç bloğu CNC\'ye yerleştirirken döndürmek.',
      'img-05 / img-04: L biçimli beyaz beşik, arka menteşe, V-çeneler, ortada pnömatik silindir → beşik + tahrik korundu; buton kutusu (img-03) aynen.',
      'KAAN\'IN DÜZELTMESİ: yalnız bir yan tel çitle kapalı (arka yan alındı), diğer üç yan ışık perdesi. TAHMİN: köşe aynalı tek perde. Vinç yukarıdan girdiği için perde kesilmez.',
      'TAHMİN: vinç tipi kolonlu pergel (jib) vinç + elektrikli zincirli palanga; tavan vinci de olabilir. Blok ölçüsü ~0.65 × 0.42 × 0.40 m (4 silindirli, kabataslak).',
      'TAHMİN: CNC genel bir dikey işleme merkezi (VMC); kayar kapı çatıya uzanır ki vinç tablaya yukarıdan inebilsin. Ham/işlenmiş blok paletleri ve forkliftle yenilenme varsayım. Süreler hızlandırıldı.',
      'TAHMİN: vinci makinenin önündeki operatör telsiz (sarkıt) kumandayla sürer ve yükü yürüyerek izler; perde kesme senaryosundaki el bu operatörün kolu.',
    ],
    group: g,
    // sabitle(): beşik (bloklar + dayamalar), silindir/amortisörler, vinç (bom + araba, kanca,
    // zincir, sapanlar), CNC kapı/kafa/tabla ve taşınan/yeniden ebeveynlenen motor blokları hareketli
    sabitHaric: [besik, anaSil.grup, ...amortisor.map((a) => a.grup), bom, kanca, zincir, ...sapan,
      kapi, kafa, tabla, ...havuz.map((b) => b.grup)],
    update,
    kontroller,
    degerler: () => [
      ['Blok açısı', `${fmt(aci, 1)}°`],
      ['Dayama', dayama > 0.98 ? 'İLERİ (sıkışık)' : dayama < 0.02 ? 'GERİ' : `${fmt(dayama * 100, 0)} %`],
      ['Fikstür adımı', mod === 'oto' ? FAZ_AD[fFaz] : 'Manuel'],
      ['Vinç', `${vinc.metin}${vinc.yuk ? ' · yüklü' : ''}`],
      ['Kanca', `${fmt((vinc.phi * 180) / Math.PI, 0)}° · r ${fmt(vinc.r, 2)} m · h ${fmt(vinc.y, 2)} m`],
      ['CNC', cncD.durum === 'isleme' ? `işleniyor · ${fmt(cncSure - cncD.t, 1)} s` : CNC_AD[cncD.durum]],
      ['İşlenen blok', String(cevrim)],
      ['Son çevrim', sonCevrim ? `${fmt(sonCevrim, 1)} s` : '—'],
      ['Stok / çıkış', `${say('stok')} ham · ${say('cikis')}/${CIKIS_SLOT.length} işlenmiş`],
      ['Işık perdesi', perde ? 'KESİK' : 'TEMİZ'],
      ['Hava basıncı', `${fmt(hava, 2)} bar`],
    ],
    trend,
    durum: durumBilgi,
  };
}
