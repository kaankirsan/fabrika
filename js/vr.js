// js/vr.js — Quest (WebXR) desteği.
//
// Masaüstündeki sahne aynen kullanılır; VR'da:
//  - Otomatik tur (js/vrtur.js): VR'a girince 3 sn sonra başlar, makineleri durak durak gezdirir
//    (ön, HMI ekranı, iki yan), sonda başa sarar. SOL tetik başlat / durdur. Yanda hep duran tur
//    panelinden makine seçilir (karartarak geçer, tur oradan sürer); YAN TUŞ paneli gizler/gösterir.
//  - Tur dururken serbest: SOL çubuk yürür (baş yönüne göre), SAĞ çubuk 30° adımlı döner, SAĞ tetik
//    zemine basılırsa oraya ışınlanır. Masaüstü yürüyüşüyle aynı harita (js/gezgin.js): duvar ve
//    makinelerden geçilmez. Yürüyüşten girilirse aynı yerde, aynı yöne bakarak başlar.
//  - Seçim: SAĞ tetikle makineye işaret et → önünde 3B kontrol paneli açılır (masaüstündeki
//    sağ panelin aynısı: kontroller, canlı değerler, trend). Paneldeki düğmelere tetikle
//    basılır; "basılı tut" düğmeleri tetik bırakılana dek etkin kalır.
//  - Görüntü / performans (js/vrkalite.js): bütün fabrika görünür. Uzaktaki makineler tek parçalık
//    vekilleriyle, yakındakiler ve turun gezdiği canlı çizilir; 72 Hz. Kare hızına göre önce
//    foveation (kenar keskinliği), sonra canlı yarıçap ve ayrıntı eşiği kendiliğinden ayarlanır.
//
// Panellerdeki kontrol tanımları makine modüllerindeki `kontroller` dizisidir
// (lib.js başındaki sözleşme) — yeni makine eklemek VR için ek iş gerektirmez.

import * as THREE from 'three';
import { turKur } from './vrtur.js';
import { vrKaliteKur } from './vrkalite.js';

const Y = new THREE.Vector3(0, 1, 0);
const SINIR = { x0: -104, x1: 158, z0: -34, z1: 34 };      // ışınlanma/yürüme alanı (A + B + C holü, x −106…160)
const HZ = 72;                                              // Quest'te hedef yenileme hızı
// VR havası: uzak hol ucu karanlığa değil hafif bir pusa karışır (eskiden sis = arka plan rengi, 34 m)
const SIS = { renk: 0x56616d, yakin: 70, uzak: 300 };
// uyarlanır kalite sınırları
const FOV = { min: 0.15, max: 1, ilk: 0.45 };               // sabit foveation: 0 keskin kenar, 1 en ucuz
const CANLI = { min: 6, max: 11 };                          // canlı (tam ayrıntı, hareketli) makine yarıçapı, m
const LOD_PX = { min: 3, max: 8 };                          // VR'da bundan küçük görünen parça çizilmez (piksel)

export function vrKur({ renderer, scene, camera, controls, makineler, gunes, etiketler, masaustuSec, gorunumAyarla, buton,
  gezgin = null, durusNoktasi = null, baslangic = null, bitis = null, basladi = null }) {
  const rig = new THREE.Group();
  rig.name = 'vr-rig';
  scene.add(rig);

  let aktif = false;
  let secili = null;
  const kayit = {};                                   // masaüstü ayarlarını VR çıkışında geri yükle
  const _h = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _v = new THREE.Vector3();
  const kalite = vrKaliteKur({ renderer, scene, camera, makineler });
  let fov = FOV.ilk, canliR = 9, lodPx = 4;

  // ------------------------------------------------------------------ giriş düğmesi
  // düğme ve Quest uygulamasının açılış oturumu (index.html → window.__vrErken) aynı yoldan bağlanır.
  // Vekiller, VR malzeme ayarı ve gölgelendirici derlemesi oturum bağlanmadan yapılır (gözlükte
  // yükleniyor noktaları görünürken): VR içinde takılma olmaz.
  async function bagla(s) {
    kalite.hazirla();
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFoveation(fov);
    // Quest Browser'da EXT_multisampled_render_to_texture yok: three'nin projeksiyon katmanı yolu MSAA'yı
    // ayrı bir çözümleme geçişiyle yapıyor (ölçüldü: ~3 fps kayıp). Klasik XRWebGLLayer'da MSAA'yı
    // tarayıcı kendisi veriyor → setSession sürerken three'ye katman desteği yokmuş gibi görün.
    const B = window.XRWebGLBinding?.prototype;
    const katman = B && Object.prototype.hasOwnProperty.call(B, 'createProjectionLayer')
      && !renderer.getContext().getExtension('EXT_multisampled_render_to_texture') ? B.createProjectionLayer : null;
    if (katman) delete B.createProjectionLayer;
    try {
      await renderer.xr.setSession(s);
    } catch (e) {
      kalite.birak();
      throw e;
    } finally {
      if (katman) B.createProjectionLayer = katman;
    }
  }
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
          await bagla(await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }));
        } catch (e) { console.error('[vr] oturum açılamadı', e); buton.title = 'VR oturumu açılamadı: ' + e.message; }
      });
    }
  }
  renderer.xr.enabled = true;

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
    c.addEventListener('squeezestart', () => tur.panelAcKapa());
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

  // ------------------------------------------------------------------ otomatik tur (js/vrtur.js)
  const tur = turKur({
    scene, camera, rig, makineler, gezgin, durusNoktasi, rigDondur, isinlan, panelYap, dugme, R,
    olay: {
      // tur yeni makineye geçince: eski makinenin paneli kapanır, masaüstü seçimi eşitlenir (LOD tam ayrıntı)
      makineDegisti: (mk) => { if (secili && secili !== mk) paneliKapat(); masaustuSec?.(mk); gorunurlukGuncelle(); },
      detay: (mk) => { if (mk) paneliAc(mk); },
      cikis: () => renderer.xr.getSession()?.end(),
    },
  });

  // ------------------------------------------------------------------ ışınlanma / hareket
  // hedefZemin: kullanıcının başının geleceği zemin noktası; bak: bakılacak nokta
  function isinlan(hedefZemin, bak) {
    const s = gezgin?.enYakin(hedefZemin.x, hedefZemin.z, 8);
    if (s) hedefZemin = new THREE.Vector3(s.x, 0, s.z);
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
  // Makineye git: turun o makinedeki ilk durağına karartarak geçilir, tur oradan sürer.
  function makineyeGit(mk) { tur.atlaMk(mk); }

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
  const solMu = (k) => k.el === 'left';
  function paneller() { return [tur.panel, P]; }
  function panelYenile(p) { if (p === P) makinePaneliCiz(); else tur.ciz(); }
  function tetikBas(k) {
    // SOL tetik yalnız turu başlatır / durdurur (ışını yok, panel / ışınlanma yapmaz)
    if (solMu(k)) { tur.basDur(); return; }
    isinKur(k);
    for (const p of paneller()) {
      const v = panelVurus(k, p);
      if (v) {
        const e = v.b?.eylem;
        if (typeof e === 'function') e();
        else if (e && e.bas) { e.bas(); k.tutulan = e; }
        if (p.mesh.visible) panelYenile(p);
        return;
      }
    }
    // makine seçimi (yalnız tetikte — her karede tüm sahneyi taramıyoruz); uzaktaki makinenin vekili de seçilir
    const gorunen = makineler.filter((x) => x.kok.visible).map((x) => x.kok).concat(kalite.vekilNesneleri());
    const hit = ray.intersectObjects(gorunen, true)[0];
    const zHit = ray.ray.intersectPlane(zemin, _v);
    if (hit && (!zHit || hit.distance <= ray.ray.origin.distanceTo(_v) + 0.01)) {
      let mk = null;
      if (hit.object.isBatchedMesh) mk = hit.object.userData.vekilIcin?.[hit.batchId] || null;
      else { let o = hit.object; while (o && !o.userData.makine) o = o.parent; mk = o && makineler.find((x) => x.kok === o); }
      if (mk) { paneliAc(mk); masaustuSec?.(mk); return; }
    }
    if (tur.yuruyor()) return;   // tur sürerken ışınlanma yok (rig'i tur taşıyor)
    if (zHit && zHit.x > SINIR.x0 && zHit.x < SINIR.x1 && zHit.z > SINIR.z0 && zHit.z < SINIR.z1 && ray.ray.origin.distanceTo(zHit) < 30) {
      isinlan(zHit.clone(), null);
    }
  }
  function tetikBirak(k) { if (k.tutulan) { k.tutulan.birak(); k.tutulan = null; } }

  // ------------------------------------------------------------------ oturum
  let kareOrt = 1 / HZ, cpuOrt = 0.008;
  renderer.xr.addEventListener('sessionstart', () => {
    aktif = true;
    if (buton) buton.textContent = "VR'dan çık";
    kayit.pos = camera.position.clone(); kayit.quat = camera.quaternion.clone();
    kayit.golge = gunes.castShadow; kayit.fog = scene.fog; kayit.hedef = controls.target.clone();
    controls.enabled = false;
    basladi?.();
    camera.clearViewOffset();
    gunes.castShadow = false;
    // aynı Fog türü (gölgelendirici yeniden derlenmez); renk arka plan değil pus: uzak hol ucu kararmaz
    scene.fog = new THREE.Fog(SIS.renk, SIS.yakin, SIS.uzak);
    kareOrt = 1 / HZ; cpuOrt = 0.008; canliR = 9; lodPx = 4;
    // 72 Hz (Quest 2 varsayılanı 90; bu sahnede 90 tutmuyor, 72 kararlı + daha az takılma)
    const ss = renderer.xr.getSession();
    if (ss?.updateTargetFrameRate && ss.supportedFrameRates?.includes?.(HZ)) ss.updateTargetFrameRate(HZ).catch(() => {});
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    rig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
    // başlangıç: masaüstündeki bakış noktasının önüne
    const t = kayit.hedef, yon = kayit.pos.clone().sub(t); yon.y = 0;
    if (yon.lengthSq() < 1e-3) yon.set(0, 0, 1);
    yon.normalize();
    const dur = t.clone().addScaledVector(yon, 4); dur.y = 0;
    dur.x = THREE.MathUtils.clamp(dur.x, SINIR.x0, SINIR.x1); dur.z = THREE.MathUtils.clamp(dur.z, SINIR.z0, SINIR.z1);
    ilkKare = { dur, bak: new THREE.Vector3(t.x, 0, t.z) };
    const b = baslangic?.();
    if (b) {
      const d0 = new THREE.Vector3(b.x, 0, b.z);
      ilkKare = { dur: d0, bak: d0.clone().add(new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw))) };
    }
    turBasla = true;   // ilk karede (konum oturunca) tur geri sayımı başlar
  });
  let ilkKare = null, turBasla = false;
  renderer.xr.addEventListener('sessionend', () => {
    aktif = false;
    tur.bitir();
    kalite.birak();
    if (buton) buton.textContent = "VR'a gir";
    camera.getWorldPosition(_h); camera.getWorldDirection(_d);
    const cikis = { x: _h.x, z: _h.z, yaw: Math.atan2(-_d.x, -_d.z) };
    rig.remove(camera);
    camera.position.copy(kayit.pos); camera.quaternion.copy(kayit.quat);
    controls.target.copy(kayit.hedef); controls.enabled = true; controls.update();
    gunes.castShadow = kayit.golge; scene.fog = kayit.fog;
    makineler.forEach((x) => { x.kok.visible = true; x.kok.userData.ekranAktif = true; x._canli = false; });
    turOnceki = turSon = null;
    etiketler.forEach((e) => { e.visible = true; });
    P.mesh.visible = false; hedefHalka.visible = false; secili = null;
    kumandalar.forEach((k) => { k.nokta.visible = false; });
    gorunumAyarla();
    bitis?.(cikis.x, cikis.z, cikis.yaw);
  });

  // ------------------------------------------------------------------ kare
  let cullT = 0, panelT = 0, ayarT = 0;
  function update(dt, t) {
    if (!aktif) return;
    if (ilkKare) { isinlan(ilkKare.dur, ilkKare.bak); ilkKare = null; }
    if (turBasla) { turBasla = false; tur.basla(); gorunurlukGuncelle(); }
    kareOrt += (dt - kareOrt) * 0.05;

    // çubuklar (yalnız tur dururken: tur sürerken rig'i tur taşır): sol yürür, sağ adımlı döner
    camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    _r.crossVectors(_d, Y).normalize();
    for (const k of kumandalar) {
      const gp = k.gp; if (!gp || gp.axes.length < 4 || tur.yuruyor()) continue;
      const ax = gp.axes[2], ay = gp.axes[3];
      if (k.el === 'left') {
        const m = Math.hypot(ax, ay);
        if (m > 0.15) {
          const s = ((m - 0.15) / 0.85) * 2.6 * dt / m;
          _v.set(0, 0, 0).addScaledVector(_d, -ay * s).addScaledVector(_r, ax * s);
          if (gezgin) {
            camera.getWorldPosition(_h);
            const [nx, nz] = gezgin.kaydir(_h.x, _h.z, _h.x + _v.x, _h.z + _v.z);
            _v.set(nx - _h.x, 0, nz - _h.z);
          }
          rig.position.add(_v);
          rig.position.x = THREE.MathUtils.clamp(rig.position.x, SINIR.x0 - 5, SINIR.x1 + 5);
          rig.position.z = THREE.MathUtils.clamp(rig.position.z, SINIR.z0 - 5, SINIR.z1 + 5);
        }
      } else if (k.el === 'right') {
        if (Math.abs(ax) > 0.7 && k.snapHazir) { rigDondur(ax > 0 ? -Math.PI / 6 : Math.PI / 6); k.snapHazir = false; }
        else if (Math.abs(ax) < 0.3) k.snapHazir = true;
      }
    }

    // tur: rig'i taşır / döndürür, paneli yanında tutar
    tur.update(dt);

    // ışın (yalnız SAĞ kumanda; sol tetik başlat/durdur): panel üzerinde vurgulama + zemin hedef halkası
    hedefHalka.visible = false;
    for (const k of kumandalar) {
      if (!k.gp || solMu(k)) { k.isin.visible = false; k.nokta.visible = false; continue; }
      k.isin.visible = true;
      isinKur(k);
      let L = 6, vurdu = false;
      for (const p of paneller()) {
        const v = panelVurus(k, p);
        if (v) {
          L = v.hit.distance; vurdu = true;
          if ((v.b?.px ?? -1) !== (p.hover?.px ?? -2) || (v.b?.py ?? -1) !== (p.hover?.py ?? -2)) {
            p.hover = v.b; panelYenile(p);
          }
          k.nokta.position.copy(v.hit.point); k.nokta.visible = true;
          break;
        }
      }
      if (!vurdu) {
        k.nokta.visible = false;
        for (const p of paneller()) if (p.hover) { p.hover = null; panelYenile(p); }
        const z = ray.ray.intersectPlane(zemin, _v);
        if (z && ray.ray.origin.distanceTo(z) < 30) {
          L = ray.ray.origin.distanceTo(z);
          if (!tur.yuruyor()) { hedefHalka.position.set(z.x, 0.02, z.z); hedefHalka.visible = true; }
        }
      }
      k.isin.scale.z = L;
    }

    // panel içeriği: 5 Hz
    panelT += dt;
    if (panelT > 0.2) { panelT = 0; if (P.mesh.visible) makinePaneliCiz(); }

    // canlı / vekil seçimi: 4 Hz
    cullT += dt;
    if (cullT > 0.25) { cullT = 0; gorunurlukGuncelle(); }

    // uyarlanır kalite (1 Hz). GPU'ya mı CPU'ya mı takıldığımızı karenin CPU süresi söyler (main.js cpuOlc):
    //  - kare yavaş ama CPU payı küçük → GPU: foveation artar (kenarlar biraz yumuşar)
    //  - kare yavaş ve CPU payı büyük → çizim çağrısı: canlı yarıçap ve ayrıntı eşiği daralır
    //  - kare hızı rahat → önce keskinlik (foveation azalır), sonra ayrıntı geri gelir
    ayarT += dt;
    if (ayarT > 1) {
      ayarT = 0;
      const butce = 1 / HZ, yavas = kareOrt > butce * 1.1, rahat = kareOrt < butce * 1.03;
      if (yavas && cpuOrt < butce * 0.8) fov = Math.min(FOV.max, fov + 0.1);
      else if (yavas) { canliR = Math.max(CANLI.min, canliR - 1); lodPx = Math.min(LOD_PX.max, lodPx + 1); }
      else if (rahat && fov > FOV.min) fov = Math.max(FOV.min, fov - 0.05);
      else if (rahat) { canliR = Math.min(CANLI.max, canliR + 0.5); lodPx = Math.max(LOD_PX.min, lodPx - 0.5); }
      renderer.xr.setFoveation(fov);
    }
  }
  // Canlı (hareketli, tam ayrıntı): turun gezdiği makine, bir önceki (uzaklaşana dek: vekile geçişteki
  // poz sıçraması uzakta olsun), paneli açık olan; tur dururken ayrıca canliR içindekiler. Diğerleri
  // vekiliyle (donmuş anlık görüntü, toplu çizim). Simülasyon hepsinde sürer.
  // Ölçüm (Quest 2): komşu makineyi de canlı tutmak kaynak robotunda tek başına ~320 çağrı ekliyordu.
  let turOnceki = null, turSon = null;
  function gorunurlukGuncelle() {
    if (!aktif) return;
    camera.getWorldPosition(_h);
    const turMk = tur.makine(), turda = tur.yuruyor();
    if (turMk !== turSon) { turOnceki = turSon; turSon = turMk; }
    makineler.forEach((x, i) => {
      const s = x.kure; const dist = s ? _h.distanceTo(s.center) - s.radius : 0;
      const yakin = dist < (x._canli ? canliR + 3 : canliR);
      const canli = !x.vekil || x === secili || x === turMk || (x === turOnceki && dist < 6) || (!turda && yakin);
      x._canli = canli;
      x.kok.visible = canli;
      kalite.vekilGoster(x, !canli);
      x.kok.userData.ekranAktif = canli && dist < 14;
      // etiket: 4–40 m (uzaktakiler hem kalabalık hem çizim çağrısı)
      if (etiketler[i]) etiketler[i].visible = dist > 4 && dist < 40;
    });
  }

  return {
    rig, aktif: () => aktif, update, makineyeGit, bagla,
    lodPiksel: () => lodPx,
    cpuOlc(ms) { cpuOrt += (ms / 1000 - cpuOrt) * 0.05; },
    ortamGeldi: (tex) => kalite.ortamGeldi(tex),
    _test: { P, tur, kalite, paneliKapat, durum: () => ({ fov, canliR, lodPx, kareOrt, cpuOrt }) },
  };
}
