import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Valores del formulario tal cual (strings); acá se interpretan y se acotan.
export type PlacaInput = { maquina: string; semilla: string; forma: string; hileras: string; alveolos: string; m: [string, string, string] };

const MARCAS_3_AGUJEROS = ['agrometal', 'fabimag', 'fercam', 'dolby'];
const MARCAS_CON_LABIO = ['crucianelli', 'pla', 'tedeschi', 'super walter', 'malasia', 'metar', 'achillii', 'monumental', 'cele', 'tefoni',
  'ascanelli', 'sembrar', 'schiarre', 'vhb', 'pierobon', 'dasa', 'templar', 'dumaire', 'brioschi'];
const LABIO_R = 31, LABIO_H = 2.5; // collar elevado alrededor del agujero central (medidas estimadas de la foto)

const DIAMETRO = 269, CENTRAL = 50, LAT_DIAM = 18, LAT_RADIO = 65, LAT_ANG = 58; // fijos: el formulario no los pide
const PARED = 3;     // mm entre la fila externa y el borde
const SEPARACION = 1.5; // mm mínimos entre alvéolos vecinos

const num = (s: string, def: number, min: number, max: number) => {
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};

function derivar(i: PlacaInput) {
  let largo = num(i.m[0], 12, 5, 25);
  const ancho = num(i.m[1], 8, 3, 15), espesor = num(i.m[2], 5.5, 2, 8);
  const redonda = i.forma === 'Redonda' || i.semilla === 'Soja' || i.semilla === 'Sorgo'; // soja y sorgo no existen alargadas
  if (redonda || ancho > largo) largo = ancho; // alvéolo circular
  const filas = i.hileras === '3' ? 3 : 2;  // el largo va a lo largo del arco (tangente) y el ancho hacia el centro
  const sepFilas = ancho + 2;
  const rExt = DIAMETRO / 2 - ancho / 2 - PARED;
  const rInt = rExt - (filas - 1) * sepFilas - ancho / 2;
  const maxCant = filas * Math.floor(2 * Math.PI * rInt / (largo + SEPARACION)); // evita alvéolos superpuestos
  const cantidad = Math.min(Math.round(num(i.alveolos, 50, 8, 200)), maxCant);
  const laterales = MARCAS_3_AGUJEROS.includes(i.maquina.toLowerCase()) ? 3 : 4;
  const labio = MARCAS_CON_LABIO.includes(i.maquina.toLowerCase());
  return { largo, ancho, espesor, filas, sepFilas, rExt, cantidad, laterales, labio };
}
type P = ReturnType<typeof derivar>;

/* ---------- Geometría ---------- */
function slotPts(cx: number, cy: number, ang: number, L: number, W: number, seg = 14) {
  const r = W / 2, h = Math.max(0, (L - W) / 2);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const c1 = [cx + ux * h, cy + uy * h], c2 = [cx - ux * h, cy - uy * h];
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= seg; i++) { const a = ang - Math.PI / 2 + Math.PI * i / seg; pts.push(new THREE.Vector2(c1[0] + Math.cos(a) * r, c1[1] + Math.sin(a) * r)); }
  for (let i = 0; i <= seg; i++) { const a = ang + Math.PI / 2 + Math.PI * i / seg; pts.push(new THREE.Vector2(c2[0] + Math.cos(a) * r, c2[1] + Math.sin(a) * r)); }
  return pts;
}
function crearPlaca(p: P) {
  const s = new THREE.Shape(); s.absarc(0, 0, DIAMETRO / 2, 0, Math.PI * 2, false);
  const hole = (x: number, y: number, d: number) => { const h = new THREE.Path(); h.absarc(x, y, d / 2, 0, Math.PI * 2, true); s.holes.push(h); };
  hole(0, 0, CENTRAL);
  for (let k = 0; k < p.laterales; k++) { const a = (LAT_ANG + k * 90) * Math.PI / 180; hole(Math.cos(a) * LAT_RADIO, Math.sin(a) * LAT_RADIO, LAT_DIAM); }
  // reparte la cantidad entre las filas (las primeras se quedan con el resto)
  const filas = Array.from({ length: p.filas }, (_, r) => Math.floor(p.cantidad / p.filas) + (r < p.cantidad % p.filas ? 1 : 0));
  filas.forEach((n, row) => {
    const r = p.rExt - row * p.sepFilas, off = row % 2 === 1 ? Math.PI / n : 0; // filas alternas desfasadas
    for (let i = 0; i < n; i++) { const a = off + i * 2 * Math.PI / n; s.holes.push(new THREE.Path(slotPts(Math.cos(a) * r, Math.sin(a) * r, a + Math.PI / 2, p.largo, p.ancho))); }
  });
  const b = Math.min(0.3, p.espesor * 0.12, p.ancho * 0.08);
  const g = new THREE.ExtrudeGeometry(s, { depth: p.espesor - 2 * b, curveSegments: 64,
    bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2 });
  g.translate(0, 0, b);
  g.rotateX(-Math.PI / 2); // acostada, espesor hacia +Y
  const sm = toCreasedNormals(g, Math.PI / 7); // paredes de agujeros suaves, aristas vivas
  g.dispose();
  return sm;
}

function crearLabio(p: P) {
  const s = new THREE.Shape(); s.absarc(0, 0, LABIO_R, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absarc(0, 0, CENTRAL / 2, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: LABIO_H, curveSegments: 64, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, p.espesor, 0); // apoyado sobre la cara superior
  const sm = toCreasedNormals(g, Math.PI / 7);
  g.dispose();
  return sm;
}

function texturaSuperficie(renderer: THREE.WebGLRenderer) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(152,152,152)'; g.fillRect(0, 0, S, S);
  for (let r = 3; r < S * 0.72; r += 2.1) { const v = 152 + (Math.random() - 0.5) * 24; g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},0.5)`; g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2); g.stroke(); }
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 2400; i++) { const v = Math.random() < 0.5 ? 112 : 192; g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 0.4 + Math.random() * 1.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(1 / DIAMETRO, 1 / DIAMETRO); t.offset.set(0.5, 0.5);
  return t;
}

/* ---------- Visor ---------- */
// root: contenedor con un <canvas> y botones [data-view] (+ #spinBtn). Devuelve la función que aplica el formulario.
export function initPlaca3d(root: HTMLElement): (i: PlacaInput) => void {
  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0); // fondo transparente: se ve el de la página

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 25; controls.maxDistance = 1800; controls.screenSpacePanning = true;

  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(220, 420, 160); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 50, far: 1200 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.3;
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8b9087, 0.55));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const tex = texturaSuperficie(renderer);
  const material = new THREE.MeshPhysicalMaterial({
    color: '#b8b7ae', roughness: 1, roughnessMap: tex, bumpMap: tex, bumpScale: 1.2,
    metalness: 0, specularIntensity: 0.55, clearcoat: 0.06, clearcoatRoughness: 0.6,
  });
  const placa = new THREE.Group(); scene.add(placa);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.castShadow = true; placa.add(mesh);
  const labioMat = material.clone(); labioMat.color.multiplyScalar(0.78); // más oscuro: se distingue de la placa en planta
  const labioMesh = new THREE.Mesh(new THREE.BufferGeometry(), labioMat);
  labioMesh.castShadow = true; placa.add(labioMesh);

  /* Cámara y vistas */
  let p: P = derivar({ maquina: '', semilla: '', forma: '', hileras: '', alveolos: '', m: ['', '', ''] });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const distAjuste = () => {
    const v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
    return DIAMETRO / 2 * 1.2 / Math.sin(Math.min(v, h) / 2);
  };
  let spinning = false;
  const spinBtn = root.querySelector<HTMLElement>('#spinBtn')!;
  const syncSpin = () => { spinBtn.setAttribute('aria-pressed', String(spinning)); spinBtn.textContent = spinning ? 'Detener giro' : 'Girar placa'; };
  const VISTAS: Record<string, () => { pos: THREE.Vector3; target: THREE.Vector3 }> = {
    perspectiva: () => ({ pos: V(0.42, 0.7, 0.58).normalize().multiplyScalar(distAjuste()), target: V(0, 0, 0) }),
    planta: () => ({ pos: V(0, distAjuste(), 0.01), target: V(0, 0, 0) }),
    canto: () => { const d = distAjuste(); return { pos: V(d, d * 0.06, 0), target: V(0, p.espesor / 2, 0) }; },
    alveolo: () => {
      spinning = false; syncSpin();
      const t = placa.localToWorld(V(p.rExt, p.espesor / 2, 0));
      const out = t.clone().setY(0).normalize(), tan = V(-out.z, 0, out.x);
      return { pos: t.clone().add(out.multiplyScalar(38)).add(tan.multiplyScalar(30)).add(V(0, 62, 0)), target: t };
    },
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tween: { p0: THREE.Vector3; t0: THREE.Vector3; pos: THREE.Vector3; target: THREE.Vector3; s: number; d: number } | null = null;
  const marcar = (nombre: string | null) => root.querySelectorAll<HTMLElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === nombre)));
  function irA(nombre: string, instant = false) {
    const v = VISTAS[nombre](); marcar(nombre);
    if (instant || reduceMotion) { camera.position.copy(v.pos); controls.target.copy(v.target); tween = null; return; }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), ...v, s: performance.now(), d: 750 };
  }
  controls.addEventListener('start', () => { tween = null; marcar(null); });
  root.querySelectorAll<HTMLElement>('[data-view]').forEach(b => b.addEventListener('click', () => irA(b.dataset.view!)));
  spinBtn.addEventListener('click', () => { spinning = !spinning; syncSpin(); });

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();

  /* Formulario → placa */
  let raf = 0, primera = true;
  function aplicar() {
    const g = crearPlaca(p); mesh.geometry.dispose(); mesh.geometry = g;
    labioMesh.visible = p.labio;
    if (p.labio) { labioMesh.geometry.dispose(); labioMesh.geometry = crearLabio(p); }
    if (primera) { primera = false; irA('perspectiva', true); }
  }
  function set(i: PlacaInput) {
    p = derivar(i);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(aplicar);
  }

  let visible = true; // no gastar GPU con el visor fuera de pantalla
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (tween) {
      const k = Math.min(1, (now - tween.s) / tween.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.pos, e); controls.target.lerpVectors(tween.t0, tween.target, e);
      if (k >= 1) tween = null;
    }
    if (spinning) placa.rotation.y += dt * (reduceMotion ? 0.25 : 0.7);
    controls.update();
    renderer.render(scene, camera);
  });
  return set;
}
