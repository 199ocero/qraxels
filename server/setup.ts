// npm run setup: checks the tools, installs the voice env, downloads the models. Safe to re-run.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { ROOT } from "./project.ts";

const ok = (m: string) => console.log(`  ✔ ${m}`);
const bad: string[] = [];
const has = (cmd: string, args = ["--version"]) => spawnSync(cmd, args, { encoding: "utf8" });

console.log("\nChecking tools…");
const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok(`node ${process.versions.node}`) : bad.push("Node 20+ is required: https://nodejs.org");
for (const [cmd, fix] of [
  ["claude", "Install Claude Code: https://claude.com/claude-code, then run `claude` once to log in"],
  ["uv", "brew install uv   (or https://docs.astral.sh/uv/)"],
  ["espeak-ng", "brew install espeak-ng"],
] as const) {
  const r = has(cmd);
  r.status === 0 ? ok(`${cmd} ${r.stdout.trim().split("\n")[0]}`) : bad.push(`${cmd} missing → ${fix}`);
}
if (process.env.ANTHROPIC_API_KEY) console.log("  ! ANTHROPIC_API_KEY is set in your shell. The bots strip it so Claude Code uses your subscription login.");
if (bad.length) {
  console.log("\nFix these, then run `npm run setup` again:\n" + bad.map((b) => `  ✘ ${b}`).join("\n") + "\n");
  process.exit(1);
}

if (!existsSync(join(ROOT, ".env"))) {
  copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env"));
  ok("created .env from .env.example");
}

console.log("\nInstalling the voice environment (Python 3.12 + Kokoro, first run takes a few minutes)…");
execFileSync("uv", ["sync", "--project", "voice"], { cwd: ROOT, stdio: "inherit" });
execFileSync("uv", ["run", "--project", "voice", "python", "voice/kokoro_tts.py", "--warmup"], { cwd: ROOT, stdio: "inherit" });

// Motivation style sounds. Designed effects (whooshes, hits, risers, glitches) are earshot takes committed in public/sfx/
// (scripts/earshot-sfx.sh). Downloaded here, never committed (their licences forbid redistributing the raw files):
// real-world recordings from Mixkit (free for videos, no credit) and the default music, picked by listening with earshot.
// Add your own tracks to public/sound/music/; they're analyzed automatically (server/music.ts).
const sfx = (id: number) => `https://assets.mixkit.co/active_storage/sfx/${id}/${id}.wav`;
const SOUND: [string, string][] = [
  ["coins.wav", sfx(1993)],
  ["crowd.wav", sfx(438)],
  ["rain.wav", sfx(1225)],
  ["typing.wav", sfx(1386)],
  ["running.wav", sfx(1232)],
  ["music/drift-phonk.mp3", "https://cdn.freesound.org/previews/704/704714_4819210-hq.mp3"], // CC BY 4.0
  ["music/epic-build.mp3", "https://assets.mixkit.co/music/871/871.mp3"], // Mixkit
  ["music/emotional-piano.mp3", "https://assets.mixkit.co/music/714/714.mp3"], // Mixkit
];
// The credit lines CC BY requires; the render step tells you to put them in the post's description.
const CREDITS: Record<string, string> = {
  "drift-phonk.mp3": `"Drift Phonk Beat By JH" by Johnnie_Holiday (https://freesound.org/people/Johnnie_Holiday/sounds/704714/), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), edited`,
};
console.log("\nDownloading the motivation sound bank (music + recordings)…");
const soundDir = join(ROOT, "public", "sound");
mkdirSync(join(soundDir, "music"), { recursive: true });
// Re-download when this list changes.
const stamp = join(soundDir, ".bank");
const want = JSON.stringify(SOUND);
const stale = !existsSync(stamp) || readFileSync(stamp, "utf8") !== want;
for (const [name, url] of SOUND) {
  if (!stale && existsSync(join(soundDir, name))) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
  writeFileSync(join(soundDir, name), Buffer.from(await res.arrayBuffer()));
}
const creditsFile = join(soundDir, "music", "credits.json");
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, "utf8")) : {};
writeFileSync(creditsFile, JSON.stringify({ ...credits, ...CREDITS }, null, 2) + "\n"); // keeps credits you added for your own tracks
writeFileSync(stamp, want);
ok("sound bank ready in public/sound/ (add your own music to public/sound/music/)");

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {}

console.log("\nDownloading the headless browser Remotion renders with…");
await ensureBrowser();
ok("Remotion browser ready");

console.log("\nAll set. Start the office with:  npm start\n");
