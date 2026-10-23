// js/machines/pompatest.js — Pompa Test Makinesi (iki DC pompa aynı anda: yakıt + yağ).
//
// Kaan'ın tarifi (2026-10-23): makine DC gerilimle çalışan 2 pompayı (yakıt + yağ) aynı
// anda test eder; her pompanın sıcaklığı, hat basıncı, debisi ve titreşimi ölçülür.
// Operatörler sürekli makineye pompa koyar, test edilen pompalar OK / NOK paletlerine
// dizilir; testler kiosk panodaki arayüzden izlenir.
//
// Fotoğraflardan: ~3 × 1.2 × 2.2 m turkuaz kabin; altta 3 kapılı dolap, üstte polikarbon
// KAYAR KAPILI test bölmesi, sarı-siyah ikaz çerçevesi, "DİKKAT! KAYAR KAPI". İçeride sarı
// fikstür, manometreli manifoldlar, numaralı rakorlar, mavi konnektörler, yanlarda pnömatik
// silindirler (üst / ön kapak). Sol yanda 220 V pano (2 sıcaklık göstergesi) + 2 volan;
// ayrı kiosk (monitör + Delta HMI "Manuel" + klavye), arkada yüksek basınç hava kabini.

export function create(lib) {
  const {
    THREE, M, box, cyl, beam, rod, mat, lamba, levha, Ekran, Trend, kuleLambasi, acilStop, pano,
    akisBorusu, ikazDokusu, canvasTex, clamp, approach, damp, fmt, throttle, gurultu,
  } = lib;

  const g = new THREE.Group();

  // ---------------------------------------------------------------- ölçüler (TAHMİN: palet/insan ölçeğinden)
  const X0 = -1.2, X1 = 1.8, Z0 = -2.0, Z1 = -0.8;
  const XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2, W = X1 - X0, D = Z1 - Z0;
  const YT = 1.06, YU = 2.15;            // alt dolap üstü, kabin üstü
  const TEZ = YT + 0.03;                  // tezgâh yüzeyi
  const KAPI_KAY = 1.42;                  // sol kanadın kayma mesafesi
  const TAMB = 24;                        // ortam sıcaklığı (°C)
  const LIM = { T: 70, vib: 4.5, debi: 0.85 }; // kabul sınırları (TAHMİN)

  const teal = mat(0x2e9ea1, { r: 0.45, m: 0.35, key: 'pt-teal' });
  const tealAcik = mat(0x9fd4d2, { r: 0.5, m: 0.2, key: 'pt-teal2' });
  const kapakMat = new THREE.MeshStandardMaterial({
    color: 0xbcd8e4, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1, depthWrite: false,
  });

  // ---------------------------------------------------------------- kabin iskeleti
  for (const x of [X0 + 0.03, X1 - 0.03]) for (const z of [Z0 + 0.03, Z1 - 0.03]) {
    box(0.06, YU - 0.1, 0.06, teal, x, 0.1 + (YU - 0.1) / 2, z, g);
    cyl(0.045, 0.035, M.kaucuk, x, 0.05, z, g, { eksen: 'x', seg: 14 });      // tekerlek
    box(0.07, 0.03, 0.07, M.koyu, x, 0.085, z, g);
  }
  for (const y of [0.13, YT, YU - 0.03]) {
    for (const z of [Z0 + 0.03, Z1 - 0.03]) box(W, 0.06, 0.06, teal, XC, y, z, g);
    for (const x of [X0 + 0.03, X1 - 0.03]) box(0.06, 0.06, D, teal, x, y, ZC, g);
  }
  // alt dolap: 3 kapı + kilit kolları, yan / arka paneller
  for (let i = 0; i < 3; i++) {
    const x = X0 + 0.06 + 0.48 + i * 0.96;
    box(0.94, 0.86, 0.02, tealAcik, x, 0.6, Z1 + 0.005, g);
    for (const y of [0.88, 0.32]) box(0.025, 0.05, 0.02, M.siyah, x + 0.42, y, Z1 + 0.025, g);
  }
  for (const x of [X0 + 0.005, X1 - 0.005]) box(0.02, 0.86, D - 0.08, tealAcik, x, 0.6, ZC, g);
  box(W - 0.08, 0.86, 0.02, tealAcik, XC, 0.6, Z0 + 0.005, g);
  const uyari = levha(['⚠ MAKİNE KUSURLARINI', 've ARIZAYI HEMEN', 'AMİRİNE BİLDİRİN'], 0.26, 0.2,
    { bg: '#f2d200', fg: '#111', font: 54, px: 320, kenar: '#111' });
  uyari.position.set(XC, 0.86, Z1 + 0.017);
  g.add(uyari);

  // test bölmesi: tezgâh, arka iç duvar, polikarbon yanlar + tavan
  box(W - 0.06, 0.03, D - 0.06, M.koyu, XC, YT + 0.015, ZC, g);
  box(W - 0.06, YU - YT - 0.06, 0.02, teal, XC, (YT + YU) / 2, Z0 + 0.04, g);
  for (const x of [X0 + 0.005, X1 - 0.005]) box(0.008, YU - YT - 0.06, D - 0.08, M.cam, x, (YT + YU) / 2, ZC, g);
  box(W - 0.06, 0.008, D - 0.06, M.cam, XC, YU - 0.005, ZC, g);
  // kapı rayları
  box(W, 0.035, 0.08, M.alu, XC, YT + 0.03, Z1 + 0.03, g);
  box(W, 0.035, 0.08, M.alu, XC, YU - 0.04, Z1 + 0.03, g);

  // ikaz çerçevesi (üst alın + iki yan dikme) + "DİKKAT! KAYAR KAPI"
  const ikazYatay = new THREE.MeshStandardMaterial({ map: ikazDokusu([W / 0.3, 1]), roughness: 0.6 });
  const ikazDikey = new THREE.MeshStandardMaterial({ map: ikazDokusu([(YU - YT) / 0.3, 1]), roughness: 0.6 });
  box(W + 0.07, 0.11, 0.03, teal, XC, YU + 0.03, Z1 + 0.065, g);
  const serit = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.05, 0.09), ikazYatay);
  serit.position.set(XC, YU + 0.03, Z1 + 0.081);
  g.add(serit);
  for (const x of [X0, X1]) {
    box(0.07, YU - YT, 0.03, teal, x, (YT + YU) / 2, Z1 + 0.065, g);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(YU - YT - 0.02, 0.06), ikazDikey);
    p.rotation.z = Math.PI / 2;
    p.position.set(x, (YT + YU) / 2, Z1 + 0.081);
    g.add(p);
  }
  const kayarLv = levha(['DİKKAT!', 'KAYAR KAPI'], 0.32, 0.22, { bg: '#f2d200', fg: '#111', font: 92, px: 384, kenar: '#111' });
  kayarLv.position.set(0.25, YU - 0.06, Z1 + 0.09);
  g.add(kayarLv);

  // kayar kapı: iki polikarbon kanat (her biri 2 × 2 göz); sol kanat sağın önüne kayar
  function kanat(xa, xb, z) {
    const k = new THREE.Group();
    const w = xb - xa, cx = (xa + xb) / 2, h = YU - YT - 0.12, cy = YT + 0.06 + h / 2;
    box(w - 0.04, h - 0.04, 0.006, M.cam, cx, cy, z, k);
    for (const x of [xa + 0.015, cx, xb - 0.015]) box(0.03, h, 0.03, teal, x, cy, z, k);
    for (const y of [cy - h / 2 + 0.015, cy, cy + h / 2 - 0.015]) box(w, 0.03, 0.03, teal, cx, y, z, k);
    g.add(k);
    return k;
  }
  const kanatSol = kanat(X0 + 0.05, XC + 0.02, Z1 + 0.045);
  box(0.03, 0.2, 0.04, M.siyah, XC - 0.06, YT + 0.55, Z1 + 0.075, kanatSol);   // kulp
  kanat(XC - 0.02, X1 - 0.05, Z1 + 0.015);
  // kapı emniyet şalteri (sağ dikmede) + acil stop
  box(0.07, 0.14, 0.06, M.gri, X1 + 0.06, 1.55, Z1 + 0.045, g);
  const kapiLed = lamba(0x2ea043, 1.5);
  box(0.03, 0.03, 0.01, kapiLed, X1 + 0.06, 1.6, Z1 + 0.08, g);
  acilStop(g, X1 - 0.07, YT - 0.14, Z1 + 0.06, 0);

  // ---------------------------------------------------------------- fikstürler
  const FX = [new THREE.Vector3(-0.75, TEZ + 0.025, -1.42), new THREE.Vector3(-0.05, TEZ + 0.115, -1.42)];
  box(0.44, 0.025, 0.36, M.koyu, FX[0].x + 0.03, TEZ + 0.0125, FX[0].z, g);           // yakıt: çelik plaka
  for (const dz of [-0.11, 0.11]) box(0.05, 0.05, 0.04, M.celik, FX[0].x - 0.18, TEZ + 0.05, FX[0].z + dz, g);
  box(0.5, 0.04, 0.42, M.sari, FX[1].x + 0.03, TEZ + 0.02, FX[1].z, g);              // yağ: sarı fikstür
  for (const dx of [-0.17, 0.23]) box(0.06, 0.055, 0.3, M.sari, FX[1].x + dx, TEZ + 0.0675, FX[1].z, g);
  box(0.42, 0.02, 0.32, M.sari, FX[1].x + 0.03, TEZ + 0.105, FX[1].z, g);
  box(0.07, 0.42, 0.07, M.sari, FX[1].x + 0.32, TEZ + 0.25, FX[1].z - 0.13, g);
  box(0.16, 0.05, 0.12, M.sari, FX[1].x + 0.32, TEZ + 0.46, FX[1].z - 0.13, g);
  // sağda bağlantı bloğu
  box(0.3, 0.2, 0.26, M.koyu, 1.0, TEZ + 0.1, -1.42, g);
  for (const dy of [0.05, 0.13]) cyl(0.018, 0.08, M.krom, 1.17, TEZ + dy, -1.42, g, { eksen: 'x', seg: 10 });
  box(0.08, 0.04, 0.005, M.sari, 1.0, TEZ + 0.16, -1.288, g);

  // ---------------------------------------------------------------- pompa modeli (tek + palet için instanced)
  const PG = {
    govde: new THREE.CylinderGeometry(0.07, 0.07, 0.17, 18).rotateZ(Math.PI / 2).translate(-0.06, 0.075, 0),
    bas: new THREE.BoxGeometry(0.12, 0.14, 0.14).translate(0.085, 0.07, 0),
    kon: new THREE.BoxGeometry(0.05, 0.035, 0.06).translate(-0.06, 0.162, 0),
  };
  const RENK = { yakit: 0xd3d8dc, yag: 0x4b525a };
  function tekPompa(parent) {
    const p = new THREE.Group();
    const basMat = new THREE.MeshStandardMaterial({ color: RENK.yakit, roughness: 0.35, metalness: 0.65 });
    for (const [geo, m] of [[PG.govde, M.siyah], [PG.bas, basMat], [PG.kon, M.mavi]]) {
      const ms = new THREE.Mesh(geo, m);
      ms.castShadow = true; ms.receiveShadow = true;
      p.add(ms);
    }
    cyl(0.016, 0.05, M.krom, 0.085, 0.165, 0, p, { seg: 10 });            // emiş rakoru
    cyl(0.016, 0.05, M.krom, 0.17, 0.07, 0, p, { eksen: 'x', seg: 10 });   // basma rakoru
    const etiketMat = lamba(0x2ea043, 1.2);
    const etiket = box(0.07, 0.045, 0.006, etiketMat, 0.085, 0.075, 0.073, p);
    etiket.visible = false;
    parent.add(p);
    return {
      grup: p,
      tip(t) { basMat.color.setHex(RENK[t]); },
      sonuc(s) {
        etiket.visible = !!s;
        if (s) { const r = s === 'OK' ? 0x2ea043 : 0xe5302a; etiketMat.color.setHex(r); etiketMat.emissive.setHex(r); }
      },
    };
  }
  const fp = [tekPompa(g), tekPompa(g)];
  fp[0].tip('yakit'); fp[1].tip('yag');
  // pompa konnektör kabloları (bağlıyken görünür)
  const kablo = FX.map((p) => rod([p.x - 0.06, p.y + 0.18, p.z], [p.x - 0.12, 1.98, Z0 + 0.07], 0.008, M.siyah, g));

  // ---------------------------------------------------------------- hatlar (akış şeritli), manifoldlar, debimetreler
  const [P0, P1] = FX, ZA = Z0 + 0.12;
  const hat = {
    yakitBas: akisBorusu([[P0.x + 0.2, P0.y + 0.07, P0.z], [P0.x + 0.32, P0.y + 0.07, P0.z], [P0.x + 0.32, 1.86, P0.z],
      [P0.x + 0.32, 1.86, ZA], [1.3, 1.86, ZA], [1.3, TEZ, ZA]], 0.016, g, { renk: '#ffcc33' }),
    yakitEmis: akisBorusu([[P0.x + 0.085, TEZ, -1.75], [P0.x + 0.085, P0.y + 0.32, -1.75], [P0.x + 0.085, P0.y + 0.32, P0.z],
      [P0.x + 0.085, P0.y + 0.19, P0.z]], 0.016, g, { renk: '#ffcc33' }),
    yagBas: akisBorusu([[P1.x + 0.2, P1.y + 0.07, P1.z], [P1.x + 0.42, P1.y + 0.07, P1.z], [P1.x + 0.42, 1.76, P1.z],
      [P1.x + 0.42, 1.76, ZA], [1.55, 1.76, ZA], [1.55, TEZ, ZA]], 0.016, g, { renk: '#ff8a1a' }),
    yagEmis: akisBorusu([[P1.x + 0.085, TEZ, -1.75], [P1.x + 0.085, P1.y + 0.32, -1.75], [P1.x + 0.085, P1.y + 0.32, P1.z],
      [P1.x + 0.085, P1.y + 0.19, P1.z]], 0.016, g, { renk: '#ff8a1a' }),
  };
  box(0.6, 0.09, 0.07, M.siyah, 0.1, 1.86, Z0 + 0.1, g);
  box(0.45, 0.08, 0.07, M.siyah, 0.8, 1.76, Z0 + 0.1, g);
  for (const x of [1.3, 1.55]) {
    box(0.1, 0.2, 0.1, M.siyah, x, 1.45, ZA, g);                         // debimetre
    box(0.06, 0.03, 0.005, lamba(0x39ff88, 0.8), x, 1.5, ZA + 0.053, g);
  }
  // numaralı rakor etiketleri (fotoğraftaki 13, 15, 29, 30, 31)
  [['13', -0.12, 1.79], ['15', 0.3, 1.79], ['29', 0.95, 1.69], ['30', 0.62, 1.69], ['31', 0.78, 1.69]].forEach(([n, x, y]) => {
    const t = levha([n], 0.05, 0.035, { bg: '#f4f4f0', fg: '#111', font: 80, px: 96 });
    t.position.set(x, y, Z0 + 0.142);
    g.add(t);
  });
  // süs hortumları (siyah)
  rod([0.35, 1.84, Z0 + 0.1], [1.0, TEZ + 0.2, -1.42], 0.014, M.siyah, g);
  rod([-0.2, 1.86, Z0 + 0.1], [-0.55, 2.05, Z0 + 0.1], 0.012, M.siyah, g);
  rod([1.0, 1.76, Z0 + 0.1], [1.2, TEZ + 0.15, -1.5], 0.014, M.siyah, g);

  // manometreler (arka duvar): yakıt hattı, yağ hattı, hava
  const kadran = canvasTex(128, 128, (x, w) => {
    x.fillStyle = '#f5f5f2'; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 3;
    for (let i = 0; i <= 10; i++) {
      const a = (-225 + i * 27) * Math.PI / 180;
      x.beginPath();
      x.moveTo(w / 2 + Math.cos(a) * 46, w / 2 + Math.sin(a) * 46);
      x.lineTo(w / 2 + Math.cos(a) * (i % 5 ? 40 : 34), w / 2 + Math.sin(a) * (i % 5 ? 40 : 34));
      x.stroke();
    }
    x.fillStyle = '#c62828'; x.beginPath(); x.arc(w / 2, w / 2, 6, 0, Math.PI * 2); x.fill();
  });
  const kadranMat = new THREE.MeshStandardMaterial({ map: kadran, roughness: 0.4 });
  const ibreGeo = new THREE.BoxGeometry(0.004, 0.04, 0.003).translate(0, 0.02, 0);
  function gosterge(x, y, z, r, max) {
    cyl(r + 0.008, 0.03, M.krom, x, y, z, g, { eksen: 'z', seg: 24 });
    const yuz = new THREE.Mesh(new THREE.CircleGeometry(r, 24), kadranMat);
    yuz.position.set(x, y, z + 0.016);
    g.add(yuz);
    const ibre = new THREE.Mesh(ibreGeo, M.siyah);
    ibre.position.set(x, y, z + 0.019);
    g.add(ibre);
    return { ibre, set(v) { ibre.rotation.z = 2.356 - clamp(v / max, 0, 1) * 4.712; } };
  }
  const manometre = [gosterge(0.0, 1.99, Z0 + 0.075, 0.05, 10), gosterge(0.75, 1.93, Z0 + 0.075, 0.05, 16),
    gosterge(1.42, 1.99, Z0 + 0.075, 0.045, 10)];

  // ---------------------------------------------------------------- pnömatik silindirler + üst / ön kapak
  const rodGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 10).translate(0, 0.5, 0);
  function silindir(x, z) {
    cyl(0.028, 0.36, M.alu, x, TEZ + 0.18, z, g, { seg: 14 });
    const r = new THREE.Mesh(rodGeo, M.krom);
    r.position.set(x, TEZ + 0.36, z);
    r.castShadow = true;
    g.add(r);
    return r;
  }
  const silUst = silindir(X0 + 0.12, -1.4), silOn = silindir(X1 - 0.12, -0.98);
  const ustKapak = new THREE.Group();
  g.add(ustKapak);
  box(1.56, 0.012, 0.95, kapakMat, -0.36, 0, -1.42, ustKapak);
  for (const z of [-0.95, -1.89]) box(1.56, 0.025, 0.025, M.alu, -0.36, 0, z, ustKapak);
  box(0.08, 0.04, 0.08, M.alu, X0 + 0.12, 0, -1.4, ustKapak);
  const onKapak = new THREE.Group();
  g.add(onKapak);
  box(W - 0.18, 0.55, 0.006, kapakMat, XC, 0.275, -0.92, onKapak);
  for (const y of [0.012, 0.538]) box(W - 0.18, 0.025, 0.025, M.alu, XC, y, -0.92, onKapak);
  box(0.08, 0.04, 0.08, M.alu, X1 - 0.12, 0.55, -0.97, onKapak);

  // ---------------------------------------------------------------- 220 V pano (sol yan) + volanlar
  const ep = pano(g, X0 - 0.13, 1.15, -1.45, 0.62, 0.85, 0.25, -Math.PI / 2);
  const sicEkran = new Ekran(0.22, 0.065, 320);
  sicEkran.mesh.position.set(0, 0.56, 0.141);
  ep.add(sicEkran.mesh);
  box(0.24, 0.085, 0.01, M.siyah, 0, 0.56, 0.133, ep);
  const lv220 = levha(['DİKKAT!', '220 V'], 0.14, 0.15, { bg: '#f2d200', fg: '#111', font: 80, px: 256, kenar: '#111' });
  lv220.position.set(0, 0.73, 0.141);
  ep.add(lv220);
  box(0.09, 0.09, 0.02, M.sari, -0.2, 0.3, 0.14, ep);                       // ana şalter
  box(0.025, 0.07, 0.03, M.kirmizi, -0.2, 0.3, 0.16, ep);
  acilStop(ep, 0.18, 0.3, 0.17, 0);
  const kule = kuleLambasi(ep, 0.22, 0.85, 0);
  const volanlar = [0.78, 0.42].map((y) => {
    const v = new THREE.Group();
    v.position.set(X0 - 0.07, y, -1.05);
    v.rotation.y = -Math.PI / 2;
    g.add(v);
    const c = new THREE.Group();
    v.add(c);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), M.siyah);
    tor.castShadow = true;
    c.add(tor);
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3;
      rod([0, 0, 0], [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0], 0.006, M.siyah, c, 8);
    }
    cyl(0.02, 0.03, M.siyah, 0, 0, 0, c, { eksen: 'z', seg: 12 });
    cyl(0.012, 0.06, M.siyah, 0.1, 0, 0.03, c, { eksen: 'z', seg: 8 });   // kol
    return c;
  });

  // ---------------------------------------------------------------- yüksek basınç hava kabini (arka)
  const hv = new THREE.Group();
  hv.position.set(-3.45, 0, -2.15);
  g.add(hv);
  box(0.95, 0.85, 0.65, M.pano, 0, 0.45, 0, hv);
  for (const sx of [-1, 1]) box(0.02, 0.6, 0.01, M.koyu, sx * 0.01, 0.42, 0.33, hv);
  const hvUst = new THREE.Group();
  hvUst.position.set(0, 0.87, 0.3);
  hvUst.rotation.x = -1.05;
  hv.add(hvUst);
  box(0.95, 0.42, 0.03, mat(0xe6e8e6, { r: 0.5, m: 0.2, key: 'pt-hv' }), 0, 0.21, 0, hvUst);
  cyl(0.1, 0.03, M.krom, -0.2, 0.24, 0.02, hvUst, { eksen: 'z', seg: 24 });
  const hvKadran = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), kadranMat);
  hvKadran.position.set(-0.2, 0.24, 0.036);
  hvUst.add(hvKadran);
  cyl(0.04, 0.05, M.mavi, 0.22, 0.12, 0.03, hvUst, { eksen: 'z', seg: 16 });
  const hvLv = levha(['YÜKSEK BASINÇ', 'HAVA REGÜLATÖRÜ'], 0.3, 0.1, { bg: '#e6e8e6', fg: '#c62828', font: 60, px: 320 });
  hvLv.position.set(0.18, 0.32, 0.017);
  hvUst.add(hvLv);

  // ---------------------------------------------------------------- kiosk (monitör + Delta HMI + klavye)
  const KX = -2.85, KZ = -0.75, KR = -0.35;
  const kio = new THREE.Group();
  kio.position.set(KX, 0, KZ);
  kio.rotation.y = KR;
  g.add(kio);
  const kioMat = mat(0xd9dcde, { r: 0.45, m: 0.3, key: 'pt-kiosk' });
  box(0.62, 0.02, 0.5, kioMat, 0, 0.012, 0, kio);
  beam([0, 0.02, -0.12], [0, 0.55, 0.06], 0.13, 0.045, kioMat, kio);
  beam([0, 0.55, 0.06], [0, 0.99, -0.08], 0.13, 0.045, kioMat, kio);
  box(0.66, 0.02, 0.28, kioMat, 0, 1.0, 0.1, kio);
  box(0.44, 0.018, 0.14, M.siyah, -0.05, 1.02, 0.13, kio);                 // klavye
  box(0.05, 0.02, 0.08, M.siyah, 0.25, 1.02, 0.13, kio);                   // fare
  const hp = new THREE.Group();
  hp.position.set(0, 1.0, -0.03);
  hp.rotation.x = -0.42;
  kio.add(hp);
  box(0.66, 0.4, 0.03, kioMat, 0, 0.2, 0, hp);
  box(0.38, 0.3, 0.02, M.koyu, 0.04, 0.2, 0.02, hp);
  const delta = new Ekran(0.34, 0.255, 640);
  delta.mesh.position.set(0.04, 0.2, 0.032);
  hp.add(delta.mesh);
  acilStop(hp, -0.24, 0.2, 0.045, 0);
  cyl(0.02, 0.03, M.siyah, 0.27, 0.25, 0.025, hp, { eksen: 'z', seg: 12 });    // anahtar
  const mon = new THREE.Group();
  mon.position.set(0, 1.37, -0.2);
  mon.rotation.x = -0.12;
  kio.add(mon);
  box(0.68, 0.46, 0.03, kioMat, 0, 0.22, 0, mon);
  box(0.6, 0.37, 0.02, M.siyah, 0, 0.24, 0.02, mon);
  const kiosk = new Ekran(0.56, 0.325, 1200);
  kiosk.mesh.position.set(0, 0.24, 0.031);
  mon.add(kiosk.mesh);

  // ---------------------------------------------------------------- paletler: giriş (test edilecek), OK, NOK
  const PAL_Y = 0.125;
  function palet(x, z, yazi, bg) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    g.add(p);
    for (const dz of [-0.42, 0, 0.42]) box(1.2, 0.1, 0.1, M.ahsap, 0, 0.05, dz, p);
    box(1.2, 0.025, 1.0, M.ahsap, 0, 0.1125, 0, p);
    box(0.03, 0.9, 0.03, M.koyu, -0.62, 0.45, -0.52, p);
    const lv = levha([yazi], 0.5, 0.13, { bg, fg: '#fff', font: 58, px: 512 });
    lv.position.set(-0.36, 0.86, -0.505);
    p.add(lv);
    return p;
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const _c = new THREE.Color();
  function pompaSeti(parent, slotlar) {
    const kap = slotlar.length;
    const basMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.65 });
    const ms = [new THREE.InstancedMesh(PG.govde, M.siyah, kap), new THREE.InstancedMesh(PG.bas, basMat, kap),
      new THREE.InstancedMesh(PG.kon, M.mavi, kap)];
    for (let i = 0; i < kap; i++) ms[1].setColorAt(i, _c.setHex(RENK.yakit));
    ms.forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; parent.add(m); });
    return {
      ayarla(tipler) {
        const n = Math.min(tipler.length, kap);
        for (let i = 0; i < n; i++) {
          _p.set(slotlar[i][0], PAL_Y, slotlar[i][1]);
          _m4.compose(_p, _q, _s);
          for (const m of ms) m.setMatrixAt(i, _m4);
          ms[1].setColorAt(i, _c.setHex(RENK[tipler[i]]));
        }
        for (const m of ms) { m.count = n; m.instanceMatrix.needsUpdate = true; }
        ms[1].instanceColor.needsUpdate = true;
      },
    };
  }
  const izgara = (xs, zs) => { const s = []; for (const x of xs) for (const z of zs) s.push([x, z]); return s; };
  const SATIR6 = [-0.4, -0.24, -0.08, 0.08, 0.24, 0.4];
  const PAL = { giris: [2.85, -0.2], ok: [1.05, 1.05], nok: [-0.45, 1.05] };
  const palGiris = palet(...PAL.giris, 'TEST EDİLECEK', '#1f6feb');
  const palOk = palet(...PAL.ok, 'OK', '#2ea043');
  const palNok = palet(...PAL.nok, 'NOK', '#d0201b');
  const setGirisYakit = pompaSeti(palGiris, izgara([-0.42, -0.14], SATIR6));
  const setGirisYag = pompaSeti(palGiris, izgara([0.16, 0.44], SATIR6));
  const setOk = pompaSeti(palOk, izgara([-0.45, -0.15, 0.15, 0.45], SATIR6));
  const setNok = pompaSeti(palNok, izgara([-0.45, -0.15, 0.15, 0.45], [-0.3, 0, 0.3]));

  let girisYakit = 8, girisYag = 8, girisPalet = 0;
  const okListe = ['yakit', 'yag', 'yakit', 'yag', 'yakit', 'yag', 'yakit', 'yag', 'yakit'];
  const nokListe = ['yag'];
  let okPalet = 0, nokPalet = 0;
  const _yk = Array(12).fill('yakit'), _yg = Array(12).fill('yag');
  function paletleriCiz() {
    setGirisYakit.ayarla(_yk.slice(0, girisYakit));
    setGirisYag.ayarla(_yg.slice(0, girisYag));
    setOk.ayarla(okListe);
    setNok.ayarla(nokListe);
  }

  // ---------------------------------------------------------------- operatörler (ortak lib.operator, yüz +Z)
  // A: yükleme/boşaltma (sarı yelek, lacivert gömlek); B: kioskta testi izler (turuncu yelek, gri gömlek)
  const opA = lib.operator({ gomlek: 0x1a3a78 });
  const isciA = opA.group;
  g.add(isciA);
  const elP = [tekPompa(isciA), tekPompa(isciA)];
  // taşıma pozunda eller ~(±0.3, 1.0, 0.49): pompalar iki elin arasında, gövdenin önünde
  elP.forEach((e, i) => { e.grup.position.set(i ? 0.13 : -0.13, 0.95, 0.42); e.grup.rotation.y = Math.PI / 2; e.grup.visible = false; });
  const opB = lib.operator({ yelek: 0xff7a1a, gomlek: 0x6b7280 });
  const isciB = opB.group;
  kio.add(isciB);
  isciB.position.set(0.58, 0, 0.36);                 // kioskun yanında: kameradan ekranı kapatmasın
  const isciByon = Math.atan2(-0.58, -0.2);          // yüzü kiosk ekranına
  opB.poz('yan');
  opB.yuru(0, false);

  // ---------------------------------------------------------------- pompa ölçüm modeli
  let limYakit = 100, limYag = 90, testSure = 20, kisma = 50;
  const PRM = {
    yakit: { ad: 'Yakıt', lim: () => limYakit, limDef: 100, oran: 0.73, Qnom: 8.0, Pnom: 4.2, Trise: 32, vib0: 1.6 },
    yag: { ad: 'Yağ', lim: () => limYag, limDef: 90, oran: 0.86, Qnom: 14.0, Pnom: 6.0, Trise: 40, vib0: 1.9 },
  };
  const yeniSlot = (tip) => ({
    tip, P: PRM[tip], var: false, kusur: null, sonuc: null, neden: '',
    V: 0, debi: 0, debiG: 0, bas: 0, T: TAMB, vibS: 0, vib: 0, A: 0, qTop: 0, vTop: 0, n: 0, Tmax: 0,
    buf: new Float32Array(120), bi: 0,
  });
  const slotlar = [yeniSlot('yakit'), yeniSlot('yag')];
  const kfAkis = () => 1 - (kisma - 50) / 250;   // kısma arttıkça debi biraz düşer

  function olcumGuncelle(s, dt) {
    const P = s.P;
    const calis = faz === 'test' && s.var && (tf === 'rampa' || tf === 'olcum') && !acil;
    s.V = approach(s.V, calis ? P.lim() * P.oran : 0, 30 * dt);
    const sv = s.V / (P.limDef * P.oran);
    let qH = P.Qnom * sv * kfAkis();
    if (s.kusur === 'debi') qH *= 0.62;
    s.debi = damp(s.debi, qH, 2.5, dt);
    s.bas = damp(s.bas, P.Pnom * (kisma / 50) * Math.pow(s.debi / P.Qnom, 2), 3, dt);
    const rise = P.Trise * sv * sv * (0.6 + (0.4 * kisma) / 50) * (s.kusur === 'sicaklik' ? 2.1 : 1);
    s.T = damp(s.T, s.V > 1 ? TAMB + rise : TAMB, s.V > 1 ? 3 / testSure : 0.04, dt);
    const tk = s.kusur === 'titresim';
    s.vibS = damp(s.vibS, s.V > 1 ? P.vib0 * sv * (tk ? 4.2 : 1) : 0, 3, dt);
    const on = s.V > 1;
    s.vib = on ? Math.max(0, s.vibS + gurultu(0.18 * (tk ? 3 : 1))) : s.vibS;
    s.debiG = on ? s.debi * (1 + gurultu(0.006)) : s.debi;
    s.A = on ? (1.667 * s.bas * s.debi / 0.35 + 18) / s.V : 0;
  }

  // ---------------------------------------------------------------- durum
  let faz = 'test';           // bos | yuklu | test | sonuc
  let tf = 'olcum', tT = 5;   // test fazı: kapak | rampa | olcum | inis
  let testTipi = 'cift', yukluTip = 'cift';
  let otomatik = true, sanalOp = true, acil = false, kapiAlarm = false;
  let ariza = 'yok';
  let kapi = 0, kapiHedef = 0, ustK = 0, ustHedef = 0, onK = 0, onHedef = 0;
  let uyariMetin = '', uyariT = 0, basBekle = 0;
  let bugun = 5, testNo = 6, gunlukOrnek = 3712, olcumSay = 0, ornekAcc = 0;
  let saatS = 13 * 3600 + 57 * 60 + 10;
  let sonSonuc = 'Yakıt OK · Yağ OK';
  const uyar = (m) => { uyariMetin = m; uyariT = 2.4; };
  const TIP_AD = { cift: 'Çift Pompa Kabul', yakit: 'Yakıt Pompası Kabul', yag: 'Yağ Pompası Kabul' };
  const saatYaz = (s) => {
    s = Math.floor(s) % 86400;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  };
  const kodYap = () => `R-20261023${saatYaz(saatS).replace(/:/g, '')}`;
  let aktifKod = 'R-20261023135650';
  const raporlar = [
    { saat: '13:49:12', kod: 'R-20261023134912', tip: 'Çift Pompa Kabul', sure: '00:27', sonuc: 'OK' },
    { saat: '13:44:30', kod: 'R-20261023134430', tip: 'Çift Pompa Kabul', sure: '00:27', sonuc: 'NOK' },
    { saat: '13:39:51', kod: 'R-20261023133951', tip: 'Çift Pompa Kabul', sure: '00:27', sonuc: 'OK' },
    { saat: '13:35:07', kod: 'R-20261023133507', tip: 'Yakıt Pompası Kabul', sure: '00:26', sonuc: 'OK' },
  ];

  function testBaslat() {
    if (acil || kapiAlarm) { uyar('ÖNCE RESET'); return; }
    if (faz !== 'yuklu') { uyar(faz === 'bos' ? 'ÖNCE POMPALARI YÜKLE' : 'TEST ZATEN SÜRÜYOR'); return; }
    if (kapi > 0.005) { uyar('KAPI AÇIK · TEST BAŞLAMAZ'); return; }
    faz = 'test'; tf = 'kapak'; tT = 0; olcumSay = 0;
    aktifKod = kodYap();
    for (const s of slotlar) { s.qTop = 0; s.vTop = 0; s.n = 0; s.Tmax = 0; s.sonuc = null; s.neden = ''; }
    // tek seferlik arıza enjeksiyonu: titreşim → yakıt, düşük debi / aşırı sıcaklık → yağ
    if (ariza !== 'yok') {
      const hedef = ariza === 'titresim' ? slotlar[0] : slotlar[1];
      if (hedef.var) hedef.kusur = ariza;
      ariza = 'yok';
    }
  }

  function testIptal(neden) {
    if (faz !== 'test') return;
    faz = 'yuklu'; tf = '';
    otomatik = false;
    raporlar.unshift({ saat: saatYaz(saatS), kod: aktifKod, tip: TIP_AD[yukluTip], sure: '—', sonuc: 'İPTAL' });
    raporlar.length = Math.min(raporlar.length, 6);
    sonSonuc = `İptal (${neden})`;
  }

  function degerlendir() {
    const aktif = slotlar.filter((s) => s.var);
    const parca = [];
    for (const s of aktif) {
      const qOrt = s.n ? s.qTop / s.n : 0, vOrt = s.n ? s.vTop / s.n : 0;
      const qBek = s.P.Qnom * (s.P.lim() / s.P.limDef) * kfAkis();
      const neden = [];
      if (qOrt < LIM.debi * qBek) neden.push('debi düşük');
      if (s.Tmax > LIM.T) neden.push('aşırı sıcaklık');
      if (vOrt > LIM.vib) neden.push('titreşim yüksek');
      s.sonuc = neden.length ? 'NOK' : 'OK';
      s.neden = neden.join(', ');
      parca.push(`${s.P.ad} ${s.sonuc}${s.neden ? ` (${s.neden})` : ''}`);
    }
    sonSonuc = parca.join(' · ');
    const nok = aktif.some((s) => s.sonuc === 'NOK');
    faz = 'sonuc'; tf = '';
    ustHedef = 1; onHedef = 1;
    bugun++; testNo++;
    const sure = Math.round(testSure + 5);
    raporlar.unshift({ saat: saatYaz(saatS), kod: aktifKod, tip: TIP_AD[yukluTip], sure: `00:${String(sure).padStart(2, '0')}`, sonuc: nok ? 'NOK' : 'OK' });
    raporlar.length = Math.min(raporlar.length, 6);
  }

  function testGuncelle(dt) {
    tT += dt;
    if (tf === 'kapak') {
      ustHedef = 0; onHedef = 0;
      if (ustK < 0.005 && onK < 0.005) { tf = 'rampa'; tT = 0; }
    } else if (tf === 'rampa') {
      if (tT >= 3) { tf = 'olcum'; tT = 0; }
    } else if (tf === 'olcum') {
      if (tT > testSure * 0.4) {
        for (const s of slotlar) if (s.var) { s.qTop += s.debi * dt; s.vTop += s.vib * dt; s.n += dt; s.Tmax = Math.max(s.Tmax, s.T); }
      }
      ornekAcc += dt;
      if (ornekAcc >= 1) { ornekAcc -= 1; olcumSay++; gunlukOrnek += slotlar.filter((s) => s.var).length; }
      if (tT >= testSure) { tf = 'inis'; tT = 0; }
    } else if (tf === 'inis') {
      if (tT >= 2) degerlendir();
    }
  }

  // ---------------------------------------------------------------- yükle / sök / diz
  const el = [null, null];   // operatörün elindeki pompalar {tip, sonuc}
  function paletten() {
    const tipler = testTipi === 'cift' ? ['yakit', 'yag'] : [testTipi];
    tipler.forEach((t, i) => {
      if (t === 'yakit') { if (!girisYakit) { girisYakit = 12; girisPalet++; } girisYakit--; }
      else { if (!girisYag) { girisYag = 12; girisPalet++; } girisYag--; }
      el[i] = { tip: t, sonuc: null };
    });
    paletleriCiz();
  }
  function bagla() {
    for (let i = 0; i < 2; i++) {
      const e = el[i];
      if (!e) continue;
      const s = slotlar[e.tip === 'yakit' ? 0 : 1];
      s.var = true; s.sonuc = null; s.neden = '';
      s.kusur = Math.random() < 0.06 ? ['titresim', 'debi', 'sicaklik'][Math.floor(Math.random() * 3)] : null;
      s.T = TAMB + 2;
      el[i] = null;
    }
    yukluTip = testTipi;
    faz = 'yuklu';
  }
  function sok() {
    let i = 0;
    for (const s of slotlar) {
      if (!s.var) continue;
      el[i++] = { tip: s.tip, sonuc: s.sonuc || 'OK' };
      s.var = false; s.kusur = null;
    }
    faz = 'bos';
  }
  function diz(sonuc) {
    for (let i = 0; i < 2; i++) {
      if (!el[i] || el[i].sonuc !== sonuc) continue;
      const liste = sonuc === 'OK' ? okListe : nokListe;
      if (liste.length >= (sonuc === 'OK' ? 24 : 12)) {
        liste.length = 0;
        if (sonuc === 'OK') okPalet++; else nokPalet++;
      }
      liste.push(el[i].tip);
      el[i] = null;
    }
    paletleriCiz();
  }
  const kapilarAcik = () => kapi > 0.995 && ustK > 0.995 && onK > 0.995;

  // ---------------------------------------------------------------- sanal operatör (A: yükleme/boşaltma, B: kioskta izler)
  const op = { x: 0.6, z: 0.0, yon: -1.78, adimlar: [], yuruyor: false, metin: 'kioskta testi izliyor' };
  const NOKTA = {
    kapi: { x: -0.4, z: -0.3, yon: Math.PI },
    giris: { x: PAL.giris[0], z: PAL.giris[1] + 0.85, yon: Math.PI },
    ok: { x: PAL.ok[0], z: PAL.ok[1] - 0.72, yon: 0 },
    nok: { x: PAL.nok[0], z: PAL.nok[1] - 0.72, yon: 0 },
    bekle: { x: 0.6, z: 0.0, yon: -1.78 },
  };
  const yuru = (n) => ({ tip: 'yuru', x: n.x, z: n.z, son: n.yon });
  const kapiyiAc = () => ({ tip: 'is', sure: 0.5, yon: Math.PI, metin: 'kayar kapıyı açıyor',
    basla: () => { kapiHedef = 1; ustHedef = 1; onHedef = 1; }, bekle: kapilarAcik });
  const kapiyiKapat = () => ({ tip: 'is', sure: 0.5, yon: Math.PI, metin: 'kayar kapıyı kapatıyor',
    basla: () => { kapiHedef = 0; }, bekle: () => kapi < 0.005 });

  function opPlanla() {
    if (faz === 'sonuc' && ustK > 0.99 && onK > 0.99) {
      const nokVar = slotlar.some((s) => s.var && s.sonuc === 'NOK');
      const okVar = slotlar.some((s) => s.var && s.sonuc !== 'NOK');
      op.adimlar = [yuru(NOKTA.kapi), kapiyiAc(),
        { tip: 'is', sure: 2.5, yon: Math.PI, metin: 'bağlantıları söküyor', bit: sok }];
      if (okVar) op.adimlar.push(yuru(NOKTA.ok), { tip: 'is', sure: 1.2, yon: 0, metin: 'OK paletine diziyor', bit: () => diz('OK') });
      if (nokVar) op.adimlar.push(yuru(NOKTA.nok), { tip: 'is', sure: 1.2, yon: 0, metin: 'NOK paletine ayırıyor', bit: () => diz('NOK') });
      return;
    }
    if (faz === 'bos' && otomatik) {
      op.adimlar = [];
      if (!kapilarAcik()) op.adimlar.push(yuru(NOKTA.kapi), kapiyiAc());
      op.adimlar.push(yuru(NOKTA.giris),
        { tip: 'is', sure: 1.2, yon: Math.PI, metin: 'paletten pompa alıyor', bit: paletten },
        yuru(NOKTA.kapi),
        { tip: 'is', sure: 3, yon: Math.PI, metin: 'pompaları fikstüre bağlıyor', bekle: kapilarAcik, bit: bagla },
        kapiyiKapat(),
        yuru(NOKTA.bekle));
      return;
    }
    if (faz === 'yuklu' && otomatik && kapi > 0.005) { op.adimlar = [yuru(NOKTA.kapi), kapiyiKapat(), yuru(NOKTA.bekle)]; return; }
    const B = NOKTA.bekle;
    if (Math.hypot(op.x - B.x, op.z - B.z) > 0.05) op.adimlar = [yuru(B)];
  }

  function opIptal() {
    op.adimlar = [];
    for (let i = 0; i < 2; i++) {
      const e = el[i];
      if (!e) continue;
      if (e.sonuc) diz(e.sonuc);
      else { if (e.tip === 'yakit') girisYakit++; else girisYag++; el[i] = null; paletleriCiz(); }
    }
  }

  function opGuncelle(dt, tm) {
    if (!op.adimlar.length && sanalOp && !kapiAlarm) opPlanla();
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
        a._t += dt;
        op.yon = a.yon;
        op.metin = a.metin;
        if (a._t >= a.sure && (!a.bekle || a.bekle())) { op.adimlar.shift(); a.bit?.(); }
      }
    } else op.metin = sanalOp ? (faz === 'test' ? 'testi bekliyor' : 'bekliyor') : 'kapalı (yükleme/boşaltma sende)';
    // poz: pompa taşırken 'tasi', yerinde iş yaparken (kapı, bağlama, sökme, dizme) 'on', yürürken 'yan'
    const cur = op.adimlar[0];
    opA.poz(el[0] || el[1] ? 'tasi' : cur && cur.tip === 'is' ? 'on' : 'yan');
    isciA.position.set(op.x, opA.yuru(tm, op.yuruyor), op.z);
    let fark = op.yon - isciA.rotation.y;
    fark = Math.atan2(Math.sin(fark), Math.cos(fark));
    isciA.rotation.y += fark * (1 - Math.exp(-10 * dt));
  }

  // ---------------------------------------------------------------- KİOSK uygulaması (fotoğraftaki düzen)
  const FN = '"Space Grotesk", "Segoe UI", sans-serif', FMN = '"JetBrains Mono", monospace';
  const MENU = ['Ana Sayfa', 'Test Seçimi', 'Ürün Bilgisi', 'Ölçüm Seçimi', 'Canlı Test', 'Canlı İzleme',
    'Raporlar', 'PDF Önizleme', 'Hatalar', 'Ayarlar', 'I/O Debug'];
  function kioskCiz(x, W2, H2, d) {
    const yaz = (s, px, py, size, renk, hiza = 'left', kalin = 600, mono = false) => {
      x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
      x.font = `${kalin} ${size}px ${mono ? FMN : FN}`;
      x.fillText(s, px, py);
    };
    const kart = (px, py, w, h) => {
      x.fillStyle = '#161b22'; x.beginPath(); x.roundRect(px, py, w, h, 10); x.fill();
      x.strokeStyle = '#2a313b'; x.lineWidth = 1.5; x.stroke();
    };
    const rozet = (s, px, py, renk) => {
      x.font = `700 13px ${FN}`;
      const w = x.measureText(s).width + 18;
      x.fillStyle = renk; x.beginPath(); x.roundRect(px, py - 11, w, 22, 11); x.fill();
      x.fillStyle = '#0d1117'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(s, px + 9, py + 1);
      return w;
    };
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, W2, H2);
    // yan menü
    const SB = 180;
    x.fillStyle = '#11161d'; x.fillRect(0, 0, SB, H2);
    yaz('TÜRASAŞ', 22, 40, 20, '#58a6ff', 'left', 700);
    yaz('POMPA TEST SİSTEMİ', 22, 64, 11, '#8b949e', 'left', 600);
    const aktifMenu = faz === 'test' ? 'Canlı Test' : 'Ana Sayfa';
    MENU.forEach((m, i) => {
      const y = 104 + i * 42;
      if (m === aktifMenu) { x.fillStyle = '#1f3a5f'; x.beginPath(); x.roundRect(10, y - 16, SB - 20, 32, 8); x.fill(); }
      yaz(m, 30, y, 15, m === aktifMenu ? '#ffffff' : '#9aa6b2', 'left', m === aktifMenu ? 700 : 500);
    });
    // başlık + çipler + saat
    const X = SB + 18, CW = W2 - X - 16;
    yaz('TÜRASAŞ Makine Kontrol', X, 30, 22, '#e6edf3', 'left', 700);
    let cx = X + 285;
    for (const [s, r] of [['PLC 192.168.7.88', '#3fb950'], [acil ? 'ACİL STOP' : 'PLC canlı', acil ? '#f85149' : '#3fb950'], ['Hedef PC sürekli çalışma', '#d29922']]) {
      x.font = `600 13px ${FN}`;
      const w = x.measureText(s).width + 34;
      x.fillStyle = '#1b2633'; x.beginPath(); x.roundRect(cx, 18, w, 26, 13); x.fill();
      x.fillStyle = r; x.beginPath(); x.arc(cx + 13, 31, 5, 0, Math.PI * 2); x.fill();
      yaz(s, cx + 24, 31, 13, '#c9d3dc', 'left', 600);
      cx += w + 10;
    }
    yaz(`23.10.2026 ${saatYaz(saatS)}`, W2 - 18, 31, 14, '#8b949e', 'right', 500, true);
    // son test kartı
    kart(X, 58, CW, 80);
    x.fillStyle = '#1f6feb'; x.beginPath(); x.roundRect(X + 16, 74, 48, 48, 10); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(X + 34, 86); x.lineTo(X + 50, 98); x.lineTo(X + 34, 110); x.fill();
    yaz('SON TEST', X + 80, 76, 12, '#8b949e', 'left', 700);
    yaz(aktifKod, X + 80, 99, 24, '#e6edf3', 'left', 700, true);
    yaz(`${TIP_AD[yukluTip]} · ${olcumSay} ölçüm · 1000 ms`, X + 80, 123, 13, '#8b949e', 'left', 500);
    const durumR = faz === 'test' ? ['TEST SÜRÜYOR', '#d29922'] : faz === 'sonuc'
      ? (slotlar.some((s) => s.var && s.sonuc === 'NOK') ? ['BAŞARISIZ', '#f85149'] : ['BAŞARILI', '#3fb950'])
      : ['BEKLENİYOR', '#6e7681'];
    rozet(durumR[0], X + 470, 99, durumR[1]);
    if (faz === 'test') {
      const kalan = tf === 'olcum' ? Math.max(0, testSure - tT) : testSure;
      yaz(`Kalan ${fmt(kalan, 0)} s · ${tf === 'kapak' ? 'kapaklar iniyor' : tf === 'rampa' ? 'DC gerilim rampası' : tf === 'inis' ? 'gerilim iniyor' : 'ölçüm'}`,
        X + CW - 18, 99, 15, '#c9d3dc', 'right', 600);
    }
    // istatistik kartları
    const uyarilar = [];
    if (acil) uyarilar.push(['Acil durdurma aktif', '#f85149']);
    if (kapiAlarm) uyarilar.push(['Kapı açıldı · test iptal', '#f85149']);
    for (const s of slotlar) if (s.var && s.sonuc === 'NOK') uyarilar.push([`${s.P.ad} NOK · ${s.neden}`, '#d29922']);
    if (faz === 'test' && kapi > 0.005) uyarilar.push(['Kapı açık', '#f85149']);
    const SW = (CW - 36) / 4;
    [['BUGÜN TAMAMLANAN', String(bugun), 'test'], ['AKTİF UYARILAR', String(uyarilar.length), 'uyarı'],
      ['PLC ÇEVRİMİ', '1000', 'ms · stabil'], ['GÜNLÜK ÖRNEK', `${fmt(gunlukOrnek / 1000, 1)} K`, 'örnek']].forEach(([b, v, a], i) => {
      const px = X + i * (SW + 12);
      kart(px, 148, SW, 70);
      yaz(b, px + 14, 166, 11, '#8b949e', 'left', 700);
      yaz(v, px + 14, 196, 26, i === 1 && uyarilar.length ? '#f85149' : i === 3 ? '#58a6ff' : '#e6edf3', 'left', 700, true);
      x.font = `700 26px ${FMN}`;
      yaz(a, px + 22 + x.measureText(v).width, 199, 12, '#8b949e', 'left', 500);
    });
    // pompa kartları
    const PW = (CW - 12) / 2;
    slotlar.forEach((s, i) => {
      const px = X + i * (PW + 12), py = 228, ph = 222;
      const vurgu = i ? '#58a6ff' : '#f0883e';
      kart(px, py, PW, ph);
      x.fillStyle = vurgu; x.fillRect(px + 14, py + 16, 10, 10);
      yaz(`${s.P.ad} Pompası`, px + 32, py + 22, 16, '#e6edf3', 'left', 700);
      const ch = !s.var ? ['boş', '#6e7681'] : faz === 'test' ? ['test ediliyor', '#d29922']
        : s.sonuc ? [s.sonuc, s.sonuc === 'OK' ? '#3fb950' : '#f85149'] : ['bağlı', '#58a6ff'];
      rozet(ch[0], px + 180, py + 22, ch[1]);
      yaz(`ID P-0${i + 1}`, px + PW - 14, py + 22, 12, '#8b949e', 'right', 500, true);
      const alanlar = [['DEBİ', fmt(s.debiG, 2), 'L/dk'], ['DC GERİLİM', fmt(s.V, 0), 'V'], ['DC AKIM', fmt(s.A, 1), 'A'],
        ['BASINÇ', fmt(s.bas, 2), 'bar'], ['SICAKLIK', fmt(s.T, 1), '°C'], ['TİTREŞİM', fmt(s.vib, 2), 'mm/s']];
      const cw = (PW - 28) / 3;
      alanlar.forEach(([b, v, u], k) => {
        const ax = px + 14 + (k % 3) * cw, ay = py + 52 + Math.floor(k / 3) * 54;
        x.fillStyle = '#0f141a'; x.beginPath(); x.roundRect(ax, ay, cw - 8, 46, 6); x.fill();
        yaz(b, ax + 9, ay + 13, 10, '#8b949e', 'left', 700);
        const asim = (b === 'SICAKLIK' && s.T > LIM.T) || (b === 'TİTREŞİM' && s.vib > LIM.vib);
        yaz(v, ax + 9, ay + 33, 19, asim ? '#f85149' : '#e6edf3', 'left', 700, true);
        x.font = `700 19px ${FMN}`;
        yaz(u, ax + 15 + x.measureText(v).width, ay + 35, 11, '#8b949e', 'left', 500);
      });
      // mini trend (debi, son 60 s)
      const tx = px + 14, ty = py + 164, tw = PW - 28, th = 48;
      x.strokeStyle = '#222a33'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(tx, ty + th); x.lineTo(tx + tw, ty + th); x.stroke();
      const mx = s.P.Qnom * 1.3;
      x.strokeStyle = vurgu; x.lineWidth = 2; x.beginPath();
      for (let k = 0; k < 120; k++) {
        const v = s.buf[(s.bi + k) % 120];
        const qx = tx + (tw * k) / 119, qy = ty + th - (clamp(v / mx, 0, 1) * th);
        k ? x.lineTo(qx, qy) : x.moveTo(qx, qy);
      }
      x.stroke();
      yaz(`debi · 60 s`, tx + tw, ty + 4, 10, '#6e7681', 'right', 500);
    });
    // son raporlar
    const RY = 462, RW = CW * 0.62;
    kart(X, RY, RW, H2 - RY - 12);
    yaz('Son Raporlar', X + 14, RY + 20, 15, '#e6edf3', 'left', 700);
    yaz(`Bugün tamamlanan: ${bugun} test`, X + 14, RY + 40, 11, '#8b949e', 'left', 500);
    yaz('Tümünü gör →', X + RW - 14, RY + 20, 12, '#58a6ff', 'right', 600);
    const kol = [X + 14, X + 104, X + 290, X + 470, X + 540];
    ['SAAT', 'ÜRÜN KODU', 'TİP', 'SÜRE', 'DURUM'].forEach((h, k) => yaz(h, kol[k], RY + 62, 10, '#6e7681', 'left', 700));
    raporlar.slice(0, 5).forEach((r, k) => {
      const y = RY + 86 + k * 26;
      yaz(r.saat, kol[0], y, 13, '#c9d3dc', 'left', 500, true);
      yaz(r.kod, kol[1], y, 13, '#c9d3dc', 'left', 500, true);
      yaz(r.tip, kol[2], y, 13, '#c9d3dc', 'left', 500);
      yaz(r.sure, kol[3], y, 13, '#c9d3dc', 'left', 500, true);
      rozet(r.sonuc === 'OK' ? 'Başarılı' : r.sonuc === 'NOK' ? 'Başarısız' : 'İptal', kol[4], y,
        r.sonuc === 'OK' ? '#3fb950' : r.sonuc === 'NOK' ? '#f85149' : '#6e7681');
    });
    // sistem durumu + aktif uyarılar
    const SX = X + RW + 12, SWd = CW - RW - 12;
    kart(SX, RY, SWd, 92);
    yaz('Sistem Durumu', SX + 14, RY + 20, 15, '#e6edf3', 'left', 700);
    x.fillStyle = '#3fb950'; x.beginPath(); x.arc(SX + 20, RY + 48, 5, 0, Math.PI * 2); x.fill();
    yaz('PLC Bağlantısı', SX + 32, RY + 48, 13, '#c9d3dc', 'left', 600);
    yaz('1000 ms', SX + SWd - 14, RY + 48, 12, '#8b949e', 'right', 500, true);
    yaz('192.168.7.88 · Modbus TCP', SX + 32, RY + 70, 12, '#8b949e', 'left', 500, true);
    kart(SX, RY + 102, SWd, H2 - RY - 114);
    yaz('Aktif Uyarılar', SX + 14, RY + 122, 15, '#e6edf3', 'left', 700);
    if (!uyarilar.length) yaz('Aktif uyarı yok', SX + 14, RY + 150, 13, '#3fb950', 'left', 600);
    uyarilar.slice(0, 3).forEach(([s, r], k) => {
      rozet('!', SX + 14, RY + 150 + k * 26, r);
      yaz(s, SX + 44, RY + 150 + k * 26, 12, '#c9d3dc', 'left', 600);
    });
  }

  // ---------------------------------------------------------------- Delta HMI "Manuel" ekranı
  function deltaCiz(x, W2, H2) {
    const yaz = (s, px, py, size, renk, hiza = 'center', kalin = 600) => {
      x.fillStyle = renk; x.textAlign = hiza; x.textBaseline = 'middle';
      x.font = `${kalin} ${size}px ${FN}`;
      x.fillText(s, px, py);
    };
    const dugme = (s, px, py, w, h, aktif) => {
      x.fillStyle = aktif ? '#7fd17f' : '#b8c0c8'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#6b7580'; x.lineWidth = 1.5; x.strokeRect(px, py, w, h);
      yaz(s, px + w / 2, py + h / 2, 12, '#1d2125');
    };
    const hap = (s, px, py, w, iyi) => {
      x.fillStyle = iyi ? '#4fd14f' : '#f0645a'; x.fillRect(px, py, w, 20);
      yaz(s, px + w / 2, py + 10, 11, '#10331a', 'center', 600);
    };
    const kutu = (px, py, w, h, baslik) => {
      x.fillStyle = '#f4f6f8'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#c3cad1'; x.lineWidth = 1.5; x.strokeRect(px, py, w, h);
      yaz(baslik, px + w / 2, py + 14, 12, '#3a434c', 'center', 600);
    };
    x.fillStyle = '#e9edf1'; x.fillRect(0, 0, W2, H2);
    x.fillStyle = '#3c78c8'; x.fillRect(0, 0, W2, 4);
    x.font = `italic 800 34px ${FN}`; x.fillStyle = '#1c5aa6'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('TÜRASAŞ', 16, 30);
    yaz(`23/10/2026 ${saatYaz(saatS).slice(0, 5)}`, 20, 56, 11, '#4b5560', 'left', 500);
    yaz('Manuel', 330, 34, 24, '#33414e', 'center', 500);
    for (const k of [-9, 0, 9]) { x.fillStyle = '#33414e'; x.fillRect(588, 32 + k - 2, 34, 4); }
    const pompaKutu = (px, py, ad, s) => {
      kutu(px, py, 190, 190, ad);
      const calis = s.V > 1;
      dugme('Start', px + 14, py + 30, 76, 30, calis);
      dugme('Stop', px + 100, py + 30, 76, 30, !calis);
      x.fillStyle = '#c3cad1'; x.fillRect(px + 30, py + 70, 130, 24);
      yaz(`Limit  ${s.P.lim()}  Volt`, px + 95, py + 82, 12, '#1d2125');
      const gx = px + 95, gy = py + 160, r = 48;
      x.strokeStyle = '#555'; x.lineWidth = 3; x.beginPath(); x.arc(gx, gy, r, Math.PI, 2 * Math.PI); x.stroke();
      const a = Math.PI + clamp(s.V / s.P.lim(), 0, 1) * Math.PI;
      x.strokeStyle = '#c62828'; x.lineWidth = 3; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + Math.cos(a) * (r - 6), gy + Math.sin(a) * (r - 6)); x.stroke();
      yaz(`Uygulanan  ${fmt(s.V, 0)}  V`, gx, gy + 18, 11, '#33414e');
    };
    pompaKutu(14, 76, 'DC Yakıt Pompası', slotlar[0]);
    pompaKutu(14, 276, 'DC Yağ Pompası', slotlar[1]);
    const kapakKutu = (px, py, ad, k) => {
      kutu(px, py, 190, 190, ad);
      dugme('Yukarı', px + 14, py + 30, 76, 30, k > 0.99);
      dugme('Aşağı', px + 100, py + 30, 76, 30, k < 0.01);
      hap('Kapak Yukarıda', px + 30, py + 90, 130, k > 0.99);
      hap('Kapak Aşağıda', px + 30, py + 126, 130, k < 0.01);
    };
    kapakKutu(216, 76, 'Üst Kapak', ustK);
    kapakKutu(216, 276, 'Ön Kapak', onK);
    kutu(418, 76, 208, 390, 'Tank 1 Pompa');
    const tCalis = faz === 'test';
    dugme('Start', 432, 106, 84, 26, tCalis); dugme('Stop', 528, 106, 84, 26, !tCalis);
    hap('Mazot Tankı Dolu', 446, 142, 152, true);
    hap('Mazot Yedek Hat Temiz', 446, 168, 152, true);
    hap('Mazot Dönüş Temiz', 446, 194, 152, true);
    yaz('Tank 2 Pompa', 522, 232, 12, '#3a434c');
    dugme('Start', 432, 248, 84, 26, tCalis); dugme('Stop', 528, 248, 84, 26, !tCalis);
    hap('Yağ Tankı Dolu', 446, 284, 152, true);
    hap('Yağ Dönüş Temiz', 446, 310, 152, true);
    yaz('Tank 3 Pompa', 522, 348, 12, '#3a434c');
    dugme('Start', 432, 364, 84, 26, false); dugme('Stop', 528, 364, 84, 26, true);
    hap('Atık Tankı Boş', 446, 402, 152, true);
  }

  function sicCiz(x, W2, H2) {
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, W2, H2);
    [slotlar[0].T, slotlar[1].T].forEach((t, i) => {
      const px = 10 + i * 155;
      x.fillStyle = '#1a0c0c'; x.fillRect(px, 10, 140, H2 - 20);
      x.fillStyle = '#ff3b30'; x.font = `700 58px ${FMN}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(Math.round(t)), px + 70, H2 / 2 + 3);
    });
  }

  // ---------------------------------------------------------------- döngü
  const trend = new Trend([{ ad: 'Yakıt debi', renk: '#f0883e' }, { ad: 'Yağ debi', renk: '#58a6ff' }],
    { min: 0, max: 18, uzunluk: 240, periyot: 0.25 });
  const kioskZ = throttle(4), deltaZ = throttle(4), sicZ = throttle(2), bufZ = throttle(2);
  const titresim = [0, 0];

  function update(dt, tm) {
    saatS += dt;
    if (!acil) {
      kapi = approach(kapi, kapiHedef, 0.6 * dt);
      ustK = approach(ustK, ustHedef, 0.8 * dt);
      onK = approach(onK, onHedef, 0.8 * dt);
    }
    if (faz === 'test' && kapi > 0.02 && !kapiAlarm) { kapiAlarm = true; testIptal('kapı açıldı'); }
    if (faz === 'test' && !acil) testGuncelle(dt);
    for (const s of slotlar) olcumGuncelle(s, dt);
    if (sanalOp && otomatik && faz === 'yuklu' && kapi < 0.005 && !acil && !kapiAlarm) {
      basBekle += dt;
      if (basBekle > 1.2) { basBekle = 0; testBaslat(); }
    } else basBekle = 0;
    if (!acil) opGuncelle(dt, tm);
    uyariT = Math.max(0, uyariT - dt);

    // görseller: kapı, kapaklar, silindir milleri
    kanatSol.position.x = kapi * KAPI_KAY;
    const ustY = 1.5 + ustK * 0.52, onY = 1.1 + onK * 0.45;
    ustKapak.position.y = ustY;
    onKapak.position.y = onY;
    silUst.scale.y = Math.max(0.01, ustY - (TEZ + 0.36));
    silOn.scale.y = Math.max(0.01, onY + 0.55 - (TEZ + 0.36));
    kapiLed.color.setHex(kapi < 0.005 ? 0x2ea043 : 0xe5302a);
    kapiLed.emissive.copy(kapiLed.color);

    // pompalar (fikstür) + titreşim + kablolar
    slotlar.forEach((s, i) => {
      const p = fp[i].grup;
      p.visible = s.var;
      kablo[i].visible = s.var;
      fp[i].sonuc(faz === 'sonuc' && s.var ? s.sonuc : null);
      titresim[i] = s.V > 1 ? 0.0012 * (1 + s.vib) : 0;
      p.position.set(FX[i].x + gurultu(titresim[i]), FX[i].y + gurultu(titresim[i]), FX[i].z + gurultu(titresim[i]));
    });
    hat.yakitBas.akis(slotlar[0].debi * 0.08, dt); hat.yakitEmis.akis(slotlar[0].debi * 0.08, dt);
    hat.yagBas.akis(slotlar[1].debi * 0.05, dt); hat.yagEmis.akis(slotlar[1].debi * 0.05, dt);
    manometre[0].set(slotlar[0].bas); manometre[1].set(slotlar[1].bas); manometre[2].set(6.2 + gurultu(0.03));
    for (const v of volanlar) v.rotation.z = (kisma / 100) * Math.PI * 4;

    // eldeki pompalar
    el.forEach((e, i) => {
      elP[i].grup.visible = !!e;
      if (e) { elP[i].tip(e.tip); elP[i].sonuc(e.sonuc); }
    });
    isciB.rotation.y = isciByon + Math.sin(tm * 0.4) * 0.12;

    const d = durumBilgi();
    kule.set(d.seviye, tm);
    trend.ornekle(dt, [slotlar[0].var ? slotlar[0].debiG : 0, slotlar[1].var ? slotlar[1].debiG : 0]);
    if (bufZ(dt)) for (const s of slotlar) { s.buf[s.bi] = s.var ? s.debiG : 0; s.bi = (s.bi + 1) % 120; }
    if (kioskZ(dt)) kiosk.ciz((x, W2, H2) => kioskCiz(x, W2, H2, d));
    if (deltaZ(dt)) delta.ciz(deltaCiz);
    if (sicZ(dt)) sicEkran.ciz(sicCiz);
  }

  function durumBilgi() {
    if (acil) return { metin: 'ACİL STOP', seviye: 'alarm' };
    if (kapiAlarm) return { metin: 'KAPI AÇILDI · TEST İPTAL', seviye: 'alarm' };
    if (uyariT > 0) return { metin: uyariMetin, seviye: 'uyari' };
    if (faz === 'test') {
      const m = tf === 'kapak' ? 'KAPAKLAR İNİYOR' : tf === 'rampa' ? 'DC GERİLİM RAMPASI'
        : tf === 'olcum' ? `ÖLÇÜM · ${Math.ceil(testSure - tT)} s` : 'GERİLİM İNİYOR';
      return { metin: `TEST · ${m}`, seviye: 'calisiyor' };
    }
    if (faz === 'sonuc') {
      const nok = slotlar.some((s) => s.var && s.sonuc === 'NOK');
      return { metin: nok ? 'TEST BİTTİ · NOK VAR' : 'TEST BİTTİ · OK', seviye: nok ? 'uyari' : 'calisiyor' };
    }
    if (!otomatik) return { metin: 'HAZIR · TEST BAŞLAT BEKLENİYOR', seviye: 'bekliyor' };
    if (faz === 'yuklu') return { metin: 'POMPALAR BAĞLANDI · KAPI KAPANIYOR', seviye: 'calisiyor' };
    return { metin: 'POMPA YÜKLENİYOR', seviye: 'calisiyor' };
  }

  // ---------------------------------------------------------------- kontroller
  const elle = (fn) => () => { if (sanalOp) { uyar('ÖNCE SANAL OPERATÖRÜ KAPAT'); return; } fn(); };
  const kapakKomut = (fn) => () => { if (faz === 'test') { uyar('TEST SÜRÜYOR · KAPAK KİLİTLİ'); return; } fn(); };
  const kontroller = [
    { tip: 'secim', metin: 'Test tipi', secenekler: Object.entries(TIP_AD), get: () => testTipi,
      set: (v) => { testTipi = v; if (faz !== 'bos') uyar('TEST TİPİ SIRADAKİ YÜKLEMEDE'); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Test başlat', tur: 'basla', tik: () => {
        if (acil || kapiAlarm) { uyar('ÖNCE RESET'); return; }
        otomatik = true;
        if (faz === 'yuklu') { if (kapi > 0.005 && !sanalOp) uyar('KAPI AÇIK · TEST BAŞLAMAZ'); else if (kapi <= 0.005) testBaslat(); }
        else if (faz === 'bos' && !sanalOp) uyar('ÖNCE POMPALARI YÜKLE');
      } },
      { metin: 'Testi durdur', tur: 'dur', tik: () => { if (faz === 'test') testIptal('operatör'); otomatik = false; } },
    ] },
    { tip: 'kaydirici', metin: 'Test süresi', min: 10, max: 60, adim: 5, birim: 's', get: () => testSure, set: (v) => (testSure = v) },
    { tip: 'kaydirici', metin: 'DC limit · yakıt pompası', min: 60, max: 100, adim: 5, birim: 'V', get: () => limYakit, set: (v) => (limYakit = v) },
    { tip: 'kaydirici', metin: 'DC limit · yağ pompası', min: 50, max: 90, adim: 5, birim: 'V', get: () => limYag, set: (v) => (limYag = v) },
    { tip: 'kaydirici', metin: 'Kısma vanası (hat yükü)', min: 20, max: 100, adim: 5, birim: '%', get: () => kisma, set: (v) => (kisma = v) },
    { tip: 'baslik', metin: 'Operatör / kapı / kapaklar' },
    { tip: 'anahtar', metin: 'Sanal operatör (pompa koy / OK-NOK diz)', get: () => sanalOp,
      set: (v) => { sanalOp = v; if (!v) opIptal(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Pompaları yükle', tik: elle(() => {
        if (faz !== 'bos') { uyar('FİKSTÜR DOLU'); return; }
        if (!kapilarAcik()) { uyar('ÖNCE KAPIYI VE KAPAKLARI AÇ'); return; }
        paletten(); bagla();
      }) },
      { metin: 'Sök → OK/NOK paleti', tik: elle(() => {
        if (faz !== 'sonuc') { uyar('SÖKÜLECEK TEST SONUCU YOK'); return; }
        if (!kapilarAcik()) { uyar('ÖNCE KAPIYI VE KAPAKLARI AÇ'); return; }
        sok(); diz('OK'); diz('NOK');
      }) },
    ] },
    { tip: 'anahtar', metin: 'Kayar kapı açık', get: () => kapiHedef === 1, set: (v) => { kapiHedef = v ? 1 : 0; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Üst kapak ▲', tik: kapakKomut(() => (ustHedef = 1)) },
      { metin: 'Üst kapak ▼', tik: kapakKomut(() => (ustHedef = 0)) },
      { metin: 'Ön kapak ▲', tik: kapakKomut(() => (onHedef = 1)) },
      { metin: 'Ön kapak ▼', tik: kapakKomut(() => (onHedef = 0)) },
    ] },
    { tip: 'baslik', metin: 'Arıza enjeksiyonu / güvenlik' },
    { tip: 'secim', metin: 'Sıradaki teste arıza', secenekler: [['yok', 'Yok'], ['titresim', 'Aşırı titreşim (yakıt)'],
      ['debi', 'Düşük debi (yağ)'], ['sicaklik', 'Aşırı sıcaklık (yağ)']], get: () => ariza, set: (v) => (ariza = v) },
    { tip: 'butonlar', ogeler: [
      { metin: 'ACİL STOP', tur: 'acil', tik: () => { acil = true; if (faz === 'test') testIptal('acil stop'); otomatik = false; } },
      { metin: 'Reset', tik: () => {
        if (kapiAlarm && kapi > 0.005) { uyar('ÖNCE KAPIYI KAPAT'); acil = false; return; }
        acil = false; kapiAlarm = false;
      } },
    ] },
  ];

  // Açılış: iki pompa bağlı, ölçüm sürüyor (salon canlı görünsün)
  slotlar.forEach((s) => {
    s.var = true;
    s.V = s.P.lim() * s.P.oran; s.debi = s.P.Qnom; s.debiG = s.debi; s.bas = s.P.Pnom;
    s.T = TAMB + s.P.Trise * 0.45; s.vibS = s.P.vib0; s.vib = s.vibS;
    for (let k = 0; k < 120; k++) s.buf[k] = k > 100 ? s.P.Qnom : 0;
  });
  olcumSay = 5;
  paletleriCiz();
  isciA.position.set(op.x, 0, op.z);
  isciA.rotation.y = op.yon;
  isciB.rotation.y = isciByon;

  // Performans (lib.sabitle): hareket eden / görünürlüğü değişen nesneler + gizli düğümler
  // (altındaki görünür mesh'ler birleşirse görünür olur) + saydam mesh'ler (polikarbon, sıralama) birleştirilmez.
  const sabitHaric = () => {
    const h = [kanatSol, ustKapak, onKapak, silUst, silOn, ...fp.map((p) => p.grup), ...kablo,
      ...manometre.map((m) => m.ibre), ...volanlar];
    g.traverse((o) => { if (!o.visible || (o.isMesh && !Array.isArray(o.material) && o.material.transparent)) h.push(o); });
    return h;
  };

  return {
    id: 'pompatest',
    sabitHaric,
    ad: 'Pompa Test Makinesi',
    altBaslik: '2 DC pompa · Modbus TCP · kiosk',
    kisa: 'Yakıt ve yağ pompasını (DC) aynı anda test eden kabin: sıcaklık, hat basıncı, debi ve titreşim ölçülür, sonuç OK / NOK. Operatör pompaları bağlar, test bitince OK / NOK paletine dizer; testler kiosk panodaki uygulamadan izlenir.',
    proje: 'other-machines',
    ayakIzi: [8.0, 4.9],
    ayakIziMerkez: [-0.2, -0.45],
    kamera: { poz: [-3.4, 3.3, 5.4], hedef: [-0.4, 1.1, -0.8] },
    mekanizmalar: [
      'Kayar kapı (polikarbon, 2 kanat): sol kanat sağ kanadın önüne kayar; kapı açıkken test başlamaz, test sırasında açılırsa test iptal edilir',
      'Üst kapak ve ön kapak: yan pnömatik silindirlerle iner / kalkar; test başında otomatik iner, test bitince kalkar',
      'İki DC pompa (yakıt + yağ) fikstürde: test sırasında titrer; emiş ve basma hatlarında debiyle orantılı akış şeritleri',
      'Manometre ibreleri (yakıt hattı, yağ hattı, hava) ve 220 V panodaki iki sıcaklık göstergesi canlı',
      'Kısma volanları: hat yükü ayarı değişince döner (basınç ↑, debi ↓, ısınma ↑)',
      'Operatör: paletten pompa alır, kapıyı açar, bağlar, kapatır; test bitince söker, OK / NOK paletine dizer. İkinci operatör kioskta testi izler',
      'Kiosk: canlı Pompa Test Sistemi uygulaması (son test, pompa kartları, son raporlar) + Delta HMI manuel ekranı',
    ],
    cikarim: [
      'KAAN\'IN TARİFİ: iki DC pompa (yakıt + yağ) aynı anda test edilir; her pompanın sıcaklığı, hat basıncı, debisi ve titreşimi ölçülür; operatörler sürekli pompa koyar, pompalar OK / NOK paletlerine dizilir, testler kiosk panodan izlenir.',
      'Fotoğraflardan: turkuaz kabin, 3 kapılı alt dolap, polikarbon kayar kapılı test bölmesi, sarı-siyah ikaz çerçevesi + "DİKKAT! KAYAR KAPI", sarı fikstür, manometreli manifoldlar, numaralı rakorlar (13, 15, 29, 30, 31), mavi konnektörler, yan pnömatik silindirler; sol yanda 220 V pano (iki sıcaklık göstergesi, ana şalter, acil stop) ve iki volan; ayrı kiosk (monitör + Delta HMI + klavye/fare) ve arkada yüksek basınç hava kabini.',
      'Kiosk ve Delta HMI fotoğraftaki düzende yeniden çizildi: menü, son test kodu, bugün tamamlanan, PLC 192.168.7.88 Modbus TCP, yakıt/yağ pompası kartları (debi, DC gerilim/akım, basınç), son raporlar; Manuel ekranda DC limit 100 / 90 V, üst/ön kapak, tank durumları.',
      'TAHMİN: kabul sınırları (debi ≥ %85 nominal, sıcaklık ≤ 70 °C, titreşim ≤ 4.5 mm/s), nominal değerler (yakıt ~8 L/dk · 4.2 bar, yağ ~14 L/dk · 6 bar), uygulanan gerilim oranı (73 V / 77 V), rastgele NOK oranı ~%6.',
      'TAHMİN: alt dolapta mazot / yağ / atık tankları, kapakların işlevi (üst kapak = sıçrama koruması, ön kapak = iç koruyucu), kısma volanlarının hat yükü ayarı olduğu, palet yerleri ve operatör akışı. Test süresi gösterim için 20 s.',
    ],
    group: g,
    update,
    kontroller,
    degerler: () => {
      const [a, b] = slotlar;
      const sat = (s) => [
        [`${s.P.ad} · debi / basınç`, s.var ? `${fmt(s.debiG, 2)} L/dk · ${fmt(s.bas, 2)} bar` : '—'],
        [`${s.P.ad} · sıcaklık / titreşim`, s.var ? `${fmt(s.T, 1)} °C · ${fmt(s.vib, 2)} mm/s` : '—'],
        [`${s.P.ad} · gerilim / akım`, s.var ? `${fmt(s.V, 1)} V · ${fmt(s.A, 2)} A` : '—'],
      ];
      return [
        ...sat(a), ...sat(b),
        ['Son sonuç', sonSonuc],
        ['Bugün tamamlanan', `${bugun} test`],
        ['OK / NOK palet', `${okListe.length + okPalet * 24} / ${nokListe.length + nokPalet * 12} pompa`],
        ['Giriş paleti', `${girisYakit} yakıt · ${girisYag} yağ`],
        ['Operatör', op.metin],
      ];
    },
    trend,
    durum: durumBilgi,
  };
}
