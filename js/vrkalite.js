// js/vrkalite.js — Quest'te VR görüntüsü: bütün fabrika görünsün, kare hızı tutsun, görüntü keskin olsun.
//
// Quest 2 ölçümleri (Kasım 2026, Quest Browser 154, göz başına 1440×1584, 72 Hz):
//  - CPU çizim maliyeti belirleyici: renderer.render() ~460 çizim çağrısında ~11.6 ms (bütçe 13.9 ms).
//    three r184 WebGL'de multiview yok: her nesne iki göz için iki kez çizilir.
//  - Bütün makineler tam ayrıntıyla açıkken girişten hole bakış: ~3900 çağrı, ~11 fps → imkânsız.
//  - Ortam haritası (IBL) GPU'da ~4 ms; makinelerdeki nokta/spot ışıklar (çoğu sönük) ~2 ms;
//    three'nin projeksiyon katmanı bu tarayıcıda MSAA'yı ayrı çözümle yapıyor (~3 fps).
//
// Çözüm:
//  1) VEKİL: her makinenin o anki görünümü, renkleri köşe rengine yazılarak kök-yerel uzayda en çok
//     3 parçaya (boya / metal / ışık) birleştirilir; bütün makinelerin parçaları kova başına tek
//     BatchedMesh'te (WEBGL_multi_draw: tüm vekiller göz başına 3 çağrı). Turun gezdiği makine canlıdır
//     (hareketli, tam ayrıntı), diğerleri vekiliyle çizilir (js/vr.js gorunurlukGuncelle).
//     Vekil donmuş bir anlık görüntüdür: uzaktan hareket görünmez, yaklaşınca makine canlanır.
//     Ölçüm (Quest 2, tur boyunca): ortalama 45–51 fps → ~60 fps, üstelik artık bütün fabrika görünür.
//  2) Ortam yansıması yalnız metal malzemelerde kalır (boyalı yüzeyler gök ışığıyla aydınlanır,
//     gök ışığı biraz güçlenir); makinelerdeki nokta/spot ışıklar VR'da kapalı.
//  3) Bunların hepsi oturum bağlanmadan yapılır ve gölgelendiriciler o an derlenir: VR'da takılma olmaz.
//  Masaüstüne dönünce her şey eski haline gelir (vekiller gizlenir, malzemeler geri alınır).

import * as THREE from 'three';

const KUCUK = 0.035;          // vekile girmeyen minik parça yarıçapı (m): uzaktan görünmez, üçgen tasarrufu
const ISIK_ESIK = 0.4;        // emissive × yoğunluk bunu aşarsa parça "ışık" kovasına (aydınlatılmaz, parlar)

export function vrKaliteKur({ renderer, scene, camera, makineler }) {
  const MAT = {
    boya: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.7 }),
    isik: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  MAT.boya.name = 'vekil-boya'; MAT.metal.name = 'vekil-metal'; MAT.isik.name = 'vekil-isik';
  let vekilVar = false, vrde = false;
  const kayit = { env: null, envI: 1, hemi: [], isiklar: [], metaller: [] };

  // ---------------------------------------------------------------- vekil
  const _m = new THREE.Matrix4(), _im = new THREE.Matrix4(), _nm = new THREE.Matrix3();
  const _v = new THREE.Vector3(), _c = new THREE.Color(), _ic = new THREE.Color();
  const EKRAN = new THREE.Color().setRGB(0.07, 0.1, 0.14);   // dokulu düz ekran uzaktan koyu cam gibi

  function vekilKur(x) {
    const kok = x.kok;
    kok.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(kok.matrixWorld).invert();
    const parcalar = { boya: [], metal: [], isik: [] };
    const say = { boya: [0, 0], metal: [0, 0], isik: [0, 0] };   // [köşe, indis]
    const gez = (o) => {
      if (!o.visible || o.userData.hareketli) return;           // gizli parça / operatör (insan) vekile girmez
      if (o.isMesh && !o.isSkinnedMesh) ekle(o);
      for (const c of o.children) gez(c);
    };
    function ekle(o) {
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || (mat.transparent && mat.opacity < 0.6) || mat.transmission > 0) return;   // cam, saydam kalkan
      const g = o.geometry, pos = g.attributes.position;
      if (!pos) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < KUCUK) return;
      let kova = 'boya';
      if (mat.isMeshBasicMaterial) { kova = 'isik'; _c.copy(mat.color); if (mat.map) _c.copy(EKRAN); }
      else {
        _c.copy(mat.color || _ic.set(0xffffff));
        const e = mat.emissive, ei = (mat.emissiveIntensity ?? 1) * (e ? Math.max(e.r, e.g, e.b) : 0);
        if (ei > ISIK_ESIK) { kova = 'isik'; _c.copy(e).multiplyScalar(Math.min(1.4, mat.emissiveIntensity ?? 1)); }
        else if ((mat.metalness ?? 0) >= 0.5) kova = 'metal';
      }
      const n = o.isInstancedMesh ? o.count : 1;
      const ic = g.index ? g.index.count : pos.count;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Matrix4();
        if (o.isInstancedMesh) { o.getMatrixAt(i, _im); m.multiplyMatrices(o.matrixWorld, _im); } else m.copy(o.matrixWorld);
        m.premultiply(inv);
        const renk = _c.clone();
        if (o.isInstancedMesh && o.instanceColor) { o.getColorAt(i, _ic); renk.multiply(_ic); }
        parcalar[kova].push({ g, m, renk });
        say[kova][0] += pos.count; say[kova][1] += ic;
      }
    }
    gez(kok);

    const geos = {};
    let ucgen = 0;
    for (const kova of ['boya', 'metal', 'isik']) {
      const L = parcalar[kova]; if (!L.length) continue;
      const [nv, ni] = say[kova];
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Uint8Array(nv * 3);
      const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let v0 = 0, i0 = 0;
      for (const { g, m, renk } of L) {
        const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
        _nm.getNormalMatrix(m);
        const r = Math.round(THREE.MathUtils.clamp(renk.r, 0, 1) * 255), gg = Math.round(THREE.MathUtils.clamp(renk.g, 0, 1) * 255), b = Math.round(THREE.MathUtils.clamp(renk.b, 0, 1) * 255);
        for (let k = 0; k < n; k++) {
          _v.fromBufferAttribute(pos, k).applyMatrix4(m);
          const o3 = (v0 + k) * 3;
          P[o3] = _v.x; P[o3 + 1] = _v.y; P[o3 + 2] = _v.z;
          if (nor) { _v.fromBufferAttribute(nor, k).applyMatrix3(_nm).normalize(); N[o3] = _v.x; N[o3 + 1] = _v.y; N[o3 + 2] = _v.z; }
          else { N[o3 + 1] = 1; }
          C[o3] = r; C[o3 + 1] = gg; C[o3 + 2] = b;
        }
        // ayna matrisi (negatif ölçek) üçgen yönünü çevirir: indis sırası tersine
        const ters = m.determinant() < 0;
        if (g.index) {
          const ix = g.index;
          for (let k = 0; k < ix.count; k += 3) {
            const a = ix.getX(k), bb = ix.getX(k + 1), c = ix.getX(k + 2);
            I[i0 + k] = v0 + a; I[i0 + k + 1] = v0 + (ters ? c : bb); I[i0 + k + 2] = v0 + (ters ? bb : c);
          }
          i0 += ix.count;
        } else {
          for (let k = 0; k < n; k += 3) {
            I[i0 + k] = v0 + k; I[i0 + k + 1] = v0 + (ters ? k + 2 : k + 1); I[i0 + k + 2] = v0 + (ters ? k + 1 : k + 2);
          }
          i0 += n;
        }
        v0 += n;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(C, 3, true));
      geo.setIndex(new THREE.BufferAttribute(I, 1));
      geos[kova] = geo;
      ucgen += ni / 3;
    }
    return { geos, ucgen: Math.round(ucgen) };
  }

  // Bütün vekiller kova başına TEK BatchedMesh'te (WEBGL_multi_draw: göz başına bir çizim çağrısı);
  // makine başına görünürlük setVisibleAt ile, ışın kesişiminde batchId → makine.
  const toplu = [];
  function topluKur(liste) {
    for (const kova of ['boya', 'metal', 'isik']) {
      const parca = liste.filter(([, v]) => v.geos[kova]);
      if (!parca.length) continue;
      let nv = 0, ni = 0;
      for (const [, v] of parca) { nv += v.geos[kova].attributes.position.count; ni += v.geos[kova].index.count; }
      const bm = new THREE.BatchedMesh(parca.length, nv, ni, MAT[kova]);
      bm.name = `vekil-${kova}`;
      bm.sortObjects = false;
      bm.userData.vekilIcin = [];
      for (const [x, v] of parca) {
        const id = bm.addInstance(bm.addGeometry(v.geos[kova]));
        bm.setMatrixAt(id, x.kok.matrixWorld);
        bm.setVisibleAt(id, false);
        bm.userData.vekilIcin[id] = x;
        x.vekil.parcalar.push([bm, id]);
        v.geos[kova].dispose();
      }
      scene.add(bm);
      toplu.push(bm);
    }
  }
  function vekilGoster(x, acik) {
    const v = x.vekil;
    if (!v || v.acik === acik) return;
    v.acik = acik;
    for (const [bm, id] of v.parcalar) bm.setVisibleAt(id, acik);
  }

  // ---------------------------------------------------------------- VR malzeme / ışık ayarı
  function malzemeler(fn) {
    const gor = new Set();
    scene.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (!gor.has(m)) { gor.add(m); fn(m); }
    });
  }
  function vrAyari() {
    // ortam yansıması yalnız metallerde (IBL boyalı yüzeylerde GPU'nun ~%20'si, görünür etkisi az)
    kayit.env = scene.environment; kayit.envI = scene.environmentIntensity ?? 1;
    kayit.metaller = [];
    if (kayit.env) {
      malzemeler((m) => {
        if (!m.isMeshStandardMaterial || m.envMap || (m.metalness ?? 0) < 0.45) return;
        kayit.metaller.push([m, m.envMapIntensity]);
        m.envMap = kayit.env; m.envMapIntensity = (m.envMapIntensity ?? 1) * kayit.envI; m.needsUpdate = true;
      });
      MAT.metal.envMap = kayit.env; MAT.metal.envMapIntensity = kayit.envI; MAT.metal.needsUpdate = true;
      scene.environment = null;
    }
    // ortamın verdiği yaygın ışığın yerine gök ışığı güçlenir
    kayit.hemi = [];
    scene.traverse((o) => { if (o.isHemisphereLight) { kayit.hemi.push([o, o.intensity]); o.intensity *= 1.45; } });
    // makinelerdeki nokta / spot ışıklar (kaynak arkı, durum lambası, aydınlatma direği): her pikselde hesaplanıyor
    kayit.isiklar = [];
    for (const x of makineler) x.kok.traverse((o) => { if ((o.isPointLight || o.isSpotLight) && o.visible) { kayit.isiklar.push(o); o.visible = false; } });
  }
  function masaustuAyari() {
    for (const [m, i] of kayit.metaller) { m.envMap = null; m.envMapIntensity = i; m.needsUpdate = true; }
    kayit.metaller = [];
    if (kayit.env) scene.environment = kayit.env;
    for (const [l, i] of kayit.hemi) l.intensity = i;
    kayit.hemi = [];
    for (const l of kayit.isiklar) l.visible = true;
    kayit.isiklar = [];
  }

  return {
    // oturum bağlanmadan: vekiller (ilk seferde) + malzeme/ışık + gölgelendirici derleme
    hazirla() {
      const t0 = performance.now();
      let ucgen = 0;
      if (!vekilVar) {
        const liste = [];
        for (const x of makineler) {
          try { const v = vekilKur(x); ucgen += v.ucgen; x.vekil = { parcalar: [], acik: null }; liste.push([x, v]); }
          catch (e) { console.warn(`[vr] vekil kurulamadı: ${x.m.id}`, e); x.vekil = null; }
        }
        try { topluKur(liste); }
        catch (e) { console.warn('[vr] vekiller toplanamadı', e); for (const x of makineler) x.vekil = null; }
        vekilVar = true;
      }
      const t1 = performance.now();
      if (!vrde) { vrAyari(); vrde = true; }
      try { renderer.compile(scene, camera); } catch (e) { console.warn('[vr] ön derleme', e); }
      const ist = { vekilMs: Math.round(t1 - t0), derlemeMs: Math.round(performance.now() - t1), vekilUcgen: ucgen };
      console.info('[vr] hazır', ist);
      return ist;
    },
    birak() {
      if (vrde) { masaustuAyari(); vrde = false; }
      for (const x of makineler) vekilGoster(x, false);
    },
    vekilGoster,
    vekilNesneleri: () => toplu,
    // HDR ortam haritası VR sırasında yüklenirse: metaller yenisini kullanır, çıkışta sahneye o döner
    ortamGeldi(tex) {
      if (!vrde) return false;
      const eski = kayit.env;
      kayit.env = tex;
      for (const [m] of kayit.metaller) { m.envMap = tex; m.needsUpdate = true; }
      MAT.metal.envMap = tex; MAT.metal.needsUpdate = true;
      eski?.dispose?.();
      return true;
    },
  };
}
