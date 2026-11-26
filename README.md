# qraxels

A small 3D office of bots that turns a topic into a vertical (1080x1920, 90–120 s) video, drawn in black-and-white with a hooded box-head character with glowing eyes and bendy limbs.

You hand a topic to the team in the chat. Or press **Suggest topics**: Sky reads this week's money news and the season and proposes 8 ideas, each with its title, first line and series (`prompts/pitch.md`); click one to fill the topic box. Each bot does its part at its own cubicle, then walks the folder over to the next bot. The script and the finished video both land on **your desk** for approval. Nothing is ever posted automatically.

| Bot | Job | Writes to `projects/{id}/` |
|---|---|---|
| Sky · Scriptwriter | Writes the speech: hook, beats, a real closing. For Explained videos (short and long), a web-search step first gathers today's dated facts (`prompts/research.md`, Sonnet, saved as `research.json`) so money news uses this year's numbers, not memory's. In the calm styles, every flagged fact is then checked with web search (`prompts/factcheck.md`, Sonnet); a wrong one goes back to Sky once, and each claim's verdict and source show in `script.md` | `research.json`, `script.md`, `factcheck.json` → **your desk** |
| Dot · Director | Splits the script into scenes. Uses a library picture for most scenes (each at most once per video, avoiding the ones the last video showed when another fits); writes a shot for Bolt to draw for at most a third of them (`DRAWN_SHARE`), the moments no library picture can show | `scenes.json` |
| Nova · Narrator | Kokoro voice (local, free) plus per-word timestamps | `audio/` |
| Bolt · Builder | Draws each scene with a shot as its own small component (`prompts/draw.md`, the library's drawing kit), renders a still per scene, then Claude reviews them and redraws or fixes what's off | `draw/`, `stills/` |
| Ray · Renderer | Renders the final video and, for the calm styles, its YouTube description (`description.txt`: the fact check's sources, credits, the not-financial-advice line); once you approve it, makes 3 cover thumbnails (1080x1920, for YouTube Shorts and Meta Reels) | `out.mp4` → **your desk**, then `thumbs/` |

## The video

Pick a style next to the topic box. Both use the same black-and-white look and scene library:

- **Explained** (the default): a calm explainer, 95–120 s (210–270 words). One idea, explained so a first-time viewer gets it: a hook question, the context, the idea named and its mechanism, one picture used throughout (an ice cube warming a degree at a time), an everyday example, 2–3 steps to try, an honest limit, and a close that returns to the picture. Every line is calm (no "rage" effect, no shouted clip), scenes last 3–6 s and fade into each other, and there's no beat pulse or hit shake. The camera only uses slow moves, and a calm track plays from the top, rotating per video through `public/sound/music/calm/` (`EXPLAINED_MUSIC` in `.env`: `auto`, one file there, or `off`). Its prompts are `prompts/script-explained.md` and `prompts/scenes-explained.md`; the director's component list is shared in `prompts/components.md`.

- **Explained · long (16:9)**: the Explained style as an 8–10 minute YouTube video (1100–1400 words, so mid-roll ads are allowed), told in 5–7 chapters of 60–120 s. Every chapter opens on a line that works cold and lands on its last line, because each one becomes its own Short; every scene carries its `chapter`, and Dot's plan is rejected unless each chapter's scenes hold exactly that chapter's narration. It renders 1920x1080 split screen: the picture (the vertical canvas cropped to its stage) on the left, the chapter title and the spoken line on the right, each word lighting as it's said. Each chapter plays its own calm track from the top, crossfading into the next over 2 s. Bolt's frame review runs one chapter at a time. Once you approve the video, Ray makes 1920x1080 thumbnails and renders every chapter as a vertical Short (`shorts/short-{n}.mp4` with a 1080x1920 cover `shorts/short-{n}.jpeg` and a YouTube description `shorts/short-{n}.txt`, titled in `shorts/titles.txt`) that ends on a "Full video on my channel" card. Bolt draws each scene once for both canvases (`prompts/draw-long.md`, laid out with the kit's `split`/`row`/`place` from `remotion/layout.ts`), so a Short plays the same drawings rearranged for vertical; the build renders both and redraws a drawing that is cut off on either, and a scene that still can't fit vertically pans across its wide drawing in the Short (older drawings show whole, letterboxed). A long video has 55–90 scenes; at most a third are drawn (with Opus), the rest come from the library. Its prompts are `prompts/script-long.md` and `prompts/scenes-long.md`.

- **Motivation**: money, discipline and hard work, as a speech rather than a report: hook, call-out of excuses, hard truth, the turn, escalating commands, payoff line. Black-and-white animation of a hooded box-head character across 50 scenes, mostly objects rather than workouts (line chart, cash stack, checklist, car at night, phone feed, calendar, door into light, brick wall, traffic jam, rush-hour crowd, stage, dominoes, hourglass, balance scale, rocket, tree, lit window, hamster wheel, chains, ladder, bridge, storm, mirror, coin jar, target, light bulb, battery, boulder, empty wallet, lock, puzzle, train, bar chart, fork in the road, speedometer, plus the original figure scenes). Each video gets a rotating first and last scene, a featured set, and at most 2 workout scenes. Post-processing uses Remotion's WebGL effects (`@remotion/effects`, `remotion/MonoFx.tsx`): scenes can enter through a pixel dissolve, venetian blinds or a film burn (alongside the CSS zoom, whip and glitch cuts), every hit gets a radial zoom blur, and a monochrome light leak washes over the drop and the outro. Each project also gets a film look (clean, TV scanlines or heavy grain). Renders run Chrome with `gl: "angle"` for WebGL (`remotion.config.ts` sets it for Studio). The camera has focus moves besides the simple ones: `focus`, `reveal`, `track`, `swing`, `punch` (lands on the hit word) and `dutch` frame each scene's key detail (`FOCUS` in `remotion/mono.ts`), blur in the direction they move and spotlight the detail; stamps and counters stay pinned on screen while the picture moves. Videos end with a 3 s outro: the last scene holds, fades to black, and the music rings out. Every scene gets a camera move and a transition (zoom blur, whip pan, glitch, flash), in an order seeded by the project so no two videos cut alike; each project also gets its own backdrop (dust, stage beams, skyline, embers) and some scenes mirrored. Each speech is built on a rotating angle (countdown, future self, round 12, …) and is rejected if it reuses any 5-word run from earlier videos. everything pulses on the music's beat, and each scene's `hit` word gets a punch, a flash, a shake and an inverted caption. The music is cut so its drop lands on the turn (an early drop loops the intro in whole bars until then), ducks under the voice and swells in the pauses. Sounds follow the reference edits' restraint (about one accent every 2.5 s): soft pops when stamps, counters and steps appear, a deep sub on the drop and payoffs with one riser into the drop, a ding when a counter lands or the flag is planted, plus quiet on-screen sounds (rain, typing, footsteps, punches, landings). The voice is levelled to -20 dBFS speech and the music sits 8 dB under it (more for tracks busy in the voice's range), measured per track. Swear words are spoken in full and starred on screen. Its prompts are `prompts/*-mono.md`, its timing rules `remotion/mono.ts`, its motion `remotion/MonoLayer.tsx`.

The narration always gets `rage()` in `voice/kokoro_tts.py` (6% faster, thinner chest, upper-mid strain, grit).

**Music.** Pixabay tracks work (free for commercial use, no credit needed), but some Pixabay artists register their tracks with Content ID, so a track can still get a claim; keep the Pixabay license page for the track in case you need to dispute one. Every file in `public/sound/music/` (mp3, wav, ogg, flac) is a candidate: drop in tracks you have the rights to and each one is analyzed once for tempo, downbeat and drop (`voice/music_info.py`). If a track's licence needs a credit, add it to `public/sound/music/credits.json` (`{"file.mp3": "credit line"}`) and the render step tells you to paste it into the description. `MONO_MUSIC` in `.env` picks one file, or `off` for no music so you can add a trending sound inside TikTok. The defaults (`npm run setup`): a drift phonk beat from Freesound (CC BY 4.0: credit required, handled as above; left out of the rotation because it clips), an epic orchestral build and an emotional piano piece from Mixkit (free, no credit).

**Sound effects.** Designed effects come from [earshot](https://github.com/Leonxlnx/earshot)'s sound bank (MIT), rendered into `public/sfx/` and committed; `scripts/earshot-sfx.sh` re-renders them. Real-world recordings earshot can't make (rain, typing, footsteps, crowd, coins) are Mixkit files that `npm run setup` downloads into `public/sound/` (free for videos; don't redistribute the raw files or register these videos with Content ID).

## Quickstart (macOS)

```sh
brew install uv espeak-ng
npm install
npm run setup     # checks tools, installs Python 3.12 + Kokoro, downloads models
npm start         # → http://127.0.0.1:4321
```

You also need [Claude Code](https://claude.com/claude-code) installed and logged in (run `claude` once).

To watch the office animate without spending any Claude usage, open `http://127.0.0.1:4321/?demo`.

## How it uses Claude

The bots run `claude -p` with **your own Claude Code login**. `ANTHROPIC_API_KEY` is always stripped from their environment, so usage counts against your subscription, not the API. Since June 15, 2026, `claude -p` draws from your plan's separate Agent SDK credit, so check your balance after the first few videos.

Each bot runs Claude with no MCP servers, hooks or plugins, and only the tools it needs (Bolt: Read; the rest none). Its output is validated against a schema (`server/schemas.ts`) and retried once if invalid.

The server listens on `127.0.0.1` only. If you ever turn this into a hosted service for other people, it must use API keys instead of a subscription login.

## Settings (`.env`)

| Key | Default | |
|---|---|---|
| `PORT` | `4321` | |
| `VID_MODEL` | Opus 5.5 for script, scenes and frame review | Overrides the Claude model for every bot (use a full id like `claude-sonnet-5-5`) |
| `VID_VOICE` | `kokoro` | or `elevenlabs` (needs `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`) |
| `KOKORO_VOICE` | `af_heart` | any [Kokoro voice](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) |
| `KOKORO_VOICE_MONO` | `af_heart` | voice for motivation videos (`ELEVENLABS_VOICE_ID_MONO` for ElevenLabs) |
| `VID_VOICE_MONO` | | voice engine for the videos (falls back to `VID_VOICE`): `kokoro` or `elevenlabs`. Kokoro reads every line at one level; under calm and quiet lines (each scene's `energy`, set by Dot from the script's section) the music and effects dip a little so they feel softer. Motivation videos also get `rage()` (see below); Explained videos are only levelled. |

## Layout

```
server/      office (queues + handoffs), bots, claude runner, schemas, http + SSE
web/         3D office (three.js / react-three-fiber) and the chat panel
remotion/    theme, component library, Explainer composition
voice/       Kokoro script (uv project, Python 3.12)
prompts/     what each bot is told; edit these to change tone or rules
projects/    one folder per video (gitignored)
```

## Commands

- `npm start`: run the office
- `npm test`: unit tests (state, schemas, claude runner, office handoffs)
- `npm run typecheck`
- `npm run stills`: render every component to `projects/_stills/`, to check the look
- `npm run studio`: open Remotion Studio on the sample scenes (`Explainer` composition)

## Rules this follows (from the channel plan)

- A human approves every script and every final video.
- Every video gets its own backdrop, camera moves, transitions and mirrored scenes (seeded per project), so the channel doesn't look mass-produced.
- `sources.md` is kept for every video, and uncertain claims are flagged for you to check.
- Label anything realistic as AI-generated when you post.
