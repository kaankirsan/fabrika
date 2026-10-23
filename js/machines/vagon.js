// js/machines/vagon.js — Vagon Test Presi (boji yük / süspansiyon testi).
//
// Fotoğraftan (wagon-testing-img-01): kısa bir ray hattının üstünde mavi portal —
// iki kutu ayak (hafifletme pencereli) + üst kiriş. Üstte hidrolik güç ünitesi,
// ortada dikey silindir; krom koç ucunda yük hücresi ve baskı pabucu.
// HMI (Delta, tren-vagon ekranları): Hedef Konum mm, Hedef Ağırlık ton, basınç
// göstergesi, "Koç Aşağı İniyor" mesajı; konsolda 3 pilot lamba (video-02).
//
// Kaan'ın düzeltmesi (2026-10-23): test edilen parça 4 tekerlekli BOJİ. Boji ray
// üstünde portalın altına girer, koç bojinin ORTA TRAVERSİNE (merkez pivot)
// basar; yaylar çöker, çökme ölçülür. Test biten boji öne çıkar, tavan vinci onu
// arkaya taşır ve "sıradaki boji" olarak hatta tekrar girer (2 boji ile döngü).

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, pipe, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, canvasTex,
    clamp, approach, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const portalMavi = mat(0x1f64b8, { r: 0.42, m: 0.3, key: 'vagon-portal' });
  const koyuMavi = mat(0x123d70, { r: 0.6, m: 0.3, key: 'vagon-pencere' });
  const hpuGri = mat(0x6d7c88, { r: 0.5, m: 0.35, key: 'vagon-hpu' });
  const motorMavi = mat(0x3c5f80, { r: 0.45, m: 0.4, key: 'vagon-motor' });
  const beton = mat(0x8c9094, { r: 0.92, m: 0, key: 'vagon-beton' });
  const bojiMat = mat(0x34383c, { r: 0.65, m: 0.35, key: 'vagon-boji' });
  const travMat = mat(0x7a2e22, { r: 0.6, m: 0.25, key: 'vagon-astar' });  // travers (kırmızı astar)
  const yayMat = mat(0x2a6f9e, { r: 0.4, m: 0.6, key: 'vagon-yay' });       // helis yaylar

  // ---------------------------------------------------------------- ray hattı (Z boyunca)
  const RAY_X = 0.7175; // 1435 mm normal hat
  const RAY_Z0 = -5.2, RAY_Z1 = 5.2;
  for (let z = RAY_Z0 + 0.2; z <= RAY_Z1; z += 0.6) box(2.5, 0.07, 0.22, beton, 0, 0.035, z, g);
  for (const sx of [-1, 1]) {
    const L = RAY_Z1 - RAY_Z0, zc = (RAY_Z0 + RAY_Z1) / 2;
    box(0.13, 0.015, L, M.celik, sx * RAY_X, 0.078, zc, g);   // taban
    box(0.03, 0.08, L, M.celik, sx * RAY_X, 0.125, zc, g);    // gövde
    box(0.07, 0.035, L, M.celik, sx * RAY_X, 0.18, zc, g);    // mantar
    for (const z of [RAY_Z0, RAY_Z1]) box(0.2, 0.25, 0.12, M.sari, sx * RAY_X, 0.24, z, g); // tampon stoper
  }

  // ---------------------------------------------------------------- portal
  const AYAK_X = 1.85;
  for (const sx of [-1, 1]) {
    box(0.95, 0.04, 1.1, M.koyu, sx * AYAK_X, 0.02, 0, g);              // taban plakası
    box(0.55, 3.0, 0.75, portalMavi, sx * AYAK_X, 1.5, 0, g);
    for (const y of [0.75, 1.5, 2.25]) box(0.33, 0.48, 0.762, koyuMavi, sx * AYAK_X, y, 0, g); // hafifletme pencereleri
    box(0.04, 2.9, 0.86, portalMavi, sx * (AYAK_X - 0.29), 1.5, 0, g);   // iç yüz takviyesi
  }
  box(4.7, 0.8, 0.95, portalMavi, 0, 3.4, 0, g);                         // üst kiriş
  for (const sx of [-1, 1]) box(0.06, 0.82, 0.97, koyuMavi, sx * 2.32, 3.4, 0, g); // kiriş uç kapakları
  box(4.4, 0.03, 0.08, koyuMavi, 0, 3.0, 0.44, g);                        // alt kenar çıtası

  // ---------------------------------------------------------------- hidrolik güç ünitesi (üstte)
  box(1.35, 0.55, 0.8, hpuGri, 0.95, 4.075, 0, g);                      // tank
  box(1.4, 0.03, 0.85, M.koyu, 0.95, 4.36, 0, g);                       // tank kapağı
  cyl(0.17, 0.5, motorMavi, 0.75, 4.58, 0, g, { eksen: 'x', seg: 20 }); // elektrik motoru
  cyl(0.18, 0.06, M.koyu, 1.03, 4.58, 0, g, { eksen: 'x', seg: 20 });  // fan kapağı
  box(0.14, 0.2, 0.14, M.koyu, 0.42, 4.5, 0, g);                        // pompa / kaplin
  box(0.28, 0.18, 0.22, M.koyu, 0.08, 4.47, 0.12, g);                   // valf bloğu
  for (const x of [0.0, 0.16]) cyl(0.035, 0.09, M.siyah, x, 4.47, 0.27, g, { eksen: 'z', seg: 12 }); // solenoidler
  cyl(0.065, 0.03, M.beyaz, 1.35, 4.15, 0.41, g, { eksen: 'z', seg: 24 });  // manometre
  cyl(0.07, 0.02, M.siyah, 1.35, 4.15, 0.398, g, { eksen: 'z', seg: 24 });
  cyl(0.045, 0.06, M.siyah, 1.45, 4.38, -0.2, g, { seg: 12 });             // doldurma kapağı
  pipe([[0.0, 4.47, 0.24], [0.0, 4.47, 0.56], [0.0, 4.2, 0.56], [0.0, 4.2, 0.2]], 0.022, M.siyah, g);
  pipe([[0.16, 4.47, 0.24], [0.16, 4.47, 0.62], [0.16, 3.9, 0.62], [0.16, 2.85, 0.62], [0.16, 2.85, 0.18]], 0.022, M.siyah, g);

  // ---------------------------------------------------------------- silindir + koç (hareketli)
  cyl(0.17, 1.4, M.koyu, 0, 3.45, 0, g, { seg: 28 });          // gövde (kirişin içinden geçer)
  cyl(0.23, 0.07, M.celik, 0, 4.17, 0, g, { seg: 28 });        // üst kapak flanşı
  cyl(0.23, 0.07, M.celik, 0, 2.77, 0, g, { seg: 28 });        // alt rakor flanşı
  const koc = new THREE.Group();
  g.add(koc);
  cyl(0.1, 1.4, M.krom, 0, 3.3, 0, koc, { seg: 24 });           // krom mil
  cyl(0.13, 0.12, M.celik, 0, 2.54, 0, koc, { seg: 24 });       // yük hücresi
  box(0.05, 0.04, 0.05, M.siyah, 0.14, 2.55, 0, koc);           // yük hücresi konnektörü
  box(0.42, 0.08, 0.42, M.koyu, 0, 2.44, 0, koc);               // baskı pabucu (alt yüz y=2.40)
  box(0.19, 0.03, 0.03, M.alu, -0.24, 2.56, 0, koc);            // cetvel okuyucu kolu
  box(0.06, 0.1, 0.06, M.siyah, -0.34, 2.56, 0.02, koc);        // okuyucu
  const okuyucuLed = lamba(0xff3b30, 1.5);
  box(0.012, 0.012, 0.01, okuyucuLed, -0.34, 2.59, 0.055, koc);
  // lineer cetvel (sabit, kirişin altından sarkar; travers üstünde biter)
  const cetvelTex = canvasTex(32, 512, (x, w, h) => {
    x.fillStyle = '#c9ced3'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#20252a';
    for (let i = 0; i <= 60; i++) { const y = (i / 60) * h; x.fillRect(0, y, i % 5 ? 10 : 20, 2); }
  });
  const cetvel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.3, 0.02),
    [M.alu, M.alu, M.alu, M.alu, new THREE.MeshStandardMaterial({ map: cetvelTex, roughness: 0.5, metalness: 0.4 }), M.alu]);
  cetvel.position.set(-0.34, 2.32, -0.035);
  cetvel.castShadow = true;
  g.add(cetvel);
  box(0.05, 0.06, 0.05, M.koyu, -0.34, 2.97, -0.035, g);

  // ---------------------------------------------------------------- boji (2 adet, döngü)
  // Yükseklikler: aks merkezi 0.61 (tekerlek Ø840), yan çerçeve üstü 1.01,
  // helis yaylar 0.30 m, travers 1.31–1.57, merkez pivot tablası üstü 1.62.
  const AKS_Y = 0.61, TEK_R = 0.42, YAN_UST = 1.01, YAY_H = 0.3, TRAV_H = 0.26;
  const PIVOT_UST = YAN_UST + YAY_H + TRAV_H + 0.05;
  const ARKA_Z = -3.7, MERKEZ_Z = 0, ON_Z = 3.7;

  // Helis yay: birim yükseklikte eğri, mesh.scale.y = anlık yay boyu
  class Helis extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      const a = t * 5.5 * Math.PI * 2;
      return out.set(0.058 * Math.cos(a), t, 0.058 * Math.sin(a));
    }
  }
  const yayGeo = new THREE.TubeGeometry(new Helis(), 110, 0.013, 6, false);

  let bojiSayac = 0;
  function bojiKur() {
    const b = {
      grup: new THREE.Group(), ust: new THREE.Group(), tekerSet: [], yaylar: [],
      x: 0, y: 0, z: 0, konum: 'arka', no: ++bojiSayac,
      K: 0, kusurlu: false, kalici: 0, sonuc: null, Kolc: 0, donme: 0,
      etiket: lamba(0x8b949e, 0.3),
    };
    g.add(b.grup);
    b.grup.add(b.ust);
    // tekerlek takımları (aks + 2 tekerlek); dönüşü görmek için tekerlek yüzünde işaret
    for (const dz of [-0.9, 0.9]) {
      const ts = new THREE.Group();
      ts.position.set(0, AKS_Y, dz);
      b.grup.add(ts);
      cyl(0.07, 1.75, M.celik, 0, 0, 0, ts, { eksen: 'x', seg: 16 });
      for (const sx of [-1, 1]) {
        cyl(TEK_R, 0.12, bojiMat, sx * RAY_X, 0, 0, ts, { eksen: 'x', seg: 28 });
        cyl(TEK_R + 0.03, 0.03, bojiMat, sx * (RAY_X - 0.07), 0, 0, ts, { eksen: 'x', seg: 28 }); // bandaj
        box(0.02, 0.24, 0.07, M.beyaz, sx * (RAY_X + 0.065), 0.16, 0, ts);                    // dönüş işareti
      }
      b.tekerSet.push(ts);
      for (const sx of [-1, 1]) box(0.2, 0.22, 0.26, M.koyu, sx * 0.98, AKS_Y + 0.03, dz, b.grup); // aks kutusu
    }
    // yan çerçeveler + fren
    for (const sx of [-1, 1]) {
      box(0.16, 0.3, 2.75, bojiMat, sx * 0.98, YAN_UST - 0.15, 0, b.grup);
      box(0.24, 0.05, 0.62, M.koyu, sx * 0.98, YAN_UST + 0.005, 0, b.grup);   // yay yatağı (alt)
      for (const dz of [-0.47, 0.47]) box(0.09, 0.22, 0.12, M.koyu, sx * RAY_X, AKS_Y, dz, b.grup); // fren pabucu
    }
    for (const dz of [-0.55, 0.55]) cyl(0.035, 1.5, M.koyu, 0, AKS_Y - 0.04, dz, b.grup, { eksen: 'x', seg: 10 }); // fren kirişi
    // ikincil süspansiyon: her yanda 2×2 helis yay
    for (const sx of [-1, 1]) for (const ox of [-0.07, 0.07]) for (const dz of [-0.14, 0.14]) {
      const y = new THREE.Mesh(yayGeo, yayMat);
      y.position.set(sx * 0.98 + ox, YAN_UST + 0.03, dz);
      y.scale.y = YAY_H;
      y.castShadow = true;
      b.grup.add(y);
      b.yaylar.push(y);
    }
    // travers (üst grup, yük altında aşağı iner): yastık kirişi + merkez pivot + yan dayanaklar
    box(2.3, TRAV_H, 0.5, travMat, 0, YAN_UST + YAY_H + TRAV_H / 2, 0, b.ust);
    for (const sx of [-1, 1]) box(0.24, 0.05, 0.62, M.koyu, sx * 0.98, YAN_UST + YAY_H + 0.0, 0, b.ust); // yay yatağı (üst)
    cyl(0.2, 0.05, M.celik, 0, PIVOT_UST - 0.025, 0, b.ust, { seg: 28 });   // merkez pivot tablası
    cyl(0.045, 0.08, M.krom, 0, PIVOT_UST + 0.0, 0, b.ust, { seg: 14 });    // merkez pimi
    for (const sx of [-1, 1]) box(0.16, 0.06, 0.2, M.koyu, sx * 0.72, YAN_UST + YAY_H + TRAV_H + 0.03, 0, b.ust); // yan dayanak
    box(0.16, 0.08, 0.02, b.etiket, 0.6, YAN_UST + YAY_H + TRAV_H / 2, 0.26, b.ust); // sonuç etiketi
    // çeki bağlantıları (vinç halkaları)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.12, 0.08, M.sari, sx * 0.98, YAN_UST + 0.05, sz * 1.3, b.grup);
    yeniKimlik(b, false);
    return b;
  }
  function yeniKimlik(b, numaraAl = true) {
    if (numaraAl) b.no = ++bojiSayac;
    b.kusurlu = siradakiKusurlu; siradakiKusurlu = false;
    b.K = K0 * (b.kusurlu ? 0.72 : 1 + gurultu(0.05));
    b.kalici = 0; b.sonuc = null; b.Kolc = 0;
    b.etiket.color.setHex(0x8b949e); b.etiket.emissive.setHex(0x8b949e); b.etiket.emissiveIntensity = 0.2;
  }
  function bojiCiz(b, cokmeVis) {
    b.grup.position.set(b.x, b.y, b.z);
    b.ust.position.y = -cokmeVis;
    // yay alt yatak üstü (1.04) ile travers altı yatağı (1.285 − çökme) arası
    const s = Math.max(0.03, YAY_H - 0.055 - cokmeVis);
    for (const y of b.yaylar) y.scale.y = s;
    for (const ts of b.tekerSet) ts.rotation.x = b.donme;
  }

  // konum stoperleri (boji merkezdeyken kalkar)
  const stoperler = [];
  for (const sx of [-1, 1]) for (const z of [-0.9 - 0.47, 0.9 + 0.47]) stoperler.push(box(0.1, 0.12, 0.16, M.sari, sx * RAY_X, 0.14, z, g));

  // çökme ölçer (komparatör): sol ayağın iç yüzünden konsol, palpör travers üstüne değer
  box(0.48, 0.04, 0.04, M.celik, -1.32, 1.86, 0.15, g);
  cyl(0.045, 0.025, M.beyaz, -1.08, 1.86, 0.18, g, { eksen: 'z', seg: 20 });
  const palpor = cyl(0.006, 0.3, M.krom, -1.08, 1.72, 0.15, g, { seg: 8 });

  // vinç (çeki halatı) — ray sonunda, bojiyi içeri/dışarı çeker
  const VINC_Z = RAY_Z1 + 0.45;
  box(0.6, 0.3, 0.45, M.koyu, 0, 0.15, VINC_Z, g);
  const tambur = new THREE.Group();
  tambur.position.set(0, 0.42, VINC_Z);
  g.add(tambur);
  cyl(0.14, 0.38, M.sari, 0, 0, 0, tambur, { eksen: 'x', seg: 18 });
  box(0.4, 0.03, 0.03, M.siyah, 0, 0.14, 0, tambur);
  const halat = cyl(0.009, 1, M.siyah, 0, 0, 0, g, { seg: 6 });
  halat.visible = false;

  // tavan vinci kancası (test biten bojiyi öndən arkaya taşır)
  const kanca = new THREE.Group();
  g.add(kanca);
  box(0.32, 0.36, 0.22, M.sari, 0, 0.18, 0, kanca);
  cyl(0.012, 4.5, M.celik, 0, 2.6, 0, kanca, { seg: 6 });
  // sapanlar: kancadan yan çerçevelerdeki dört vinç halkasına
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod([0, 0, 0], [sx * 0.98, YAN_UST + 0.11 - (PIVOT_UST + 0.55), sz * 1.3], 0.008, M.siyah, kanca, 5);
  kanca.visible = false;

  // ---------------------------------------------------------------- operatör konsolu
  const kons = new THREE.Group();
  kons.position.set(3.1, 0, 2.0);
  kons.rotation.y = 0.35;
  g.add(kons);
  for (const sx of [-1, 1]) box(0.06, 0.62, 0.06, M.koyu, sx * 0.25, 0.31, 0, kons);
  box(0.62, 0.95, 0.3, M.pano, 0, 1.075, 0, kons);
  box(0.36, 0.25, 0.02, M.koyu, 0, 1.33, 0.155, kons);
  const ekran = new Ekran(0.32, 0.2, 512);
  ekran.mesh.position.set(0, 1.33, 0.167);
  kons.add(ekran.mesh);
  const pilot = [lamba(0xe5302a, 0.05), lamba(0x2ea043, 0.05), lamba(0xe5302a, 0.05)];
  pilot.forEach((m, i) => {
    cyl(0.03, 0.02, M.koyu, (i - 1) * 0.11, 1.07, 0.155, kons, { eksen: 'z', seg: 16 });
    cyl(0.024, 0.02, m, (i - 1) * 0.11, 1.07, 0.172, kons, { eksen: 'z', seg: 16 });
  });
  for (const x of [-0.11, 0.11]) {
    cyl(0.025, 0.02, M.siyah, x, 0.88, 0.16, kons, { eksen: 'z', seg: 12 });
    box(0.008, 0.035, 0.012, M.beyaz, x, 0.88, 0.175, kons);  // selektör şalter kolu
  }
  acilStop(kons, 0.2, 1.6, 0.05, 0).rotation.x = -Math.PI / 2;
  const kule = kuleLambasi(kons, -0.2, 1.55, 0);

  // ---------------------------------------------------------------- operatör (lib.operator)
  // Konsolda testi yönetir; boji içeri/dışarı alınırken ya da vinç taşırken güvenli
  // çizgide bekler; test bitince bojideki sonuç etiketini kontrol edip konsola döner.
  const op = lib.operator({ baret: 0xffffff });
  g.add(op.group);
  const KONS_YON = 0.35;
  const OP_KONS = [3.1 + Math.sin(KONS_YON) * 0.72, 2.0 + Math.cos(KONS_YON) * 0.72];
  const OP_GUVENLI = [3.45, 3.75];
  const OP_ETIKET = [1.38, 1.62];
  const O = { x: OP_KONS[0], z: OP_KONS[1], yon: KONS_YON + Math.PI, hedefYon: KONS_YON + Math.PI, gorev: 'konsol', yol: [], t: 0, testNo: -1 };
  const opGit = (gorev, yol) => { O.gorev = gorev; O.yol = yol; O.t = 0; };

  // ---------------------------------------------------------------- test mantığı
  // Koç stroku mm (0 = üst). Pabuç alt yüzü 2.40 m → pivot üstüne KONTAKT mm'de değer.
  // Temas sonrası kuvvet = K (ton/mm, yay grubu rijitliği) × çökme. Görselde çökme ABART kat.
  const KONTAKT = Math.round((2.4 - PIVOT_UST) * 1000);
  const K0 = 0.75, FMAX = 65, ABART = 2, ELASTIK = 55, KOC_MAX = KONTAKT + 120;
  const A_PISTON = Math.PI * 0.1 * 0.1; // Ø200 mm piston
  const SENARYOLAR = { statik: 'Statik yük', kademeli: 'Kademeli (4 adım)', yorulma: 'Yorulma (6 çevrim)' };
  let siradakiKusurlu = false;
  const bojiler = [bojiKur(), bojiKur()];
  bojiler[0].konum = 'merkez'; bojiler[0].z = MERKEZ_Z;
  bojiler[1].konum = 'arka'; bojiler[1].z = ARKA_Z;

  let durum = 'bekliyor';  // bos|giris|bekliyor|inis|yaklasma|yukleme|bekleme|yorulma|bosaltma|yukari|degerlendir|cikis|manuel|acil
  let acilOnce = null;
  let senaryo = 'statik';
  let hedefF = 40, hedefKonum = KONTAKT + 90, oto = true;
  let F = 0, kocMm = 0, testNo = 0, adim = 0, sayac = 0, bosT = 1.0, yorT = 0, Fmaks = 0, testAktif = false;
  let jog = 0, mesaj = '', mesajT = 0, emniyet = 0;
  let vinc = null;          // {b, yol:[V3...], i}
  let stoperY = 1;

  const merkez = () => bojiler.find((b) => b.konum === 'merkez') || null;
  const nerede = (k) => bojiler.find((b) => b.konum === k) || null;
  const asamaHedefi = () => (senaryo === 'kademeli' ? (hedefF * (adim + 1)) / 4 : senaryo === 'yorulma' ? hedefF * 0.2 : hedefF);
  const kisaMesaj = (m) => { mesaj = m; mesajT = 3; };
  const cokmeMm = () => (merkez() ? Math.max(0, kocMm - KONTAKT) : 0);

  function baslat() {
    if (!['bekliyor', 'manuel'].includes(durum)) return;
    if (!merkez()) { kisaMesaj('Test için boji yok'); return; }
    testNo++; adim = 0; yorT = 0; sayac = 0; Fmaks = 0; testAktif = true;
    const b = merkez();
    b.sonuc = null; b.Kolc = 0;
    durum = kocMm >= KONTAKT ? 'yukleme' : 'inis';
  }

  function degerlendir(b) {
    // kalıcı çökme: elastik sınır aşılırsa artar; kusurlu yay belirgin iz bırakır
    const olcK = b.Kolc || b.K;
    const sapma = Math.abs(olcK / K0 - 1);
    b.sonuc = b.kalici <= 0.5 && sapma <= 0.12 ? 'GEÇTİ' : 'KALDI';
    const r = b.sonuc === 'GEÇTİ' ? 0x2ea043 : 0xe5302a;
    b.etiket.color.setHex(r); b.etiket.emissive.setHex(r); b.etiket.emissiveIntensity = 1.6;
    kisaMesaj(`Sonuç: ${b.sonuc} · kalıcı ${fmt(b.kalici, 2)} mm`);
  }

  // Raylarda yuvarlanma: konum + tekerlek dönüşü (ω = v / r)
  function yuvarla(b, hedefZ, dt) {
    const once = b.z;
    b.z = approach(b.z, hedefZ, 0.55 * dt);
    b.donme += (b.z - once) / TEK_R;
    return b.z === hedefZ;
  }

  function vincBaslat(b) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    b.konum = 'vinc';
    vinc = { b, i: 0, yol: [V(0, 0, b.z), V(0, 1.3, b.z), V(-4.4, 1.3, b.z), V(-4.4, 1.3, ARKA_Z), V(0, 1.3, ARKA_Z), V(0, 0, ARKA_Z)] };
  }
  const _v = new THREE.Vector3();
  function vincGuncelle(dt) {
    if (!vinc) {
      const on = nerede('on');
      if (on && !nerede('arka')) vincBaslat(on);
      return;
    }
    const { b, yol } = vinc;
    const hedef = yol[vinc.i + 1];
    _v.set(b.x, b.y, b.z);
    const d = _v.distanceTo(hedef), adim = 1.4 * dt;
    if (d <= adim) {
      b.x = hedef.x; b.y = hedef.y; b.z = hedef.z;
      vinc.i++;
      if (vinc.i >= yol.length - 1) { b.konum = 'arka'; yeniKimlik(b); vinc = null; }
    } else {
      _v.subVectors(hedef, _v).multiplyScalar(adim / d);
      b.x += _v.x; b.y += _v.y; b.z += _v.z;
    }
  }

  // operatör görevleri: konsol | etiketeGit | kontrol | konsolaDon | guvenliyeGit | guvenli
  const yonu = (hx, hz) => Math.atan2(hx - O.x, hz - O.z);
  function opGuncelle(dt, t) {
    const tehlike = durum === 'giris' || durum === 'cikis' || !!vinc;
    const bm = merkez();
    if (durum === 'acil' && O.gorev !== 'konsol' && O.gorev !== 'konsolaDon') {
      opGit('konsolaDon', O.x < 2.4 ? [[2.6, 2.6], OP_KONS.slice()] : [OP_KONS.slice()]);
    } else if (durum !== 'acil' && tehlike && O.gorev !== 'guvenli' && O.gorev !== 'guvenliyeGit') {
      opGit('guvenliyeGit', O.x < 2.4 ? [[2.6, 2.9], OP_GUVENLI.slice()] : [OP_GUVENLI.slice()]);
    } else if (!tehlike && O.gorev === 'guvenli') {
      opGit('konsolaDon', [OP_KONS.slice()]);
    } else if (O.gorev === 'konsol' && O.testNo !== testNo && bm && testAktif === false && durum === 'degerlendir'
      || O.gorev === 'konsol' && O.testNo !== testNo && durum === 'yukari' && testAktif && kocMm < 500) {
      O.testNo = testNo;                                           // test bitti: sonucu bojide kontrol et
      opGit('etiketeGit', [[2.6, 2.6], OP_ETIKET.slice()]);
    }
    let yuruyor = false;
    if (O.yol.length) {
      const [hx, hz] = O.yol[0];
      const dx = hx - O.x, dz = hz - O.z, d = Math.hypot(dx, dz), a = 1.25 * dt;
      if (d <= a) { O.x = hx; O.z = hz; O.yol.shift(); }
      else { O.x += (dx / d) * a; O.z += (dz / d) * a; O.hedefYon = Math.atan2(dx, dz); yuruyor = true; }
    } else {
      O.t += dt;
      if (O.gorev === 'etiketeGit') { O.gorev = 'kontrol'; O.t = 0; }
      else if (O.gorev === 'konsolaDon') O.gorev = 'konsol';
      else if (O.gorev === 'guvenliyeGit') O.gorev = 'guvenli';
      if (O.gorev === 'kontrol') {
        O.hedefYon = yonu(0.6, 0.26);                              // travers üstündeki sonuç etiketi
        if (!bm?.sonuc) O.t = 0;                                   // sonuç yanana kadar bekle
        else if (O.t > 1.6) opGit('konsolaDon', [[2.6, 2.6], OP_KONS.slice()]);
      } else if (O.gorev === 'konsol') O.hedefYon = KONS_YON + Math.PI;
      else if (O.gorev === 'guvenli') O.hedefYon = yonu(0, 1.5);   // hattı izler
    }
    const testte = ['inis', 'yaklasma', 'yukleme', 'bekleme', 'yorulma', 'bosaltma', 'yukari', 'manuel', 'acil'].includes(durum);
    op.poz(O.yol.length ? 'yan' : O.gorev === 'konsol' && testte ? 'on' : O.gorev === 'kontrol' && bm?.sonuc ? 'sag' : 'yan');
    let f = O.hedefYon - O.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    O.yon += f * (1 - Math.exp(-10 * dt));
    const zip = op.yuru(t, yuruyor);
    op.group.position.set(O.x, zip, O.z);
    op.group.rotation.y = O.yon;
  }

  function update(dt, t) {
    const b = merkez();
    switch (durum) {
      case 'bos': {
        const arka = nerede('arka');
        if (oto && arka && !nerede('giris')) { arka.konum = 'giris'; durum = 'giris'; }
        break;
      }
      case 'giris': {
        const gb = nerede('giris');
        if (!gb) { durum = 'bos'; break; }
        if (yuvarla(gb, MERKEZ_Z, dt)) { gb.konum = 'merkez'; durum = 'bekliyor'; bosT = 0; kisaMesaj(`Boji #${gb.no} konumda`); }
        break;
      }
      case 'bekliyor':
        if (!oto) break;
        if (!b) { durum = 'bos'; break; }
        if (b.sonuc) { if (!nerede('on') && kocMm <= 0) durum = 'cikis'; break; } // test bitti → öne çık
        bosT += dt;
        if (bosT > 2.0 && stoperY > 0.98) { bosT = 0; baslat(); }
        break;
      case 'inis':
        kocMm = Math.min(KONTAKT - 25, kocMm + 140 * dt);
        if (kocMm >= KONTAKT - 25) durum = 'yaklasma';
        break;
      case 'yaklasma':
        kocMm = Math.min(KONTAKT, kocMm + 25 * dt);
        if (kocMm >= KONTAKT) durum = 'yukleme';
        break;
      case 'yukleme': {
        const hf = asamaHedefi();
        F = approach(F, hf, 7 * dt);
        kocMm = KONTAKT + b.kalici + F / b.K;
        Fmaks = Math.max(Fmaks, F);
        if (kocMm >= hedefKonum) { kocMm = hedefKonum; F = (kocMm - KONTAKT - b.kalici) * b.K; kisaMesaj('Hedef konuma ulaşıldı'); durum = 'bekleme'; sayac = 0; }
        else if (F >= hf) { durum = senaryo === 'yorulma' ? 'yorulma' : 'bekleme'; sayac = 0; }
        break;
      }
      case 'bekleme':
        sayac += dt;
        if (F > 1) b.Kolc = F / Math.max(0.01, kocMm - KONTAKT - b.kalici) * (1 + gurultu(0.01));
        if (sayac >= (senaryo === 'kademeli' ? 2 : 4)) {
          if (senaryo === 'kademeli' && adim < 3 && kocMm < hedefKonum) { adim++; durum = 'yukleme'; }
          else bosaltmaBasla();
        }
        break;
      case 'yorulma': {
        yorT += dt;
        F = Math.min(hedefF * (0.6 - 0.4 * Math.cos((2 * Math.PI * yorT) / 2.5)), (hedefKonum - KONTAKT) * b.K);
        kocMm = KONTAKT + b.kalici + F / b.K;
        Fmaks = Math.max(Fmaks, F);
        if (F > 1) b.Kolc = F / Math.max(0.01, kocMm - KONTAKT - b.kalici);
        if (yorT >= 2.5 * 6) bosaltmaBasla();
        break;
      }
      case 'bosaltma':
        F = approach(F, 0, 12 * dt);
        kocMm = KONTAKT + (b ? b.kalici + F / b.K : 0);
        if (F <= 0) { durum = 'yukari'; }
        break;
      case 'yukari':
        kocMm = approach(kocMm, 0, 160 * dt);
        if (kocMm <= 0) {
          if (testAktif && b) { durum = 'degerlendir'; sayac = 0; degerlendir(b); }
          else { durum = b ? 'bekliyor' : 'bos'; bosT = 0; }
          testAktif = false;
        }
        break;
      case 'degerlendir':
        sayac += dt;
        if (sayac >= 2.0) { durum = 'bekliyor'; bosT = 0; }
        break;
      case 'cikis': {
        if (!b) { durum = 'bos'; break; }
        stoperY = Math.max(0, stoperY - dt * 3);
        if (stoperY > 0) break;
        if (yuvarla(b, ON_Z, dt)) { b.konum = 'on'; durum = 'bos'; }
        break;
      }
      case 'manuel':
        if (jog) {
          kocMm = clamp(kocMm + jog * 60 * dt, 0, KOC_MAX);
          if (b && kocMm > KONTAKT && (kocMm - KONTAKT - b.kalici) * b.K >= FMAX - 1) { emniyet = 2; kocMm = KONTAKT + b.kalici + (FMAX - 1) / b.K; }
        }
        F = b ? Math.max(0, kocMm - KONTAKT - b.kalici) * b.K : 0;
        if (b && F > 1) b.Kolc = b.K;
        break;
      default: break; // acil: valfler kapalı, koç / vinç yerinde kalır
    }
    if (durum !== 'acil') vincGuncelle(dt);
    mesajT = Math.max(0, mesajT - dt);
    emniyet = Math.max(0, emniyet - dt);

    // ---- görsel
    const bm = merkez();
    const cokVis = bm ? (Math.max(0, kocMm - KONTAKT) / 1000) * ABART : 0;
    const strokVis = Math.min(kocMm, KONTAKT) / 1000 + cokVis + (bm ? 0 : Math.max(0, kocMm - KONTAKT) / 1000);
    koc.position.y = -strokVis;
    for (const x of bojiler) bojiCiz(x, x === bm ? cokVis : (x.kalici / 1000) * ABART);
    palpor.position.y = 1.72 - (bm ? cokVis : 0.1);
    const stoperHedef = bm && durum !== 'cikis' ? 1 : 0;
    if (durum !== 'cikis') stoperY = approach(stoperY, stoperHedef, dt * 3);
    stoperler.forEach((s) => (s.position.y = 0.06 + 0.1 * stoperY));
    // vinç halatı: çekilen boji ile ray sonundaki tambur arasında
    const cekilen = durum === 'giris' ? nerede('giris') : durum === 'cikis' && stoperY <= 0 ? bm : null;
    halat.visible = !!cekilen;
    if (cekilen) {
      const z0 = cekilen.z + 1.42, z1 = VINC_Z - 0.15, L = Math.max(0.05, z1 - z0);
      halat.position.set(0, 0.42, (z0 + z1) / 2);
      halat.rotation.set(Math.PI / 2, 0, 0);
      halat.scale.set(1, L, 1);
      tambur.rotation.x += dt * 4;
    }
    kanca.visible = !!vinc;
    if (vinc) kanca.position.set(vinc.b.x, vinc.b.y + PIVOT_UST + 0.55, vinc.b.z);
    opGuncelle(dt, t);

    const hareket = ['inis', 'yaklasma', 'yukleme', 'yorulma', 'bosaltma', 'yukari', 'giris', 'cikis'].includes(durum) || (durum === 'manuel' && jog !== 0);
    const d = durumBilgi();
    kule.set(d.seviye, t);
    pilot[0].emissiveIntensity = durum === 'acil' || emniyet > 0 ? (Math.sin(t * 9) > 0 ? 2.4 : 0.1) : 0.05;
    pilot[1].emissiveIntensity = hareket ? 2.2 : 0.05;
    pilot[2].emissiveIntensity = F > 0.5 ? 2.2 : 0.05;
    okuyucuLed.emissiveIntensity = 1 + Math.sin(t * 6) * 0.5;

    trend.ornekle(dt, [F, cokmeMm()]);
    if (ekranZ(dt)) ekran.ciz((x, W, H) => hmiCiz(x, W, H, d));
  }

  function bosaltmaBasla() {
    const b = merkez();
    // elastik sınırın üstü kalıcı iz bırakır; kusurlu yay belirgin oturma yapar
    if (b) b.kalici = Math.abs(gurultu(0.12)) + Math.max(0, Fmaks - ELASTIK) * 0.08 + (b.kusurlu ? 1.1 : 0);
    durum = 'bosaltma';
  }

  const basinc1 = () => (F * 1000 * 9.81) / A_PISTON / 1e5;
  const pompa2 = () => (['inis', 'yukari'].includes(durum) || (durum === 'manuel' && jog) ? 40 : 3);
  function mesajMetni() {
    if (mesajT > 0) return mesaj;
    const b = merkez();
    return {
      bos: oto ? 'Sıradaki boji bekleniyor' : 'Hatta boji yok', giris: 'Boji içeri alınıyor',
      bekliyor: b ? (b.sonuc && oto ? `Boji #${b.no} · ön park boşalması bekleniyor` : oto ? `Boji #${b.no} · test bekleniyor` : 'Hazır') : 'Boji yok',
      inis: 'Koç Aşağı İniyor', yaklasma: 'Merkez pivota yaklaşılıyor',
      yukleme: senaryo === 'kademeli' ? `Yük uygulanıyor · adım ${adim + 1}/4` : 'Yük uygulanıyor', bekleme: 'Yük tutuluyor · çökme ölçülüyor',
      yorulma: `Yorulma çevrimi ${Math.min(6, Math.floor(yorT / 2.5) + 1)}/6`, bosaltma: 'Basınç boşaltılıyor',
      yukari: 'Koç Yukarı Çıkıyor', degerlendir: b?.sonuc ? `Sonuç: ${b.sonuc}` : 'Değerlendiriliyor', cikis: 'Boji dışarı çıkıyor',
      manuel: emniyet > 0 ? 'Emniyet valfi açtı!' : 'Manuel mod', acil: 'ACİL STOP',
    }[durum];
  }
  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (emniyet > 0) return { metin: 'EMNİYET VALFİ', seviye: 'uyari' };
    if (durum === 'manuel') return { metin: 'MANUEL', seviye: 'uyari' };
    if (durum === 'bos') return { metin: oto ? 'BOJİ BEKLENİYOR' : 'HATTA BOJİ YOK', seviye: 'bekliyor' };
    if (durum === 'giris') return { metin: 'BOJİ İÇERİ ALINIYOR', seviye: 'calisiyor' };
    if (durum === 'cikis') return { metin: 'BOJİ DIŞARI ÇIKIYOR', seviye: 'calisiyor' };
    if (durum === 'degerlendir') {
      const b = merkez();
      return { metin: `SONUÇ: ${b?.sonuc ?? '…'}`, seviye: b?.sonuc === 'KALDI' ? 'uyari' : 'calisiyor' };
    }
    if (durum === 'bekliyor') {
      if (oto && merkez()?.sonuc) return { metin: 'ÇIKIŞ · VİNÇ BEKLENİYOR', seviye: 'bekliyor' };
      return { metin: oto ? 'TEST BEKLİYOR' : 'HAZIR', seviye: 'bekliyor' };
    }
    return { metin: `TEST #${testNo} · ${SENARYOLAR[senaryo].split(' ')[0].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
  }

  // Delta HMI görünümü: solda hedef/anlık kutuları, sağda basınç ibresi, altta mesaj
  function hmiCiz(x, W, H, d) {
    x.fillStyle = '#eef1f4'; x.fillRect(0, 0, W, H);
    const hb = H * 0.15;
    x.fillStyle = '#1b2a3a'; x.fillRect(0, 0, W, hb);
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.font = `700 ${hb * 0.5}px "Space Grotesk", sans-serif`;
    x.fillText(`BOJİ TESTİ · ${oto ? 'OTOMATİK' : 'MANUEL'}`, W * 0.04, hb / 2);
    x.textAlign = 'right'; x.font = `500 ${hb * 0.42}px "JetBrains Mono", monospace`;
    const b = merkez();
    x.fillText(b ? `Boji #${b.no}` : 'Boji —', W * 0.96, hb / 2);
    const satir = [['Hedef Konum', `${hedefKonum} mm`], ['Hedef Ağırlık', `${hedefF} Ton`], ['Anlık Kuvvet', `${fmt(F, 1)} Ton`], ['Yay Çökmesi', `${fmt(cokmeMm(), 1)} mm`]];
    const ust = hb + H * 0.04, rh = (H * 0.64) / satir.length;
    satir.forEach(([k, v], i) => {
      const y = ust + rh * (i + 0.5);
      x.fillStyle = '#33414e'; x.textAlign = 'left'; x.font = `500 ${rh * 0.34}px "Space Grotesk", sans-serif`;
      x.fillText(k, W * 0.04, y);
      const bx = W * 0.3, bw = W * 0.23, bh = rh * 0.72;
      x.fillStyle = '#fff'; x.fillRect(bx, y - bh / 2, bw, bh);
      x.strokeStyle = '#5a6b7b'; x.lineWidth = 2; x.strokeRect(bx, y - bh / 2, bw, bh);
      x.fillStyle = '#0b2540'; x.textAlign = 'center'; x.font = `700 ${rh * 0.36}px "JetBrains Mono", monospace`;
      x.fillText(v, bx + bw / 2, y);
    });
    // basınç ibresi (0-250 bar, 270° tarama)
    const p = basinc1();
    const cx = W * 0.78, cy = hb + H * 0.4, r = Math.min(W * 0.17, H * 0.27);
    const a0 = Math.PI * 0.75, tara = Math.PI * 1.5, aci = (v) => a0 + tara * clamp(v / 250, 0, 1);
    x.lineWidth = r * 0.16;
    [[0, 160, '#2ea043'], [160, 210, '#d29922'], [210, 250, '#e5302a']].forEach(([a, bb, c]) => {
      x.strokeStyle = c; x.beginPath(); x.arc(cx, cy, r, aci(a), aci(bb)); x.stroke();
    });
    x.strokeStyle = '#33414e'; x.lineWidth = 2;
    for (let v = 0; v <= 250; v += 25) {
      const a = aci(v);
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
      x.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); x.stroke();
    }
    x.strokeStyle = '#c0392b'; x.lineWidth = 4;
    const an = aci(p);
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * r * 0.82, cy + Math.sin(an) * r * 0.82); x.stroke();
    x.fillStyle = '#1b2a3a'; x.beginPath(); x.arc(cx, cy, r * 0.09, 0, Math.PI * 2); x.fill();
    x.textAlign = 'center'; x.fillStyle = '#0b2540';
    x.font = `700 ${r * 0.27}px "JetBrains Mono", monospace`; x.fillText(`${fmt(p, 0)} bar`, cx, cy + r * 0.8);
    x.font = `600 ${r * 0.22}px "Space Grotesk", sans-serif`; x.fillStyle = '#33414e'; x.fillText('BASINÇ', cx, cy - r * 0.35);
    // mesaj çubuğu
    const ab = H * 0.15;
    const kaldi = durum === 'degerlendir' && merkez()?.sonuc === 'KALDI';
    x.fillStyle = d.seviye === 'alarm' || kaldi ? '#e5302a' : d.seviye === 'uyari' ? '#d29922'
      : durum === 'degerlendir' ? '#2ea043' : ['bekliyor', 'bos'].includes(durum) ? '#6e7681' : '#e8a317';
    x.fillRect(0, H - ab, W, ab);
    x.fillStyle = '#111'; x.font = `700 ${ab * 0.48}px "Space Grotesk", sans-serif`;
    x.fillText(mesajMetni(), W / 2, H - ab / 2);
  }

  const trend = new Trend([{ ad: 'Kuvvet (ton)', renk: '#f2c200' }, { ad: 'Yay çökmesi (mm)', renk: '#39c5cf' }], { min: 0, max: 90, uzunluk: 300 });
  const ekranZ = throttle(6);

  function manuelJog(y) {
    if (!['bekliyor', 'manuel', 'bos'].includes(durum)) { kisaMesaj('Test sürerken manuel yok'); return; }
    oto = false; durum = 'manuel'; jog = y;
  }
  function bojiIceri() {
    if (!['bos', 'bekliyor', 'manuel'].includes(durum) || kocMm > 0.5) { kisaMesaj('Önce koç yukarıda olmalı'); return; }
    if (merkez()) { kisaMesaj('Test konumunda zaten boji var'); return; }
    const arka = nerede('arka');
    if (!arka) { kisaMesaj('Bekleyen boji yok (vinç taşıyor)'); return; }
    oto = false; arka.konum = 'giris'; durum = 'giris';
  }
  function bojiDisari() {
    if (!['bekliyor', 'manuel'].includes(durum) || kocMm > 0.5) { kisaMesaj('Önce koç yukarıda olmalı'); return; }
    if (!merkez()) { kisaMesaj('Test konumunda boji yok'); return; }
    if (nerede('on')) { kisaMesaj('Ön park dolu · vinç bekleniyor'); return; }
    oto = false; durum = 'cikis';
  }

  const kontroller = [
    { tip: 'secim', metin: 'Test senaryosu', secenekler: Object.entries(SENARYOLAR), get: () => senaryo, set: (v) => (senaryo = v) },
    { tip: 'kaydirici', metin: 'Hedef ağırlık', min: 5, max: 60, adim: 1, birim: 'ton', get: () => hedefF, set: (v) => (hedefF = v) },
    { tip: 'kaydirici', metin: 'Hedef konum (koç stroku)', min: KONTAKT + 10, max: KOC_MAX, adim: 5, birim: 'mm', get: () => hedefKonum, set: (v) => (hedefKonum = v) },
    { tip: 'anahtar', metin: 'Otomatik döngü (boji gir → test → çık)', get: () => oto,
      set: (v) => {
        oto = v; bosT = 0;
        if (v && durum === 'manuel') { jog = 0; durum = F > 0 ? 'bosaltma' : kocMm > 0 ? 'yukari' : merkez() ? 'bekliyor' : 'bos'; }
      } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Test Başlat', tur: 'basla', tik: () => { baslat(); } },
      { metin: 'Durdur', tur: 'dur', tik: () => {
        oto = false; testAktif = false;
        if (['inis', 'yaklasma', 'yukleme', 'bekleme', 'yorulma'].includes(durum)) durum = F > 0 ? 'bosaltma' : 'yukari';
      } },
    ] },
    { tip: 'baslik', metin: 'Boji (ray üstünde, vinçle çekilir)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Boji içeri ▶', tik: bojiIceri },
      { metin: 'Boji dışarı ▶', tik: bojiDisari },
    ] },
    { tip: 'anahtar', metin: 'Sıradaki bojide kusurlu yay (arıza)', get: () => siradakiKusurlu || !!nerede('arka')?.kusurlu,
      set: (v) => { const a = nerede('arka'); if (a) { a.kusurlu = v; a.K = K0 * (v ? 0.72 : 1 + gurultu(0.05)); } else siradakiKusurlu = v; } },
    { tip: 'baslik', metin: 'Manuel koç (basılı tut)' },
    { tip: 'basili', ogeler: [
      { metin: 'Koç Yukarı ▲', bas: () => manuelJog(-1), birak: () => (jog = 0) },
      { metin: 'Koç Aşağı ▼', bas: () => manuelJog(1), birak: () => (jog = 0) },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { if (durum !== 'acil') acilOnce = durum; durum = 'acil'; jog = 0; oto = false; } },
      { metin: 'Reset', tik: () => {
        if (durum !== 'acil') return;
        if (F > 0) durum = 'bosaltma';
        else if (kocMm > 0) durum = 'yukari';
        else if (['giris', 'cikis'].includes(acilOnce)) durum = acilOnce;
        else durum = merkez() ? 'bekliyor' : 'bos';
      } },
    ] },
  ];

  const bojiDurum = () => {
    const b = merkez();
    if (!b) { const gb = nerede('giris'); return gb ? `#${gb.no} · içeri giriyor` : 'yok'; }
    return `#${b.no}${b.kusurlu ? ' (kusurlu yay)' : ''} · ${durum === 'cikis' ? 'çıkıyor' : 'test konumunda'}`;
  };

  // performans: hareketli rijit grupların kendi içindeki sabit parçaları da birleştir (grupla hareket eder)
  if (lib.sabitle && new URLSearchParams(location.search).get('sabit') !== '0') {
    lib.sabitle(koc, []); lib.sabitle(tambur, []); lib.sabitle(kanca, []);
    for (const b of bojiler) {
      lib.sabitle(b.grup, [b.ust, ...b.tekerSet, ...b.yaylar]);   // yan çerçeveler, akslar arası, halkalar
      lib.sabitle(b.ust, []);                                      // travers (etiket malzemesi paylaşılır)
      b.tekerSet.forEach((ts) => lib.sabitle(ts, []));             // dingil + tekerlekler
    }
  }

  return {
    id: 'vagon',
    ad: 'Vagon Test Presi',
    altBaslik: 'Boji yük testi · yük hücresi · 50+ senaryo',
    kisa: 'Tren vagonu bojisi için hidrolik portal test presi: boji ray üstünde portalın altına girer, koç orta traversteki merkez pivota basar, yaylar çöker; yük hücresi ve cetvelle kuvvet–çökme ölçülür, otomatik test senaryoları ve sonuç değerlendirmesi.',
    proje: 'wagon-testing',
    ayakIzi: [9.8, 11.8],
    ayakIziMerkez: [-1.1, 0.25],
    kamera: { poz: [5.6, 4.4, 8.6], hedef: [-0.4, 1.4, 0.2] },
    mekanizmalar: [
      'Boji: ray üstünde vinç halatıyla portalın altına çekilir (tekerlekler döner), konum stoperleri kalkar',
      'Hidrolik silindir: krom koç hızlı iner → merkez pivota yavaş yaklaşır → kuvvet rampası → bekleme → boşaltma',
      'İkincil süspansiyon: 8 helis yay yük altında sıkışır, travers aşağı iner (görselde çökme 2× abartılı)',
      'Lineer cetvel okuyucusu koçla, komparatör palpörü traversle birlikte hareket eder',
      'Test biten boji öne çıkar; tavan vinci onu arkaya taşır ve sıradaki boji olarak hatta girer',
      'Konsolda 3 pilot lamba: acil / çalışıyor / yük var; bojide GEÇTİ/KALDI etiketi',
      'Operatör: testi konsoldan yönetir, boji içeri/dışarı alınırken ve vinç taşırken güvenli çizgiye çekilir, test bitince bojideki sonuç etiketini kontrol eder',
    ],
    cikarim: [
      'KAAN\'IN DÜZELTMESİ: test edilen parça 4 tekerlekli boji; boji makinenin altına girer, koç orta traverse (merkez pivot) basar, yaylar çöker ve çökme ölçülür.',
      'Mavi portal, kutu ayaklardaki pencereler ve üstteki ünite wagon-testing-img-01\'den; HMI ekranları (tren-vagon-img-01/02): "Hedef Konum mm / Hedef Ağırlık Ton", basınç ibresi, cetvel kalibrasyonu.',
      'Video-02: "Pompa 1 / Pompa 2 bar" ve "Koç Aşağı İniyor" → iki pompa (yük + hızlı yaklaşma) ve mesaj çubuğu.',
      'TAHMİN: yay grubu rijitliği ~0.75 ton/mm (40 ton → ~53 mm), elastik sınır 55 ton, kalıcı çökme ≤ 0.5 mm ve rijitlik ±%12 → GEÇTİ.',
      'TAHMİN: operatör iş akışı (konsol, güvenli bekleme çizgisi, etiket kontrolü); videoda operatörün konumu net görünmüyor.',
      'TAHMİN: boji ölçüleri (dingil aralığı 1.8 m, Ø840 tekerlek, 2×4 helis yay), bojinin vinç halatıyla çekilmesi ve tavan vinciyle 2 boji döngüsü; senaryolar "50+ test senaryosu" ifadesinden örneklendi.',
    ],
    group: g,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (lib.sabitle)
    sabitHaric: () => [koc, ...bojiler.map((b) => b.grup), palpor, tambur, halat, kanca, ...stoperler],
    update,
    kontroller,
    degerler: () => {
      const b = merkez();
      return [
        ['Boji', bojiDurum()],
        ['Anlık kuvvet', `${fmt(F, 1)} ton`],
        ['Yay çökmesi', `${fmt(cokmeMm(), 1)} mm`],
        ['Koç konumu', `${fmt(kocMm, 0)} mm`],
        ['Pompa 1 (yük)', `${fmt(basinc1() + (F > 0 ? gurultu(0.4) : 0), 0)} bar`],
        ['Pompa 2 (yaklaşma)', `${fmt(pompa2(), 0)} bar`],
        ['Ölçülen rijitlik', b?.Kolc ? `${fmt(b.Kolc, 2)} ton/mm` : '—'],
        ['Kalıcı çökme', b?.sonuc ? `${fmt(b.kalici, 2)} mm` : '—'],
        ['Sonuç', b?.sonuc ?? '—'],
        ['Senaryo', SENARYOLAR[senaryo]],
        ['Test sayısı', `${testNo}`],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
