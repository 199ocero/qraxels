import { z } from "zod";
import { CAMERAS, SCENE_SFX } from "../remotion/mono.ts";

export const SECTIONS = ["hook", "story", "dip", "turn", "rise", "peak", "landing"] as const;
// Explained videos (prompts/script-explained.md): a question, its context, the idea named, an example, what to do,
// the honest limit, the close.
export const EXPLAINED_SECTIONS = ["hook", "context", "idea", "example", "how", "caveat", "close"] as const;

// Shape only; hand edits are checked against this (the editor shows the length warning instead).
export const ScriptShape = z.object({
  title: z.string().min(1).max(70),
  // Long videos: two more titles for YouTube's Test & Compare, each drawn its own thumbnail (prompts/script-long.md).
  alt_titles: z.array(z.string().min(1).max(70)).max(2).optional(),
  hook: z.string().min(1),
  analogy: z.string().min(1),
  analogy_breaks_down: z.string().min(1),
  // section: where the beat sits in the speech's wave (prompts/script-mono.md). Optional here so older and
  // hand-edited scripts still load; the script job requires it.
  // chapter: long videos only, the title of the chapter this beat belongs to (consecutive beats share it).
  beats: z.array(z.object({ section: z.enum(SECTIONS).or(z.enum(EXPLAINED_SECTIONS)).optional(), chapter: z.string().min(1).max(40).optional(), narration: z.string().min(1), visual_idea: z.string().min(1) })).min(4).max(80),
  flagged_claims: z.array(z.string()),
  estimated_seconds: z.number().min(55).max(720),
});
// The model's own estimate is unreliable; count words so the video lands at the style's length.
const scriptOf = (min: number, max: number, secs: string) =>
  ScriptShape.superRefine((s, ctx) => {
    const words = s.beats.map((b) => b.narration).join(" ").split(/\s+/).filter(Boolean).length;
    if (words < min || words > max)
      ctx.addIssue({ code: "custom", path: ["beats"], message: `narration is ${words} words; it must be ${min}–${max} words total (${secs} seconds spoken)` });
  });
// Read fast with short pauses (~2.7 words/s), so it needs 240–320 words to fill 90–120 s.
export const Script = scriptOf(240, 320, "90–120");
// Explained and built: read calmly with pauses at ~2.25 words/s (measured), so 210–270 words fill 95–120 s.
export const ExplainedScript = scriptOf(210, 270, "95–120");
export type Script = z.infer<typeof ScriptShape>;

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
// A long script's chapter titles, in order.
export const chaptersOf = (s: Script) => [...new Set(s.beats.flatMap((b) => (b.chapter ? [b.chapter] : [])))];
// Long: 1100–1400 words at ~2.25 words/s is 8–10 minutes (8+ minutes allows mid-roll ads). Each chapter is 150–280
// words, i.e. 60–120 s: a chapter is cut into its own Short later, so it has to stand on its own.
export const LongScript = scriptOf(1100, 1400, "8–10 minutes").superRefine((s, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["beats"], message });
  if (s.beats.some((b) => !b.chapter)) return bad("give every beat its chapter title");
  const titles = chaptersOf(s);
  // A title that comes back after another chapter started means the chapters are interleaved.
  const runs = s.beats.filter((b, i) => i === 0 || b.chapter !== s.beats[i - 1].chapter).length;
  if (runs !== titles.length) bad("each chapter's beats must be together, in one run; never come back to an earlier chapter");
  if (titles.length < 5 || titles.length > 7) bad(`write 5–7 chapters, not ${titles.length}`);
  for (const t of titles) {
    const n = wordCount(s.beats.filter((b) => b.chapter === t).map((b) => b.narration).join(" "));
    if (n < 150 || n > 280) bad(`chapter "${t}" is ${n} words; each chapter must be 150–280 words`);
  }
});
const label = z.string().min(1).max(28);
// A money/number counter that ticks up ("NET WORTH" $0 → $63,930).
const stat = z.object({ label: z.string().min(1).max(20), to: z.number().int().min(0).max(1e9), from: z.number().int().min(0).max(1e9).optional(), prefix: z.string().max(2).optional() });

// History and engineering pictures for the "built" series (remotion/components/{Ancient,Built,Relics}.tsx); label-only too.
export const HISTORY = [
  "Giza", "Sledge", "Obelisk", "Aqueduct", "Arch", "Colosseum", "GreatWall", "Stonehenge", "Lever", "Pulley", "Treadwheel", "Screw", "Waterwheel", "Trebuchet", "Sundial", "Trireme", "Quarry", "Scroll", "Tablet", "Ruins", "Dig", "Tomb", "Hieroglyphs", "Moai", "Road", "Canal", "Printing", "Steam", "Telegraph", "Dome",
  "Masonry", "Concrete", "Buttress", "Castle", "Petra", "Terraces", "StepPyramid", "Pagoda", "IronTower", "Suspension", "Dam", "Borer", "Rails", "Skeleton", "Hypocaust", "Windcatcher", "Qanat", "Stepwell", "Sewer",
  "Antikythera", "WaterClock", "Loom", "Potter", "Casting", "Pendulum", "Locomotive", "Airship", "Biplane", "Obscura", "Cannon", "SiegeTower", "BatteringRam", "Longship", "Caravan", "Nazca", "Rosetta", "Terracotta", "Mummy", "Shipwreck", "CavePaint", "TreeRings", "HalfLife", "Lidar",
] as const;

// Economy and prices pictures (remotion/components/Economy.tsx); label-only too.
export const ECONOMY = [
  "GasPump", "Cart", "Feast", "PowerMeter", "Pylons", "Servers", "Truck", "Barrel", "Port", "Toll", "RateDial", "CentralBank", "ForSale", "Mortgage", "Gold", "SaleMonth", "Doorbuster", "Assistant", "Appetite", "Layoff", "Spillover", "Shrink", "Vise", "Supply", "Dollar", "PowerBill", "Strait", "Parcels", "Funnel", "Queue", "Robot", "Snacks", "Race", "Valve", "Squeeze", "Flood",
  "TwoPrices", "Profile", "Watching", "ShelfLabel", "MenuBoard", "DriveThru", "Limited", "Hog", "TopTen", "AgeCurve", "Distribution", "ThenNow", "Receipts", "Sticker", "Thermostat", "LockedIn", "HandOff", "ForYou", "Memo", "Tractor", "BathScale", "WasNow",
] as const;

// Picture scenes whose only prop is an optional label (remotion/components/{Money,Mind,Nature,Action,Life,Ancient}.tsx).
export const LABELED = [
  ...HISTORY,
  ...ECONOMY,
  "Piggy", "Vault", "Receipt", "Card", "Stacks", "Paycheck", "Cubicle", "Coffee", "Laptop", "Inbox", "Shop", "Deal", "Leak", "Candles", "Dice", "Slots", "BallChain", "Pyramid", "Printer", "Pie", "Magnet", "Faucet", "Meter", "Conveyor", "Gears", "PunchClock", "Tag", "Crown", "Trophy", "Podium", "Lottery",
  "Brain", "Cloud", "Maze", "Book", "Alarm", "Couch", "Pings", "Sleep", "Meditate", "Journal", "Mask", "Shadow", "Cage", "OutBox", "Glass", "Iceberg", "Compass", "Route", "Vision", "Footsteps", "Zone", "Slingshot", "Spring", "Seesaw", "Juggle", "Tightrope", "Fog", "Megaphone", "Pointing", "Puppet",
  "Sunrise", "Moon", "Autumn", "Surf", "Volcano", "Eclipse", "Ridge", "Drip", "Desert", "Snow", "Campfire", "Lighthouse", "Boat", "Anchor", "Island", "Cave", "Sprout", "Bloom", "Cocoon", "Bird", "Upstream", "Waterfall", "Stars", "Wish", "Orbit", "Globe", "Windmill", "Leap", "Sink", "Ice",
  "Sword", "Shield", "Anvil", "Fire", "Breakthrough", "Hurdles", "TugOfWar", "Rope", "Pushup", "JumpRope", "Swim", "Bike", "Finish", "Start", "Countdown", "Press", "Atlas", "Tunnel", "Escalator", "Elevator", "Umbrella", "Fist", "Heartbeat", "Parachute", "Pit", "Ceiling", "Fly", "Tornado", "Chess", "Cards",
  "Fuse", "Snowball", "Wrecking", "Giant", "Echoes", "Hand", "Gate", "Confetti", "Fireworks", "Gift", "Letter", "Suitcase", "Plane", "House", "Skyline", "Crane", "Blueprint", "Ripple", "Mic", "Vlog", "Loading", "Likes", "Candle", "Bench", "Grave", "Cake", "Ages", "Kite", "Balloon", "Lead",
] as const;

// One entry per Remotion component in remotion/components. Claude picks from these, never writes code.
export const SceneVisual = z.discriminatedUnion("component", [
  z.object({ component: z.literal(LABELED), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Heights"), props: z.object({ items: z.array(z.object({ name: z.string().min(1).max(12), meters: z.number().positive().max(10000) })).min(2).max(4) }) }),
  z.object({ component: z.literal("Timeline"), props: z.object({ events: z.array(z.object({ year: z.string().min(1).max(10), label: z.string().min(1).max(16) })).min(2).max(5) }) }),
  z.object({ component: z.literal("HookCard"), props: z.object({ title: z.string().min(1).max(60), subtitle: z.string().max(80).optional() }) }),
  z.object({ component: z.literal("Callout"), props: z.object({ text: z.string().min(1).max(90), emphasis: z.string().max(30).optional() }) }),
  z.object({ component: z.literal("Crowd"), props: z.object({ ending: z.enum(["alone", "stands"]).optional() }) }),
  z.object({ component: z.literal("PullUp"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Grind"), props: z.object({ stat: stat.optional() }) }),
  z.object({ component: z.literal("RainWalk"), props: z.object({ sign: z.string().min(1).max(14).optional(), stat: stat.optional() }) }),
  z.object({ component: z.literal("Climb"), props: z.object({ steps: z.array(z.string().min(1).max(12)).min(2).max(5) }) }),
  z.object({ component: z.literal("Run"), props: z.object({ goal: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("BigWord"), props: z.object({ word: z.string().min(1).max(12) }) }),
  z.object({ component: z.literal("Split"), props: z.object({ left: z.string().min(1).max(12), right: z.string().min(1).max(12) }) }),
  z.object({ component: z.literal("Lift"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Boxing"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Fall"), props: z.object({}) }),
  z.object({ component: z.literal("Summit"), props: z.object({ flag: z.string().min(1).max(12).optional() }) }),
  z.object({ component: z.literal("Clock"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Chart"), props: z.object({ label: z.string().min(1).max(16).optional(), trend: z.enum(["up", "down", "comeback"]).optional() }) }),
  z.object({ component: z.literal("Cash"), props: z.object({ stat: stat.optional() }) }),
  z.object({ component: z.literal("Plan"), props: z.object({ items: z.array(z.string().min(1).max(14)).min(2).max(4) }) }),
  z.object({ component: z.literal("Car"), props: z.object({ sign: z.string().min(1).max(14).optional() }) }),
  z.object({ component: z.literal("Phone"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Calendar"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Door"), props: z.object({ label: z.string().min(1).max(12).optional() }) }),
  z.object({ component: z.literal("Bricks"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Traffic"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Dominoes"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Hourglass"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Rocket"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Tree"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Window"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Wheel"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Chains"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Ladder"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Bridge"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Storm"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Mirror"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Target"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Bulb"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Boulder"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Wallet"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Lock"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Puzzle"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Train"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Bars"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Gauge"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Stage"), props: z.object({ label: z.string().min(1).max(16).optional() }) }),
  z.object({ component: z.literal("Jar"), props: z.object({ stat: stat.optional() }) }),
  z.object({ component: z.literal("Battery"), props: z.object({ label: z.string().min(1).max(16).optional(), drain: z.boolean().optional() }) }),
  z.object({ component: z.literal("Fork"), props: z.object({ left: z.string().min(1).max(12), right: z.string().min(1).max(12) }) }),
  z.object({ component: z.literal("Rush"), props: z.object({}) }),
  z.object({ component: z.literal("Scale"), props: z.object({ left: z.string().min(1).max(12), right: z.string().min(1).max(12) }) }),
]);

export const Scene = z
  .object({
    purpose: z.enum(["hook", "setup", "explain", "payoff", "outro"]),
    narration: z.string().min(1),
    // Calm styles: this scene's own picture, drawn fresh for it (server/bots/draw.ts). The component and props
    // below are the fallback when there's no shot or the drawing fails.
    shot: z.string().min(1).max(400).optional(),
    // The director's call: draw this shot as a three.js scene (prompts/draw-3d.md) rather than flat SVG.
    in3d: z.boolean().optional(),
    speed: z.number().min(0.8).max(1.25).default(1),
    pause_after: z.number().min(0).max(1.5).default(0.3),
    // Motivation style: the word that gets a hit (punch + flash + shake), a scene sound, a camera move.
    hit: z.string().max(30).optional(),
    sfx: z.enum(SCENE_SFX).optional(),
    camera: z.enum(CAMERAS).optional(),
    // How the line is delivered: the music and effects dip under calm and quiet lines (remotion/mono.ts ENERGY_DB).
    energy: z.enum(["low", "calm", "high"]).optional(),
    // Long videos: the chapter (1 = first) this scene belongs to, so each chapter can be cut into a Short.
    chapter: z.number().int().min(1).optional(),
    // Filled in by the Narrator from the word timestamps.
    start: z.number().optional(),
    end: z.number().optional(),
  })
  .and(SceneVisual);
export type Scene = z.infer<typeof Scene>;

export const Scenes = z.object({ scenes: z.array(Scene).min(5).max(130) });
export type Scenes = z.infer<typeof Scenes>;

// The fact checker's verdict on each flagged claim (prompts/factcheck.md), found with web search.
export const FactCheck = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(1),
      verdict: z.enum(["confirmed", "wrong", "unsure"]),
      // What's actually true, phrased to replace the claim; only for "wrong".
      correction: z.string().optional(),
      source: z.string().optional(),
    }),
  ),
});
export type FactCheck = z.infer<typeof FactCheck>;

// Today's facts for a calm video, looked up before Sky writes (prompts/research.md): memory can't know this year's numbers.
export const Research = z.object({
  news: z.string(),
  facts: z.array(z.object({ fact: z.string().min(1), date: z.string().min(1), source: z.string().min(1) })).min(1).max(15),
});
export type Research = z.infer<typeof Research>;

// Topic ideas for the channel (prompts/pitch.md), each already packaged with its title and opening line.
export const SERIES = ["How it makes money", "Why it costs more", "Money news"] as const;
export const Pitch = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1).max(70),
    hook: z.string().min(1),
    series: z.enum(SERIES),
    why_now: z.string().min(1),
    layout: z.enum(["explained", "long"]),
  })).min(5).max(10),
});
export type Pitch = z.infer<typeof Pitch>;

export const Review = z.object({
  ok: z.boolean(),
  issues: z.array(z.string()),
  // Full replacement scene list when ok=false; must keep narration unchanged so the audio still matches.
  scenes: z.array(Scene).optional(),
  // Drawn scenes to draw again (scene numbers as in the still names), each with what to change.
  redraw: z.array(z.object({ scene: z.number().int().min(1), note: z.string().min(1) })).optional(),
});
export type Review = z.infer<typeof Review>;

export const Word = z.object({ word: z.string(), start: z.number(), end: z.number(), scene: z.number().int() });
export type Word = z.infer<typeof Word>;
