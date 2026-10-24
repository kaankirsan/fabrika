// js/machines/fk1000.js — FK-1000 V3 Panel Temizleme Robotu (dokamuh.com canlı sahnesi).
//
// KAYNAK: dokamuh.com ana sayfasındaki hero sahnesi (scene.js / scene-worker.js,
// Kaan'ın kendi kodu; 2026-10-23 canlı siteden alındı). Nesne kurulumu ve tick()
// animasyonu SATIR SATIR aktarıldı. Bilinçli değişiklikler:
//  - scene → `S` grubu (kök altında, asfalttan 5 cm yukarıda; çatı plakası z-fight yapmasın)
//  - renderer / kamera / sis / fare paralaksı / DOM telemetri / rAF / scroll YOK
//  - global ışıklar (hemisphere + güneş + rim) YOK — fabrikanın ışıkları kullanılır;
//    robotun küçük durum ışığı (PointLight) duruyor
//  - bina gövdesi, komşu binalar, güneş diski/hale YOK; çatı 46×30 yerine 28×16
//  - hortum uç noktaları dünya yerine S-yerel çerçevede (kök fabrikada B holünde (88,0,18)'de)
//  - kare başına sabit artışlar (sprey, parçacık, operatör takibi, leke silme)
//    canlıdaki 60 fps adımına göre dt ile ölçeklendi; tick 1/60 s alt adımlarla koşar
//  - martılar → güvercin (lib.guvercin; hol içinde kirişlerden süzülerek alçalır)
//  - üstüne fabrika katmanı: başlat/durdur, mod, temizlik modu, hızlar, güvercin gönder,
//    kenar sensörü testi, ACİL; ROTTEST ekranında canlı telemetri kartı
//
// Yönelim canlıdaki gibi: bigPanelGroup.rotation.x = -tilt → panelin +Z kenarı YÜKSEK;
// operatör (z = +4.2) ve tank/ROTTEST/makara (z ≈ +5) yüksek kenar tarafında.

export function create(lib) {
  const { THREE, Ekran, Trend, throttle, fmt, clamp } = lib;

  const root = new THREE.Group();
  const S = new THREE.Group();          // canlı koddaki `scene`
  S.position.y = 0.05;
  root.add(S);

  // Nesnenin S-yerel konumu (canlıdaki getWorldPosition'ın karşılığı)
  function yerel(obj, out) {
    obj.getWorldPosition(out);
    return S.worldToLocal(out);
  }

  // ─── Rooftop (çatı tipi GES) ───────────────  [46×30 → 28×16, merkez z=+1]
  const ROOF_W = 28, ROOF_D = 16, ROOF_Z = 1;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(ROOF_W, 0.6, ROOF_D),
    new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.95, metalness: 0.02 })
  );
  roof.position.set(0, -0.3, ROOF_Z);
  S.add(roof);

  // Parapet walls
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x9a9486, roughness: 0.85 });
  const pH = 0.7, pT = 0.3;
  const zOn = ROOF_Z + ROOF_D / 2, zArka = ROOF_Z - ROOF_D / 2, xK = ROOF_W / 2;
  const pF = new THREE.Mesh(new THREE.BoxGeometry(ROOF_W, pH, pT), parapetMat); pF.position.set(0, 0.35, zOn - pT/2); S.add(pF);
  const pB = new THREE.Mesh(new THREE.BoxGeometry(ROOF_W, pH, pT), parapetMat); pB.position.set(0, 0.35, zArka + pT/2); S.add(pB);
  const pL = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, ROOF_D), parapetMat); pL.position.set(-xK + pT/2, 0.35, ROOF_Z); S.add(pL);
  const pR = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, ROOF_D), parapetMat); pR.position.set(xK - pT/2, 0.35, ROOF_Z); S.add(pR);

  // HVAC prop  [(-17, -11) → çatı köşesine (-11.5, -5)]
  const hvacMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.7, metalness: 0.4 });
  const hvac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.4), hvacMat);
  hvac.position.set(-11.5, 0.5, -5); S.add(hvac);
  const hvacFan = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }));
  hvacFan.position.set(-11.5, 1.05, -5); S.add(hvacFan);

  // ─── Solar panel array ─────────────────────
  const tilt = THREE.MathUtils.degToRad(10);
  const arrayGroup = new THREE.Group();
  S.add(arrayGroup);

  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x162546,
    roughness: 0.18,
    metalness: 0.55,
    emissive: 0x0a1a36,
    emissiveIntensity: 0.5,
  });
  const cellLineMat = new THREE.LineBasicMaterial({ color: 0x3550a0, transparent: true, opacity: 0.55 });
  // (canlıdaki makeCellLines/makePanel/makeRow tanımlı ama hiç çağrılmıyor — aktarılmadı)

  // Place a single big panel that spans the rooftop
  const bigW = 16.8;   // 7 panels * 2.4
  const bigD = 6.5;    // 5 rows * 1.3
  const bigPanelGeo = new THREE.BoxGeometry(bigW, 0.06, bigD);
  const bigPanel = new THREE.Mesh(bigPanelGeo, panelMat);
  const bigPanelGroup = new THREE.Group();
  bigPanelGroup.add(bigPanel);
  // outline
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(bigPanelGeo),
    new THREE.LineBasicMaterial({ color: 0xa5b0c5 })
  );
  bigPanelGroup.add(outline);
  // cell grid lines on the top surface
  const gridPts = [];
  const cols = 24, rows = 10;
  for (let i = 1; i < cols; i++){
    const x = -bigW/2 + (i / cols) * bigW;
    gridPts.push(x, 0.031, -bigD/2); gridPts.push(x, 0.031, bigD/2);
  }
  for (let j = 1; j < rows; j++){
    const z = -bigD/2 + (j / rows) * bigD;
    gridPts.push(-bigW/2, 0.031, z); gridPts.push(bigW/2, 0.031, z);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const gridLines = new THREE.LineSegments(gridGeo, cellLineMat);
  bigPanelGroup.add(gridLines);
  // support legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x7a8497, metalness: 0.8, roughness: 0.45 });
  [[-1, -1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]].forEach(([sx, sz])=>{
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), legMat);
    leg.position.set(sx * (bigW/2 - 1.2), -0.18, sz * (bigD/2 - 0.6));
    bigPanelGroup.add(leg);
  });
  bigPanelGroup.rotation.x = -tilt;          // +Z kenarı yukarı (operatör tarafı)
  bigPanelGroup.position.set(0, 0.28, 0);
  arrayGroup.add(bigPanelGroup);
  arrayGroup.position.y = 0;

  // ─── Cleaning robot ────────────────────────
  // Gövde gerçek FK-1000 V3'e göre (other-machines-img-06 üstten + fuar fotoğrafı);
  // canlı sitedeki kutu gövde yerine. Hareket/animasyon referansları (robot, body,
  // strip, brush1/2, light, sensorL/R, stripHousing/stripLed) aynı adlarla duruyor.
  // Robot-yerel eksenler: X = hareket yönü (siyah ön yüz -X), Z = fırça boyu (operatör +Z),
  // kumanda ucu -Z: üstten bakınca fotoğraftaki (img-06) yerleşimle aynı el yönü,
  // panel yüzeyi y = -0.055 (robot.position.y 0.085, panel üstü 0.03).
  const RL = 1.35, RY0 = -0.055;
  const robot = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.55, metalness: 0.35 });
  const inoxMat = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.28, metalness: 0.9 });
  const kMat = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.8 });
  const modMat = new THREE.MeshStandardMaterial({ color: 0x2c4a94, roughness: 0.45, metalness: 0.2 });

  // body — SİMETRİK yamuk kesitli şasi (Kaan: robot simetrik): düz üst tabla, iki uzun
  // yanda da aşağı eğik siyah bantlı yüz (X-Y profili Z boyunca, x=0'a göre ayna)
  const BX = 0.30, KX = 0.23, TX = 0.20;   // alt yarı genişlik, kırılma, üst tabla yarı genişlik
  const prof = new THREE.Shape();
  prof.moveTo(-BX, 0.055);
  prof.lineTo(BX, 0.055);
  prof.lineTo(BX, 0.075);
  prof.lineTo(KX, 0.20);
  prof.lineTo(TX, 0.245);
  prof.lineTo(-TX, 0.245);
  prof.lineTo(-KX, 0.20);
  prof.lineTo(-BX, 0.075);
  prof.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: RL, bevelEnabled: false });
  bodyGeo.translate(0, 0, -RL / 2);
  const body = new THREE.Mesh(bodyGeo, deckMat);
  robot.add(body);

  // ön yüz: siyah panel bandı, paslanmaz bölme ayırıcıları + uyarı etiketleri (canvas)
  // Doku u ekseni -Z → +Z (sol = kumanda ucu), fotoğraftaki sırayla aynı.
  const yuzTex = lib.canvasTex(1024, 128, (x, w, h) => {
    x.fillStyle = '#16171a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c9ced3';
    for (const f of [0, 0.2, 0.39, 0.6, 1]) x.fillRect(Math.min(w - 8, Math.max(0, f * w - 4)), 0, 8, h);
    const etiket = (cx, baslik, satirlar, ikon) => {
      const ew = 170, eh = 92, ex = cx - ew / 2, ey = 18;
      x.fillStyle = '#f4f4f2'; x.fillRect(ex, ey, ew, eh);
      x.fillStyle = '#f29a00'; x.fillRect(ex + 62, ey + 6, ew - 68, 20);
      x.fillStyle = '#111'; x.font = '700 15px "Space Grotesk", sans-serif'; x.textBaseline = 'middle';
      x.fillText('⚠ WARNING', ex + 68, ey + 16);
      x.font = '600 13px "Space Grotesk", sans-serif';
      satirlar.forEach((s, i) => x.fillText(s, ex + 66, ey + 44 + i * 16));
      x.strokeStyle = '#111'; x.lineWidth = 3;
      if (ikon === 'mano') { x.beginPath(); x.arc(ex + 32, ey + 40, 18, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(ex + 32, ey + 40); x.lineTo(ex + 42, ey + 30); x.stroke(); x.fillRect(ex + 28, ey + 58, 8, 22); }
      else { x.strokeRect(ex + 14, ey + 48, 34, 32); x.beginPath(); x.arc(ex + 30, ey + 22, 7, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(ex + 30, ey + 29); x.lineTo(ex + 22, ey + 48); x.stroke(); }
      void baslik;
    };
    etiket(0.1 * w, 'mano', ['Max Pressure', '50 BAR'], 'mano');
    etiket(0.7 * w, 'lift', ['Lifting hazard.', 'Two person lift'], 'lift');
  });
  // iki eğik yüze de aynı siyah bant (s = -1: -X yüzü, +1: +X yüzü)
  const yuzMat = new THREE.MeshStandardMaterial({ map: yuzTex, roughness: 0.6 });
  const egim = Math.atan2(BX - KX, 0.125);
  const yuzBoy = Math.hypot(BX - KX, 0.125) - 0.004;
  for (const s of [-1, 1]) {
    const yuzGrp = new THREE.Group();
    yuzGrp.position.set(s * ((BX + KX) / 2 + 0.0015), 0.1375 + 0.0008, 0);
    yuzGrp.rotation.z = s * egim;                          // dış normal (±X, +Y) yönüne
    const yuz = new THREE.Mesh(new THREE.PlaneGeometry(RL - 0.01, yuzBoy), yuzMat);
    yuz.rotation.y = s * Math.PI / 2;
    yuzGrp.add(yuz);
    robot.add(yuzGrp);
  }

  // strip — canlıdaki turuncu şeridin yerine: iki yanda alt paslanmaz ray (fotoğraftaki gibi)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.03, RL + 0.02), inoxMat);
  strip.position.set(-(BX + 0.007), 0.07, 0);
  robot.add(strip);
  const strip2 = strip.clone();
  strip2.position.x = BX + 0.007;
  robot.add(strip2);

  // brushes — gövde altında boydan boya siyah kıllı iki silindir fırça (eksen Z)
  const kilTex = lib.canvasTex(64, 32, (x, w, h) => {
    x.fillStyle = '#141518'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3a3d44'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, h);
  }, { tekrar: [3, 1] });
  const brushGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.05, 14);
  const brushMat = new THREE.MeshStandardMaterial({ map: kilTex, roughness: 0.95 });
  const ribGeo = new THREE.BoxGeometry(0.15, 0.012, 1.03);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.9 });
  function makeBrushAssembly(){
    const g = new THREE.Group();
    const core = new THREE.Mesh(brushGeo, brushMat);
    core.rotation.x = Math.PI / 2;
    g.add(core); // cylinder axis along Z
    for (let i = 0; i < 4; i++){
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.rotation.z = (i / 4) * Math.PI;
      g.add(rib);
    }
    return g;
  }
  const brush1 = makeBrushAssembly();
  brush1.position.set(-0.12, RY0 + 0.07, 0);
  robot.add(brush1);
  const brush2 = makeBrushAssembly();
  brush2.position.set(0.12, RY0 + 0.07, 0);
  robot.add(brush2);

  // ── üst tabla donanımı (z konumları fotoğraftan: sol = kumanda ucu = -Z).
  // Donanım `ust` grubunda; grup -0.11 kaydırılarak simetrik tablanın ortasına oturur.
  const TOP = 0.245;
  const ust = new THREE.Group();
  ust.position.x = -0.11;
  robot.add(ust);
  const kutu = (w, h, d, mat, x, y, z, parent = ust) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const silindir = (r, h, mat, x, y, z, eksen) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
    if (eksen === 'x') m.rotation.z = Math.PI / 2; else if (eksen === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); ust.add(m); return m;
  };
  // telsiz kumanda (turuncu, 6 buton) — sol uçta tutucuda
  const kumTex = lib.canvasTex(128, 64, (x, w, h) => {
    x.fillStyle = '#e8622c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#141414';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.roundRect(14 + i * 36, 8 + j * 28, 26, 20, 4); x.fill(); }
    x.fillStyle = '#3ad16a'; x.beginPath(); x.arc(w - 8, h / 2, 4, 0, Math.PI * 2); x.fill();
  });
  const turuncu = new THREE.MeshStandardMaterial({ color: 0xe8622c, roughness: 0.5 });
  kutu(0.2, 0.035, 0.085, [turuncu, turuncu, new THREE.MeshStandardMaterial({ map: kumTex, roughness: 0.5 }), kMat, turuncu, turuncu], 0.12, TOP + 0.02, -0.6);
  silindir(0.009, 0.07, kMat, -0.01, TOP + 0.03, -0.625, 'x');            // anten
  // taşıma kolları (gümüş boru, siyah uç bağlantıları) iki uçta, derinlik yönünde
  for (const [zh, ek] of [[-0.53, false], [0.53, true]]) {
    silindir(0.016, 0.3, inoxMat, 0.09, TOP + 0.07, zh, 'x');
    for (const xh of [0.25, -0.07]) kutu(0.04, 0.085, 0.04, kMat, xh, TOP + 0.04, zh);
    if (ek) kutu(0.3, 0.02, 0.03, inoxMat, 0.09, TOP + 0.012, 0.63);        // yan paslanmaz lama
  }
  // ayrı doka logo levhası (tabla üstünde; siyah levhada resmi logo)
  const dkLogoTex = lib.canvasTex(512, 192, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    lib.dokaLogo(x, w / 2, h / 2, 146);
  });
  const levhaMat = new THREE.MeshStandardMaterial({ map: dkLogoTex, roughness: 0.5 });
  const logoLevha = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.09), levhaMat);
  logoLevha.rotation.set(-Math.PI / 2, 0, 0);          // yazı X (derinlik) boyunca, fotoğraftaki gibi
  logoLevha.position.set(0.085, TOP + 0.002, -0.386);
  ust.add(logoLevha);
  // kontrol kutusu (yükseltilmiş): üst yüz dokusu (logo, QR, buton etiketleri) + gerçek butonlar
  const kontTex = lib.canvasTex(340, 300, (x, w, h) => {
    x.fillStyle = '#b4b8bd'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#8c9096'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    // doku: sol = kumanda ucu (-Z), üst = siyah ön yüz (-X); butonların sarı etiketleri arka-solda
    x.fillStyle = '#e9c21a'; x.fillRect(16, 150, 14, 40); x.fillRect(16, 222, 14, 40);
    // doka logo bloğu (sağ-orta, dikey resmi logo; kendi siyah rozetiyle) + QR (sağ-ön)
    x.save(); x.translate(246, 170); x.rotate(-Math.PI / 2); lib.dokaLogo(x, 0, 0, 34); x.restore();
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 13 + i * j) % 3 === 0) { x.fillStyle = '#111'; x.fillRect(262 + j * 7, 22 + i * 7, 7, 7); }
  });
  const kontMats = [deckMat, deckMat, new THREE.MeshStandardMaterial({ map: kontTex, roughness: 0.5, metalness: 0.2 }), deckMat, deckMat, deckMat];
  const kontKutu = kutu(0.34, 0.035, 0.3, kontMats, 0.10, TOP + 0.0175, -0.107);
  kontKutu.rotation.y = -Math.PI / 2;                                         // doku u ekseni → +Z
  const kTOP = TOP + 0.035;
  silindir(0.02, 0.022, new THREE.MeshStandardMaterial({ color: 0xc8241c, roughness: 0.4, emissive: 0x3a0503 }), 0.2, kTOP + 0.011, -0.212);   // kırmızı mantar
  silindir(0.016, 0.016, new THREE.MeshStandardMaterial({ color: 0x23a347, emissive: 0x23a347, emissiveIntensity: 0.9 }), 0.142, kTOP + 0.008, -0.217); // yeşil ışıklı
  silindir(0.009, 0.02, kMat, 0.076, kTOP + 0.01, -0.222);                                                              // küçük siyah buton
  silindir(0.034, 0.008, new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }), 0.142, kTOP + 0.004, -0.147); // ACİL taban
  silindir(0.02, 0.026, new THREE.MeshStandardMaterial({ color: 0xd61f1a, roughness: 0.4 }), 0.142, kTOP + 0.02, -0.147);  // ACİL mantar
  silindir(0.012, 0.012, inoxMat, 0.054, kTOP + 0.006, -0.11);                                                          // anahtar
  // kaz boynu (siyah spiral hortum) + yuvarlak konnektör — besleme/su girişi
  const kazEgri = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, kTOP, 0.007), new THREE.Vector3(0.22, kTOP + 0.12, 0.01),
    new THREE.Vector3(0.29, kTOP + 0.22, 0.06), new THREE.Vector3(0.27, kTOP + 0.2, 0.13),
    new THREE.Vector3(0.2, kTOP + 0.1, 0.165),
  ]);
  const kazBoynu = new THREE.Mesh(new THREE.TubeGeometry(kazEgri, 24, 0.012, 6, false), kMat);
  ust.add(kazBoynu);
  silindir(0.022, 0.06, kMat, 0.192, TOP + 0.075, 0.167);                     // konnektör gövdesi
  silindir(0.026, 0.012, inoxMat, 0.192, TOP + 0.045, 0.167);                 // konnektör bileziği
  kutu(0.05, 0.03, 0.05, kMat, 0.195, TOP + 0.015, 0.167);                    // tabla soketi
  silindir(0.018, 0.02, kMat, 0.217, TOP + 0.01, 0.092);                      // dolum kapağı
  const hoseAnchor = new THREE.Object3D();                                     // su hortumu buraya bağlanır
  hoseAnchor.position.set(0.192, TOP + 0.11, 0.167);
  ust.add(hoseAnchor);
  // sökülebilir batarya kapağı + siyah tutamak + etiket
  kutu(0.31, 0.014, 0.36, deckMat, 0.11, TOP + 0.007, 0.30);
  kutu(0.03, 0.028, 0.26, kMat, 0.15, TOP + 0.028, 0.29);
  const etiketMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 });
  kutu(0.1, 0.003, 0.13, etiketMat, 0.045, TOP + 0.016, 0.21);

  // small status light
  const light = new THREE.PointLight(0xffd17a, 0.8, 4);
  light.castShadow = false;
  light.position.set(-0.15, 0.32, 0);
  robot.add(light);

  robot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // Attach robot to the front row, on top surface
  const frontRow = arrayGroup.children[0];
  frontRow.add(robot);
  robot.position.set(0, 0.085, 0);

  robot.name = 'robot'; brush1.name = 'brush1'; brush2.name = 'brush2';

  // ─── Operator (PPE: hard hat, yellow hi-vis vest with logo, work pants) ──
  const operator = new THREE.Group();
  operator.name = 'operator';
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.55, emissive: 0x3a2a00, emissiveIntensity: 0.1 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1a3a78, roughness: 0.85 });
  const opSkin = new THREE.MeshStandardMaterial({ color: 0xd9a07a, roughness: 0.9 });
  const opDark = new THREE.MeshStandardMaterial({ color: 0x222328, roughness: 0.85 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.45 });
  const refMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, emissive: 0x888888, emissiveIntensity: 0.25 });

  // Torso: dark shirt under bright yellow vest
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.26), shirtMat);
  shirt.position.y = 1.05; operator.add(shirt);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.62, 0.30), vestMat);
  vest.position.y = 1.08; operator.add(vest);
  // Reflective horizontal bands on vest
  const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.32), refMat);
  band1.position.y = 1.20; operator.add(band1);
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.32), refMat);
  band2.position.y = 0.92; operator.add(band2);
  // Logo patch on back — high-contrast, larger, slightly offset to clear vest
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 180;
  const lctx = lc.getContext('2d');
  lctx.fillStyle = '#000'; lctx.fillRect(0, 0, 512, 180);
  lib.dokaLogo(lctx, 256, 90, 140);                            // siyah zeminde resmi doka logosu
  const logoTex = new THREE.CanvasTexture(lc);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.7, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.25 });
  const logoPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), logoMat);
  logoPanel.position.set(0, 1.10, -0.161); logoPanel.rotation.y = Math.PI; operator.add(logoPanel);

  // Head + hard hat (proper construction style)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), opSkin);
  head.position.y = 1.55; operator.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16, 0, Math.PI*2, 0, Math.PI/2.2), hatMat);
  helmet.position.y = 1.60; operator.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.022, 20), hatMat);
  brim.position.y = 1.60; operator.add(brim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.40), hatMat);
  ridge.position.y = 1.65; operator.add(ridge);

  // Arms angled forward so hands hold the remote / hose in front
  const armL = new THREE.Group(); armL.position.set(-0.30, 1.25, 0); operator.add(armL);
  const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), shirtMat);
  armLMesh.position.set(0, -0.22, 0.11); armLMesh.rotation.x = -0.55; armL.add(armLMesh);
  const armR = new THREE.Group(); armR.position.set(0.30, 1.25, 0); operator.add(armR);
  const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), shirtMat);
  armRMesh.position.set(0, -0.22, 0.11); armRMesh.rotation.x = -0.55; armR.add(armRMesh);

  // Legs
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.24), opDark);
  legs.position.y = 0.36; operator.add(legs);
  const boots = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.30), new THREE.MeshStandardMaterial({color:0x111114, roughness:0.9}));
  boots.position.y = 0.04; operator.add(boots);

  // ─── Industrial crane-style pendant remote ────────────────────────────
  // Yellow rectangular body with black bottom, antenna boot, 8 buttons, lanyard
  const remote = new THREE.Group();
  const bodyY = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.45, metalness: 0.05 });
  const bodyK = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.85 });
  const btnK  = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.7 });
  const btnR  = new THREE.MeshStandardMaterial({ color: 0xd9322a, roughness: 0.55, emissive: 0x4a0a07, emissiveIntensity: 0.3 });
  const btnG  = new THREE.MeshStandardMaterial({ color: 0x2bbf6a, roughness: 0.55, emissive: 0x0d3a1f, emissiveIntensity: 0.3 });
  // Body: width along X = 0.32m, depth Y = 0.10m, length Z = 0.12m
  const rTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.12), bodyY);
  rTop.position.y = 0.035; remote.add(rTop);
  const rBot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.13), bodyK);
  rBot.position.y = -0.015; remote.add(rBot);
  // 8 buttons in a 4×2 grid on top face
  const btnPositions = [
    [-0.115,  0.025, btnG], // START
    [-0.115, -0.025, btnR], // STOP
    [-0.045,  0.025, btnK], // UP
    [-0.045, -0.025, btnK], // DOWN
    [ 0.035,  0.025, btnK], // EAST
    [ 0.035, -0.025, btnK], // SOUTH
    [ 0.110,  0.025, btnK], // WEST
    [ 0.110, -0.025, btnK], // NORTH
  ];
  btnPositions.forEach(([x, z, m]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.018, 0.030), m);
    b.position.set(x, 0.078, z); remote.add(b);
  });
  // Antenna boot on left side
  const antBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.030, 0.10, 12), bodyK);
  antBoot.rotation.z = Math.PI/2; antBoot.position.set(-0.21, 0.04, 0); remote.add(antBoot);
  const antTip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.06, 10), bodyK);
  antTip.rotation.z = Math.PI/2; antTip.position.set(-0.28, 0.04, 0); remote.add(antTip);
  // Lanyard loop on right side (thin torus)
  const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 6, 20), new THREE.MeshStandardMaterial({color:0x222222, roughness:0.7}));
  lanyard.position.set(0.19, 0.02, 0); lanyard.rotation.y = Math.PI/2; remote.add(lanyard);

  // Held in RIGHT hand, antenna tip pointing forward toward the robot.
  remote.position.set(-0.42, 1.00, 0.22);
  remote.rotation.set(-0.20, Math.PI/2, 0);
  remote.scale.setScalar(1.35);
  operator.add(remote);

  // Left hand grip point (where the hose attaches) — model-local +X side
  const leftGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 12), opDark);
  leftGrip.position.set(0.22, 0.95, 0.28);
  leftGrip.rotation.x = Math.PI/2;
  operator.add(leftGrip);

  operator.position.set(-7.5, 0, 4.2);
  operator.rotation.y = Math.PI;
  S.add(operator);

  // ─── Water tank + hose reel (rotteste) ─────────────────────────────────
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.6, metalness: 0.1, emissive: 0x0a1a36, emissiveIntensity: 0.15 });
  const utility = new THREE.Group();
  S.add(utility);
  utility.position.set(-4.5, 0, 5.2);

  // Water tank — IBC-like blue cylinder
  const tankShell = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.5, metalness: 0.2 });
  const tankFrame = new THREE.MeshStandardMaterial({ color: 0xb8c0d0, roughness: 0.5, metalness: 0.6 });
  const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.55, 24), tankShell);
  tankBody.position.y = 0.8;
  utility.add(tankBody);
  const tankTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 24), tankFrame);
  tankTop.position.y = 1.6;
  utility.add(tankTop);
  // Top filler cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), tankFrame);
  cap.position.set(0, 1.66, 0); utility.add(cap);
  // Bottom outlet (where the hose leaves the tank)
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), tankFrame);
  outlet.rotation.x = Math.PI / 2;
  outlet.position.set(0, 0.18, -0.7);
  utility.add(outlet);
  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.5), tankFrame);
  base.position.y = 0.025; utility.add(base);
  // "DOKA H2O" label strip
  const label = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.005), new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.7 }));
  label.position.set(0, 0.85, 0.625); utility.add(label);

  // Rottest — pure water / RO filtration cabinet (between tank and operator)
  const rottest = new THREE.Group();
  rottest.position.set(1.6, 0, -0.2); // local to utility
  utility.add(rottest);
  // Main cabinet
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.55, metalness: 0.25 });
  const cabDark = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.75 });
  const cabAccent = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.5, metalness: 0.3 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.55), cabMat);
  cabinet.position.y = 0.7; rottest.add(cabinet);
  // Top hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.6), cabDark);
  hood.position.y = 1.37; rottest.add(hood);
  // Base wheels frame
  const baseR2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.6), cabDark);
  baseR2.position.y = 0.04; rottest.add(baseR2);
  // Display panel (front)
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.02), cabDark);
  display.position.set(0, 1.0, 0.285); rottest.add(display);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.005), new THREE.MeshStandardMaterial({ color: 0x6ea8ff, emissive: 0x2a6fdb, emissiveIntensity: 0.8, roughness: 0.4 }));
  screen.position.set(0, 1.02, 0.297); rottest.add(screen);
  // Brand strip "ROTTEST"
  const brand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.005), cabAccent);
  brand.position.set(0, 0.78, 0.281); rottest.add(brand);
  // Filter tubes (clear vertical cylinders along the side)
  // transmission KULLANMA: görünür tek bir transmission malzemesi three.js'te tüm opak sahneyi
  // ikinci kez çizdirir (genel bakışta 2330 → 4553 çağrı, VR'da göz başına). Yarı saydam
  // standart malzeme + ortam yansıması aynı "şeffaf filtre kabı" görüntüsünü verir.
  const filterMat = new THREE.MeshStandardMaterial({ color: 0xb4bfd2, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 3; i++){
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 16), filterMat);
    tube.position.set(0.6, 0.55, -0.18 + i * 0.18); rottest.add(tube);
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), cabDark);
    capT.position.set(0.6, 0.98, -0.18 + i * 0.18); rottest.add(capT);
    const capB = capT.clone(); capB.position.y = 0.13; rottest.add(capB);
  }
  // Inlet / outlet valves
  const inletV = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), cabDark);
  inletV.rotation.x = Math.PI / 2;
  inletV.position.set(-0.3, 0.3, 0.36); rottest.add(inletV);
  const outletV = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), cabDark);
  outletV.rotation.x = Math.PI / 2;
  outletV.position.set(0.3, 0.3, 0.36); rottest.add(outletV);

  // FABRİKA: ROTTEST ekranı → canlı telemetri kartı (canlıdaki mavi ekran kutusunun yerine)
  const ekran = new Ekran(0.42, 0.20, 512);
  ekran.mesh.position.set(0, 1.02, 0.3);
  rottest.add(ekran.mesh);
  screen.visible = false;

  // Hose reel attached to side of rottest
  const reel = new THREE.Group();
  reel.position.set(3.0, 0, -0.2); // local to utility
  utility.add(reel);
  // Stand
  const standMat = new THREE.MeshStandardMaterial({ color: 0x37404f, roughness: 0.6, metalness: 0.5 });
  const standL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), standMat);
  standL.position.set(-0.32, 0.35, 0); reel.add(standL);
  const standR = standL.clone(); standR.position.x = 0.32; reel.add(standR);
  const baseR = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.45), standMat);
  baseR.position.y = 0.025; reel.add(baseR);
  // Drum
  const drumMat = new THREE.MeshStandardMaterial({ color: 0xffb84a, roughness: 0.6, metalness: 0.3 });
  const drumSideMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.8 });
  const drumCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 18), drumMat);
  drumCore.rotation.z = Math.PI / 2;
  drumCore.position.y = 0.55; reel.add(drumCore);
  const drumSideL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 22), drumSideMat);
  drumSideL.rotation.z = Math.PI / 2; drumSideL.position.set(-0.295, 0.55, 0);
  reel.add(drumSideL);
  const drumSideR = drumSideL.clone();
  drumSideR.position.x = 0.295; reel.add(drumSideR);
  // Wound hose on drum (helical visualization — just a few rings)
  const woundMat = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.6 });
  for (let i = 0; i < 5; i++){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 24), woundMat);
    ring.rotation.y = Math.PI / 2; ring.position.set(-0.2 + i * 0.1, 0.55, 0);
    reel.add(ring);
  }
  // Crank handle
  const crankMat = new THREE.MeshStandardMaterial({ color: 0xc23030, roughness: 0.5, metalness: 0.4 });
  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), crankMat);
  crankArm.position.set(0.36, 0.55, 0.08); reel.add(crankArm);
  const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), crankMat);
  crankKnob.position.set(0.36, 0.55, 0.16); reel.add(crankKnob);

  // S-local anchor helpers (canlıda world-space)
  const tankOutletWorld = new THREE.Vector3();
  const reelInWorld = new THREE.Vector3();    // tank-side entry on reel
  const reelOutWorld = new THREE.Vector3();   // operator-side exit on reel
  function updateUtilityWorld(){
    yerel(outlet, tankOutletWorld);
    // reel hose anchors — left/right of drum
    yerel(drumSideL, reelInWorld);   // hose IN from rottest
    yerel(drumSideR, reelOutWorld);  // hose OUT to operator
  }

  // Build a tube from a list of points
  function buildTube(pts, radius = 0.045){
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(18, Math.round(pts.length*1.5)), radius, 6, false), hoseMat);
  }

  // Tank → Rottest hose (then Rottest → Reel chained inside same builder)
  function buildTankToReel(){
    updateUtilityWorld();
    // Tank outlet → Rottest inlet valve
    const tankP = tankOutletWorld.clone();
    const rottestInletW = new THREE.Vector3();
    yerel(inletV, rottestInletW);
    const a1 = tankP;
    const b1 = rottestInletW;
    const pts = [];
    const seg = 18;
    for (let i = 0; i <= seg; i++){
      const tt = i / seg;
      pts.push(new THREE.Vector3(
        THREE.MathUtils.lerp(a1.x, b1.x, tt),
        THREE.MathUtils.lerp(a1.y, b1.y, tt) + Math.sin(tt * Math.PI) * 0.14,
        THREE.MathUtils.lerp(a1.z, b1.z, tt)
      ));
    }
    // Rottest outlet valve → Reel drum
    const rottestOutletW = new THREE.Vector3();
    yerel(outletV, rottestOutletW);
    const a2 = rottestOutletW;
    const b2 = reelInWorld;
    for (let i = 1; i <= seg; i++){
      const tt = i / seg;
      pts.push(new THREE.Vector3(
        THREE.MathUtils.lerp(a2.x, b2.x, tt),
        THREE.MathUtils.lerp(a2.y, b2.y, tt) + Math.sin(tt * Math.PI) * 0.16,
        THREE.MathUtils.lerp(a2.z, b2.z, tt)
      ));
    }
    return buildTube(pts, 0.05);
  }
  const hoseTankReel = buildTankToReel();
  S.add(hoseTankReel);
  // Water hose (operator -> robot) — one BufferGeometry each, only vertices updated.
  const HOSE_TUBE_SEGMENTS = 32;
  const HOSE_RADIAL_SEGMENTS = 6;
  const hoseTmpA = new THREE.Vector3();
  const hoseTmpB = new THREE.Vector3();
  const hoseTmpTangent = new THREE.Vector3();
  const hoseTmpNormal = new THREE.Vector3();
  const hoseTmpBinormal = new THREE.Vector3();
  const hoseUp = new THREE.Vector3(0, 1, 0);
  const hoseSide = new THREE.Vector3(1, 0, 0);
  function createDynamicTube(radius = 0.045, tubularSegments = HOSE_TUBE_SEGMENTS, radialSegments = HOSE_RADIAL_SEGMENTS) {
    const ringCount = tubularSegments + 1;
    const vertsPerRing = radialSegments;
    const positions = new Float32Array(ringCount * vertsPerRing * 3);
    const normals = new Float32Array(ringCount * vertsPerRing * 3);
    const indices = [];
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * vertsPerRing + j;
        const b = i * vertsPerRing + ((j + 1) % radialSegments);
        const c = (i + 1) * vertsPerRing + j;
        const d = (i + 1) * vertsPerRing + ((j + 1) % radialSegments);
        indices.push(a, c, b, b, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeBoundingSphere();
    const mesh = new THREE.Mesh(geom, hoseMat);
    mesh.frustumCulled = false;
    return { mesh, geom, positions, normals, radius, tubularSegments, radialSegments };
  }
  const hoseTrig = Array.from({ length: 6 }, (_, j) => ({
    c: Math.cos((j / 6) * Math.PI * 2),
    s: Math.sin((j / 6) * Math.PI * 2),
  }));
  const hosePrevA = new THREE.Vector3(999,999,999);
  const hosePrevB = new THREE.Vector3(999,999,999);
  const hosePrevC = new THREE.Vector3(999,999,999);
  const hosePrevD = new THREE.Vector3(999,999,999);
  function updateDynamicTube(tube, centerAt) {
    const { positions, normals, radius, tubularSegments, radialSegments, geom } = tube;
    const ringCount = tubularSegments + 1;
    for (let i = 0; i < ringCount; i++) {
      const u = i / tubularSegments;
      centerAt(Math.max(0, u - 1 / tubularSegments), hoseTmpA);
      centerAt(Math.min(1, u + 1 / tubularSegments), hoseTmpB);
      hoseTmpTangent.subVectors(hoseTmpB, hoseTmpA).normalize();
      hoseTmpNormal.crossVectors(hoseTmpTangent, hoseUp);
      if (hoseTmpNormal.lengthSq() < 0.0001) hoseTmpNormal.crossVectors(hoseTmpTangent, hoseSide);
      hoseTmpNormal.normalize();
      hoseTmpBinormal.crossVectors(hoseTmpTangent, hoseTmpNormal).normalize();
      centerAt(u, hoseTmpA);
      for (let j = 0; j < radialSegments; j++) {
        const trig = hoseTrig[j];
        const cx = trig.c;
        const sy = trig.s;
        const nx = hoseTmpNormal.x * cx + hoseTmpBinormal.x * sy;
        const ny = hoseTmpNormal.y * cx + hoseTmpBinormal.y * sy;
        const nz = hoseTmpNormal.z * cx + hoseTmpBinormal.z * sy;
        const idx = (i * radialSegments + j) * 3;
        positions[idx] = hoseTmpA.x + nx * radius;
        positions[idx + 1] = hoseTmpA.y + ny * radius;
        positions[idx + 2] = hoseTmpA.z + nz * radius;
        normals[idx] = nx;
        normals[idx + 1] = ny;
        normals[idx + 2] = nz;
      }
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.normal.needsUpdate = true;
    geom.computeBoundingSphere();
  }
  const robotHoseTube = createDynamicTube(0.045);
  const reelOperatorTube = createDynamicTube(0.045);
  S.add(robotHoseTube.mesh);
  S.add(reelOperatorTube.mesh);
  const hoseRobotWorld = new THREE.Vector3();
  const hoseOpWorld = new THREE.Vector3();
  const hoseOpBack = new THREE.Vector3();
  const hoseFlank = new THREE.Vector3();
  const hoseCtrl1 = new THREE.Vector3();
  const hoseOpLocal = new THREE.Vector3(0.22, 0.95, 0.28);
  const hoseFlankLocal = new THREE.Vector3(0.55, 0.95, 0.05);
  const hoseEuler = new THREE.Euler();          // canlıda her kare `new THREE.Euler` — tek nesne
  const hoseWrapCurve = new THREE.CatmullRomCurve3([
    reelOutWorld.clone(), hoseCtrl1, hoseFlank, hoseOpBack
  ], false, 'centripetal', 0.5);
  function updateHoseEndpoints(){
    updateUtilityWorld();
    yerel(hoseAnchor, hoseRobotWorld);   // gerçek robottaki kaz boynu konnektörü (canlıda gövde kenarı +0.42 z / +0.12 y)
    hoseEuler.set(0, operator.rotation.y, 0);
    hoseOpWorld.copy(hoseOpLocal).applyEuler(hoseEuler);
    hoseOpWorld.add(operator.position);
    hoseOpBack.copy(hoseOpLocal).applyEuler(hoseEuler);
    hoseOpBack.add(operator.position);
    hoseFlank.copy(hoseFlankLocal).applyEuler(hoseEuler);
    hoseFlank.add(operator.position);
    const dx = operator.position.x - reelOutWorld.x;
    const wrap = THREE.MathUtils.clamp((-dx - 0.3) / 2.5, 0, 1);
    hoseCtrl1.set(
      THREE.MathUtils.lerp(reelOutWorld.x, hoseFlank.x, 0.40),
      (reelOutWorld.y + hoseOpBack.y) * 0.5,
      THREE.MathUtils.lerp(reelOutWorld.z, hoseFlank.z, 0.45) - 0.25 * wrap
    );
    hoseWrapCurve.points[0].copy(reelOutWorld);
  }
  const hoseRobotCenter = (u, out) => out.set(
    THREE.MathUtils.lerp(hoseOpWorld.x, hoseRobotWorld.x, u),
    THREE.MathUtils.lerp(hoseOpWorld.y, hoseRobotWorld.y, u) + Math.sin((1 - u) * Math.PI * 0.5) * 0.25,
    THREE.MathUtils.lerp(hoseOpWorld.z, hoseRobotWorld.z, u)
  );
  const hoseWrapCenter = (u, out) => hoseWrapCurve.getPoint(u, out);
  function rebuildHose(){
    updateHoseEndpoints();
    if (hoseRobotWorld.distanceToSquared(hosePrevA) < 0.000004 && hoseOpWorld.distanceToSquared(hosePrevB) < 0.000004 && reelOutWorld.distanceToSquared(hosePrevC) < 0.000004 && hoseOpBack.distanceToSquared(hosePrevD) < 0.000004) return;
    hosePrevA.copy(hoseRobotWorld);
    hosePrevB.copy(hoseOpWorld);
    hosePrevC.copy(reelOutWorld);
    hosePrevD.copy(hoseOpBack);
    updateDynamicTube(robotHoseTube, hoseRobotCenter);
    updateDynamicTube(reelOperatorTube, hoseWrapCenter);
  }

  // ─── Water spray particles (under brushes) ─────────────────────────────
  const sprayCount = 107;
  const sprayPos = new Float32Array(sprayCount * 3);
  const sprayVel = [];
  for (let i = 0; i < sprayCount; i++){
    sprayPos[i*3] = 0; sprayPos[i*3+1] = 0; sprayPos[i*3+2] = 0;
    sprayVel.push({x: (Math.random()-0.5)*0.04, y: -0.01 - Math.random()*0.02, z: (Math.random()-0.5)*0.06, life: Math.random()});
  }
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const sprayMat = new THREE.PointsMaterial({
    color: 0x9bd6ff, size: 0.05, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const spray = new THREE.Points(sprayGeo, sprayMat);
  spray.frustumCulled = false;
  frontRow.add(spray);

  // ─── Edge-sensor LEDs — mavi sensör modülleri (fotoğraftaki gibi), simetrik: her eğik
  //     yüzün alt kenarında 3 kablolu modül (sensorR +X, sensorL -X). Hareket yönündeki
  //     küme canlıdaki mantıkla yanıp söner.
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xff3030, emissiveIntensity: 1.2 });
  const modGeo = new THREE.BoxGeometry(0.05, 0.045, 0.075);
  const ledGeo = new THREE.SphereGeometry(0.012, 8, 6);
  function addEdgeLeds(xSide, y, zs, kablo) {
    const arr = [];
    zs.forEach((z) => {
      const mdl = new THREE.Mesh(modGeo, modMat);
      mdl.position.set(xSide, y, z); mdl.castShadow = true;
      robot.add(mdl);
      const s = new THREE.Mesh(ledGeo, sensorMat.clone());
      s.position.set(xSide, y + 0.026, z);
      robot.add(s);
      arr.push(s);
      if (kablo) lib.rod([xSide - Math.sign(xSide) * 0.012, y + 0.02, z + 0.028], [Math.sign(xSide) * (KX - 0.02), 0.19, z + 0.028], 0.006, kMat, robot);
    });
    return arr;
  }
  const sensorR = addEdgeLeds( BX + 0.01, 0.06, [-0.401, -0.227, -0.082], true);
  const sensorL = addEdgeLeds(-BX - 0.01, 0.06, [-0.401, -0.227, -0.082], true);

  // ─── Directional strip LED — operatöre bakan +Z uçta kırmızı-turuncu LED bar (fuar fotoğrafı)
  const ledGrp = new THREE.Group();
  ledGrp.position.set(0, 0.17, RL / 2);
  robot.add(ledGrp);
  const stripHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.5, roughness: 0.5 })
  );
  stripHousing.position.z = 0.006;
  ledGrp.add(stripHousing);
  const stripLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.022, 0.014),
    new THREE.MeshStandardMaterial({ color: 0xff4a24, emissive: 0xff3a1a, emissiveIntensity: 2.2 })
  );
  stripLed.position.z = 0.009;
  ledGrp.add(stripLed);

  // ─── "Clean streak" trail behind robot ─────
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0x9bd6ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  });
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 1.25), trailMat);
  trail.rotation.x = -Math.PI / 2;
  trail.position.set(0, 0.07, 0);
  frontRow.add(trail);

  // ─── Güvercin + pislik ──────────────────────────────────────────────────
  // FABRİKA: canlı sitedeki martılar burada (hol içinde) güvercin: lib.guvercin() modeli.
  // Uçuş çatı kirişleri yüksekliğinden (~8 m) süzülerek panelin üstüne alçalır, pisliği bırakıp
  // yeniden yükselir; durum makinesi / pislik / silme döngüsü canlı koddakiyle aynı.
  function makeBird(initialDelay) {
    const guv = lib.guvercin({ olcek: 0.85 });
    const seagull = guv.group;
    seagull.visible = false;
    S.add(seagull);

    const splat = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 18),
      new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.95, transparent: true, opacity: 0 })
    );
    splat.rotation.x = -Math.PI / 2;
    splat.position.set(0, 0.04, 0);
    frontRow.add(splat);

    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9 })
    );
    drop.visible = false;
    S.add(drop);

    return {
      group: seagull, guv, splat, drop,
      state: {
        nextSpawn: initialDelay,
        flying: false,
        t0: 0,
        duration: 9 + Math.random() * 2,
        splatX: 0,
        splatActive: false,
        dropped: false,
        falling: false,
        fallStart: 0,
        flapPhase: Math.random() * Math.PI * 2,
        altitude: 3.6 + Math.random() * 1.2,
      }
    };
  }

  const birds = [makeBird(3), makeBird(7), makeBird(12)];
  const frontRowWorld = new THREE.Vector3();

  // ─── Floating particles (atmosphere) ───────  [çatı alanına sınırlı: x ±13, z -6…8, y ≤ 7]
  const pCount = 140;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 26;
    pPos[i * 3 + 1] = Math.random() * 6 + 0.5;
    pPos[i * 3 + 2] = ROOF_Z + (Math.random() - 0.5) * 14;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffc78a, size: 0.04, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  S.add(particles);

  // Gölgeler: dolu mesh'ler atar/alır; şeffaf iz/leke/çatı plakası atmaz
  S.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !o.material.transparent;
    o.receiveShadow = true;
  });
  roof.castShadow = false;
  ekran.mesh.castShadow = false;

  // ─── Fabrika durumu ────────────────────────
  // Edge-bounce drive: semi-autonomous (operator + edge sensors)
  let dir = 1; // +1 right, -1 left
  let lastEdge = -Infinity;
  const EDGE_X = 8.1;
  const DUSME_X = 8.4;
  let calisma = true;            // Başlat/Durdur
  let acil = false, dusme = false;
  let mod = 'yari';              // yari | manuel
  let temizlik = 'islak';        // islak | kuru | hibrit
  let fircaRpm = 210;            // canlıdaki dt*22 rad/s ≈ 210 dev/dk
  let hiz = 1.2;                 // m/s (canlıdaki speed)
  let kenarKapali = false;
  let jog = 0;
  let tAnim = 0;                 // canlıdaki clock.getElapsedTime() (hep akar: kuşlar)
  let tSure = 0;                 // çalışma süresi (telemetri "Süre")
  let leke = 0;
  let uyariMetin = '', uyariT = 0;
  let edgeBlink = false;
  const uyar = (m) => { uyariMetin = m; uyariT = 2; };
  const hareketli = () => calisma && !acil && !dusme;
  const spreyAcik = () => hareketli() && (temizlik === 'islak' || (temizlik === 'hibrit' && (tSure % 6) < 3));
  const suAkisi = () => (spreyAcik() ? 2.4 + Math.sin(tSure * 1.4) * 0.2 : 0);
  const hortumBasinci = () => (spreyAcik() ? 4.2 + Math.sin(tSure * 0.9) * 0.04 : 0);

  // ─── Animate (canlı tick gövdesi; 1/60 s alt adımlarla) ───────────────
  function adim(dt) {
    tAnim += dt;
    const t = tAnim;
    const kosu = hareketli();
    if (kosu) tSure += dt;

    // Robot drives at constant speed, reverses direction on edge sensors
    let v = 0;
    if (kosu) {
      if (mod === 'yari') v = dir * hiz;
      else if (jog) { dir = jog; v = jog * hiz; }
    }
    robot.position.x += v * dt;
    const sinir = kenarKapali ? DUSME_X : EDGE_X;
    if (robot.position.x >  sinir){ robot.position.x =  sinir; kenarDurum( 1, t); }
    if (robot.position.x < -sinir){ robot.position.x = -sinir; kenarDurum(-1, t); }
    edgeBlink = (t - lastEdge) < 3;

    // Brushes spin around Z axis (their cylinder axis)
    if (kosu) {
      const w = (fircaRpm * Math.PI * 2) / 60;
      brush1.rotation.z += dt * w;
      brush2.rotation.z += dt * w;
    }
    // small bobbing
    robot.position.y = 0.085 + (kosu ? Math.sin(t * 6) * 0.005 : 0);
    robot.rotation.z = dusme ? -Math.sign(robot.position.x) * 0.12 : 0;   // kenardan taşma

    // Sensor LEDs: leading-edge cluster blinks orange, trailing cluster red dim
    const leadingIsR = dir > 0;
    const leadArr = leadingIsR ? sensorR : sensorL;
    const trailArr = leadingIsR ? sensorL : sensorR;
    const ledAcik = !kenarKapali;
    leadArr.forEach(s => {
      s.material.emissiveIntensity = !ledAcik ? 0.05 : edgeBlink ? 2.4 : 0.8;
      s.material.emissive.setHex(edgeBlink ? 0xffaa30 : 0xff3030);
    });
    trailArr.forEach(s => {
      s.material.emissiveIntensity = ledAcik ? 0.25 : 0.05;
      s.material.emissive.setHex(0xff3030);
    });

    // Directional strip LED — segment slides in the robot's heading direction (chase loop)
    const stripRange = 0.17;   // canlıda 0.36 (0.86 m şerit); gerçek robotta uç yüzdeki 0.42 m LED bar
    const stripSpeed = 0.45;
    if (kosu) stripLed.userData.phase = (stripLed.userData.phase || 0) + dir * stripSpeed * dt;
    const period = stripRange * 2;
    let ph = (stripLed.userData.phase || 0) % period;
    if (ph < 0) ph += period;
    stripLed.position.x = -stripRange + ph;
    stripLed.material.emissiveIntensity = kosu ? 1.8 + Math.sin(t * 4) * 0.4 : 0.3;

    // Wet streak follows behind robot (yalnız sprey açıkken)
    const trailLen = 1.2;
    trail.visible = spreyAcik();
    trail.scale.x = trailLen * 200; // PlaneGeometry was 0.001
    trail.position.x = robot.position.x + dir * trailLen / 2;
    trail.material.opacity = 0.35 + Math.abs(Math.sin(t * 1.6)) * 0.15;

    // ─── Güvercin geçişi + pislik döngüsü (3 kuş; canlıda martı) ─────────
    for (const b of birds) {
      const seagull = b.group; const st = b.state;
      const splat = b.splat; const drop = b.drop;

      if (!st.flying && t >= st.nextSpawn) {
        st.flying = true;
        st.t0 = t;
        st.duration = 8 + Math.random() * 3;
        st.dirX = Math.random() < 0.5 ? 1 : -1;
        st.splatX = (Math.random() - 0.5) * 14;
        st.altitude = 3.4 + Math.random() * 1.4;
        st.zDrift = (Math.random() - 0.5) * 4;
        st.dropped = false;
        seagull.visible = true;
      }
      if (st.flying) {
        const u = (t - st.t0) / st.duration;
        if (u >= 1) {
          st.flying = false;
          seagull.visible = false;
          st.nextSpawn = t + 4 + Math.random() * 6;
        } else {
          const startX = st.dirX > 0 ? -18 : 18;
          const endX   = st.dirX > 0 ?  18 : -18;
          // FABRİKA: kirişlerden süzülerek alçalır (ortada en alçak), sonra yükselir; burun yola göre eğilir
          const SUZ = 3.6;
          seagull.position.x = THREE.MathUtils.lerp(startX, endX, u);
          seagull.position.y = st.altitude + (1 - Math.sin(u * Math.PI)) * SUZ;
          seagull.position.z = st.zDrift + Math.sin(u * Math.PI * 2 + st.flapPhase) * 1.2;
          seagull.rotation.set(0, st.dirX > 0 ? 0 : Math.PI, Math.atan2(-SUZ * Math.PI * Math.cos(u * Math.PI), Math.abs(endX - startX)));
          // alçalırken süzülür, düzlükte ve tırmanırken çırpar
          if (u > 0.08 && u < 0.34) b.guv.suzul(0.2); else b.guv.kanat(t, st.flapPhase, 0.8, 10);
          yerel(frontRow, frontRowWorld);
          const seaLocalX = seagull.position.x - frontRowWorld.x;
          if (!st.dropped && Math.abs(seaLocalX - st.splatX) < 0.4) {
            st.dropped = true;
            st.falling = true;
            st.fallStart = t;
            st.dropY = seagull.position.y;
            drop.position.set(frontRowWorld.x + st.splatX, seagull.position.y, frontRowWorld.z);
            drop.visible = true;
          }
        }
      }
      if (st.falling) {
        const fu = (t - st.fallStart) / 2.4;
        if (fu >= 1) {
          st.falling = false;
          drop.visible = false;
          splat.position.set(st.splatX, 0.04, (Math.random() - 0.5) * 1.6);
          splat.material.opacity = 0.95;
          st.splatActive = true;
        } else {
          yerel(frontRow, frontRowWorld);
          const startY = st.dropY ?? st.altitude + 0.5;
          drop.position.y = THREE.MathUtils.lerp(startY, frontRowWorld.y + 0.04, fu);
        }
      }
      if (st.splatActive && kosu && fircaRpm > 0) {
        if (Math.abs(robot.position.x - splat.position.x) < 0.55) {
          splat.material.opacity *= Math.pow(0.85, dt * 60);
          if (splat.material.opacity < 0.02) {
            splat.material.opacity = 0;
            st.splatActive = false;
            leke++;
          }
        }
      }
    }

    // Water spray particles under brushes (canlıda her kare; burada 60 fps adımına ölçekli)
    spray.visible = spreyAcik();
    if (spray.visible) {
      const k = dt * 60;
      for (let i = 0; i < sprayCount; i++){
        const sv = sprayVel[i];
        sv.life -= dt * 1.6;
        if (sv.life <= 0){
          sprayPos[i*3]   = robot.position.x + (Math.random()-0.5) * 0.6;
          sprayPos[i*3+1] = 0.08;
          sprayPos[i*3+2] = (Math.random()-0.5) * 1.0;
          sv.x = (Math.random()-0.5)*0.04 + dir * 0.02;
          sv.y = -0.005 - Math.random()*0.01;
          sv.z = (Math.random()-0.5) * 0.04;
          sv.life = 0.6 + Math.random()*0.4;
        } else {
          sprayPos[i*3]   += sv.x * k;
          sprayPos[i*3+1] += sv.y * k;
          sprayPos[i*3+2] += sv.z * k;
        }
      }
      sprayGeo.attributes.position.needsUpdate = true;
    }

    // Operator walks alongside the robot — same X line, fixed Z, gentle bob
    const opTargetX = robot.position.x;
    operator.position.x += (opTargetX - operator.position.x) * (1 - Math.pow(1 - 0.06, dt * 60));
    const yuruyor = kosu && Math.abs(v) > 0.01;
    operator.position.y = yuruyor ? Math.abs(Math.sin(t * 4.2)) * 0.05 : 0;
    legs.rotation.x = yuruyor ? Math.sin(t * 4.2) * 0.25 : 0;
    operator.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.06;
    remote.rotation.z = Math.sin(t * 1.8) * 0.06;

    // Particles drift
    const pos = particles.geometry.attributes.position;
    const k = dt * 60;
    for (let i = 0; i < pCount; i++) {
      pos.array[i * 3] += Math.sin(t * 0.3 + i) * 0.002 * k;
      pos.array[i * 3 + 1] += (0.005 + Math.sin(i) * 0.002) * k;
      if (pos.array[i * 3 + 1] > 7) pos.array[i * 3 + 1] = 0.4;
    }
    pos.needsUpdate = true;
  }

  // Kenar: sensör açıksa canlıdaki gibi yön değiştir (manuelde dur); kapalıysa düşme alarmı
  function kenarDurum(taraf, t) {
    if (kenarKapali) {
      dusme = true;
      calisma = false;              // Reset + Başlat ister
      return;
    }
    lastEdge = t;
    if (mod === 'yari') dir = -taraf;
  }

  // ─── Telemetri ekranı (canlı sitedeki "FK-1000 V3 · CANLI" kartı) ─────
  const sure = () => `${String(Math.floor(tSure / 60)).padStart(2, '0')}:${String(Math.floor(tSure % 60)).padStart(2, '0')}`;
  const MOD_TXT = { yari: 'YARI OTOMATİK', manuel: 'MANUEL' };
  function kenarTxt() {
    if (kenarKapali) return ['DEVRE DIŞI', '#f85149'];
    return edgeBlink ? ['KENAR ALGILANDI', '#e3b341'] : ['TARAMA', '#e6edf3'];
  }
  function ekranCiz(x, W, H) {
    x.fillStyle = '#0d1219'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#263241'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, H - 3);
    const yaz = (s, px, py, size, renk, hiza = 'left', kalin = 600) => {
      x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
      x.font = `${kalin} ${size}px "JetBrains Mono", monospace`;
      x.fillText(s, px, py);
    };
    const d = durumBilgi();
    const nokta = { calisiyor: '#3fb950', uyari: '#e3b341', alarm: '#f85149', bekliyor: '#6e7681' }[d.seviye];
    x.fillStyle = nokta; x.beginPath(); x.arc(20, 22, 5, 0, Math.PI * 2); x.fill();
    yaz('FK-1000 V3 · CANLI', 32, 22, 15, '#c9d1d9', 'left', 700);
    yaz('#R-1042 · OSB-04', W - 14, 22, 11, '#6e7681', 'right', 500);
    x.strokeStyle = '#263241'; x.lineWidth = 1; x.beginPath(); x.moveTo(10, 40); x.lineTo(W - 10, 40); x.stroke();
    const [kt, kr] = kenarTxt();
    const satir = [
      ['Mod', MOD_TXT[mod], '#3fb950'],
      ['Operatör', 'MANUEL · YARI OTOMATİK', '#3fb950'],
      ['Kenar Sensörü', kt, kr],
      ['Hortum Basıncı', `${fmt(hortumBasinci(), 1)} bar`, '#e6edf3'],
      ['Su Akışı', `${fmt(suAkisi(), 2)} L/dk`, '#3fb950'],
      ['Süre', sure(), '#e6edf3'],
    ];
    const rh = (H - 46) / satir.length;
    satir.forEach(([k, v, r], i) => {
      const y = 46 + rh * (i + 0.5);
      if (i) { x.strokeStyle = '#1b2430'; x.beginPath(); x.moveTo(14, 46 + rh * i); x.lineTo(W - 14, 46 + rh * i); x.stroke(); }
      yaz(k, 16, y, 13, '#8b949e', 'left', 500);
      yaz(v, W - 16, y, 14, r, 'right', 700);
    });
    if (d.seviye === 'alarm') {
      x.fillStyle = 'rgba(248,81,73,.88)'; x.fillRect(0, H - 26, W, 26);
      yaz(d.metin, W / 2, H - 13, 13, '#fff', 'center', 700);
    }
  }

  const trend = new Trend([{ ad: 'Robot X (m)', renk: '#39c5cf' }, { ad: 'Su akışı ×3 (L/dk)', renk: '#9bd6ff' }], { min: -9, max: 9, uzunluk: 300 });
  const ekranZ = throttle(4);

  function update(dt) {
    let kalan = Math.min(dt, 0.05);
    while (kalan > 1e-6) {
      const h = Math.min(kalan, 1 / 60);
      adim(h);
      kalan -= h;
    }
    // Hose has to follow the robot smoothly; rebuild once per rendered frame.
    rebuildHose();
    uyariT = Math.max(0, uyariT - dt);
    trend.ornekle(dt, [robot.position.x, suAkisi() * 3]);
    if (ekranZ(dt)) ekran.ciz(ekranCiz);
  }

  function durumBilgi() {
    if (acil) return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (dusme) return { metin: 'DÜŞME RİSKİ · KENAR SENSÖRÜ KAPALI', seviye: 'alarm' };
    if (!calisma) return { metin: 'DURDU', seviye: 'bekliyor' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (kenarKapali) return { metin: 'KENAR SENSÖRÜ DEVRE DIŞI', seviye: 'uyari' };
    if (edgeBlink) return { metin: 'KENAR ALGILANDI', seviye: 'uyari' };
    return { metin: `${MOD_TXT[mod]} · ${dir > 0 ? 'SAĞA →' : '← SOLA'}`, seviye: 'calisiyor' };
  }

  const manuelJog = (y) => () => {
    if (mod !== 'manuel') { uyar('MANUEL MODA GEÇ'); return; }
    jog = y;
  };
  const kontroller = [
    { tip: 'butonlar', ogeler: [
      { metin: 'Başlat', tur: 'basla', tik: () => { if (!acil && !dusme) calisma = true; } },
      { metin: 'Durdur', tur: 'dur', tik: () => { calisma = false; jog = 0; } },
    ] },
    { tip: 'secim', metin: 'Sürüş modu', secenekler: [['yari', 'Yarı otomatik (kenarda dön)'], ['manuel', 'Manuel (◀ ▶ basılı tut)']],
      get: () => mod, set: (v) => { mod = v; jog = 0; } },
    { tip: 'basili', ogeler: [
      { metin: '◀ Sola', bas: manuelJog(-1), birak: () => (jog = 0) },
      { metin: 'Sağa ▶', bas: manuelJog(1), birak: () => (jog = 0) },
    ] },
    { tip: 'secim', metin: 'Temizlik modu', secenekler: [['islak', 'Islak (su açık)'], ['kuru', 'Kuru (su kapalı)'], ['hibrit', 'Hibrit (aralıklı su)']],
      get: () => temizlik, set: (v) => (temizlik = v) },
    { tip: 'kaydirici', metin: 'Fırça hızı', min: 0, max: 300, adim: 10, birim: 'dev/dk', get: () => fircaRpm, set: (v) => (fircaRpm = v) },
    { tip: 'kaydirici', metin: 'Robot hızı', min: 0.2, max: 2.0, adim: 0.1, birim: 'm/s', get: () => hiz, set: (v) => (hiz = v) },
    { tip: 'butonlar', ogeler: [{ metin: 'Güvercin gönder', tik: () => {
      const b = birds.filter((x) => !x.state.flying).sort((a, c) => a.state.nextSpawn - c.state.nextSpawn)[0];
      if (b) b.state.nextSpawn = tAnim; else uyar('ÜÇ GÜVERCİN DE HAVADA');
    } }] },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'anahtar', metin: 'Kenar sensörünü devre dışı bırak (test)', get: () => kenarKapali, set: (v) => (kenarKapali = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { acil = true; calisma = false; jog = 0; } },
      { metin: 'Reset', tik: () => {
        acil = false; uyariT = 0;
        if (dusme) {                                   // robotu panel içine geri al, yönü çevir
          const s = Math.sign(robot.position.x) || 1;
          robot.position.x = s * (EDGE_X - 0.3);
          dir = -s; dusme = false;
        }
      } },
    ] },
  ];

  rebuildHose();
  ekran.ciz(ekranCiz);

  return {
    id: 'fk1000',
    ad: 'FK-1000 V3 Panel Temizleme Robotu',
    altBaslik: 'dokamuh.com canlı sahnesi · yarı otomatik',
    kisa: 'Doka Mühendislik FK-1000 V3: 1000 mm fırça, 26 kg, 1800 m²/sa. Çatı GES\'inde panel üstünde gidip gelir, kenar sensörüyle yön değiştirir; su tankı + ROTTEST saf su kabini + hortum makarasından beslenir, operatör telsiz kumandayla eşlik eder. Sahne dokamuh.com ana sayfasındaki canlı animasyondan birebir aktarıldı.',
    proje: 'other-machines',
    ayakIzi: [29, 17],
    ayakIziMerkez: [0, ROOF_Z],
    // Canlı kamera (8, 7, 14) → (0, 1.4, 0), FOV 40; fabrika FOV 45 → mesafe ×0.88
    kamera: { poz: [7.2, 6.3, 12.4], hedef: [0, 1.4, 0] },
    mekanizmalar: [
      'Robot: panel üstünde 1.2 m/s gidip gelir; kenar sensörü (±8.1 m) algılayınca yön değiştirir, öndeki LED kümesi turuncu yanar',
      'Gövde altında boydan boya iki siyah kıllı fırça kendi ekseninde döner; altında su püskürtme, arkasında ıslak iz',
      'Mavi kenar sensörleri: gidilen yöndeki modüllerin LED\'i yanıp söner (ön alt / arka üst)',
      'Operatör ucundaki kırmızı LED bar robotun gittiği yöne kayar',
      'Hortum: tank → ROTTEST → makara sabit; makara → operatör → robot hortumu robotu izleyerek her karede yeniden şekillenir',
      'Operatör robotla aynı hizada yürür, sarı telsiz kumandayı tutar',
      'Güvercinler holün kirişlerinden süzülüp panelin üstünden geçerken pislik bırakır; robot üstünden geçince silinir (sayaç)',
    ],
    cikarim: [
      'dokamuh.com ana sayfasındaki hero sahnesinden (scene.js / scene-worker.js) birebir aktarıldı: panel, ızgara, robot, fırçalar, LED\'ler, operatör ve DOKA logosu, kumanda, tank/ROTTEST/makara, hortum geometrisi, sprey, iz, kuş geçişleri ve tüm tick() animasyonu aynı kod.',
      'Sanal fabrikada B holüne alındı: çatı plakası + parapetler holün içinde çatı maketi / test platformu olarak duruyor; sitedeki martılar fabrika içine uygun güvercinlere çevrildi (aynı pislik → silme döngüsü).',
      'Değişenler: çatı 46×30 yerine 28×16; sitenin kendi ışıkları (sıcak gün batımı + mavi rim), sis, güneş diski, alttaki bina ve komşu binalar YOK — fabrika ışığıyla görünüyor; fare paralaksı/kamera kayması yok.',
      'Eklenenler (fabrika katmanı): başlat/durdur, yarı otomatik/manuel sürüş, ıslak/kuru/hibrit, fırça ve robot hızı, güvercin gönder, kenar sensörü testi (kapalıyken düşme alarmı), ACİL; ROTTEST ekranında sitedeki telemetri kartı.',
      'Yönelim sitedeki gibi: panelin yüksek kenarı (+Z) operatör, tank ve makara tarafında.',
      'Robot gövdesi other-machines-img-06 ve fuar fotoğrafına göre yeniden modellendi (canlı sitedeki kutu gövde yerine): SİMETRİK yamuk kesitli gri şasi (Kaan: robot simetrik; iki uzun yanda da eğik siyah bant ve alt paslanmaz ray), eğik siyah bantlar (paslanmaz ayırıcılar, "Max Pressure 50 BAR" ve "Lifting hazard" etiketleri), alt paslanmaz ray ve boydan boya siyah fırça, iki uçta boru taşıma kolu, sol uçta turuncu telsiz kumanda, kontrol kutusu (kırmızı/yeşil buton, ACİL STOP, anahtar, doka logosu, QR), kaz boynu konnektörü (hortum buraya bağlanır), tutamaklı batarya kapağı, arka üstte ve ön altta 3\'er mavi kenar sensörü, operatör ucunda kırmızı LED bar.',
      'TAHMİN (robot ölçüleri): 1.35 m boy × 0.55 m derinlik × ~0.30 m yükseklik, iki fırça Ø140 mm; donanım konumları üstten fotoğraftan oranlandı. Hortumun kaz boynu konnektörüne bağlandığı varsayıldı.',
    ],
    group: root,
    // sabitle(): robot, operatör, dinamik hortum tüpleri, ıslak iz, güvercinler/damla/lekeler hareketli;
    // tank çıkışı, ROTTEST vanaları ve makara yanakları her karede konumları OKUNAN çapalar (hortum)
    sabitHaric: [robot, operator, robotHoseTube.mesh, reelOperatorTube.mesh, trail,
      outlet, inletV, outletV, drumSideL, drumSideR, ...birds.flatMap((b) => [b.group, b.splat, b.drop])],
    update,
    kontroller,
    degerler: () => {
      const [kt] = kenarTxt();
      return [
        ['Mod', MOD_TXT[mod]],
        ['Operatör', 'MANUEL · YARI OTOMATİK'],
        ['Kenar Sensörü', kt],
        ['Yön', dir > 0 ? 'SAĞA →' : '← SOLA'],
        ['Hortum Basıncı', `${fmt(hortumBasinci(), 1)} bar`],
        ['Su Akışı', `${fmt(suAkisi(), 2)} L/dk`],
        ['Süre', sure()],
        ['Temizlenen leke', String(leke)],
        ['Robot X', `${fmt(robot.position.x, 2)} m`],
        ['Kapasite', '1800 m²/sa'],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
