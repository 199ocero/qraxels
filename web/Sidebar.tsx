import { useState, useSyncExternalStore } from "react";
import { Chat } from "./Chat.tsx";
import { Projects } from "./Projects.tsx";
import { getVersion, sim, subscribe } from "./sim.ts";

export function Sidebar() {
  useSyncExternalStore(subscribe, getVersion);
  const [tab, setTab] = useState<"chat" | "projects">("chat");
  const [open, setOpen] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<string | null>(null);
  const chatProject = chatFor && sim.projects.has(chatFor) ? chatFor : null; // falls back to All once it's archived or deleted
  const openChat = (id: string) => {
    setChatFor(id);
    setTab("chat");
  };
  const waiting = [...sim.projects.values()].filter((p) => p.gate).length;
  const openProject = (id: string) => {
    setOpen(id);
    setTab("projects");
  };
  return (
    <aside className="chat">
      <header>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
            Chat
          </button>
          <button role="tab" aria-selected={tab === "projects"} className={tab === "projects" ? "on" : ""} onClick={() => setTab("projects")}>
            Projects <span className="count">{sim.projects.size}</span>
            {waiting > 0 && <span className="badge" title={`${waiting} waiting for you`}>{waiting}</span>}
          </button>
        </div>
        <span className={`dot ${sim.connected ? "on" : ""}`} title={sim.connected ? "connected" : "offline"} />
      </header>
      {tab === "chat" ? <Chat project={chatProject} setProject={setChatFor} onOpen={openProject} /> : <Projects open={open} setOpen={setOpen} onChat={openChat} />}
    </aside>
  );
}
