import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { makeCancelSignal, renderMedia, renderStill, selectComposition, type RenderMediaOptions } from "@remotion/renderer";
import type { Job } from "../office.ts";
import { ROOT, dir, readJson, writeJson, type Layout } from "../project.ts";
import { Review } from "../schemas.ts";
import { OPUS, runClaude } from "../claude.ts";
import { fill } from "./claude-bots.ts";
import { readVoiced, run, type VoicedScenes } from "./voice.ts";
import { drawPath, drawScenes, drawnOf } from "./draw.ts";
import { musicLibrary } from "../music.ts";
import type { ExplainerProps } from "../../remotion/Explainer.tsx";
import { musicFor, seedOf, type Track } from "../../remotion/mono.ts";

const FPS = 30;
// The effects layer (remotion/MonoFx.tsx) is WebGL, which headless Chrome only runs with the ANGLE backend.
const chromiumOptions = { gl: "angle" } as const;

// publicDir is fixed at bundle time, so each project gets its own bundle (staticFile → its audio).
// `sound` copies the music/SFX bank in for the motivation style.
export function bundleFor(publicDir: string, activity: (l: string) => void = () => {}, sound = false) {
  if (sound) {
    const bank = join(ROOT, "public", "sound");
    if (!existsSync(join(bank, "rain.wav"))) throw new Error("the sound bank is missing; run `npm run setup` to download it");
    cpSync(bank, join(publicDir, "sound"), { recursive: true });
    cpSync(join(ROOT, "public", "sfx"), join(publicDir, "sfx"), { recursive: true });
  }
  return bundle({
    entryPoint: join(ROOT, "remotion", "index.ts"),
    publicDir,
    onProgress: (p) => activity(`bundling ${p}%`),
  });
}

export const propsOf = (v: VoicedScenes, id: string, tracks: Track[] = [], layout: Layout = "mono"): ExplainerProps => {
  const calm = layout !== "mono";
  const found = musicFor(id, tracks);
  // An explainer plays its track from the top (a slow intro suits it) instead of jumping to the full beat.
  const music = found && calm ? { ...found, start: 0 } : found;
  // null, not a missing key: Remotion merges input props over the composition's defaults, and the fixture has music.
  return { scenes: v.scenes, words: v.words, audio: v.audio, seed: seedOf(id), music: music ?? null, calm, drawn: drawnOf(id, v.scenes.length) };
};
// Explainers get calm music: EXPLAINED_MUSIC picks the file (default the piano piece), "off" for none.
const tracksFor = (activity: (l: string) => void, layout: Layout) => {
  activity("checking the music folder");
  const pick = layout !== "mono" ? process.env.EXPLAINED_MUSIC || "emotional-piano.mp3" : process.env.MONO_MUSIC;
  return musicLibrary((args) => run("uv", args), undefined, pick);
};

// One still per scene at its midpoint; returns the file paths. Drawn scenes that crash are added to `failed`.
// shortcut: a drawing that only throws at other frames isn't caught here; it falls back to the library picture there.
export async function renderStills(serveUrl: string, props: ExplainerProps, outDir: string, activity: (l: string) => void = () => {}, failed = new Map<number, string>()) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps: props, chromiumOptions });
  const files: string[] = [];
  for (const [i, s] of props.scenes.entries()) {
    activity(`still ${i + 1}/${props.scenes.length}`);
    const frame = Math.round((((s.start ?? 0) + (s.end ?? 0)) / 2) * FPS);
    const output = join(outDir, `scene-${String(i + 1).padStart(2, "0")}.jpeg`);
    const onBrowserLog = ({ text }: { text: string }) => {
      const m = text.match(/DRAW_FAIL (\d+) (.*)/);
      if (m) failed.set(Number(m[1]), m[2].slice(0, 300));
    };
    await renderStill({ serveUrl, composition, inputProps: props, chromiumOptions, frame, output, imageFormat: "jpeg", jpegQuality: 80, scale: 0.5, onBrowserLog });
    files.push(output);
  }
  return files;
}

// shortcut: bundling and stills don't stop on cancel (they're short); Office discards their result.
export const build: Job = async ({ state, note, activity, signal }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  const tracks = await tracksFor(activity, state.layout);
  let voiced = readVoiced(state.id);
  // Draw every scene the director gave a shot; a retry keeps the drawings already made (Dot clears them on a new plan).
  const missing = voiced.scenes.flatMap((s, i) => (s.shot && !existsSync(drawPath(state.id, i)) ? [{ i }] : []));
  const undrawn = missing.length ? await drawScenes(state, voiced, missing, activity, signal) : [];
  const fixed: string[] = [];
  const drawnCount = () => voiced.scenes.filter((_, i) => existsSync(drawPath(state.id, i))).length;
  for (let round = 1; round <= 2; round++) {
    const failed = new Map<number, string>();
    const props = propsOf(voiced, state.id, tracks, state.layout);
    const stills = await renderStills(serveUrl, props, dir(state.id, "stills"), activity, failed);
    const drawn = props.drawn!.flatMap((d, i) => (d ? [i + 1] : []));
    activity(`reviewing ${stills.length} frames`);
    const review = await runClaude({
      model: OPUS,
      prompt: fill("review", { stills: stills.map((f) => f.replace(dir(state.id) + "/", "")).join(", "), drawn: drawn.length ? drawn.join(", ") : "none", scenes: JSON.stringify(voiced.scenes, null, 1) }, note),
      schema: Review,
      tools: ["Read"],
      cwd: dir(state.id),
      onActivity: activity,
      signal,
    });
    // A drawing that crashed shows its library picture in the still; draw it again with the error.
    const redo = [...failed].map(([i, e]) => ({ i, note: `Your last drawing of this scene crashed: ${e}. Fix that.` }));
    for (const r of review.redraw ?? []) if (voiced.scenes[r.scene - 1]?.shot && !failed.has(r.scene - 1)) redo.push({ i: r.scene - 1, note: `The reviewer saw your last drawing of this scene and asked for changes: ${r.note}` });
    if (!review.ok && review.scenes) {
      // The fix may only touch visuals: narration and timing must still match the recorded audio.
      const same = review.scenes.length === voiced.scenes.length && review.scenes.every((s, i) => s.narration === voiced.scenes[i].narration);
      if (!same) throw new Error("my fix changed the narration, so it no longer matches the audio. Send the video back to Dot.");
      // Keep fields Bolt may have left out (shot, hit, sfx, camera); its component/props win.
      voiced = { ...voiced, scenes: review.scenes.map((s, i) => ({ ...voiced.scenes[i], ...s, start: voiced.scenes[i].start, end: voiced.scenes[i].end })) };
      writeJson(dir(state.id, "scenes.json"), voiced);
    }
    fixed.push(...review.issues, ...[...failed].map(([i, e]) => `scene ${i + 1} crashed (${e.slice(0, 60)}), redrawn`));
    if (!redo.length && (review.ok || !review.scenes)) break;
    if (redo.length) undrawn.push(...(await drawScenes(state, voiced, redo, activity, signal)));
    if (round === 2) await renderStills(serveUrl, propsOf(voiced, state.id, tracks, state.layout), dir(state.id, "stills"), activity);
  }
  const head = `Drew ${drawnCount()} of ${voiced.scenes.length} scenes for this video.${undrawn.length ? ` Drawing failed for ${undrawn.join("; ")} (those keep their earlier drawing or the library picture).` : ""}`;
  return fixed.length ? `${head} Checked every frame and fixed ${fixed.length} issue(s): ${fixed.slice(0, 2).join("; ")}.` : `${head} Checked every frame, all good.`;
};

// Remotion's ffmpeg only ships loudnorm (no compressor/limiter): it lifts quiet mixes ~1.5 LU and keeps true peak at -1.5 dBTP.
// shortcut: lands near -16 LUFS, not the -14 platforms use; a real limiter (system ffmpeg or a Python master) would get there.
export const louder: RenderMediaOptions["ffmpegOverride"] = ({ type, args }) => {
  const i = args.indexOf("-c:a");
  if (type !== "stitcher" || i < 0 || args[i + 1] !== "copy") return args;
  const out = [...args];
  out.splice(i, 2, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "320k", "-ar", "48000");
  return out;
};

export const render: Job = async ({ state, activity, signal }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  const props = propsOf(readVoiced(state.id), state.id, await tracksFor(activity, state.layout), state.layout);
  const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps: props, chromiumOptions });
  let last = -1;
  const { cancelSignal, cancel } = makeCancelSignal();
  signal.addEventListener("abort", cancel);
  await renderMedia({
    cancelSignal,
    chromiumOptions,
    serveUrl,
    composition,
    inputProps: props,
    codec: "h264",
    outputLocation: dir(state.id, "out.mp4"),
    ffmpegOverride: louder,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last) activity(`rendering ${(last = pct)}%`);
    },
  });
  // CC BY music must be credited in the post's description.
  const credit = props.music?.credit;
  if (credit) writeFileSync(dir(state.id, "credits.txt"), `${credit}\n`);
  const song = props.music ? ` Music: ${props.music.src.split("/").pop()}.` : " No music (add a sound in TikTok).";
  return `Video rendered: ${(composition.durationInFrames / FPS).toFixed(1)}s, 1080x1920.${song}${credit ? ` Put this in the description: ${credit}` : ""}`;
};

// Text-only scenes would clash with the cover title.
const WORDY = new Set(["HookCard", "Callout", "BigWord", "Split"]);
// Three covers from early, middle and late in the video (each 70% into its scene, after the entrance animation).
export function thumbFrames(scenes: { component: string; start?: number; end?: number }[]): number[] {
  const pool = scenes.filter((s) => !WORDY.has(s.component));
  const from = pool.length >= 3 ? pool : scenes;
  const picks = [...new Set([0.15, 0.5, 0.85].map((k) => from[Math.min(from.length - 1, Math.floor(k * from.length))]))];
  return picks.map((s) => Math.round(((s.start ?? 0) + 0.7 * ((s.end ?? (s.start ?? 0) + 3) - (s.start ?? 0))) * FPS));
}

// Runs after you approve the video: thumbs/thumb-{1,2,3}.jpeg, 1080x1920 covers for YouTube Shorts and Meta Reels.
export const thumbs: Job = async ({ state, activity }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  const video = propsOf(readVoiced(state.id), state.id, await tracksFor(activity, state.layout), state.layout);
  const title = readJson<{ title: string }>(dir(state.id, "script.json")).title;
  const out = dir(state.id, "thumbs");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const frames = thumbFrames(video.scenes);
  const inputProps = { video, title };
  const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps, chromiumOptions });
  for (const [i, frame] of frames.entries()) {
    activity(`thumbnail ${i + 1}/${frames.length}`);
    await renderStill({ serveUrl, composition, inputProps, chromiumOptions, frame, output: join(out, `thumb-${i + 1}.jpeg`), imageFormat: "jpeg", jpegQuality: 90 });
  }
  return `Made ${frames.length} thumbnails (1080x1920, for YouTube Shorts and Reels) in projects/${state.id}/thumbs/.`;
};
