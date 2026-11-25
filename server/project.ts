import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");
export const PROJECTS = process.env.VID_PROJECTS_DIR ?? join(ROOT, "projects");
export const ARCHIVE = join(PROJECTS, "_archive");

export const STEPS = ["script", "scenes", "voice", "build", "render"] as const;
export type Step = (typeof STEPS)[number];
export type StepStatus = "pending" | "working" | "done" | "failed";
export type Gate = "script" | "video";
// The gate that sits right after a step, if any.
export const GATE_AFTER: Partial<Record<Step, Gate>> = { script: "script", render: "video" };
// Every video renders in the black-and-white "mono" look. "mono" is a fired-up motivation speech; "explained" is a calm
// explainer (one idea, its context, an example, what to do) with gentler cuts and piano music; "built" is the same calm
// style for history and engineering ("how was it built / how did it work"), with its own script (prompts/script-built.md).
// "long" is a 16:9 explained video of 8–10 minutes in chapters (prompts/script-long.md), shown split screen.
export const LAYOUTS = ["explained", "mono", "built", "long"] as const;
export type Layout = (typeof LAYOUTS)[number];

export type State = {
  id: string;
  topic: string;
  layout: Layout;
  color: string;
  steps: Record<Step, StepStatus>;
  gate: Gate | null;
  approved: boolean;
  notes: Partial<Record<Step, string>>;
  // A track picked for this video (a file in its music folder, or "off"); unset = MONO_MUSIC / EXPLAINED_MUSIC.
  music?: string;
  created_at: string;
  updated_at: string;
};

export type ChatMsg = { ts: string; project?: string; from: string; text: string; gate?: Gate };

const COLORS = ["#ff8a3d", "#3dd6ff", "#b77dff", "#5be37d", "#ffd23d", "#ff5c8a"];

export const dir = (id: string, ...p: string[]) => join(PROJECTS, id, ...p);

export function slug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "video";
}

export function writeAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export const writeJson = (path: string, value: unknown) => writeAtomic(path, JSON.stringify(value, null, 2) + "\n");
export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

export function load(id: string): State {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`bad project id: ${id}`);
  return readJson<State>(dir(id, "state.json"));
}

export function save(state: State): State {
  state.updated_at = new Date().toISOString();
  writeJson(dir(state.id, "state.json"), state);
  return state;
}

export function list(): State[] {
  if (!existsSync(PROJECTS)) return [];
  return readdirSync(PROJECTS)
    .filter((id) => existsSync(dir(id, "state.json")))
    .map(load)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function create(topic: string, now = new Date(), layout: Layout = "mono"): State {
  const existing = list();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  let id = `${date}-${slug(topic)}`;
  for (let n = 2; existsSync(dir(id)); n++) id = `${date}-${slug(topic)}-${n}`;
  mkdirSync(dir(id), { recursive: true });
  const ts = now.toISOString();
  return save({
    id,
    topic,
    layout,
    color: COLORS[existing.length % COLORS.length],
    steps: Object.fromEntries(STEPS.map((s) => [s, "pending"])) as State["steps"],
    gate: null,
    approved: false,
    notes: {},
    created_at: ts,
    updated_at: ts,
  });
}

export function appendChat(msg: ChatMsg): void {
  if (!msg.project) return;
  appendFileSync(dir(msg.project, "chat.jsonl"), JSON.stringify(msg) + "\n");
}

export function chatOf(id: string): ChatMsg[] {
  const f = dir(id, "chat.jsonl");
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as ChatMsg) : [];
}

export function chatHistory(): ChatMsg[] {
  return list()
    .flatMap((p) => chatOf(p.id))
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

// Archived projects, newest first (read straight from projects/_archive/).
export function listArchived(): State[] {
  if (!existsSync(ARCHIVE)) return [];
  return readdirSync(ARCHIVE)
    .filter((id) => /^[a-z0-9-]+$/.test(id) && existsSync(join(ARCHIVE, id, "state.json")))
    .map((id) => readJson<State>(join(ARCHIVE, id, "state.json")))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
