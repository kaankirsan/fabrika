// js/machines/kaynak.js — Kaynak Robotu Hücresi (arkalı önlü iki pozisyoner + sabit robot).
//
// Sistem (Kaan'ın tarifi, 2026-10-23):
//  - İki doğrusal pozisyoner iki paralel hatta: P1 önde (robota yakın), P2 arkada
//    (duvar tarafı). Robot sabit kaidede ön hattın önünde; arka fikstüre ön hattın
//    üstünden uzanır. Pozisyoner yalnız doğrusal gider, fikstür dönmez/eğilmez.
//  - Operatör başlangıç noktasında baza parçalarını fikstüre dizer, pozisyonerin
//    üstündeki HAZIR butonuna basar → pozisyoner robotun önüne gider, 3 konumda
//    (K1, K2, K3) durur; robot her konumda o bölgenin kaynaklarını yapar.
//  - Kaynak bitince başlangıca döner; operatör kaynaklı bazayı alıp palete koyar.
//  - Robot tek seferde tek pozisyonerde çalışır. Diğeri HAZIR olsa bile sırada
//    bekler; pozisyonerler yalnız robot "evde"yken hareket eder (robotla
//    haberleşme). P1 kaynak bölgesinden çıkmadan P2 robota gelemez (P1 önü kapatır).
//
// Ölçüler TAHMİN: baza 2.0 × 1.5 m, strok 0–2500 mm (HMI fotoğrafındaki cetvel),
// konumlar 1100 / 1800 / 2500 mm. Süreler gösterim için hızlandırıldı.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, rod, sphere, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop, pano,
    cit, orguDokusu, kabloZinciri, clamp, approach, damp, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const ic = new THREE.Group();          // hücre; ayak izi ortalansın diye kaydırıldı
  ic.position.set(-0.45, 0, -0.3);
  g.add(ic);

  // ---------------------------------------------------------------- ölçüler
  const EGIM = (-8 * Math.PI) / 180;     // fikstür üst kenarı robottan uzağa yatık
  const cE = Math.cos(EGIM), sE = Math.sin(EGIM);
  const YB = 0.32;                       // fikstür alt çizgisi
  const XS = 0;                          // başlangıçta (yükleme) fikstür merkezi x
  const STROK = 2.5;
  const DURAK = [1.1, 1.8, 2.5];         // K1, K2, K3 (strok, m)
  const BOLGE_U = [0.7, 0, -0.7];        // her konumda robotun önüne gelen bölge (fikstür u)
  const RX = XS + DURAK[0] + BOLGE_U[0]; // robot ekseni (= 1.8)
  // Robot kaidesi merkezi z. Fikstürlerden uzak tutulur: yakın olunca alçak dikişlerde dirsek
  // öne çıkıp ön fikstürün içinden geçiyordu (Kaan: "iç içe giriyor"). Uzaklık kol boyu +
  // yüksek kaideyle telafi edildi; arka fikstürün üst köşesine erişim payı ~8 cm.
  const ZR = 1.3;
  const HAT_Z = [0.05, -0.9];            // P1 (ön) / P2 (arka) fikstür ön yüzü
  const FW = 2.3, FH = 1.78;             // fikstür ızgarası
  const BW = 2.0, BH = 1.5, BV0 = 0.12;  // baza; fikstürde v=0.12'den başlar
  const DIKEY_U = [-1, -0.5, 0, 0.5, 1], YATAY_V = [0, 0.75, 1.5];
  const SERBEST_S = 0.2;                 // P1 bunun altındaysa arka fikstüre erişim açık
  const LC_X = 1.2;                      // ışık perdesi / çit sol kenarı
  const VMAX = 0.6;
  const YUKLEME_SURE = 9, BOSALTMA_SURE = 3, ELLE_DIZME = 3;
  const DIKIS = 0.07;

  // Eklemler (baza profillerinin kesişimleri) ve konumlara dağılımı
  const EKLEM = [];
  YATAY_V.forEach((v) => DIKEY_U.forEach((u) => EKLEM.push([u, BV0 + v])));
  const bolgeOf = (u) => (u > 0.25 ? 0 : u < -0.25 ? 2 : 1);
  const BOLGE_EKLEM = [0, 1, 2].map((k) => {
    const L = [];
    YATAY_V.forEach((v, r) => {
      const satir = EKLEM.map((e, i) => [e, i]).filter(([e]) => e[1] === BV0 + v && bolgeOf(e[0]) === k);
      satir.sort((a, b) => (r % 2 ? b[0][0] - a[0][0] : a[0][0] - b[0][0]));
      L.push(...satir.map(([, i]) => i));
    });
    return L;
  });

  const beyaz = mat(0xeef0ec, { r: 0.5, m: 0.15, key: 'fikstur' });
  const robotKirmizi = mat(0xd42a1e, { r: 0.36, m: 0.25, key: 'robot' });
  const profilMat = mat(0x4f555c, { r: 0.42, m: 0.75, key: 'baza' });
  const dikisMat = mat(0x2e2b28, { r: 0.6, m: 0.5, key: 'dikis' });

  // Kaynaklı baza şablonu (palet ve taşıma için): yerel X = u, Y = v, orijin alt orta
  function bazaSablon() {
    const s = new THREE.Group();
    YATAY_V.forEach((v) => box(BW + 0.04, 0.04, 0.04, profilMat, 0, v, 0, s));
    DIKEY_U.forEach((u) => box(0.04, BH, 0.04, profilMat, u, BH / 2, 0, s));
    return s;
  }

  // ---------------------------------------------------------------- zemin rayları
  const RAY_X0 = XS - FW / 2 - 0.25, RAY_X1 = XS + STROK + FW / 2 + 0.25;
  for (const hz of HAT_Z) for (const dz of [-0.1, -0.52]) {
    box(RAY_X1 - RAY_X0, 0.08, 0.16, M.gri, (RAY_X0 + RAY_X1) / 2, 0.04, hz + dz, ic);
    box(RAY_X1 - RAY_X0, 0.03, 0.045, M.celik, (RAY_X0 + RAY_X1) / 2, 0.095, hz + dz, ic);
    for (const x of [RAY_X0, RAY_X1]) box(0.08, 0.14, 0.18, M.sari, x, 0.07, hz + dz, ic);
  }
  // Robot ekseni zemin işareti (konumlar bu çizgiye göre)
  const eksen = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.4), new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.7 }));
  eksen.rotation.x = -Math.PI / 2;
  eksen.position.set(RX, 0.006, -0.45);
  ic.add(eksen);

  // ---------------------------------------------------------------- pozisyonerler
  const v3 = () => new THREE.Vector3();
  function cerceveNokta(t, u, v, f, out = v3()) {
    // fikstür yerel (u yatay, v yukarı, f robota doğru) → hücre (ic) çerçevesi
    return out.set(XS + t.s + u, YB + v * cE - f * sE, t.ZF + v * sE + f * cE);
  }

  function pozKur(i) {
    const ZF = HAT_Z[i];
    const t = {
      i, ZF, s: 0, v: 0, sp: 0,
      yuk: 'bos',            // bos | yukleniyor | parca | kaynakli
      parca: 0,              // dizme ilerlemesi 0..1
      elleDizme: false,
      hazir: false,
      faz: 'start',          // start | git | kaynak | don | manuel
      konum: 0, bolgeBitti: [false, false, false],
      adet: 0, cevrimT: 0, ortKaynak: 0, sonKaynak: 0, yukT: 0, ortYukleme: 0, sonYukleme: 0,
      grup: new THREE.Group(), boncuk: [], isi: [], parcalar: [],
    };
    ic.add(t.grup);
    // kızak + rulman blokları + servo (Veichi SD700)
    box(FW + 0.1, 0.1, 0.62, M.koyu, 0, 0.16, ZF - 0.31, t.grup);
    for (const sx of [-1, 1]) for (const dz of [-0.1, -0.52]) box(0.16, 0.05, 0.1, M.siyah, sx * (FW / 2 - 0.15), 0.125, ZF + dz, t.grup);
    box(0.15, 0.15, 0.15, M.siyah, -(FW / 2 - 0.3), 0.29, ZF - 0.5, t.grup);
    cyl(0.055, 0.2, M.koyu, -(FW / 2 - 0.3), 0.29, ZF - 0.33, t.grup, { eksen: 'z', seg: 16 });
    box(0.08, 0.2, 0.08, M.koyu, 0, 0.12, ZF - 0.66, t.grup);           // zincir bağlantısı
    // arka destek dikmeleri
    for (const sx of [-0.8, 0.8]) {
      const ust = cerceveNokta({ s: -XS, ZF }, sx, 1.3, -0.07);
      beam([sx, 0.22, ZF - 0.56], [sx, ust.y, ust.z], 0.06, 0.06, beyaz, t.grup);
    }
    // eğik ızgara fikstür
    const c = new THREE.Group();
    c.position.set(0, YB, ZF);
    c.rotation.x = EGIM;
    t.grup.add(c);
    const s = 0.07;
    for (const u of [-1.12, -0.56, 0, 0.56, 1.12]) box(s, FH, s, beyaz, u, FH / 2, -s / 2, c);
    for (const v of [0, 0.59, 1.18, 1.76]) box(FW + s, s, s, beyaz, 0, v, -s / 2, c);
    // bölge numaraları (K1'de sağ bölge robotun önüne gelir)
    BOLGE_U.forEach((u, k) => {
      const lv = levha([`K${k + 1}`], 0.26, 0.17, { bg: '#151b22', fg: '#f2c200', font: 64, px: 256 });
      lv.position.set(u, FH + 0.17, 0);
      c.add(lv);
    });
    // kelepçeler
    for (const v of YATAY_V) for (const u of [-0.75, -0.25, 0.25, 0.75]) box(0.05, 0.05, 0.04, M.siyah, u, BV0 + v + 0.045, 0.02, c);
    // baza parçaları — operatör dizdikçe sırayla görünür
    YATAY_V.forEach((v) => t.parcalar.push(box(BW + 0.04, 0.04, 0.03, profilMat, 0, BV0 + v, 0.03, c)));
    DIKEY_U.forEach((u) => t.parcalar.push(box(0.04, BH, 0.03, profilMat, u, BV0 + BH / 2, 0.03, c)));
    // dikiş boncukları: ilerleyerek uzar, kızgın turuncudan koyuya soğur
    EKLEM.forEach(([u, v]) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x3b3833, emissive: 0xff6a10, emissiveIntensity: 0, roughness: 0.6, metalness: 0.5 });
      const b = cyl(0.014, DIKIS, m, u, v, 0.05, c, { eksen: 'x', seg: 8 });
      b.scale.y = 0.0001;
      b.userData = { u, mat: m };
      t.boncuk.push(b);
      t.isi.push(0);
    });
    // HAZIR butonu: pozisyonerin sol ucunda, kızakla birlikte gider
    const bx = -FW / 2 - 0.14;
    box(0.24, 0.1, 0.3, M.koyu, bx + 0.02, 0.16, ZF - 0.15, t.grup);
    box(0.06, 0.88, 0.06, M.sari, bx, 0.64, ZF - 0.1, t.grup);
    box(0.16, 0.14, 0.1, M.sari, bx, 1.14, ZF - 0.1, t.grup);
    t.hazirLamba = lamba(0x2ee66b, 0.05);
    cyl(0.04, 0.03, t.hazirLamba, bx, 1.15, ZF - 0.035, t.grup, { eksen: 'z', seg: 18 });
    const hl = levha(['HAZIR'], 0.15, 0.045, { bg: '#151515', fg: '#fff', font: 90, px: 256 });
    hl.position.set(bx, 1.065, ZF - 0.044);
    t.grup.add(hl);
    const pl = levha([`P${i + 1}`], 0.12, 0.07, { bg: '#f2c200', fg: '#111', font: 96, px: 192 });
    pl.position.set(bx, 1.26, ZF - 0.044);
    t.grup.add(pl);
    // enerji zinciri (iki hat arasında / arka hattın arkasında)
    t.zincir = kabloZinciri({ adet: 62, R: 0.07, s: 1.35, d: 1, link: [0.05, 0.035, 0.08] });
    t.zincir.group.position.set(0, 0.02, ZF - 0.72);
    ic.add(t.zincir.group);
    return t;
  }
  const T = [pozKur(0), pozKur(1)];

  // ---------------------------------------------------------------- robot
  const L1 = 1.15, L2 = 1.15, LT = 0.36;  // üst kol, ön kol, bilek→torç ucu
  const KH = 0.75;                         // kaide yüksekliği
  const J1Y = KH + 0.2, HS = 0.3, FS = 0.12; // J1 yüksekliği, omuz yüksekliği/ileri ofseti
  const TORC_ACI = (-28 * Math.PI) / 180;  // torç: yatayın 28° altı

  box(0.7, KH, 0.7, M.siyah, RX, KH / 2, ZR, ic);
  box(0.78, 0.04, 0.78, M.koyu, RX, KH + 0.02, ZR, ic);
  cyl(0.235, 0.04, M.siyah, RX, KH + 0.06, ZR, ic, { seg: 28 });
  cyl(0.21, 0.14, robotKirmizi, RX, KH + 0.13, ZR, ic, { seg: 28 });
  const J1 = new THREE.Group();
  J1.position.set(RX, J1Y, ZR);
  ic.add(J1);
  box(0.36, 0.3, 0.42, robotKirmizi, 0, 0.13, -0.02, J1);
  cyl(0.085, 0.12, M.siyah, 0.24, HS, FS, J1, { eksen: 'x', seg: 18 });        // J2 motoru
  box(0.22, 0.2, 0.16, M.mavi, 0, 0.38, -0.2, J1);                            // tel sürücü
  cyl(0.15, 0.06, M.siyah, 0, 0.3, -0.33, J1, { eksen: 'z', seg: 24 });      // tel makarası
  cyl(0.05, 0.065, M.celik, 0, 0.3, -0.33, J1, { eksen: 'z', seg: 16 });

  const ust = new THREE.Group();
  ust.position.set(0, HS, FS);
  J1.add(ust);
  cyl(0.13, 0.27, M.siyah, 0, 0, 0, ust, { eksen: 'x', seg: 22 });
  box(0.17, L1, 0.2, robotKirmizi, 0, L1 / 2, 0, ust);
  rod([0.11, 0.1, -0.07], [0.11, L1 - 0.1, -0.07], 0.022, M.siyah, ust);       // torç kablosu

  const on = new THREE.Group();
  on.position.set(0, L1, 0);
  ust.add(on);
  cyl(0.11, 0.25, M.siyah, 0, 0, 0, on, { eksen: 'x', seg: 20 });
  box(0.2, 0.3, 0.24, robotKirmizi, 0, 0.08, -0.02, on);
  cyl(0.065, 0.14, M.siyah, 0, 0.06, -0.2, on, { eksen: 'z', seg: 16 });       // J4 motoru
  cyl(0.072, L2 - 0.18, robotKirmizi, 0, 0.18 + (L2 - 0.18) / 2, 0, on, { seg: 20 });
  rod([0.09, 0.15, -0.05], [0.07, L2 - 0.08, -0.04], 0.02, M.siyah, on);

  const bilek = new THREE.Group();
  bilek.position.set(0, L2, 0);
  on.add(bilek);
  box(0.11, 0.12, 0.13, robotKirmizi, 0, 0, 0, bilek);
  cyl(0.05, 0.04, M.koyu, 0, 0.08, 0, bilek, { seg: 16 });
  rod([0, 0.08, 0], [0, 0.22, 0], 0.028, M.siyah, bilek);
  rod([0, 0.22, 0], [0, LT - 0.04, 0], 0.017, mat(0x8a8f96, { r: 0.3, m: 0.8 }), bilek);
  cyl(0.014, 0.05, mat(0xc07a3a, { r: 0.3, m: 0.9, key: 'bakir' }), 0, LT - 0.02, 0, bilek, { r2: 0.021, seg: 14 });
  const arkMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff, toneMapped: false });
  const ark = sphere(0.022, arkMat, 0, LT + 0.005, 0, bilek, 12);
  ark.castShadow = false;
  ark.visible = false;

  // Analitik IK: yaw (J1) + düzlemsel 2 uzuv (J2, J3) + bilek açısı torcu sabit eğimde tutar.
  function ikUygula(P) {
    const dx = P.x - RX, dz = P.z - ZR;
    J1.rotation.y = Math.atan2(dx, dz);
    const rT = Math.hypot(dx, dz);
    const rr = rT - LT * Math.cos(TORC_ACI) - FS;
    const h = P.y - LT * Math.sin(TORC_ACI) - (J1Y + HS);
    const aci = Math.atan2(h, rr);
    const d = clamp(Math.hypot(rr, h), 0.25, L1 + L2 - 0.002);
    const th1 = aci + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const th2 = Math.atan2(d * Math.sin(aci) - L1 * Math.sin(th1), d * Math.cos(aci) - L1 * Math.cos(th1));
    ust.rotation.x = Math.PI / 2 - th1;
    on.rotation.x = th1 - th2;
    bilek.rotation.x = th2 - TORC_ACI;
  }

  // Torç ucu hareket kuyruğu: doğrusal parçalar {hedef, hiz, kaynak?, bas?, bit?}
  const EV = new THREE.Vector3(RX, 1.5, ZR - 0.55);   // güvenli bekleme pozu ("robot evde")
  const robot = { P: EV.clone(), kuyruk: [], program: null, sahip: null, bolge: 0, dikisNo: 0, dikisToplam: 0 };
  const mesgul = () => robot.kuyruk.length > 0;
  const evde = () => !mesgul() && robot.P.distanceTo(EV) < 0.01;
  let kaynakAcik = false;
  const _d = v3();

  function kaynakProgrami(t, k) {
    robot.program = t; robot.bolge = k;
    robot.dikisNo = 0; robot.dikisToplam = BOLGE_EKLEM[k].length;
    const q = [];
    for (const idx of BOLGE_EKLEM[k]) {
      const [u, v] = EKLEM[idx];
      const a = cerceveNokta(t, u - DIKIS / 2, v, 0.065), b = cerceveNokta(t, u + DIKIS / 2, v, 0.065);
      q.push({ hedef: cerceveNokta(t, u - DIKIS / 2, v, 0.27), hiz: 1.4 });
      q.push({ hedef: a, hiz: 0.45 });
      const parca = { hedef: b, hiz: DIKIS / 1.1, kaynak: true, tabla: t, nokta: idx, bit: () => robot.dikisNo++ };
      parca.bas = () => { parca.uzunluk = robot.P.distanceTo(b) || 1e-6; };
      q.push(parca);
      q.push({ hedef: cerceveNokta(t, u + DIKIS / 2, v, 0.27), hiz: 0.8 });
    }
    q.push({ hedef: EV.clone(), hiz: 1.4, bit: () => {
      robot.program = null;
      t.bolgeBitti[k] = true;
      if (!t.bolgeBitti.includes(false) && t.yuk === 'parca') {
        t.yuk = 'kaynakli'; t.adet++;
        t.sonKaynak = t.cevrimT;
        t.ortKaynak = t.ortKaynak ? t.ortKaynak * 0.7 + t.cevrimT * 0.3 : t.cevrimT;
      }
    } });
    robot.kuyruk.push(...q);
  }

  function robotGuncelle(dt) {
    const s = robot.kuyruk[0];
    kaynakAcik = false;
    if (!s) return;
    if (!s._basladi) { s._basladi = true; s.bas?.(); }
    const kalan = robot.P.distanceTo(s.hedef);
    const adim = s.hiz * dt;
    if (kalan <= adim) {
      robot.P.copy(s.hedef);
      if (s.kaynak) boncukIlerle(s, 1);
      robot.kuyruk.shift();
      s.bit?.();
    } else {
      robot.P.addScaledVector(_d.subVectors(s.hedef, robot.P).normalize(), adim);
      if (s.kaynak) { kaynakAcik = true; boncukIlerle(s, 1 - (kalan - adim) / s.uzunluk); }
    }
  }
  function boncukIlerle(s, k) {
    const b = s.tabla.boncuk[s.nokta];
    k = clamp(k, 0.0001, 1);
    b.scale.y = k;
    b.position.x = b.userData.u - DIKIS / 2 + (DIKIS * k) / 2;
    s.tabla.isi[s.nokta] = 1;
  }

  // ---------------------------------------------------------------- kıvılcım + ark ışığı
  const KN = 110;
  const kPos = new Float32Array(KN * 3).fill(-10), kHiz = new Float32Array(KN * 3), kOmur = new Float32Array(KN);
  const kGeo = new THREE.BufferGeometry();
  kGeo.setAttribute('position', new THREE.BufferAttribute(kPos, 3));
  const kivilcim = new THREE.Points(kGeo, new THREE.PointsMaterial({
    color: 0xffb347, size: 0.03, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  kivilcim.frustumCulled = false;
  ic.add(kivilcim);
  let kSira = 0;
  const arkIsik = new THREE.PointLight(0xffb070, 0, 6, 2);
  arkIsik.castShadow = false;
  ic.add(arkIsik);
  const _uc = v3();
  let akim = 210;   // A

  function kivilcimGuncelle(dt) {
    if (kaynakAcik) {
      const n = Math.ceil(dt * 300 * (akim / 200));
      for (let i = 0; i < n; i++) {
        const j = kSira++ % KN;
        kPos[j * 3] = _uc.x; kPos[j * 3 + 1] = _uc.y; kPos[j * 3 + 2] = _uc.z;
        kHiz[j * 3] = gurultu(1.4); kHiz[j * 3 + 1] = Math.random() * 2.0 - 0.3; kHiz[j * 3 + 2] = 0.3 + Math.random() * 1.6;
        kOmur[j] = 0.25 + Math.random() * 0.4;
      }
    }
    for (let j = 0; j < KN; j++) {
      if (kOmur[j] <= 0) continue;
      kOmur[j] -= dt;
      kHiz[j * 3 + 1] -= 9.8 * dt;
      kPos[j * 3] += kHiz[j * 3] * dt; kPos[j * 3 + 1] += kHiz[j * 3 + 1] * dt; kPos[j * 3 + 2] += kHiz[j * 3 + 2] * dt;
      if (kPos[j * 3 + 1] < 0.01) { kPos[j * 3 + 1] = 0.01; kHiz[j * 3 + 1] *= -0.25; kHiz[j * 3] *= 0.4; kHiz[j * 3 + 2] *= 0.4; }
      if (kOmur[j] <= 0) kPos[j * 3 + 1] = -10;
    }
    kGeo.attributes.position.needsUpdate = true;
    arkIsik.position.copy(_uc);
    arkIsik.intensity = kaynakAcik ? (8 + Math.random() * 14) * (akim / 200) : 0;
    ark.visible = kaynakAcik;
    if (kaynakAcik) ark.scale.setScalar(0.7 + Math.random() * 0.8);
  }

  // ---------------------------------------------------------------- yardımcı ekipman
  // kaynak güç kaynağı + gaz tüpü (çit içinde, robotun sağında)
  const guc = new THREE.Group();
  guc.position.set(3.35, 0, 1.25);
  ic.add(guc);
  box(0.5, 0.72, 0.62, mat(0x3a3f45, { r: 0.6, m: 0.3 }), 0, 0.46, 0, guc);
  box(0.44, 0.22, 0.01, M.siyah, 0, 0.62, 0.315, guc);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.05, 0.035, M.kaucuk, sx * 0.2, 0.05, sz * 0.24, guc, { eksen: 'x', seg: 12 });
  cyl(0.11, 1.35, mat(0x5d6d5f, { r: 0.5, m: 0.4 }), 0.42, 0.68, -0.1, guc, { seg: 18 });
  cyl(0.05, 0.12, M.celik, 0.42, 1.41, -0.1, guc, { seg: 12 });
  rod([3.1, 0.3, 1.0], [RX + 0.3, 0.25, ZR + 0.15], 0.025, M.siyah, ic);

  // güvenlik çiti (robot bölgesi) + kapı; sol kenar ışık perdesiyle kapanır
  const CZ = 2.3, CX1 = 4.15, KX0 = 2.0, KX1 = 3.0;
  cit([[LC_X, 0.45], [LC_X, CZ], [KX0, CZ], [KX1, CZ], [CX1, CZ], [CX1, -1.95]], 2.0, ic, { bosluk: [2] });
  const kapi = new THREE.Group();
  kapi.position.set(KX0, 0, CZ);
  ic.add(kapi);
  const kapiGeo = new THREE.PlaneGeometry(0.94, 1.72);
  const kuv = kapiGeo.attributes.uv;
  for (let j = 0; j < kuv.count; j++) kuv.setXY(j, (kuv.getX(j) * 0.94) / 0.05, (kuv.getY(j) * 1.72) / 0.05);
  const kapiPanel = new THREE.Mesh(kapiGeo, new THREE.MeshStandardMaterial({
    map: orguDokusu(), color: 0x3a3f45, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4,
  }));
  kapiPanel.position.set(0.5, 1.0, 0);
  kapi.add(kapiPanel);
  beam([0.03, 0.12, 0], [0.03, 1.9, 0], 0.04, 0.04, M.sari, kapi);
  beam([0.97, 0.12, 0], [0.97, 1.9, 0], 0.04, 0.04, M.sari, kapi);
  beam([0.03, 1.9, 0], [0.97, 1.9, 0], 0.04, 0.04, M.sari, kapi);
  beam([0.03, 0.12, 0], [0.97, 0.12, 0], 0.04, 0.04, M.sari, kapi);
  box(0.03, 0.14, 0.04, M.siyah, 0.9, 1.05, 0.04, kapi);
  box(0.05, 0.08, 0.05, M.sari, KX1 - 0.05, 1.05, CZ + 0.03, ic);           // kapı emniyet şalteri
  let kapiAci = 0;

  // ışık perdesi: yükleme alanı ile kaynak bölgesi arasında, iki hattı keser
  const PZ0 = 0.45, PZ1 = -1.95;
  for (const z of [PZ0, PZ1]) {
    box(0.08, 2.0, 0.08, M.turuncu, LC_X, 1.0, z, ic);
    box(0.02, 1.7, 0.03, M.siyah, LC_X, 1.05, z + (z > 0 ? -0.045 : 0.045), ic);
  }
  const perdePos = [];
  for (let k = 0; k < 9; k++) { const y = 0.3 + k * 0.19; perdePos.push(LC_X, y, PZ0 - 0.05, LC_X, y, PZ1 + 0.05); }
  const perdeGeo = new THREE.BufferGeometry();
  perdeGeo.setAttribute('position', new THREE.Float32BufferAttribute(perdePos, 3));
  const perdeMat = new THREE.LineBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35 });
  ic.add(new THREE.LineSegments(perdeGeo, perdeMat));

  // operatör panosu + HMI + kule lambası (çitin sağında; yükleme alanının görüşünü kapatmasın)
  const PX = 4.8, PZ = 1.35;
  pano(ic, PX, 0, PZ, 0.7, 1.7, 0.35, 0);
  const ekran = new Ekran(0.44, 0.27, 800);
  ekran.mesh.position.set(PX, 1.3, PZ + 0.207);
  ic.add(ekran.mesh);
  box(0.48, 0.31, 0.02, M.siyah, PX, 1.3, PZ + 0.195, ic);
  acilStop(ic, PX - 0.22, 0.95, PZ + 0.2, 0);
  const kule = kuleLambasi(ic, PX + 0.24, 1.7, PZ);

  // palet (kaynaklı bazalar) + profil stoğu
  const PAL = { x: -2.95, z: 1.0 }, STOK = { x: -2.95, z: -1.15 };
  for (const dz of [-0.7, 0, 0.7]) box(2.1, 0.06, 0.12, M.ahsap, PAL.x, 0.03, PAL.z + dz, ic);
  for (let k = 0; k < 7; k++) box(0.12, 0.03, 1.6, M.ahsap, PAL.x - 0.98 + k * 0.327, 0.075, PAL.z, ic);
  for (let k = 0; k < 5; k++) box(0.11, 0.025, 1.6, M.ahsap, PAL.x - 0.98 + k * 0.49, 0.1, PAL.z, ic);
  const paletYigin = [];
  for (let k = 0; k < 8; k++) {
    const b = bazaSablon();
    b.rotation.x = -Math.PI / 2;
    b.position.set(PAL.x, 0.135 + k * 0.042, PAL.z + BH / 2);
    b.visible = false;
    ic.add(b);
    paletYigin.push(b);
  }
  // stok rafı: yatay profil demeti
  for (const dx of [-0.9, 0, 0.9]) {
    box(0.06, 0.9, 0.06, M.mavi, STOK.x + dx, 0.45, STOK.z - 0.25, ic);
    box(0.06, 0.06, 0.55, M.mavi, STOK.x + dx, 0.5, STOK.z, ic);
    box(0.06, 0.06, 0.55, M.mavi, STOK.x + dx, 0.2, STOK.z, ic);
  }
  for (let k = 0; k < 12; k++) box(2.1, 0.04, 0.04, profilMat, STOK.x, 0.55 + (k % 3) * 0.042, STOK.z - 0.18 + Math.floor(k / 3) * 0.1, ic);
  for (let k = 0; k < 10; k++) box(1.55, 0.04, 0.04, profilMat, STOK.x, 0.25 + (k % 2) * 0.042, STOK.z - 0.2 + Math.floor(k / 2) * 0.09, ic);

  // operatör (ortak FK-1000 tipi model; yüz +Z)
  const opModel = lib.operator({ yelek: 0xff7a1a, baret: 0xffffff });
  const isci = opModel.group;
  ic.add(isci);
  const demet = new THREE.Group();                                           // sağ omuzda profil demeti
  for (let k = 0; k < 4; k++) box(0.04, 0.035, 2.0, profilMat, 0.18 + (k % 2) * 0.045, 1.47 + Math.floor(k / 2) * 0.037, 0.1, demet);
  isci.add(demet);
  const tasinanBaza = bazaSablon();                                          // sağ yanında kaynaklı baza
  tasinanBaza.rotation.y = Math.PI / 2;
  tasinanBaza.position.set(0.42, 0.12, 0);
  isci.add(tasinanBaza);

  // ---------------------------------------------------------------- durum
  let mod = 'oto';            // oto | man
  let durum = 'calisiyor';    // calisiyor | durdu | acil | kapi | perde
  let kapiAcik = false, perdeIhlal = false;
  let sanalOp = true;
  let sira = [];              // HAZIR basılma sırası (pozisyoner indeksleri)
  let palet = 0;
  let uyariMetin = '', uyariT = 0;
  const jog = [0, 0];
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };
  const vardi = (t) => Math.abs(t.s - t.sp) < 0.001 && Math.abs(t.v) < 0.005;
  const baslangicta = (t) => t.s < 0.003 && Math.abs(t.v) < 0.01;

  // ---------------------------------------------------------------- pozisyoner sürüşü
  function pozSur(t, dt) {
    const dur = durum !== 'calisiyor';
    const vh = dur ? 0 : clamp((t.sp - t.s) * 3, -VMAX, VMAX);
    t.v = approach(t.v, vh, (dur ? 3 : 1.2) * dt);
    t.s = clamp(t.s + t.v * dt, 0, STROK);
    t.grup.position.x = XS + t.s;
    t.zincir.guncelle(XS + 1.2, XS + t.s);
    if (t.faz === 'don' && baslangicta(t)) t.faz = 'start';
    if (mod === 'man') t.faz = baslangicta(t) ? 'start' : 'manuel';
    if (robot.sahip === t.i) t.cevrimT += dt;
    // elle dizme (sanal operatör kapalıyken kullanıcı dizer)
    if (t.elleDizme) {
      t.parca = Math.min(1, t.parca + dt / ELLE_DIZME);
      if (t.parca >= 1) { t.elleDizme = false; t.yuk = 'parca'; }
    }
    const n = t.yuk === 'bos' ? 0 : t.yuk === 'yukleniyor' ? Math.floor(t.parca * 8 + 1e-4) : 8;
    t.parcalar.forEach((p, k) => (p.visible = k < n));
    t.isi.forEach((h, k) => {
      t.isi[k] = Math.max(0, h - dt * 0.35);
      t.boncuk[k].userData.mat.emissiveIntensity = t.isi[k] * t.isi[k] * 3;
    });
  }

  function bosalt(t) {
    t.yuk = 'bos'; t.parca = 0; t.hazir = false;
    t.bolgeBitti = [false, false, false];
    t.boncuk.forEach((b) => { b.scale.y = 0.0001; });
    t.isi.fill(0);
  }

  function hazirBas(t) {
    if (!baslangicta(t)) { uyar(`P${t.i + 1} BAŞLANGIÇTA DEĞİL`); return false; }
    if (t.yuk !== 'parca') { uyar(`P${t.i + 1} FİKSTÜR DİZİLMEDİ`); return false; }
    if (t.hazir) return true;
    t.hazir = true;
    sira.push(t.i);
    t.sonYukleme = t.yukT;
    t.ortYukleme = t.ortYukleme ? t.ortYukleme * 0.7 + t.yukT * 0.3 : t.yukT;
    return true;
  }

  // ---------------------------------------------------------------- otomatik sıralama (PLC)
  function otoCevrim() {
    if (robot.sahip == null) {
      if (!evde() || !sira.length) return;
      const i = sira[0], t = T[i];
      if (!baslangicta(t) || t.yuk !== 'parca') { sira.shift(); t.hazir = false; return; }
      if (i === 1 && T[0].s > SERBEST_S) return;   // P1 kaynak bölgesinden çıkmadan arka hatta erişim yok
      sira.shift();
      t.hazir = false;
      robot.sahip = i;
      t.cevrimT = 0;
      t.konum = t.bolgeBitti.indexOf(false);
      t.faz = 'git';
      t.sp = DURAK[t.konum];
      return;
    }
    const t = T[robot.sahip];
    if (t.faz === 'git') {
      if (vardi(t)) { t.faz = 'kaynak'; kaynakProgrami(t, t.konum); }
    } else if (t.faz === 'kaynak' && !mesgul()) {
      const k = t.bolgeBitti.indexOf(false);
      if (k >= 0) { t.konum = k; t.faz = 'git'; t.sp = DURAK[k]; }
      else { t.faz = 'don'; t.sp = 0; robot.sahip = null; }   // başlangıca dön; robot sıradakine geçer
    }
  }

  // Manuel → otomatik: bölgedeki pozisyonerleri tutarlı bir faza oturt
  function otoyaGec() {
    robot.sahip = null;
    for (const t of T) {
      t.sp = t.s;
      if (baslangicta(t)) { t.faz = 'start'; continue; }
      if (t.yuk === 'parca' && t.bolgeBitti.includes(false) && robot.sahip == null && !(t.i === 1 && T[0].s > SERBEST_S)) {
        robot.sahip = t.i; t.konum = t.bolgeBitti.indexOf(false); t.faz = 'git'; t.sp = DURAK[t.konum];
      } else { t.faz = 'don'; t.sp = 0; }
    }
    sira = sira.filter((i) => T[i].hazir && T[i].i !== robot.sahip);
  }

  function manuelSur() {
    T.forEach((t, i) => {
      if (!jog[i]) { t.sp = t.s; return; }
      if (!evde()) { uyar('ROBOT EVDE DEĞİL · POZİSYONER KİLİTLİ'); t.sp = t.s; return; }
      t.sp = clamp(t.s + jog[i] * 0.4, 0, STROK);
    });
  }

  function manuelKaynak() {
    if (mod !== 'man' || durum !== 'calisiyor') { uyar('MANUEL MODDA BAŞLAT'); return; }
    if (mesgul()) return;
    for (const t of T) {
      const k = DURAK.findIndex((d) => Math.abs(t.s - d) < 0.01);
      if (k < 0 || t.yuk !== 'parca' || t.bolgeBitti[k]) continue;
      if (t.i === 1 && T[0].s > SERBEST_S) { uyar('P1 ÖNDE · ARKA FİKSTÜRE ERİŞİM YOK'); return; }
      kaynakProgrami(t, k);
      return;
    }
    uyar('K1/K2/K3\'TE KAYNAKLANACAK BAZA YOK');
  }

  // ---------------------------------------------------------------- sanal operatör
  // Görev listesi: {tip:'yuru', x, z} | {tip:'is', sure, yon, kosul?, basla?, guncelle?(k), bit?}
  const op = { x: -1.7, z: 1.4, yon: 0, adimlar: [], yuruyor: false, metin: 'bekliyor' };
  const NOKTA = {
    p1: { x: XS, z: HAT_Z[0] + 0.62, yon: Math.PI },          // P1 fikstür önü
    p2: { x: XS - FW / 2 - 0.42, z: HAT_Z[1] + 0.28, yon: Math.PI / 2 }, // P2 sol uç (ön hat ile arası)
    b1: { x: XS - FW / 2 - 0.14, z: HAT_Z[0] + 0.5, yon: Math.PI },
    palet: { x: PAL.x + 1.32, z: PAL.z, yon: -Math.PI / 2 },
    stok: { x: STOK.x + 0.3, z: STOK.z + 0.62, yon: Math.PI },
    bekle: { x: -1.7, z: 1.45, yon: 0.3 },
  };
  const yuru = (n) => ({ tip: 'yuru', x: n.x, z: n.z, son: n.yon });

  function opPlanla() {
    const basta = T.filter((t) => baslangicta(t) && t.faz === 'start');
    // 1) kaynaklı baza → al, palete koy
    let t = basta.find((x) => x.yuk === 'kaynakli');
    if (t) {
      const n = t.i ? NOKTA.p2 : NOKTA.p1;
      op.adimlar = [
        yuru(n),
        { tip: 'is', sure: BOSALTMA_SURE, yon: n.yon, metin: `P${t.i + 1} bazayı alıyor`, kosul: () => baslangicta(t),
          guncelle: (k) => { if (k > 0.4 && t.yuk === 'kaynakli') { bosalt(t); tasinanBaza.visible = true; } } },
        yuru(NOKTA.palet),
        { tip: 'is', sure: 1.2, yon: NOKTA.palet.yon, metin: 'palete koyuyor', bit: () => { tasinanBaza.visible = false; palet++; } },
      ];
      return;
    }
    // 2) dizilmiş ama HAZIR'a basılmamış (ör. manuelden dönüş) → butona bas
    t = basta.find((x) => x.yuk === 'parca' && !x.hazir);
    if (t) {
      const n = t.i ? NOKTA.p2 : NOKTA.b1;
      op.adimlar = [yuru(n), { tip: 'is', sure: 0.6, yon: n.yon, metin: `P${t.i + 1} HAZIR`, bit: () => hazirBas(t) }];
      return;
    }
    // 3) boş fikstür → stoktan parça al, diz, HAZIR'a bas (önce P1, sonra P2: alternatif)
    const bos = basta.filter((x) => x.yuk === 'bos');
    if (bos.length) {
      t = bos.length === 2 ? T[0] : bos[0];
      const n = t.i ? NOKTA.p2 : NOKTA.p1;
      const b = t.i ? NOKTA.p2 : NOKTA.b1;
      op.adimlar = [
        yuru(NOKTA.stok),
        { tip: 'is', sure: 1.0, yon: NOKTA.stok.yon, metin: 'stoktan profil alıyor', bit: () => { demet.visible = true; } },
        yuru(n),
        { tip: 'is', sure: YUKLEME_SURE, yon: n.yon, metin: `P${t.i + 1} parçaları diziyor`, kosul: () => baslangicta(t),
          basla: () => { demet.visible = false; t.yuk = 'yukleniyor'; t.parca = 0; t.yukT = 0; },
          guncelle: (k) => { t.parca = k; if (!t.i) op.x = XS - 0.8 + 1.6 * k; },
          bit: () => { t.yuk = 'parca'; } },
        yuru(b),
        { tip: 'is', sure: 0.6, yon: b.yon, metin: `P${t.i + 1} HAZIR butonuna basıyor`, bit: () => hazirBas(t) },
      ];
      return;
    }
    const B = NOKTA.bekle;
    if (Math.hypot(op.x - B.x, op.z - B.z) > 0.05) op.adimlar = [yuru(B)];
  }

  function opIptal() {
    op.adimlar = [];
    demet.visible = false; tasinanBaza.visible = false;
    for (const t of T) if (t.yuk === 'yukleniyor' && !t.elleDizme) { t.yuk = 'bos'; t.parca = 0; }
  }

  function opGuncelle(dt, tm) {
    T.forEach((t) => { if (t.yuk === 'yukleniyor' || (t.yuk === 'parca' && !t.hazir)) t.yukT += dt; });
    if (!op.adimlar.length && sanalOp) opPlanla();
    const a = op.adimlar[0];
    op.yuruyor = false;
    if (a) {
      if (a.tip === 'yuru') {
        const dx = a.x - op.x, dz = a.z - op.z, d = Math.hypot(dx, dz), adim = 1.3 * dt;
        if (d <= adim) { op.x = a.x; op.z = a.z; if (a.son != null) op.yon = a.son; op.adimlar.shift(); }
        else { op.x += (dx / d) * adim; op.z += (dz / d) * adim; op.yon = Math.atan2(dx, dz); op.yuruyor = true; }
        op.metin = 'yürüyor';
      } else {
        if (!a._basladi) { a._basladi = true; a._t = 0; a.basla?.(); }
        if (a.kosul && !a.kosul()) { opIptal(); return; }
        a._t += dt;
        op.yon = a.yon;
        op.metin = a.metin;
        const k = Math.min(1, a._t / a.sure);
        a.guncelle?.(k);
        if (k >= 1) { op.adimlar.shift(); a.bit?.(); }
      }
    } else op.metin = sanalOp ? 'bekliyor' : 'kapalı (dizme/boşaltma sende)';
    // poz: omuzda demet → sağ kol destekte; baza taşırken kollar yanda; iş başında kollar önde
    const isBasinda = a && a.tip === 'is';
    opModel.poz(demet.visible ? 'sag' : tasinanBaza.visible ? 'yan' : isBasinda ? 'on' : 'yan');
    isci.position.set(op.x, opModel.yuru(tm, op.yuruyor), op.z);
    let fark = op.yon - isci.rotation.y;
    fark = Math.atan2(Math.sin(fark), Math.cos(fark));
    isci.rotation.y += fark * (1 - Math.exp(-10 * dt));
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'P1 (ön)', renk: '#39c5cf' }, { ad: 'P2 (arka)', renk: '#f2c200' }], { min: 0, max: 2500, uzunluk: 300 });
  const ekranZ = throttle(4);

  function update(dt, tm) {
    if (durum === 'calisiyor') {
      if (mod === 'oto') otoCevrim(); else manuelSur();
      robotGuncelle(dt);
    } else kaynakAcik = false;
    T.forEach((x) => pozSur(x, dt));
    if (durum !== 'acil') opGuncelle(dt, tm);
    uyariT = Math.max(0, uyariT - dt);

    // torç ucu: kaynakta hafif salınım (weaving)
    _uc.copy(robot.P);
    if (kaynakAcik) _uc.y += Math.sin(tm * 26) * 0.004;
    ikUygula(_uc);
    kivilcimGuncelle(dt);

    // HAZIR lambaları: sırada = sabit yeşil, dizildi/basılmadı = yanıp söner
    T.forEach((t) => {
      t.hazirLamba.emissiveIntensity = t.hazir ? 2.4
        : t.yuk === 'parca' && baslangicta(t) ? (Math.sin(tm * 6) > 0 ? 2.2 : 0.1) : 0.05;
    });
    // ışık perdesi: pozisyoner geçerken susturulur (amber), ihlalde kırmızı yanıp söner
    const gecis = T.some((t) => XS + t.s + FW / 2 > LC_X - 0.02 && XS + t.s - FW / 2 < LC_X);
    perdeMat.color.setHex(perdeIhlal ? 0xff2010 : gecis ? 0xffb020 : 0xff3020);
    perdeMat.opacity = perdeIhlal ? (Math.sin(tm * 10) > 0 ? 0.9 : 0.2) : gecis ? 0.55 : 0.3;

    kapiAci = damp(kapiAci, kapiAcik ? 1.45 : 0, 4, dt);
    kapi.rotation.y = kapiAci;

    paletYigin.forEach((b, k) => { b.visible = palet > 0 && k < ((palet - 1) % 8) + 1; });

    const d = durumBilgi();
    kule.set(d.seviye, tm);
    trend.ornekle(dt, [T[0].s * 1000, T[1].s * 1000]);
    if (ekranZ(dt)) ekran.ciz((x, W, H) => hmiCiz(x, W, H, d));
  }

  // ---------------------------------------------------------------- HMI (fotoğraftaki ekranın düzeni)
  function hmiCiz(x, W, H, d) {
    x.fillStyle = '#e3e6e8'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(150,160,170,.28)'; x.lineWidth = 1;
    for (let i = -H; i < W; i += 30) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke();
      x.beginPath(); x.moveTo(i + H, 0); x.lineTo(i, H); x.stroke();
    }
    const yaz = (s, px, py, size, renk = '#1d2125', hiza = 'left', kalin = 600) => {
      x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
      x.font = `${kalin} ${size}px "Space Grotesk", sans-serif`;
      x.fillText(s, px, py);
    };
    const kutu = (px, py, w, h, dolgu = null, cizgi = '#3c4248', lw = 2) => {
      x.beginPath(); x.roundRect(px, py, w, h, 8);
      if (dolgu) { x.fillStyle = dolgu; x.fill(); }
      x.strokeStyle = cizgi; x.lineWidth = lw; x.stroke();
    };
    const deger = (s, px, py, w = 92) => {
      kutu(px, py - 15, w, 30, '#d9dee2', '#555', 2);
      yaz(s, px + w / 2, py, 19, '#111', 'center', 700);
    };
    // başlık + alarm şeridi
    x.fillStyle = '#26292c'; x.fillRect(12, 10, 190, 52);
    yaz('KAYNAK', 107, 28, 20, '#fff', 'center', 700);
    yaz('HÜCRESİ', 107, 48, 15, '#c9d0d6', 'center', 600);
    kutu(220, 12, 470, 48, '#e9ecee', '#2b2f33', 4);
    const alarm = d.seviye === 'alarm' || d.seviye === 'uyari';
    yaz(alarm ? d.metin : 'Sistem normal', 455, 36, 19, alarm ? '#d0201b' : '#4b5560', 'center', 600);
    x.beginPath(); x.arc(748, 36, 26, 0, Math.PI * 2); x.strokeStyle = '#26292c'; x.lineWidth = 5; x.stroke();
    for (const k of [-9, 0, 9]) x.fillRect(734, 36 + k - 2, 28, 4);

    // pozisyoner konum çubukları (2500 → 0) + K1/K2/K3 işaretleri
    kutu(12, 74, 460, 216, null, '#4a5158', 2);
    T.forEach((t, i) => {
      const y0 = 92 + i * 102, xa = 40, xb = 430;
      const xs = (s) => xb - ((xb - xa) * s) / STROK;
      x.strokeStyle = '#2a2f34'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(xa, y0 + 8); x.lineTo(xb, y0 + 8); x.stroke();
      for (let k = 0; k <= 10; k++) {
        const px = xa + ((xb - xa) * k) / 10;
        x.beginPath(); x.moveTo(px, y0 + 8); x.lineTo(px, y0 + (k % 2 ? 14 : 20)); x.stroke();
        if (k % 2 === 0) yaz(String(2500 - k * 250) + '.0', px, y0 - 2, 10, '#333', 'center', 500);
      }
      const cy = y0 + 50, r = 24;
      const px = xs(t.s);
      if (Math.abs(t.v) > 0.01) { x.fillStyle = '#e8352f'; x.fillRect(xa, cy - r, px - xa, 2 * r); }
      x.strokeStyle = '#2a2f34'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(xa, cy - r); x.lineTo(xb, cy - r); x.moveTo(xa, cy + r); x.lineTo(xb, cy + r); x.stroke();
      DURAK.forEach((s, k) => {
        const kx = xs(s);
        const aktif = robot.program === t && robot.bolge === k;
        x.fillStyle = t.bolgeBitti[k] ? '#2e8b3a' : aktif ? '#e8352f' : '#7a838c';
        x.beginPath(); x.moveTo(kx, cy - r - 2); x.lineTo(kx - 6, cy - r - 12); x.lineTo(kx + 6, cy - r - 12); x.fill();
        yaz(`K${k + 1}`, kx, cy + r + 10, 10, '#333', 'center', 700);
      });
      x.beginPath(); x.ellipse(xa, cy, 16, r, 0, 0, Math.PI * 2); x.fillStyle = '#eef0f1'; x.fill(); x.stroke();
      x.beginPath(); x.ellipse(px, cy, 16, r, 0, 0, Math.PI * 2); x.fillStyle = t.hazir ? '#2e8b3a' : '#2a2d31'; x.fill(); x.stroke();
      yaz(`T${i + 1}`, xb + 22, cy - 8, 15, '#333', 'center', 700);
      yaz(i ? 'Arka' : 'Ön', xb + 22, cy + 10, 11, '#555', 'center', 600);
    });

    // ortalamalar
    kutu(484, 74, 304, 216, null, '#4a5158', 2);
    T.forEach((t, i) => {
      const y0 = 92 + i * 106;
      yaz(`Ortalama Tabla ${i + 1}`, 636, y0, 17, '#222', 'center', 700);
      yaz('Kaynak', 560, y0 + 25, 15, '#222', 'right'); deger(fmt(t.ortKaynak, 1), 570, y0 + 25, 84); yaz('Saniye', 664, y0 + 25, 14, '#222');
      yaz('Yükleme', 560, y0 + 52, 15, '#222', 'right'); deger(fmt(t.ortYukleme, 1), 570, y0 + 52, 84); yaz('Saniye', 664, y0 + 52, 14, '#222');
      deger(String(t.adet), 570, y0 + 79, 84); yaz('Adet', 664, y0 + 79, 14, '#222');
    });

    // alt sıra: üretim, mod + sıra, robot
    kutu(12, 300, 230, 180, null, '#4a5158', 2);
    yaz('Üretim Adet', 127, 325, 17, '#222', 'center', 700);
    T.forEach((t, i) => { yaz(`Tabla ${i + 1}`, 30, 362 + i * 40, 15, '#222'); deger(String(t.adet), 110, 362 + i * 40, 90); yaz('adet', 210, 362 + i * 40, 13, '#222'); });
    yaz('Palet', 30, 442, 15, '#222'); deger(String(palet), 110, 442, 90); yaz('baza', 210, 442, 13, '#222');
    kutu(252, 300, 270, 180, null, '#4a5158', 2);
    yaz('Çift Tabla Seçili', 330, 322, 15, '#222', 'center', 700);
    yaz(mod === 'oto' ? 'Otomatik Seçili' : 'Manuel Seçili', 452, 322, 15, '#222', 'center', 700);
    kutu(298, 340, 64, 56, '#d8322c', '#7a1a16', 3);
    kutu(408, 344, 92, 48, null, '#222', 4);
    yaz(mod === 'oto' ? 'AUTO' : 'MAN', 454, 368, 26, '#111', 'center', 800);
    yaz(`Sıra: ${sira.length ? sira.map((i) => 'T' + (i + 1)).join(' → ') : '—'}`, 387, 420, 15, '#222', 'center', 700);
    const hv = T.some((t) => Math.abs(t.v) > 0.01) || mesgul();
    yaz(hv ? 'Hareket Var' : 'Hareket Yok', 387, 455, 15, '#222', 'center', 700);
    kutu(532, 300, 256, 180, null, '#4a5158', 2);
    yaz('Robot', 660, 322, 16, '#222', 'center', 700);
    const rt = robot.program ? `Tabla ${robot.program.i + 1} · K${robot.bolge + 1}` : evde() ? 'Evde (güvenli)' : 'Eve dönüyor';
    yaz(rt, 660, 356, 17, robot.program ? '#c0221c' : '#222', 'center', 700);
    yaz('Dikiş', 560, 396, 14, '#222', 'right');
    deger(robot.program ? `${robot.dikisNo}/${robot.dikisToplam}` : '—', 570, 396, 84);
    yaz('Çevrim', 560, 436, 14, '#222', 'right');
    const sahipT = robot.sahip != null ? T[robot.sahip].cevrimT : 0;
    deger(fmt(sahipT, 1), 570, 436, 84); yaz('Saniye', 664, 436, 13, '#222');
  }

  // ---------------------------------------------------------------- durum + arayüz
  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'kapi') return { metin: 'KAPI AÇIK · KİLİT', seviye: 'alarm' };
    if (durum === 'perde') return { metin: 'IŞIK PERDESİ İHLALİ', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (mod === 'man') return mesgul() ? { metin: 'MANUEL · KAYNAK', seviye: 'calisiyor' } : { metin: 'MANUEL', seviye: 'bekliyor' };
    if (robot.sahip != null) {
      const t = T[robot.sahip];
      return { metin: `OTOMATİK · P${t.i + 1} K${t.konum + 1} ${t.faz === 'kaynak' ? 'KAYNAK' : 'KONUMA GİDİYOR'}`, seviye: 'calisiyor' };
    }
    if (sira[0] === 1 && T[0].s > SERBEST_S) return { metin: 'P2 HAZIR · P1 BÖLGEDEN ÇIKIYOR', seviye: 'calisiyor' };
    if (T.some((t) => t.faz === 'don')) return { metin: 'OTOMATİK · BAŞLANGICA DÖNÜŞ', seviye: 'calisiyor' };
    return { metin: 'HAZIR POZİSYONER BEKLENİYOR', seviye: 'uyari' };
  }

  function pozDurum(t) {
    if (t.faz === 'git') return `K${t.konum + 1} konumuna gidiyor`;
    if (t.faz === 'kaynak') return robot.program === t ? `K${t.konum + 1} · kaynak ${robot.dikisNo}/${robot.dikisToplam}` : `K${t.konum + 1}`;
    if (t.faz === 'don') return 'başlangıca dönüyor';
    if (t.faz === 'manuel') {
      const k = DURAK.findIndex((s) => Math.abs(t.s - s) < 0.01);
      return k >= 0 ? `K${k + 1} konumunda` : 'manuel';
    }
    if (t.yuk === 'bos') return 'başlangıçta · boş';
    if (t.yuk === 'yukleniyor') return `diziliyor %${Math.round(t.parca * 100)}`;
    if (t.yuk === 'kaynakli') return 'kaynaklı · alınmayı bekliyor';
    if (t.hazir) {
      if (robot.sahip != null && robot.sahip !== t.i) return `HAZIR · P${robot.sahip + 1} bitince gelecek`;
      if (t.i === 1 && T[0].s > SERBEST_S) return 'HAZIR · P1 bölgeden çıkıyor';
      return 'HAZIR · sırada';
    }
    return 'dizildi · HAZIR bekleniyor';
  }

  const elle = (i, fn) => () => {
    if (sanalOp) { uyar('ÖNCE SANAL OPERATÖRÜ KAPAT'); return; }
    fn(T[i]);
  };
  const elleDiz = (t) => {
    if (!baslangicta(t)) return uyar(`P${t.i + 1} BAŞLANGIÇTA DEĞİL`);
    if (t.yuk !== 'bos') return uyar(t.yuk === 'kaynakli' ? `P${t.i + 1} ÖNCE BAZAYI AL` : `P${t.i + 1} ZATEN DİZİLİ`);
    t.yuk = 'yukleniyor'; t.parca = 0; t.yukT = 0; t.elleDizme = true;
  };
  const elleAl = (t) => {
    if (!baslangicta(t) || t.yuk !== 'kaynakli') return uyar(`P${t.i + 1} ALINACAK KAYNAKLI BAZA YOK`);
    bosalt(t); palet++;
  };
  const opSatiri = (i) => ({ tip: 'butonlar', ogeler: [
    { metin: `P${i + 1} · Diz`, tik: elle(i, elleDiz) },
    { metin: `P${i + 1} · HAZIR`, tur: 'basla', tik: elle(i, hazirBas) },
    { metin: `P${i + 1} · Bazayı al`, tik: elle(i, elleAl) },
  ] });

  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik (çift pozisyoner)'], ['man', 'Manuel']], get: () => mod,
      set: (v) => { mod = v; jog[0] = jog[1] = 0; if (v === 'oto') otoyaGec(); else { robot.sahip = null; T.forEach((t) => (t.sp = t.s)); } } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'baslik', metin: 'Operatör' },
    { tip: 'anahtar', metin: 'Sanal operatör (dizme / HAZIR / boşaltma)', get: () => sanalOp,
      set: (v) => { sanalOp = v; if (!v) opIptal(); } },
    opSatiri(0),
    opSatiri(1),
    { tip: 'baslik', metin: 'Manuel pozisyoner (mod: Manuel)' },
    { tip: 'basili', ogeler: [
      { metin: 'P1 ◀ başlangıç', bas: () => (jog[0] = mod === 'man' ? -1 : 0), birak: () => (jog[0] = 0) },
      { metin: 'P1 ▶ robot', bas: () => (jog[0] = mod === 'man' ? 1 : 0), birak: () => (jog[0] = 0) },
    ] },
    { tip: 'basili', ogeler: [
      { metin: 'P2 ◀ başlangıç', bas: () => (jog[1] = mod === 'man' ? -1 : 0), birak: () => (jog[1] = 0) },
      { metin: 'P2 ▶ robot', bas: () => (jog[1] = mod === 'man' ? 1 : 0), birak: () => (jog[1] = 0) },
    ] },
    { tip: 'butonlar', ogeler: [{ metin: 'Bulunduğu K konumunu kaynakla', tur: 'basla', tik: manuelKaynak }] },
    { tip: 'kaydirici', metin: 'Kaynak akımı', min: 120, max: 280, adim: 5, birim: 'A', get: () => akim, set: (v) => (akim = v) },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'anahtar', metin: 'Güvenlik kapısı açık', get: () => kapiAcik,
      set: (v) => { kapiAcik = v; if (v && durum !== 'acil') durum = 'kapi'; else if (!v && durum === 'kapi') durum = perdeIhlal ? 'perde' : 'durdu'; } },
    { tip: 'anahtar', metin: 'Işık perdesi ihlali (kaynak bölgesine giriş)', get: () => perdeIhlal,
      set: (v) => { perdeIhlal = v; if (v && durum !== 'acil') durum = 'perde'; else if (!v && durum === 'perde') durum = kapiAcik ? 'kapi' : 'durdu'; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') durum = kapiAcik ? 'kapi' : perdeIhlal ? 'perde' : 'durdu'; } },
    ] },
  ];

  // Açılış: P1 dizili ve HAZIR (robota gidiyor), operatör P2'yi dizmeye başlar
  T[0].yuk = 'parca'; T[0].parca = 1; T[0].yukT = 8.5;
  hazirBas(T[0]);
  isci.position.set(op.x, 0, op.z);
  demet.visible = false; tasinanBaza.visible = false;

  // performans: hareketli rijit grupların KENDİ içindeki sabit parçaları da birleştir
  // (birleşen mesh grubun çocuğu olur, grupla birlikte hareket eder; görüntü aynı)
  if (lib.sabitle && new URLSearchParams(location.search).get('sabit') !== '0') {
    T.forEach((t) => lib.sabitle(t.grup, [...t.parcalar, ...t.boncuk]));   // fikstür çerçevesi + kızak
    lib.sabitle(J1, [ust]); lib.sabitle(ust, [on]); lib.sabitle(on, [bilek]); lib.sabitle(bilek, [ark]);
  }

  return {
    id: 'kaynak',
    ad: 'Kaynak Robotu Hücresi',
    altBaslik: 'Arkalı önlü 2 pozisyoner · S7-1200 · Servo',
    kisa: 'Baza kaynağı: operatör parçaları fikstüre dizip HAZIR\'a basar, pozisyoner robotun önüne gelip 3 konumda durur, robot her konumda o bölgeyi kaynatır ve pozisyoner başlangıca döner. Arkalı önlü iki pozisyoner robotla haberleşerek sırayla çalışır.',
    proje: 'welding',
    ayakIzi: [9.8, 5.2],
    kamera: { poz: [-2.9, 4.6, 6.8], hedef: [0.6, 1.0, -0.4] },
    mekanizmalar: [
      'P1 (ön) ve P2 (arka) pozisyoner: servo ile ayrı paralel raylarda 0–2500 mm; K1 (1100), K2 (1800), K3 (2500 mm) konumlarında durur',
      'Robot 6 eksen: sabit kaide, ön hattın önünde; arka fikstüre ön hattın üstünden uzanır. Torç ucu her konumdaki dikişleri analitik IK ile izler',
      'Kaynak: ark ışığı + kıvılcım; dikiş boncuğu ilerleyerek uzar, kızgın turuncudan koyuya soğur',
      'HAZIR butonu (her pozisyonerin sol ucunda): dizildiyse yanıp söner, basılınca sabit yeşil (sırada)',
      'Enerji zincirleri pozisyonerle açılıp kapanır; ışık perdesi pozisyoner geçerken susturulur (amber)',
      'Operatör: kaynaklı bazayı alıp palete koyar, stoktan profil alıp fikstüre dizer, HAZIR\'a basar',
    ],
    cikarim: [
      'SENİN TARİFİN: iki pozisyoner arkalı önlü, robot önde (sabit kaide), pozisyoner yalnız doğrusal; 3 konumda durup kaynak; robot tek pozisyonerde çalışır, diğeri hazırsa bekler; bitince başlangıca dönüp operatöre gelir.',
      'Kilit mantığı: pozisyoner yalnız robot evdeyken hareket eder; P2\'ye geçiş için P1\'in kaynak bölgesinden çıkmış olması gerekir (ön fikstür arka fikstürün önünü kapatır).',
      'HMI fotoğrafı (Çift Tabla / AUTO, 2500→0 cetvel, ortalama kaynak/yükleme, adet) korundu; T1 = ön, T2 = arka; K1/K2/K3 işaretleri ve sıra/robot kutusu eklendi.',
      'TAHMİN: baza ölçüsü (2.0 × 1.5 m), profil/eklem yerleşimi, konum değerleri (1100/1800/2500), hat arası mesafe, palet ve stok yeri, ışık perdesi + çit.',
      'TAHMİN: operatör arka fikstüre sol uçtan erişiyor. Süreler hızlandırıldı (HMI\'da gerçek ortalama kaynak ~280 s, yükleme ~640 s).',
    ],
    group: g,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (lib.sabitle)
    sabitHaric: () => [
      ...T.map((t) => t.grup), ...T.map((t) => t.zincir.group),   // pozisyonerler (kayar, parça görünürlüğü, dikişler)
      J1,                                                         // robot kolu (tüm eklemler + ark)
      kapi,                                                       // güvenlik kapısı (döner)
      isci,                                                       // operatör + taşınan demet / baza
      ...paletYigin,                                              // palet yığını (görünürlük)
    ],
    update,
    kontroller,
    degerler: () => [
      ['P1 (ön)', `${fmt(T[0].s * 1000, 0)} mm · ${pozDurum(T[0])}`],
      ['P2 (arka)', `${fmt(T[1].s * 1000, 0)} mm · ${pozDurum(T[1])}`],
      ['Robot', robot.program ? `P${robot.program.i + 1} · K${robot.bolge + 1} · dikiş ${robot.dikisNo}/${robot.dikisToplam}` : evde() ? 'evde (güvenli)' : 'eve dönüyor'],
      ['HAZIR sırası', sira.length ? sira.map((i) => 'P' + (i + 1)).join(' → ') : '—'],
      ['Kaynak akımı', kaynakAcik ? `${fmt(akim + gurultu(6), 0)} A` : '0 A'],
      ['Üretim P1 / P2', `${T[0].adet} / ${T[1].adet} baza`],
      ['Palet', `${palet} baza`],
      ['Operatör', op.metin],
    ],
    trend,
    durum: durumBilgi,
  };
}
