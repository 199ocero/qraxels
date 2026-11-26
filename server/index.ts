import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname, relative } from "node:path";
import { createServer as createVite } from "vite";
import react from "@vitejs/plugin-react";
import { Office, type OfficeEvent } from "./office.ts";
import { readdirSync } from "node:fs";
import { LAYOUTS, PROJECTS, ROOT, STEPS, dir, listArchived, load, type Step } from "./project.ts";
import { ScriptShape } from "./schemas.ts";
import { pitch, writeScript } from "./bots/claude-bots.ts";
import { z } from "zod";
import { afterApprove, jobs } from "./bots/index.ts";
import { MUSIC_DIR, musicDirFor, musicFiles } from "./music.ts";

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {}

const PORT = Number(process.env.PORT || 4321);
// Localhost only: the bots run Claude with web tools on this machine.
const HOST = "127.0.0.1";

const office = new Office(jobs, undefined, afterApprove);
const clients = new Set<ServerResponse>();
office.on("event", (e: OfficeEvent) => {
  for (const c of clients) c.write(`data: ${JSON.stringify(e)}\n\n`);
});


const send = (res: ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function body(req: IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("body too large");
  }
  return raw ? JSON.parse(raw) : {};
}

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".md": "text/markdown; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpeg": "image/jpeg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".flac": "audio/flac", ".txt": "text/plain; charset=utf-8" };

// Serves files from projects/ (gate previews) or the music folder (track previews); supports Range so media can seek.
function serveFile(req: IncomingMessage, res: ServerResponse, rel: string, base = PROJECTS) {
  const path = normalize(join(base, decodeURIComponent(rel)));
  if (!path.startsWith(base + "/") || !existsSync(path) || !statSync(path).isFile()) return send(res, 404, { error: "not found" });
  const size = statSync(path).size;
  const type = TYPES[extname(path)] ?? "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-store" });
  createReadStream(path).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  try {
    if (url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify({ type: "snapshot", ...office.snapshot() })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname.startsWith("/files/")) return serveFile(req, res, url.pathname.slice("/files/".length));
    if (url.pathname.startsWith("/music/")) return serveFile(req, res, url.pathname.slice("/music/".length), MUSIC_DIR);
    if (req.method === "GET" && url.pathname === "/api/archived") return send(res, 200, { projects: listArchived() });
    if (req.method === "GET" && url.pathname === "/api/files") {
      const id = String(url.searchParams.get("id") ?? "");
      if (!/^[a-z0-9-]+$/.test(id) || !existsSync(dir(id))) return send(res, 404, { error: "no such project" });
      const files = (readdirSync(dir(id), { recursive: true }) as string[])
        .filter((f) => !/(^|\/)(state\.json|chat\.jsonl)$|\.tmp$/.test(f) && statSync(dir(id, f)).isFile())
        .sort();
      return send(res, 200, { files });
    }
    // The tracks this project can switch to (its layout's music folder) and the one picked for it, if any.
    if (req.method === "GET" && url.pathname === "/api/music") {
      const s = load(String(url.searchParams.get("id") ?? ""));
      const folder = musicDirFor(s.layout);
      return send(res, 200, { files: musicFiles(folder), current: s.music ?? null, served: `/music/${relative(MUSIC_DIR, folder)}/`.replace("//", "/") });
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      const b = await body(req);
      switch (url.pathname) {
        case "/api/topic": {
          const topic = String(b.topic ?? "").trim();
          if (!topic || topic.length > 200) return send(res, 400, { error: "topic must be 1-200 characters" });
          const layout = LAYOUTS.find((l) => l === b.layout) ?? "explained";
          return send(res, 200, office.newTopic(topic, layout));
        }
        case "/api/approve":
          office.approve(String(b.id));
          return send(res, 200, { ok: true });
        case "/api/reject": {
          const note = String(b.note ?? "").trim();
          if (!note) return send(res, 400, { error: "say what to change" });
          office.reject(String(b.id), note.slice(0, 2000), STEPS.includes(b.to) ? (b.to as Step) : undefined);
          return send(res, 200, { ok: true });
        }
        case "/api/redo": {
          if (!STEPS.includes(b.step)) return send(res, 400, { error: "pick a step to redo from" });
          const note = String(b.note ?? "").trim().slice(0, 2000);
          office.redo(String(b.id), b.step as Step, note || undefined);
          return send(res, 200, { ok: true });
        }
        case "/api/archive":
          office.archive(String(b.id));
          return send(res, 200, { ok: true });
        case "/api/cancel":
          office.cancel(String(b.id));
          return send(res, 200, { ok: true });
        case "/api/delete":
          office.delete(String(b.id));
          return send(res, 200, { ok: true });
        case "/api/restore":
          office.restore(String(b.id));
          return send(res, 200, { ok: true });
        case "/api/script": {
          const parsed = ScriptShape.safeParse(b.script);
          if (!parsed.success) return send(res, 400, { error: z.prettifyError(parsed.error) });
          const id = String(b.id);
          office.saveScript(id, () => writeScript(id, parsed.data));
          return send(res, 200, { ok: true });
        }
        case "/api/music":
          office.music(String(b.id), b.music ? String(b.music) : undefined);
          return send(res, 200, { ok: true });
        // Topic ideas from this week's money news (Sonnet with web search, a minute or two).
        case "/api/pitch":
          return send(res, 200, await pitch());
        case "/api/retry":
          office.retry(String(b.id));
          return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "unknown endpoint" });
    }
    vite.middlewares(req, res);
  } catch (e) {
    send(res, 400, { error: (e as Error).message });
  }
});

const vite = await createVite({
  root: join(ROOT, "web"),
  configFile: false,
  plugins: [react()],
  appType: "spa",
  server: { middlewareMode: true, hmr: { server } },
});

server.listen(PORT, HOST, () => {
  office.resume();
  console.log(`\n  qraxels office → http://${HOST}:${PORT}\n  (demo animation without Claude: http://${HOST}:${PORT}/?demo)\n`);
});
