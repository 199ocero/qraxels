import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatMsg, State } from "../server/project.ts";
import type { Pitch } from "../server/schemas.ts";
import { getVersion, sim, subscribe } from "./sim.ts";
import { api, musicFiles } from "./api.ts";

const colorOf = (from: string) => [...sim.bots.values()].find((b) => b.name === from)?.color ?? "var(--you)";

function ScriptPreview({ id }: { id: string }) {
  const [text, setText] = useState("Loading script…");
  useEffect(() => {
    fetch(`/files/${id}/script.md`).then((r) => (r.ok ? r.text() : "Script file not found.")).then(setText);
  }, [id]);
  return <pre className="script">{text}</pre>;
}

// Re-renders the video with another track; the picture and voice stay as they are.
function MusicPicker({ p }: { p: State }) {
  const [files, setFiles] = useState<string[]>([]);
  const [served, setServed] = useState("");
  const [pick, setPick] = useState(p.music ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    musicFiles(p.id).then((m) => {
      setFiles(m.files);
      setServed(m.served);
    });
  }, [p.id]);
  const change = async () => {
    setBusy(true);
    setError("");
    try {
      await api("music", { id: p.id, music: pick || undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!files.length) return null;
  return (
    <>
      <div className="row">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Music">
          <option value="">Default music (from .env)</option>
          {files.map((f) => (
            <option key={f} value={f}>
              {f.replace(/\.\w+$/, "")}
            </option>
          ))}
          <option value="off">No music</option>
        </select>
        <button disabled={busy || pick === (p.music ?? "")} onClick={change}>
          Change music
        </button>
      </div>
      {pick && pick !== "off" && <audio key={pick} src={`${served}${encodeURIComponent(pick)}`} controls preload="none" aria-label={`Preview ${pick}`} />}
      {error && <p className="error">{error}</p>}
    </>
  );
}

export function GateCard({ p }: { p: State }) {
  const [note, setNote] = useState("");
  const [to, setTo] = useState(p.gate === "script" ? "script" : "scenes");
  const [busy, setBusy] = useState(false);
  const targets = p.gate === "script" ? [["script", "Sky (rewrite script)"]] : [["scenes", "Dot (re-direct scenes)"], ["build", "Bolt (fix visuals)"]];
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gate">
      {p.gate === "script" ? <ScriptPreview id={p.id} /> : <video src={`/files/${p.id}/out.mp4?v=${p.updated_at}`} controls playsInline />}
      <button className="approve" disabled={busy} onClick={() => act(() => api("approve", { id: p.id }))}>
        Approve {p.gate === "script" ? "script" : "video"}
      </button>
      {p.gate === "video" && <MusicPicker p={p} />}
      <textarea placeholder="Or say what to change…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <div className="row">
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send back to">
          {targets.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button disabled={busy || !note.trim()} onClick={() => act(() => api("reject", { id: p.id, note, to }))}>
          Send back
        </button>
      </div>
    </div>
  );
}

function Message({ m, last, onOpen }: { m: ChatMsg; last: boolean; onOpen: (id: string) => void }) {
  const p = m.project ? sim.projects.get(m.project) : undefined;
  const isYou = m.from === "You";
  const failed = p && Object.values(p.steps).includes("failed");
  return (
    <li className={isYou ? "you" : ""}>
      <div className="meta">
        <b style={{ color: colorOf(m.from) }}>{m.from}</b>
        {p && (
          <button className="chip" style={{ background: p.color }} title={`Open "${p.topic}" in Projects`} onClick={() => onOpen(p.id)}>
            {p.topic.slice(0, 26)}
          </button>
        )}
      </div>
      <div className="text">{m.text}</div>
      {last && p && m.gate && p.gate === m.gate && <GateCard p={p} />}
      {last && failed && /^(I got stuck|Stopped\.)/.test(m.text) && (
        <button onClick={() => api("retry", { id: p!.id })}>Retry</button>
      )}
    </li>
  );
}

// `project` null = every project's messages; otherwise just that project's chat.
export function Chat({ project, setProject, onOpen }: { project: string | null; setProject: (id: string | null) => void; onOpen: (id: string) => void }) {
  useSyncExternalStore(subscribe, getVersion);
  const [topic, setTopic] = useState("");
  const [layout, setLayout] = useState("explained");
  const [error, setError] = useState("");
  const [ideas, setIdeas] = useState<Pitch["ideas"]>([]);
  const [pitching, setPitching] = useState(false);
  const end = useRef<HTMLLIElement>(null);
  const chat = project ? sim.chat.filter((m) => m.project === project) : sim.chat;
  const projects = [...sim.projects.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and React would treat it as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  // Only the newest message of each project gets action buttons.
  const lastIdx = new Map<string, number>();
  chat.forEach((m, i) => m.project && lastIdx.set(m.project, i));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    try {
      const s = (await api("topic", { topic, layout })) as State;
      setTopic("");
      setProject(s.id); // a new topic opens its own chat
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const suggest = async () => {
    setPitching(true);
    setError("");
    try {
      setIdeas(((await api("pitch", {})) as Partial<Pitch>).ideas ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPitching(false);
    }
  };

  return (
    <>
      <select className="channel" value={project ?? ""} onChange={(e) => setProject(e.target.value || null)} aria-label="Show chat for">
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.topic}
          </option>
        ))}
      </select>
      <ul className="scroll">
        {chat.length === 0 && !project && <li className="empty">Hand Sky a topic below, like "Why you're still broke at 30". The team takes it from there and brings the script and the video to your desk for approval.</li>}
        {chat.map((m, i) => (
          <Message key={i} m={m} last={lastIdx.get(m.project ?? "") === i} onOpen={onOpen} />
        ))}
        <li ref={end} className="end" />
      </ul>
      {ideas.length > 0 && (
        <ul className="ideas" aria-label="Topic ideas">
          {ideas.map((x) => (
            <li key={x.title}>
              <button type="button" onClick={() => (setTopic(x.title), setLayout(x.layout))} title={`First line: ${x.hook}`}>
                <b>{x.title}</b>
                <span>
                  {x.series} · {x.layout === "long" ? "long" : "Short"} · {x.why_now}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send}>
        {error && <p className="error">{error}</p>}
        <select value={layout} onChange={(e) => setLayout(e.target.value)} aria-label="Video style">
          <option value="explained">Explained</option>
          <option value="mono">Motivation</option>
          <option value="built">How it was built</option>
          <option value="long">Explained · long (16:9)</option>
        </select>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={project ? "Start another project…" : "Hand a topic to the team…"} maxLength={200} aria-label="New topic" />
        <button type="submit" disabled={!topic.trim()}>
          Send
        </button>
        <button type="button" className="suggest" disabled={pitching} onClick={suggest}>
          {pitching ? "Sky is reading the news…" : "Suggest topics"}
        </button>
      </form>
    </>
  );
}
