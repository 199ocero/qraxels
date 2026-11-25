import { useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Vector3 } from "three";
import { Bot } from "./Bot.tsx";
import { Cubicle, Decor, Floor, Kitchen, Lounge, Restroom, Room, Sky, YourDesk } from "./Furniture.tsx";
import { People, wife, you } from "./People.tsx";
import { DESK, FLOOR, SPOTS, STEPS, getVersion, sim, subscribe, tick, type BotSim } from "./sim.ts";

const CENTER: [number, number, number] = [(FLOOR.minX + FLOOR.maxX) / 2, 0, 0.4];

// Labels are plain DOM over the canvas; each frame we project their 3D anchor to screen space.
const labels = new Map<string, { el: HTMLElement; anchor: () => [number, number, number] }>();
const v = new Vector3();

function Sim() {
  useFrame(({ camera, size }, dt) => {
    tick(Math.min(dt, 0.1));
    for (const { el, anchor } of labels.values()) {
      v.set(...anchor()).project(camera);
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

function Label({ id, anchor, children }: { id: string; anchor: () => [number, number, number]; children: React.ReactNode }) {
  return (
    <div
      className="label"
      ref={(el) => {
        if (el) labels.set(id, { el, anchor });
        else labels.delete(id);
      }}
    >
      {children}
    </div>
  );
}

// What the bubble over a bot shows, most important first.
function bubbleOf(bot: BotSim): { text: string; kind: string } | null {
  if (bot.say) return { text: bot.say.text, kind: "say" };
  if (bot.walking && bot.carrying) return { text: "📁 bringing it over", kind: "work" };
  if (bot.status === "failed") return { text: "⚠ stuck — see chat", kind: "failed" };
  if (bot.status === "working" && !bot.walking) return { text: bot.activity ?? "working…", kind: "work" };
  if (bot.status === "working") return { text: "On my way!", kind: "work" };
  if (bot.pose === "sleep") return { text: "z z z", kind: "zzz" };
  return null;
}

function Labels() {
  const waiting = [...sim.folders.values()].filter((f) => f.at === "desk").length;
  return (
    <div className="labels" aria-hidden>
      {[...sim.bots.values()].map((bot) => {
        const b = bubbleOf(bot);
        return (
          <Label key={bot.id} id={bot.id} anchor={() => [bot.pos[0], bot.seated ? 1.75 : 1.95, bot.pos[2]]}>
            {b && <div className={`bubble ${b.kind}`}>{b.text}</div>}
            <div className="name" style={{ borderColor: bot.color }}>
              {bot.name} <span>· {bot.role}</span>
            </div>
          </Label>
        );
      })}
      <Label id="desk" anchor={() => [DESK.center[0], 1.75, DESK.center[2]]}>
        <div className={`desk-sign ${waiting ? "waiting" : ""}`}>{waiting ? `Your desk · ${waiting} to review` : "Your desk"}</div>
      </Label>
      <Label id="wife" anchor={() => [wife.pos[0], wife.seated ? 1.65 : 1.85, wife.pos[2]]}>
        {wife.say ? <div className="bubble say">{wife.say.text}</div> : wife.pose === "sleep" && <div className="bubble zzz">z z z</div>}
        <div className="name" style={{ borderColor: "#ff7eb6" }}>
          Wife <span>· 🤰 expecting</span>
        </div>
      </Label>
      <Label id="you" anchor={() => [you.pos[0], 2.2, you.pos[2]]}>
        {you.say && <div className="bubble say">{you.say.text}</div>}
      </Label>
      <Label id="cr" anchor={() => [SPOTS.cr.stand[0], 1.6, 4.4]}>
        <div className="desk-sign">🚻 CR</div>
      </Label>
    </div>
  );
}

export function Office() {
  useSyncExternalStore(subscribe, getVersion);
  return (
    <>
      <Canvas shadows="percentage" dpr={[1, 2]}>
        <color attach="background" args={["#0f131b"]} />
        <OrthographicCamera makeDefault position={[CENTER[0] + 12, 15, 17]} zoom={36} near={-50} far={200} />
        <OrbitControls target={CENTER} maxPolarAngle={1.2} minZoom={20} maxZoom={120} enableDamping />
        <hemisphereLight args={["#fff8ee", "#c9b8a2", 0.9]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={1.5}
          color="#fff4e2"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        {/* soft light from the windows */}
        <directionalLight position={[-2, 6, -14]} intensity={0.35} color="#cfe6ff" />
        <Sky />
        <Floor />
        <Room />
        <Kitchen />
        <Lounge />
        <Restroom />
        <Decor />
        {STEPS.map((_, i) => (
          <Cubicle key={i} i={i} />
        ))}
        <YourDesk />
        {[...sim.bots.values()].map((b) => (
          <Bot key={b.id} bot={b} />
        ))}
        <People />
        <Sim />
      </Canvas>
      <Labels />
    </>
  );
}
