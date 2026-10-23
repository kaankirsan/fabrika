// js/machines/sasi.js — Tren Şasesi Döndürme Pozisyoneri (MKN-F01).
//
// Kaan'ın tarifi: tren şasesinin uç kısımları iki kuleye bağlanır, şase KENDİ
// EKSENİ etrafında YAVAŞÇA döndürülür; böylece etraftaki operatörler şasenin
// kaynak yapılacak yerlerine kaynak yapar.
// Fotoğraftan (other-machines-img-01): iki gri çelik kule (biri "P5" yazılı),
// kulede dikey kızaklı taşıyıcı + dişli kutulu motor + yuvarlak döner ayna (flanş),
// altta hidrolik silindirler, mavi hidrolik güç ünitesi, tepe lambalı beyaz pano.
//
// Çevrim (otomatik): 0° → kilit → kaynak → 90° → kilit → kaynak → 180° → … Döndürme
// sırasında kaynak yapılmaz (fren kilidi); kaynakçılar süpürme yarıçapının dışına çekilir.
// Dikişler yalnız "ulaşılabilir" konumdayken yapılır: yükseklik 0.35–2.45 m ve dikiş
// yüzü tavana bakmıyor (tavan kaynağı yok) — şasenin döndürülme sebebi bu.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, rod, sphere, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop,
    clamp, approach, damp, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ölçüler
  const TX = 6.6;                 // kule (ayna) ekseni x
  const L = 12.0;                 // şase boyu
  const SB = 1.35;                // yan kiriş (sole bar) z
  const YMIN = 1.6, YMAX = 2.4;   // eksen yüksekliği (süpürme yarıçapı ~1.5 m)
  const SUPURME = 1.55;

  const gri = mat(0x6d737a, { r: 0.55, m: 0.35, key: 'sasi-gri' });
  const celik = mat(0x3c3f43, { r: 0.6, m: 0.55, key: 'sasi-celik' });
  const astar = mat(0x6b3426, { r: 0.7, m: 0.2, key: 'sasi-astar' });

  // ---------------------------------------------------------------- kuleler
  function hidrolikRod(parent, x, z) {
    const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 12);
    geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, M.krom);
    m.position.set(x, 0.8, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function kuleKur(s) {
    const k = { s };
    const xc = s * (TX + 0.25);
    // zemin çerçevesi
    for (const sz of [-1, 1]) box(1.7, 0.1, 0.12, gri, xc, 0.05, sz * 0.98, g);
    for (const sx of [-1, 1]) box(0.12, 0.1, 2.0, gri, xc + sx * 0.79, 0.05, 0, g);
    // kolonlar + kızak rayları + üst kiriş + arka çaprazlar
    for (const sz of [-1, 1]) {
      box(0.22, 3.4, 0.22, gri, s * (TX + 0.15), 1.75, sz * 0.42, g);
      box(0.05, 2.9, 0.05, M.celik, s * (TX + 0.15), 1.6, sz * 0.29, g);
      beam([s * (TX + 1.0), 0.12, sz * 0.42], [s * (TX + 0.25), 3.0, sz * 0.42], 0.12, 0.12, gri, g);
    }
    box(0.34, 0.26, 1.15, gri, s * (TX + 0.15), 3.5, 0, g);
    // hidrolik silindirler (taşıyıcıyı kaldırır)
    k.rodlar = [-0.22, 0.22].map((z) => {
      cyl(0.06, 0.7, M.siyah, s * TX, 0.45, z, g, { seg: 14 });
      return hidrolikRod(g, s * TX, z);
    });
    // taşıyıcı (dikey kızakta)
    k.tasiyici = new THREE.Group();
    g.add(k.tasiyici);
    box(0.42, 0.95, 0.72, gri, s * 0.1, 0, 0, k.tasiyici);
    box(0.32, 0.3, 0.36, M.koyu, s * 0.48, 0.12, 0, k.tasiyici);                  // dişli kutusu
    cyl(0.1, 0.36, mat(0x58606a, { r: 0.5, m: 0.4 }), s * 0.48, 0.12, 0.34, k.tasiyici, { eksen: 'z', seg: 18 }); // motor
    // döner ayna (flanş) — şaseyle birlikte döner
    k.ayna = new THREE.Group();
    k.ayna.position.x = -s * 0.15;
    k.tasiyici.add(k.ayna);
    cyl(0.34, 0.08, M.celik, 0, 0, 0, k.ayna, { eksen: 'x', seg: 28 });
    cyl(0.09, 0.1, M.koyu, -s * 0.02, 0, 0, k.ayna, { eksen: 'x', seg: 16 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cyl(0.022, 0.1, M.siyah, -s * 0.01, Math.cos(a) * 0.25, Math.sin(a) * 0.25, k.ayna, { eksen: 'x', seg: 8 });
    }
    return k;
  }
  const K = [kuleKur(-1), kuleKur(1)];
  const p5 = levha(['P5'], 0.36, 0.22, { bg: '#5f656c', fg: '#e8392e', font: 110, px: 256 });
  p5.position.set(-(TX + 0.15), 3.2, 0.535);
  g.add(p5);

  // ---------------------------------------------------------------- şase (ekseni etrafında döner)
  const sase = new THREE.Group();
  g.add(sase);
  for (const sz of [-1, 1]) {                                     // yan kirişler (I profil)
    box(L, 0.36, 0.022, celik, 0, 0, sz * SB, sase);
    for (const sy of [-1, 1]) box(L, 0.025, 0.15, celik, 0, sy * 0.18, sz * SB, sase);
  }
  box(L, 0.3, 0.3, celik, 0, 0, 0, sase);                         // orta kiriş
  const XLER = [-4, -2, 0, 2, 4];
  for (const x of XLER) box(0.14, 0.24, 2 * SB - 0.04, x === 0 ? astar : celik, x, 0, 0, sase); // traversler
  for (const x of [-3, 3]) box(0.4, 0.32, 2 * SB - 0.04, astar, x, 0, 0, sase);                 // boji yastık kirişleri
  for (const sx of [-1, 1]) {
    box(0.3, 0.36, 2 * SB + 0.2, astar, sx * (L / 2 - 0.15), 0, 0, sase);                       // başlık kirişleri
    for (const sz of [-1, 1]) cyl(0.11, 0.22, M.koyu, sx * (L / 2 + 0.05), 0, sz * 0.87, sase, { eksen: 'x', seg: 14 }); // tamponlar
    box(0.08, 0.85, 1.25, M.koyu, sx * (L / 2 + 0.22), 0, 0, sase);                              // ayna adaptörü
    cyl(0.12, 0.26, M.koyu, sx * (L / 2 + 0.33), 0, 0, sase, { eksen: 'x', seg: 16 });
  }

  // Dikişler: her travers × her yan kiriş: üst yüz, alt yüz, dış yan (köşebent) → 30 dikiş
  const sicak = new THREE.MeshStandardMaterial({ color: 0x3b3833, emissive: 0xff6a10, emissiveIntensity: 2.2, roughness: 0.6, metalness: 0.5 });
  const soguk = mat(0x2a2826, { r: 0.6, m: 0.5, key: 'sasi-dikis' });
  const DIKIS = [];
  for (const x of XLER) for (const sz of [-1, 1]) {
    DIKIS.push({ p: new THREE.Vector3(x, 0.205, sz * (SB - 0.1)), n: new THREE.Vector3(0, 1, 0), boyut: [0.04, 0.025, 0.16] });
    DIKIS.push({ p: new THREE.Vector3(x, -0.205, sz * (SB - 0.1)), n: new THREE.Vector3(0, -1, 0), boyut: [0.04, 0.025, 0.16] });
    DIKIS.push({ p: new THREE.Vector3(x, 0, sz * (SB + 0.09)), n: new THREE.Vector3(0, 0, sz), boyut: [0.04, 0.16, 0.025] });
  }
  DIKIS.forEach((d) => {
    d.mesh = box(d.boyut[0], d.boyut[1], d.boyut[2], soguk, d.p.x, d.p.y, d.p.z, sase);
    d.mesh.visible = false;
    d.yapildi = false; d.rezerve = -1; d.sogu = 0;
  });

  // ---------------------------------------------------------------- hidrolik ünite + pano
  const HU = { x: -7.4, z: 1.7 };
  box(0.9, 0.55, 0.55, mat(0x2f6db5, { r: 0.45, m: 0.3, key: 'hu-mavi' }), HU.x, 0.33, HU.z, g);
  box(0.95, 0.04, 0.6, M.koyu, HU.x, 0.04, HU.z, g);
  cyl(0.13, 0.36, mat(0x7d858e, { r: 0.45, m: 0.5 }), HU.x + 0.15, 0.78, HU.z, g, { seg: 18 });           // motor
  cyl(0.15, 0.04, M.koyu, HU.x + 0.15, 0.98, HU.z, g, { seg: 18 });
  box(0.18, 0.16, 0.14, mat(0x2a5e9e, { r: 0.4, m: 0.4 }), HU.x - 0.25, 0.68, HU.z + 0.05, g);              // valf bloğu
  box(0.04, 0.1, 0.01, mat(0xd8b24a, { r: 0.3, m: 0.1 }), HU.x + 0.3, 0.38, HU.z + 0.28, g);               // yağ seviye
  rod([HU.x - 0.25, 0.6, HU.z - 0.1], [-TX, 0.12, 0.3], 0.016, M.siyah, g);
  rod([HU.x - 0.2, 0.6, HU.z - 0.2], [-6.0, 0.03, 1.15], 0.016, M.siyah, g);
  rod([-6.0, 0.03, 1.15], [TX - 0.5, 0.03, 1.15], 0.016, M.siyah, g);
  rod([TX - 0.5, 0.03, 1.15], [TX, 0.12, 0.3], 0.016, M.siyah, g);

  const PX = -(TX + 0.15), PY = 1.55, PZ = 0.66;
  box(0.62, 0.86, 0.25, M.beyaz, PX, PY, PZ, g);
  const ekran = new Ekran(0.36, 0.22, 512);
  ekran.mesh.position.set(PX, PY + 0.17, PZ + 0.127);
  g.add(ekran.mesh);
  const butonlar = [0x2ea043, 0x2ea043, 0xe5302a, 0xe5302a].map((r, i) => {
    const m = lamba(r, 0.1);
    cyl(0.024, 0.02, m, PX - 0.18 + i * 0.12, PY - 0.12, PZ + 0.135, g, { eksen: 'z', seg: 14 });
    return m;
  });
  for (let i = 0; i < 2; i++) cyl(0.022, 0.03, M.siyah, PX - 0.06 + i * 0.12, PY - 0.27, PZ + 0.14, g, { eksen: 'z', seg: 10 }); // seçiciler
  acilStop(g, PX + 0.21, PY - 0.27, PZ + 0.16, 0);
  const kule = kuleLambasi(g, PX, PY + 0.43, PZ);

  // ---------------------------------------------------------------- kaynakçılar
  // ortak lib.operator modeli, kaynakçı sürümü (kaynak maskesi + deri önlük); yüz +Z.
  // Sağ kol torç ucuna doğru yönlendirilir; torç (boyun) elden dikişe uzanır.
  const _Y = new THREE.Vector3(0, 1, 0);
  const torcGeo = new THREE.CylinderGeometry(0.016, 0.02, 1, 8);
  const KAYNAKCI_BASLANGIC = [[-3.5, 2.6], [0.5, -2.6], [3.5, 2.6]];
  const KC = KAYNAKCI_BASLANGIC.map(([x, z], i) => {
    const op = lib.operator({ kaynakci: true });
    const grp = op.group;
    g.add(grp);
    const torc = new THREE.Mesh(torcGeo, M.koyu);
    torc.castShadow = true;
    g.add(torc);
    // taraf: kaynakçı yalnız kendi tarafındaki dikişleri alır (şasenin içinden karşıya geçmesin)
    return { i, op, grp, torc, x, z, taraf: Math.sign(z), yon: z > 0 ? Math.PI : 0, hedef: null, hedefV: new THREE.Vector3(),
      dikis: -1, t: 0, kaynak: false, yuruyor: false, ark: false, ucX: 0, ucY: 0, ucZ: 0 };
  });

  // kıvılcım + ark ışığı
  const KN = 160;
  const kPos = new Float32Array(KN * 3).fill(-10), kHiz = new Float32Array(KN * 3), kOmur = new Float32Array(KN);
  const kGeo = new THREE.BufferGeometry();
  kGeo.setAttribute('position', new THREE.BufferAttribute(kPos, 3));
  const kivilcim = new THREE.Points(kGeo, new THREE.PointsMaterial({
    color: 0xffb347, size: 0.035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  kivilcim.frustumCulled = false;
  g.add(kivilcim);
  let kSira = 0;
  const arkIsik = new THREE.PointLight(0xffb070, 0, 7, 2);
  arkIsik.castShadow = false;
  g.add(arkIsik);

  // ---------------------------------------------------------------- durum
  let mod = 'oto';              // oto | man
  let durum = 'calisiyor';      // calisiyor | durdu | acil
  let faz = 'kaynak';           // don | kaynak | tamam  (otomatik)
  let aci = 0, hedefAci = 0, w = 0;
  let rpm = 1.5;
  let eksenY = 1.9, hedefY = 1.9, basinc = 0;
  let kaynakcilarAcik = true;
  let jogDon = 0, jogY = 0;
  let durgunT = 0, tamamT = 0, sasiNo = 1;
  let cekil = false;            // döndürme istendi: kaynakçılar süpürme alanından çekilsin
  let uyariMetin = '', uyariT = 0;
  const uyar = (m) => { uyariMetin = m; uyariT = 2.2; };
  const ADIM = Math.PI / 2;
  const yapilanSay = () => DIKIS.reduce((n, d) => n + (d.yapildi ? 1 : 0), 0);
  const kaynakVar = () => KC.some((k) => k.kaynak);

  // şase yerel → makine yerel (konum, normal)
  const _p = new THREE.Vector3(), _n = new THREE.Vector3();
  function dunya(d, outP, outN) {
    const c = Math.cos(aci), s = Math.sin(aci);
    outP.set(d.p.x, eksenY + d.p.y * c - d.p.z * s, d.p.y * s + d.p.z * c);
    if (outN) outN.set(0, d.n.y * c - d.n.z * s, d.n.y * s + d.n.z * c);
    return outP;
  }
  function ulasilir(d) {
    dunya(d, _p, _n);
    return _p.y > 0.35 && _p.y < 2.45 && _n.y > -0.2;
  }
  // dikişe hangi taraftan (z işareti) yaklaşılır — dunya() çağrısından sonra
  const yaklasmaTarafi = () => (Math.abs(_n.y) < 0.7 && Math.abs(_n.z) > 0.01 ? Math.sign(_n.z) : (_p.z >= 0 ? 1 : -1));
  const disarida = () => KC.every((k) => Math.abs(k.z) > SUPURME + 0.45);
  // kaynakçının duracağı nokta: yatay normalde yüzün önü, yukarı normalde kirişin yanı
  function durusNoktasi(d, out) {
    dunya(d, _p, _n);
    const yatay = Math.hypot(_n.x, _n.z);
    if (Math.abs(_n.y) < 0.7 && yatay > 0.01) out.set(_p.x, 0, _p.z + (_n.z / yatay) * 0.75);
    else {
      const yan = _p.z >= 0 ? 1 : -1;
      out.set(_p.x, 0, _p.z + yan * 0.75);
    }
    // şase yatayken altına girme
    if (Math.abs(Math.cos(aci)) > 0.6 && Math.abs(out.z) < 1.95) out.z = Math.sign(out.z || 1) * 1.95;
    out.x += (Math.random() - 0.5) * 0.1;
    return out;
  }

  // ---------------------------------------------------------------- kaynakçı mantığı
  const _h = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const _yerel = new THREE.Vector3(), _NY = new THREE.Vector3(0, -1, 0);
  function kaynakciGuncelle(k, dt, t) {
    const donuyor = Math.abs(w) > 0.0005 || durum !== 'calisiyor';
    if (donuyor || cekil || !kaynakcilarAcik) {
      if (k.dikis >= 0 && !k.kaynak) { DIKIS[k.dikis].rezerve = -1; k.dikis = -1; }
      if (!k.kaynak) {                       // süpürme yarıçapı dışına çekil
        k.hedef = k.hedefV.set(k.x, 0, k.taraf * (SUPURME + 1.0));
      }
    } else if (k.dikis < 0 && durgunT > 0.6) {
      // kendi tarafındaki en yakın ulaşılabilir, boş dikişi seç
      let en = -1, ed = 1e9;
      DIKIS.forEach((d, i) => {
        if (d.yapildi || d.rezerve >= 0 || !ulasilir(d) || yaklasmaTarafi() !== k.taraf) return;
        const dd = Math.abs(d.p.x - k.x);
        if (dd < ed) { ed = dd; en = i; }
      });
      if (en >= 0) {
        k.dikis = en; DIKIS[en].rezerve = k.i;
        k.hedef = durusNoktasi(DIKIS[en], k.hedefV);
      } else k.hedef = null;
    }
    // yürüme
    k.yuruyor = false;
    if (k.hedef && !k.kaynak) {
      const dx = k.hedef.x - k.x, dz = k.hedef.z - k.z, dd = Math.hypot(dx, dz), adim = 1.1 * dt;
      if (dd > 0.02) {
        const f = Math.min(1, adim / dd);
        k.x += dx * f; k.z += dz * f;
        k.yon = Math.atan2(dx, dz);
        k.yuruyor = true;
      } else if (k.dikis >= 0 && !donuyor) { k.kaynak = true; k.t = 0; DIKIS[k.dikis].mesh.visible = true; DIKIS[k.dikis].mesh.material = sicak; }
    }
    // kaynak
    const d = k.dikis >= 0 ? DIKIS[k.dikis] : null;
    if (k.kaynak && d) {
      if (durum !== 'calisiyor') { /* acil: ark söner, bekler */ }
      else {
        k.t += dt;
        const ilerle = Math.min(1, k.t / 1.3);
        d.mesh.scale.set(d.boyut[0] > 0.1 ? ilerle : 1, d.boyut[1] > 0.1 ? ilerle : 1, d.boyut[2] > 0.1 ? ilerle : 1);
        if (ilerle >= 1) {
          d.yapildi = true; d.sogu = 2.5; d.rezerve = -1;
          k.kaynak = false; k.dikis = -1; k.hedef = null;
        }
      }
    }
    // torç ucu: kaynakta (ya da dikişe varırken) dikişe, aksi halde öne-aşağı
    let uc;
    const calis = d && (k.kaynak || (k.hedef && Math.hypot(k.hedef.x - k.x, k.hedef.z - k.z) < 0.3));
    if (calis) {
      uc = dunya(d, _h, _n).addScaledVector(_n, 0.05);
      k.yon = Math.atan2(uc.x - k.x, uc.z - k.z);
    } else uc = _h.set(k.x + Math.sin(k.yon) * 0.5, 0.92, k.z + Math.cos(k.yon) * 0.5);
    // gövde: operatör pozu + yürüme salınımı (sol kol 'on'/'yan'; sağ kol aşağıda torca kilitlenir)
    k.op.poz(calis ? 'on' : 'yan');
    const zipla = k.op.yuru(t + k.i, k.yuruyor);
    k.grp.position.set(k.x, zipla, k.z);
    k.grp.rotation.y = k.yon;
    // sağ omuz (operatör yerel 0.3, 1.25, 0) → makine çerçevesi; kol torç ucuna yönelir
    const cy = Math.cos(k.yon), sy = Math.sin(k.yon);
    const omuz = _o.set(k.x + 0.3 * cy, zipla + 1.25, k.z - 0.3 * sy);
    _d.subVectors(uc, omuz);
    const mesafe = Math.max(0.05, _d.length());
    _d.multiplyScalar(1 / mesafe);
    _yerel.set(_d.x * cy - _d.z * sy, _d.y, _d.x * sy + _d.z * cy);            // kol yönü, operatör yerel
    k.op.kolSag.quaternion.setFromUnitVectors(_NY, _yerel);
    // torç boynu: elden (kol 0.55 m) torç ucuna
    const boy = Math.max(0.12, mesafe - 0.55);
    k.torc.position.copy(omuz).addScaledVector(_d, 0.55 + boy / 2);
    k.torc.quaternion.setFromUnitVectors(_Y, _d);
    k.torc.scale.set(1, boy, 1);
    uc = _h.copy(omuz).addScaledVector(_d, 0.55 + boy);
    k.ucX = uc.x; k.ucY = uc.y; k.ucZ = uc.z;
    k.ark = k.kaynak && durum === 'calisiyor';
  }

  function kivilcimGuncelle(dt) {
    let isikVar = false;
    for (const k of KC) {
      if (!k.ark) continue;
      if (!isikVar) { arkIsik.position.set(k.ucX, k.ucY, k.ucZ); isikVar = true; }
      const n = Math.ceil(dt * 220);
      for (let i = 0; i < n; i++) {
        const j = kSira++ % KN;
        kPos[j * 3] = k.ucX; kPos[j * 3 + 1] = k.ucY; kPos[j * 3 + 2] = k.ucZ;
        kHiz[j * 3] = gurultu(1.5); kHiz[j * 3 + 1] = Math.random() * 1.8 - 0.2; kHiz[j * 3 + 2] = gurultu(1.5);
        kOmur[j] = 0.25 + Math.random() * 0.45;
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
    arkIsik.intensity = isikVar ? 10 + Math.random() * 16 : 0;
  }

  // ---------------------------------------------------------------- otomatik sıra
  function sonrakiAdim() {
    // bu açıda ulaşılabilir boş dikiş kalmadıysa bir sonraki 90°'ye
    hedefAci = (Math.round(aci / ADIM) + 1) * ADIM;
    faz = 'don';
  }
  function otoCevrim(dt) {
    if (faz === 'tamam') {
      tamamT += dt;
      if (tamamT > 4) {                       // yeni şase (dikişler sıfırlanır)
        DIKIS.forEach((d) => { d.yapildi = false; d.rezerve = -1; d.mesh.visible = false; d.mesh.material = soguk; d.mesh.scale.set(1, 1, 1); });
        sasiNo++; faz = 'kaynak'; tamamT = 0;
      }
      return;
    }
    if (faz === 'don') {
      if (Math.abs(hedefAci - aci) < 0.0005 && Math.abs(w) < 0.0005) {
        aci = hedefAci;
        if (aci >= Math.PI * 2 - 1e-4) { aci -= Math.PI * 2; hedefAci = aci; }
        faz = yapilanSay() === DIKIS.length ? 'tamam' : 'kaynak';
        tamamT = 0;
      }
      return;
    }
    // faz === 'kaynak': ulaşılabilir boş dikiş yoksa ve kimse kaynak yapmıyorsa dön
    if (durgunT < 1.0 || kaynakVar() || !kaynakcilarAcik) return;
    if (KC.some((k) => k.dikis >= 0)) return;
    if (!DIKIS.some((d) => !d.yapildi && ulasilir(d))) sonrakiAdim();
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'Açı °', renk: '#39c5cf' }, { ad: 'Yükseklik cm', renk: '#f2c200' }], { min: 0, max: 360, uzunluk: 300 });
  const ekranZ = throttle(5);

  function update(dt, t) {
    if (durum === 'calisiyor') {
      if (mod === 'oto') otoCevrim(dt);
      else if (jogDon) {
        if (kaynakVar()) { uyar('KAYNAK SÜRÜYOR · DÖNDÜRME KİLİTLİ'); }
        else hedefAci = aci + jogDon * 0.6;
      }
    }
    // döndürme: hız sınırlı, yaklaşırken yavaşlar. Fren kilidi: kaynak sürerken dönmez;
    // dönüş istenince önce kaynakçılar süpürme alanından çekilir, sonra döner.
    const wMax = (rpm * 2 * Math.PI) / 60;
    const kilit = kaynakVar() || durum !== 'calisiyor';
    const istek = Math.abs(hedefAci - aci) > 0.0005;
    if (istek && !kaynakVar() && durum === 'calisiyor') cekil = true;
    const izin = !kilit && (!istek || disarida() || Math.abs(w) > 0.0005);
    // yamuk profil: kalan açıda duracak hızla sınırla (aşma yok)
    const hata = hedefAci - aci, IVME = 0.06;
    const wHedef = izin ? Math.sign(hata) * Math.min(wMax, Math.sqrt(2 * IVME * Math.abs(hata)) * 0.95, Math.abs(hata) * 4) : 0;
    w = approach(w, wHedef, (durum === 'acil' ? 0.4 : IVME) * dt);
    aci += w * dt;
    if (!istek && Math.abs(w) < 0.0005) cekil = false;
    if (kaynakVar() && mod === 'man' && !jogDon) hedefAci = aci;
    durgunT = Math.abs(w) < 0.0005 && !cekil ? durgunT + dt : 0;

    // yükseklik (hidrolik): yalnız dönmüyorken
    if (durum === 'calisiyor' && jogY && Math.abs(w) < 0.0005) hedefY = clamp(hedefY + jogY * 0.12 * dt, YMIN, YMAX);
    const eskiY = eksenY;
    eksenY = durum === 'acil' ? eksenY : approach(eksenY, hedefY, 0.08 * dt);
    const vy = (eksenY - eskiY) / Math.max(dt, 1e-4);
    basinc = Math.max(0, damp(basinc, vy > 0.001 ? 135 : vy < -0.001 ? 40 : Math.abs(w) > 0.0005 ? 18 : 0, 5, dt) + (basinc > 1 ? gurultu(0.4) : 0));

    // görsel: taşıyıcılar, aynalar, şase, silindir milleri
    for (const k of K) {
      k.tasiyici.position.set(k.s * TX, eksenY, 0);
      k.ayna.rotation.x = aci;
      for (const r of k.rodlar) r.scale.y = Math.max(0.05, eksenY - 0.475 - 0.8);
    }
    sase.position.y = eksenY;
    sase.rotation.x = aci;

    for (const k of KC) kaynakciGuncelle(k, dt, t);
    DIKIS.forEach((d) => {
      if (d.sogu > 0) { d.sogu -= dt; if (d.sogu <= 0) d.mesh.material = soguk; }
    });
    kivilcimGuncelle(dt);
    uyariT = Math.max(0, uyariT - dt);

    const db = durumBilgi();
    kule.set(db.seviye, t);
    butonlar[0].emissiveIntensity = durum === 'calisiyor' ? 2 : 0.1;
    butonlar[1].emissiveIntensity = Math.abs(w) > 0.0005 ? 2 : 0.1;
    butonlar[2].emissiveIntensity = kilit ? 1.6 : 0.1;
    butonlar[3].emissiveIntensity = durum === 'acil' && Math.sin(t * 8) > 0 ? 2.4 : 0.1;
    trend.ornekle(dt, [aciDerece(), eksenY * 100]);
    if (ekranZ(dt)) {
      ekran.standart('Şase Döndürme · P5', [
        ['Açı', `${fmt(aciDerece(), 1)}°`],
        ['Hız', `${fmt((w * 60) / (2 * Math.PI), 2)} dev/dk`],
        ['Yükseklik', `${fmt(eksenY * 1000, 0)} mm`],
        ['Hidrolik', `${fmt(basinc, 0)} bar`],
        ['Dikiş', `${yapilanSay()} / ${DIKIS.length}`],
      ], db);
    }
  }
  const aciDerece = () => ((((aci * 180) / Math.PI) % 360) + 360) % 360;

  function durumBilgi() {
    if (durum === 'acil') return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (durum === 'durdu') return { metin: 'HAZIR · BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (Math.abs(w) > 0.0005) return { metin: `DÖNDÜRÜLÜYOR → ${fmt(((hedefAci * 180) / Math.PI) % 360, 0)}°`, seviye: 'calisiyor' };
    if (mod === 'oto' && faz === 'tamam') return { metin: `ŞASE #${sasiNo} TAMAM`, seviye: 'calisiyor' };
    if (kaynakVar()) return { metin: `KİLİTLİ · KAYNAK ${fmt(aciDerece(), 0)}°`, seviye: 'calisiyor' };
    return { metin: mod === 'oto' ? 'OTOMATİK · KİLİTLİ' : 'MANUEL', seviye: mod === 'oto' ? 'calisiyor' : 'bekliyor' };
  }

  const aciyaGit = (der) => () => {
    if (mod !== 'man' || durum !== 'calisiyor') return uyar('MANUEL MODDA KULLAN');
    if (kaynakVar()) return uyar('KAYNAK SÜRÜYOR · DÖNDÜRME KİLİTLİ');
    // en kısa yoldan hedef açıya
    const h = (der * Math.PI) / 180;
    let fark = (h - aci) % (Math.PI * 2);
    if (fark > Math.PI) fark -= Math.PI * 2;
    if (fark < -Math.PI) fark += Math.PI * 2;
    hedefAci = aci + fark;
  };

  const kontroller = [
    { tip: 'secim', metin: 'Mod', secenekler: [['oto', 'Otomatik (90° adımlı)'], ['man', 'Manuel']], get: () => mod,
      set: (v) => { mod = v; jogDon = 0; if (v === 'oto') { hedefAci = Math.round(aci / ADIM) * ADIM; faz = 'don'; } else hedefAci = aci; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (durum === 'durdu') durum = 'calisiyor'; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { if (durum === 'calisiyor') durum = 'durdu'; } },
    ] },
    { tip: 'kaydirici', metin: 'Döndürme hızı', min: 0.3, max: 3, adim: 0.1, birim: 'dev/dk', get: () => rpm, set: (v) => (rpm = v) },
    { tip: 'baslik', metin: 'Manuel döndürme (mod: Manuel)' },
    { tip: 'butonlar', ogeler: [0, 90, 180, 270].map((d) => ({ metin: `${d}°`, tik: aciyaGit(d) })) },
    { tip: 'basili', ogeler: [
      { metin: '◀ Döndür', bas: () => (jogDon = mod === 'man' ? -1 : 0), birak: () => { jogDon = 0; hedefAci = aci + w * 2; } },
      { metin: 'Döndür ▶', bas: () => (jogDon = mod === 'man' ? 1 : 0), birak: () => { jogDon = 0; hedefAci = aci + w * 2; } },
    ] },
    { tip: 'baslik', metin: 'Hidrolik yükseklik (basılı tut)' },
    { tip: 'basili', ogeler: [
      { metin: 'Taşıyıcı ▲', bas: () => (jogY = 1), birak: () => (jogY = 0) },
      { metin: 'Taşıyıcı ▼', bas: () => (jogY = -1), birak: () => (jogY = 0) },
    ] },
    { tip: 'anahtar', metin: 'Kaynakçılar çalışıyor', get: () => kaynakcilarAcik, set: (v) => (kaynakcilarAcik = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { durum = 'acil'; } },
      { metin: 'Reset', tik: () => { if (durum === 'acil') durum = 'durdu'; } },
    ] },
  ];

  return {
    id: 'sasi',
    ad: 'Tren Şasesi Pozisyoneri',
    altBaslik: 'Döner ayna · hidrolik kaldırma · kaynak',
    kisa: 'Tren şasesi uçlarından iki kuledeki döner aynalara bağlanır ve kendi ekseni etrafında yavaşça döndürülür; kaynakçılar her konumda dikişleri yatay/düz pozisyonda çeker. Döndürme sırasında fren kilidi kaynağı engeller.',
    proje: 'other-machines',
    ayakIzi: [16, 6.4],
    kamera: { poz: [1.5, 6.6, 12.8], hedef: [0, 1.3, 0] },
    mekanizmalar: [
      'Döner aynalar (2×): şaseyi uçlarından tutar, dişli kutulu motorla 90° adımlarla ya da sürekli döner',
      'Taşıyıcılar: kuledeki dikey kızakta, alttaki hidrolik silindirlerle 1600–2400 mm arasında kalkar/iner',
      'Şase (~12 m): yan kirişler, orta kiriş, traversler, yastık ve başlık kirişleri — aynalarla birlikte döner',
      'Kaynakçılar (3): şase durup kilitlenince en yakın ulaşılabilir dikişe yürür, kaynak yapar (kıvılcım, ark); döndürmede süpürme alanından çekilir',
      'Dikişler: her travers × yan kiriş için üst, alt ve dış yan dikiş — alttakiler ancak şase döndürülünce yapılabilir',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: şasenin uçları kulelere bağlanır, şase kendi ekseni etrafında yavaşça döndürülür, operatörler etrafta kaynak yapar.',
      'other-machines-img-01: iki gri kule (biri "P5"), kızaklı taşıyıcıda dişli kutusu + yuvarlak flanş, altta silindirler, mavi hidrolik ünite (tank, motor, valf, yağ göstergesi), tepe lambalı beyaz pano → modeldeki parçalar.',
      'TAHMİN: şase ~12 × 2.9 m ve kabataslak profil düzeni; 90° adımlı otomatik çevrim; dönüş hızı (varsayılan 1.5 dev/dk, gösterim için hızlı); eksen yüksekliği aralığı.',
      'TAHMİN: kaynakçılar tavan kaynağı yapmaz ve 2.45 m üstüne uzanmaz — alt yüz dikişleri bu yüzden ancak 90°/180°\'de yapılır; döndürme sırasında fren kilidi.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => [
      ['Şase açısı', `${fmt(aciDerece(), 1)}°`],
      ['Dönüş hızı', `${fmt((w * 60) / (2 * Math.PI), 2)} dev/dk`],
      ['Taşıyıcı yüksekliği', `${fmt(eksenY * 1000, 0)} mm`],
      ['Hidrolik basınç', `${fmt(basinc, 0)} bar`],
      ['Dikiş', `${yapilanSay()} / ${DIKIS.length}`],
      ['Kaynak yapan', `${KC.filter((k) => k.ark).length} / 3`],
      ['Fren kilidi', kaynakVar() || durum !== 'calisiyor' ? 'KİLİTLİ' : 'AÇIK'],
      ['Şase no', `#${sasiNo}`],
    ],
    trend,
    durum: durumBilgi,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (şase + dikişler döner,
    // taşıyıcı/ayna kalkar-döner, silindir milleri ölçeklenir, torçlar kaynakçıyla gezer)
    sabitHaric: [sase, ...K.flatMap((k) => [k.tasiyici, ...k.rodlar]), ...KC.map((k) => k.torc)],
  };
}
