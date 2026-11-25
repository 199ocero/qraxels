import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job } from "../office.ts";
import { ROOT, dir, list, load, readJson, writeJson, type State } from "../project.ts";
import { EXPLAINED_SECTIONS, ExplainedScript, FactCheck, HISTORY, LABELED, LongScript, SECTIONS, Script, Scenes, chaptersOf, type Scene } from "../schemas.ts";
import { OPUS, SONNET, runClaude } from "../claude.ts";
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
  // Long videos are paced by their chapters instead of one section wave.
  const [schema, order] = state.layout === "mono" ? [Script, SECTIONS] : state.layout === "long" ? [LongScript, null] : [ExplainedScript, EXPLAINED_SECTIONS];
  const write = (fix?: string) =>
    runClaude({
      model: OPUS,
      prompt: fill("script", { topic: state.topic, avoid, angle }, [note, fix].filter(Boolean).join("\n\n") || undefined, ...variantsOf(state)),
      schema: schema.superRefine((x, ctx) => {
        const copied = [...runs(x.beats.map((b) => b.narration).join(" "))].filter((k) => used.has(k));
        if (copied.length) ctx.addIssue({ code: "custom", path: ["beats"], message: `these phrases repeat earlier videos; rewrite those lines with new words: ${copied.map((c) => `"${c}"`).join(", ")}` });
        if (order && !fullWave(x.beats.map((b) => b.section), order)) ctx.addIssue({ code: "custom", path: ["beats"], message: `tag every beat with a section; use all of ${order.join(" → ")} in that order, ending on ${order.at(-1)}` });
      }),
      onActivity: activity,
      signal,
    });
  let s = await write();
  rmSync(dir(state.id, "factcheck.json"), { force: true });
  let checked = "";
  // The calm styles state facts from memory: check each flagged claim on the web; a wrong one goes back to Sky once.
  if (state.layout !== "mono" && s.flagged_claims.length) {
    try {
      let fc = await factCheck(state.topic, s, activity, signal);
      const wrong = fc.claims.filter((c) => c.verdict === "wrong");
      if (wrong.length) {
        activity(`fixing ${wrong.length} wrong claim(s)`);
        s = await write(`A fact check found these claims wrong. Fix every line that uses one: state the correction instead, or cut the claim if it no longer fits:\n${wrong.map((c) => `- "${c.claim}" → ${c.correction ?? "remove it"}`).join("\n")}`);
        fc = s.flagged_claims.length ? await factCheck(state.topic, s, activity, signal) : { claims: [] };
      }
      writeJson(dir(state.id, "factcheck.json"), fc);
      const n = (v: string) => fc.claims.filter((c) => c.verdict === v).length;
      checked = ` Fact check: ${n("confirmed")} confirmed${wrong.length ? `, ${wrong.length} fixed` : ""}${n("unsure") ? `, ${n("unsure")} unsure` : ""}${n("wrong") ? `, ${n("wrong")} STILL WRONG` : ""} (see script.md).`;
    } catch (e) {
      if (signal.aborted) throw e;
      checked = ` The fact check didn't run (${(e as Error).message.slice(0, 80)}), so check the flagged claims yourself.`;
    }
  }
  const secs = writeScript(state.id, s);
  const parts = chaptersOf(s).length ? `, ${chaptersOf(s).length} chapters` : "";
  return `Script "${s.title}" is ready: ~${secs}s, ${s.beats.length} beats${parts}, ${s.flagged_claims.length} claims flagged.${checked}`;
};

// Checks each flagged claim with web search (Sonnet: it's lookup work, not writing).
async function factCheck(topic: string, s: Script, activity: (l: string) => void, signal: AbortSignal): Promise<FactCheck> {
  activity(`checking ${s.flagged_claims.length} facts`);
  return runClaude({
    model: SONNET,
    prompt: fill("factcheck", { topic, claims: s.flagged_claims.map((c, i) => `${i + 1}. ${c}`).join("\n"), script: s.beats.map((b) => b.narration).join(" ") }),
    schema: FactCheck,
    tools: ["WebSearch", "WebFetch"],
    onActivity: activity,
    signal,
  });
}

// The fact check's verdict on a claim, for script.md; a claim edited by hand since then shows as not checked.
function verdictOf(id: string, claim: string): string {
  const f = dir(id, "factcheck.json");
  if (!existsSync(f)) return "";
  const c = readJson<FactCheck>(f).claims.find((x) => x.claim.trim() === claim.trim());
  if (!c) return "[not checked] ";
  const src = c.source ? ` (source: ${c.source})` : "";
  return c.verdict === "confirmed" ? `[confirmed${src}] ` : c.verdict === "unsure" ? `[UNSURE, nothing reliable found${src}] ` : `[WRONG: ${c.correction ?? "no correction given"}${src}] `;
}

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
      ...s.beats.flatMap((b, i) => [
        ...(b.chapter && b.chapter !== s.beats[i - 1]?.chapter ? [`## ${chaptersOf(s).indexOf(b.chapter) + 1}. ${b.chapter}`, ""] : []),
        `${i + 1}. ${b.section ? `[${b.section}] ` : ""}${b.narration}`,
        `   on screen: ${b.visual_idea}`,
        "",
      ]),
      "## Where the analogy breaks down",
      s.analogy_breaks_down,
      "",
      "## Flagged claims (check these)",
      ...(s.flagged_claims.length ? s.flagged_claims.map((c) => `- ${verdictOf(id, c)}${c}`) : ["- none"]),
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

const normShot = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The calm styles show a library picture only once per video and draw everything else from its shot, so no scene is
// the same stock picture with a new label. `shown`: label-only pictures the last videos showed, drawn instead too.
export function calmIssues(scenes: { component: string; shot?: string }[], shown = new Set<string>(), most = 2): string[] {
  const out: string[] = [];
  const shots = scenes.flatMap((s) => (s.shot ? [normShot(s.shot)] : []));
  const dup = shots.filter((x, i) => shots.indexOf(x) !== i);
  if (dup.length) out.push(`these shots repeat; every scene needs its own picture: ${[...new Set(dup)].map((d) => `"${d.slice(0, 60)}"`).join(", ")}`);
  const lib = scenes.filter((s) => !s.shot).map((s) => s.component);
  const again = [...new Set(lib.filter((c, i) => lib.indexOf(c) !== i))];
  if (again.length) out.push(`each library picture at most once; write a shot for the other scenes that use: ${again.join(", ")}`);
  const stale = [...new Set(lib.filter((c) => shown.has(c)))];
  if (stale.length) out.push(`the last videos already showed ${stale.join(", ")}; write a shot for those scenes instead`);
  const counts = new Map<string, number>();
  for (const s of scenes) counts.set(s.component, (counts.get(s.component) ?? 0) + 1);
  const over = [...counts].filter(([, n]) => n > most).map(([c, n]) => `${c} (${n}x)`);
  if (over.length) out.push(`no component more than ${most} times, counting fallbacks: ${over.join(", ")}`);
  return out;
}

// Long videos: each chapter's scenes hold exactly that chapter's narration, in order, so a chapter cuts cleanly into a Short.
export function chapterIssues(s: Script, scenes: { chapter?: number; narration: string }[]): string[] {
  const titles = chaptersOf(s);
  if (scenes.some((x) => !x.chapter || x.chapter > titles.length)) return [`give every scene its chapter number, 1 to ${titles.length}`];
  if (scenes.some((x, i) => i > 0 && x.chapter! < scenes[i - 1].chapter!)) return ["chapter numbers must never go back down"];
  const text = (t: string) => norm(t).join(" ");
  return titles.flatMap((t, k) => {
    const want = text(s.beats.filter((b) => b.chapter === t).map((b) => b.narration).join(" "));
    const got = text(scenes.filter((x) => x.chapter === k + 1).map((x) => x.narration).join(" "));
    return want === got ? [] : [`chapter ${k + 1} ("${t}"): its scenes must hold exactly that chapter's narration, word for word`];
  });
}

// What a chapter repeats from the chapters before it (chapter index → issues); the earlier chapter keeps it.
export function chapterClashes(parts: { component: string; shot?: string }[][], most = 3): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const shots = new Map<string, number>();
  const lib = new Map<string, number>();
  const counts = new Map<string, number>();
  let gym = 0;
  parts.forEach((scenes, k) => {
    const bad = new Set<string>();
    for (const x of scenes) {
      const [seen, key] = x.shot ? [shots, normShot(x.shot)] : [lib, x.component];
      const j = seen.get(key);
      if (j === undefined) seen.set(key, k);
      else if (j !== k) bad.add(x.shot ? `your shot "${x.shot.slice(0, 60)}" repeats one in chapter ${j + 1}; draw a new picture` : `chapter ${j + 1} already shows the library picture ${x.component}; write a shot for that scene instead`);
      const n = (counts.get(x.component) ?? 0) + 1;
      counts.set(x.component, n);
      if (n > most) bad.add(`${x.component} is already used ${most} times in the chapters before yours (counting fallbacks); pick other components`);
      if (GYM.includes(x.component) && ++gym > 2) bad.add(`the video already has 2 workout scenes; no ${x.component}`);
    }
    if (bad.size) out.set(k, [...bad]);
  });
  return out;
}

// Splits a whole-video budget across n chapters as evenly as it goes (6 over 7 → 0,1,1,1,1,1,1).
export const spread = (total: number, n: number) => Array.from({ length: n }, (_, k) => Math.floor(((k + 1) * total) / n) - Math.floor((k * total) / n));

// The chapters as one video: chapter numbers, the hook/payoff/outro, the hit and sfx caps, no camera twice in a row.
export function stitch(parts: Scene[][]): Scene[] {
  const all = parts.flatMap((p, k) => p.map((x) => ({ ...x, chapter: k + 1 })));
  let hits = 0;
  let sfx = 0;
  const out = all.map((x, i) => {
    const y = { ...x };
    const first2 = y.chapter === 2 && all[i - 1]?.chapter === 1;
    y.purpose = i === 0 ? "hook" : first2 ? "payoff" : y.purpose === "setup" ? "setup" : "explain";
    if (y.hit && ++hits > 6) delete y.hit;
    if (y.sfx && ++sfx > 4) delete y.sfx;
    if (i && y.camera && y.camera === all[i - 1].camera) delete y.camera;
    return y;
  });
  const last = out.at(-1)!;
  Object.assign(last, { purpose: "outro", camera: "pull" });
  delete last.hit;
  return out;
}

// Long videos: one director call per chapter, all at once, stitched in order. A chapter that clashes with an
// earlier one (a repeated shot or picture, a component over 3 times) is planned again on its own, seeing the others.
async function longScenes(s: Script, vars: Record<string, string>, pal: ReturnType<typeof paletteFor>, shown: Set<string>, note: string | undefined, activity: (l: string) => void, signal: AbortSignal): Promise<Scenes> {
  const titles = chaptersOf(s);
  const n = titles.length;
  const [hits, sfx] = [spread(6, n), spread(4, n)];
  const said = (k: number) => s.beats.filter((b) => b.chapter === titles[k]).map((b) => b.narration).join(" ");
  const plan = (k: number, fix?: string) => {
    const words = said(k).split(/\s+/).length;
    const part = [
      `You plan ONLY chapter ${k + 1} of ${n}: "${titles[k]}". Other directors plan the other chapters at the same time, so keep to this chapter's budget:`,
      `- Its narration, which your scenes split word for word, in order: ${said(k)}`,
      `- About ${Math.round(words / 20)}–${Math.round(words / 13)} scenes.`,
      `- hit: at most ${hits[k]}. sfx: at most ${sfx[k]}. BigWord: ${k === 0 ? "at most 1" : "none"}. Callout: at most 1.`,
      k === 0 ? "- Its first scene opens the whole video." : "- Its first scene follows another chapter, so it must read without context.",
      k === n - 1 ? "- Its last scene ends the whole video (see the ending rule)." : "- Its last scene ends this chapter, not the video.",
    ].join("\n");
    const feat = pal.featured[k];
    const palette = `This video's look (so it doesn't cut like the last ones):\n${k === 0 ? `- FIRST scene: ${pal.open}\n` : ""}${k === n - 1 ? `- LAST scene: ${pal.close}\n` : ""}${feat ? `- Feature ${feat} in this chapter (as the picture, or the fallback of a drawn scene)\n` : ""}- Workout scenes (${GYM.join(", ")}): at most 1, and only if the line is literally about exercise.\n`;
    return runClaude({
      model: OPUS,
      prompt: fill("scenes", { ...vars, part, palette }, [note, fix].filter(Boolean).join("\n\n") || undefined, "long"),
      schema: Scenes.superRefine((x, ctx) => {
        const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["scenes"], message });
        if (norm(x.scenes.map((y) => y.narration).join(" ")).join(" ") !== norm(said(k)).join(" ")) bad("your scenes must hold exactly this chapter's narration, word for word, in order");
        calmIssues(x.scenes, shown, 3).forEach(bad);
        const c = x.scenes.map((y) => y.component);
        if (k === 0 && c[0] !== pal.open) bad(`the first scene must be ${pal.open}`);
        if (k === n - 1 && c.at(-1) !== pal.close) bad(`the last scene must be ${pal.close}`);
        if (feat && !c.includes(feat as never)) bad(`feature ${feat} in this chapter`);
      }),
      onActivity: (l) => activity(`chapter ${k + 1}: ${l}`),
      signal,
    }).then((r) => r.scenes);
  };
  let done = 0;
  const parts = await Promise.all(titles.map((_, k) => plan(k).finally(() => activity(`planned ${++done} of ${n} chapters`))));
  for (let round = 1; ; round++) {
    const clash = chapterClashes(parts);
    if (!clash.size) break;
    if (round > 2) throw new Error(`the chapters still repeat each other after 2 fixes: ${[...clash].map(([k, m]) => `chapter ${k + 1}: ${m[0]}`).join("; ").slice(0, 500)}`);
    // One at a time, so each fix sees the others' latest plans.
    for (const k of clash.keys()) {
      const now = chapterClashes(parts).get(k);
      if (!now) continue; // an earlier fix this round already cleared it
      activity(`re-planning chapter ${k + 1} (it repeats another chapter)`);
      const others = parts.flatMap((p, j) => (j === k ? [] : p));
      const fix = `Your last plan clashed with the other chapters:\n${now.map((m) => `- ${m}`).join("\n")}\nThe other chapters already use these components: ${[...new Set(others.map((x) => x.component))].join(", ")}.\nTheir shots (don't repeat them):\n${others.flatMap((x) => (x.shot ? [`- ${x.shot.slice(0, 90)}`] : [])).join("\n")}`;
      parts[k] = await plan(k, fix);
    }
  }
  const scenes = stitch(parts);
  // The stitched video must pass the same checks a one-call plan did.
  const issues = [...calmIssues(scenes, shown, 3), ...chapterIssues(s, scenes)];
  if (issues.length) throw new Error(`the stitched plan has problems: ${issues.join("; ").slice(0, 500)}`);
  return { scenes };
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
  const vars = { topic: state.topic, script: JSON.stringify(s, null, 1), palette, components: componentsFor(readFileSync(join(ROOT, "prompts", "components.md"), "utf8"), state.layout), recent: recentText };
  const out = state.layout === "long" ? await longScenes(s, vars, pal, shown, note, activity, signal) : await runClaude({
    model: OPUS,
    prompt: fill("scenes", vars, note, ...variantsOf(state)),
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
