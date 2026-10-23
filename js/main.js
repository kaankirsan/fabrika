// js/main.js — sanal fabrika: salon, kamera, makine yükleme, seçim ve kontrol paneli.
//
// Makineler js/machines/<id>.js içinde, sözleşme lib.js başında. Her makine
// ayrı dinamik import ile yüklenir: biri bozuksa salon yine açılır, o bölmede
// "hazırlanıyor" yer tutucusu görünür (konsola hata düşer).
//
// URL parametreleri (test / doğrudan bağlantı için):
//   ?m=<id>   açılışta o makineye odaklan      ?ui=0   arayüzü gizle

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import * as lib from './lib.js';
import { vrKur } from './vr.js';

const { M, box, canvasTex, easeInOut, clamp } = lib;
const $ = (id) => document.getElementById(id);
const URLP = new URLSearchParams(location.search);
if (URLP.get('ui') === '0') document.body.classList.add('arayuzsuz');

// Kuzey sırası (z<0) önünü koridora (+Z) verir; güney sırası 180° döner.
// Konteyner salonun sağ duvarındaki kapıdan çıkılan dış sahada (açık dizi ~30 m + kamyon yolu).
const YERLESIM = [
  { id: 'kaynak',    x: -38.5, z: -10, ry: 0 },
  { id: 'konveyor',  x: -17.5, z: -10, ry: 0 },
  { id: 'pres',      x: 2.5,   z: -10, ry: 0 },
  { id: 'vagon',     x: 15,    z: -10, ry: 0 },
  { id: 'konteyner', x: 66,    z: -14, ry: 0 },
  { id: 'hedef',     x: -30, z: 10,  ry: Math.PI },
  { id: 'jetyakit',  x: -15, z: 10,  ry: Math.PI },
  { id: 'fikstur',   x: 0,   z: 10,  ry: Math.PI },
  { id: 'solarbot',  x: 15,  z: 10,  ry: Math.PI },
  // "Diğer makineler" (MKN-F/V) — dış saha
  { id: 'fk1000',    x: 100,   z: 16,  ry: 0 },
  { id: 'bigbag',    x: 100,   z: -26, ry: 0 },
  // salon: güney sırası boş yeri + batı uzantısı
  { id: 'saft',      x: 30,    z: 10,  ry: Math.PI },
  { id: 'yangin',    x: -57,   z: -10, ry: 0 },
  { id: 'sacpres',   x: -75,   z: -10, ry: 0 },
  { id: 'sasi',      x: -94,   z: -10, ry: 0 },
  { id: 'taslama',   x: -45,   z: 10,  ry: Math.PI },
  { id: 'disacma',   x: -60,   z: 10,  ry: Math.PI },
  { id: 'yikama',    x: -75,   z: 10,  ry: Math.PI },
  { id: 'pompatest', x: 31,    z: -10, ry: 0 },
];

// ------------------------------------------------------------------ renderer
const canvas = $('sahne');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b222b);
scene.fog = new THREE.Fog(0x1b222b, 260, 520);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 900);
const GENEL = { poz: new THREE.Vector3(-30, 92, 106), hedef: new THREE.Vector3(-30, 0, 4) };
const SAHA_GORUNUM = { poz: new THREE.Vector3(118, 52, 62), hedef: new THREE.Vector3(90, 0, -2) };
camera.position.copy(GENEL.poz);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(GENEL.hedef);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.2;
controls.maxDistance = 280;
controls.screenSpacePanning = false; // zemin düzleminde kaydır
controls.update();

// Görüntü merkezini sol liste (~250 px) ile sağ panel (~370 px, açıksa)
// arasındaki serbest alanın ortasına kaydır: makine panelin arkasında kalmasın.
function gorunumAyarla() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  const genis = W > 900;
  const kay = genis ? Math.round(((!$('panel').hidden ? 370 : 0) - 250) / 2) : 0;
  if (kay) camera.setViewOffset(W, H, kay, 0, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}
window.addEventListener('resize', gorunumAyarla);

// ------------------------------------------------------------------ ışık
scene.add(new THREE.HemisphereLight(0xe6edf5, 0x3a342c, 1.15));
// Gölge kutusu salon + dış saha (x -106…134) birlikte kapsasın diye ışık hedefi ortaya alındı
const gunes = new THREE.DirectionalLight(0xfff2df, 2.4);
gunes.position.set(42, 52, 22);
gunes.target.position.set(14, 0, 0);
scene.add(gunes.target);
gunes.castShadow = true;
gunes.shadow.mapSize.set(4096, 4096);
Object.assign(gunes.shadow.camera, { left: -125, right: 125, top: 40, bottom: -40, near: 5, far: 180 });
gunes.shadow.bias = -0.0003;
gunes.shadow.normalBias = 0.03;
scene.add(gunes);

// ------------------------------------------------------------------ salon
// Salon batıya uzatıldı (18 makine): x x0…x1; sağ duvarda dış sahaya kapı.
const SALON = { x0: -106, x1: 46, z: 46 };
SALON.x = SALON.x1 - SALON.x0;
SALON.xc = (SALON.x0 + SALON.x1) / 2;
function salonKur() {
  const g = new THREE.Group();
  // Beton zemin: gürültü + hafif lekeler
  const beton = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#8f9396'; x.fillRect(0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n;
    }
    x.putImageData(id, 0, 0);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(60,60,58,${Math.random() * 0.06})`;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 30 + Math.random() * 120, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(40,40,40,.25)'; x.lineWidth = 2; // derz çizgileri (6 m)
    x.strokeRect(0, 0, w, h);
  }, { tekrar: [SALON.x / 6, SALON.z / 6] });
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(SALON.x, SALON.z),
    new THREE.MeshStandardMaterial({ map: beton, roughness: 0.85, metalness: 0.05 }));
  zemin.rotation.x = -Math.PI / 2;
  zemin.position.x = SALON.xc;
  zemin.receiveShadow = true;
  g.add(zemin);

  // Koridor şeritleri
  const seritMat = new Map();   // renk başına tek malzeme → birleştirmede tek çizim
  const serit = (x0, z0, x1, z1, w = 0.12, renk = 0xf2c200) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (!seritMat.has(renk)) seritMat.set(renk, new THREE.MeshStandardMaterial({ color: renk, roughness: 0.7 }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), seritMat.get(renk));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
    m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    m.receiveShadow = true;
    g.add(m);
  };
  serit(SALON.x0 + 2, -2.2, SALON.x1 - 2, -2.2); serit(SALON.x0 + 2, 2.2, SALON.x1 - 2, 2.2);
  // Yaya geçidi çizgileri koridorda
  for (let x = SALON.x0 + 16; x <= SALON.x1 - 6; x += 20) for (let k = -1.6; k <= 1.6; k += 0.8) serit(x - 1.2, k, x + 1.2, k, 0.35, 0xdedede);

  // Duvarlar + kolonlar + pencere bandı. Sağ duvarda dış sahaya açılan büyük kapı (z KAPI[0]…KAPI[1]).
  const duvarMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.8 });
  const pencere = new THREE.MeshStandardMaterial({ color: 0xa9c9e0, emissive: 0x9cc4e4, emissiveIntensity: 0.35, roughness: 0.2 });
  const H = 9, KAPI = [-20, -5], KH = 7;
  const xR = SALON.x1;
  const sagParcalar = [[(-SALON.z / 2 + KAPI[0]) / 2, KAPI[0] + SALON.z / 2], [(KAPI[1] + SALON.z / 2) / 2, SALON.z / 2 - KAPI[1]]];
  [[SALON.xc, -SALON.z / 2, SALON.x, 0], [SALON.x0, 0, SALON.z, Math.PI / 2], ...sagParcalar.map(([z, L]) => [xR, z, L, Math.PI / 2])].forEach(([x, z, L, ry]) => {
    const d = box(L, H, 0.25, duvarMat, x, H / 2, z, g);
    d.rotation.y = ry;
    if (L < 6) return;
    const p = box(L - 2, 1.4, 0.05, pencere, x, H - 1.6, z, g);
    p.rotation.y = ry;
    p.position.x += Math.sin(ry) * 0.16; p.position.z += Math.cos(ry) * 0.16;
    p.castShadow = false;
  });
  // kapı lentosu + ikaz çerçevesi
  const lento = box(KAPI[1] - KAPI[0], H - KH, 0.25, duvarMat, xR, (H + KH) / 2, (KAPI[0] + KAPI[1]) / 2, g);
  lento.rotation.y = Math.PI / 2;
  const ikazK = lib.ikazDokusu([1, 12]);
  for (const z of KAPI) box(0.3, KH, 0.32, new THREE.MeshStandardMaterial({ map: ikazK, roughness: 0.6 }), xR, KH / 2, z, g);
  const kapiYazi = lib.levha(['DIŞ SAHA →', 'Konteyner · FK-1000 · Big bag'], 7, 1.3, { bg: '#17324f', font: 92, px: 1200 });
  kapiYazi.rotation.y = -Math.PI / 2;
  kapiYazi.position.set(xR - 0.2, KH + 0.9, (KAPI[0] + KAPI[1]) / 2);
  g.add(kapiYazi);

  // Dış saha: asfalt + kamyon şeridi çizgileri
  const SAHA = { x0: xR, x1: 134, z0: -36, z1: 34 };
  const asfalt = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#4b4f53'; x.fillRect(0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    x.putImageData(id, 0, 0);
  }, { tekrar: [(SAHA.x1 - SAHA.x0) / 8, (SAHA.z1 - SAHA.z0) / 8] });
  const saha = new THREE.Mesh(new THREE.PlaneGeometry(SAHA.x1 - SAHA.x0, SAHA.z1 - SAHA.z0),
    new THREE.MeshStandardMaterial({ map: asfalt, roughness: 0.95 }));
  saha.rotation.x = -Math.PI / 2;
  saha.position.set((SAHA.x0 + SAHA.x1) / 2, -0.002, (SAHA.z0 + SAHA.z1) / 2);
  saha.receiveShadow = true;
  g.add(saha);
  for (let x = xR + 2; x < SAHA.x1 - 2; x += 6) serit(x, -18.6, x + 3, -18.6, 0.15, 0xe8e8e8);
  serit(xR + 1, -9.4, SAHA.x1 - 1, -9.4, 0.15, 0xe8e8e8);
  serit(xR, KAPI[0] + 0.5, xR + 4, KAPI[0] + 0.5, 0.12); serit(xR, KAPI[1] - 0.5, xR + 4, KAPI[1] - 0.5, 0.12);
  for (let x = SALON.x0 + 7.5; x <= SALON.x1 - 7; x += 15) box(0.5, H, 0.5, M.mavi, x, H / 2, -SALON.z / 2 + 0.38, g);
  // Arka duvarda "SANAL FABRİKA" yazısı (kolonların arasına denk gelir)
  const yazi = lib.levha(['SANAL FABRİKA', 'Kaan Kırşan · Otomasyon & Robotik'], 14, 2.4, { bg: '#17324f', font: 92, px: 1600 });
  yazi.position.set(-31, 5.4, -SALON.z / 2 + 0.15);
  g.add(yazi);
  scene.add(g);
  lib.sabitle(g);   // salon tamamen sabit: duvar/şerit/kolon/kapı parçaları malzeme başına birleşir
}
salonKur();

// Bölme zemin işareti: sarı-siyah çerçeve + numara levhası. merkez = [x, z] (ayakIziMerkez)
// İkaz şeridi tüm bölmelerde TEK doku/malzeme paylaşır; uzunluk UV'ye işlenir (görüntü aynı).
let _ikazMat = null;
function bolmeIsaret(parent, w, d, no, ad, [cx, cz] = [0, 0]) {
  if (!_ikazMat) {
    const t = lib.ikazDokusu([1, 1]);
    _ikazMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }
  const isaret = new THREE.Group();
  parent.add(isaret);
  const kenar = (len, x, z, ry) => {
    const geo = new THREE.PlaneGeometry(len, 0.14);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 0.6));
    const m = new THREE.Mesh(geo, _ikazMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
    m.position.set(cx + x, 0.006, cz + z); m.receiveShadow = true;
    isaret.add(m);
  };
  kenar(w, 0, -d / 2, 0); kenar(w, 0, d / 2, 0);
  kenar(d, -w / 2, 0, Math.PI / 2); kenar(d, w / 2, 0, Math.PI / 2);
  const lv = lib.levha([`${String(no).padStart(2, '0')}  ${ad.toLocaleUpperCase('tr')}`], 3.6, 0.36,
    { bg: '#151b22', fg: '#f2c200', font: 50, px: 1024 });
  lv.rotation.x = -Math.PI / 2;
  lv.position.set(cx - w / 2 + 1.8, 0.008, cz + d / 2 + 0.32);
  isaret.add(lv);
  lib.sabitle(isaret);
}

// Yüzen etiket (genel bakışta makine adı)
function etiketSprite(no, ad) {
  const tex = canvasTex(768, 128, (x, w, h) => {
    x.fillStyle = 'rgba(12,16,22,.86)';
    x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill();
    x.strokeStyle = '#f2c200'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#f2c200'; x.font = '700 58px "JetBrains Mono", monospace'; x.textBaseline = 'middle';
    x.fillText(String(no).padStart(2, '0'), 34, h / 2 + 2);
    x.fillStyle = '#e8eef3'; x.font = '600 50px "Space Grotesk", sans-serif';
    x.fillText(ad, 130, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(8.4, 1.4, 1);
  s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ makineler
const makineler = []; // {m, yer, no, kok, etiket}
async function makineleriYukle() {
  await document.fonts.ready.catch(() => {});
  await Promise.all(YERLESIM.map(async (yer, i) => {
    const no = i + 1;
    const kok = new THREE.Group();
    kok.position.set(yer.x, 0, yer.z);
    kok.rotation.y = yer.ry;
    scene.add(kok);
    let m;
    try {
      const mod = await import(`./machines/${yer.id}.js`);
      m = mod.create(lib);
    } catch (e) {
      console.error(`[makine:${yer.id}] yüklenemedi`, e);
      m = yerTutucu(yer.id);
    }
    kok.add(m.group);
    kok.userData.makine = m;
    const [w, d] = m.ayakIzi || [10, 10];
    bolmeIsaret(kok, w, d, no, m.ad, m.ayakIziMerkez);
    const kutu = new THREE.Box3().setFromObject(m.group);
    const et = etiketSprite(no, m.ad);
    et.position.set(yer.x, Math.max(kutu.max.y, 2) + 1.6, yer.z);
    scene.add(et);
    // görüş/uzaklık testleri için dünya küresi (hareketli parçalara pay: ×1.15)
    const kure = new THREE.Box3().setFromObject(kok).getBoundingSphere(new THREE.Sphere());
    kure.radius *= 1.15;
    makineler[i] = { m, yer, no, kok, etiket: et, kure };
  }));
}

// Performans (görüntüye etkisi yok): gölge haritasına ~20 cm'den küçük parçaları
// (buton, cıvata, LED, kablo...) çizme — gölgeleri zaten 1–2 gölge pikseli. Instanced
// gruplar (rulo, panel vb.) tek çizim olduğundan dokunulmaz.
function kucukGolgeleriKapat() {
  const s = new THREE.Vector3();
  let n = 0;
  for (const x of makineler) {
    x.kok.updateMatrixWorld(true);
    x.kok.traverse((o) => {
      if (!o.isMesh || !o.castShadow || o.isInstancedMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(s);
      if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.1) { o.castShadow = false; n++; }
    });
  }
  return n;
}

function yerTutucu(id) {
  const g = new THREE.Group();
  box(3, 1.2, 2, M.gri, 0, 0.6, 0, g);
  return {
    id, ad: id + ' (hazırlanıyor)', kisa: 'Bu makinenin modeli henüz yüklenemedi.', ayakIzi: [8, 8], group: g,
    mekanizmalar: [], cikarim: [], kontroller: [], update() {}, degerler: () => [], trend: null,
    durum: () => ({ metin: 'YOK', seviye: 'bekliyor' }),
  };
}

// ------------------------------------------------------------------ kamera uçuşu
let ucus = null;
function uc(poz, hedef, sure = 1.3) {
  ucus = { p0: camera.position.clone(), t0: controls.target.clone(), p1: poz.clone(), t1: hedef.clone(), k: 0, sure };
}
controls.addEventListener('start', () => { ucus = null; });

function makineKamerasi(x) {
  const { m, kok } = x;
  kok.updateMatrixWorld(true);
  if (m.kamera) {
    return {
      poz: kok.localToWorld(new THREE.Vector3().fromArray(m.kamera.poz)),
      hedef: kok.localToWorld(new THREE.Vector3().fromArray(m.kamera.hedef)),
    };
  }
  const kutu = new THREE.Box3().setFromObject(m.group);
  const merkez = kutu.getCenter(new THREE.Vector3());
  const boy = kutu.getSize(new THREE.Vector3());
  const mesafe = Math.max(boy.x, boy.y * 1.4, boy.z) * 1.25 + 2.5;
  const yon = new THREE.Vector3(0.55, 0.6, 1).normalize().applyQuaternion(kok.quaternion);
  return { poz: merkez.clone().addScaledVector(yon, mesafe), hedef: merkez };
}

// ------------------------------------------------------------------ seçim / arayüz
let secili = null;
function sec(x, { anlik = false } = {}) {
  secili = x;
  document.querySelectorAll('.kart').forEach((k, i) => k.classList.toggle('secili', makineler[i] === x));
  if (!x) {
    $('panel').hidden = true; gorunumAyarla();
    if (anlik) { camera.position.copy(GENEL.poz); controls.target.copy(GENEL.hedef); } else uc(GENEL.poz, GENEL.hedef);
    return;
  }
  const k = makineKamerasi(x);
  if (anlik) { camera.position.copy(k.poz); controls.target.copy(k.hedef); } else uc(k.poz, k.hedef);
  paneliKur(x);
  gorunumAyarla();
}

function listeKur() {
  const L = $('liste');
  L.innerHTML = '';
  makineler.forEach((x) => {
    const d = document.createElement('div');
    d.className = 'kart';
    d.innerHTML = `<span class="no">${String(x.no).padStart(2, '0')}</span>
      <span class="ad">${x.m.ad}<small>${x.m.altBaslik || ''}</small></span><span class="nokta"></span>`;
    d.onclick = () => sec(x);
    L.appendChild(d);
  });
}

let senkronlar = [];
function paneliKur(x) {
  const { m } = x;
  const P = $('panel-ic');
  senkronlar = [];
  P.innerHTML = '';
  const el = (tag, cls, html, parent = P) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };
  const ust = el('div', 'p-ust');
  el('h2', '', `<span style="color:var(--sari);font-family:var(--mono);font-size:14px">${String(x.no).padStart(2, '0')}</span> ${m.ad}`, ust);
  const kapat = el('button', 'kapat', '×', ust);
  kapat.title = 'Genel bakışa dön';
  kapat.onclick = () => sec(null);
  el('div', 'p-kisa', m.kisa || '');
  const durumEl = el('span', 'durum', '');

  if (m.kontroller?.length) {
    const b = el('div', 'p-bolum');
    el('h3', '', 'Kontrol', b);
    kontrolleriCiz(m.kontroller, b);
  }
  const db = el('div', 'p-bolum');
  el('h3', '', 'Canlı değerler', db);
  const degerEl = el('div', 'degerler', '', db);
  let trendCanvas = null;
  if (m.trend) {
    const tb = el('div', 'p-bolum');
    el('h3', '', 'Trend', tb);
    trendCanvas = el('canvas', '', null, tb);
    trendCanvas.id = 'trend';
  }
  if (m.mekanizmalar?.length) {
    const mb = el('div', 'p-bolum');
    el('h3', '', 'Hareketli mekanizmalar', mb);
    el('ul', 'liste-m', m.mekanizmalar.map((s) => `<li>${s}</li>`).join(''), mb);
  }
  if (m.cikarim?.length) {
    const cb = el('div', 'p-bolum');
    const det = el('details', 'cikarim', '', cb);
    det.open = true;
    el('summary', '', 'Fotoğraf / videodan çıkarımlar', det);
    el('ul', 'liste-m', m.cikarim.map((s) => `<li>${s}</li>`).join(''), det);
  }
  $('panel').hidden = false;
  P.parentElement.scrollTop = 0;
  panelGuncelle = () => {
    const d = m.durum();
    durumEl.innerHTML = `<span class="nokta ${d.seviye}"></span>${d.metin}`;
    degerEl.innerHTML = m.degerler().map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
    senkronlar.forEach((f) => f());
    if (trendCanvas) trendCiz(trendCanvas, m.trend);
  };
  panelGuncelle();
}
let panelGuncelle = () => {};

function kontrolleriCiz(liste, parent) {
  const el = (tag, cls, html, p = parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    p.appendChild(e);
    return e;
  };
  for (const k of liste) {
    if (k.tip === 'baslik') el('div', 'k-baslik', k.metin);
    else if (k.tip === 'butonlar') {
      const s = el('div', 'k-satir');
      for (const o of k.ogeler) {
        const b = el('button', 'k-dugme ' + (o.tur || ''), o.metin, s);
        b.onclick = () => o.tik();
      }
    } else if (k.tip === 'basili') {
      const s = el('div', 'k-satir');
      for (const o of k.ogeler) {
        const b = el('button', 'k-dugme', o.metin, s);
        let basik = false;
        const birak = () => { if (!basik) return; basik = false; b.classList.remove('basili'); o.birak(); };
        b.addEventListener('pointerdown', (e) => { basik = true; b.setPointerCapture(e.pointerId); b.classList.add('basili'); o.bas(); });
        b.addEventListener('pointerup', birak);
        b.addEventListener('pointercancel', birak);
        b.addEventListener('lostpointercapture', birak);
      }
    } else if (k.tip === 'kaydirici') {
      const w = el('label', 'k-kaydir');
      el('span', '', k.metin, w);
      const out = el('output', '', '', w);
      const r = el('input', '', null, w);
      Object.assign(r, { type: 'range', min: k.min, max: k.max, step: k.adim ?? 1 });
      let surukleniyor = false;
      const yaz = (v) => { out.textContent = `${(+v).toFixed(decimals(k.adim))} ${k.birim || ''}`; };
      r.value = k.get(); yaz(r.value);
      r.addEventListener('input', () => { k.set(+r.value); yaz(r.value); });
      r.addEventListener('pointerdown', () => (surukleniyor = true));
      r.addEventListener('pointerup', () => (surukleniyor = false));
      senkronlar.push(() => { if (!surukleniyor && document.activeElement !== r) { const v = k.get(); if (+r.value !== v) { r.value = v; yaz(v); } } });
    } else if (k.tip === 'secim') {
      const w = el('label', 'k-secim');
      el('span', '', k.metin, w);
      const s = el('select', '', k.secenekler.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''), w);
      s.value = k.get();
      s.onchange = () => k.set(s.value);
      senkronlar.push(() => { if (document.activeElement !== s && s.value !== String(k.get())) s.value = k.get(); });
    } else if (k.tip === 'anahtar') {
      const w = el('label', 'k-anahtar');
      const c = el('input', '', null, w);
      c.type = 'checkbox';
      c.checked = !!k.get();
      el('span', '', k.metin, w);
      c.onchange = () => k.set(c.checked);
      senkronlar.push(() => { if (c.checked !== !!k.get()) c.checked = !!k.get(); });
    }
  }
}
const decimals = (adim = 1) => { const s = String(adim); return s.includes('.') ? s.split('.')[1].length : 0; };

function trendCiz(cv, tr) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  let lo = tr.min, hi = tr.max;
  if (lo == null || hi == null) {
    let a = Infinity, b = -Infinity;
    tr.veri.forEach((d) => d.forEach((v) => { if (v < a) a = v; if (v > b) b = v; }));
    if (!Number.isFinite(a)) { a = 0; b = 1; }
    const pay = Math.max((b - a) * 0.12, 1e-6);
    lo = lo ?? a - pay; hi = hi ?? b + pay;
  }
  const pl = 6, pr = 6, pt = 18, pb = 6;
  x.strokeStyle = '#1f2a35'; x.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pt + (H - pt - pb) * i / 4; x.beginPath(); x.moveTo(pl, y); x.lineTo(W - pr, y); x.stroke(); }
  x.font = '10px "JetBrains Mono", monospace'; x.fillStyle = '#6e7c89';
  x.textAlign = 'right';
  x.fillText(fmtEksen(hi), W - pr, pt - 6 + 10 + 2);
  x.fillText(fmtEksen(lo), W - pr, H - pb - 2);
  tr.seriler.forEach((s, i) => {
    const d = tr.veri[i];
    if (d.length < 2) return;
    x.strokeStyle = s.renk; x.lineWidth = s.kalin ?? 1.6; x.setLineDash(s.kesik ? [5, 4] : []);
    x.beginPath();
    d.forEach((v, k) => {
      const px = pl + (W - pl - pr) * k / (tr.uzunluk - 1);
      const py = pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
      k ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.stroke();
  });
  x.setLineDash([]);
  x.textAlign = 'left';
  let lx = pl + 2;
  tr.seriler.forEach((s, i) => {
    const son = tr.veri[i].at(-1);
    const t = `${s.ad} ${son != null ? fmtEksen(son) : ''}`;
    x.fillStyle = s.renk; x.fillRect(lx, 6, 8, 3);
    x.fillStyle = '#c9d3dc'; x.fillText(t, lx + 11, 11);
    lx += x.measureText(t).width + 24;
  });
}
const fmtEksen = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

// ------------------------------------------------------------------ fare: seçim + hover
const ray = new THREE.Raycaster();
const fareN = new THREE.Vector2();
let basNokta = null;
function makineBul(e) {
  const r = canvas.getBoundingClientRect();
  fareN.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(fareN, camera);
  const hit = ray.intersectObjects(makineler.map((x) => x.kok), true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.makine) o = o.parent;
  return o ? makineler.find((x) => x.kok === o) : null;
}
canvas.addEventListener('pointerdown', (e) => { basNokta = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!basNokta || Math.hypot(e.clientX - basNokta.x, e.clientY - basNokta.y) > 5 || e.button !== 0) return;
  const x = makineBul(e);
  if (x && x !== secili) sec(x);
});
let hoverZ = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - hoverZ < 60 || e.buttons) return;
  hoverZ = now;
  const x = makineBul(e);
  const tt = $('tooltip');
  if (x) {
    tt.hidden = false; tt.textContent = `${String(x.no).padStart(2, '0')} · ${x.m.ad}`;
    tt.style.left = e.clientX + 14 + 'px'; tt.style.top = e.clientY + 12 + 'px';
    canvas.style.cursor = 'pointer';
  } else { tt.hidden = true; canvas.style.cursor = ''; }
});

// ------------------------------------------------------------------ klavye: WASD yürüyüş, 1-9, Esc
const tus = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'escape') sec(null);
  else if (/^[1-9]$/.test(k) && makineler[+k - 1]) sec(makineler[+k - 1]);
  else if (k === 'e' || k === 'q') {
    // listede sonraki / önceki makine (9'dan fazla makine için)
    const n = makineler.length, i = secili ? makineler.indexOf(secili) : (k === 'e' ? -1 : 0);
    sec(makineler[(i + (k === 'e' ? 1 : -1) + n) % n]);
  } else tus.add(k);
});
window.addEventListener('keyup', (e) => tus.delete(e.key.toLowerCase()));
const _ileri = new THREE.Vector3(), _sag = new THREE.Vector3();
function yuru(dt) {
  if (!tus.size) return;
  camera.getWorldDirection(_ileri); _ileri.y = 0; _ileri.normalize();
  _sag.crossVectors(_ileri, camera.up).normalize();
  const hiz = (tus.has('shift') ? 16 : 7) * dt;
  const v = new THREE.Vector3();
  if (tus.has('w')) v.add(_ileri);
  if (tus.has('s')) v.sub(_ileri);
  if (tus.has('d')) v.add(_sag);
  if (tus.has('a')) v.sub(_sag);
  if (v.lengthSq() === 0) return;
  ucus = null;
  v.normalize().multiplyScalar(hiz);
  camera.position.add(v); controls.target.add(v);
}

// ------------------------------------------------------------------ üst şerit düğmeleri
$('btn-genel').onclick = () => { if (!vr?.aktif()) sec(null); };
$('btn-saha').onclick = () => { sec(null); uc(SAHA_GORUNUM.poz, SAHA_GORUNUM.hedef); };
$('chk-etiket').onchange = (e) => makineler.forEach((x) => (x.etiket.visible = e.target.checked));
$('chk-golge').onchange = (e) => { gunes.castShadow = e.target.checked; };

// ------------------------------------------------------------------ döngü
// ------------------------------------------------------------------ performans yardımcıları
// 1) Ekran (HMI) dokuları yalnız görüş alanındaki ve yakın makinelerde yeniden çizilir
//    (lib.Ekran.ciz kök grubun ekranAktif bayrağına bakar). Görüntü aynı; boşa çizim yok.
// 2) Uyarlanır çözünürlük: kare hızı belirgin düşerse piksel oranı kademeli azalır,
//    toparlanınca geri yükselir. Güçlü makinede hiç devreye girmez.
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _cw = new THREE.Vector3();
let gorusT = 0;
function ekranlariAyarla() {
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_pm);
  camera.getWorldPosition(_cw);
  for (const x of makineler) {
    const yakin = _cw.distanceTo(x.kure.center) - x.kure.radius < 45;
    x.kok.userData.ekranAktif = x === secili || (yakin && _fr.intersectsSphere(x.kure));
  }
}
const PR_MAX = Math.min(window.devicePixelRatio, 2);
let prSimdi = PR_MAX, kareOrt = 1 / 60, prT = 0;
function cozunurlukAyarla(dt) {
  kareOrt += (dt - kareOrt) * 0.03;
  prT += dt;
  if (prT < 2) return;
  prT = 0;
  let yeni = prSimdi;
  if (kareOrt > 1 / 38 && prSimdi > 1) yeni = Math.max(1, prSimdi - 0.25);
  else if (kareOrt < 1 / 56 && prSimdi < PR_MAX) yeni = Math.min(PR_MAX, prSimdi + 0.25);
  if (yeni !== prSimdi) { prSimdi = yeni; renderer.setPixelRatio(prSimdi); renderer.setSize(window.innerWidth, window.innerHeight); }
}

const saat = new THREE.Timer();
let t = 0, uiAcc = 0, vr = null;
function dongu(zaman) {
  saat.update(zaman);
  const dt = Math.min(saat.getDelta(), 0.05);
  t += dt;
  const vrde = vr?.aktif();
  camera.getWorldPosition(_cw);
  for (const x of makineler) {
    try { x.m.update(dt, t); } catch (e) { console.error(`[makine:${x.m.id}] update`, e); x.m.update = () => {}; }
    // Seçili makinenin etiketi gizli; kameraya yakın olanlar silikleşir (görüşü kapatmasın)
    const d = _cw.distanceTo(x.etiket.position);
    x.etiket.material.opacity = x === secili ? 0 : clamp((d - (vrde ? 5 : 16)) / (vrde ? 4 : 10), 0, 1);
  }
  if (vrde) {
    vr.update(dt, t);
  } else {
    if (ucus) {
      ucus.k = Math.min(1, ucus.k + dt / ucus.sure);
      const e = easeInOut(ucus.k);
      camera.position.lerpVectors(ucus.p0, ucus.p1, e);
      controls.target.lerpVectors(ucus.t0, ucus.t1, e);
      if (ucus.k >= 1) ucus = null;
    }
    yuru(dt);
    controls.update();
    gorusT += dt;
    if (gorusT > 0.25) { gorusT = 0; ekranlariAyarla(); }
    cozunurlukAyarla(dt);
  }
  uiAcc += dt;
  if (uiAcc > 0.15) {
    uiAcc = 0;
    if (secili) panelGuncelle();
    document.querySelectorAll('.kart .nokta').forEach((n, i) => {
      const s = makineler[i]?.m.durum().seviye || 'bekliyor';
      if (n.className !== 'nokta ' + s) n.className = 'nokta ' + s;
    });
  }
  renderer.render(scene, camera);
}

await makineleriYukle();
listeKur();
gorunumAyarla();
// Sabit parçaları birleştir (makine `sabitHaric` listesini verdiyse; ?sabit=0 kapatır)
const sabitIst = {};
if (URLP.get('sabit') !== '0') {
  for (const x of makineler) {
    const h = x.m.sabitHaric;
    if (!h) continue;
    try { sabitIst[x.m.id] = lib.sabitle(x.m.group, typeof h === 'function' ? h() : h); }
    catch (e) { console.error(`[makine:${x.m.id}] sabitle`, e); }
  }
}
const golgesiz = kucukGolgeleriKapat();
// VR: masaüstü seçimini sessizce eşitle (kamera uçuşu / HTML panel yok)
vr = vrKur({
  renderer, scene, camera, controls, makineler, gunes,
  etiketler: makineler.map((x) => x.etiket),
  gorunumAyarla,
  buton: $('btn-vr'),
  masaustuSec: (x) => { secili = x; document.querySelectorAll('.kart').forEach((k, i) => k.classList.toggle('secili', makineler[i] === x)); },
});
const ilk = URLP.get('m');
const ilkX = ilk && makineler.find((x) => x.m.id === ilk || x.yer.id === ilk);
if (ilkX) sec(ilkX, { anlik: true });
renderer.setAnimationLoop(dongu);
$('yukleniyor').classList.add('bitti');
window.__fabrika = { makineler, sec, hazir: true, camera, controls, renderer, golgesiz, vr, sabitIst };
