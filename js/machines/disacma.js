// js/machines/disacma.js — Diş Açma ve Ayıklama Makinesi (iç mekanizma görünür).
//
// Kaan'ın tarifi (MKN-F06 + MKN-V10 aynı makine): ~6 cm'lik parçanın merkezine
// yakın, dikeyde hizalı İKİ deliğine M4 diş açılır; günde binlerce parça.
// Makinenin içinde İKİ kılavuz çekme ünitesi var. Parça yukarıdan aşağı YER
// ÇEKİMİYLE gelir; pnömatikler parçayı 1. konumda tutar, 1. diş açılır, bırakır;
// parça 2. konuma düşer, orada 2. diş açılır. Diş açmalar başarılıysa OK'ye,
// değilse NOK'a ayrılır — ayırma da pnömatik: KAYDIRAK yana kayarak parçayı OK
// ya da NOK tarafına bırakır. Normalde içi görünmez; "İç görünüm" kabini saydam yapar.
//
// Kılavuz ünitesinin görünüşü ve hareket profili arkozmakine.com'daki "AR810 ·
// canlı simülasyon"dan: kutu gövde + delikli gömme kapak, yanında üstü nervürlü
// servo motor sütunu, mavi konnektör; hızlı yaklaşma → yavaş ilerleme + ileri
// dönüş (ovalama) → ters dönerek geri çıkış; temas noktasında turuncu parlama.
//
// Yerleşim: oluk makinenin X–Y düzleminde 40° eğimli (önden bakınca soldan sağa
// iner); oluk çerçevesinde u = oluk boyunca aşağı, v = oluk yüzeyine dik, w = Z.

export function create(lib) {
  const {
    THREE, M, box, cyl, pipe, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, pano, canvasTex, levha,
    clamp, lerp, approach, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const S = 0.04;                                   // kutu profil kesiti
  const celik = mat(0x5c6166, { r: 0.55, m: 0.7, key: 'disacma-celik' });
  const sac = mat(0x8a9097, { r: 0.45, m: 0.75, key: 'disacma-sac' });
  const parcaMat = mat(0xdfe4e8, { r: 0.28, m: 0.75, key: 'disacma-parca2' });
  const olukMat = mat(0x2e3238, { r: 0.6, m: 0.4, key: 'disacma-oluk' });
  const uniteMat = mat(0xd3d7db, { r: 0.32, m: 0.65, key: 'arkoz-govde' });

  // ---------------------------------------------------------------- ölçüler
  const T0 = 0.85;                                  // masa üstü
  const KW = 1.3, KD = 0.76, KH = 1.05;             // kabin (masa üstünden)
  const A = (40 * Math.PI) / 180, cA = Math.cos(A), sA = Math.sin(A);
  const C = { x: -0.5, y: 1.74 };                   // oluk başlangıcı (makine çerçevesi)
  const OL = 0.95, KL = 0.22;                       // oluk ve kaydırak uzunluğu
  // Parça 60×25×6 mm; okunur olsun diye görsel olarak 3× büyütüldü
  const V = 3;
  const PL = 0.06 * V, PW = 0.025 * V, PT = 0.006 * V;
  const HD = 0.01 * V;                              // deliklerin merkezden ofseti (u boyunca, hizalı)
  const S1 = 0.45, S2 = 0.75;                       // stoper pimleri (parçanın ön kenarı burada durur)
  const P1 = S1 - PL / 2, P2 = S2 - PL / 2;         // tutma konumlarında parça merkezi
  const U1 = P1 + HD, U2 = P2 - HD;                 // ünite eksenleri: 1. ünite alttaki deliği, 2. ünite üsttekini çeker
  const U_DUS = 0.1;                                // magazinden düşen parçanın oluğa oturduğu merkez
  const KAY_W = 0.12;                               // kaydırak yana kayma (OK +, NOK −)
  const BAND = [2.4, 4.2];                          // kabul tork bandı (N·m, M4 ovalama — TAHMİN)
  const ACC = 2.2, VMAX = 1.0;                      // kayma ivmesi (görsel olarak yavaşlatıldı)
  const T_UNITE = 2.0, T_SIK = 0.15, T_KONTROL = 0.45;
  const olukNokta = (u, v, w = 0) => [C.x + u * cA + v * sA, C.y - u * sA + v * cA, w];
  const makineY = (u, v) => C.y - u * sA + v * cA;

  // ---------------------------------------------------------------- masa çerçevesi
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(S, T0, S, celik, sx * (KW / 2 - 0.02), T0 / 2, sz * (KD / 2 - 0.02), g);
  for (const y of [0.25, T0 - 0.03]) {
    for (const sz of [-1, 1]) box(KW, S, S, celik, 0, y, sz * (KD / 2 - 0.02), g);
    for (const sx of [-1, 1]) box(S, S, KD, celik, sx * (KW / 2 - 0.02), y, 0, g);
  }
  box(KW + 0.04, 0.025, KD + 0.04, sac, 0, T0 - 0.0125, 0, g);              // masa plakası
  box(KW - 0.06, 0.012, KD - 0.06, sac, 0, 0.27, 0, g);                     // alt raf
  // hava tankı (gümüş) + şartlandırıcı + spiral hortum (alt rafta)
  cyl(0.08, 0.55, M.krom, 0.2, 0.37, -0.12, g, { eksen: 'x', seg: 20 });
  box(0.16, 0.12, 0.1, M.alu, -0.35, 0.34, -0.1, g);
  cyl(0.025, 0.1, M.mavi, -0.35, 0.45, -0.1, g, { seg: 12 });
  for (let i = 0; i < 6; i++) cyl(0.045, 0.01, M.mavi, -0.15, 0.3 + i * 0.018, 0.15, g, { acik: true, seg: 16 });

  // ---------------------------------------------------------------- kabin (iç görünümde saydam)
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.5, metalness: 0.45, transparent: true, opacity: 1 });
  const kabin = new THREE.Group();
  g.add(kabin);
  const panel = (w, h, d, x, y, z) => {
    const m = box(w, h, d, panelMat, x, y, z, kabin);
    m.castShadow = false;                            // saydamken içeriyi gölgelemesin
    m.renderOrder = 5;
    return m;
  };
  const Y0 = T0, YC = T0 + KH / 2;
  panel(KW, KH, 0.012, 0, YC, -KD / 2);              // arka
  panel(KW, KH, 0.012, 0, YC, KD / 2);               // ön
  panel(0.012, KH, KD, -KW / 2, YC, 0);              // sol
  panel(0.012, KH, KD, KW / 2, YC, 0);               // sağ
  panel(KW, 0.012, KD, 0, Y0 + KH, 0);               // tavan
  // köşe profilleri (her iki modda görünür)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.025, KH, 0.025, celik, sx * KW / 2, YC, sz * KD / 2, g);
  for (const sz of [-1, 1]) box(KW, 0.025, 0.025, celik, 0, Y0 + KH, sz * KD / 2, g);
  for (const sx of [-1, 1]) box(0.025, 0.025, KD, celik, sx * KW / 2, Y0 + KH, 0, g);
  // kesit çizgileri (iç görünümde)
  const kesit = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(KW, KH, KD)),
    new THREE.LineBasicMaterial({ color: 0x39c5cf, transparent: true, opacity: 0.8 }));
  kesit.position.set(0, YC, 0);
  g.add(kesit);
  // ön kapak donanımı (yalnız kapalı görünümde): levha + kulplar
  const onDonanim = new THREE.Group();
  g.add(onDonanim);
  const onLevha = levha(['DİŞ AÇMA · 2× M4', 'Kılavuz çekme ve ayıklama'], 0.42, 0.11, { bg: '#17324f', font: 64, px: 512 });
  onLevha.position.set(-0.3, Y0 + KH - 0.15, KD / 2 + 0.008);
  onDonanim.add(onLevha);
  for (const x of [0.2, 0.45]) box(0.02, 0.14, 0.03, M.siyah, x, YC, KD / 2 + 0.02, onDonanim);

  // ---------------------------------------------------------------- oluk (eğimli kayma yolu)
  const oluk = new THREE.Group();
  oluk.position.set(C.x, C.y, 0);
  oluk.rotation.z = -A;
  g.add(oluk);
  box(OL, 0.012, 0.11, olukMat, OL / 2, -0.006, 0, oluk);
  box(OL, 0.012, 0.006, M.krom, OL / 2, 0.0, PW / 2 + 0.003, oluk);       // ön alçak korkuluk (parça buna dayanır)
  box(OL, 0.008, 0.006, M.krom, OL / 2, -0.002, -0.054, oluk);             // arka alçak kenar (sıkma pabuçları üstünden geçer)
  // oluk ayakları
  for (const u of [0.18, 0.86]) {
    const [x, y] = olukNokta(u, -0.012);
    box(0.03, y - T0, 0.03, celik, x, (y + T0) / 2, -0.03, g);
  }
  // arka bağlantı plakası (üniteler buna bağlı)
  box(0.95, 0.55, 0.012, M.alu, 0.0, 1.58, -KD / 2 + 0.02, g);

  // ---------------------------------------------------------------- magazin (dikey hazne)
  const [mx, my0] = olukNokta(U_DUS, PT / 2);
  const MAG_Y = my0 + 0.06;                         // en alttaki parçanın merkezi
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.01, 0.36, 0.01, M.krom, mx + sx * (PL / 2 + 0.008), MAG_Y + 0.17, sz * (PW / 2 + 0.008), g);
  box(PL + 0.04, 0.012, PW + 0.04, sac, mx, MAG_Y + 0.35, 0, g);                       // üst çerçeve
  const huni = cyl(0.13, 0.12, sac, mx, MAG_Y + 0.42, 0, g, { r2: 0.07, seg: 4, acik: true });
  huni.rotation.y = Math.PI / 4;
  // ayırıcı (eskapman) pnömatik itici: en alttaki parçayı bırakır
  cyl(0.014, 0.08, M.alu, mx - 0.15, MAG_Y + 0.012, 0, g, { eksen: 'x', seg: 12 });
  const esk = box(0.012, 0.012, 0.05, M.krom, mx - 0.1, MAG_Y + 0.012, 0, g);
  const MAG_GOR = 10;
  const magIm = new THREE.InstancedMesh(new THREE.BoxGeometry(PL, PT, PW), parcaMat, MAG_GOR);
  magIm.castShadow = true;
  g.add(magIm);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  let magN = 36;                                    // haznedeki toplam parça
  let magCizilen = -1;
  function magCiz() {
    const n = Math.min(MAG_GOR, magN);
    if (n === magCizilen) return;
    magCizilen = n;
    for (let i = 0; i < n; i++) magIm.setMatrixAt(i, _m4.compose(_p.set(mx, MAG_Y + 0.014 + i * PT * 1.05, 0), _q.identity(), _s));
    magIm.count = n;
    magIm.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- kılavuz çekme üniteleri (Arkoz AR görünümü)
  const nervurTex = canvasTex(64, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#b9bec4'); gr.addColorStop(0.5, '#eef1f3'); gr.addColorStop(1, '#a7adb3');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(80,88,96,.55)';
    for (let i = 0; i < 7; i++) x.fillRect(0, 10 + i * 7, w, 2);
  });
  const motorMat = new THREE.MeshStandardMaterial({ map: nervurTex, roughness: 0.3, metalness: 0.7 });
  const kapakTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#c9ced3'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#8d949b'; x.lineWidth = 6; x.beginPath(); x.roundRect(10, 10, w - 20, h - 20, 18); x.stroke();
    x.fillStyle = '#7b828a';
    for (const [cx, cy] of [[44, 40], [86, 70], [44, 98]]) { x.beginPath(); x.arc(cx, cy, 8, 0, Math.PI * 2); x.fill(); }
  });
  const kapakMat = new THREE.MeshStandardMaterial({ map: kapakTex, roughness: 0.4, metalness: 0.5 });
  const kilavuzTex = canvasTex(32, 64, (x, w, h) => {
    x.fillStyle = '#5a6068'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#dfe3e7'; x.lineWidth = 4;
    for (let i = -h; i < h * 2; i += 10) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i + 12); x.stroke(); }
  }, { tekrar: [1, 2] });
  const kilavuzMat = new THREE.MeshStandardMaterial({ map: kilavuzTex, roughness: 0.25, metalness: 0.95 });
  const V_IDLE = 0.075, V_TEMAS = PT, V_DIP = -0.002, KIRIK_KISALMA = 0.032;

  function uniteKur(U, no) {
    const u = { no, U, sp: null, uc: null, kivilcim: null, k: -1, aci: 0, rpm: 0, tork: 0, tepe: 0, hedefTepe: 3.2,
      kirik: false, p: null, delik: 0, yaz: 'BEKLİYOR' };
    const gov = new THREE.Group();
    gov.position.set(U, 0, 0);
    oluk.add(gov);
    box(0.12, 0.18, 0.12, uniteMat, 0, 0.22, 0, gov);                       // gövde
    const kp = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.12), kapakMat);  // delikli gömme kapak (ön yüz)
    kp.position.set(0, 0.22, 0.0605);
    gov.add(kp);
    // servo motor sütunu: nervürlü + disk kapak
    box(0.085, 0.2, 0.085, motorMat, 0.105, 0.235, 0, gov);
    cyl(0.04, 0.02, mat(0xe3e6e9, { r: 0.25, m: 0.8, key: 'arkoz-kapak' }), 0.105, 0.345, 0, gov, { seg: 24 });
    box(0.03, 0.018, 0.022, mat(0x2f7ff0, { r: 0.4, key: 'arkoz-mavi' }), -0.03, 0.318, 0.02, gov);   // mavi konnektör
    box(0.012, 0.016, 0.012, M.siyah, -0.05, 0.318, 0.02, gov);
    // arka bağlantı braketi (kabin arka plakasına)
    box(0.06, 0.06, KD / 2 - 0.08, M.alu, 0.0, 0.25, -(KD / 2 - 0.08) / 2 - 0.05, gov);
    // ünite numarası
    const lv = levha([`ÜNİTE ${no}`], 0.09, 0.025, { bg: '#151b22', fg: '#f2c200', font: 80, px: 256 });
    lv.position.set(0, 0.145, 0.0605);
    gov.add(lv);
    // iş mili (spindle): orijin = kılavuz ucu; v boyunca iner, kendi ekseninde döner
    const sp = new THREE.Group();
    sp.position.set(U, V_IDLE, 0);
    oluk.add(sp);
    cyl(0.016, 0.1, M.krom, 0, 0.1, 0, sp, { seg: 14 });                      // mil
    cyl(0.022, 0.03, M.koyu, 0, 0.045, 0, sp, { seg: 14 });                   // pens
    box(0.006, 0.012, 0.03, M.turuncu, 0.022, 0.045, 0, sp);                  // dönüş işareti
    const ucGrup = new THREE.Group();
    sp.add(ucGrup);
    const uc = cyl(0.0065, 0.045, kilavuzMat, 0, 0.0225, 0, ucGrup, { seg: 12 });
    // temas parlaması (ovalama sürtünmesi)
    const kivMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const kiv = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), kivMat);
    kiv.position.set(U, PT + 0.002, 0);
    kiv.castShadow = false;
    oluk.add(kiv);
    Object.assign(u, { sp, uc, ucGrup, kivilcim: kiv, kivMat });
    return u;
  }
  const uniteler = [uniteKur(U1, 1), uniteKur(U2, 2)];

  // ---------------------------------------------------------------- istasyonlar: stoper pimi + yan sıkma silindiri
  // Silindir mili: z boyunca 0..1 birim, ölçekle uzar
  const milGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 8);
  milGeo.rotateX(Math.PI / 2); milGeo.translate(0, 0, 0.5);
  function istasyonKur(Sp, Pm, i) {
    const s = { i, S: Sp, P: Pm, p: null, gecen: null, faz: 'bos', t: 0, stop: 1, stopH: 1, sik: 0, sikH: 0, unite: uniteler[i] };
    // stoper: oluk altında silindir, pim yüzeyden çıkar
    cyl(0.012, 0.05, M.alu, Sp + 0.006, -0.045, 0.015, oluk, { seg: 12 });
    s.pim = cyl(0.006, 0.05, M.krom, Sp + 0.006, 0, 0.015, oluk, { seg: 10 });
    // sıkma: arka kenardan +w yönüne itilen pabuç
    cyl(0.013, 0.05, M.alu, Pm, PT / 2, -0.11, oluk, { eksen: 'z', seg: 12 });
    s.mil = new THREE.Mesh(milGeo, M.krom);
    s.mil.position.set(Pm, PT / 2, -0.085);
    oluk.add(s.mil);
    s.pabuc = box(0.06, 0.012, 0.008, M.turuncu, Pm, PT / 2, -0.075, oluk);
    return s;
  }
  const ist = [istasyonKur(S1, P1, 0), istasyonKur(S2, P2, 1)];

  // ---------------------------------------------------------------- kırmızı ışıklı sensör (2. konumda delik kontrolü)
  const sensorPoz = [P2, 0.13, 0.11];
  const sens = new THREE.Group();
  sens.position.set(...sensorPoz);
  oluk.add(sens);
  box(0.035, 0.03, 0.045, M.siyah, 0, 0, 0, sens);
  const sensorMat = lamba(0xff2a1a, 0.6);
  cyl(0.008, 0.006, sensorMat, 0, -0.017, 0, sens, { seg: 10 });
  box(0.008, 0.06, 0.008, M.koyu, 0, 0.04, -0.02, sens);
  const isinMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.06, depthWrite: false, toneMapped: false });
  {
    const hedef = new THREE.Vector3(P2, PT, 0), kaynak = new THREE.Vector3(...sensorPoz);
    const d = new THREE.Vector3().subVectors(kaynak, hedef);
    const isin = new THREE.Mesh(new THREE.ConeGeometry(0.035, d.length(), 16, 1, true), isinMat);
    isin.position.addVectors(kaynak, hedef).multiplyScalar(0.5);
    isin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    isin.castShadow = false;
    oluk.add(isin);
  }

  // ---------------------------------------------------------------- pnömatik kaydırak (OK / NOK ayırma)
  // Girişi oluk çıkışında sabit kalır, çıkış ucu silindirle yana kayar (yönlendirme oluğu):
  // kayW = çıkış ucunun w konumu (OK +, NOK −).
  const KAY_U = OL + KL * 0.8;                       // silindirin çıkış koluna bağlandığı yer
  box(0.06, 0.016, 0.36, M.koyu, KAY_U, -0.03, 0, oluk);                     // kızak rayı
  cyl(0.016, 0.12, M.alu, KAY_U, -0.03, -0.27, oluk, { eksen: 'z', seg: 12 });
  const kayMil = new THREE.Mesh(milGeo, M.krom);
  kayMil.position.set(KAY_U, -0.03, -0.21);
  oluk.add(kayMil);
  const kay = new THREE.Group();
  kay.position.set(OL, 0, 0);
  oluk.add(kay);
  box(KL, 0.012, 0.11, mat(0xf0a020, { r: 0.45, m: 0.3, key: 'kaydirak' }), KL / 2, -0.006, 0, kay);
  for (const sz of [-1, 1]) box(KL, 0.02, 0.005, M.krom, KL / 2, 0.004, sz * 0.055, kay);
  box(0.04, 0.03, 0.04, M.koyu, KL * 0.8, -0.03, 0, kay);                   // kızak arabası
  cyl(0.01, 0.03, M.koyu, 0, -0.02, 0, kay, { seg: 10 });                    // dönme pimi (girişte)
  let kayW = KAY_W, kayH = KAY_W, kaySin = KAY_W / KL, kayCos = Math.sqrt(1 - kaySin * kaySin);

  // ---------------------------------------------------------------- OK / NOK kasaları
  const [xSon, ySon] = olukNokta(OL + KL, 0);
  const KASA_X = xSon + 0.075;
  const kasaKur = (z, renk, ad) => {
    const k = new THREE.Group();
    k.position.set(KASA_X, T0 + 0.002, z);
    g.add(k);
    const m = mat(renk, { r: 0.7, key: 'kasa' + ad });
    box(0.28, 0.01, 0.16, m, 0, 0.005, 0, k);
    for (const sz of [-1, 1]) box(0.28, 0.07, 0.008, m, 0, 0.035, sz * 0.076, k);
    for (const sx of [-1, 1]) box(0.008, 0.07, 0.16, m, sx * 0.136, 0.035, 0, k);
    const lv = levha([ad], 0.1, 0.045, { bg: ad === 'OK' ? '#1e7a34' : '#a51f1b', fg: '#fff', font: 80, px: 256 });
    lv.position.set(0.142, 0.04, 0);
    lv.rotation.y = Math.PI / 2;
    k.add(lv);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(PL, PT, PW), parcaMat, 40);
    im.count = 0;
    im.castShadow = true;
    k.add(im);
    return { k, im };
  };
  const kasaOK = kasaKur(0.14, 0x2e9e46, 'OK');
  const kasaNOK = kasaKur(-0.14, 0xc6302a, 'NOK');
  box(0.28, 0.07, 0.006, sac, KASA_X, T0 + 0.037, 0, g);                    // kasalar arası ayırıcı
  function kasayaKoy(kasa, toplam) {
    const n = toplam <= 0 ? 0 : ((toplam - 1) % 40) + 1;
    for (let i = 0; i < n; i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678;
      const fx = a - Math.floor(a) - 0.5, fz = b - Math.floor(b) - 0.5;
      _p.set(fx * 0.06, 0.018 + Math.floor(i / 6) * 0.014, fz * 0.04);
      _q.setFromEuler(_e.set(0, fx * 0.5, fz * 0.2));
      kasa.im.setMatrixAt(i, _m4.compose(_p, _q, _s));
    }
    kasa.im.count = n;
    kasa.im.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- parça havuzu
  const halkaTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#1a1c1f'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#d6dbe0'; x.lineWidth = 3;
    for (let r = 8; r < 32; r += 6) { x.beginPath(); x.arc(32, 32, r, 0, Math.PI * 2); x.stroke(); }
  });
  const HAVUZ = 8;
  const parcalar = [];
  for (let i = 0; i < HAVUZ; i++) {
    const pg = new THREE.Group();
    pg.visible = false;
    oluk.add(pg);
    box(PL, PT, PW, parcaMat, 0, 0, 0, pg);
    const hm = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6, metalness: 0.3, emissive: 0x000000 }));
    const hv = [HD, -HD].map((u, k) => {
      const d = cyl(0.0085, PT + 0.002, hm[k], u, 0, 0, pg, { seg: 14 });
      d.castShadow = false;
      return d;
    });
    parcalar.push({ g: pg, hm, hv, st: 'yok', u: 0, v: 0, w: 0, rz: 0, rx: 0, hiz: 0, vu: 0, vv: 0, t: 0,
      dis: [null, null], tork: [0, 0], ok: true, sebep: '', delikYok: false, rast: [false, false], kaynak: null });
  }
  function parcaSifirla(p) {
    p.dis = [null, null]; p.tork = [0, 0]; p.ok = true; p.sebep = ''; p.delikYok = false; p.rast = [false, false];
    for (let k = 0; k < 2; k++) { p.hm[k].map = null; p.hm[k].color.setHex(0x0c0d0f); p.hm[k].emissive.setHex(0); p.hm[k].needsUpdate = true; p.hv[k].visible = true; }
  }
  function disAcildi(p, k, iyi) {
    if (iyi) { p.hm[k].map = halkaTex; p.hm[k].color.setHex(0xffffff); }
    else p.hm[k].color.setHex(0x2a1010);
    p.hm[k].needsUpdate = true;
  }

  // ---------------------------------------------------------------- pano + Delta HMI (sol yanda, ayaklı)
  const PX = -KW / 2 - 0.32, PY = 1.0, PZ = 0.12;
  box(0.05, PY, 0.05, celik, PX, PY / 2, PZ - 0.05, g);
  box(0.32, 0.02, 0.32, celik, PX, 0.01, PZ - 0.05, g);
  pano(g, PX, PY, PZ - 0.05, 0.44, 0.56, 0.18, 0);
  const ekran = new Ekran(0.3, 0.196, 640);
  ekran.mesh.position.set(PX, PY + 0.36, PZ + 0.052);
  g.add(ekran.mesh);
  box(0.33, 0.225, 0.014, M.siyah, PX, PY + 0.36, PZ + 0.04, g);
  const delta = levha(['DELTA'], 0.06, 0.014, { bg: '#0b0b0b', fg: '#cfd6dd', font: 90, px: 256 });
  delta.position.set(PX - 0.12, PY + 0.462, PZ + 0.048);
  g.add(delta);
  acilStop(g, PX - 0.12, PY + 0.13, PZ + 0.05, 0);
  const kule = kuleLambasi(g, KW / 2 - 0.12, T0 + KH, -KD / 2 + 0.1);
  // valf adası (X6 / X20) arka plakada + mavi hortumlar
  const VX = -0.33, VY = 1.8, VZ = -KD / 2 + 0.06;
  box(0.2, 0.06, 0.07, M.koyu, VX, VY, VZ, g);
  for (let i = 0; i < 4; i++) box(0.035, 0.07, 0.05, mat(0x2f6fc4, { r: 0.4, key: 'valf' }), VX - 0.06 + i * 0.04, VY + 0.06, VZ, g);
  for (const [i, ad] of [[0, 'X6'], [1, 'X20']]) {
    box(0.05, 0.035, 0.03, M.beyaz, VX - 0.04 + i * 0.08, VY - 0.045, VZ + 0.03, g);
    const lv = levha([ad], 0.04, 0.02, { bg: '#f2f2f2', fg: '#111', font: 90, px: 128 });
    lv.position.set(VX - 0.04 + i * 0.08, VY - 0.045, VZ + 0.046);
    g.add(lv);
  }
  for (const [U, dv, dw] of [[U1 - 0.03, 0.33, 0.0], [U2 - 0.03, 0.33, 0.0], [P1, 0.02, -0.14], [P2, 0.02, -0.14]]) {
    const hedef = olukNokta(U, dv, dw);
    pipe([[VX, VY - 0.02, VZ + 0.04], [(VX + hedef[0]) / 2, VY - 0.02, -0.2], hedef], 0.005, M.mavi, g);
  }

  // ---------------------------------------------------------------- operatör + basamak, ham parça kasası, kasa paleti
  // Magazin azalınca operatör ham parça kasasını alır, basamağa çıkıp huniye boşaltır; OK kasası
  // dolunca paletten boş kasa getirip değiştirir, dolu kasayı palete koyar; arada HMI'yı izler.
  const BASAMAK = { x: mx, z: 0.62, h: 0.45 };
  box(0.5, BASAMAK.h, 0.36, M.koyu, BASAMAK.x, BASAMAK.h / 2, BASAMAK.z, g);
  box(0.5, 0.012, 0.36, M.sari, BASAMAK.x, BASAMAK.h + 0.006, BASAMAK.z, g);
  const kasaMavi = mat(0x2f6fc4, { r: 0.6, key: 'disacma-hamkasa' });
  const kasaYesil = mat(0x2e9e46, { r: 0.7, key: 'kasaOK' });
  // ham parça kasası (yerde, açık mavi plastik) — üstünde parçalar
  const STOK = { x: -1.6, z: 0.0 };
  box(0.42, 0.24, 0.32, kasaMavi, STOK.x, 0.12, STOK.z, g);
  for (let i = 0; i < 6; i++) box(PL, PT, PW, parcaMat, STOK.x - 0.1 + (i % 3) * 0.1, 0.24 + PT / 2 + Math.floor(i / 3) * PT, STOK.z - 0.05 + Math.floor(i / 3) * 0.1, g);
  // kasa paleti (sağ arkada): boş OK kasaları + dolu kasalar
  const PAL = { x: 1.35, z: -0.55 };
  box(0.62, 0.1, 0.52, M.ahsap, PAL.x, 0.05, PAL.z, g);
  const kasaGeo = (parent, x, y, z) => {
    const k = new THREE.Group(); k.position.set(x, y, z); parent.add(k);
    box(0.28, 0.01, 0.16, kasaYesil, 0, 0.005, 0, k);
    for (const sz of [-1, 1]) box(0.28, 0.07, 0.008, kasaYesil, 0, 0.035, sz * 0.076, k);
    for (const sx of [-1, 1]) box(0.008, 0.07, 0.16, kasaYesil, sx * 0.136, 0.035, 0, k);
    const dolu = new THREE.Group(); k.add(dolu);
    for (let i = 0; i < 6; i++) box(PL, PT, PW, parcaMat, -0.06 + (i % 3) * 0.06, 0.03 + Math.floor(i / 3) * PT, (i % 2 ? 1 : -1) * 0.03, dolu);
    return { k, dolu };
  };
  const bosYigin = [0, 1].map((i) => {                                                                  // boş kasa yığını
    const kg = kasaGeo(g, PAL.x - 0.15, 0.1 + i * 0.072, PAL.z);
    kg.dolu.visible = false;
    return kg;
  });
  const doluYigin = [0, 1, 2].map((i) => kasaGeo(g, PAL.x + 0.15, 0.1 + i * 0.072, PAL.z));
  let doluSay = 1;
  const doluCiz = () => doluYigin.forEach((y, i) => (y.k.visible = i < doluSay));
  doluCiz();
  // operatör + taşınanlar (operatör grubunun yerelinde: yüz +Z, eller önde)
  const op = lib.operator({ yelek: 0xffd400, baret: 0xffffff });
  g.add(op.group);
  const tHam = new THREE.Group();
  op.group.add(tHam);
  box(0.3, 0.12, 0.2, kasaMavi, 0, 0, 0, tHam);
  for (let i = 0; i < 4; i++) box(PL, PT, PW, parcaMat, -0.06 + (i % 2) * 0.12, 0.06 + PT / 2, (i < 2 ? -0.04 : 0.04), tHam);
  tHam.visible = false;
  const tKasa = kasaGeo(op.group, 0, 0.97, 0.47);
  tKasa.k.visible = false;
  const LANE = 1.05;
  const IZLE = { x: PX, z: 0.78, bx: PX, bz: PZ };
  // OK kasasına sağ yandan uzanır (önden yaklaşınca kamerada mekanizmanın önünü kapatıyordu)
  const STOK_DUR = { x: STOK.x, z: 0.42 }, PAL_DUR = { x: PAL.x, z: -0.05 }, KASA_DUR = { x: 1.0, z: 0.14 };
  const opD = { x: IZLE.x, z: IZLE.z, y: 0, yon: Math.PI, f: 'izle', t: 0, yol: [], bx: IZLE.bx, bz: IZLE.bz };
  const aciFark = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  function opGit(x, z, bx, bz) {
    opD.yol.length = 0;
    if (Math.abs(x - opD.x) > 0.3 || Math.abs(z - opD.z) > 0.6) opD.yol.push([opD.x, LANE], [x, LANE]);
    opD.yol.push([x, z]);
    opD.bx = bx; opD.bz = bz;
  }
  const OP_AD = {
    izle: 'HMI\'yı izliyor', stoga: 'ham parça kasasına gidiyor', al_ham: 'ham parça kasasını alıyor',
    basamaga: 'magazine taşıyor', cik: 'basamağa çıkıyor', bosalt: 'magazine boşaltıyor', in: 'basamaktan iniyor',
    palete: 'boş kasa almaya gidiyor', bos_al: 'boş kasa alıyor', kasaya: 'OK kasasına gidiyor',
    degistir: 'OK kasasını değiştiriyor', palete2: 'dolu kasayı palete götürüyor', dolu_birak: 'dolu kasayı bırakıyor',
    izleye: 'panoya dönüyor',
  };

  // ---------------------------------------------------------------- durum
  let durum = 'calisiyor';          // calisiyor | durdu | acil | alarm
  let alarmMetin = '';
  let icGorunum = true;
  let hiz = 100;                    // %
  let rastOran = 1.5;               // % rastgele tork sapması
  let deliksizOran = 0.5;           // % rastgele deliksiz parça
  let deliksizSiradaki = false, sikismaIste = false;
  let gunluk = 1846, ok = 1829, nok = 17, cevrimSay = 12480, artArdaNok = 0;
  let okKasaBas = ok - 34;          // OK kasası en son değiştirildiğinde ok sayacı (kasadaki = ok - okKasaBas)
  let sonSonuc = '—', sonTepe = [0, 0], zaman = 0, eskT = 0, eskAnim = 0, magBekle = 0;
  const bitisler = [];
  const hf = () => 100 / hiz;

  const serbestParca = () => parcalar.find((p) => p.st === 'yok');
  const kaydirakMesgul = () => parcalar.some((p) => p.st === 'kaydirak' || (p.st === 'kay' && p.u > S2));
  const araliktaKayan = (a, b) => parcalar.some((p) => (p.st === 'kay' || p.st === 'dus' || p.st === 'sikisti') && p.u >= a && p.u <= b);

  function sinirBul(p) {
    let lim = Infinity;
    if (ist[0].stop > 0.5 && p.u <= P1 + 1e-4) lim = P1;
    else if (ist[1].stop > 0.5 && p.u <= P2 + 1e-4) lim = P2;
    for (const q of parcalar) {
      if (q === p || q.st === 'yok' || q.st === 'dus' || q.st === 'serbest' || q.u <= p.u) continue;
      lim = Math.min(lim, q.u - PL - 0.002);
    }
    return lim;
  }

  // ---------------------------------------------------------------- kılavuz çevrimi (Arkoz profili)
  function uniteBasla(un, p, delik) {
    un.k = 0; un.p = p; un.delik = delik; un.tepe = 0;
    if (p.delikYok) un.hedefTepe = 8.6 + Math.random() * 0.6;              // delik yok → aşırı tork
    else if (un.kirik) un.hedefTepe = 0.15 + Math.random() * 0.1;          // kırık kılavuz → tork yok
    else if (p.rast[un.no - 1]) un.hedefTepe = Math.random() < 0.5 ? 5.0 + Math.random() * 0.6 : 1.6 + Math.random() * 0.5;
    else un.hedefTepe = 3.2 + gurultu(0.3);
  }
  function uniteBitti(un) {
    const p = un.p, i = un.no - 1;
    p.tork[i] = un.tepe;
    sonTepe[i] = un.tepe;
    const iyi = !un.kirik && !p.delikYok && un.tepe >= BAND[0] && un.tepe <= BAND[1];
    p.dis[i] = iyi;
    if (!iyi && !p.sebep) {
      p.sebep = p.delikYok ? 'Delik yok · aşırı tork'
        : un.kirik ? `Ünite ${un.no}: kılavuz kırık · diş yok`
          : `Ünite ${un.no}: tork bandı dışı (${fmt(un.tepe, 1)} N·m)`;
    }
    if (!p.delikYok) disAcildi(p, un.delik, iyi);
    p.hm[un.delik].emissiveIntensity = 0;
    cevrimSay++;
    un.k = -1; un.p = null;
  }
  function uniteGuncelle(un, dt) {
    let tip = V_IDLE, don = 0, tork = 0, kiv = 0;
    un.yaz = 'BEKLİYOR';
    if (un.k >= 0) {
      if (durum === 'calisiyor') un.k += dt / (T_UNITE * hf());
      const k = Math.min(un.k, 1);
      const p = un.p;
      if (k < 0.05) tip = V_IDLE;
      else if (k < 0.25) { tip = lerp(V_IDLE, V_TEMAS, easeInOut((k - 0.05) / 0.2)); un.yaz = 'YAKLAŞMA'; }
      else if (k < 0.55) {
        const f = (k - 0.25) / 0.3;
        if (p && p.delikYok) {
          // dolu malzemeye çarptı: servo aşırı torkla durdurur, geri çeker
          tip = V_TEMAS; tork = un.hedefTepe * Math.min(1, f * 6); kiv = Math.min(1, f * 5) * 1.6; un.yaz = 'AŞIRI TORK';
          if (f > 0.25) un.k = 0.75;
        } else {
          tip = lerp(V_TEMAS, V_DIP, f); don = (8 * Math.PI) / (0.3 * T_UNITE * hf());
          tork = un.hedefTepe * (0.35 + 0.65 * Math.sin(Math.min(1, f * 1.15) * Math.PI / 2)) + gurultu(0.05);
          if (un.kirik) { tork = un.hedefTepe + gurultu(0.03); un.yaz = 'DİŞ YOK'; } else { kiv = Math.sin(Math.min(1, f * 1.1) * Math.PI); un.yaz = 'DİŞ ÇEKİYOR'; }
        }
      } else if (k < 0.75) {
        tip = lerp(V_DIP, V_TEMAS, (k - 0.55) / 0.2); don = -(8 * Math.PI) / (0.2 * T_UNITE * hf());
        tork = un.kirik ? 0.1 : un.hedefTepe * 0.4 + gurultu(0.05); un.yaz = 'GERİ ÇIKIŞ';
      } else if (k < 0.9) { tip = lerp(V_TEMAS, V_IDLE, easeInOut((k - 0.75) / 0.15)); un.yaz = 'YUKARI'; }
      un.tepe = Math.max(un.tepe, tork);
      if (un.k >= 1) uniteBitti(un);
    }
    if (durum !== 'calisiyor') { don = 0; kiv = 0; }
    un.aci += don * dt;
    un.sp.position.y = tip;
    un.sp.rotation.y = un.aci;
    un.rpm = don ? 2950 + Math.round(gurultu(110)) : 0;
    un.tork = Math.max(0, tork);
    // kırık kılavuz: uç kısalır, delik dibine ulaşmaz
    un.ucGrup.position.y = un.kirik ? KIRIK_KISALMA : 0;
    un.uc.scale.y = un.kirik ? 0.3 : 1;
    un.kivMat.opacity = Math.min(1, kiv);
    un.kivilcim.scale.setScalar(0.6 + kiv * 1.1);
    // ovalama sürtünmesi: delik ağzı turuncu kızarır
    if (un.p && un.k >= 0) {
      const hm = un.p.hm[un.delik];
      hm.emissive.setHex(0xff6a10);
      hm.emissiveIntensity = kiv * 2.2;
    }
  }

  // ---------------------------------------------------------------- akış
  function serbestBirak() {
    // eskapman: 1. konum boş, stoper yukarıda ve aradaki oluk boşsa en alttaki parçayı bırak
    if (magN <= 0 || ist[0].p || ist[0].stop < 1 || araliktaKayan(0, P1 + 0.001)) return;
    if (eskT > 0) return;
    const p = serbestParca();
    if (!p) return;
    parcaSifirla(p);
    p.delikYok = deliksizSiradaki || Math.random() * 100 < deliksizOran;
    deliksizSiradaki = false;
    p.rast = [Math.random() * 100 < rastOran, Math.random() * 100 < rastOran];
    if (p.delikYok) p.hv.forEach((h) => (h.visible = false));
    // düşüş başlangıcı: magazin altında yatay → oluk çerçevesine çevir
    const dx = mx - C.x, dy = MAG_Y - C.y;
    p.su = dx * cA - dy * sA; p.sv = dx * sA + dy * cA;
    p.st = 'dus'; p.t = 0; p.w = 0; p.rx = 0;
    p.sikisacak = sikismaIste; sikismaIste = false;
    p.g.visible = true;
    magN--; eskT = 0.5 * hf(); eskAnim = 1;
  }

  function parcaGuncelle(p, dt) {
    if (p.st === 'dus') {
      p.t += dt;
      const k = Math.min(1, p.t / 0.28);
      p.u = lerp(p.su, U_DUS, k * k); p.v = lerp(p.sv, PT / 2, k * k); p.rz = lerp(A, 0, k);
      if (k >= 1) { p.st = 'kay'; p.hiz = 0.15; p.u = U_DUS; p.v = PT / 2; p.rz = 0; }
    } else if (p.st === 'kay' || p.st === 'kaydirak') {
      p.hiz = Math.min(VMAX, p.hiz + ACC * dt);
      let yeni = p.u + p.hiz * dt;
      if (p.sikisacak && p.u < 0.27 && yeni >= 0.27) {
        yeni = 0.27; p.st = 'sikisti'; p.rz = 0.12; p.hiz = 0;
        durum = 'alarm'; alarmMetin = 'PARÇA OLUKTA SIKIŞTI';
      }
      const lim = sinirBul(p);
      if (p.st !== 'sikisti' && yeni >= lim) {
        yeni = lim; p.hiz = 0;
        for (const s of ist) if (Math.abs(lim - s.P) < 1e-4 && !s.p && s.stop > 0.5) { p.st = 'tut'; s.p = p; s.faz = 'sik'; s.t = 0; }
      }
      p.u = yeni;
      if (p.u > OL - PL / 2 && p.st === 'kay') p.st = 'kaydirak';
      if (p.st === 'kaydirak' && p.u > OL + KL + PL * 0.3) {
        // kaydırak ucundan serbest düşüş: kaydırak yönündeki hızla (oluk çerçevesinde yerçekimi = (sA, −cA))
        const s = p.u - OL;
        p.fu = OL + s * kayCos; p.fw = s * kaySin;
        p.st = 'serbest'; p.vu = p.hiz * kayCos; p.vw = p.hiz * kaySin; p.vv = 0;
      }
    } else if (p.st === 'serbest') {
      const gv = 9.81 * 0.55;
      p.vu += sA * gv * dt; p.vv -= cA * gv * dt;
      p.fu += p.vu * dt; p.fw += p.vw * dt; p.v += p.vv * dt; p.rz -= dt * 5;
      if (makineY(p.fu, p.v) < T0 + 0.03) {
        p.st = 'yok'; p.g.visible = false;
        gunluk++;
        if (p.ok) { ok++; artArdaNok = 0; kasayaKoy(kasaOK, Math.min(40, ok - okKasaBas)); }
        else { nok++; artArdaNok++; kasayaKoy(kasaNOK, nok); }
        bitisler.push(zaman);
        if (artArdaNok >= 3) { durum = 'alarm'; alarmMetin = 'ART ARDA 3 NOK · KILAVUZU KONTROL ET'; }
      }
    }
    // görüntü konumu: kaydırak üstünde kaydırak ekseni boyunca, düşüşte serbest koordinat
    let ry = 0;
    if (p.st === 'kaydirak') {
      const s = Math.max(0, p.u - OL);
      p.g.position.set(OL + s * kayCos, p.v, s * kaySin);
      ry = -Math.asin(kaySin);
    } else if (p.st === 'serbest') { p.g.position.set(p.fu, p.v, p.fw); ry = -Math.asin(kaySin); }
    else p.g.position.set(p.u, p.v, p.w);
    p.g.rotation.set(0, ry, p.rz);
  }

  function istasyonGuncelle(s, dt) {
    s.stop = approach(s.stop, s.stopH, dt / 0.12);
    s.sik = approach(s.sik, s.sikH, dt / T_SIK);
    // geçen parça pimi tamamen aştıysa (ya da düştüyse) pim tekrar kalkar
    if (s.stopH === 0 && !s.p) {
      const q = s.gecen;
      if (!q || q.st === 'yok' || q.st === 'serbest' || q.u - PL / 2 > s.S + 0.01) { s.stopH = 1; s.gecen = null; }
    }
    if (!s.p) return;
    s.t += dt;
    if (s.faz === 'sik') {
      s.sikH = 1;
      if (s.sik >= 1) { s.faz = 'kilavuz'; s.t = 0; uniteBasla(s.unite, s.p, s.i === 0 ? 0 : 1); }
    } else if (s.faz === 'kilavuz') {
      if (s.unite.k < 0) { s.faz = s.i === 1 ? 'kontrol' : 'birak'; s.t = 0; }
    } else if (s.faz === 'kontrol') {
      if (s.t >= T_KONTROL * hf()) {
        const p = s.p;
        p.ok = p.dis[0] === true && p.dis[1] === true;
        if (!p.ok && !p.sebep) p.sebep = 'Diş kontrolü başarısız';
        for (let k = 0; k < 2; k++) { p.hm[k].emissive.setHex(p.ok ? 0x00ff55 : 0xff2200); p.hm[k].emissiveIntensity = 0.7; }
        sonSonuc = p.ok ? `OK · ${fmt(p.tork[0], 1)} / ${fmt(p.tork[1], 1)} N·m` : `NOK · ${p.sebep}`;
        s.faz = 'birak'; s.t = 0;
      }
    } else if (s.faz === 'birak') {
      s.sikH = 0;
      if (s.sik > 0) return;
      if (s.i === 0) {
        if (ist[1].p || ist[1].stop < 1 || araliktaKayan(P1 + 0.001, P2)) return;
      } else {
        if (kaydirakMesgul()) return;
        kayH = s.p.ok ? KAY_W : -KAY_W;
        if (Math.abs(kayW - kayH) > 0.002) return;
      }
      s.stopH = 0;
      if (s.stop > 0) return;
      s.p.st = 'kay'; s.p.hiz = 0;
      s.gecen = s.p; s.p = null; s.faz = 'bos';
    }
  }

  // ---------------------------------------------------------------- HMI (Delta çerçeve, Arkoz kart üslubu)
  const FAZ_AD = { bos: 'boş', sik: 'sıkma', kilavuz: 'diş çekiyor', kontrol: 'sensör kontrol', birak: 'bırakıyor' };
  function hmiCiz(x, W, H, d) {
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, W, H);
    const mono = (sz, k = 600) => `${k} ${sz}px "JetBrains Mono", monospace`;
    const yaz = (s, px, py, f, renk = '#e6edf3', hiza = 'left') => { x.font = f; x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle'; x.fillText(s, px, py); };
    x.fillStyle = '#161b22'; x.fillRect(0, 0, W, 48);
    yaz('DİŞ AÇMA · 2× M4 OVALAMA', 16, 25, mono(19), '#c9d1d9');
    const renk = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' }[d.seviye];
    x.fillStyle = renk; x.beginPath(); x.arc(W - 120, 25, 7, 0, Math.PI * 2); x.fill();
    yaz(d.seviye === 'calisiyor' ? 'ÇALIŞIYOR' : d.seviye === 'alarm' ? 'ALARM' : d.seviye === 'uyari' ? 'UYARI' : 'HAZIR', W - 106, 25, mono(16), renk);
    const kw = (W - 36) / 2;
    uniteler.forEach((un, i) => {
      const x0 = 12 + i * (kw + 12), y0 = 60;
      x.strokeStyle = '#30363d'; x.lineWidth = 2; x.beginPath(); x.roundRect(x0, y0, kw, 196, 10); x.stroke();
      yaz(`ÜNİTE ${un.no}`, x0 + 14, y0 + 22, mono(15), '#8b949e');
      yaz(un.yaz, x0 + kw - 14, y0 + 22, mono(14), un.kirik ? '#f85149' : un.yaz === 'DİŞ ÇEKİYOR' ? '#f0883e' : '#8b949e', 'right');
      yaz('DEVİR', x0 + 14, y0 + 58, mono(13, 500), '#8b949e');
      yaz(`${un.rpm} RPM`, x0 + 14, y0 + 84, mono(26, 700));
      const t = un.k >= 0 ? un.tork : sonTepe[i];
      const bandda = t >= BAND[0] && t <= BAND[1];
      yaz(un.k >= 0 ? 'TORK' : 'SON TEPE TORK', x0 + 14, y0 + 120, mono(13, 500), '#8b949e');
      // çekerken canlı değer turuncu; bitince son tepe bant içiyse yeşil, dışıysa kırmızı
      yaz(`${fmt(t, 1)} N·m`, x0 + 14, y0 + 146, mono(26, 700), un.k >= 0 ? '#f0883e' : bandda ? '#3fb950' : t > 0.05 ? '#f85149' : '#e6edf3');
      // tork çubuğu + bant
      const bx = x0 + 14, bw = kw - 28, by = y0 + 172, sk = bw / 10;
      x.fillStyle = '#21262d'; x.fillRect(bx, by, bw, 10);
      x.fillStyle = 'rgba(63,185,80,.35)'; x.fillRect(bx + BAND[0] * sk, by, (BAND[1] - BAND[0]) * sk, 10);
      x.fillStyle = bandda ? '#3fb950' : '#f85149'; x.fillRect(bx, by + 3, Math.min(10, t) * sk, 4);
    });
    const hucre = [['ÇEVRİM', cevrimSay.toLocaleString('tr-TR')], ['GÜNLÜK', String(gunluk)], ['OK / NOK', `${ok} / ${nok}`], ['NOK %', fmt(nokYuzde(), 2)]];
    const hw = (W - 24) / 4;
    hucre.forEach(([k, v], i) => {
      const x0 = 12 + i * hw;
      x.strokeStyle = '#30363d'; x.strokeRect(x0, 268, hw - 6, 70);
      yaz(k, x0 + 10, 288, mono(12, 500), '#8b949e');
      yaz(v, x0 + 10, 318, mono(20, 700), i === 3 && nokYuzde() > 3 ? '#f85149' : '#e6edf3');
    });
    yaz(`P1: ${FAZ_AD[ist[0].faz]} · P2: ${FAZ_AD[ist[1].faz]} · Kaydırak: ${kayH > 0 ? 'OK' : 'NOK'}`, 14, 362, mono(14, 500), '#c9d1d9');
    yaz(`Son: ${sonSonuc}`, 14, 392, mono(14, 500), sonSonuc.startsWith('NOK') ? '#f85149' : '#3fb950');
  }

  const trend = new Trend([
    { ad: 'Ü1 tepe', renk: '#39c5cf' }, { ad: 'Ü2 tepe', renk: '#f2c200' },
    { ad: 'alt', renk: '#6e7681', kesik: true, kalin: 1 }, { ad: 'üst', renk: '#6e7681', kesik: true, kalin: 1 },
  ], { min: 0, max: 10, uzunluk: 240, periyot: 0.25 });
  const ekranZ = throttle(4);
  const dakikalik = () => {
    while (bitisler.length && zaman - bitisler[0] > 60) bitisler.shift();
    const pencere = Math.min(60, zaman);
    return pencere > 5 ? (bitisler.length * 60) / pencere : 0;
  };
  const nokYuzde = () => (gunluk ? (nok / gunluk) * 100 : 0);

  function icGorunumUygula() {
    panelMat.opacity = icGorunum ? 0.12 : 1;
    panelMat.depthWrite = !icGorunum;
    kesit.visible = icGorunum;
    onDonanim.visible = !icGorunum;
  }

  // ---------------------------------------------------------------- döngü
  function update(dt, t) {
    zaman += dt;
    const calis = durum === 'calisiyor';
    if (calis) {
      eskT = Math.max(0, eskT - dt);
      // magazini operatör doldurur; operatör gelemezse (ör. manuel test) 25 s sonra yedek dolum
      if (magN <= 0) { magBekle += dt; if (magBekle > 25) { magN = 36; magBekle = 0; } } else magBekle = 0;
      serbestBirak();
      for (const p of parcalar) parcaGuncelle(p, dt);
      for (const s of ist) istasyonGuncelle(s, dt);
      kayW = approach(kayW, kayH, dt * 0.6);
    }
    for (const un of uniteler) uniteGuncelle(un, dt);
    eskAnim = Math.max(0, eskAnim - dt * 3);
    esk.position.x = mx - 0.1 + Math.sin(eskAnim * Math.PI) * 0.03;
    magCiz();
    operatorGuncelle(dt, t);

    // pnömatik görseller
    for (const s of ist) {
      s.pim.position.y = lerp(-0.03, 0.012, s.stop);
      const pw = lerp(-0.075, -PW / 2 - 0.004, s.sik);
      s.pabuc.position.z = pw;
      s.mil.scale.z = Math.max(0.01, pw - 0.004 - -0.085);
    }
    kaySin = kayW / KL; kayCos = Math.sqrt(1 - kaySin * kaySin);
    kay.rotation.y = -Math.asin(kaySin);
    kayMil.scale.z = Math.max(0.01, 0.8 * kayW - 0.05 - -0.21);

    // kırmızı sensör: 2. konumda kontrol sırasında yanıp söner
    const kontrolde = calis && ist[1].faz === 'kontrol';
    sensorMat.emissiveIntensity = kontrolde ? 3 + Math.sin(t * 40) : 0.7;
    isinMat.opacity = kontrolde ? 0.32 : 0.05;

    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [sonTepe[0], sonTepe[1], BAND[0], BAND[1]]);
    if (ekranZ(dt)) ekran.ciz((x, W, H) => hmiCiz(x, W, H, d));
  }

  // ---------------------------------------------------------------- operatör durum makinesi
  function operatorGuncelle(dt, t) {
    let poz = 'yan', yH = 0;
    tHam.position.set(0, 1.0, 0.47); tHam.rotation.x = 0;
    if (durum !== 'acil') {
      opD.t += dt;
      const vardi = opD.yol.length === 0;
      const git = (f, n, bx, bz) => { opD.f = f; opD.t = 0; opGit(n.x, n.z, bx, bz); };
      const adim = (f) => { opD.f = f; opD.t = 0; };
      switch (opD.f) {
        case 'izle':
          if (magN <= 8) git('stoga', STOK_DUR, STOK.x, STOK.z);
          else if (ok - okKasaBas >= 38) git('palete', PAL_DUR, PAL.x, PAL.z);
          break;
        case 'stoga': if (vardi) adim('al_ham'); break;
        case 'al_ham':
          poz = 'on';
          if (opD.t > 0.7) { tHam.visible = true; git('basamaga', { x: BASAMAK.x, z: 1.0 }, BASAMAK.x, 0); }
          break;
        case 'basamaga':
          poz = 'tasi';
          if (vardi) { opD.f = 'cik'; opD.t = 0; opD.yol.push([BASAMAK.x, BASAMAK.z + 0.04]); opD.bx = mx; opD.bz = 0; }
          break;
        case 'cik':
          poz = 'tasi'; yH = BASAMAK.h;
          if (vardi) adim('bosalt');
          break;
        case 'bosalt': {
          poz = 'yukari'; yH = BASAMAK.h;
          const k = Math.min(1, opD.t / 0.5);
          tHam.position.set(0, lerp(1.0, 1.72, k), lerp(0.47, 0.42, k));
          tHam.rotation.x = k * (opD.t > 0.6 ? 1.05 : 0.3);
          if (opD.t > 1.1 && magN < 36) magN = 36;                      // parçalar huniden magazine
          if (opD.t > 1.6) { tHam.visible = false; opD.f = 'in'; opD.t = 0; opD.yol.push([BASAMAK.x, 1.0]); }
          break;
        }
        case 'in': if (vardi) git('izleye', IZLE, IZLE.bx, IZLE.bz); break;
        case 'palete': if (vardi) adim('bos_al'); break;
        case 'bos_al':
          poz = 'on';
          if (opD.t > 0.6) { tKasa.k.visible = true; tKasa.dolu.visible = false; git('kasaya', KASA_DUR, KASA_X, 0.14); }
          break;
        case 'kasaya': poz = 'tasi'; if (vardi) adim('degistir'); break;
        case 'degistir':
          poz = 'on';
          if (opD.t > 0.5 && !tKasa.dolu.visible) { okKasaBas = ok; kasayaKoy(kasaOK, 0); tKasa.dolu.visible = true; }
          if (opD.t > 1.0) git('palete2', PAL_DUR, PAL.x, PAL.z);
          break;
        case 'palete2': poz = 'tasi'; if (vardi) adim('dolu_birak'); break;
        case 'dolu_birak':
          poz = 'on';
          if (opD.t > 0.6) {
            tKasa.k.visible = false;
            doluSay = doluSay >= 3 ? 1 : doluSay + 1;                    // palet dolunca forklift alır (varsayım)
            doluCiz();
            git('izleye', IZLE, IZLE.bx, IZLE.bz);
          }
          break;
        case 'izleye': if (vardi) opD.f = 'izle'; break;
        default: break;
      }
      if (tHam.visible || tKasa.k.visible) poz = poz === 'yan' ? 'tasi' : poz;
    }
    // yol izleme
    let yuruyor = false, hedefYon = Math.atan2(opD.bx - opD.x, opD.bz - opD.z);
    if (opD.yol.length && durum !== 'acil') {
      const [hx, hz] = opD.yol[0];
      const ddx = hx - opD.x, ddz = hz - opD.z, dd = Math.hypot(ddx, ddz);
      if (dd < 0.02) { opD.x = hx; opD.z = hz; opD.yol.shift(); }
      else {
        const s = Math.min(dd, (opD.f === 'cik' || opD.f === 'in' ? 0.6 : 1.1) * dt) / dd;
        opD.x += ddx * s; opD.z += ddz * s; yuruyor = true;
        if (dd > 0.15 && opD.f !== 'cik' && opD.f !== 'in') hedefYon = Math.atan2(ddx, ddz);
      }
    }
    opD.y += (yH - opD.y) * (1 - Math.exp(-6 * dt));
    opD.yon += aciFark(hedefYon, opD.yon) * (1 - Math.exp(-7 * dt));
    op.poz(poz);
    const zip = op.yuru(t, yuruyor);
    op.group.position.set(opD.x, opD.y + zip, opD.z);
    op.group.rotation.y = opD.yon;
  }

  // Performans (lib.sabitle): hareket eden / görünürlüğü ya da opaklığı değişen nesneler + gizli
  // düğümler (altındaki görünür mesh'ler birleşirse görünür olur) + saydam mesh'ler birleştirilmez.
  const sabitHaric = () => {
    const h = [kabin, onDonanim, esk, kay, kayMil,
      ...uniteler.flatMap((u) => [u.sp, u.kivilcim]),
      ...ist.flatMap((s) => [s.pim, s.mil, s.pabuc]),
      ...parcalar.map((p) => p.g),
      ...doluYigin.map((y) => y.k), ...bosYigin.map((y) => y.dolu)];
    g.traverse((o) => { if (!o.visible || (o.isMesh && !Array.isArray(o.material) && o.material.transparent)) h.push(o); });
    return h;
  };

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'alarm') return { metin: alarmMetin, seviye: 'alarm' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    const kirik = uniteler.find((u) => u.kirik);
    if (kirik) return { metin: `ÜNİTE ${kirik.no} KILAVUZ KIRIK · NOK`, seviye: 'uyari' };
    if (magN <= 0) return { metin: 'MAGAZİN BOŞ · DOLDURULUYOR', seviye: 'uyari' };
    const aktif = uniteler.filter((u) => u.yaz === 'DİŞ ÇEKİYOR').map((u) => `Ü${u.no}`);
    return { metin: aktif.length ? `ÇALIŞIYOR · ${aktif.join('+')} DİŞ ÇEKİYOR` : 'ÇALIŞIYOR', seviye: 'calisiyor' };
  }

  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'kaydirici', metin: 'Çevrim hızı', min: 50, max: 200, adim: 10, birim: '%', get: () => hiz, set: (v) => (hiz = v) },
    { tip: 'anahtar', metin: 'İç görünüm (kesit)', get: () => icGorunum, set: (v) => { icGorunum = v; icGorunumUygula(); } },
    { tip: 'baslik', metin: 'Arıza enjeksiyonu' },
    { tip: 'anahtar', metin: 'Ünite 1 kılavuz kırık', get: () => uniteler[0].kirik, set: (v) => (uniteler[0].kirik = v) },
    { tip: 'anahtar', metin: 'Ünite 2 kılavuz kırık', get: () => uniteler[1].kirik, set: (v) => (uniteler[1].kirik = v) },
    { tip: 'kaydirici', metin: 'Rastgele deliksiz parça', min: 0, max: 20, adim: 0.5, birim: '%', get: () => deliksizOran, set: (v) => (deliksizOran = v) },
    { tip: 'kaydirici', metin: 'Rastgele tork sapması', min: 0, max: 20, adim: 0.5, birim: '%', get: () => rastOran, set: (v) => (rastOran = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'Sıradaki parça deliksiz', tik: () => { deliksizSiradaki = true; } },
      { metin: 'Sıkışma oluştur', tik: () => { sikismaIste = true; } },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Kılavuzları değiştir', tik: () => { uniteler.forEach((u) => (u.kirik = false)); artArdaNok = 0; } },
      { metin: 'Sayaçları sıfırla', tik: () => { gunluk = 0; ok = 0; nok = 0; okKasaBas = 0; kasayaKoy(kasaOK, 0); kasayaKoy(kasaNOK, 0); bitisler.length = 0; } },
      { metin: 'Magazini doldur', tik: () => { magN = 36; } },
    ] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if (durum !== 'acil' && durum !== 'alarm') return;
        for (const p of parcalar) if (p.st === 'sikisti') { p.st = 'yok'; p.g.visible = false; }   // sıkışan parça elle alındı
        artArdaNok = 0; durum = 'durdu';
      } },
    ] },
  ];

  // ---------------------------------------------------------------- açılış: iki konum da dolu, diş çekmeye hazır
  {
    const a = parcalar[0], b = parcalar[1];
    for (const [p, s] of [[a, ist[0]], [b, ist[1]]]) {
      parcaSifirla(p);
      p.st = 'tut'; p.u = s.P; p.v = PT / 2; p.w = 0; p.rz = 0; p.g.visible = true;
      s.p = p; s.faz = 'sik'; s.t = 0;
      p.g.position.set(p.u, p.v, 0);
    }
    b.dis[0] = true; b.tork[0] = 3.1; disAcildi(b, 0, true);
    sonTepe[0] = 3.1; sonTepe[1] = 3.3;
  }
  kasayaKoy(kasaOK, 34);
  kasayaKoy(kasaNOK, 6);
  icGorunumUygula();
  magCiz();

  return {
    id: 'disacma',
    ad: 'Diş Açma ve Ayıklama',
    altBaslik: '2 kılavuz ünitesi · yerçekimli oluk · OK/NOK',
    kisa: 'Yaklaşık 6 cm\'lik parça haznadan yer çekimiyle oluğa düşer; pnömatik stoper ve sıkma 1. konumda tutar, 1. ünite M4 diş çeker; parça 2. konuma kayar, 2. ünite ikinci deliği çeker. Tork ve sensör kontrolünden sonra pnömatik kaydırak parçayı OK ya da NOK kasasına bırakır.',
    proje: 'other-machines',
    ayakIzi: [3.8, 2.3],
    ayakIziMerkez: [-0.1, 0.15],
    kamera: { poz: [1.2, 2.65, 2.4], hedef: [0.0, 1.35, 0.0] },     // operatörün başı üstünden içeri bakar
    mekanizmalar: [
      'Magazin (hazne): parçalar üst üste; pnömatik eskapman en alttakini bırakır, parça yer çekimiyle 40° eğimli oluğa düşer',
      'Konum 1: stoper pimi yükselir, yan sıkma silindiri parçayı korkuluğa bastırır; Ünite 1 alttaki deliğe diş çeker',
      'Konum 2: aynı stoper + sıkma; Ünite 2 üstteki (hizalı) deliğe diş çeker; kırmızı ışıklı sensör kontrol eder',
      'Kılavuz üniteleri (Arkoz AR görünümü): hızlı yaklaşma → yavaş ilerleme + ileri dönüş (ovalama, turuncu parlama) → ters dönerek çıkış',
      'Pnömatik kaydırak: girişi oluğa hizalı kalır, çıkış ucu silindirle yana kayar (OK önde, NOK arkada); parça ucundan kasaya düşer',
      'İç görünüm anahtarı: kabin panelleri saydam / opak (makinede normalde içi görünmez)',
      'Operatör: magazin azalınca ham parça kasasını alıp basamağa çıkar ve huniye boşaltır; OK kasası dolunca paletten boş kasa getirip değiştirir; arada HMI\'yı izler',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: içeride 2 diş açma ünitesi; parça yukarıdan yer çekimiyle gelir, pnömatikler 1. konumda tutar, 1. diş açılır, bırakılır; 2. konuma düşer, 2. diş açılır; sonuç OK ise OK\'ye, değilse NOK\'a — ayırma pnömatik kaydırakla.',
      'ARKOZ (arkozmakine.com "AR810 · canlı simülasyon"): ünite görünüşü (kutu gövde, 3 delikli gömme kapak, nervürlü motor sütunu + disk kapak, mavi konnektör) ve hareket profili (bekle → hızlı yaklaşma → yavaş ilerleme ~4 tur → geri çıkış, turuncu temas parlaması); devir/tork/çevrim sayacı HMI\'ya taşındı. Geri çıkışta dönüş, girişteki tur sayısıyla eşitlendi (fiziksel olarak doğrusu).',
      'MKN-F06 / MKN-V10: kutu profil masa, Delta HMI\'lı pano + acil stop, X6/X20 valf adası ve mavi hortumlar, gümüş hava tankı, kırmızı ışıklı sensör.',
      'TAHMİN: oluk eğimi (40°), ünitelerin oluğa dik yerleşimi, yan sıkma, kaydırağın yana kayan plaka olması, M4 ovalama tork bandı (2.4–4.2 N·m), ~3.4 s/parça ritim. Parça okunur olsun diye 3× büyütüldü; kayma görsel olarak yavaşlatıldı.',
      'TAHMİN: magazin üstten basamakla elle doldurulur (huniye kasa boşaltma); OK kasası 40 parçada değiştirilir, dolu kasalar sağdaki palete konur; ham parça kasası solda yerde.',
    ],
    group: g,
    update,
    kontroller,
    sabitHaric,
    degerler: () => [
      ['Konum 1 / 2', `${FAZ_AD[ist[0].faz]} / ${FAZ_AD[ist[1].faz]}`],
      ['Ünite 1', `${uniteler[0].rpm} RPM · ${fmt(uniteler[0].k >= 0 ? uniteler[0].tork : sonTepe[0], 1)} N·m`],
      ['Ünite 2', `${uniteler[1].rpm} RPM · ${fmt(uniteler[1].k >= 0 ? uniteler[1].tork : sonTepe[1], 1)} N·m`],
      ['Son parça', sonSonuc],
      ['OK / NOK', `${ok} / ${nok}`],
      ['NOK oranı', `%${fmt(nokYuzde(), 2)}`],
      ['Günlük adet', String(gunluk)],
      ['Dakikadaki parça', fmt(dakikalik(), 1)],
      ['Magazin', `${magN} parça`],
      ['OK kasası', `${Math.min(40, ok - okKasaBas)} / 40`],
      ['Operatör', OP_AD[opD.f]],
    ],
    trend,
    durum: durumBilgi,
  };
}
