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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import * as lib from './lib.js';
import { vrKur } from './vr.js';

const { M, box, canvasTex, easeInOut, clamp } = lib;
const $ = (id) => document.getElementById(id);
const URLP = new URLSearchParams(location.search);
if (URLP.get('ui') === '0') document.body.classList.add('arayuzsuz');

// Kuzey sırası (z<0) önünü koridora (+Z) verir; güney sırası 180° döner.
// Konteyner, FK-1000 ve big bag A holünün doğusundaki B holünde. Konteyner ile big bag
// ry = π/2: kamyon şeritleri (yerel +X) dünya −Z'ye, B holünün arka duvarındaki kapılara bakar;
// konteynerin açılan panel dizisi (yerel +Z) doğuya uzanır.
const YERLESIM = [
  { id: 'kaynak',    x: -38.5, z: -10, ry: 0 },
  { id: 'konveyor',  x: -17.5, z: -10, ry: 0 },
  { id: 'pres',      x: 2.5,   z: -10, ry: 0 },
  { id: 'vagon',     x: 15,    z: -10, ry: 0 },
  { id: 'konteyner', x: 60,    z: -14, ry: Math.PI / 2 },
  { id: 'hedef',     x: -30, z: 10,  ry: Math.PI },
  { id: 'jetyakit',  x: -15, z: 10,  ry: Math.PI },
  { id: 'fikstur',   x: 0,   z: 10,  ry: Math.PI },
  { id: 'solarbot',  x: 15,  z: 10,  ry: Math.PI },
  // "Diğer makineler" (MKN-F/V) — B holü
  { id: 'fk1000',    x: 88,    z: 18,  ry: 0 },
  { id: 'bigbag',    x: 104,   z: -18, ry: Math.PI / 2 },
  // salon: güney sırası boş yeri + batı uzantısı
  { id: 'saft',      x: 30,    z: 10,  ry: Math.PI },
  { id: 'yangin',    x: -57,   z: -10, ry: 0 },
  { id: 'sacpres',   x: -75,   z: -10, ry: 0 },
  { id: 'sasi',      x: -94,   z: -10, ry: 0 },
  { id: 'taslama',   x: -45,   z: 10,  ry: Math.PI },
  { id: 'disacma',   x: -60,   z: 10,  ry: Math.PI },
  { id: 'yikama',    x: -75,   z: 10,  ry: Math.PI },
  { id: 'pompatest', x: 31,    z: -10, ry: 0 },
  // C holü (Ar-Ge & BT): web & veri altyapısı — kuzey yarı
  { id: 'sunucu',    x: 140,   z: -13, ry: 0 },
  // C holü (Ar-Ge & BT): kişisel / üniversite projeleri — güney sırası
  { id: 'ebisiklet', x: 128,   z: 11,  ry: Math.PI },
  { id: 'iha',       x: 141,   z: 11,  ry: Math.PI },
  { id: 'earac',     x: 154,   z: 11,  ry: Math.PI },
];

// ------------------------------------------------------------------ renderer
const canvas = $('sahne');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Ton eşleme: Khronos PBR Neutral — boya/RAL renklerini kaydırmaz (ACES sarıyı/kırmızıyı
// soldurup griye çekiyordu), 0.76 altını doğrusal bırakır → HMI ekranları/etiketler de bozulmaz.
// ?tm=aces|agx|neutral ile karşılaştırılabilir.
const TON = { aces: [THREE.ACESFilmicToneMapping, 1.05], agx: [THREE.AgXToneMapping, 1.3], neutral: [THREE.NeutralToneMapping, 0.9] };
[renderer.toneMapping, renderer.toneMappingExposure] = TON[URLP.get('tm')] || TON.neutral;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // r184: donanım karşılaştırmalı Vogel-disk PCF, yumuşaklık shadow.radius
// Gölge haritası kare başına bir kez (ciz() işaretler): AO normal geçişi gölgeyi yeniden çizmesin
renderer.shadowMap.autoUpdate = false;
lib.kalite.anisotropi = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b222b);
scene.fog = new THREE.Fog(0x1b222b, 260, 520);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 900);
// genel bakış: A + B holü birlikte (x −106…120); "B Holü" düğmesi: B holüne güneydoğudan
const GENEL = { poz: new THREE.Vector3(28, 137, 216), hedef: new THREE.Vector3(28, 0, -4) };   // A + B + C holü
const SAHA_GORUNUM = { poz: new THREE.Vector3(104, 64, 86), hedef: new THREE.Vector3(84, 0, -4) };
camera.position.copy(GENEL.poz);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(GENEL.hedef);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.2;
controls.maxDistance = 320;   // genel bakışlar (A+B+C) ~260–280 m
controls.screenSpacePanning = false; // zemin düzleminde kaydır
controls.update();

// Dikey ekranda (telefon) 152 m'lik salon yandan bakışta ince bir şerit kalıyor:
// salonu boylamasına, batı ucundan yukarıdan gör.
const GENEL_DIKEY = { poz: new THREE.Vector3(-184, 214, 3), hedef: new THREE.Vector3(-4, 0, 2) };
const SAHA_DIKEY = { poz: new THREE.Vector3(83, 150, 62), hedef: new THREE.Vector3(83, 0, -2) };
const dikey = () => window.innerWidth < window.innerHeight * 0.9;
const genelGorunum = () => (dikey() ? GENEL_DIKEY : GENEL);
const sahaGorunum = () => (dikey() ? SAHA_DIKEY : SAHA_GORUNUM);
// C holü (Ar-Ge & BT, x 120…160, z ±24)
const C_GORUNUM = { poz: new THREE.Vector3(154, 38, 50), hedef: new THREE.Vector3(145, 0, -2) };
const C_DIKEY = { poz: new THREE.Vector3(140, 112, 42), hedef: new THREE.Vector3(140, 0, -1) };
const cGorunum = () => (dikey() ? C_DIKEY : C_GORUNUM);

// Görüntü merkezini sol liste (~250 px) ile sağ panel (~370 px, açıksa)
// arasındaki serbest alanın ortasına kaydır: makine panelin arkasında kalmasın.
// Dar ekranda serbest alan DOM'dan ölçülür (üstte şerit + yatay liste, panel altta ya da sağda).
let serbest = { fw: 1, fh: 1 };
function gorunumAyarla() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  let kx = 0, ky = 0;
  if (W > 900) {
    kx = Math.round(((!$('panel').hidden ? 370 : 0) - 250) / 2);
    serbest = { fw: 1, fh: 1 };
  } else {
    document.documentElement.style.setProperty('--ust-h', $('ust').offsetHeight + 'px');
    let L = 0, R = W, T = Math.max($('ust').getBoundingClientRect().bottom, $('liste').getBoundingClientRect().bottom), B = H;
    if (!$('panel').hidden) {
      const p = $('panel').getBoundingClientRect();
      if (p.left > W * 0.3) R = p.left - 4; else B = p.top - 4;
    }
    kx = Math.round(W / 2 - (L + R) / 2);
    ky = Math.round(H / 2 - (T + B) / 2);
    serbest = { fw: Math.max(0.2, (R - L) / W), fh: Math.max(0.2, (B - T) / H) };
  }
  if (kx || ky) camera.setViewOffset(W, H, kx, ky, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// Masaüstünde makine yakın planı serbest alanda yatayda ≈0.45·2d, dikeyde ≈0.385·2d genişlik görür;
// dar ekranda aynı doluluk için kamerayı bu oranla geri çek.
function darCarpani() {
  if (window.innerWidth > 900) return 1;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const k = Math.max(0.385 / (t * serbest.fh), 0.45 / (t * camera.aspect * serbest.fw));
  return THREE.MathUtils.clamp(k, 1, 2.8);
}
window.addEventListener('resize', gorunumAyarla);

// ------------------------------------------------------------------ ışık
scene.add(new THREE.HemisphereLight(0xe6edf5, 0x3a342c, 1.15));
// Gölge kutusu A + B + C holü (x -106…160, z ±36) birlikte kapsasın diye ışık hedefi ortaya alındı
// (yön aynı kaldı: konum − hedef = (28, 52, 22); js/cevre.js ışık huzmeleri bu yönü kullanır)
const gunes = new THREE.DirectionalLight(0xfff2df, 2.4);
gunes.position.set(55, 52, 22);
gunes.target.position.set(27, 0, 0);
scene.add(gunes.target);
gunes.castShadow = true;
gunes.shadow.mapSize.set(4096, 4096);
Object.assign(gunes.shadow.camera, { left: -140, right: 140, top: 50, bottom: -50, near: 5, far: 200 });
gunes.shadow.bias = -0.0003;
gunes.shadow.normalBias = 0.03;
gunes.shadow.radius = 2.2;   // yumuşak gölge kenarı (PCF Vogel disk, ~13 cm)
scene.add(gunes);

// ------------------------------------------------------------------ salon
// A holü (16 makine): x x0…x1, z ±z/2; doğu duvarında B holüne geniş geçit.
const SALON = { x0: -106, x1: 46, z: 46 };
SALON.x = SALON.x1 - SALON.x0;
SALON.xc = (SALON.x0 + SALON.x1) / 2;
// Binaların zemin dikdörtgenleri (SCADA ana ekranındaki yerleşim haritası vb. bunu okur;
// yeni hol eklenince buraya da eklenir).
const BINALAR = [{ ad: 'A HOLÜ', x0: SALON.x0, x1: SALON.x1, z0: -SALON.z / 2, z1: SALON.z / 2 }];
// B holü: A'nın doğusuna eklenen daha yüksek ve derin hol (konteyner · FK-1000 · big bag).
// Arka (kuzey, z0) duvarında iki kamyon kapısı: konteyner şeridi (konteyner x'i) ve big bag
// şeridi (big bag x'i − 2; yerel ZC = −2, ry = π/2'de dünya x'ine düşer). Dışarıda asfalt rampa.
const _yx = (id) => YERLESIM.find((y) => y.id === id).x;
const HOL_B = {
  x0: SALON.x1, x1: 120, z0: -36, z1: 36, H: 11,
  gecit: [-12, 12], gecitH: 7,                        // A↔B geçidi (paylaşılan duvarda)
  kapilar: [_yx('konteyner'), _yx('bigbag') - 2], kapiW: 5.6, kapiH: 5.4,
  rampa: { x0: 50, x1: 114, z0: -64 },               // kapı önü asfalt (kamyonlar burada bekler)
};
BINALAR.push({ ad: 'B HOLÜ', x0: HOL_B.x0, x1: HOL_B.x1, z0: HOL_B.z0, z1: HOL_B.z1 });
// C holü: B'nin doğusunda Ar-Ge & BT holü (sunucu odası, e-bisiklet, İHA, elektrikli araç).
// B'nin doğu duvarında geçit (koridor ekseninde); A gibi 9 m, güney duvarı içeriden görünür.
const HOL_C = { x0: HOL_B.x1, x1: 160, z0: -24, z1: 24, H: 9, gecit: [-8, 8], gecitH: 6 };
BINALAR.push({ ad: 'C HOLÜ', x0: HOL_C.x0, x1: HOL_C.x1, z0: HOL_C.z0, z1: HOL_C.z1 });
// salonKur'un ortam modülüne (js/cevre.js) verdiği ortak malzemeler (duvara sandviç panel deseni ekler)
const SALON_MALZEME = {};
const ON_DUVARLAR = [];   // { g, z }: güney duvarları, kamera içerideyken görünür
function onDuvarGuncelle(kamZ, vrde) {
  for (const d of ON_DUVARLAR) d.g.visible = vrde || kamZ < d.z - 0.3;
}
function salonKur() {
  const g = new THREE.Group();
  // Cilalı endüstriyel beton zemin (6 m derz karesi, çok ölçekli leke/parlaklık; lib.zeminMalzemesi)
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(SALON.x, SALON.z),
    lib.zeminMalzemesi({ tekrar: [SALON.x / 6, SALON.z / 6] }));
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
  // ana koridor A holünden geçitten B holüne kesintisiz uzanır
  serit(SALON.x0 + 2, -2.2, HOL_C.x1 - 2, -2.2); serit(SALON.x0 + 2, 2.2, HOL_C.x1 - 2, 2.2);
  // Yaya geçidi çizgileri koridorda
  for (let x = SALON.x0 + 16; x <= HOL_C.x1 - 6; x += 20) for (let k = -1.6; k <= 1.6; k += 0.8) serit(x - 1.2, k, x + 1.2, k, 0.35, 0xdedede);

  // Duvarlar + pencere bandı. Ön (güney) taraf açık: genel bakış oradan. ic: pencere bandının
  // yüzü (duvar normali yönü, +1/−1), pencere=false → iç (hol arası) duvar, pencere yok.
  const duvarMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.8 });
  SALON_MALZEME.duvar = duvarMat;
  const pencere = new THREE.MeshStandardMaterial({ color: 0xa9c9e0, emissive: 0x9cc4e4, emissiveIntensity: 0.35, roughness: 0.2 });
  const H = 9;
  const duvar = (x, z, L, ry, h, { ic = 1, pencereli = true } = {}) => {
    if (L <= 0.01) return;
    const d = box(L, h, 0.25, duvarMat, x, h / 2, z, g);
    d.rotation.y = ry;
    if (!pencereli || L < 6) return;
    const p = box(L - 2, 1.4, 0.05, pencere, x, h - 1.6, z, g);
    p.rotation.y = ry;
    p.position.x += Math.sin(ry) * 0.16 * ic; p.position.z += Math.cos(ry) * 0.16 * ic;
    p.castShadow = false;
  };
  // z/x aralığı → duvar (uzunluk boyunca ortalanmış)
  const duvarX = (x0, x1, z, h, o) => duvar((x0 + x1) / 2, z, x1 - x0, 0, h, o);
  const duvarZ = (z0, z1, x, h, o) => duvar(x, (z0 + z1) / 2, z1 - z0, Math.PI / 2, h, o);
  const ikazMat = new THREE.MeshStandardMaterial({ map: lib.ikazDokusu([1, 12]), roughness: 0.6 });
  const B = HOL_B;

  // --- A holü: arka + batı duvarı
  duvarX(SALON.x0, SALON.x1, -SALON.z / 2, H);
  duvarZ(-SALON.z / 2, SALON.z / 2, SALON.x0, H);

  // --- B holü zemini: A ile aynı beton malzemesi (UV, A'nın dokuya işlenmiş tekrarına göre ölçeklenir → tek çizim)
  const bW = B.x1 - B.x0, bD = B.z1 - B.z0;
  const zeminBGeo = new THREE.PlaneGeometry(bW, bD);
  const uvB = zeminBGeo.attributes.uv;
  for (let i = 0; i < uvB.count; i++) uvB.setXY(i, uvB.getX(i) * (bW / SALON.x), uvB.getY(i) * (bD / SALON.z));
  const zeminB = new THREE.Mesh(zeminBGeo, zemin.material);
  zeminB.rotation.x = -Math.PI / 2;
  zeminB.position.set((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
  zeminB.receiveShadow = true;
  g.add(zeminB);

  // --- A↔B paylaşılan duvar (x = B.x0, B holü yüksekliğinde) + geniş geçit
  duvarZ(B.z0, -SALON.z / 2, B.x0, B.H, { ic: 1 });                 // A'nın arkasında kalan dış parça
  duvarZ(-SALON.z / 2, B.gecit[0], B.x0, B.H, { pencereli: false });
  duvarZ(B.gecit[1], SALON.z / 2, B.x0, B.H, { pencereli: false });
  duvarZ(SALON.z / 2, B.z1, B.x0, B.H, { ic: 1 });
  const gL = B.gecit[1] - B.gecit[0];
  box(0.25, B.H - B.gecitH, gL, duvarMat, B.x0, (B.H + B.gecitH) / 2, (B.gecit[0] + B.gecit[1]) / 2, g);   // lento
  for (const z of B.gecit) box(0.32, B.gecitH, 0.3, ikazMat, B.x0, B.gecitH / 2, z, g);
  const gecitA = lib.levha(['B HOLÜ →', 'Konteyner · FK-1000 · Big bag'], 8, 1.5, { bg: '#17324f', font: 92, px: 1200 });
  gecitA.rotation.y = -Math.PI / 2;
  gecitA.position.set(B.x0 - 0.2, B.gecitH + 1.2, 0);
  g.add(gecitA);
  const gecitB = lib.levha(['← A HOLÜ', 'Üretim & test hücreleri'], 8, 1.5, { bg: '#17324f', font: 92, px: 1200 });
  gecitB.rotation.y = Math.PI / 2;
  gecitB.position.set(B.x0 + 0.2, B.gecitH + 1.2, 0);
  g.add(gecitB);

  // --- B holü arka (kuzey) duvarı: kamyon kapıları arasında parçalar
  const kx = [...B.kapilar].sort((a, b) => a - b), kw = B.kapiW / 2;
  let xBas = B.x0;
  for (const k of kx) { duvarX(xBas, k - kw, B.z0, B.H); xBas = k + kw; }
  duvarX(xBas, B.x1, B.z0, B.H);
  // --- doğu duvarı (pencere bandı içeride: −X). Ortası C holüyle paylaşılır: pencere yok + geniş geçit
  const C = HOL_C;
  duvarZ(B.z0, C.z0, B.x1, B.H, { ic: -1 });
  duvarZ(C.z0, C.gecit[0], B.x1, B.H, { pencereli: false });
  duvarZ(C.gecit[1], C.z1, B.x1, B.H, { pencereli: false });
  duvarZ(C.z1, B.z1, B.x1, B.H, { ic: -1 });
  const cL = C.gecit[1] - C.gecit[0];
  box(0.25, B.H - C.gecitH, cL, duvarMat, B.x1, (B.H + C.gecitH) / 2, (C.gecit[0] + C.gecit[1]) / 2, g);   // lento
  for (const z of C.gecit) box(0.32, C.gecitH, 0.3, ikazMat, B.x1, C.gecitH / 2, z, g);
  const gecitBC = lib.levha(['C HOLÜ →', 'Ar-Ge & BT · sunucu odası'], 8, 1.5, { bg: '#17324f', font: 92, px: 1200 });
  gecitBC.rotation.y = -Math.PI / 2;
  gecitBC.position.set(B.x1 - 0.2, C.gecitH + 1.2, 0);
  g.add(gecitBC);
  const gecitCB = lib.levha(['← B HOLÜ', 'Ağır makine & saha sistemleri'], 8, 1.5, { bg: '#17324f', font: 92, px: 1200 });
  gecitCB.rotation.y = Math.PI / 2;
  gecitCB.position.set(B.x1 + 0.2, C.gecitH + 1.2, 0);
  g.add(gecitCB);

  // --- C holü: zemin (A ile aynı beton, UV ölçekli → tek çizim), kuzey + doğu duvarı, kolonlar, tabela
  {
    const cW = C.x1 - C.x0, cD = C.z1 - C.z0;
    const geo = new THREE.PlaneGeometry(cW, cD);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (cW / SALON.x), uv.getY(i) * (cD / SALON.z));
    const zc = new THREE.Mesh(geo, zemin.material);
    zc.rotation.x = -Math.PI / 2;
    zc.position.set((C.x0 + C.x1) / 2, 0, (C.z0 + C.z1) / 2);
    zc.receiveShadow = true;
    g.add(zc);
    duvarX(C.x0, C.x1, C.z0, C.H);
    duvarZ(C.z0, C.z1, C.x1, C.H, { ic: -1 });
    for (let cx = C.x0 + 5; cx <= C.x1 - 4; cx += 10) box(0.5, C.H, 0.5, M.mavi, cx, C.H / 2, C.z0 + 0.38, g);
    for (let cz = C.z0 + 12; cz <= C.z1 - 6; cz += 12) box(0.5, C.H, 0.5, M.mavi, C.x1 - 0.38, C.H / 2, cz, g);
    const tabC = lib.levha(['C HOLÜ', 'Ar-Ge & BT · sunucu odası · kişisel projeler'], 9.2, 1.6, { bg: '#17324f', font: 92, px: 1400 });
    tabC.position.set((C.x0 + C.x1) / 2, C.H - 3.6, C.z0 + 0.15);   // pencere bandının (H−1.6 ± 0.7) altında
    g.add(tabC);
  }

  // --- ön (güney) duvarlar: göz hizasında holün güneyi kara boşluk gibi görünmesin.
  // Genel bakış güneyden baktığı için yalnızca kamera duvarın iç tarafındayken (ya da VR'da)
  // görünürler (onDuvarGuncelle). Gölge atmazlar: içeriyi karartmasınlar.
  for (const [x0, x1, z, h] of [[SALON.x0, SALON.x1, SALON.z / 2, H], [B.x0, B.x1, B.z1, B.H], [C.x0, C.x1, C.z1, C.H]]) {
    const og = new THREE.Group();
    const L = x1 - x0, xc = (x0 + x1) / 2;
    const d = box(L, h, 0.25, duvarMat, xc, h / 2, z, og);
    d.castShadow = false;
    const p = box(L - 2, 1.4, 0.05, pencere, xc, h - 1.6, z - 0.16, og);
    p.castShadow = false;
    for (let cx = x0 + 7.5; cx <= x1 - 4; cx += 15) {
      const k = box(0.5, h, 0.5, M.mavi, cx, h / 2, z - 0.38, og);
      k.castShadow = false;
    }
    scene.add(og);
    lib.sabitle(og);
    ON_DUVARLAR.push({ g: og, z });
  }

  // --- kamyon kapıları: lento, ikaz çerçeve, yukarı sarılmış seksiyonel kapı kutusu, babalar, rampa levhası
  const kutuMat = new THREE.MeshStandardMaterial({ color: 0x5b6670, roughness: 0.5, metalness: 0.4 });
  const babaMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.55 });
  kx.forEach((k, i) => {
    box(B.kapiW, B.H - B.kapiH, 0.25, duvarMat, k, (B.H + B.kapiH) / 2, B.z0, g);
    for (const s of [-1, 1]) {
      box(0.3, B.kapiH, 0.34, ikazMat, k + s * (kw + 0.05), B.kapiH / 2, B.z0, g);
      for (const dz of [1.2, -1.6]) lib.cyl(0.13, 1.1, babaMat, k + s * (kw + 0.55), 0.55, B.z0 + dz, g, { seg: 14 });
    }
    box(B.kapiW + 0.5, 0.7, 0.7, kutuMat, k, B.kapiH + 0.4, B.z0 + 0.5, g);        // sarılı kapı kutusu
    const lv = lib.levha([`RAMPA ${i + 1}`, k === _yx('konteyner') ? 'Konteyner kamyonu' : 'Big bag kamyonu'],
      4.2, 0.9, { bg: '#17324f', font: 92, px: 900 });
    lv.position.set(k, B.kapiH + 1.5, B.z0 + 0.16);
    g.add(lv);
  });
  // B holü tabelası (arka duvar, kapıların arasında)
  const tabB = lib.levha(['B HOLÜ', 'Ağır makine & saha sistemleri'], 10, 1.8, { bg: '#17324f', font: 92, px: 1400 });
  tabB.position.set((kx[0] + kx[1]) / 2, B.H - 3.4, B.z0 + 0.15);
  g.add(tabB);

  // --- kolonlar (arka ve doğu duvar boyunca, kapı açıklıklarını atla)
  for (let cx = B.x0 + 6; cx <= B.x1 - 4; cx += 12) {
    if (kx.some((k) => Math.abs(cx - k) < kw + 1)) continue;
    box(0.5, B.H, 0.5, M.mavi, cx, B.H / 2, B.z0 + 0.38, g);
  }
  for (let cz = B.z0 + 12; cz <= B.z1 - 6; cz += 12) {
    if (cz > C.gecit[0] - 1 && cz < C.gecit[1] + 1) continue;   // C geçidi
    box(0.5, B.H, 0.5, M.mavi, B.x1 - 0.38, B.H / 2, cz, g);
  }

  // --- içeride kamyon şeritleri (beyaz kesikli kenar çizgileri, kapıdan makineye)
  const SERIT_SON = { [kx[0]]: -9, [kx[1]]: -8 };
  for (const k of kx) for (const s of [-1, 1]) {
    for (let z = B.z0 + 0.6; z < (SERIT_SON[k] ?? -8); z += 3) serit(k + s * 1.9, z, k + s * 1.9, Math.min(z + 1.6, SERIT_SON[k] ?? -8), 0.14, 0xe8e8e8);
  }

  // --- kapı önü asfalt rampa (kamyonlar dışarıda bekler / uzaklaşır)
  const R = B.rampa;
  const asfalt = canvasTex(512, 512, (cx2, w, h) => {
    cx2.fillStyle = '#4b4f53'; cx2.fillRect(0, 0, w, h);
    const id = cx2.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    cx2.putImageData(id, 0, 0);
  }, { tekrar: [(R.x1 - R.x0) / 8, (B.z0 - R.z0) / 8] });
  const rampa = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, B.z0 - R.z0),
    new THREE.MeshStandardMaterial({ map: asfalt, roughness: 0.95 }));
  rampa.rotation.x = -Math.PI / 2;
  rampa.position.set((R.x0 + R.x1) / 2, -0.002, (B.z0 + R.z0) / 2);
  rampa.receiveShadow = true;
  g.add(rampa);
  for (const k of kx) for (const s of [-1, 1]) serit(k + s * 1.9, B.z0 - 0.3, k + s * 1.9, R.z0 + 1, 0.15, 0xe8e8e8);
  serit(R.x0 + 1, R.z0 + 1, R.x1 - 1, R.z0 + 1, 0.15, 0xe8e8e8);
  for (let x = SALON.x0 + 7.5; x <= SALON.x1 - 7; x += 15) box(0.5, H, 0.5, M.mavi, x, H / 2, -SALON.z / 2 + 0.38, g);
  // Arka duvar ortası: "SANAL FABRİKA" başlıklı SCADA video duvarı (js/scada.js kurar;
  // kurulamazsa yükleme sonundaki SCADA bölümü eski tabelayı koyar)
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
    $('panel').hidden = true; $('panel-ac').hidden = true; gorunumAyarla();
    const G = genelGorunum();
    if (anlik) { camera.position.copy(G.poz); controls.target.copy(G.hedef); } else uc(G.poz, G.hedef);
    return;
  }
  // panel önce açılsın: dar ekranda yakın plan mesafesi panelin bıraktığı alana göre hesaplanır
  paneliKur(x);
  gorunumAyarla();
  const k = makineKamerasi(x);
  const f = darCarpani();
  if (f > 1) k.poz.sub(k.hedef).multiplyScalar(f).add(k.hedef);
  if (anlik) { camera.position.copy(k.poz); controls.target.copy(k.hedef); } else uc(k.poz, k.hedef);
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
  const dugmeler = el('div', 'p-dugmeler', '', ust);
  const gizle = el('button', 'gizle', '⟩', dugmeler);
  gizle.title = 'Paneli gizle, makinede kal (P)';
  gizle.setAttribute('aria-label', 'Paneli gizle');
  gizle.onclick = () => paneliGoster(false);
  const kapat = el('button', 'kapat', '×', dugmeler);
  kapat.title = 'Genel bakışa dön (Esc)';
  kapat.setAttribute('aria-label', 'Genel bakışa dön');
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
  $('panel').hidden = panelGizli;
  $('panel-ac').hidden = !panelGizli;
  $('panel-ac').textContent = `‹ ${String(x.no).padStart(2, '0')} ${m.ad}`;
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
// Panel gizlenince kamera seçili makinede kalır (görüntü merkezi serbest alana kayar);
// tercih makineler arasında gezerken de korunur.
let panelGizli = false;
function paneliGoster(acik) {
  if (!secili) return;
  panelGizli = !acik;
  $('panel').hidden = !acik;
  $('panel-ac').hidden = acik;
  if (acik) panelGuncelle();
  gorunumAyarla();
}
$('panel-ac').onclick = () => paneliGoster(true);

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
  else if (k === 'p' && secili) paneliGoster($('panel').hidden);
  else if (/^[1-9]$/.test(k) && makineler[+k - 1]) sec(makineler[+k - 1]);
  else if (k === 'e' || k === 'q') {
    // listede sonraki / önceki makine (9'dan fazla makine için)
    const n = makineler.length, i = secili ? makineler.indexOf(secili) : (k === 'e' ? -1 : 0);
    sec(makineler[(i + (k === 'e' ? 1 : -1) + n) % n]);
  } else tus.add(k);
  tusIsigi(k, true);
});
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); tus.delete(k); tusIsigi(k, false); });
// pencere odağı kaçarsa (Alt+Tab) keyup gelmez: yürüyüş takılı kalmasın
window.addEventListener('blur', () => { tus.clear(); document.querySelectorAll('#ipucu kbd.basik').forEach((el) => el.classList.remove('basik')); });

// ------------------------------------------------------------------ kontrol kartı (alt ipucu)
// Basılan tuş kartta yanar; × ile küçülür, tercih bu tarayıcıda hatırlanır.
function tusIsigi(k, acik) {
  document.querySelectorAll(`#ipucu kbd[data-t="${CSS.escape(k)}"]`).forEach((el) => el.classList.toggle('basik', acik));
}
function ipucuGoster(acik, kaydet = true) {
  $('ipucu').hidden = !acik;
  $('ipucu-ac').hidden = acik;
  if (kaydet) try { localStorage.setItem('fabrika-ipucu', acik ? 'acik' : 'kapali'); } catch {}
}
$('ipucu-kapat').onclick = () => ipucuGoster(false);
$('ipucu-ac').onclick = () => ipucuGoster(true);
let ipucuKapali = false;
try { ipucuKapali = localStorage.getItem('fabrika-ipucu') === 'kapali'; } catch {}
ipucuGoster(!ipucuKapali, false);
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
$('btn-saha').onclick = () => { sec(null); const S = sahaGorunum(); uc(S.poz, S.hedef); };
$('btn-c').onclick = () => { sec(null); const S = cGorunum(); uc(S.poz, S.hedef); };
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
    const gorus = _fr.intersectsSphere(x.kure);
    x.kok.userData.ekranGorus = gorus;   // uzaktan görüşte: SCADA ekranı seyrek tazelenir
    x.kok.userData.ekranAktif = x === secili || (yakin && gorus);
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
  // çözünürlük tabanda ve hâlâ yavaşsa efektleri kademeli kapat: önce AO (yalnız gerçekten
  // çalışıyorken — genel bakıştaki yavaşlık çizim çağrısı kaynaklı, AO'yla ilgisiz), çok yavaşsa tümü
  else if (kareOrt > 1 / 38 && efekt.seviye === 2 && gtao.enabled) efektKademe(1);
  else if (kareOrt > 1 / 28 && efekt.seviye > 0) efektKademe(0);
  if (yeni !== prSimdi) { prSimdi = yeni; renderer.setPixelRatio(prSimdi); renderer.setSize(window.innerWidth, window.innerHeight); efektBoyut(); }
}

// ------------------------------------------------------------------ efektler (son işlem)
// Masaüstü: MSAA (4×) yarı-float hedef → GTAO (yalnız yakın planda) → seçici bloom → OutputPass
// (ton eşleme + sRGB). VR'da ve "Efektler" kapalıyken doğrudan renderer.render (eski yol).
// Bloom eşiği parlaklık (luminance) yerine en büyük kanala bakar: güneşte beyaz boya ~1.2
// iken kırmızı/yeşil kule lambaları (emissive 2.2–2.4) ancak böyle ayrışır.
const efekt = { seviye: 0, istek: false };   // seviye 2: AO + bloom, 1: bloom, 0: kapalı
const efektRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, efektRT);
const gtao = new GTAOPass(scene, camera, 1, 1, undefined,
  { radius: 0.6, distanceExponent: 1.3, thickness: 1.4, scale: 1.0, samples: 12, distanceFallOff: 1.0 },
  { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
gtao.blendIntensity = 0.9;
// AO tamponu CSS pikseli çözünürlüğünde (retina'da 1/4 maliyet; gürültü giderici zaten yumuşatır)
const _gtaoBoyut = gtao.setSize.bind(gtao);
gtao.setSize = (w, h) => { const pr = Math.max(1, renderer.getPixelRatio()); _gtaoBoyut(Math.round(w / pr), Math.round(h / pr)); };
// AO normal geçişinde saydam / alfa-kesik / sprite nesneler gizlenir (cam, çit örgüsü, etiket
// kartları katı yüzey sanılıp çevresini karartmasın). Liste 2 sn'de bir yenilenir.
let aoGizli = [], aoTaramaT = 99;
function aoTara() {
  aoGizli = [];
  scene.traverse((o) => {
    if (o.isSprite || o.isPoints || o.isLine) { aoGizli.push(o); return; }
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (o.userData.aoHaric || ms.some((m) => m && (m.transparent || m.alphaTest > 0 || m.transmission > 0))) aoGizli.push(o);
  });
}
gtao._overrideVisibility = function () {
  const c = this._visibilityCache;
  for (const o of aoGizli) if (o.visible) { o.visible = false; c.push(o); }
};
// eşik 2.1: güneşte sarı baret / beyaz boya (~1.6) parlamasın, emissive 2.2+ lambalar parlasın
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 2.1);
bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader
  .replace('float v = luminance( texel.xyz );', 'float v = max( texel.r, max( texel.g, texel.b ) );');
bloom.materialHighPassFilter.needsUpdate = true;
bloom.highPassUniforms.smoothWidth.value = 0.6;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(gtao);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function efektBoyut() {
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', efektBoyut);
function efektKademe(s, { kaydet = false } = {}) {
  efekt.seviye = s;
  bloom.enabled = s >= 1;
  lib.kalite.detay.value = s >= 1 ? 1 : 0;   // yüzey detayı da efektlerle birlikte
  const k = $('chk-efekt'); if (k) k.checked = s > 0;
  if (kaydet) try { localStorage.setItem('fabrika-efekt', s > 0 ? '1' : '0'); } catch {}
}
{
  // Varsayılan: masaüstünde açık, dokunmatik/telefonda kapalı; ?efekt=0|1 ve son tercih geçerli
  const dokunmatik = matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth <= 900;
  let acik = !dokunmatik;
  try { const k = localStorage.getItem('fabrika-efekt'); if (k) acik = k === '1'; } catch {}
  if (URLP.has('efekt')) acik = URLP.get('efekt') !== '0';
  efekt.istek = acik;
  efektBoyut();
  efektKademe(acik ? 2 : 0);
  $('chk-efekt')?.addEventListener('change', (e) => efektKademe(e.target.checked ? 2 : 0, { kaydet: true }));
}
// VR: efektler ve yüzey detayı devre dışı (Quest GPU'su), çıkınca eski seviye
let efektVrOnce = 0;
renderer.xr.addEventListener('sessionstart', () => { efektVrOnce = efekt.seviye; lib.kalite.detay.value = 0; });
renderer.xr.addEventListener('sessionend', () => { efektKademe(efektVrOnce); efektBoyut(); });

// Ortam haritası: oda ortamı hemen; ardından endüstriyel iç mekân HDRI'si (Poly Haven, CC0)
// yüklenince metal yansımaları gerçek bir depo/atölyeyi yansıtır.
new HDRLoader().load('vendor/env/empty_warehouse_01_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const eski = scene.environment;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.75;   // depo HDRI'si oda ortamından koyu: metal/boya yansıması dengelensin
  hdr.dispose(); eski?.dispose();
}, undefined, (e) => console.warn('HDRI yüklenemedi, oda ortamı kalıyor', e));

// Ölü kıvılcım / su parçacıkları makinelerde y = −10'a "park" ediliyor; salon kenarının ötesinde
// boşlukta nokta olarak görünüyor (bloom ile parlıyordu) → yalnız Points için zemin altını kırp.
renderer.localClippingEnabled = true;
const zeminAlti = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5)];
let noktaTaramaT = 99;
function noktaKirp() {
  scene.traverse((o) => {
    if (o.isPoints && o.material && !o.material.clippingPlanes?.length) { o.material.clippingPlanes = zeminAlti; o.material.needsUpdate = true; }
  });
}

function ciz(dt) {
  if ((noktaTaramaT += dt) > 3) { noktaTaramaT = 0; noktaKirp(); }
  renderer.shadowMap.needsUpdate = true;
  if (efekt.seviye > 0 && !renderer.xr.isPresenting) {
    // AO yalnız yakın planda: genel bakışta (≥ ~75 m) etkisi görünmez, normal geçişi boşuna
    gtao.enabled = efekt.seviye >= 2 && camera.position.distanceTo(controls.target) < 75;
    if (gtao.enabled && (aoTaramaT += dt) > 2) { aoTaramaT = 0; aoTara(); }
    composer.render();
  } else renderer.render(scene, camera);
}

const saat = new THREE.Timer();
let t = 0, uiAcc = 0, vr = null;
// ------------------------------------------------------------------ ekran boyutuna göre ayrıntı (LOD)
// Uzaktan ~1.5 pikselden küçük görünen makine parçaları çizilmez: genel bakışta yüzlerce çizim
// çağrısı, görüntüde fark yok; yaklaşınca geri gelirler. Makineler kendi `visible` bayraklarını
// yönettiği için katmanla yapılır: kamera 0. katmanı çizer, uzaktaki küçük parça LOD_KATMAN'a alınır
// (WebXR 1/2. katmanları sol/sağ göz için kullanır, 7 boş).
const LOD_KATMAN = 7, LOD_PIKSEL = 1.5;
let lodT = 0;
const _lodP = new THREE.Vector3();
function lodHazirla() {
  for (const x of makineler) {
    const liste = [];
    x.kok.updateMatrixWorld(true);
    x.kok.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.name === 'sabit') return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = o.matrixWorld.getMaxScaleOnAxis() * o.geometry.boundingSphere.radius;
      if (r < 0.5) liste.push({ o, r });
    });
    liste.sort((a, b) => a.r - b.r);
    x.lod = { liste, n: 0 };   // liste[0..n) gizli
  }
}
function lodGuncelle(vrde) {
  // K: 1 m yarıçaplı parçanın LOD_PIKSEL'e düştüğü mesafe → yarıçapı d / K'dan küçük parçalar gizlenir
  const H = vrde ? 1900 : renderer.domElement.height;
  const K = H / (2 * Math.tan(THREE.MathUtils.degToRad(vrde ? 45 : camera.fov / 2)) * LOD_PIKSEL);
  camera.getWorldPosition(_lodP);
  for (const x of makineler) {
    if (!x.lod) continue;
    const esik = x === secili ? 0 : Math.max(0, _lodP.distanceTo(x.kure.center) - x.kure.radius) / K;
    const L = x.lod.liste;
    let n = x.lod.n;
    while (n < L.length && L[n].r < esik * 0.85) L[n++].o.layers.set(LOD_KATMAN);   // %15 histerezis
    while (n > 0 && L[n - 1].r >= esik) L[--n].o.layers.set(0);
    x.lod.n = n;
  }
}

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
  onDuvarGuncelle(_cw.z, vrde);
  lodT += dt;
  if (lodT > 0.2) { lodT = 0; lodGuncelle(vrde); }
  scada?.update(dt, t);   // SCADA ekranları (VR'da da)
  if (cevre) { try { cevre.update(dt, t, vrde); } catch (e) { console.error('[cevre] update', e); cevre = null; } }
  uiAcc += dt;
  if (uiAcc > 0.15) {
    uiAcc = 0;
    if (secili && !$('panel').hidden) panelGuncelle();
    document.querySelectorAll('.kart .nokta').forEach((n, i) => {
      const s = makineler[i]?.m.durum().seviye || 'bekliyor';
      if (n.className !== 'nokta ' + s) n.className = 'nokta ' + s;
    });
  }
  ciz(dt);
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
// SCADA: arka duvarda fabrika video duvarı + her makinenin arkasında makine ekranı (js/scada.js)
let scada = null;
try {
  const { scadaKur } = await import('./scada.js');
  scada = scadaKur({ THREE, lib, scene, camera, makineler, binalar: BINALAR,
    duvar: { x: -31, z: -SALON.z / 2 + 1.05, ry: 0 } });   // kolonların (z −22.4'e dek) önünde
} catch (e) {
  console.warn('[scada] kurulamadı, düz tabela konuyor', e);
  const yazi = lib.levha(['SANAL FABRİKA', 'Kaan Kırşan · Otomasyon & Robotik'], 14, 2.4, { bg: '#17324f', font: 92, px: 1600 });
  yazi.position.set(-31, 5.4, -SALON.z / 2 + 0.15);
  scene.add(yazi);
}
// Ortam ve canlılık: çatı/armatür/duvar detayları, raflar ve lojistik alanları, güvercinler,
// koridor AGV'si, holler arası yürüyen işçi (js/cevre.js). Kurulamazsa fabrika olduğu gibi açılır.
let cevre = null;
try {
  const { cevreKur } = await import('./cevre.js');
  cevre = cevreKur({
    lib, scene, camera, makineler, duvarMat: SALON_MALZEME.duvar,
    A: { x0: SALON.x0, x1: SALON.x1, z0: -SALON.z / 2, z1: SALON.z / 2, H: 9 },
    B: HOL_B,
    C: HOL_C,
  });
} catch (e) { console.error('[cevre] kurulamadı', e); }
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
sec(ilkX || null, { anlik: true }); // null → ekran yönüne uygun genel bakış
lodHazirla();   // sabitle + SCADA + çevre kurulduktan sonra: birleşmiş parçalar listeye girmez
renderer.setAnimationLoop(dongu);
$('yukleniyor').classList.add('bitti');
if (!$('ipucu').hidden) document.querySelector('.ip-kart').classList.add('parla');
window.__fabrika = { makineler, sec, hazir: true, camera, controls, renderer, golgesiz, vr, sabitIst, cevre, lodGuncelle, LOD_KATMAN, onDuvarGuncelle };
