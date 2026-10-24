// js/vr.js — Quest (WebXR) desteği.
//
// Masaüstündeki sahne aynen kullanılır; VR'da:
//  - Hareket: SOL çubuk yürür (baş yönüne göre), SAĞ çubuk 30° adımlı döner (mide dostu),
//    tetik zemine basılırsa oraya ışınlanır.
//  - Seçim: tetikle makineye işaret et → önünde 3B kontrol paneli açılır (masaüstündeki
//    sağ panelin aynısı: kontroller, canlı değerler, trend). Paneldeki düğmelere tetikle
//    basılır; "basılı tut" düğmeleri tetik bırakılana dek etkin kalır.
//  - Menü: herhangi bir kumandada YAN TUŞ (grip) → makine listesi; seçilen makinenin
//    önüne ışınlanır. Menüde salon ortası / B holü / VR'dan çıkış da var.
//  - Performans (Quest): gölge kapalı, sis yakın, uzaktaki makineler çizilmez
//    (sisin arkasında kalır), ekran dokuları yalnız yakındaki makinelerde güncellenir.
//    Hedef kare hızının altına düşülürse görüş mesafesi kendiliğinden kısalır.
//
// Panellerdeki kontrol tanımları makine modüllerindeki `kontroller` dizisidir
// (lib.js başındaki sözleşme) — yeni makine eklemek VR için ek iş gerektirmez.

import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const SINIR = { x0: -104, x1: 118, z0: -34, z1: 34 };      // ışınlanma/yürüme alanı (A + B holü, x −106…120)

export function vrKur({ renderer, scene, camera, controls, makineler, gunes, etiketler, masaustuSec, gorunumAyarla, buton }) {
  const rig = new THREE.Group();
  rig.name = 'vr-rig';
  scene.add(rig);

  let aktif = false;
  let secili = null;
  const kayit = {};                                   // masaüstü ayarlarını VR çıkışında geri yükle
  const _h = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _v = new THREE.Vector3();

  // ------------------------------------------------------------------ giriş düğmesi
  if (buton) {
    if (!navigator.xr) {
      buton.hidden = false; buton.disabled = true;
      buton.title = window.isSecureContext
        ? 'Bu tarayıcı WebXR desteklemiyor (Quest tarayıcısında açın).'
        : 'VR için sayfa HTTPS ile açılmalı (FABRIKA VR AC.bat).';
    } else {
      navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
        buton.hidden = false; buton.disabled = !ok;
        if (!ok) buton.title = 'VR gözlük bulunamadı.';
      }).catch(() => {});
      buton.addEventListener('click', async () => {
        if (aktif) { renderer.xr.getSession()?.end(); return; }
        try {
          const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
          renderer.xr.setReferenceSpaceType('local-floor');
          await renderer.xr.setSession(s);
        } catch (e) { console.error('[vr] oturum açılamadı', e); buton.title = 'VR oturumu açılamadı: ' + e.message; }
      });
    }
  }
  renderer.xr.enabled = true;
  renderer.xr.setFoveation(1.0);

  // ------------------------------------------------------------------ kumandalar
  const isinGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const kumandalar = [0, 1].map((i) => {
    const c = renderer.xr.getController(i);
    const isin = new THREE.Line(isinGeo, new THREE.LineBasicMaterial({ color: 0x39c5cf, transparent: true, opacity: 0.8 }));
    isin.scale.z = 5; c.add(isin);
    const nokta = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    nokta.visible = false; scene.add(nokta);
    const grip = renderer.xr.getControllerGrip(i);
    const govde = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.6 }));
    govde.position.z = 0.02; grip.add(govde);
    const halka = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: 0x39c5cf, roughness: 0.4 }));
    halka.position.set(0, 0.01, -0.04); halka.rotation.x = Math.PI / 3; grip.add(halka);
    rig.add(c); rig.add(grip);
    const k = { c, isin, nokta, el: '', gp: null, tutulan: null, snapHazir: true };
    c.addEventListener('connected', (e) => { k.el = e.data.handedness; k.gp = e.data.gamepad; });
    c.addEventListener('disconnected', () => { k.gp = null; });
    c.addEventListener('selectstart', () => tetikBas(k));
    c.addEventListener('selectend', () => tetikBirak(k));
    c.addEventListener('squeezestart', () => menuAcKapa(k));
    return k;
  });

  // ------------------------------------------------------------------ zemin hedef işareti
  const hedefHalka = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0x39c5cf, transparent: true, opacity: 0.85, depthWrite: false }));
  hedefHalka.rotation.x = -Math.PI / 2; hedefHalka.visible = false; hedefHalka.renderOrder = 5;
  scene.add(hedefHalka);

  // ------------------------------------------------------------------ 3B paneller
  // Canvas'a çizilen düz panel; regions = tıklanabilir dikdörtgenler (canvas pikseli).
  function panelYap(wM, hM, px = 1024) {
    const H = Math.round((px * hM) / wM);
    const cv = document.createElement('canvas'); cv.width = px; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
    mesh.visible = false; mesh.renderOrder = 6;
    scene.add(mesh);
    return { cv, ctx: cv.getContext('2d'), tex, mesh, W: px, H, bolgeler: [], hover: null };
  }
  const P = panelYap(0.72, 1.12, 900);          // makine paneli
  const MN = panelYap(0.9, 0.82, 1000);         // menü

  const R = (x, px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };
  function dugme(p, x, px, py, w, h, metin, tur, eylem, secili2 = false) {
    const hov = p.hover && p.hover.px === px && p.hover.py === py;
    const renk = { basla: ['#17321d', '#2a6f36'], dur: ['#2e2914', '#6b5a1d'], acil: ['#4a1513', '#b33a33'] }[tur] || ['#222b35', '#3c4a58'];
    R(x, px, py, w, h, 12);
    x.fillStyle = secili2 ? '#1d5f66' : hov ? '#34475a' : renk[0]; x.fill();
    x.lineWidth = hov ? 4 : 2; x.strokeStyle = hov ? '#39c5cf' : renk[1]; x.stroke();
    x.fillStyle = tur === 'acil' ? '#ffd5d2' : '#e6edf3';
    x.font = `${tur === 'acil' ? 700 : 600} ${Math.min(30, h * 0.42)}px "Space Grotesk", sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    let s = metin; while (x.measureText(s).width > w - 16 && s.length > 3) s = s.slice(0, -2) + '…';
    x.fillText(s, px + w / 2, py + h / 2 + 1);
    p.bolgeler.push({ px, py, w, h, eylem });
  }

  function makinePaneliCiz() {
    const p = P, x = p.ctx, W = p.W, H = p.H;
    p.bolgeler = [];
    x.clearRect(0, 0, W, H);
    R(x, 2, 2, W - 4, H - 4, 28); x.fillStyle = 'rgba(14,19,26,0.94)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = '#2b3540'; x.stroke();
    if (!secili) { p.tex.needsUpdate = true; return; }
    const m = secili.m;
    let y = 30;
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#f2c200'; x.font = '700 30px "JetBrains Mono", monospace';
    x.fillText(String(secili.no).padStart(2, '0'), 34, y + 34);
    x.fillStyle = '#ffffff'; x.font = '700 38px "Space Grotesk", sans-serif';
    let ad = m.ad; while (x.measureText(ad).width > W - 230 && ad.length > 4) ad = ad.slice(0, -2) + '…';
    x.fillText(ad, 92, y + 36);
    dugme(p, x, W - 120, y, 90, 56, '✕', '', () => paneliKapat());
    y += 74;
    const d = m.durum();
    const dr = { calisiyor: '#2ea043', uyari: '#d29922', alarm: '#f85149', bekliyor: '#6e7681' }[d.seviye] || '#6e7681';
    R(x, 34, y, W - 68, 48, 24); x.fillStyle = '#1b2430'; x.fill();
    x.fillStyle = dr; x.beginPath(); x.arc(64, y + 24, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e6edf3'; x.font = '600 26px "JetBrains Mono", monospace'; x.fillText(d.metin.slice(0, 44), 88, y + 33);
    y += 70;

    // kontroller
    const satirH = 58, bosluk = 10, sol = 34, gen = W - 68;
    for (const k of m.kontroller || []) {
      if (y > H - 420) break;
      if (k.tip === 'baslik') {
        x.fillStyle = '#39c5cf'; x.font = '600 24px "Space Grotesk", sans-serif'; x.textAlign = 'left';
        x.fillText(k.metin, sol, y + 26); y += 38;
      } else if (k.tip === 'butonlar' || k.tip === 'basili') {
        const n = k.ogeler.length, bw = (gen - bosluk * (n - 1)) / n;
        k.ogeler.forEach((o, i) => dugme(p, x, sol + i * (bw + bosluk), y, bw, satirH, o.metin, o.tur,
          k.tip === 'basili' ? { bas: o.bas, birak: o.birak } : () => o.tik()));
        y += satirH + bosluk;
      } else if (k.tip === 'kaydirici') {
        const v = k.get(), adim = k.adim ?? 1, adimN = Math.max(adim, Math.round(((k.max - k.min) / 20) / adim) * adim);
        const dec = String(adim).includes('.') ? String(adim).split('.')[1].length : 0;
        x.fillStyle = '#c9d3dc'; x.font = '500 24px "Space Grotesk", sans-serif'; x.textAlign = 'left';
        x.fillText(k.metin, sol, y + 36);
        x.fillStyle = '#ffffff'; x.font = '700 26px "JetBrains Mono", monospace'; x.textAlign = 'right';
        x.fillText(`${(+v).toFixed(dec)} ${k.birim || ''}`, sol + gen - 150, y + 36);
        const kis = (s) => () => k.set(Math.min(k.max, Math.max(k.min, +(k.get() + s * adimN).toFixed(6))));
        dugme(p, x, sol + gen - 140, y, 64, satirH, '−', '', kis(-1));
        dugme(p, x, sol + gen - 66, y, 64, satirH, '+', '', kis(1));
        y += satirH + bosluk;
      } else if (k.tip === 'secim') {
        const ops = k.secenekler, i = Math.max(0, ops.findIndex(([v]) => String(v) === String(k.get())));
        x.fillStyle = '#c9d3dc'; x.font = '500 24px "Space Grotesk", sans-serif'; x.textAlign = 'left';
        x.fillText(k.metin, sol, y + 36);
        const bx = sol + gen * 0.42, bw = gen * 0.58;
        dugme(p, x, bx, y, 60, satirH, '◀', '', () => k.set(ops[(i - 1 + ops.length) % ops.length][0]));
        dugme(p, x, bx + 66, y, bw - 132, satirH, ops[i][1], '', () => k.set(ops[(i + 1) % ops.length][0]));
        dugme(p, x, bx + bw - 60, y, 60, satirH, '▶', '', () => k.set(ops[(i + 1) % ops.length][0]));
        y += satirH + bosluk;
      } else if (k.tip === 'anahtar') {
        const on = !!k.get();
        dugme(p, x, sol, y, gen, satirH, `${on ? '☑' : '☐'}  ${k.metin}`, '', () => k.set(!k.get()), on);
        y += satirH + bosluk;
      }
    }
    // canlı değerler (kalan alana sığdığı kadar)
    y += 6;
    const kalan = H - 220 - y;
    const deg = m.degerler().slice(0, Math.max(0, Math.floor(kalan / 34)));
    x.font = '500 23px "Space Grotesk", sans-serif';
    deg.forEach(([k, v], i) => {
      const yy = y + i * 34 + 24;
      x.fillStyle = '#8b97a3'; x.textAlign = 'left'; x.fillText(k, sol, yy);
      x.fillStyle = '#ffffff'; x.textAlign = 'right'; x.font = '600 22px "JetBrains Mono", monospace';
      let s = String(v); while (x.measureText(s).width > gen * 0.62 && s.length > 4) s = s.slice(0, -2) + '…';
      x.fillText(s, sol + gen, yy); x.font = '500 23px "Space Grotesk", sans-serif';
    });
    // trend (alt bölüm)
    if (m.trend) trendCiz(x, m.trend, sol, H - 200, gen, 170);
    p.tex.needsUpdate = true;
  }

  function trendCiz(x, tr, px, py, w, h) {
    R(x, px, py, w, h, 12); x.fillStyle = '#0c1116'; x.fill(); x.strokeStyle = '#2b3540'; x.lineWidth = 2; x.stroke();
    let lo = tr.min, hi = tr.max;
    if (lo == null || hi == null) {
      let a = Infinity, b = -Infinity;
      tr.veri.forEach((d) => d.forEach((v) => { if (v < a) a = v; if (v > b) b = v; }));
      if (!Number.isFinite(a)) { a = 0; b = 1; }
      const pay = Math.max((b - a) * 0.12, 1e-6); lo = lo ?? a - pay; hi = hi ?? b + pay;
    }
    tr.seriler.forEach((s, i) => {
      const d = tr.veri[i]; if (d.length < 2) return;
      x.strokeStyle = s.renk; x.lineWidth = 3; x.setLineDash(s.kesik ? [8, 6] : []); x.beginPath();
      d.forEach((v, k) => {
        const qx = px + 8 + ((w - 16) * k) / (tr.uzunluk - 1), qy = py + 30 + (h - 40) * (1 - (v - lo) / (hi - lo));
        k ? x.lineTo(qx, qy) : x.moveTo(qx, qy);
      });
      x.stroke();
    });
    x.setLineDash([]);
    let lx = px + 12; x.font = '500 20px "JetBrains Mono", monospace'; x.textAlign = 'left';
    tr.seriler.forEach((s) => { x.fillStyle = s.renk; x.fillRect(lx, py + 14, 14, 5); x.fillStyle = '#c9d3dc'; x.fillText(s.ad, lx + 20, py + 22); lx += x.measureText(s.ad).width + 44; });
  }

  function menuCiz() {
    const p = MN, x = p.ctx, W = p.W, H = p.H;
    p.bolgeler = [];
    x.clearRect(0, 0, W, H);
    R(x, 2, 2, W - 4, H - 4, 28); x.fillStyle = 'rgba(14,19,26,0.95)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = '#2b3540'; x.stroke();
    x.fillStyle = '#f2c200'; x.font = '700 34px "Space Grotesk", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText('SANAL FABRİKA · makineye git', 34, 58);
    const kol = 2, bw = (W - 68 - 14) / kol, bh = 52;
    makineler.forEach((mk, i) => {
      const c = i % kol, r = Math.floor(i / kol);
      dugme(p, x, 34 + c * (bw + 14), 84 + r * (bh + 8), bw, bh, `${String(mk.no).padStart(2, '0')}  ${mk.m.ad}`, '', () => { menuKapat(); makineyeGit(mk); }, mk === secili);
    });
    const y = 84 + Math.ceil(makineler.length / kol) * (bh + 8) + 10;
    const ucw = (W - 68 - 28) / 3;
    dugme(p, x, 34, y, ucw, 58, 'Salon ortası', '', () => { menuKapat(); isinlan(new THREE.Vector3(-30, 0, 0), new THREE.Vector3(-30, 0, -10)); });
    dugme(p, x, 34 + ucw + 14, y, ucw, 58, 'B Holü', '', () => { menuKapat(); isinlan(new THREE.Vector3(62, 0, 1), new THREE.Vector3(82, 0, -8)); });
    dugme(p, x, 34 + 2 * (ucw + 14), y, ucw, 58, "VR'dan çık", 'dur', () => renderer.xr.getSession()?.end());
    p.tex.needsUpdate = true;
  }

  // Panel, kullanıcının önüne (hafif sola) yerleşir ve ona döner; dünyada sabit kalır.
  function paneliYerlestir(p, sagaAci = 0.35, uzak = 1.05, dusey = -0.12) {
    camera.getWorldPosition(_h); camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    _d.applyAxisAngle(Y, sagaAci);
    p.mesh.position.copy(_h).addScaledVector(_d, uzak); p.mesh.position.y = _h.y + dusey;
    p.mesh.lookAt(_h.x, p.mesh.position.y, _h.z);
    p.mesh.updateMatrixWorld(true);       // aynı karede tetik gelirse ışın paneli bulsun
    p.mesh.visible = true;
  }
  function paneliAc(mk) { secili = mk; makinePaneliCiz(); paneliYerlestir(P); }
  function paneliKapat() { secili = null; P.mesh.visible = false; }
  function menuAcKapa() { if (MN.mesh.visible) menuKapat(); else { menuCiz(); paneliYerlestir(MN, 0, 1.0, -0.05); } }
  function menuKapat() { MN.mesh.visible = false; }

  // ------------------------------------------------------------------ ışınlanma / hareket
  // hedefZemin: kullanıcının başının geleceği zemin noktası; bak: bakılacak nokta
  function isinlan(hedefZemin, bak) {
    camera.getWorldPosition(_h);
    if (bak) {
      camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
      _r.subVectors(bak, hedefZemin); _r.y = 0;
      if (_r.lengthSq() > 1e-4) {
        _r.normalize();
        const aci = Math.atan2(_d.x, _d.z) - Math.atan2(_r.x, _r.z);
        rigDondur(-aci);
        camera.getWorldPosition(_h);
      }
    }
    rig.position.x += hedefZemin.x - _h.x;
    rig.position.z += hedefZemin.z - _h.z;
    rig.updateMatrixWorld(true);
    gorunurlukGuncelle();          // yeni yerdeki makineler aynı karede görünsün/seçilebilsin
  }
  function rigDondur(aci) {
    camera.getWorldPosition(_h);
    rig.position.sub(_h).applyAxisAngle(Y, aci).add(_h);
    rig.rotation.y += aci;
    rig.updateMatrixWorld(true);
  }
  // Makinenin masaüstü kamera açısından (kamera.poz → hedef) ayakta duruş noktası türetilir.
  function makineyeGit(mk) {
    mk.kok.updateMatrixWorld(true);
    const m = mk.m;
    let hedef, poz;
    if (m.kamera) {
      hedef = mk.kok.localToWorld(new THREE.Vector3().fromArray(m.kamera.hedef));
      poz = mk.kok.localToWorld(new THREE.Vector3().fromArray(m.kamera.poz));
    } else {
      const b = new THREE.Box3().setFromObject(m.group); hedef = b.getCenter(new THREE.Vector3());
      poz = hedef.clone().add(new THREE.Vector3(0, 0, 5).applyQuaternion(mk.kok.quaternion));
    }
    const yon = poz.clone().sub(hedef); yon.y = 0;
    const L = THREE.MathUtils.clamp(yon.length() * 0.6, 2.2, 5.5);
    yon.normalize();
    const dur = hedef.clone().addScaledVector(yon, L); dur.y = 0;
    isinlan(dur, hedef);
    paneliAc(mk);
    masaustuSec?.(mk);
  }

  // ------------------------------------------------------------------ tetik
  const ray = new THREE.Raycaster();
  const zemin = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function panelVurus(k, p) {
    if (!p.mesh.visible) return null;
    const hit = ray.intersectObject(p.mesh, false)[0];
    if (!hit || !hit.uv) return null;
    const px = hit.uv.x * p.W, py = (1 - hit.uv.y) * p.H;
    const b = p.bolgeler.find((q) => px >= q.px && px <= q.px + q.w && py >= q.py && py <= q.py + q.h) || null;
    return { hit, b };
  }
  function isinKur(k) { ray.setFromXRController(k.c); }
  function tetikBas(k) {
    isinKur(k);
    for (const p of [MN, P]) {
      const v = panelVurus(k, p);
      if (v) {
        const e = v.b?.eylem;
        if (typeof e === 'function') e();
        else if (e && e.bas) { e.bas(); k.tutulan = e; }
        if (p === P) makinePaneliCiz(); else if (MN.mesh.visible) menuCiz();
        return;
      }
    }
    // makine seçimi (yalnız tetikte — her karede tüm sahneyi taramıyoruz)
    const gorunen = makineler.filter((x) => x.kok.visible).map((x) => x.kok);
    const hit = ray.intersectObjects(gorunen, true)[0];
    const zHit = ray.ray.intersectPlane(zemin, _v);
    if (hit && (!zHit || hit.distance <= ray.ray.origin.distanceTo(_v) + 0.01)) {
      let o = hit.object; while (o && !o.userData.makine) o = o.parent;
      const mk = o && makineler.find((x) => x.kok === o);
      if (mk) { paneliAc(mk); masaustuSec?.(mk); return; }
    }
    if (zHit && zHit.x > SINIR.x0 && zHit.x < SINIR.x1 && zHit.z > SINIR.z0 && zHit.z < SINIR.z1 && ray.ray.origin.distanceTo(zHit) < 30) {
      isinlan(zHit.clone(), null);
    }
  }
  function tetikBirak(k) { if (k.tutulan) { k.tutulan.birak(); k.tutulan = null; } }

  // ------------------------------------------------------------------ oturum
  let gorusR = 34, kareOrt = 1 / 72;
  renderer.xr.addEventListener('sessionstart', () => {
    aktif = true;
    if (buton) buton.textContent = "VR'dan çık";
    kayit.pos = camera.position.clone(); kayit.quat = camera.quaternion.clone();
    kayit.golge = gunes.castShadow; kayit.fog = scene.fog; kayit.hedef = controls.target.clone();
    controls.enabled = false;
    camera.clearViewOffset();
    gunes.castShadow = false;
    scene.fog = new THREE.Fog(scene.background, 14, gorusR);
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    rig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
    // başlangıç: masaüstündeki bakış noktasının önüne
    const t = kayit.hedef, yon = kayit.pos.clone().sub(t); yon.y = 0;
    if (yon.lengthSq() < 1e-3) yon.set(0, 0, 1);
    yon.normalize();
    const dur = t.clone().addScaledVector(yon, 4); dur.y = 0;
    dur.x = THREE.MathUtils.clamp(dur.x, SINIR.x0, SINIR.x1); dur.z = THREE.MathUtils.clamp(dur.z, SINIR.z0, SINIR.z1);
    ilkKare = { dur, bak: new THREE.Vector3(t.x, 0, t.z) };
  });
  let ilkKare = null;
  renderer.xr.addEventListener('sessionend', () => {
    aktif = false;
    if (buton) buton.textContent = "VR'a gir";
    rig.remove(camera);
    camera.position.copy(kayit.pos); camera.quaternion.copy(kayit.quat);
    controls.target.copy(kayit.hedef); controls.enabled = true; controls.update();
    gunes.castShadow = kayit.golge; scene.fog = kayit.fog;
    makineler.forEach((x) => { x.kok.visible = true; x.kok.userData.ekranAktif = true; });
    etiketler.forEach((e) => { e.visible = true; });
    P.mesh.visible = false; MN.mesh.visible = false; hedefHalka.visible = false;
    kumandalar.forEach((k) => { k.nokta.visible = false; });
    gorunumAyarla();
  });

  // ------------------------------------------------------------------ kare
  let cullT = 0, panelT = 0;
  function update(dt, t) {
    if (!aktif) return;
    if (ilkKare) { isinlan(ilkKare.dur, ilkKare.bak); ilkKare = null; }
    kareOrt += (dt - kareOrt) * 0.05;

    // çubuklar: sol yürür, sağ adımlı döner
    camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    _r.crossVectors(_d, Y).normalize();
    for (const k of kumandalar) {
      const gp = k.gp; if (!gp || gp.axes.length < 4) continue;
      const ax = gp.axes[2], ay = gp.axes[3];
      if (k.el === 'left') {
        const m = Math.hypot(ax, ay);
        if (m > 0.15) {
          const s = ((m - 0.15) / 0.85) * 2.6 * dt / m;
          rig.position.addScaledVector(_d, -ay * s).addScaledVector(_r, ax * s);
          rig.position.x = THREE.MathUtils.clamp(rig.position.x, SINIR.x0 - 5, SINIR.x1 + 5);
          rig.position.z = THREE.MathUtils.clamp(rig.position.z, SINIR.z0 - 5, SINIR.z1 + 5);
        }
      } else if (k.el === 'right') {
        if (Math.abs(ax) > 0.7 && k.snapHazir) { rigDondur(ax > 0 ? -Math.PI / 6 : Math.PI / 6); k.snapHazir = false; }
        else if (Math.abs(ax) < 0.3) k.snapHazir = true;
      }
    }

    // ışın: panel üzerinde vurgulama + zemin hedef halkası
    hedefHalka.visible = false;
    for (const k of kumandalar) {
      if (!k.gp) { k.isin.visible = false; continue; }
      k.isin.visible = true;
      isinKur(k);
      let L = 6, vurdu = false;
      for (const p of [MN, P]) {
        const v = panelVurus(k, p);
        if (v) {
          L = v.hit.distance; vurdu = true;
          if ((v.b?.px ?? -1) !== (p.hover?.px ?? -2) || (v.b?.py ?? -1) !== (p.hover?.py ?? -2)) {
            p.hover = v.b; if (p === P) makinePaneliCiz(); else menuCiz();
          }
          k.nokta.position.copy(v.hit.point); k.nokta.visible = true;
          break;
        }
      }
      if (!vurdu) {
        k.nokta.visible = false;
        const z = ray.ray.intersectPlane(zemin, _v);
        if (z && ray.ray.origin.distanceTo(z) < 30) {
          L = ray.ray.origin.distanceTo(z);
          if (k.el === 'right' || !hedefHalka.visible) { hedefHalka.position.set(z.x, 0.02, z.z); hedefHalka.visible = true; }
        }
      }
      k.isin.scale.z = L;
    }

    // panel içeriği: 5 Hz
    panelT += dt;
    if (panelT > 0.2) { panelT = 0; if (P.mesh.visible) makinePaneliCiz(); }

    // performans: uzaktaki makineleri sisin arkasında gizle; kare hızı düşerse görüş kısalır
    cullT += dt;
    if (cullT > 0.25) {
      cullT = 0;
      if (kareOrt > 1 / 60 && gorusR > 20) gorusR -= 1;
      else if (kareOrt < 1 / 70 && gorusR < 34) gorusR += 0.5;
      scene.fog.far = gorusR; scene.fog.near = gorusR * 0.42;
      gorunurlukGuncelle();
    }
  }
  function gorunurlukGuncelle() {
    if (!aktif) return;
    camera.getWorldPosition(_h);
    makineler.forEach((x, i) => {
      const s = x.kure; const dist = s ? _h.distanceTo(s.center) - s.radius : 0;
      const gor = dist < gorusR || x === secili;
      x.kok.visible = gor;
      x.kok.userData.ekranAktif = gor && dist < 14;
      if (etiketler[i]) etiketler[i].visible = gor && dist > 4;
    });
  }

  return { rig, aktif: () => aktif, update, makineyeGit, _test: { P, MN, menuKapat, paneliKapat } };
}
