// ?demo: a fake office that plays the handoff animation without running Claude.
import type { State, Step } from "../server/project.ts";
import { handle, STEPS } from "./sim.ts";

export const isDemo = new URLSearchParams(location.search).has("demo");

const BOTS = [
  { id: "script", name: "Sky", role: "Scriptwriter" },
  { id: "scenes", name: "Dot", role: "Director" },
  { id: "voice", name: "Nova", role: "Narrator" },
  { id: "build", name: "Bolt", role: "Builder" },
  { id: "render", name: "Ray", role: "Renderer" },
] as const;
const ACTIVITY: Record<Step, string[]> = {
  script: ["drafting the hook", "writing beat 4 of 8", "where the analogy breaks down"],
  scenes: ["picking components", "Climb for the routine", "pacing: change every 3s"],
  voice: ["synthesising scene 3", "word timestamps", "adding pauses"],
  build: ["rendering stills", "looking at scene-04.png", "text fits the safe area"],
  render: ["rendering 12%", "rendering 58%", "rendering 96%"],
};
const COLORS = ["#ff8a3d", "#3dd6ff", "#b77dff", "#5be37d"];
const projects = new Map<string, State>();
const name = (s: Step) => BOTS.find((b) => b.id === s)!.name;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function say(from: string, text: string, project: string, gate?: "script" | "video") {
  handle({ type: "chat", msg: { ts: new Date().toISOString(), from, text, project, gate } });
}
function update(p: State) {
  p.updated_at = new Date().toISOString();
  handle({ type: "project", state: structuredClone(p) });
}

async function run(p: State, step: Step) {
  await wait(3500);
  p.steps[step] = "working";
  update(p);
  for (const a of ACTIVITY[step]) {
    handle({ type: "bot", bot: step, status: "working", project: p.id, activity: a });
    await wait(1600);
  }
  p.steps[step] = "done";
  handle({ type: "bot", bot: step, status: "idle" });
  const i = STEPS.indexOf(step);
  if (step === "script" || step === "render") {
    p.gate = step === "script" ? "script" : "video";
    update(p);
    handle({ type: "handoff", from: step, to: "desk", project: p.id, color: p.color });
    say(name(step), "Done. It's on your desk for review.", p.id, p.gate);
  } else {
    update(p);
    handle({ type: "handoff", from: step, to: STEPS[i + 1], project: p.id, color: p.color });
    say(name(step), `Done. Handing it to ${name(STEPS[i + 1])}.`, p.id);
    run(p, STEPS[i + 1]);
  }
}

export async function demoApi(action: string, body: Record<string, unknown>) {
  const p = projects.get(String(body.id));
  if (action === "topic") {
    const ts = new Date().toISOString();
    const s: State = {
      id: `demo-${projects.size + 1}`,
      topic: String(body.topic),
      layout: "mono",
      color: COLORS[projects.size % COLORS.length],
      steps: Object.fromEntries(STEPS.map((x) => [x, "pending"])) as State["steps"],
      gate: null,
      approved: false,
      notes: {},
      created_at: ts,
      updated_at: ts,
    };
    projects.set(s.id, s);
    update(s);
    say("You", s.topic, s.id);
    say("Sky", `On it! Writing "${s.topic}".`, s.id);
    run(s, "script");
    return s;
  } else if (action === "approve" && p) {
    if (p.gate === "script") {
      p.gate = null;
      update(p);
      say("You", "Script approved.", p.id);
      handle({ type: "handoff", from: "script", to: "scenes", project: p.id, color: p.color });
      run(p, "scenes");
    } else {
      p.gate = null;
      p.approved = true;
      update(p);
      say("Ray", `Final video saved at projects/${p.id}/out.mp4 — ready to post.`, p.id);
    }
  } else if (action === "reject" && p) {
    const to = body.to as Step;
    p.gate = null;
    update(p);
    say("You", `Back to ${name(to)}: ${body.note}`, p.id);
    handle({ type: "handoff", from: to, to, project: p.id, color: p.color });
    run(p, to);
  } else if ((action === "archive" || action === "delete") && p) {
    projects.delete(p.id);
    handle({ type: "removed", id: p.id });
  } else if (action === "redo" && p) {
    const step = body.step as Step;
    for (const st of STEPS.slice(STEPS.indexOf(step))) p.steps[st] = "pending";
    p.gate = null;
    p.approved = false;
    update(p);
    say("You", `Redo from ${name(step)}.`, p.id);
    handle({ type: "handoff", from: step, to: step, project: p.id, color: p.color });
    run(p, step);
  }
  return { ok: true };
}

export function startDemo() {
  handle({ type: "snapshot", bots: BOTS.map((b) => ({ ...b, status: "idle" })), projects: [], chat: [] });
  demoApi("topic", { topic: "What happens when you type a URL" });
}
