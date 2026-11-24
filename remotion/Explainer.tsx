import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { Audio } from "@remotion/media";
import type { Scene, Word } from "../server/schemas.ts";
import { FPS, H, MONO, W, font, type Theme } from "./theme.ts";
import { Callout, HookCard } from "./components/Cards.tsx";
import { Bars, Battery, Boulder, Bridge, Bulb, Fork, Gauge, Jar, Ladder, Lock, Mirror, Puzzle, Storm, Target, Train, Wallet } from "./components/Objects.tsx";
import { BigWord, Boxing, Bricks, Chains, Dominoes, Hourglass, Rocket, Rush, Scale, Stage, Traffic, Tree, Wheel, Window, Calendar, Car, Cash, Chart, Climb, Clock, Crowd, Door, Fall, Grind, Lift, Phone, Plan, PullUp, RainWalk, Run, Split, Summit } from "./components/Mono.tsx";
import * as Money from "./components/Money.tsx";
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
import { OUTRO, backdropFor, dropAt, hitTime, videoEnd, type Track } from "./mono.ts";

export type ExplainerProps = {
  scenes: Scene[];
  words: Word[];
  audio: { src: string; start: number }[];
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
};

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
  ...Mind,
  ...Nature,
  ...Action,
  ...Life,
  ...Ancient,
  ...Built,
  ...Relics,
};

export const calculateMetadata: CalculateMetadataFunction<ExplainerProps> = ({ props }) => {
  return { durationInFrames: Math.ceil(videoEnd(props.scenes) * FPS), fps: FPS, width: W, height: H };
};

// Mono backdrops: one per project (backdropFor), all faint so the figures stay on top.
function MonoBackdrop({ seed }: { seed: number }) {
  const f = useCurrentFrame();
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

export function Explainer({ scenes, words, audio, music: maybe, seed = 0, calm = false, drawn = [], captions = true }: ExplainerProps) {
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
    const v = js ? <Drawn i={i} js={js} fallback={<V {...vp} />} props={vp} /> : <V {...vp} />;
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
  return (
    <AbsoluteFill style={{ fontFamily: font.display }}>
      <MonoBackdrop seed={seed} />
      <MonoMotion scenes={scenes} words={words} music={music} seed={seed} calm={calm}>
        {visuals}
      </MonoMotion>
      {captions && <MonoCaptions words={words} scenes={scenes} music={music} calm={calm} />}
      <LightLeaks drop={dropAt(scenes)} end={end} seed={seed} />
      <FadeOut total={Math.ceil(end * FPS)} />
      <MonoSound track={music} scenes={scenes} words={words} seed={seed} end={end} calm={calm} />
      {audio.map((a, i) => (
        <Sequence key={a.src} from={Math.round(a.start * FPS)} name={`audio ${i + 1}`}>
          <Audio src={staticFile(a.src)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
