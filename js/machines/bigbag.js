// js/machines/bigbag.js — Big Bag Kıstırma ve Yükleme Aparatı (bağımsız, telsiz kumandalı).
//
// Kaan'ın tarifi + düzeltmesi (MKN-V01 + MKN-V03): aparat İŞ MAKİNESİNE BAĞLI DEĞİL; kendi
// ayakları üzerinde yerde duran bağımsız bir makine. "Aşağıda ayakları var, ortaya doğru iki
// kolu var; kollar balyaya sarılıp tutuyor, sonra kaldırıyor." Kollar PARALEL kayarak balyayı
// iki yandan sıkıştırır; balya kaldırılınca KAMYON GERİ GERİ ALTINA yanaşır, aparat balyayı
// kasaya indirir. Balyanın durduğu büyük yuvarlak plaka DÖNER TABLA. Kontrol turuncu 8 butonlu
// telsiz kumandayla.
//  V01: yerde öne uzanan turuncu ayaklar (yuvarlak uç kapaklı), koyu döner tabla, krom kılavuz
//       kolonlar, sarı-siyah ikaz şeritli turuncu kollar.
//  V03: gri portal çerçeve, ortada dikey hidrolik silindir gri taşıyıcı kirişi kolonlarda
//       yukarı-aşağı sürer; mavi hidrolik güç ünitesi, lambalı gri kumanda kutusu + anten.
//
// Yerleşim (yerel, dış saha): portal -X ucunda, ayaklar +X'e uzanır; kamyon şeridi z=ZC
// boyunca, kamyon +X'ten geri geri gelir. Portal kamyon kasasının içinden geçebileceği
// genişlikte (TAHMİN) → kamyon her yuvayı balyanın altına getirebilir. Stok + forklift önde (+Z).
// Konteynerin kamyon şeridi yerel z=+12'de → yerel z ∈ [-5.3, 4.3].

export function create(lib) {
  const {
    THREE, M, box, cyl, sphere, beam, mat, lamba, Ekran, Trend, kuleLambasi, ikazDokusu,
    clamp, approach, fmt, throttle, gurultu, easeInOut,
  } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ölçüler
  const ZC = -2.0;                  // aparat / kamyon şeridi ekseni
  const XC = -6.0;                  // kolonlar + taşıyıcı kiriş hattı
  const XB = -5.0;                  // balya merkezi (döner tabla)
  const KZ = 1.6;                   // kolonların eksenden uzaklığı (iç açıklık 3.2 m)
  const KOL_H = 3.7;                // kolon boyu
  const H_TABLA = 0.14, KASA_Y = 1.3, H_KALDIR = 1.85, H_MAX = 2.0, H_KAMYON = 1.75;
  const W_ACIK = 0.95, W_TEMAS = 0.56, W_SIKI = 0.5, W_BOS = 0.42;   // ped iç yüzü eksenden (m)
  const P_OTUR = 100;               // bar — bu basınçta kıskaç "oturdu"
  const SLOT = [1.7, 0.55, -0.6, -1.75];   // kasa yuvaları (kamyon yerel x), önden arkaya doldurulur
  const KAM_BEKLE = 7.2, KAM_UZAK = 30;
  const STOK = [[-1.4, 3.3], [-0.2, 3.3], [1.0, 3.3]];
  const FL_PARK = [1.6, 1.2];
  const CATAL_OFS = 1.19;          // çatal üstü → balya tabanı (çatal askı kulplarının altından geçer)

  const turuncu = mat(0xf06a14, { r: 0.45, m: 0.2, key: 'bb-turuncu' });
  const aparatGri = mat(0x7c848c, { r: 0.5, m: 0.4, key: 'aparat' });
  const ikazMat = new THREE.MeshStandardMaterial({ map: ikazDokusu([1, 3]), roughness: 0.6 });

  // ---------------------------------------------------------------- yardımcı: teleskop silindir
  const _Y = new THREE.Vector3(0, 1, 0), _dd = new THREE.Vector3();
  function teleskop(parent, rG, Lg, rR, matG) {
    const grp = new THREE.Group();
    parent.add(grp);
    cyl(rG, Lg, matG, 0, Lg / 2, 0, grp, { seg: 12 });
    const rg = new THREE.CylinderGeometry(rR, rR, 1, 10);
    rg.translate(0, 0.5, 0);
    const rodM = new THREE.Mesh(rg, M.krom);
    rodM.castShadow = true;
    rodM.position.y = Lg * 0.92;
    grp.add(rodM);
    return {
      guncelle(A, B) {
        grp.position.copy(A);
        _dd.subVectors(B, A);
        const L = _dd.length();
        grp.quaternion.setFromUnitVectors(_Y, _dd.multiplyScalar(1 / L));
        rodM.scale.y = Math.max(0.01, L - Lg * 0.92);
      },
    };
  }

  // ---------------------------------------------------------------- aparat: ayaklar + portal
  for (const s of [-1, 1]) {
    const z = ZC + s * KZ;
    box(3.7, 0.15, 0.18, turuncu, -5.45, 0.075, z, g);                          // turuncu ayak (yerde)
    cyl(0.09, 0.18, turuncu, -3.6, 0.09, z, g, { eksen: 'z', seg: 16 });         // yuvarlak uç kapak
    box(0.42, 0.03, 0.42, M.koyu, XC, 0.165, z, g);                              // kolon taban plakası
    cyl(0.065, KOL_H - 0.18, M.krom, XC, 0.18 + (KOL_H - 0.18) / 2, z, g, { seg: 16 }); // krom kılavuz kolon
    box(0.14, KOL_H - 0.2, 0.14, aparatGri, XC - 0.24, 0.2 + (KOL_H - 0.2) / 2, z, g);  // gri dikme
    beam([-7.2, 0.15, z], [XC - 0.24, 2.7, z], 0.12, 0.12, aparatGri, g);         // arka çapraz destek (A-çerçeve)
  }
  box(0.32, 0.26, 2 * KZ + 0.4, aparatGri, XC - 0.1, KOL_H + 0.12, ZC, g);         // üst kiriş
  // dikey kaldırma silindiri: gövde üst kirişte, mil aşağı taşıyıcıya
  const SIL_UST = KOL_H - 0.02, SIL_ALT = SIL_UST - 0.58;
  cyl(0.095, SIL_UST - SIL_ALT, M.koyu, XC, (SIL_UST + SIL_ALT) / 2, ZC, g, { seg: 18 });
  cyl(0.12, 0.06, M.siyah, XC, SIL_ALT + 0.03, ZC, g, { seg: 18 });
  const milGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 12);
  milGeo.translate(0, -0.5, 0);
  const mil = new THREE.Mesh(milGeo, M.krom);
  mil.position.set(XC, SIL_ALT, ZC); mil.castShadow = true;
  g.add(mil);
  const flasorMat = lamba(0xff3b1f, 0.1);
  cyl(0.06, 0.09, flasorMat, XC - 0.1, KOL_H + 0.3, ZC + KZ + 0.05, g, { seg: 14 });
  const kule = kuleLambasi(g, XC - 0.1, KOL_H + 0.25, ZC - KZ - 0.05);

  // ---------------------------------------------------------------- taşıyıcı + paralel kollar
  const tasiyici = new THREE.Group();                 // y = H + 0.85 (H: kol pedlerinin alt kenarı)
  g.add(tasiyici);
  box(0.22, 0.24, 2 * KZ + 0.2, aparatGri, XC, 0, ZC, tasiyici);
  for (const s of [-1, 1]) cyl(0.11, 0.36, M.koyu, XC, 0, ZC + s * KZ, tasiyici, { seg: 14 }); // kolon burçları
  box(0.3, 0.12, 0.3, M.koyu, XC, 0.18, ZC, tasiyici);                                         // silindir bağlantısı

  const kollar = [-1, 1].map((s) => {
    const k = new THREE.Group();
    tasiyici.add(k);
    box(0.32, 0.32, 0.26, M.koyu, XC, 0, s * 0.15, k);                         // kızak bloğu (kirişi sarar)
    box(1.55, 0.14, 0.12, turuncu, (XC - 4.45) / 2, 0, s * 0.08, k);             // öne uzanan taşıyıcı kol
    box(0.13, 0.85, 0.13, ikazMat, -4.5, -0.43, s * 0.08, k);                    // ikaz şeritli dikey kol
    box(0.92, 0.7, 0.05, M.celik, XB, -0.47, s * 0.045, k);                      // baskı pabucu
    box(0.88, 0.66, 0.02, M.kaucuk, XB, -0.47, s * 0.01, k);                     // kauçuk yüz (iç yüz z=0)
    box(1.0, 0.1, 0.12, turuncu, XB + 0.05, -0.8, s * 0.07, k);                  // alt kol (V01'deki L)
    cyl(0.065, 0.12, turuncu, -4.47, -0.8, s * 0.07, k, { eksen: 'z', seg: 14 }); // yuvarlak uç
    beam([XC + 0.1, -0.05, s * 0.08], [XB - 0.3, -0.45, s * 0.08], 0.06, 0.06, turuncu, k); // destek
    const sil = teleskop(tasiyici, 0.05, 0.24, 0.022, M.mavi);                   // yatay kıskaç silindiri
    return { k, s, sil };
  });

  // ---------------------------------------------------------------- döner tabla
  const tabla = new THREE.Group();
  tabla.position.set(XB, 0, ZC);
  g.add(tabla);
  cyl(0.72, 0.06, M.koyu, 0, 0.03, 0, tabla, { seg: 32 });
  const disk = new THREE.Group();
  tabla.add(disk);
  cyl(0.66, 0.07, mat(0x3a3e43, { r: 0.6, m: 0.5, key: 'tabla' }), 0, 0.1, 0, disk, { seg: 32 });
  for (let i = 0; i < 4; i++) {                                                     // dönüş görünsün diye işaret
    const m = box(0.5, 0.012, 0.05, M.sari, 0, 0.142, 0, disk);
    m.rotation.y = (i * Math.PI) / 4;
  }
  box(0.3, 0.22, 0.24, M.mavi, -0.95, 0.11, 0, tabla);                              // tabla redüktör motoru (kiriş altında)

  // ---------------------------------------------------------------- güç ünitesi + kumanda kutusu
  const gu = new THREE.Group();
  gu.position.set(XC + 0.3, 0, ZC - KZ - 0.85);
  g.add(gu);
  box(0.8, 0.42, 0.46, M.mavi, 0, 0.21, 0, gu);                                     // yağ tankı
  cyl(0.13, 0.36, M.mavi, 0.12, 0.6, 0, gu, { eksen: 'x', seg: 16 });               // elektrik motoru
  box(0.16, 0.14, 0.16, M.koyu, -0.26, 0.5, 0, gu);                                 // valf bloğu
  cyl(0.035, 0.04, M.beyaz, -0.26, 0.6, 0.09, gu, { eksen: 'z', seg: 12 });         // manometre
  beam([-0.26, 0.5, 0.05], [-0.3, 1.2, 0.72], 0.025, 0.025, M.siyah, gu);           // hortum (kolona)
  // kumanda kutusu (direğe bağlı, +X'e bakar)
  box(0.06, 1.1, 0.06, M.koyu, 1.0, 0.55, 0.0, gu);
  box(0.2, 0.52, 0.42, M.pano, 1.0, 1.32, 0.0, gu);
  const kutuLamba = [0xf2a900, 0x1f6fd6, 0x2ea043].map((r, i) => {
    const m = lamba(r, 0.1);
    cyl(0.022, 0.02, m, 1.11, 1.5, -0.1 + i * 0.1, gu, { eksen: 'x', seg: 12 });
    return m;
  });
  cyl(0.03, 0.03, M.kirmizi, 1.11, 1.12, 0.12, gu, { eksen: 'x', seg: 12 });
  cyl(0.007, 0.45, M.siyah, 1.0, 1.8, 0.15, gu, { seg: 6 });                        // telsiz alıcı anteni
  const ekran = new Ekran(0.34, 0.22, 512);
  ekran.mesh.position.set(1.105, 1.27, -0.03);
  ekran.mesh.rotation.y = Math.PI / 2;
  gu.add(ekran.mesh);

  // ---------------------------------------------------------------- big bag'ler (havuz)
  const cantaGeo = new THREE.BoxGeometry(1.0, 1.15, 1.0, 6, 6, 6);
  {
    const p = cantaGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const by = 1 - (y / 0.575) ** 2;
      const bx = 1 - (z / 0.5) ** 2, bz = 1 - (x / 0.5) ** 2;
      p.setXYZ(i, x * (1 + 0.09 * by * bx), y, z * (1 + 0.09 * by * bz));
    }
    cantaGeo.computeVertexNormals();
    cantaGeo.translate(0, 0.575, 0);
  }
  const cantaMat = mat(0xe4e6e2, { r: 0.92, m: 0, key: 'bigbag' });
  const kayisMat = mat(0x8c9196, { r: 0.85, m: 0, key: 'bb-kayis' });
  const kulpGeo = new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI);
  const cantalar = [];
  for (let i = 0; i < 8; i++) {
    const dis = new THREE.Group();              // konum + dünya eksenli sıkışma ölçeği
    const ic = new THREE.Group();               // yaw
    dis.add(ic);
    const govde = new THREE.Mesh(cantaGeo, cantaMat);
    govde.castShadow = true; govde.receiveShadow = true;
    ic.add(govde);
    cyl(0.13, 0.1, cantaMat, 0, 1.2, 0, ic, { seg: 12 });                           // dolum ağzı
    for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
      const k = new THREE.Mesh(kulpGeo, kayisMat);
      k.position.set(x, 1.15, z);                                                   // kulp XY düzleminde → Z boyunca giren çatal geçer
      ic.add(k);
    }
    g.add(dis);
    cantalar.push({ dis, ic, durum: 'yok', slot: -1, stok: -1, off: 0, yaw: 0, ton: 0.9 + Math.random() * 0.35, olcek: 1, sq: 0 });
  }

  // ---------------------------------------------------------------- kamyon (açık kasa, kabin +X)
  const kamyon = new THREE.Group();
  g.add(kamyon);
  box(5.0, 0.12, 2.4, M.celik, 0, KASA_Y - 0.06, 0, kamyon);                        // kasa tabanı
  for (const s of [-1, 1]) box(5.0, 0.22, 0.05, M.gri, 0, KASA_Y + 0.11, s * 1.18, kamyon);
  box(0.05, 0.22, 2.4, M.gri, -2.48, KASA_Y + 0.11, 0, kamyon);
  box(0.06, 0.9, 2.3, M.gri, 2.5, KASA_Y + 0.45, 0, kamyon);                        // kabin koruma
  for (const z of [-0.45, 0.45]) box(6.9, 0.2, 0.12, M.siyah, 0.9, 0.85, z, kamyon); // şasi
  const kabinMat = mat(0xf3f4f1, { r: 0.4, m: 0.2, key: 'kamyonkabin' });
  box(1.75, 1.85, 2.3, kabinMat, 3.45, 1.78, 0, kamyon);
  const camK = mat(0x24323d, { r: 0.1, m: 0.4, key: 'camkamyon' });
  box(0.03, 0.8, 2.0, camK, 4.33, 2.15, 0, kamyon);
  for (const s of [-1, 1]) {
    box(0.9, 0.62, 0.03, camK, 3.65, 2.2, s * 1.16, kamyon);
    box(0.02, 1.2, 0.03, M.koyu, 3.1, 1.6, s * 1.162, kamyon);
    box(0.12, 0.04, 0.04, M.koyu, 3.8, 1.75, s * 1.17, kamyon);
  }
  box(0.12, 0.3, 2.35, M.koyu, 4.36, 0.95, 0, kamyon);                              // tampon
  for (const s of [-1, 1]) box(0.04, 0.12, 0.3, lamba(0xfff3c8, 0.6), 4.38, 1.2, s * 0.85, kamyon);
  const geriLamba = lamba(0xff2a1a, 0.1);
  for (const s of [-1, 1]) box(0.04, 0.1, 0.2, geriLamba, -2.52, 1.05, s * 1.0, kamyon); // stop/geri lambası
  box(0.6, 0.35, 0.3, M.koyu, 2.0, 0.75, 0.95, kamyon);                              // yakıt deposu
  const tekerler = [];
  for (const x of [-1.9, -0.9, 3.55]) for (const s of [-1, 1]) {
    const t = new THREE.Group();
    t.position.set(x, 0.46, s * 1.02);
    kamyon.add(t);
    cyl(0.46, 0.32, M.kaucuk, 0, 0, 0, t, { eksen: 'z', seg: 22 });
    cyl(0.22, 0.34, M.gri, 0, 0, 0, t, { eksen: 'z', seg: 12 });
    box(0.06, 0.34, 0.345, M.koyu, 0, 0.12, 0, t);
    tekerler.push(t);
  }

  // ---------------------------------------------------------------- forklift (balya besleme)
  const fork = new THREE.Group();
  g.add(fork);
  const flSari = mat(0xf2b705, { r: 0.5, m: 0.2, key: 'forklift' });
  box(1.0, 0.55, 1.5, flSari, 0, 0.55, -0.25, fork);                                // gövde
  box(1.0, 0.5, 0.35, M.koyu, 0, 0.6, -1.05, fork);                                 // karşı ağırlık
  box(0.5, 0.08, 0.5, M.siyah, 0, 0.9, -0.35, fork);                                // koltuk
  for (const [x, z] of [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.8], [0.45, -0.8]]) box(0.05, 1.3, 0.05, M.koyu, x, 1.45, z, fork);
  box(1.0, 0.05, 1.25, M.koyu, 0, 2.1, -0.22, fork);                                // koruma tavanı
  const flTeker = [];
  for (const [x, z] of [[-0.5, 0.3], [0.5, 0.3], [-0.5, -0.8], [0.5, -0.8]]) {
    const t = cyl(0.22, 0.2, M.kaucuk, x, 0.22, z, fork, { eksen: 'x', seg: 16 });
    flTeker.push(t);
  }
  for (const x of [-0.4, 0.4]) box(0.08, 2.3, 0.1, M.koyu, x, 1.2, 0.62, fork);    // direk
  const catal = new THREE.Group();
  fork.add(catal);
  box(0.95, 0.4, 0.06, M.koyu, 0, 0.18, 0.7, catal);                                // çatal arabası
  for (const x of [-0.42, 0.42]) box(0.1, 0.05, 1.15, M.celik, x, 0, 1.28, catal); // çatallar (kulplardan geçer)

  // ---------------------------------------------------------------- operatör (telsiz kumandalı)
  // ortak FK-1000 tipi operatör (yüz +Z); sağ elde videodaki turuncu 8 butonlu telsiz
  const opModel = lib.operator({ yelek: 0xff7a1a, baret: 0xffffff });
  const isci = opModel.group;
  isci.position.set(-3.0, 0, 1.3);
  g.add(isci);
  opModel.poz('sag');                                          // sağ kol önde: telsizi tutuyor
  const telsiz = new THREE.Group();
  telsiz.position.set(0, -0.02, 0.05);
  telsiz.rotation.x = 0.9 - 0.35;                              // kol açısını telafi et, hafif eğik tut
  opModel.elSag.add(telsiz);
  box(0.09, 0.19, 0.05, mat(0xff5a10, { r: 0.5, m: 0.1, key: 'telsiz' }), 0, 0.06, 0, telsiz);
  for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) box(0.022, 0.022, 0.012, M.siyah, sx * 0.02, 0.0 + r * 0.032, 0.03, telsiz);
  cyl(0.008, 0.12, M.siyah, 0.03, 0.2, 0, telsiz, { seg: 6 });            // anten
  isci.rotation.y = Math.atan2(XB - isci.position.x, ZC - isci.position.z);

  // ---------------------------------------------------------------- durum
  let mod = 'oto';                    // oto | man
  let durum = 'calisiyor';            // calisiyor | durdu | acil
  let faz = 'hizala';
  let H = H_TABLA, Hhedef = H_TABLA;  // kol pedlerinin alt kenarı (= kıstırılan balyanın tabanı)
  let w = W_ACIK, kolHedef = 0;       // ped iç yüzü eksenden; kolHedef 0 açık / 1 kapalı
  let basinc = 0;
  let tablaRot = 0, tablaHedef = null;
  let tutulan = null;                 // kollardaki balya
  let yuklenen = 0, stokT = 0;
  let uyariMetin = '', uyariT = 0;
  const jog = { h: 0, t: 0 };
  const uyar = (m) => { uyariMetin = m; uyariT = 2.4; };

  const kam = { x: KAM_BEKLE, hedef: KAM_BEKLE, v: 0, durum: 'bekliyor', t: 0, yuva: -1 };
  const fl = { x: FL_PARK[0], z: FL_PARK[1], yaw: 0, catal: 0.15, q: [], tasinan: null };

  // ---------------------------------------------------------------- yardımcılar
  const tablaBalya = () => cantalar.find((c) => c.durum === 'tabla');
  const kamyondaki = () => cantalar.filter((c) => c.durum === 'kamyon').length;
  const stoktaki = () => cantalar.filter((c) => c.durum === 'stok').length;
  const yuvaDolu = (i) => cantalar.some((c) => c.durum === 'kamyon' && c.slot === i);
  const bosYuva = () => SLOT.findIndex((_, i) => !yuvaDolu(i));
  const kamPortalda = () => kam.x - 2.5 < -4.3;                     // kasa arkası pedlerin önünü geçti
  const hizaliYuva = () => {
    if (!kamPortalda() || Math.abs(kam.v) > 0.01) return -1;
    const i = SLOT.findIndex((sx) => Math.abs(kam.x + sx - XB) < 0.04);
    return i >= 0 && !yuvaDolu(i) ? i : -1;
  };
  function destek() {                                               // kollardaki balyanın inebileceği en alt seviye
    if (hizaliYuva() >= 0) return KASA_Y;
    if (kamPortalda()) return 1.62;                                 // hizasız kasa: kenar tahtalarının üstü
    return H_TABLA;
  }
  const kolHareket = () => Math.abs(w - wHedef()) > 0.002;
  function wHedef() {
    if (kolHedef === 0) return W_ACIK;
    return tutulan || kiskacAdayi() ? W_SIKI : W_BOS;
  }
  function kiskacAdayi() {                                          // pedlerin arasındaki balya
    const t = tablaBalya();
    if (t && Math.abs(H - H_TABLA) < 0.1) return t;
    if (Math.abs(H - KASA_Y) < 0.1 && kamPortalda() && Math.abs(kam.v) < 0.01) {
      return cantalar.find((c) => c.durum === 'kamyon' && Math.abs(kam.x + SLOT[c.slot] - XB) < 0.04) || null;
    }
    return null;
  }
  const yawHizali = (y) => Math.round(y / (Math.PI / 2)) * (Math.PI / 2);

  // ---------------------------------------------------------------- balya yerleşimi (her kare)
  function cantalariYerlestir() {
    for (const c of cantalar) {
      const D = c.dis;
      D.visible = c.durum !== 'yok';
      if (!D.visible) continue;
      let yaw = 0;
      if (c.durum === 'stok') { D.position.set(STOK[c.stok][0], 0, STOK[c.stok][1]); yaw = c.yaw; }
      else if (c.durum === 'forklift') {
        D.position.set(fl.x + Math.sin(fl.yaw) * 1.28, fl.catal - CATAL_OFS, fl.z + Math.cos(fl.yaw) * 1.28);
        yaw = fl.yaw + c.off;
      } else if (c.durum === 'tabla') { D.position.set(XB, H_TABLA, ZC); yaw = tablaRot + c.off; }
      else if (c.durum === 'aparat') { D.position.set(XB, H, ZC); yaw = c.yaw; }
      else if (c.durum === 'kamyon') { D.position.set(kam.x + SLOT[c.slot], KASA_Y, ZC); yaw = c.yaw; }
      c.ic.rotation.y = yaw;
      // kıskaç sıkışması (dünya Z ekseni) — balya pedlerin arasındaysa
      const sq = (c === tutulan || c === kiskacAdayi()) ? clamp((W_TEMAS - w) / (W_TEMAS - W_SIKI), 0, 1) : 0;
      c.sq = sq;
      const o = c.olcek < 1 ? easeInOut(c.olcek) : 1;
      D.scale.set(o, o * (1 + sq * 0.04), o * (1 - sq * 0.09));
    }
  }

  // ---------------------------------------------------------------- kollar / taşıyıcı / tabla
  function hidrolik(dt) {
    // kollar (paralel kızak)
    const wh = wHedef();
    w = approach(w, wh, 0.28 * dt);
    const aday = tutulan || kiskacAdayi();
    if (kolHedef === 1) {
      const temas = aday && w <= W_TEMAS + 0.001;
      const hedefP = temas || (!aday && w <= W_BOS + 0.001) ? 112 + gurultu(1.5) : 14 + gurultu(1);
      basinc = approach(basinc, hedefP, (temas ? 90 : 160) * dt);
      if (aday && !tutulan && basinc >= P_OTUR) {               // kıskaç oturdu → balya kollarda
        tutulan = aday;
        aday.yaw = aday.durum === 'tabla' ? tablaRot + aday.off : aday.yaw;
        aday.durum = 'aparat'; aday.slot = -1;
      }
    } else {
      basinc = approach(basinc, kolHareket() ? 12 + gurultu(1) : 0, 160 * dt);
      if (tutulan && w > W_TEMAS + 0.01) {                       // kollar açıldı → balya desteğe bırakılır
        const i = hizaliYuva();
        if (i >= 0) { tutulan.durum = 'kamyon'; tutulan.slot = i; yuklenen++; }
        else { tutulan.durum = 'tabla'; tutulan.off = tutulan.yaw - tablaRot; }
        tutulan = null;
      }
    }
    // taşıyıcı
    let hMin = tutulan ? destek() : (kamPortalda() ? 1.32 : H_TABLA);
    if (kamPortalda() && Math.abs(kam.v) > 0.01) hMin = Math.max(hMin, H_KAMYON);
    let hh = mod === 'oto' ? Hhedef : H + jog.h * 0.5;
    hh = clamp(hh, hMin, H_MAX);
    if (hh > H + 0.001 && kolHedef === 1 && basinc < P_OTUR) { hh = H; uyar('BASINÇ OTURMADI · KALDIRMA YOK'); }
    if (hh > H + 0.001 && kolHareket()) { hh = H; }
    if (mod === 'man' && jog.h < 0 && tutulan && H < KASA_Y + 0.06 && hizaliYuva() < 0 && H > H_TABLA + 0.05) {
      uyar('KAMYON ALTINDA DEĞİL · YÜK TABLAYA İNİYOR');
    }
    H = approach(H, hh, 0.38 * dt);
    // döner tabla
    if (mod === 'man' && jog.t) {
      if (tutulan || (tablaBalya() && w < W_ACIK - 0.05)) { uyar('KOLLAR BALYADA · TABLA KİLİTLİ'); }
      else tablaRot += jog.t * 0.6 * dt;
    } else if (tablaHedef != null) tablaRot = approach(tablaRot, tablaHedef, 0.6 * dt);
  }

  // ---------------------------------------------------------------- kamyon
  function kamyonGuncelle(dt) {
    if (kam.durum === 'uzakta') {
      kam.t += dt;
      if (kam.t > 2.5) {                                          // başka yerde boşaltıldı
        for (const c of cantalar) if (c.durum === 'kamyon') { c.durum = 'yok'; c.slot = -1; }
        kam.durum = 'donuyor'; kam.hedef = KAM_BEKLE;
      }
    }
    const fark = kam.hedef - kam.x;
    const portal = kam.x < 1.5 || kam.hedef < 1.5;
    const vmax = portal ? 1.1 : 3.2;
    let vh = clamp(fark * 1.2, -vmax, vmax);
    if (kamPortalda() && H < H_KAMYON - 0.01) { vh = 0; if (Math.abs(fark) > 0.02) uyar('KOL ALÇAK · KAMYON BEKLİYOR'); }
    kam.v = approach(kam.v, vh, 1.4 * dt);
    if (Math.abs(fark) < 0.004 && Math.abs(kam.v) < 0.05) { kam.x = kam.hedef; kam.v = 0; }
    kam.x += kam.v * dt;
    if (kam.v === 0 && kam.x === kam.hedef) {
      if (kam.durum === 'geliyor') kam.durum = 'altta';
      else if (kam.durum === 'cikiyor' || kam.durum === 'donuyor') kam.durum = 'bekliyor';
      else if (kam.durum === 'gidiyor') { kam.durum = 'uzakta'; kam.t = 0; }
    }
    kamyon.position.set(kam.x, 0, ZC);
    kamyon.visible = kam.x < KAM_UZAK - 0.5;
    tekerler.forEach((t) => (t.rotation.z = -kam.x / 0.46));
    geriLamba.emissiveIntensity = kam.v < -0.02 ? 2.4 : 0.15;
  }
  function kamyonCagir() {
    const i = bosYuva();
    if (i < 0 || kam.durum !== 'bekliyor') return false;
    if (H < H_KAMYON) { uyar('ÖNCE BALYAYI KALDIR'); return false; }
    kam.yuva = i; kam.hedef = XB - SLOT[i]; kam.durum = 'geliyor';
    return true;
  }
  function kamyonGonder() {
    if (kam.durum === 'altta' || kam.durum === 'geliyor') {
      if (tutulan && tutulan.durum === 'aparat' && H < H_KAMYON) { uyar('YÜK KASADA · ÖNCE KOLLARI AÇ'); return; }
      kam.hedef = KAM_BEKLE; kam.durum = 'cikiyor';
    } else if (kam.durum === 'bekliyor' && kamyondaki() > 0) {
      kam.hedef = KAM_UZAK; kam.durum = 'gidiyor';
    }
  }

  // ---------------------------------------------------------------- forklift
  const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const don = (yaw) => ({ tip: 'don', yaw });
  const git = (x, z, geri = false) => ({ tip: 'git', x, z, geri });
  const cat = (h) => ({ tip: 'catal', h });
  const fn = (f) => ({ tip: 'fn', f });
  const bekle = (k) => ({ tip: 'bekle', k });
  const flBos = () => fl.q.length === 0;
  const gitNokta = (x, z) => [{ tip: 'yonel', x, z }, git(x, z)];

  function forkliftBesle() {
    if (!flBos() || tablaBalya() || tutulan || kamPortalda()) return false;
    const c = cantalar.filter((k) => k.durum === 'stok').sort((a, b) => b.stok - a.stok)[0];
    if (!c) return false;
    const [sx] = STOK[c.stok];
    fl.q.push(
      ...gitNokta(sx, 1.2), don(0), cat(CATAL_OFS), git(sx, STOK[c.stok][1] - 1.28),
      fn(() => { c.durum = 'forklift'; c.off = c.yaw - fl.yaw; fl.tasinan = c; }),
      cat(1.65), git(sx, 1.2, true),
      ...gitNokta(1.6, 1.2),
      bekle(() => !kamPortalda() && kam.v === 0),
      ...gitNokta(1.6, ZC), don(-Math.PI / 2), git(XB + 1.28, ZC),
      cat(H_TABLA + CATAL_OFS),
      fn(() => { c.durum = 'tabla'; c.off = fl.yaw + c.off - tablaRot + (Math.random() - 0.5) * 0.9; fl.tasinan = null; }),
      cat(0.9), git(1.6, ZC, true), cat(0.15),
      ...gitNokta(FL_PARK[0], FL_PARK[1]), don(0),
    );
    return true;
  }
  function forkliftGuncelle(dt) {
    const a = fl.q[0];
    let surus = 0;
    if (a) {
      if (a.tip === 'yonel') {
        const hedef = Math.atan2(a.x - fl.x, a.z - fl.z);
        if (Math.hypot(a.x - fl.x, a.z - fl.z) < 0.01) fl.q.shift();
        else { const d = sar(hedef - fl.yaw); fl.yaw += clamp(d, -1.8 * dt, 1.8 * dt); if (Math.abs(d) < 0.003) { fl.yaw = hedef; fl.q.shift(); } }
      } else if (a.tip === 'don') {
        const d = sar(a.yaw - fl.yaw);
        fl.yaw += clamp(d, -1.8 * dt, 1.8 * dt);
        if (Math.abs(d) < 0.003) { fl.yaw = a.yaw; fl.q.shift(); }
      } else if (a.tip === 'git') {
        const dx = a.x - fl.x, dz = a.z - fl.z, d = Math.hypot(dx, dz), adim = 1.5 * dt;
        if (d <= adim) { fl.x = a.x; fl.z = a.z; fl.q.shift(); }
        else { fl.x += (dx / d) * adim; fl.z += (dz / d) * adim; surus = a.geri ? -adim : adim; }
      } else if (a.tip === 'catal') {
        fl.catal = approach(fl.catal, a.h, 0.6 * dt);
        if (fl.catal === a.h) fl.q.shift();
      } else if (a.tip === 'fn') { fl.q.shift(); a.f(); }
      else if (a.tip === 'bekle') { if (a.k()) fl.q.shift(); }
    }
    fork.position.set(fl.x, 0, fl.z);
    fork.rotation.y = fl.yaw;
    catal.position.y = fl.catal;
    flTeker.forEach((t) => (t.rotation.x += surus / 0.22));
  }

  // ---------------------------------------------------------------- otomatik çevrim
  const FAZ = {
    besle: 'FORKLİFT BALYA GETİRİYOR', hizala: 'TABLA BALYAYI HİZALIYOR', kapat: 'KOLLAR KAPANIYOR',
    kaldir: 'BALYA KALDIRILIYOR', kamyon_bekle: 'KAMYON BEKLENİYOR', kamyon_gel: 'KAMYON GERİ GERİ YANAŞIYOR',
    indir: 'BALYA KASAYA İNİYOR', ac: 'KOLLAR AÇILIYOR', kalk: 'TAŞIYICI KALKIYOR', alcal: 'TAŞIYICI TABLAYA İNİYOR',
  };
  function oto() {
    if (kam.durum === 'bekliyor' && bosYuva() < 0) kamyonGonder();   // kasa doldu → boşaltmaya
    switch (faz) {
      case 'besle':
        if (tablaBalya() && flBos()) faz = 'hizala';
        else if (flBos() && !tablaBalya()) forkliftBesle();
        break;
      case 'hizala': {
        const c = tablaBalya();
        if (!c) { faz = 'besle'; break; }
        if (tablaHedef == null) tablaHedef = yawHizali(tablaRot + c.off) - c.off;
        if (Math.abs(tablaRot - tablaHedef) < 0.002) { tablaHedef = null; faz = 'kapat'; }
        break;
      }
      case 'kapat':
        kolHedef = 1;
        if (tutulan && basinc >= P_OTUR) faz = 'kaldir';
        break;
      case 'kaldir':
        Hhedef = H_KALDIR;
        if (Math.abs(H - H_KALDIR) < 0.002) faz = 'kamyon_bekle';
        break;
      case 'kamyon_bekle':
        if (kam.durum === 'bekliyor' && bosYuva() >= 0) { if (kamyonCagir()) faz = 'kamyon_gel'; }
        else if (kam.durum === 'bekliyor' && bosYuva() < 0) kamyonGonder();
        break;
      case 'kamyon_gel':
        if (kam.durum === 'altta') faz = 'indir';
        break;
      case 'indir':
        Hhedef = KASA_Y;
        if (Math.abs(H - KASA_Y) < 0.002) faz = 'ac';
        break;
      case 'ac':
        kolHedef = 0;
        if (!tutulan && w >= W_ACIK - 0.002) faz = 'kalk';
        break;
      case 'kalk':
        Hhedef = H_KALDIR;
        if (Math.abs(H - H_KALDIR) < 0.002) {
          kamyonGonder();                                          // yuvasından çekilir
          faz = 'alcal';
        }
        break;
      case 'alcal':
        if (kam.durum === 'bekliyor' && bosYuva() < 0) kamyonGonder(); // dolu → boşaltmaya gider
        if (!kamPortalda()) Hhedef = H_TABLA;
        if (Math.abs(H - H_TABLA) < 0.002) faz = 'besle';
        break;
    }
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'Sıkıştırma (bar)', renk: '#f2c200' }, { ad: 'Kol tabanı ×50 (m)', renk: '#39c5cf' }], { min: 0, max: 120, uzunluk: 300 });
  const ekranZ = throttle(4);

  function update(dt, t) {
    const calis = durum === 'calisiyor';
    if (calis) {
      if (mod === 'oto') oto();
      hidrolik(dt);
      kamyonGuncelle(dt);
      forkliftGuncelle(dt);
      // stok yenileme: stok bitti ve forklift boşta → boşalmış balyalar stoğa döner
      if (stoktaki() === 0 && flBos()) {
        stokT += dt;
        if (stokT > 3) {
          stokT = 0;
          let n = 0;
          for (const c of cantalar) if (c.durum === 'yok' && n < STOK.length) { c.durum = 'stok'; c.stok = n; c.yaw = (Math.random() - 0.5) * 0.5; c.olcek = 0; n++; }
        }
      }
    } else {
      kamyon.position.set(kam.x, 0, ZC);
    }
    for (const c of cantalar) if (c.olcek < 1) c.olcek = Math.min(1, c.olcek + dt * 2.2);
    uyariT = Math.max(0, uyariT - dt);

    // görsel yerleşim
    tasiyici.position.y = H + 0.85;
    mil.scale.y = Math.max(0.02, SIL_ALT - (H + 0.85 + 0.24));
    for (const k of kollar) {
      k.k.position.z = ZC + k.s * w;
      k.sil.guncelle(_A.set(XC, 0.22, ZC + k.s * 0.13), _B.set(XC, 0.22, ZC + k.s * (w + 0.02)));
    }
    disk.rotation.y = tablaRot;
    cantalariYerlestir();

    // lambalar
    const hidrolikHareket = calis && (kolHareket() || Math.abs(H - (mod === 'oto' ? Hhedef : H)) > 0.002 || jog.h !== 0);
    flasorMat.emissiveIntensity = hidrolikHareket || kam.v !== 0 ? (Math.sin(t * 12) > 0 ? 2.6 : 0.1) : 0.1;
    kutuLamba[0].emissiveIntensity = durum !== 'acil' ? 1.8 : 0.05;
    kutuLamba[1].emissiveIntensity = kolHareket() ? 2.2 : 0.05;
    kutuLamba[2].emissiveIntensity = tutulan ? 2.2 : 0.05;
    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [basinc, H * 50]);
    if (ekranZ(dt)) {
      ekran.standart('Big Bag Aparatı · Telsiz', [
        ['Kol aralığı', `${fmt(w * 2000, 0)} mm`],
        ['Basınç', `${fmt(basinc, 0)} bar`],
        ['Kol tabanı', `${fmt(H * 1000, 0)} mm`],
        ['Kasa', `${kamyondaki()} / ${SLOT.length}`],
      ], d);
    }
  }
  const _A = new THREE.Vector3(), _B = new THREE.Vector3();

  function kolMetni() {
    if (tutulan && basinc >= P_OTUR) return 'KISTIRDI';
    if (kolHareket()) return kolHedef ? 'KAPANIYOR' : 'AÇILIYOR';
    return kolHedef ? 'KAPALI (boş)' : 'AÇIK';
  }
  const KAM_METIN = { bekliyor: 'beklemede', geliyor: 'geri geri yanaşıyor', altta: 'balyanın altında', cikiyor: 'öne çekiliyor', gidiyor: 'boşaltmaya gidiyor', uzakta: 'boşaltıyor', donuyor: 'geri dönüyor' };

  function durumBilgi() {
    if (durum === 'acil') return { metin: tutulan && H > destek() + 0.02 ? 'ACİL STOP · YÜK TUTULUYOR' : 'ACİL STOP', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (mod === 'man') return { metin: 'MANUEL · TELSİZ KUMANDA', seviye: 'calisiyor' };
    if (faz === 'besle' && stoktaki() === 0 && flBos() && !tablaBalya()) return { metin: 'STOK BEKLENİYOR', seviye: 'uyari' };
    if (faz === 'kamyon_bekle' && kam.durum !== 'bekliyor') return { metin: 'KAMYON BOŞALTMADA · BALYA HAVADA BEKLİYOR', seviye: 'calisiyor' };
    return { metin: `OTOMATİK · ${FAZ[faz]}`, seviye: 'calisiyor' };
  }

  // ---------------------------------------------------------------- arayüz
  const elle = (f) => () => { if (mod !== 'man') { uyar('MANUEL MODA GEÇ'); return; } if (durum === 'calisiyor') f(); };
  const jogTus = (eksen, yon, metin) => ({
    metin, bas: () => { if (mod === 'man' && durum === 'calisiyor') jog[eksen] = yon; else if (mod !== 'man') uyar('MANUEL MODA GEÇ'); },
    birak: () => (jog[eksen] = 0),
  });
  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik yükleme'], ['man', 'Manuel (telsiz)']], get: () => mod,
      set: (v) => {
        mod = v; jog.h = jog.t = 0; tablaHedef = null; Hhedef = H;
        if (v === 'oto') {                                       // kaldığı yerden tutarlı faza otur
          if (tutulan) faz = H >= H_KALDIR - 0.01 ? 'kamyon_bekle' : 'kaldir';
          else if (kamPortalda()) faz = 'kalk';
          else faz = tablaBalya() ? 'hizala' : 'alcal';
          if (!tutulan) kolHedef = 0;
        }
      } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'baslik', metin: 'Telsiz kumanda (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Kollar kapat', tik: elle(() => { kolHedef = 1; }) },
      { metin: 'Kollar aç', tik: elle(() => {
        if (tutulan && H > destek() + 0.02) { uyar('YÜK HAVADA · KOLLAR AÇILMAZ'); return; }
        kolHedef = 0;
      }) },
    ] },
    { tip: 'basili', ogeler: [jogTus('h', 1, 'Kaldır ▲'), jogTus('h', -1, 'İndir ▼')] },
    { tip: 'basili', ogeler: [jogTus('t', 1, '⟲ Tabla sola'), jogTus('t', -1, 'Tabla sağa ⟳')] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Kamyonu çağır', tik: elle(() => { if (!kamyonCagir() && kam.durum !== 'bekliyor') uyar('KAMYON MÜSAİT DEĞİL'); else if (bosYuva() < 0) uyar('KASA DOLU'); }) },
      { metin: 'Kamyonu gönder', tik: elle(kamyonGonder) },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Forklift: balya getir', tik: elle(() => { if (!forkliftBesle()) uyar('TABLA DOLU / KAMYON ALTTA / STOK YOK'); }) },
    ] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; jog.h = jog.t = 0; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') durum = 'durdu'; } },
    ] },
  ];

  // ---------------------------------------------------------------- açılış durumu
  // 3 balya stokta, 1 balya döner tablada (hizasız), kamyon beklemede boş
  for (let i = 0; i < 3; i++) Object.assign(cantalar[i], { durum: 'stok', stok: i, yaw: (Math.random() - 0.5) * 0.5 });
  Object.assign(cantalar[3], { durum: 'tabla', off: 0.55 });
  fork.position.set(fl.x, 0, fl.z);
  kamyon.position.set(kam.x, 0, ZC);
  tasiyici.position.y = H + 0.85;
  cantalariYerlestir();

  return {
    id: 'bigbag',
    ad: 'Big Bag Kıstırma ve Yükleme Aparatı',
    altBaslik: 'Paralel kıskaç · hidrolik · telsiz kumanda',
    kisa: 'Kendi ayakları üzerinde duran hidrolik aparat: döner tabladaki big bag\'i iki paralel kol yanlardan sıkıştırır, taşıyıcı krom kolonlarda kaldırır; kamyon geri geri altına yanaşır, balya kasaya indirilir. Telsiz uzaktan kumandayla kontrol edilir.',
    proje: 'other-machines',
    ayakIzi: [20, 9.6],
    ayakIziMerkez: [2.1, -0.5],
    kamera: { poz: [5.0, 7.5, 10.5], hedef: [-2.6, 1.2, -1.8] },
    mekanizmalar: [
      'Paralel kollar: taşıyıcı kiriş üzerindeki kızakta yatay silindirlerle ortaya kayar, kauçuk pabuçlar balyayı iki yandan sıkıştırır (çanta yanlardan hafif içe basılır)',
      'Taşıyıcı: üst kirişteki dikey hidrolik silindir taşıyıcıyı krom kolonlarda yukarı-aşağı sürer; kollar ve balya onunla kalkar',
      'Döner tabla: balyayı kollara düz yüzü gelecek şekilde hizalar (redüktör motor)',
      'Kamyon: balya havadayken geri geri gelir, kasası ayakların arasından geçer, sıradaki boş yuvayı balyanın altına getirir; 4 balyada boşaltmaya gider',
      'Forklift: stoktaki balyayı askı kulplarından çatallayıp döner tablaya koyar',
      'Güvenlik: basınç oturmadan kaldırma yok, yük havadayken kollar açılmaz, kol alçakken kamyon durur, ACİL STOP\'ta hidrolik durur ve yük tutulur',
    ],
    cikarim: [
      'KAAN\'IN DÜZELTMESİ: aparat iş makinesine (ekskavatöre) bağlı DEĞİL — kendi ayakları üzerinde yerde duran bağımsız makine; ortaya doğru kayan iki kol balyayı sarıp tutuyor ve kaldırıyor. Kollar paralel kayıyor, balyanın durduğu yuvarlak plaka döner tabla, kamyon kaldırılmış balyanın altına geri geri yanaşıyor.',
      'MKN-V01: yerde öne uzanan turuncu ayaklar (yuvarlak uç kapaklı), koyu döner tabla üstünde balya, krom kılavuz kolonlar ve sarı-siyah ikaz şeritli turuncu kollar → ayaklar, tabla, kolonlar ve L biçimli kollar.',
      'MKN-V03: gri portal çerçeve, ortadaki dikey silindir gri taşıyıcı kirişi yukarı-aşağı sürüyor; mavi hidrolik ünite, lambalı gri kumanda kutusu + anten, turuncu telsiz → taşıyıcı, güç ünitesi, kumanda kutusu.',
      'TAHMİN: portal genişliği (kolonlar arası 3.2 m) kamyon kasasının ayakların ve kolonların arasından geçebileceği şekilde alındı; videoda çerçeve daha dar görünüyor — gerçekte kamyon yalnız kasa arkasını sokuyor olabilir.',
      'TAHMİN: forkliftle besleme, kamyonun 4 balya alması, balya ~1 t / 1.0 × 1.15 m, kıskaç basıncı ~110 bar, kaldırma 1.85 m; süreler hızlandırıldı.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => [
      ['Kollar', kolMetni()],
      ['Kol aralığı', `${fmt(w * 2000, 0)} mm`],
      ['Sıkıştırma basıncı', `${fmt(basinc, 0)} bar`],
      ['Taşıyıcı (kol tabanı)', `${fmt(H * 1000, 0)} mm`],
      ['Tabla açısı', `${fmt((((tablaRot * 180) / Math.PI) % 360 + 360) % 360, 0)}°`],
      ['Yük', tutulan ? `${fmt(tutulan.ton, 2)} t` : '—'],
      ['Kamyon', `${KAM_METIN[kam.durum]} · kasada ${kamyondaki()} / ${SLOT.length}`],
      ['Stok', `${stoktaki()} balya · yüklenen ${yuklenen}`],
    ],
    trend,
    durum: durumBilgi,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (mil ölçeklenir, taşıyıcı/kollar
    // kalkar, disk döner, kamyon/forklift/balyalar hareket eder ve gizlenir)
    sabitHaric: [mil, tasiyici, disk, kamyon, fork, ...cantalar.map((c) => c.dis)],
  };
}
