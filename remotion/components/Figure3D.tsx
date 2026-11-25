import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Pt } from "./Mono.tsx";

// The hooded figure as a toon-shaded 3D rig, and <Three>, a three.js layer for drawn scenes. Both render with one
// shared WebGL renderer into a PNG for an SVG <image>: one WebGL context per tab however many figures a scene has,
// and the scene's glow filter, mirroring and camera moves still apply.

export type Joints = { sh: Pt; head: Pt; armL: Pt[]; armR: Pt[]; legL: Pt[]; legR: Pt[] };
export type View = "side" | "front" | "back";
export type Img = { href: string; x: number; y: number; w: number; h: number };

const R = 12; // half the SVG limb stroke
const YAW: Record<View, number> = { side: -0.38, front: 0.28, back: -0.28 }; // turned a little so the depth shows
const FACE: Record<View, number> = { side: 0, front: -Math.PI / 2, back: Math.PI / 2 }; // rig is built facing +x

let gl: THREE.WebGLRenderer | undefined;
let ramp: THREE.DataTexture | undefined;
let halo: THREE.Texture | undefined;
let ball: THREE.SphereGeometry | undefined;
// shortcut: whole-pose cache, cleared when full; static poses hit it, walk cycles don't.
const cache = new Map<string, Img>();

const v3 = ([x, y]: Pt, z: number) => new THREE.Vector3(x, -y, z); // SVG is y-down, three is y-up
const ang = (v: Pt) => Math.atan2(v[0], -v[1]); // same angle the SVG Figure rotates the body/hood by

// Three-tone toon shading in one grey: the channel's flat-but-solid look. Use it for every solid in a 3D scene.
export function toon(color: THREE.ColorRepresentation, opacity = 1) {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, transparent: opacity < 1, opacity });
}
const flat = (color: THREE.ColorRepresentation, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });

// Soft white halo behind each eye (the SVG figure's eyeglow filter).
function glowSprite(size: number, opacity: number) {
  if (!halo) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    halo = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.set(size, size, 1);
  return s;
}

// Rubber-hose limb: the SVG's quadratic curve (passing through the joint) as a tube, plus the foot, with round caps.
function limb(g: THREE.Group, [a, k, e, toe]: Pt[], z: number, mat: THREE.Material) {
  const ctl: Pt = [2 * k[0] - (a[0] + e[0]) / 2, 2 * k[1] - (a[1] + e[1]) / 2];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(v3(a, z), v3(ctl, z), v3(e, z)), 24, R, 12), mat));
  if (toe) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(v3(e, z), v3(toe, z)), 1, R, 12), mat));
  for (const p of toe ? [a, e, toe] : [a, e]) {
    const m = new THREE.Mesh((ball ??= new THREE.SphereGeometry(R, 16, 12)), mat);
    m.position.copy(v3(p, z));
    g.add(m);
  }
}

// The character from its 2D skeleton (hip at the origin, three's y-up), facing +x in the side view.
export function rig(j: Joints, view: View, color: string, back: string, opacity = 1, limbsOnly = false) {
  const root = new THREE.Group();
  const near = toon(color, opacity);
  const far = toon(back, opacity);
  const trim = toon(new THREE.Color(color).multiplyScalar(0.62), opacity);
  const side = view === "side";
  // Side view: arms just outside the body's 100-deep sides, near ones toward the camera. Facing views spread them in x
  // already, so the arms come forward to lie over the body as the SVG draws them (inside it, only the hands showed).
  limb(root, j.armL, side ? -56 : 54, far);
  limb(root, j.legL, side ? -22 : 0, far);
  limb(root, j.legR, side ? 22 : 0, near);
  limb(root, j.armR, side ? 56 : 54, near);
  if (limbsOnly) return root;

  // Hoodie, in the torso's frame (hip at the origin, up along the torso), with its front pocket and drawstrings.
  const len = Math.hypot(j.sh[0], j.sh[1]) || 1;
  const torso = new THREE.Group();
  torso.rotation.z = -ang(j.sh);
  const facing = new THREE.Group();
  facing.rotation.y = FACE[view];
  const body = new THREE.Mesh(new RoundedBoxGeometry(80, len + 36, 100, 4, 16), near);
  body.position.y = (len + 8) / 2;
  const pocket = new THREE.Mesh(new RoundedBoxGeometry(6, 34, 62, 2, 3), trim);
  pocket.position.set(39, 30, 0);
  facing.add(body, pocket);
  for (const z of [-13, 13]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 42, 8), trim);
    cord.position.set(41, len - 8, z);
    facing.add(cord);
  }
  torso.add(facing);
  root.add(torso);

  // Hood, in the neck's frame: a soft rounded shell, the dark face opening on its front, two glowing eyes.
  const hood = new THREE.Group();
  hood.position.copy(v3(j.head, 0));
  hood.rotation.z = -ang([j.head[0] - j.sh[0], j.head[1] - j.sh[1]]);
  const hf = new THREE.Group();
  hf.rotation.y = FACE[view];
  const shell = new THREE.Mesh(new RoundedBoxGeometry(113, 109, 112, 6, 44), near);
  shell.position.set(-1.5, 6.5, 0);
  const face = new THREE.Mesh(new RoundedBoxGeometry(30, 70, 78, 4, 22), flat("#050505", opacity));
  face.position.set(42, 6, 0);
  hf.add(shell, face);
  for (const ez of [-17, 17]) {
    const eye = new THREE.Mesh(new RoundedBoxGeometry(5, 13, 17, 2, 2), flat("#ffffff", opacity));
    eye.position.set(57.5, 5, ez);
    const glow = glowSprite(52, 0.85 * opacity);
    glow.position.set(62, 5, ez);
    hf.add(eye, glow);
  }
  hood.add(hf);
  root.add(hood);
  return root;
}

// Renders a scene to a PNG data URL with the channel's lighting, then frees what the scene made.
export function snap(scene: THREE.Scene, cam: THREE.Camera, w: number, h: number, px: number) {
  if (cam instanceof THREE.PerspectiveCamera && cam.aspect !== w / h) {
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  const sun = new THREE.DirectionalLight("#ffffff", 2.8);
  sun.position.set(250, 450, 600);
  scene.add(new THREE.AmbientLight("#ffffff", 0.55), sun);
  gl ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(1);
  gl.setSize(Math.round(w * px), Math.round(h * px), false);
  gl.setClearColor(0x000000, 0);
  gl.render(scene, cam);
  const href = gl.domElement.toDataURL("image/png");
  scene.traverse((m) => {
    if (!(m instanceof THREE.Mesh || m instanceof THREE.Sprite || m instanceof THREE.Line)) return;
    if (m.geometry !== ball) m.geometry.dispose();
    for (const x of [m.material].flat()) x.dispose();
  });
  return href;
}

// The SVG Figure's body as an image covering x, y, w, h in its local units (hip at 0,0, y down). `s` sets resolution.
export function figure3d(j: Joints, trail: Joints[], view: View, color: string, back: string, s: number): Img {
  const px = Math.min(2, Math.max(0.6, s * 2)); // pixels per local unit
  const key = JSON.stringify([j, trail, view, color, back, px.toFixed(2)]);
  const hit = cache.get(key);
  if (hit) return hit;

  const pts = [j, ...trail].flatMap((g) => [g.sh, g.head, ...g.armL, ...g.armR, ...g.legL, ...g.legR]);
  const m = 100; // room for the hood, the body's depth turned by the yaw, and the limb radius
  const x = Math.min(...pts.map((p) => p[0])) - m;
  const y = Math.min(...pts.map((p) => p[1])) - m;
  const w = Math.max(...pts.map((p) => p[0])) + m - x;
  const h = Math.max(...pts.map((p) => p[1])) + m - y;

  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.rotation.y = YAW[view];
  trail.forEach((g, i) => world.add(rig(g, view, back, back, 0.2 / (i + 1), true)));
  world.add(rig(j, view, color, back));
  scene.add(world);
  const cam = new THREE.OrthographicCamera(x, x + w, -y, -(y + h), 1, 4000);
  cam.position.z = 2000;
  const img = { href: snap(scene, cam, w, h, px), x, y, w, h };

  if (cache.size > 300) cache.clear();
  cache.set(key, img);
  return img;
}

// A 3D layer in a drawing: `scene` seen by `camera`, drawn into `box` (stage(t), or a box from split/row). Build the
// scene fresh every frame from useCurrentFrame(); it's lit for you and freed after. A perspective camera's aspect is
// set to the box's. `glow` puts the scene's glow filter on the whole layer.
type Box = { left: number; top: number; width: number; height: number };
export function Three({ box, scene, camera, glow = false, opacity = 1 }: { box: Box; scene: THREE.Scene; camera: THREE.Camera; glow?: boolean; opacity?: number }) {
  const href = snap(scene, camera, box.width, box.height, Math.min(1.25, 2400 / Math.max(box.width, box.height)));
  return <image href={href} x={box.left} y={box.top} width={box.width} height={box.height} opacity={opacity} filter={glow ? "url(#glow)" : undefined} />;
}
