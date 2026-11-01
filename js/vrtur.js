// js/vrtur.js — VR'da otomatik fabrika turu: biri fabrikayı gezdiriyormuş gibi, durak durak.
//
// Rota bir halka: kuzey sırası batıdan doğuya → B holü → C holü → güney sırası doğudan batıya → girişe
// dönüp baştan. Her makinede 2–4 durak: ön taraf (main durusNoktasi), HMI ekranı (makinenin en büyük
// lib.Ekran'ı, ~1 m önü), sol ve sağ yan (ya da köşe; ayak izinden). Duraklar arası yol gezgin.yolBul
// (A*) ile koridorlardan; yollar tur başlarken kare başına birer tane hazırlanır (Quest'te takılmasın).
//
// Rahatlık (mide) kuralları:
//  - Rig kafa konumuna "oturtulmaz", yol üzerindeki adım farkı kadar taşınır: kullanıcının eğilmesi,
//    etrafa bakması iptal edilmez.
//  - Dönüş yalnız Y ekseninde, kafanın etrafında, en çok AYAR.donus (30°/sn); hedef yön turdan gelir,
//    kullanıcının baktığı yerden türetilmez (h0 yalnız başlarken/devam ederken bir kez okunur).
//  - Uzun yolda önce dur-dön, sonra yürü; durağa varınca dur-dön, sonra bekle. Kısa (makine çevresi)
//    yolda dönmeden yan yan kayar. Sabit hız + kısa rampa; hareket ederken kenarlar kararır (vinyet).
//  - Panelden başka makineye geçiş: karartarak ışınlanma.
// Kontrol: SOL tetik başlat/durdur (vr.js); paneldeki ⏮ ▶/⏸ ⏭, hız, makine listesi.

import * as THREE from 'three';

export const AYAR = {
  // 23 makine, ~91 durak, ~760 m: normal hızda bir tur ~12 dk, "Hızlı"da ~8 dk
  bekle: { on: 2.2, hmi: 2.4, yan: 1.3 },   // durakta bekleme (sn, yönelim bittikten sonra)
  hiz: { yakin: 1.5, koridor: 3.0 },       // m/sn: makine çevresi / makineler arası
  ivme: 1.5,                               // m/sn²
  donus: THREE.MathUtils.degToRad(30),     // en hızlı yumuşak dönüş (rad/sn)
  sicrama: THREE.MathUtils.degToRad(75),   // bundan büyük dönüş yumuşak değil, kısa karartmayla tek seferde
  uzunYol: 12,                             // bundan uzun yolda önce yürüme yönüne dönülür
  hmiMesafe: 0.95,                         // ekranın önünde durulacak uzaklık (m)
  yanPay: 2.2,                             // ayak izinin dışına pay (m)
  geriSayim: 3,
  hizli: 1.6,                              // "Hızlı" modda hız çarpanı (bekleme 1/çarpan)
};

const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawYon = (dx, dz) => Math.atan2(-dx, -dz);
const clamp = THREE.MathUtils.clamp;

export function turKur({ scene, camera, rig, makineler, gezgin, durusNoktasi, rigDondur, isinlan,
  panelYap, dugme, R, olay = {} }) {
  const _h = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

  // ---------------------------------------------------------------- rota
  let D = [];            // duraklar: { mk, mi, tur, ad, x, z, bak, nesne?, bekle }
  let mBas = [];         // makine sırası → ilk durak indisi
  let sira = [];         // tur sırasındaki makineler
  let yollar = [];       // yollar[i]: D[i-1] → D[i] hazır yol
  let hazirlaI = 0;

  function sirala() {
    const k = makineler.filter(Boolean);
    const kuzey = k.filter((x) => x.yer.z < 0).sort((a, b) => a.yer.x - b.yer.x);
    const guney = k.filter((x) => x.yer.z >= 0).sort((a, b) => b.yer.x - a.yer.x);
    return [...kuzey, ...guney];
  }
  function hmiDurak(x) {
    // operatör hizasındaki en büyük ekran (arkadaki yüksek SCADA monitörü değil)
    let en = null, A = 0.03;
    const p = new THREE.Vector3();
    x.kok.updateMatrixWorld(true);
    x.kok.traverse((o) => {
      const h = o.userData.hmi;
      if (!h || !o.isMesh || h.w * h.h <= A) return;
      o.getWorldPosition(p);
      if (p.y < 0.45 || p.y > 2.3) return;
      A = h.w * h.h; en = o;
    });
    if (!en) return null;
    en.getWorldPosition(p);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(en.matrixWorld); n.y = 0;
    if (n.lengthSq() < 0.1) return null;
    n.normalize();
    const L = AYAR.hmiMesafe + Math.max(en.userData.hmi.w, en.userData.hmi.h) * 0.6;
    const hx = p.x + n.x * L, hz = p.z + n.z * L;
    const s = gezgin.enYakin(hx, hz, 1.5);
    if (!s || Math.hypot(s.x - hx, s.z - hz) > 1.2) return null;
    return { tur: 'hmi', ad: 'HMI ekranı', x: s.x, z: s.z, bak: p, nesne: en, bekle: AYAR.bekle.hmi };
  }
  function yanDuraklar(x, mevcut) {
    const [w, d] = x.m.ayakIzi || [6, 6], [cx, cz] = x.m.ayakIziMerkez || [0, 0], p = AYAR.yanPay;
    // makinenin önü yerel +Z; önüne bakan ziyaretçinin sağı yerel +X
    const aday = [
      { ad: 'Sol yan', taraf: 'sol', l: [cx - w / 2 - p, cz] },
      { ad: 'Sağ yan', taraf: 'sag', l: [cx + w / 2 + p, cz] },
      { ad: 'Sol arka köşe', taraf: 'sol', l: [cx - w / 2 - p * 0.7, cz - d / 2 - p * 0.7] },
      { ad: 'Sağ arka köşe', taraf: 'sag', l: [cx + w / 2 + p * 0.7, cz - d / 2 - p * 0.7] },
      { ad: 'Sol ön köşe', taraf: 'sol', l: [cx - w / 2 - p * 0.7, cz + d / 2 + p * 0.7] },
      { ad: 'Sağ ön köşe', taraf: 'sag', l: [cx + w / 2 + p * 0.7, cz + d / 2 + p * 0.7] },
    ];
    x.kok.updateMatrixWorld(true);
    const merkez = x.kok.localToWorld(new THREE.Vector3(cx, 0, cz));
    merkez.y = clamp(x.kure.center.y, 0.9, 1.8);
    const sec = [];
    for (const a of aday) {
      if (sec.length >= 2 || sec.some((q) => q.taraf === a.taraf)) continue;
      const w3 = x.kok.localToWorld(new THREE.Vector3(a.l[0], 0, a.l[1]));
      const s = gezgin.enYakin(w3.x, w3.z, 2);
      if (!s || Math.hypot(s.x - w3.x, s.z - w3.z) > 1.8) continue;
      // aynı makinenin ve önceki makinelerin duraklarıyla çakışmasın (iki makine arasındaki boşlukta
      // ikisinin de "yan" durağı olmasın: aynı yerde 180° dönmek yerine o taraf için köşe denenir)
      if ([...mevcut, ...sec].some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 3)) continue;
      if (D.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 4)) continue;
      sec.push({ tur: 'yan', ad: a.ad, taraf: a.taraf, x: s.x, z: s.z, bak: merkez, bekle: AYAR.bekle.yan });
    }
    return sec;
  }
  function rotaKur() {
    sira = sirala();
    D = []; mBas = [];
    let px = null, pz = null;
    sira.forEach((x, mi) => {
      const d = durusNoktasi(x);
      const ds = [{ tur: 'on', ad: 'Ön taraf', x: d.x, z: d.z, bak: d.hedef.clone(), bekle: x.m.tur?.bekle ?? AYAR.bekle.on }];
      try { const h = hmiDurak(x); if (h) ds.push(h); } catch (e) { console.warn('[tur] hmi', x.m.id, e); }
      try { ds.push(...yanDuraklar(x, ds)); } catch (e) { console.warn('[tur] yan', x.m.id, e); }
      // yürüyerek gezer gibi: önceki noktaya en yakından başla, sonra hep en yakın durak
      const sirali = [];
      let kx = px ?? ds[0].x, kz = pz ?? ds[0].z;
      while (ds.length) {
        let en = 0, enD = Infinity;
        ds.forEach((q, i) => { const dd = Math.hypot(q.x - kx, q.z - kz); if (dd < enD) { enD = dd; en = i; } });
        const q = ds.splice(en, 1)[0];
        sirali.push(q); kx = q.x; kz = q.z;
      }
      mBas.push(D.length);
      for (const q of sirali) D.push({ ...q, mk: x, mi });
      px = kx; pz = kz;
    });
    yollar = new Array(D.length).fill(null);
    hazirlaI = 0;
  }
  // kare başına bir yol (A* Quest'te uzun koridorda onlarca ms sürebilir)
  function hazirla() {
    if (hazirlaI >= D.length) return;
    const i = hazirlaI++, a = D[(i - 1 + D.length) % D.length], b = D[i];
    yollar[i] = gezgin.yolBul(a.x, a.z, b.x, b.z);
  }

  // ---------------------------------------------------------------- görsel: vinyet + karartma
  function vinyetDokusu() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv); return t;
  }
  const kameraUstu = (mat, z, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    m.position.z = z; m.renderOrder = 1000; m.frustumCulled = false; m.visible = false;
    camera.add(m);
    return m;
  };
  const vinyet = kameraUstu(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: vinyetDokusu(), transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), -0.12, 0.42);
  const karart = kameraUstu(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), -0.11, 1.2);
  let vinyetK = 0, karartK = 0, karartHedef = 0, karartBitince = null, karartSure = 0.28;
  function karartarak(f, sure = 0.28) { karartSure = sure; karartHedef = 1; karartBitince = f; }

  // ---------------------------------------------------------------- panel
  const T = panelYap(0.44, 0.52, 880);
  let panelAcik = true, panelYaw = null;
  const kafaYerelYaw = () => _e.setFromQuaternion(camera.quaternion, 'YXZ').y;   // kafa, rig'e göre
  const kafaDunyaYaw = () => _e.setFromQuaternion(camera.getWorldQuaternion(_q), 'YXZ').y;
  function panelTakip(dt, zorla = false) {
    if (!panelAcik) { T.mesh.visible = false; return; }
    camera.getWorldPosition(_h);
    const hy = kafaDunyaYaw();
    if (panelYaw === null || zorla) panelYaw = hy;
    const f = sar(hy - panelYaw);
    if (Math.abs(f) > 0.6) panelYaw += f * (1 - Math.exp(-2.5 * dt));    // ~35° dışına çıkınca yavaşça gelir
    const fx = -Math.sin(panelYaw), fz = -Math.cos(panelYaw), rx = Math.cos(panelYaw), rz = -Math.sin(panelYaw);
    T.mesh.position.set(_h.x + fx * 0.55 - rx * 0.3, _h.y - 0.36, _h.z + fz * 0.55 - rz * 0.3);
    T.mesh.lookAt(_h);
    T.mesh.updateMatrixWorld(true);
    T.mesh.visible = true;
  }

  // ---------------------------------------------------------------- durum
  let calisiyor = false;     // tur oturumda kurulu
  let oynuyor = false, geri = 0, hizli = false;
  let j = 0, faz = null;     // faz: 'don0' (yola dön) | 'yol' | 'don1' (durağa dön) | 'bekle'
  let yol = null, bekleT = 0, h0 = 0, w = 0, v = 0;
  let mkSimdi = null;

  const govdeYaw = () => rig.rotation.y + h0;
  function don(hedef, dt) {
    const fark = sar(hedef - govdeYaw());
    const hizMax = Math.min(AYAR.donus, Math.abs(fark) * 2.2 + 0.05);
    const a = Math.sign(fark) * Math.min(Math.abs(fark), hizMax * dt);
    if (a) rigDondur(a);
    w = dt > 0 ? a / dt : 0;
    return Math.abs(fark - a);
  }
  function noktaAt(s) {
    const { p, cum } = yol;
    let k = 1; while (k < p.length - 1 && cum[k] < s) k++;
    const s0 = cum[k - 1], L = cum[k] - s0 || 1, u = clamp((s - s0) / L, 0, 1);
    return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u];
  }
  function makineyeGec(mk) {
    if (mk === mkSimdi) return;
    mkSimdi = mk;
    olay.makineDegisti?.(mk);
    try { mk.m.tur?.varis?.(); } catch (e) { console.warn('[tur] varis', mk.m.id, e); }   // makine gösterisini başlatsın
    ciz();
  }
  function yolBaslat() {
    const hedef = D[j], onceki = D[(j - 1 + D.length) % D.length];
    camera.getWorldPosition(_h);
    let p = null;
    const hazir = yollar[j];
    if (hazir && hazir.length >= 2 && Math.hypot(_h.x - onceki.x, _h.z - onceki.z) < 1.5) p = [[_h.x, _h.z], ...hazir.slice(1)];
    else p = gezgin.yolBul(_h.x, _h.z, hedef.x, hedef.z);
    if (!p || p.length < 2) p = [[_h.x, _h.z], [hedef.x, hedef.z]];
    const cum = [0];
    for (let k = 1; k < p.length; k++) cum.push(cum[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
    const L = cum[cum.length - 1];
    yol = { p, cum, L, s: 0, uzun: L > AYAR.uzunYol };
    v = 0;
    makineyeGec(hedef.mk);
    faz = L < 0.25 ? 'don1' : yol.uzun ? 'don0' : 'yol';
  }
  function ileriDurak() { j = (j + 1) % D.length; yolBaslat(); }
  // büyük dönüş: yumuşak dönüş (vection) yerine 0.18 sn karart → tek seferde dön → aç
  function sicra(hedef) { karartarak(() => rigDondur(sar(hedef - govdeYaw())), 0.18); }
  const bakisYaw = () => {
    const d = D[j], b = d.nesne ? d.nesne.getWorldPosition(new THREE.Vector3()) : d.bak;
    camera.getWorldPosition(_h);
    return yawYon(b.x - _h.x, b.z - _h.z);
  };

  function update(dt) {
    if (!calisiyor) return;
    hazirla();
    // karartma (panelden makineye geçiş)
    if (karartHedef || karartK > 0) {
      karartK = clamp(karartK + (karartHedef ? 1 : -1) * dt / karartSure, 0, 1);
      karart.material.opacity = karartK; karart.visible = karartK > 0.001;
      if (karartHedef && karartK >= 1 && karartBitince) { const f = karartBitince; karartBitince = null; f(); karartHedef = 0; }
    }
    w = 0;
    const k = hizli ? AYAR.hizli : 1;
    if (oynuyor && geri > 0) {
      geri -= dt;
      if (geri <= 0) { geri = 0; h0 = kafaYerelYaw(); yolBaslat(); }
    } else if (oynuyor && D.length && !karartBitince) {
      if (faz === 'don0') {
        const [ax, az] = noktaAt(Math.min(yol.L, 3));
        camera.getWorldPosition(_h);
        const hedef = yawYon(ax - _h.x, az - _h.z);
        if (Math.abs(sar(hedef - govdeYaw())) > AYAR.sicrama) sicra(hedef);
        else if (don(hedef, dt) < 0.12) faz = 'yol';
      } else if (faz === 'yol') {
        const vmax = (yol.uzun ? AYAR.hiz.koridor : AYAR.hiz.yakin) * k;
        const kalan = yol.L - yol.s;
        const vHedef = Math.min(vmax, Math.sqrt(2 * AYAR.ivme * Math.max(kalan, 0)) + 0.05);
        v = v < vHedef ? Math.min(vHedef, v + AYAR.ivme * dt) : vHedef;
        const s1 = Math.min(yol.L, yol.s + v * dt);
        const [ax, az] = noktaAt(yol.s), [bx, bz] = noktaAt(s1);
        rig.position.x += bx - ax; rig.position.z += bz - az;   // adım farkı kadar: kafa hareketi korunur
        yol.s = s1;
        // uzun yolda yürüme yönüne yumuşakça uy (köşelerde 2.5 m ilerisine bakarak)
        if (yol.uzun && kalan > 1) {
          const [lx, lz] = noktaAt(Math.min(yol.L, s1 + 2.5));
          if (Math.hypot(lx - bx, lz - bz) > 0.3) don(yawYon(lx - bx, lz - bz), dt);
        }
        if (yol.s >= yol.L - 1e-3) { faz = 'don1'; v = 0; }
      } else if (faz === 'don1') {
        const hedef = bakisYaw();
        if (Math.abs(sar(hedef - govdeYaw())) > AYAR.sicrama) sicra(hedef);
        else if (don(hedef, dt) < 0.1) { faz = 'bekle'; bekleT = 0; ciz(); }
      } else if (faz === 'bekle') {
        don(bakisYaw(), dt);
        bekleT += dt;
        if (bekleT >= D[j].bekle / k) ileriDurak();
      }
    }
    if (!oynuyor || faz !== 'yol') v = 0;
    // vinyet: doğrusal + açısal hıza göre kenarlar kararır
    const hedefV = oynuyor ? clamp(v / 2.6, 0, 1) * 0.55 + clamp(Math.abs(w) / AYAR.donus, 0, 1) * 0.45 : 0;
    vinyetK += (hedefV - vinyetK) * (1 - Math.exp(-6 * dt));
    vinyet.material.opacity = vinyetK * 0.85; vinyet.visible = vinyetK > 0.01;
    panelTakip(dt);
    panelT += dt;
    if (panelT > 0.25) { panelT = 0; ciz(); }
  }
  let panelT = 0;

  // ---------------------------------------------------------------- komutlar
  function basDur() {
    if (!calisiyor) return;
    if (oynuyor) { oynuyor = false; geri = 0; v = 0; }
    else {
      oynuyor = true; h0 = kafaYerelYaw();
      // durakta değilsek (kullanıcı dururken yürüdüyse) yolu bulunduğu yerden yeniden kur
      if (faz === 'yol' || faz === 'don0' || faz === null) yolBaslat();
    }
    ciz();
  }
  function atla(mi) {
    if (!D.length || karartBitince) return;
    const n = sira.length; mi = ((mi % n) + n) % n;
    karartarak(() => {
      j = mBas[mi];
      const d = D[j];
      isinlan(new THREE.Vector3(d.x, 0, d.z), d.nesne ? d.nesne.getWorldPosition(new THREE.Vector3()) : d.bak);
      h0 = kafaYerelYaw();
      yol = null; v = 0; faz = 'bekle'; bekleT = 0; geri = 0;
      makineyeGec(d.mk);
      panelTakip(0, true);
    });
  }
  const mIndis = () => (D.length ? D[j].mi : 0);

  // ---------------------------------------------------------------- panel çizimi
  function ciz() {
    const p = T, x = p.ctx, W = p.W, H = p.H;
    p.bolgeler = [];
    x.clearRect(0, 0, W, H);
    R(x, 2, 2, W - 4, H - 4, 26); x.fillStyle = 'rgba(14,19,26,0.93)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = '#2b3540'; x.stroke();
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#f2c200'; x.font = '700 28px "Space Grotesk", sans-serif';
    x.fillText('SANAL FABRİKA · OTOMATİK TUR', 30, 50);
    const mi = mIndis(), mk = sira[mi];
    if (mk) {
      x.fillStyle = '#ffffff'; x.font = '700 36px "Space Grotesk", sans-serif';
      let ad = `${String(mk.no).padStart(2, '0')}  ${mk.m.ad}`;
      while (x.measureText(ad).width > W - 60 && ad.length > 4) ad = ad.slice(0, -2) + '…';
      x.fillText(ad, 30, 100);
      // durum satırı
      let durum;
      if (geri > 0) durum = `Tur ${Math.ceil(geri)} sn içinde başlıyor`;
      else if (!oynuyor) durum = 'Durduruldu · sol tetik: devam';
      else if (faz === 'yol' || faz === 'don0') durum = yol?.uzun ? `Yürüyor → ${D[j].mk.m.ad}` : `${D[j].ad} tarafına geçiyor`;
      else durum = D[j]?.ad || '';
      x.fillStyle = oynuyor ? '#39c5cf' : '#d29922'; x.font = '600 26px "Space Grotesk", sans-serif';
      x.fillText(durum.slice(0, 48), 30, 140);
      // ilerleme
      const ilk = mBas[mi], son = mi + 1 < mBas.length ? mBas[mi + 1] : D.length;
      const ic = son > ilk ? (j - ilk + (faz === 'bekle' ? 1 : 0.5)) / (son - ilk) : 0;
      const oran = (mi + clamp(ic, 0, 1)) / sira.length;
      R(x, 30, 156, W - 60, 12, 6); x.fillStyle = '#1b2430'; x.fill();
      R(x, 30, 156, Math.max(12, (W - 60) * oran), 12, 6); x.fillStyle = '#f2c200'; x.fill();
      x.fillStyle = '#8b97a3'; x.font = '500 20px "JetBrains Mono", monospace'; x.textAlign = 'right';
      x.fillText(`${mi + 1} / ${sira.length}`, W - 30, 140); x.textAlign = 'left';
    }
    // oynat / durdur
    const y0 = 186, bh = 80;
    dugme(p, x, 30, y0, 150, bh, '⏮', '', () => atla(mi - 1));
    dugme(p, x, 190, y0, W - 380, bh, oynuyor ? '⏸  Durdur' : '▶  Başlat', oynuyor ? 'dur' : 'basla', () => basDur());
    dugme(p, x, W - 180, y0, 150, bh, '⏭', '', () => atla(mi + 1));
    x.fillStyle = '#8b97a3'; x.font = '500 22px "Space Grotesk", sans-serif'; x.textAlign = 'left';
    x.fillText('Sol tetik: başlat / durdur · yan tuş: paneli gizle', 30, 300);
    dugme(p, x, W - 230, 268, 200, 50, hizli ? 'Hız: Hızlı' : 'Hız: Normal', '', () => { hizli = !hizli; ciz(); }, hizli);
    // makine listesi (2 sütun): seçilene karartarak geçer, tur oradan sürer
    const kol = 2, gy = 334, gap = 6, gw = (W - 60 - gap) / kol;
    const satir = Math.ceil(sira.length / kol), gh = Math.min(48, Math.floor((H - gy - 90) / satir) - gap);
    sira.forEach((m, i) => {
      const c = Math.floor(i / satir), r = i % satir;   // sütun sütun: tur sırası yukarıdan aşağı okunur
      dugme(p, x, 30 + c * (gw + gap), gy + r * (gh + gap), gw, gh, `${String(m.no).padStart(2, '0')}  ${m.m.ad}`, '', () => atla(i), i === mi);
    });
    const by = H - 78, bw = (W - 60 - 2 * 10) / 3;
    dugme(p, x, 30, by, bw, 56, 'Makine paneli', '', () => olay.detay?.(sira[mi]));
    dugme(p, x, 30 + bw + 10, by, bw, 56, 'Paneli gizle', '', () => panelAcKapa());
    dugme(p, x, 30 + 2 * (bw + 10), by, bw, 56, "VR'dan çık", 'dur', () => olay.cikis?.());
    p.tex.needsUpdate = true;
  }
  function panelAcKapa() { panelAcik = !panelAcik; if (panelAcik) { panelTakip(0, true); ciz(); } else T.mesh.visible = false; }

  return {
    panel: T, ciz, update, basDur, atla, panelAcKapa,
    atlaMk(mk) { if (!D.length) rotaKur(); const i = sira.indexOf(mk); if (i >= 0) atla(i); },
    yuruyor: () => calisiyor && oynuyor,
    makine: () => (calisiyor ? mkSimdi : null),
    basla() {
      if (!D.length) rotaKur();
      calisiyor = true; oynuyor = true; geri = AYAR.geriSayim;
      j = 0; faz = null; yol = null; v = 0; mkSimdi = null;
      panelAcik = true; panelTakip(0, true);
      ciz();
    },
    bitir() {
      calisiyor = false; oynuyor = false;
      T.mesh.visible = false; vinyet.visible = false; karart.visible = false;
      karartK = 0; karartHedef = 0; karartBitince = null; mkSimdi = null;
    },
    rotaKur,
    _test: { D: () => D, sira: () => sira, yollar: () => yollar, faz: () => faz, j: () => j, AYAR },
  };
}
