// js/machines/iha.js — Üniversite İHA Projesi (TEMSİLİ).
//
// Takımın uçağı sabit kanatlıydı: ≈2 m kanat açıklığı, hazır alınan genel geçer bir gövde.
// Temsili model bu sınıfın yaygın biçimi: yüksek kanat, gövde arkasında itici (pusher)
// pervane, çift karbon kuyruk borusu ve H-kuyruk. 2 m'lik uçak salonda uçamayacağı için
// istasyon yer testlerini gösterir: uçak yük hücreli itki tezgâhında; kontrol yüzeyi testi,
// motor/itki testi ve HITL görev simülasyonu (uçuş kontrolcüsü simülatöre bağlı, görev yer
// istasyonu haritasında; gerçek modelin yüzeyleri ve motoru komutları izler). Güvenlik: RC
// bağlantı kaybı (HITL'de eve dönüş, yerde motor kesme) ve KILL. Yanda ray fırlatıcı,
// yedek kanat sehpası, LiPo şarj masası ve RC kumandalı pilot.

export function create(lib) {
  const {
    THREE, M, box, cyl, rod, sphere, mat, lamba, Ekran, Trend, levha, profil,
    clamp, approach, fmt, throttle,
  } = lib;

  const g = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rad = (d) => (d * Math.PI) / 180, der = (r) => (r * 180) / Math.PI;

  // ---------------------------------------------------------------- itki test tezgâhı (uçak ekseninde döndürülmüş)
  const TB = { x: 0.7, z: -0.5, yaw: -0.55 };   // burun izleyiciye (+Z) ve sağa bakar
  const tezgah = new THREE.Group();
  tezgah.position.set(TB.x, 0, TB.z); tezgah.rotation.y = TB.yaw;
  g.add(tezgah);
  const yerel = (x, z) => {   // tezgâh ekseni → istasyon (x, z)
    const c = Math.cos(TB.yaw), s = Math.sin(TB.yaw);
    return [TB.x + x * c + z * s, TB.z - x * s + z * c];
  };
  // pervane tehlike bölgesi: koyu paspas + sarı sınır
  box(3.0, 0.01, 2.7, mat(0x2c3440, { r: 0.92, key: 'iha-paspas' }), -0.1, 0.005, 0, tezgah).castShadow = false;
  for (const s of [-1, 1]) {
    box(3.0, 0.012, 0.05, M.sari, -0.1, 0.007, s * 1.35, tezgah).castShadow = false;
    box(0.05, 0.012, 2.7, M.sari, -0.1 + s * 1.5, 0.007, 0, tezgah).castShadow = false;
  }
  const TH = 0.78;   // tabla merkezi (üst yüz 0.805)
  box(1.5, 0.05, 0.75, M.koyu, 0, TH, 0, tezgah);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, TH - 0.025, 0.05, M.gri, sx * 0.7, (TH - 0.025) / 2, sz * 0.33, tezgah);
  box(1.4, 0.02, 0.65, M.koyu, 0, 0.25, 0, tezgah);                    // alt raf
  box(0.42, 0.18, 0.22, M.kirmizi, -0.35, 0.35, 0.1, tezgah);          // takım çantası
  box(0.3, 0.12, 0.2, M.siyah, 0.3, 0.32, -0.12, tezgah);              // güç kaynağı
  // kızak rayları + yük hücresi: itici pervane uçağı öne iter, kızak hücreye bastırır
  for (const s of [-1, 1]) box(1.1, 0.02, 0.025, M.alu, -0.05, TH + 0.035, s * 0.12, tezgah);
  box(0.62, 0.02, 0.34, M.alu, -0.03, TH + 0.055, 0, tezgah);
  box(0.06, 0.2, 0.08, M.koyu, 0.66, TH + 0.125, 0, tezgah);           // sabit ayak
  box(0.05, 0.06, 0.03, M.paslanmaz, 0.6, TH + 0.12, 0, tezgah);       // S tipi yük hücresi
  rod(V(0.28, TH + 0.075, 0), V(0.575, TH + 0.12, 0), 0.006, M.celik, tezgah, 8);
  box(0.16, 0.08, 0.06, M.siyah, 0.5, TH + 0.065, 0.3, tezgah);        // itki göstergesi
  const itkiEkran = new Ekran(0.13, 0.05, 160);
  itkiEkran.mesh.position.set(0.5, TH + 0.07, 0.331);
  tezgah.add(itkiEkran.mesh);
  rod(V(0.6, TH + 0.09, 0.02), V(0.5, TH + 0.04, 0.27), 0.003, M.siyah, tezgah, 5);

  // ---------------------------------------------------------------- uçak (yerel: +X burun, +Z sağ kanat, y=0 gövde ekseni)
  const PY = 1.08;   // gövde ekseni yüksekliği (gövde altı ≈ 1.0 m)
  const ucak = new THREE.Group();
  ucak.position.set(0, PY, 0);
  tezgah.add(ucak);
  const epo = mat(0xeef0ec, { r: 0.72, key: 'iha-epo' });       // beyaz EPO köpük
  const epo2 = mat(0xc4c9c6, { r: 0.72, key: 'iha-epo2' });     // hareketli yüzeyler (menteşe çizgisi seçilsin)
  const turuncu = mat(0xff6a1a, { r: 0.6, key: 'iha-uc' });     // görünürlük uçları
  const karbon = mat(0x1a1c1f, { r: 0.35, m: 0.3, key: 'iha-karbon' });
  const ekle = (geo, m, p) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };

  // gövde (pod): döner profil, burun +X
  const POD = [[-0.53, 0], [-0.53, 0.036], [-0.42, 0.056], [-0.3, 0.07], [-0.15, 0.078], [0.12, 0.078],
    [0.25, 0.074], [0.33, 0.062], [0.38, 0.045], [0.405, 0.028], [0.42, 0]];
  const rPod = (x) => {
    for (let i = 2; i < POD.length; i++) if (x <= POD[i][0]) {
      const [x0, r0] = POD[i - 1], [x1, r1] = POD[i];
      return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
    }
    return 0;
  };
  const podGeo = new THREE.LatheGeometry(POD.map(([x, r]) => new THREE.Vector2(r, x)), 24);
  podGeo.rotateZ(-Math.PI / 2);   // dönme ekseni Y → X
  ekle(podGeo, epo, ucak);
  box(0.12, 0.006, 0.07, epo2, 0.2, rPod(0.2) + 0.002, 0, ucak);                     // batarya kapağı
  box(0.44, 0.008, 0.03, M.siyah, 0.0, -0.079, 0, ucak);                              // gövde altı kızak
  sphere(0.028, M.siyah, 0.3, -0.058, 0, ucak, 14);                                    // gimbal kamera
  cyl(0.012, 0.012, mat(0x0a1a2a, { r: 0.1, m: 0.6, key: 'iha-lens' }), 0.326, -0.064, 0, ucak, { eksen: 'x', seg: 12 });
  rod(V(0.41, 0.004, 0), V(0.54, 0.004, 0), 0.0028, M.alu, ucak, 6);                  // pitot
  rod(V(-0.32, 0.06, 0), V(-0.32, 0.15, 0), 0.004, M.koyu, ucak, 6);                  // GPS direği
  cyl(0.03, 0.012, M.gri, -0.32, 0.156, 0, ucak, { seg: 16 });
  cyl(0.036, 0.02, M.koyu, -0.54, 0, 0, ucak, { eksen: 'x', seg: 16 });               // motor yatağı
  cyl(0.024, 0.032, M.alu, -0.566, 0, 0, ucak, { eksen: 'x', seg: 16 });              // motor çanı
  // itici pervane (12"): düşük devirde pal, yüksekte bulanık disk
  const pervane = new THREE.Group();
  pervane.position.set(-0.597, 0, 0);
  ucak.add(pervane);
  const pal = box(0.01, 0.305, 0.026, mat(0x141516, { r: 0.5, key: 'iha-pal' }), 0, 0, 0, pervane);
  pal.castShadow = false;
  cyl(0.003, 0.034, M.koyu, -0.018, 0, 0, pervane, { eksen: 'x', r2: 0.017, seg: 14 });   // spinner (geriye sivri)
  const diskMat = new THREE.MeshBasicMaterial({ color: 0x2a2c30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.153, 32).rotateY(Math.PI / 2), diskMat);
  disk.position.set(-0.6, 0, 0); disk.visible = false;
  ucak.add(disk);

  // kanat: düz tabanlı profil, kiriş 0.235 m, %12; menteşe hattı kirişin %80'inde
  const C = 0.235, LE = 0.12, TK = 0.12, HT = 0.8;
  const yt = (t) => 5 * TK * C * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
  const yU = (t) => yt(t) * 1.6, yL = (t) => -yt(t) * 0.4;
  const X = (t) => LE - t * C;
  function profilSekli(t0, t1, ox, oy) {
    const s = new THREE.Shape(), n = 12;
    const tt = (i) => t0 + (t1 - t0) * (t0 === 0 ? (i / n) ** 2 : i / n);   // hücum kenarında sık
    for (let i = 0; i <= n; i++) { const t = tt(i); i ? s.lineTo(X(t) - ox, yU(t) - oy) : s.moveTo(X(t) - ox, yU(t) - oy); }
    for (let i = n; i >= (t0 === 0 ? 1 : 0); i--) { const t = tt(i); s.lineTo(X(t) - ox, yL(t) - oy); }
    return s;
  }
  const kanatGeo = (t0, t1, z0, z1, ox = 0, oy = 0) => {
    const geo = new THREE.ExtrudeGeometry(profilSekli(t0, t1, ox, oy), { depth: z1 - z0, bevelEnabled: false });
    geo.translate(0, 0, z0);
    return geo;
  };
  const DIH = rad(3), WY = 0.085;
  const HX = X(HT), HY = (yU(HT) + yL(HT)) / 2;
  const kanatcik = [];   // [sağ, sol] aileron grupları
  const navK = lamba(0xff2a2a, 1.6), navY = lamba(0x2bdc5a, 1.6), strobe = lamba(0xffffff, 0);
  for (const s of [1, -1]) {
    const k = new THREE.Group();
    k.position.set(0, WY, 0); k.rotation.x = -s * DIH;   // dihedral: uçlar yukarı
    ucak.add(k);
    const zz = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    ekle(kanatGeo(0, HT, ...zz(0, 0.88)), epo, k);
    ekle(kanatGeo(0, HT, ...zz(0.88, 1.0)), turuncu, k);
    ekle(kanatGeo(HT, 1, ...zz(0, 0.47)), epo, k);
    ekle(kanatGeo(HT, 1, ...zz(0.88, 1.0)), turuncu, k);
    const ai = new THREE.Group();
    ai.position.set(HX, HY, 0);
    k.add(ai);
    ekle(kanatGeo(HT, 1, ...zz(0.474, 0.876), HX, HY), epo2, ai);
    kanatcik.push(ai);
    box(0.02, 0.01, 0.006, s > 0 ? navY : navK, X(0.2), 0.006, s * 1.003, k).castShadow = false;   // seyir ledi
  }
  box(0.016, 0.008, 0.016, strobe, -0.42, rPod(-0.42) + 0.003, 0, ucak).castShadow = false;

  // çift kuyruk borusu + H-kuyruk
  const BZ = 0.28, BY = 0.08;
  for (const s of [-1, 1]) {
    rod(V(0.07, BY, s * BZ), V(-0.97, BY, s * BZ), 0.011, karbon, ucak, 10);
    box(0.08, 0.022, 0.03, epo2, 0.0, BY + 0.012, s * BZ, ucak);   // kanat bağlantı bloğu
  }
  box(0.09, 0.008, 2 * BZ, epo, -0.905, BY, 0, ucak);              // yatay stabilize
  const elevator = new THREE.Group();
  elevator.position.set(-0.95, BY, 0);
  ucak.add(elevator);
  box(0.04, 0.006, 2 * BZ - 0.03, epo2, -0.02, 0, 0, elevator);
  const finGeo = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(-0.82, 0), new THREE.Vector2(-0.95, 0), new THREE.Vector2(-0.95, 0.17), new THREE.Vector2(-0.895, 0.17),
  ]), { depth: 0.007, bevelEnabled: false });
  finGeo.translate(0, 0, -0.0035);
  const rudder = [];
  for (const s of [-1, 1]) {
    const f = ekle(finGeo, epo, ucak);
    f.position.set(0, BY, s * BZ);
    box(0.06, 0.028, 0.009, turuncu, -0.92, BY + 0.157, s * BZ, ucak);   // dikey kuyruk ucu
    const r = new THREE.Group();
    r.position.set(-0.95, BY, s * BZ);
    ucak.add(r);
    box(0.04, 0.165, 0.006, epo2, -0.02, 0.085, 0, r);
    rudder.push(r);
  }

  // köpük yataklı beşik (kızak üstünde)
  const kopuk = mat(0x111111, { r: 0.95, key: 'iha-kopuk' });
  for (const x of [0.17, -0.27]) {
    const ust = PY - rPod(x);
    for (const s of [-1, 1]) rod(V(x, TH + 0.065, s * 0.1), V(x, ust - 0.022, s * 0.05), 0.008, M.alu, tezgah, 8);
    box(0.05, 0.025, 0.15, kopuk, x, ust - 0.0125, 0, tezgah);
    for (const s of [-1, 1]) box(0.05, 0.05, 0.02, kopuk, x, ust + 0.01, s * (rPod(x) * 0.9 + 0.01), tezgah);
  }

  // ---------------------------------------------------------------- yer istasyonu: masa, monitör (harita), dizüstü, anten
  const DX = -1.6, DZ = 0.2;   // uçağın solunda: yakın planda uçak ve harita birlikte görünsün
  box(1.4, 0.04, 0.7, M.siyah, DX, 0.74, DZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, M.koyu, DX + sx * 0.65, 0.36, DZ + sz * 0.3, g);
  const mon = new THREE.Group();
  mon.position.set(DX + 0.1, 0.76, DZ - 0.18); mon.rotation.y = 0.75;   // izleyiciye dönük
  g.add(mon);
  box(0.22, 0.012, 0.15, M.koyu, 0, 0.006, 0, mon);
  rod(V(0, 0.01, -0.02), V(0, 0.22, -0.02), 0.012, M.koyu, mon, 8);
  box(0.64, 0.4, 0.03, M.siyah, 0, 0.41, -0.006, mon);
  const ekran = new Ekran(0.6, 0.36, 640);
  ekran.mesh.position.set(0, 0.41, 0.0105);
  mon.add(ekran.mesh);
  box(0.34, 0.02, 0.24, M.koyu, DX - 0.42, 0.77, DZ + 0.06, g);                    // dizüstü
  const kapak = box(0.34, 0.22, 0.012, M.koyu, DX - 0.42, 0.885, DZ - 0.07, g);
  kapak.rotation.x = -0.2;
  const lapEkran = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.19), lamba(0x1f4a73, 0.55));
  lapEkran.position.set(DX - 0.42, 0.885, DZ - 0.062); lapEkran.rotation.x = -0.2;
  g.add(lapEkran);
  box(0.2, 0.03, 0.12, M.siyah, DX + 0.48, 0.775, DZ + 0.12, g);                   // yedek RC kumanda
  // telemetri anteni (sehpa üstünde patch anten + modem)
  const AX = DX - 0.2, AZ = DZ - 0.75;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4;
    rod(V(AX + Math.cos(a) * 0.35, 0, AZ + Math.sin(a) * 0.35), V(AX, 1.0, AZ), 0.01, M.koyu, g, 6);
  }
  rod(V(AX, 1.0, AZ), V(AX, 1.72, AZ), 0.014, M.alu, g, 8);
  const patch = box(0.22, 0.22, 0.035, M.beyaz, AX, 1.8, AZ, g);
  patch.rotation.set(-0.25, 0.7, 0);
  box(0.06, 0.12, 0.04, M.siyah, AX, 1.5, AZ + 0.035, g);

  // ---------------------------------------------------------------- LiPo şarj masası: şarj cihazı + yanmaz torbalar + yangın tüpü
  const SX = -3.4, SZ = -1.5;
  box(1.0, 0.04, 0.55, M.koyu, SX, 0.74, SZ, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, M.koyu, SX + sx * 0.45, 0.36, SZ + sz * 0.23, g);
  box(0.24, 0.1, 0.18, M.siyah, SX - 0.25, 0.81, SZ, g);
  const sarjEkran = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), lamba(0x39c5cf, 0.9));
  sarjEkran.position.set(SX - 0.25, 0.83, SZ + 0.091);
  g.add(sarjEkran);
  const lipoMat = mat(0x2a2d31, { r: 0.6, key: 'iha-lipo' });
  for (let i = 0; i < 2; i++) box(0.2, 0.08, 0.12, mat(0xb3261e, { r: 0.85, key: 'iha-torba' }), SX + 0.1 + i * 0.24, 0.8, SZ, g);
  const yedekPil = box(0.15, 0.045, 0.05, lipoMat, SX + 0.3, 0.783, SZ + 0.15, g);   // 4S 5000 mAh
  box(0.15, 0.002, 0.05, M.sari, 0, 0.0235, 0, yedekPil);   // etiket
  cyl(0.08, 0.5, M.kirmizi, SX + 0.75, 0.25, SZ + 0.1, g, { seg: 14 });

  // ---------------------------------------------------------------- ray fırlatıcı (bungee) + yedek kanat sehpası + tabela
  const RA = V(1.3, 0.32, -3.2), RB = V(4.0, 0.88, -3.2);
  const rayP = (u, dy = 0) => V(RA.x + (RB.x - RA.x) * u, RA.y + (RB.y - RA.y) * u + dy, RA.z);
  for (const s of [-1, 1]) profil([RA.x, RA.y, RA.z + s * 0.055], [RB.x, RB.y, RB.z + s * 0.055], 0.04, g);
  for (const s of [-1, 1]) {
    profil([RA.x + 0.1, 0, RA.z + s * 0.25], [RA.x + 0.1, rayP(0.037).y - 0.02, RA.z + s * 0.055], 0.04, g);
    profil([RB.x - 0.1, 0, RB.z + s * 0.3], [RB.x - 0.1, rayP(0.963).y - 0.02, RB.z + s * 0.055], 0.04, g);
  }
  const egim = Math.atan2(RB.y - RA.y, RB.x - RA.x);
  const mekik = new THREE.Group();
  mekik.position.copy(rayP(0.09, 0.04)); mekik.rotation.z = egim;
  g.add(mekik);
  box(0.32, 0.03, 0.2, M.koyu, 0, 0, 0, mekik);
  for (const x of [-0.1, 0.1]) box(0.05, 0.04, 0.16, kopuk, x, 0.035, 0, mekik);
  cyl(0.045, 0.06, M.koyu, RB.x + 0.02, RB.y - 0.06, RB.z, g, { eksen: 'z', seg: 16 });                // makara
  rod(rayP(0.99, -0.07), rayP(0.12, -0.03), 0.008, M.turuncu, g, 6);                                   // bungee
  box(0.06, 0.1, 0.06, M.kirmizi, RA.x + 0.05, RA.y + 0.02, RA.z + 0.14, g);                           // bırakma pimi
  // yedek kanat sehpası
  const RX = -1.2, RZ = -3.15;
  for (const x of [RX - 0.4, RX + 0.4]) {
    box(0.06, 1.6, 0.06, M.gri, x, 0.8, RZ, g);
    box(0.36, 0.03, 0.36, M.gri, x, 0.015, RZ, g);
    for (const y of [0.95, 1.4]) box(0.05, 0.03, 0.34, M.koyu, x, y, RZ + 0.1, g);
  }
  const yedekGeo = kanatGeo(0, 1, -0.5, 0.5);
  for (const y of [0.98, 1.43]) {
    const m = ekle(yedekGeo, epo, g);
    m.rotation.y = Math.PI / 2; m.position.set(RX, y, RZ + 0.1);
  }
  for (let i = 0; i < 3; i++) box(0.305, 0.004, 0.026, mat(0x141516, { r: 0.5, key: 'iha-pal' }), RX + 0.65, 1.15 - i * 0.05, RZ + 0.05, g).rotation.z = 0.15 * i;
  const tabela = levha(['ÜNİVERSİTE İHA PROJESİ', 'temsili model · 2 m sabit kanat · yer testleri'], 3.0, 0.5, { bg: '#17324f', font: 64, px: 1024 });
  tabela.position.set(0.6, 2.5, -3.75);
  g.add(tabela);
  for (const s of [-1, 1]) rod(V(0.6 + s * 1.5, 0, -3.77), V(0.6 + s * 1.5, 2.75, -3.77), 0.025, M.koyu, g, 8);

  // ---------------------------------------------------------------- pilot (RC kumanda elinde)
  const op = lib.operator({ logo: false, yelek: 0x9ee03a, gomlek: 0x24304a });
  g.add(op.group);
  const rc = new THREE.Group();
  box(0.2, 0.12, 0.05, M.siyah, 0, 0, 0, rc);
  for (const s of [-1, 1]) cyl(0.008, 0.03, M.koyu, s * 0.05, 0.0, 0.035, rc, { eksen: 'z', seg: 8 });
  rod(V(0.08, 0.06, 0), V(0.1, 0.2, -0.02), 0.004, M.koyu, rc, 6);
  rc.position.set(0, 1.0, 0.3); rc.rotation.x = -0.5;
  op.group.add(rc);
  const PILOT = { x: DX - 1.0, z: DZ + 0.15 };   // masanın batı ucu: uçağı da monitörü de görür
  const opS = { x: PILOT.x, z: PILOT.z, yon: 2.3, hx: PILOT.x, hz: PILOT.z, hyon: 2.3, poz: 'on', rota: [], tasi: false };
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
    op.poz(opS.tasi ? 'tasi' : yuruyor ? 'yan' : opS.poz);
    rc.visible = !opS.tasi;
    op.group.position.set(opS.x, op.yuru(t, yuruyor), opS.z);
    op.group.rotation.y = opS.yon;
  }
  const ucakYon = () => Math.atan2(TB.x - opS.x, TB.z - opS.z);   // pilot uçağa bakar
  const DEGIS = yerel(0.55, 0.62), KAPAK = yerel(0.2, 0);          // pil değişimi: burnun sağında, kapağa dönük
  const DEGIS_YON = Math.atan2(KAPAK[0] - DEGIS[0], KAPAK[1] - DEGIS[1]);
  const MON_YON = Math.atan2(DX + 0.1 - PILOT.x, DZ - 0.18 - PILOT.z);   // HITL'de haritaya bakar

  // ---------------------------------------------------------------- test mantığı
  const MODLAR = { yuzey: 'Kontrol yüzeyi testi', motor: 'Motor / itki testi', hitl: 'HITL görev simülasyonu' };
  const RPM_MAX = 8600, ITKI_MAX = 2300, AKIM_MAX = 48;   // 4S, 12" pervane (temsili)
  let mod = 'yuzey', armed = false, kill = false, failsafe = false;
  let demo = true, demoT = 0, demoAdim = 0, demoSart = null;
  let gaz = 0, soc = 0.95, pilIs = null, yuzeyT = -1, motorProg = -1;
  let rpm = 0, akim = 0, volt = 16.6, itki = 0, thr = 0;
  const yz = { a: 0, e: 0, r: 0 };   // yüzey açıları (rad): + sağa yatış / burun yukarı / sağa sapma

  // HITL: harita metre (x doğu, y kuzey), yön ψ doğudan saat tersine; ×2.5 hızlandırılmış
  const WP = [[320, 0], [320, 260], [-260, 260], [-260, 0]];
  const SIM_HIZ = 2.5;
  const sim = { x: 0, y: 0, psi: 0, phi: 0, phiD: 0, V: 0, h: 0, vz: 0, vzH: 0, faz: 'yok', wp: 0, iz: [], izT: 0, yerde: false, loiter: false, hI: 80 };
  const ucuyor = () => ['kalkis', 'gorev', 'rtl', 'inis'].includes(sim.faz);
  function simBaslat() {
    Object.assign(sim, { x: -20, y: 0, psi: 0, phi: 0, phiD: 0, V: 0, h: 0, vz: 0, vzH: 0, faz: 'kalkis', wp: 0, izT: 0, yerde: false, loiter: false, hI: 80 });
    sim.iz.length = 0;
  }
  function simAdim(dt) {
    if (!ucuyor()) return;
    if ((failsafe || soc < 0.15) && (sim.faz === 'gorev' || (sim.faz === 'kalkis' && sim.h > 20))) sim.faz = 'rtl';
    const ev = Math.hypot(sim.x, sim.y);
    let hedef = null, hH = 80, vH = 16;
    sim.loiter = false;
    if (sim.faz === 'kalkis') {
      hedef = [sim.x + 100, sim.y];
      if (sim.h > 35) sim.faz = 'gorev';
    } else if (sim.faz === 'gorev') {
      const w = WP[sim.wp];
      if (Math.hypot(w[0] - sim.x, w[1] - sim.y) < 30 && ++sim.wp >= WP.length) sim.faz = 'inis';
      hedef = WP[Math.min(sim.wp, WP.length - 1)];
    } else if (sim.faz === 'rtl') {
      hedef = [0, 0];
      if (ev < 70) { if (failsafe) sim.loiter = true; else sim.faz = 'inis'; }
    }
    if (sim.faz === 'inis') { hedef = [0, 0]; sim.hI = Math.min(sim.hI, clamp(ev * 0.25 - 5, 0, 80)); hH = sim.hI; vH = 13; }   // süzülme hedefi yalnız alçalır
    if (sim.yerde) {   // gövde üstü iniş: yerde süzülüp durur
      sim.V = approach(sim.V, 0, 4 * dt); sim.phi = approach(sim.phi, 0, 2 * dt); sim.h = 0; sim.vz = 0; sim.vzH = 0;
      if (sim.V < 0.3) sim.faz = 'bitti';
    } else {
      if (hedef) {
        let e = Math.atan2(hedef[1] - sim.y, hedef[0] - sim.x) - sim.psi;
        e = Math.atan2(Math.sin(e), Math.cos(e));
        sim.phiD = clamp(-e * 1.3, -0.55, 0.55);   // sola dönüş = sol yatış (φ < 0)
      }
      if (sim.loiter) sim.phiD = -0.5;
      if (sim.faz === 'kalkis' && sim.h < 15) sim.phiD = 0;
      sim.phi = approach(sim.phi, sim.phiD, 1.0 * dt);
      sim.V = approach(sim.V, vH, (sim.faz === 'kalkis' && sim.V < 12 ? 12 : 1.5) * dt);   // ray: ≈1 s'de 12 m/s
      sim.vzH = sim.V > 10 ? clamp((hH - sim.h) * 0.4, -3, 4) : 0;
      if (sim.faz === 'inis' && hH < 1) sim.vzH = Math.min(sim.vzH, -0.9);   // son yaklaşma: sabit alçalma, yere değer
      sim.vz = approach(sim.vz, sim.vzH, 2 * dt);
      sim.h = Math.max(0, sim.h + sim.vz * dt);
      if (sim.faz === 'inis' && sim.h < 0.3 && ev < 60) sim.yerde = true;
    }
    if (sim.V > 3) sim.psi += ((-9.81 * Math.tan(sim.phi)) / sim.V) * dt;
    sim.x += sim.V * Math.cos(sim.psi) * dt; sim.y += sim.V * Math.sin(sim.psi) * dt;
    sim.izT += dt;
    if (sim.izT > 0.5) { sim.izT = 0; sim.iz.push([sim.x, sim.y]); if (sim.iz.length > 400) sim.iz.shift(); }
  }

  function yuzeyKomut(T) {   // aileron → elevator → rudder → kombine (3'er s)
    const w = (Math.PI * 2) / 1.5;
    if (T < 3) return [rad(22) * Math.sin(w * T), 0, 0];
    if (T < 6) return [0, rad(20) * Math.sin(w * (T - 3)), 0];
    if (T < 9) return [0, 0, rad(25) * Math.sin(w * (T - 6))];
    if (T < 12) { const u = T - 9; return [rad(14) * Math.sin(w * u), rad(12) * Math.cos(w * u) * Math.min(1, u * 2), rad(10) * Math.sin(2 * w * u)]; }
    return [0, 0, 0];
  }
  const motorAdim = (T) => (T < 10 ? 0.25 * (1 + Math.floor(T / 2.5)) : 0);   // %25-50-75-100, sonra kapalı

  const arm = () => { if (!kill && !failsafe && soc > 0.12 && !pilIs) armed = true; };
  const disarm = () => { if (mod === 'hitl' && ucuyor()) return; armed = false; motorProg = -1; };
  function baslat() {
    if (kill || pilIs) return;
    if (mod === 'yuzey') yuzeyT = 0;
    else if (mod === 'motor') { arm(); if (armed) motorProg = 0; }
    else { arm(); if (armed && !ucuyor()) simBaslat(); }
  }
  function durdur() {
    yuzeyT = -1; motorProg = -1; gaz = 0;
    if (mod === 'hitl' && (sim.faz === 'kalkis' || sim.faz === 'gorev')) sim.faz = 'rtl';
  }

  // pil değişimi: pilot şarj masasından yedek pili alıp uçağa takar (masanın önünden dolaşır)
  function pilGuncelle(dt) {
    if (!pilIs) return;
    if (pilIs.faz === 0) {
      if (!pilIs.r) { opRota([[SX + 0.3, SZ + 0.62]], Math.PI); pilIs.r = true; }
      if (opVardi()) { pilIs.faz = 1; pilIs.k = 0; pilIs.r = false; }
    } else if (pilIs.faz === 1) {
      pilIs.k += dt;
      if (pilIs.k > 0.6) { yedekPil.visible = false; opS.tasi = true; pilIs.faz = 2; }
    } else if (pilIs.faz === 2) {
      if (!pilIs.r) { opRota([[-3.0, 1.2], [0.9, 1.2], DEGIS], DEGIS_YON); pilIs.r = true; }
      if (opVardi()) { pilIs.faz = 3; pilIs.k = 0; pilIs.r = false; opS.tasi = false; opS.poz = 'on'; }
    } else if (pilIs.faz === 3) {
      pilIs.k += dt;
      if (pilIs.k > 1.6) { soc = 1; pilIs.faz = 4; }
    } else if (pilIs.faz === 4) {
      if (!pilIs.r) { opRota([[0.9, 1.2], [-3.0, 1.2], [PILOT.x, PILOT.z]], ucakYon()); pilIs.r = true; }
      if (opVardi()) { yedekPil.visible = true; pilIs = null; }
    }
  }

  function demoGuncelle(dt) {
    demoT += dt;
    if (demoSart && demoSart()) { demoT = Math.max(demoT, demoGuncelle.sure || 0); demoSart = null; }
    const sira = [
      () => { mod = 'yuzey'; disarm(); yuzeyT = 0; return 13; },
      () => { mod = 'motor'; arm(); motorProg = 0; return 12.5; },
      () => { disarm(); return 1.5; },
      () => { mod = 'hitl'; arm(); simBaslat(); demoSart = () => sim.faz === 'bitti'; return 150; },
      () => { disarm(); return 3; },
      () => { const z = soc < 0.55; if (z) pilIs = { faz: 0, k: 0 }; return z ? 16 : 0.5; },
    ];
    if (demoT >= (demoGuncelle.sure || 0)) {
      demoT = 0;
      demoGuncelle.sure = sira[demoAdim % sira.length]();
      demoAdim++;
    }
  }

  const trend = new Trend([
    { ad: 'Devir (%)', renk: '#39c5cf' }, { ad: 'Akım (A)', renk: '#f2c200' }, { ad: 'Pil (%)', renk: '#2ea043' }, { ad: 'HITL irtifa (m)', renk: '#d2a8ff' },
  ], { min: 0, max: 100, uzunluk: 300 });
  const ekranZ = throttle(4);

  function update(dt, t) {
    if (demo && !kill && !failsafe) demoGuncelle(dt);
    let hA = 0, hE = 0, hR = 0;
    if (mod === 'yuzey' && yuzeyT >= 0 && yuzeyT < 12) {
      if (!failsafe && !kill) yuzeyT += dt;
      [hA, hE, hR] = yuzeyKomut(yuzeyT);
    }
    if (mod === 'motor' && motorProg >= 0 && armed && !kill) { motorProg += dt; if (motorProg > 11.5) motorProg = -1; }
    if (soc < 0.15 && mod === 'motor') { motorProg = -1; gaz = 0; }
    if (mod === 'hitl' && sim.faz !== 'yok') {
      if (!kill) simAdim(dt * SIM_HIZ);
      if (ucuyor() && !kill) {   // gerçek model simülasyondaki kumanda komutlarını izler
        hA = clamp((sim.phiD - sim.phi) * 1.4 + 0.03 * Math.sin(t * 2.3), -0.35, 0.35);
        hE = clamp(0.03 + (sim.vzH - sim.vz) * 0.06 + 0.75 * (1 / Math.cos(sim.phi) - 1) + (sim.yerde ? -0.03 : 0), -0.3, 0.3);
        hR = hA * 0.35;
      }
    }
    if (kill || (failsafe && mod !== 'hitl')) hA = hE = hR = 0;   // failsafe konumu: nötr
    yz.a = approach(yz.a, hA, 5 * dt); yz.e = approach(yz.e, hE, 5 * dt); yz.r = approach(yz.r, hR, 5 * dt);
    kanatcik[0].rotation.z = -yz.a; kanatcik[1].rotation.z = yz.a;   // sağa yatış: sağ aileron yukarı
    elevator.rotation.z = -yz.e;
    for (const r of rudder) r.rotation.y = yz.r;

    // motor: gaz → devir → itki/akım (4S, 12")
    if (kill || !armed || soc < 0.05) thr = 0;
    else if (mod === 'motor') thr = failsafe ? 0 : motorProg >= 0 ? motorAdim(motorProg) : gaz / 100;
    else if (mod === 'hitl') {
      thr = !ucuyor() || sim.yerde ? 0 : sim.faz === 'kalkis' ? 0.9 : sim.faz === 'inis' ? (sim.h > 3 ? 0.25 : 0) : clamp(0.52 + sim.vz * 0.08, 0.3, 0.9);
    } else thr = 0;
    rpm = approach(rpm, thr * RPM_MAX, (kill ? 14000 : 7000) * dt);
    const n = rpm / RPM_MAX;
    itki = ITKI_MAX * n * n;
    akim = 0.35 + AKIM_MAX * n * n * n + (Math.abs(hA - yz.a) + Math.abs(hE - yz.e)) * 0.8;
    volt = 4 * (3.45 + 0.75 * soc) - akim * 0.01;
    soc = Math.max(0, soc - (akim * dt * 8) / (5 * 3600));   // 5000 mAh, ×8 hızlandırılmış
    const w = (rpm / 60) * Math.PI * 2;
    if (rpm < 1600) { pal.visible = true; pervane.rotation.x += Math.min(w * dt, 1.1); }
    else pal.visible = false;
    disk.visible = rpm > 700;
    diskMat.opacity = clamp((rpm - 700) / 3500, 0, 0.42);
    strobe.emissiveIntensity = armed && t % 1.2 < 0.08 ? 4 : 0;
    sarjEkran.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 2);

    pilGuncelle(dt);
    if (!pilIs) { opS.rota.length = 0; opHedef(PILOT.x, PILOT.z, mod === 'hitl' && ucuyor() ? MON_YON : ucakYon(), 'on'); }
    opGuncelle(dt, t);

    trend.ornekle(dt, [n * 100, akim, soc * 100, mod === 'hitl' ? sim.h : 0]);
    if (ekranZ(dt)) {
      const d = durumBilgi();
      if (mod === 'hitl') ekran.ciz((x, W, H) => haritaCiz(x, W, H, d));
      else if (mod === 'yuzey') {
        const ok = (a, b) => (yuzeyT >= b ? '✓ TAMAM' : yuzeyT >= a ? '▶ test' : '—');
        ekran.standart('Yer İstasyonu · Kontrol Yüzeyi Testi', [
          ['Aileron (sol / sağ)', ok(0, 3)], ['Elevator', ok(3, 6)], ['Rudder (çift)', ok(6, 9)], ['Kombine çubuk', ok(9, 12)],
          ['Açılar A / E / R', `${fmt(der(yz.a), 0)}° / ${fmt(der(yz.e), 0)}° / ${fmt(der(yz.r), 0)}°`],
        ], d);
      } else {
        ekran.standart('Yer İstasyonu · İtki Testi', [
          ['Gaz', `%${fmt(thr * 100, 0)}`], ['Devir', `${fmt(rpm, 0)} rpm`], ['İtki (yük hücresi)', `${fmt(itki, 0)} g`],
          ['Akım / güç', `${fmt(akim, 1)} A · ${fmt(volt * akim, 0)} W`],
          ['Verim', akim > 2 ? `${fmt(itki / (volt * akim), 2)} g/W` : '—'], ['Pil (4S)', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
        ], d);
      }
      itkiEkran.ciz((x, W, H) => {
        x.fillStyle = '#071108'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#5dff7a'; x.font = `700 ${Math.round(H * 0.6)}px "JetBrains Mono", monospace`;
        x.textAlign = 'right'; x.textBaseline = 'middle';
        x.fillText(`${fmt(itki, 0)} g`, W * 0.94, H * 0.55);
      });
    }
  }

  const SEVIYE = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' };
  const FAZ = { yok: 'BEKLEMEDE', kalkis: 'KALKIŞ (ray)', gorev: 'GÖREV', rtl: 'EVE DÖNÜŞ (RTL)', inis: 'İNİŞ', bitti: 'GÖREV TAMAM' };
  function haritaCiz(x, W, H, d) {
    x.fillStyle = '#0d1b16'; x.fillRect(0, 0, W, H);
    const hb = Math.round(H * 0.13), alt = Math.round(H * 0.12);
    x.fillStyle = '#163a5c'; x.fillRect(0, 0, W, hb);
    x.fillStyle = '#fff'; x.font = `700 ${Math.round(hb * 0.5)}px "Space Grotesk", sans-serif`;
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('Yer İstasyonu · HITL Görev', W * 0.03, hb / 2);
    // harita
    const mx0 = 8, my0 = hb + 6, mw = Math.round(W * 0.6), mh = H - hb - alt - 12;
    const X0 = -340, X1 = 400, Y0 = -70, Y1 = 330;
    const sk = Math.min(mw / (X1 - X0), mh / (Y1 - Y0));
    const px = (v) => mx0 + (v - X0) * sk, py = (v) => my0 + mh - (v - Y0) * sk;
    x.fillStyle = '#17321f'; x.fillRect(mx0, my0, mw, mh);
    x.fillStyle = '#1d3b25';
    for (const [a, b, c, e] of [[-330, 120, 150, 190], [40, -60, 200, 110], [-120, 150, 180, 170]]) x.fillRect(px(a), py(b + e), c * sk, e * sk);
    x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
    for (let v = -300; v <= 400; v += 100) { x.beginPath(); x.moveTo(px(v), my0); x.lineTo(px(v), my0 + mh); x.stroke(); }
    for (let v = 0; v <= 300; v += 100) { x.beginPath(); x.moveTo(mx0, py(v)); x.lineTo(mx0 + mw, py(v)); x.stroke(); }
    x.fillStyle = '#4a4f55'; x.fillRect(px(-45), py(6), 80 * sk, 12 * sk);   // pist
    x.strokeStyle = '#f2c200'; x.lineWidth = 2; x.setLineDash([6, 4]);
    x.beginPath(); x.moveTo(px(0), py(0)); for (const [a, b] of WP) x.lineTo(px(a), py(b)); x.lineTo(px(0), py(0)); x.stroke();
    x.setLineDash([]);
    x.font = '700 11px "JetBrains Mono", monospace'; x.textAlign = 'center';
    WP.forEach(([a, b], i) => {
      x.fillStyle = i < sim.wp || sim.faz === 'bitti' ? '#2ea043' : '#f2c200';
      x.beginPath(); x.arc(px(a), py(b), 8, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#0d1b16'; x.fillText(String(i + 1), px(a), py(b) + 1);
    });
    x.fillStyle = '#fff'; x.font = '700 13px "Space Grotesk", sans-serif'; x.fillText('H', px(0), py(0) - 14);
    if (sim.iz.length > 1) {
      x.strokeStyle = '#39c5cf'; x.lineWidth = 2; x.beginPath();
      sim.iz.forEach(([a, b], i) => (i ? x.lineTo(px(a), py(b)) : x.moveTo(px(a), py(b))));
      x.lineTo(px(sim.x), py(sim.y)); x.stroke();
    }
    if (sim.faz !== 'yok') {
      x.save(); x.translate(px(sim.x), py(sim.y)); x.rotate(-sim.psi);
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(11, 0); x.lineTo(-7, -8); x.lineTo(-3, 0); x.lineTo(-7, 8); x.closePath(); x.fill();
      x.restore();
    }
    if (sim.loiter) { x.strokeStyle = 'rgba(210,153,34,0.8)'; x.beginPath(); x.arc(px(0), py(0), 60 * sk, 0, Math.PI * 2); x.stroke(); }
    // sağ sütun: telemetri
    const pus = ((90 - der(sim.psi)) % 360 + 360) % 360;
    const satir = [
      ['Faz', FAZ[sim.faz]], ['WP', sim.faz === 'gorev' ? `${sim.wp + 1} / ${WP.length}` : '—'],
      ['İrtifa', `${fmt(sim.h, 0)} m`], ['Hava hızı', `${fmt(sim.V, 1)} m/s`], ['Yön', `${fmt(pus, 0)}°`],
      ['Yatış', `${fmt(der(sim.phi), 0)}°`], ['Gaz', `%${fmt(thr * 100, 0)}`], ['Pil', `${fmt(volt, 1)} V · %${fmt(soc * 100, 0)}`],
    ];
    const cx = mx0 + mw + 12, cw = W - cx - 8, rh = mh / satir.length;
    satir.forEach(([k, v], i) => {
      const y = my0 + rh * (i + 0.5);
      if (i % 2) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(cx - 4, my0 + rh * i, cw + 8, rh); }
      x.fillStyle = '#9fb2c2'; x.font = `500 ${Math.round(rh * 0.42)}px "Space Grotesk", sans-serif`;
      x.textAlign = 'left'; x.fillText(k, cx, y);
      x.fillStyle = '#e6edf3'; x.font = `700 ${Math.round(rh * 0.44)}px "JetBrains Mono", monospace`;
      x.textAlign = 'right'; x.fillText(String(v), cx + cw, y);
    });
    x.fillStyle = SEVIYE[d.seviye] || '#6e7681'; x.fillRect(0, H - alt, W, alt);
    x.fillStyle = '#fff'; x.font = `700 ${Math.round(alt * 0.5)}px "Space Grotesk", sans-serif`;
    x.textAlign = 'center'; x.fillText(d.metin, W / 2, H - alt / 2);
  }

  function durumBilgi() {
    if (kill) return { metin: 'KILL · MOTOR KESİK', seviye: 'alarm' };
    if (failsafe) return { metin: mod === 'hitl' && ucuyor() ? 'FAILSAFE · RC YOK · EVE DÖNÜŞ' : 'FAILSAFE · RC YOK · MOTOR KESİK', seviye: 'uyari' };
    if (soc < 0.15) return { metin: `PİL ZAYIF · %${fmt(soc * 100, 0)}`, seviye: 'uyari' };
    if (pilIs) return { metin: 'PİL DEĞİŞİMİ', seviye: 'bekliyor' };
    if (mod === 'yuzey') {
      if (yuzeyT >= 0 && yuzeyT < 12) return { metin: `YÜZEY TESTİ · ${['AİLERON', 'ELEVATOR', 'RUDDER', 'KOMBİNE'][Math.floor(yuzeyT / 3)]}`, seviye: 'calisiyor' };
      if (yuzeyT >= 12) return { metin: 'YÜZEY TESTİ TAMAM', seviye: 'bekliyor' };
    }
    if (mod === 'hitl' && ucuyor()) {
      const ek = sim.faz === 'gorev' ? ` · WP ${sim.wp + 1}/${WP.length}` : '';
      return { metin: `HITL · ${FAZ[sim.faz]}${ek} · ${fmt(sim.h, 0)} m`, seviye: 'calisiyor' };
    }
    if (mod === 'hitl' && sim.faz === 'bitti') return { metin: 'HITL · GÖREV TAMAM', seviye: 'bekliyor' };
    if (armed && rpm > 100) return { metin: `İTKİ TESTİ · %${fmt(thr * 100, 0)} · ${fmt(itki, 0)} g`, seviye: 'calisiyor' };
    if (armed) return { metin: 'ARMED · HAZIR', seviye: 'uyari' };
    return { metin: 'DISARMED · HAZIR', seviye: 'bekliyor' };
  }

  const elle = () => { demo = false; demoSart = null; };
  const kontroller = [
    { tip: 'secim', metin: 'Test modu', secenekler: Object.entries(MODLAR), get: () => mod,
      set: (v) => { if (ucuyor() || rpm > 50 || pilIs) return; elle(); mod = v; yuzeyT = -1; motorProg = -1; sim.faz = 'yok'; } },
    { tip: 'butonlar', ogeler: [
      { metin: 'ARM', tur: 'basla', tik: () => { elle(); arm(); } },
      { metin: 'DISARM', tur: 'dur', tik: () => { elle(); disarm(); } },
    ] },
    { tip: 'butonlar', ogeler: [
      { metin: 'Testi başlat', tik: () => { elle(); baslat(); } },
      { metin: 'Durdur / RTL', tik: () => { elle(); durdur(); } },
      { metin: 'Pil değiştir', tik: () => { elle(); if (!armed && rpm < 50 && !pilIs) pilIs = { faz: 0, k: 0 }; } },
    ] },
    { tip: 'kaydirici', metin: 'Gaz (motor testi, ARM gerekir)', min: 0, max: 100, adim: 5, birim: '%', get: () => gaz,
      set: (v) => { gaz = v; motorProg = -1; } },
    { tip: 'anahtar', metin: 'Otomatik demo (yüzey → itki → HITL)', get: () => demo, set: (v) => { demo = v; demoSart = null; demoT = 0; demoGuncelle.sure = 0; } },
    { tip: 'baslik', metin: 'Güvenlik' },
    { tip: 'anahtar', metin: 'RC bağlantı kaybı (failsafe testi)', get: () => failsafe, set: (v) => { failsafe = v; elle(); } },
    { tip: 'butonlar', ogeler: [
      { metin: 'KILL (motor kes)', tur: 'acil', tik: () => { kill = true; armed = false; motorProg = -1; if (ucuyor()) sim.faz = 'bitti'; elle(); } },
      { metin: 'Reset', tik: () => { if (rpm < 50) kill = false; } },
    ] },
  ];

  return {
    id: 'iha',
    ad: 'Üniversite İHA Projesi',
    altBaslik: 'Temsili · sabit kanat · 2 m',
    kisa: 'Üniversitede İHA takımında yer aldığım sabit kanatlı uçağın temsili modeli: ≈2 m kanat açıklıklı, hazır alınan genel geçer bir gövde (yüksek kanat, itici pervane, çift kuyruk borusu, H-kuyruk). 2 m\'lik uçak salonda uçamayacağı için istasyon yer testlerini gösterir: yük hücreli itki tezgâhında kontrol yüzeyi testi, motor/itki ölçümü ve yer istasyonu haritasında izlenen HITL görev simülasyonu; RC bağlantısı kesilince eve dönüş (failsafe), KILL ile motor kesme.',
    proje: 'personal-projects',
    ayakIzi: [9.4, 7.8],
    ayakIziMerkez: [-0.1, -0.1],
    kamera: { poz: [1.8, 2.2, 3.65], hedef: [-0.15, 0.95, -0.3] },
    mekanizmalar: [
      'Kontrol yüzeyleri menteşe hatlarında döner: aileronlar ters yönde (yatış), elevator (yunuslama), çift rudder (sapma)',
      'Kontrol yüzeyi testi: aileron → elevator → rudder → kombine çubuk hareketi; yer istasyonunda kontrol listesi işaretlenir',
      'İtki testi: uçak yük hücreli kızakta; gaz %25-50-75-100 basamaklarında devir, itki (g), akım ve verim (g/W) ölçülür',
      'İtici pervane: düşük devirde pal görünür, yüksekte bulanık disk',
      'HITL: uçuş kontrolcüsü simülatöre bağlı; haritada ray fırlatma → tırmanış → 4 noktalı görev → eve dönüş → iniş; gerçek modelin yüzeyleri ve motoru komutları izler',
      'Failsafe: RC bağlantısı kesilince HITL uçağı eve döner ve üstünde tur atar, yer testinde motor kesilir; KILL motoru anında durdurur',
      'Pilot RC kumandayla izler; pil zayıflayınca şarj masasından yedek 4S LiPo\'yu getirip uçağa takar',
    ],
    cikarim: [
      'TEMSİLİ: Takımın uçağı sabit kanatlı, ≈2 m kanat açıklıklı, hazır alınan genel geçer bir modeldi. Gövde biçimi (yüksek kanat, itici pervane, çift kuyruk borusu, H-kuyruk) bu sınıfın yaygın hazır gövdelerinden temsilen seçildi.',
      'Değerler bu sınıf için tipik: 4S 5000 mAh LiPo, ≈2.7 kg kalkış ağırlığı, 12" itici pervane → ≈8600 rpm\'de ≈2.3 kg statik itki ve ≈48 A; seyir ≈16 m/s.',
      'Gerçek uçuş yerine yer testleri ve HITL gösteriliyor; simülasyon ×2.5, pil tüketimi ×8 hızlandırıldı.',
    ],
    group: g,
    sabitHaric: [pervane, disk, ...kanatcik, elevator, ...rudder, yedekPil, sarjEkran],
    update,
    kontroller,
    degerler: () => [
      ['Test modu', MODLAR[mod]],
      ['Durum', kill ? 'KILL' : armed ? 'ARMED' : 'DISARMED'],
      ['Yüzeyler A / E / R', `${fmt(der(yz.a), 0)}° / ${fmt(der(yz.e), 0)}° / ${fmt(der(yz.r), 0)}°`],
      ['Motor devri', `${fmt(rpm, 0)} rpm`],
      ['İtki (yük hücresi)', `${fmt(itki, 0)} g`],
      ['Pil (4S)', `${fmt(volt, 1)} V · ${fmt(akim, 1)} A · %${fmt(soc * 100, 0)}`],
      ['HITL', sim.faz === 'yok' ? '—' : `${FAZ[sim.faz]} · ${fmt(sim.h, 0)} m · ${fmt(sim.V, 1)} m/s`],
      ['RC bağlantısı', failsafe ? 'YOK (failsafe)' : 'RC + telemetri'],
    ],
    trend,
    durum: durumBilgi,
  };
}
