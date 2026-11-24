import { demoApi, isDemo } from "./demo.ts";

export type Action = "topic" | "approve" | "reject" | "retry" | "redo" | "archive" | "restore" | "script" | "cancel" | "delete";

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
