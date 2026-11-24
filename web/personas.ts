// Who each bot is: look, habits and things they say. Purely cosmetic; the server only knows step ids.
import type { Step } from "../server/project.ts";

export type Activity = "coffee" | "snack" | "window" | "lounge" | "chat" | "stretch" | "nap";
export type Accessory = "glasses" | "beret" | "director" | "headphones" | "hardhat" | "shades";
export type DeskProp = "books" | "papers" | "clapper" | "mic" | "toolbox" | "monitor";

export type Persona = {
  color: string;
  tint: string; // body colour, a light shade of their colour
  accessory: Accessory;
  deskProp: DeskProp;
  trait: string;
  likes: Partial<Record<Activity, number>>; // relative weights for idle activities
  start: string[]; // said when a job starts
  thanks: string[]; // said when a folder is handed to them ({from} = giver)
  lines: Partial<Record<Activity, string[]>>;
};

export const PERSONAS: Record<Step, Persona> = {
  script: {
    color: "#3dd6ff",
    tint: "#dff0f5",
    accessory: "beret",
    deskProp: "papers",
    trait: "dramatic wordsmith",
    likes: { lounge: 3, coffee: 2, window: 2, chat: 2, nap: 1 },
    start: ["Every word matters ✍️", "Inspiration strikes!", "Act one, scene one…"],
    thanks: ["Ooh, a new topic!", "A blank page. My favourite."],
    lines: {
      lounge: ["Writer's block… just kidding.", "Thinking about plot twists."],
      window: ["Those clouds look like a plot twist."],
      coffee: ["Espresso. For drama ☕"],
      nap: ["Dreaming in prose… zzz"],
    },
  },
  scenes: {
    color: "#b77dff",
    tint: "#ebe3f6",
    accessory: "director",
    deskProp: "clapper",
    trait: "bossy but lovable director",
    likes: { chat: 4, coffee: 2, stretch: 1, window: 1 },
    start: ["Places, everyone! 🎬", "And… action!", "Let's make it pop."],
    thanks: ["Great script, {from}! 🎬", "Love it, {from}. Let's shoot."],
    lines: {
      coffee: ["Director's cut: extra shot ☕"],
      stretch: ["That's a wrap! …on this stretch."],
      window: ["Golden hour lighting. Chef's kiss."],
    },
  },
  voice: {
    color: "#ff5c8a",
    tint: "#f6e2e9",
    accessory: "headphones",
    deskProp: "mic",
    trait: "calm, smooth-voiced",
    likes: { coffee: 3, lounge: 2, chat: 2, nap: 1 },
    start: ["Testing, one, two 🎙️", "Warming up my voice…", "Mi mi mi mi ♪"],
    thanks: ["Thanks {from}, lovely scenes.", "Ooh, {from}, my cue!"],
    lines: {
      coffee: ["Warm tea for the vocal cords 🍵", "Honey and lemon, please."],
      lounge: ["La la laaa ♪"],
      nap: ["Resting my voice… zzz"],
    },
  },
  build: {
    color: "#5be37d",
    tint: "#e1f1e4",
    accessory: "hardhat",
    deskProp: "toolbox",
    trait: "practical perfectionist",
    likes: { snack: 4, stretch: 2, chat: 1, coffee: 1 },
    start: ["Let's build this 🔧", "Measure twice, render once.", "Hard hat on!"],
    thanks: ["Got it {from}, I'll check every frame.", "Thanks {from}!"],
    lines: {
      snack: ["Snack break. Bolts need fuel 🍩", "Who ate my donut?"],
      stretch: ["Pixel perfect posture."],
      coffee: ["Black. Like my terminal ☕"],
    },
  },
  render: {
    color: "#ffd23d",
    tint: "#f5efd8",
    accessory: "shades",
    deskProp: "monitor",
    trait: "chill speed demon",
    likes: { coffee: 4, lounge: 2, nap: 2, chat: 1 },
    start: ["Rendering mode: ON 🎞️", "Let's roll!", "60 fps or bust."],
    thanks: ["Thanks {from}, rolling!", "Nice one {from} 😎"],
    lines: {
      coffee: ["Coffees per second: high ☕", "Fuel for frames."],
      lounge: ["Rendering… I mean, resting 😎"],
      nap: ["Buffering… zzz"],
    },
  },
};

// Little two-bot conversations. "a" starts, "b" answers. {a}/{b} = names.
export const CONVOS: { who: "a" | "b"; text: string }[][] = [
  [
    { who: "a", text: "Hey {b}, coffee later?" },
    { who: "b", text: "Always ☕" },
    { who: "a", text: "I'll bring the donuts." },
  ],
  [
    { who: "a", text: "Do bots get weekends?" },
    { who: "b", text: "We get reboots." },
    { who: "a", text: "Same thing, really." },
  ],
  [
    { who: "a", text: "What's the next topic?" },
    { who: "b", text: "Something about the internet." },
    { who: "a", text: "So… everything." },
  ],
  [
    { who: "a", text: "I dreamt in 60 fps last night." },
    { who: "b", text: "That's… concerning." },
  ],
  [
    { who: "a", text: "Did you see the last video?" },
    { who: "b", text: "The conveyor belt scene? Iconic." },
    { who: "a", text: "Bolt fixed the labels three times." },
    { who: "b", text: "Pixel perfect 👌" },
  ],
  [
    { who: "a", text: "{b}! Nice hat." },
    { who: "b", text: "Thanks, it's load-bearing." },
  ],
  [
    { who: "a", text: "How many drafts did Sky write?" },
    { who: "b", text: "Seventeen." },
    { who: "a", text: "Overachiever 😄" },
  ],
  [
    { who: "a", text: "Is it lunch yet?" },
    { who: "b", text: "We don't eat." },
    { who: "a", text: "Then why is there a fridge?" },
    { who: "b", text: "…good question." },
  ],
];

export const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
