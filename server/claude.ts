import { spawn as nodeSpawn } from "node:child_process";
import { createInterface } from "node:readline";
import { z } from "zod";
import { ROOT } from "./project.ts";

export type SpawnFn = typeof nodeSpawn;

// Exact ids, not "sonnet"/"opus": aliases follow ANTHROPIC_DEFAULT_*_MODEL from the user's shell, which can point at old models.
export const SONNET = "claude-sonnet-5-5";
export const OPUS = "claude-opus-5-5";

export type ClaudeOpts<T extends z.ZodType> = {
  prompt: string;
  schema: T;
  tools?: string[];
  model?: string;
  cwd?: string;
  onActivity?: (line: string) => void;
  timeoutMs?: number;
  spawn?: SpawnFn;
  signal?: AbortSignal;
};

// Never pass API credentials through: claude must bill the user's subscription, not the API.
export function claudeEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...rest } = env;
  return rest;
}

// Claude Code validates --json-schema with a draft-7 validator that rejects the 2020-12 $schema URI.
export function jsonSchemaFor(schema: z.ZodType): string {
  const { $schema, ...rest } = z.toJSONSchema(schema, { io: "input", target: "draft-7" }) as Record<string, unknown>;
  return JSON.stringify(rest);
}

export function claudeArgs(schema: z.ZodType, tools: string[], model: string): string[] {
  return [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--model", model,
    "--json-schema", jsonSchemaFor(schema),
    // Lean, reproducible runs: no user MCP servers, hooks, plugins or saved sessions.
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--tools", tools.join(","),
    ...(tools.length ? ["--allowedTools", tools.join(",")] : []),
  ];
}

// Turns one stream-json event into a short line for the bot's speech bubble.
export function activityOf(event: any): string | null {
  if (event?.type !== "assistant") return null;
  for (const c of event.message?.content ?? []) {
    if (c.type === "tool_use" && c.name !== "StructuredOutput") {
      const i = c.input ?? {};
      if (c.name === "WebSearch") return `searching: ${i.query}`;
      if (c.name === "WebFetch") return `reading: ${String(i.url).replace(/^https?:\/\//, "").slice(0, 50)}`;
      if (c.name === "Read") return `looking at ${String(i.file_path).split("/").pop()}`;
      return c.name;
    }
    if (c.type === "text" && c.text.trim()) return c.text.trim().slice(0, 80);
  }
  return null;
}

function runOnce(opts: Required<Omit<ClaudeOpts<z.ZodType>, "onActivity" | "signal">> & { onActivity?: (l: string) => void; signal?: AbortSignal }): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const child = opts.spawn("claude", claudeArgs(opts.schema, opts.tools, opts.model), {
      cwd: opts.cwd,
      env: claudeEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      signal: opts.signal,
    });
    let result: any = null;
    let stderr = "";
    // Times out on silence, not total runtime: healthy runs keep emitting events, a stalled one goes quiet.
    let timer: NodeJS.Timeout;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reject(new Error(`claude timed out: no output for ${opts.timeoutMs / 1000}s`));
        child.kill("SIGTERM");
      }, opts.timeoutMs);
    };
    arm();
    child.stderr!.on("data", (d) => (stderr += d));
    createInterface({ input: child.stdout! }).on("line", (line) => {
      arm();
      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "result") result = event;
      const a = activityOf(event);
      if (a) opts.onActivity?.(a);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!result) return reject(new Error(`claude exited ${code} with no result. ${stderr.slice(-400)}`));
      if (result.is_error) return reject(new Error(`claude error: ${String(result.result ?? result.subtype).slice(0, 400)}`));
      resolvePromise(result.structured_output ?? tryParse(result.result));
    });
    child.stdin!.end(opts.prompt);
  });
}

function tryParse(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const m = text.match(/\{[\s\S]*\}/);
  try {
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

export async function runClaude<T extends z.ZodType>(opts: ClaudeOpts<T>): Promise<z.output<T>> {
  const full = {
    tools: [],
    model: SONNET,
    cwd: ROOT,
    timeoutMs: 5 * 60_000,
    spawn: nodeSpawn,
    ...opts,
  };
  if (process.env.VID_MODEL) full.model = process.env.VID_MODEL;
  let prompt = opts.prompt;
  for (let attempt = 1; ; attempt++) {
    // A stalled claude usually works on a fresh run, so retry a timeout once before failing the job.
    const raw = await runOnce({ ...full, prompt }).catch((e) => {
      if (!/timed out/.test(e.message) || opts.signal?.aborted) throw e;
      opts.onActivity?.("claude went quiet, retrying…");
      return runOnce({ ...full, prompt });
    });
    const parsed = opts.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    if (attempt >= 2) throw new Error(`claude output failed validation twice: ${z.prettifyError(parsed.error).slice(0, 600)}`);
    opts.onActivity?.("fixing my output…");
    prompt = `${opts.prompt}\n\nYour previous answer was invalid:\n${z.prettifyError(parsed.error)}\n\nPrevious answer:\n${JSON.stringify(raw)}\n\nReturn a corrected answer.`;
  }
}
