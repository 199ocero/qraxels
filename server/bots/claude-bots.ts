import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job } from "../office.ts";
import { ROOT, dir, list, load, readJson, writeJson, type State } from "../project.ts";
import { EXPLAINED_SECTIONS, ExplainedScript, HISTORY, LABELED, SECTIONS, Script, Scenes } from "../schemas.ts";
import { OPUS, runClaude } from "../claude.ts";
import { rand, seedOf } from "../../remotion/mono.ts";

// prompts/script-mono.md (layout) wins over script.md; review.md has no variant.
export function fill(name: string, vars: Record<string, string>, note?: string, ...variants: string[]): string {
  const vals = { ...vars, note: note ? `\nYou were sent this back with a note. Address it:\n${note}\n` : "" };
  const file = [...variants.map((v) => join(ROOT, "prompts", `${name}-${v}.md`)), join(ROOT, "prompts", `${name}.md`)].find((f) => existsSync(f))!;
  return readFileSync(file, "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => vals[k as keyof typeof vals] ?? "");
}

// Prompt variants to try, in order: "built" videos are calm explainers too, so they fall back to the explained prompts.
const variantsOf = (s: State) => (s.layout === "mono" ? [s.layout] : [s.layout, "explained"]);

// How a "built" video is told; consecutive videos never share one, so the series never runs on one template.
export const BUILT_ANGLES = [
  "THE PROBLEM FIRST: open on the impossible-sounding problem the builders faced, then solve it one obstacle at a time.",
  "FOLLOW ONE PIECE: follow a single stone, beam or part from where it started to where it ended up.",
  "BY THE NUMBERS: three or four striking numbers are the spine; each one is explained, never just listed.",
  "MYTH VS EVIDENCE: start with the popular myth, then show what the evidence actually says and how we know.",
  "THE FOREMAN: walk the viewer through the build as if they were in charge on site, step by step, day by day.",
  "THE CLUE: start from one surviving clue (a mark, a tool, a ruin, a text) and reason outward from it.",
  "WHAT WENT WRONG: the failures, collapses and fixes that taught the builders how to do it.",
  "THEN AND NOW: how it was done then, set against how we would do the same job today.",
] as const;

// The frame a shouted speech is built around; consecutive videos never share one.
export const ANGLES = [
  "COUNTDOWN: the speech counts down from ten to the second they move. Numbers are the spine.",
  "FUTURE SELF: the viewer, ten years older and furious, yelling back through time at today's version.",
  "ROUND 12: they're on the ropes, the fight is almost lost, and you're the corner screaming at them.",
  "THE RECEIPT: read back what today cost them, item by item, like a bill that's come due.",
  "INTERROGATION: rapid-fire questions, each one slammed shut with a two-word answer.",
  "THE RACE: someone their exact age, with their exact start, is already running. Call it like a race commentator.",
  "THE ALARM: the speech IS the alarm that won't stop ringing until they're on their feet.",
  "COUNTED OUT: everyone already bet against them. This is the comeback, told before it happens.",
  "LAST CALL: the door is closing tonight. Every line makes the clock louder.",
  "WAR ROOM: a general giving orders the night before the battle. Short. Tactical. No feelings.",
] as const;

// Projects of the same style before this one, oldest first, that already have a file.
const pastMono = (s: State, file: string) => list().filter((p) => p.id !== s.id && p.layout === s.layout && p.created_at <= s.created_at && existsSync(dir(p.id, file)));
const lines = (s: Script) => s.beats.flatMap((b) => b.narration.split(/(?<=[.!?])\s+/)).filter((l) => l.split(/\s+/).length >= 3);
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
// Every 5-word run in a text (the unit a copied line shows up as).
export const runs = (t: string) => {
  const w = norm(t);
  return new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(" ")));
};

// The speech's wave is complete and in order, ending on its last section (never stopping at its loudest point).
export function fullWave(secs: (string | undefined)[], all: readonly string[] = SECTIONS): boolean {
  const order = secs.map((y) => all.indexOf(y as never));
  return order.every((o, k) => o >= 0 && (!k || o >= order[k - 1])) && all.every((y) => secs.includes(y)) && secs.at(-1) === all.at(-1);
}

export const script: Job = async ({ state, note, activity, signal }) => {
  const past = pastMono(state, "script.json").slice(-8).map((p) => readJson<Script>(dir(p.id, "script.json")));
  const used = new Set(past.flatMap((p) => [...runs(p.beats.map((b) => b.narration).join(" "))]));
  const avoid = past.length ? `Lines from this channel's earlier videos. Do NOT reuse any of them, their structure, or any 5-word run from them; viewers have already heard these:\n${past.flatMap(lines).map((l) => `- ${l}`).join("\n")}\n` : "";
  const n = pastMono(state, "state.json").length;
  const angle = state.layout === "built" ? BUILT_ANGLES[n % BUILT_ANGLES.length] : ANGLES[n % ANGLES.length];
  const [schema, order] = state.layout === "mono" ? [Script, SECTIONS] : [ExplainedScript, EXPLAINED_SECTIONS];
  const s = await runClaude({
    model: OPUS,
    prompt: fill("script", { topic: state.topic, avoid, angle }, note, ...variantsOf(state)),
    schema: schema.superRefine((x, ctx) => {
      const copied = [...runs(x.beats.map((b) => b.narration).join(" "))].filter((k) => used.has(k));
      if (copied.length) ctx.addIssue({ code: "custom", path: ["beats"], message: `these phrases repeat earlier videos; rewrite those lines with new words: ${copied.map((c) => `"${c}"`).join(", ")}` });
      if (!fullWave(x.beats.map((b) => b.section), order)) ctx.addIssue({ code: "custom", path: ["beats"], message: `tag every beat with a section; use all of ${order.join(" → ")} in that order, ending on ${order.at(-1)}` });
    }),
    onActivity: activity,
    signal,
  });
  const secs = writeScript(state.id, s);
  return `Script "${s.title}" is ready: ~${secs}s, ${s.beats.length} beats, ${s.flagged_claims.length} claims flagged.`;
};

// Writes script.json plus the readable script.md; returns the spoken length in seconds.
export function writeScript(id: string, s: Script): number {
  writeJson(dir(id, "script.json"), s);
  const words = s.beats.map((b) => b.narration).join(" ").split(/\s+/).filter(Boolean).length;
  // Measured speaking rates: motivation is read fast, the calm styles at ~2.25 words/s with their pauses.
  const secs = Math.round(words / (load(id).layout === "mono" ? 2.5 : 2.25));
  writeFileSync(
    dir(id, "script.md"),
    [
      `# ${s.title}`,
      "",
      `~${secs}s spoken (${words} words) · analogy: ${s.analogy}`,
      "",
      ...s.beats.flatMap((b, i) => [`${i + 1}. ${b.section ? `[${b.section}] ` : ""}${b.narration}`, `   on screen: ${b.visual_idea}`, ""]),
      "## Where the analogy breaks down",
      s.analogy_breaks_down,
      "",
      "## Flagged claims (check these)",
      ...(s.flagged_claims.length ? s.flagged_claims.map((c) => `- ${c}`) : ["- none"]),
    ].join("\n") + "\n",
  );
  return secs;
}

// Workout scenes all read as the same video; they're capped, and each video gets its own opener, closer and featured set.
export const GYM = ["PullUp", "Lift", "Boxing", "Run", "Pushup", "JumpRope"];
const PICTURES = ["Chart", "Cash", "Plan", "Car", "Phone", "Calendar", "Door", "Bricks", "Traffic", "Rush", "Stage", "Dominoes", "Hourglass", "Scale", "Rocket", "Tree", "Window", "Wheel", "Chains", "Ladder", "Bridge", "Storm", "Mirror", "Jar", "Target", "Bulb", "Battery", "Boulder", "Wallet", "Lock", "Puzzle", "Train", "Bars", "Fork", "Gauge", "Crowd", "Fall", "Split", "Grind", "RainWalk", "Climb", "Summit", "Clock", ...LABELED.filter((c) => !GYM.includes(c) && !(HISTORY as readonly string[]).includes(c))];
const OPENERS = ["Phone", "Wheel", "Wallet", "Calendar", "Traffic", "Chart", "Storm", "Window", "Rush", "Battery", "Cash", "Hourglass", "Train", "Crowd", "Scale", "Mirror", "Clock", "Car", "Fall", "Split", "Plan", "Boulder", "Gauge", "Alarm", "Couch", "Pings", "Cubicle", "Paycheck", "Receipt", "Card", "Iceberg", "Candle", "Fuse", "Grave", "Ages", "Cage", "Fog", "Pit", "Ice", "Lottery", "PunchClock", "Conveyor", "Mask", "Giant", "Bench"];
const CLOSERS = ["Door", "Rocket", "Summit", "Tree", "Car", "Stage", "Target", "Chart", "Chains", "Bulb", "Bricks", "Lock", "Dominoes", "Bars", "Puzzle", "Climb", "Bridge", "Sunrise", "Vault", "Crown", "Trophy", "Podium", "Finish", "Bloom", "Cocoon", "Bird", "Elevator", "Tunnel", "Skyline", "House", "Letter", "Confetti", "Fireworks", "Plane", "Lead", "Compass", "Route", "Stars"];
// n = how many videos came before (consecutive videos never share an opener or closer); seed shuffles the featured set.
export function paletteFor(n: number, seed: number) {
  const open = OPENERS[n % OPENERS.length];
  // On a clash with the opener, jump 3 ahead: still differs from both neighbours' closers.
  const close = CLOSERS[n % CLOSERS.length] !== open ? CLOSERS[n % CLOSERS.length] : CLOSERS[(n + 3) % CLOSERS.length];
  const featured = PICTURES.filter((c) => c !== open && c !== close)
    .map((c, i) => [c, rand(seed, i)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 6)
    .map(([c]) => c);
  return { open, close, featured };
}

// The component list the director sees, trimmed to what suits the style (a smaller prompt, and pictures that fit):
// "built" videos skip the motivation sets, the others skip the history set. Sections run from a header line
// ("Money and work:") to the next one.
const SKIP: Record<string, string[]> = { built: ["Money and work:", "Mind and habits:", "Action and struggle:"], other: ["History and engineering"] };
export function componentsFor(md: string, layout: string): string {
  const skip = SKIP[layout === "built" ? "built" : "other"];
  let drop = false;
  return md
    .split("\n")
    .filter((line) => {
      if (!line.startsWith("- ") && line.trimEnd().endsWith(":")) drop = skip.some((h) => line.startsWith(h));
      return !drop;
    })
    .join("\n");
}

// The calm styles show a library picture only once per video and draw everything else from its shot, so no scene is
// the same stock picture with a new label. `shown`: label-only pictures the last videos showed, drawn instead too.
export function calmIssues(scenes: { component: string; shot?: string }[], shown = new Set<string>()): string[] {
  const out: string[] = [];
  const shots = scenes.flatMap((s) => (s.shot ? [s.shot.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] : []));
  const dup = shots.filter((x, i) => shots.indexOf(x) !== i);
  if (dup.length) out.push(`these shots repeat; every scene needs its own picture: ${[...new Set(dup)].map((d) => `"${d.slice(0, 60)}"`).join(", ")}`);
  const lib = scenes.filter((s) => !s.shot).map((s) => s.component);
  const again = [...new Set(lib.filter((c, i) => lib.indexOf(c) !== i))];
  if (again.length) out.push(`each library picture at most once; write a shot for the other scenes that use: ${again.join(", ")}`);
  const stale = [...new Set(lib.filter((c) => shown.has(c)))];
  if (stale.length) out.push(`the last videos already showed ${stale.join(", ")}; write a shot for those scenes instead`);
  const counts = new Map<string, number>();
  for (const s of scenes) counts.set(s.component, (counts.get(s.component) ?? 0) + 1);
  const over = [...counts].filter(([, n]) => n > 2).map(([c, n]) => `${c} (${n}x)`);
  if (over.length) out.push(`no component more than twice, counting fallbacks: ${over.join(", ")}`);
  return out;
}

export const scenes: Job = async ({ state, note, activity, signal }) => {
  const s = readJson<Script>(dir(state.id, "script.json"));
  const lastPlans = pastMono(state, "scenes.json").slice(-3).map((p) => readJson<Scenes>(dir(p.id, "scenes.json")).scenes);
  const recent = lastPlans.map((x) => `- ${x.map((y) => y.component).join(" → ")}`);
  // Label-only pictures (the same drawing every time) the last videos put on screen; scenes with data props differ each time.
  const shown = new Set(lastPlans.flat().filter((y) => !y.shot && (LABELED as readonly string[]).includes(y.component)).map((y) => y.component));
  const calm = state.layout !== "mono";
  const recentText = [recent.length ? `Scene orders of the last videos (don't follow the same order):\n${recent.join("\n")}\n` : "", calm && shown.size ? `Shown in the last videos (draw these moments instead): ${[...shown].join(", ")}\n` : ""].join("");
  // A "built" video's pictures come from its subject (the structure, its parts and tools), never a fixed rotation.
  const built = state.layout === "built";
  const pal = paletteFor(pastMono(state, "state.json").length, seedOf(state.id));
  const palette = built
    ? `This video's look: open on the structure or object itself and end on it finished or still standing. Prefer the history and engineering pictures; use a Timeline when the script moves through dates. Workout scenes (${GYM.join(", ")}): none.\n`
    : `This video's look (so it doesn't cut like the last ones):\n- FIRST scene: ${pal.open}\n- LAST scene: ${pal.close}\n- Feature at least 4 of: ${pal.featured.join(", ")}\n- Workout scenes (${GYM.join(", ")}): at most 2 in the whole video.\n`;
  const out = await runClaude({
    model: OPUS,
    prompt: fill("scenes", { topic: state.topic, script: JSON.stringify(s, null, 1), palette, components: componentsFor(readFileSync(join(ROOT, "prompts", "components.md"), "utf8"), state.layout), recent: recentText }, note, ...variantsOf(state)),
    schema: Scenes.superRefine((x, ctx) => {
      const c = x.scenes.map((y) => y.component);
      const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["scenes"], message });
      if (calm) calmIssues(x.scenes, shown).forEach(bad);
      if (built) {
        if (c.some((y) => GYM.includes(y))) bad(`no workout scenes (${GYM.join(", ")})`);
        return;
      }
      if (c[0] !== pal.open) bad(`the first scene must be ${pal.open}`);
      if (c.at(-1) !== pal.close) bad(`the last scene must be ${pal.close}`);
      if (c.filter((y) => GYM.includes(y)).length > 2) bad(`at most 2 workout scenes (${GYM.join(", ")}) in total`);
      if (pal.featured.filter((y) => c.includes(y as never)).length < 4) bad(`use at least 4 of: ${pal.featured.join(", ")}`);
    }),
    onActivity: activity,
    signal,
  });
  writeJson(dir(state.id, "scenes.json"), out);
  // A new plan means new shots: drop the last plan's drawings so Bolt draws them again.
  rmSync(dir(state.id, "draw"), { recursive: true, force: true });
  const kinds = new Set(out.scenes.map((x) => x.component)).size;
  const [first, last] = [out.scenes[0].component, out.scenes.at(-1)!.component];
  return `Planned ${out.scenes.length} scenes using ${kinds} kinds of visuals, opening on ${first} and ending on ${last}.`;
};
