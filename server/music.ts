import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, readJson, writeJson, type Layout } from "./project.ts";
import type { Track } from "../remotion/mono.ts";

// Motivation music: every file in public/sound/music/ is a candidate. Drop your own tracks there (mp3, wav, ogg, flac);
// each one is analyzed once (tempo, downbeat, drop) by voice/music_info.py and cached in tracks.json.
// credits.json maps a file name to the credit line its licence requires (e.g. CC BY); the render step passes it on.
export const MUSIC_DIR = join(ROOT, "public", "sound", "music");
const AUDIO = /\.(mp3|wav|ogg|flac)$/i;
// Explainers (every layout but "mono") use the calm tracks.
export const musicDirFor = (layout: Layout) => (layout === "mono" ? MUSIC_DIR : join(MUSIC_DIR, "calm"));
export const musicFiles = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => AUDIO.test(f)).sort() : []);

type Info = { size: number; mtime: number; bpm: number; downbeat: number; drop: number | null; duration: number; level: number; mid: number; start: number };
export type RunFn = (args: string[]) => Promise<string>;

// MONO_MUSIC: unset/"auto" = rotate through the folder, a file name = always that track, "off" = no music (add a sound in TikTok).
export const CRUSHED = -8;

// `served` is where the page loads the folder from (public/ is the web root).
export async function musicLibrary(run: RunFn, dir = MUSIC_DIR, pick = process.env.MONO_MUSIC, served = "sound/music"): Promise<Track[]> {
  if (pick === "off" || !existsSync(dir)) return [];
  const files = musicFiles(dir);
  const cacheFile = join(dir, "tracks.json");
  const cache: Record<string, Info> = existsSync(cacheFile) ? readJson(cacheFile) : {};
  const stat = (f: string) => statSync(join(dir, f));
  const stale = files.filter((f) => cache[f]?.size !== stat(f).size || cache[f]?.mtime !== stat(f).mtimeMs || cache[f]?.start === undefined);
  if (stale.length) {
    const out = JSON.parse(await run(["run", "--project", "voice", "python", "voice/music_info.py", ...stale.map((f) => join(dir, f))])) as (Info & { file: string })[];
    out.forEach((r, i) => (cache[stale[i]] = { size: stat(stale[i]).size, mtime: stat(stale[i]).mtimeMs, bpm: r.bpm, downbeat: r.downbeat, drop: r.drop, duration: r.duration, level: r.level, mid: r.mid, start: r.start }));
    writeJson(cacheFile, cache);
  }
  const credits: Record<string, string> = existsSync(join(dir, "credits.json")) ? readJson(join(dir, "credits.json")) : {};
  // A track whose loud part sits above CRUSHED dBFS RMS was limited until it clipped (drift-phonk.mp3: -6.7, thousands
  // of samples over full scale); that built-in distortion is plainly audible under a voice once the music is up after
  // the drop. It's left out of the rotation; naming it in MONO_MUSIC still uses it.
  const auto = files.filter((f) => cache[f].level <= CRUSHED);
  const chosen = pick && pick !== "auto" ? files.filter((f) => f === pick) : auto;
  if (pick && pick !== "auto" && !chosen.length) throw new Error(`${pick} is set as the music but there's no such file in ${relative(ROOT, dir)}/`);
  return chosen.map((f) => ({
    src: `${served}/${f}`,
    drop: cache[f].drop,
    bpm: cache[f].bpm,
    downbeat: cache[f].downbeat,
    duration: cache[f].duration,
    start: cache[f].start,
    level: cache[f].level,
    mid: cache[f].mid,
    pulseEvery: cache[f].bpm > 130 ? 2 : 1, // fast tempos pulse every other beat
    ...(credits[f] ? { credit: credits[f] } : {}),
  }));
}
