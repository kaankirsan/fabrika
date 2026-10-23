// js/machines/saft.js — Şaft Başı Sökme Makinesi (MKN-V04 + MKN-V05).
//
// Kaan'ın tarifi: arabaların şaftlarının başlarını sökmeye yarayan makine.
// Videodan: mavi dikey gövde, mavi tel koruma, sarı çift el kumanda istasyonu
// (ortada acil stop, iki yanda yeşil butonlar), kanallı (spline) uçlu krom
// homokinetik mafsal başı siyah çatal bloklara oturuyor, şaft aşağı uzanıyor;
// HMI "SET DEĞERLER: Max Peak, Min Peak, Çek, Kilitle", "Prosesi Durdur".
//
// Çevrim: operatör şaftı yerleştirir → KİLİTLE (alt çeneler şaftı sıkar) → çift el
// ile ÇEK (hidrolik silindir şaftı aşağı çeker; mafsal başı çatalda kalır, segman
// bırakınca kuvvet tepe yapıp düşer) → tepe kuvvet Min…Max içindeyse OK, değilse NOK →
// baş ve şaft ayrı kasalara (NOK ayrı kasaya).
// Çift el (EN 574 mantığı): iki buton 0.5 s içinde basılmalı, çekme boyunca ikisi de
// basılı tutulmalı; biri bırakılırsa çekme durur, yeniden başlamak için ikisi de bırakılır.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop,
    canvasTex, orguDokusu, clamp, approach, damp, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const mavi = mat(0x1f63b8, { r: 0.45, m: 0.3, key: 'saft-mavi' });
  const siyah = mat(0x1d1f22, { r: 0.55, m: 0.45, key: 'saft-siyah' });
  const sari = mat(0xf2b600, { r: 0.45, m: 0.15, key: 'saft-sari' });

  // ---------------------------------------------------------------- gövde
  const TY = 0.92;                                            // tabla üstü
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, TY, 0.08, mavi, sx * 0.46, TY / 2, sz * 0.36, g);
  box(1.0, 0.05, 0.8, M.celik, 0, TY - 0.025, 0, g);          // tabla
  box(0.98, 0.04, 0.78, mavi, 0, 0.06, 0, g);                 // alt çerçeve
  box(0.96, 0.8, 0.02, mavi, 0, 0.5, -0.38, g);               // arka panel
  for (const sx of [-1, 1]) box(0.02, 0.8, 0.72, mavi, sx * 0.48, 0.5, 0, g);
  // üst çerçeve: kolonlar + tepe kirişi
  for (const sx of [-1, 1]) box(0.1, 1.25, 0.12, mavi, sx * 0.42, TY + 0.625, -0.12, g);
  box(0.94, 0.12, 0.16, mavi, 0, TY + 1.25, -0.12, g);
  // tel koruma (yanlar + arka üst bölge, alt bölgenin önü)
  const orguMat = new THREE.MeshStandardMaterial({
    map: orguDokusu(), color: 0x2a64c0, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3,
  });
  function tel(w, h, x, y, z, ry) {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 0.04, (uv.getY(i) * h) / 0.04);
    const p = new THREE.Mesh(geo, orguMat);
    p.position.set(x, y, z); p.rotation.y = ry;
    g.add(p);
  }
  for (const sx of [-1, 1]) tel(0.62, 1.15, sx * 0.47, TY + 0.6, 0.12, Math.PI / 2);
  tel(0.84, 1.15, 0, TY + 0.6, -0.2, 0);
  tel(0.92, 0.7, 0, 0.5, 0.39, 0);                             // alt bölme önü (silindir görünsün)

  // çatal: iki ağır siyah blok, ortada şaft yarığı; altında taşıyıcı plakalar
  const CY = TY + 0.33;                                       // çatal üstü
  for (const sx of [-1, 1]) {
    box(0.26, 0.12, 0.28, siyah, sx * 0.165, CY - 0.06, 0, g);
    box(0.08, 0.27, 0.28, siyah, sx * 0.3, TY + 0.135, 0, g);
    for (let i = 0; i < 3; i++) cyl(0.012, 0.03, M.celik, sx * 0.165, CY - 0.06, 0.14 + 0.001, g, { eksen: 'z', seg: 8 }).position.x = sx * (0.08 + i * 0.07);
  }

  // ---------------------------------------------------------------- iş parçası
  // mafsal başı (çan + kanallı uç) çatalda kalır; şaft alt çenelerle birlikte aşağı çekilir
  const kanalTex = canvasTex(32, 64, (x, w, h) => {
    x.fillStyle = '#9aa1a8'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5a6067'; for (let i = 0; i < 4; i++) x.fillRect(i * 8, 0, 3, h);
  }, { tekrar: [6, 1] });
  const kanalMat = new THREE.MeshStandardMaterial({ map: kanalTex, roughness: 0.3, metalness: 0.9 });
  const bas = new THREE.Group();
  g.add(bas);
  cyl(0.062, 0.1, M.krom, 0, CY + 0.05, 0, bas, { seg: 26 });
  cyl(0.05, 0.03, M.krom, 0, CY + 0.115, 0, bas, { r2: 0.062, seg: 22 });
  cyl(0.018, 0.22, kanalMat, 0, CY + 0.24, 0, bas, { seg: 14 });
  cyl(0.012, 0.05, M.celik, 0, CY + 0.375, 0, bas, { seg: 10 });
  const mil = new THREE.Group();
  g.add(mil);
  cyl(0.016, 0.82, M.celik, 0, CY - 0.41 + 0.02, 0, mil, { seg: 14 });
  cyl(0.03, 0.05, M.koyu, 0, CY - 0.1, 0, mil, { seg: 14 });  // iç bilezik (tripod) izi

  // ---------------------------------------------------------------- çekici: hidrolik silindir + kilit çeneleri
  const SY0 = 0.62;                                           // çekici başlangıç yüksekliği
  const STROK = 0.14;
  cyl(0.065, 0.32, M.siyah, 0, 0.22, 0, g, { seg: 18 });       // silindir gövdesi
  cyl(0.08, 0.03, M.koyu, 0, 0.395, 0, g, { seg: 18 });
  const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 12);
  rodGeo.translate(0, 0.5, 0);
  const silMil = new THREE.Mesh(rodGeo, M.krom);
  silMil.position.y = 0.41; silMil.castShadow = true;
  g.add(silMil);
  const cekici = new THREE.Group();
  g.add(cekici);
  box(0.3, 0.06, 0.16, siyah, 0, -0.04, 0, cekici);
  const ceneler = [-1, 1].map((sx) => box(0.08, 0.09, 0.12, M.celik, sx * 0.1, 0.02, 0, cekici));
  for (const sx of [-1, 1]) rod([sx * 0.13, -0.04, 0], [sx * 0.13, 0.12, 0], 0.01, M.krom, cekici); // kılavuz

  // ---------------------------------------------------------------- çift el istasyonu (sarı)
  const CEX = -0.55, CEZ = 0.75;
  box(0.06, 0.95, 0.06, M.koyu, CEX, 0.475, CEZ, g);
  box(0.36, 0.03, 0.3, M.koyu, CEX, 0.015, CEZ, g);
  box(0.66, 0.11, 0.2, sari, CEX, 1.0, CEZ, g);
  for (const sx of [-1, 1]) box(0.12, 0.05, 0.22, sari, CEX + sx * 0.3, 1.05, CEZ, g);
  acilStop(g, CEX, 1.09, CEZ, 0).rotation.x = -Math.PI / 2;
  const elLamba = [-1, 1].map((sx) => {
    const m = lamba(0x2ee66b, 0.1);
    cyl(0.032, 0.025, m, CEX + sx * 0.3, 1.09, CEZ, g, { seg: 16 });
    return m;
  });

  // ---------------------------------------------------------------- HMI paneli + hidrolik ünite + kule
  const hmi = new THREE.Group();
  hmi.position.set(0.74, 1.42, 0.22);
  hmi.rotation.y = 0.35;
  g.add(hmi);
  rod([-0.18, -0.02, -0.05], [-0.26, -0.05, -0.32], 0.02, M.koyu, hmi);
  box(0.42, 0.33, 0.06, mat(0xbfc4c9, { r: 0.5, m: 0.3, key: 'saft-hmi' }), 0, 0, 0, hmi);
  const ekran = new Ekran(0.32, 0.2, 640);
  ekran.mesh.position.set(0, 0.03, 0.032);
  hmi.add(ekran.mesh);
  for (let i = 0; i < 6; i++) box(0.035, 0.018, 0.008, M.koyu, -0.15 + i * 0.06, -0.125, 0.034, hmi);
  const HUX = 0.78, HUZ = -0.35;
  box(0.5, 0.36, 0.38, mavi, HUX, 0.2, HUZ, g);
  cyl(0.09, 0.28, mat(0x7d858e, { r: 0.45, m: 0.5 }), HUX - 0.08, 0.52, HUZ, g, { seg: 16 });
  box(0.12, 0.1, 0.1, mat(0x2a5e9e, { r: 0.4, m: 0.4 }), HUX + 0.14, 0.43, HUZ + 0.05, g);
  rod([HUX - 0.2, 0.3, HUZ + 0.1], [0.05, 0.3, -0.05], 0.012, M.siyah, g);
  const kule = kuleLambasi(g, 0.42, TY + 1.31, -0.12);

  // ---------------------------------------------------------------- kasalar + parça yığınları
  const kasa = (x, z, renk, etiket) => {
    const k = new THREE.Group();
    k.position.set(x, 0, z);
    g.add(k);
    const km = mat(renk, { r: 0.75, m: 0.05 });
    box(0.56, 0.04, 0.4, km, 0, 0.02, 0, k);
    for (const sz of [-1, 1]) box(0.56, 0.3, 0.02, km, 0, 0.17, sz * 0.19, k);
    for (const sx of [-1, 1]) box(0.02, 0.3, 0.4, km, sx * 0.27, 0.17, 0, k);
    const lv = levha([etiket], 0.3, 0.09, { bg: '#151515', fg: '#fff', font: 70, px: 256 });
    lv.position.set(0, 0.22, 0.205);
    k.add(lv);
    return k;
  };
  const GIRIS = { x: -1.25, z: 0.55 }, KBAS = { x: 1.05, z: 0.95 }, KMIL = { x: 1.7, z: 0.95 }, KNOK = { x: 1.38, z: 1.55 };
  const kGiris = kasa(GIRIS.x, GIRIS.z, 0x6d7a86, 'ŞAFT GİRİŞ');
  const kBas = kasa(KBAS.x, KBAS.z, 0x2f8f3c, 'BAŞ · OK');
  const kMil = kasa(KMIL.x, KMIL.z, 0x2f8f3c, 'ŞAFT · OK');
  const kNok = kasa(KNOK.x, KNOK.z, 0xc0392b, 'NOK');
  // kasalardaki yığınlar (adet arttıkça görünür)
  const yatayParca = (k, n, tur) => Array.from({ length: n }, (_, i) => {
    const p = new THREE.Group();
    p.position.set(-0.16 + (i % 4) * 0.105, 0.07 + Math.floor(i / 4) * 0.06, 0);
    p.rotation.z = Math.PI / 2;
    if (tur !== 'bas') cyl(0.016, 0.5, M.celik, 0, 0, 0, p, { seg: 10 });
    if (tur !== 'mil') cyl(0.055, 0.09, M.krom, 0, tur === 'tam' ? 0.25 : 0, 0, p, { seg: 14 });
    p.rotation.y = tur === 'bas' ? 0 : Math.PI / 2;
    p.rotation.z = Math.PI / 2;
    k.add(p);
    return p;
  });
  const girisYigin = yatayParca(kGiris, 8, 'tam');
  const basYigin = yatayParca(kBas, 8, 'bas');
  const milYigin = yatayParca(kMil, 8, 'mil');
  const nokYigin = yatayParca(kNok, 4, 'tam');

  // ---------------------------------------------------------------- operatör (ortak lib.operator, yüz +Z)
  const opM = lib.operator({ gomlek: 0x3d6aa8 });
  const isci = opM.group;
  g.add(isci);
  // taşıma pozunda eller ~(±0.3, 1.0, 0.49): şaft iki elin arasında yatay, gövdenin önünde
  const elde = new THREE.Group();                             // taşınan parça
  elde.position.set(0, 1.0, 0.45);
  elde.rotation.z = Math.PI / 2;
  isci.add(elde);
  cyl(0.016, 0.5, M.celik, 0, 0, 0, elde, { seg: 10 });
  cyl(0.055, 0.09, M.krom, 0, 0.25, 0, elde, { seg: 14 });
  elde.visible = false;

  // ---------------------------------------------------------------- durum
  let mod = 'oto';              // oto | man
  let durum = 'calisiyor';      // calisiyor | durdu | acil | sikisma
  let maxPeak = 14, minPeak = 6;   // kN
  let sikismaArizasi = false;
  let parcaVar = false, ayrildi = false, kilitli = false, cene = 0;   // cene 0 açık … 1 kapalı
  let x = 0;                    // çekme mesafesi (m)
  let F = 0, tepe = 0, fTepeHedef = 10, serbest = false, sonuc = '—';
  let milY = 0;                 // ayrılan şaft en alt konumunda kalır (geri dönüşte başa girmez)
  let okSay = 0, nokSay = 0;
  let geriDon = false;
  let uyariMetin = '', uyariT = 0;
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };

  // çift el: zaman damgaları + kurulum
  const el = { sol: false, sag: false, tSol: 0, tSag: 0, aktif: false, kilit: false };
  let tSaat = 0;
  function elGuncelle() {
    if (!el.sol && !el.sag) el.kilit = false;                   // ikisi de bırakıldı → yeniden kurulabilir
    if (el.sol && el.sag && !el.aktif && !el.kilit) {
      if (Math.abs(el.tSol - el.tSag) <= 0.5) el.aktif = true;
      else { el.kilit = true; uyar('ÇİFT EL: 0.5 s İÇİNDE BAS'); }
    }
    if (el.aktif && (!el.sol || !el.sag)) { el.aktif = false; el.kilit = true; }
  }

  function yeniParca() {
    parcaVar = true; ayrildi = false; serbest = false; x = 0; F = 0; tepe = 0; sonuc = '—'; milY = 0;
    // tepe kuvvet: normal ~N(10, 1.3) kN; %12 olasılıkla segman eksik (düşük); arıza → sıkışma
    if (sikismaArizasi) fTepeHedef = 30;
    else if (Math.random() < 0.12) fTepeHedef = 2.5 + Math.random() * 1.5;
    else fTepeHedef = 10 + gurultu(2.2);
  }

  // çekme fiziği: segman bırakana dek doğrusal artış, sonra sürtünmeyle kayma
  const X_SEGMAN = 0.008, X_CIKIS = 0.075;
  function cek(dt) {
    const v = x < 0.01 ? 0.007 : 0.06;                          // önce yavaş, sonra hızlı
    x = Math.min(STROK, x + v * dt);
    if (!serbest) {
      F = (fTepeHedef * Math.min(x, X_SEGMAN)) / X_SEGMAN + gurultu(0.08);
      if (F > maxPeak + 4) {                                     // emniyet: aşırı kuvvette dur
        F = maxPeak + 4; tepe = Math.max(tepe, F); durum = 'sikisma'; sonuc = 'NOK';
        return;
      }
      if (x >= X_SEGMAN) { serbest = true; ayrildi = true; }
    } else F = x < X_CIKIS ? 0.9 + gurultu(0.12) : Math.max(0, F - 6 * dt);
    tepe = Math.max(tepe, F);
  }

  // ---------------------------------------------------------------- otomatik çevrim (sanal operatör)
  const NOKTA = {
    giris: [GIRIS.x + 0.15, GIRIS.z + 0.55, Math.PI],
    makine: [0.0, 0.62, Math.PI],
    ciftEl: [CEX, CEZ + 0.42, Math.PI],
    kasa: [1.35, 1.1, 0.0],
  };
  const op = { x: -0.9, z: 1.3, yon: Math.PI, adim: 0, t: 0, yuruyor: false };
  // adımlar: 0 girişe yürü, 1 al, 2 makineye yürü, 3 yerleştir, 4 kilitle, 5 çift ele yürü,
  // 6 çek, 7 geri dön + kilidi aç, 8 makineye yürü, 9 çıkar, 10 kasaya yürü, 11 bırak
  const ADIM_AD = ['girişe gidiyor', 'şaft alıyor', 'makineye gidiyor', 'yerleştiriyor', 'kilitliyor', 'çift ele geçiyor',
    'çekiyor', 'geri dönüş', 'makineye gidiyor', 'parçaları çıkarıyor', 'kasaya gidiyor', 'kasaya bırakıyor'];
  function yuru(n, dt) {
    const [tx, tz, ty] = n;
    const dx = tx - op.x, dz = tz - op.z, d = Math.hypot(dx, dz), adim = 1.1 * dt;
    if (d <= adim) { op.x = tx; op.z = tz; op.yon = ty; return true; }
    op.x += (dx / d) * adim; op.z += (dz / d) * adim; op.yon = Math.atan2(dx, dz); op.yuruyor = true;
    return false;
  }
  function otoCevrim(dt) {
    op.t += dt;
    const ileri = () => { op.adim = (op.adim + 1) % 12; op.t = 0; };
    switch (op.adim) {
      case 0: if (yuru(NOKTA.giris, dt)) ileri(); break;
      case 1: if (op.t > 0.9) { elde.visible = true; ileri(); } break;
      case 2: if (yuru(NOKTA.makine, dt)) ileri(); break;
      case 3: if (op.t > 1.0) { elde.visible = false; yeniParca(); ileri(); } break;
      case 4: kilitli = true; if (cene > 0.98) ileri(); break;
      case 5: if (yuru(NOKTA.ciftEl, dt)) ileri(); break;
      case 6:
        el.sol = el.sag = true; el.tSol = el.tSag = tSaat;
        if (el.aktif) cek(dt);
        if (x >= STROK) { el.sol = el.sag = false; degerlendir(); ileri(); }
        break;
      case 7: if (geriDonus(dt)) ileri(); break;
      case 8: if (yuru(NOKTA.makine, dt)) ileri(); break;
      case 9: if (op.t > 1.0) { parcaVar = false; elde.visible = true; ileri(); } break;
      case 10: if (yuru(NOKTA.kasa, dt)) ileri(); break;
      case 11: if (op.t > 0.7) { elde.visible = false; kasayaSay(); ileri(); } break;
    }
  }
  function degerlendir() {
    const ok = tepe >= minPeak && tepe <= maxPeak && ayrildi;
    sonuc = ok ? 'OK' : 'NOK';
  }
  let sonKasa = 'ok';
  function kasayaSay() {
    if (sonuc === 'OK') { okSay++; sonKasa = 'ok'; } else { nokSay++; sonKasa = 'nok'; }
  }
  // kilidi aç + silindiri geri al; bitince true
  function geriDonus(dt) {
    kilitli = false;
    x = Math.max(0, x - 0.12 * dt);
    F = damp(F, 0, 8, dt);
    return x <= 0 && cene < 0.02;
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([
    { ad: 'Kuvvet kN', renk: '#39c5cf' }, { ad: 'Max', renk: '#f85149', kesik: true }, { ad: 'Min', renk: '#f2c200', kesik: true },
  ], { min: 0, max: 25, uzunluk: 240, periyot: 0.05 });
  const ekranZ = throttle(6);

  function update(dt, t) {
    tSaat = t;
    elGuncelle();
    op.yuruyor = false;
    if (durum === 'calisiyor') {
      if (mod === 'oto') otoCevrim(dt);
      else {
        yuru(NOKTA.ciftEl, dt);                     // manuelde operatör çift el istasyonunda bekler
        if (parcaVar && kilitli && el.aktif && x < STROK) {
          cek(dt);
          if (x >= STROK) degerlendir();
        }
        if (geriDon) { if (geriDonus(dt)) geriDon = false; }
      }
    } else F = damp(F, 0, 3, dt);
    uyariT = Math.max(0, uyariT - dt);

    // görseller
    cene = approach(cene, kilitli ? 1 : 0, 2.5 * dt);
    ceneler.forEach((c, i) => { c.position.x = (i ? 1 : -1) * (0.058 + (1 - cene) * 0.07); });
    cekici.position.y = SY0 - x;
    silMil.scale.y = Math.max(0.02, SY0 - x - 0.07 - 0.41);
    bas.visible = parcaVar;
    mil.visible = parcaVar;
    milY = ayrildi ? Math.min(milY, -x) : -Math.min(x, 0.002);
    mil.position.y = milY;
    // poz: şaft taşırken 'tasi'; yerinde iş (al, yerleştir, kilitle, çek, çıkar, bırak) ve çift el
    // istasyonunda beklerken 'on'; yürürken 'yan'
    const yerinde = !op.yuruyor && (mod === 'man' || [1, 3, 4, 6, 7, 9, 11].includes(op.adim));
    opM.poz(elde.visible ? 'tasi' : yerinde ? 'on' : 'yan');
    isci.position.set(op.x, opM.yuru(t, op.yuruyor), op.z);
    let fark = op.yon - isci.rotation.y;
    fark = Math.atan2(Math.sin(fark), Math.cos(fark));
    isci.rotation.y += fark * (1 - Math.exp(-10 * dt));
    elLamba[0].emissiveIntensity = el.sol ? 2.4 : el.aktif ? 1 : 0.1;
    elLamba[1].emissiveIntensity = el.sag ? 2.4 : el.aktif ? 1 : 0.1;
    girisYigin.forEach((p, i) => (p.visible = i < 8 - (okSay + nokSay) % 8));
    basYigin.forEach((p, i) => (p.visible = i < okSay % 9));
    milYigin.forEach((p, i) => (p.visible = i < okSay % 9));
    nokYigin.forEach((p, i) => (p.visible = i < nokSay % 5));

    const db = durumBilgi();
    kule.set(db.seviye, t);
    trend.ornekle(dt, [F, maxPeak, minPeak]);
    if (ekranZ(dt)) ekran.ciz(hmiCiz);
  }

  // HMI: Siemens benzeri gri ekran, "SET DEĞERLER" + canlı kuvvet ve sonuç
  function hmiCiz(c, W, H) {
    c.fillStyle = '#d7dbe0'; c.fillRect(0, 0, W, H);
    const yaz = (s, px, py, size, renk = '#1d2125', hiza = 'left', kalin = 600) => {
      c.fillStyle = renk; c.textAlign = hiza; c.textBaseline = 'middle';
      c.font = `${kalin} ${size}px "Space Grotesk", sans-serif`;
      c.fillText(s, px, py);
    };
    const btn = (s, px, py, w, h, renk) => { c.fillStyle = renk; c.fillRect(px, py, w, h); yaz(s, px + w / 2, py + h / 2, 17, '#fff', 'center', 700); };
    btn('Prosesi Durdur', 150, 12, 150, 38, '#5f6b78');
    btn(mod === 'oto' ? 'Otomatik' : 'Manuel', 312, 12, 120, 38, '#2e9e48');
    btn('Kilitle', 444, 12, 90, 38, kilitli ? '#c0392b' : '#5f6b78');
    btn('Çek', 546, 12, 80, 38, el.aktif ? '#c0392b' : '#5f6b78');
    yaz('SET DEĞERLER', 330, 78, 26, '#1d2125', 'center', 800);
    const satir = (k, v, y) => {
      yaz(k, 40, y, 20, '#333');
      c.fillStyle = '#fff'; c.fillRect(190, y - 16, 120, 32); c.strokeStyle = '#555'; c.strokeRect(190, y - 16, 120, 32);
      yaz(v, 250, y, 20, '#0b2540', 'center', 700); yaz('kN', 320, y, 16, '#333');
    };
    satir('Max Peak', fmt(maxPeak, 1), 125);
    satir('Min Peak', fmt(minPeak, 1), 168);
    satir('Anlık', fmt(F, 2), 211);
    satir('Tepe', fmt(tepe, 2), 254);
    const renk = sonuc === 'OK' ? '#2e9e48' : sonuc === 'NOK' ? '#c0392b' : '#8a939c';
    c.fillStyle = renk; c.fillRect(400, 110, 210, 110);
    yaz(sonuc, 505, 165, 64, '#fff', 'center', 800);
    yaz(`OK ${okSay}  ·  NOK ${nokSay}`, 505, 250, 20, '#222', 'center', 700);
    yaz(`Çek: ${fmt(x * 1000, 0)} mm`, 505, 285, 17, '#333', 'center', 600);
    const db = durumBilgi();
    c.fillStyle = db.seviye === 'alarm' ? '#c0392b' : db.seviye === 'uyari' ? '#c9851a' : '#33414e';
    c.fillRect(0, H - 48, W, 48);
    yaz(db.metin, W / 2, H - 24, 20, '#fff', 'center', 700);
  }

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'sikisma') return { metin: 'AŞIRI KUVVET · SIKIŞMA', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'PROSES DURDU', seviye: 'bekliyor' };
    if (el.aktif && x < STROK && parcaVar) return { metin: `ÇEKİYOR · ${fmt(F, 1)} kN`, seviye: 'calisiyor' };
    if (mod === 'oto') return { metin: `OTOMATİK · ${ADIM_AD[op.adim].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
    return { metin: 'MANUEL', seviye: 'bekliyor' };
  }

  const manuel = (fn) => () => {
    if (mod !== 'man' || durum !== 'calisiyor') return uyar('MANUEL MODDA KULLAN');
    fn();
  };
  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik (sanal operatör)'], ['man', 'Manuel']], get: () => mod,
      set: (v) => {
        mod = v; el.sol = el.sag = false;
        if (v === 'man') { op.adim = 0; elde.visible = false; }
        else { parcaVar = false; kilitli = false; x = 0; op.adim = 0; op.t = 0; }
      } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Prosesi durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'baslik', metin: 'Set değerler' },
    { tip: 'kaydirici', metin: 'Max peak', min: 6, max: 25, adim: 0.5, birim: 'kN', get: () => maxPeak, set: (v) => (maxPeak = Math.max(v, minPeak + 1)) },
    { tip: 'kaydirici', metin: 'Min peak', min: 1, max: 15, adim: 0.5, birim: 'kN', get: () => minPeak, set: (v) => (minPeak = Math.min(v, maxPeak - 1)) },
    { tip: 'baslik', metin: 'Manuel adımlar (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Şaftı yerleştir', tik: manuel(() => { if (!parcaVar) yeniParca(); else uyar('FİKSTÜRDE PARÇA VAR'); }) },
      { metin: 'Kilitle / Aç', tik: manuel(() => {
        if (!parcaVar) return uyar('PARÇA YOK');
        if (x > 0.001) return uyar('ÖNCE GERİ AL');
        kilitli = !kilitli;
      }) },
    ] },
    { tip: 'baslik', metin: 'Çift el kumanda — ikisine birlikte basılı tut (Çek)' },
    { tip: 'basili', ogeler: [
      { metin: '● Sol el', bas: () => { el.sol = true; el.tSol = tSaat; if (mod === 'man' && (!parcaVar || !kilitli)) uyar('ÖNCE YERLEŞTİR + KİLİTLE'); }, birak: () => (el.sol = false) },
      { metin: 'Sağ el ●', bas: () => { el.sag = true; el.tSag = tSaat; }, birak: () => (el.sag = false) },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Geri al + kilidi aç', tik: manuel(() => { geriDon = true; }) },
      { metin: 'Parçayı kasaya', tik: manuel(() => {
        if (!parcaVar) return uyar('PARÇA YOK');
        if (x > 0.001 || kilitli) return uyar('ÖNCE GERİ AL');
        if (sonuc === '—') sonuc = 'NOK';
        parcaVar = false; kasayaSay();
      }) },
    ] },
    { tip: 'baslik', metin: 'Arıza / güvenlik' },
    { tip: 'anahtar', metin: 'Sıkışmış baş (aşırı kuvvet)', get: () => sikismaArizasi, set: (v) => (sikismaArizasi = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => {
        if (durum === 'sikisma') {                 // sıkışan parça NOK olarak çıkarılır
          sonuc = 'NOK'; durum = 'calisiyor';
          if (mod === 'oto') { el.sol = el.sag = false; op.adim = 7; op.t = 0; } else geriDon = true;
        } else if (durum === 'acil') durum = 'durdu';
      } },
    ] },
  ];

  return {
    id: 'saft',
    ad: 'Şaft Başı Sökme Makinesi',
    altBaslik: 'Hidrolik çekme · çift el · tepe kuvvet',
    kisa: 'Araç şaftlarının homokinetik mafsal başlarını söken hidrolik makine. Şaft kilitlenir, çift el kumandayla çekilir; segman bırakırken oluşan tepe kuvvet Min/Max aralığına göre OK/NOK ayıklanır.',
    proje: 'other-machines',
    ayakIzi: [5.0, 3.6],
    kamera: { poz: [2.3, 2.75, 2.9], hedef: [0.15, 1.0, 0.1] },
    mekanizmalar: [
      'Hidrolik çekme silindiri: alt bölmede, kilit çeneleriyle birlikte şaftı 140 mm aşağı çeker',
      'Kilit çeneleri: şaftı sıkar (Kilitle), geri dönüşte açılır',
      'Çatal bloklar: mafsal başını tutar; baş yerinde kalır, şaft aşağı ayrılır',
      'Çift el istasyonu: iki yeşil buton 0.5 s içinde basılı tutulmazsa çekme olmaz; bırakınca durur',
      'Operatör: şaftı girişten alır, yerleştirir, çeker, baş/şaftı OK ya da NOK kasasına koyar',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ (MKN-V04 + V05): arabaların şaftlarının başlarını sökmeye yarayan makine.',
      'Videodan: mavi gövde + mavi tel, sarı çift el istasyonu (ortada acil stop, yanlarda yeşil), kanallı uçlu krom mafsal başı siyah çatalda, şaft aşağıda; HMI "SET DEĞERLER: Max Peak, Min Peak, Çek, Kilitle", "Prosesi Durdur".',
      'TAHMİN: çekme yönü (şaft aşağı, baş çatalda kalır), segman bırakma kuvveti ~10 kN, varsayılan Min 6 / Max 14 kN, emniyet sınırı Max + 4 kN, %12 segmansız (düşük kuvvet) parça.',
      'TAHMİN: giriş kasası, baş/şaft OK kasaları ve NOK kasası düzeni; hidrolik ünite yeri.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => [
      ['Anlık kuvvet', `${fmt(F, 2)} kN`],
      ['Tepe kuvvet', `${fmt(tepe, 2)} kN`],
      ['Aralık', `${fmt(minPeak, 1)} – ${fmt(maxPeak, 1)} kN`],
      ['Sonuç', sonuc],
      ['Adet OK / NOK', `${okSay} / ${nokSay}`],
      ['Çekme', `${fmt(x * 1000, 0)} mm`],
      ['Kilit', kilitli ? 'KİLİTLİ' : 'AÇIK'],
      ['Çift el', el.aktif ? 'AKTİF' : el.kilit ? 'BIRAK + YENİDEN BAS' : 'BEKLİYOR'],
    ],
    trend,
    durum: durumBilgi,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (iş parçası, silindir mili,
    // çekici + çeneler hareket eder; kasa yığınları adede göre görünür)
    sabitHaric: [bas, mil, silMil, cekici, ...girisYigin, ...basYigin, ...milYigin, ...nokYigin],
  };
}
