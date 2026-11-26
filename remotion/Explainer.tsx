import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { Audio } from "@remotion/media";
import type { Scene, Word } from "../server/schemas.ts";
import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, FPS, H, MONO, SAFE, W, WIDE_CANVAS, font, stage, type Theme } from "./theme.ts";
import { Callout, HookCard } from "./components/Cards.tsx";
import { Bars, Battery, Boulder, Bridge, Bulb, Fork, Gauge, Jar, Ladder, Lock, Mirror, Puzzle, Storm, Target, Train, Wallet } from "./components/Objects.tsx";
import { BigWord, Boxing, Bricks, Chains, Dominoes, Hourglass, Rocket, Rush, Scale, Stage, Traffic, Tree, Wheel, Window, Calendar, Car, Cash, Chart, Climb, Clock, Crowd, Door, Fall, Grind, Lift, Phone, Plan, PullUp, RainWalk, Run, Split, Summit } from "./components/Mono.tsx";
import * as Money from "./components/Money.tsx";
import * as Economy from "./components/Economy.tsx";
import * as Mind from "./components/Mind.tsx";
import * as Nature from "./components/Nature.tsx";
import * as Action from "./components/Action.tsx";
import * as Life from "./components/Life.tsx";
import * as Ancient from "./components/Ancient.tsx";
import * as Built from "./components/Built.tsx";
import * as Relics from "./components/Relics.tsx";
import { MonoCaptions, MonoFrame, MonoMotion, MonoSound } from "./MonoLayer.tsx";
import { LightLeaks } from "./MonoFx.tsx";
import { Drawn } from "./drawn.tsx";
import { Backdrop, Defs } from "./Brand.tsx";
import { Figure, STAND } from "./components/Mono.tsx";
import { END_SCREEN, OUTRO, backdropFor, dropAt, hitTime, videoEnd, type Track } from "./mono.ts";

export type ExplainerProps = {
  scenes: Scene[];
  words: Word[];
  // start: video seconds the file starts at (negative: it started before this video, as in a Short cut from a long
  // video); end: video seconds it stops at, if it runs on past what this video should play.
  audio: { src: string; start: number; end?: number }[];
  // Motivation style: the music track (its drop is aligned to the first payoff) plus auto-placed sound effects.
  music?: Track | null;
  // Per project (seedOf(id)): varies the backdrop, film look, camera moves, transitions and mirrored scenes.
  seed?: number;
  // Explainer style: fades between scenes, no beat pulse or hit shakes (MonoLayer.tsx).
  calm?: boolean;
  // Per scene: its own drawing compiled to JS (server/bots/draw.ts), or null to play the library component.
  drawn?: (string | null)[];
  // Off for thumbnails (remotion/Thumbnail.tsx), which put the title there instead.
  captions?: boolean;
  // Long videos: 16:9, full width. Drawings are made for the wide canvas; library pictures sit centred, cropped to their
  // stage. Captions run along the bottom and each chapter opens on a title card.
  wide?: boolean;
  // Long videos: chapter titles; scene.chapter (1-based) points into this.
  chapters?: string[];
  // Long videos: chapter k's music is chapterMusic[k-1], each played from the top and crossfaded into the next.
  chapterMusic?: Track[];
  // Shorts cut from a long video: a line shown over the outro ("Full video on my channel").
  endCard?: string;
  // Shorts cut from a long video, per scene: how its 16:9-era drawing shows in the vertical frame. "native": drawn
  // responsive, it lays itself out for the tall canvas; "pan": too wide to rearrange, the camera pans across it;
  // "box": an older wide-only drawing, shown whole across the frame. Unset: native.
  tallAs?: TallAs[];
  // Build check (renderStills): log DRAW_CUT for drawings (wide, or native in a Short) with shapes out of place (Probe).
  probe?: boolean;
};
export type TallAs = "native" | "pan" | "box" | null;

// The 16:9 frame. A library picture is drawn on the vertical canvas inside stage() (about y 480–1520); Portrait shows
// that square plus a margin at full height, centred.
export const WIDE = { ...WIDE_CANVAS, cropTop: 440, cropH: 1120 };
const ART = WIDE.H / WIDE.cropH;
function Portrait({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: (WIDE.W - W * ART) / 2, top: 0, width: W, height: H, transform: `scale(${ART}) translateY(${-WIDE.cropTop}px)`, transformOrigin: "0 0" }}>
      <Canvas.Provider value={{ W, H }}>{children}</Canvas.Provider>
    </div>
  );
}

// A 16:9 drawing in the vertical frame: the wide stage (x 100–1820) fills the width, centred under the captions.
const FIT = W / 1720;
function Landscape({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: (W - WIDE.W * FIT) / 2, top: stage(MONO).cy - (WIDE.H * FIT) / 2, width: WIDE.W, height: WIDE.H, transform: `scale(${FIT})`, transformOrigin: "0 0", overflow: "hidden" }}>
      <Canvas.Provider value={WIDE_CANVAS}>{children}</Canvas.Provider>
    </div>
  );
}

// A wide-only drawing in a vertical Short: at full size, the camera pans across its stage over the scene.
const WS = stage({ ...MONO, wide: true });
function Pan({ dur, children }: { dur: number; children: React.ReactNode }) {
  const x = interpolate(useCurrentFrame(), [0, dur], [-WS.left, W - WS.right], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 0, top: stage(MONO).cy - WS.cy, width: WIDE.W, height: WIDE.H, transform: `translateX(${x}px)` }}>
      <Canvas.Provider value={WIDE_CANVAS}>{children}</Canvas.Provider>
    </div>
  );
}

// Shapes a drawing leaves cut off by the frame edge or up in the captions / under the platform UI (the vertical
// canvas), in its SVG's own units so camera moves don't count. Long shapes (ground, roads, backdrops) may bleed past on
// purpose; fully off-frame or invisible ones are ignored.
function Probe({ i, children }: { i: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { W, H } = useContext(Canvas);
  useLayoutEffect(() => {
    const M = 8;
    const st = stage(MONO);
    const cut: string[] = [];
    for (const el of ref.current?.querySelectorAll<SVGGraphicsElement>("svg rect, svg circle, svg ellipse, svg path, svg line, svg polygon, svg polyline, svg text") ?? []) {
      if (el.closest("defs, filter, clipPath, mask, pattern")) continue;
      // How solid it is: its group opacity times its strongest paint (Ground's faint perspective lines don't count).
      let op = 1;
      for (let n: Element | null = el; n && n.tagName !== "svg"; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      const cs = getComputedStyle(el);
      const paint = (c: string, o: string) => (c === "none" || c === "rgba(0, 0, 0, 0)" ? 0 : Number(o));
      if (op * Math.max(paint(cs.stroke, cs.strokeOpacity), /^(line|polyline)$/.test(el.tagName) ? 0 : paint(cs.fill, cs.fillOpacity)) < 0.2) continue;
      const b = el.getBBox(), m = el.getCTM();
      if (!m) continue;
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
      const [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
      const across = (a: number, z: number, edge: number) => a < edge - M && z > edge + M;
      if (x1 - x0 >= 0.8 * W || y1 - y0 >= 0.8 * H || x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
      const why = across(x0, x1, 0) || across(x0, x1, W) || across(y0, y1, 0) || across(y0, y1, H) ? "cut off by the frame edge"
        : W > H ? ""
        // The camera's push-ins and slides crop the ~70 px outside the stage's sides on the vertical canvas.
        : x0 < st.left - 20 || x1 > st.right + 20 ? `past the stage's side (keep within x ${st.left}–${st.right}; the camera crops the rest)`
        : y0 < st.top - 40 ? `up in the captions (keep below y ${st.top})`
        : y1 > H - SAFE.bottom + 40 ? `under the platform UI (keep above y ${H - SAFE.bottom})` : "";
      if (why) cut.push(`a <${el.tagName}> at x ${Math.round(x0)}–${Math.round(x1)}, y ${Math.round(y0)}–${Math.round(y1)}: ${why}`);
    }
    if (cut.length) console.log(`DRAW_CUT ${i} ${cut.length} shape(s) out of place on the ${W}x${H} canvas, e.g. ${cut.slice(0, 3).join("; ")}`);
  });
  return <div ref={ref}>{children}</div>;
}

const VISUALS: Record<Scene["component"], React.FC<{ p: any; t: Theme; dur: number; w?: { word: string; start: number }[]; hit?: number }>> = {
  HookCard,
  Callout,
  Crowd,
  PullUp,
  Grind,
  RainWalk,
  Climb,
  Run,
  BigWord,
  Split,
  Lift,
  Boxing,
  Fall,
  Summit,
  Clock,
  Chart,
  Cash,
  Plan,
  Car,
  Phone,
  Calendar,
  Door,
  Bricks,
  Traffic,
  Rush,
  Dominoes,
  Hourglass,
  Scale,
  Rocket,
  Tree,
  Window,
  Wheel,
  Chains,
  Stage,
  Ladder,
  Bridge,
  Storm,
  Mirror,
  Target,
  Bulb,
  Boulder,
  Wallet,
  Lock,
  Puzzle,
  Train,
  Bars,
  Gauge,
  Jar,
  Battery,
  Fork,
  ...Money,
  ...Economy,
  ...Mind,
  ...Nature,
  ...Action,
  ...Life,
  ...Ancient,
  ...Built,
  ...Relics,
};

// Long videos end on END_SCREEN seconds of the mascot pointing at empty space, where YouTube's end-screen elements
// (a video to watch next, subscribe) go. Shorts have none.
export const tailOf = (p: Pick<ExplainerProps, "wide" | "endCard">) => (p.wide && !p.endCard ? END_SCREEN : 0);

function EndScreen() {
  const k = interpolate(useCurrentFrame(), [0, 0.8 * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const { W: w, H: h } = WIDE_CANVAS;
  return (
    <AbsoluteFill style={{ background: "#000", opacity: k }}>
      <svg width={w} height={h}>
        <Defs />
        <Backdrop w={w} h={h} />
        {/* Left third only: the rest stays empty for the end-screen cards. */}
        <Figure x={330} ground={960} s={1.4} pose={STAND} front hands={[[-52, -40], [172, -175]]} />
        <text x={1240} y={170} textAnchor="middle" fill="#fff" style={{ font: `400 84px ${font.impact}`, letterSpacing: 4 }}>WATCH NEXT</text>
      </svg>
    </AbsoluteFill>
  );
}

export const calculateMetadata: CalculateMetadataFunction<ExplainerProps> = ({ props }) => {
  return { durationInFrames: Math.ceil((videoEnd(props.scenes) + tailOf(props)) * FPS), fps: FPS, width: props.wide ? WIDE.W : W, height: props.wide ? WIDE.H : H };
};

// Mono backdrops: one per project (backdropFor), all faint so the figures stay on top.
function MonoBackdrop({ seed }: { seed: number }) {
  const f = useCurrentFrame();
  const { W, H } = useContext(Canvas);
  const kind = backdropFor(seed);
  const dust = (n: number, rise: number, op: number) =>
    Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={((i * 397 + seed) % W) + 12 * Math.sin(f / 40 + i)} cy={(((i * 263 - f * rise * (0.6 + (i % 3) * 0.4)) % H) + H) % H} r={(i % 3) + 1.5} fill="#fff" opacity={op} />
    ));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${kind === "beams" ? 10 : 45}%, #181818, #000 72%)` }}>
      <svg width={W} height={H}>
        <defs>
          <pattern id="dots" width="44" height="44" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="2" fill="#fff" opacity="0.09" />
          </pattern>
          <linearGradient id="beamfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {kind === "dust" && (
          <>
            <rect width={W} height={H} fill="url(#dots)" />
            {dust(30, 1, 0.18)}
          </>
        )}
        {/* Stage lights sweeping from above. */}
        {kind === "beams" &&
          [-1, 0, 1].map((k) => {
            const a = k * 18 + Math.sin(f / 50 + k * 2) * 8;
            return <path key={k} d={`M ${W / 2 + k * 260} -40 L ${W / 2 + k * 260 - 260} ${H} L ${W / 2 + k * 260 + 260} ${H} Z`} fill="url(#beamfade)" transform={`rotate(${a} ${W / 2 + k * 260} -40)`} />;
          })}
        {kind === "beams" && dust(20, 0.4, 0.14)}
        {/* A dark city on the horizon, a few windows lit, slow drift. */}
        {kind === "skyline" && (
          <g opacity={0.22} transform={`translate(${-((f * 0.3) % 160)} 0)`}>
            {Array.from({ length: 10 }, (_, i) => {
              const w = 120 + ((i * 53 + seed) % 70);
              const h = 260 + ((i * 197 + seed) % 520);
              const x = i * 150;
              return (
                <g key={i}>
                  <rect x={x} y={H - h} width={w} height={h} fill="#0d0d0d" stroke="#fff" strokeWidth={2} />
                  {Array.from({ length: 8 }, (_, j) => ((i * 7 + j * 3 + seed) % 5 === 0 ? <rect key={j} x={x + 20 + (j % 3) * 32} y={H - h + 30 + Math.floor(j / 3) * 60} width={16} height={24} fill="#fff" opacity={0.7} /> : null))}
                </g>
              );
            })}
          </g>
        )}
        {/* Sparks rising off a fire just below the frame. */}
        {kind === "embers" && (
          <>
            <rect y={H * 0.6} width={W} height={H * 0.4} fill="url(#beamfade)" transform={`rotate(180 ${W / 2} ${H * 0.8})`} />
            {dust(45, 2.4, 0.26)}
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
}

// The ending: the held last scene fades to black over the outro's last 1.5 s.
function FadeOut({ total }: { total: number }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [total - 1.5 * FPS, total - 0.2 * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return k > 0 ? <AbsoluteFill style={{ background: "#000", opacity: k }} /> : null;
}

// Long videos' captions, along the bottom: a phrase at a time (up to 8 words, broken at sentence ends), each word
// lighting up as it's said.
function WideCaptions({ words }: { words: Word[] }) {
  const now = useCurrentFrame() / FPS;
  const groups = useMemo(() => {
    const out: Word[][] = [];
    for (const w of words) {
      const g = out.at(-1);
      if (!g || g.length >= 8 || g[0].scene !== w.scene || /[.!?]$/.test(g.at(-1)!.word) || (g.length >= 4 && /[,:;]$/.test(g.at(-1)!.word))) out.push([w]);
      else g.push(w);
    }
    return out;
  }, [words]);
  // The latest phrase that has started, held until 0.6 s after its last word (no gap frames between phrases).
  const g = groups.findLast((x) => now >= x[0].start - 0.15);
  if (!g || now > g.at(-1)!.end + 0.6) return null;
  const e = interpolate(now - g[0].start, [-0.15, 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: "linear-gradient(#0000, #000c)" }} />
      <div style={{ position: "absolute", left: 210, right: 210, bottom: 72, textAlign: "center", font: `600 54px/1.25 ${font.display}`, opacity: e, transform: `translateY(${(1 - e) * 14}px)`, textShadow: "0 4px 18px #000" }}>
        {g.map((w, i) => (
          <span key={i} style={{ color: now >= w.start ? "#fff" : "#7a7a7a" }}>
            {w.word}{" "}
          </span>
        ))}
      </div>
    </>
  );
}

// Each chapter after the first opens on a full-screen title card over the dimmed picture (2.6 s), then a small tag stays
// in the corner. The first chapter has only the tag, so the hook plays clean.
const CARD = 2.6;
function ChapterCard({ scenes, chapters }: { scenes: Scene[]; chapters: string[] }) {
  const now = useCurrentFrame() / FPS;
  const starts = chapters.map((_, k) => scenes.find((s) => s.chapter === k + 1)?.start ?? Infinity);
  const c = starts.filter((s) => now >= s).length; // 1-based chapter on screen
  if (!c || !chapters[c - 1]) return null;
  const since = now - starts[c - 1];
  const r = (a: number, b: number) => interpolate(since, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const card = c > 1 && since < CARD;
  const out = 1 - r(CARD - 0.45, CARD);
  const tag = c === 1 ? r(0.8, 1.4) : r(CARD, CARD + 0.5);
  return (
    <>
      {card && (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${0.72 * r(0, 0.35) * out})`, justifyContent: "center", paddingLeft: 200, opacity: out }}>
          <div style={{ font: `700 30px ${font.mono}`, letterSpacing: 10, color: "#9a9a9a", transform: `translateX(${(1 - r(0.05, 0.5)) * -80}px)`, opacity: r(0.05, 0.4) }}>
            PART {c} / {chapters.length}
          </div>
          <div style={{ overflow: "hidden", marginTop: 10 }}>
            <div style={{ font: `400 170px/1.02 ${font.impact}`, color: "#fff", textTransform: "uppercase", transform: `translateY(${(1 - r(0.15, 0.7)) * 110}%)`, textShadow: "0 0 40px #fff5" }}>{chapters[c - 1]}</div>
          </div>
          <div style={{ height: 6, width: 300 * r(0.5, 1.1), background: "#fff", marginTop: 26, boxShadow: "0 0 20px #fff8" }} />
        </AbsoluteFill>
      )}
      {tag > 0 && (
        <div style={{ position: "absolute", left: 70, top: 56, font: `700 22px ${font.mono}`, letterSpacing: 5, color: "#fff", opacity: 0.6 * tag, textTransform: "uppercase" }}>
          {c} · {chapters[c - 1]}
        </div>
      )}
    </>
  );
}

// Over the outro (the last OUTRO seconds), on top of the fade to black.
function EndCard({ text, total }: { text: string; total: number }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [total - (OUTRO - 0.3) * FPS, total - (OUTRO - 0.9) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return k > 0 ? (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", background: `rgba(0,0,0,${0.55 * k})` }}>
      <div style={{ opacity: k, transform: `scale(${0.92 + 0.08 * k})`, font: `400 96px/1.05 ${font.impact}`, color: "#fff", textTransform: "uppercase", textAlign: "center", padding: "0 90px", textShadow: "0 0 30px #fff6" }}>{text}</div>
    </AbsoluteFill>
  ) : null;
}

export function Explainer({ scenes, words, audio, music: maybe, seed = 0, calm = false, drawn = [], captions = true, wide = false, chapters = [], chapterMusic = [], endCard, tallAs = [], probe = false }: ExplainerProps) {
  const music = maybe ?? undefined; // null = no music (see propsOf)
  const t = MONO;
  const end = videoEnd(scenes);
  // Frame (within its scene) when the scene's hit word is spoken, for the camera's punch-in.
  const hitFrame = (i: number) => {
    const h = hitTime(i, scenes[i].hit, words);
    return h === undefined ? undefined : (h - (scenes[i].start ?? 0)) * FPS;
  };
  const visuals = scenes.map((s, i) => {
    const from = Math.round((s.start ?? 0) * FPS);
    // The last scene keeps playing through the outro instead of cutting to an empty frame.
    const dur = Math.max(1, Math.round(((s.end ?? (s.start ?? 0) + 3) + (i === scenes.length - 1 ? OUTRO : 0)) * FPS) - from);
    const V = VISUALS[s.component];
    const vp = { p: s.props, t, dur, w: words.filter((x) => x.scene === i).map((x) => ({ word: x.word, start: x.start - (s.start ?? 0) })), hit: hitFrame(i) };
    const js = drawn[i];
    // On the wide canvas a library picture sits centred; drawings are made for the wide canvas itself.
    const as = js && !wide ? tallAs[i] ?? "native" : null;
    const asWide = wide || as === "pan" || as === "box";
    const lib = asWide ? <Portrait><V {...vp} /></Portrait> : <V {...vp} />;
    const d = js ? <Drawn i={i} js={js} fallback={lib} props={asWide ? { ...vp, t: { ...t, wide: true } } : vp} /> : lib;
    const v = as === "box" ? <Landscape>{d}</Landscape> : as === "pan" ? <Pan dur={dur}>{d}</Pan> : js && probe && (wide || as === "native") ? <Probe i={i}>{d}</Probe> : d;
    // A drawing has its own text and composition: never mirror it, and focus the camera on its centre.
    const framed = js ? ({ ...s, component: "Drawn" } as unknown as Scene) : s;
    return (
      <Sequence key={i} from={from} durationInFrames={dur} name={`${i + 1}. ${js ? "Drawn" : s.component}`}>
        <MonoFrame i={i} s={framed} dur={dur} seed={seed} hit={hitFrame(i)} calm={calm}>
          {v}
        </MonoFrame>
      </Sequence>
    );
  });
  const picture = (
    <>
      <MonoBackdrop seed={seed} />
      <MonoMotion scenes={scenes} words={words} music={music} seed={seed} calm={calm}>
        {visuals}
      </MonoMotion>
      {captions && !wide && <MonoCaptions words={words} scenes={scenes} music={music} calm={calm} />}
      <LightLeaks drop={dropAt(scenes)} end={end} seed={seed} />
    </>
  );
  return (
    <AbsoluteFill style={{ fontFamily: font.display, background: "#000" }}>
      {wide ? (
        <Canvas.Provider value={WIDE_CANVAS}>
          {picture}
          {captions && <WideCaptions words={words} />}
          {captions && <ChapterCard scenes={scenes} chapters={chapters} />}
        </Canvas.Provider>
      ) : (
        picture
      )}
      <FadeOut total={Math.ceil(end * FPS)} />
      {endCard && <EndCard text={endCard} total={Math.ceil(end * FPS)} />}
      {tailOf({ wide, endCard }) > 0 && (
        <Sequence from={Math.ceil(end * FPS)} name="end screen">
          <EndScreen />
        </Sequence>
      )}
      {/* The music carries on under the end screen and fades at the very end. */}
      <MonoSound track={music} tracks={chapterMusic} scenes={scenes} words={words} seed={seed} end={end + tailOf({ wide, endCard })} calm={calm} />
      {audio.map((a, i) => {
        const from = Math.max(0, Math.round(a.start * FPS));
        return (
          <Sequence key={a.src} from={from} durationInFrames={a.end === undefined ? undefined : Math.max(1, Math.round(a.end * FPS) - from)} name={`audio ${i + 1}`}>
            <Audio src={staticFile(a.src)} trimBefore={a.start < 0 ? Math.round(-a.start * FPS) : undefined} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
