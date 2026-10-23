// js/machines/sacpres.js — Sac Şekillendirme Presi (yeşil H gövdeli hidrolik pres).
//
// Kaan'ın tarifi (2026-10-23): MKN-V07 — kalıpla sac şekillendirme. Video karelerinden:
// yeşil H gövde, turuncu üst tabla/kalıp, büyük krom silindir, üstte iki manometre ve
// bükülü hidrolik boruları, sağ dikmede çok butonlu beyaz kumanda kutusu; yanında
// kabartmalı galvaniz sac panel, operatörün elinde şeffaf koruma poşetleri.
// Akış: düz sac → kalıba → çift el kumanda → basma + bekleme → açma → kabartmalı
// panel poşetlenip istiflenir. Ölçüler, kalıp şekli ve operatör akışı TAHMİN.

export function create(lib) {
  const {
    THREE, M, box, cyl, pipe, mat, lamba, Ekran, Trend, kuleLambasi, acilStop, canvasTex,
    clamp, lerp, damp, easeInOut, fmt, throttle,
  } = lib;

  const g = new THREE.Group();
  const yesil = mat(0x4f7d4a, { r: 0.55, m: 0.3, key: 'sacpres-yesil' });
  const turuncu = mat(0xe0662a, { r: 0.5, m: 0.25, key: 'sacpres-turuncu' });

  // galvaniz (pullu) sac dokusu
  const galvTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b9c0c6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      x.fillStyle = `rgba(${200 + Math.random() * 40},${205 + Math.random() * 40},${210 + Math.random() * 40},0.35)`;
      x.beginPath();
      const px = Math.random() * w, py = Math.random() * h, r = 8 + Math.random() * 22;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.random() * 0.4; x.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); }
      x.fill();
    }
  });
  const galv = new THREE.MeshStandardMaterial({ map: galvTex, roughness: 0.32, metalness: 0.85 });

  // ---------------------------------------------------------------- H gövde
  const PZ = -0.3;
  const TABLA = 0.83;                 // alt tabla (bolster) üstü
  const KALIP_UST = TABLA + 0.12;     // alt kalıp üst yüzü
  const SAC = 0.004;
  const RAM_UST = KALIP_UST + 0.78;   // koç alt yüzü (açık)
  const RAM_KAPALI = KALIP_UST + SAC + 0.002;
  for (const sx of [-1, 1]) {
    box(0.36, 3.3, 1.1, yesil, sx * 0.97, 1.65, PZ, g);                     // yan dikmeler
    box(0.06, 1.5, 0.04, M.koyu, sx * 0.97, 1.3, PZ + 0.57, g);             // ön kenar takviyesi
  }
  box(2.3, 0.62, 1.1, yesil, 0, 3.0, PZ, g);                                  // taç
  box(2.3, 0.76, 1.2, yesil, 0, 0.38, PZ, g);                                 // taban
  box(1.55, 0.07, 0.95, M.celik, 0, TABLA - 0.035, PZ, g);                   // bolster
  // alt kalıp: gri blok + erkek form (dikdörtgen kabartma + nervür)
  box(1.15, 0.12, 0.78, M.gri, 0, TABLA + 0.06, PZ, g);
  box(0.66, 0.012, 0.4, M.celik, 0, KALIP_UST - 0.004, PZ, g);
  // ana silindir + manometreler + borular + marka levhası
  cyl(0.3, 0.75, yesil, 0, 3.68, PZ, g, { seg: 28 });
  cyl(0.32, 0.06, M.koyu, 0, 4.08, PZ, g, { seg: 28 });
  for (const dx of [0.55, 0.78]) {
    cyl(0.1, 0.04, M.beyaz, dx, 3.45, PZ + 0.57, g, { eksen: 'z', seg: 22 });
    cyl(0.11, 0.03, M.krom, dx, 3.45, PZ + 0.545, g, { eksen: 'z', seg: 22 });
  }
  pipe([[-0.25, 3.9, PZ + 0.2], [-0.85, 3.9, PZ + 0.2], [-1.05, 3.6, PZ + 0.45], [-1.05, 2.3, PZ + 0.62]], 0.03, M.krom, g);
  pipe([[0.25, 3.95, PZ - 0.1], [0.9, 3.95, PZ - 0.1], [1.15, 3.6, PZ + 0.1], [1.15, 1.2, PZ + 0.1]], 0.03, M.krom, g);
  box(0.55, 0.16, 0.02, turuncu, -0.45, 3.1, PZ + 0.56, g);

  // koç: turuncu üst tabla + dişi kalıp (alt yüzde)
  const ram = new THREE.Group();
  g.add(ram);
  box(1.42, 0.36, 0.86, turuncu, 0, 0.18 + 0.03, PZ, ram);
  box(1.15, 0.06, 0.78, M.koyu, 0, 0.03, PZ, ram);
  for (const sx of [-1, 1]) box(0.05, 0.3, 0.9, M.celik, sx * 0.74, 0.2, PZ, ram);  // kızak pabuçları
  const milGeo = new THREE.CylinderGeometry(0.13, 0.13, 1, 20);
  milGeo.translate(0, 0.5, 0);
  const mil = new THREE.Mesh(milGeo, M.krom);
  mil.position.set(0, 0, PZ);
  mil.castShadow = true;
  g.add(mil);

  // ---------------------------------------------------------------- sac parça (düz → kabartmalı)
  function parcaKur(parent) {
    const p = new THREE.Group();
    box(0.95, SAC, 0.65, galv, 0, SAC / 2, 0, p);
    const kab = new THREE.Group();                       // kabartma: kenarları yuvarlatılmış dikdörtgen + nervür
    box(0.62, 0.02, 0.36, galv, 0, 0.01, 0, kab);
    box(0.5, 0.012, 0.03, galv, 0, 0.026, 0.1, kab);
    box(0.5, 0.012, 0.03, galv, 0, 0.026, -0.1, kab);
    kab.position.y = SAC;
    p.add(kab);
    parent.add(p);
    return { p, kab };
  }
  const kalipParca = parcaKur(g);
  kalipParca.p.position.set(0, KALIP_UST, PZ);

  // ---------------------------------------------------------------- kumanda kutusu (sağ dikme) + çift el konsolu
  const KX = 1.45, KZ = PZ + 0.25;
  box(0.55, 0.9, 0.18, M.beyaz, KX, 1.75, KZ, g);
  const butonRenk = [0x2ea043, 0xf2a900, 0xe5302a, 0x2ea043];
  const butonlar = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    const m = lamba(butonRenk[(r + c) % 4], 0.05);
    cyl(0.026, 0.025, m, KX - 0.18 + c * 0.12, 1.98 - r * 0.11, KZ + 0.1, g, { eksen: 'z', seg: 14 });
    butonlar.push(m);
  }
  acilStop(g, KX + 0.18, 1.35, KZ + 0.1, 0);
  const ekran = new Ekran(0.26, 0.15, 384);
  ekran.mesh.position.set(KX - 0.08, 1.45, KZ + 0.093);
  g.add(ekran.mesh);
  const kule = kuleLambasi(g, KX + 0.18, 2.2, KZ);
  // çift el konsolu (öne yerleştirilmiş ayaklı)
  const CEZ = 1.05;
  box(0.06, 1.0, 0.06, M.koyu, 0, 0.5, CEZ, g);
  box(0.4, 0.04, 0.3, M.koyu, 0, 0.02, CEZ, g);
  box(0.7, 0.12, 0.26, M.sari, 0, 1.06, CEZ, g);
  const ceButon = [-0.26, 0.26].map((dx) => {
    const m = lamba(0x2ea043, 0.1);
    cyl(0.045, 0.04, m, dx, 1.14, CEZ, g, { seg: 18 });
    return m;
  });
  cyl(0.035, 0.035, M.kirmizi, 0, 1.14, CEZ, g, { seg: 18 });

  // ---------------------------------------------------------------- stok, poşet masası, istif paleti
  const STOK = { x: -2.35, z: 0.3 }, MASA = { x: 2.55, z: 0.95 }, PAL = { x: 3.35, z: -0.55 };
  box(1.15, 0.12, 0.85, M.ahsap, STOK.x, 0.06, STOK.z, g);
  const stokYigin = box(0.95, 1, 0.65, galv, STOK.x, 0.12, STOK.z, g);
  box(0.9, 0.04, 0.6, M.koyu, MASA.x, 0.82, MASA.z, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.8, 0.04, M.koyu, MASA.x + sx * 0.4, 0.4, MASA.z + sz * 0.25, g);
  cyl(0.08, 0.7, new THREE.MeshStandardMaterial({ color: 0xdfe8ee, transparent: true, opacity: 0.6, roughness: 0.2 }),
    MASA.x, 0.92, MASA.z - 0.15, g, { eksen: 'x', seg: 18 });                 // poşet/film rulosu
  box(1.15, 0.12, 0.85, M.ahsap, PAL.x, 0.06, PAL.z, g);
  const istif = box(0.95, 1, 0.65, galv, PAL.x, 0.12, PAL.z, g);
  const posetMat = new THREE.MeshStandardMaterial({ color: 0xe8f2f8, transparent: true, opacity: 0.32, roughness: 0.15, depthWrite: false });
  const istifPoset = box(1.0, 1, 0.7, posetMat, PAL.x, 0.12, PAL.z, g);
  istifPoset.castShadow = false;

  // operatör (ortak lib.operator, yüz +Z; turuncu yelek) + elindeki parça / poşet
  const opM = lib.operator({ yelek: 0xff7a1a });
  const op = { g: opM.group, x: 0, z: 1.5, yon: Math.PI, adimlar: [], yuruyor: false, metin: 'bekliyor' };
  g.add(op.g);
  // taşıma pozunda eller ~(±0.3, 1.0, 0.49): sac iki elin arasında, gövdenin önünde
  const el = new THREE.Group();
  el.position.set(0, 1.0, 0.46);
  el.rotation.x = -1.2;
  op.g.add(el);
  const elParca = parcaKur(el);
  const elPoset = box(1.02, 0.06, 0.7, posetMat, 0, 0.02, 0, el);
  elPoset.castShadow = false;

  const NOKTA = {
    stok: { x: STOK.x + 0.95, z: STOK.z + 0.1, yon: -Math.PI / 2 },
    pres: { x: 0, z: 0.62, yon: Math.PI },
    konsol: { x: 0, z: 1.45, yon: Math.PI },
    masa: { x: MASA.x, z: MASA.z + 0.62, yon: Math.PI },
    palet: { x: PAL.x, z: PAL.z + 0.95, yon: Math.PI },
  };
  const yuru = (n) => ({ tip: 'yuru', x: n.x, z: n.z, son: n.yon });
  const is = (sure, yon, metin, bit, guncelle) => ({ tip: 'is', sure, yon, metin, bit, guncelle });

  function opGuncelle(dt, tm, aktif) {
    const a = op.adimlar[0];
    op.yuruyor = false;
    if (a && aktif) {
      if (a.tip === 'yuru') {
        const dx = a.x - op.x, dz = a.z - op.z, d = Math.hypot(dx, dz), adim = 1.3 * dt;
        if (d <= adim) { op.x = a.x; op.z = a.z; if (a.son != null) op.yon = a.son; op.adimlar.shift(); }
        else { op.x += (dx / d) * adim; op.z += (dz / d) * adim; op.yon = Math.atan2(dx, dz); op.yuruyor = true; }
        op.metin = 'yürüyor';
      } else {
        if (!a._b) { a._b = true; a._t = 0; }
        a._t += dt;
        if (a.yon != null) op.yon = a.yon;
        op.metin = a.metin;
        const k = Math.min(1, a._t / a.sure);
        a.guncelle?.(k);
        if (k >= 1) { op.adimlar.shift(); a.bit?.(); }
      }
    } else if (!a) op.metin = mod === 'oto' ? 'bekliyor' : 'manuel mod (sen kumandadasın)';
    // poz: sac/panel taşırken 'tasi', yerinde iş (yerleştirme, poşetleme, istif) ya da çift el
    // konsolunda 'on', yürürken / boşta 'yan'
    const konsolda = !a && (P.faz === 'ciftel' || P.faz === 'kapan' || P.faz === 'bekleme');
    opM.poz(elParca.p.visible ? 'tasi' : (a && a.tip === 'is') || konsolda ? 'on' : 'yan');
    op.g.position.set(op.x, opM.yuru(tm, op.yuruyor), op.z);
    let f = op.yon - op.g.rotation.y;
    f = Math.atan2(Math.sin(f), Math.cos(f));
    op.g.rotation.y += f * (1 - Math.exp(-10 * dt));
  }

  // ---------------------------------------------------------------- mantık
  let mod = 'oto';                // oto (sanal operatör) | man (çift el kumanda sende)
  let durum = 'calisiyor';        // calisiyor | durdu | acil
  let basinc = 180, beklemeSure = 1.5;
  let stok = 30, istifSay = 0, adet = 0;
  let ciftEl = false, uyariMetin = '', uyariT = 0;
  let cevrimT = 0, sonCevrim = 0;
  const P = { faz: 'bekle', t: 0, ramY: RAM_UST, bar: 0, parca: 'yok', form: 0, donBas: RAM_UST, gorev: false };
  // parca: yok | duz | sekilli
  const FAZ = {
    bekle: 'Sac bekleniyor', yukle: 'Sac yükleniyor', ciftel: 'Çift el kumanda', kapan: 'Koç iniyor',
    bekleme: 'Basınçta bekleme (şekillendirme)', ac: 'Koç yukarı', cikar: 'Parça alınıyor', hazir: 'Hazır · çift el bekleniyor',
    bitti: 'Bitti · parçayı al',
  };
  const uyar = (m) => { uyariMetin = m; uyariT = 2; };
  function gec(f) { P.faz = f; P.t = 0; P.gorev = false; }

  function presGuncelle(dt) {
    P.t += dt;
    if (P.parca !== 'yok') cevrimT += dt;
    switch (P.faz) {
      case 'bekle':
        if (mod === 'oto' && stok > 0 && !op.adimlar.length) {
          op.adimlar = [
            yuru(NOKTA.stok),
            is(0.7, NOKTA.stok.yon, 'stoktan düz sac alıyor', () => { stok--; elParca.p.visible = true; elParca.kab.scale.y = 0.01; elPoset.visible = false; }),
            yuru(NOKTA.pres),
            is(0.8, NOKTA.pres.yon, 'sacı kalıba yerleştiriyor', () => { elParca.p.visible = false; P.parca = 'duz'; P.form = 0; cevrimT = 0; }),
            yuru(NOKTA.konsol),
          ];
          gec('yukle');
        } else if (mod === 'man' && P.parca === 'duz') gec('hazir');
        break;
      case 'yukle':
        if (!op.adimlar.length) gec('ciftel');
        break;
      case 'ciftel':
        ciftEl = true;
        if (P.t > 0.5) gec('kapan');
        break;
      case 'hazir':
        if (ciftEl) gec('kapan');
        break;
      case 'kapan': {
        // çift el emniyeti: kapanma boyunca iki buton basılı kalmalı
        if (mod === 'man' && !ciftEl) { uyar('ÇİFT EL BIRAKILDI · KOÇ GERİ'); P.donBas = P.ramY; gec('ac'); break; }
        const hizli = 0.55, yavas = 0.9;
        if (P.t < hizli) P.ramY = lerp(RAM_UST, RAM_KAPALI + 0.12, easeInOut(P.t / hizli));
        else P.ramY = lerp(RAM_KAPALI + 0.12, RAM_KAPALI, Math.min(1, (P.t - hizli) / yavas));
        if (P.t >= hizli + yavas) gec('bekleme');
        break;
      }
      case 'bekleme':
        P.form = Math.min(1, P.t / Math.max(0.3, beklemeSure));
        if (P.t >= beklemeSure) { P.parca = 'sekilli'; P.donBas = P.ramY; gec('ac'); }
        break;
      case 'ac': {
        const k = Math.min(1, P.t / 1.0);
        P.ramY = lerp(P.donBas, RAM_UST, easeInOut(k));
        if (k >= 1) {
          if (P.parca === 'sekilli') { adet++; sonCevrim = cevrimT; gec(mod === 'oto' ? 'cikar' : 'bitti'); }
          else gec(mod === 'oto' ? 'bekle' : 'hazir');
        }
        break;
      }
      case 'cikar':
        if (!P.gorev) {
          P.gorev = true;
          op.adimlar = [
            yuru(NOKTA.pres),
            is(0.7, NOKTA.pres.yon, 'şekillenmiş paneli alıyor', () => { P.parca = 'yok'; elParca.p.visible = true; elParca.kab.scale.y = 1; }),
            yuru(NOKTA.masa),
            is(1.1, NOKTA.masa.yon, 'koruma poşetine koyuyor', null, (k) => { elPoset.visible = k > 0.25; elPoset.scale.y = lerp(0.2, 1, k); }),
            yuru(NOKTA.palet),
            is(0.6, NOKTA.palet.yon, 'palete istifliyor', () => { elParca.p.visible = false; elPoset.visible = false; istifSay++; }),
          ];
        } else if (!op.adimlar.length) gec('bekle');
        break;
      case 'bitti':
        break;
    }
    if (mod === 'oto' && P.faz !== 'ciftel' && P.faz !== 'kapan') ciftEl = false;
    const hedefBar = P.faz === 'kapan' && P.t > 0.55 ? basinc * Math.min(1, (P.t - 0.55) / 0.9) * 0.85
      : P.faz === 'bekleme' ? basinc : P.faz === 'ac' || P.faz === 'kapan' ? 35 : 3;
    P.bar = damp(P.bar, hedefBar, 9, dt);
    if (stok <= 0 && P.faz === 'bekle') stok = 30;              // forklift yeni sac paleti getirir
    if (istifSay >= 40) istifSay = 0;                            // dolu palet sevke gider
  }

  const trend = new Trend([{ ad: 'Basınç (bar)', renk: '#f2c200' }, { ad: 'Koç (cm)', renk: '#39c5cf' }], { min: 0, max: 260, uzunluk: 300 });
  const ekranZ = throttle(5);

  function update(dt, tm) {
    if (durum === 'calisiyor') presGuncelle(dt);
    else { P.bar = damp(P.bar, 0, 3, dt); ciftEl = mod === 'man' ? ciftEl : false; }
    uyariT = Math.max(0, uyariT - dt);
    opGuncelle(dt, tm, durum === 'calisiyor');
    // görseller
    ram.position.y = P.ramY;
    mil.position.y = P.ramY + 0.39;
    mil.scale.y = Math.max(0.01, 2.69 - P.ramY - 0.39);
    kalipParca.p.visible = P.parca !== 'yok';
    kalipParca.kab.scale.y = P.parca === 'sekilli' ? 1 : Math.max(0.01, P.form);
    stokYigin.scale.y = Math.max(0.001, stok * 0.006);
    stokYigin.position.y = 0.12 + (stok * 0.006) / 2;
    stokYigin.visible = stok > 0;
    const ih = Math.max(0.001, istifSay * 0.012);
    istif.scale.y = ih; istif.position.y = 0.12 + ih / 2; istif.visible = istifSay > 0;
    istifPoset.scale.y = ih + 0.01; istifPoset.position.y = 0.12 + ih / 2; istifPoset.visible = istifSay > 0;
    ceButon.forEach((m) => (m.emissiveIntensity = ciftEl ? 2.6 : 0.1));
    butonlar.forEach((m, i) => {
      const yanik = durum === 'acil' ? i % 4 === 2 && Math.sin(tm * 9) > 0
        : (i % 4 === 0 && durum === 'calisiyor') || (i === 5 && P.faz === 'bekleme') || (i === 9 && P.faz === 'kapan');
      m.emissiveIntensity = yanik ? 2.2 : 0.06;
    });
    const d = durumBilgi();
    kule.set(d.seviye, tm);
    trend.ornekle(dt, [P.bar, (RAM_UST - P.ramY) * 100]);
    if (ekranZ(dt)) {
      ekran.standart('Sac Pres · PLC', [
        ['Basınç', `${fmt(P.bar, 0)} bar`],
        ['Koç', `${fmt((RAM_UST - P.ramY) * 1000, 0)} mm`],
        ['Adet', String(adet)],
      ], d);
    }
  }

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (mod === 'man') {
      if (P.faz === 'hazir') return { metin: 'MANUEL · ÇİFT EL BEKLENİYOR', seviye: 'bekliyor' };
      if (P.faz === 'bitti') return { metin: 'MANUEL · PARÇAYI AL', seviye: 'uyari' };
      if (P.faz === 'bekle') return { metin: 'MANUEL · SAC YÜKLE', seviye: 'bekliyor' };
    }
    return { metin: `${mod === 'oto' ? 'OTOMATİK' : 'MANUEL'} · ${FAZ[P.faz].toLocaleUpperCase('tr')}`, seviye: 'calisiyor' };
  }

  const manuel = (fn) => () => {
    if (mod !== 'man') { uyar('ÖNCE MANUEL MODA AL'); return; }
    if (durum !== 'calisiyor') { uyar('BAŞLAT BEKLENİYOR'); return; }
    fn();
  };
  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik (sanal operatör)'], ['man', 'Manuel (çift el sende)']], get: () => mod,
      set: (v) => {
        mod = v; ciftEl = false;
        if (v === 'man') {
          op.adimlar = []; elParca.p.visible = false; elPoset.visible = false;
          if (P.faz === 'yukle' || P.faz === 'cikar' || P.faz === 'ciftel') {
            if (P.faz === 'cikar' && P.parca === 'sekilli') gec('bitti'); else gec(P.parca === 'duz' ? 'hazir' : 'bekle');
          }
        } else if (P.faz === 'hazir') gec('ciftel');
        else if (P.faz === 'bitti') gec('cikar');
      } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'kaydirici', metin: 'Basma basıncı', min: 80, max: 250, adim: 5, birim: 'bar', get: () => basinc, set: (v) => (basinc = v) },
    { tip: 'kaydirici', metin: 'Bekleme süresi', min: 0.5, max: 4, adim: 0.1, birim: 's', get: () => beklemeSure, set: (v) => (beklemeSure = v) },
    { tip: 'baslik', metin: 'Manuel (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Sac yükle', tik: manuel(() => {
        if (P.parca !== 'yok') { uyar('KALIP DOLU'); return; }
        if (stok <= 0) stok = 30;
        stok--; P.parca = 'duz'; P.form = 0; cevrimT = 0; gec('hazir');
      }) },
      { metin: 'Parçayı al', tik: manuel(() => {
        if (P.faz !== 'bitti') { uyar('ALINACAK PARÇA YOK'); return; }
        P.parca = 'yok'; istifSay++; gec('bekle');
      }) },
    ] },
    { tip: 'basili', ogeler: [
      { metin: 'Çift el kumanda (basılı tut)', bas: () => { if (mod === 'man') ciftEl = true; }, birak: () => { if (mod === 'man') ciftEl = false; } },
    ] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') { durum = 'durdu'; ciftEl = false; } } },
    ] },
  ];

  return {
    id: 'sacpres',
    ad: 'Sac Şekillendirme Presi',
    altBaslik: 'H gövde hidrolik · kalıplı · çift el',
    kisa: 'Yeşil H gövdeli hidrolik pres: düz galvaniz sac kalıba konur, çift el kumandayla koç iner, basınçta bekleyerek kabartmalı paneli şekillendirir; parça koruma poşetine konup istiflenir.',
    proje: 'other-machines',
    ayakIzi: [7.4, 4.0],
    ayakIziMerkez: [0.45, 0.2],
    kamera: { poz: [2.4, 3.3, 6.4], hedef: [0.25, 1.45, -0.1] },
    mekanizmalar: [
      'Koç (turuncu üst tabla + dişi kalıp): hızlı iniş → yavaş basma → basınçta bekleme → dönüş; krom mil koçla birlikte uzar',
      'Şekillendirme: düz sacta dikdörtgen kabartma ve iki nervür bekleme süresince belirir',
      'Çift el kumanda: iki yeşil buton; manuel modda kapanma boyunca basılı tutulmazsa koç geri döner',
      'Operatör: stoktan sac alır → kalıba koyar → çift el → paneli alır → poşetler → palete istifler',
      'Kumanda kutusu lambaları ve kule lambası duruma göre yanar; ana silindir üstünde iki manometre',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: MKN-V07 kalıpla sac şekillendirme presi.',
      'MKN-V07 kareleri: yeşil H gövde, turuncu üst tabla, büyük silindir, üstte iki manometre ve bükülü borular, sağ dikmede çok butonlu beyaz kumanda kutusu; yanda kabartmalı galvaniz panel; operatör şeffaf poşetlerle çalışıyor → parça poşetlenip istifleniyor.',
      'TAHMİN: pres ölçüsü (~2.3 × 4.1 m), kalıp şekli (dikdörtgen kabartma + iki nervür), çift el konsolu (videoda kumanda kutusu görünüyor, konsol yeri tahmin), stok/poşet masası/palet yerleri, operatör akışı.',
      'TAHMİN: basınç ve süre değerleri temsili; çevrim hızlandırıldı.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => [
      ['Basınç', `${fmt(P.bar, 0)} bar`],
      ['Koç konumu', `${fmt((RAM_UST - P.ramY) * 1000, 0)} mm`],
      ['Adım', FAZ[P.faz]],
      ['Adet', `${adet}`],
      ['Çevrim süresi', `${fmt(cevrimT, 1)} s (son ${fmt(sonCevrim, 1)} s)`],
      ['Sac stoğu / istif', `${stok} / ${istifSay}`],
      ['Çift el', ciftEl ? 'BASILI' : '—'],
      ['Operatör', op.metin],
    ],
    trend,
    durum: durumBilgi,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (koç + mil, kalıptaki sac,
    // stok / istif yığınları ölçeklenir ve gizlenir)
    sabitHaric: [ram, mil, kalipParca.p, stokYigin, istif, istifPoset],
  };
}
