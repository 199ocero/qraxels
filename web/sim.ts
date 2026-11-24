// Mutable office simulation. Server events mutate it; the 3D scene reads it every frame,
// and React panels re-render through subscribe()/version.
import type { ChatMsg, State, Step } from "../server/project.ts";
import type { OfficeEvent } from "../server/office.ts";
import { CONVOS, PERSONAS, pick, type Activity, type Persona } from "./personas.ts";

export type Vec = [number, number, number];
export type Place = Step | "desk";
export type Pose = "idle" | "type" | "sip" | "eat" | "talk" | "sleep" | "stretch";
export type Prop = "mug" | "snack" | null;
// A place a bot can walk to: approach via `door` (on the aisle side), stand at `stand`, then face `face`.
export type Spot = { stand: Vec; door: Vec; face: number; seated?: boolean; key?: string };

export const STEPS: Step[] = ["script", "scenes", "voice", "build", "render"];
export const BOT_COLORS = Object.fromEntries(STEPS.map((s) => [s, PERSONAS[s].color])) as Record<Step, string>;

// ---------- floor plan ----------
// Aisle runs along z=0. Top row of cubicles faces it from -z, bottom row from +z (rotated π).
const CX = [-4.5, 0, 4.5, 4.5, 0, -4.5];
export const CUBE_Z = 4.2;
export const FLOOR = { minX: -13, maxX: 10.6, minZ: -7, maxZ: 7 };

export function cubicle(i: number) {
  const top = i < 3;
  const cx = CX[i];
  const cz = top ? -CUBE_Z : CUBE_Z;
  const s = top ? 1 : -1;
  const world = (lx: number, ly: number, lz: number): Vec => [cx + s * lx, ly, cz + s * lz];
  const door = world(0, 0, 1.4);
  const seatRot = top ? Math.PI : 0;
  return {
    center: [cx, 0, cz] as Vec,
    rot: top ? 0 : Math.PI,
    world,
    seat: world(0, 0, -0.35),
    seatRot,
    door,
    seatSpot: { stand: world(0, 0, -0.35), door, face: seatRot, seated: true } as Spot,
    traySpot: { stand: world(0.95, 0, -0.25), door, face: seatRot } as Spot,
  };
}

export const DESK = { center: [9.5, 0, 0] as Vec, spot: { stand: [8.3, 0, 0], door: [8.3, 0, 0], face: Math.PI / 2 } as Spot };

const spot = (key: string, stand: Vec, face: number, seated = false): Spot => ({ key, stand, door: [stand[0], 0, Math.sign(stand[2]) * 1.2], face, seated });
export const SPOTS = {
  coffee: spot("coffee", [-9.6, 0, -5.4], Math.PI),
  snack: spot("snack", [-12, 0, -5.4], Math.PI),
  stool1: spot("stool1", [-10.8, 0, -2.85], Math.PI, true),
  window: spot("window", [-7.4, 0, -6.1], Math.PI),
  sofa1: spot("sofa1", [-12, 0, 3.7], Math.PI / 2, true),
  sofa2: spot("sofa2", [-12, 0, 5.0], Math.PI / 2, true), // your wife's seat (People.tsx); bots only use sofa1
  cr: spot("cr", [-7.8, 0, 6.15], Math.PI, true),
  vendo: { key: "vendo", stand: [-11.7, 0, -0.7], door: [-11.7, 0, 0], face: -Math.PI / 2 } as Spot, // vending machine on the left wall, right off the aisle
  chat1: spot("chat1", [6.95, 0, -3.3], Math.PI / 2),
  chat2: spot("chat2", [8.15, 0, -3.3], -Math.PI / 2),
};

// Walk straight out to the aisle, along it, then in through the target's door.
export function pathTo(from: Vec, to: Spot): Vec[] {
  const pts: Vec[] = [];
  const near = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.05;
  if (near(from, to.stand)) return [];
  // Short hop inside the same cubicle/area (e.g. tray → chair): walk straight there.
  if (Math.abs(from[2]) > 2.4 && Math.sign(from[2]) === Math.sign(to.stand[2]) && Math.hypot(from[0] - to.stand[0], from[2] - to.stand[2]) < 1.6) return [to.stand];
  const sameLane = Math.abs(from[0] - to.stand[0]) < 0.05 && Math.sign(from[2]) === Math.sign(to.stand[2]) && from[2] !== 0;
  if (!sameLane) {
    if (Math.abs(from[2]) > 0.05) pts.push([from[0], 0, 0]);
    pts.push([to.door[0], 0, 0]);
  }
  pts.push(to.door, to.stand);
  return pts.filter((p, i) => !near(p, i ? pts[i - 1] : from));
}

// ---------- state ----------
type Action =
  | { kind: "go"; to: Spot; work?: boolean; path?: Vec[]; onArrive?: () => void }
  | { kind: "pose"; pose: Pose; secs: number; t?: number; work?: boolean }
  | { kind: "convo"; convo: Convo; work?: boolean }
  | { kind: "call"; fn: () => void; work?: boolean };

type Convo = { a: Step; b: Step; lines: { who: "a" | "b"; text: string }[]; i: number; nextAt: number; done: boolean };

export type BotSim = {
  id: Step;
  name: string;
  role: string;
  color: string;
  persona: Persona;
  pos: Vec;
  rotY: number;
  status: "idle" | "working" | "failed";
  activity?: string;
  project?: string;
  carrying: string | null;
  prop: Prop;
  pose: Pose;
  seated: boolean;
  say?: { text: string; until: number };
  actions: Action[];
  walking: boolean;
  idleIn: number;
};

export type Folder = { color: string; topic: string; at: Place | "carried" };

export const sim = {
  bots: new Map<Step, BotSim>(),
  folders: new Map<string, Folder>(),
  projects: new Map<string, State>(),
  chat: [] as ChatMsg[],
  connected: false,
  version: 0,
  clock: 0,
  brewUntil: 0,
  convos: [] as Convo[],
  reserved: new Set<string>(),
};

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
export const getVersion = () => sim.version;
export function notify() {
  sim.version++;
  for (const l of listeners) l();
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const home = (b: { id: Step }) => cubicle(STEPS.indexOf(b.id));

export function initBots(bots: { id: Step; name: string; role: string }[]) {
  for (const b of bots) {
    if (sim.bots.has(b.id)) continue;
    const c = home(b);
    const persona = PERSONAS[b.id];
    sim.bots.set(b.id, {
      ...b,
      color: persona.color,
      persona,
      pos: [...c.seat],
      rotY: c.seatRot,
      status: "idle",
      carrying: null,
      prop: null,
      pose: "idle",
      seated: true,
      actions: [],
      walking: false,
      idleIn: rand(3, 12),
    });
  }
}

export function say(bot: BotSim, text: string, secs = 3) {
  bot.say = { text, until: sim.clock + secs };
  notify();
}

export const isSeated = (bot: BotSim) => {
  const s = home(bot).seat;
  return bot.seated && !bot.walking && Math.hypot(bot.pos[0] - s[0], bot.pos[2] - s[2]) < 0.05;
};
const atHomeIdle = (b: BotSim) => isSeated(b) && b.actions.length === 0 && b.status === "idle";

// Drop whatever idle thing the bot was doing (coffee, chat…); work actions stay.
function interrupt(bot: BotSim) {
  for (const a of bot.actions) if (a.kind === "convo") endConvo(a.convo, bot.id);
  bot.actions = bot.actions.filter((a) => a.work);
  bot.prop = null;
  bot.pose = "idle";
  for (const k of [...sim.reserved]) if (k.endsWith(`:${bot.id}`)) sim.reserved.delete(k);
}

const goHome = (bot: BotSim, work = false): Action => ({ kind: "go", to: home(bot).seatSpot, work });

// ---------- server events ----------
function folderPlace(s: State): Place | null {
  if (s.approved) return null;
  if (s.gate) return "desk";
  return STEPS.find((st) => s.steps[st] !== "done") ?? "desk";
}

function handoff(e: Extract<OfficeEvent, { type: "handoff" }>) {
  const folder = sim.folders.get(e.project) ?? { color: e.color, topic: "", at: e.from };
  sim.folders.set(e.project, folder);
  if (folder.at === "desk" && e.to !== "desk") {
    // The receiving bot walks to your desk, picks up the folder and carries it back.
    const bot = sim.bots.get(e.to)!;
    interrupt(bot);
    bot.actions.push(
      { kind: "go", to: DESK.spot, work: true, onArrive: () => ((folder.at = "carried"), (bot.carrying = folder.color), notify()) },
      { kind: "go", to: home(bot).traySpot, work: true, onArrive: () => ((folder.at = e.to), (bot.carrying = null), notify()) },
      goHome(bot, true),
    );
    return;
  }
  const bot = sim.bots.get(e.from)!;
  interrupt(bot);
  folder.at = "carried";
  bot.carrying = folder.color;
  const dest = e.to === "desk" ? DESK.spot : home({ id: e.to }).traySpot;
  bot.actions.push(
    {
      kind: "go",
      to: dest,
      work: true,
      onArrive: () => {
        folder.at = e.to;
        bot.carrying = null;
        if (e.to !== "desk") {
          const r = sim.bots.get(e.to)!;
          say(r, pick(r.persona.thanks).replace("{from}", bot.name), 2.6);
        } else say(bot, "On your desk! 📥", 2.4);
        notify();
      },
    },
    goHome(bot, true),
  );
}

export function handle(e: OfficeEvent | ({ type: "snapshot" } & any)) {
  switch (e.type) {
    case "snapshot":
      initBots(e.bots);
      for (const b of e.bots) Object.assign(sim.bots.get(b.id)!, { status: b.status, activity: b.activity, project: b.project });
      sim.projects = new Map(e.projects.map((p: State) => [p.id, p]));
      sim.folders.clear();
      for (const p of e.projects as State[]) {
        const at = folderPlace(p);
        if (at) sim.folders.set(p.id, { color: p.color, topic: p.topic, at });
      }
      sim.chat = e.chat;
      break;
    case "bot": {
      const bot = sim.bots.get(e.bot)!;
      const was = bot.status;
      Object.assign(bot, { status: e.status, activity: e.activity, project: e.project });
      if (e.status === "working" && was !== "working") {
        say(bot, pick(bot.persona.start), 2.6);
        // Called back to work: drop the coffee and head to the desk.
        if (!bot.actions.some((a) => a.work)) {
          interrupt(bot);
          if (!isSeated(bot)) bot.actions.push(goHome(bot, true));
        }
      }
      if (e.status === "failed" && was !== "failed") say(bot, "Uh oh… 😬", 3);
      if (e.status === "idle" && was === "working") bot.idleIn = rand(6, 14);
      break;
    }
    case "project": {
      sim.projects.set(e.state.id, e.state);
      const f = sim.folders.get(e.state.id);
      if (!f) {
        const at = folderPlace(e.state);
        if (at) sim.folders.set(e.state.id, { color: e.state.color, topic: e.state.topic, at });
      } else {
        f.topic = e.state.topic;
        if (e.state.approved) sim.folders.delete(e.state.id);
      }
      break;
    }
    case "handoff":
      handoff(e);
      break;
    case "restored": {
      sim.projects.set(e.state.id, e.state);
      const at = folderPlace(e.state);
      if (at) sim.folders.set(e.state.id, { color: e.state.color, topic: e.state.topic, at });
      sim.chat = [...sim.chat.filter((m) => m.project !== e.state.id), ...e.chat].sort((a, b) => a.ts.localeCompare(b.ts));
      break;
    }
    case "removed":
      sim.projects.delete(e.id);
      sim.folders.delete(e.id);
      sim.chat = sim.chat.filter((m) => m.project !== e.id);
      break;
    case "chat":
      sim.chat.push(e.msg);
      break;
  }
  notify();
}

// ---------- idle life ----------
function reserve(key: string, bot: BotSim) {
  if ([...sim.reserved].some((k) => k.startsWith(`${key}:`))) return false;
  sim.reserved.add(`${key}:${bot.id}`);
  return true;
}
const unreserve = (key: string, bot: BotSim) => sim.reserved.delete(`${key}:${bot.id}`);
const call = (fn: () => void): Action => ({ kind: "call", fn });
const release = (key: string, bot: BotSim) => call(() => unreserve(key, bot));
const pose = (p: Pose, secs: number): Action => ({ kind: "pose", pose: p, secs });
const line = (bot: BotSim, a: Activity, fallback: string) => pick(bot.persona.lines[a] ?? [fallback]);

function chooseActivity(bot: BotSim): Activity {
  const likes = bot.persona.likes;
  const options = (Object.keys(likes) as Activity[]).filter((a) => (likes[a] ?? 0) > 0);
  let r = Math.random() * options.reduce((n, a) => n + likes[a]!, 0);
  return options.find((a) => (r -= likes[a]!) <= 0) ?? "stretch";
}

// Queues one idle activity. Returns false if its spot is taken (the bot just tries again later).
function startActivity(bot: BotSim, choice = chooseActivity(bot)): boolean {
  const A = bot.actions;
  switch (choice) {
    case "coffee":
      if (!reserve("coffee", bot)) return false;
      A.push(
        { kind: "go", to: SPOTS.coffee },
        call(() => ((sim.brewUntil = sim.clock + 2.6), say(bot, line(bot, "coffee", "Coffee time ☕"), 2.8))),
        pose("idle", 2.6),
        call(() => (bot.prop = "mug")),
        release("coffee", bot),
        goHome(bot),
        pose("sip", rand(4, 7)),
        call(() => (bot.prop = null)),
      );
      return true;
    case "snack":
      if (!reserve("snack", bot)) return false;
      A.push({ kind: "go", to: SPOTS.snack }, pose("idle", 1.4), call(() => ((bot.prop = "snack"), say(bot, line(bot, "snack", "Mmm, donut 🍩")))), release("snack", bot));
      if (reserve("stool1", bot)) A.push({ kind: "go", to: SPOTS.stool1 }, pose("eat", rand(4, 6)), release("stool1", bot), call(() => (bot.prop = null)), goHome(bot));
      else A.push(goHome(bot), pose("eat", 4), call(() => (bot.prop = null)));
      return true;
    case "window":
      if (!reserve("window", bot)) return false;
      A.push({ kind: "go", to: SPOTS.window }, call(() => say(bot, line(bot, "window", "Nice day out."), 3.5)), pose("idle", 4.5), release("window", bot), goHome(bot));
      return true;
    case "lounge": {
      const key = reserve("sofa1", bot) ? "sofa1" : null;
      if (!key) return false;
      A.push({ kind: "go", to: SPOTS[key] }, pose("idle", 2.5), call(() => say(bot, line(bot, "lounge", "Ahh, comfy."), 3)), pose("idle", 2), pose("sleep", rand(3, 6)), release(key, bot), goHome(bot));
      return true;
    }
    case "chat": {
      const partner = [...sim.bots.values()].find((b) => b !== bot && atHomeIdle(b));
      if (!partner || !reserve("chat1", bot)) return false;
      if (!reserve("chat2", partner)) return unreserve("chat1", bot), false;
      const lines = pick(CONVOS).map((l) => ({ ...l, text: l.text.replace("{a}", bot.name).replace("{b}", partner.name) }));
      const convo: Convo = { a: bot.id, b: partner.id, lines, i: 0, nextAt: 0, done: false };
      sim.convos.push(convo);
      bot.actions.push({ kind: "go", to: SPOTS.chat1 }, { kind: "convo", convo }, release("chat1", bot), goHome(bot));
      partner.actions.push({ kind: "go", to: SPOTS.chat2 }, { kind: "convo", convo }, release("chat2", partner), goHome(partner));
      partner.idleIn = rand(10, 20);
      return true;
    }
    case "nap":
      A.push(call(() => say(bot, line(bot, "nap", "zzz…"), 3)), pose("sleep", rand(4, 8)));
      return true;
    default:
      A.push(call(() => say(bot, line(bot, "stretch", "*stretches*"), 2.5)), pose("stretch", 2.5));
      return true;
  }
}

function endConvo(c: Convo, leaver?: Step) {
  if (c.done) return;
  c.done = true;
  const other = leaver && sim.bots.get(leaver === c.a ? c.b : c.a);
  if (other) say(other, "Oh, duty calls!", 2);
}

function tickConvos() {
  for (const c of sim.convos) {
    const a = sim.bots.get(c.a)!;
    const b = sim.bots.get(c.b)!;
    const ready = (x: BotSim) => x.actions[0]?.kind === "convo" && (x.actions[0] as { convo: Convo }).convo === c;
    if (c.done || !ready(a) || !ready(b) || sim.clock < c.nextAt) continue;
    if (c.i >= c.lines.length) {
      c.done = true;
      continue;
    }
    const l = c.lines[c.i++];
    say(l.who === "a" ? a : b, l.text, 2.7);
    c.nextAt = sim.clock + 2.9;
  }
  sim.convos = sim.convos.filter((c) => !c.done);
}

// ---------- per-frame update ----------
const SPEED = 3.4;
export function tick(dt: number) {
  sim.clock += dt;
  let changed = false;
  for (const bot of sim.bots.values()) {
    if (bot.say && sim.clock > bot.say.until) {
      bot.say = undefined;
      changed = true;
    }
    const a = bot.actions[0];
    const walking = a?.kind === "go";
    if (bot.walking !== walking) {
      bot.walking = walking;
      changed = true;
    }
    if (!a) {
      bot.pose = bot.status === "working" && isSeated(bot) ? "type" : "idle";
      if (atHomeIdle(bot) && (bot.idleIn -= dt) <= 0) {
        bot.idleIn = rand(10, 24);
        startActivity(bot);
      }
      continue;
    }
    if (a.kind === "call") {
      bot.actions.shift();
      a.fn();
      changed = true;
    } else if (a.kind === "pose") {
      bot.pose = a.pose;
      a.t = (a.t ?? 0) + dt;
      if (a.t >= a.secs) bot.actions.shift();
    } else if (a.kind === "convo") {
      bot.pose = "talk";
      if (a.convo.done) bot.actions.shift();
    } else {
      bot.seated = false;
      bot.pose = "idle";
      a.path ??= pathTo(bot.pos, a.to);
      const target = a.path[0];
      if (!target) {
        bot.actions.shift();
        bot.rotY = a.to.face;
        bot.seated = !!a.to.seated;
        a.onArrive?.();
        changed = true;
        continue;
      }
      const dx = target[0] - bot.pos[0];
      const dz = target[2] - bot.pos[2];
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist <= step) {
        bot.pos = [...target];
        a.path.shift();
      } else {
        bot.pos = [bot.pos[0] + (dx / dist) * step, 0, bot.pos[2] + (dz / dist) * step];
        bot.rotY = Math.atan2(dx, dz);
      }
    }
  }
  tickConvos();
  if (changed) notify();
}
