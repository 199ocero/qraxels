// You and your wife: the two humans in the bot office. Cosmetic only, the server knows nothing about them.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { pick } from "./personas.ts";
import { SPOTS, STEPS, cubicle, isSeated, notify, pathTo, say as botSay, sim, type Spot, type Vec } from "./sim.ts";

type Pose = "idle" | "sip" | "eat" | "sleep" | "talk" | "stretch" | "rub";
type Prop = "tumbler" | "snack" | null;
export type Human = { pos: Vec; rotY: number; seated: boolean; walking: boolean; pose: Pose; prop: Prop; say?: { text: string; until: number } };
type Step = { fn?: () => void; secs?: number; pose?: Pose; go?: Spot; path?: Vec[] };

// You sit in the producer chair behind your desk, facing the monitor.
export const you: Human = { pos: [10.35, 0, 0], rotY: -Math.PI / 2, seated: true, walking: false, pose: "idle", prop: null };
export const wife: Human = { pos: [...SPOTS.sofa2.stand], rotY: SPOTS.sofa2.face, seated: true, walking: false, pose: "idle", prop: null };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
let clock = 0;
const plan: Step[] = [];
function say(text: string, h = wife) {
  h.say = { text, until: clock + 2.8 };
  notify();
}
const call = (fn: () => void): Step => ({ fn });
const talk = (lines: string[]) => call(() => say(pick(lines)));
// One spoken line, held long enough to read.
const line = (text: string, h = wife): Step[] => [call(() => say(text, h)), hold(2.9, "talk")];
const hand = (p: Prop) => call(() => (wife.prop = p));
const hold = (secs: number, pose: Pose = "idle"): Step => ({ secs, pose });
const go = (to: Spot, path?: Vec[]): Step => ({ go: to, path });
const stop = (x: number, z: number, face: number): Spot => ({ stand: [x, 0, z], door: [x, 0, z], face });

// Beside your chair. Approached along z=1.75 so she never cuts through the desk, and left the same way.
const DESK_SIDE: Spot = { stand: [10.4, 0, 1.75], door: [8.3, 0, 1.75], face: Math.PI };
const leaveDesk = () => go(stop(8.3, 0, -Math.PI / 2), [[8.3, 0, 1.75], [8.3, 0, 0]]);
const WINDOW: Spot = { stand: [-2.25, 0, -6.4], door: [-2.25, 0, -1.2], face: Math.PI }; // the gap between cubicles 0 and 1

// Alternating lines: wife, you, wife…
const DESK_TALKS = [
  ["Hi love 😘", "Hi babe! 😊"],
  ["Are you done yet?", "5 more minutes…", "You said that an hour ago 🙄"],
  ["The baby kicked! 👶", "Really?! Let me feel 🥹"],
  ["Can you buy me mango? 🥭", "At midnight?!", "Yes. 🙂"],
  ["What are the bots making?", "A video about DNS.", "Cute. Now feed me 🍜"],
  ["Foot rub later? 🦶", "Of course ❤️"],
  ["Did you eat yet?", "Not yet…", "Eat! You're eating for zero 😤"],
  ["Baby names. Go.", "Pixel? 🤖", "Absolutely not."],
];
const BOT_REPLIES = ["Top secret 🤫", "A video about the internet!", "Congrats again! 🎉", "Want a donut? 🍩", "Almost done!", "Beep boop, hello baby 👶"];

function visitDesk(): Step[] {
  const lines = pick(DESK_TALKS);
  return [
    talk(["Gonna bother my husband 😏", "Checking on him…", "Time for a desk visit 💕"]),
    go(DESK_SIDE),
    call(() => ((you.rotY = 0), (you.pose = "talk"))), // swivel round to face her
    ...lines.flatMap((t, i) => line(t, i % 2 ? you : wife)),
    call(() => ((you.rotY = -Math.PI / 2), (you.pose = "idle"))),
    leaveDesk(),
    go(SPOTS.sofa2),
  ];
}

function visitBot(): Step[] {
  const bots = [...sim.bots.values()];
  if (!bots.length) return visitDesk();
  const bot = pick(bots.filter(isSeated).length ? bots.filter(isSeated) : bots);
  const door = cubicle(STEPS.indexOf(bot.id)).door;
  const at: Spot = { stand: door, door: [door[0], 0, Math.sign(door[2]) * 1.2], face: door[2] < 0 ? Math.PI : 0 };
  return [
    talk([`Let's see what ${bot.name} is up to 👀`, `Visiting ${bot.name}!`]),
    go(at),
    ...line(`Hi ${bot.name}! What are you working on?`),
    call(() => botSay(bot, pick(BOT_REPLIES), 2.9)),
    hold(2.9, "talk"),
    ...line(pick(["Keep it up! 💪", "Don't overwork 😅", "Aww, cute!", "Save me a donut 🍩"])),
    go(SPOTS.sofa2),
  ];
}

// What she does between rests on the sofa. Weights: the bladder still wins.
const ROUTINES: [number, () => Step[]][] = [
  [3, () => [talk(["Baby's on my bladder again 🤰", "Sorry, again! 🚽", "Third time this hour…", "Be right back 🏃‍♀️", "Why is the CR so far?!"]), hand(null), go(SPOTS.cr), talk(["💦 …ahh"]), hold(3), talk(["*flush* 🚽"]), go(SPOTS.sofa2), talk(["Okay, I'm good… 😌", "For now. 😅", "Phew.", "Where was I?"])]],
  [2, () => [talk(["Hydrate! 💧", "Water for two 🥤", "Tumbler time."]), hand("tumbler"), hold(rand(4, 6), "sip"), hand(null)]],
  [2, () => [talk(["Craving chips… 🥔", "Just one more handful.", "Eating for two 😋"]), hand("snack"), hold(rand(4, 6), "eat"), hand(null)]],
  [1, () => [talk(["I want chocolate. NOW 🍫", "Vendo run! 🏃‍♀️", "Baby wants a snack."]), go(SPOTS.vendo), hold(1.5), talk(["*clunk* 🍫"]), hand("snack"), go(SPOTS.sofa2), hold(rand(5, 7), "eat"), hand(null), talk(["Baby says thank you 😋"])]],
  [1, () => [talk(["So sleepy… 😴", "Just resting my eyes."]), hold(rand(7, 11), "sleep")]],
  [2.5, visitDesk],
  [1.5, visitBot],
  [1, () => [talk(["Wanna see the sky 🌤️", "Need some sunlight."]), go(WINDOW), hold(2, "rub"), talk(["Pretty day, baby 🌤️", "Look, birds! 🐦"]), hold(3, "rub"), go(SPOTS.sofa2)]],
  [1, () => [talk(["Doctor said walk more 🚶‍♀️", "Waddle laps!"]), go(stop(6, 0, Math.PI / 2)), hold(1.2), talk(["Okay that's enough cardio 😮‍💨"]), go(stop(-4, 0, -Math.PI / 2)), go(SPOTS.sofa2)]],
  [1, () => [talk(["Tumbler's empty 💧"]), hand("tumbler"), go(SPOTS.coffee), hold(2.2), talk(["Refilled! 💧", "Decaf would be nice… ☕"]), go(SPOTS.sofa2), hand(null)]],
  [1, () => [talk(["My back… 🫠", "Oof, stretch break."]), hold(3, "stretch")]],
  [1, () => [talk(["Ooh! Kick! 👶", "Someone's playing football in there ⚽", "Hi baby 💕"]), hold(4.5, "rub")]],
];
let last: (typeof ROUTINES)[number] | undefined;
function nextRoutine(): Step[] {
  const options = ROUTINES.filter((x) => x !== last); // never the same thing twice in a row
  let r = Math.random() * options.reduce((n, [w]) => n + w, 0);
  last = options.find(([w]) => (r -= w) <= 0) ?? options[0];
  return last[1]();
}

function tickWife(dt: number) {
  clock += dt;
  for (const h of [wife, you]) if (h.say && clock > h.say.until) (h.say = undefined), notify();
  if (!plan.length) plan.push(hold(rand(3, 6)), ...nextRoutine());
  const s = plan[0];
  const done = () => (plan.shift(), (wife.pose = "idle"), notify());
  if (s.fn) return s.fn(), done();
  if (s.secs != null) {
    if (wife.pose !== s.pose) (wife.pose = s.pose!), notify();
    return void ((s.secs -= dt) <= 0 && done());
  }
  const to = s.go!;
  s.path ??= pathTo(wife.pos, to);
  wife.seated = false;
  wife.walking = true;
  const t = s.path[0];
  if (!t) {
    Object.assign(wife, { walking: false, rotY: to.face, seated: !!to.seated });
    return done();
  }
  const dx = t[0] - wife.pos[0];
  const dz = t[2] - wife.pos[2];
  const dist = Math.hypot(dx, dz);
  const step = 2.6 * dt; // a hurried waddle, a bit slower than the bots
  if (dist <= step) (wife.pos = [...t]), s.path.shift();
  else (wife.pos = [wife.pos[0] + (dx / dist) * step, 0, wife.pos[2] + (dz / dist) * step]), (wife.rotY = Math.atan2(dx, dz));
}

type Look = { skin: string; shirt: string; pants: string; hair: string; longHair?: boolean; pregnant?: boolean; typing?: boolean };

function Tumbler() {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.042, 0.2, 14]} />
        <meshStandardMaterial color="#7fd1c7" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.03, 14]} />
        <meshStandardMaterial color="#2a3140" />
      </mesh>
    </group>
  );
}

function Person({ h, look }: { h: Human; look: Look }) {
  const root = useRef<Group>(null!);
  const body = useRef<Group>(null!);
  const head = useRef<Group>(null!);
  const eyes = useRef<Group>(null!);
  const legL = useRef<Group>(null!);
  const legR = useRef<Group>(null!);
  const armL = useRef<Group>(null!);
  const armR = useRef<Group>(null!);
  const tumbler = useRef<Group>(null!);
  const snack = useRef<Mesh>(null!);
  const phase = useRef(Math.random() * 10);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase.current;
    const seated = h.seated && !h.walking;
    const p = h.pose;
    root.current.position.set(h.pos[0], 0, h.pos[2]);
    root.current.rotation.y = h.rotY;
    const swing = h.walking ? Math.sin(t * 9) * 0.5 : 0;
    legL.current.rotation.x = seated ? -Math.PI / 2 : swing;
    legR.current.rotation.x = seated ? -Math.PI / 2 : -swing;
    body.current.position.y = seated ? -0.02 : h.walking ? Math.abs(Math.sin(t * 9)) * 0.03 : Math.sin(t * 2) * 0.01;
    body.current.rotation.z = h.walking && look.pregnant ? Math.sin(t * 9) * 0.08 : p === "talk" ? Math.sin(t * 3) * 0.04 : 0;
    body.current.rotation.x = p === "sleep" ? -0.15 : 0; // leans back into the sofa
    head.current.rotation.x = p === "sleep" ? 0.4 + Math.sin(t * 1.2) * 0.04 : look.typing ? 0.1 : 0;
    eyes.current.scale.y = p === "sleep" || t % 4.5 < 0.12 ? 0.15 : 1;

    let l = -swing * 0.8;
    let r = swing * 0.8;
    if (seated && look.typing && p === "idle") (l = -1.15 + Math.sin(t * 18) * 0.12), (r = -1.15 + Math.sin(t * 18 + 1.6) * 0.12);
    else if (p === "sip") (l = -0.55), (r = Math.sin(t * 0.9) > 0.3 ? -2.3 : -0.9);
    else if (p === "eat") (l = -0.55), (r = -2.1 + Math.sin(t * 6) * 0.25);
    else if (p === "talk") (l = -0.3 + Math.sin(t * 4) * 0.3), (r = -0.5 + Math.sin(t * 3 + 1) * 0.4);
    else if (p === "stretch") l = r = -2.9 + Math.sin(t * 2) * 0.1;
    else if (p === "rub") (l = -0.55 + Math.sin(t * 3) * 0.12), (r = -0.55 - Math.sin(t * 3) * 0.12);
    else if (h.prop) r = -0.9;
    else if (look.pregnant && !h.walking) l = r = -0.55; // hands resting on the bump
    if (h.prop && h.walking) l = -swing * 0.8;
    armL.current.rotation.x = l;
    armR.current.rotation.x = r;
    tumbler.current.visible = h.prop === "tumbler";
    snack.current.visible = h.prop === "snack";
  });

  const mat = (c: string) => <meshStandardMaterial color={c} />;
  return (
    <group ref={root}>
      {[-0.12, 0.12].map((x, i) => (
        <group key={x} ref={i ? legR : legL} position={[x, 0.48, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[0.15, 0.44, 0.16]} />
            {mat(look.pants)}
          </mesh>
          <mesh position={[0, -0.44, 0.04]} castShadow>
            <boxGeometry args={[0.15, 0.06, 0.24]} />
            {mat("#2a3140")}
          </mesh>
        </group>
      ))}
      <group ref={body}>
        <RoundedBox args={[0.48, 0.55, 0.3]} radius={0.1} position={[0, 0.78, 0]} castShadow>
          {mat(look.shirt)}
        </RoundedBox>
        {look.pregnant && (
          <mesh position={[0, 0.7, 0.15]} scale={[1, 1, 0.9]} castShadow>
            <sphereGeometry args={[0.22, 20, 16]} />
            {mat(look.shirt)}
          </mesh>
        )}
        {/* head pivots at the neck so it can nod off */}
        <group ref={head} position={[0, 1.1, 0]}>
          <group position={[0, -1.1, 0]}>
            <mesh position={[0, 1.27, 0]} castShadow>
              <sphereGeometry args={[0.19, 20, 16]} />
              {mat(look.skin)}
            </mesh>
            <group ref={eyes} position={[0, 1.29, 0.175]}>
              {[-0.07, 0.07].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                  <sphereGeometry args={[0.022, 10, 10]} />
                  {mat("#1d2433")}
                </mesh>
              ))}
            </group>
            {/* hair: a cap over the top and back of the head */}
            <mesh position={[0, 1.29, -0.02]} rotation={[-0.35, 0, 0]} castShadow>
              <sphereGeometry args={[0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              {mat(look.hair)}
            </mesh>
            {look.longHair && (
              <RoundedBox args={[0.36, 0.42, 0.1]} radius={0.04} position={[0, 1.13, -0.15]} castShadow>
                {mat(look.hair)}
              </RoundedBox>
            )}
          </group>
        </group>
        {[-0.3, 0.3].map((x, i) => (
          <group key={x} ref={i ? armR : armL} position={[x, 0.98, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.1, 0.42, 0.11]} />
              {mat(look.shirt)}
            </mesh>
            <mesh position={[0, -0.44, 0]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              {mat(look.skin)}
            </mesh>
            {i === 1 && (
              <>
                <group ref={tumbler} position={[0, -0.5, 0.06]} visible={false}>
                  <Tumbler />
                </group>
                <mesh ref={snack} position={[0, -0.48, 0.07]} visible={false} castShadow>
                  <boxGeometry args={[0.12, 0.16, 0.04]} />
                  <meshStandardMaterial color="#ffb02e" />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

// Her tumbler and snack bowl on the lounge coffee table; the tumbler leaves the table while she drinks.
function TableStuff() {
  const tumbler = useRef<Group>(null!);
  useFrame(() => void (tumbler.current.visible = wife.prop !== "tumbler"));
  return (
    <>
      <group ref={tumbler} position={[-11.05, 0.525, 4.8]}>
        <Tumbler />
      </group>
      <group position={[-10.75, 0.425, 4.55]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.1, 0.1, 18]} />
          <meshStandardMaterial color="#ff7eb6" />
        </mesh>
        {[[-0.06, 0.02], [0.05, -0.04], [0.02, 0.07], [-0.03, -0.07], [0.08, 0.04]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.11, z]} rotation={[0.4 * i, i, 0.3]}>
            <cylinderGeometry args={[0.04, 0.04, 0.01, 10]} />
            <meshStandardMaterial color="#f2c14e" />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function People() {
  useFrame((_, dt) => tickWife(Math.min(dt, 0.1)));
  return (
    <>
      <Person h={you} look={{ skin: "#c99a74", shirt: "#2f6bff", pants: "#3a4458", hair: "#1d1a18", typing: true }} />
      <Person h={wife} look={{ skin: "#d8a887", shirt: "#ff7eb6", pants: "#5b4a6b", hair: "#2b1d16", longHair: true, pregnant: true }} />
      <TableStuff />
    </>
  );
}
