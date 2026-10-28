// js/machines/konteyner.js — Güneş Enerjili Konteyner (mobil enerji ünitesi, B holü).
//
// Kaan'ın tarifi (2026-10-23) + container-img-01/02, container-video-01:
//  - Konteynerin TEK uzun yanı (+Z) açık. İçeride 16 yaprak dik paket halinde
//    durur; her yaprak yan yana 4 dikey panel. Yapraklar akordeon gibi alt/üst
//    menteşelerle bağlı: açılırken ÜÇGENLER yapa yapa açılır, kapanırken katlanır.
//  - Altta dönen HİDROMOTOR, zemin raylarındaki zincirle yaprakların ALT uçlarını
//    (sarı tekerlekli menteşe arabaları) çekerek açar / çekerek kapatır.
//    Fotoğrafta dıştaki yapraklar yatmış, içtekiler dik üçgen → açılma dıştan içe.
//  - Tam açık: ~22° eğim, basık üçgenler, dizi ~30 m.
//  - Uçlardaki siyah ters-U çerçevelerin köşelerinde 4 hidrolik ayak (konteyner
//    genişliğinin dışında → dorse aralarından geçer).
//  - Nakliye: paneller kapanır → konteyner ayaklarla yükselir → kamyon geri geri
//    altına girer → konteyner dorseye oturur, ayaklar toplanır → kamyon gider.
//    Kurulum tersi: kamyon gelir → ayaklar yere basar, konteyner kalkar → kamyon
//    çıkar → konteyner yere alçalır → paneller açılır.
//
// Yerleşim: B holü (fabrikada ry = π/2); yerel X = konteyner uzun ekseni ve kamyon yolu
// (+X'ten gelir → holün arka duvarındaki RAMPA 1 kapısı), +Z = açık yan ve panel dizisi.

export function create(lib) {
  const {
    THREE, M, box, cyl, sphere, mat, lamba, Ekran, Trend, kuleLambasi, canvasTex,
    clamp, approach, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();
  const L = 6.06, W = 2.44, H = 2.59;          // 20 ft ISO konteyner
  const ZEMIN = 0.05;                          // gövde altı, yerdeyken
  const DECK = 1.32;                           // dorse yatak (twistlock) yüksekliği
  const KALK = 1.58;                           // dorsenin altından geçebileceği kaldırma
  const UZAK = 34;                             // kamyonun kapı dışındaki rampada beklediği yerel x (tamamen dışarıda)
  const FX = L / 2 + 0.2, FZ = W / 2 + 0.25;   // uç çerçeve dikmeleri (genişliğin dışında)

  // panel dizisi (akordeon)
  const P = 8, LY = 2.15, D_MIN = 0.12, TETA = (22 * Math.PI) / 180;
  const D_MAX = 2 * LY * Math.cos(TETA);
  const S_MIN = P * D_MIN, S_MAX = P * D_MAX;
  const B0 = -0.1;                             // en içteki alt menteşe (konteyner tabanında sabit)
  const RYR = 0.17;                            // taban / ray üstü (gövde yerel)
  const RAY_X = [-1.95, 1.95];
  const PANEL_X = [-1.695, -0.565, 0.565, 1.695];
  const RAY_SON = B0 + S_MAX + 0.5;            // saha raylarının dış ucu

  // ---------------------------------------------------------------- dokular / malzemeler
  const olukCiz = (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#24762b'); gr.addColorStop(0.18, '#34a13a'); gr.addColorStop(0.42, '#4cbd4c');
    gr.addColorStop(0.6, '#34a13a'); gr.addColorStop(0.86, '#24762b'); gr.addColorStop(1, '#24762b');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  };
  const olukMat = (uzunluk) => new THREE.MeshStandardMaterial({
    map: canvasTex(64, 4, olukCiz, { tekrar: [uzunluk / 0.28, 1] }), roughness: 0.5, metalness: 0.3,
  });
  const yesil = mat(0x3aa83d, { r: 0.5, m: 0.3, key: 'kont-yesil' });
  const ahsapZemin = mat(0x6b4a2b, { r: 0.9, m: 0, key: 'kont-zemin' });
  const panelTex = canvasTex(256, 512, (x, w, h) => {
    x.fillStyle = '#c3c9ce'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e8edf2'; x.fillRect(8, 8, w - 16, h - 16);
    const cs = 6, rs = 12, cw = (w - 20) / cs, ch = (h - 20) / rs;
    for (let i = 0; i < cs; i++) for (let j = 0; j < rs; j++) {
      const gx = 10 + i * cw, gy = 10 + j * ch;
      const gr = x.createLinearGradient(gx, gy, gx + cw, gy + ch);
      gr.addColorStop(0, '#1d3d74'); gr.addColorStop(1, '#122a52');
      x.fillStyle = gr; x.fillRect(gx + 1.5, gy + 1.5, cw - 3, ch - 3);
      x.fillStyle = 'rgba(200,210,225,.35)';
      for (let k = 1; k <= 2; k++) x.fillRect(gx + (cw * k) / 3, gy + 2, 1, ch - 4);
    }
  });
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.22, metalness: 0.35 });
  const arkaMat = mat(0xeef0f2, { r: 0.6, m: 0.1, key: 'panel-arka' });   // panel arkası beyaz (img-01)
  const dolapTex = canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = '#b9bec3'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#7d848b'; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      x.strokeRect(i * (w / 6) + 4, 6, w / 6 - 8, h - 12);
      x.fillStyle = '#2ea043'; x.fillRect(i * (w / 6) + 14, 16, 8, 6);
      x.fillStyle = '#20252a'; x.fillRect(i * (w / 6) + 30, 14, 26, 10);
    }
  });
  // ray içindeki zincir: bakla deseni, hidromotor çektikçe kayar
  const zincirTex = canvasTex(16, 32, (x, w, h) => {
    x.fillStyle = '#1a1b1d'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#6d7277'; x.fillRect(3, 2, w - 6, 12); x.fillRect(3, 18, w - 6, 12);
    x.fillStyle = '#2c2e31'; x.fillRect(6, 5, w - 12, 6); x.fillRect(6, 21, w - 12, 6);
  }, { tekrar: [1, 1] });
  const zincirMat = new THREE.MeshStandardMaterial({ map: zincirTex, roughness: 0.5, metalness: 0.6 });

  // ---------------------------------------------------------------- saha: beton yatak + raylar (sabit)
  box(7.0, 0.012, 3.3, mat(0x9a9d9f, { r: 0.9, m: 0, key: 'beton-yatak' }), 0, 0.006, 0, g);
  const SR0 = W / 2 + 0.08, SRL = RAY_SON - SR0;
  const zincirSerit = (x, z0, len, parent, y) => {
    const geom = new THREE.PlaneGeometry(0.05, len);
    const uv = geom.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setY(j, (uv.getY(j) * len) / 0.064);
    const m = new THREE.Mesh(geom, zincirMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z0 + len / 2);
    parent.add(m);
    return m;
  };
  for (const x of RAY_X) {
    box(0.14, 0.12, SRL, M.siyah, x, ZEMIN + RYR - 0.06, SR0 + SRL / 2, g);
    zincirSerit(x, SR0, SRL, g, ZEMIN + RYR + 0.002);
    box(0.2, 0.18, 0.24, M.koyu, x, 0.12, RAY_SON + 0.05, g);                         // dönüş dişlisi yatağı
    cyl(0.07, 0.06, M.celik, x, ZEMIN + RYR - 0.02, RAY_SON + 0.05, g, { eksen: 'x', seg: 16 });
  }
  // ayarlı ayaklar + bağlantı traversleri (instanced)
  const nAyak = Math.floor(SRL / 2.4) + 1;
  const ayakIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), M.koyu, nAyak * 2);
  const ayakMilIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, ZEMIN + RYR - 0.12, 10), M.celik, nAyak * 2);
  const travIM = new THREE.InstancedMesh(new THREE.BoxGeometry(RAY_X[1] - RAY_X[0], 0.05, 0.08), M.koyu, Math.ceil(nAyak / 2));
  const _m = new THREE.Matrix4();
  for (let i = 0; i < nAyak; i++) {
    const z = SR0 + 0.3 + i * 2.4;
    RAY_X.forEach((x, j) => {
      ayakIM.setMatrixAt(i * 2 + j, _m.makeTranslation(x, 0.025, z));
      ayakMilIM.setMatrixAt(i * 2 + j, _m.makeTranslation(x, (ZEMIN + RYR - 0.12) / 2 + 0.03, z));
    });
    if (i % 2 === 0) travIM.setMatrixAt(i / 2, _m.makeTranslation(0, ZEMIN + RYR - 0.1, z));
  }
  for (const im of [ayakIM, ayakMilIM, travIM]) { im.castShadow = true; im.receiveShadow = true; g.add(im); }

  // ---------------------------------------------------------------- gövde (ayaklar / dorse ile hareket eder)
  const govde = new THREE.Group();
  govde.position.y = ZEMIN;
  g.add(govde);
  const KX = L / 2 - 0.07, KZ = W / 2 - 0.07;
  for (const sz of [-1, 1]) box(L, 0.16, 0.1, M.siyah, 0, 0.08, sz * (W / 2 - 0.05), govde);
  for (const sx of [-1, 1]) box(0.1, 0.16, W, M.siyah, sx * (L / 2 - 0.05), 0.08, 0, govde);
  box(L - 0.1, 0.03, W - 0.1, ahsapZemin, 0, RYR - 0.015, 0, govde);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.14, H, 0.14, M.siyah, sx * KX, H / 2, sz * KZ, govde);
    for (const y of [0.06, H - 0.06]) box(0.18, 0.12, 0.17, M.koyu, sx * (L / 2 - 0.08), y, sz * (W / 2 - 0.08), govde);
  }
  for (const sz of [-1, 1]) box(L, 0.1, 0.08, M.siyah, 0, H - 0.05, sz * (W / 2 - 0.04), govde);
  for (const sx of [-1, 1]) box(0.08, 0.1, W, M.siyah, sx * (L / 2 - 0.04), H - 0.05, 0, govde);
  box(L - 0.1, 0.04, W - 0.1, yesil, 0, H - 0.04, 0, govde);
  // arka uzun yan (−Z): oluklu duvar + yazı (açık yan +Z'de duvar YOK)
  box(L - 0.26, H - 0.26, 0.04, olukMat(L), 0, H / 2, -(W / 2 - 0.05), govde);
  const yazi = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.62), new THREE.MeshBasicMaterial({
    map: canvasTex(1024, 188, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = '#ffffff'; x.font = '700 120px "Space Grotesk", sans-serif'; x.textBaseline = 'middle';
      x.fillText('SOLAR', 20, h / 2);
      x.font = '500 46px "Space Grotesk", sans-serif'; x.fillText('MOBİL ENERJİ', 560, h / 2);
    }), transparent: true, toneMapped: false,
  }));
  yazi.position.set(0.4, 1.35, -W / 2 - 0.035);
  yazi.rotation.y = Math.PI;
  govde.add(yazi);
  // −X ucu: oluklu duvar + şerit; +X ucu: çift kanat kapı
  box(0.04, H - 0.26, W - 0.26, olukMat(W), -(L / 2 - 0.05), H / 2, 0, govde);
  const serit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.9), new THREE.MeshStandardMaterial({
    map: canvasTex(84, 380, (x, w, h) => {
      x.fillStyle = '#f2f4f2'; x.fillRect(0, 0, w, h);
      x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2);
      x.fillStyle = '#2b8a33'; x.font = '700 40px "Space Grotesk", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('SOLAR · 120 kWh', 0, 0); x.restore();
    }), roughness: 0.6,
  }));
  serit.position.set(-(L / 2 + 0.0), 1.35, 0.6);
  serit.rotation.y = -Math.PI / 2;
  govde.add(serit);
  for (const sz of [-1, 1]) {
    box(0.04, H - 0.26, (W - 0.26) / 2 - 0.01, olukMat(W / 2), L / 2 - 0.05, H / 2, (sz * (W - 0.26)) / 4, govde);
    for (const k of [0.3, 0.75]) cyl(0.018, H - 0.4, M.celik, L / 2 - 0.01, H / 2, sz * k, govde, { seg: 8 });
  }
  // iç: arka duvar boyunca batarya dolapları, uçta invertör + hidrolik güç ünitesi
  box(4.2, 1.9, 0.75, M.gri, -0.5, RYR + 0.95, -0.74, govde);
  const dolapYuz = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), new THREE.MeshStandardMaterial({ map: dolapTex, roughness: 0.5, metalness: 0.3 }));
  dolapYuz.position.set(-0.5, RYR + 0.95, -0.36);
  govde.add(dolapYuz);
  box(0.55, 1.6, 0.6, M.beyaz, 2.45, RYR + 0.8, -0.78, govde);                       // invertör
  const invLed = lamba(0x2ea043, 1.5);
  box(0.06, 0.03, 0.01, invLed, 2.45, 1.5, -0.475, govde);
  box(0.5, 0.6, 0.5, mat(0x2f5aa8, { r: 0.5, m: 0.3, key: 'hgu' }), 2.68, RYR + 0.3, 0.3, govde);   // hidrolik güç ünitesi
  cyl(0.1, 0.25, M.gri, 2.68, RYR + 0.72, 0.3, govde, { seg: 14 });

  // iç raylar (tabanda) + zincir
  for (const x of RAY_X) {
    box(0.14, 0.03, W / 2 - B0 + 0.1, M.siyah, x, RYR - 0.005, (B0 - 0.1 + W / 2) / 2, govde);
    zincirSerit(x, B0 - 0.1, W / 2 - B0 + 0.1, govde, RYR + 0.012);
  }
  // hidromotor + tahrik mili + zincir dişlileri (açık yanın alt kenarında)
  const ZM = W / 2 - 0.1, YM = 0.09;
  cyl(0.03, 4.3, M.celik, 0, YM, ZM, govde, { eksen: 'x', seg: 12 });
  const disliler = RAY_X.map((x) => {
    const d = new THREE.Group();
    d.position.set(x, YM, ZM);
    govde.add(d);
    cyl(0.085, 0.035, M.koyu, 0, 0, 0, d, { eksen: 'x', seg: 18 });
    box(0.04, 0.16, 0.02, M.celik, 0, 0, 0, d);
    box(0.04, 0.02, 0.16, M.celik, 0, 0, 0, d);
    return d;
  });
  const hmGrup = new THREE.Group();
  hmGrup.position.set(2.42, YM, ZM);
  govde.add(hmGrup);
  cyl(0.1, 0.24, M.kirmizi, 0, 0, 0, hmGrup, { eksen: 'x', seg: 20 });                // hidromotor gövdesi
  cyl(0.12, 0.03, M.koyu, -0.13, 0, 0, hmGrup, { eksen: 'x', seg: 20 });
  const hmRotor = new THREE.Group(); hmGrup.add(hmRotor);
  box(0.03, 0.17, 0.03, M.sari, 0.13, 0, 0, hmRotor);                                 // dönüş işareti
  lib.rod([2.5, YM + 0.08, ZM - 0.02], [2.6, RYR + 0.2, 0.5], 0.016, M.siyah, govde);  // basınç / dönüş hortumları
  lib.rod([2.36, YM + 0.08, ZM - 0.02], [2.5, RYR + 0.2, 0.42], 0.016, M.siyah, govde);

  // uç çerçeveler (ters-U) + 4 hidrolik ayak
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(0.24, H, 0.24, M.siyah, sx * FX, H / 2, sz * FZ, govde);
      for (const y of [0.35, H - 0.35]) {
        box(FX - L / 2 + 0.1, 0.2, 0.2, M.koyu, sx * (L / 2 + (FX - L / 2) / 2), y, sz * (W / 2 - 0.1), govde);
        box(0.2, 0.2, FZ - W / 2 + 0.2, M.koyu, sx * FX, y, sz * (W / 2 + (FZ - W / 2) / 2 - 0.05), govde);
      }
      cyl(0.11, 0.5, M.koyu, sx * FX, 0.25, sz * FZ, govde, { seg: 16 });             // silindir alt başlığı
    }
    box(0.24, 0.24, 2 * FZ + 0.24, M.siyah, sx * FX, H + 0.12, 0, govde);
  }
  const ayaklar = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const mil = cyl(0.065, 1, M.krom, sx * FX, 0, sz * FZ, govde, { seg: 16 });
    const ped = box(0.38, 0.05, 0.38, M.koyu, sx * FX, 0, sz * FZ, govde);
    ayaklar.push({ mil, ped });
  }

  // ---------------------------------------------------------------- yapraklar (instanced)
  const yaprakIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.11, LY - 0.03, 0.035),
    [M.alu, M.alu, M.alu, M.alu, panelMat, arkaMat], P * 2 * 4);
  const ustMenteseIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 4.5, 10).rotateZ(Math.PI / 2), M.alu, P);
  const altMenteseIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 4.0, 10).rotateZ(Math.PI / 2), M.koyu, P + 1);
  const arabaIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), M.siyah, (P + 1) * 2);
  const tekerIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14).rotateZ(Math.PI / 2), M.sari, (P + 1) * 2);
  for (const im of [yaprakIM, ustMenteseIM, altMenteseIM, arabaIM, tekerIM]) {
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    govde.add(im);
  }
  const dTaban = new Float32Array(P), bZ = new Float32Array(P + 1), tZ = new Float32Array(P), tH = new Float32Array(P);
  const _X = new THREE.Vector3(), _Yv = new THREE.Vector3(), _Zv = new THREE.Vector3();

  function yaprakGeometri(s) {
    // toplam çekilen mesafeyi DIŞTAN içe dağıt: önce en dıştaki üçgen yatar
    let fazla = s - S_MIN;
    for (let k = P - 1; k >= 0; k--) {
      const a = clamp(fazla, 0, D_MAX - D_MIN);
      dTaban[k] = D_MIN + a;
      fazla -= a;
    }
    let b = B0;
    for (let k = 0; k < P; k++) {
      bZ[k] = b;
      tZ[k] = b + dTaban[k] / 2;
      tH[k] = Math.sqrt(Math.max(0, LY * LY - (dTaban[k] / 2) ** 2));
      b += dTaban[k];
    }
    bZ[P] = b;
  }

  function yaprakCiz() {
    let n = 0;
    for (let k = 0; k < P; k++) {
      // yaprak 2k: bZ[k] → tepe; yaprak 2k+1: bZ[k+1] → tepe. Panel yüzü hep yukarı baksın.
      for (let j = 0; j < 2; j++) {
        const zAlt = j ? bZ[k + 1] : bZ[k];
        const dz = tZ[k] - zAlt, dy = tH[k], len = Math.hypot(dz, dy) || 1;
        _Yv.set(0, dy / len, dz / len);
        _X.set(j ? 1 : -1, 0, 0);
        _Zv.crossVectors(_X, _Yv);
        for (const px of PANEL_X) {
          _m.makeBasis(_X, _Yv, _Zv);
          _m.setPosition(px, RYR + dy / 2, (zAlt + tZ[k]) / 2);
          yaprakIM.setMatrixAt(n++, _m);
        }
      }
      ustMenteseIM.setMatrixAt(k, _m.makeTranslation(0, RYR + tH[k], tZ[k]));
    }
    for (let k = 0; k <= P; k++) {
      altMenteseIM.setMatrixAt(k, _m.makeTranslation(0, RYR + 0.06, bZ[k]));
      RAY_X.forEach((x, j) => {
        arabaIM.setMatrixAt(k * 2 + j, _m.makeTranslation(x, RYR + 0.05, bZ[k]));
        tekerIM.setMatrixAt(k * 2 + j, _m.makeTranslation(x + (j ? -0.1 : 0.1), RYR + 0.055, bZ[k]));
      });
    }
    for (const im of [yaprakIM, ustMenteseIM, altMenteseIM, arabaIM, tekerIM]) im.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- aydınlatma direği (−X ucu, çerçevenin dışında)
  const direk = new THREE.Group();
  direk.position.set(-(FX + 0.38), 0, 0);
  govde.add(direk);
  box(0.3, 0.2, 0.2, M.koyu, 0.2, 0.55, 0, direk);
  box(0.3, 0.2, 0.2, M.koyu, 0.2, 2.2, 0, direk);
  cyl(0.075, 2.3, M.gri, 0, 1.45, 0, direk, { seg: 16 });
  const kat2 = cyl(0.06, 2.2, M.alu, 0, 1.5, 0, direk, { seg: 16 });
  const kat3 = cyl(0.045, 2.2, M.alu, 0, 1.55, 0, direk, { seg: 16 });
  const kafa = new THREE.Group(); direk.add(kafa);
  box(0.06, 0.06, 0.4, M.koyu, 0, 0, 0, kafa);
  const projMat = lamba(0xfff4dc, 0);
  const proj = new THREE.Group(); proj.position.set(0.05, 0.05, 0); proj.rotation.y = -Math.PI / 2; proj.rotation.x = -0.6; kafa.add(proj);
  box(0.56, 0.36, 0.16, M.koyu, 0, 0, 0, proj);
  box(0.5, 0.3, 0.01, projMat, 0, 0, 0.085, proj);
  const spot = new THREE.SpotLight(0xfff1d6, 0, 40, 0.8, 0.5, 1.6);
  spot.castShadow = false;
  proj.add(spot);
  const spotHedef = new THREE.Object3D();
  g.add(spotHedef);
  spotHedef.position.set(0, 0, 10);
  spot.target = spotHedef;

  // tavan: anemometre + kule lambası
  const ane = new THREE.Group();
  ane.position.set(L / 2 - 0.4, H, -W / 2 + 0.35);
  govde.add(ane);
  cyl(0.015, 0.7, M.gri, 0, 0.35, 0, ane, { seg: 8 });
  const rotor = new THREE.Group(); rotor.position.y = 0.72; ane.add(rotor);
  for (let i = 0; i < 3; i++) {
    const kol = new THREE.Group(); kol.rotation.y = (i * 2 * Math.PI) / 3; rotor.add(kol);
    box(0.16, 0.01, 0.01, M.gri, 0.08, 0, 0, kol);
    sphere(0.035, M.beyaz, 0.17, 0, 0, kol, 10);
  }
  const kule = kuleLambasi(govde, L / 2 - 0.3, H, -W / 2 + 0.7);

  // kiosk: tablet (Flutter uygulaması) — saha tarafında, kamyon yolunun dışında
  const kiosk = new THREE.Group();
  kiosk.position.set(L / 2 + 1.6, 0, 2.7);
  kiosk.rotation.y = -0.5;
  g.add(kiosk);
  box(0.3, 0.03, 0.3, M.koyu, 0, 0.015, 0, kiosk);
  cyl(0.03, 1.1, M.gri, 0, 0.56, 0, kiosk, { seg: 10 });
  const tablet = new THREE.Group(); tablet.position.set(0, 1.18, 0.02); tablet.rotation.x = -0.45; kiosk.add(tablet);
  box(0.4, 0.27, 0.025, M.siyah, 0, 0, 0, tablet);
  const ekran = new Ekran(0.37, 0.24, 512);
  ekran.mesh.position.z = 0.014;
  tablet.add(ekran.mesh);

  // ---------------------------------------------------------------- saha operatörü (lib.operator)
  // Tablet kioskunda uygulamayı kullanır; kamyon gelip giderken yol kenarında kamyona
  // kollarıyla yol gösterir; paneller açılırken dizinin yanına yürüyüp izler.
  const op = lib.operator({ yelek: 0xff7a1a, baret: 0xffffff });
  g.add(op.group);
  const KIOSK_YON = -0.5;
  const OP_KIOSK = [L / 2 + 1.6 + Math.sin(KIOSK_YON) * 0.68, 2.7 + Math.cos(KIOSK_YON) * 0.68];
  const OP_YOL = [L / 2 + 3.0, 3.0];         // kamyon şeridinin kenarı (dorse/kabin z ±1.25, ~1.7 m pay)
  const OP_DIZI = [3.3, 6.2];                // panel dizisinin yanı (dizi x ±2.3)
  const O = { x: OP_KIOSK[0], z: OP_KIOSK[1], yon: KIOSK_YON + Math.PI, hedefYon: KIOSK_YON + Math.PI, gorev: 'kiosk', yol: [], t: 0 };

  // ---------------------------------------------------------------- kamyon (çekici + iskelet konteyner dorsesi)
  const tir = new THREE.Group();
  tir.userData.gezGecer = true;   // yer değiştirir: ziyaretçi yürüme haritasında engel sayılmaz (js/gezgin.js)
  g.add(tir);
  const tekerlekler = [];
  function aks(x, r, ikiz, parent) {
    const a = new THREE.Group();
    a.position.set(x, r, 0);
    parent.add(a);
    cyl(0.05, 2.0, M.koyu, 0, 0, 0, a, { eksen: 'z', seg: 8 });
    const zs = ikiz ? [-1.0, -0.72, 0.72, 1.0] : [-0.98, 0.98];
    for (const z of zs) {
      cyl(r, 0.26, M.kaucuk, 0, 0, z, a, { eksen: 'z', seg: 22 });
      cyl(r * 0.55, 0.27, M.gri, 0, 0, z, a, { eksen: 'z', seg: 14 });
      box(r * 1.0, 0.07, 0.28, M.koyu, 0, 0, z, a);                                   // jant işareti (dönüş görünsün)
    }
    tekerlekler.push({ a, r });
    return a;
  }
  // dorse: x −3.6 … +4.6, yatak üstü DECK
  for (const sz of [-1, 1]) box(8.2, 0.32, 0.14, M.koyu, 0.5, 1.04, sz * 0.48, tir);
  for (const x of [-3.3, -1.9, -0.5, 0.9, 2.3, 3.7]) box(0.12, 0.14, 2.3, M.koyu, x, 1.13, 0, tir);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.22, 0.12, 0.22, M.sari, sx * 2.95, DECK - 0.06, sz * 1.05, tir);
  aks(-2.75, 0.5, true, tir); aks(-1.5, 0.5, true, tir);
  for (const sz of [-1, 1]) box(0.08, 0.75, 0.08, M.gri, 3.0, 0.55, sz * 0.48, tir);   // dorse ayakları
  box(0.1, 0.25, 2.4, M.koyu, -3.65, 0.7, 0, tir);                                    // arka tampon
  for (const sz of [-1, 1]) box(0.04, 0.1, 0.25, lamba(0xe5302a, 1.2), -3.71, 0.72, sz * 0.95, tir);
  // çekici: x +3.6 … +9.9
  box(6.2, 0.3, 0.95, M.koyu, 6.7, 0.82, 0, tir);
  cyl(0.45, 0.08, M.siyah, 4.45, 1.0, 0, tir, { seg: 22 });                             // beşinci teker
  const kabinMat = mat(0xf2f2f0, { r: 0.4, m: 0.2, key: 'kabin' });
  box(2.2, 2.45, 2.45, kabinMat, 8.65, 2.18, 0, tir);
  box(2.1, 0.5, 2.3, kabinMat, 8.7, 3.6, 0, tir);                                       // tavan spoyleri
  box(0.3, 0.55, 2.45, M.kirmizi, 9.8, 1.05, 0, tir);                                   // tampon
  box(0.05, 0.95, 2.15, mat(0x1f2a33, { r: 0.1, m: 0.6, key: 'kabin-cam' }), 9.77, 2.75, 0, tir);
  for (const sz of [-1, 1]) {
    box(0.9, 0.7, 0.04, mat(0x1f2a33, { r: 0.1, m: 0.6, key: 'kabin-cam' }), 9.1, 2.8, sz * 1.235, tir);
    cyl(0.28, 1.1, M.alu, 6.4, 0.75, sz * 0.9, tir, { eksen: 'x', seg: 16 });         // yakıt deposu
    cyl(0.07, 1.7, M.krom, 7.45, 3.0, sz * 1.05, tir, { seg: 10 });                     // egzoz
    box(0.04, 0.15, 0.2, lamba(0xfff4dc, 0.8), 9.96, 1.05, sz * 0.9, tir);             // far
  }
  box(0.6, 0.6, 0.06, M.kirmizi, 8.65, 2.0, 1.23, tir);                                 // kapı logosu (düz kırmızı)
  box(0.6, 0.6, 0.06, M.kirmizi, 8.65, 2.0, -1.23, tir);
  aks(4.9, 0.5, true, tir); aks(6.2, 0.5, true, tir); aks(9.05, 0.5, false, tir);

  // ---------------------------------------------------------------- durum
  let e = 0, eHedef = 0, eJog = 0;            // ayak uzaması (m, gövde altından aşağı)
  let s = S_MIN, sHedef = S_MIN, sHiz = 0;    // zincirle çekilen toplam mesafe
  let tirX = UZAK, tirHedef = UZAK, tirV = 0, tirGorunur = true;
  let tirda = true;                           // konteyner dorsede mi
  let hizMod = 'orta';
  const HIZ = { yavas: 0.6, orta: 1.0, hizli: 1.7 };
  let acil = false;
  let sira = [], siraAd = '', siraTur = '';
  let baslangicT = 1.0;
  let demoDongu = true, demoBekle = 0;
  let direkAcik = false, direkE = 0;
  let ruzgar = 12, ruzgarLimit = 40, saat = 13, zamanAkisi = false;
  let otoRuzgar = true, otoGunBatimi = true, dolu = false;
  let otoNeden = null;
  let enerji = 86.4, mesaj = '', mesajT = 0;
  const KAP = 120;
  let hmDevir = 0, hmAci = 0;

  const kisaMesaj = (m) => { mesaj = m; mesajT = 2.8; };
  const yk = () => (tirda ? DECK : Math.max(ZEMIN, e));
  const sahada = () => !tirda && yk() <= ZEMIN + 0.001;
  const panelKapali = () => s <= S_MIN + 0.005;
  const acikOran = () => clamp((s - S_MIN) / (S_MAX - S_MIN), 0, 1);
  const acikUcgen = () => { let n = 0; for (let k = 0; k < P; k++) if (dTaban[k] > D_MIN + 0.3) n++; return n; };
  const egimDer = (k) => (Math.acos(clamp(dTaban[k] / 2 / LY, 0, 1)) * 180) / Math.PI;
  const gunes = () => Math.max(0, Math.sin((Math.PI * (saat - 6)) / 14));
  const tirHareket = () => Math.abs(tirV) > 0.02 || Math.abs(tirX - tirHedef) > 0.01;
  const hidrolikCalisiyor = () => !acil && (Math.abs(e - eHedef) > 1e-4 || eJog !== 0 || Math.abs(sHedef - s) > 1e-4);
  const hidrolikBasinc = () => (hidrolikCalisiyor() ? (Math.abs(sHedef - s) > 1e-4 ? 150 : 175) + gurultu(4) : 0);
  const uretim = () => 35.2 * acikOran() * gunes() * 0.86;
  const tuketim = () => 1.2 + (direkAcik && direkE > 0.95 ? 0.4 : 0) + (hidrolikCalisiyor() ? 3.0 : 0);

  // ---------------------------------------------------------------- sıralar
  const adim = (ad, basla, bitti) => ({ ad, basla, bitti });
  const eVar = () => Math.abs(e - eHedef) < 1e-4;
  const sVar = () => Math.abs(s - sHedef) < 1e-4;
  const tirVar = () => Math.abs(tirX - tirHedef) < 0.01 && Math.abs(tirV) < 0.05;
  function siraBaslat(tur, adimlar) { sira = adimlar; siraTur = tur; siraAd = ''; eJog = 0; }

  function kurulum() {
    if (!tirda) {
      if (!sahada()) return kisaMesaj('Konteyner yerde değil');
      if (otoNeden) return kisaMesaj('Acil senaryo sürüyor');
      siraBaslat('kurulum', [adim('Paneller açılıyor', () => (sHedef = S_MAX), sVar)]);
      return;
    }
    siraBaslat('kurulum', [
      adim('Kamyon konteynerle geliyor', () => { tirGorunur = true; if (tirX >= UZAK - 0.01) tirX = UZAK; tirHedef = 0; }, tirVar),
      adim('Ayaklar yere iniyor', () => (eHedef = DECK), eVar),
      adim('Konteyner dorseden kalkıyor', () => (eHedef = KALK), eVar),
      adim('Kamyon çıkıyor', () => (tirHedef = UZAK), tirVar),
      adim('Konteyner yere alçalıyor', () => { tirGorunur = false; eHedef = ZEMIN; }, eVar),
      adim('Paneller açılıyor', () => (sHedef = otoNeden ? S_MIN : S_MAX), sVar),
    ]);
  }
  function nakliye() {
    if (tirda) return kisaMesaj('Konteyner zaten dorsede');
    siraBaslat('nakliye', [
      adim('Paneller kapanıyor', () => (sHedef = S_MIN), sVar),
      adim('Konteyner ayaklarla yükseliyor', () => (eHedef = KALK), eVar),
      adim('Kamyon geri geri yanaşıyor', () => { tirGorunur = true; tirX = UZAK; tirHedef = 0; }, tirVar),
      adim('Konteyner dorseye oturuyor', () => (eHedef = DECK), eVar),
      adim('Ayaklar toplanıyor', () => (eHedef = 0), eVar),
      adim('Kamyon yola çıkıyor', () => (tirHedef = UZAK), tirVar),
    ]);
  }
  const panelAc = () => {
    if (!sahada()) return kisaMesaj('Paneller yalnız konteyner yerdeyken açılır');
    if (otoNeden) return kisaMesaj('Acil senaryo sürüyor');
    sira = []; sHedef = S_MAX;
  };
  const panelKapat = () => { sira = []; sHedef = S_MIN; };
  const hidroDur = () => { sira = []; sHedef = s; eHedef = e; };

  // ---------------------------------------------------------------- operatör
  // gorev: kiosk | yol (kamyona yol gösterir) | dizi (açılan paneli izler); varış noktası hedefe göre
  function opGuncelle(dt, t) {
    const kamyonIsi = !acil && ((siraTur === 'kurulum' || siraTur === 'nakliye') && siraAd && !/panel/i.test(siraAd) || tirHareket() && tir.visible);
    const diziAciliyor = !acil && sahada() && sHedef > s + 0.01;
    const gorev = kamyonIsi ? 'yol' : diziAciliyor ? 'dizi' : 'kiosk';
    const [hx, hz] = gorev === 'yol' ? OP_YOL : gorev === 'dizi' ? OP_DIZI : OP_KIOSK;
    O.gorev = gorev;
    const dx = hx - O.x, dz = hz - O.z, d = Math.hypot(dx, dz), a = 1.3 * dt;
    let yuruyor = false;
    if (d <= a) { O.x = hx; O.z = hz; }
    else { O.x += (dx / d) * a; O.z += (dz / d) * a; O.hedefYon = Math.atan2(dx, dz); yuruyor = true; }
    let poz = 'yan';
    if (!yuruyor) {
      if (gorev === 'kiosk') { O.hedefYon = KIOSK_YON + Math.PI; poz = 'on'; }        // tableti kullanır
      else if (gorev === 'dizi') { O.hedefYon = 0; }                                  // dizi boyunca (+Z) izler
      else {
        const tirGelen = tir.visible && tirHareket();
        O.hedefYon = Math.atan2((tirGelen ? tirX + 1.5 : 0) - O.x, -O.z);           // kamyona / konteynere dönük
        // kamyon hareketliyken kollarla "gel/geri" işareti (sallama), dururken "dur" (kollar yukarı)
        poz = tirGelen ? (Math.sin(t * 5) > 0 ? 'yukari' : 'on') : Math.abs(tirX) < 0.05 && tir.visible ? 'yukari' : 'yan';
      }
    }
    op.poz(poz);
    let f = O.hedefYon - O.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    O.yon += f * (1 - Math.exp(-8 * dt));
    const zip = op.yuru(t, yuruyor);
    op.group.position.set(O.x, zip, O.z);
    op.group.rotation.y = O.yon;
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'Üretim kW', renk: '#3fb950' }, { ad: 'Açılma %', renk: '#39c5cf' }], { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(5);

  function update(dt, t) {
    const k = HIZ[hizMod];
    if (zamanAkisi) saat = (saat + dt / 60) % 24;

    // -- acil senaryolar: yalnız sahadayken; neden oluşunca topla, kalkınca yeniden aç
    const neden = otoRuzgar && ruzgar > ruzgarLimit ? 'ruzgar'
      : dolu ? 'dolu'
      : otoGunBatimi && (saat >= 19.5 || saat < 6.5) ? 'gunbatimi' : null;
    if (!acil && sahada() && (!sira.length || siraTur === 'oto')) {
      if (neden && neden !== otoNeden) { otoNeden = neden; siraBaslat('oto', [adim('Otomatik toplama', () => (sHedef = S_MIN), sVar)]); }
      else if (!neden && otoNeden) {
        if (otoNeden !== 'ruzgar' || ruzgar < ruzgarLimit - 5) {
          otoNeden = null;
          siraBaslat('oto', [adim('Paneller yeniden açılıyor', () => (sHedef = S_MAX), sVar)]);
        }
      }
    }
    if (!neden && otoNeden && !sahada()) otoNeden = null;

    // -- açılış: kurulum senaryosu kendiliğinden oynar
    if (baslangicT > 0) { baslangicT -= dt; if (baslangicT <= 0) kurulum(); }
    // -- demo döngüsü: nakliye bitince yeni sahaya kurulum
    if (demoBekle > 0) { demoBekle -= dt; if (demoBekle <= 0 && !sira.length && tirda) kurulum(); }

    // -- sıra yürütücü
    if (!acil && sira.length) {
      const a = sira[0];
      if (!a.basladi) { a.basladi = true; a.basla(); siraAd = a.ad; }
      else if (a.bitti()) {
        sira.shift();
        if (!sira.length) {
          siraAd = '';
          if (siraTur === 'nakliye') { tirGorunur = false; if (demoDongu) demoBekle = 3; }
          siraTur = '';
        }
      }
    }

    // -- aktüatörler (acilde kilitli)
    let ds = 0;
    if (!acil) {
      if (eJog) eHedef = clamp(e + eJog * 0.3, 0, KALK);
      e = approach(e, eHedef, 0.16 * k * dt);
      const s0 = s;
      s = approach(s, sHedef, 1.2 * k * dt);
      ds = s - s0;
      // kamyon: yamuk hız profili
      const kalan = tirHedef - tirX;
      const vIst = Math.sign(kalan) * Math.min(6, Math.sqrt(2 * 1.6 * Math.abs(kalan)));
      tirV = approach(tirV, vIst, 1.8 * dt);
      tirX += tirV * dt;
      if (Math.abs(kalan) < 0.01 && Math.abs(tirV) < 0.05) { tirX = tirHedef; tirV = 0; }
      direkE = approach(direkE, direkAcik ? 1 : 0, 0.12 * k * dt);
    } else {
      tirV = approach(tirV, 0, 6 * dt);
      tirX += tirV * dt;
    }
    sHiz = dt > 0 ? ds / dt : 0;

    // -- taşıma: ayaklar DECK üstüne çıkınca dorseden kalkar; kamyon alttayken DECK'e inince dorseye oturur
    const tirAltta = tirGorunur && Math.abs(tirX) < 0.02;
    if (tirda) { if (e > DECK + 1e-4) tirda = false; }
    else if (tirAltta && e <= DECK + 1e-4 && yk() >= DECK - 0.02) tirda = true;

    // -- gövde + ayaklar
    govde.position.set(tirda ? tirX : 0, yk(), 0);
    govde.visible = !(tirda && !tirGorunur && tirX >= UZAK - 0.01);
    for (const a of ayaklar) {
      a.mil.scale.y = Math.max(0.001, e);
      a.mil.position.y = -e / 2;
      a.ped.position.y = -e + 0.025;
    }
    tir.position.x = tirX;
    tir.visible = tirGorunur || tirHareket();
    for (const w of tekerlekler) w.a.rotation.z -= (tirV * dt) / w.r;

    // -- akordeon + zincir + hidromotor
    yaprakGeometri(s);
    yaprakCiz();
    zincirTex.offset.y -= ds / 0.064;
    for (const d of disliler) d.rotation.x += ds / 0.085;
    hmAci += (ds / 0.085) * 4;
    hmRotor.rotation.x = hmAci;
    hmDevir = (Math.abs(sHiz) / (2 * Math.PI * 0.085)) * 60;

    // -- direk + ışık + anemometre
    kat2.position.y = 1.5 + direkE * 2.0;
    kat3.position.y = 1.55 + direkE * 4.0;
    kafa.position.y = 2.7 + direkE * 4.0;
    const isik = direkAcik && direkE > 0.95 && !acil ? 1 : 0;
    projMat.emissiveIntensity = isik * 3.2;
    spot.intensity = isik * 300;
    rotor.rotation.y += (ruzgar / 3.6) * 0.9 * dt;
    invLed.emissiveIntensity = 1 + Math.sin(t * 3) * 0.6;

    // -- enerji (1 sn = 1 dk)
    enerji = clamp(enerji + ((uretim() - tuketim()) * dt) / 60, 0, KAP);
    mesajT = Math.max(0, mesajT - dt);

    opGuncelle(dt, t);
    const db = durumBilgi();
    kule.set(db.seviye, t);
    trend.ornekle(dt, [uretim(), acikOran() * 100]);
    if (ekranZ(dt)) ekran.ciz((x, Wp, Hp) => hmiCiz(x, Wp, Hp, db));
  }

  const NEDEN_METNI = { ruzgar: 'RÜZGAR LİMİTİ', gunbatimi: 'GÜN BATIMI', dolu: 'DOLU UYARISI' };
  function konteynerDurum() {
    if (tirda) return !tirGorunur && tirX >= UZAK - 0.01 ? 'nakliyede (sahada değil)' : tirHareket() ? 'dorsede · yolda' : 'dorsede';
    if (yk() > ZEMIN + 0.001) return `ayaklar üzerinde · ${Math.round((yk() - ZEMIN) * 1000)} mm`;
    return 'yerde';
  }
  function kamyonDurum() {
    if (!tir.visible) return 'yok';
    if (tirHareket()) return tirV < 0 ? 'geri geri yanaşıyor' : 'uzaklaşıyor';
    return Math.abs(tirX) < 0.02 ? 'konteynerin altında' : 'bekliyor';
  }
  function durumBilgi() {
    if (acil) return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (mesajT > 0) return { metin: mesaj.toLocaleUpperCase('tr'), seviye: 'uyari' };
    if (otoNeden) return { metin: `${NEDEN_METNI[otoNeden]} · ${panelKapali() ? 'TOPLANDI' : 'TOPLANIYOR'}`, seviye: 'uyari' };
    if (siraAd) return { metin: siraAd.toLocaleUpperCase('tr'), seviye: 'calisiyor' };
    if (tirda && !govde.visible) return { metin: 'NAKLİYEDE · SAHADA DEĞİL', seviye: 'bekliyor' };
    if (tirda) return { metin: tirHareket() ? 'NAKLİYEDE' : 'DORSEDE · KURULUM BEKLİYOR', seviye: 'bekliyor' };
    if (hidrolikCalisiyor()) return { metin: 'HİDROLİK ÇALIŞIYOR', seviye: 'calisiyor' };
    if (acikOran() >= 0.999) return gunes() > 0 ? { metin: 'AÇIK · ÜRETİMDE', seviye: 'calisiyor' } : { metin: 'AÇIK · GECE', seviye: 'bekliyor' };
    if (panelKapali()) return { metin: 'KAPALI', seviye: 'bekliyor' };
    return { metin: 'KISMİ AÇIK', seviye: 'bekliyor' };
  }

  // Flutter uygulaması görünümü (koyu tema, yeşil vurgu) + yandan dizi şeması
  function hmiCiz(x, Wp, Hp, db) {
    x.fillStyle = '#0e1412'; x.fillRect(0, 0, Wp, Hp);
    x.fillStyle = '#16201c'; x.fillRect(0, 0, Wp, Hp * 0.13);
    x.fillStyle = '#e6efe9'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.font = `600 ${Hp * 0.065}px "Space Grotesk", sans-serif`;
    x.fillText('Solar Container', Wp / 2, Hp * 0.065);
    x.textAlign = 'left'; x.fillStyle = '#7ee08f'; x.font = `500 ${Hp * 0.045}px "JetBrains Mono", monospace`;
    x.fillText(`${Math.round((enerji / KAP) * 100)}%`, Wp * 0.86, Hp * 0.065);
    // yandan şema: konteyner + ray + akordeon yapraklar
    const x0 = Wp * 0.04, y0 = Hp * 0.4, sc = (Wp * 0.9) / (W + S_MAX + 0.6);
    const zx = (z) => x0 + (z + W / 2) * sc;
    const yy = (h) => y0 - h * sc * 1.6;
    x.fillStyle = '#1f6d3c'; x.fillRect(zx(-W / 2), yy(H), W * sc, H * sc * 1.6);
    x.strokeStyle = '#2e9e5b'; x.lineWidth = 2; x.strokeRect(zx(-W / 2), yy(H), W * sc, H * sc * 1.6);
    x.strokeStyle = '#555f5a'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(zx(B0), y0); x.lineTo(zx(RAY_SON), y0); x.stroke();
    x.strokeStyle = '#3d86ff'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(zx(bZ[0]), y0);
    for (let kk = 0; kk < P; kk++) { x.lineTo(zx(tZ[kk]), yy(tH[kk])); x.lineTo(zx(bZ[kk + 1]), y0); }
    x.stroke();
    x.fillStyle = '#f2c200';
    for (let kk = 0; kk <= P; kk++) { x.beginPath(); x.arc(zx(bZ[kk]), y0, 2.5, 0, Math.PI * 2); x.fill(); }
    // çipler
    const cip = (metin, cx, y, renk) => {
      x.font = `500 ${Hp * 0.04}px "Space Grotesk", sans-serif`;
      const w = x.measureText(metin).width + 20;
      x.fillStyle = renk; x.beginPath(); x.roundRect(cx, y - Hp * 0.033, w, Hp * 0.066, 12); x.fill();
      x.fillStyle = '#eafff0'; x.textAlign = 'left'; x.fillText(metin, cx + 10, y);
      return cx + w + 8;
    };
    let cx = Wp * 0.04;
    cx = cip(`Hidrolik: ${hidrolikCalisiyor() ? 'Çalışıyor' : 'Hazır'}`, cx, Hp * 0.47, '#1f6d3c');
    cx = cip(`Ayak: ${Math.round(e * 1000)} mm`, cx, Hp * 0.47, '#24433a');
    cip(`Rüzgar: ${fmt(ruzgar, 0)} km/s`, cx, Hp * 0.47, ruzgar > ruzgarLimit ? '#8a2622' : '#24433a');
    const kart = (i, baslik, deger) => {
      const y = Hp * (0.58 + i * 0.1);
      x.fillStyle = '#18221e'; x.beginPath(); x.roundRect(Wp * 0.04, y - Hp * 0.042, Wp * 0.92, Hp * 0.084, 10); x.fill();
      x.fillStyle = '#9fb3a8'; x.font = `500 ${Hp * 0.043}px "Space Grotesk", sans-serif`; x.textAlign = 'left';
      x.fillText(baslik, Wp * 0.07, y);
      x.fillStyle = '#ffffff'; x.font = `700 ${Hp * 0.048}px "JetBrains Mono", monospace`; x.textAlign = 'right';
      x.fillText(deger, Wp * 0.93, y);
    };
    kart(0, 'Kalan Enerji', `${fmt(enerji, 1)} kWh`);
    kart(1, 'Üretim', `${fmt(uretim(), 1)} kW`);
    kart(2, 'Yaprak açılma', `%${Math.round(acikOran() * 100)} · ${fmt(Math.max(0, bZ[P] - W / 2), 1)} m`);
    const ab = Hp * 0.1;
    x.fillStyle = { calisiyor: '#1f8a3e', uyari: '#a8761a', alarm: '#b3261e', bekliyor: '#3a4440' }[db.seviye];
    x.fillRect(0, Hp - ab, Wp, ab);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 ${ab * 0.46}px "Space Grotesk", sans-serif`;
    x.fillText(db.metin, Wp / 2, Hp - ab / 2);
  }

  const ayakKilit = (yon) => {
    if (tirda && !tirGorunur) { kisaMesaj('Konteyner sahada değil'); return false; }
    if (tirHareket()) { kisaMesaj('Kamyon hareket ediyor'); return false; }
    if (sira.length) sira = [];
    if (yon > 0 && !tirda && !panelKapali() && e >= ZEMIN - 1e-3) { kisaMesaj('Paneller açıkken konteyner kaldırılamaz'); return false; }
    return true;
  };

  const kontroller = [
    { tip: 'baslik', metin: 'Saha senaryoları' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Kurulum (kamyonla getir)', tur: 'basla', tik: kurulum },
      { metin: 'Nakliye (topla · yükle · gönder)', tur: 'dur', tik: nakliye },
    ] },
    { tip: 'anahtar', metin: 'Nakliyeden sonra yeni sahaya kur (demo döngüsü)', get: () => demoDongu, set: (v) => (demoDongu = v) },
    { tip: 'baslik', metin: 'Panel dizisi (hidromotor + zincir)' },
    { tip: 'butonlar', ogeler: [
      { metin: 'Panelleri aç', tur: 'basla', tik: panelAc },
      { metin: 'Panelleri topla', tik: panelKapat },
      { metin: 'Hidrolik dur', tur: 'dur', tik: hidroDur },
    ] },
    { tip: 'secim', metin: 'Hız modu', secenekler: [['yavas', 'Yavaş'], ['orta', 'Orta'], ['hizli', 'Hızlı']], get: () => hizMod, set: (v) => (hizMod = v) },
    { tip: 'baslik', metin: 'Hidrolik ayaklar (basılı tut)' },
    { tip: 'basili', ogeler: [
      { metin: 'Ayaklar ▼ (kaldır)', bas: () => { if (ayakKilit(1)) eJog = 1; }, birak: () => { eJog = 0; eHedef = e; } },
      { metin: 'Ayaklar ▲ (indir / topla)', bas: () => { if (ayakKilit(-1)) eJog = -1; }, birak: () => { eJog = 0; eHedef = e; } },
    ] },
    { tip: 'anahtar', metin: 'Aydınlatma direği (teleskopik)', get: () => direkAcik, set: (v) => (direkAcik = v) },
    { tip: 'baslik', metin: 'Hava & acil senaryolar' },
    { tip: 'kaydirici', metin: 'Rüzgar hızı', min: 0, max: 80, adim: 1, birim: 'km/s', get: () => ruzgar, set: (v) => (ruzgar = v) },
    { tip: 'anahtar', metin: `Rüzgara göre otomatik topla (> ${ruzgarLimit} km/s)`, get: () => otoRuzgar, set: (v) => (otoRuzgar = v) },
    { tip: 'kaydirici', metin: 'Saat', min: 0, max: 23.75, adim: 0.25, birim: 'sa', get: () => saat, set: (v) => (saat = v) },
    { tip: 'anahtar', metin: 'Gün batımında otomatik topla', get: () => otoGunBatimi, set: (v) => (otoGunBatimi = v) },
    { tip: 'anahtar', metin: 'Zaman aksın (1 sn = 1 dk)', get: () => zamanAkisi, set: (v) => (zamanAkisi = v) },
    { tip: 'anahtar', metin: 'Dolu uyarısı', get: () => dolu, set: (v) => (dolu = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { acil = true; eJog = 0; } },
      { metin: 'Reset', tik: () => { acil = false; } },
    ] },
  ];

  const saatMetni = () => `${String(Math.floor(saat)).padStart(2, '0')}:${String(Math.round((saat % 1) * 60) % 60).padStart(2, '0')}`;

  // ilk kare: kapalı paket
  yaprakGeometri(s);
  yaprakCiz();

  // performans: hareketli rijit grupların (konteyner gövdesi, kamyon, direk, anemometre...)
  // kendi içindeki sabit parçaları birleştir — birleşen mesh grubun çocuğu olur, grupla hareket eder
  if (lib.sabitle && new URLSearchParams(location.search).get('sabit') !== '0') {
    lib.sabitle(govde, [...disliler, hmGrup, ...ayaklar.flatMap((a) => [a.mil, a.ped]), direk, ane]);
    disliler.forEach((d) => lib.sabitle(d, []));
    lib.sabitle(hmGrup, [hmRotor]);
    lib.sabitle(direk, [kat2, kat3, kafa]);
    lib.sabitle(ane, [rotor]); lib.sabitle(rotor, []);
    lib.sabitle(tir, tekerlekler.map((w) => w.a));
    tekerlekler.forEach((w) => lib.sabitle(w.a, []));
  }

  return {
    id: 'konteyner',
    ad: 'Güneş Enerjili Konteyner',
    altBaslik: 'Akordeon dizi · hidromotor · Flutter',
    kisa: 'Kamyonla taşınıp kendi kendine kurulan 20 ft güneş konteyneri. Hidrolik ayaklarla dorseden iner/biner; içindeki 16 yapraklık panel dizisi hidromotorun zinciriyle üçgenler yapa yapa ~30 m açılır. Flutter uygulaması Modbus TCP ile PLC\'ye bağlı.',
    proje: 'container',
    ayakIzi: [16, 37],
    ayakIziMerkez: [0, 15.5],
    kamera: { poz: [15, 10, 27], hedef: [0, 0.8, 9.5] },
    durus: { poz: [-8.5, 6], bak: [4, 1.5, 6] },     // yürüyüş: koridor tarafından raylara ve kamyon kapısına bakar
    mekanizmalar: [
      'Panel dizisi: 16 yaprak (yaprak başına 4 panel), akordeon menteşe; açılırken üçgenler yapar, dıştaki üçgen önce yatar (~22°), dizi ~30 m',
      'Hidromotor + tahrik mili + zincir dişlileri: raydaki zincir alt menteşe arabalarını (sarı tekerlek) çekerek açar / çekerek toplar',
      '4 hidrolik ayak (uç ters-U çerçevelerde, konteyner genişliğinin dışında): yere basar, konteyneri 1.58 m\'ye kaldırır / indirir',
      'Kamyon: çekici + iskelet dorse; geri geri konteynerin altına girer, tekerlekler döner',
      'Teleskopik aydınlatma direği + LED projektör; tavanda anemometre',
      'Saha operatörü: tablet kioskunda uygulamayı kullanır; kamyon yanaşırken / ayrılırken yol kenarından kollarıyla yol gösterir, kamyon alttayken "dur" işareti verir; paneller açılırken dizinin yanından izler',
    ],
    cikarim: [
      'SENİN TARİFİN: tek yan açılır; 15–20 yaprak üçgenler yapa yapa açılıp katlanır; altta dönen hidromotor yaprakların alt uçlarını zincirle çekerek açar/kapatır; kamyon senaryosu (yüksel → kamyon girer → dorseye otur → git; tersiyle kurulum).',
      'container-img-01/02 + video-01: açık uzun yan, içeride dik paket; alt menteşelerde sarı tekerlekler, zincirli siyah raylar ve ayarlı ayaklar; dıştaki yapraklar yatık, içtekiler dik üçgen → dıştan içe sıralı açılma.',
      'Uçlardaki siyah çerçeve dikmeleri ve altlarındaki krom miller → 4 hidrolik ayak; dikmeler gövdenin dışında olduğu için dorse aralarından geçebilir.',
      'TAHMİN: yaprak sayısı 16 (8 üçgen), yaprak boyu 2.15 m, tam açık eğim 22°, ray sayısı 2, hidromotorun yeri (açık yanın alt kenarı), kaldırma yüksekliği 1.58 m, dorse yatağı 1.32 m, panel gücü 64 × 550 W.',
      'TAHMİN: saha rayları kurulum yerinde serili kabul edildi (konteynerle taşınmıyor). Süreler hızlandırıldı.',
      'Sanal fabrikada gösterim için B holüne alındı: kamyon holün arka duvarındaki RAMPA 1 kapısından geri geri girer, kapı önündeki asfaltta bekler.',
      'TAHMİN: operatörün kamyona yol göstermesi ve dizi açılışını izlemesi temsili iş akışı; fotoğraflarda saha operatörü görünmüyor.',
    ],
    group: g,
    // performans: bunlar dışındaki sabit parçalar birleştirilir (lib.sabitle)
    sabitHaric: () => [govde, tir],   // konteyner gövdesi (kalkar/kamyona biner) ve kamyon
    update,
    kontroller,
    degerler: () => [
      ['Yaprak açılma', `%${Math.round(acikOran() * 100)} · ${acikUcgen()}/${P} üçgen açık`],
      ['Dizi uzunluğu', `${fmt(Math.max(0, bZ[P] - W / 2), 1)} m`],
      ['Yaprak eğimi', `dış ${fmt(egimDer(P - 1), 0)}° · iç ${fmt(egimDer(0), 0)}°`],
      ['Hidromotor', Math.abs(sHiz) > 1e-3 ? `${fmt(hmDevir, 0)} d/dk · ${fmt(hidrolikBasinc(), 0)} bar` : 'durgun'],
      ['Ayak stroku', `${Math.round(e * 1000)} mm`],
      ['Konteyner', konteynerDurum()],
      ['Kamyon', kamyonDurum()],
      ['Üretim', `${fmt(uretim(), 1)} kW`],
      ['Kalan enerji', `${fmt(enerji, 1)} kWh (%${Math.round((enerji / KAP) * 100)})`],
      ['Rüzgar / saat', `${fmt(ruzgar, 0)} km/s · ${saatMetni()}`],
    ],
    trend,
    durum: durumBilgi,
  };
}
