// js/machines/yikama.js — Klişe Yıkama Makinesi.
//
// Kaan'ın düzeltmesi (2026-10-23): makine "klişe yıkama makinesi". Klişe tek parça
// plaka (fleksografik baskı klişesi: ince fotopolimer plaka, üstünde kabartma baskı
// deseni ve mürekkep kalıntısı). İçeride BOYDAN BOYA GEZEN tek bir fırça var; fırçanın
// ÖNÜNDE ve ARKASINDA hem su hem hava verebilen nozzle barları: önce yıkama, sonra
// kurutma. Başında operatör: yıkama biter, kapağı açar, temiz klişeyi kaldırıp askıya
// asar, kirli raftan yenisini alıp yatağa serer, kapağı kapatır, BAŞLAT'a basar.
//
// HMI düzeni Kaan'ın galerisindeki FiTeknik/doka ekranlarından (MKN-F09–F11): KAPAK AÇIK!,
// atılan / toplam tur, yıkama / durulama / kurutma çevrim sayıları, BAŞLAT / DUR,
// hata lambası, fırça yukarı/aşağı, fırça grubu ileri/geri komutları.
//
// Görünüş Kaan'ın gönderdiği gerçek makine render'ından ("SOFT CLEANER", FiTeknik HMI'nın
// KAPAK AÇIK! ekranı): gri/antrasit uzun kabin, uçlarda camlı turuncu muhafazalar, ortada
// yıkama yatağı; kapak ORTADAN İKİYE ayrılıp uçlara kayan iki yarımdır (menteşe yok).
//
// Yerleşim (makine yereli, ön yüz +Z): kabin ortada, uzun eksen X; araba X boyunca gezer,
// boştayken sol muhafazanın içinde park eder. HMI sağ önde; solda kirli klişe rafı,
// sağda temiz klişe askısı.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, beam, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop,
    canvasTex, clamp, approach, damp, lerp, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const paslanmaz = M.paslanmaz;
  const beyaz = mat(0xeef0ee, { r: 0.45, m: 0.2, key: 'kl-beyaz' });

  // ---------------------------------------------------------------- ölçüler
  // Gerçek makine (Kaan'ın gönderdiği FiTeknik HMI render'ı, "SOFT CLEANER"): uzun
  // dikdörtgen kabin — üst yarı gri, alt yarı antrasit; iki kısa uçta turuncu muhafaza
  // blokları (üstlerinde içini gösteren koyu cam), ortada açık yıkama yatağı. Yatağı iki
  // yarım SÜRGÜLÜ kapak örter: ortadan ayrılıp uçlara, turuncu muhafazaların içine kayar.
  const W = 2.6, D = 1.3;          // kabin (X uzun eksen)
  const BH = 0.5;                  // alt (antrasit) gövde üstü
  const Y1 = 0.95;                 // orta bölüm / yatak kenarı
  const YM = 1.05;                 // turuncu muhafaza üstü
  const MX = 0.82;                 // orta bölüm yarı uzunluğu (muhafazalar |x| > MX)
  const ML = W / 2 - MX;           // muhafaza uzunluğu
  const BY = 0.62;                 // klişenin yattığı kızak seviyesi
  const T = 0.04;                  // duvar
  const PL = 1.2, PW = 0.8, PT = 0.004;   // klişe (uzun kenar X boyunca)
  const XR = 0.72;                 // yıkama stroku ±XR
  const PARK = -1.02;              // park: sol muhafazanın içi (koyu camdan görünür)
  const AMAX = W / 2 - 0.28;       // manuelde araba sınırı
  const BAR = 0.17;                // nozzle barlarının fırçaya uzaklığı (önde / arkada)
  const FR = 0.085, FL = 0.92;     // fırça yarıçapı, boyu (yatağın enine)
  const RZ = D / 2 - T - 0.03;     // araba rayları (ön / arka iç duvarda)
  const RY = Y1 - 0.06;

  const griUst = mat(0x8c9094, { r: 0.55, m: 0.25, key: 'kl-gri' });
  const antrasit = mat(0x4b4e53, { r: 0.6, m: 0.25, key: 'kl-antrasit' });
  const turuncu = mat(0xf08a1c, { r: 0.45, m: 0.2, key: 'kl-turuncu' });

  // ---------------------------------------------------------------- gövde
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.04, 0.05, M.siyah, sx * (W / 2 - 0.1), 0.025, sz * (D / 2 - 0.1), g, { seg: 12 }); // ayaklar
  box(W, BH - 0.05, D, antrasit, 0, 0.05 + (BH - 0.05) / 2, 0, g);                       // alt gövde
  const cep = mat(0x4fb3c9, { r: 0.5, m: 0.2, key: 'kl-cep' });                          // forklift cepleri
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const cx = sx * 0.62, cz = sz * (D / 2 + 0.006);
    box(0.34, 0.025, 0.012, cep, cx, 0.2, cz, g);
    box(0.34, 0.025, 0.012, cep, cx, 0.085, cz, g);
    box(0.025, 0.14, 0.012, cep, cx - 0.16, 0.142, cz, g);
    box(0.025, 0.14, 0.012, cep, cx + 0.16, 0.142, cz, g);
    box(0.3, 0.09, 0.008, M.siyah, cx, 0.142, cz, g);
  }
  // orta üst bölüm (gri ön / arka duvar) + tava dibi + yatak kenarında turuncu çıta
  for (const sz of [-1, 1]) box(2 * MX, Y1 - BH, T, griUst, 0, (BH + Y1) / 2, sz * (D / 2 - T / 2), g);
  box(W - 0.1, 0.02, D - 2 * T, mat(0x3d4247, { r: 0.6, m: 0.5, key: 'kl-dip' }), 0, BH + 0.01, 0, g);
  for (const sz of [-1, 1]) box(2 * MX, 0.018, 0.05, turuncu, 0, Y1 + 0.009, sz * (D / 2 - 0.025), g);
  // turuncu uç muhafazaları (kabuk; içi boş, park eden araba koyu camdan görünür)
  const camKoyu = new THREE.MeshStandardMaterial({ color: 0x10161b, transparent: true, opacity: 0.66, roughness: 0.06, metalness: 0.4, depthWrite: false });
  for (const sx of [-1, 1]) {
    const cx = sx * (MX + ML / 2);
    for (const sz of [-1, 1]) box(ML, YM - BH, 0.05, turuncu, cx, (BH + YM) / 2, sz * (D / 2 - 0.025), g);   // ön / arka
    box(0.05, YM - BH, D, turuncu, sx * (W / 2 - 0.025), (BH + YM) / 2, 0, g);                               // uç
    box(0.04, YM - (Y1 + 0.05), D, turuncu, sx * (MX + 0.02), (YM + Y1 + 0.05) / 2, 0, g);                 // iç kenar (kapak yarığının üstü)
    for (const sz of [-1, 1]) box(ML, 0.03, 0.16, turuncu, cx, YM - 0.015, sz * (D / 2 - 0.08), g);          // üst çerçeve
    for (const ex of [W / 2 - 0.04, MX + 0.04]) box(0.08, 0.03, D - 0.32, turuncu, sx * ex, YM - 0.015, 0, g);
    const cam = box(ML - 0.16, 0.012, D - 0.32, camKoyu, cx, YM - 0.02, 0, g);
    cam.castShadow = false;
    // köşe trimleri (2 mm dışarıda: alt gövde yüzeyiyle aynı düzlemde titreşmesin)
    for (const sz of [-1, 1]) box(0.06, BH - 0.05, 0.06, turuncu, sx * (W / 2 - 0.028), 0.05 + (BH - 0.05) / 2, sz * (D / 2 - 0.028), g);
  }
  const ad = levha(['SOFT CLEANER'], 0.42, 0.06, { bg: '#8c9094', fg: '#6b1d10', font: 66, px: 600 });
  ad.position.set(-0.52, 0.8, D / 2 + 0.003);
  g.add(ad);
  // drenaj ızgarası + klişe kızakları (yatak)
  const izgaraTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#5c646b'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#a9b1b8'; x.lineWidth = 6;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, h); x.stroke(); }
    x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 16); x.lineTo(w, i * 16); x.stroke(); }
  }, { tekrar: [(2 * MX - 0.04) / 0.06, (D - 0.12) / 0.06] });
  const izgara = new THREE.Mesh(new THREE.PlaneGeometry(2 * MX - 0.04, D - 0.12), new THREE.MeshStandardMaterial({ map: izgaraTex, roughness: 0.5, metalness: 0.6 }));
  izgara.rotation.x = -Math.PI / 2;
  izgara.position.set(0, BY - 0.025, 0);                  // klişe ızgara üstündeki kızaklara yatar
  izgara.receiveShadow = true;
  g.add(izgara);
  for (let i = -3; i <= 3; i++) box(2 * MX - 0.1, 0.024, 0.025, mat(0x8a9198, { r: 0.4, m: 0.7, key: 'kl-kizak' }), 0, BY - 0.012, i * 0.17, g);
  for (const sx of [-0.6, 0.6]) for (const sz of [-1, 1]) box(0.04, BY - BH - 0.045, 0.04, M.koyu, sx, (BH + 0.02 + BY - 0.025) / 2, sz * 0.5, g);
  // araba rayları (ön / arka iç duvarda, muhafazaların içine kadar)
  for (const sz of [-1, 1]) {
    box(W - 0.12, 0.03, 0.04, paslanmaz, 0, RY, sz * (RZ + 0.03), g);
    box(W - 0.14, 0.02, 0.02, M.krom, 0, RY + 0.025, sz * (RZ + 0.03), g);
  }

  // ---------------------------------------------------------------- araba (gantry) + fırça + nozzle barları
  const araba = new THREE.Group();
  g.add(araba);
  for (const sz of [-1, 1]) box(0.2, 0.06, 0.06, M.koyu, 0, RY + 0.05, sz * (RZ + 0.03), araba);   // kızaklar
  box(0.12, 0.045, 2 * RZ + 0.06, paslanmaz, 0, RY + 0.035, 0, araba);                          // köprü kirişi
  box(0.12, 0.1, 0.1, M.mavi, 0.1, RY - 0.02, RZ - 0.03, araba);                                 // fırça motoru
  // pnömatik fırça kaldırma silindirleri (köprüden aşağı)
  const SILZ = 0.5;
  for (const sz of [-1, 1]) cyl(0.024, 0.06, M.alu, 0, RY - 0.017, sz * SILZ, araba, { seg: 14 });
  const milGeo = new THREE.CylinderGeometry(0.01, 0.01, 1, 10);
  milGeo.translate(0, -0.5, 0);
  const SILALT = RY - 0.047;
  const miller = [-1, 1].map((sz) => {
    const m = new THREE.Mesh(milGeo, M.krom);
    m.position.set(0, SILALT, sz * SILZ);
    m.castShadow = true;
    araba.add(m);
    return m;
  });
  // fırça grubu: yükselir / alçalır; içinde dönen fırça
  const firca = new THREE.Group();
  araba.add(firca);
  for (const sz of [-1, 1]) box(0.05, 0.1, 0.025, paslanmaz, 0, 0.025, sz * (FL / 2 + 0.03), firca);   // yan plakalar
  box(0.05, 0.02, FL + 0.08, paslanmaz, 0, 0.08, 0, firca);                                          // üst bağ
  const fircaTex = canvasTex(64, 128, (x, w, h) => {
    x.fillStyle = '#26303d'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = Math.random() < 0.5 ? '#3f5168' : '#151b24';
      x.fillRect(Math.random() * w, Math.random() * h, 1.5, 6);
    }
    x.fillStyle = 'rgba(120,150,190,.35)';
    for (let i = 0; i < 8; i++) x.fillRect(0, i * 16, w, 4);
  }, { tekrar: [1, 6] });
  const donen = new THREE.Group();
  firca.add(donen);
  cyl(FR, FL, new THREE.MeshStandardMaterial({ map: fircaTex, roughness: 0.95 }), 0, 0, 0, donen, { eksen: 'z', seg: 24 });
  cyl(0.03, FL + 0.06, M.celik, 0, 0, 0, donen, { eksen: 'z', seg: 10 });
  for (const sz of [-1, 1]) cyl(FR * 0.7, 0.02, M.koyu, 0, 0, sz * (FL / 2 + 0.005), donen, { eksen: 'z', seg: 18 });
  // nozzle barları (önde + arkada) — su + hava manifoldu
  const NN = 12;
  const nozGeo = new THREE.ConeGeometry(0.011, 0.035, 8);
  nozGeo.rotateX(Math.PI);
  const nozzle = new THREE.InstancedMesh(nozGeo, M.siyah, 2 * NN);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let k = 0;
    for (const bx of [-BAR, BAR]) for (let i = 0; i < NN; i++) nozzle.setMatrixAt(k++, m4.compose(p.set(bx, BY + 0.155, -0.44 + (i * 0.88) / (NN - 1)), q, s));
  }
  nozzle.castShadow = true;
  araba.add(nozzle);
  for (const bx of [-BAR, BAR]) {
    rod([bx, BY + 0.18, -0.5], [bx, BY + 0.18, 0.5], 0.016, M.krom, araba);              // su borusu
    rod([bx + Math.sign(bx) * 0.03, BY + 0.2, -0.5], [bx + Math.sign(bx) * 0.03, BY + 0.2, 0.5], 0.01, mat(0xd9dfe4, { r: 0.3, m: 0.6, key: 'kl-hava' }), araba); // hava hattı
    for (const sz of [-1, 1]) beam([0, RY + 0.02, sz * 0.47], [bx, BY + 0.19, sz * 0.47], 0.02, 0.02, paslanmaz, araba);
  }
  // püskürtme yelpazeleri (su: mavi, hava: beyazımsı) — barın altında dikey yarı saydam perde
  const yelpazeTex = canvasTex(16, 64, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0.15)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 4; i++) x.fillRect(i * 4 + 1, 0, 1, h);
  }, { tekrar: [12, 1] });
  const yelpazeMat = new THREE.MeshBasicMaterial({ map: yelpazeTex, color: 0x7cc8ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const yelpazeler = [-BAR, BAR].map((bx) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.15), yelpazeMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(bx, BY + 0.075, 0);
    m.visible = false;
    araba.add(m);
    return m;
  });

  // ---------------------------------------------------------------- sürgülü kapak: iki yarım, her yarı 2 teleskopik panel
  // Kapalı: yarılar ortada birleşir. Açılırken ortadan ayrılır, iç panel (A, tutamaklı)
  // dış panelin (B) üstünden kayar; ikisi de uçtaki turuncu muhafazanın içine girer.
  const kapakMat = new THREE.MeshStandardMaterial({ color: 0x6f767c, transparent: true, opacity: 0.62, roughness: 0.22, metalness: 0.2, depthWrite: false });
  const PANEL = MX / 2 + 0.02;
  const kapakYarilar = [-1, 1].map((sx) => {
    const A = new THREE.Group(), B = new THREE.Group();
    A.position.y = Y1 + 0.034; B.position.y = Y1 + 0.018;
    g.add(A); g.add(B);
    for (const p of [A, B]) {
      box(PANEL, 0.01, D - 0.12, kapakMat, 0, 0, 0, p);
      for (const sz of [-1, 1]) box(PANEL, 0.016, 0.025, M.gri, 0, 0, sz * (D / 2 - 0.07), p);   // kenar profilleri
    }
    box(0.022, 0.1, 0.03, M.siyah, -sx * (PANEL / 2 - 0.012), 0.055, D / 2 - 0.2, A);           // dikey tutamaklar (iç kenar)
    box(0.022, 0.1, 0.03, M.siyah, -sx * (PANEL / 2 - 0.012), 0.055, -D / 2 + 0.2, A);
    return { sx, A, B };
  });
  function kapakYerlestir(k) {
    for (const { sx, A, B } of kapakYarilar) {
      A.position.x = sx * lerp(PANEL / 2, MX + PANEL / 2 - 0.03, k);
      B.position.x = sx * lerp(1.5 * PANEL - 0.03, MX + 0.02 + PANEL / 2, Math.min(1, k * 1.6));
    }
  }
  kapakYerlestir(0);

  // ---------------------------------------------------------------- HMI paneli (sağ önde, dışarı çıkıntılı) + acil stop
  const HX = MX + ML / 2, HY = 0.86, HZ = D / 2 + 0.12;
  box(0.06, 0.08, 0.12, M.gri, HX, HY - 0.16, D / 2 + 0.06, g);                               // taşıyıcı kol
  const hmiKutu = new THREE.Group();
  hmiKutu.position.set(HX, HY, HZ);
  hmiKutu.rotation.x = -0.12;
  g.add(hmiKutu);
  box(0.4, 0.27, 0.07, mat(0xa4aab0, { r: 0.45, m: 0.3, key: 'kl-hmi' }), 0, 0, 0, hmiKutu);
  box(0.35, 0.22, 0.01, M.siyah, 0, 0, 0.036, hmiKutu);
  const ekran = new Ekran(0.33, 0.2, 720);
  ekran.mesh.position.set(0, 0, 0.042);
  hmiKutu.add(ekran.mesh);
  acilStop(g, HX + 0.25, HY + 0.1, D / 2 + 0.04, 0);
  const startLed = lamba(0x2ea043, 0.4);
  cyl(0.022, 0.02, startLed, HX + 0.25, HY - 0.03, D / 2 + 0.01, g, { eksen: 'z', seg: 16 });
  const kapakSensor = lamba(0x2ea043, 1.2);
  box(0.04, 0.03, 0.03, kapakSensor, MX + 0.06, YM + 0.015, D / 2 - 0.05, g);
  const isiticiLed = lamba(0xff6a10, 0);
  box(0.05, 0.03, 0.01, isiticiLed, HX, 0.4, D / 2 + 0.005, g);
  const kule = kuleLambasi(g, W / 2 - 0.12, YM, -D / 2 + 0.12);

  // ---------------------------------------------------------------- klişe dokuları
  // Desen: fotopolimer zemin + kabartma (aynalı yazı, barkod, logo, register işaretleri)
  function desenCiz(x, w, h, renk, golge) {
    const kabart = (fn) => {
      if (golge) { x.save(); x.translate(2, 2); x.fillStyle = golge; x.strokeStyle = golge; fn(); x.restore(); }
      x.fillStyle = renk; x.strokeStyle = renk; fn();
    };
    x.save(); x.translate(w, 0); x.scale(-1, 1);                 // klişede yazılar aynalı
    kabart(() => { lib.dokaLogo(x, w / 2, h * 0.2, h * 0.2, x.fillStyle); x.textBaseline = 'middle'; });   // resmi doka logosu (kabartma rengiyle)
    kabart(() => { x.font = `600 ${Math.round(h * 0.06)}px "Space Grotesk", sans-serif`; x.textAlign = 'left'; x.fillText('Net 500 g · Son kul. 12/2027', w * 0.08, h * 0.88); });
    kabart(() => { x.lineWidth = h * 0.03; x.beginPath(); x.arc(w * 0.76, h * 0.56, h * 0.15, 0, Math.PI * 2); x.stroke();
      x.font = `800 ${Math.round(h * 0.1)}px "Space Grotesk", sans-serif`; x.textAlign = 'center'; x.fillText('%100', w * 0.76, h * 0.57); });
    x.restore();
    kabart(() => {                                            // barkod
      let bx = w * 0.08;
      const r = [3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 2, 1, 3, 1, 2];
      r.forEach((k, i) => { if (i % 2 === 0) x.fillRect(bx, h * 0.38, k * 3, h * 0.36); bx += k * 3 + 2; });
    });
    kabart(() => {                                            // register (hizalama) işaretleri
      x.lineWidth = 2;
      for (const [cx, cy] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) {
        x.beginPath(); x.arc(cx, cy, 6, 0, Math.PI * 2); x.moveTo(cx - 11, cy); x.lineTo(cx + 11, cy); x.moveTo(cx, cy - 11); x.lineTo(cx, cy + 11); x.stroke();
      }
    });
  }
  const CW = 384, CH = 256;
  const desenTex = canvasTex(CW, CH, (x, w, h) => {
    x.fillStyle = '#2d6a5f'; x.fillRect(0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 10; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    x.putImageData(id, 0, 0);
    desenCiz(x, w, h, '#78c3ad', '#173d35');
  });
  const MUREKKEP = ['#0a9fd4', '#c8107a', '#1b1b1f', '#c9a400'];
  function kirCiz(x, w, h, renk) {
    x.clearRect(0, 0, w, h);
    x.globalAlpha = 0.88;
    desenCiz(x, w, h, renk, null);                             // mürekkep kabartma yüzeylerde kalır
    for (let i = 0; i < 28; i++) {                             // lekeler + sıçramalar
      x.globalAlpha = 0.18 + Math.random() * 0.35;
      x.fillStyle = Math.random() < 0.8 ? renk : '#3a3530';
      x.beginPath();
      x.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 40, 5 + Math.random() * 22, Math.random() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 0.6;
    for (let i = 0; i < 260; i++) { x.fillStyle = renk; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.globalAlpha = 1;
  }
  // aktif klişenin kir katmanı (dinamik: fırça geçtikçe silinir)
  const kirCanvas = document.createElement('canvas');
  kirCanvas.width = CW; kirCanvas.height = CH;
  const kirCtx = kirCanvas.getContext('2d');
  const kirTex = new THREE.CanvasTexture(kirCanvas);
  kirTex.colorSpace = THREE.SRGBColorSpace;
  // ıslaklık maskesi (alphaMap; sütun başına 1 piksel)
  const COLS = 96;
  const islakCanvas = document.createElement('canvas');
  islakCanvas.width = COLS; islakCanvas.height = 2;
  const islakCtx = islakCanvas.getContext('2d');
  const islakTex = new THREE.CanvasTexture(islakCanvas);
  const kir = new Float32Array(COLS), islak = new Float32Array(COLS);
  let kirDegisti = true, islakDegisti = true, murekkepNo = 1;
  function kirSifirla() {
    kirCiz(kirCtx, CW, CH, MUREKKEP[murekkepNo++ % MUREKKEP.length]);
    kir.fill(1); islak.fill(0);
    kirDegisti = islakDegisti = true;
  }
  // raftaki kirli klişeler için sabit (desen + kir) doku
  const rafKirTex = canvasTex(CW, CH, (x, w, h) => {
    x.drawImage(desenTex.image, 0, 0);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    kirCiz(c.getContext('2d'), w, h, MUREKKEP[1]);
    x.drawImage(c, 0, 0);
  });

  const plakaGeo = new THREE.BoxGeometry(PL, PT, PW);
  const plakaGovdeMat = mat(0x24574e, { r: 0.6, m: 0.05, key: 'kl-plaka' });
  const ustGeo = new THREE.PlaneGeometry(PL, PW);
  const katmanMat = (opts, sira) => new THREE.MeshStandardMaterial({
    ...opts, polygonOffset: true, polygonOffsetFactor: -sira, polygonOffsetUnits: -sira,
  });
  const desenMat = katmanMat({ map: desenTex, roughness: 0.55, metalness: 0.05 }, 1);
  const rafKirMat = katmanMat({ map: rafKirTex, roughness: 0.6, metalness: 0.05 }, 1);
  const kirMat = katmanMat({ map: kirTex, transparent: true, roughness: 0.7, depthWrite: false }, 2);
  const islakMat = katmanMat({ color: 0x8fc9ea, alphaMap: islakTex, transparent: true, opacity: 0.3, roughness: 0.03, metalness: 0.0, depthWrite: false }, 3);
  function plakaKur(parent, ustMat, ekstra = []) {
    const grp = new THREE.Group();
    const govde = new THREE.Mesh(plakaGeo, plakaGovdeMat);
    govde.castShadow = true; govde.receiveShadow = true;
    grp.add(govde);
    [ustMat, ...ekstra].forEach((m, i) => {
      const u = new THREE.Mesh(ustGeo, m);
      u.rotation.x = -Math.PI / 2;
      u.position.y = PT / 2 + 0.0004 * (i + 1);
      u.receiveShadow = true;
      grp.add(u);
    });
    parent.add(grp);
    return grp;
  }
  const plaka = plakaKur(g, desenMat, [kirMat, islakMat]);   // aktif klişe

  // ---------------------------------------------------------------- raflar
  const RK = { x: -3.05, z: 0.1 }, RT = { x: 3.05, z: 0.0 };
  const RAFN = 6;
  const rafY = (i) => 0.22 + i * 0.17;
  // kirli klişe rafı: yatay katlar
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 1.25, 0.04, M.koyu, RK.x + sx * 0.66, 0.625, RK.z + sz * 0.45, g);
  for (let i = 0; i < RAFN; i++) for (const sz of [-1, 1]) box(1.34, 0.02, 0.03, M.gri, RK.x, rafY(i) - 0.012, RK.z + sz * 0.42, g);
  const kirliLv = levha(['KİRLİ KLİŞE'], 0.7, 0.12, { bg: '#b3261e', fg: '#fff', font: 64, px: 512 });
  kirliLv.position.set(RK.x, 1.32, RK.z + 0.46);
  g.add(kirliLv);
  const kirliRaf = [];
  for (let i = 0; i < RAFN; i++) {
    const p = plakaKur(g, rafKirMat);
    p.position.set(RK.x, rafY(i), RK.z);
    p.rotation.set(0, Math.PI, 0, 'YXZ');
    kirliRaf.push(p);
  }
  // temiz klişe askısı: dikey askı (klişeler Z boyunca sıralı asılı)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 1.9, 0.05, M.koyu, RT.x + sx * 0.7, 0.95, RT.z + sz * 0.36, g);
  for (const sx of [-1, 1]) box(0.04, 0.04, 0.78, paslanmaz, RT.x + sx * 0.62, 1.82, RT.z, g);
  for (const sz of [-1, 1]) box(1.44, 0.05, 0.05, M.koyu, RT.x, 1.88, RT.z + sz * 0.36, g);
  const temizLv = levha(['TEMİZ KLİŞE · KURUMA'], 0.9, 0.12, { bg: '#2e7d32', fg: '#fff', font: 56, px: 640 });
  temizLv.position.set(RT.x, 2.0, RT.z + 0.39);
  g.add(temizLv);
  const askiZ = (i) => RT.z - 0.25 + i * 0.1;
  const temizRaf = [];
  for (let i = 0; i < RAFN; i++) {
    const p = plakaKur(g, desenMat);
    p.position.set(RT.x, 1.39, askiZ(i));
    p.rotation.set(Math.PI / 2, Math.PI, 0, 'YXZ');
    for (const sx of [-1, 1]) box(0.03, 0.02, 0.05, M.sari, sx * 0.45, 0, -0.4, p);       // askı klipsleri (üst kenar)
    temizRaf.push(p);
  }

  // ---------------------------------------------------------------- operatör
  const op = { x: W / 2 + 0.3, z: D / 2 + 0.55, yaw: Math.PI, kol: 0, adimlar: [], yuruyor: false, metin: 'bekliyor', bakisT: 0 };
  // ortak lib.operator modeli (FK-1000 sahnesindeki operatör); yüz +Z, poz opGuncelle'de
  const opModel = lib.operator({ yelek: 0xffd400 });
  const isci = opModel.group;
  g.add(isci);

  // ---------------------------------------------------------------- klişe pozları (makine çerçevesi)
  const P = () => ({ x: 0, y: 0, z: 0, yaw: 0, tilt: 0 });
  const _poz = P(), _bas = P(), _hed = P(), _cur = P();
  let plakaYer = 'yatak';          // yatak | el | gecis | yok
  const yatakPoz = (o) => Object.assign(o, { x: 0, y: BY + PT / 2, z: 0, yaw: Math.PI, tilt: 0 });
  // elde taşıma: 'tasi' pozunda eller ~1.0 m yükseklikte, gövdenin ~0.5 m önünde buluşur
  const elPoz = (o) => Object.assign(o, { x: op.x + Math.sin(op.yaw) * 0.62, y: 1.03, z: op.z + Math.cos(op.yaw) * 0.62, yaw: op.yaw, tilt: 0 });
  const kirliPoz = (o, i) => Object.assign(o, { x: RK.x, y: rafY(i), z: RK.z, yaw: Math.PI, tilt: 0 });
  const temizPoz = (o, i) => Object.assign(o, { x: RT.x, y: 1.39, z: askiZ(i), yaw: Math.PI, tilt: Math.PI / 2 });
  const kopya = (d, s) => Object.assign(d, s);
  function pozLerp(o, a, b, k) {
    o.x = lerp(a.x, b.x, k); o.z = lerp(a.z, b.z, k);
    o.y = lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 0.12;
    let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    o.yaw = a.yaw + dy * k; o.tilt = lerp(a.tilt, b.tilt, k);
    return o;
  }
  function plakaUygula(p) {
    kopya(_cur, p);
    plaka.position.set(p.x, p.y, p.z);
    plaka.rotation.set(p.tilt, p.yaw, 0, 'YXZ');
  }

  // ---------------------------------------------------------------- durum
  let mod = 'oto';            // oto | man
  let durum = 'calisiyor';    // calisiyor | durdu | acil | kapak
  let faz = 'yikama';         // hazir | yikama | durulama | kurutma | bitti
  let fazT = 0, fazTur = 0, atilanTur = 0, toplamTur = 1268;
  let yikamaTur = 3, durulamaTur = 1, kurutmaTur = 2;
  let basinc = 70, devir = 240, arabaHiz = 0.45;
  let ax = -XR, axYon = 1, yarim = false;     // park: PARK (sol muhafaza içi)
  let firY = 0, firHiz = 0;
  let kapakAcik = false, kapakK = 0;           // kapakK: 0 kapalı (yarılar ortada) .. 1 açık (uçlarda)
  let sanalOp = true;
  let kirliSay = 5, temizSay = 2, yikanan = 37;
  let suBasinc = 0, havaBasinc = 6.2, suSic = 41, isitici = false;
  let uyariMetin = '', uyariT = 0;
  const jog = { x: 0, y: 0, su: false, hava: false };
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };
  const calisan = () => faz === 'yikama' || faz === 'durulama' || faz === 'kurutma';
  const gec = (f) => { faz = f; fazT = 0; fazTur = 0; };
  const fazHedefTur = () => (faz === 'yikama' ? yikamaTur : faz === 'durulama' ? durulamaTur : kurutmaTur);
  const ilkFaz = () => (yikamaTur ? 'yikama' : durulamaTur ? 'durulama' : kurutmaTur ? 'kurutma' : 'bitti');

  function baslat() {
    if (kapakK > 0.02) { uyar('KAPAK AÇIK!'); return; }
    if (plakaYer !== 'yatak') { uyar('YATAKTA KLİŞE YOK'); return; }
    if (mod !== 'oto') { uyar('OTOMATİK MODDA BAŞLAT'); return; }
    if (calisan()) { if (durum === 'durdu') durum = 'calisiyor'; return; }
    if (durum === 'acil') return;
    durum = 'calisiyor';
    atilanTur = 0;
    gec(ilkFaz());
  }

  // ---------------------------------------------------------------- program (araba turları)
  function arabaSur(dt) {
    ax += axYon * arabaHiz * dt;
    if (ax > XR) { ax = XR; axYon = -1; yarim = true; }
    else if (ax < -XR) {
      ax = -XR; axYon = 1;
      if (yarim) { yarim = false; turBitti(); }
    }
  }
  function turBitti() {
    atilanTur++; fazTur++; toplamTur++;
    if (fazTur < fazHedefTur()) return;
    if (faz === 'yikama') gec(durulamaTur ? 'durulama' : kurutmaTur ? 'kurutma' : 'bitti');
    else if (faz === 'durulama') gec(kurutmaTur ? 'kurutma' : 'bitti');
    else gec('bitti');
    if (faz === 'bitti') yikanan++;
  }
  function otoCevrim(dt) {
    fazT += dt;
    if (!calisan()) {                                            // hazır / bitti: fırça yukarı, araba park
      firY = approach(firY, 0, 1.5 * dt);
      ax = approach(ax, PARK, arabaHiz * dt); axYon = 1; yarim = false;
      return;
    }
    const hedef = faz === 'yikama' ? 1 : 0;
    firY = approach(firY, hedef, 1.5 * dt);
    if (Math.abs(firY - hedef) < 0.01) arabaSur(dt);
  }
  function manuelSur(dt) {
    if (jog.x) ax = clamp(ax + jog.x * arabaHiz * dt, -AMAX, AMAX);
    if (jog.y) firY = clamp(firY + jog.y * 1.2 * dt, 0, 1);
  }

  // ---------------------------------------------------------------- temizleme / ıslatma / kurutma (sütun bazlı)
  // Klişe yatakta 180° döndürülmüş durur → makine x'i klişe yerelinde -x.
  function sutunAraligi(x0, x1) {
    const l0 = clamp(-x1, -PL / 2, PL / 2), l1 = clamp(-x0, -PL / 2, PL / 2);
    if (l1 <= l0) return null;
    return [Math.floor(((l0 + PL / 2) / PL) * COLS), Math.min(COLS - 1, Math.ceil(((l1 + PL / 2) / PL) * COLS) - 1)];
  }
  function temizle(x0, x1, k, dt) {
    const r = sutunAraligi(x0, x1);
    if (!r) return;
    const f = Math.exp(-k * dt);
    for (let i = r[0]; i <= r[1]; i++) kir[i] *= f;
    kirCtx.globalCompositeOperation = 'destination-out';
    kirCtx.globalAlpha = 1 - f;
    const px0 = (r[0] / COLS) * CW, px1 = ((r[1] + 1) / COLS) * CW;
    kirCtx.fillRect(px0, 0, px1 - px0, CH);
    kirCtx.globalCompositeOperation = 'source-over';
    kirCtx.globalAlpha = 1;
    kirDegisti = true;
  }
  function islat(x0, x1, hedef, k, dt) {
    const r = sutunAraligi(x0, x1);
    if (!r) return;
    for (let i = r[0]; i <= r[1]; i++) islak[i] = damp(islak[i], hedef, k, dt);
    islakDegisti = true;
  }
  let temizlik = 0;
  const islakZ = throttle(15), kirZ = throttle(20);

  // ---------------------------------------------------------------- püskürtme parçacıkları
  const PCN = 320;
  const pPos = new Float32Array(PCN * 3).fill(-10), pHiz = new Float32Array(PCN * 3), pOmur = new Float32Array(PCN);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x7cc8ff, size: 0.02, transparent: true, opacity: 0.85, depthWrite: false });
  const parcacik = new THREE.Points(pGeo, pMat);
  parcacik.frustumCulled = false;
  g.add(parcacik);
  let pSira = 0;
  function parcacikGuncelle(dt, tur) {
    if (tur) {
      const hava = tur === 'hava';
      const n = Math.ceil(dt * (hava ? 220 : 340));
      for (let i = 0; i < n; i++) {
        const j = pSira++ % PCN;
        const bx = (i % 2 ? BAR : -BAR) + gurultu(0.01);
        pPos[j * 3] = ax + bx; pPos[j * 3 + 1] = BY + 0.135; pPos[j * 3 + 2] = gurultu(0.44);
        pHiz[j * 3] = Math.sign(bx) * (hava ? 0.6 : 0.25) + gurultu(0.15);
        pHiz[j * 3 + 1] = hava ? -3.2 : -1.6 - Math.random() * 0.8;
        pHiz[j * 3 + 2] = gurultu(hava ? 0.3 : 0.2);
        pOmur[j] = hava ? 0.18 : 0.28 + Math.random() * 0.12;
      }
    }
    const zemin = BY + PT;
    for (let j = 0; j < PCN; j++) {
      if (pOmur[j] <= 0) continue;
      pOmur[j] -= dt;
      pPos[j * 3] += pHiz[j * 3] * dt; pPos[j * 3 + 1] += pHiz[j * 3 + 1] * dt; pPos[j * 3 + 2] += pHiz[j * 3 + 2] * dt;
      if (pPos[j * 3 + 1] < zemin) {                             // klişeye çarpınca yana sıçrar
        pPos[j * 3 + 1] = zemin;
        pHiz[j * 3 + 1] *= -0.15;
        pHiz[j * 3] *= 3; pHiz[j * 3 + 2] *= 3;
      }
      if (pOmur[j] <= 0) pPos[j * 3 + 1] = -10;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------- sanal operatör
  // Adım: {tip:'yuru', x, z, son} | {tip:'is', sure, yon?, metin, basla?, guncelle?(k), bit?} | {tip:'bekle', kosul, metin}
  const N = {
    on: { x: 0, z: D / 2 + 0.45, yon: Math.PI },
    bekle: { x: W / 2 + 0.3, z: D / 2 + 0.55, yon: Math.PI },
    panel: { x: HX, z: D / 2 + 0.62, yon: Math.PI },
    kirli: { x: RK.x, z: RK.z + 0.98, yon: Math.PI },
    temiz: { x: RT.x, z: RT.z + 0.92, yon: Math.PI },
  };
  const yuru = (n) => ({ tip: 'yuru', x: n.x, z: n.z, son: n.yon });
  function gecisAdimi(metin, sure, hedefFn, sonYer, extra = {}) {
    return {
      tip: 'is', sure, yon: Math.PI, metin, el: true,
      basla: () => { extra.basla?.(); kopya(_bas, _cur); plakaYer = 'gecis'; },
      guncelle: (k) => { hedefFn(_hed); plakaUygula(pozLerp(_poz, _bas, _hed, easeInOut(k))); },
      bit: () => { plakaYer = sonYer; extra.bit?.(); },
    };
  }
  function opPlanla() {
    if (!sanalOp || mod !== 'oto') return;
    if (faz === 'bitti' && plakaYer === 'yatak' && durum === 'calisiyor') {
      gec('hazir');
      op.adimlar = [
        yuru(N.on),
        { tip: 'is', sure: 0.8, yon: Math.PI, metin: 'kapağı açıyor', el: true, basla: () => { kapakAcik = true; } },
        { tip: 'bekle', metin: 'kapak açılıyor', kosul: () => kapakK > 0.98 },
        gecisAdimi('temiz klişeyi kaldırıyor', 1.3, elPoz, 'el'),
        yuru(N.temiz),
        gecisAdimi('klişeyi kurumaya asıyor', 1.4, (o) => temizPoz(o, temizSay), 'yok', {
          basla: () => { if (temizSay >= RAFN) temizSay = 0; },
          bit: () => { temizSay++; },
        }),
        yuru(N.kirli),
        gecisAdimi('kirli klişeyi alıyor', 1.2, elPoz, 'el', {
          basla: () => {
            if (kirliSay <= 0) kirliSay = RAFN;                  // yeni parti
            kirliSay--;
            kirSifirla();
            kirliPoz(_cur, kirliSay);
          },
        }),
        yuru(N.on),
        gecisAdimi('klişeyi yatağa seriyor', 1.5, yatakPoz, 'yatak'),
        { tip: 'is', sure: 0.8, yon: Math.PI, metin: 'kapağı kapatıyor', el: true, basla: () => { kapakAcik = false; } },
        { tip: 'bekle', metin: 'kapak kapanıyor', kosul: () => kapakK < 0.02 },
        yuru(N.panel),
        { tip: 'is', sure: 0.6, yon: Math.PI, metin: 'BAŞLAT\'a basıyor', el: true, bit: baslat },
        yuru(N.bekle),
      ];
      return;
    }
    if (faz === 'hazir' && plakaYer === 'yatak' && kapakK < 0.02 && !kapakAcik && durum === 'calisiyor') {
      // program hazırda bekliyor (ör. manuelden dönüş): operatör BAŞLAT'a basar
      op.adimlar = [yuru(N.panel), { tip: 'is', sure: 0.6, yon: Math.PI, metin: 'BAŞLAT\'a basıyor', el: true, bit: baslat }, yuru(N.bekle)];
      return;
    }
    if (!op.adimlar.length && Math.hypot(op.x - N.bekle.x, op.z - N.bekle.z) > 0.05 && plakaYer === 'yatak') op.adimlar = [yuru(N.bekle)];
  }
  function opIptal() {
    op.adimlar = [];
    if (plakaYer === 'el' || plakaYer === 'gecis') { plakaYer = 'yatak'; }
  }
  function opGuncelle(dt, t) {
    if (!op.adimlar.length) opPlanla();
    const a = op.adimlar[0];
    op.yuruyor = false;
    // poz: klişe eldeyken 'tasi', askıya asarken 'yukari', kapak/klişe/panel işinde 'on', aksi 'yan'
    let poz = plakaYer === 'el' ? 'tasi' : 'yan';
    if (a) {
      if (a.tip === 'yuru') {
        const dx = a.x - op.x, dz = a.z - op.z, d = Math.hypot(dx, dz), adim = 1.2 * dt;
        if (d <= adim) { op.x = a.x; op.z = a.z; if (a.son != null) op.yaw = a.son; op.adimlar.shift(); }
        else { op.x += (dx / d) * adim; op.z += (dz / d) * adim; op.yaw = Math.atan2(dx, dz); op.yuruyor = true; }
        op.metin = plakaYer === 'el' ? 'klişeyi taşıyor' : 'yürüyor';
      } else if (a.tip === 'bekle') {
        op.metin = a.metin;
        if (a.kosul()) op.adimlar.shift();
      } else {
        if (!a._basladi) { a._basladi = true; a._t = 0; a.basla?.(); }
        a._t += dt;
        if (a.yon != null) op.yaw = a.yon;
        op.metin = a.metin;
        if (a.el) poz = /asıyor/.test(a.metin) ? 'yukari' : 'on';
        const k = Math.min(1, a._t / a.sure);
        a.guncelle?.(k);
        if (k >= 1) { op.adimlar.shift(); a.bit?.(); }
      }
    } else {
      // program sürerken başında bekler, ara sıra HMI'a bakar
      op.metin = calisan() ? 'yıkamayı izliyor' : sanalOp ? 'bekliyor' : 'kapalı (değişim sende)';
      op.bakisT += dt;
      const bak = calisan() && (op.bakisT % 9) > 6.5;
      const hedefYaw = bak ? Math.atan2(HX - op.x, HZ - op.z) : Math.PI;
      let fark = hedefYaw - op.yaw; fark = Math.atan2(Math.sin(fark), Math.cos(fark));
      op.yaw += fark * (1 - Math.exp(-4 * dt));
    }
    opModel.poz(poz);
    const zipla = opModel.yuru(t, op.yuruyor);
    isci.position.set(op.x, zipla, op.z);
    isci.rotation.y = op.yaw;
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'Araba konumu', renk: '#39c5cf' }, { ad: 'Temizlik', renk: '#2ea043' }], { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(4);

  function update(dt, t) {
    if (calisan() && kapakK > 0.02 && durum === 'calisiyor') durum = 'kapak';
    if (durum === 'calisiyor') { if (mod === 'oto') otoCevrim(dt); else manuelSur(dt); }
    uyariT = Math.max(0, uyariT - dt);

    // sürgülü kapak yarıları
    kapakK = approach(kapakK, kapakAcik ? 1 : 0, 0.8 * dt);
    kapakYerlestir(easeInOut(kapakK));
    kapakSensor.color.setHex(kapakK < 0.02 ? 0x2ea043 : 0xe5302a);
    kapakSensor.emissive.copy(kapakSensor.color);
    startLed.emissiveIntensity = durum === 'calisiyor' && calisan() ? 1.8 : 0.15;

    // fırça, araba, nozzle durumları
    const calis = durum === 'calisiyor';
    const temas = firY > 0.85;
    let su = false, hava = false, donmeli = false;
    if (calis && mod === 'oto' && calisan()) {
      su = (faz === 'yikama' && temas) || faz === 'durulama';
      hava = faz === 'kurutma';
      donmeli = faz === 'yikama' && firY > 0.5;
    } else if (calis && mod === 'man') {
      su = jog.su; hava = jog.hava; donmeli = firY > 0.5;
    }
    firHiz = damp(firHiz, donmeli ? (devir * 2 * Math.PI) / 60 : 0, 3, dt);
    donen.rotation.z -= firHiz * dt;
    araba.position.x = ax;
    const fircaMerkez = lerp(BY + PT + FR + 0.035, BY + PT + FR - 0.006 * (basinc / 70), firY);
    firca.position.y = fircaMerkez;
    for (const m of miller) m.scale.y = Math.max(0.005, SILALT - (fircaMerkez + 0.09));
    yelpazeler.forEach((y) => { y.visible = su || hava; });
    yelpazeMat.color.setHex(hava ? 0xf2fbff : 0x7cc8ff);
    yelpazeMat.opacity = hava ? 0.14 + Math.random() * 0.06 : 0.32;
    pMat.color.setHex(hava ? 0xeaf7ff : 0x7cc8ff);
    pMat.size = hava ? 0.012 : 0.02;
    pMat.opacity = hava ? 0.4 : 0.85;
    parcacikGuncelle(dt, su ? 'su' : hava ? 'hava' : null);

    // klişe üzerinde temizlik / ıslaklık
    if (plakaYer === 'yatak') {
      const basincKat = basinc / 70, devirKat = devir / 240;
      if (temas && Math.abs(firHiz) > 3) temizle(ax - 0.075, ax + 0.075, (su ? 0.95 : 0.3) * basincKat * (0.6 + 0.4 * devirKat), dt);
      for (const bx of [-BAR, BAR]) {
        if (su) { temizle(ax + bx - 0.04, ax + bx + 0.04, 0.12, dt); islat(ax + bx - 0.06, ax + bx + 0.06, 1, 8, dt); }
        if (hava) islat(ax + bx - 0.06, ax + bx + 0.06, 0, 5.5, dt);
      }
      if (temas && su) islat(ax - 0.09, ax + 0.09, 1, 6, dt);
    }
    let kt = 0;
    for (let i = 0; i < COLS; i++) { islak[i] *= Math.exp(-0.02 * dt); kt += kir[i]; }
    temizlik = 1 - kt / COLS;
    if (islakDegisti && islakZ(dt)) {
      for (let i = 0; i < COLS; i++) { const v = Math.round(clamp(islak[i], 0, 1) * 255); islakCtx.fillStyle = `rgb(${v},${v},${v})`; islakCtx.fillRect(i, 0, 1, 2); }
      islakTex.needsUpdate = true;
      islakDegisti = false;
    }
    if (kirDegisti && kirZ(dt)) { kirTex.needsUpdate = true; kirDegisti = false; }

    // pompa / hava / ısıtıcı
    suBasinc = damp(suBasinc, su ? 2.8 + (basinc / 100) * 0.8 + gurultu(0.04) : 0, 4, dt);
    havaBasinc = damp(havaBasinc, hava ? 5.5 + gurultu(0.05) : 6.2, 3, dt);
    if (suSic < 38) isitici = true; else if (suSic > 45) isitici = false;
    suSic += ((isitici ? 0.6 : 0) - (suSic - 20) * 0.008 - (su ? 0.05 : 0)) * dt;
    isiticiLed.emissiveIntensity = isitici ? 2 : 0;

    // operatör + klişe
    if (durum !== 'acil') opGuncelle(dt, t);
    plaka.visible = plakaYer !== 'yok';
    if (plakaYer === 'yatak') plakaUygula(yatakPoz(_poz));
    else if (plakaYer === 'el') plakaUygula(elPoz(_poz));
    kirliRaf.forEach((p, i) => { p.visible = i < kirliSay; });
    temizRaf.forEach((p, i) => { p.visible = i < temizSay; });

    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [((ax + XR) / (2 * XR)) * 100, temizlik * 100]);
    if (ekranZ(dt)) ekran.ciz((x, Wp, Hp) => hmiCiz(x, Wp, Hp, d, t));
  }

  // ---------------------------------------------------------------- HMI (FiTeknik ana ekranı düzeni)
  const FAZ_AD = { hazir: 'Klişe değişimi', yikama: 'Yıkama', durulama: 'Durulama', kurutma: 'Kurutma', bitti: 'Program bitti' };
  function hmiCiz(x, Wp, Hp, d, t) {
    x.fillStyle = '#fbfbfb'; x.fillRect(0, 0, Wp, Hp);
    const yaz = (s, px, py, size, renk = '#111', kalin = 700, hiza = 'center') => {
      x.fillStyle = renk; x.font = `${kalin} ${size}px "Space Grotesk", sans-serif`;
      x.textAlign = hiza; x.textBaseline = 'middle'; x.fillText(s, px, py);
    };
    // logolar + başlık
    x.fillStyle = '#ef7d00'; x.fillRect(12, 12, 40, 52);
    yaz('Fi', 32, 38, 30, '#fff', 800);
    yaz('TEKNİK', 60, 28, 18, '#ef7d00', 800, 'left'); yaz('TASARIM', 60, 50, 15, '#ef7d00', 700, 'left');
    x.fillStyle = '#151515'; x.fillRect(Wp - 150, 12, 138, 48);
    lib.dokaLogo(x, Wp - 81, 36, 36, '#fff');
    yaz('KLİŞE YIKAMA', Wp / 2 - 10, 24, 22, '#222', 800);
    // adım kutusu
    const adimRenk = { yikama: '#1f6fd6', durulama: '#39a0d8', kurutma: '#8a8f96', bitti: '#2ea043', hazir: '#ef7d00' }[faz];
    x.fillStyle = adimRenk; x.fillRect(Wp / 2 - 120, 40, 220, 34);
    yaz(mod === 'man' ? 'MANUEL' : (FAZ_AD[faz] || '').toLocaleUpperCase('tr'), Wp / 2 - 10, 58, 20, '#fff', 800);
    // makine şeması: yatak + klişe + araba
    const mx = 120, my = 100, mw = 380, mh = 150;
    x.fillStyle = '#d9dee2'; x.fillRect(mx, my, mw, mh);
    x.strokeStyle = '#555'; x.lineWidth = 3; x.strokeRect(mx, my, mw, mh);
    const kx = mx + mw * 0.12, kw = mw * 0.76, ky = my + 22, kh = mh - 44;
    x.fillStyle = '#2d6a5f'; x.fillRect(kx, ky, kw, kh);
    for (let i = 0; i < COLS; i++) {                                // kir (sütun bazlı) + ıslaklık
      const ci = COLS - 1 - i;                                     // klişe yatakta ters
      if (kir[ci] > 0.02) { x.fillStyle = `rgba(80,30,90,${(kir[ci] * 0.75).toFixed(2)})`; x.fillRect(kx + (i * kw) / COLS, ky, kw / COLS + 0.5, kh); }
      if (islak[ci] > 0.05) { x.fillStyle = `rgba(150,210,255,${(islak[ci] * 0.45).toFixed(2)})`; x.fillRect(kx + (i * kw) / COLS, ky, kw / COLS + 0.5, kh); }
    }
    if (plakaYer !== 'yatak') { x.fillStyle = '#d9dee2'; x.fillRect(kx - 2, ky - 2, kw + 4, kh + 4); yaz('KLİŞE YOK', mx + mw / 2, my + mh / 2, 20, '#777', 800); }
    const axPx = mx + mw / 2 + (ax / (W / 2)) * (mw / 2);
    x.fillStyle = '#333'; x.fillRect(axPx - 5, my - 8, 10, mh + 16);
    x.fillStyle = suBasinc > 0.5 ? '#1f8fe0' : havaBasinc < 5.9 ? '#cfd6dc' : '#888';
    x.fillRect(axPx - 14, my - 8, 4, mh + 16); x.fillRect(axPx + 10, my - 8, 4, mh + 16);
    yaz(`Temizlik %${fmt(temizlik * 100, 0)}`, mx + mw / 2, my + mh + 18, 14, '#333', 700);
    if (kapakK > 0.02) { x.fillStyle = '#e5302a'; x.fillRect(mx - 10, my - 4, mw + 20, 40); yaz('KAPAK AÇIK!', mx + mw / 2, my + 16, 24, '#fff', 800); }
    // sol ikonlar
    const hata = d.seviye === 'alarm';
    x.fillStyle = hata ? (Math.sin(t * 8) > 0 ? '#e5302a' : '#7a1a16') : '#2ea043';
    x.beginPath(); x.arc(52, 120, 22, 0, Math.PI * 2); x.fill();
    yaz(hata ? '!' : '✓', 52, 121, 24, '#fff', 800);
    yaz('HATA LAMBASI', 52, 154, 11, '#333', 700);
    x.strokeStyle = '#1f6fd6'; x.lineWidth = 7;
    x.beginPath(); x.arc(52, 193, 13, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; x.beginPath(); x.moveTo(52 + Math.cos(a) * 13, 193 + Math.sin(a) * 13); x.lineTo(52 + Math.cos(a) * 21, 193 + Math.sin(a) * 21); x.stroke(); }
    yaz('AYARLAR', 52, 220, 11, '#333', 700);
    yaz('MANUEL', 52, 246, 11, '#333', 700); yaz('KOMUTLAR', 52, 260, 11, '#333', 700);
    // sağ sayaçlar
    const sayac = (lbl, v, y) => {
      x.fillStyle = '#ef7d00'; x.fillRect(Wp - 110, y, 90, 46);
      x.fillStyle = '#fff'; x.fillRect(Wp - 104, y + 6, 78, 34);
      yaz(String(v), Wp - 65, y + 24, 20, '#111', 800);
      yaz(lbl, Wp - 65, y + 58, 10, '#333', 700);
    };
    sayac('ATILAN TUR', `${atilanTur}/${yikamaTur + durulamaTur + kurutmaTur}`, 80);
    sayac('TOPLAM TUR', toplamTur, 152);
    sayac('YIKANAN KLİŞE', yikanan, 224);
    // bilgi satırı
    yaz(`Su ${fmt(suBasinc, 1)} bar  ·  Hava ${fmt(havaBasinc, 1)} bar  ·  ${fmt(suSic, 1)} °C  ·  Fırça ${fmt((Math.abs(firHiz) * 60) / (2 * Math.PI), 0)} dev/dk`, Wp / 2, 296, 14, '#333', 600);
    // alt sıra: başlat/dur + çevrim sayıları
    const by = Hp - 70;
    const calis = durum === 'calisiyor' && calisan();
    x.fillStyle = calis ? '#e8262a' : '#b44'; x.beginPath(); x.arc(130, by, 22, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(123, by - 10); x.lineTo(123, by + 10); x.lineTo(140, by); x.fill();
    yaz('BAŞLAT', 130, by + 34, 11, '#333', 700);
    x.fillStyle = !calis ? '#e8262a' : '#b44'; x.beginPath(); x.arc(200, by, 22, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.fillRect(192, by - 9, 5, 18); x.fillRect(203, by - 9, 5, 18);
    yaz('DUR', 200, by + 34, 11, '#333', 700);
    [['YIKAMA', yikamaTur, 'yikama'], ['DURULAMA', durulamaTur, 'durulama'], ['KURUTMA', kurutmaTur, 'kurutma']].forEach(([lbl, v, f], i) => {
      const cx = 300 + i * 120;
      x.fillStyle = faz === f && durum === 'calisiyor' ? '#2ea043' : '#fff'; x.fillRect(cx - 34, by - 22, 68, 40);
      x.strokeStyle = '#333'; x.lineWidth = 2; x.strokeRect(cx - 34, by - 22, 68, 40);
      yaz(faz === f ? `${fazTur}/${v}` : String(v), cx, by - 2, 20, '#111', 800);
      yaz(`${lbl} ÇEVRİM`, cx, by + 34, 10, '#333', 700);
    });
    const renk = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#e5302a', bekliyor: '#6e7681' }[d.seviye];
    x.fillStyle = renk; x.fillRect(0, Hp - 18, Wp, 18);
    yaz(d.metin, Wp / 2, Hp - 9, 12, '#fff', 700);
  }

  // ---------------------------------------------------------------- durum + arayüz
  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'kapak') return { metin: 'KAPAK AÇIK! · PROGRAM DURDU', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'DURDURULDU · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (mod === 'man') return { metin: 'MANUEL KOMUT', seviye: 'bekliyor' };
    if (faz === 'hazir') return kapakK > 0.02 ? { metin: 'KLİŞE DEĞİŞİMİ · KAPAK AÇIK', seviye: 'uyari' } : { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (faz === 'bitti') return { metin: 'PROGRAM TAMAMLANDI · KLİŞEYİ ALIN', seviye: 'calisiyor' };
    return { metin: `${FAZ_AD[faz].toLocaleUpperCase('tr')} · TUR ${Math.min(fazTur + 1, fazHedefTur())}/${fazHedefTur()}`, seviye: 'calisiyor' };
  }

  // Performans (lib.sabitle): hareket eden / görünürlüğü değişen nesneler + gizli düğümler
  // (altındaki görünür mesh'ler birleşirse görünür olur) + saydam mesh'ler (cam, sıralama) birleştirilmez.
  const sabitHaric = () => {
    const h = [araba, plaka, ...kapakYarilar.flatMap((k) => [k.A, k.B]), ...kirliRaf, ...temizRaf];
    g.traverse((o) => { if (!o.visible || (o.isMesh && !Array.isArray(o.material) && o.material.transparent)) h.push(o); });
    return h;
  };

  function kliseDegistir() {
    if (sanalOp) { uyar('ÖNCE SANAL OPERATÖRÜ KAPAT'); return; }
    if (calisan()) { uyar('PROGRAM SÜRÜYOR'); return; }
    if (kapakK < 0.98) { uyar('ÖNCE KAPAĞI AÇ'); return; }
    if (plakaYer === 'yatak') { if (temizSay >= RAFN) temizSay = 0; temizSay++; }
    if (kirliSay <= 0) kirliSay = RAFN;
    kirliSay--;
    kirSifirla();
    plakaYer = 'yatak';
    gec('hazir');
    uyar('YENİ KLİŞE YATAKTA · KAPAĞI KAPAT');
  }

  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik program'], ['man', 'Manuel komut']], get: () => mod,
      set: (v) => { mod = v; jog.x = jog.y = 0; jog.su = jog.hava = false; opIptal(); if (v === 'man' && calisan()) gec('hazir'); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'BAŞLAT', tur: 'basla', tik: () => { if (durum === 'durdu' && !calisan()) durum = 'calisiyor'; baslat(); } },
      { metin: 'DUR', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'anahtar', metin: 'Kapak açık', get: () => kapakAcik,
      set: (v) => { kapakAcik = v; if (!v && durum === 'kapak') durum = 'durdu'; } },
    { tip: 'baslik', metin: 'Operatör' },
    { tip: 'anahtar', metin: 'Sanal operatör (kapak / klişe değişimi / BAŞLAT)', get: () => sanalOp,
      set: (v) => { sanalOp = v; if (!v) opIptal(); } },
    { tip: 'butonlar', ogeler: [{ metin: 'Klişeyi değiştir', tik: kliseDegistir }] },
    { tip: 'baslik', metin: 'Program' },
    { tip: 'kaydirici', metin: 'Yıkama turu', min: 1, max: 6, adim: 1, birim: 'tur', get: () => yikamaTur, set: (v) => (yikamaTur = v) },
    { tip: 'kaydirici', metin: 'Durulama turu', min: 0, max: 4, adim: 1, birim: 'tur', get: () => durulamaTur, set: (v) => (durulamaTur = v) },
    { tip: 'kaydirici', metin: 'Kurutma turu', min: 0, max: 4, adim: 1, birim: 'tur', get: () => kurutmaTur, set: (v) => (kurutmaTur = v) },
    { tip: 'kaydirici', metin: 'Fırça basıncı', min: 20, max: 100, adim: 5, birim: '%', get: () => basinc, set: (v) => (basinc = v) },
    { tip: 'kaydirici', metin: 'Fırça devri', min: 100, max: 400, adim: 10, birim: 'dev/dk', get: () => devir, set: (v) => (devir = v) },
    { tip: 'kaydirici', metin: 'Araba hızı', min: 0.2, max: 0.7, adim: 0.05, birim: 'm/s', get: () => arabaHiz, set: (v) => (arabaHiz = v) },
    { tip: 'baslik', metin: 'Manuel komut (mod: Manuel)' },
    { tip: 'basili', ogeler: [
      { metin: 'Fırça grubu geri', bas: () => (jog.x = -1), birak: () => (jog.x = 0) },
      { metin: 'Fırça grubu ileri', bas: () => (jog.x = 1), birak: () => (jog.x = 0) },
    ] },
    { tip: 'basili', ogeler: [
      { metin: 'Fırça yukarı', bas: () => (jog.y = -1), birak: () => (jog.y = 0) },
      { metin: 'Fırça aşağı', bas: () => (jog.y = 1), birak: () => (jog.y = 0) },
    ] },
    { tip: 'basili', ogeler: [
      { metin: 'Su ver', bas: () => (jog.su = true), birak: () => (jog.su = false) },
      { metin: 'Hava ver', bas: () => (jog.hava = true), birak: () => (jog.hava = false) },
    ] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') durum = calisan() && kapakK > 0.02 ? 'kapak' : 'durdu'; } },
    ] },
  ];

  // açılış: kirli klişe yatakta, program yıkamada
  kirSifirla();
  plakaUygula(yatakPoz(_poz));
  isci.position.set(op.x, 0, op.z);

  return {
    id: 'yikama',
    ad: 'Klişe Yıkama Makinesi',
    altBaslik: 'Soft Cleaner · gezer fırça · su/hava nozzle',
    kisa: 'Fleksografik baskı klişelerinin mürekkebini temizleyen makine (Soft Cleaner): klişe yatağa serilir, boydan boya gezen tek fırça ve önündeki/arkasındaki su-hava nozzle\'larıyla yıkama, durulama ve kurutma yapılır. İki yarım sürgülü kapak ortadan ayrılıp uçlara kayar; operatör temiz klişeyi askıya asar, yenisini serer. Kapak tam kapanmadan çalışmaz.',
    proje: 'other-machines',
    ayakIzi: [8.2, 3.2],
    ayakIziMerkez: [0, 0.3],
    kamera: { poz: [-1.2, 2.4, 3.6], hedef: [0.25, 0.7, 0] },
    mekanizmalar: [
      'Fırça arabası (gantry): yatak boyunca boydan boya gider-gelir (bir tur = ileri + geri); boştayken sol turuncu muhafazanın içinde park eder (koyu camdan görünür)',
      'Tek tam genişlik silindir fırça: yıkamada pnömatik silindirlerle iner ve döner, durulama/kurutmada kalkar',
      'Önde ve arkada nozzle barı: yıkama/durulamada SU, kurutmada HAVA (hava bıçağı) verir',
      'Klişe: fırçanın geçtiği yerde mürekkep katmanı silinir, su ıslatır, hava kurutur',
      'Sürgülü kapak: iki yarım; ortadan ayrılıp uçlardaki turuncu muhafazaların içine kayar (her yarı 2 teleskopik panel); tam kapanmadan program çalışmaz (KAPAK AÇIK!)',
      'Su ısıtıcısı ~38–45 °C (gövde içinde; önde ısıtıcı LED\'i)',
      'Operatör: kapağı açar, temiz klişeyi askıya asar, kirli raftan yenisini serer, kapatır, BAŞLAT',
    ],
    cikarim: [
      'KAAN\'IN DÜZELTMESİ: makine "klişe yıkama makinesi"; klişe tek parça plaka. İçeride boydan boya gezen tek fırça, fırçanın önünde ve arkasında hem su hem hava verebilen nozzle\'lar (önce yıkama, sonra kurutma). Başında operatör, kapak açılıp klişe değişiyor.',
      'Sektör örnekleri (Fujifilm su-yıkamalı klişe işlemcileri: spray bar + air knife + basınç ayarlı fırça; Baldwin: tam genişlik fırça + nozzle + ayrı hava bıçağı) genel yerleşim için referans alındı.',
      'MKN-F09–F11 FiTeknik/doka ekranları: KAPAK AÇIK!, atılan/toplam tur, yıkama/durulama/kurutma çevrim sayıları, BAŞLAT/DUR, hata lambası, fırça yukarı/aşağı ve fırça grubu ileri/geri komutları → HMI ve manuel komutlar.',
      'GERÇEK MAKİNE RENDER\'I (FiTeknik HMI, KAPAK AÇIK! ekranı, "SOFT CLEANER"): üst yarı gri / alt yarı antrasit uzun kabin, iki uçta üstü koyu camlı turuncu muhafaza blokları, dikey turuncu köşe trimleri, ön solda "SOFT CLEANER" yazısı, altta iki turkuaz forklift cebi, sağ önde dışarı çıkıntılı dokunmatik panel + acil stop, ortada açık yıkama yatağı.',
      'KAAN: kapaklar aşağıdan yukarı açılmıyor, 2 parça ortadan ikiye ayrılarak açılıyor → iki yarım sürgülü kapak; render\'daki turuncu blokların iç kenarındaki kulplar = kapak yarılarının tutamakları.',
      'TAHMİN: ölçüler (~2.6 × 1.3 × 1.05 m), kapak yarılarının teleskopik 2 panel olarak muhafazalara girmesi, arabanın sol muhafazada park etmesi, klişe boyutu (1.2 × 0.8 m, yeşil fotopolimer, aynalı kabartma desen), tur sayıları (3 yıkama · 1 durulama · 2 kurutma), su sıcaklığı, kirli raf ve temiz klişe askısının yeri/biçimi.',
      'Süreler gösterim için hızlandırıldı; mürekkep rengi her klişede değişir (cyan / magenta / siyah / sarı).',
    ],
    group: g,
    update,
    kontroller,
    sabitHaric,
    degerler: () => [
      ['Adım', mod === 'oto' ? FAZ_AD[faz] : 'Manuel'],
      ['Tur', calisan() ? `${Math.min(fazTur + 1, fazHedefTur())}/${fazHedefTur()} · atılan ${atilanTur}` : `atılan ${atilanTur}`],
      ['Araba konumu', `${fmt(ax * 1000, 0)} mm`],
      ['Fırça', `${fmt((Math.abs(firHiz) * 60) / (2 * Math.PI), 0)} dev/dk · ${firY > 0.85 ? 'temasta' : 'yukarıda'}`],
      ['Su basıncı', `${fmt(suBasinc, 1)} bar`],
      ['Hava basıncı', `${fmt(havaBasinc, 1)} bar`],
      ['Su sıcaklığı', `${fmt(suSic, 1)} °C${isitici ? ' · ısıtıcı açık' : ''}`],
      ['Klişe temizliği', plakaYer === 'yatak' ? `%${fmt(temizlik * 100, 0)}` : '—'],
      ['Yıkanan klişe', String(yikanan)],
      ['Raflar', `kirli ${kirliSay} · temiz ${temizSay}`],
      ['Operatör', op.metin],
    ],
    trend,
    durum: durumBilgi,
  };
}
