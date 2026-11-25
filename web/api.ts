import { demoApi, isDemo } from "./demo.ts";

export type Action = "topic" | "approve" | "reject" | "retry" | "redo" | "archive" | "restore" | "script" | "cancel" | "delete" | "music";

export async function api(action: Action, body: Record<string, unknown>): Promise<unknown> {
  if (isDemo) return demoApi(action, body);
  const res = await fetch(`/api/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

// Files inside projects/<id>/ (relative paths), for the project detail view.
export async function projectFiles(id: string): Promise<string[]> {
  if (isDemo) return [];
  const res = await fetch(`/api/files?id=${encodeURIComponent(id)}`);
  return res.ok ? ((await res.json()) as { files: string[] }).files : [];
}

export async function archivedProjects(): Promise<import("../server/project.ts").State[]> {
  if (isDemo) return [];
  const res = await fetch("/api/archived");
  return res.ok ? ((await res.json()) as { projects: import("../server/project.ts").State[] }).projects : [];
}

// Tracks a project can switch to, and the one picked for it (null = the .env default).
// `served` is the URL folder the tracks play from (for the preview player).
type Music = { files: string[]; current: string | null; served: string };
export async function musicFiles(id: string): Promise<Music> {
  const none = { files: [], current: null, served: "" };
  if (isDemo) return none;
  const res = await fetch(`/api/music?id=${encodeURIComponent(id)}`);
  return res.ok ? ((await res.json()) as Music) : none;
}
