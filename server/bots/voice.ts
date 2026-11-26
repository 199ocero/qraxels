import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Job } from "../office.ts";
import { ROOT, dir, readJson, writeJson } from "../project.ts";
import type { Scenes, Word } from "../schemas.ts";

// What the Explainer composition plays: one or more audio files placed on the timeline.
export type AudioClip = { src: string; start: number };
export type VoicedScenes = Scenes & { audio: AudioClip[]; words: Word[] };
type Timing = { start: number; end: number };

export function run(cmd: string, args: string[], onLine: (l: string) => void = () => {}, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, signal });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => {
      err += d;
      onLine(String(d).trim().split("\n").pop()!.slice(0, 80));
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))));
  });
}

// Local engines write voice.wav + words.json + timings.json into the project's audio folder.
async function local(id: string, args: string[], activity: (l: string) => void, signal: AbortSignal): Promise<{ audio: AudioClip[]; words: Word[]; timings: Timing[] }> {
  activity("warming up my voice…");
  await run("uv", args, () => activity("speaking…"), signal);
  return {
    audio: [{ src: "audio/voice.wav", start: 0 }],
    words: readJson<Word[]>(dir(id, "audio", "words.json")),
    timings: readJson<Timing[]>(dir(id, "audio", "timings.json")),
  };
}

// One ElevenLabs request per scene; each clip is placed at its scene's start time.
async function elevenlabs(id: string, scenes: Scenes["scenes"], mono: boolean, activity: (l: string) => void, signal: AbortSignal) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = (mono && process.env.ELEVENLABS_VOICE_ID_MONO) || process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) throw new Error("VID_VOICE=elevenlabs needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env");
  const audio: AudioClip[] = [];
  const words: Word[] = [];
  const timings: Timing[] = [];
  let t = 0;
  for (const [i, s] of scenes.entries()) {
    activity(`speaking scene ${i + 1}/${scenes.length}`);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
      method: "POST",
      signal,
      headers: { "xi-api-key": key, "content-type": "application/json" },
      // Motivation wants a performance, not a reading: low stability + high style exaggerate the delivery.
      body: JSON.stringify({ text: s.narration, model_id: "eleven_multilingual_v2", voice_settings: mono ? { speed: s.speed, stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true } : { speed: s.speed } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { audio_base64: string; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
    const src = `audio/scene-${String(i).padStart(2, "0")}.mp3`;
    writeFileSync(dir(id, src), Buffer.from(j.audio_base64, "base64"));
    const a = j.alignment;
    let cur: Word | null = null;
    a.characters.forEach((ch, k) => {
      if (/\s/.test(ch)) return void (cur = null);
      if (!cur) words.push((cur = { word: "", start: t + a.character_start_times_seconds[k], end: 0, scene: i }));
      cur.word += ch;
      cur.end = t + a.character_end_times_seconds[k];
    });
    audio.push({ src, start: t });
    const end = t + (a.character_end_times_seconds.at(-1) ?? 0) + 0.15 + s.pause_after;
    timings.push({ start: t, end });
    t = end;
  }
  writeJson(dir(id, "audio", "words.json"), words);
  return { audio, words, timings };
}

// Inworld TTS-2, paid per character. One request per scene; the raw 16-bit audio is joined into one voice.wav with each
// scene's pause and levelled like Kokoro's, so the music still sits right under it. A bracketed instruction steers the
// delivery: Inworld doesn't speak it but bills it as characters, so it stays short.
const STEER = { calm: "[warm, calm and curious, in a low tone]", hype: "[intense, with building conviction, like a coach]" };
const PCM_RATE = 24000;
type InworldAlignment = { words: string[]; wordStartTimeSeconds: number[]; wordEndTimeSeconds: number[] };

async function inworld(id: string, scenes: Scenes["scenes"], mono: boolean, activity: (l: string) => void, signal: AbortSignal) {
  const key = process.env.INWORLD_API_KEY;
  const voiceId = (mono && process.env.INWORLD_VOICE_ID_MONO) || process.env.INWORLD_VOICE_ID || "Dennis";
  if (!key) throw new Error("VID_VOICE=inworld needs INWORLD_API_KEY in .env (the Base64 API credential from the Inworld Portal)");
  const pcm: Buffer[] = [];
  const words: Word[] = [];
  const timings: Timing[] = [];
  let t = 0;
  for (const [i, s] of scenes.entries()) {
    activity(`speaking scene ${i + 1}/${scenes.length}`);
    const res = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      signal,
      headers: { authorization: `Basic ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        text: `${mono ? STEER.hype : STEER.calm} ${s.narration}`,
        voiceId,
        modelId: "inworld-tts-2",
        audioConfig: { audioEncoding: "PCM", sampleRateHertz: PCM_RATE, speakingRate: s.speed },
        deliveryMode: mono ? "CREATIVE" : "BALANCED",
        applyTextNormalization: "ON",
        timestampType: "WORD",
      }),
    });
    if (!res.ok) throw new Error(`Inworld ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { audioContent: string; timestampInfo?: { wordAlignment?: InworldAlignment } };
    const clip = Buffer.from(j.audioContent, "base64");
    const pause = Buffer.alloc(2 * Math.round(s.pause_after * PCM_RATE));
    words.push(...inworldWords(j.timestampInfo?.wordAlignment, t, i));
    pcm.push(clip.subarray(0, clip.length & ~1), pause);
    const end = t + (Math.floor(clip.length / 2) + pause.length / 2) / PCM_RATE;
    timings.push({ start: t, end });
    t = end;
  }
  writeFileSync(dir(id, "audio", "voice.wav"), wav(Buffer.concat(pcm), PCM_RATE));
  activity("levelling my voice");
  await run("uv", ["run", "--project", "voice", "python", "voice/kokoro_tts.py", "--level", dir(id, "audio", "voice.wav")], () => {}, signal);
  writeJson(dir(id, "audio", "words.json"), words);
  return { audio: [{ src: "audio/voice.wav", start: 0 }], words, timings };
}

// Inworld's word list, as captions. Its docs show it both as bare words ("Hello,") and as every token including spaces
// and punctuation, so this takes either: blanks are dropped, "$" and "(" join the next word, other punctuation the
// previous one (as in voice/kokoro_tts.py), and a steering [instruction] that shows up is never captioned.
export function inworldWords(a: InworldAlignment | undefined, offset: number, scene: number): Word[] {
  const out: Word[] = [];
  let held = "";
  let inTag = false;
  a?.words.forEach((raw, k) => {
    let w = raw;
    if (inTag) {
      if (!w.includes("]")) return;
      inTag = false;
      w = w.slice(w.indexOf("]") + 1);
    }
    w = w.replace(/\[[^\]]*\]/g, "");
    if (w.includes("[")) {
      inTag = true;
      w = w.slice(0, w.indexOf("["));
    }
    w = w.trim();
    if (!w) return;
    if (!/[A-Za-z0-9]/.test(w)) {
      if (/^[$£€¥(“‘]+$/.test(w)) held += w;
      else if (out.length) out[out.length - 1].word += w;
      return;
    }
    const at = (x: number) => Math.round((offset + x) * 1000) / 1000;
    out.push({ word: held + w, start: at(a.wordStartTimeSeconds[k]), end: at(a.wordEndTimeSeconds[k]), scene });
    held = "";
  });
  return out;
}

// A 16-bit mono WAV around raw PCM samples.
export function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export const voice: Job = async ({ state, activity, signal }) => {
  const scenesPath = dir(state.id, "scenes.json");
  const data = readJson<Scenes>(scenesPath);
  mkdirSync(dir(state.id, "audio"), { recursive: true });
  // Both styles share the box-head look and its voice settings (the *_MONO keys); only motivation is fired up.
  const hype = state.layout === "mono";
  const kVoice = process.env.KOKORO_VOICE_MONO || "af_heart";
  const engine = process.env.VID_VOICE_MONO || process.env.VID_VOICE || "kokoro";
  const io = [dir(state.id, "scenes.json"), dir(state.id, "audio")];
  const extra = hype ? ["rage"] : [];
  let r;
  if (engine === "elevenlabs") r = await elevenlabs(state.id, data.scenes, hype, activity, signal);
  else if (engine === "inworld") r = await inworld(state.id, data.scenes, hype, activity, signal);
  else r = await local(state.id, ["run", "--project", "voice", "python", "voice/kokoro_tts.py", ...io, kVoice, ...extra], activity, signal);
  if (r.timings.length !== data.scenes.length) throw new Error("voice timings don't match the scene count");
  const voiced: VoicedScenes = {
    scenes: data.scenes.map((s, i) => ({ ...s, start: r.timings[i].start, end: r.timings[i].end })),
    audio: r.audio,
    words: r.words,
  };
  writeJson(scenesPath, voiced);
  const secs = voiced.scenes.at(-1)!.end!;
  const warn =
    state.layout === "long"
      ? secs < 480 ? " Heads up: under 8 minutes, so YouTube won't allow mid-roll ads." : ""
      : secs < 60 ? " Heads up: under 60s, too short for TikTok Creator Rewards." : secs > 125 ? " Heads up: over 2 minutes." : "";
  return `Narration recorded: ${secs.toFixed(1)}s, ${r.words.length} words timed.${warn}`;
};

export const readVoiced = (id: string) => JSON.parse(readFileSync(dir(id, "scenes.json"), "utf8")) as VoicedScenes;
