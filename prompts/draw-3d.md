## This scene is 3D

The director marked this shot `in3d`: draw it as a three.js scene, not flat SVG. Everything above still holds (the brief, the timing, black and white, one clear subject, something moving the whole time, deterministic frames) except where this section says otherwise. You may also `import * as THREE from "three"`.

How it works: every frame, build a fresh `THREE.Scene` and a camera in your component's body, from `useCurrentFrame()`, and draw them with `<Three box={…} scene={scene} camera={camera} />` inside `<Frame>`. The kit renders it, lights it (a sun from above and front-right, +x +y +z, plus soft fill) and frees it. Never make a WebGLRenderer, a canvas, lights, `useFrame` or an animation loop; never keep objects between frames.

```tsx
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { Frame, Three, hooded, toon, walk, walkRate, k01, stage, tall } from "kit";

// The pyramid rises course by course once "layer" is said, while a worker walks along its base; the camera circles slowly.
export default function Scene({ p, t, dur, w = [] }) {
  const f = useCurrentFrame();
  const at = (word, fallback) => (w.find((x) => x.word.toLowerCase().startsWith(word))?.start ?? fallback) * 30;
  const built = k01(f, at("layer", 0.5), dur * 0.85);
  const scene = new THREE.Scene();

  const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), toon("#262626"));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 8 courses of stone, each smaller than the one below; the newest one is the bright one.
  const courses = Math.max(1, Math.round(built * 8));
  for (let i = 0; i < courses; i++) {
    const size = 1400 - i * 160;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 110, size), toon(i === courses - 1 ? "#ffffff" : "#999999"));
    slab.position.y = 55 + i * 110;
    scene.add(slab);
  }

  // The worker walks along the front of the base; walkRate keeps the feet planted.
  const ph = f * 0.1;
  const guy = hooded({ pose: walk(ph) });
  guy.position.set(-700 + walkRate() * ph, 0, 900);
  scene.add(guy);

  // The camera circles slowly; on the narrow vertical canvas it stands further back so the whole base fits.
  const a = 0.5 + f * 0.003;
  const r = tall(t) ? 5200 : 3400;
  const camera = new THREE.PerspectiveCamera(40, 1, 10, 20000);
  camera.position.set(Math.sin(a) * r, r * 0.45, Math.cos(a) * r);
  camera.lookAt(0, 450, 0);

  return (
    <Frame p={p} t={t}>
      <Three box={stage(t)} scene={scene} camera={camera} />
    </Frame>
  );
}
```

The 3D kit:
- `<Three box scene camera glow? opacity? />`: draws the scene into `box` (`stage(t)`, or a box from `split`/`row`, so it lays out on both canvases like any drawing). A perspective camera's aspect is set to the box's for you. `glow` lights the whole layer; leave it off unless the layer IS the one glowing thing.
- `hooded({ pose, headDown?, hands?, color? })` → the character as a three.js object: feet on y = 0, facing +x, about 480 units tall. Same poses as Figure (`STAND`, `walk(ph)`, `run(ph)`, `mix`…). Place it with `position`, turn it with `rotation.y` (−π/2 faces the camera when the camera is on +z), size it with `scale.setScalar(k)`. To walk without sliding, move `walkRate(amp) * scale` per unit of phase, in the direction it faces. Crowd extras: `color: "#888888"`.
- `toon(color)`: the channel's material, three flat shades of one grey. Use it for every solid. `new THREE.MeshBasicMaterial({ color: "#ffffff" })` for something that glows or is pure black; `LineBasicMaterial` with `EdgesGeometry` or `GridHelper` for outlines and floors.

3D rules:
- Units: the character is ~480 tall, so a door is ~600, a house ~1500, a pyramid course ~110. Keep the subject within about 4000 of the origin and the camera 2000–6000 from it. The box is wide in the video and narrow in a Short: frame for both (`tall(t)` → stand the camera further back), and keep floors and grounds small enough to sit inside the view; a cut-off floor edge looks broken.
- Greys only: `#ffffff`, `#dddddd`, `#bbbbbb`, `#999999`, `#555555`, `#3a3a3a`, `#262626`, `#1a1a1a`, `#000000`. No colour, no textures, no images, no shadows.
- Simple solids (Box, Cylinder, Cone, Sphere, Torus, Extrude of a simple Shape, groups of them) read best; a few dozen meshes at most. The subject fills at least half the box.
- The camera does the slow, calm move that shows the depth (circling, rising, drifting closer), on top of the one thing that changes on its word. Keep it smooth: positions are smooth functions of `f`, no jumps.
- Labels and numbers stay SVG: draw them with `<text>` in the Frame after the `<Three>`, or as `over` HTML.
- Never an empty or flat frame: the subject and the character are in view and readable from the FIRST frame. The spoken word changes something that is already there (a wall that starts low rises, a cable that starts thin thickens), it never makes the whole subject appear out of nothing.
- Sea, ground and floors: a disc or slab around the subject in a mid grey (`#262626`–`#3a3a3a`), never a plane that fills the whole box. The layer's edges fade out softly, so the box should hold the subject on a dark background, not a grey card.
- Surfaces that fill most of the view (a wall you stand inside, a floor seen from above, a tower face up close) stay dark: `#1a1a1a`–`#3a3a3a`, with `#555555` lines for detail. Keep the light greys (`#999999`–`#ffffff`) for the subject and the one thing that changes, so the eye goes there and the layer never turns into a bright card.
- The character must read on a phone: at least about a sixth of the box's height. Next to big structures, scale it up (`guy.scale.setScalar(2.5)`) or bring the camera closer; a dot-sized figure is a failed shot.
