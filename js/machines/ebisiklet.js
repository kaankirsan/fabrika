// js/machines/ebisiklet.js — Elektrikli Bisiklet Dönüşümü (kişisel proje): aşama aşama montaj.
//
// Fotoğraflardan (portföy personal-img-01/03/04/05/06/07/10, personal-video-01):
//  v1 — kırmızı/gri donör MTB: arka göbek motoru + selenin arkasında taşıyıcıda siyah akü kutusu,
//       kontrolcü ve şarj cihazı yerde (img-03) → akü kadro üçgenine, koyu kırmızı üçgen kutuya
//       taşınır; gidonda krom far (img-07, img-01).
//  v2 — parçalar yeni SİYAH kadroya aktarılır (img-04: eski bisiklet yanında), karbon desenli siyah
//       üçgen akü kutusu + şarj soketi, turuncu şarj cihazı (img-10); son hâl: 500 W arka göbek
//       motoru, siyah üçgen kutu, sarı-yeşil sele çantası, çift LED far, gidon ekranı (img-05/06).
// İstasyon: bisiklet tamir sehpasında, arkada tezgâh. Operatör aşama değişince parçayı tezgâhtan
// alıp takar (bisiklet-arası aktarımda bisikletleri iterek yer değiştirir). Test: arka teker
// standda döner; değerler 500 W · 30 km/h · 45 km bilgisinden türetilir.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, mat, lamba, Ekran, Trend, levha, canvasTex,
    clamp, lerp, approach, easeInOut, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---------------------------------------------------------------- malzemeler
  const kirmizi = mat(0xa3211d, { r: 0.32, m: 0.35, key: 'eb-kirmizi' });
  const gri = mat(0xb6bcc2, { r: 0.33, m: 0.7, key: 'eb-gri' });
  const siyahK = mat(0x17181a, { r: 0.38, m: 0.45, key: 'eb-siyah' });
  const tel = mat(0xc9ced3, { r: 0.3, m: 0.9, key: 'eb-tel' });
  const motorMat = mat(0x1e2023, { r: 0.42, m: 0.6, key: 'eb-motor' });
  const kKutu = mat(0x74261f, { r: 0.7, m: 0.05, key: 'eb-kkutu' });      // img-01: koyu kırmızı-kahve çanta
  const sariYesil = mat(0xb5d62a, { r: 0.7, m: 0.02, key: 'eb-canta' });  // img-06: sele altı çanta
  const turuncu = mat(0xe8542a, { r: 0.55, m: 0.05, key: 'eb-sarj' });    // img-10: şarj cihazı
  const sariJant = mat(0xf2c200, { r: 0.4, m: 0.4, key: 'eb-sjant' });    // img-04: kenardaki yedek teker
  const karbonTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#141517'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const gr = x.createLinearGradient(i * 16, j * 16, i * 16 + 16, j * 16 + 16);
      const yat = (i + j) % 2 === 0;
      gr.addColorStop(0, yat ? '#2a2c30' : '#1b1c1f'); gr.addColorStop(1, yat ? '#1a1b1e' : '#2c2e32');
      x.fillStyle = gr; x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
    }
  }, { tekrar: [18, 18] });
  const karbon = new THREE.MeshStandardMaterial({ map: karbonTex, roughness: 0.42, metalness: 0.25 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.1, metalness: 0.2 });
  const ledMat = lamba(0xf4f8ff, 0.05);   // çift LED far (testte yanar)
  const sarjLed = lamba(0xff3b30, 1.6);

  // ---------------------------------------------------------------- teker
  const R = 0.335;
  const gLastik = new THREE.TorusGeometry(R - 0.028, 0.028, 8, 40);
  const gJant = new THREE.TorusGeometry(R - 0.062, 0.011, 6, 40);
  function teker(motorlu, jantMat = M.alu) {
    const w = new THREE.Group();
    const l = new THREE.Mesh(gLastik, M.kaucuk); l.castShadow = true; w.add(l);
    const j = new THREE.Mesh(gJant, jantMat); j.castShadow = true; w.add(j);
    const rHub = motorlu ? 0.105 : 0.022;
    const n = motorlu ? 18 : 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, s = i % 2 ? 1 : -1;
      const a2 = a + (motorlu ? 0 : s * 0.35);
      rod(V(Math.cos(a) * rHub, Math.sin(a) * rHub, s * (motorlu ? 0.025 : 0.03)),
        V(Math.cos(a2) * (R - 0.068), Math.sin(a2) * (R - 0.068), s * 0.004), 0.0018, tel, w, 4);
    }
    if (motorlu) {
      cyl(0.105, 0.07, motorMat, 0, 0, 0, w, { eksen: 'z', seg: 28 });
      cyl(0.075, 0.074, M.alu, 0, 0, 0, w, { eksen: 'z', seg: 24 });
      cyl(0.012, 0.16, M.celik, 0, 0, 0, w, { eksen: 'z', seg: 10 });
    } else {
      cyl(0.02, 0.09, M.alu, 0, 0, 0, w, { eksen: 'z', seg: 12 });
    }
    lib.sabitle(w);   // teller/jant/lastik malzeme başına tek parça (teker döner, kendi içinde sabit)
    return w;
  }

  // ---------------------------------------------------------------- bisiklet (yerel: +X ön, zemin y=0, eksen yüksekliği R)
  // Geometri (m, arka aks −0.54 / ön aks +0.54): orta boy 26" MTB, kadro açıları 70°/73°.
  const P = {
    RA: [-0.54, 0.34], BB: [-0.12, 0.29], ST: [-0.25, 0.78], SC: [-0.235, 0.725],
    TT0: [-0.22, 0.70], TT1: [0.345, 0.865], HTt: [0.342, 0.885], HTb: [0.386, 0.763], FA: [0.54, 0.34],
  };
  const v2 = (p, z = 0) => V(p[0], p[1], z);
  // kadro üçgeni pil kutusu (üst boru altı · sele borusu önü · alt boru üstü)
  const UA = [-0.17, 0.655], UB = [0.30, 0.80], UC = [-0.08, 0.38];
  const UCX = (UA[0] + UB[0] + UC[0]) / 3, UCY = (UA[1] + UB[1] + UC[1]) / 3;
  function ucgenKutu(material, kal, soket) {
    const s = new THREE.Shape();
    s.moveTo(UA[0] - UCX, UA[1] - UCY); s.lineTo(UB[0] - UCX, UB[1] - UCY); s.lineTo(UC[0] - UCX, UC[1] - UCY); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: kal, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    geo.translate(0, 0, -kal / 2);
    const grp = new THREE.Group();
    const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    if (soket) {   // img-10: yan yüzde yuvarlak şarj soketi + üstte dişi fiş kapağı
      cyl(0.016, 0.012, M.siyah, -0.05, -0.02, kal / 2 + 0.012, grp, { eksen: 'z', seg: 14 });
      cyl(0.008, 0.014, M.krom, -0.05, -0.02, kal / 2 + 0.014, grp, { eksen: 'z', seg: 10 });
    } else {       // fermuar çizgisi (yumuşak çanta)
      box(0.36, 0.006, 0.006, M.siyah, 0.02, 0.07, kal / 2 + 0.008, grp).rotation.z = 0.3;
    }
    return grp;
  }
  const PARCA = {};   // ad → { tezgah: Object3D (taşınan kopya), montaj: Object3D (bisiklette) }
  function bisiklet(tip) {
    const b = new THREE.Group();
    const ana = tip === 'v1' ? kirmizi : siyahK, arka = tip === 'v1' ? gri : siyahK;
    rod(v2(P.HTb), v2(P.BB), 0.024, ana, b);            // alt boru
    rod(v2(P.TT0), v2(P.TT1), 0.02, ana, b);            // üst boru
    rod(v2(P.BB), v2(P.ST), 0.019, ana, b);             // sele borusu
    rod(v2(P.HTb), v2(P.HTt), 0.025, ana, b);           // furç kafası
    for (const s of [-1, 1]) {
      rod(v2(P.RA, s * 0.065), v2(P.SC, s * 0.014), 0.009, arka, b);   // sele çatalı
      rod(v2(P.RA, s * 0.065), v2(P.BB, s * 0.03), 0.011, arka, b);    // zincir çatalı
    }
    if (tip === 'v1') {   // rijit gri çatal
      for (const s of [-1, 1]) rod(V(0.395, 0.74, s * 0.045), v2(P.FA, s * 0.05), 0.011, gri, b);
      box(0.05, 0.03, 0.12, gri, 0.392, 0.75, 0, b);
    } else {              // img-05: siyah amortisörlü çatal
      box(0.06, 0.035, 0.15, siyahK, 0.392, 0.75, 0, b);
      for (const s of [-1, 1]) {
        rod(V(0.398, 0.745, s * 0.062), V(0.46, 0.55, s * 0.062), 0.017, M.krom, b);
        rod(V(0.455, 0.57, s * 0.062), v2(P.FA, s * 0.062), 0.021, siyahK, b);
      }
      box(0.03, 0.03, 0.14, siyahK, 0.47, 0.53, 0, b);
      rod(V(-0.2, 0.3, 0.07), V(-0.33, 0.02, 0.2), 0.009, siyahK, b);   // yan ayak
    }
    // gidon
    rod(v2(P.HTt), V(0.33, 0.95, 0), 0.014, M.koyu, b);
    rod(V(0.33, 0.95, 0), V(0.40, 0.965, 0), 0.016, M.koyu, b);
    cyl(0.011, 0.64, M.koyu, 0.40, 0.965, 0, b, { eksen: 'z', seg: 10 });
    for (const s of [-1, 1]) {
      cyl(0.017, 0.11, M.kaucuk, 0.40, 0.965, s * 0.27, b, { eksen: 'z', seg: 10 });
      box(0.07, 0.012, 0.02, M.koyu, 0.44, 0.955, s * 0.22, b);   // fren kolu
    }
    // sele
    rod(v2(P.SC), V(-0.27, 0.86, 0), 0.013, M.krom, b);
    box(0.24, 0.045, 0.15, M.siyah, -0.3, 0.885, 0, b);
    box(0.12, 0.035, 0.06, M.siyah, -0.15, 0.885, 0, b);
    // krank + aynakol + zincir (sağ taraf = +Z, kameraya bakar)
    cyl(0.1, 0.006, M.celik, P.BB[0], P.BB[1], 0.06, b, { eksen: 'z', seg: 28 });
    cyl(0.03, 0.006, M.celik, P.RA[0], P.RA[1], 0.06, b, { eksen: 'z', seg: 14 });
    rod(V(P.BB[0], P.BB[1] + 0.1, 0.062), V(P.RA[0], P.RA[1] + 0.03, 0.062), 0.004, M.koyu, b, 6);
    rod(V(P.BB[0], P.BB[1] - 0.1, 0.062), V(P.RA[0], P.RA[1] - 0.03, 0.062), 0.004, M.koyu, b, 6);
    for (const s of [-1, 1]) {
      const kol = box(0.022, 0.17, 0.012, M.koyu, P.BB[0] + s * 0.035, P.BB[1] - s * 0.07, s * 0.075, b);
      kol.rotation.z = 0.45;
      box(0.09, 0.02, 0.06, M.koyu, P.BB[0] + s * 0.07, P.BB[1] - s * 0.15, s * 0.11, b);
    }
    const onT = teker(false); onT.position.set(P.FA[0], P.FA[1], 0); b.add(onT);
    const arkaN = teker(false); arkaN.position.set(P.RA[0], P.RA[1], 0); b.add(arkaN);
    const arkaM = teker(true); arkaM.position.set(P.RA[0], P.RA[1], 0); b.add(arkaM);
    arkaM.visible = false;
    return { group: b, onT, arkaN, arkaM };
  }

  // ---------------------------------------------------------------- parçalar (yerel merkez = parça merkezi)
  function rafPil() {   // img-03: sele arkasında taşıyıcı + siyah kutu pil
    const p = new THREE.Group();
    box(0.36, 0.012, 0.13, M.koyu, 0, -0.075, 0, p);
    for (const s of [-1, 1]) {
      rod(V(-0.15, -0.08, s * 0.06), V(0.08, -0.46, s * 0.075), 0.006, M.koyu, p, 6);
      rod(V(0.16, -0.08, s * 0.06), V(0.3, -0.2, s * 0.04), 0.006, M.koyu, p, 6);
    }
    box(0.3, 0.12, 0.13, M.siyah, 0, 0, 0, p);
    box(0.3, 0.012, 0.135, M.koyu, 0, 0.066, 0, p);
    box(0.04, 0.03, 0.02, M.kirmizi, 0.12, 0.02, 0.07, p);
    return p;
  }
  function farV1() {    // img-07: krom yuvarlak far + korna
    const p = new THREE.Group();
    cyl(0.045, 0.07, M.krom, 0, 0, 0, p, { eksen: 'x', seg: 20 });
    cyl(0.04, 0.006, lens, 0.037, 0, 0, p, { eksen: 'x', seg: 20 });
    cyl(0.018, 0.04, M.krom, -0.02, 0.02, 0.09, p, { eksen: 'x', seg: 12 });
    return p;
  }
  function kontrolcu() { // alüminyum kanatlı kontrolcü kutusu
    const p = new THREE.Group();
    box(0.13, 0.045, 0.07, M.alu, 0, 0, 0, p);
    for (let i = -2; i <= 2; i++) box(0.13, 0.012, 0.004, M.alu, 0, 0.028, i * 0.014, p);
    return p;
  }
  let ekranB = null;
  function gidonEkrani(gercek) {   // img-06 / video-01: gidon ortasında ekran + sağda gaz kolu
    const p = new THREE.Group();
    box(0.03, 0.05, 0.08, M.siyah, 0, 0, 0, p);
    if (gercek) {
      ekranB = new Ekran(0.07, 0.042, 140);
      ekranB.mesh.rotation.y = -Math.PI / 2;
      ekranB.mesh.position.set(-0.017, 0.002, 0);
      p.add(ekranB.mesh);
    } else box(0.002, 0.042, 0.07, mat(0x0a2030, { r: 0.2, key: 'eb-ek' }), -0.016, 0.002, 0, p);
    box(0.05, 0.03, 0.035, M.siyah, 0.0, -0.015, 0.21, p);   // gaz kolu (sağ elcik yanında)
    return p;
  }
  function ciftFar(mt) {   // img-05: iki LED far
    const p = new THREE.Group();
    box(0.03, 0.012, 0.16, M.koyu, 0, -0.03, 0, p);
    for (const s of [-1, 1]) {
      cyl(0.032, 0.05, M.siyah, 0, 0, s * 0.055, p, { eksen: 'x', seg: 18 });
      cyl(0.026, 0.006, mt, 0.027, 0, s * 0.055, p, { eksen: 'x', seg: 18 });
    }
    return p;
  }
  function canta() { const p = new THREE.Group(); box(0.13, 0.075, 0.09, sariYesil, 0, 0, 0, p); box(0.13, 0.008, 0.092, M.siyah, 0, 0.03, 0, p); return p; }

  // ---------------------------------------------------------------- istasyon: zemin, tezgâh, sehpa, raf
  const TZ = -1.5;        // tezgâh merkez z
  box(6.4, 0.012, 3.6, mat(0x2e3236, { r: 0.95, key: 'eb-paspas' }), -0.4, 0.006, -0.1, g);   // kauçuk paspas
  // tezgâh (ahşap üst, çelik ayak) + takım panosu
  box(4.2, 0.05, 0.75, M.ahsap, -0.8, 0.9, TZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.88, 0.05, M.koyu, -0.8 + sx * 2.0, 0.44, TZ + sz * 0.32, g);
  box(4.1, 0.03, 0.68, M.koyu, -0.8, 0.2, TZ, g);   // alt raf
  box(4.2, 1.1, 0.03, mat(0x8a9097, { r: 0.6, key: 'eb-pano' }), -0.8, 1.55, TZ - 0.37, g);
  for (let i = 0; i < 14; i++) {   // panodaki takımlar (anahtar, pense, tornavida)
    const x = -2.7 + i * 0.27, h = 0.16 + (i % 3) * 0.05;
    box(0.025, h, 0.012, i % 4 === 0 ? M.kirmizi : M.celik, x, 1.6 - (i % 2) * 0.25, TZ - 0.345, g);
  }
  // tamir sehpası (üç ayak + direk + kol + kıskaç) — bisiklet sele borusundan tutulur
  const SH = 0.14, BX = 0, BZ = 0.15;   // standda bisiklet: yükseklik + konum
  const SX = -1.42;   // sehpa direği arka tekerin solunda; kol tekerin üstünden sele borusuna uzanır
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    rod(V(SX, 0.5, BZ), V(SX + Math.cos(a) * 0.42, 0.02, BZ + Math.sin(a) * 0.42), 0.016, M.koyu, g, 8);
  }
  rod(V(SX, 0.02, BZ), V(SX, 1.06, BZ), 0.022, M.koyu, g, 10);
  rod(V(SX, 1.02, BZ), V(-0.3, 0.97, BZ), 0.016, M.koyu, g, 10);
  box(0.07, 0.08, 0.07, M.kirmizi, -0.265, 0.95, BZ, g);
  // parça rafı + kutular, yedek teker (sarı jant, img-04)
  const rafM = mat(0x3d5a7a, { r: 0.55, m: 0.3, key: 'eb-raf' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 1.8, 0.04, rafM, -3.75 + sx * 0.43, 0.9, -1.45 + sz * 0.2, g);
  for (let k = 0; k < 4; k++) box(0.9, 0.025, 0.44, rafM, -3.75, 0.12 + k * 0.55, -1.45, g);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 2; i++) box(0.34, 0.22 + (i + k) % 2 * 0.06, 0.34, M.karton, -3.95 + i * 0.4, 0.25 + k * 0.55 + (i + k) % 2 * 0.03, -1.45, g);
  const yedek = teker(false, sariJant); yedek.position.set(-3.1, R + 0.01, -1.05); yedek.rotation.set(0.12, 0.25, 0); g.add(yedek);
  // test monitörü arabası
  box(0.6, 0.04, 0.45, M.koyu, 2.1, 0.85, -1.0, g);
  for (const sx of [-1, 1]) box(0.04, 0.83, 0.04, M.koyu, 2.1 + sx * 0.26, 0.42, -1.0, g);
  box(0.52, 0.34, 0.03, M.siyah, 2.1, 1.12, -1.15, g);
  const ekran = new Ekran(0.48, 0.3, 512);
  ekran.mesh.position.set(2.1, 1.12, -1.13);
  g.add(ekran.mesh);
  const tabela = levha(['ELEKTRİKLİ BİSİKLET DÖNÜŞÜMÜ', 'Kişisel proje · 500 W · 30 km/h · 45 km'], 2.6, 0.5, { bg: '#17324f', font: 64, px: 1024 });
  tabela.position.set(-0.8, 2.35, TZ - 0.35);
  g.add(tabela);

  // ---------------------------------------------------------------- bisikletler + yer değiştiren donanım
  const B1 = bisiklet('v1'), B2 = bisiklet('v2');
  g.add(B1.group, B2.group);
  const YER = { stand: [BX, SH, BZ], eski: [-3.35, 0, 1.55], yeni: [3.25, 0, 1.0] };
  const MONT = {   // bisiklet-yerel montaj noktaları
    rafPil: [-0.62, 0.82, 0], kUcgen: [UCX, UCY, 0], far1: [0.45, 0.93, 0], sUcgen: [UCX, UCY, 0],
    kontrol: [-0.31, 0.34, 0.0], ekran: [0.405, 0.995, 0], farlar: [0.455, 0.93, 0], canta: [-0.33, 0.825, 0],
  };
  const TEZ = {    // tezgâh üstü konumlar (istasyon-yerel)
    rafPil: [-2.2, 1.0, TZ + 0.05], kUcgen: [-1.45, 1.06, TZ], far1: [-0.95, 0.95, TZ + 0.15],
    sUcgen: [-0.35, 1.06, TZ], kontrol: [0.15, 0.95, TZ + 0.15], ekran: [0.5, 0.95, TZ + 0.12],
    farlar: [0.85, 0.97, TZ + 0.1], canta: [1.15, 0.96, TZ + 0.1],
  };
  const tanim = [
    ['rafPil', rafPil, B1], ['kUcgen', () => ucgenKutu(kKutu, 0.085, false), B1], ['far1', farV1, B1],
    ['sUcgen', () => ucgenKutu(karbon, 0.075, true), B2], ['kontrol', kontrolcu, B2],
    ['ekran', (gercek) => gidonEkrani(gercek), B2], ['farlar', (gercek) => ciftFar(gercek ? ledMat : lens), B2], ['canta', canta, B2],
  ];
  for (const [ad, yap, bis] of tanim) {
    const montaj = yap(true); montaj.position.fromArray(MONT[ad]); montaj.visible = false; bis.group.add(montaj);
    const tezgah = yap(false); tezgah.position.fromArray(TEZ[ad]); g.add(tezgah);
    lib.sabitle(montaj); lib.sabitle(tezgah);
    PARCA[ad] = { montaj, tezgah, bis };
  }
  // arka göbek motorlu tekerin tezgâh kopyası (tezgâha yaslı)
  const motorTez = teker(true); g.add(motorTez);
  const MOTOR_TEZ = { p: [-2.95, R + 0.01, TZ + 0.5], r: [0.15, 0, 0] };
  // yerde/tezgâhta duran: v1 kontrolcü + siyah şarj cihazı (img-03), turuncu şarj (img-10)
  const yerV1 = new THREE.Group(); g.add(yerV1);
  box(0.13, 0.045, 0.07, M.alu, 0.75, 0.025, BZ + 0.55, yerV1);
  box(0.16, 0.06, 0.09, M.siyah, 1.05, 0.03, BZ + 0.75, yerV1);
  rod(V(0.7, 0.03, BZ + 0.55), V(0.15, 0.5, BZ + 0.05), 0.005, M.siyah, yerV1, 5);
  const sarjT = new THREE.Group(); g.add(sarjT);
  box(0.2, 0.08, 0.11, turuncu, -2.55, 0.965, TZ + 0.15, sarjT);
  box(0.02, 0.012, 0.02, sarjLed, -2.45, 1.01, TZ + 0.15, sarjT);
  // kablo hepsi tek mesh (sabitle sarjT'yi dışarıda bırakır: görünürlüğü değişir)
  lib.sabitle(B1.group, [B1.onT, B1.arkaN, B1.arkaM, ...tanim.filter((t) => t[2] === B1).map((t) => PARCA[t[0]].montaj)]);
  lib.sabitle(B2.group, [B2.onT, B2.arkaN, B2.arkaM, ...tanim.filter((t) => t[2] === B2).map((t) => PARCA[t[0]].montaj)]);

  // ---------------------------------------------------------------- aşama durumu (animasyonsuz uygula)
  const ASAMA = {
    1: 'Donör bisiklet (kırmızı/gri)',
    2: 'Arka göbek motoru 500 W + arka akü kutusu',
    3: 'Akü kadro üçgeninde (kırmızı kutu)',
    4: 'Siyah kadroya geçiş + siyah üçgen akü kutusu',
    5: 'Kontrolcü, gidon ekranı, çift far',
  };
  // hangi parça hangi aşamadan itibaren bisiklette
  const TAKILI = { rafPil: [2, 2], kUcgen: [3, 3], far1: [3, 3], sUcgen: [4, 5], kontrol: [5, 5], ekran: [5, 5], farlar: [5, 5], canta: [5, 5] };
  let asama = 1, hedefAsama = 1;
  function bisikletYeri(bis, ad) {
    const p = YER[ad];
    bis.group.position.set(p[0], p[1], p[2]);
    bis.group.rotation.set(0, 0, 0);
  }
  function uygula(s) {
    asama = s;
    for (const [ad, [a, b]] of Object.entries(TAKILI)) {
      const tak = s >= a && s <= b;
      PARCA[ad].montaj.visible = tak;
      PARCA[ad].tezgah.visible = !tak;
      PARCA[ad].tezgah.position.fromArray(TEZ[ad]);
      PARCA[ad].tezgah.quaternion.identity();
    }
    // eski kırmızı kutu v2'de tezgâha döner; v1 parkta çıplak
    B1.arkaM.visible = s === 2 || s === 3; B1.arkaN.visible = !B1.arkaM.visible;
    B2.arkaM.visible = s >= 4; B2.arkaN.visible = !B2.arkaM.visible;
    motorTez.visible = s === 1;
    motorTez.position.fromArray(MOTOR_TEZ.p); motorTez.rotation.set(...MOTOR_TEZ.r);
    yerV1.visible = s === 2 || s === 3;
    sarjT.visible = s >= 4;
    bisikletYeri(B1, s <= 3 ? 'stand' : 'eski');
    bisikletYeri(B2, s <= 3 ? 'yeni' : 'stand');
  }
  uygula(1);

  // ---------------------------------------------------------------- operatör
  const op = lib.operator({ logo: false, yelek: 0xff7a1a, gomlek: 0x2d3540 });
  g.add(op.group);
  const opS = { x: -0.6, z: -0.85, yon: Math.PI, hx: -0.6, hz: -0.85, hyon: Math.PI, poz: 'on', rota: [] };
  function opHedef(x, z, yon, poz = 'on') {
    opS.hyon = yon; opS.poz = poz;
    if (x === opS.hx && z === opS.hz) return;
    opS.hx = x; opS.hz = z; opS.rota.length = 0;
    // standdaki bisikletin (x −1.1…1.1, z = BZ) içinden geçme: yakın uçtan dolan
    const z0 = opS.z;
    if ((z0 - BZ) * (z - BZ) < 0) {
      const xc = opS.x + (x - opS.x) * ((BZ - z0) / (z - z0));
      if (Math.abs(xc) < 1.15) {
        const sx = (opS.x + x) / 2 >= -0.2 ? 1.35 : -1.95;
        const z1 = z0 < BZ ? BZ - 0.7 : BZ + 0.7, z2 = z0 < BZ ? BZ + 0.7 : BZ - 0.7;
        opS.rota.push([sx, z1], [sx, z2]);
      }
    }
  }
  const opVardi = () => !opS.rota.length && Math.hypot(opS.hx - opS.x, opS.hz - opS.z) < 0.03;
  function opGuncelle(dt, t, tasiyor) {
    let tx = opS.hx, tz = opS.hz;
    if (opS.rota.length) {
      [tx, tz] = opS.rota[0];
      if (Math.hypot(tx - opS.x, tz - opS.z) < 0.06) { opS.rota.shift(); if (opS.rota.length) [tx, tz] = opS.rota[0]; else { tx = opS.hx; tz = opS.hz; } }
    }
    const dx = tx - opS.x, dz = tz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.25 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(tasiyor ? 'tasi' : yuruyor ? 'yan' : opS.poz);
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }
  const _v = V(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  // nesnenin istasyon (g) yerel konum/yönü
  function gYerel(o, pos, quat) {
    g.updateWorldMatrix(true, false); o.updateWorldMatrix(true, false);
    o.getWorldPosition(pos); g.worldToLocal(pos);
    if (quat) { o.getWorldQuaternion(quat); g.getWorldQuaternion(_qi); quat.premultiply(_qi.invert()); }
  }

  // ---------------------------------------------------------------- montaj adımları
  // her aşama geçişi bir iş listesi: {tur:'tak'|'sok'|'aktar'|'it', ...}
  function isListesi(s) {   // s → s+1
    if (s === 1) return [{ tur: 'motor' }, { tur: 'tak', ad: 'rafPil' }];
    if (s === 2) return [{ tur: 'sok', ad: 'rafPil' }, { tur: 'tak', ad: 'kUcgen' }, { tur: 'tak', ad: 'far1' }];
    if (s === 3) return [{ tur: 'it', bis: B1, hedef: 'eski' }, { tur: 'it', bis: B2, hedef: 'stand' }, { tur: 'aktar' }, { tur: 'tak', ad: 'sUcgen' }];
    if (s === 4) return [{ tur: 'tak', ad: 'kontrol' }, { tur: 'tak', ad: 'ekran' }, { tur: 'tak', ad: 'farlar' }, { tur: 'tak', ad: 'canta' }];
    return [];
  }
  let isler = [], is = null, adim = false;
  const ELDE = V(), MNT = V(), MQ = new THREE.Quaternion(), BAS = V(), BQ = new THREE.Quaternion();
  function eldeki(out) {   // operatörün önü, göğüs hizası
    out.set(opS.x + Math.sin(opS.yon) * 0.42, 0.98, opS.z + Math.cos(opS.yon) * 0.42);
    return out;
  }
  // montaj noktasına yaklaşma yeri: bisikletin arkası (tezgâh tarafı), parça hizasında
  function yaklasma(pos) { return [clamp(pos.x, -1.0, 1.0), -0.55]; }
  function isBaslat(j) {
    is = { ...j, faz: 'git', k: 0, nesne: null };
    if (j.tur === 'tak') {
      is.nesne = PARCA[j.ad].tezgah;
      gYerel(PARCA[j.ad].montaj, MNT, MQ);
      const [x] = yaklasma(MNT);
      opHedef(TEZ[j.ad][0], TZ + 0.68, Math.PI);
      is.sonra = [x, -0.55];
    } else if (j.tur === 'sok') {
      const p = PARCA[j.ad];
      gYerel(p.montaj, MNT, MQ);
      const [x] = yaklasma(MNT);
      opHedef(x, -0.55, 0);
    } else if (j.tur === 'motor') {     // tezgâhtaki motorlu teker v1 arka tekere
      is.nesne = motorTez;
      gYerel(B1.arkaN, MNT, MQ);
      opHedef(MOTOR_TEZ.p[0] + 0.5, TZ + 0.85, -Math.PI * 0.75);
    } else if (j.tur === 'aktar') {     // motorlu teker parktaki v1'den standdaki v2'ye
      gYerel(B1.arkaM, BAS, BQ);
      opHedef(BAS.x, BAS.z + 0.55, Math.PI);
    } else if (j.tur === 'it') {
      const bp = j.bis.group.position;
      opHedef(bp.x, bp.z + 0.6, Math.PI);
    }
  }
  function isGuncelle(dt) {
    if (!is) {
      if (isler.length) { isBaslat(isler.shift()); return; }
      if (adim) { adim = false; uygula(asama + 1); return; }
      if (asama < hedefAsama) { isler = isListesi(asama); adim = true; }
      return;
    }
    const j = is;
    if (j.tur === 'tak' || j.tur === 'motor') {
      if (j.faz === 'git' && opVardi()) {
        j.faz = 'al'; j.k = 0;
        BAS.copy(j.nesne.position); BQ.copy(j.nesne.quaternion);
      } else if (j.faz === 'al') {
        j.k = Math.min(1, j.k + dt / 0.55);
        j.nesne.position.lerpVectors(BAS, eldeki(ELDE), easeInOut(j.k));
        if (j.k >= 1) {
          j.faz = 'tasi';
          if (j.tur === 'motor') opHedef(-0.54, -0.55, 0);
          else opHedef(j.sonra[0], j.sonra[1], 0);
        }
      } else if (j.faz === 'tasi') {
        j.nesne.position.copy(eldeki(ELDE));
        j.nesne.quaternion.slerp(MQ, Math.min(1, dt * 4));
        if (opVardi()) { j.faz = 'yerlestir'; j.k = 0; BAS.copy(j.nesne.position); BQ.copy(j.nesne.quaternion); }
      } else if (j.faz === 'yerlestir') {
        j.k = Math.min(1, j.k + dt / 0.9);
        const e = easeInOut(j.k);
        j.nesne.position.lerpVectors(BAS, MNT, e);
        j.nesne.quaternion.slerpQuaternions(BQ, MQ, e);
        if (j.k >= 1) {
          j.nesne.visible = false;
          if (j.tur === 'motor') { B1.arkaM.visible = true; B1.arkaN.visible = false; }
          else PARCA[j.ad].montaj.visible = true;
          is = null;
        }
      }
    } else if (j.tur === 'sok') {
      const p = PARCA[j.ad];
      if (j.faz === 'git' && opVardi()) {
        j.faz = 'cikar'; j.k = 0;
        p.montaj.visible = false; p.tezgah.visible = true;
        p.tezgah.position.copy(MNT); p.tezgah.quaternion.copy(MQ);
      } else if (j.faz === 'cikar') {
        j.k = Math.min(1, j.k + dt / 0.7);
        p.tezgah.position.lerpVectors(MNT, eldeki(ELDE), easeInOut(j.k));
        if (j.k >= 1) { j.faz = 'tasi'; opHedef(TEZ[j.ad][0], TZ + 0.68, Math.PI); }
      } else if (j.faz === 'tasi') {
        p.tezgah.position.copy(eldeki(ELDE));
        p.tezgah.quaternion.slerp(_q.identity(), Math.min(1, dt * 4));
        if (opVardi()) { j.faz = 'birak'; j.k = 0; BAS.copy(p.tezgah.position); }
      } else if (j.faz === 'birak') {
        j.k = Math.min(1, j.k + dt / 0.6);
        p.tezgah.position.lerpVectors(BAS, _v.fromArray(TEZ[j.ad]), easeInOut(j.k));
        if (j.k >= 1) { p.tezgah.quaternion.identity(); is = null; }
      }
    } else if (j.tur === 'aktar') {
      if (j.faz === 'git' && opVardi()) {
        j.faz = 'cikar'; j.k = 0;
        B1.arkaM.visible = false; B1.arkaN.visible = true;
        motorTez.visible = true; motorTez.position.copy(BAS); motorTez.quaternion.copy(BQ);
        gYerel(B2.arkaN, MNT, MQ);
      } else if (j.faz === 'cikar') {
        j.k = Math.min(1, j.k + dt / 0.7);
        motorTez.position.lerpVectors(BAS, eldeki(ELDE), easeInOut(j.k));
        if (j.k >= 1) { j.faz = 'tasi'; opHedef(MNT.x, -0.55, 0); }
      } else if (j.faz === 'tasi') {
        motorTez.position.copy(eldeki(ELDE));
        if (opVardi()) { j.faz = 'yerlestir'; j.k = 0; BAS.copy(motorTez.position); }
      } else if (j.faz === 'yerlestir') {
        j.k = Math.min(1, j.k + dt / 0.9);
        motorTez.position.lerpVectors(BAS, MNT, easeInOut(j.k));
        if (j.k >= 1) { motorTez.visible = false; B2.arkaM.visible = true; B2.arkaN.visible = false; is = null; }
      }
    } else if (j.tur === 'it') {
      const bg = j.bis.group;
      if (j.faz === 'git' && opVardi()) {
        j.faz = 'it'; j.bas = bg.position.clone();
        const h = YER[j.hedef];
        j.son = V(h[0], h[1], h[2]);
        j.mesafe = Math.hypot(j.son.x - j.bas.x, j.son.z - j.bas.z);
        j.k = 0;
      } else if (j.faz === 'it') {
        j.k = Math.min(1, j.k + (1.0 * dt) / Math.max(0.5, j.mesafe));
        const e = easeInOut(j.k);
        const ox = bg.position.x;
        bg.position.lerpVectors(j.bas, j.son, e);
        bg.position.y = lerp(j.bas.y, j.son.y, clamp(j.k * 3 - (j.bas.y > j.son.y ? 0 : 2), 0, 1));
        const dx = bg.position.x - ox;
        j.bis.onT.rotation.z -= dx / R; (j.bis.arkaM.visible ? j.bis.arkaM : j.bis.arkaN).rotation.z -= dx / R;
        opHedef(bg.position.x, bg.position.z + 0.6, Math.PI, 'on');
        opS.x = opS.hx; opS.z = opS.hz;   // bisikleti iterken yan yana
        if (j.k >= 1) is = null;
      }
    }
  }

  // ---------------------------------------------------------------- test / pil modeli
  // Akü (Kaan'dan): 4 × 12 V 9 Ah jel akü seri → 48 V 9 Ah ≈ 432 Wh. Kurşun-asitte kullanılabilir ≈ %80
  // (≈345 Wh): 20 km/h karışık sürüşte ≈ 7.8 Wh/km → ≈ 45 km; sürekli 30 km/h'de ≈ 13.7 Wh/km → ≈ 25 km.
  const PIL_WH = 432, KULLANILIR = 0.8;
  let test = false, gaz = 70, soc = 0.86, sarj = false, zayifBlok = false, acil = false;
  let hiz = 0, guc = 0, akim = 0, volt = 52, demo = true, demoT = 0;
  const yolGucu = (v) => 15 + 2.2 * v + 0.012 * v * v * v;   // v: km/h → W (düz yol, sürücü ~80 kg)
  const testOlur = () => !acil && (asama === 2 || asama === 3 || asama === 5) && !is && !isler.length && !adim && asama === hedefAsama;
  const testBis = () => (asama <= 3 ? B1 : B2);

  const trend = new Trend([
    { ad: 'Hız (km/h)', renk: '#39c5cf' }, { ad: 'Motor gücü (W/10)', renk: '#f2c200' }, { ad: 'Pil (%)', renk: '#2ea043' },
  ], { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(4), ekranBZ = throttle(4);

  function update(dt, t) {
    // demo döngüsü: aşamalar sırayla, 5'te test, sonra baştan (söküm anlık)
    if (demo && !acil) {
      if (!is && !isler.length && !adim && asama === hedefAsama) {
        demoT += dt;
        if (asama < 5 && demoT > 3) { hedefAsama = asama + 1; demoT = 0; }
        else if (asama === 5) {
          if (!test && demoT > 1.5 && demoT < 2) test = true;
          if (test && demoT > 16) test = false;
          if (demoT > 19) { hedefAsama = 1; is = null; isler = []; adim = false; uygula(1); demoT = 0; }
        }
      }
    }
    if (hedefAsama < asama) { test = false; is = null; isler = []; adim = false; uygula(hedefAsama); }
    isGuncelle(dt);
    if (test && !testOlur()) test = false;

    // motor (standda yüksüz): gaz → hız; zayıf akü bloğu gerilimi düşürür → kontrolcü gücü kısar
    const sinir = zayifBlok ? 0.45 : 1;
    const vHedef = test ? 32 * (gaz / 100) * sinir : 0;
    hiz = approach(hiz, vHedef, (test ? 9 : 14) * dt);
    guc = test ? 22 + 2.4 * hiz + gurultu(3) : 0;                 // yüksüz dönüş kaybı
    if (soc <= 0.02) { test = false; }
    // 4 blok jel akü: dinlenme ≈ 12.85 V/blok (dolu) … ≈ 11.8 V (kullanılabilir alt sınır); iç direnç ≈ 0.12 Ω
    volt = 4 * (11.8 + 1.05 * soc) - (zayifBlok ? 1.6 : 0) - (guc / 48) * 0.12;
    akim = guc / volt;
    if (test) soc = Math.max(0, soc - (guc * dt * 30) / (PIL_WH * KULLANILIR * 3600));   // ×30 hızlandırılmış
    if (sarj) { soc = Math.min(1, soc + dt * 0.03); if (soc >= 1) sarj = false; }
    sarjLed.color.set(soc >= 0.999 ? 0x2ea043 : 0xff3b30); sarjLed.emissive.copy(sarjLed.color);
    sarjLed.emissiveIntensity = sarj || soc >= 0.999 ? 1.8 : 0.3;
    ledMat.emissiveIntensity = test && asama === 5 ? 2.6 : 0.05;

    // teker dönüşü (standdaki bisikletin arka tekeri)
    if (hiz > 0.01) {
      const b = testBis();
      b.arkaM.rotation.z -= ((hiz / 3.6) / R) * dt;
    }

    // operatör: iş yoksa test sırasında gidonda, değilse tezgâhta
    if (!is) {
      // test: bisikletin arkasında gidonda (öndeki görüşü kapatmaz); boşta: tezgâhın sağ ucunda
      if (test) opHedef(BX + 0.62, BZ - 0.52, 0, 'on');
      else if (sarj) opHedef(-2.55, TZ + 0.7, Math.PI, 'on');
      else opHedef(1.0, TZ + 0.68, Math.PI, 'on');
    }
    const tasiyor = !!is && (is.faz === 'tasi');
    opGuncelle(dt, t, tasiyor);

    trend.ornekle(dt, [hiz, guc / 10, soc * 100]);
    const d = durumBilgi();
    if (ekranZ(dt)) {
      ekran.standart('E-Bisiklet · Test', [
        ['Aşama', `${asama}/5`],
        ['Hız', `${fmt(hiz, 1)} km/h`],
        ['Motor gücü', `${fmt(guc, 0)} W`],
        ['Pil', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
        ['Menzil (tahmini)', `${fmt(menzil(), 0)} km`],
      ], d);
    }
    if (ekranB && PARCA.ekran.montaj.visible && ekranBZ(dt)) {
      ekranB.ciz((x, W, H) => {
        x.fillStyle = '#05080b'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#7df9ff'; x.font = `700 ${Math.round(H * 0.5)}px "JetBrains Mono", monospace`;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(fmt(hiz, 0), W * 0.42, H * 0.42);
        x.font = `500 ${Math.round(H * 0.16)}px "Space Grotesk", sans-serif`; x.fillText('km/h', W * 0.8, H * 0.5);
        x.fillStyle = '#1d2a33'; x.fillRect(W * 0.08, H * 0.8, W * 0.84, H * 0.1);
        x.fillStyle = soc > 0.2 ? '#2ea043' : '#f85149'; x.fillRect(W * 0.08, H * 0.8, W * 0.84 * soc, H * 0.1);
      });
    }
  }
  const menzil = () => {
    const v = hiz > 3 ? hiz : 20;   // boşta: 20 km/h karışık sürüş
    return (soc * PIL_WH * KULLANILIR) / (yolGucu(v) / v);
  };
  function durumBilgi() {
    if (acil) return { metin: 'ACİL KESME · AKÜ DEVRESİ AÇIK', seviye: 'alarm' };
    if (is || isler.length || adim || asama < hedefAsama) return { metin: `MONTAJ · AŞAMA ${Math.min(5, asama + 1)}: ${ASAMA[Math.min(5, asama + 1)]}`, seviye: 'calisiyor' };
    if (test && zayifBlok) return { metin: 'ZAYIF AKÜ BLOĞU · GERİLİM DÜŞÜK · GÜÇ SINIRLI', seviye: 'uyari' };
    if (test) return { metin: `TEST · ${fmt(hiz, 0)} km/h · ${fmt(guc, 0)} W`, seviye: 'calisiyor' };
    if (sarj) return { metin: `ŞARJ · %${fmt(soc * 100, 0)}`, seviye: 'calisiyor' };
    if (soc < 0.15) return { metin: 'PİL ZAYIF · ŞARJ GEREKLİ', seviye: 'uyari' };
    return { metin: `AŞAMA ${asama}/5 · ${ASAMA[asama]}`, seviye: 'bekliyor' };
  }

  const kontroller = [
    { tip: 'baslik', metin: 'Montaj' },
    { tip: 'secim', metin: 'Montaj aşaması', secenekler: Object.entries(ASAMA).map(([k, v]) => [k, `${k} · ${v}`]),
      get: () => String(hedefAsama), set: (v) => { hedefAsama = clamp(+v, 1, 5); demo = false; acil = false; } },
    { tip: 'butonlar', ogeler: [
      { metin: '◀ Önceki', tik: () => { hedefAsama = Math.max(1, Math.min(asama, hedefAsama) - 1); demo = false; } },
      { metin: 'Sonraki ▶', tur: 'basla', tik: () => { hedefAsama = Math.min(5, Math.max(asama, hedefAsama) + 1); demo = false; acil = false; } },
      { metin: 'Baştan', tik: () => { hedefAsama = 1; demo = false; } },
    ] },
    { tip: 'anahtar', metin: 'Otomatik tur (montaj → test → baştan)', get: () => demo, set: (v) => { demo = v; demoT = 0; } },
    { tip: 'baslik', metin: 'Test (arka teker standda)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Testi başlat', tur: 'basla', tik: () => { if (testOlur()) { test = true; sarj = false; demo = false; } } },
      { metin: 'Durdur', tur: 'dur', tik: () => { test = false; demo = false; } },
      { metin: 'Şarj et', tik: () => { if (asama >= 2 && !test) { sarj = true; demo = false; } } },
    ] },
    { tip: 'kaydirici', metin: 'Gaz', min: 0, max: 100, adim: 5, birim: '%', get: () => gaz, set: (v) => (gaz = v) },
    { tip: 'baslik', metin: 'Arıza / güvenlik' },
    { tip: 'anahtar', metin: 'Zayıf akü bloğu (simülasyon)', get: () => zayifBlok, set: (v) => (zayifBlok = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL KESME', tur: 'acil', tik: () => { acil = true; test = false; sarj = false; } },
      { metin: 'Reset', tik: () => { acil = false; } },
    ] },
  ];

  return {
    id: 'ebisiklet',
    ad: 'Elektrikli Bisiklet Dönüşümü',
    altBaslik: 'Kişisel · 500 W arka göbek motoru · 48 V jel akü',
    kisa: 'Kişisel projem: sıradan bir dağ bisikletini 500 W arka göbek motoru ve 48 V jel akü paketiyle (4 × 12 V 9 Ah seri) elektrikliye çevirdim (30 km/h, 45 km menzil). Önce kırmızı donör kadroda denedim, sonra parçaları siyah kadroya taşıyıp karbon desenli üçgen akü kutusu, gidon ekranı ve çift LED farla bitirdim. İstasyonda aşamaları seçip montajı ve standda motor testini izleyebilirsin.',
    proje: 'personal-projects',
    ayakIzi: [9, 7.6],
    ayakIziMerkez: [-0.3, -0.2],
    kamera: { poz: [0.25, 2.45, 5.7], hedef: [-0.05, 0.7, -0.35] },
    mekanizmalar: [
      'Aşama seçimi: operatör parçayı tezgâhtan alır, taşır ve bisiklete takar; geri alınca parçalar anında sökülür',
      'Aşama 2: tezgâha yaslı motorlu teker (500 W göbek motoru) arka tekerin yerine, taşıyıcılı akü kutusu selenin arkasına',
      'Aşama 3: taşıyıcıdaki kutu sökülür, kırmızı üçgen akü kutusu kadroya, krom far gidona',
      'Aşama 4: kırmızı bisiklet kenara itilir, siyah kadro standa gelir; motorlu teker eski bisikletten sökülüp siyah kadroya takılır, karbon desenli üçgen akü kutusu (şarj soketli) yerleşir',
      'Aşama 5: kontrolcü, gidon ekranı + gaz kolu, çift LED far, sele çantası',
      'Test: arka teker standda gaza göre döner; gidon ekranı hız ve akü seviyesini, test monitörü güç/menzili gösterir',
      'Şarj: şarj cihazının ledi şarjda kırmızı, dolunca yeşil',
    ],
    cikarim: [
      'Kırmızı/gri donör kadro, taşıyıcıdaki akü kutusu ve yerdeki kontrolcü/şarj cihazı img-03, img-07 ve img-01\'den; siyah kadro, karbon desenli üçgen kutu, sele çantası ve çift far img-04/05/06/10\'dan alındı.',
      'img-04\'te siyah kadroda kısa süre kırmızı kutu da görünüyor; istasyonda sade olsun diye aşama 4\'te doğrudan siyah kutuya geçildi.',
      'Akü Kaan\'dan: 4 adet 12 V 9 Ah jel akü seri bağlı → 48 V 9 Ah (≈432 Wh); motor arka tekerde 500 W göbek motoru. Kutular kapalı olduğu için aküler dışarıdan görünmüyor.',
      'Menzil kullanılabilir ≈%80 kapasite (≈345 Wh) ve yol gücü modeliyle tahmin edilir: 20 km/h karışık sürüşte ≈45 km, sürekli 30 km/h\'de ≈25 km. Gerilim 4 bloklu kurşun-asit eğrisiyle (≈51 V dolu, ≈47 V alt sınır).',
      'Standda teker yüksüz döner (≈30–100 W); menzil yol gücü modeliyle tahmin edilir, standdaki tüketimden değil.',
      'Kadro ölçüleri 26" teker ve fotoğraftaki karo boyutuna (≈33 cm) oranlanarak alındı; kontrolcünün yeri görünmediği için zincir çatalı üstüne konuldu.',
      'personal-img-08/09 ve video-02\'deki paletli RC robot ayrı bir proje; bu istasyonda yok.',
    ],
    group: g,
    sabitHaric: () => [B1.group, B2.group, motorTez, yerV1, sarjT, ...Object.values(PARCA).map((p) => p.tezgah)],
    update,
    kontroller,
    degerler: () => [
      ['Aşama', `${asama}/5 · ${ASAMA[asama]}`],
      ['Kadro', asama <= 3 ? 'v1 · kırmızı/gri donör' : 'v2 · siyah'],
      ['Motor', asama >= 2 ? '500 W arka göbek' : '—'],
      ['Hız', `${fmt(hiz, 1)} km/h`],
      ['Motor gücü (standda)', `${fmt(guc, 0)} W · ${fmt(akim, 1)} A`],
      ['Pil', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
      ['Yolda güç @hız', `${fmt(yolGucu(hiz > 3 ? hiz : 30), 0)} W`],
      ['Menzil (tahmini)', `${fmt(menzil(), 0)} km`],
      ['Akü (4 × 12 V 9 Ah jel)', acil ? 'devre açık' : zayifBlok ? '1 blok zayıf' : 'normal'],
    ],
    trend,
    durum: durumBilgi,
  };
}
