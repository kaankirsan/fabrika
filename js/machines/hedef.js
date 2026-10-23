// js/machines/hedef.js — Hareketli Hedef Sistemi (arayıcı başlık testleri için XY portal).
//
// Fotoğraftan: ~2.6 x 2.45 x 1.1 m alüminyum sigma profil kafes, tekerlekli.
// Altta X lineer modülü (servo + kablo zinciri yerde), üstünde dikey kolon;
// kolonda Y arabası ve folyo kaplı hedef kutusu. Solda operatör masası (laptop,
// WinCC) + beyaz kontrol panosu. Profiller Excel'den (üçgen/kare/sinüs) gelir.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, profil, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, pano, levha,
    kabloZinciri, iz, clamp, approach, fmt, throttle,
  } = lib;

  const g = new THREE.Group();
  const W = 2.6, H = 2.45, D = 1.1, P = 0.06;
  const XK = W / 2 - P / 2, ZK = D / 2 - P / 2;
  const X0 = -1.0, XMAX = 2.0;  // X stroku 0..2000 mm (dünya x = X0 + X)
  const Y0 = 0.36, YMAX = 1.6;  // Y stroku 0..1600 mm (araba merkezi y = Y0 + Y)

  // ---------------------------------------------------------------- kafes
  const yB = 0.13, yT = H - P / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    profil([sx * XK, 0.1, sz * ZK], [sx * XK, H, sz * ZK], P, g);
    // tekerlek + ayak
    box(0.05, 0.03, 0.08, M.koyu, sx * XK, 0.085, sz * ZK, g);
    cyl(0.045, 0.035, M.kaucuk, sx * XK, 0.045, sz * ZK, g, { eksen: 'x', seg: 16 });
    // üst köşe gönyeleri
    profil([sx * XK, H - 0.38, sz * ZK], [sx * (XK - 0.32), yT, sz * ZK], 0.035, g);
  }
  for (const y of [yB, yT]) {
    for (const sz of [-1, 1]) profil([-XK, y, sz * ZK], [XK, y, sz * ZK], P, g);
    for (const sx of [-1, 1]) profil([sx * XK, y, -ZK], [sx * XK, y, ZK], P, g);
  }
  // alt orta kiriş + X lineer modülü (kayış kapağı koyu)
  profil([-XK, yB, 0], [XK, yB, 0], 0.08, g);
  box(W - 0.2, 0.05, 0.16, M.alu, 0, yB + 0.065, 0, g);
  box(W - 0.24, 0.012, 0.1, M.siyah, 0, yB + 0.096, 0, g);
  // üst kılavuz ray
  profil([-XK, yT, 0], [XK, yT, 0], 0.08, g);
  box(W - 0.2, 0.03, 0.1, M.alu, 0, yT - 0.055, 0, g);
  // X servo motoru (sağ uçta)
  const motor = (parent, x, y, z, eksen) => {
    const m = new THREE.Group();
    m.position.set(x, y, z);
    box(0.11, 0.11, 0.11, M.siyah, 0, 0, 0, m);
    cyl(0.045, 0.16, M.koyu, eksen === 'x' ? 0.13 : 0, eksen === 'y' ? 0.13 : 0, 0, m, { eksen, seg: 18 });
    box(0.05, 0.04, 0.06, M.koyu, 0, 0.075, 0, m);
    parent.add(m);
    return m;
  };
  motor(g, XK - 0.02, yB + 0.06, 0.16, 'x');

  // ---------------------------------------------------------------- hareketli: kolon (X)
  const kolon = new THREE.Group();
  g.add(kolon);
  box(0.24, 0.08, 0.2, M.alu, 0, yB + 0.13, 0, kolon);          // alt araba
  box(0.2, 0.06, 0.13, M.alu, 0, yT - 0.1, 0, kolon);            // üst araba
  box(0.11, yT - yB - 0.3, 0.11, M.alu, 0, (yT + yB) / 2, 0, kolon);
  box(0.03, yT - yB - 0.36, 0.06, M.siyah, 0, (yT + yB) / 2, 0.06, kolon); // Y kayış kapağı
  motor(kolon, 0, yT - 0.2, -0.12, 'y');

  // Y arabası + hedef
  const araba = new THREE.Group();
  kolon.add(araba);
  box(0.2, 0.26, 0.025, M.alu, 0, 0, 0.075, araba);
  const folyo = mat(0xd9dde0, { r: 0.18, m: 1, key: 'folyo' });
  box(0.17, 0.21, 0.15, folyo, 0, 0, 0.165, araba);
  box(0.06, 0.05, 0.06, M.siyah, 0.05, 0.13, 0.12, araba);       // sensör kutusu
  const yayiciMat = lamba(0xff3b30, 0.2);
  cyl(0.032, 0.03, yayiciMat, 0, 0, 0.255, araba, { eksen: 'z', seg: 20 });
  cyl(0.045, 0.012, M.siyah, 0, 0, 0.243, araba, { eksen: 'z', seg: 20 });

  // Kablo zincirleri: X (yerde, kolonu izler) ve Y (kolon arkasında, dikey)
  const zX = kabloZinciri({ adet: 46, R: 0.07, s: 0.62, d: 1 });
  zX.group.position.set(0, yB + 0.05, 0.3);
  g.add(zX.group);
  box(0.04, 0.17, 0.04, M.koyu, 0, 0, 0, kolon).position.set(0, yB + 0.13, 0.25); // zincir bağlantı
  const zY = kabloZinciri({ adet: 34, R: 0.05, s: 0.45, d: 1, link: [0.035, 0.025, 0.055] });
  zY.group.rotation.z = Math.PI / 2;            // yerel X -> dünya Y
  zY.group.position.set(0.0, 0, -0.08);
  kolon.add(zY.group);

  // Hedefin izi (profilin 3B çizimi)
  const yol = iz(700, 0x39c5cf, g);

  // ---------------------------------------------------------------- operatör tarafı
  const masaX = -W / 2 - 1.0, masaZ = 0.9;
  box(0.95, 0.04, 0.6, M.siyah, masaX, 0.74, masaZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, M.koyu, masaX + sx * 0.42, 0.36, masaZ + sz * 0.25, g);
  // laptop + WinCC ekranı
  box(0.36, 0.02, 0.25, M.koyu, masaX + 0.1, 0.77, masaZ + 0.05, g);
  const ekran = new Ekran(0.34, 0.22, 512);
  ekran.mesh.position.set(masaX + 0.1, 0.89, masaZ - 0.075);
  ekran.mesh.rotation.x = -0.18;
  g.add(ekran.mesh);
  box(0.36, 0.24, 0.012, M.koyu, masaX + 0.1, 0.89, masaZ - 0.083, g).rotation.x = -0.18;
  acilStop(g, masaX - 0.32, 0.81, masaZ + 0.15, 0);
  // beyaz kontrol panosu + kule lambası
  pano(g, masaX, 0, masaZ - 1.05, 0.6, 1.1, 0.45, Math.PI / 2);
  const kule = kuleLambasi(g, masaX, 1.1, masaZ - 1.05);
  // ikaz levhası
  const lv = levha(['ÇALIŞMA VAR', 'YAKLAŞMAYINIZ'], 0.5, 0.3, { bg: '#f2c200', fg: '#111', font: 70, kenar: '#111' });
  lv.position.set(W / 2 + 0.55, 1.5, 0.75);
  g.add(lv);
  box(0.04, 1.5, 0.04, M.koyu, W / 2 + 0.55, 0.75, 0.73, g);

  // ---------------------------------------------------------------- test operatörü
  // Laptopun (WinCC) başında; bariyer ihlalinde portal bölgesine girmiş halde (ihlalin
  // sebebi), ACİL'de masadaki acil stopa sağ eliyle uzanır. Yüz +Z → masaya bakmak için π.
  const op = lib.operator({ gomlek: 0x2b3f5c });
  g.add(op.group);
  const opS = { x: masaX + 0.1, z: masaZ + 0.55, yon: Math.PI, hx: masaX + 0.1, hz: masaZ + 0.55, hyon: Math.PI, poz: 'on' };
  const opHedef = (x, z, yon, poz) => { opS.hx = x; opS.hz = z; opS.hyon = yon; opS.poz = poz; };
  function opGuncelle(dt, t) {
    const dx = opS.hx - opS.x, dz = opS.hz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.2 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(yuruyor ? 'yan' : opS.poz);
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }

  // ---------------------------------------------------------------- kontrol mantığı
  const ex = { pos: 0.4, v: 0, sp: 0.4, max: XMAX }, ey = { pos: 0.3, v: 0, sp: 0.3, max: YMAX };
  let mod = 'p1';           // p1 | p2 | p3 | manuel
  let durum = 'calisiyor';  // calisiyor | durdu | acil | bariyer | referans
  let hiz = 70;             // %
  let bariyer = false;
  let profT = 0, limitT = 0;
  const jog = { x: 0, y: 0 };
  const VMAX = 0.9, AMAX = 2.4;

  const ucgen = (t, T) => { const f = ((t / T) % 1 + 1) % 1; return f < 0.5 ? f * 2 : 2 - f * 2; };
  const kare = (t, T) => (((t / T) % 1) < 0.5 ? 0 : 1);
  function profilSp(t) {
    if (mod === 'p1') return [0.2 + 1.6 * ucgen(t, 8), 0.25 + 1.0 * kare(t, 5)];
    if (mod === 'p2') return [1.0 + 0.8 * Math.sin((2 * Math.PI * t) / 7), 0.8 + 0.6 * Math.sin((2 * Math.PI * t) / 3.5)];
    // p3: Lissajous 3:2
    return [1.0 + 0.85 * Math.sin((2 * Math.PI * t * 3) / 18), 0.8 + 0.65 * Math.sin((2 * Math.PI * t * 2) / 18 + Math.PI / 4)];
  }
  const hareketli = () => durum === 'calisiyor' || durum === 'referans';

  function eksen(a, dt) {
    const vmax = (VMAX * hiz) / 100;
    let vh = hareketli() ? clamp((a.sp - a.pos) * 7, -vmax, vmax) : 0;
    const acc = durum === 'acil' || durum === 'bariyer' ? AMAX * 3 : AMAX; // acil: hızlı duruş (Kat. 1)
    a.v = approach(a.v, vh, acc * dt);
    const yeni = a.pos + a.v * dt;
    if (yeni < 0 || yeni > a.max) { a.v = 0; limitT = 1.5; }
    a.pos = clamp(yeni, 0, a.max);
  }

  const trend = new Trend([{ ad: 'X', renk: '#39c5cf' }, { ad: 'Y', renk: '#f2c200' }], { min: 0, max: 2000, uzunluk: 300 });
  const ekranZ = throttle(5);

  function update(dt, t) {
    if (durum === 'calisiyor') {
      if (mod === 'manuel') {
        // basılı jog: hedef sürekli ileri itilir, yazılım limitinde durur
        for (const [a, j] of [[ex, jog.x], [ey, jog.y]]) {
          if (j) {
            a.sp = a.pos + j * 0.25;
            if (a.sp < 0 || a.sp > a.max) limitT = 1.2;
            a.sp = clamp(a.sp, 0, a.max);
          } else a.sp = a.pos + a.v * 0.05;
        }
      } else {
        profT += dt * (hiz / 70);
        [ex.sp, ey.sp] = profilSp(profT);
      }
    } else if (durum === 'referans') {
      ex.sp = 0; ey.sp = 0;
      if (ex.pos < 0.002 && ey.pos < 0.002 && Math.abs(ex.v) + Math.abs(ey.v) < 0.01) { durum = 'durdu'; profT = 0; yol.temizle(); }
    }
    eksen(ex, dt); eksen(ey, dt);
    limitT = Math.max(0, limitT - dt);

    kolon.position.x = X0 + ex.pos;
    araba.position.y = Y0 + ey.pos;
    zX.guncelle(-0.02, kolon.position.x);
    zY.guncelle(1.2, araba.position.y - 0.05);
    if (Math.abs(ex.v) + Math.abs(ey.v) > 0.005) yol.ekle(kolon.position.x, araba.position.y, 0.27);

    // operatör: durumla senkron (bariyer → portal önünde, acil → acil stopa uzanır)
    if (durum === 'bariyer') opHedef(-0.3, 1.0, Math.PI, 'on');
    else if (durum === 'acil') opHedef(masaX - 0.02, masaZ + 0.58, Math.PI, 'sag');
    else opHedef(masaX + 0.1, masaZ + 0.55, Math.PI, 'on');
    opGuncelle(dt, t);

    yayiciMat.emissiveIntensity = durum === 'calisiyor' ? 2 + Math.sin(t * 12) * 0.6 : 0.15;
    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [ex.pos * 1000, ey.pos * 1000]);
    if (ekranZ(dt)) {
      ekran.standart('Hareketli Hedef · WinCC', [
        ['X Ekseni', `${fmt(ex.pos * 1000, 0)} mm`],
        ['Y Ekseni', `${fmt(ey.pos * 1000, 0)} mm`],
        ['Profil', MODLAR[mod]],
        ['Hız', `%${hiz}`],
      ], d);
    }
  }

  const MODLAR = { p1: 'Profil 1 (üçgen/kare)', p2: 'Profil 2 (sinüs)', p3: 'Lissajous 3:2', manuel: 'Manuel jog' };
  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (durum === 'bariyer') return { metin: 'GÜVENLİK BARİYERİ', seviye: 'alarm' };
    if (durum === 'referans') return { metin: 'REFERANS ARANIYOR', seviye: 'uyari' };
    if (limitT > 0) return { metin: 'YAZILIM LİMİTİ', seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAZIR', seviye: 'bekliyor' };
    return { metin: mod === 'manuel' ? 'MANUEL' : 'OTOMATİK', seviye: 'calisiyor' };
  }

  const basla = () => { if (durum === 'durdu') durum = 'calisiyor'; };
  const kontroller = [
    { tip: 'secim', metin: 'Hareket modu', secenekler: Object.entries(MODLAR), get: () => mod,
      set: (v) => { mod = v; profT = 0; yol.temizle(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'XY Start', tur: 'basla', tik: basla },
      { metin: 'Stop', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
      { metin: 'Referans', tik: () => { if (durum === 'durdu' || durum === 'calisiyor') durum = 'referans'; } },
    ] },
    { tip: 'baslik', metin: 'Manuel jog (mod: Manuel jog)' },
    { tip: 'basili', ogeler: [
      { metin: 'X −', bas: () => (jog.x = -1), birak: () => (jog.x = 0) },
      { metin: 'X +', bas: () => (jog.x = 1), birak: () => (jog.x = 0) },
      { metin: 'Y −', bas: () => (jog.y = -1), birak: () => (jog.y = 0) },
      { metin: 'Y +', bas: () => (jog.y = 1), birak: () => (jog.y = 0) },
    ] },
    { tip: 'kaydirici', metin: 'Hız', min: 10, max: 100, adim: 5, birim: '%', get: () => hiz, set: (v) => (hiz = v) },
    { tip: 'baslik', metin: 'Güvenlik (SIL 2)' },
    { tip: 'anahtar', metin: 'Güvenlik bariyeri ihlal edildi', get: () => bariyer,
      set: (v) => { bariyer = v; if (v) durum = 'bariyer'; else if (durum === 'bariyer') durum = 'durdu'; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil' && !bariyer) durum = 'durdu'; } },
    ] },
  ];

  return {
    id: 'hedef',
    ad: 'Hareketli Hedef Sistemi',
    altBaslik: 'XY servo portal · WinCC · SIL 2',
    kisa: 'Arayıcı başlık testleri için çift eksen servo hedef. Hareket profilleri Excel\'den okunur, WinCC SCADA ile sürülür; güvenlik devreleri SIL 2.',
    proje: 'mobile-target',
    ayakIzi: [6.2, 4.2],
    kamera: { poz: [1.6, 2.3, 5.4], hedef: [-0.3, 1.15, 0] },
    mekanizmalar: [
      'X ekseni: alt lineer modülde kayan dikey kolon (servo + kayış), 0–2000 mm',
      'Y ekseni: kolon üstünde hedef arabası, 0–1600 mm',
      'X kablo zinciri: kolonla birlikte açılıp kapanır (kıvrım yarı hızda kayar)',
      'Y kablo zinciri: kolon arkasında dikey',
      'Hedef yayıcı: çalışırken yanıp söner; cyan çizgi hedefin izlediği yol',
      'Test operatörü: WinCC laptopunun başında; bariyer ihlalinde portal bölgesine girmiş görünür, ACİL\'de acil stopa uzanır',
    ],
    cikarim: [
      'Kafes ölçüsü fotoğraftaki kapı ve masa yüksekliğine oranlanarak ~2.6 × 2.45 × 1.1 m alındı.',
      'Alttaki sarı noktalı siyah zincir ve sağ alttaki iki motor → X ekseni yerde, servo sağ uçta.',
      'Kolon tepesindeki kısa zincir ve folyolu kutu → Y arabası ve hedef gövdesi.',
      'Kılavuzdaki "Profil 1 / Profil 2" grafikleri (üçgen, kare, sinüs) hareket modlarına çevrildi.',
      'Ekrandaki "XY Start / Stop / Excel" butonları ve acil stop → kontrol paneli düzeni.',
    ],
    group: g,
    // sabitle(): kolon (Y arabası + Y zinciri dahil) ve X zinciri hareketli; iz çizgisi değişken
    sabitHaric: [kolon, zX.group, yol.line],
    update,
    kontroller,
    degerler: () => [
      ['X konumu', `${fmt(ex.pos * 1000, 0)} mm`],
      ['Y konumu', `${fmt(ey.pos * 1000, 0)} mm`],
      ['X hızı', `${fmt(ex.v * 1000, 0)} mm/s`],
      ['Y hızı', `${fmt(ey.v * 1000, 0)} mm/s`],
      ['Mod', MODLAR[mod]],
    ],
    trend,
    durum: durumBilgi,
  };
}
