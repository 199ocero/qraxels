import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { makeCancelSignal, openBrowser, renderMedia, renderStill, selectComposition, type RenderMediaOptions } from "@remotion/renderer";
import type { Job } from "../office.ts";
import { ROOT, dir, readJson, writeJson, type Layout, type State } from "../project.ts";
import { CoverCheck, Review, chaptersOf, type FactCheck, type Scene, type Script } from "../schemas.ts";
import { OPUS, SONNET, runClaude } from "../claude.ts";
import { fill } from "./claude-bots.ts";
import { readVoiced, run, type VoicedScenes } from "./voice.ts";
import { drawCover, drawPath, drawScenes, drawnOf, markWideOnly, tallAsOf } from "./draw.ts";
import { musicDirFor, musicLibrary } from "../music.ts";
import type { ExplainerProps } from "../../remotion/Explainer.tsx";
import { END_SCREEN, musicFor, seedOf, type Track } from "../../remotion/mono.ts";

const FPS = 30;
// The effects layer (remotion/MonoFx.tsx) is WebGL, which headless Chrome only runs with the ANGLE backend.
const chromiumOptions = { gl: "angle" } as const;
// The character is 3D (remotion/components/Figure3D.tsx); FIGURE_3D=0 renders the flat SVG one instead.
const envVariables: Record<string, string> = process.env.FIGURE_3D ? { FIGURE_3D: process.env.FIGURE_3D } : {};

// publicDir is fixed at bundle time, so each project gets its own bundle (staticFile → its audio).
// `sound` copies the music/SFX bank in for the motivation style.
// Deletes a bundle once its job is done (each is ~46 MB of JS). Its public/ is a symlink, which rmSync removes without
// following, so the project folder is untouched.
export const dropBundle = (serveUrl: string) => rmSync(serveUrl, { recursive: true, force: true });

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
    // Link the project folder instead of copying it: copies took its renders (GBs of mp4s) along and filled the disk.
    symlinkPublicDir: true,
    onProgress: (p) => activity(`bundling ${p}%`),
  });
}

export const propsOf = (v: VoicedScenes, id: string, tracks: Track[] = [], layout: Layout = "mono"): ExplainerProps => {
  const calm = layout !== "mono";
  const found = musicFor(id, tracks);
  // An explainer plays its track from the top (a slow intro suits it) instead of jumping to the full beat.
  const music = found && calm ? { ...found, start: 0 } : found;
  // null, not a missing key: Remotion merges input props over the composition's defaults, and the fixture has music.
  const props: ExplainerProps = { scenes: v.scenes, words: v.words, audio: v.audio, seed: seedOf(id), music: music ?? null, calm, drawn: drawnOf(id, v.scenes.length) };
  if (layout !== "long") return props;
  // Long videos render 16:9, split screen, with the chapter titles beside the picture, and a new track each chapter:
  // the rotation continues from this video's track, each played from the top.
  const chapters = chaptersOf(readJson<Script>(dir(id, "script.json")));
  const first = found ? tracks.indexOf(found) : 0;
  const chapterMusic = found ? chapters.map((_, k) => ({ ...tracks[(first + k) % tracks.length], start: 0 })) : [];
  return { ...props, wide: true, chapters, chapterMusic };
};
// Explainers rotate through the calm tracks in public/sound/music/calm/; EXPLAINED_MUSIC picks one file there, or "off".
// A track picked for this project (state.music, from the video gate) wins over the .env setting.
export const tracksFor = (activity: (l: string) => void, state: State) => {
  activity("checking the music folder");
  const calm = state.layout !== "mono";
  const run_ = (args: string[]) => run("uv", args);
  return musicLibrary(run_, musicDirFor(state.layout), state.music ?? (calm ? process.env.EXPLAINED_MUSIC : process.env.MONO_MUSIC), calm ? "sound/music/calm" : "sound/music");
};

// One still per scene at its midpoint; returns the file paths. Drawn scenes that crash are added to `failed`.
// shortcut: a drawing that only throws at other frames isn't caught here; it falls back to the library picture there.
// cut collects the DRAW_CUT probe (props.probe).
export async function renderStills(serveUrl: string, props: ExplainerProps, outDir: string, activity: (l: string) => void = () => {}, failed = new Map<number, string>(), cut = new Map<number, string>()) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // One browser for every still, 4 tabs at a time, instead of a fresh browser per still.
  const puppeteerInstance = await openBrowser("chrome", { chromiumOptions });
  try {
    const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps: props, chromiumOptions, envVariables, puppeteerInstance });
    const files = props.scenes.map((_, i) => join(outDir, `scene-${String(i + 1).padStart(2, "0")}.jpeg`));
    const onBrowserLog = ({ text }: { text: string }) => {
      const m = text.match(/DRAW_FAIL (\d+) (.*)/);
      if (m) failed.set(Number(m[1]), m[2].slice(0, 300));
      const c = text.match(/DRAW_CUT (\d+) (.*)/);
      if (c) cut.set(Number(c[1]), c[2].slice(0, 400));
    };
    const queue = [...props.scenes.keys()];
    let done = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        const s = props.scenes[i];
        const frame = Math.round((((s.start ?? 0) + (s.end ?? 0)) / 2) * FPS);
        await renderStill({ serveUrl, composition, inputProps: props, chromiumOptions, envVariables, puppeteerInstance, frame, output: files[i], imageFormat: "jpeg", jpegQuality: 80, scale: 0.5, onBrowserLog });
        activity(`still ${++done}/${props.scenes.length}`);
      }
    }));
    return files;
  } finally {
    await puppeteerInstance.close({ silent: true });
  }
}

// The listed scenes on the vertical canvas (props from tallOf), probed 20%, 50% and 85% in (drawings move things in and
// out, and the camera moves): small stills in outDir; returns scene → the first problem the probe logged.
export async function probeTall(serveUrl: string, props: ExplainerProps, only: number[], outDir: string, activity: (l: string) => void = () => {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const cut = new Map<number, string>();
  const puppeteerInstance = await openBrowser("chrome", { chromiumOptions });
  try {
    const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps: props, chromiumOptions, envVariables, puppeteerInstance });
    const queue = only.flatMap((i) => [20, 50, 85].map((k) => ({ i, k })));
    const total = queue.length;
    let done = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const { i, k } = j;
        const s = props.scenes[i];
        const frame = Math.round(((s.start ?? 0) + (k / 100) * ((s.end ?? 0) - (s.start ?? 0))) * FPS);
        const onBrowserLog = ({ text }: { text: string }) => {
          const m = text.match(/DRAW_CUT (\d+) (.*)/);
          if (m && !cut.has(Number(m[1]))) cut.set(Number(m[1]), `${k}% into the scene: ${m[2].slice(0, 400)}`);
        };
        await renderStill({ serveUrl, composition, inputProps: props, chromiumOptions, envVariables, puppeteerInstance, frame, output: join(outDir, `scene-${String(i + 1).padStart(2, "0")}-${k}.jpeg`), imageFormat: "jpeg", jpegQuality: 70, scale: 0.25, onBrowserLog });
        activity(`checking the Shorts' frames ${++done}/${total}`);
      }
    }));
    return cut;
  } finally {
    await puppeteerInstance.close({ silent: true });
  }
}

// Scene index ranges [a, b) reviewed together: one per chapter in a long video, else the whole video.
export function reviewParts(scenes: { chapter?: number }[]): [number, number][] {
  const starts = scenes.flatMap((s, i) => (i === 0 || (s.chapter && s.chapter !== scenes[i - 1].chapter) ? [i] : []));
  return starts.map((a, k) => [a, starts[k + 1] ?? scenes.length]);
}

// What review.md is told about the frame it checks.
const frameOf = (wide?: boolean) =>
  wide
    ? { frame: "landscape 1920x1080 (16:9) YouTube", unsafe: "important content cut off at the edges of the frame or covered by the chapter titles" }
    : { frame: "vertical 1080x1920", unsafe: "important content inside the unsafe areas (top 220px and bottom 380px are covered by platform UI)" };

// shortcut: bundling and stills don't stop on cancel (they're short); Office discards their result.
export const build: Job = async ({ state, note, activity, signal }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  try {
    const tracks = await tracksFor(activity, state);
    let voiced = readVoiced(state.id);
    // Draw every scene the director gave a shot; a retry keeps the drawings already made (Dot clears them on a new plan).
    const missing = voiced.scenes.flatMap((s, i) => (s.shot && !existsSync(drawPath(state.id, i)) ? [{ i }] : []));
    const undrawn = missing.length ? await drawScenes(state, voiced, missing, activity, signal) : [];
    const fixed: string[] = [];
    const drawnCount = () => voiced.scenes.filter((_, i) => existsSync(drawPath(state.id, i))).length;
    for (let round = 1; round <= 2; round++) {
      const failed = new Map<number, string>();
      const props = propsOf(voiced, state.id, tracks, state.layout);
      // Stills use the video's real canvas: a long video's drawings are made for 16:9, and look broken squeezed into a vertical frame.
      const wideCut = new Map<number, string>();
      const stills = await renderStills(serveUrl, props.wide ? { ...props, probe: true } : props, dir(state.id, "stills"), activity, failed, wideCut);
      const drawn = props.drawn!.flatMap((d, i) => (d ? [i + 1] : []));
      // Only crashed drawings are redrawn (with the error): the reviewer's style redraws cost too much for what they fixed.
      const redo = [...failed].map(([i, e]) => ({ i, note: `Your last drawing of this scene crashed: ${e}. Fix that.` }));
      // Long videos: each drawing must fit the 16:9 frame and, laid out again, its vertical Short. Round 1 redraws one that
      // doesn't (crashed ones are already being redrawn); round 2 pans the Short across it, or reports a wide cut-off.
      if (props.wide) {
        const tall = tallOf(props);
        const native = tall.tallAs!.flatMap((m, i) => (m === "native" && !failed.has(i) ? [i] : []));
        const cut = native.length ? await probeTall(serveUrl, tall, native, dir(state.id, "stills-short"), activity) : new Map<number, string>();
        for (const i of new Set([...wideCut.keys(), ...cut.keys()])) {
          if (failed.has(i)) continue;
          const where = [wideCut.has(i) && `In the 16:9 video: ${wideCut.get(i)}.`, cut.has(i) && `In the vertical Short (1080x1920): ${cut.get(i)}.`].filter(Boolean).join(" ");
          if (round === 1) redo.push({ i, note: `Your last drawing of this scene doesn't fit. ${where} Lay it out for both canvases (see "One drawing, two canvases"); if it truly can't work vertically, export wideOnly.` });
          else if (cut.has(i)) markWideOnly(state.id, i);
          fixed.push(`scene ${i + 1} ${wideCut.has(i) ? "was cut off in the video" : "didn't fit the Short"}, ${round === 1 ? "redrawn" : cut.has(i) ? "its Short pans across it instead" : "left as is"}`);
        }
      }
      let replaced = false;
      // One review per chapter for long videos (~15 frames each instead of ~70 in one call), one for the rest.
      // Round 2 only re-checks the redraws for crashes: a second Opus review of every chapter (and its redraws) burned tokens.
      const parts = round === 1 ? reviewParts(voiced.scenes) : [];
      if (parts.length) activity(parts.length > 1 ? `reviewing ${parts.length} chapters at once` : `reviewing ${stills.length} frames`);
      let reviewed = 0;
      // All chapters are reviewed at once; their fixes touch disjoint scene ranges, so they're applied in order after.
      const reviews = await Promise.all(parts.map(([a, b]) =>
        runClaude({
          model: OPUS,
          prompt: fill("review", { ...frameOf(props.wide), stills: stills.slice(a, b).map((f) => f.replace(dir(state.id) + "/", "")).join(", "), drawn: drawn.filter((n) => n > a && n <= b).join(", ") || "none", scenes: `(scenes ${a + 1}–${b}; the first entry below is scene ${a + 1}, matching the still names)\n${JSON.stringify(voiced.scenes.slice(a, b), null, 1)}` }, note),
          schema: Review,
          tools: ["Read"],
          cwd: dir(state.id),
          onActivity: parts.length > 1 ? undefined : activity,
          signal,
        }).finally(() => parts.length > 1 && activity(`reviewed ${++reviewed}/${parts.length} chapters`)),
      ));
      for (const [k, [a, b]] of parts.entries()) {
        const review = reviews[k];
        if (!review.ok && review.scenes) {
          // The fix may only touch visuals: take just component/props, so narration and timing still match the recorded audio.
          // A list that doesn't line up scene for scene can't be applied; skip it rather than stop the build.
          if (review.scenes.length !== b - a) {
            fixed.push(`skipped a fix for scenes ${a + 1}–${b}: it returned ${review.scenes.length} scenes, not ${b - a}`);
            continue;
          }
          const part = voiced.scenes.slice(a, b).map((s, i) => ({ ...s, component: review.scenes![i].component, props: review.scenes![i].props }) as Scene);
          voiced = { ...voiced, scenes: [...voiced.scenes.slice(0, a), ...part, ...voiced.scenes.slice(b)] };
          writeJson(dir(state.id, "scenes.json"), voiced);
          replaced = true;
        }
        fixed.push(...review.issues);
      }
      fixed.push(...[...failed].map(([i, e]) => `scene ${i + 1} crashed (${e.slice(0, 60)}), redrawn`));
      if (!redo.length && !replaced) break;
      if (redo.length) undrawn.push(...(await drawScenes(state, voiced, redo, activity, signal)));
      if (round === 2) await renderStills(serveUrl, propsOf(voiced, state.id, tracks, state.layout), dir(state.id, "stills"), activity);
    }
    const head = `Drew ${drawnCount()} of ${voiced.scenes.length} scenes for this video.${undrawn.length ? ` Drawing failed for ${undrawn.join("; ")} (those keep their earlier drawing or the library picture).` : ""}`;
    return fixed.length ? `${head} Checked every frame and fixed ${fixed.length} issue(s): ${fixed.slice(0, 2).join("; ")}.` : `${head} Checked every frame, all good.`;
  } finally {
    dropBundle(serveUrl);
  }
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
  try {
    const props = propsOf(readVoiced(state.id), state.id, await tracksFor(activity, state), state.layout);
    const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps: props, chromiumOptions });
    let last = -1;
    const { cancelSignal, cancel } = makeCancelSignal();
    signal.addEventListener("abort", cancel);
    await renderMedia({
      cancelSignal,
      chromiumOptions, envVariables,
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
    // CC BY music must be credited in the post's description (every chapter's track in a long video).
    const credit = [...new Set([props.music, ...(props.chapterMusic ?? [])].flatMap((t) => (t?.credit ? [t.credit] : [])))].join("\n");
    if (credit) writeFileSync(dir(state.id, "credits.txt"), `${credit}\n`);
    // The calm styles' YouTube description: chapter timestamps for a long video (they turn on chapters in YouTube's
    // player), the fact check's sources, the credits and the channel's disclaimer.
    const described = state.layout !== "mono";
    if (described) {
      const fc = existsSync(dir(state.id, "factcheck.json")) ? readJson<FactCheck>(dir(state.id, "factcheck.json")) : { claims: [] };
      const chapters = props.wide && props.chapters?.length ? chapterTimestamps(props.scenes, props.chapters) : [];
      const script = readJson<Script>(dir(state.id, "script.json"));
      writeFileSync(dir(state.id, "description.txt"), videoDescription(script.title, chapters, fc, credit, state.layout !== "built"));
      if (script.pinned_comment) writeFileSync(dir(state.id, "comment.txt"), pinnedComment(script.pinned_comment, !!props.wide));
    }
    const songs = props.chapterMusic?.length ? props.chapterMusic : props.music ? [props.music] : [];
    const song = songs.length ? ` Music: ${[...new Set(songs.map((t) => t.src.split("/").pop()))].join(", ")}.` : " No music (add a sound in TikTok).";
    const desc = described
      ? ` The YouTube description (sources, credits and chapters for a long video) is in description.txt${existsSync(dir(state.id, "comment.txt")) ? ", the comment to pin in comment.txt" : ""}.${props.wide ? ` It ends on ${END_SCREEN} s for an end screen: add one in Studio (a video to watch next and subscribe) over the last ${END_SCREEN} s.` : ""}`
      : credit ? ` Put this in the description: ${credit}` : "";
    return `Video rendered: ${(composition.durationInFrames / FPS).toFixed(1)}s, ${composition.width}x${composition.height}.${song}${desc}`;
  } finally {
    dropBundle(serveUrl);
  }
};

// Chapter k (1-based) of a long video as its own vertical Short: its scenes, words, drawings, track and stretch of the
// voice, shifted to start at 0. The voice stops just after the chapter's last word, before the next chapter starts.
export function chapterShort(v: ExplainerProps, k: number, endCard = "Full video on my channel"): ExplainerProps {
  const a = v.scenes.findIndex((s) => s.chapter === k);
  if (a < 0) throw new Error(`there's no chapter ${k}`);
  const j = v.scenes.slice(a).findIndex((s) => s.chapter !== k);
  const b = j < 0 ? v.scenes.length : a + j;
  const t0 = v.scenes[a].start ?? 0;
  const words = v.words.filter((w) => w.scene >= a && w.scene < b).map((w) => ({ ...w, start: w.start - t0, end: w.end - t0, scene: w.scene - a }));
  const stop = (words.at(-1)?.end ?? 0) + 0.3;
  return {
    scenes: v.scenes.slice(a, b).map((s) => ({ ...s, start: (s.start ?? 0) - t0, end: (s.end ?? 0) - t0 })),
    words,
    audio: v.audio.map((x) => ({ ...x, start: x.start - t0, end: stop })),
    music: v.chapterMusic?.[k - 1] ?? v.music,
    seed: v.seed,
    calm: v.calm,
    drawn: v.drawn?.slice(a, b),
    endCard,
    tallAs: v.drawn?.slice(a, b).map(tallAsOf),
  };
}

// A long video's scenes on the vertical canvas, as its Shorts show them, probing native drawings for cut-offs.
export const tallOf = (v: ExplainerProps): ExplainerProps => ({ ...v, wide: undefined, chapters: undefined, tallAs: v.drawn?.map(tallAsOf), probe: true });

// A Short's 1080x1920 cover: its drawn cover, or a frame from its middle with its title (remotion/Thumbnail.tsx).
export async function shortCover(serveUrl: string, video: ExplainerProps, title: string, output: string, cover?: string) {
  const inputProps = { video, title, cover };
  const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps, chromiumOptions });
  const frames = cover ? [0] : thumbFrames(video.scenes);
  await renderStill({ serveUrl, composition, inputProps, chromiumOptions, envVariables, frame: frames[1] ?? frames[0], output, imageFormat: "jpeg", jpegQuality: 90 });
}

// A video's YouTube description. Sources are the fact check's confirmed ones: showing them is what sets a researched
// explainer apart from template-made content.
export function videoDescription(title: string, chapters: string[], fc: FactCheck, credit: string, disclaimer: boolean): string {
  const sources = [...new Set(fc.claims.flatMap((c) => (c.verdict === "confirmed" && c.source ? [c.source] : [])))];
  return [
    title,
    ...(chapters.length ? ["", "Chapters", ...chapters] : []),
    ...(sources.length ? ["", "Sources", ...sources] : []),
    ...(credit ? ["", "Music", credit] : []),
    ...(disclaimer ? ["", "For educational purposes only. Not financial advice."] : []),
  ].join("\n") + "\n";
}

// The comment to pin under a video: Sky's question, plus the Hype ask on long videos (Hype is for channels under 500K).
export const pinnedComment = (question: string, long: boolean) =>
  `${question}${long ? "\n\nIf this one was worth your time, tap Hype under the video: it's how a small channel like this gets seen." : ""}\n`;

const quoted = (ts: string[]) => ts.map((t) => `"${t}"`).join(", ");

// A Short's YouTube description: its title, its opening line (chapters open cold, so it's the hook), where the full
// video is, and its track's credit.
export function shortDescription(short: ExplainerProps, title: string, videoTitle: string): string {
  const credit = short.music?.credit;
  return [title, "", short.scenes[0]?.narration ?? "", "", `Full video on my channel: "${videoTitle}"`, ...(credit ? ["", credit] : []), "", "#Shorts"].join("\n") + "\n";
}

// After a long video is approved: every chapter as its own vertical Short, shorts/short-{k}.mp4 with its cover
// short-{k}.jpeg and description short-{k}.txt, titled in titles.txt.
export const shorts: Job = async ({ state, activity, signal }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  try {
    const video = propsOf(readVoiced(state.id), state.id, await tracksFor(activity, state), state.layout);
    const titles = video.chapters ?? [];
    const videoTitle = readJson<Script>(dir(state.id, "script.json")).title;
    const out = dir(state.id, "shorts");
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    activity(`drawing ${titles.length} Short covers`);
    const covers = await Promise.all(titles.map((t, i) => drawCover(state, `short-${i + 1}`, t, video.scenes.filter((s) => s.chapter === i + 1).map((s) => s.narration ?? ""), false, signal, `This is one Short in a series cut from one video; the others are titled: ${quoted(titles.filter((_, j) => j !== i))}. They get their own covers, so build yours on what is distinctive in YOUR lines: never their hero or their words, even when your lines mention them.`)));
    const { cancelSignal, cancel } = makeCancelSignal();
    signal.addEventListener("abort", cancel);
    for (const [i, title] of titles.entries()) {
      const inputProps = chapterShort(video, i + 1);
      const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, chromiumOptions });
      let last = -1;
      await renderMedia({
        cancelSignal,
        chromiumOptions, envVariables,
        serveUrl,
        composition,
        inputProps,
        codec: "h264",
        outputLocation: join(out, `short-${i + 1}.mp4`),
        ffmpegOverride: louder,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) activity(`Short ${i + 1}/${titles.length}: "${title}" ${(last = pct)}%`);
        },
      });
      writeFileSync(join(out, `short-${i + 1}.txt`), shortDescription(inputProps, title, videoTitle));
      activity(`Short ${i + 1}/${titles.length}: its cover`);
      await shortCover(serveUrl, inputProps, title, join(out, `short-${i + 1}.jpeg`), covers[i] ?? undefined);
    }
    writeFileSync(join(out, "titles.txt"), titles.map((t, i) => `short-${i + 1}.mp4  ${t}`).join("\n") + "\n");
    return `Cut ${titles.length} Shorts (1080x1920, one per chapter, each ending on "Full video on my channel", each with a drawn short-{n}.jpeg cover and short-{n}.txt description) into projects/${state.id}/shorts/; their titles are in shorts/titles.txt. When you upload each Short, set its Related video to the full video (in the Short's details), the one link a Shorts viewer can tap.`;
  } finally {
    dropBundle(serveUrl);
  }
};

// Runs after you approve the video: the thumbnails, then for a long video its chapters as Shorts.
export const afterApprove: Job = async (ctx) => {
  const covers = await thumbs(ctx);
  return ctx.state.layout === "long" ? `${covers} ${await shorts(ctx)}` : covers;
};

// YouTube chapter timestamps for a long video's description: the first must be 0:00 (YouTube's rule).
export function chapterTimestamps(scenes: { chapter?: number; start?: number }[], chapters: string[]): string[] {
  const at = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return chapters.map((t, k) => `${at(k === 0 ? 0 : (scenes.find((s) => s.chapter === k + 1)?.start ?? 0))} ${t}`);
}

// Text-only scenes would clash with the cover title.
const WORDY = new Set(["HookCard", "Callout", "BigWord", "Split"]);
// Three covers from early, middle and late in the video (each 70% into its scene, after the entrance animation).
export function thumbFrames(scenes: { component: string; start?: number; end?: number }[]): number[] {
  const pool = scenes.filter((s) => !WORDY.has(s.component));
  const from = pool.length >= 3 ? pool : scenes;
  const picks = [...new Set([0.15, 0.5, 0.85].map((k) => from[Math.min(from.length - 1, Math.floor(k * from.length))]))];
  return picks.map((s) => Math.round(((s.start ?? 0) + 0.7 * ((s.end ?? (s.start ?? 0) + 3) - (s.start ?? 0))) * FPS));
}

// Runs after you approve the video: thumbs/thumb-1.jpeg, a drawn cover (prompts/cover.md), 1080x1920 for YouTube
// Shorts and Meta Reels (1920x1080 for a long video); if it can't be drawn, thumb-{1,2,3}.jpeg frames with the title.
export const thumbs: Job = async ({ state, activity, signal }) => {
  const serveUrl = await bundleFor(dir(state.id), activity, true);
  try {
    const video = propsOf(readVoiced(state.id), state.id, await tracksFor(activity, state), state.layout);
    const script = readJson<Script>(dir(state.id, "script.json"));
    const title = script.title;
    const out = dir(state.id, "thumbs");
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const lines = video.scenes.map((s) => s.narration ?? "");
    activity("drawing the thumbnail");
    const drawn = (await drawCover(state, "video", title, lines, !!video.wide, signal)) ?? undefined;
    const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps: { video, title, cover: drawn }, chromiumOptions });
    // A cover at the size a phone shows it (360 px wide): Sonnet looks at it there, and it's redrawn once with what
    // didn't read. Only this video's covers; the chapter Shorts' covers aren't checked.
    const atPhoneSize = async (name: string, t: string, c: string, others = ""): Promise<string> => {
      const small = `covers/${name}-phone.jpeg`;
      try {
        await renderStill({ serveUrl, composition, inputProps: { video, title: t, cover: c }, chromiumOptions, envVariables, frame: 0, output: dir(state.id, small), imageFormat: "jpeg", jpegQuality: 90, scale: 360 / composition.width });
        activity(`checking ${name === "video" ? "the thumbnail" : name} at phone size`);
        const check = await runClaude({ model: SONNET, prompt: fill("cover-check", { file: small, title: t, px: "360" }), schema: CoverCheck, tools: ["Read"], cwd: dir(state.id), signal });
        if (check.ok) return c;
        activity(`redrawing: ${check.note.slice(0, 60)}`);
        return (await drawCover(state, name, t, lines, !!video.wide, signal, others, `At phone size (360 px wide) your last cover didn't read: ${check.note}`)) ?? c;
      } catch (e) {
        if (signal.aborted) throw e;
        return c; // the check is a bonus: if it can't run, the cover ships as drawn
      }
    };
    const cover = drawn && (await atPhoneSize("video", title, drawn));
    const frames = cover ? [0] : thumbFrames(video.scenes);
    const inputProps = { video, title, cover };
    for (const [i, frame] of frames.entries()) {
      activity(`thumbnail ${i + 1}/${frames.length}`);
      await renderStill({ serveUrl, composition, inputProps, chromiumOptions, envVariables, frame, output: join(out, `thumb-${i + 1}.jpeg`), imageFormat: "jpeg", jpegQuality: 90 });
    }
    const size = video.wide ? "1920x1080, for the YouTube video" : "1080x1920, for YouTube Shorts and Reels";
    // Long videos: one more drawn cover per alternative title, so YouTube's Test & Compare gets up to 3 title +
    // thumbnail pairs (it picks by watch time; Shorts can't be tested, so they keep one cover).
    const alts = video.wide && cover ? (script.alt_titles ?? []).slice(0, 2) : [];
    const pairs = [`thumb-1.jpeg  ${title}`];
    for (const [i, alt] of alts.entries()) {
      activity(`drawing test thumbnail ${i + 2}`);
      const others = `This is one of ${alts.length + 1} title + thumbnail pairs YouTube tests against each other for the same video; the other titles are ${quoted([title, ...alts].filter((t) => t !== alt))}. Build yours on a different hero or contrast from the opening lines than theirs would, so the test compares real alternatives.`;
      const first = await drawCover(state, `video-${i + 2}`, alt, lines, true, signal, others);
      if (!first) continue;
      const c = await atPhoneSize(`video-${i + 2}`, alt, first, others);
      await renderStill({ serveUrl, composition, inputProps: { video, title: alt, cover: c }, chromiumOptions, envVariables, frame: 0, output: join(out, `thumb-${pairs.length + 1}.jpeg`), imageFormat: "jpeg", jpegQuality: 90 });
      pairs.push(`thumb-${pairs.length + 1}.jpeg  ${alt}`);
    }
    if (pairs.length > 1) {
      writeFileSync(join(out, "titles.txt"), pairs.join("\n") + "\n");
      return `Drew ${pairs.length} title + thumbnail pairs (${size}) in projects/${state.id}/thumbs/, listed in thumbs/titles.txt: upload them all to Test & Compare in YouTube Studio (it keeps the pair people watch longest).`;
    }
    return cover ? `Drew the thumbnail (${size}): projects/${state.id}/thumbs/thumb-1.jpeg.` : `Made ${frames.length} thumbnails (${size}) in projects/${state.id}/thumbs/.`;
  } finally {
    dropBundle(serveUrl);
  }
};
