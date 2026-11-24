import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, Mesh } from "three";
import type { Accessory } from "./personas.ts";
import type { BotSim } from "./sim.ts";

const DARK = "#2a3140";

function Hat({ kind, color }: { kind: Accessory; color: string }) {
  switch (kind) {
    case "glasses":
      return (
        <group position={[0, 1.3, 0.235]}>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <torusGeometry args={[0.065, 0.014, 8, 20]} />
              <meshStandardMaterial color="#3b2a1a" />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.07, 0.012, 0.012]} />
            <meshStandardMaterial color="#3b2a1a" />
          </mesh>
        </group>
      );
    case "beret":
      return (
        <mesh position={[0.04, 1.49, -0.02]} rotation={[0.1, 0, -0.25]} scale={[1, 0.32, 1]} castShadow>
          <sphereGeometry args={[0.27, 20, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    case "director":
      return (
        <group position={[0, 1.47, 0]} rotation={[0, Math.PI, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.26, 0.12, 20]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, -0.04, 0.27]}>
            <boxGeometry args={[0.3, 0.025, 0.18]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "headphones":
      return (
        <group position={[0, 1.3, 0]}>
          <mesh>
            <torusGeometry args={[0.28, 0.025, 8, 24, Math.PI]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
          {[-0.27, 0.27].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.09, 0.09, 0.07, 16]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ))}
          <mesh position={[-0.2, -0.12, 0.15]} rotation={[0.9, 0, 0.5]}>
            <cylinderGeometry args={[0.01, 0.01, 0.24]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        </group>
      );
    case "hardhat":
      return (
        <group position={[0, 1.45, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ffc93c" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.32, 0.32, 0.02, 24]} />
            <meshStandardMaterial color="#ffc93c" />
          </mesh>
        </group>
      );
    case "shades":
      return (
        <group>
          <mesh position={[0, 1.31, 0.235]}>
            <boxGeometry args={[0.38, 0.08, 0.02]} />
            <meshStandardMaterial color="#111" metalness={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.48, -0.02]} castShadow>
            <cylinderGeometry args={[0.24, 0.25, 0.1, 20]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.44, 0.24]}>
            <boxGeometry args={[0.32, 0.02, 0.16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
  }
}

// Low-poly office bot. Pose, props and position come from the sim every frame.
export function Bot({ bot }: { bot: BotSim }) {
  const root = useRef<Group>(null!);
  const body = useRef<Group>(null!);
  const head = useRef<Group>(null!);
  const armL = useRef<Group>(null!);
  const armR = useRef<Group>(null!);
  const legL = useRef<Group>(null!);
  const legR = useRef<Group>(null!);
  const folder = useRef<Mesh>(null!);
  const mug = useRef<Group>(null!);
  const snack = useRef<Mesh>(null!);
  const antenna = useRef<Mesh>(null!);
  const eyes = useRef<Group>(null!);
  const phase = useRef(Math.random() * 10);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase.current;
    const seated = bot.seated && !bot.walking;
    const p = bot.pose;
    root.current.position.set(bot.pos[0], 0, bot.pos[2]);
    root.current.rotation.y = bot.rotY;

    const swing = bot.walking ? Math.sin(t * 10) * 0.6 : 0;
    legL.current.rotation.x = seated ? -Math.PI / 2 : swing;
    legR.current.rotation.x = seated ? -Math.PI / 2 : -swing;
    body.current.position.y = seated ? -0.02 : bot.walking ? Math.abs(Math.sin(t * 10)) * 0.04 : Math.sin(t * 2) * 0.01;
    body.current.rotation.z = p === "talk" ? Math.sin(t * 3) * 0.04 : 0;
    head.current.rotation.x = p === "sleep" ? 0.45 : p === "type" ? 0.12 : 0;
    head.current.rotation.y = p === "talk" ? Math.sin(t * 2.3) * 0.15 : p === "idle" && !bot.walking ? Math.sin(t * 0.5) * 0.25 : 0;
    // Eyes close when asleep, blink now and then otherwise.
    eyes.current.scale.y = p === "sleep" || t % 4 < 0.12 ? 0.15 : 1;

    const carry = bot.carrying != null;
    let l: number;
    let r: number;
    if (carry) l = r = -1.1;
    else if (p === "type") (l = -1.15 + Math.sin(t * 18) * 0.12), (r = -1.15 + Math.sin(t * 18 + 1.6) * 0.12);
    else if (p === "sip") (l = 0), (r = Math.sin(t * 0.9) > 0.3 ? -2.3 : -0.9);
    else if (p === "eat") (l = 0), (r = -2.1 + Math.sin(t * 6) * 0.25);
    else if (p === "stretch") l = r = -2.9 + Math.sin(t * 2) * 0.1;
    else if (p === "talk") (l = -0.3 + Math.sin(t * 4) * 0.3), (r = -0.5 + Math.sin(t * 3 + 1) * 0.4);
    else if (bot.prop) (l = -swing * 0.8), (r = -0.9);
    else (l = -swing * 0.8), (r = swing * 0.8);
    armL.current.rotation.x = l;
    armR.current.rotation.x = r;

    folder.current.visible = carry;
    if (carry) (folder.current.material as any).color.set(bot.carrying);
    mug.current.visible = bot.prop === "mug" && !carry;
    snack.current.visible = bot.prop === "snack" && !carry;

    const glow = bot.status === "failed" ? (Math.sin(t * 8) > 0 ? 1 : 0.2) : bot.status === "working" ? 0.6 + Math.sin(t * 6) * 0.4 : p === "sleep" ? 0.05 : 0.3;
    (antenna.current.material as any).emissiveIntensity = glow * 2;
  });

  const tint = bot.persona.tint;
  return (
    <group ref={root}>
      {/* legs pivot at the hip so they fold forward when seated */}
      {[-0.13, 0.13].map((x, i) => (
        <group key={x} ref={i ? legR : legL} position={[x, 0.48, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[0.14, 0.44, 0.16]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
          <mesh position={[0, -0.44, 0.04]} castShadow>
            <boxGeometry args={[0.16, 0.06, 0.24]} />
            <meshStandardMaterial color={bot.color} />
          </mesh>
        </group>
      ))}
      <group ref={body}>
        <RoundedBox args={[0.56, 0.56, 0.4]} radius={0.1} position={[0, 0.78, 0]} castShadow>
          <meshStandardMaterial color={tint} />
        </RoundedBox>
        <mesh position={[0, 0.82, 0.205]}>
          <boxGeometry args={[0.22, 0.08, 0.02]} />
          <meshStandardMaterial color={bot.color} emissive={bot.color} emissiveIntensity={0.8} />
        </mesh>
        {/* head pivots at the neck so it can nod off */}
        <group ref={head} position={[0, 1.1, 0]}>
          <group position={[0, -1.1, 0]}>
            <RoundedBox args={[0.5, 0.36, 0.42]} radius={0.1} position={[0, 1.27, 0]} castShadow>
              <meshStandardMaterial color={tint} />
            </RoundedBox>
            <mesh position={[0, 1.28, 0.2]}>
              <boxGeometry args={[0.4, 0.2, 0.04]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            <group ref={eyes} position={[0, 1.29, 0.225]}>
              {[-0.09, 0.09].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshStandardMaterial color={bot.color} emissive={bot.color} emissiveIntensity={2} />
                </mesh>
              ))}
            </group>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.14]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            <mesh ref={antenna} position={[0, 1.6, 0]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color={bot.color} emissive={bot.color} />
            </mesh>
            <Hat kind={bot.persona.accessory} color={bot.color} />
          </group>
        </group>
        {[-0.34, 0.34].map((x, i) => (
          <group key={x} ref={i ? armR : armL} position={[x, 0.98, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.11, 0.42, 0.12]} />
              <meshStandardMaterial color={tint} />
            </mesh>
            {i === 1 && (
              <>
                <group ref={mug} position={[0, -0.44, 0.06]} visible={false}>
                  <mesh>
                    <cylinderGeometry args={[0.06, 0.05, 0.12, 14]} />
                    <meshStandardMaterial color="#ffffff" />
                  </mesh>
                  <mesh position={[0, 0.02, 0]}>
                    <cylinderGeometry args={[0.062, 0.062, 0.03, 14]} />
                    <meshStandardMaterial color={bot.color} />
                  </mesh>
                </group>
                <mesh ref={snack} position={[0, -0.44, 0.06]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
                  <torusGeometry args={[0.06, 0.03, 10, 16]} />
                  <meshStandardMaterial color="#e89ab0" />
                </mesh>
              </>
            )}
          </group>
        ))}
        <mesh ref={folder} position={[0, 0.95, 0.42]} rotation={[0.2, 0, 0]} visible={false} castShadow>
          <boxGeometry args={[0.42, 0.3, 0.05]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      </group>
    </group>
  );
}
