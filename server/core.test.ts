import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

process.env.VID_PROJECTS_DIR = mkdtempSync(join(tmpdir(), "qraxels-test-"));
const P = await import("./project.ts");
const { runClaude, claudeEnv, activityOf } = await import("./claude.ts");
const { Office } = await import("./office.ts");
const { Script, Scenes, LABELED } = await import("./schemas.ts");
const { z } = await import("zod");

test("project create/save roundtrip, unique ids, always mono, atomic write", () => {
  const a = P.create("What happens when you type a URL?");
  const b = P.create("What happens when you type a URL?");
  assert.match(a.id, /^\d{8}-what-happens-when-you-type-a-url$/);
  assert.equal(b.id, `${a.id}-2`);
  assert.equal(a.layout, "mono");
  a.steps.script = "done";
  P.save(a);
  assert.equal(P.load(a.id).steps.script, "done");
  assert.deepEqual(readdirSync(P.dir(a.id)).filter((f) => f.endsWith(".tmp")), []);
});

test("schemas accept valid output and reject bad output", () => {
  const script = {
    title: "What happens when you type a URL",
    hook: "You press enter. 100 milliseconds later, a page appears.",
    analogy: "A letter travelling through a city",
    analogy_breaks_down: "Real packets take many routes at once.",
    beats: Array(11).fill({ narration: Array(25).fill("word").join(" "), visual_idea: "y" }),
    flagged_claims: [],
    estimated_seconds: 75,
  };
  assert.ok(Script.safeParse(script).success);
  assert.ok(!Script.safeParse({ ...script, estimated_seconds: 30 }).success);
  const long = { ...script, beats: Array(14).fill(script.beats[0]) }; // 350 words, over 2 min
  assert.match(JSON.stringify(Script.safeParse(long).error?.issues), /350 words/);
  const scene = { purpose: "hook", narration: "Hi", component: "HookCard", props: { title: "Hi" } };
  const parsed = Scenes.parse({ scenes: Array(5).fill(scene) });
  assert.equal(parsed.scenes[0].speed, 1);
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ ...scene, component: "Teleporter" }) }).success);
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ ...scene, props: { lines: ["a"] } }) }).success);
});

test("every label-only picture is described to the director and parses with or without a label", async () => {
  const { readFileSync } = await import("node:fs");
  const md = readFileSync(join(P.ROOT, "prompts", "components.md"), "utf8");
  assert.equal(new Set(LABELED).size, LABELED.length);
  for (const c of LABELED) {
    assert.match(md, new RegExp(`^- ${c}:`, "m"), `${c} missing from prompts/components.md`);
    const scene = { purpose: "explain", narration: "Hi", component: c };
    assert.ok(Scenes.safeParse({ scenes: Array(5).fill({ ...scene, props: {} }) }).success, c);
    assert.ok(Scenes.safeParse({ scenes: Array(5).fill({ ...scene, props: { label: "DAY 1" } }) }).success, c);
  }
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ purpose: "explain", narration: "Hi", component: "Piggy", props: { label: "X".repeat(17) } }) }).success);
});

test("every label-only picture has its sounds, and every sound file exists", async () => {
  const { existsSync } = await import("node:fs");
  const { BEATS, SFX, sfxCues } = await import("../remotion/mono.ts");
  for (const c of LABELED) assert.ok(BEATS[c]?.length, `${c} has no BEATS`);
  for (const src of Object.values(SFX).filter((x) => x.startsWith("sfx/"))) assert.ok(existsSync(join(P.ROOT, "public", src)), src);
  // A boom lands on the hit word; quiet contact sounds stay inside the scene.
  const scenes = [{ purpose: "hook", component: "Crowd", start: 0, end: 3 }, { purpose: "payoff", component: "Door", start: 3, end: 6 }, { purpose: "explain", component: "Breakthrough", start: 6, end: 10, hit: "wall" }, { purpose: "outro", component: "Summit", start: 10, end: 13 }];
  const words = [{ word: "through", start: 8, end: 8.3, scene: 2 }, { word: "wall.", start: 8.6, end: 9, scene: 2 }];
  const cues = sfxCues(scenes as never, words);
  assert.ok(cues.some((c) => c.src === SFX.impact && Math.abs(c.at + 0.213 - 8.6) < 1e-6), "impact peaks on the hit word");
  assert.ok(cues.filter((c) => c.src === SFX.knock).every((c) => c.at >= 6 && c.at < 10), "footsteps stay in the scene");
});

test("built style: its own script prompt with a rotating structure, the explained scenes prompt, a calm render", async () => {
  const { readFileSync } = await import("node:fs");
  const { fill, BUILT_ANGLES } = await import("./bots/claude-bots.ts");
  const { propsOf } = await import("./bots/remotion.ts");
  const b = P.create("How were the pyramids built?", new Date(), "built");
  assert.equal(b.layout, "built");
  const script = fill("script", { angle: BUILT_ANGLES[0] }, undefined, "built", "explained");
  assert.match(script, /How was it built/);
  assert.ok(script.includes(BUILT_ANGLES[0]));
  assert.match(fill("scenes", {}, undefined, "built", "explained"), /director of a calm explainer/);
  assert.equal(propsOf({ scenes: [], words: [], audio: [] }, b.id, [], "built").calm, true);
  const tl = { purpose: "explain", narration: "Hi", component: "Timeline", props: { events: [{ year: "2560 BC", label: "GREAT PYRAMID" }, { year: "AD 1311", label: "OVERTAKEN" }] } };
  assert.ok(Scenes.safeParse({ scenes: Array(5).fill(tl) }).success);
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ ...tl, props: { events: [tl.props.events[0]] } }) }).success, "a timeline needs 2+ dates");
  assert.match(readFileSync(join(P.ROOT, "prompts", "components.md"), "utf8"), /^- Timeline \{/m);
  const { componentsFor } = await import("./bots/claude-bots.ts");
  const md = readFileSync(join(P.ROOT, "prompts", "components.md"), "utf8");
  const [forBuilt, forMono] = [componentsFor(md, "built"), componentsFor(md, "mono")];
  const check = (text: string, has: string[], lacks: string[]) => {
    for (const h of has) assert.ok(text.includes(h), `has ${h}`);
    for (const l of lacks) assert.ok(!text.includes(l), `lacks ${l}`);
  };
  check(forBuilt, ["- Giza:", "- Timeline {", "- Sunrise:", "- Chart {", "- BigWord {"], ["- Piggy:", "- Brain:", "- Sword:"]);
  check(forMono, ["- Piggy:", "- Sword:", "- Sunrise:", "- BigWord {"], ["- Giza:", "- Timeline {", "- Lidar:"]);
  assert.ok(forBuilt.length < md.length * 0.8 && forMono.length < md.length * 0.8, "each style's list is well under the full one");
  const ht = { purpose: "explain", narration: "Hi", component: "Heights", props: { items: [{ name: "PYRAMID", meters: 146 }, { name: "LIBERTY", meters: 93 }] } };
  assert.ok(Scenes.safeParse({ scenes: Array(5).fill(ht) }).success);
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ ...ht, props: { items: [{ name: "X", meters: -1 }, { name: "Y", meters: 2 }] } }) }).success, "heights are positive");
});

test("claude env strips API credentials", () => {
  const env = claudeEnv({ ANTHROPIC_API_KEY: "sk", ANTHROPIC_AUTH_TOKEN: "t", PATH: "/bin" });
  assert.deepEqual(env, { PATH: "/bin" });
});

test("activity lines come from tool use", () => {
  const ev = { type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch", input: { query: "TLS handshake" } }] } };
  assert.equal(activityOf(ev), "searching: TLS handshake");
});

const STALL = Symbol("stall");
function fakeSpawn(outputs: unknown[]) {
  const calls: { args: string[]; env: NodeJS.ProcessEnv; stdin: string }[] = [];
  const fn = ((_: string, args: string[], opts: any) => {
    const child: any = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    const call = { args, env: opts.env, stdin: "" };
    calls.push(call);
    child.stdin.on("data", (d: Buffer) => (call.stdin += d));
    const out = outputs[calls.length - 1];
    child.kill = () => child.emit("close", null);
    if (out === STALL) return child;
    setImmediate(() => {
      child.stdout.end(JSON.stringify({ type: "result", is_error: false, structured_output: out }) + "\n");
      child.stdout.on("close", () => child.emit("close", 0));
    });
    return child;
  }) as any;
  return { fn, calls };
}

const Name = z.object({ name: z.string() });

test("runClaude retries once with the validation error, then succeeds", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-should-not-leak";
  const { fn, calls } = fakeSpawn([{ nope: 1 }, { name: "bot" }]);
  const out = await runClaude({ prompt: "give name", schema: Name, spawn: fn });
  assert.deepEqual(out, { name: "bot" });
  assert.equal(calls.length, 2);
  assert.match(calls[1].stdin, /previous answer was invalid/i);
  assert.equal(calls[0].env.ANTHROPIC_API_KEY, undefined);
  const schemaArg = calls[0].args[calls[0].args.indexOf("--json-schema") + 1];
  assert.equal(JSON.parse(schemaArg).$schema, undefined, "claude's validator rejects the 2020-12 $schema URI");
  delete process.env.ANTHROPIC_API_KEY;
});

test("runClaude retries a stalled claude once, then gives up", async () => {
  const ok = fakeSpawn([STALL, { name: "bot" }]);
  assert.deepEqual(await runClaude({ prompt: "x", schema: Name, spawn: ok.fn, timeoutMs: 20 }), { name: "bot" });
  const dead = fakeSpawn([STALL, STALL]);
  await assert.rejects(runClaude({ prompt: "x", schema: Name, spawn: dead.fn, timeoutMs: 20 }), /timed out/);
  assert.equal(dead.calls.length, 2);
});

test("runClaude fails after the second invalid answer", async () => {
  const { fn, calls } = fakeSpawn([{ nope: 1 }, { nope: 2 }]);
  await assert.rejects(runClaude({ prompt: "x", schema: Name, spawn: fn }), /validation twice/);
  assert.equal(calls.length, 2);
});

test("office hands work along the pipeline and stops at both gates", async () => {
  const order: string[] = [];
  const job = (step: string) => async ({ state }: any) => (order.push(`${step}:${state.id}`), `${step} done.`);
  const office = new Office(Object.fromEntries(P.STEPS.map((s) => [s, job(s)])) as any, 0);
  const waitGate = (g: string) =>
    new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === g && r()));

  const s = office.newTopic("How a QR code works");
  await waitGate("script");
  assert.deepEqual(order, [`script:${s.id}`]);

  office.reject(s.id, "shorter hook");
  assert.equal(P.load(s.id).notes.script, "shorter hook");
  await waitGate("script");
  assert.equal(order.at(-1), `script:${s.id}`);

  office.approve(s.id);
  await waitGate("video");
  assert.deepEqual(order.slice(2).map((o) => o.split(":")[0]), ["scenes", "voice", "build", "render"]);

  office.approve(s.id);
  const done = P.load(s.id);
  assert.equal(done.approved, true);
  assert.ok(Object.values(done.steps).every((v) => v === "done"));
  assert.ok(P.chatHistory().some((m) => m.text.includes("out.mp4")));
});

test("thumbnails and Shorts killed by a restart run again on resume, then the flag clears", async () => {
  const jobs = Object.fromEntries(P.STEPS.map((s) => [s, async () => "ok."])) as any;
  const s = P.save({ ...P.create("Restart mid-Shorts"), gate: "video", steps: Object.fromEntries(P.STEPS.map((st) => [st, "done"])) as any });
  new Office(jobs, 0, () => new Promise(() => {})).approve(s.id); // the server dies before it finishes
  assert.equal(P.load(s.id).afterPending, true);
  let ran = 0;
  const office = new Office(jobs, 0, async () => (ran++, "Shorts done."));
  const said = new Promise<void>((r) => office.on("event", (e: any) => e.type === "chat" && e.msg.text === "Shorts done." && r()));
  office.resume();
  await said;
  assert.equal(ran, 1);
  assert.equal(P.load(s.id).afterPending, undefined);
});

test("a failed job marks the step failed and retry re-runs it", async () => {
  let fail = true;
  const jobs = Object.fromEntries(P.STEPS.map((s) => [s, async () => "ok."])) as any;
  jobs.script = async () => {
    if (fail) throw new Error("boom");
    return "ok.";
  };
  const office = new Office(jobs, 0);
  const failed = new Promise<void>((r) => office.on("event", (e: any) => e.type === "bot" && e.status === "failed" && r()));
  const s = office.newTopic("Cache");
  await failed;
  assert.equal(P.load(s.id).steps.script, "failed");
  fail = false;
  const gated = new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === "script" && r()));
  office.retry(s.id);
  await gated;
});

test("redo from any step, keeps the old video, refuses while busy; archive moves the folder", async () => {
  const { existsSync, writeFileSync, readdirSync } = await import("node:fs");
  const order: string[] = [];
  let release: () => void = () => {};
  const jobs = Object.fromEntries(P.STEPS.map((s) => [s, async () => (order.push(s), "ok.")])) as any;
  const office = new Office(jobs, 0);
  const gate = (g: string) => new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === g && r()));

  const s = office.newTopic("Race condition");
  await gate("script");
  office.approve(s.id);
  await gate("video");
  office.approve(s.id);
  writeFileSync(P.dir(s.id, "out.mp4"), "v1");

  // Redo an approved video from the Narrator: earlier steps stay, old video is kept.
  order.length = 0;
  office.redo(s.id, "voice", "slower please");
  assert.equal(P.load(s.id).notes.voice, "slower please");
  await gate("video");
  assert.deepEqual(order, ["voice", "build", "render"]);
  assert.ok(readdirSync(P.dir(s.id)).some((f) => /^out-.*\.mp4$/.test(f)));

  // Change music: only the render step runs again, with the pick saved on the project; unknown files are refused.
  order.length = 0;
  assert.throws(() => office.music(s.id, "../../etc/passwd"), /no \.\.\/\.\.\/etc\/passwd in the music folder/);
  office.music(s.id, "off");
  assert.equal(P.load(s.id).music, "off");
  await gate("video");
  assert.deepEqual(order, ["render"]);
  office.music(s.id);
  assert.equal(P.load(s.id).music, undefined);
  await gate("video");

  // Can't redo from a step whose inputs aren't done.
  const t = office.newTopic("Queue");
  await gate("script");
  assert.throws(() => office.redo(t.id, "scenes"), /approve the script first/);
  assert.throws(() => office.redo(t.id, "voice"), /approve the script first/);

  // Refuses while a bot is mid-job on that project.
  jobs.script = () => new Promise<string>((r) => (release = () => r("ok.")));
  const u = office.newTopic("Mutex");
  await new Promise((r) => setTimeout(r, 10));
  assert.throws(() => office.redo(u.id, "script"), /working on it/);
  assert.throws(() => office.archive(u.id), /working on it/);
  release();
  await gate("script");

  office.archive(u.id);
  assert.ok(!existsSync(P.dir(u.id)));
  assert.ok(existsSync(join(P.PROJECTS, "_archive", u.id, "state.json")));
  assert.ok(!P.list().some((p) => p.id === u.id));
  assert.ok(P.listArchived().some((p) => p.id === u.id));

  // Restore brings it back with its chat history and it's still waiting at the script gate.
  const restored = new Promise<any>((r) => office.on("event", (e: any) => e.type === "restored" && r(e)));
  office.restore(u.id);
  const ev = await restored;
  assert.equal(ev.state.gate, "script");
  assert.ok(ev.chat.some((m: any) => m.text.includes("Brought this back")));
  assert.ok(P.list().some((p) => p.id === u.id));
  assert.ok(!P.listArchived().some((p) => p.id === u.id));
  assert.throws(() => office.restore(u.id), /no such archived project/);
  assert.throws(() => office.restore("../etc"), /no such archived project/);
});

test("a stale handoff can't run a step twice after a redo", async () => {
  const order: string[] = [];
  const jobs = Object.fromEntries(P.STEPS.map((s) => [s, async () => (order.push(s), "ok.")])) as any;
  const office = new Office(jobs, 30); // the script→scenes handoff timer is still pending when we redo
  const s = office.newTopic("Cache stampede");
  await new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === "script" && r()));
  office.approve(s.id);
  office.redo(s.id, "script");
  await new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === "script" && r()));
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(order, ["script", "script"]);
});

test("hand-edited scripts are only accepted at the script gate", async () => {
  const office = new Office(Object.fromEntries(P.STEPS.map((s) => [s, async () => "ok."])) as any, 0);
  const s = office.newTopic("DNS");
  await new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === "script" && r()));
  let wrote = false;
  office.saveScript(s.id, () => (wrote = true));
  assert.ok(wrote);
  office.approve(s.id);
  assert.throws(() => office.saveScript(s.id, () => {}), /on your desk/);
});

test("motivation style: mono projects, sound cues on earshot peaks, drop-aligned music, beat pulses, music library, schemas", async () => {
  const { sfxCues, censor, musicFor, musicPieces, dropAt, pulseAt, hitTimes, cameraFor, SFX } = await import("../remotion/mono.ts");
  type Track = import("../remotion/mono.ts").Track;
  const { musicLibrary } = await import("./music.ts");
  const m = P.create("Nobody is coming to save you");
  assert.equal(m.layout, "mono");
  const { fill } = await import("./bots/claude-bots.ts");
  assert.match(fill("script", {}, undefined, m.layout), /motivational channel/);

  const scenes = [
    { purpose: "hook", component: "Crowd", start: 0, end: 3 },
    { purpose: "explain", component: "Grind", start: 3, end: 8, props: { stat: { label: "NET WORTH", to: 5 } }, hit: "work" },
    { purpose: "payoff", component: "BigWord", start: 8, end: 11 },
    { purpose: "explain", component: "Boxing", start: 11, end: 12.5, sfx: "crowd" },
  ];
  const words = [
    { word: "Do", start: 3.2, end: 3.4, scene: 1 },
    { word: "the", start: 3.4, end: 3.5, scene: 1 },
    { word: "work.", start: 3.6, end: 3.9, scene: 1 },
  ];
  assert.equal(dropAt(scenes), 8);
  const cues = sfxCues(scenes, words);
  // Each take is placed so its measured peak lands on the moment: cue.at + peak = moment.
  const at = (src: string) => cues.filter((c) => c.src === src).map((c) => +c.at.toFixed(3));
  assert.deepEqual(at(SFX.riser), [+(8 - 1.202).toFixed(3)]); // peaks on the drop
  assert.ok(at(SFX.sub).includes(+(8 - 0.274).toFixed(3))); // the drop's sub, stacked with the riser (same moment)
  assert.deepEqual(at(SFX.punch), [11.142, 11.742, 12.342]); // Boxing's synced punches; the hit word itself stays silent
  assert.deepEqual(at(SFX.typing), [3]); // Grind's ambience
  assert.equal(cues.find((c) => c.src === SFX.crowd)?.dur, 1.5);
  // Accents keep the reference edits' restraint: different moments at least 2.5 s apart.
  const accentSrcs = [SFX.pop, SFX.ding, SFX.sub, SFX.riser, SFX.whoosh, SFX.coins];
  const peaks = cues.filter((c) => accentSrcs.includes(c.src)).map((c) => c.at + ({ [SFX.sub]: 0.274, [SFX.riser]: 1.202, [SFX.whoosh]: 0.116 }[c.src] ?? 0.004));
  const moments = [...new Set(peaks.map((p) => p.toFixed(2)))].map(Number).sort((a, b) => a - b);
  moments.forEach((t, i) => i && assert.ok(t - moments[i - 1] >= 2.5 - 1e-9, `accents at ${moments[i - 1]} and ${t}`));
  // The counter's start pop (3.15) loses to nothing near it; its landing ding (3 + 5*0.8 = 7) is within 1.2 s of the drop and loses.
  assert.ok(peaks.some((p) => Math.abs(p - 3.15) < 0.01) && !peaks.some((p) => Math.abs(p - 7) < 0.01));
  // Bass-heavy music sits 3 dB under the voice while it speaks, more for a track busy in the voice's range.
  const { musicGains, VOICE_LEVEL } = await import("../remotion/mono.ts");
  const under = (t: Partial<Track>) => 20 * Math.log10(musicGains({ src: "", drop: null, bpm: 90, downbeat: 0, pulseEvery: 1, duration: 60, ...t }).under) + (t.level ?? -14);
  assert.ok(Math.abs(under({ level: -10, mid: -7.5 }) - (VOICE_LEVEL - 3)) < 1e-9);
  assert.ok(under({ level: -10, mid: -4.5 }) < VOICE_LEVEL - 6.5);
  assert.deepEqual(hitTimes(scenes, words), [3.6, 8]);
  // A quiet line's own effects drop with it (Boxing's punches at -3 dB when the line is "low").
  const quietCues = sfxCues(scenes.map((x) => (x.component === "Boxing" ? { ...x, energy: "low" } : x)), words);
  assert.ok(Math.abs(quietCues.filter((c) => c.src === SFX.punch)[0].volume - 0.18 * 10 ** (-3 / 20)) < 1e-9);
  // Music wave: soft before the drop (8 s), full after; with a later payoff, eased down for the scenes after it.
  const { musicWave } = await import("../remotion/mono.ts");
  assert.deepEqual(musicWave(scenes), [[7.7, 8], [0.55, 1]]); // one payoff: full from the drop to the end
  const waved = [...scenes, { purpose: "payoff", component: "Chart", start: 12.5, end: 14 }, { purpose: "outro", component: "Door", start: 14, end: 17 }];
  assert.deepEqual(musicWave(waved), [[7.7, 8, 14, 14.8], [0.55, 1, 1, 0.6]]); // turn at 8, peak, landing from 14
  assert.notEqual(cameraFor(1, scenes[1]), cameraFor(2, scenes[2]));

  // Music plays its loud part (from the drop) from frame 0 and repeats it; pieces cover 0..end back to back.
  const tr = { src: "a.mp3", drop: 2.58 + 18 * (240 / 93), bpm: 93, downbeat: 2.58, pulseEvery: 1, duration: 101 };
  for (const t of [tr, { ...tr, drop: null }, { ...tr, duration: 40, drop: 39.5 }]) {
    const pieces = musicPieces(t, 80);
    assert.deepEqual([pieces[0].at, pieces[0].from], [0, t.drop !== null && t.duration - t.drop > 1 ? t.drop : 0], String(t.drop));
    pieces.forEach((p, i) => i && assert.ok(Math.abs(p.at - (pieces[i - 1].at + pieces[i - 1].dur)) < 1e-9));
    assert.ok(Math.abs(pieces.at(-1)!.at + pieces.at(-1)!.dur - 80) < 1e-9);
    assert.ok(pieces.every((p) => p.from + p.dur <= t.duration + 1e-9));
  }
  assert.equal(musicFor(m.id, []), undefined);
  assert.equal(musicFor(m.id, [tr])?.src, "a.mp3");
  // The drop sits on a bar line, so video t = k beats is on the grid: bar pulses before the video's drop (30 s), every beat after.
  const beat = 60 / tr.bpm;
  assert.ok(Math.abs(pulseAt(tr, 30, 20 * beat).k - 0.4) < 1e-6 && pulseAt(tr, 30, 21 * beat + 0.001).k < 0.05);
  assert.ok(pulseAt(tr, 30, 60 * beat).k > 0.99 && pulseAt(tr, 30, 60 * beat).down && pulseAt(tr, 30, 61 * beat).k > 0.99);
  assert.ok(pulseAt(tr, 30, 60.5 * beat).k < 0.1);

  // The music folder: new files are analyzed once, cached by size + mtime; MONO_MUSIC picks or turns it off.
  const dir = mkdtempSync(join(tmpdir(), "qraxels-music-"));
  writeFileSync(join(dir, "one.mp3"), "x");
  writeFileSync(join(dir, "notes.txt"), "not music");
  writeFileSync(join(dir, "credits.json"), JSON.stringify({ "one.mp3": "Song by Someone, CC BY 4.0" }));
  let runs = 0;
  const run = async (args: string[]) => {
    runs++;
    assert.ok(args.at(-1)!.endsWith("one.mp3"));
    return JSON.stringify([{ file: args.at(-1), bpm: 140, downbeat: 0.5, drop: 20.1, duration: 95, level: -9, mid: -7, start: 30.5 }]);
  };
  const lib = await musicLibrary(run, dir, undefined);
  assert.deepEqual(lib, [{ src: "sound/music/one.mp3", drop: 20.1, bpm: 140, downbeat: 0.5, duration: 95, start: 30.5, level: -9, mid: -7, pulseEvery: 2, credit: "Song by Someone, CC BY 4.0" }]);
  await musicLibrary(run, dir, "auto");
  assert.equal(runs, 1);
  // A crushed master (loud part above -8 dBFS RMS) is left out of the rotation, but can still be picked by name.
  writeFileSync(join(dir, "loud.mp3"), "xx");
  const loud = async (args: string[]) => JSON.stringify([{ file: args.at(-1), bpm: 96, downbeat: 0.9, drop: 10.9, duration: 51, level: -6.7, mid: -6.4, start: 23.4 }]);
  assert.deepEqual((await musicLibrary(loud, dir, undefined)).map((t) => t.src), ["sound/music/one.mp3"]);
  assert.equal((await musicLibrary(loud, dir, "loud.mp3"))[0].src, "sound/music/loud.mp3");
  assert.deepEqual(await musicLibrary(run, dir, "off"), []);
  await assert.rejects(musicLibrary(run, dir, "missing.mp3"), /no such file/);
  assert.equal((await musicLibrary(run, dir, undefined, "sound/music/calm"))[0].src, "sound/music/calm/one.mp3");

  // Checklist items tick when their first word is spoken, in order; an unsaid item falls back to even spacing.
  const { saidAt } = await import("../remotion/mono.ts");
  const said = [{ word: "One", start: 10.2 }, { word: "hour.", start: 10.5 }, { word: "No", start: 11 }, { word: "phone.", start: 11.2 }, { word: "Ship", start: 11.9 }];
  assert.deepEqual(saidAt(["ONE HOUR", "NO PHONE", "SHIP IT"], said, 10, 3).map((x) => +x.toFixed(2)), [0.2, 1, 1.9]);
  assert.equal(saidAt(["GYM"], said, 10, 3)[0], (10 + 0.5 * (90 * 0.8 - 10)) / 30);
  assert.equal(censor("shit"), "sh*t");
  assert.equal(censor("Fucking,"), "F*cking,");
  assert.equal(censor("shift"), "shift");

  const narr = { purpose: "explain", narration: "Get up." } as const;
  assert.ok(
    Scenes.safeParse({
      scenes: [
        { ...narr, component: "Crowd", props: { ending: "stands" }, hit: "up", camera: "push" },
        { ...narr, component: "BigWord", props: { word: "GET UP" }, sfx: "braam" },
        { ...narr, component: "Split", props: { left: "YOU", right: "THEM" } },
        { ...narr, component: "Fall", props: {} },
        { ...narr, component: "Summit", props: { flag: "YOU" } },
      ],
    }).success,
  );
  assert.ok(!Scenes.safeParse({ scenes: Array(5).fill({ ...narr, component: "Fall", props: {}, sfx: "airhorn" }) }).success);
});

test("motivation variety: per-project camera/transition/backdrop, copied-phrase detection", async () => {
  const { cameraFor, transitionFor, pick, seedOf, backdropFor, BACKDROPS } = await import("../remotion/mono.ts");
  const { runs } = await import("./bots/claude-bots.ts");
  const sc = { purpose: "explain", component: "Run" };
  const seq = (id: string) => Array.from({ length: 20 }, (_, i) => cameraFor(i, sc, seedOf(id)) + transitionFor(i, sc, seedOf(id))).join();
  assert.notEqual(seq("20261123-a"), seq("20261123-b"));
  for (const seed of [0, 1, 99, seedOf("x")]) for (let i = 1; i < 30; i++) assert.notEqual(pick(6, seed, i), pick(6, seed, i - 1));
  assert.equal(new Set(Array.from({ length: 40 }, (_, i) => backdropFor(seedOf(`p${i}`)))).size, BACKDROPS.length);
  // Consecutive videos never open or close on the same scene; the featured set never includes them.
  const { paletteFor } = await import("./bots/claude-bots.ts");
  for (let n = 1; n < 30; n++) {
    const [a, b] = [paletteFor(n - 1, n * 7), paletteFor(n, n * 7)];
    assert.ok(a.open !== b.open && a.close !== b.close && b.open !== b.close, `video ${n}`);
    assert.ok(b.featured.length === 6 && !b.featured.includes(b.open) && !b.featured.includes(b.close));
  }
  // Camera focus moves: end on the detail, never show past the frame's edges, punch lands on the hit word.
  const { shotAt, focusFor } = await import("../remotion/mono.ts");
  const fc = focusFor("Chart"); // near the top-right corner
  const end = shotAt("focus", 90, 90, fc)!;
  assert.ok(Math.abs(end.z - 1.38) < 1e-9 && end.spot === 1);
  for (const cam of ["focus", "reveal", "track", "swing", "punch", "dutch"])
    for (let fr = 0; fr <= 90; fr += 5) {
      const sh = shotAt(cam, fr, 90, fc, 40, -1)!;
      assert.ok(sh.cx >= 540 / sh.z - 1e-6 && sh.cx <= 1080 - 540 / sh.z + 1e-6 && sh.cy >= 960 / sh.z - 1e-6 && sh.cy <= 1920 - 960 / sh.z + 1e-6, `${cam} at ${fr} shows past the edge`);
    }
  assert.equal(shotAt("punch", 39, 90, fc, 40)!.z, 1);
  assert.ok(shotAt("punch", 46, 90, fc, 40)!.z > 1.44);
  assert.deepEqual(focusFor("Chart", true), [120, 700]); // mirrored scenes mirror their focus
  assert.equal(shotAt("push", 10, 90, fc), undefined); // the simple moves stay CSS-only
  const { fullWave } = await import("./bots/claude-bots.ts");
  assert.ok(fullWave(["hook", "story", "story", "dip", "turn", "rise", "rise", "peak", "landing", "landing"]));
  assert.ok(!fullWave(["hook", "story", "dip", "turn", "rise", "peak"])); // stops at the peak
  assert.ok(!fullWave(["hook", "dip", "story", "turn", "rise", "peak", "landing"])); // out of order
  assert.ok(!fullWave(["hook", "story", "dip", "turn", undefined, "peak", "landing"])); // untagged beat
  const { EXPLAINED_SECTIONS, ExplainedScript } = await import("./schemas.ts");
  assert.ok(fullWave(["hook", "context", "idea", "idea", "example", "how", "caveat", "close"], EXPLAINED_SECTIONS));
  assert.ok(!fullWave(["hook", "context", "idea", "example", "how", "caveat"], EXPLAINED_SECTIONS)); // no close
  const said = (n: number) => ({ title: "t", hook: "h", analogy: "a", analogy_breaks_down: "b", flagged_claims: [], estimated_seconds: 100, beats: Array.from({ length: 10 }, () => ({ narration: Array(n).fill("word").join(" "), visual_idea: "v" })) });
  assert.ok(ExplainedScript.safeParse(said(25)).success && !ExplainedScript.safeParse(said(18)).success && !ExplainedScript.safeParse(said(30)).success); // 250 ok, 180 too short, 300 runs past 2 min
  const { transitionFor: tr } = await import("../remotion/mono.ts");
  assert.equal(tr(0, { purpose: "payoff", component: "Chart" }, 1, true), "fade"); // explainers fade, never flash
  const calmCams = Array.from({ length: 40 }, (_, i) => cameraFor(i, { purpose: "explain", component: "Chart" }, 5, true));
  assert.ok(calmCams.every((c) => !["punch", "swing", "dutch", "handheld", "orbit"].includes(c)));
  const old = runs("Get up when it's cold! Get up when it hurts!");
  assert.ok([...runs("Then GET UP when it's cold, now.")].some((r) => old.has(r)));
  assert.ok(![...runs("Move before the coffee is cold.")].some((r) => old.has(r)));
});

test("cancel kills the running job and marks it stopped; retry resumes; delete removes it for good", async () => {
  const { existsSync } = await import("node:fs");
  let aborted = false;
  const jobs = Object.fromEntries(P.STEPS.map((s) => [s, async () => "ok."])) as any;
  jobs.script = ({ signal }: any) => new Promise<string>((_, rej) => signal.addEventListener("abort", () => ((aborted = true), rej(new Error("killed")))));
  const office = new Office(jobs, 0);
  const s = office.newTopic("Cancel me");
  await new Promise((r) => setTimeout(r, 10));
  assert.throws(() => office.delete(s.id), /working on it/);
  const stopped = new Promise<void>((r) => office.on("event", (e: any) => e.type === "chat" && /^Stopped/.test(e.msg.text) && r()));
  office.cancel(s.id);
  await stopped;
  assert.ok(aborted);
  assert.equal(P.load(s.id).steps.script, "failed");
  assert.throws(() => office.cancel(s.id), /nothing is running/);

  jobs.script = async () => "ok.";
  const gated = new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.id === s.id && e.state.gate === "script" && r()));
  office.retry(s.id);
  await gated;

  office.delete(s.id);
  assert.ok(!existsSync(P.dir(s.id)));
  const t = office.newTopic("Archived then deleted");
  await new Promise((r) => setTimeout(r, 10));
  office.archive(t.id);
  office.delete(t.id);
  assert.ok(!existsSync(join(P.ARCHIVE, t.id)));
  assert.throws(() => office.delete("_archive"), /no such project/);
  assert.throws(() => office.delete("../etc"), /no such project/);
});

test("calm styles: library pictures once and only where they fit, the rest drawn; drawings drawings are checked before they reach the render", async () => {
  const { calmIssues } = await import("./bots/claude-bots.ts");
  const { checkDrawing, toJs } = await import("./bots/draw.ts");
  const sc = (component: string, shot?: string) => ({ component, shot });
  assert.deepEqual(calmIssues([sc("Giza"), sc("Sledge", "b"), sc("Lever", "c"), sc("Timeline")]), []); // library where it fits, drawn elsewhere
  assert.match(calmIssues([sc("Giza"), sc("Lever"), sc("Giza")]).join(), /at most once.*Giza/);
  assert.deepEqual(calmIssues([sc("Giza"), sc("Giza", "the pyramid, now finished")]), []); // a return to the picture is drawn
  assert.match(calmIssues([sc("Giza", "The ramp."), sc("Sledge", "the ramp")]).join(), /shots repeat/);
  assert.match(calmIssues(["Giza", "Giza", "Giza"].map((c, i) => sc(c, `s${i}`))).join(), /Giza \(3x\)/);
  assert.match(calmIssues([sc("Giza", "a"), sc("Lever", "b"), sc("Sledge", "c"), sc("Timeline")], 2, 1 / 3).join(), /too many drawn scenes: 3 of 4 .* at most 2/);
  assert.deepEqual(calmIssues([sc("Giza", "a"), sc("Lever"), sc("Sledge"), sc("Timeline")], 2, 1 / 3), []); // 1 of 4 drawn: within the cap
  const ok = `import { useCurrentFrame } from "remotion";\nimport { Frame } from "kit";\nexport default function S({ p, t }) { const f = useCurrentFrame(); return <Frame p={p} t={t}><circle r={f} /></Frame>; }`;
  assert.deepEqual(checkDrawing(ok), []);
  assert.match(toJs(ok), /require\("kit"\)/); // CommonJS, so remotion/drawn.tsx can hand it the kit
  assert.match(checkDrawing(ok.replace(`"kit"`, `"../Mono.tsx"`)).join(), /imports "..\/Mono.tsx"/);
  assert.match(checkDrawing(ok.replace("f}", "Math.random()}")).join(), /Math.random/);
  assert.match(checkDrawing(ok.replace("<circle", "<circle <")).join(), /doesn't compile/);
  assert.match(checkDrawing(ok.replace("f}", "pop(f)}")).join(), /calls pop/);
  assert.deepEqual(checkDrawing(ok.replace("f}", "Easing.ease(f)}")), []);
  // 3D scenes (prompts/draw-3d.md): three is importable, but the kit's <Three> does the rendering.
  const three = `import * as THREE from "three";\n${ok}`;
  assert.deepEqual(checkDrawing(three), []);
  assert.match(checkDrawing(three.replace("f}", "new THREE.WebGLRenderer() && f}")).join(), /renders three.js itself/);
});

test("long videos: chapters planned apart, clashes blamed on the later chapter, stitched into one plan", async () => {
  const { chapterClashes, spread, stitch, fill } = await import("./bots/claude-bots.ts");
  const sc = (component: string, shot?: string) => ({ component, shot });
  assert.deepEqual(chapterClashes([[sc("Giza"), sc("Lever", "a ramp")], [sc("Sledge", "a sledge")]]), new Map());
  const c = chapterClashes([[sc("Giza"), sc("Lever", "A ramp.")], [sc("Giza")], [sc("Sledge", "a ramp")]]);
  assert.deepEqual([...c.keys()], [1, 2]); // chapter 1 keeps what it used first
  assert.match(c.get(1)!.join(), /chapter 1 already shows the library picture Giza/);
  assert.match(c.get(2)!.join(), /repeats one in chapter 1/);
  assert.match(chapterClashes([[sc("Chart", "a"), sc("Chart", "b")], [sc("Chart", "c"), sc("Chart", "d")]]).get(1)!.join(), /Chart is already used 3 times/);
  assert.match(chapterClashes([[sc("Run", "a"), sc("Lift", "b")], [sc("Boxing", "c")]]).get(1)!.join(), /2 workout scenes/);
  assert.deepEqual(spread(6, 7), [0, 1, 1, 1, 1, 1, 1]);
  assert.equal(spread(4, 5).reduce((a, b) => a + b), 4);
  const s = (purpose: string, extra = {}) => ({ purpose, narration: "x", component: "Chart", props: {}, speed: 1, pause_after: 0.3, ...extra }) as never;
  const out = stitch([[s("explain", { hit: "a", camera: "push" }), s("payoff")], [s("hook", { camera: "focus" }), s("outro", { camera: "focus", hit: "b" })]]);
  assert.deepEqual(out.map((x) => x.chapter), [1, 1, 2, 2]);
  assert.deepEqual(out.map((x) => x.purpose), ["hook", "explain", "payoff", "outro"]); // the models' own hook/payoff/outro are replaced
  assert.equal(out[3].camera, "pull");
  assert.equal(out[3].hit, undefined); // the ending has no hit
  assert.equal(out[0].hit, "a");
  const many = stitch([Array.from({ length: 8 }, (_, i) => s("explain", { hit: `h${i}`, sfx: "clock" }))]);
  assert.equal(many.filter((x) => x.hit).length, 6);
  assert.equal(many.filter((x) => x.sfx).length, 4);
  assert.equal(stitch([[s("explain", { camera: "pan" }), s("explain", { camera: "pan" })]])[1].camera, "pull"); // last scene
  assert.equal(stitch([[s("explain", { camera: "pan" })], [s("explain", { camera: "pan" }), s("explain")]])[1].camera, undefined); // no repeat across the seam
  const p = fill("scenes", { part: "You plan ONLY chapter 2 of 5" }, undefined, "long");
  assert.match(p, /You plan ONLY chapter 2 of 5/);
  assert.doesNotMatch(p, /55–90 scenes|in the whole video/);
});

test("approving the video runs the thumbnail job once; script approval doesn't", async () => {
  const ran: string[] = [];
  const office = new Office(Object.fromEntries(P.STEPS.map((s) => [s, async () => "ok."])) as any, 0, async ({ state }: any) => (ran.push(state.id), "3 thumbs."));
  const waitGate = (g: string) => new Promise<void>((r) => office.on("event", (e: any) => e.type === "project" && e.state.gate === g && r()));
  const s = office.newTopic("Thumbnail test");
  await waitGate("script");
  office.approve(s.id);
  assert.deepEqual(ran, []);
  await waitGate("video");
  office.approve(s.id);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(ran, [s.id]);
  assert.ok(P.chatOf(s.id).some((m) => m.text === "3 thumbs."));
});

test("thumbnail frames: three spread picks, skipping text-only scenes", async () => {
  const { thumbFrames } = await import("./bots/remotion.ts");
  const scenes = Array.from({ length: 10 }, (_, i) => ({ component: i === 0 ? "HookCard" : "Chart", start: i * 4, end: i * 4 + 4 }));
  const f = thumbFrames(scenes);
  assert.equal(f.length, 3);
  assert.ok(f.every((x, i) => x > 4 * 30 && (i === 0 || x > f[i - 1])));
  assert.equal(thumbFrames([{ component: "Chart", start: 0, end: 2 }]).length, 1);
});

test("long style: chaptered script, scenes carry their chapter's narration word for word, 16:9 props", async () => {
  const { LongScript, chaptersOf } = await import("./schemas.ts");
  const { chapterIssues } = await import("./bots/claude-bots.ts");
  // 6 chapters x 4 beats x 50 words = 1200 words, 200 per chapter.
  const script = (chapters: number, words = 50, beats = 4) => ({
    title: "t", hook: "h", analogy: "a", analogy_breaks_down: "b", flagged_claims: [], estimated_seconds: 530,
    beats: Array.from({ length: chapters * beats }, (_, i) => ({ chapter: `Part ${Math.floor(i / beats) + 1}`, narration: `${i} ${Array(words - 1).fill("word").join(" ")}.`, visual_idea: "v" })),
  });
  assert.ok(LongScript.safeParse(script(6)).success);
  assert.ok(!LongScript.safeParse(script(4, 70)).success); // 4 chapters (280 words each) is too few
  assert.ok(!LongScript.safeParse(script(6, 40)).success); // 960 words, under 8 minutes
  const untitled = script(6);
  delete (untitled.beats[3] as { chapter?: string }).chapter;
  assert.ok(!LongScript.safeParse(untitled).success);
  const interleaved = script(6);
  interleaved.beats[23].chapter = "Part 1"; // comes back to chapter 1 at the end
  assert.ok(!LongScript.safeParse(interleaved).success);

  const s = script(6);
  assert.deepEqual(chaptersOf(s), ["Part 1", "Part 2", "Part 3", "Part 4", "Part 5", "Part 6"]);
  // One scene per beat, split across two scenes for the first beat: same words, so it's fine.
  const [a, b] = [s.beats[0].narration.split(" ").slice(0, 10).join(" "), s.beats[0].narration.split(" ").slice(10).join(" ")];
  const scenes = [{ chapter: 1, narration: a }, { chapter: 1, narration: b }, ...s.beats.slice(1).map((x, i) => ({ chapter: Math.floor((i + 1) / 4) + 1, narration: x.narration }))];
  assert.deepEqual(chapterIssues(s, scenes), []);
  assert.match(chapterIssues(s, scenes.map((x, i) => (i === 4 ? { ...x, chapter: 2 } : x))).join(), /chapter 1 .*word for word/); // a chapter-1 line filed under 2
  assert.match(chapterIssues(s, scenes.map((x, i) => (i === 9 ? { ...x, chapter: 1 } : x))).join(), /never go back down/);
  assert.match(chapterIssues(s, scenes.map(({ narration }) => ({ narration }))).join(), /every scene its chapter/);

  // The render props: 16:9 with the script's chapter titles.
  const { propsOf } = await import("./bots/remotion.ts");
  const L = P.create("How Costco makes money", new Date(), "long");
  writeFileSync(P.dir(L.id, "script.json"), JSON.stringify(s));
  const props = propsOf({ scenes: [], words: [], audio: [] }, L.id, [], "long");
  assert.equal(props.wide, true);
  assert.equal(props.calm, true);
  assert.equal(props.chapters?.length, 6);
});

test("long style: review per chapter, a track per chapter, chapters cut into Shorts, fact-check verdicts in script.md", async () => {
  const { reviewParts, chapterShort } = await import("./bots/remotion.ts");
  assert.deepEqual(reviewParts([{ chapter: 1 }, { chapter: 1 }, { chapter: 2 }, { chapter: 3 }, { chapter: 3 }]), [[0, 2], [2, 3], [3, 5]]);
  assert.deepEqual(reviewParts([{}, {}, {}]), [[0, 3]]); // a Short: one review

  const { musicSegments, XFADE } = await import("../remotion/mono.ts");
  const tr = (src: string) => ({ src, drop: null, bpm: 80, downbeat: 0, pulseEvery: 1, duration: 150, start: 0 });
  const [a, b] = [tr("a.mp3"), tr("b.mp3")];
  const sc = [{ chapter: 1, start: 0 }, { chapter: 1, start: 50 }, { chapter: 2, start: 100 }, { chapter: 3, start: 180 }];
  const segs = musicSegments(a, [a, b], sc, 300);
  assert.deepEqual(segs.map((x) => [x.track.src, x.at, x.dur]), [["a.mp3", 0, 100 + XFADE], ["b.mp3", 100, 80 + XFADE], ["a.mp3", 180, 120]]);
  assert.deepEqual(musicSegments(a, [], sc, 300).map((x) => [x.at, x.dur]), [[0, 300]]); // no chapter tracks: one track throughout
  assert.deepEqual(musicSegments(undefined, [], sc, 300), []); // music off

  // Chapter 2 of a 3-chapter video: its 2 scenes and words, shifted to 0; the voice is cut just after its last word.
  const w = (word: string, start: number, scene: number) => ({ word, start, end: start + 0.4, scene });
  const video = {
    scenes: [0, 10, 20, 30, 40].map((t, i) => ({ purpose: "explain", narration: "x", component: "Chart", props: {}, chapter: [1, 2, 2, 3, 3][i], start: t, end: t + 10 })),
    words: [w("one", 1, 0), w("two", 11, 1), w("three", 25, 2), w("four", 31, 3)],
    audio: [{ src: "audio/voice.wav", start: 0 }],
    music: a,
    chapterMusic: [a, b, a],
    drawn: ["d0", null, "d2", null, null],
    seed: 7,
    calm: true,
    wide: true,
    chapters: ["A", "B", "C"],
  } as unknown as import("../remotion/Explainer.tsx").ExplainerProps;
  const short = chapterShort(video, 2);
  assert.deepEqual(short.scenes.map((s) => [s.start, s.end]), [[0, 10], [10, 20]]);
  assert.deepEqual(short.words.map((x) => [x.word, x.start, x.scene]), [["two", 1, 0], ["three", 15, 1]]);
  assert.equal(short.audio[0].start, -10);
  assert.ok(Math.abs(short.audio[0].end! - 15.7) < 1e-9); // "three" ends at 15.4, plus 0.3
  assert.equal(short.music?.src, "b.mp3");
  assert.deepEqual(short.drawn, [null, "d2"]);
  assert.equal(short.wide, undefined); // vertical
  assert.deepEqual(short.tallAs, [null, "box"]); // an older wide-only drawing: shown whole, not cut off

  // How a long video's drawings play in its Shorts, from the markers their files export.
  const { toJs, tallAsOf, checkDrawing } = await import("./bots/draw.ts");
  const file = (extra: string) => toJs(`export default function S() { return null; }\n${extra}`);
  assert.equal(tallAsOf(file("export const responsive = true;")), "native");
  assert.equal(tallAsOf(file("export const responsive = true;\nexport const wideOnly = true;")), "pan");
  assert.equal(tallAsOf(file("")), "box");
  assert.equal(tallAsOf(null), null);
  assert.deepEqual(chapterShort({ ...video, drawn: [file("export const responsive = true;"), null, null, null, null] }, 1).tallAs, ["native"]);
  assert.match(checkDrawing('import { Frame } from "kit";\nexport default function S() { return null; }\nfunction stage(t) { return {}; }').join(), /own stage/);

  // Drawn scenes never get a focus move: it zooms 1.15–1.55x on the centre and crops the drawing's sides.
  const { cameraFor } = await import("../remotion/mono.ts");
  const drawnScene = { purpose: "explain", component: "Drawn", camera: "focus" };
  for (let i = 0; i < 40; i++) for (const calm of [true, false]) assert.match(cameraFor(i, drawnScene, 3, calm), /^(push|pull|pan|tilt|orbit|handheld)$/);
  assert.equal(cameraFor(0, { ...drawnScene, component: "Chart" }, 3, true), "focus"); // library scenes keep theirs

  // Drawing layout: the same call goes side by side on the wide stage and stacks on the tall one.
  const { box, split, row, place } = await import("../remotion/layout.ts");
  const wideS = box(100, 90, 1820, 890), tallS = box(70, 480, 1010, 1520);
  const [l, r] = split(wideS);
  assert.ok(l.right < r.left && l.top === r.top);
  const [up, down] = split(tallS);
  assert.ok(up.bottom < down.top && up.left === down.left);
  assert.deepEqual(row(wideS, 3).map((c) => Math.round(c.top)), [90, 90, 90]);
  const grid = row(tallS, 3);
  assert.ok(grid[0].top === grid[1].top && grid[2].top > grid[0].top && Math.abs(grid[2].cx - tallS.cx) < 1e-9); // 2 + a centred 1
  for (const c of [...grid, ...row(wideS, 4)]) assert.ok(c.left >= 70 - 1e-9 && c.right <= 1820 + 1e-9);
  assert.equal(place(box(0, 0, 300, 1000), 600, 500), "translate(0 750) scale(0.5)"); // fit by width, standing on the bottom
  assert.match(short.endCard!, /full video/i);
  assert.equal(chapterShort(video, 3).scenes.length, 2); // the last chapter runs to the end
  const { shortDescription } = await import("./bots/remotion.ts");
  const d = shortDescription({ ...short, scenes: [{ ...short.scenes[0], narration: "A card costs $65." }, ...short.scenes.slice(1)], music: { ...b, credit: "Music: Song by Someone" } }, "B", "How X works");
  assert.equal(d, 'B\n\nA card costs $65.\n\nFull video on my channel: "How X works"\n\nMusic: Song by Someone\n\n#Shorts\n');
  assert.doesNotMatch(shortDescription({ ...short, music: null }, "B", "T"), /Music/); // no track, no credit
  assert.throws(() => chapterShort(video, 4), /no chapter 4/);

  // script.md shows each claim's verdict; a claim edited by hand since the check shows as not checked.
  const { writeScript } = await import("./bots/claude-bots.ts");
  const p = P.create("Fact check", new Date(), "long");
  writeFileSync(P.dir(p.id, "factcheck.json"), JSON.stringify({ claims: [{ claim: "Costco charges $65", verdict: "confirmed", source: "https://example.com/a" }, { claim: "Hot dog since 1990", verdict: "wrong", correction: "since 1985" }] }));
  const s = { title: "t", hook: "h", analogy: "a", analogy_breaks_down: "b", estimated_seconds: 500, flagged_claims: ["Costco charges $65", "Hot dog since 1990", "A new claim"], beats: Array.from({ length: 4 }, () => ({ narration: "word", visual_idea: "v" })) };
  writeScript(p.id, s);
  const md = (await import("node:fs")).readFileSync(P.dir(p.id, "script.md"), "utf8");
  assert.match(md, /\[confirmed \(source: https:\/\/example.com\/a\)\] Costco charges \$65/);
  assert.match(md, /\[WRONG: since 1985\] Hot dog since 1990/);
  assert.match(md, /\[not checked\] A new claim/);
});

test("long style: YouTube chapter timestamps start at 0:00", async () => {
  const { chapterTimestamps } = await import("./bots/remotion.ts");
  const scenes = [{ chapter: 1, start: 0.4 }, { chapter: 1, start: 30 }, { chapter: 2, start: 95.6 }, { chapter: 3, start: 612 }];
  assert.deepEqual(chapterTimestamps(scenes, ["The $65 ticket", "The hot dog", "Kirkland"]), ["0:00 The $65 ticket", "1:35 The hot dog", "10:12 Kirkland"]);
});

test("the cover prompt's example is a valid drawing, and the prompt fills it in", async () => {
  const { readFileSync } = await import("node:fs");
  const { checkDrawing } = await import("./bots/draw.ts");
  const { fill } = await import("./bots/claude-bots.ts");
  const example = readFileSync(join(P.ROOT, "prompts", "cover-example.tsx"), "utf8");
  assert.deepEqual(checkDrawing(example), []);
  const prompt = fill("cover", { title: "T", example });
  assert.ok(prompt.includes("export default function Cover") && !/\{\{\w+\}\}/.test(prompt));
});

test("a facing figure's elbow bends outward: mirrored across shoulder–hand when IK put it inside", async () => {
  const { elbowOut } = await import("../remotion/components/Figure3D.tsx");
  assert.deepEqual(elbowOut([74, -140], [60, -90], [100, -40], 1).map(Math.round), [111, -103]); // was inside → mirrored out, same lengths
  assert.deepEqual(elbowOut([74, -140], [111, -102], [100, -40], 1), [111, -102]); // already outside: unchanged
  assert.deepEqual(elbowOut([-74, -140], [-60, -90], [-100, -40], -1).map(Math.round), [-111, -103]); // the left arm too
});
