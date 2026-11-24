import { AbsoluteFill, HtmlInCanvas, Solid, interpolate, useCurrentFrame, type EffectDescriptor } from "remotion";
import { filmBurn } from "@remotion/effects/film-burn";
import { grayscale } from "@remotion/effects/grayscale";
import { lightLeak } from "@remotion/effects/light-leak";
import { pixelDissolve } from "@remotion/effects/pixel-dissolve";
import { venetianBlinds } from "@remotion/effects/venetian-blinds";
import { zoomBlur } from "@remotion/effects/zoom-blur";
import type { Scene } from "../server/schemas.ts";
import { FPS, H, W } from "./theme.ts";
import { OUTRO, lookFor, transitionFor } from "./mono.ts";

// Post-processing with Remotion's WebGL effects (@remotion/effects, 4.0.5xx). Renders need WebGL: every render call
// passes chromiumOptions.gl = "angle" (server/bots/remotion.ts) and remotion.config.ts sets it for Studio.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Frames an effect transition takes to reveal a new scene.
const REVEAL = 10;

// The WebGL effects at frame f: an effect transition (pixel dissolve, blinds, film burn) as a scene enters, and a
// radial zoom blur on each hit. Empty on most frames, so the canvas only runs where it's needed.
export function effectsAt(scenes: Scene[], hits: number[], seed: number, f: number): EffectDescriptor[] {
  const t = f / FPS;
  const fx: EffectDescriptor[] = [];
  let i = -1;
  for (let k = 0; k < scenes.length; k++) if (t >= (scenes[k].start ?? 0)) i = k;
  if (i > 0) {
    const k = (f - Math.round((scenes[i].start ?? 0) * FPS)) / REVEAL;
    const tr = transitionFor(i, scenes[i], seed);
    if (k < 1 && tr === "dissolve") fx.push(pixelDissolve({ progress: 1 - k, columns: 18, rows: 32, seed: i }));
    if (k < 1 && tr === "blinds") fx.push(venetianBlinds({ progress: 1 - k, slats: 12, direction: i % 2 ? "horizontal" : "vertical" }));
    if (k < 1 && tr === "burn") fx.push(filmBurn({ progress: 1 - k, seed: i }), grayscale({ amount: 1 })); // the burn is orange; keep it mono
  }
  const since = Math.min(9, ...hits.map((h) => (t >= h ? t - h : 9)));
  if (since < 0.35) fx.push(zoomBlur({ amount: 36 * Math.exp(-since * 12), samples: 16 }));
  return fx;
}

// The scene picture, through the effects canvas only on the frames that have effects.
export function FxLayer({ scenes, hits, seed, children }: { scenes: Scene[]; hits: number[]; seed: number; children: React.ReactNode }) {
  const fx = effectsAt(scenes, hits, seed, useCurrentFrame());
  if (!fx.length) return <>{children}</>;
  return (
    <HtmlInCanvas width={W} height={H} effects={fx}>
      <AbsoluteFill>{children}</AbsoluteFill>
    </HtmlInCanvas>
  );
}

// The project's film look, drawn in SVG/CSS (not WebGL) so it never needs a canvas: TV scanlines or heavy grain.
export function FilmLook({ seed }: { seed: number }) {
  const f = useCurrentFrame();
  const look = lookFor(seed);
  if (look === "scanlines")
    return <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0 3px, transparent 3px 7px)", backgroundPositionY: f * 0.6 }} />;
  if (look === "noise")
    return (
      <svg viewBox="0 0 360 640" preserveAspectRatio="none" style={{ position: "absolute", width: W, height: H, opacity: 0.16, mixBlendMode: "overlay" }}>
        <filter id="heavygrain">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves={2} seed={f % 37} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={360} height={640} filter="url(#heavygrain)" />
      </svg>
    );
  return null;
}

// A monochrome light leak washes over the drop and over the outro.
export function LightLeaks({ drop, end, seed }: { drop: number; end: number; seed: number }) {
  const f = useCurrentFrame();
  const leak = (at: number, dur: number) => interpolate(f, [at * FPS, (at + dur) * FPS], [0, 1], clamp);
  const [a, b] = [leak(drop - 0.1, 1.4), leak(end - OUTRO, OUTRO - 0.5)];
  const p = a > 0 && a < 1 ? a : b > 0 && b < 1 ? b : 0;
  if (!p) return null;
  return <Solid width={W} height={H} style={{ position: "absolute", mixBlendMode: "screen", opacity: 0.35 }} effects={[lightLeak({ progress: p, seed: seed % 97 }), grayscale({ amount: 1 })]} />;
}
