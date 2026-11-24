// The office set: room, kitchen, lounge, decor, cubicles and your desk. All primitives, no downloaded assets.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group, type Mesh } from "three";
import type { Step } from "../server/project.ts";
import { PERSONAS, type DeskProp } from "./personas.ts";
import { DESK, FLOOR, SPOTS, STEPS, cubicle, isSeated, sim } from "./sim.ts";

type V3 = [number, number, number];
const WOOD = "#c79f74";
const WALL = "#f1ece4";
const PARTITION = "#c9d3df";

export function Box({ size, pos, color, rot = [0, 0, 0], rough = 0.8 }: { size: V3; pos: V3; color: string; rot?: V3; rough?: number }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- room ----------
export function Floor() {
  const w = FLOOR.maxX - FLOOR.minX;
  const d = FLOOR.maxZ - FLOOR.minZ;
  const planks = useMemo(() => {
    const t = canvasTexture(512, 512, (g) => {
      const rows = 8;
      const h = 512 / rows;
      for (let r = 0; r < rows; r++) {
        let x = -((r * 137) % 256);
        while (x < 512) {
          const len = 180 + ((x * 7 + r * 31) % 140);
          const shade = 200 + ((x + r * 53) % 22);
          g.fillStyle = `rgb(${shade + 22},${shade - 8},${shade - 52})`;
          g.fillRect(x, r * h, len, h);
          g.fillStyle = "rgba(90,60,30,0.35)";
          g.fillRect(x, r * h, 2, h);
          x += len;
        }
        g.fillStyle = "rgba(90,60,30,0.45)";
        g.fillRect(0, r * h, 512, 2);
      }
    });
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(w / 4, d / 4);
    return t;
  }, [w, d]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(FLOOR.minX + FLOOR.maxX) / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={planks} roughness={0.9} />
      </mesh>
      {/* aisle runner */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.004, 0]} receiveShadow>
        <planeGeometry args={[19, 1.8]} />
        <meshStandardMaterial color="#9fb3a3" roughness={1} />
      </mesh>
    </>
  );
}

function Window({ x }: { x: number }) {
  return (
    <group position={[x, 1.75, FLOOR.minZ + 0.11]}>
      <Box size={[1.9, 1.3, 0.06]} pos={[0, 0, 0]} color="#ffffff" />
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[1.75, 1.15]} />
        <meshStandardMaterial color="#bfe2ff" emissive="#9fd1ff" emissiveIntensity={0.35} />
      </mesh>
      <Box size={[0.04, 1.15, 0.03]} pos={[0, 0, 0.05]} color="#ffffff" />
      <Box size={[1.75, 0.04, 0.03]} pos={[0, 0, 0.05]} color="#ffffff" />
      <Box size={[2.0, 0.06, 0.18]} pos={[0, -0.68, 0.08]} color="#ffffff" />
    </group>
  );
}

function Clock() {
  const hour = useRef<Group>(null!);
  const minute = useRef<Group>(null!);
  useFrame(() => {
    const d = new Date();
    minute.current.rotation.x = -(d.getMinutes() / 60) * Math.PI * 2;
    hour.current.rotation.x = -(((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2;
  });
  return (
    <group position={[FLOOR.minX + 0.12, 2.05, -3.4]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.01, 0, 0]}>
        <torusGeometry args={[0.32, 0.03, 8, 32]} />
        <meshStandardMaterial color="#2a3140" />
      </mesh>
      <group ref={hour} position={[0.04, 0, 0]}>
        <Box size={[0.02, 0.17, 0.035]} pos={[0, 0.08, 0]} color="#2a3140" />
      </group>
      <group ref={minute} position={[0.05, 0, 0]}>
        <Box size={[0.02, 0.26, 0.025]} pos={[0, 0.12, 0]} color="#2a3140" />
      </group>
    </group>
  );
}

function Whiteboard() {
  const tex = useMemo(
    () =>
      canvasTexture(512, 280, (g) => {
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, 512, 280);
        g.font = "bold 44px system-ui, sans-serif";
        g.fillStyle = "#2f6bff";
        g.fillText("THIS WEEK", 28, 60);
        g.font = "30px system-ui, sans-serif";
        g.fillStyle = "#2a3140";
        ["✓ URL video", "→ QR codes", "→ Card taps", "? Cache"].forEach((t, i) => g.fillText(t, 36, 112 + i * 40));
        g.strokeStyle = "#ff5c8a";
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(330, 210);
        g.bezierCurveTo(360, 120, 420, 240, 470, 110);
        g.stroke();
        g.fillStyle = "#5be37d";
        g.fillRect(330, 220, 140, 14);
      }),
    [],
  );
  return (
    <group position={[7.6, 1.65, FLOOR.minZ + 0.12]}>
      <Box size={[2.3, 1.3, 0.05]} pos={[0, 0, 0]} color="#9aa3b2" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Poster({ pos, colors }: { pos: V3; colors: string[] }) {
  return (
    <group position={pos} rotation={[0, Math.PI / 2, 0]}>
      <Box size={[1.1, 0.8, 0.04]} pos={[0, 0, 0]} color="#2a3140" />
      {colors.map((c, i) => (
        <mesh key={i} position={[-0.3 + i * 0.3, -0.05 + (i % 2) * 0.12, 0.03]}>
          <circleGeometry args={[0.16, 24]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

export function Room() {
  const w = FLOOR.maxX - FLOOR.minX;
  const d = FLOOR.maxZ - FLOOR.minZ;
  const H = 2.8;
  return (
    <>
      <Box size={[w, H, 0.2]} pos={[(FLOOR.minX + FLOOR.maxX) / 2, H / 2, FLOOR.minZ - 0.1]} color={WALL} />
      <Box size={[0.2, H, d + 0.2]} pos={[FLOOR.minX - 0.1, H / 2, -0.1]} color={WALL} />
      {/* baseboards */}
      <Box size={[w, 0.12, 0.04]} pos={[(FLOOR.minX + FLOOR.maxX) / 2, 0.06, FLOOR.minZ + 0.02]} color="#d8cfc2" />
      <Box size={[0.04, 0.12, d]} pos={[FLOOR.minX + 0.02, 0.06, 0]} color="#d8cfc2" />
      {[-7.4, -2.25, 2.25].map((x) => (
        <Window key={x} x={x} />
      ))}
      <Whiteboard />
      <Clock />
      <Poster pos={[FLOOR.minX + 0.04, 1.75, 4.35]} colors={["#ff8a3d", "#3dd6ff", "#ffd23d"]} />
    </>
  );
}

// ---------- kitchen ----------
function Steam() {
  const puffs = useRef<Mesh[]>([]);
  useFrame(({ clock }) => {
    const on = sim.clock < sim.brewUntil;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const k = (clock.elapsedTime * 0.8 + i / 3) % 1;
      m.visible = on;
      m.position.y = k * 0.45;
      m.scale.setScalar(0.5 + k);
      (m.material as any).opacity = 0.5 * (1 - k);
    });
  });
  return (
    <group position={[0, 0.42, 0.08]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m!)}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function Kitchen() {
  const z = FLOOR.minZ + 0.45;
  return (
    <>
      {/* counter + cabinets */}
      <Box size={[3.1, 0.86, 0.7]} pos={[-10.15, 0.43, z]} color="#7b8aa0" />
      <Box size={[3.2, 0.06, 0.78]} pos={[-10.15, 0.89, z + 0.02]} color="#eceff3" rough={0.3} />
      <Box size={[3.1, 0.6, 0.38]} pos={[-10.15, 2.05, FLOOR.minZ + 0.2]} color="#7b8aa0" />
      {/* fridge */}
      <RoundedBox args={[0.85, 1.9, 0.75]} radius={0.05} position={[-12.2, 0.95, z]} castShadow>
        <meshStandardMaterial color="#e9edf2" roughness={0.3} />
      </RoundedBox>
      <Box size={[0.04, 0.5, 0.04]} pos={[-11.85, 1.2, z + 0.39]} color="#9aa3b2" />
      {/* coffee machine */}
      <group position={[-9.6, 0.92, z - 0.05]}>
        <RoundedBox args={[0.42, 0.5, 0.36]} radius={0.04} position={[0, 0.25, 0]} castShadow>
          <meshStandardMaterial color="#2a3140" roughness={0.4} />
        </RoundedBox>
        <Box size={[0.3, 0.06, 0.2]} pos={[0, 0.06, 0.12]} color="#111" />
        <mesh position={[0.12, 0.38, 0.185]}>
          <circleGeometry args={[0.03, 12]} />
          <meshStandardMaterial color="#5be37d" emissive="#5be37d" emissiveIntensity={1.5} />
        </mesh>
        <Steam />
      </group>
      {/* mugs + microwave */}
      {[-10.2, -10.05].map((x, i) => (
        <mesh key={x} position={[x, 0.97, z + 0.15]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 12]} />
          <meshStandardMaterial color={i ? "#ff8a3d" : "#3dd6ff"} />
        </mesh>
      ))}
      <Box size={[0.6, 0.34, 0.4]} pos={[-11.15, 1.09, z - 0.05]} color="#d8dde4" />
      <Box size={[0.36, 0.24, 0.02]} pos={[-11.2, 1.09, z + 0.16]} color="#2a3140" />
      {/* bistro table + stools */}
      <mesh position={[-10.8, 0.74, -3.6]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 28]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <Box size={[0.08, 0.72, 0.08]} pos={[-10.8, 0.36, -3.6]} color="#2a3140" />
      {([[-10.8, -2.95], [-11.6, -3.7]] as const).map(([x, zz]) => (
        <group key={x} position={[x, 0, zz]}>
          <mesh position={[0, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.06, 18]} />
            <meshStandardMaterial color="#ff8a3d" />
          </mesh>
          <Box size={[0.05, 0.42, 0.05]} pos={[0, 0.21, 0]} color="#2a3140" />
        </group>
      ))}
    </>
  );
}

// ---------- lounge ----------
export function Lounge() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11.3, 0.006, 4.35]} receiveShadow>
        <planeGeometry args={[3.1, 3.2]} />
        <meshStandardMaterial color="#c7b9e6" roughness={1} />
      </mesh>
      {/* sofa against the left wall, facing the room */}
      <group position={[-12.4, 0, 4.35]}>
        <RoundedBox args={[0.85, 0.42, 2.7]} radius={0.08} position={[0.05, 0.21, 0]} castShadow>
          <meshStandardMaterial color="#3d6fb6" />
        </RoundedBox>
        <RoundedBox args={[0.25, 0.9, 2.7]} radius={0.08} position={[-0.32, 0.45, 0]} castShadow>
          <meshStandardMaterial color="#35619f" />
        </RoundedBox>
        {[-1.35, 1.35].map((zz) => (
          <RoundedBox key={zz} args={[0.85, 0.6, 0.2]} radius={0.06} position={[0.05, 0.3, zz]} castShadow>
            <meshStandardMaterial color="#35619f" />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.18, 0.32, 0.4]} radius={0.06} position={[-0.12, 0.6, 0.6]} rotation={[0, 0, -0.2]}>
          <meshStandardMaterial color="#ffd23d" />
        </RoundedBox>
      </group>
      {/* coffee table */}
      <Box size={[0.7, 0.05, 1.2]} pos={[-10.85, 0.4, 4.35]} color={WOOD} />
      {[[-11.1, 3.85], [-10.6, 3.85], [-11.1, 4.85], [-10.6, 4.85]].map(([x, zz]) => (
        <Box key={`${x}${zz}`} size={[0.05, 0.38, 0.05]} pos={[x, 0.19, zz]} color="#2a3140" />
      ))}
      <Box size={[0.3, 0.02, 0.22]} pos={[-10.9, 0.44, 4.1]} rot={[0, 0.3, 0]} color="#ff5c8a" />
      <Box size={[0.3, 0.02, 0.22]} pos={[-10.85, 0.46, 4.15]} rot={[0, -0.2, 0]} color="#3dd6ff" />
      {/* floor lamp */}
      <group position={[-12.5, 0, 6.3]}>
        <Box size={[0.3, 0.04, 0.3]} pos={[0, 0.02, 0]} color="#2a3140" />
        <Box size={[0.04, 1.5, 0.04]} pos={[0, 0.75, 0]} color="#2a3140" />
        <mesh position={[0, 1.55, 0]}>
          <coneGeometry args={[0.25, 0.3, 20, 1, true]} />
          <meshStandardMaterial color="#fff4d6" emissive="#ffe7a8" emissiveIntensity={0.6} side={2} />
        </mesh>
      </group>
      {/* bookshelf */}
      <group position={[FLOOR.minX + 0.25, 0, 1.6]}>
        <Box size={[0.4, 1.8, 1.2]} pos={[0, 0.9, 0]} color="#8a6a4a" />
        {[0.45, 0.95, 1.45].map((y) =>
          [-0.4, -0.2, 0, 0.2, 0.4].map((zz, i) => <Box key={`${y}${zz}`} size={[0.3, 0.32, 0.12]} pos={[0.06, y, zz]} color={["#ff8a3d", "#3dd6ff", "#b77dff", "#5be37d", "#ffd23d"][(i + y * 10) % 5]} />),
        )}
      </group>
    </>
  );
}

// ---------- CR (comfort room) ----------
// Cubicle-height walls so the camera still sees in; the door gap faces the aisle.
export function Restroom() {
  const [x, , z] = SPOTS.cr.stand;
  const W = "#bcd7e6";
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, 5.65]} receiveShadow>
        <planeGeometry args={[1.6, 2.5]} />
        <meshStandardMaterial color="#e3eef2" roughness={0.6} />
      </mesh>
      <Box size={[0.08, 1.35, 2.5]} pos={[x - 0.8, 0.675, 5.65]} color={W} />
      <Box size={[0.08, 1.35, 2.5]} pos={[x + 0.8, 0.675, 5.65]} color={W} />
      <Box size={[0.4, 1.35, 0.08]} pos={[x - 0.6, 0.675, 4.4]} color={W} />
      <Box size={[0.4, 1.35, 0.08]} pos={[x + 0.6, 0.675, 4.4]} color={W} />
      {/* toilet facing the door */}
      <mesh position={[x, 0.2, z + 0.05]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <Box size={[0.42, 0.45, 0.18]} pos={[x, 0.62, z + 0.35]} color="#ffffff" rough={0.3} />
    </>
  );
}

// ---------- decor ----------
export function Plant({ pos, s = 1 }: { pos: V3; s?: number }) {
  return (
    <group position={pos} scale={s}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 14]} />
        <meshStandardMaterial color="#c8714f" />
      </mesh>
      {[[0, 0.75, 0, 0.32], [0.15, 0.6, 0.1, 0.24], [-0.14, 0.62, -0.08, 0.22], [0.02, 1.0, 0.04, 0.2]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={i % 2 ? "#4f9a5c" : "#5fae6b"} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// Snack vending machine against the left wall, glass front facing the room (+x).
function VendingMachine() {
  const sign = useMemo(
    () =>
      canvasTexture(256, 64, (g) => {
        g.fillStyle = "#1c2230";
        g.fillRect(0, 0, 256, 64);
        g.fillStyle = "#ffd23d";
        g.font = "bold 38px system-ui, sans-serif";
        g.textAlign = "center";
        g.fillText("SNACKS", 128, 46);
      }),
    [],
  );
  const [, , z] = SPOTS.vendo.stand;
  const front = -12.27;
  const COLORS = ["#ff8a3d", "#3dd6ff", "#ffd23d", "#5be37d", "#ff5c8a", "#b77dff"];
  return (
    <group>
      <RoundedBox args={[0.65, 1.85, 0.95]} radius={0.04} position={[-12.6, 0.925, z]} castShadow>
        <meshStandardMaterial color="#d8344a" roughness={0.5} />
      </RoundedBox>
      <mesh position={[front, 1.72, z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.4} />
      </mesh>
      {/* glass window with rows of snacks */}
      <mesh position={[front - 0.005, 1.05, z - 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.62, 1.05]} />
        <meshStandardMaterial color="#1c2230" emissive="#2f6bff" emissiveIntensity={0.15} />
      </mesh>
      {[0.7, 0.95, 1.2, 1.45].map((y, r) =>
        [-0.32, -0.17, -0.02, 0.13].map((dz, c) => <Box key={`${r}${c}`} size={[0.04, 0.16, 0.11]} pos={[front, y, z + dz]} color={COLORS[(r * 4 + c) % COLORS.length]} />),
      )}
      {/* keypad + pickup slot */}
      <Box size={[0.02, 0.4, 0.18]} pos={[front, 1.2, z + 0.34]} color="#2a3140" />
      <mesh position={[front - 0.012, 1.3, z + 0.34]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.025, 12]} />
        <meshStandardMaterial color="#5be37d" emissive="#5be37d" emissiveIntensity={1.5} />
      </mesh>
      <Box size={[0.02, 0.18, 0.6]} pos={[front, 0.3, z - 0.1]} color="#111" />
    </group>
  );
}

export function Decor() {
  return (
    <>
      <VendingMachine />
      {/* water cooler by the whiteboard: the chat corner */}
      <group position={[7.55, 0, -4.85]}>
        <Box size={[0.4, 0.95, 0.4]} pos={[0, 0.475, 0]} color="#e9edf2" />
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.5, 18]} />
          <meshStandardMaterial color="#7cc4ff" transparent opacity={0.75} roughness={0.1} />
        </mesh>
      </group>
      {/* printer + filing cabinet */}
      <Box size={[0.7, 0.75, 0.55]} pos={[8.6, 0.375, 5.6]} color="#5b6578" />
      <Box size={[0.6, 0.25, 0.5]} pos={[8.6, 0.88, 5.6]} color="#e9edf2" />
      <Box size={[0.5, 1.1, 0.55]} pos={[7.6, 0.55, 6.2]} color="#7b8aa0" />
      <Plant pos={[10.1, 0, -6.4]} s={1.3} />
      <Plant pos={[10.1, 0, 6.4]} s={1.2} />
      <Plant pos={[-9.4, 0, 6.6]} s={1.1} />
      <Plant pos={[-12.5, 0, -1.7]} s={1.1} />
      <Plant pos={[6.9, 0, 6.3]} s={0.9} />
    </>
  );
}

// ---------- cubicles ----------
function DeskThing({ kind, color }: { kind: DeskProp; color: string }) {
  switch (kind) {
    case "books":
      return (
        <group>
          {[0, 1, 2].map((i) => (
            <Box key={i} size={[0.36, 0.07, 0.26]} pos={[0, 0.035 + i * 0.07, 0]} rot={[0, i * 0.2, 0]} color={["#ff8a3d", "#3d6fb6", "#f1ece4"][i]} />
          ))}
          <mesh position={[0.32, 0.18, 0.05]} castShadow>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color="#5fae6b" />
          </mesh>
        </group>
      );
    case "papers":
      return (
        <group>
          <Box size={[0.3, 0.08, 0.38]} pos={[0, 0.04, 0]} color="#ffffff" />
          {[[0.3, 0.05], [0.4, -0.15], [0.22, -0.2]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.05, z]}>
              <icosahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial color="#f1ece4" flatShading />
            </mesh>
          ))}
        </group>
      );
    case "clapper":
      return (
        <group rotation={[0, 0.4, 0]}>
          <Box size={[0.36, 0.24, 0.04]} pos={[0, 0.12, 0]} color="#2a3140" />
          <Box size={[0.36, 0.06, 0.045]} pos={[0, 0.27, 0]} rot={[0, 0, 0.25]} color="#ffffff" />
        </group>
      );
    case "mic":
      return (
        <group>
          <Box size={[0.18, 0.02, 0.18]} pos={[0, 0.01, 0]} color="#2a3140" />
          <Box size={[0.025, 0.3, 0.025]} pos={[0, 0.15, 0]} color="#2a3140" />
          <mesh position={[0, 0.34, 0]}>
            <capsuleGeometry args={[0.05, 0.08, 6, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "toolbox":
      return (
        <group>
          <Box size={[0.42, 0.18, 0.22]} pos={[0, 0.09, 0]} color="#d9534f" />
          <Box size={[0.2, 0.04, 0.04]} pos={[0, 0.21, 0]} color="#2a3140" />
        </group>
      );
    case "monitor":
      return (
        <group rotation={[0, 0.35, 0]}>
          <Box size={[0.04, 0.2, 0.04]} pos={[0, 0.1, 0]} color="#2a3140" />
          <Box size={[0.5, 0.3, 0.03]} pos={[0, 0.33, 0]} color="#1c2230" />
          <Box size={[0.36, 0.035, 0.035]} pos={[-0.04, 0.33, 0.02]} color={color} />
        </group>
      );
  }
}

function Laptop({ step }: { step: Step }) {
  const screen = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    const bot = sim.bots.get(step);
    const m = screen.current.material as any;
    const on = bot && bot.status === "working" && isSeated(bot);
    m.emissiveIntensity = on ? 0.9 + Math.sin(clock.elapsedTime * 7) * 0.25 : bot?.status === "failed" ? 0.8 : 0.12;
    m.emissive.set(bot?.status === "failed" ? "#ff4d4d" : PERSONAS[step].color);
  });
  return (
    <group position={[0, 0.78, -1.1]}>
      <Box size={[0.62, 0.03, 0.42]} pos={[0, 0, 0]} color="#3a4252" />
      <mesh ref={screen} position={[0, 0.2, -0.22]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.4, 0.03]} />
        <meshStandardMaterial color="#1c2230" emissive="#88a" />
      </mesh>
    </group>
  );
}

function Folders({ colors, at }: { colors: string[]; at: V3 }) {
  return (
    <>
      {colors.map((c, i) => (
        <Box key={i} size={[0.42, 0.04, 0.3]} pos={[at[0], at[1] + 0.02 + i * 0.045, at[2]]} color={c} />
      ))}
    </>
  );
}

export function Cubicle({ i }: { i: number }) {
  const c = cubicle(i);
  const step = STEPS[i];
  const persona = PERSONAS[step];
  const tray = [...sim.folders.values()].filter((f) => f.at === step).map((f) => f.color);
  return (
    <group position={c.center} rotation={[0, c.rot, 0]}>
      <Box size={[3.4, 1.35, 0.08]} pos={[0, 0.675, -1.75]} color={PARTITION} />
      <Box size={[0.08, 1.35, 2.4]} pos={[-1.7, 0.675, -0.55]} color={PARTITION} />
      <Box size={[0.08, 1.35, 2.4]} pos={[1.7, 0.675, -0.55]} color={PARTITION} />
      {/* trim in the bot's colour */}
      <Box size={[3.48, 0.05, 0.12]} pos={[0, 1.37, -1.75]} color={persona.color} />
      <Box size={[0.12, 0.05, 2.4]} pos={[-1.7, 1.37, -0.55]} color={persona.color} />
      <Box size={[0.12, 0.05, 2.4]} pos={[1.7, 1.37, -0.55]} color={persona.color} />
      {/* pinned notes */}
      <Box size={[0.22, 0.22, 0.01]} pos={[-0.9, 1.05, -1.7]} color="#fff3a0" />
      <Box size={[0.22, 0.22, 0.01]} pos={[-0.6, 0.95, -1.7]} color="#ffd1dc" />
      {/* desk */}
      <Box size={[2.6, 0.06, 0.95]} pos={[0, 0.75, -1.2]} color={WOOD} />
      <Box size={[0.06, 0.72, 0.9]} pos={[-1.25, 0.36, -1.2]} color={WOOD} />
      <Box size={[0.06, 0.72, 0.9]} pos={[1.25, 0.36, -1.2]} color={WOOD} />
      <Laptop step={step} />
      <group position={[-0.85, 0.78, -1.2]}>
        <DeskThing kind={persona.deskProp} color={persona.color} />
      </group>
      {/* inbox tray with the folders waiting for this bot */}
      <Box size={[0.5, 0.05, 0.38]} pos={[0.92, 0.8, -1.15]} color="#5b6578" />
      <Folders colors={tray} at={[0.92, 0.82, -1.15]} />
      {/* office chair */}
      <RoundedBox args={[0.55, 0.08, 0.5]} radius={0.03} position={[0, 0.42, -0.3]} castShadow>
        <meshStandardMaterial color="#3a4458" />
      </RoundedBox>
      <RoundedBox args={[0.52, 0.55, 0.08]} radius={0.04} position={[0, 0.72, 0.0]} castShadow>
        <meshStandardMaterial color="#3a4458" />
      </RoundedBox>
      <Box size={[0.06, 0.38, 0.06]} pos={[0, 0.2, -0.3]} color="#2a3140" />
      <Box size={[0.5, 0.04, 0.06]} pos={[0, 0.03, -0.3]} color="#2a3140" />
      <Box size={[0.06, 0.04, 0.5]} pos={[0, 0.03, -0.3]} color="#2a3140" />
    </group>
  );
}

export function YourDesk() {
  const waiting = [...sim.folders.values()].filter((f) => f.at === "desk").map((f) => f.color);
  const plate = useMemo(
    () =>
      canvasTexture(256, 64, (g) => {
        g.fillStyle = "#2a3140";
        g.fillRect(0, 0, 256, 64);
        g.fillStyle = "#ffd23d";
        g.font = "bold 36px system-ui, sans-serif";
        g.textAlign = "center";
        g.fillText("PRODUCER", 128, 46);
      }),
    [],
  );
  const [x, , z] = DESK.center;
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.006, 0]} receiveShadow>
        <planeGeometry args={[2.4, 3.6]} />
        <meshStandardMaterial color="#e6c9a8" roughness={1} />
      </mesh>
      <Box size={[1.1, 0.07, 2.8]} pos={[0, 0.76, 0]} color="#8a6a4a" />
      <Box size={[1.0, 0.72, 0.06]} pos={[0, 0.36, -1.35]} color="#6f543a" />
      <Box size={[1.0, 0.72, 0.06]} pos={[0, 0.36, 1.35]} color="#6f543a" />
      <Box size={[0.06, 0.6, 2.6]} pos={[-0.5, 0.42, 0]} color="#6f543a" />
      {/* monitor facing you (+x), nameplate facing the office */}
      <Box size={[0.25, 0.04, 0.3]} pos={[0.15, 0.81, 0]} color="#2a3140" />
      <Box size={[0.04, 0.28, 0.04]} pos={[0.15, 0.95, 0]} color="#2a3140" />
      <Box size={[0.05, 0.55, 0.95]} pos={[0.12, 1.25, 0]} color="#1c2230" />
      <mesh position={[0.15, 1.25, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.88, 0.48]} />
        <meshStandardMaterial color="#2f6bff" emissive="#2f6bff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.56, 0.62, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.0, 0.25]} />
        <meshStandardMaterial map={plate} />
      </mesh>
      {/* lamp + mug + plant */}
      <group position={[0.2, 0.8, -1.1]}>
        <Box size={[0.03, 0.4, 0.03]} pos={[0, 0.2, 0]} color="#2a3140" rot={[0, 0, -0.3]} />
        <mesh position={[-0.1, 0.42, 0]} rotation={[0, 0, 0.8]}>
          <coneGeometry args={[0.1, 0.16, 16, 1, true]} />
          <meshStandardMaterial color="#ffd23d" emissive="#ffe7a8" emissiveIntensity={0.5} side={2} />
        </mesh>
      </group>
      <mesh position={[0.25, 0.85, 1.05]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 14]} />
        <meshStandardMaterial color="#2f6bff" />
      </mesh>
      <Plant pos={[0.25, 0.8, -0.6]} s={0.45} />
      <Folders colors={waiting} at={[-0.2, 0.8, 0.7]} />
      {/* your chair */}
      <group position={[0.9, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <RoundedBox args={[0.6, 0.1, 0.55]} radius={0.04} position={[0, 0.46, 0]} castShadow>
          <meshStandardMaterial color="#2a3140" />
        </RoundedBox>
        <RoundedBox args={[0.58, 0.75, 0.1]} radius={0.05} position={[0, 0.85, -0.27]} castShadow>
          <meshStandardMaterial color="#2a3140" />
        </RoundedBox>
        <Box size={[0.06, 0.42, 0.06]} pos={[0, 0.21, 0]} color="#5b6578" />
      </group>
    </group>
  );
}
