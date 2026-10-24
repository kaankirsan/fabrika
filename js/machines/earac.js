// js/machines/earac.js — MAVERA · Üniversite Elektrikli Araç (TÜBİTAK Efficiency Challenge).
//
// Kaan üniversitede MAVERA takımıyla TÜBİTAK Efficiency Challenge'a katıldı (4 tekerli araç).
// Gövde takımın araç fotoğrafından: açık gri astar boyalı kabuk, burundan kuyruğa mavi şerit,
// siyah çerçeveli geniş ön cam, oval yan camlar, yukarı açılan makas kapı, çamurluk üstünde
// aynalar, ön kaputta mandallı servis kapağı, ön tamponda üçer led çizgi, arka kanat.
// Kabuk tek parça "loft": x boyunca kesit anahtarlarından örülür; cam, kapı ve kapak bölgeleri
// aynı ızgaradan ayrı mesh'lere ayrılır (kapı/kapak menteşede döner, köşe normalleri ortak).
// Ölçüler fotoğraftan tahmin (≈2.7 × 1.3 × 1.05 m); kapak altı donanım ve şasi dinamometresi temsili.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, pipe, sphere, mat, lamba, Ekran, Trend, levha, canvasTex,
    clamp, lerp, approach, easeInOut, fmt, throttle,
  } = lib;

  const g = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const CX = 0.4, CZ = -0.3, CY = 0.08;               // araç merkezi (dyno platformu üstünde)
  const RA = -0.85, FA = 0.9, IZ = 0.53, R = 0.26;    // arka / ön aks (araç-yerel x), iz yarısı, teker yarıçapı

  // ---------------------------------------------------------------- dinamometre platformu
  const gri = mat(0x5d656d, { r: 0.6, m: 0.5, key: 'ea-platform' });
  const PX0 = CX - 1.95, PX1 = CX + 1.85, PGAP0 = CX + RA - 0.32, PGAP1 = CX + RA + 0.32;
  box(PGAP0 - PX0, 0.08, 1.7, gri, (PX0 + PGAP0) / 2, 0.04, CZ, g);
  box(PX1 - PGAP1, 0.08, 1.7, gri, (PGAP1 + PX1) / 2, 0.04, CZ, g);
  box(PGAP1 - PGAP0, 0.01, 1.7, M.siyah, (PGAP0 + PGAP1) / 2, 0.005, CZ, g);   // makara çukuru
  for (const sz of [-1, 1]) box(PGAP1 - PGAP0, 0.08, 0.06, M.sari, (PGAP0 + PGAP1) / 2, 0.04, CZ + sz * 0.82, g);
  box(0.5, 0.04, 1.7, gri, PX0 - 0.25, 0.02, CZ, g).rotation.z = 0.15;      // rampa
  // makaralar: her arka tekerin altında iki makara
  const makaralar = [];
  for (const sz of [-1, 1]) for (const dx of [-0.13, 0.13]) {
    makaralar.push(cyl(0.085, 0.26, M.celik, CX + RA + dx, 0.03, CZ + sz * IZ, g, { eksen: 'z', seg: 20 }));
  }
  for (const sz of [-1, 1]) {   // fren/volan ünitesi + kayış kapağı
    box(0.42, 0.34, 0.2, mat(0x23487a, { r: 0.5, m: 0.3, key: 'ea-dyno' }), CX + RA, 0.17, CZ + sz * 1.0, g);
    cyl(0.12, 0.06, M.koyu, CX + RA, 0.2, CZ + sz * 1.12, g, { eksen: 'z', seg: 20 });
  }
  for (const sz of [-1, 1]) for (const dx of [-0.29, 0.29]) box(0.08, 0.07, 0.15, M.sari, CX + FA + dx, 0.115, CZ + sz * IZ, g);   // ön teker takozları

  // ---------------------------------------------------------------- araç (yerel: +X burun, +Z sağ yan, zemin y=0)
  const arac = new THREE.Group();
  arac.position.set(CX, CY, CZ);
  g.add(arac);

  // Kesit anahtarları [x, w, yb, yw, ysh, zc, yc, zr, yr, yt] → yarım kesit kontrol noktaları
  // (0,yb) (.8w,yb) (w,yb+.1) (w,yw) (.9w,ysh) (zc,yc) (zr,yr) (0,yt): taban, yan, omuz,
  // çamurluk tepesi / kabin yanı, kaput / tavan kenarı, orta çizgi. Kaputta zc/yc çamurluk
  // tümseği (kaput ortası biraz aşağıda), kabinde içe eğik cam yanı (tumblehome).
  const KESIT = [
    [-1.35, 0.53, 0.21, 0.34, 0.55, 0.38, 0.61, 0.22, 0.64, 0.64],
    [-1.12, 0.60, 0.17, 0.33, 0.58, 0.43, 0.66, 0.27, 0.72, 0.74],
    [-0.85, 0.64, 0.15, 0.33, 0.60, 0.47, 0.72, 0.31, 0.84, 0.87],
    [-0.55, 0.65, 0.14, 0.33, 0.60, 0.49, 0.77, 0.34, 0.95, 0.99],
    [-0.22, 0.65, 0.14, 0.33, 0.60, 0.50, 0.79, 0.36, 1.00, 1.04],
    [0.05, 0.65, 0.14, 0.33, 0.60, 0.50, 0.76, 0.36, 0.88, 0.90],
    [0.32, 0.65, 0.14, 0.33, 0.60, 0.48, 0.69, 0.28, 0.67, 0.67],
    [0.62, 0.65, 0.14, 0.33, 0.58, 0.48, 0.65, 0.25, 0.59, 0.58],
    [0.90, 0.65, 0.15, 0.32, 0.55, 0.49, 0.61, 0.25, 0.54, 0.53],
    [1.15, 0.63, 0.17, 0.31, 0.48, 0.47, 0.54, 0.24, 0.49, 0.48],
    [1.35, 0.58, 0.20, 0.30, 0.40, 0.44, 0.45, 0.22, 0.43, 0.42],
  ];
  function kesitAt(x) {   // anahtarlar arası kübik Hermite (sonlu fark eğimleri)
    let i = 0;
    while (i < KESIT.length - 2 && x > KESIT[i + 1][0]) i++;
    const A = KESIT[i], B = KESIT[i + 1], h = B[0] - A[0], t = clamp((x - A[0]) / h, 0, 1);
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const egim = (j, c) => {
      const a = KESIT[Math.max(0, j - 1)], b = KESIT[Math.min(KESIT.length - 1, j + 1)];
      return (b[c] - a[c]) / (b[0] - a[0]);
    };
    const out = [];
    for (let c = 1; c < 10; c++) out.push(h00 * A[c] + h10 * h * egim(i, c) + h01 * B[c] + h11 * h * egim(i + 1, c));
    return out;
  }
  const NH = 44, NS = 110, XMIN = -1.35, XMAX = 1.35, LT = XMAX - XMIN, NR = 2 * NH;
  const _kn = Array.from({ length: 8 }, () => new THREE.Vector3());
  const yariEgri = new THREE.CatmullRomCurve3(_kn, false, 'centripetal');
  function yariKesit(x) {   // alt ortadan tavan ortasına eşit yay aralıklı NH+1 nokta (x=z, y=y)
    const [w, yb, yw, ysh, zc, yc, zr, yr, yt] = kesitAt(x);
    [[0, yb], [0.8 * w, yb], [w, yb + 0.1], [w, yw], [0.9 * w, ysh], [zc, yc], [zr, yr], [0, yt]]
      .forEach(([z, y], i) => _kn[i].set(z, y, 0));
    yariEgri.updateArcLengths();
    return { pts: yariEgri.getSpacedPoints(NH), len: yariEgri.getLength(), ym: (yb + yt) / 2 };
  }
  // burun ve kuyruk: son ~15 cm'de kesit elips çeyreğiyle merkezine büzülür (küt, yuvarlak uç)
  const ucOlcek = (x) => {
    if (x > 1.15) { const f = (x - 1.15) / (XMAX - 1.15); return Math.sqrt(Math.max(0, 1 - f * f)); }
    if (x < -1.2) { const f = (-1.2 - x) / (-1.2 - XMIN); return Math.sqrt(Math.max(0, 1 - f * f)); }
    return 1;
  };

  // doku uzayı: u = x, v = tavan ortasından imzalı yay uzunluğu s (+ sağ yan), ikisi de metre
  const KPX = 512, SMAX = 1.7, TW = Math.ceil(LT * KPX), TH = Math.ceil(2 * SMAX * KPX);
  const P = (x, s) => [(x - XMIN) * KPX, (SMAX + s) * KPX];   // (x, s) → kanvas pikseli
  const pos = new Float32Array(NS * (NR + 1) * 3), uv = new Float32Array(NS * (NR + 1) * 2);
  const sDizi = new Float32Array(NS * (NR + 1));
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1);
    const x = XMIN + LT * (0.5 * u + 0.25 * (1 - Math.cos(Math.PI * u)));   // uçlarda sık
    const { pts, len, ym } = yariKesit(x);
    const k = ucOlcek(x);
    for (let j = 0; j <= NR; j++) {
      const sag = j <= NH, kk = sag ? j : NR - j, p = pts[kk], sg = sag ? 1 : -1;
      const n = i * (NR + 1) + j, s = sg * len * (1 - kk / NH) * k;
      pos[n * 3] = x; pos[n * 3 + 1] = ym + (p.y - ym) * k; pos[n * 3 + 2] = sg * p.x * k;
      uv[n * 2] = ((x - XMIN) * KPX) / TW; uv[n * 2 + 1] = 1 - ((SMAX + s) * KPX) / TH;
      sDizi[n] = s;
    }
  }

  // bölgeler (x, s): süper elips / eğik elips; aynı fonksiyonlar hem yüz ayırmada hem boyamada
  const se = (a, b, n) => Math.pow(Math.abs(a), n) + Math.pow(Math.abs(b), n);
  const sgn = (v) => (v < 0 ? -1 : 1);
  const WS = { x0: -0.15, x1: 0.30 };                                   // ön cam
  const wsYari = (x) => lerp(0.5, 0.37, clamp((WS.x1 - x) / (WS.x1 - WS.x0), 0, 1));
  const WSc = (WS.x0 + WS.x1) / 2, WSa = (WS.x1 - WS.x0) / 2;
  const onCam = (x, s, pay = 0) => se((x - WSc) / (WSa + pay), s / (wsYari(x) + pay), 4) < 1;
  const YC = { x: -0.24, s: 0.72, ax: 0.21, as: 0.13, egim: -0.2 };      // oval yan cam (önü yukarıda)
  const yanCam = (x, s, pay = 0) => {
    const dx = x - YC.x, ds = Math.abs(s) - (YC.s + YC.egim * dx);
    return (dx / (YC.ax + pay)) ** 2 + (ds / (YC.as + pay)) ** 2 < 1;
  };
  const KP = { x0: -0.52, x1: 0.12, s0: 0.52, s1: 1.18 };                // kapı
  const KPc = (KP.x0 + KP.x1) / 2, KPa = (KP.x1 - KP.x0) / 2, KPsc = (KP.s0 + KP.s1) / 2, KPsa = (KP.s1 - KP.s0) / 2;
  const kapiIc = (x, s, pay = 0) => se((x - KPc) / (KPa + pay), (Math.abs(s) - KPsc) / (KPsa + pay), 6) < 1;
  const KK = { x0: 0.58, x1: 1.05, s: 0.26 };                           // ön servis kapağı
  const KKc = (KK.x0 + KK.x1) / 2, KKa = (KK.x1 - KK.x0) / 2;
  const kapakIc = (x, s, pay = 0) => se((x - KKc) / (KKa + pay), s / (KK.s + pay), 6) < 1;
  // Yüz ayırma: kenarı geçen yüzler iki tarafa da girer, asıl sınırı doku maskesi (alphaTest)
  // çizer → cam, kapı, kapak ve teker davlumbazı kenarları merdivensiz. Cam yüzleri biraz taşar;
  // polygonOffset ile gövdenin arkasında kalır (yalnız maskenin kestiği yerde görünür).
  const PAY = 0.05, DAVLUMBAZ = 0.29;
  const IND = { govde: [], cam: [], kapi: [], kapiCam: [], kapak: [] }, tum = [];
  for (let i = 0; i < NS - 1; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1, q = [a, c, b, b, c, d];
    const ort = (o) => (pos[a * 3 + o] + pos[b * 3 + o] + pos[c * 3 + o] + pos[d * 3 + o]) / 4;
    const x = ort(0), s = (sDizi[a] + sDizi[b] + sDizi[c] + sDizi[d]) / 4;
    tum.push(...q);   // dış yüz dışa bakar
    const tamCam = onCam(x, s, -PAY) || yanCam(x, s, -PAY), tamKapi = s > 0 && kapiIc(x, s, -PAY);
    if (!tamCam && !tamKapi && !kapakIc(x, s, -PAY)) IND.govde.push(...q);
    if (onCam(x, s, PAY) || (s < 0 && yanCam(x, s, PAY))) IND.cam.push(...q);
    if (s > 0 && yanCam(x, s, PAY)) IND.kapiCam.push(...q);
    if (s > 0 && kapiIc(x, s, PAY) && !yanCam(x, s, -PAY)) IND.kapi.push(...q);
    if (kapakIc(x, s, PAY)) IND.kapak.push(...q);
  }
  // davlumbaz sınırı (x, s): her x'te yan duvarın daire tepesine (y = R + √(r² − dx²)) eriştiği s,
  // alt kenar tabanda |z| = 0.42 → maskede bu çokgen kesilir
  const yayS = (pts, len, k) => len * (1 - k / NH);
  function davlumbazYol(ax, sg) {
    const ust = [], alt = [], dxm = Math.sqrt(DAVLUMBAZ ** 2 - (0.14 - R) ** 2);
    for (let i = 0; i <= 40; i++) {
      const x = ax - dxm + (2 * dxm * i) / 40, yT = R + Math.sqrt(Math.max(0, DAVLUMBAZ ** 2 - (x - ax) ** 2));
      const { pts, len } = yariKesit(x);
      let kb = 0;
      while (kb < NH && pts[kb].x < 0.42) kb++;
      let kt = kb;
      while (kt < NH && pts[kt + 1].x > 0.42 && pts[kt + 1].y < yT) kt++;
      const p0 = pts[kt], p1 = pts[Math.min(NH, kt + 1)];
      const f = p1.y > p0.y ? clamp((yT - p0.y) / (p1.y - p0.y), 0, 1) : 0;
      ust.push([x, sg * yayS(pts, len, kt + (p1.x > 0.42 ? f : 0))]);
      alt.push([x, sg * yayS(pts, len, kb)]);
    }
    return [...ust, ...alt.reverse()];
  }
  const tamGeo = new THREE.BufferGeometry();
  tamGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tamGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tamGeo.setIndex(tum);
  tamGeo.computeVertexNormals();
  const parcaGeo = (ind) => {   // aynı köşe dizileri, farklı indeks (dikişte normaller ortak)
    const gg = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) gg.setAttribute(k, tamGeo.attributes[k]);
    gg.setIndex(ind);
    return gg;
  };

  // ---------------------------------------------------------------- gövde dokusu (astar gri, şerit, çerçeveler)
  const sePts = (xc, ax, sFn, n, N = 140) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      const x = xc + ax * sgn(c) * Math.pow(Math.abs(c), 2 / n);
      out.push([x, sFn(x, sgn(sn) * Math.pow(Math.abs(sn), 2 / n))]);
    }
    return out;
  };
  const onCamYol = (pay) => sePts(WSc, WSa + pay, (x, k) => k * (wsYari(x) + pay), 4);
  const kapiYol = (sg, pay) => sePts(KPc, KPa + pay, (x, k) => sg * (KPsc + k * (KPsa + pay)), 6);
  const kapakYol = (pay) => sePts(KKc, KKa + pay, (x, k) => k * (KK.s + pay), 6);
  const yanCamYol = (sg, pay) => {
    const out = [];
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2, dx = (YC.ax + pay) * Math.cos(t);
      out.push([YC.x + dx, sg * (YC.s + YC.egim * dx + (YC.as + pay) * Math.sin(t))]);
    }
    return out;
  };
  const yolCiz = (x, pts, k = 1) => {
    x.beginPath();
    pts.forEach(([px, ps], i) => { const [cx, cy] = P(px, ps); if (i) x.lineTo(cx * k, cy * k); else x.moveTo(cx * k, cy * k); });
    x.closePath();
  };
  const govdeTex = canvasTex(TW, TH, (x) => {
    const yol = (pts) => yolCiz(x, pts);
    x.fillStyle = '#b3b8bd'; x.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 240; i++) {   // mat astarın hafif ton dalgası
      x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(80,88,96,0.03)';
      x.beginPath(); x.arc(Math.random() * TW, Math.random() * TH, 25 + Math.random() * 90, 0, Math.PI * 2); x.fill();
    }
    // servis kapağı: açık panel + derz + mandallar
    x.fillStyle = '#e6e8eb'; yol(kapakYol(0)); x.fill();
    x.fillStyle = '#1d3f9e'; x.fillRect(0, (SMAX - 0.065) * KPX, TW, 0.13 * KPX);   // mavi şerit (burundan kuyruğa)
    x.save();   // MAVERA logosu: önden okunur (harf üstü ön cama bakar)
    const [lx, ly] = P(0.8, 0);
    x.translate(lx, ly); x.rotate(-Math.PI / 2);
    x.fillStyle = '#e6e8eb'; x.fillRect(-0.2 * KPX, -0.125 * KPX, 0.4 * KPX, 0.2 * KPX);
    x.fillStyle = '#1b2f6e';
    x.beginPath();
    x.moveTo(-0.17 * KPX, -0.025 * KPX); x.lineTo(0, -0.11 * KPX); x.lineTo(0.17 * KPX, -0.025 * KPX);
    x.lineTo(0.13 * KPX, -0.025 * KPX); x.lineTo(0, -0.08 * KPX); x.lineTo(-0.13 * KPX, -0.025 * KPX);
    x.closePath(); x.fill();
    x.font = `700 ${Math.round(0.068 * KPX)}px "Space Grotesk", "Segoe UI", sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('MAVERA', 0, 0.025 * KPX);
    x.restore();
    x.strokeStyle = '#41464d'; x.lineWidth = 0.007 * KPX; yol(kapakYol(0)); x.stroke();
    x.fillStyle = '#5a6068';
    for (const s of [-0.12, 0.12]) { const [cx, cy] = P(1.035, s); x.fillRect(cx - 0.018 * KPX, cy - 0.012 * KPX, 0.036 * KPX, 0.024 * KPX); }
    for (const s of [-0.06, 0.06]) { const [cx, cy] = P(0.6, s); x.beginPath(); x.arc(cx, cy, 0.007 * KPX, 0, Math.PI * 2); x.fill(); }
    // ön cam ve yan cam çerçeveleri, kapı derzleri (iki yan)
    x.fillStyle = '#0d0f12'; yol(onCamYol(0.045)); x.fill();
    for (const sg of [1, -1]) {
      x.fillStyle = '#0d0f12'; yol(yanCamYol(sg, 0.035)); x.fill();
      x.strokeStyle = '#3c4148'; x.lineWidth = 0.006 * KPX; yol(kapiYol(sg, 0)); x.stroke();
    }
    // kapıda takım adı: sağda düz, solda 180° (her iki yandan soldan sağa okunur)
    for (const sg of [1, -1]) {
      x.save();
      const [tx, ty] = P(-0.2, sg * 0.97);
      x.translate(tx, ty); if (sg < 0) x.rotate(Math.PI);
      x.fillStyle = '#1b2f6e'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${Math.round(0.07 * KPX)}px "Space Grotesk", "Segoe UI", sans-serif`;
      x.fillText('MAVERA', 0, 0);
      x.font = `600 ${Math.round(0.024 * KPX)}px "Space Grotesk", "Segoe UI", sans-serif`;
      x.fillText('TÜBİTAK EFFICIENCY CHALLENGE', 0, 0.06 * KPX);
      x.restore();
    }
  });
  // maskeler (yarım çözünürlük; beyaz = görünür): gövde camları/kapıyı/kapağı keser, kapı ve kapak yalnız kendini tutar
  const MK = 0.5, MW = Math.round(TW * MK), MH = Math.round(TH * MK);
  const maske = (zemin, ciz) => canvasTex(MW, MH, (x) => { x.fillStyle = zemin; x.fillRect(0, 0, MW, MH); ciz(x, (pts, renk) => { x.fillStyle = renk; yolCiz(x, pts, MK); x.fill(); }); }, { srgb: false });
  const mGovde = maske('#fff', (x, dol) => { for (const ax of [FA, RA]) for (const sg of [1, -1]) dol(davlumbazYol(ax, sg), '#000'); dol(onCamYol(0), '#000'); dol(yanCamYol(1, 0), '#000'); dol(yanCamYol(-1, 0), '#000'); dol(kapiYol(1, 0), '#000'); dol(kapakYol(0), '#000'); });
  const mKapi = maske('#000', (x, dol) => { dol(kapiYol(1, 0), '#fff'); dol(yanCamYol(1, 0), '#000'); });
  const mKapak = maske('#000', (x, dol) => dol(kapakYol(0), '#fff'));
  const disMat = (alphaMap) => lib.detayEkle(new THREE.MeshStandardMaterial({ map: govdeTex, alphaMap, alphaTest: 0.5, roughness: 0.46, metalness: 0.04 }), 'boya');
  const icMatY = (alphaMap) => new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.9, metalness: 0, side: THREE.BackSide, alphaMap, alphaTest: 0.5 });
  const camMat = new THREE.MeshStandardMaterial({
    color: 0x16202a, roughness: 0.05, metalness: 0.45, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4,
  });
  const yuzeyMesh = (ind, m, parent) => {
    const o = new THREE.Mesh(parcaGeo(ind), m);
    o.castShadow = m !== camMat; o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  yuzeyMesh(IND.govde, disMat(mGovde), arac);
  yuzeyMesh(IND.govde, icMatY(mGovde), arac);   // kabuğun içi (kapı/kapak açılınca, camdan bakınca koyu)
  yuzeyMesh(IND.cam, camMat, arac);
  // makas kapı: menteşe kapının ön alt köşesinde; önce hafif dışa döner, sonra yukarı kalkar
  const KAPI_M = V(0.1, 0.55, 0.6);
  const kapiPivot = new THREE.Group(); kapiPivot.position.copy(KAPI_M); arac.add(kapiPivot);
  const kapiKol = new THREE.Group(); kapiPivot.add(kapiKol);
  const kapiIcG = new THREE.Group(); kapiIcG.position.copy(KAPI_M).negate(); kapiKol.add(kapiIcG);
  yuzeyMesh(IND.kapi, disMat(mKapi), kapiIcG); yuzeyMesh(IND.kapi, icMatY(mKapi), kapiIcG); yuzeyMesh(IND.kapiCam, camMat, kapiIcG);
  // ön servis kapağı: menteşe ön cam tarafında, burun tarafı kalkar
  const KAPAK_M = V(KK.x0, 0.6, 0);
  const kapakPivot = new THREE.Group(); kapakPivot.position.copy(KAPAK_M); arac.add(kapakPivot);
  const kapakIcG = new THREE.Group(); kapakIcG.position.copy(KAPAK_M).negate(); kapakPivot.add(kapakIcG);
  yuzeyMesh(IND.kapak, disMat(mKapak), kapakIcG); yuzeyMesh(IND.kapak, icMatY(mKapak), kapakIcG);

  // yüzeye oturan ekler için ışın (kurulumda bir kez)
  const _rc = new THREE.Raycaster(), _rm = new THREE.Mesh(tamGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const yuzey = (o, d) => {
    _rc.set(o, d.normalize());
    const h = _rc.intersectObject(_rm)[0];
    return h ? { p: h.point.clone(), n: h.face.normal.clone() } : null;
  };
  const govdeDuz = mat(0xb3b8bd, { r: 0.46, m: 0.04, key: 'ea-govde' });
  const cizgi = (pts, r, m) => {
    if (pts.length < 2) return;
    const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, r, 6), m);
    arac.add(o);
  };
  // ön tampon: iki yanda üçer led çizgi; arkada stop lambaları
  const ledOn = lamba(0xeef3ff, 0.3), ledArka = lamba(0xff2a1f, 0.3);
  for (const sg of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const h = yuzey(V(3, 0.25 + k * 0.034, sg * (0.13 + i * 0.046 - k * 0.012)), V(-1, 0, 0));
        if (h) pts.push(h.p.addScaledVector(h.n, 0.004));
      }
      cizgi(pts, 0.0055, ledOn);
    }
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const h = yuzey(V(-3, 0.52, sg * (0.16 + i * 0.045)), V(1, 0, 0));
      if (h) pts.push(h.p.addScaledVector(h.n, 0.004));
    }
    cizgi(pts, 0.011, ledArka);
  }
  // aynalar (çamurluk üstünde, ön cam dibinde)
  const aynaCam = mat(0x2a3440, { r: 0.05, m: 0.9, key: 'ea-ayna' });
  for (const sg of [1, -1]) {
    const h = yuzey(V(0.38, 2, sg * 0.5), V(0, -1, 0));
    if (!h) continue;
    const b = h.p.clone().add(V(-0.03, 0.08, sg * 0.09));
    rod(h.p, b, 0.012, govdeDuz, arac, 8);
    sphere(0.05, govdeDuz, b.x - 0.01, b.y + 0.02, b.z + sg * 0.04, arac, 16).scale.set(0.75, 0.95, 1.6);
    box(0.004, 0.075, 0.13, aynaCam, b.x - 0.048, b.y + 0.02, b.z + sg * 0.04, arac);
  }
  // arka kanat (beyaz, ortada mavi şerit)
  {
    const hs = [-1, 1].map((sg) => yuzey(V(-1.18, 2, sg * 0.3), V(0, -1, 0)));
    if (hs[0] && hs[1]) {
      const y = Math.max(hs[0].p.y, hs[1].p.y) + 0.13;
      for (const h of hs) rod(h.p, V(h.p.x - 0.02, y, h.p.z), 0.012, M.koyu, arac, 8);
      const kanat = box(0.2, 0.014, 1.0, M.beyaz, -1.22, y + 0.008, 0, arac); kanat.rotation.z = 0.08;
      const serit = box(0.2, 0.004, 0.13, mat(0x1d3f9e, { r: 0.5, key: 'ea-serit' }), -1.22, y + 0.017, 0, arac); serit.rotation.z = 0.08;
    }
  }
  // ön camda küçük Türk bayrağı çıkartması (sürücünün sağ üstü)
  {
    const h = yuzey(V(-0.08, 2, 0.28), V(0, -1, 0));
    if (h) {
      const bayrak = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), new THREE.MeshStandardMaterial({
        roughness: 0.6, map: canvasTex(96, 64, (x, w, hh) => {
          x.fillStyle = '#e30a17'; x.fillRect(0, 0, w, hh);
          x.fillStyle = '#fff'; x.beginPath(); x.arc(w * 0.38, hh / 2, hh * 0.25, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#e30a17'; x.beginPath(); x.arc(w * 0.42, hh / 2, hh * 0.2, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#fff'; x.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? hh * 0.05 : hh * 0.12;
            x.lineTo(w * 0.6 + Math.cos(a) * r, hh / 2 + Math.sin(a) * r);
          }
          x.closePath(); x.fill();
        }),
      }));
      bayrak.position.copy(h.p).addScaledVector(h.n, -0.006);
      bayrak.lookAt(h.p.clone().add(h.n));
      arac.add(bayrak);
    }
  }
  // dışarıdan erişilen acil durdurma (sağ yanda, kapının arkasında)
  {
    const h = yuzey(V(-0.66, 0.6, 2), V(0, 0, -1));
    if (h) lib.acilStop(arac, h.p.x, h.p.y, h.p.z + 0.035, 0);
  }

  // ---------------------------------------------------------------- iç donanım (camdan, kapıdan ve kapaktan görünür)
  const siyahKoltuk = mat(0x17181a, { r: 0.8, key: 'ea-koltuk' });
  box(0.42, 0.06, 0.42, siyahKoltuk, -0.3, 0.22, 0, arac).rotation.z = -0.05;    // yarış koltuğu
  box(0.06, 0.58, 0.44, siyahKoltuk, -0.52, 0.5, 0, arac).rotation.z = 0.36;      // yatık sırtlık
  for (const sg of [1, -1]) {
    box(0.4, 0.1, 0.05, siyahKoltuk, -0.32, 0.28, sg * 0.21, arac);
    box(0.08, 0.45, 0.06, siyahKoltuk, -0.5, 0.52, sg * 0.21, arac).rotation.z = 0.36;
  }
  for (const sg of [1, -1]) {   // alüminyum devrilme kafesi: arka çember + ön çapraz boru
    rod(V(-0.66, 0.16, sg * 0.4), V(-0.66, 0.84, sg * 0.3), 0.016, M.alu, arac, 10);
    rod(V(0.08, 0.16, sg * 0.4), V(0.05, 0.72, sg * 0.38), 0.014, M.alu, arac, 10);
    rod(V(-0.66, 0.84, sg * 0.3), V(0.05, 0.72, sg * 0.38), 0.013, M.alu, arac, 10);
    rod(V(-0.66, 0.16, sg * 0.4), V(0.9, 0.16, sg * 0.3), 0.016, M.alu, arac, 10);   // taban rayı
  }
  rod(V(-0.66, 0.85, -0.3), V(-0.66, 0.85, 0.3), 0.016, M.alu, arac, 10);
  rod(V(0.05, 0.72, -0.38), V(0.05, 0.72, 0.38), 0.014, M.alu, arac, 10);
  box(0.12, 0.08, 0.7, M.koyu, 0.2, 0.56, 0, arac);                               // gösterge paneli
  cyl(0.012, 0.3, M.koyu, 0.08, 0.57, 0, arac, { eksen: 'x', seg: 8 }).rotation.z = Math.PI / 2 - 0.5;
  const dir = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 24), M.siyah);
  dir.position.set(-0.04, 0.62, 0); dir.rotation.y = Math.PI / 2; dir.rotation.x = 0.55; arac.add(dir);
  for (const sg of [1, -1]) box(0.03, 0.08, 0.05, M.koyu, 0.62, 0.24, sg * 0.07, arac);   // pedallar
  const dash = new Ekran(0.13, 0.075, 160);
  dash.mesh.position.set(0.135, 0.62, 0); dash.mesh.rotation.set(0, -Math.PI / 2, 0); dash.mesh.rotateX(-0.35);
  arac.add(dash.mesh);
  // kapak altı: pil paketi (turuncu HV kapak), BMS kartı, motor sürücü, HV kabloları
  const pil = mat(0x2a2e33, { r: 0.6, m: 0.2, key: 'ea-pil' });
  box(0.38, 0.15, 0.32, pil, 0.86, 0.3, 0, arac);
  box(0.38, 0.012, 0.32, mat(0xef7d00, { r: 0.6, key: 'ea-hv' }), 0.86, 0.381, 0, arac);
  box(0.16, 0.025, 0.11, mat(0x1f7a3a, { r: 0.5, key: 'ea-bms' }), 0.84, 0.4, 0.07, arac);
  for (let i = 0; i < 4; i++) box(0.02, 0.012, 0.02, M.koyu, 0.79 + i * 0.03, 0.418, 0.07, arac);
  box(0.2, 0.06, 0.13, M.alu, 0.66, 0.27, -0.2, arac);    // motor sürücü (kanatlı)
  for (let i = -2; i <= 2; i++) box(0.2, 0.018, 0.005, M.alu, 0.66, 0.308, -0.2 + i * 0.022, arac);
  const hv = mat(0xff6a00, { r: 0.55, key: 'ea-hvkablo' });
  pipe([V(0.68, 0.3, 0.16), V(0.5, 0.2, 0.3), V(-0.2, 0.18, 0.36), V(-0.7, 0.2, 0.4), V(RA + 0.1, R, 0.44)], 0.011, hv, arac);
  pipe([V(0.7, 0.27, -0.13), V(0.75, 0.3, -0.02)], 0.009, hv, arac);
  box(0.1, 0.05, 0.08, M.siyah, -1.0, 0.24, -0.12, arac);   // telemetri modülü + anten
  rod(V(-1.0, 0.27, -0.12), V(-1.0, 0.5, -0.12), 0.003, M.koyu, arac, 5);

  // tekerler: siyah lastik, gümüş çok kollu jant; arka sağda göbek motoru
  const gLas = new THREE.LatheGeometry([[0.16, -0.062], [0.232, -0.066], [0.254, -0.05], [0.26, 0], [0.254, 0.05], [0.232, 0.066], [0.16, 0.062]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 36);
  gLas.rotateX(Math.PI / 2);
  const jant = mat(0xd5d9dd, { r: 0.28, m: 0.85, key: 'ea-jant' });
  function teker(motorlu, sg) {
    const w = new THREE.Group();
    const las = new THREE.Mesh(gLas, M.kaucuk); las.castShadow = true; w.add(las);
    cyl(0.158, 0.11, jant, 0, 0, 0, w, { eksen: 'z', seg: 28, acik: true });
    cyl(0.035, 0.12, jant, 0, 0, 0, w, { eksen: 'z', seg: 12 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const k = box(0.12, 0.018, 0.012, jant, Math.cos(a) * 0.095, Math.sin(a) * 0.095, sg * 0.045, w);
      k.rotation.z = a;
    }
    if (motorlu) { cyl(0.1, 0.075, M.koyu, 0, 0, 0, w, { eksen: 'z', seg: 26 }); cyl(0.06, 0.08, M.alu, 0, 0, 0, w, { eksen: 'z', seg: 18 }); }
    box(0.03, 0.02, 0.005, M.koyu, 0.13, 0, sg * 0.056, w);   // dönüş görünsün diye jant işareti
    lib.sabitle(w);
    return w;
  }
  // davlumbaz içi (koyu yarım silindir: kesilen kabuğun ardı boş görünmesin)
  const gIc = new THREE.CylinderGeometry(DAVLUMBAZ + 0.005, DAVLUMBAZ + 0.005, 0.2, 22, 1, true, -Math.PI / 2, Math.PI);
  gIc.rotateX(-Math.PI / 2);
  const icKoyu = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.95, side: THREE.DoubleSide });
  for (const ax of [FA, RA]) for (const sg of [1, -1]) { const o = new THREE.Mesh(gIc, icKoyu); o.position.set(ax, R, sg * 0.5); arac.add(o); }
  const tekerler = [];
  for (const [x, z, mt] of [[FA, IZ, false], [FA, -IZ, false], [RA, IZ, true], [RA, -IZ, false]]) {
    const w = teker(mt, Math.sign(z)); w.position.set(x, R, z); arac.add(w); tekerler.push({ w, arka: x < 0 });
  }

  // ---------------------------------------------------------------- soğutma fanı, kontrol masası, tabela
  const FX = CX + 2.35;
  const fan = new THREE.Group(); fan.position.set(FX, 0.6, CZ); g.add(fan);
  const fanCerceve = new THREE.Group(); g.add(fanCerceve);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), M.koyu);
  halka.position.set(FX, 0.6, CZ); halka.rotation.y = Math.PI / 2; fanCerceve.add(halka);
  for (const s of [-1, 1]) rod(V(FX, 0.0, CZ + s * 0.35), V(FX, 0.6, CZ + s * 0.2), 0.02, M.koyu, fanCerceve, 8);
  box(0.3, 0.04, 0.9, M.koyu, FX, 0.02, CZ, fanCerceve);
  cyl(0.08, 0.14, M.koyu, FX + 0.06, 0.6, CZ, fanCerceve, { eksen: 'x', seg: 16 });
  for (let i = 0; i < 5; i++) {
    const k = box(0.02, 0.36, 0.11, mat(0x8fa3b5, { r: 0.4, m: 0.6, key: 'ea-fan' }), 0, 0.2, 0, fan);
    const p = new THREE.Group(); p.rotation.x = (i / 5) * Math.PI * 2; p.add(k); fan.add(p); k.rotation.y = 0.35;
  }
  lib.sabitle(fan);
  const DX = -3.3, DZ = 1.5;   // dyno kontrol masası
  box(1.4, 0.04, 0.7, M.siyah, DX, 0.76, DZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.74, 0.04, M.koyu, DX + sx * 0.65, 0.37, DZ + sz * 0.3, g);
  box(0.66, 0.42, 0.03, M.siyah, DX, 1.12, DZ - 0.25, g);
  const ekran = new Ekran(0.62, 0.38, 512);
  ekran.mesh.position.set(DX, 1.12, DZ - 0.234);
  g.add(ekran.mesh);
  box(0.36, 0.02, 0.24, M.koyu, DX + 0.45, 0.79, DZ + 0.05, g);   // laptop
  const dynoPano = new THREE.Group(); g.add(dynoPano);
  lib.pano(dynoPano, -3.6, 0, -1.5, 0.8, 1.6, 0.4, Math.PI / 2);
  const kule = lib.kuleLambasi(g, -3.6, 1.6, -1.5);
  const tabela = levha(['MAVERA · ELEKTRİKLİ ARAÇ', 'TÜBİTAK Efficiency Challenge · üniversite takımı · şasi dinamometresi'], 3.6, 0.5, { bg: '#17324f', font: 62, px: 1300 });
  tabela.position.set(CX, 2.6, CZ - 1.9);
  g.add(tabela);
  for (const s of [-1, 1]) rod(V(CX + s * 1.6, 0, CZ - 1.9), V(CX + s * 1.6, 2.85, CZ - 1.9), 0.025, M.koyu, g, 8);
  // takım dolabı + şarj arabası
  box(0.7, 0.9, 0.45, M.kirmizi, 3.5, 0.45, -2.0, g);
  for (let i = 0; i < 4; i++) box(0.66, 0.012, 0.01, M.koyu, 3.5, 0.2 + i * 0.2, -1.77, g);
  box(0.5, 0.7, 0.4, M.pano, -2.0, 0.35, -2.0, g);
  box(0.3, 0.12, 0.02, mat(0x0d2a3a, { r: 0.3, key: 'ea-sarjek' }), -2.0, 0.6, -1.79, g);

  // ---------------------------------------------------------------- operatör (takım mühendisi)
  const op = lib.operator({ logo: false, yelek: 0x2a6fdb, gomlek: 0x1b1f27 });
  g.add(op.group);
  const MASA = [DX, DZ + 0.62];
  const opS = { x: MASA[0], z: MASA[1], yon: Math.PI, hx: MASA[0], hz: MASA[1], hyon: Math.PI, poz: 'on', rota: [] };
  const opHedef = (x, z, yon, poz = 'on') => { opS.hx = x; opS.hz = z; opS.hyon = yon; opS.poz = poz; };
  const opRota = (noktalar, yon, poz = 'on') => {   // ara noktalar sırayla, sonuncusu hedef
    opS.rota = noktalar.slice(0, -1).map((n) => n.slice());
    const [x, z] = noktalar[noktalar.length - 1];
    opHedef(x, z, yon, poz);
  };
  const opVardi = () => !opS.rota.length && Math.hypot(opS.hx - opS.x, opS.hz - opS.z) < 0.03;
  function opGuncelle(dt, t) {
    let tx = opS.hx, tz = opS.hz;
    if (opS.rota.length) {
      [tx, tz] = opS.rota[0];
      if (Math.hypot(tx - opS.x, tz - opS.z) < 0.06) { opS.rota.shift(); [tx, tz] = opS.rota.length ? opS.rota[0] : [opS.hx, opS.hz]; }
    }
    const dx = tx - opS.x, dz = tz - opS.z, d = Math.hypot(dx, dz);
    const yuruyor = d > 0.02;
    let hy = opS.hyon;
    if (yuruyor) { const s = Math.min(d, 1.25 * dt); opS.x += (dx / d) * s; opS.z += (dz / d) * s; hy = Math.atan2(dx, dz); }
    let f = hy - opS.yon; f = Math.atan2(Math.sin(f), Math.cos(f));
    opS.yon += f * (1 - Math.exp(-10 * dt));
    op.poz(yuruyor ? 'yan' : opS.poz);
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }

  // ---------------------------------------------------------------- dyno / araç modeli
  // m = 150 kg (araç + sürücü), Crr 0.0055, kapalı gövde CdA ≈ 0.30 m², motor+sürücü verimi %88, rejen %60.
  const KTL = 150, CRR = 0.0055, CDA = 0.3, ETA = 0.88;
  const PIL_WH = 1024;   // 16S LiFePO4 51.2 V 20 Ah (temsili)
  const PROF = { sabit: 'Sabit hız', parkur: 'Yarış parkuru döngüsü', rejen: 'Rejeneratif fren testi' };
  let profil = 'parkur', test = false, hedefHiz = 30, fanAcik = true, kill = false, demo = true, demoT = 0, demoAdim = 0;
  let v = 0, a = 0, pMek = 0, pEl = 0, soc = 0.9, sicaklik = 27, profT = 0, mesafe = 0, enerji = 0;
  let volt = 52, akim = 0, rpm = 0, tork = 0;
  const parkurHiz = (t) => {   // 40 s döngü (km/h)
    const T = t % 40;
    if (T < 8) return 35 * (T / 8);
    if (T < 18) return 35;
    if (T < 22) return 35 - 17 * ((T - 18) / 4);
    if (T < 26) return 18;
    if (T < 32) return 18 + 14 * ((T - 26) / 6);
    if (T < 36) return 32;
    return 32 * (1 - (T - 36) / 4);
  };
  const rejenHiz = (t) => { const T = t % 14; return T < 5 ? 35 * (T / 5) : T < 7 ? 35 : 35 - 30 * ((T - 7) / 7); };

  function fizik(dt) {
    const hedef = kill || !test ? 0 : profil === 'sabit' ? hedefHiz : profil === 'parkur' ? parkurHiz(profT) : rejenHiz(profT);
    if (test && !kill) profT += dt;
    const v0 = v;
    const amax = profil === 'rejen' && hedef < v ? 1.6 : 1.2;   // m/s²
    v = approach(v, hedef, amax * 3.6 * dt);
    if (kill) v = approach(v0, 0, 2.5 * 3.6 * dt);
    a = (v - v0) / 3.6 / Math.max(dt, 1e-4);
    const vm = v / 3.6;
    const F = CRR * KTL * 9.81 * (vm > 0.05 ? 1 : 0) + 0.5 * 1.2 * CDA * vm * vm + KTL * a;
    pMek = F * vm;
    pEl = kill ? 0 : pMek >= 0 ? pMek / ETA : pMek * 0.6;
    volt = 16 * (3.12 + 0.3 * soc) - (pEl / 51) * 0.03;
    akim = pEl / volt;
    soc = clamp(soc - (pEl * dt * 10) / (PIL_WH * 3600), 0, 1);   // ×10 hızlandırılmış
    sicaklik += (Math.abs(akim) * Math.abs(akim) * 0.0011 - (sicaklik - 26) * (fanAcik ? 0.05 : 0.012)) * dt * 3;
    rpm = (vm / (2 * Math.PI * R)) * 60;
    tork = rpm > 1 && !kill ? pMek / ((rpm * 2 * Math.PI) / 60) : 0;
    mesafe += (vm * dt) / 1000; enerji += (pEl * dt) / 3600;
    if (soc <= 0.03) test = false;
  }

  const trend = new Trend([
    { ad: 'Hız (km/h)', renk: '#39c5cf' }, { ad: 'Güç (W/10)', renk: '#f2c200' }, { ad: 'Pil sıcaklığı (°C)', renk: '#f85149' },
  ], { min: -20, max: 60, uzunluk: 300 });
  const ekranZ = throttle(4), dashZ = throttle(4);
  const verim = () => (v > 3 ? pEl / v : 0);   // Wh/km

  // kapı / kapak işleri: operatör yürür, kaldırır/indirir, masaya döner (kuyrukta sırayla)
  let kapiK = 0, kapakK = 0, isler = [];
  const IS_YER = {
    kapi: { rota: [[CX - 1.0, CZ + 1.0]], yon: 2.03 },                          // kapının arkasında (kamerayı kapatmaz)
    kapak: { rota: [[CX + 1.82, CZ + 1.2], [CX + 1.82, CZ - 0.55]], yon: -1.08 },   // burnun arka köşesinde (kamerayı kapatmaz)
  };
  const isEkle = (tip, hedef) => { isler.push({ tip, hedef, faz: 0, r: false }); };
  const isAcik = (tip) => { const son = [...isler].reverse().find((i) => i.tip === tip); return son ? son.hedef : (tip === 'kapi' ? kapiK : kapakK) > 0.5; };
  function isGuncelle(dt) {
    const is = isler[0];
    if (!is) return;   // hedef zaten masa (iş bitince dönüş rotası verilir)
    const Y = IS_YER[is.tip];
    if (is.faz === 0) {
      if (!is.r) { opRota(Y.rota, Y.yon, 'on'); is.r = true; }
      if (opVardi()) is.faz = 1;
    } else if (is.faz === 1) {
      opS.poz = 'yukari';
      const hedef = is.hedef ? 1 : 0;
      if (is.tip === 'kapi') kapiK = approach(kapiK, hedef, dt / 2.0); else kapakK = approach(kapakK, hedef, dt / 1.6);
      if ((is.tip === 'kapi' ? kapiK : kapakK) === hedef) { is.faz = 2; is.r = false; }
    } else {
      // sıradaki iş varsa doğrudan ona, yoksa masaya (geri dönüş ara noktaları ters sırada)
      isler.shift();
      if (!isler.length) opRota([...Y.rota.slice(0, -1).reverse(), MASA], Math.PI, 'on');
    }
  }

  function demoGuncelle(dt) {
    demoT += dt;
    const sira = [
      () => { isEkle('kapak', true); return 12; },                       // servis kapağı: pil, BMS, sürücü
      () => { isEkle('kapak', false); return 6; },
      () => { isEkle('kapi', true); return 9; },                         // makas kapı: koltuk, kafes
      () => { isEkle('kapi', false); return 9; },
      () => { profil = 'parkur'; profT = 0; test = true; return 42; },   // parkur döngüsü
      () => { test = false; return 5; },
      () => { profil = 'rejen'; profT = 0; test = true; return 30; },
      () => { test = false; if (soc < 0.4) soc = 0.95; return 6; },
    ];
    if (demoT >= (demoGuncelle.sure || 0)) { demoT = 0; demoGuncelle.sure = sira[demoAdim % sira.length](); demoAdim++; }
  }

  function update(dt, t) {
    if (demo && !kill) demoGuncelle(dt);
    fizik(dt);
    isGuncelle(dt);
    const kk = easeInOut(kapiK);
    kapiPivot.rotation.z = -1.3 * kk;           // yukarı (menteşe önde: arka uç kalkar)
    kapiKol.rotation.y = 0.14 * kk;             // önce dışa
    kapiPivot.position.z = KAPI_M.z + 0.04 * kk;
    kapakPivot.rotation.z = 1.05 * easeInOut(kapakK);
    // tekerler + makaralar + fan
    const wv = (v / 3.6 / R) * dt;
    for (const tk of tekerler) if (tk.arka) tk.w.rotation.z -= wv;
    for (const m of makaralar) m.rotation.y += (v / 3.6 / 0.085) * dt;   // eksen z'ye yatık silindir: yerel Y
    if (fanAcik) fan.rotation.x += dt * 14;
    // ışıklar: testte ön ledler yanar; yavaşlarken / KILL'de stop
    ledOn.emissiveIntensity = test ? 2.2 : 0.25;
    ledArka.emissiveIntensity = kill || (v > 1 && a < -0.25) ? 2.8 : test ? 0.7 : 0.25;
    opGuncelle(dt, t);
    const d = durumBilgi();
    kule.set(d.seviye, t);
    trend.ornekle(dt, [v, pEl / 10, sicaklik]);
    if (ekranZ(dt)) {
      ekran.standart('MAVERA · Şasi Dinamometresi', [
        ['Profil', test ? PROF[profil] : 'beklemede'],
        ['Hız', `${fmt(v, 1)} km/h`],
        ['Güç / tork', `${fmt(pEl, 0)} W · ${fmt(tork, 1)} Nm`],
        ['Verim', v > 3 ? `${fmt(verim(), 2)} Wh/km` : '—'],
        ['Pil', `%${fmt(soc * 100, 0)} · ${fmt(sicaklik, 1)} °C`],
      ], d);
    }
    if (dashZ(dt)) {
      dash.ciz((x, W, H) => {
        x.fillStyle = '#05080b'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#7df9ff'; x.font = `700 ${Math.round(H * 0.5)}px "JetBrains Mono", monospace`;
        x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText(fmt(v, 0), W * 0.06, H * 0.42);
        x.font = `500 ${Math.round(H * 0.18)}px "Space Grotesk", sans-serif`; x.fillStyle = '#c9d1d9';
        x.fillText(`${fmt(pEl, 0)} W`, W * 0.56, H * 0.3);
        x.fillText(`%${fmt(soc * 100, 0)}`, W * 0.56, H * 0.6);
        x.fillStyle = kill ? '#f85149' : '#2ea043'; x.fillRect(0, H * 0.86, W, H * 0.14);
      });
    }
  }

  function durumBilgi() {
    if (kill) return { metin: 'KILL SWITCH · HV KESİK', seviye: 'alarm' };
    const is = isler[0];
    if (is) return { metin: `${is.tip === 'kapi' ? 'MAKAS KAPI' : 'SERVİS KAPAĞI'} ${is.hedef ? 'AÇILIYOR' : 'KAPANIYOR'}`, seviye: 'calisiyor' };
    if (test && sicaklik > 42) return { metin: `PİL SICAKLIĞI YÜKSEK · ${fmt(sicaklik, 0)} °C`, seviye: 'uyari' };
    if (test) return { metin: `DYNO · ${PROF[profil]} · ${fmt(v, 0)} km/h · ${fmt(pEl, 0)} W`, seviye: 'calisiyor' };
    if (soc < 0.1) return { metin: 'PİL ZAYIF', seviye: 'uyari' };
    return { metin: `HAZIR · kapı ${kapiK > 0.5 ? 'açık' : 'kapalı'} · kapak ${kapakK > 0.5 ? 'açık' : 'kapalı'}`, seviye: 'bekliyor' };
  }

  const elle = () => { demo = false; };
  const kontroller = [
    { tip: 'anahtar', metin: 'Makas kapı açık', get: () => isAcik('kapi'), set: (vv) => { elle(); isEkle('kapi', !!vv); } },
    { tip: 'anahtar', metin: 'Servis kapağı açık (pil, BMS, sürücü)', get: () => isAcik('kapak'), set: (vv) => { elle(); isEkle('kapak', !!vv); } },
    { tip: 'secim', metin: 'Test profili', secenekler: Object.entries(PROF), get: () => profil, set: (vv) => { profil = vv; profT = 0; elle(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'Dyno başlat', tur: 'basla', tik: () => { if (!kill) { test = true; profT = 0; } elle(); } },
      { metin: 'Durdur', tur: 'dur', tik: () => { test = false; elle(); } },
      { metin: 'Pil şarj (tam)', tik: () => { if (!test) soc = 1; elle(); } },
    ] },
    { tip: 'kaydirici', metin: 'Hız hedefi (sabit profil)', min: 0, max: 45, adim: 1, birim: 'km/h', get: () => hedefHiz, set: (vv) => (hedefHiz = vv) },
    { tip: 'anahtar', metin: 'Soğutma fanı', get: () => fanAcik, set: (vv) => (fanAcik = vv) },
    { tip: 'anahtar', metin: 'Otomatik demo (kapak → kapı → parkur → rejen)', get: () => demo, set: (vv) => { demo = vv; demoT = 0; demoGuncelle.sure = 0; } },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'butonlar', ogeler: [
      { metin: 'KILL SWITCH', tur: 'acil', tik: () => { kill = true; test = false; elle(); } },
      { metin: 'Reset', tik: () => { if (v < 0.5) kill = false; } },
    ] },
  ];

  return {
    id: 'earac',
    ad: 'MAVERA Elektrikli Araç',
    altBaslik: 'Efficiency Challenge · 4 teker · dyno',
    kisa: 'Üniversitede MAVERA takımıyla TÜBİTAK Efficiency Challenge\'a katıldığımız 4 tekerli elektrikli aracın modeli. Gövde takımın fotoğrafındaki araçtan alındı: açık gri kabuk, burundan kuyruğa mavi şerit, yukarı açılan makas kapı, oval yan camlar, ön kaputta servis kapağı. Kapağı açınca pil paketi, BMS ve motor sürücüsü görünür; araç şasi dinamometresinde sabit hız, yarış parkuru ve rejeneratif fren testlerinde hız, güç, verim (Wh/km) ve pil sıcaklığını gösterir.',
    proje: 'personal-projects',
    ayakIzi: [8.4, 5.6],
    ayakIziMerkez: [-0.25, -0.15],
    kamera: { poz: [2.8, 1.85, 3.9], hedef: [0.35, 0.55, -0.35] },
    mekanizmalar: [
      'Makas kapı: menteşe kapının ön alt köşesinde; kapı önce hafif dışa, sonra yukarı kalkar (operatör yanına gidip kaldırır)',
      'Servis kapağı: ön cam tarafından menteşeli, burun tarafı kalkar; altında pil paketi (turuncu HV kapak), BMS kartı, motor sürücü',
      'Dyno: arka tekerler iki makara üstünde döner; önde soğutma fanı; arka sağ tekerde göbek motoru',
      'Profiller: sabit hız (kaydırıcı), 40 s yarış parkuru döngüsü, rejeneratif fren (yavaşlarken güç negatife döner)',
      'Işıklar: testte ön tampondaki led çizgiler yanar, yavaşlarken stop lambaları parlar',
      'Kokpit ekranı hız/güç/pil gösterir; dyno monitörü ve kule lambası durumla senkron',
      'KILL SWITCH: HV kesilir, araç makaralarda serbest yavaşlar (sağ yanda dışarıdan erişilen acil durdurma)',
    ],
    cikarim: [
      'Kaan\'dan: MAVERA takımı, TÜBİTAK Efficiency Challenge, 4 teker.',
      'Gövde takımın araç fotoğrafından: astar gri kabuk, ortadan mavi şerit, siyah çerçeveli ön cam, oval yan camlar, makas kapı, çamurluk üstü aynalar, mandallı ön servis kapağı, ön tamponda üçer led çizgi, arka kanat, camda bayrak çıkartması.',
      'Ölçüler fotoğraftan tahmin: ≈2.7 m boy, ≈1.3 m en, ≈1.05 m yükseklik, 1.75 m dingil mesafesi. Fotoğraftaki sponsor logoları konmadı; kapakta takım adı var.',
      'Kapak altındaki yerleşim, motorun yeri ve sayısal değerler temsili: 150 kg (sürücü dahil), Crr 0.0055, CdA ≈ 0.30 m² → 30 km/h\'de ≈ 190 W; pil 16S LiFePO4 51.2 V 20 Ah. Pil tüketimi gösterim için ×10 hızlandırıldı.',
    ],
    group: g,
    sabitHaric: [kapiPivot, kapakPivot, ...tekerler.map((t) => t.w), ...makaralar, fan, op.group],
    update,
    kontroller,
    degerler: () => [
      ['Profil', test ? PROF[profil] : 'beklemede'],
      ['Hız', `${fmt(v, 1)} km/h`],
      ['Motor gücü', `${fmt(pEl, 0)} W`],
      ['Tork / devir', `${fmt(tork, 1)} Nm · ${fmt(rpm, 0)} rpm`],
      ['Verim', v > 3 ? `${fmt(verim(), 2)} Wh/km` : '—'],
      ['Pil', `${fmt(volt, 1)} V · ${fmt(akim, 1)} A · %${fmt(soc * 100, 0)}`],
      ['Pil sıcaklığı', `${fmt(sicaklik, 1)} °C`],
      ['Test sayacı', `${fmt(mesafe, 2)} km · ${fmt(enerji, 1)} Wh`],
      ['Kapı / servis kapağı', `${kapiK > 0.5 ? 'açık' : 'kapalı'} / ${kapakK > 0.5 ? 'açık' : 'kapalı'}`],
    ],
    trend,
    durum: durumBilgi,
  };
}
