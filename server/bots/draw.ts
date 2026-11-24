import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { z } from "zod";
import { ROOT, dir, type State } from "../project.ts";
import { OPUS, runClaude } from "../claude.ts";
import { fill } from "./claude-bots.ts";
import type { VoicedScenes } from "./voice.ts";

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
  if (!/export\s+default/.test(code)) out.push("it has no `export default` component");
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

// A library component's source, as an example of the drawing style.
function sourceOf(file: string, name: string): string {
  const src = readFileSync(join(ROOT, "remotion", "components", file), "utf8");
  const a = src.lastIndexOf("\n//", src.indexOf(`export function ${name}(`));
  return src.slice(a, src.indexOf("\nexport ", a + 3)).trim();
}

const Drawing = z.object({ code: z.string().min(80) });

// Draws the listed scenes, 4 at a time. A scene that fails twice keeps its library picture; returns those failures.
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
        model: OPUS,
        prompt: fill("draw", vars, note),
        schema: Drawing.superRefine((x, ctx) => checkDrawing(x.code).forEach((message) => ctx.addIssue({ code: "custom", path: ["code"], message }))),
        signal,
      });
      writeFileSync(drawPath(state.id, i), out.code);
    } catch (e) {
      if (signal.aborted) throw e;
      failed.push(`scene ${i + 1}: ${(e as Error).message.slice(0, 120)}`);
    }
    activity(`drew ${++done}/${todo.length} scenes`);
  };
  const queue = [...todo];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let x = queue.shift(); x; x = queue.shift()) await one(x);
  }));
  return failed;
}
