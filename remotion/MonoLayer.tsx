import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { useContext, useMemo } from "react";
import type { Scene, Word } from "../server/schemas.ts";
import { Canvas, FPS, SAFE, font } from "./theme.ts";
import { ENERGY_DB, XFADE, cameraFor, censor, dropAt, focusFor, hitTimes, mirrorFor, shotAt, musicGains, musicPieces, musicSegments, musicWave, pulseAt, sfxCues, transitionFor, type Segment, type Track } from "./mono.ts";
import { Mirror, Pin } from "./components/Mono.tsx";
import { FilmLook, FxLayer } from "./MonoFx.tsx";

// Motivation style: everything that moves the whole frame or plays sound. Scenes themselves live in components/Mono.tsx.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");

// Per scene: a camera move across its whole length, an entrance, and a zoom-through into the next cut.
// The focus moves (focus, reveal, track, swing, punch, dutch; mono.ts shotAt) frame the scene's key detail, smear in the
// direction they move (a directional blur from the camera's speed), and dim everything around the detail.
export function MonoFrame({ i, s, dur, seed = 0, hit, calm = false, children }: { i: number; s: Scene; dur: number; seed?: number; hit?: number; calm?: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { W, H } = useContext(Canvas);
  // On the wide canvas the moves travel further, so they read on a big screen; library focus points are vertical-only.
  const wide = W > H;
  const p = Easing.inOut(Easing.sin)(Math.min(1, f / dur));
  const dir = i % 2 ? 1 : -1;
  const kind = cameraFor(i, s, seed, calm);
  const mirrored = mirrorFor(i, s, seed);
  const focus: [number, number] = wide ? [W / 2, H / 2] : focusFor(s.component, mirrored);
  const shot = shotAt(kind, f, dur, focus, hit, dir, [W, H]);
  const prev = shotAt(kind, f - 1, dur, focus, hit, dir, [W, H]);
  const [zoom, slide, rise] = wide ? [0.18, 120, 70] : [0.1, 30, 50];
  // Simple moves as [transform, its inverse] (both about the frame's centre); the inverse pins labels in place.
  const hx = Math.sin(f / 7) * 7 + Math.sin(f / 13) * 5, hy = Math.cos(f / 9) * 6, hr = Math.sin(f / 11) * 0.6;
  const moves: Record<string, [string, string]> = {
    push: [`scale(${1 + zoom * p})`, `scale(${1 / (1 + zoom * p)})`],
    pull: [`scale(${1 + zoom - zoom * p})`, `scale(${1 / (1 + zoom - zoom * p)})`],
    pan: [`translateX(${dir * slide * (1 - 2 * p)}px) scale(${wide ? 1.16 : 1.08})`, `scale(${1 / (wide ? 1.16 : 1.08)}) translateX(${-dir * slide * (1 - 2 * p)}px)`],
    tilt: [`translateY(${rise - 2 * rise * p}px) scale(${wide ? 1.16 : 1.08})`, `scale(${1 / (wide ? 1.16 : 1.08)}) translateY(${2 * rise * p - rise}px)`],
    orbit: [`rotate(${dir * (-2.5 + 5 * p)}deg) scale(1.1)`, `scale(${1 / 1.1}) rotate(${-dir * (-2.5 + 5 * p)}deg)`],
    handheld: [`translate(${hx}px, ${hy}px) rotate(${hr}deg) scale(1.06)`, `scale(${1 / 1.06}) rotate(${-hr}deg) translate(${-hx}px, ${-hy}px)`],
  };
  const [simple, unsimple] = moves[kind as string] ?? [undefined, undefined];
  // The frame point (cx, cy) sits at the screen centre, zoomed z, tilted rot.
  const cam = shot ? `translate(${W / 2}px, ${H / 2}px) rotate(${shot.rot}deg) scale(${shot.z}) translate(${-shot.cx}px, ${-shot.cy}px)` : simple;
  // Motion blur from the camera's speed: how far the picture slides on screen in one frame, along each axis. Only the
  // motivation style's fast moves get it: on a calm video's slow, steady moves it just smeared the whole scene soft.
  const [vx, vy] = shot && prev && !calm ? [(shot.cx - prev.cx) * shot.z, (shot.cy - prev.cy) * shot.z] : [0, 0];
  const vz = shot && prev && !calm ? Math.abs(shot.z - prev.z) * 900 : 0;
  const tr = transitionFor(i, s, seed, calm);
  const e = interpolate(f, [0, tr === "fade" ? 14 : 7], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  // The zoom-through into the next cut; a calm video just fades scene to scene.
  const x = calm ? 0 : interpolate(f, [dur - 4, dur], [0, 1], clamp) ** 2;
  const enter = tr === "zoom" ? `scale(${1 + 0.4 * (1 - e)})` : tr === "whip" ? `translateX(${-dir * 520 * (1 - e)}px)` : tr === "fade" ? `scale(${1 + 0.03 * (1 - e)})` : `scale(${1 + 0.12 * (1 - e)})`;
  const blur = (tr === "zoom" ? 16 * (1 - e) : 0) + 10 * x + Math.min(3, vz * 0.25);
  const bx = Math.min(48, (tr === "whip" ? 50 * (1 - e) : 0) + Math.abs(vx) * 0.55);
  const by = Math.min(48, Math.abs(vy) * 0.55);
  const id = `mb${i}`;
  const directional = bx > 0.5 || by > 0.5;
  const filter = [blur > 0.3 && `blur(${blur.toFixed(1)}px)`, directional && `url(#${id})`].filter(Boolean).join(" ") || undefined;
  // Where the detail lands on screen, for the spotlight.
  const spot = shot ? shot.spot : 0;
  const sx = shot ? W / 2 + (focus[0] - shot.cx) * shot.z : W / 2;
  const sy = shot ? H / 2 + (focus[1] - shot.cy) * shot.z : H / 2;
  const body = (
    <AbsoluteFill style={{ transform: `${enter} scale(${1 + 0.12 * x})`, filter, opacity: tr === "fade" ? e : undefined }}>
      <AbsoluteFill style={{ transform: cam, transformOrigin: shot ? "0 0" : undefined }}>
        <Mirror.Provider value={mirrored}>
          <Pin.Provider value={shot ? `translate(${shot.cx}px, ${shot.cy}px) scale(${1 / shot.z}) rotate(${-shot.rot}deg) translate(${-W / 2}px, ${-H / 2}px)` : unsimple && `translate(${W / 2}px, ${H / 2}px) ${unsimple} translate(${-W / 2}px, ${-H / 2}px)`}>{children}</Pin.Provider>
        </Mirror.Provider>
      </AbsoluteFill>
    </AbsoluteFill>
  );
  return (
    <>
      {directional && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={`${bx.toFixed(1)} ${by.toFixed(1)}`} />
          </filter>
        </svg>
      )}
      {tr === "glitch" && f < 6
        ? [0, 1, 2, 3].map((k) => (
            <AbsoluteFill
              key={k}
              style={{
                clipPath: `inset(${k * 25}% 0 ${75 - k * 25}% 0)`,
                transform: `translateX(${(((k * 37 + f * 53) % 9) - 4) * 18}px)`,
              }}
            >
              {body}
            </AbsoluteFill>
          ))
        : body}
      {/* Spotlight: everything around the detail falls into shadow, a soft pool of light on it. */}
      {spot > 0.02 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${sx.toFixed(0)}px ${sy.toFixed(0)}px, rgba(255,255,255,${(0.07 * spot).toFixed(3)}) 0, transparent 230px, rgba(0,0,0,${(0.62 * spot).toFixed(2)}) 520px)`,
          }}
        />
      )}
      {tr === "flash" && f < 6 && <AbsoluteFill style={{ background: "#fff", opacity: 0.85 * (1 - f / 6) }} />}
    </>
  );
}

// Whole frame: beat pulse (harder after the drop), shake + zoom + flash on hits, grain and vignette.
// calm (explainers): no beat pulse, no shake/flash/zoom blur on hits, no effect transitions.
export function MonoMotion({ scenes, words, music, seed = 0, calm = false, children }: { scenes: Scene[]; words: Word[]; music?: Track; seed?: number; calm?: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  const drop = useMemo(() => dropAt(scenes), [scenes]);
  const hits = useMemo(() => (calm ? [] : hitTimes(scenes, words)), [scenes, words, calm]);
  const pulse = music && !calm ? pulseAt(music, drop, t) : { k: 0, down: false };
  let shake = 0;
  let zoom = 0;
  let flash = 0;
  for (const h of hits) {
    const dt = t - h;
    if (dt < 0 || dt > 0.5) continue;
    shake += 24 * Math.exp(-dt * 8) * Math.sin(dt * 70);
    zoom += 0.08 * Math.exp(-dt * 12);
    flash = Math.max(flash, (h === drop ? 0.95 : 0.55) * Math.exp(-dt * 14));
  }
  const scale = 1 + 0.03 * pulse.k + zoom;
  const bright = 1 + (pulse.down ? 0.35 : 0.12) * pulse.k;
  const flicker = 0.04 * (((f * 7919) % 13) / 13);
  const { W, H } = useContext(Canvas);
  return (
    <>
      <AbsoluteFill
        style={{
          transform: `translate(${shake}px, ${shake * 0.5}px) scale(${scale})`,
          filter: bright > 1.01 ? `brightness(${bright.toFixed(2)})` : undefined,
        }}
      >
        <FxLayer scenes={calm ? [] : scenes} hits={hits} seed={seed}>
          {children}
        </FxLayer>
      </AbsoluteFill>
      <FilmLook seed={seed} />
      {flash > 0.01 && <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
      <svg
        viewBox="0 0 360 640"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          width: W,
          height: H,
          opacity: 0.1,
          mixBlendMode: "screen",
        }}
      >
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={f % 23} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={360} height={640} filter="url(#grain)" />
      </svg>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,${0.7 + flicker}) 100%)`,
        }}
      />
    </>
  );
}

// Three words at a time, each slamming in as it's spoken; the scene's hit word is inverted.
export function MonoCaptions({ words, scenes, music, calm = false }: { words: Word[]; scenes: Scene[]; music?: Track; calm?: boolean }) {
  const now = useCurrentFrame() / FPS;
  const groups = useMemo(() => {
    const out: Word[][] = [];
    for (const w of words) {
      const g = out.at(-1);
      if (!g || g.length >= 3 || g[0].scene !== w.scene || /[.!?,:;]$/.test(g.at(-1)!.word)) out.push([w]);
      else g.push(w);
    }
    return out;
  }, [words]);
  const drop = useMemo(() => dropAt(scenes), [scenes]);
  const g = groups.find((x, i) => now >= x[0].start - 0.03 && now < (groups[i + 1]?.[0].start ?? x.at(-1)!.end + 0.4));
  const scene = g && scenes[g[0].scene];
  if (!g || !scene || scene.component === "Callout" || scene.component === "BigWord") return null;
  const hit = scene.hit ? norm(scene.hit.split(" ")[0]) : "";
  const beat = music && !calm ? pulseAt(music, drop, now).k : 0;
  // A long group shrinks to stay on one line: two lines reach down onto the scene's label.
  const fit = Math.min(1, 18 / g.map((w) => w.word).join(" ").length);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.side - 30,
        right: SAFE.side - 30,
        top: SAFE.top + 10,
        height: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0 24px",
        textAlign: "center",
        transform: `scale(${1 + 0.04 * beat})`,
      }}
    >
      {g.map((w, i) => {
        const k = interpolate(now - w.start, [-0.03, 0.09], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.back(2.2)),
        });
        const on = hit !== "" && norm(w.word) === hit;
        const tilt = ((w.start * 1000) % 5) - 2.5;
        return (
          <span
            key={i}
            style={{
              font: `400 ${Math.round((on ? 124 : 112) * fit)}px/1.05 ${font.impact}`,
              color: on ? "#000" : "#fff",
              background: on ? "#fff" : undefined,
              padding: on ? "0 14px" : undefined,
              opacity: Math.min(1, k * 2),
              transform: `scale(${1.7 - 0.7 * k}) rotate(${tilt * (1 - k)}deg)`,
              textShadow: on ? undefined : "0 0 24px rgba(255,255,255,0.3), 0 6px 0 rgba(0,0,0,0.85)",
              boxShadow: on ? "0 0 40px rgba(255,255,255,0.6)" : undefined,
            }}
          >
            {censor(w.word).toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}

// The track laid out by musicPieces: each piece is a plain trimmed clip at its own time (no loop, nothing before frame 0).
// Each segment (musicSegments) is its track laid out from `at`; segments after the first fade in, all but the last fade
// out, over XFADE seconds where they overlap.
function MonoMusic({ segments, volume }: { segments: Segment[]; volume: (videoFrame: number, track: Track) => number }) {
  const F = (sec: number) => Math.round(sec * FPS);
  return (
    <>
      {segments.flatMap((s, j) => {
        const len = F(s.dur);
        const edge = (local: number) => (j > 0 ? interpolate(local, [0, F(XFADE)], [0, 1], clamp) : 1) * (j < segments.length - 1 ? interpolate(local, [len - F(XFADE), len], [1, 0], clamp) : 1);
        return musicPieces(s.track, s.dur).map((p, i) => (
          <Sequence key={`${j}-${i}`} from={F(s.at + p.at)} durationInFrames={Math.max(1, F(p.at + p.dur) - F(p.at))} name={`music ${s.track.src.split("/").pop()} ${p.from.toFixed(1)}s`}>
            <Audio src={staticFile(s.track.src)} trimBefore={F(p.from) || undefined} volume={(fr) => volume(fr + F(s.at + p.at), s.track) * edge(fr + F(p.at))} />
          </Sequence>
        ));
      })}
    </>
  );
}

// Music plus every cue. Without a track (MONO_MUSIC=off) only the effects play, so a sound can be added inside TikTok.
export function MonoSound({ track, tracks = [], scenes, words, end, seed = 0, calm = false }: { track?: Track; tracks?: Track[]; scenes: Scene[]; words: Word[]; end: number; seed?: number; calm?: boolean }) {
  const drop = useMemo(() => dropAt(scenes), [scenes]);
  const cues = useMemo(() => sfxCues(scenes, words, seed, calm), [scenes, words, seed, calm]);
  const total = Math.round(end * FPS);
  // Seconds from t to the nearest spoken word (0 while speaking).
  const gap = (t: number) => {
    let lo = 0;
    let hi = words.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].end + 0.1 < t) lo = mid + 1;
      else hi = mid;
    }
    const w = words[lo];
    if (!w) return 9;
    const prev = words[lo - 1];
    const d = (x: Word) => Math.max(0, x.start - 0.05 - t, t - x.end - 0.1);
    return Math.min(d(w), prev ? d(prev) : 9);
  };
  const [wt, wg] = useMemo(() => musicWave(scenes), [scenes]);
  // Under a quiet line the music ducks as far as the line was lowered, so it never covers it.
  const duck = (t: number) => {
    let i = 0;
    while (i < scenes.length - 1 && (scenes[i + 1].start ?? 0) <= t) i++;
    return 10 ** ((ENERGY_DB[scenes[i]?.energy ?? "high"] ?? 0) / 20);
  };
  // Levels are per track: each is measured on its own (musicGains).
  const volume = (vf: number, tr: Track) => {
    const g = musicGains(tr);
    return interpolate(gap(vf / FPS), [0.05, 0.5], [g.under * duck(vf / FPS), g.pause], clamp) * interpolate(vf / FPS, wt, wg, clamp) * interpolate(vf, [0, 8, total - 2.5 * FPS, total], [0, 1, 1, 0], clamp);
  };
  const segments = useMemo(() => musicSegments(track, tracks, scenes, end), [track, tracks, scenes, end]);
  return (
    <>
      <MonoMusic segments={segments} volume={volume} />
      {cues.map((c, i) => {
        // Beds shorter than their 8-in / 10-out fades (a cheer over a scene's last moment) need room for both: 20 frames.
        const len = c.dur ? Math.max(20, Math.round(c.dur * FPS)) : undefined;
        return (
          <Sequence key={i} from={Math.round(c.at * FPS)} durationInFrames={len} name={`sfx ${c.src.split("/").pop()}`}>
            <Audio src={staticFile(c.src)} loop={!!len} volume={len ? (fr) => c.volume * interpolate(fr, [0, 8, len - 10, len], [0, 1, 1, 0], clamp) : c.volume} />
          </Sequence>
        );
      })}
    </>
  );
}
