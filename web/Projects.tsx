import { useEffect, useState } from "react";
import type { State, Step } from "../server/project.ts";
import type { Script } from "../server/schemas.ts";
import { GateCard } from "./Chat.tsx";
import { api, archivedProjects, projectFiles } from "./api.ts";
import { BOT_COLORS, STEPS, sim } from "./sim.ts";

const nameOf = (s: Step) => sim.bots.get(s)?.name ?? s;
const roleOf = (s: Step) => sim.bots.get(s)?.role ?? s;

function status(p: State): { text: string; kind: "you" | "work" | "fail" | "done" | "queue" } {
  if (p.approved) return { text: "Done, ready to post", kind: "done" };
  if (p.gate) return { text: p.gate === "script" ? "Script waiting for you" : "Video waiting for you", kind: "you" };
  const failed = STEPS.find((s) => p.steps[s] === "failed");
  if (failed) return { text: `${nameOf(failed)} stopped`, kind: "fail" };
  const working = STEPS.find((s) => p.steps[s] === "working");
  if (working) return { text: `${nameOf(working)} is working`, kind: "work" };
  const next = STEPS.find((s) => p.steps[s] === "pending");
  return { text: next ? `Waiting for ${nameOf(next)}` : "", kind: "queue" };
}

function Dots({ p }: { p: State }) {
  return (
    <span className="dots" aria-label={STEPS.map((s) => `${roleOf(s)} ${p.steps[s]}`).join(", ")}>
      {STEPS.map((s) => (
        <i key={s} className={p.steps[s]} style={p.steps[s] === "done" || p.steps[s] === "working" ? { background: BOT_COLORS[s] } : undefined} title={`${roleOf(s)}: ${p.steps[s]}`} />
      ))}
    </span>
  );
}

function useAction() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

function Redo({ p, step, onDone }: { p: State; step: Step; onDone: () => void }) {
  const [note, setNote] = useState("");
  const { error, busy, run } = useAction();
  return (
    <div className="redo">
      <textarea rows={2} placeholder={`Optional note for ${nameOf(step)}…`} value={note} onChange={(e) => setNote(e.target.value)} />
      {p.approved && <p className="hint">This makes a new version. The current video is kept as out-&lt;date&gt;.mp4.</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="approve" disabled={busy} onClick={async () => (await run(() => api("redo", { id: p.id, step, note }))) && onDone()}>
          Redo from {nameOf(step)}
        </button>
        <button onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function Steps({ p }: { p: State }) {
  const [redo, setRedo] = useState<Step | null>(null);
  const anyWorking = STEPS.some((s) => p.steps[s] === "working");
  return (
    <ol className="steps">
      {STEPS.map((s, i) => {
        const ready = STEPS.slice(0, i).every((b) => p.steps[b] === "done") && !(p.gate === "script" && i > STEPS.indexOf("script"));
        return (
          <li key={s}>
            <div className="step-row">
              <i className={`dot-s ${p.steps[s]}`} style={{ background: p.steps[s] === "pending" ? undefined : BOT_COLORS[s] }} />
              <span>
                <b>{nameOf(s)}</b> · {roleOf(s)}
              </span>
              <em>{p.steps[s]}</em>
              <button className="small" disabled={!ready || anyWorking} title={anyWorking ? "Wait for the current bot to finish" : !ready ? (p.gate === "script" ? "Approve the script first" : "Earlier steps aren't done yet") : ""} onClick={() => setRedo(redo === s ? null : s)}>
                Redo from here
              </button>
            </div>
            {redo === s && <Redo p={p} step={s} onDone={() => setRedo(null)} />}
          </li>
        );
      })}
    </ol>
  );
}

const countWords = (s: Script) => s.beats.map((b) => b.narration).join(" ").split(/\s+/).filter(Boolean).length;

function ScriptEditor({ p, onClose }: { p: State; onClose: () => void }) {
  const [s, setS] = useState<Script | null>(null);
  const { error, busy, run } = useAction();
  useEffect(() => {
    fetch(`/files/${p.id}/script.json`).then((r) => r.json()).then(setS);
  }, [p.id]);
  if (!s) return <p className="hint">Loading script…</p>;
  const words = countWords(s);
  const set = (patch: Partial<Script>) => setS({ ...s, ...patch });
  const setBeat = (i: number, k: "narration" | "visual_idea", v: string) => set({ beats: s.beats.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  return (
    <div className="editor">
      <label>
        Title
        <input value={s.title} maxLength={70} onChange={(e) => set({ title: e.target.value })} />
      </label>
      {s.beats.map((b, i) => (
        <fieldset key={i}>
          <legend>
            Beat {i + 1}
            <button className="small" disabled={s.beats.length <= 4} onClick={() => set({ beats: s.beats.filter((_, j) => j !== i) })} aria-label={`Remove beat ${i + 1}`}>
              Remove
            </button>
          </legend>
          <textarea rows={3} value={b.narration} onChange={(e) => setBeat(i, "narration", e.target.value)} aria-label={`Beat ${i + 1} narration`} />
          <input value={b.visual_idea} onChange={(e) => setBeat(i, "visual_idea", e.target.value)} aria-label={`Beat ${i + 1} on screen`} placeholder="On screen…" />
        </fieldset>
      ))}
      <label>
        Where the analogy breaks down
        <textarea rows={2} value={s.analogy_breaks_down} onChange={(e) => set({ analogy_breaks_down: e.target.value })} />
      </label>
      <p className={`hint ${words < 150 || words > 225 ? "warn" : ""}`}>
        {words} words ≈ {Math.round((words / 150) * 60)}s spoken {words > 225 ? "(over the 90s target)" : words < 150 ? "(under 60s, too short for TikTok Creator Rewards)" : "(within 60–90s)"}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="approve" disabled={busy} onClick={async () => (await run(() => api("script", { id: p.id, script: s }))) && onClose()}>
          Save script
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function Files({ p }: { p: State }) {
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    projectFiles(p.id).then(setFiles);
  }, [p.id, p.updated_at]);
  const url = (f: string) => `/files/${p.id}/${f}?v=${encodeURIComponent(p.updated_at)}`;
  const docs = files.filter((f) => /^(research|sources|script)\.md$|^scenes\.json$|^description\.txt$/.test(f));
  const stills = files.filter((f) => f.startsWith("stills/"));
  const thumbs = files.filter((f) => f.startsWith("thumbs/"));
  const shorts = files.filter((f) => /^shorts\/short-\d+\.mp4$/.test(f)).sort((x, y) => parseInt(x.slice(12)) - parseInt(y.slice(12)));
  const videos = files.filter((f) => /^out.*\.mp4$/.test(f)).sort().reverse();
  if (!files.length) return <p className="hint">No files yet.</p>;
  return (
    <div className="files">
      {docs.length > 0 && (
        <p className="links">
          {docs.map((f) => (
            <a key={f} href={url(f)} target="_blank" rel="noreferrer">
              {f}
            </a>
          ))}
        </p>
      )}
      {videos.map((f, i) =>
        i === 0 && f === "out.mp4" ? (
          <video key={f} src={url(f)} controls playsInline />
        ) : (
          <a key={f} href={url(f)} target="_blank" rel="noreferrer">
            Older version: {f}
          </a>
        ),
      )}
      {thumbs.length > 0 && (
        <>
          <p className="hint">{p.layout === "long" ? "Thumbnails (1920x1080, for the YouTube video)" : "Thumbnails (1080x1920, YouTube Shorts and Reels covers)"}</p>
          <div className="stills">
            {thumbs.map((f) => (
              <a key={f} href={url(f)} target="_blank" rel="noreferrer" download>
                <img src={url(f)} alt={f.replace("thumbs/", "")} loading="lazy" />
              </a>
            ))}
          </div>
        </>
      )}
      {shorts.length > 0 && (
        <>
          <p className="hint">Shorts, one per chapter (1080x1920)</p>
          <p className="links">
            {shorts.map((f) => (
              <a key={f} href={url(f)} target="_blank" rel="noreferrer" download>
                {f.replace("shorts/", "")}
              </a>
            ))}
            <a href={url("shorts/titles.txt")} target="_blank" rel="noreferrer">
              titles.txt
            </a>
          </p>
        </>
      )}
      {stills.length > 0 && (
        <div className="stills">
          {stills.map((f) => (
            <a key={f} href={url(f)} target="_blank" rel="noreferrer">
              <img src={url(f)} alt={f.replace("stills/", "")} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <p className="hint">Folder: projects/{p.id}/</p>
    </div>
  );
}

function Detail({ p, back, onChat }: { p: State; back: () => void; onChat: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { error, busy, run } = useAction();
  const st = status(p);
  const anyWorking = STEPS.some((s) => p.steps[s] === "working");
  const running = st.kind === "work" || st.kind === "queue";
  return (
    <div className="scroll detail">
      <button className="link" onClick={back}>
        ← All projects
      </button>
      <h2>
        <span className="swatch" style={{ background: p.color }} />
        {p.topic}
      </h2>
      <p className={`status ${st.kind}`}>
        {st.text}
      </p>
      <div className="row">
        <button className="small" onClick={() => onChat(p.id)}>
          Open chat
        </button>
        {running && (
          <button className="small danger" disabled={busy} onClick={() => run(() => api("cancel", { id: p.id }))}>
            Cancel
          </button>
        )}
        {STEPS.some((s) => p.steps[s] === "failed") && <button className="small" onClick={() => run(() => api("retry", { id: p.id }))}>Retry</button>}
      </div>
      {p.gate && !editing && <GateCard p={p} />}
      {p.gate === "script" && !editing && (
        <button className="small" onClick={() => setEditing(true)}>
          Edit script by hand
        </button>
      )}
      {editing && <ScriptEditor p={p} onClose={() => setEditing(false)} />}
      <h3>Team</h3>
      <Steps p={p} />
      <h3>Files</h3>
      <Files p={p} />
      <h3>Archive or delete</h3>
      {!confirmArchive ? (
        <button className="small" disabled={anyWorking} onClick={() => setConfirmArchive(true)}>
          Archive project…
        </button>
      ) : (
        <div className="redo">
          <p className="hint">Move this project to projects/_archive/? It leaves the office, but nothing is deleted.</p>
          <div className="row">
            <button className="danger" disabled={busy} onClick={async () => (await run(() => api("archive", { id: p.id }))) && back()}>
              Archive
            </button>
            <button onClick={() => setConfirmArchive(false)}>Cancel</button>
          </div>
        </div>
      )}
      {!confirmDelete ? (
        <button className="small" disabled={anyWorking} title={anyWorking ? "Cancel it first" : ""} onClick={() => setConfirmDelete(true)}>
          Delete project…
        </button>
      ) : (
        <div className="redo">
          <p className="hint">Permanently delete projects/{p.id}/ with its video, files and chat? This can't be undone.</p>
          <div className="row">
            <button className="danger" disabled={busy} onClick={async () => (await run(() => api("delete", { id: p.id }))) && back()}>
              Delete forever
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Archived() {
  const [items, setItems] = useState<State[]>([]);
  const [show, setShow] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { error, busy, run } = useAction();
  // Re-read whenever a project enters or leaves the office.
  useEffect(() => {
    archivedProjects().then(setItems);
  }, [sim.projects.size]);
  if (!items.length) return null;
  return (
    <li className="archived">
      <button className="link" onClick={() => setShow(!show)} aria-expanded={show}>
        {show ? "▾" : "▸"} Archived ({items.length})
      </button>
      {show && (
        <ul>
          {items.map((p) => (
            <li key={p.id}>
              <span className="swatch" style={{ background: p.color }} />
              <span className="pinfo">
                <b>{p.topic}</b>
                <span className="status">{status(p).text}</span>
              </span>
              {deleting === p.id ? (
                <>
                  <button className="small danger" disabled={busy} onClick={async () => (await run(() => api("delete", { id: p.id }))) && setItems(items.filter((x) => x.id !== p.id))}>
                    Delete forever
                  </button>
                  <button className="small" onClick={() => setDeleting(null)}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button className="small" disabled={busy} onClick={() => run(() => api("restore", { id: p.id }))}>
                    Restore
                  </button>
                  <button className="small" disabled={busy} onClick={() => setDeleting(p.id)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  );
}

export function Projects({ open, setOpen, onChat }: { open: string | null; setOpen: (id: string | null) => void; onChat: (id: string) => void }) {
  const projects = [...sim.projects.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = open ? sim.projects.get(open) : undefined;
  if (current) return <Detail p={current} back={() => setOpen(null)} onChat={onChat} />;
  return (
    <ul className="scroll projects">
      {projects.length === 0 && <li className="empty">No projects yet. Hand the team a topic in the Chat tab.</li>}
      {projects.map((p) => {
        const st = status(p);
        return (
          <li key={p.id}>
            <button className="project" onClick={() => setOpen(p.id)}>
              <span className="swatch" style={{ background: p.color }} />
              <span className="pinfo">
                <b>{p.topic}</b>
                <span className={`status ${st.kind}`}>{st.text}</span>
              </span>
              <Dots p={p} />
            </button>
          </li>
        );
      })}
      <Archived />
    </ul>
  );
}
