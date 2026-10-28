// js/gezgin.js — birinci şahıs gezinti: yürünebilir alan haritası, yol bulma, göz hizası kamera, girdiler.
//
// Harita: sahnedeki geometriden 0.2 m'lik ızgara. 0.2–1.85 m yüksekliğe uzanan her üçgen altındaki
// hücreleri "dolu" yapar (duvar, makine gövdesi, raf, çit, kolon...); ziyaretçi yarıçapı (0.32 m) kadar
// şişirilir; bina dışı dolu sayılır. Yer değiştiren şeyler engel değildir: operatör / işçi
// (userData.hareketli), kamyon / forklift (userData.gezGecer), güvercinler (dinamik örnek tamponu).
// Yol bulma: ince ızgarada A* (8 yön, köşe kesmez), ardından görüş hattıyla düzleştirme.
//
// Kontroller — masaüstü:
//   fare kilitli (oyun gibi): fare = bak, WASD / oklar = yürü, Shift = koş, tık = nişangâhtaki makineye
//     git, Esc = imleci serbest bırak (tarayıcı kuralı; sayfa engelleyemez).
//   imleç serbest: sürükle = bak (sahneyi tutup çeker gibi), makineye tık = git, boş yere tık = fare
//     kilidine dön, teker = ileri / geri adım.
// Dokunmatik: sol altta başparmak = sanal kumanda (yürü), başka yerde sürükle = bak, makineye dokun = git,
//   zemine dokun = oraya yürü.
// Otomatik yürüyüş (git): hedefe koridorlardan yürür, uzun yolda hızlanır; WASD / kumanda / Boşluk /
//   "Atla" keser ya da bitirir. Tıklama kararları (makine mi, zemin mi) main.js'te: olay.tik.

export function gezginKur({ THREE, scene, camera, canvas, sinirlar, tus, olay = {} }) {
  const GOZ = 1.65, HC = 0.2, BANT0 = 0.2, BANT1 = 1.85, R_KISI = 0.32;
  const YURU = 2.4, KOS = 6.0;
  const HASSAS_KILIT = 0.0022, HASSAS_SURUK = 0.0045, HASSAS_DOKUN = 0.006;
  const PITCH_MAX = 1.3;
  const dokunmatik = matchMedia('(hover: none) and (pointer: coarse)').matches;

  // ---------------------------------------------------------------- ızgara
  const X0 = Math.min(...sinirlar.map((s) => s.x0)) - 1, X1 = Math.max(...sinirlar.map((s) => s.x1)) + 1;
  const Z0 = Math.min(...sinirlar.map((s) => s.z0)) - 1, Z1 = Math.max(...sinirlar.map((s) => s.z1)) + 1;
  const NX = Math.ceil((X1 - X0) / HC), NZ = Math.ceil((Z1 - Z0) / HC), N = NX * NZ;
  const ham = new Uint8Array(N);     // 1: geometri / bina dışı
  const yurur = new Uint8Array(N);   // 1: ziyaretçinin merkezi burada durabilir (şişirilmiş)
  const ulas = new Uint8Array(N);    // 1: girişten yürüyerek ulaşılabilir (korkulukla çevrili alanlar 0)
  let ulasVar = false;
  const hi = (x) => Math.floor((x - X0) / HC), hj = (z) => Math.floor((z - Z0) / HC);
  const serbestH = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && yurur[j * NX + i] === 1;
  const serbest = (x, z) => serbestH(hi(x), hj(z));
  const isaret = (i, j) => { if (i >= 0 && j >= 0 && i < NX && j < NZ) ham[j * NX + i] = 1; };

  function parca(ax, az, bx, bz) {          // doğru parçası (dik duvar, ince üçgen kenarı)
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (HC * 0.5)));
    for (let k = 0; k <= n; k++) { const s = k / n; isaret(hi(ax + (bx - ax) * s), hj(az + (bz - az) * s)); }
  }
  function ucgen(ax, ay, az, bx, by, bz, cx, cy, cz) {
    if (Math.max(ay, by, cy) < BANT0 || Math.min(ay, by, cy) > BANT1) return;
    const i0 = hi(Math.min(ax, bx, cx)), i1 = hi(Math.max(ax, bx, cx));
    const j0 = hj(Math.min(az, bz, cz)), j1 = hj(Math.max(az, bz, cz));
    if (i1 < 0 || j1 < 0 || i0 >= NX || j0 >= NZ) return;
    if (i1 - i0 <= 1 && j1 - j0 <= 1) { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) isaret(i, j); return; }
    const A2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const lab = Math.hypot(bx - ax, bz - az), lbc = Math.hypot(cx - bx, cz - bz), lca = Math.hypot(ax - cx, az - cz);
    if (Math.abs(A2) < Math.max(lab, lbc, lca) * HC * 0.5) {   // izdüşümü ince (dik yüz): kenarları çiz
      parca(ax, az, bx, bz); parca(bx, bz, cx, cz); parca(cx, cz, ax, az); return;
    }
    const s = Math.sign(A2), pay = -HC * 0.71;                 // hücreye değen her hücre (yarı köşegen payı)
    for (let j = Math.max(0, j0); j <= Math.min(NZ - 1, j1); j++) {
      const pz = Z0 + (j + 0.5) * HC;
      for (let i = Math.max(0, i0); i <= Math.min(NX - 1, i1); i++) {
        const px = X0 + (i + 0.5) * HC;
        if (s * ((bx - ax) * (pz - az) - (bz - az) * (px - ax)) / lab < pay) continue;
        if (s * ((cx - bx) * (pz - bz) - (cz - bz) * (px - bx)) / lbc < pay) continue;
        if (s * ((ax - cx) * (pz - cz) - (az - cz) * (px - cx)) / lca < pay) continue;
        ham[j * NX + i] = 1;
      }
    }
  }
  let wb = new Float32Array(3 * 4096);
  function meshTara(geo, mw) {
    const pos = geo.attributes.position, n = pos.count;
    if (wb.length < n * 3) wb = new Float32Array(Math.ceil(n * 1.5) * 3);
    const e = mw.elements;
    let ymin = Infinity, ymax = -Infinity;
    for (let k = 0; k < n; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      wb[k * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      wb[k * 3 + 1] = wy;
      wb[k * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (wy < ymin) ymin = wy;
      if (wy > ymax) ymax = wy;
    }
    if (ymax < BANT0 || ymin > BANT1) return 0;
    const idx = geo.index, tn = Math.floor((idx ? idx.count : n) / 3);
    for (let t = 0; t < tn; t++) {
      const a = (idx ? idx.getX(t * 3) : t * 3) * 3, b = (idx ? idx.getX(t * 3 + 1) : t * 3 + 1) * 3, c = (idx ? idx.getX(t * 3 + 2) : t * 3 + 2) * 3;
      ucgen(wb[a], wb[a + 1], wb[a + 2], wb[b], wb[b + 1], wb[b + 2], wb[c], wb[c + 1], wb[c + 2]);
    }
    return tn;
  }
  // tohum: girişteki nokta; oradan yürüyerek ulaşılabilen hücreler işaretlenir (duruş / ışınlanma noktaları
  // yalnız buraya oturur — kapalı alana düşüp mahsur kalınmaz)
  function haritaKur(tohum = null) {
    const t0 = performance.now();
    ham.fill(0);
    scene.updateMatrixWorld(true);
    const m4 = new THREE.Matrix4(), mi = new THREE.Matrix4();
    let ucgenSay = 0;
    // ışık huzmesi / görüş konisi gibi görsel hacimler (saydam, derinlik yazmayan düz malzeme) engel değil;
    // cam (MeshStandardMaterial) engeldir
    const efekt = (m) => m && !Array.isArray(m) && m.isMeshBasicMaterial && m.transparent && m.depthWrite === false;
    const tara = (o) => {
      if (o.userData.hareketli || o.userData.gezGecer || o.isSprite || o.isPoints || o.isLine || o.name === 'vr-rig') return;
      if (o.isMesh && o.geometry?.attributes?.position && !efekt(o.material)) {
        if (o.isInstancedMesh) {
          if (o.instanceMatrix.usage !== THREE.DynamicDrawUsage) {
            for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, mi); ucgenSay += meshTara(o.geometry, m4.multiplyMatrices(o.matrixWorld, mi)); }
          }
        } else ucgenSay += meshTara(o.geometry, o.matrixWorld);
      }
      for (const c of o.children) tara(c);
    };
    tara(scene);
    for (let j = 0; j < NZ; j++) {                // bina dışı
      const z = Z0 + (j + 0.5) * HC;
      for (let i = 0; i < NX; i++) {
        const x = X0 + (i + 0.5) * HC;
        if (!sinirlar.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1)) ham[j * NX + i] = 1;
      }
    }
    const r = R_KISI / HC, rr = Math.ceil(r), ofs = [];
    for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) if (di * di + dj * dj <= r * r) ofs.push(dj * NX + di, di);
    yurur.fill(1);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      if (!ham[j * NX + i]) continue;
      const c = j * NX + i;
      for (let k = 0; k < ofs.length; k += 2) {
        const di = ofs[k + 1], n = c + ofs[k];
        if (i + di >= 0 && i + di < NX && n >= 0 && n < N) yurur[n] = 0;
      }
    }
    ulas.fill(0); ulasVar = false;
    let ulasSay = 0;
    if (tohum) {
      const ti = hi(tohum.x), tj = hj(tohum.z);
      if (serbestH(ti, tj)) {
        const kuyruk = new Int32Array(N);
        let bas = 0, son = 0;
        kuyruk[son++] = tj * NX + ti; ulas[tj * NX + ti] = 1;
        while (bas < son) {
          const c = kuyruk[bas++], ci = c % NX, cj = (c - ci) / NX;
          for (let k = 0; k < 4; k++) {
            const ni = ci + DI[k], nj = cj + DJ[k];
            if (!serbestH(ni, nj)) continue;
            const n = nj * NX + ni;
            if (!ulas[n]) { ulas[n] = 1; kuyruk[son++] = n; }
          }
        }
        ulasSay = son; ulasVar = true;
      }
    }
    let ser = 0; for (let k = 0; k < N; k++) ser += yurur[k];
    return { ms: Math.round(performance.now() - t0), ucgen: ucgenSay, hucre: N, serbestOran: +(ser / N).toFixed(3), ulasOran: +(ulasSay / Math.max(1, ser)).toFixed(3) };
  }
  const hedefOlur = (i, j) => serbestH(i, j) && (!ulasVar || ulas[j * NX + i] === 1);

  // En yakın serbest ve girişten ulaşılabilir hücre (halka halka arar, en fazla R m)
  function enYakin(x, z, R = 10) {
    const ci = hi(x), cj = hj(z);
    if (hedefOlur(ci, cj)) return { i: ci, j: cj, x, z };
    const rm = Math.ceil(R / HC);
    for (let r = 1; r <= rm; r++) {
      let iyi = null, iyiD = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !hedefOlur(ci + di, cj + dj)) continue;
        const d = di * di + dj * dj;
        if (d < iyiD) { iyiD = d; iyi = { i: ci + di, j: cj + dj }; }
      }
      if (iyi) return { ...iyi, x: X0 + (iyi.i + 0.5) * HC, z: Z0 + (iyi.j + 0.5) * HC };
    }
    return null;
  }
  // a → b hareketi: duvara çarpınca eksen boyunca kayar. Ziyaretçi dolu hücredeyse (ışınlanma vb.) serbest.
  function kaydir(ax, az, bx, bz) {
    if (serbest(bx, bz) || !serbest(ax, az)) return [bx, bz];
    if (serbest(bx, az)) return [bx, az];
    if (serbest(ax, bz)) return [ax, bz];
    return [ax, az];
  }
  function gorus(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (HC * 0.4));
    for (let k = 1; k < n; k++) { const s = k / n; if (!serbest(ax + (bx - ax) * s, az + (bz - az) * s)) return false; }
    return true;
  }

  // ---------------------------------------------------------------- A*
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
  let AS = null;
  function yolBul(sx, sz, hx, hz) {
    const s = enYakin(sx, sz), h = enYakin(hx, hz);
    if (!s || !h) return null;
    if (!AS) AS = { g: new Float32Array(N), from: new Int32Array(N), kapali: new Uint8Array(N) };
    const { g, from, kapali } = AS;
    g.fill(Infinity); kapali.fill(0);
    const si = s.j * NX + s.i, gi = h.j * NX + h.i;
    const yi = [], yf = [];                       // ikili yığın (indis, f)
    const it = (idx, f) => {
      let k = yi.length; yi.push(idx); yf.push(f);
      while (k > 0) { const p = (k - 1) >> 1; if (yf[p] <= f) break; yi[k] = yi[p]; yf[k] = yf[p]; k = p; }
      yi[k] = idx; yf[k] = f;
    };
    const al = () => {
      const top = yi[0], li = yi.pop(), lf = yf.pop();
      if (yi.length) {
        let k = 0; const n = yi.length;
        for (;;) {
          let c = 2 * k + 1; if (c >= n) break;
          if (c + 1 < n && yf[c + 1] < yf[c]) c++;
          if (yf[c] >= lf) break;
          yi[k] = yi[c]; yf[k] = yf[c]; k = c;
        }
        yi[k] = li; yf[k] = lf;
      }
      return top;
    };
    const Hs = (i, j) => { const dx = Math.abs(i - h.i), dz = Math.abs(j - h.j); return (dx + dz - 0.5858 * Math.min(dx, dz)) * 1.15; };
    g[si] = 0; from[si] = -1; it(si, Hs(s.i, s.j));
    let bulundu = false, adim = 0;
    while (yi.length) {
      const c = al();
      if (kapali[c]) continue;
      kapali[c] = 1;
      if (c === gi) { bulundu = true; break; }
      if (++adim > 600000) break;
      const ci = c % NX, cj = (c - ci) / NX;
      for (let k = 0; k < 8; k++) {
        const ni = ci + DI[k], nj = cj + DJ[k];
        if (!serbestH(ni, nj)) continue;
        if (k >= 4 && (!serbestH(ni, cj) || !serbestH(ci, nj))) continue;   // köşe kesme
        const n = nj * NX + ni;
        if (kapali[n]) continue;
        const ng = g[c] + (k >= 4 ? 1.4142 : 1);
        if (ng < g[n]) { g[n] = ng; from[n] = c; it(n, ng + Hs(ni, nj)); }
      }
    }
    if (!bulundu) return null;
    const p = [];
    for (let c = gi; c !== -1; c = from[c]) p.push([X0 + ((c % NX) + 0.5) * HC, Z0 + (Math.floor(c / NX) + 0.5) * HC]);
    p.reverse();
    if (serbest(sx, sz)) p[0] = [sx, sz];
    if (serbest(hx, hz)) p[p.length - 1] = [hx, hz];
    if (p.length <= 2) return p;
    const out = [p[0]];                            // görüş hattıyla düzleştir
    let a = 0;
    for (let k = 2; k < p.length; k++) if (!gorus(p[a][0], p[a][1], p[k][0], p[k][1])) { out.push(p[k - 1]); a = k - 1; }
    out.push(p[p.length - 1]);
    return out;
  }

  // ---------------------------------------------------------------- durum + kamera
  const P = { x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, itme: 0, faz: 0, bakisT: 0 };
  let etkin = false, kilitli = false, kilitAcT = 0, yol = null, gecis = null;
  const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion();
  const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ileriV = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
  const yawYon = (dx, dz) => Math.atan2(-dx, -dz);

  function kameraYaz(bob = 0) {
    camera.position.set(P.x, GOZ + bob, P.z);
    camera.quaternion.setFromEuler(_e.set(P.pitch, P.yaw, 0, 'YXZ'));
    camera.updateMatrixWorld();
  }
  function isinla(x, z, yaw = P.yaw, pitch = 0) {
    const s = enYakin(x, z) || { x, z };
    Object.assign(P, { x: s.x, z: s.z, yaw, pitch: clamp(pitch, -PITCH_MAX, PITCH_MAX), vx: 0, vz: 0, itme: 0 });
    yolBitir(false);
    gecis = null;
    kameraYaz();
  }
  // Kuş bakışından ya da herhangi bir kamera duruşundan göz hizasına yumuşak iniş
  function inis(x, z, yaw, pitch = -0.05, sure = 1.4) {
    const s = enYakin(x, z) || { x, z };
    Object.assign(P, { x: s.x, z: s.z, yaw, pitch, vx: 0, vz: 0, itme: 0 });
    yolBitir(false);
    gecis = { p0: camera.position.clone(), q0: camera.quaternion.clone(), p1: new THREE.Vector3(s.x, GOZ, s.z),
      q1: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), k: 0, sure };
  }

  // ---------------------------------------------------------------- otomatik yürüyüş
  function git(h, { ad = '', bitince = null } = {}) {
    const p = yolBul(P.x, P.z, h.x, h.z);
    const bakYaw = h.yaw ?? null, bakPitch = h.pitch ?? null;
    if (!p) { isinla(h.x, h.z, bakYaw ?? P.yaw, bakPitch ?? 0); olay.yolculuk?.(null); bitince?.(); return false; }
    const L = [0];
    for (let k = 1; k < p.length; k++) L.push(L[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
    const toplam = L[L.length - 1];
    const T = clamp(2 + toplam / 6, 3, 16);
    yol = { p, L, toplam, s: 0, v: 0, vMax: clamp(toplam / T, 1.6, 12), bakYaw, bakPitch, ad, bitince, sonT: 0 };
    P.vx = P.vz = 0;
    olay.yolculuk?.({ ad, kalan: toplam });
    return true;
  }
  function noktaAt(s) {
    const { p, L } = yol;
    let k = 1;
    while (k < L.length - 1 && L[k] < s) k++;
    const u = L[k] > L[k - 1] ? clamp((s - L[k - 1]) / (L[k] - L[k - 1]), 0, 1) : 1;
    return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u];
  }
  function yolBitir(tamam) {
    if (!yol) return;
    const f = yol.bitince;
    yol = null;
    olay.yolculuk?.(null);
    if (tamam) f?.();
  }
  function atla() {
    if (!yol) return;
    const [x, z] = yol.p[yol.p.length - 1];
    Object.assign(P, { x, z, vx: 0, vz: 0 });
    if (yol.bakYaw != null) P.yaw = yol.bakYaw;
    if (yol.bakPitch != null) P.pitch = yol.bakPitch;
    olay.karart?.();
    yolBitir(true);
    kameraYaz();
  }
  function yolAdim(dt) {
    const kalan = yol.toplam - yol.s;
    const [x, z] = noktaAt(yol.s);
    const [lx, lz] = noktaAt(Math.min(yol.toplam, yol.s + 2.2));
    let hYaw = Math.hypot(lx - x, lz - z) > 0.05 ? yawYon(lx - x, lz - z) : P.yaw, hPitch = -0.04;
    const k = clamp(1 - kalan / 2.6, 0, 1);          // son metrelerde makineye dön
    if (k > 0 && yol.bakYaw != null) { hYaw = hYaw + sar(yol.bakYaw - hYaw) * k; hPitch = hPitch + ((yol.bakPitch ?? hPitch) - hPitch) * k; }
    const hata = Math.abs(sar(hYaw - P.yaw));
    // hız: ivmelen, durabilecek şekilde yavaşla, dönemeçte / ters bakarken yavaş
    const fren = Math.sqrt(2 * 2.4 * kalan);
    let hv = Math.min(yol.vMax, fren);
    if (hata > 0.9 && P.bakisT <= 0) hv = Math.min(hv, 0.4);
    else if (hata > 0.35) hv = Math.min(hv, yol.vMax * 0.55);
    yol.v += clamp(hv - yol.v, -6 * dt, 3.2 * dt);
    yol.s = Math.min(yol.toplam, yol.s + Math.max(0, yol.v) * dt);
    [P.x, P.z] = noktaAt(yol.s);
    if (P.bakisT <= 0) {                              // kullanıcı bakınıyorsa bakışı ona bırak
      P.yaw += clamp(sar(hYaw - P.yaw) * (1 - Math.exp(-5 * dt)), -2.6 * dt, 2.6 * dt);
      P.pitch += (hPitch - P.pitch) * (1 - Math.exp(-4 * dt));
    }
    olay.yolculuk?.({ ad: yol.ad, kalan: Math.max(0, kalan) });
    if (yol.s >= yol.toplam) {
      yol.sonT += dt;
      const donuk = yol.bakYaw == null || (Math.abs(sar(yol.bakYaw - P.yaw)) < 0.03 && Math.abs((yol.bakPitch ?? P.pitch) - P.pitch) < 0.03);
      if (donuk || yol.sonT > 1.6 || P.bakisT > 0) yolBitir(true);
    }
    return Math.max(0, yol ? yol.v : 0);
  }

  // ---------------------------------------------------------------- kare
  const joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  function update(dt) {
    if (!etkin) return;
    if (gecis) {
      gecis.k = Math.min(1, gecis.k + dt / gecis.sure);
      const e = gecis.k < 0.5 ? 2 * gecis.k * gecis.k : 1 - Math.pow(-2 * gecis.k + 2, 2) / 2;
      camera.position.lerpVectors(gecis.p0, gecis.p1, e);
      camera.quaternion.slerpQuaternions(gecis.q0, gecis.q1, e);
      camera.updateMatrixWorld();
      if (gecis.k >= 1) { gecis = null; kameraYaz(); }
      return;
    }
    P.bakisT = Math.max(0, P.bakisT - dt);
    let ileri = 0, yan = 0, don = 0;
    if (tus.has('w') || tus.has('arrowup')) ileri += 1;
    if (tus.has('s') || tus.has('arrowdown')) ileri -= 1;
    if (tus.has('d')) yan += 1;
    if (tus.has('a')) yan -= 1;
    if (tus.has('arrowleft')) don += 1;
    if (tus.has('arrowright')) don -= 1;
    let buyukluk = Math.min(1, Math.hypot(ileri, yan));
    if (joy.id != null) { ileri -= joy.y; yan += joy.x; buyukluk = Math.min(1, Math.hypot(joy.x, joy.y)); }
    const elle = buyukluk > 0.05 || Math.abs(P.itme) > 0.01;
    if (elle && yol) yolBitir(false);            // kullanıcı yürümeye başlarsa otomatik yürüyüş biter
    if (don) P.yaw += don * 1.9 * dt;
    let hiz;
    if (yol) hiz = yolAdim(dt);
    else {
      const kos = tus.has('shift') || (joy.id != null && buyukluk > 0.95);
      const [fx, fz] = ileriV(P.yaw), rx = -fz, rz = fx;      // sağ = (cos, -sin)
      let dx = fx * ileri + rx * yan, dz = fz * ileri + rz * yan;
      const L = Math.hypot(dx, dz);
      const hv = (kos ? KOS : YURU) * buyukluk;
      if (L > 1e-4) { dx *= hv / L; dz *= hv / L; } else { dx = 0; dz = 0; }
      const a = 1 - Math.exp(-(L > 1e-4 ? 9 : 12) * dt);
      P.vx += (dx - P.vx) * a; P.vz += (dz - P.vz) * a;
      if (Math.abs(P.itme) > 0.005) {             // teker: kısa ileri / geri adım (hız biriktirmez, doğrudan konum)
        const s = P.itme * Math.min(1, dt * 8);
        P.itme -= s;
        [P.x, P.z] = kaydir(P.x, P.z, P.x + fx * s, P.z + fz * s);
      }
      const [nx, nz] = kaydir(P.x, P.z, P.x + P.vx * dt, P.z + P.vz * dt);
      if (nx === P.x && Math.abs(P.vx) > 0) P.vx *= 0.5;
      if (nz === P.z && Math.abs(P.vz) > 0) P.vz *= 0.5;
      P.x = nx; P.z = nz;
      hiz = Math.hypot(P.vx, P.vz);
    }
    // adım salınımı: yürürken hafif, koşarken/uçar gibi hızlarda sönük
    P.faz += dt * hiz * 2.3;
    const genlik = 0.022 * Math.min(1, hiz / 2.4) * clamp((7 - hiz) / 3, 0, 1);
    kameraYaz(Math.sin(P.faz * 2) * genlik);
  }

  // ---------------------------------------------------------------- girdiler
  function bak(dx, dy) {
    P.yaw = sar(P.yaw + dx);
    P.pitch = clamp(P.pitch + dy, -PITCH_MAX, PITCH_MAX);
    if (yol) P.bakisT = 1.6;
  }
  function kilitle() {
    if (dokunmatik || !canvas.requestPointerLock || kilitli) return;
    if (performance.now() - kilitAcT < 1100) return;        // tarayıcı Esc'ten hemen sonra izin vermez
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      p?.catch?.(() => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {} });
    } catch { try { canvas.requestPointerLock(); } catch {} }
  }
  function kilitAc() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
  document.addEventListener('pointerlockchange', () => {
    const k = document.pointerLockElement === canvas;
    if (kilitli && !k) kilitAcT = performance.now();
    kilitli = k;
    olay.kilit?.(k);
  });
  document.addEventListener('pointerlockerror', () => olay.kilit?.(false));
  document.addEventListener('mousemove', (e) => {
    if (!etkin || !kilitli || gecis) return;
    bak(-clamp(e.movementX, -160, 160) * HASSAS_KILIT, -clamp(e.movementY, -160, 160) * HASSAS_KILIT);
  });

  const parmak = new Map();
  const joyEl = document.createElement('div');
  joyEl.id = 'joy'; joyEl.hidden = true;
  joyEl.innerHTML = '<div class="joy-dugme"></div>';
  document.body.appendChild(joyEl);
  const JOY_R = 52;
  canvas.addEventListener('pointerdown', (e) => {
    if (!etkin) return;
    olay.dokunus?.();
    if (kilitli) { if (e.button === 0) olay.tik?.({ merkez: true }); return; }
    const dok = e.pointerType !== 'mouse';
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (dok && joy.id == null && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.38) {
      Object.assign(joy, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      joyEl.firstChild.style.transform = 'translate(-50%,-50%)';
      joyEl.hidden = false;
      return;
    }
    parmak.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), oynadi: false, dok, tus: e.button });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!etkin) return;
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
      const L = Math.hypot(dx, dy);
      if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
      joy.x = dx / JOY_R; joy.y = dy / JOY_R;
      joyEl.firstChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const p = parmak.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.oynadi && Math.hypot(p.x - p.x0, p.y - p.y0) > (p.dok ? 9 : 4)) p.oynadi = true;
    if (p.oynadi) { const k = p.dok ? HASSAS_DOKUN : HASSAS_SURUK; bak(dx * k, dy * k); }
  });
  const birak = (e) => {
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyEl.hidden = true; return; }
    const p = parmak.get(e.pointerId);
    if (!p) return;
    parmak.delete(e.pointerId);
    if (e.type === 'pointerup' && !p.oynadi && p.tus === 0 && performance.now() - p.t0 < 700 && etkin) {
      olay.tik?.({ x: e.clientX, y: e.clientY, dok: p.dok });
    }
  };
  canvas.addEventListener('pointerup', birak);
  canvas.addEventListener('pointercancel', birak);
  canvas.addEventListener('contextmenu', (e) => { if (etkin) e.preventDefault(); });
  canvas.addEventListener('wheel', (e) => {
    if (!etkin) return;
    e.preventDefault();
    P.itme = clamp(P.itme - Math.sign(e.deltaY) * 0.8, -3, 3);
  }, { passive: false });
  window.addEventListener('blur', () => { joy.id = null; joy.x = joy.y = 0; joyEl.hidden = true; parmak.clear(); });

  return {
    GOZ,
    haritaKur, serbest, enYakin, kaydir, yolBul, gorus,
    isinla, inis, git, atla, iptal: () => yolBitir(false), update, kilitle, kilitAc,
    get etkin() { return etkin; },
    set etkin(v) { etkin = v; if (!v) { kilitAc(); joy.id = null; joyEl.hidden = true; parmak.clear(); yolBitir(false); } },
    get kilitli() { return kilitli; },
    get yolda() { return !!yol; },
    get gecisde() { return !!gecis; },
    get konum() { return { x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch }; },
    ileri(m = 4) { const [fx, fz] = ileriV(P.yaw); return new THREE.Vector3(P.x + fx * m, GOZ, P.z + fz * m); },
    bakis: { yawYon },
    // hata ayıklama / test: ızgarayı PNG'ye dök (yeşil = yürünebilir, mavi = kapalı alan, koyu = dolu)
    haritaResmi() {
      const c = document.createElement('canvas'); c.width = NX; c.height = NZ;
      const x = c.getContext('2d'), id = x.createImageData(NX, NZ);
      for (let k = 0; k < N; k++) {
        const o = k * 4, y = yurur[k], h = ham[k], u = !ulasVar || ulas[k];   // mavi: yürünür ama girişten ulaşılamaz
        id.data[o] = h ? 40 : y ? (u ? 70 : 60) : 150; id.data[o + 1] = h ? 44 : y ? (u ? 170 : 110) : 110; id.data[o + 2] = h ? 52 : y ? (u ? 90 : 190) : 60; id.data[o + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      return { url: c.toDataURL('image/png'), X0, Z0, HC, NX, NZ };
    },
  };
}
