import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { z } from "zod";
import { ROOT, dir, type State } from "../project.ts";
import { OPUS, SONNET, runClaude } from "../claude.ts";
import { fill } from "./claude-bots.ts";
import type { VoicedScenes } from "./voice.ts";
import type { TallAs } from "../../remotion/Explainer.tsx";

// Each scene with a shot gets its own picture, written as a small component in the library's drawing kit, so no two
// videos (or scenes) show the same stock drawing with a new label. The library component stays as the fallback.
export const drawPath = (id: string, i: number) => dir(id, "draw", `scene-${String(i + 1).padStart(2, "0")}.tsx`);

// TSX → CommonJS for remotion/drawn.tsx to run; throws on a syntax error.
export const toJs = (tsx: string) => transformSync(tsx, { loader: "tsx", format: "cjs", jsx: "automatic", target: "es2022" }).code;

// Mirrors remotion/drawn.tsx IMPORTS (that file pulls in the Remotion runtime, so it isn't imported here).
const IMPORTS = ["react", "react/jsx-runtime", "remotion", "kit"];

// Problems that would make the drawing crash or vary between frames; empty when it's fine.
export function checkDrawing(code: string): string[] {
  const out: string[] = [];
  try {
    toJs(code);
  } catch (e) {
    out.push(`it doesn't compile: ${(e as Error).message.slice(0, 400)}`);
  }
  for (const [, m] of code.matchAll(/from\s+["']([^"']+)["']/g)) if (!IMPORTS.includes(m)) out.push(`it imports "${m}"; only ${IMPORTS.join(", ")} are available`);
  if (/Math\.random|Date\.now|new Date/.test(code)) out.push("it uses Math.random or the clock; every frame must be a pure function of useCurrentFrame()");
  if (/(?<![.\w])(pop|ease|clamp)\s*\(/.test(code)) out.push("it calls pop, ease or clamp as a function; they're interpolate options objects, passed as k01's 4th argument: k01(f, a, b, pop)");
  if (!/export\s+default/.test(code)) out.push("it has no `export default` component");
  // A home-made stage() is fixed to one canvas; the kit's follows the one the drawing plays on.
  if (/function\s+stage\s*\(|(const|let|var)\s+stage\s*=/.test(code)) out.push('it defines its own stage(); import stage from "kit" instead (it changes with the canvas)');
  return out;
}

// Each scene's drawing as JS, or null where there's none (or it no longer compiles: the library picture plays).
export function drawnOf(id: string, n: number): (string | null)[] {
  return Array.from({ length: n }, (_, i) => {
    const f = drawPath(id, i);
    if (!existsSync(f)) return null;
    try {
      return toJs(readFileSync(f, "utf8"));
    } catch {
      return null;
    }
  });
}

// How a long video's drawing (compiled JS) shows in its vertical Shorts, from the markers its file exports (esbuild's
// CommonJS lists each export as `name: () => name`): see remotion/Explainer.tsx TallAs.
export const tallAsOf = (js: string | null): TallAs => (js === null ? null : /\bwideOnly: \(\) =>/.test(js) ? "pan" : /\bresponsive: \(\) =>/.test(js) ? "native" : "box");

// Gives up on a drawing's vertical layout: its Shorts pan across the wide one instead.
export function markWideOnly(id: string, i: number) {
  const f = drawPath(id, i);
  if (existsSync(f) && !/export const wideOnly\b/.test(readFileSync(f, "utf8"))) appendFileSync(f, "\nexport const wideOnly = true;\n");
}

// A library component's source, as an example of the drawing style.
function sourceOf(file: string, name: string): string {
  const src = readFileSync(join(ROOT, "remotion", "components", file), "utf8");
  const a = src.lastIndexOf("\n//", src.indexOf(`export function ${name}(`));
  return src.slice(a, src.indexOf("\nexport ", a + 3)).trim();
}

const Drawing = z.object({ code: z.string().min(80) });

// Draws the listed scenes, several at a time. A scene that fails twice keeps its library picture; returns those failures.
export async function drawScenes(state: State, v: VoicedScenes, todo: { i: number; note?: string }[], activity: (l: string) => void, signal: AbortSignal): Promise<string[]> {
  mkdirSync(dir(state.id, "draw"), { recursive: true });
  const shots = v.scenes.map((s, i) => `${i + 1}. ${s.shot ?? `(${s.component}, from the library)`}`).join("\n");
  const examples = [sourceOf("Built.tsx", "Masonry"), sourceOf("Ancient.tsx", "Obelisk")].join("\n\n");
  const failed: string[] = [];
  let done = 0;
  const one = async ({ i, note }: { i: number; note?: string }) => {
    const s = v.scenes[i];
    const secs = (s.end ?? 0) - (s.start ?? 0);
    const words = v.words.filter((w) => w.scene === i).map((w) => `${w.word}@${(w.start - (s.start ?? 0)).toFixed(2)}`).join(" ");
    const vars = { topic: state.topic, n: String(i + 1), shot: s.shot ?? "", narration: s.narration, secs: secs.toFixed(1), frames: String(Math.round(secs * 30)), words, hit: s.hit ?? "none", label: "label" in s.props && s.props.label ? s.props.label : "none", shots, examples };
    try {
      const out = await runClaude({
        // Sonnet: ~80 drawings per long video; Opus stays on script, scene direction and review.
        model: SONNET,
        // Long videos are drawn for the wide 1920x1080 canvas (prompts/draw-long.md).
        prompt: fill("draw", vars, note, ...(state.layout === "long" ? ["long"] : [])),
        schema: Drawing.superRefine((x, ctx) => checkDrawing(x.code).forEach((message) => ctx.addIssue({ code: "custom", path: ["code"], message }))),
        signal,
      });
      // Long videos' drawings are made for both canvases; the marker tells their Shorts to play them as they are.
      const responsive = state.layout === "long" && !/export const responsive\b/.test(out.code);
      writeFileSync(drawPath(state.id, i), responsive ? `${out.code}\nexport const responsive = true;\n` : out.code);
    } catch (e) {
      if (signal.aborted) throw e;
      failed.push(`scene ${i + 1}: ${(e as Error).message.slice(0, 120)}`);
    }
    activity(`drew ${++done}/${todo.length} scenes`);
  };
  const queue = [...todo];
  // A long video's ~70 drawings go 6 at a time; the short styles' few drawings 4 at a time.
  await Promise.all(Array.from({ length: state.layout === "long" ? 6 : 4 }, async () => {
    for (let x = queue.shift(); x; x = queue.shift()) await one(x);
  }));
  return failed;
}

// A drawn thumbnail (prompts/cover.md): projects/{id}/covers/{name}.tsx, compiled. An existing file is kept (redraw by
// deleting it, or edit it by hand); null when it can't be drawn, so the frame-and-title cover is used instead.
// `others`: the titles of the covers drawn beside this one (a long video's Shorts), so each gets its own idea.
export async function drawCover(state: State, name: string, title: string, lines: string[], wide: boolean, signal: AbortSignal, others: string[] = []): Promise<string | null> {
  const f = dir(state.id, "covers", `${name}.tsx`);
  if (!existsSync(f)) {
    const vars = {
      topic: state.topic,
      title,
      lines: lines.map((l) => `- ${l}`).join("\n"),
      others: others.length ? `\nThis is one Short in a series cut from one video; the others are titled: ${others.map((t) => `"${t}"`).join(", ")}. They get their own covers, so build yours on what is distinctive in YOUR lines: never their hero or their words, even when your lines mention them.\n` : "",
      size: wide ? "1920x1080, the YouTube video's thumbnail" : "1080x1920, the cover of a YouTube Short and a Facebook/Instagram Reel",
      format: wide
        ? "Safe area: keep everything that matters 60 px from the edges, and the bottom-right corner (x > 1650, y > 950) free: YouTube puts the duration there."
        : "Safe area: everything that matters stays inside x 90–990, y 300–1600 (the profile grid crops to the centre 3:4, the Shorts player covers the bottom). Stack it: the words in the top third, the hero in the middle, the mascot low.",
      example: readFileSync(join(ROOT, "prompts", "cover-example.tsx"), "utf8").trim(),
    };
    try {
      // Opus: one or a few covers per video, and they decide the click.
      const out = await runClaude({ model: OPUS, prompt: fill("cover", vars), schema: Drawing.superRefine((x, ctx) => checkDrawing(x.code).forEach((message) => ctx.addIssue({ code: "custom", path: ["code"], message }))), signal });
      mkdirSync(dir(state.id, "covers"), { recursive: true });
      writeFileSync(f, out.code);
    } catch (e) {
      if (signal.aborted) throw e;
      return null;
    }
  }
  try {
    return toJs(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}
