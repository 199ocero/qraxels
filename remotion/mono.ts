// Motivation style timing: music drop alignment, beat pulses, sound cues, camera picks.
// No Remotion imports, so server tests can use it. Files live in public/sound/ (`npm run setup`).

// Designed effects are earshot takes (scripts/earshot-sfx.sh, committed in public/sfx/); real-world sounds earshot
// can't make (rain, typing, footsteps, crowd, coins) are Mixkit recordings downloaded by `npm run setup`.
const X = (f: string) => `sfx/${f}`;
const R = (f: string) => `sound/${f}`;
export const SFX = {
  pop: X("pop.wav"),
  ding: X("ding.wav"),
  sub: X("sub.wav"),
  riser: X("riser.wav"),
  whoosh: X("whoosh.wav"),
  punch: X("punch.wav"),
  land: X("land.wav"),
  tick: X("tick.wav"),
  kick: X("kick.wav"),
  impact: X("impact.wav"),
  shimmer: X("shimmer.wav"),
  sting: X("sting.wav"),
  bell: X("bell.wav"),
  swish: X("swish.wav"),
  jet: X("jet.wav"),
  shutter: X("shutter.wav"),
  knock: X("knock.wav"),
  drip: X("drip.wav"),
  sink: X("sink.wav"),
  buzz: X("buzz.wav"),
  zip: X("zip.wav"),
  page: X("page.wav"),
  coins: R("coins.wav"),
  crowd: R("crowd.wav"),
  rain: R("rain.wav"),
  typing: R("typing.wav"),
  running: R("running.wav"),
};
// Seconds from the start of each earshot take to its loudest moment (earshot's measured peak_s), so peaks land on the frame.
const PEAK: Record<string, number> = {
  [SFX.pop]: 0.004, [SFX.ding]: 0.004, [SFX.sub]: 0.274, [SFX.riser]: 1.202, [SFX.whoosh]: 0.116,
  [SFX.punch]: 0.058, [SFX.land]: 0.181, [SFX.tick]: 0.007, [SFX.kick]: 0.013,
  [SFX.impact]: 0.213, [SFX.shimmer]: 0.362, [SFX.sting]: 0.011, [SFX.bell]: 0.062, [SFX.swish]: 0.059, [SFX.jet]: 0.544,
  [SFX.shutter]: 0.042, [SFX.knock]: 0.015, [SFX.drip]: 0.022, [SFX.sink]: 0.152, [SFX.buzz]: 0.252, [SFX.zip]: 0.162,
  [SFX.page]: 0.13,
};

// The voice reads every line at one level; under calm and quiet lines the music and that scene's effects dip by this
// much, so those lines feel softer and come through clearer.
export const ENERGY_DB: Record<string, number> = { low: -3, calm: -2, high: 0 };

// The narration's speech level (dBFS RMS of active speech); voice/kokoro_tts.py normalizes to it. Keep the two in sync.
export const VOICE_LEVEL = -20;
// Music gain while the voice speaks and in pauses. The reference edits run a steady, present bed (about -20 dBFS between
// words in a -12 LUFS mix): bass-heavy beats sit just 3 dB under the voice, since bass doesn't cover words. A track busier
// in 1-4 kHz (where words are understood) masks the voice, so it ducks further.
// -7.5 was measured on a bass-heavy trap beat that earshot heard like the references ("hip hop beat with heavy bass").
const MID_OK = -7.5;
export function musicGains(track: Track): { under: number; pause: number } {
  const margin = 3 + Math.max(0, ((track.mid ?? MID_OK) - MID_OK) * 1.2);
  const under = Math.min(1, 10 ** ((VOICE_LEVEL - margin - (track.level ?? -14)) / 20));
  return { under, pause: Math.min(1, under * 1.4) };
}

// A music track: drop = seconds into the track where it hits (null: no drop, it just plays from the start).
// level: dBFS RMS of the track's loud part; mid: share of its energy in 1-4 kHz (dB); start: bar line where the full beat
// runs. All from voice/music_info.py.
export type Track = { src: string; drop: number | null; bpm: number; downbeat: number; pulseEvery: number; duration: number; start?: number; level?: number; mid?: number; credit?: string };
// Built-in fallback; normally the server analyzes every file in public/sound/music/ (voice/music_info.py).
export const TRACKS: Track[] = [
  { src: R("music/epic-build.mp3"), drop: 49.03, bpm: 93, downbeat: 2.579, pulseEvery: 1, duration: 101.3, level: -14 },
];

// Seconds the last scene holds after its narration while the picture fades and the music rings out, so videos end
// instead of stopping. Everything that needs the video's length uses videoEnd.
export const OUTRO = 3;
export const videoEnd = (scenes: { end?: number }[]) => (scenes.at(-1)?.end ?? 5) + OUTRO;

// Scene sounds the Director may pick.
export const SCENE_SFX = ["punch", "braam", "glitch", "crowd", "clock", "cash", "heartbeat"] as const;
export const CAMERAS = ["push", "pan", "pull", "orbit", "tilt", "handheld", "focus", "reveal", "track", "swing", "punch", "dutch"] as const;
export type Camera = (typeof CAMERAS)[number];

// ---------- the camera ----------
// Where each scene's key detail sits (1080x1920 frame, before mirroring): the camera's focus moves push to it, and the
// spotlight lights it. Scenes that aren't listed are framed on the centre.
const FW = 1080, FH = 1920;
export const FOCUS: Record<string, [number, number]> = {
  Crowd: [540, 1180], PullUp: [540, 800], Grind: [710, 1075], RainWalk: [700, 1300], Climb: [880, 900], Run: [360, 1250],
  Split: [540, 1100], Lift: [540, 1250], Boxing: [600, 1150], Fall: [540, 1350], Summit: [680, 810], Clock: [540, 850],
  Chart: [960, 700], Cash: [690, 1200], Plan: [430, 700], Car: [460, 1250], Phone: [540, 1000], Calendar: [540, 850],
  Door: [540, 1000], Bricks: [500, 1150], Traffic: [540, 1250], Rush: [530, 1300], Stage: [540, 900], Dominoes: [900, 1250],
  Hourglass: [540, 1000], Scale: [750, 1000], Rocket: [540, 1100], Tree: [600, 900], Window: [381, 945], Wheel: [540, 1250],
  Chains: [540, 1150], Ladder: [540, 1000], Bridge: [540, 1200], Storm: [480, 1300], Mirror: [600, 1150], Jar: [540, 1250],
  Target: [600, 960], Bulb: [540, 860], Battery: [540, 1090], Boulder: [560, 1150], Wallet: [540, 1180], Lock: [540, 1000],
  Puzzle: [540, 1040], Train: [420, 1250], Bars: [935, 700], Fork: [700, 1000], Gauge: [540, 1100],
};
export const focusFor = (component: string, mirrored = false): [number, number] => {
  const [x, y] = FOCUS[component] ?? [FW / 2, FH / 2];
  return [mirrored ? FW - x : x, y];
};

// A camera position: zoom z, the frame point at the screen's centre (cx, cy), tilt in degrees, and how lit the
// spotlight on the focus is (0..1).
export type Shot = { z: number; cx: number; cy: number; rot: number; spot: number };
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const out3 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
// Keeps the view inside the frame so a zoomed camera never shows past a scene's edges.
const inside = (z: number, x: number, y: number, [FW, FH]: [number, number]): [number, number] => {
  const [hw, hh] = [FW / (2 * z), FH / (2 * z)];
  return [Math.min(FW - hw, Math.max(hw, x)), Math.min(FH - hh, Math.max(hh, y))];
};
// The focus moves, frame by frame. f and dur in frames; hit = frame of the scene's hit word; dir = +1/-1 for sideways moves;
// size = the canvas (1920x1080 for a long video).
export function shotAt(cam: string, f: number, dur: number, focus: [number, number], hit?: number, dir = 1, size: [number, number] = [1080, 1920]): Shot | undefined {
  const [FW, FH] = size;
  const [fx, fy] = focus;
  const u = Math.min(1, Math.max(0, f / dur));
  const at = (z: number, x: number, y: number, spot: number, rot = 0): Shot => {
    const [cx, cy] = inside(z, x, y, size);
    return { z, cx, cy, rot, spot };
  };
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  switch (cam) {
    case "focus": { // slow push into the detail, the spotlight coming up with it
      const k = smooth(u);
      return at(1 + 0.38 * k, mix(FW / 2, fx, 0.9 * k), mix(FH / 2, fy, 0.9 * k), k);
    }
    case "reveal": { // starts tight on the detail, pulls back to the whole scene
      const k = out3(u * 1.4);
      return at(1.55 - 0.55 * k, mix(fx, FW / 2, k), mix(fy, FH / 2, k), 1 - k);
    }
    case "track": { // zoomed in, a sideways move across the scene that settles on the detail
      const k = smooth(u * 1.15);
      return at(1.5, fx + dir * (300 - 300 * k), fy, 0.6 * k);
    }
    case "swing": { // holds off to one side, then swings fast onto the detail (8 frames) and settles
      const k = out3((f - dur * 0.3) / 8);
      return at(1.35, mix(fx - dir * 380, fx, k), mix(fy - 160, fy, k), k, -3 * dir * (1 - k));
    }
    case "punch": { // snaps in on the detail the moment the hit word lands, then breathes
      const h = hit ?? dur * 0.35;
      const k = out3((f - h) / 5);
      return at(1 + 0.45 * k + 0.03 * smooth((f - h) / dur), mix(FW / 2, fx, k), mix(FH / 2, fy, k), k);
    }
    case "dutch": { // a tilted angle that slowly pushes in and levels a little
      const k = smooth(u);
      return at(1.15 + 0.1 * k, mix(FW / 2, fx, 0.3 * k), mix(FH / 2, fy, 0.3 * k), 0, dir * (7 - 3 * k));
    }
  }
  return undefined;
}

type SceneLike = { purpose: string; component: string; energy?: string; start?: number; end?: number; props?: unknown; hit?: string; sfx?: string; camera?: string };
type WordLike = { word: string; start: number; end: number; scene: number };

// Where the beat drops: the first payoff, else the scene starting closest to 40% in.
export function dropAt(scenes: SceneLike[]): number {
  const p = scenes.find((s, i) => i > 0 && s.purpose === "payoff");
  if (p) return p.start ?? 0;
  const target = (scenes.at(-1)?.end ?? 0) * 0.4;
  return scenes.slice(1).reduce((best, s) => (Math.abs((s.start ?? 0) - target) < Math.abs(best - target) ? (s.start ?? 0) : best), 0);
}

// One number per project: picks its track, backdrop, camera moves, transitions and mirrored scenes, so no two videos match.
export const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
// Deterministic 0..2^32 hash of (seed, i).
export const rand = (seed: number, i: number) => {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
// Index i of a seeded sequence over n choices where neighbours always differ.
export function pick(n: number, seed: number, i: number): number {
  let v = seed % n;
  for (let k = 0; k <= i; k++) v = (v + 1 + (rand(seed, k) % (n - 1))) % n;
  return v;
}

// Same project, same track; projects rotate through the folder.
export function musicFor(id: string, tracks: Track[] = TRACKS): Track | undefined {
  return tracks.length ? tracks[seedOf(id) % tracks.length] : undefined;
}

// The music follows the speech's wave: held back under the story, full from the drop (the turn) through the last
// payoff (the peak), eased down for the landing. Returns [times, gains] for interpolate().
export function musicWave(scenes: SceneLike[]): [number[], number[]] {
  const drop = dropAt(scenes);
  // The peak is a second payoff after the turn; with only one, nothing after the drop is a landing.
  const payoffs = scenes.flatMap((s, i) => (i > 0 && s.purpose === "payoff" ? [i] : []));
  const peak = payoffs.length > 1 ? payoffs.at(-1)! : -1;
  const land = peak >= 0 && peak < scenes.length - 1 ? (scenes[peak + 1].start ?? 0) : undefined;
  if (land === undefined || land <= drop) return [[drop - 0.3, drop], [0.55, 1]];
  return [[drop - 0.3, drop, land, land + 0.8], [0.55, 1, 1, 0.6]];
}

// Where the track starts: its full beat from the very first frame. The reference edits run the beat the whole way
// (loudness range ~2 LU); starting on a quiet intro left the first 20 s nearly silent.
const startOf = (track: Track) => track.start ?? track.drop ?? 0;

// How the track is laid on the timeline: back-to-back pieces {at: video s, from: track s, dur: s} covering 0..end,
// playing from startOf and repeating that part (it starts on a bar line) when the track runs out.
export type Piece = { at: number; from: number; dur: number };
export function musicPieces(track: Track, end: number): Piece[] {
  const out: Piece[] = [];
  const from = startOf(track);
  const len = track.duration - from > 1 ? track.duration - from : track.duration;
  for (let t = 0; t < end - 0.01; t += len) out.push({ at: t, from: len === track.duration ? 0 : from, dur: Math.min(len, end - t) });
  return out;
}

// Long videos: each chapter plays its own track from the top, overlapping the next chapter by XFADE seconds so they
// crossfade. `tracks[k]` is chapter k+1's track. Other videos: one segment, the whole video.
export const XFADE = 2;
export type Segment = { track: Track; at: number; dur: number };
export function musicSegments(track: Track | undefined, tracks: Track[], scenes: { chapter?: number; start?: number }[], end: number): Segment[] {
  if (!tracks.length || !scenes.some((s) => s.chapter)) return track ? [{ track, at: 0, dur: end }] : [];
  const starts = scenes.flatMap((s, i) => (i === 0 ? [0] : s.chapter !== scenes[i - 1].chapter ? [s.start ?? 0] : []));
  return starts.map((at, k) => ({ track: tracks[k % tracks.length], at, dur: Math.min(end, (starts[k + 1] ?? end) + XFADE) - at }));
}

// Beat number at video time t.
const beatAt = (track: Track, t: number) => (t + startOf(track) - track.downbeat) / (60 / track.bpm);

// 0..1 kick on each beat (bar starts only before the drop, every pulseEvery beats after); `down` marks bar starts after the drop.
// The picture still builds: before the video's drop scene the frame pulses on bar starts only, after it on every beat.
export function pulseAt(track: Track, drop: number, t: number): { k: number; down: boolean } {
  const n = beatAt(track, t);
  if (n < 0) return { k: 0, down: false };
  const after = t >= drop;
  const every = after ? track.pulseEvery : 4;
  const since = (((n % every) + every) % every) * (60 / track.bpm);
  return { k: (after ? 1 : 0.4) * Math.exp(-since * 9), down: after && ((Math.floor(n) % 4) + 4) % 4 === 0 };
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");
// When the scene's emphasis word is spoken.
export function hitTime(i: number, hit: string | undefined, words: WordLike[]): number | undefined {
  if (!hit) return undefined;
  const target = norm(hit.split(" ")[0]);
  return words.find((w) => w.scene === i && norm(w.word) === target)?.start;
}

// Moments that get a flash + shake: the drop, other payoffs, and every hit word.
export function hitTimes(scenes: SceneLike[], words: WordLike[]): number[] {
  const drop = dropAt(scenes);
  const out = [drop];
  scenes.forEach((s, i) => {
    if (s.purpose === "payoff") out.push(s.start ?? 0);
    const h = hitTime(i, s.hit, words);
    if (h !== undefined) out.push(h);
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

export type Cue = { src: string; at: number; volume: number; dur?: number };
// Places a take so its peak lands at time t.
const hit = (src: string, t: number, volume: number): Cue => ({ src, at: Math.max(0, t - (PEAK[src] ?? 0)), volume });
const every = (src: string, from: number, to: number, step: number, volume: number) => {
  const out: Cue[] = [];
  for (let t = from; t < to - 0.05; t += step) out.push(hit(src, t, volume));
  return out;
};
const heartbeat = (from: number, to: number, volume: number) => every(SFX.kick, from, to, 0.9, volume).flatMap((c) => [c, { ...c, at: c.at + 0.18, volume: volume * 0.6 }]);
// Ambience caused by what's on screen.
const BED: Record<string, [string, number]> = { RainWalk: [SFX.rain, 0.35], Grind: [SFX.typing, 0.4], Run: [SFX.running, 0.4], Cash: [SFX.coins, 0.22], Stage: [SFX.crowd, 0.25], Traffic: [SFX.running, 0.25], Storm: [SFX.rain, 0.4], Jar: [SFX.coins, 0.2], Train: [SFX.running, 0.3] };
const FRAME = 1 / 30;

// Sounds for the label-only pictures (remotion/components/{Money,Mind,Nature,Action,Life}.tsx), timed to what each one
// animates. Fractions are of the scene's length, seconds are from its start.
//   boom: the scene's big moment, an accent that lands on its hit word when the line has one (else at the fraction)
//   once: one quiet contact sound at a fraction    each: quiet repeats from `from` s every `step` s until fraction `to`
//   steps: n quiet sounds evenly between two fractions    ticks: n quiet sounds on tickAt (the scenes' shared beat)
//   bed: a recording under the scene from fraction `from` to `to`
type Beat =
  | { big: number; src: string; vol: number }
  | { at: number; src: string; vol: number }
  | { each: [from: number, step: number, to: number]; src: string; vol: number }
  | { steps: [n: number, from: number, to: number]; src: string; vol: number }
  | { ticks: number; src: string; vol: number }
  | { bed: [from: number, to: number]; src: string; vol: number };
const boom = (src: string, frac: number, vol = 0.5): Beat => ({ big: frac, src, vol });
const once = (src: string, frac: number, vol = 0.3): Beat => ({ at: frac, src, vol });
const each = (src: string, from: number, step: number, vol = 0.15, to = 1): Beat => ({ each: [from, step, to], src, vol });
const steps = (src: string, n: number, from: number, to: number, vol = 0.15): Beat => ({ steps: [n, from, to], src, vol });
const ticks = (src: string, n: number, vol = 0.15): Beat => ({ ticks: n, src, vol });
const bed = (src: string, vol = 0.25, from = 0, to = 1): Beat => ({ bed: [from, to], src, vol });
const S = SFX;
export const BEATS: Record<string, Beat[]> = {
  GasPump: [each(S.tick, 0.08, 0.1, 0.08, 0.9), once(S.pop, 0.47, 0.3)],
  Cart: [ticks(S.knock, 6, 0.25), boom(S.ding, 0.85, 0.3)],
  Feast: [each(S.tick, 0.15, 0.2, 0.08, 0.85), boom(S.ding, 0.85, 0.3)],
  PowerMeter: [each(S.tick, 0, 0.12, 0.08), boom(S.buzz, 0.85, 0.3)],
  Pylons: [each(S.tick, 0, 0.25, 0.06), boom(S.sting, 0.8, 0.35)],
  Servers: [each(S.tick, 0, 0.15, 0.06)],
  Truck: [once(S.whoosh, 0.1, 0.25), boom(S.sink, 0.85, 0.35)],
  Barrel: [once(S.drip, 0.2, 0.3), boom(S.riser, 0.7, 0.35)],
  Port: [once(S.zip, 0.15, 0.25), once(S.swish, 0.4, 0.2), boom(S.land, 0.8, 0.45)],
  Toll: [once(S.land, 0.25, 0.3), bed(S.coins, 0.12, 0.3, 0.6), boom(S.ding, 0.65, 0.35)],
  RateDial: [each(S.tick, 0.15, 0.1, 0.1, 0.75), boom(S.sting, 0.75, 0.4)],
  CentralBank: [steps(S.pop, 4, 0.2, 0.85, 0.2), boom(S.impact, 0.85, 0.35)],
  ForSale: [each(S.tick, 0.15, 0.25, 0.08, 0.85), once(S.swish, 0.5, 0.2)],
  Mortgage: [once(S.zip, 0.2, 0.2), boom(S.riser, 0.7, 0.3)],
  Gold: [ticks(S.knock, 10, 0.2), boom(S.shimmer, 0.85, 0.4)],
  SaleMonth: [each(S.pop, 0.05, 0.03, 0.08, 0.85), boom(S.ding, 0.85, 0.3)],
  Doorbuster: [once(S.knock, 0.2, 0.2), boom(S.whoosh, 0.45, 0.4), bed(S.crowd, 0.2, 0.5)],
  Assistant: [once(S.pop, 0.08, 0.3), each(S.tick, 0.18, 0.08, 0.08, 0.4), once(S.pop, 0.42, 0.3), boom(S.ding, 0.72, 0.35)],
  Appetite: [boom(S.shutter, 0.24, 0.4), once(S.swish, 0.6, 0.2)],
  Layoff: [each(S.knock, 0, 0.5, 0.15), boom(S.shimmer, 0.42, 0.35)],
  Spillover: [boom(S.sub, 0.12, 0.4), ticks(S.pop, 6, 0.2)],
  Shrink: [once(S.swish, 0.3, 0.2), once(S.swish, 0.6, 0.2), boom(S.ding, 0.85, 0.3)],
  Vise: [each(S.tick, 0.1, 0.12, 0.1, 0.8), bed(S.coins, 0.15, 0.4)],
  Supply: [once(S.pop, 0.35, 0.3), once(S.pop, 0.62, 0.3), boom(S.ding, 0.9, 0.35)],
  Dollar: [once(S.swish, 0.3, 0.2), boom(S.sink, 0.8, 0.35)],
  PowerBill: [once(S.page, 0.1, 0.35), each(S.tick, 0.35, 0.1, 0.08, 0.85), boom(S.buzz, 0.85, 0.3)],
  Strait: [boom(S.land, 0.45, 0.45), once(S.riser, 0.55, 0.25)],
  Parcels: [ticks(S.knock, 7, 0.3), boom(S.ding, 0.85, 0.25)],
  Funnel: [bed(S.coins, 0.1, 0, 0.5), boom(S.ding, 0.6, 0.35)],
  Queue: [each(S.knock, 0.2, 0.45, 0.12, 0.85)],
  Robot: [once(S.zip, 0.2, 0.25), boom(S.shimmer, 0.45, 0.3), bed(S.typing, 0.2, 0.45)],
  Snacks: [each(S.knock, 0.1, 0.25, 0.12, 0.85), boom(S.sink, 0.85, 0.3)],
  Race: [steps(S.tick, 8, 0.1, 0.85, 0.12), boom(S.sting, 0.85, 0.35)],
  Valve: [each(S.tick, 0.2, 0.08, 0.1, 0.7), bed(S.coins, 0.15, 0, 0.5)],
  Squeeze: [once(S.whoosh, 0.2, 0.25), boom(S.impact, 0.35, 0.45)],
  Flood: [each(S.drip, 0.1, 0.6, 0.15), boom(S.sink, 0.85, 0.3)],
  TwoPrices: [boom(S.ding, 0.42, 0.35)],
  Profile: [each(S.tick, 0.1, 0.1, 0.06, 0.7), boom(S.ding, 0.76, 0.3)],
  Watching: [each(S.knock, 0, 0.5, 0.12, 0.55), boom(S.ding, 0.58, 0.3)],
  ShelfLabel: [steps(S.tick, 4, 0.21, 0.69, 0.2), boom(S.buzz, 0.85, 0.25)],
  MenuBoard: [once(S.swish, 0.25, 0.25), boom(S.sting, 0.65, 0.4)],
  DriveThru: [ticks(S.knock, 3, 0.15), boom(S.bell, 0.8, 0.3)],
  Limited: [each(S.tick, 0.05, 0.5, 0.12, 0.9), boom(S.ding, 0.9, 0.3)],
  Hog: [each(S.tick, 0.15, 0.15, 0.08, 0.85), boom(S.sink, 0.85, 0.3)],
  TopTen: [steps(S.pop, 10, 0, 0.33, 0.12), boom(S.sting, 0.5, 0.4)],
  AgeCurve: [once(S.zip, 0.05, 0.2), boom(S.ding, 0.85, 0.3)],
  Distribution: [steps(S.pop, 12, 0.02, 0.4, 0.12), boom(S.sting, 0.65, 0.4)],
  ThenNow: [each(S.tick, 0.25, 0.12, 0.08, 0.8), boom(S.ding, 0.8, 0.3)],
  Receipts: [bed(S.typing, 0.12, 0.1, 0.85), boom(S.ding, 0.85, 0.3)],
  Sticker: [ticks(S.punch, 3, 0.3), boom(S.ding, 0.85, 0.25)],
  Thermostat: [each(S.tick, 0.05, 0.25, 0.06, 0.9), boom(S.buzz, 0.88, 0.25)],
  LockedIn: [boom(S.knock, 0.25, 0.45), each(S.tick, 0.35, 0.15, 0.08, 0.85)],
  HandOff: [once(S.swish, 0.3, 0.2), once(S.swish, 0.65, 0.2), boom(S.sink, 0.85, 0.35)],
  ForYou: [once(S.swish, 0.1, 0.25), boom(S.ding, 0.55, 0.35)],
  Memo: [once(S.page, 0.05, 0.35), boom(S.punch, 0.34, 0.45), steps(S.zip, 6, 0.45, 0.85, 0.12)],
  Tractor: [each(S.tick, 0.1, 0.2, 0.06, 0.85), boom(S.sink, 0.85, 0.3)],
  BathScale: [each(S.tick, 0.15, 0.2, 0.08, 0.85), boom(S.ding, 0.85, 0.3)],
  WasNow: [once(S.zip, 0.25, 0.3), boom(S.sting, 0.43, 0.4)],
  // Money and work
  Piggy: [bed(S.coins, 0.22)], // earshot has no metal clink (its taps read as a snare): the real coins recording, like Jar
  Vault: [each(S.tick, 0, 0.15, 0.12, 0.5), boom(S.impact, 0.5, 0.45), once(S.shimmer, 0.55, 0.3)],
  Receipt: [each(S.tick, 0, 0.12, 0.1)],
  Card: [once(S.swish, 0.18, 0.3), boom(S.buzz, 0.45, 0.45)],
  Stacks: [each(S.knock, 0.2, 0.25, 0.1, 0.8), boom(S.ding, 0.85, 0.35)],
  Paycheck: [once(S.land, 0.15, 0.3), each(S.page, 0.6, 0.5, 0.1)],
  Cubicle: [bed(S.typing, 0.2), once(S.swish, 0.4, 0.2)],
  Coffee: [each(S.drip, 0.1, 0.5, 0.12, 0.7)],
  Laptop: [once(S.knock, 0.1, 0.25), bed(S.typing, 0.35, 0.15)],
  Inbox: [steps(S.pop, 19, 0.05, 1, 0.12)],
  Shop: [once(S.knock, 0.4, 0.3), boom(S.bell, 0.42, 0.4)],
  Deal: [boom(S.land, 0.4, 0.4)],
  Leak: [each(S.drip, 0.2, 0.53, 0.18), bed(S.coins, 0.12)],
  Candles: [steps(S.pop, 12, 0.08, 0.78, 0.12)],
  Dice: [once(S.knock, 0.12, 0.3), once(S.knock, 0.26, 0.25), once(S.knock, 0.4, 0.2), boom(S.knock, 0.55, 0.35)],
  Slots: [each(S.tick, 0, 0.08, 0.08, 0.65), once(S.knock, 0.35, 0.3), once(S.knock, 0.5, 0.3), once(S.knock, 0.65, 0.3), boom(S.buzz, 0.67, 0.35)],
  BallChain: [each(S.land, 0.3, 1.3, 0.2)],
  Pyramid: [once(S.pop, 0.12, 0.25), once(S.pop, 0.24, 0.25), once(S.pop, 0.36, 0.25), boom(S.ding, 0.48, 0.35)],
  Printer: [each(S.tick, 0, 0.13, 0.12), bed(S.coins, 0.12)],
  Pie: [once(S.pop, 0.28, 0.25), once(S.pop, 0.45, 0.25), once(S.pop, 0.6, 0.25), boom(S.ding, 0.8, 0.35)],
  Magnet: [bed(S.coins, 0.18)],
  Faucet: [each(S.drip, 0.5, 0.6, 0.25)],
  Meter: [each(S.tick, 0.1, 0.2, 0.08, 0.8), boom(S.sting, 0.8, 0.4)],
  Conveyor: [each(S.tick, 0, 0.25, 0.1), once(S.swish, 0.55, 0.2), boom(S.ding, 0.75, 0.3)],
  Gears: [each(S.tick, 0, 0.2, 0.12)],
  PunchClock: [each(S.tick, 0, 0.5, 0.1), steps(S.punch, 4, 0.04, 0.79, 0.3)],
  Tag: [each(S.tick, 0, 0.15, 0.08), boom(S.ding, 0.9, 0.3)],
  Crown: [once(S.land, 0.3, 0.25), boom(S.sting, 0.65, 0.4)],
  Trophy: [once(S.zip, 0.2, 0.2), boom(S.sting, 0.4, 0.4)],
  Podium: [once(S.land, 0.45, 0.3), boom(S.sting, 0.5, 0.4), bed(S.crowd, 0.2, 0.45)],
  Lottery: [each(S.tick, 0.15, 0.08, 0.08, 0.7), boom(S.buzz, 0.72, 0.35)],
  // Mind and habits
  Brain: [once(S.shimmer, 0.05, 0.3), each(S.tick, 0.2, 0.4, 0.06)],
  Cloud: [bed(S.rain, 0.3, 0, 0.6), each(S.land, 0, 1.333, 0.15, 0.55), boom(S.shimmer, 0.7, 0.35)],
  Maze: [each(S.tick, 0.15, 0.15, 0.07, 0.85), boom(S.ding, 0.86, 0.35)],
  Book: [each(S.page, 0, 0.233, 0.1)],
  Alarm: [each(S.bell, 0, 0.12, 0.18, 0.5), once(S.land, 0.6, 0.25)],
  Couch: [once(S.buzz, 0.1, 0.1), each(S.tick, 0.5, 1, 0.06)],
  Pings: [ticks(S.pop, 11, 0.2)],
  Sleep: [each(S.tick, 0.3, 1, 0.08)],
  Meditate: [once(S.shimmer, 0.05, 0.25), each(S.bell, 0.3, 2, 0.12)],
  Journal: [each(S.tick, 0, 0.1, 0.05, 0.9)],
  Mask: [once(S.swish, 0.45, 0.2), boom(S.sink, 0.55, 0.4)],
  Shadow: [once(S.jet, 0.2, 0.15), boom(S.sub, 0.7, 0.45)],
  Cage: [once(S.knock, 0.3, 0.3), boom(S.shimmer, 0.9, 0.35)],
  OutBox: [each(S.knock, 0, 0.2, 0.2, 0.3), boom(S.swish, 0.4, 0.4), once(S.land, 0.8, 0.25)],
  Glass: [each(S.drip, 0.1, 0.15, 0.1, 0.8)],
  Iceberg: [boom(S.sub, 0.05, 0.4), bed(S.rain, 0.12)],
  Compass: [each(S.tick, 0, 0.08, 0.1, 0.65), boom(S.ding, 0.65, 0.35)],
  Route: [each(S.tick, 0.1, 0.12, 0.05, 0.8), boom(S.ding, 0.8, 0.35)],
  Vision: [once(S.shimmer, 0.05, 0.3)],
  Footsteps: [steps(S.knock, 10, 0.04, 0.85, 0.2)],
  Zone: [each(S.knock, 0.35, 0.5, 0.12, 0.8), boom(S.shimmer, 0.8, 0.35)],
  Slingshot: [each(S.tick, 0.1, 0.2, 0.06, 0.5), boom(S.jet, 0.55, 0.45)],
  Spring: [each(S.tick, 0.1, 0.2, 0.06, 0.5), boom(S.zip, 0.5, 0.45)],
  Seesaw: [each(S.knock, 0.6, 1.9, 0.15)],
  Juggle: [each(S.pop, 0.2, 0.333, 0.1)],
  Tightrope: [each(S.kick, 0.2, 0.9, 0.2)],
  Fog: [once(S.jet, 0, 0.12), boom(S.shimmer, 0.8, 0.35)],
  Megaphone: [each(S.whoosh, 0.1, 0.8, 0.15)],
  Pointing: [each(S.pop, 0, 1, 0.12), each(S.knock, 0.3, 0.6, 0.1)],
  Puppet: [boom(S.swish, 0.5, 0.45), once(S.ding, 0.7, 0.25)],
  // Nature and sky
  Sunrise: [once(S.shimmer, 0.3, 0.25), boom(S.sting, 0.85, 0.35)],
  Moon: [each(S.bell, 0, 1.667, 0.1)],
  Autumn: [each(S.page, 0.2, 0.7, 0.06)],
  Surf: [bed(S.rain, 0.3), once(S.jet, 0.1, 0.15)],
  Volcano: [each(S.land, 0, 0.3, 0.1, 0.4), boom(S.impact, 0.4, 0.5), bed(S.rain, 0.2, 0.4)],
  Eclipse: [boom(S.riser, 0.6, 0.3), once(S.shimmer, 0.6, 0.35)],
  Ridge: [each(S.knock, 0.2, 0.87, 0.1)],
  Drip: [each(S.drip, 0.77, 0.8, 0.22)], // lands every 24 frames
  Desert: [once(S.jet, 0, 0.12), each(S.knock, 0.3, 1.5, 0.08)],
  Snow: [each(S.knock, 0.2, 0.9, 0.12)],
  Campfire: [bed(S.rain, 0.15)],
  Lighthouse: [bed(S.rain, 0.2), each(S.bell, 0.5, 2.5, 0.1)],
  Boat: [bed(S.rain, 0.35), each(S.land, 0, 2, 0.25)],
  Anchor: [once(S.sink, 0, 0.2), boom(S.whoosh, 0.45, 0.4)],
  Island: [bed(S.rain, 0.2)],
  Cave: [once(S.jet, 0, 0.1), boom(S.shimmer, 0.5, 0.35)],
  Sprout: [once(S.knock, 0.3, 0.3), once(S.pop, 0.47, 0.2), once(S.pop, 0.64, 0.2), once(S.pop, 0.81, 0.2)],
  Bloom: [boom(S.shimmer, 0.4, 0.35), each(S.pop, 0.2, 0.3, 0.08, 0.8)],
  Cocoon: [once(S.knock, 0.38, 0.3), boom(S.shimmer, 0.4, 0.4)],
  Bird: [each(S.jet, 0, 3, 0.15)],
  Upstream: [bed(S.rain, 0.3), boom(S.swish, 0.4, 0.35), once(S.drip, 0.7, 0.3)],
  Waterfall: [bed(S.rain, 0.5)],
  Stars: [steps(S.bell, 6, 0.1, 0.85, 0.1)],
  Wish: [boom(S.whoosh, 0.38, 0.35), once(S.shimmer, 0.55, 0.3)],
  Orbit: [each(S.whoosh, 0.5, 2, 0.1)],
  Globe: [once(S.shimmer, 0.05, 0.2), each(S.tick, 0.5, 1, 0.05)],
  Windmill: [each(S.whoosh, 0.2, 0.6, 0.08)],
  Leap: [each(S.knock, 0.1, 0.25, 0.12, 0.4), boom(S.jet, 0.4, 0.45)],
  Sink: [boom(S.sink, 0.05, 0.4), once(S.zip, 0.6, 0.25)],
  Ice: [steps(S.knock, 7, 0.1, 0.85, 0.2), once(S.buzz, 0.6, 0.12)],
  // Action and struggle
  Sword: [boom(S.swish, 0.25, 0.45), once(S.ding, 0.6, 0.2)],
  Shield: [each(S.knock, 0.4, 0.27, 0.12)],
  Anvil: [each(S.punch, 0, 0.8, 0.3), each(S.bell, 0, 0.8, 0.08)],
  Fire: [bed(S.rain, 0.3), once(S.jet, 0, 0.15)],
  Breakthrough: [each(S.knock, 0.1, 0.25, 0.12, 0.45), boom(S.impact, 0.45, 0.5), once(S.punch, 0.45, 0.3)],
  Hurdles: [each(S.swish, 0.08, 1.444, 0.15), each(S.knock, 0.33, 1.444, 0.15)],
  TugOfWar: [bed(S.crowd, 0.15), each(S.land, 0.3, 0.6, 0.1, 0.85), boom(S.sub, 0.9, 0.4)],
  Rope: [each(S.knock, 0.2, 0.63, 0.12)],
  Pushup: [each(S.land, 0.5, 1, 0.15), each(S.pop, 1, 1, 0.15)],
  JumpRope: [each(S.tick, 0.2, 0.42, 0.15)],
  Swim: [bed(S.rain, 0.3)],
  Bike: [each(S.tick, 0, 0.2, 0.07)],
  Finish: [each(S.knock, 0.1, 0.25, 0.12, 0.6), boom(S.sting, 0.6, 0.4), bed(S.crowd, 0.25, 0.6)],
  Start: [once(S.pop, 0.02, 0.3), once(S.pop, 0.25, 0.3), boom(S.punch, 0.5, 0.5), once(S.whoosh, 0.52, 0.25)],
  Countdown: [once(S.pop, 0.01, 0.35), once(S.pop, 0.225, 0.35), once(S.pop, 0.45, 0.35), boom(S.sub, 0.675, 0.5)],
  Press: [each(S.land, 0.2, 0.5, 0.08), boom(S.sub, 0.5, 0.4)],
  Atlas: [each(S.land, 0.5, 1.75, 0.15)],
  Tunnel: [once(S.jet, 0, 0.1), boom(S.shimmer, 0.8, 0.35)],
  Escalator: [each(S.knock, 0.1, 0.25, 0.1)],
  Elevator: [each(S.tick, 0, 0.1, 0.08, 0.5), boom(S.bell, 0.5, 0.4)],
  Umbrella: [bed(S.rain, 0.35, 0, 0.65), boom(S.shimmer, 0.65, 0.35)],
  Fist: [boom(S.punch, 0.4, 0.4), once(S.sub, 0.4, 0.25)],
  Heartbeat: [each(S.kick, 0.1, 0.67, 0.3), boom(S.sub, 0.45, 0.45)],
  Parachute: [once(S.jet, 0, 0.2), boom(S.land, 0.35, 0.45), once(S.whoosh, 0.35, 0.2)],
  Pit: [each(S.knock, 0.2, 0.5, 0.1, 0.85), boom(S.shimmer, 0.85, 0.35)],
  Ceiling: [boom(S.impact, 0.45, 0.5), once(S.buzz, 0.45, 0.3)],
  Fly: [each(S.jet, 0, 1.5, 0.15)],
  Tornado: [bed(S.rain, 0.25), each(S.jet, 0, 1, 0.12)],
  Chess: [steps(S.knock, 5, 0.1, 0.54, 0.2), boom(S.shimmer, 0.6, 0.4), once(S.knock, 0.72, 0.35)],
  Cards: [each(S.tick, 0, 0.3, 0.05, 0.45), boom(S.sub, 0.45, 0.35), steps(S.land, 4, 0.5, 0.75, 0.15)],
  // Life and milestones
  Fuse: [bed(S.rain, 0.2), boom(S.riser, 1, 0.3)],
  Snowball: [each(S.land, 0.2, 0.5, 0.1), once(S.jet, 0.6, 0.12)],
  Wrecking: [boom(S.impact, 0.45, 0.5), once(S.whoosh, 0.4, 0.2)],
  Giant: [boom(S.sub, 0, 0.4), each(S.kick, 0.4, 0.9, 0.2)],
  Echoes: [each(S.knock, 0.2, 0.5, 0.1)],
  Hand: [boom(S.shimmer, 0.4, 0.35), once(S.zip, 0.7, 0.2)],
  Gate: [once(S.knock, 0.2, 0.25), boom(S.zip, 0.3, 0.35), each(S.knock, 0.6, 0.5, 0.08)],
  Confetti: [once(S.pop, 0.02, 0.35), bed(S.crowd, 0.3)],
  Fireworks: [each(S.whoosh, 0, 0.5, 0.06), each(S.punch, 0.6, 0.5, 0.2)],
  Gift: [each(S.knock, 0.1, 0.25, 0.1, 0.4), boom(S.shimmer, 0.4, 0.4), once(S.pop, 0.4, 0.3)],
  Letter: [once(S.page, 0.15, 0.25), once(S.page, 0.45, 0.2), boom(S.punch, 0.68, 0.4), once(S.sting, 0.7, 0.3)],
  Suitcase: [each(S.knock, 0.2, 0.5, 0.1), each(S.tick, 0.1, 0.15, 0.04)],
  Plane: [bed(S.rain, 0.2), boom(S.jet, 0.4, 0.4)],
  House: [steps(S.land, 6, 0.02, 0.5, 0.15), once(S.pop, 0.55, 0.2), once(S.pop, 0.67, 0.2), once(S.pop, 0.79, 0.2)],
  Skyline: [ticks(S.land, 7, 0.15), boom(S.ding, 0.8, 0.3)],
  Crane: [each(S.tick, 0, 0.2, 0.06), once(S.land, 0.8, 0.3)],
  Blueprint: [steps(S.tick, 13, 0.03, 0.85, 0.08)],
  Ripple: [boom(S.drip, 0.15, 0.45)],
  Mic: [once(S.knock, 0.02, 0.25), bed(S.crowd, 0.1)],
  Vlog: [once(S.shutter, 0.05, 0.35), each(S.tick, 0.5, 1, 0.05)],
  Loading: [each(S.tick, 0, 0.1, 0.05, 0.45), boom(S.ding, 0.75, 0.4)],
  Likes: [each(S.pop, 0, 0.35, 0.1)],
  Candle: [each(S.tick, 0.3, 1, 0.1)],
  Bench: [once(S.jet, 0, 0.1), each(S.page, 0.5, 1.2, 0.06)],
  Grave: [once(S.bell, 0.45, 0.2), boom(S.sub, 0.6, 0.4)],
  Cake: [steps(S.pop, 7, 0.07, 0.4, 0.15), boom(S.whoosh, 0.6, 0.35)],
  Ages: [each(S.tick, 0, 0.3, 0.05), once(S.bell, 0.9, 0.15)],
  Kite: [each(S.jet, 0, 1.5, 0.1)],
  Balloon: [once(S.pop, 0.05, 0.2), boom(S.zip, 0.5, 0.35)],
  Lead: [each(S.knock, 0.2, 0.5, 0.1), each(S.pop, 0.4, 0.27, 0.12, 0.6)],
  // History and engineering (the "built" series)
  Giza: [each(S.knock, 1.97, 2, 0.2), steps(S.land, 7, 0.11, 0.9, 0.15), boom(S.ding, 0.9, 0.3)],
  Sledge: [each(S.drip, 0.2, 0.6, 0.15), each(S.knock, 0.1, 0.5, 0.08)],
  Obelisk: [each(S.tick, 0, 0.15, 0.06, 0.85), boom(S.land, 0.85, 0.45)],
  Aqueduct: [bed(S.rain, 0.25)],
  Arch: [steps(S.knock, 8, 0.05, 0.5, 0.2), boom(S.land, 0.6, 0.45), once(S.land, 0.72, 0.2)],
  Colosseum: [steps(S.land, 4, 0, 0.8, 0.2), bed(S.crowd, 0.15, 0.8)],
  GreatWall: [ticks(S.swish, 5, 0.2)],
  Stonehenge: [steps(S.knock, 8, 0, 0.6, 0.15), boom(S.land, 0.85, 0.4)],
  Lever: [each(S.land, 0.83, 1.667, 0.15)],
  Pulley: [each(S.tick, 0, 0.2, 0.07, 0.85), boom(S.ding, 0.85, 0.3)],
  Treadwheel: [each(S.knock, 0.2, 0.5, 0.1), each(S.tick, 0, 0.25, 0.06), boom(S.ding, 0.9, 0.3)],
  Screw: [bed(S.rain, 0.2), each(S.tick, 0, 0.4, 0.05)],
  Waterwheel: [bed(S.rain, 0.35), each(S.knock, 0, 0.75, 0.08)],
  Trebuchet: [boom(S.jet, 0.4, 0.45), once(S.land, 0.95, 0.25)],
  Sundial: [each(S.tick, 0, 1, 0.08)],
  Trireme: [each(S.kick, 0, 0.733, 0.2), bed(S.rain, 0.2)], // the rowing drum, one beat per stroke
  Quarry: [each(S.knock, 0.33, 0.667, 0.25, 0.6), boom(S.impact, 0.6, 0.45)],
  Scroll: [once(S.page, 0.05, 0.3)],
  Tablet: [steps(S.tick, 15, 0, 0.9, 0.12)], // one press per cuneiform sign
  Ruins: [once(S.shimmer, 0.1, 0.25), once(S.sink, 0.7, 0.2)],
  Dig: [each(S.page, 0, 0.4, 0.06, 0.8), boom(S.shimmer, 0.8, 0.35)],
  Tomb: [once(S.sink, 0.25, 0.2), boom(S.shimmer, 0.5, 0.35)],
  Hieroglyphs: [steps(S.tick, 11, 0, 0.9, 0.08), bed(S.rain, 0.08)], // one per sign as it lights
  Moai: [each(S.land, 0.5, 1.05, 0.25)],
  Road: [ticks(S.land, 4, 0.3)],
  Canal: [bed(S.rain, 0.25, 0, 0.6), once(S.land, 0.7, 0.3)],
  Printing: [each(S.punch, 0.5, 2, 0.3), each(S.page, 1.3, 2, 0.15)],
  Steam: [each(S.kick, 0, 0.5, 0.15), bed(S.rain, 0.1)],
  Telegraph: [each(S.tick, 0, 0.4, 0.25)],
  Dome: [steps(S.land, 7, 0, 0.7, 0.15), boom(S.shimmer, 0.75, 0.35)],
  Masonry: [ticks(S.land, 9, 0.25)],
  Concrete: [bed(S.rain, 0.15, 0.1, 0.65), each(S.knock, 0.3, 0.6, 0.06, 0.65), boom(S.land, 0.72, 0.3)],
  Buttress: [each(S.land, 0.3, 1, 0.08, 0.3), boom(S.sub, 0.4, 0.35)],
  Castle: [steps(S.land, 4, 0, 0.65, 0.2), boom(S.impact, 0.75, 0.4), bed(S.rain, 0.1)],
  Petra: [each(S.knock, 0, 0.25, 0.12, 0.85), boom(S.shimmer, 0.88, 0.3)],
  Terraces: [steps(S.land, 7, 0, 0.8, 0.15)],
  StepPyramid: [steps(S.land, 7, 0, 0.8, 0.18), boom(S.ding, 0.82, 0.3)],
  Pagoda: [each(S.land, 0.2 * 3, 0.2, 0.08, 0.75), boom(S.sub, 0.25, 0.4)],
  IronTower: [each(S.punch, 0, 0.35, 0.12, 0.85), boom(S.ding, 0.87, 0.3)],
  Suspension: [each(S.tick, 0.5, 0.1, 0.05, 0.45), steps(S.knock, 10, 0.5, 0.85, 0.1)],
  Dam: [bed(S.rain, 0.25, 0.2), boom(S.sub, 0.25, 0.35)],
  Borer: [bed(S.rain, 0.25), each(S.land, 0, 0.4, 0.1)],
  Rails: [each(S.punch, 0.1, 0.533, 0.2, 0.9)],
  Skeleton: [each(S.punch, 0.3, 0.3, 0.1, 0.85), boom(S.shimmer, 0.88, 0.3)], // rivets as the skin goes on
  Hypocaust: [bed(S.rain, 0.15), once(S.shimmer, 0.5, 0.2)],
  Windcatcher: [each(S.jet, 0, 2.3, 0.1)],
  Qanat: [bed(S.rain, 0.2, 0.1), boom(S.drip, 0.72, 0.3)],
  Stepwell: [each(S.knock, 0.6, 0.5, 0.08), once(S.drip, 0.95, 0.2)],
  Sewer: [bed(S.rain, 0.35), each(S.drip, 0.3, 0.8, 0.15)],
  Antikythera: [each(S.tick, 0, 0.25, 0.1), once(S.shimmer, 0.1, 0.2)],
  WaterClock: [each(S.drip, 0.3, 0.667, 0.25)],
  Loom: [each(S.swish, 0.4, 0.8, 0.15), each(S.knock, 0.8, 0.8, 0.1)],
  Potter: [bed(S.rain, 0.1), each(S.tick, 0, 0.3, 0.04)],
  Casting: [bed(S.rain, 0.25, 0.05, 0.6), boom(S.impact, 0.65, 0.4)],
  Pendulum: [each(S.tick, 0, 0.5, 0.3)],
  Locomotive: [each(S.kick, 0, 0.42, 0.2), each(S.punch, 0.2, 0.84, 0.08)],
  Airship: [each(S.tick, 0, 0.15, 0.04), once(S.jet, 0, 0.12)],
  Biplane: [each(S.tick, 0, 0.1, 0.06), boom(S.jet, 0.45, 0.35)],
  Obscura: [boom(S.shimmer, 0.3, 0.35)],
  Cannon: [each(S.tick, 0, 0.12, 0.06, 0.45), boom(S.impact, 0.45, 0.55)],
  SiegeTower: [each(S.land, 0.2, 0.45, 0.12, 0.65), boom(S.land, 0.7, 0.45)],
  BatteringRam: [each(S.punch, 0.5, 1, 0.3), boom(S.impact, 0.7, 0.45)],
  Longship: [each(S.kick, 0, 0.84, 0.2), bed(S.rain, 0.2)],
  Caravan: [once(S.jet, 0, 0.1), each(S.knock, 0.2, 0.52, 0.08)],
  Nazca: [each(S.knock, 0.1, 0.4, 0.08, 0.85), boom(S.shimmer, 0.9, 0.35)],
  Rosetta: [boom(S.shimmer, 0.4, 0.35)], // the names link up
  Terracotta: [once(S.shimmer, 0.05, 0.25), each(S.kick, 0.3, 1.2, 0.08)],
  Mummy: [each(S.page, 0, 0.5, 0.1, 0.85)],
  Shipwreck: [bed(S.rain, 0.12), boom(S.shimmer, 0.5, 0.35)],
  CavePaint: [bed(S.rain, 0.08), steps(S.shimmer, 3, 0.2, 0.8, 0.15)],
  TreeRings: [steps(S.tick, 16, 0, 0.85, 0.15)],
  HalfLife: [steps(S.ding, 4, 0, 0.85, 0.2)],
  Lidar: [each(S.tick, 0, 0.1, 0.05, 0.85), once(S.jet, 0, 0.1), boom(S.shimmer, 0.6, 0.35)],
};
// The reference edits use 0.3-1.9 noticeable effects per 10 s, so accents compete for space: one per 2.5 s, the more
// important one wins (0 = the drop … 5 = a whoosh). Hit words and most cuts stay silent: the picture already hits there.
const ACCENT_GAP = 2.5;

export function sfxCues(scenes: SceneLike[], words: WordLike[] = [], seed = 0, calm = false): Cue[] {
  const accents: { cue: Cue; rank: number; t: number }[] = [];
  const quiet: Cue[] = []; // beds and on-screen contact sounds: low, always kept
  const accent = (rank: number, src: string, t: number, volume: number) => accents.push({ cue: hit(src, t, volume), rank, t });
  const drop = dropAt(scenes);
  const end = scenes.at(-1)?.end ?? Infinity;
  scenes.forEach((s, i) => {
    const [na, nq] = [accents.length, quiet.length];
    const at = s.start ?? 0;
    const dur = Math.max(0.5, (s.end ?? at + 3) - at);
    const props = (s.props ?? {}) as { stat?: unknown; label?: string; steps?: string[]; items?: string[]; trend?: string; events?: unknown[] };
    if (i === 0) accent(1, SFX.sub, at, 0.45);
    else if (at === drop) (accent(0, SFX.riser, at, 0.35), accent(0, SFX.sub, at, 0.7));
    else if (s.purpose === "payoff") accent(1, SFX.sub, at, 0.6);
    else if (transitionFor(i, s, seed, calm) === "whip") accent(5, SFX.whoosh, at, 0.22);
    // Things appearing, at the frames Mono.tsx animates them.
    if (props.label) accent(4, SFX.pop, at + 0.2, 0.4); // the stamp pops in
    if (s.component === "Split") accent(4, SFX.pop, at + 0.1, 0.4);
    if (props.stat) (accent(4, SFX.pop, at + 0.15, 0.4), accent(2, SFX.ding, at + dur * 0.8, 0.35)); // counter starts / lands
    if (s.component === "Climb" && props.steps) {
      const n = props.steps.length;
      for (let k = 1; k < n; k++) accent(4, SFX.pop, at + 8 * FRAME + (k / (n - 0.5)) * (dur * 0.8 - 8 * FRAME), 0.35); // a step lights
    }
    if (s.component === "Summit") accent(2, SFX.ding, at + dur * 0.74, 0.35); // the flag is planted
    if (s.component === "Heights" && props.items) props.items.forEach((_, k, all) => quiet.push(hit(SFX.land, at + tickAt(k, all.length, dur * 30) / 30, 0.3))); // each one rises
    if (s.component === "Timeline" && props.events) props.events.forEach((_, k, all) => quiet.push(hit(SFX.pop, at + tickAt(k, all.length, dur * 30) / 30, 0.3))); // each date drops in
    if (s.component === "Plan" && props.items) saidAt(props.items, words.filter((w) => w.scene === i), at, dur).forEach((d) => accent(4, SFX.pop, at + d, 0.35)); // a box is ticked as it's said
    if (s.component === "Chart" && props.trend !== "down") accent(2, SFX.ding, at + dur * 0.75, 0.35); // the line hits its peak
    if (s.component === "Door") accent(2, SFX.sub, at + 0.3, 0.5); // it swings open
    // A scene's big moment lands on its hit word when it has one (the components time it the same way).
    const big = (frac: number) => hitTime(i, s.hit, words) ?? at + dur * frac;
    if (s.component === "Rocket") (accent(2, SFX.riser, big(0.4), 0.3), accent(2, SFX.sub, big(0.4), 0.55)); // liftoff
    if (s.component === "Chains") accent(2, SFX.sub, big(0.45), 0.55); // the chains snap
    if (s.component === "Bulb") accent(2, SFX.ding, big(0.45), 0.35); // the light comes on
    if (s.component === "Lock") accent(2, SFX.sub, big(0.55), 0.5); // the shackle springs
    if (s.component === "Target") [0, 1, 2, 3].forEach((k) => accent(k === 3 ? 2 : 4, k === 3 ? SFX.ding : SFX.pop, at + tickAt(k, 4, dur * 30) / 30, 0.35)); // arrows land
    if (s.component === "Puzzle") for (let k = 0; k < 9; k++) quiet.push(hit(SFX.pop, at + tickAt(k, 9, dur * 30) / 30, 0.15)); // pieces snap in
    if (s.component === "BigWord") accent(2, SFX.sub, at + 0.12, 0.5); // the slam
    for (const b of BEATS[s.component] ?? []) {
      const t0 = at;
      if ("big" in b) accent(2, b.src, big(b.big), b.vol);
      else if ("at" in b) quiet.push(hit(b.src, t0 + b.at * dur, b.vol));
      else if ("each" in b) quiet.push(...every(b.src, t0 + b.each[0], t0 + b.each[2] * dur, b.each[1], b.vol));
      else if ("steps" in b) for (let k = 0; k < b.steps[0]; k++) quiet.push(hit(b.src, t0 + dur * (b.steps[1] + ((b.steps[2] - b.steps[1]) * (k + 0.5)) / b.steps[0]), b.vol));
      else if ("ticks" in b) for (let k = 0; k < b.ticks; k++) quiet.push(hit(b.src, t0 + tickAt(k, b.ticks, dur * 30) / 30, b.vol));
      else quiet.push({ src: b.src, at: t0 + b.bed[0] * dur, volume: b.vol, dur: (b.bed[1] - b.bed[0]) * dur });
    }
    if (i === scenes.length - 1) (accent(2, SFX.ding, at + 0.3, 0.3), accent(1, SFX.sub, at + dur, 0.5)); // the final button as the picture settles
    switch (s.sfx) {
      case "punch":
      case "braam": accent(2, SFX.sub, at, 0.55); break;
      case "glitch": accent(4, SFX.pop, at + 0.1, 0.4); break;
      case "cash": accent(3, SFX.coins, at + 0.4, 0.45); break;
      case "crowd": quiet.push({ src: SFX.crowd, at, volume: 0.3, dur }); break;
      case "clock": if (s.component !== "Clock") quiet.push(...every(SFX.tick, at, at + dur, 0.5, 0.45)); break;
      case "heartbeat": quiet.push(...heartbeat(at, at + dur, 0.45)); break;
    }
    const bed = BED[s.component];
    if (bed) quiet.push({ src: bed[0], at, volume: bed[1], dur });
    if (s.component === "Clock") quiet.push(...every(SFX.tick, at, at + dur, 0.5, 0.45));
    if (s.component === "Boxing") quiet.push(...every(SFX.punch, at + 0.2, at + dur, 0.6, 0.18)); // contact every 18 frames at +6
    if (s.component === "Fall") quiet.push(hit(SFX.land, at + 0.47, 0.45)); // lands at frame 14
    if (s.component === "Lift") quiet.push(...every(SFX.land, at + 1.6, at + dur, 1.6, 0.25)); // plates touch down every 48 frames
    if (s.component === "Calendar") quiet.push(...every(SFX.tick, at + 0.2, at + dur * 0.85, 0.3, 0.2)); // days being crossed out
    if (s.component === "Bricks") quiet.push(...every(SFX.land, at + 0.3, at + dur * 0.85, 0.5, 0.15)); // bricks set down
    if (s.component === "Dominoes") for (let k = 0; k < 8; k++) quiet.push(hit(SFX.land, at + (tickAt(k, 8, dur * 30) + 6) / 30, 0.12 + k * 0.03)); // each one lands, louder as they grow
    if (s.component === "Chains") quiet.push(hit(SFX.punch, big(0.45), 0.35));
    if (s.component === "Car") quiet.push(...every(SFX.whoosh, at + 0.5, at + dur, 1, 0.1)); // street lights passing
    // A scene's sounds follow its line's energy like the voice does, so a quiet line isn't buried under its own effects.
    const eg = 10 ** ((ENERGY_DB[s.energy ?? "high"] ?? 0) / 20);
    for (const a of accents.slice(na)) a.cue.volume *= eg;
    for (const q of quiet.slice(nq)) q.volume *= eg;
  });
  const kept: typeof accents = [];
  for (const a of [...accents].sort((x, y) => x.rank - y.rank || x.t - y.t)) {
    // Sounds of the same moment (the drop's riser + sub) stack; different moments need room.
    if (kept.every((k) => Math.abs(k.t - a.t) < 0.01 || Math.abs(k.t - a.t) >= ACCENT_GAP)) kept.push(a);
  }
  return [...kept.map((k) => k.cue), ...quiet].filter((c) => c.at < end + OUTRO - 0.5).sort((x, y) => x.at - y.at);
}

// The Director may pick a camera move; otherwise a per-project sequence where consecutive scenes never share one.
// calm (explainers) only rotates through the slow moves.
const CALM_CAMERAS: Camera[] = ["focus", "reveal", "track", "push", "pull", "pan", "tilt"];
// A drawing has no known focus point: the focus moves (1.15–1.55x on its centre) cropped its sides, worst in a vertical
// Short. Drawn scenes get only the gentle moves (up to ~1.1x), which stay inside the stage's margin.
const GENTLE = new Set<Camera>(["push", "pull", "pan", "tilt", "orbit", "handheld"]);
export const cameraFor = (i: number, s: SceneLike, seed = 0, calm = false): Camera => {
  const drawn = s.component === "Drawn";
  if ((CAMERAS as readonly string[]).includes(s.camera ?? "") && (!drawn || GENTLE.has(s.camera as Camera))) return s.camera as Camera;
  const from = (calm ? CALM_CAMERAS : CAMERAS).filter((c) => !drawn || GENTLE.has(c));
  return from[pick(from.length, seed, i)];
};
// zoom/whip/glitch are CSS moves in MonoFrame; dissolve/blinds/burn are WebGL effects in MonoFx's FxLayer.
const TRANSITIONS = ["zoom", "whip", "glitch", "dissolve", "blinds", "burn"] as const;
// calm (explainers): every scene fades in, no flashes.
export const transitionFor = (i: number, s: SceneLike, seed = 0, calm = false) => (calm ? "fade" : s.purpose === "payoff" || i === 0 ? "flash" : TRANSITIONS[pick(TRANSITIONS.length, seed + 7, i)]);
// Scenes whose text overlays are centered (or absent), so their drawing can be mirrored without breaking a label.
// (Anything with text drawn in SVG, like the clock's numerals or the jar's label, would read backwards: not listed.)
const MIRRORABLE = new Set(["Crowd", "Fall", "Boxing", "Grind", "Lift", "PullUp", "BigWord", "Cash", "Phone", "Door", "Bricks", "Rush", "Hourglass", "Rocket", "Tree", "Wheel", "Chains", "Traffic", "Dominoes", "Ladder", "Bridge", "Storm", "Mirror", "Bulb", "Boulder", "Wallet", "Lock", "Puzzle", "Train"]);
// Frame (within its scene) of the k-th of n timed beats (Plan's ticks, falling dominoes); Mono.tsx and the cues share it.
export const tickAt = (k: number, n: number, dur: number) => 10 + ((k + 0.5) / n) * (dur * 0.8 - 10);
// Seconds after `from` at which each listed item is spoken: each item's first word, matched in order among `words`.
// An item that isn't said falls back to tickAt spacing over `dur` seconds. Plan ticks its boxes here; sfxCues pops here.
export function saidAt(items: string[], words: { word: string; start: number }[], from: number, dur: number): number[] {
  let next = 0;
  return items.map((it, k) => {
    const target = norm(it.split(/\s+/)[0]);
    const j = words.findIndex((w, x) => x >= next && norm(w.word) === target);
    if (j < 0) return tickAt(k, items.length, dur * 30) / 30;
    next = j + 1;
    return words[j].start - from;
  });
}
export const mirrorFor = (i: number, s: SceneLike, seed = 0) => MIRRORABLE.has(s.component) && rand(seed + 13, i) % 2 === 1;
// Which mono backdrop a project gets (Explainer.tsx draws them).
export const BACKDROPS = ["dust", "beams", "skyline", "embers"] as const;
export const backdropFor = (seed = 0) => BACKDROPS[seed % BACKDROPS.length];
// Which film look a project's picture gets (MonoFx.tsx applies it); hashed so it doesn't follow the backdrop.
export const LOOKS = ["clean", "scanlines", "noise"] as const;
export const lookFor = (seed = 0) => LOOKS[rand(seed, 77) % LOOKS.length];

// Spoken uncut, starred on screen ("SH*T"), like the reference videos.
export const censor = (w: string) => w.replace(/\b(fuck\w*|shit\w*|bitch\w*|damn\w*)/gi, (m) => m[0] + m.slice(1).replace(/[aeiou]/i, "*"));
