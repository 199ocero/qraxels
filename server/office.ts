import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as P from "./project.ts";
import { musicDirFor, musicFiles } from "./music.ts";
import type { ChatMsg, Gate, State, Step } from "./project.ts";

export const BOTS: { id: Step; name: string; role: string }[] = [
  { id: "script", name: "Sky", role: "Scriptwriter" },
  { id: "scenes", name: "Dot", role: "Director" },
  { id: "voice", name: "Nova", role: "Narrator" },
  { id: "build", name: "Bolt", role: "Builder" },
  { id: "render", name: "Ray", role: "Renderer" },
];

export type BotStatus = "idle" | "working" | "failed";
// `signal` aborts when you cancel the project; jobs pass it to the processes they start.
export type JobCtx = { state: State; note?: string; activity: (line: string) => void; signal: AbortSignal };
// A job does its step's work for one project and returns a one-line summary for the chat.
export type Job = (ctx: JobCtx) => Promise<string>;

export type OfficeEvent =
  | { type: "bot"; bot: Step; status: BotStatus; project?: string; activity?: string }
  | { type: "handoff"; from: Step; to: Step | "desk"; project: string; color: string }
  | { type: "chat"; msg: ChatMsg }
  | { type: "project"; state: State }
  | { type: "removed"; id: string }
  | { type: "restored"; state: State; chat: ChatMsg[] };

const role = (s: Step) => BOTS.find((b) => b.id === s)!;
const next = (s: Step): Step | undefined => P.STEPS[P.STEPS.indexOf(s) + 1];

export class Office extends EventEmitter {
  private queues = new Map<Step, string[]>(P.STEPS.map((s) => [s, []]));
  private busy = new Set<Step>();
  private running = new Map<string, AbortController>();
  bots = new Map<Step, { status: BotStatus; project?: string; activity?: string }>(P.STEPS.map((s) => [s, { status: "idle" }]));

  constructor(
    private jobs: Record<Step, Job>,
    // Time for the folder to be walked over before the next bot starts, so the 3D view matches.
    private handoffMs = 4000,
    // Runs once the video is approved (cover thumbnails); its failure never undoes the approval.
    private afterApprove?: Job,
  ) {
    super();
  }

  private emitEvent(e: OfficeEvent) {
    this.emit("event", e);
  }

  say(from: string, text: string, project?: string, gate?: Gate) {
    const msg: ChatMsg = { ts: new Date().toISOString(), project, from, text, gate };
    P.appendChat(msg);
    this.emitEvent({ type: "chat", msg });
  }

  private setBot(bot: Step, status: BotStatus, project?: string, activity?: string) {
    this.bots.set(bot, { status, project, activity });
    this.emitEvent({ type: "bot", bot, status, project, activity });
  }

  private update(id: string, fn: (s: State) => void): State {
    const s = P.load(id);
    fn(s);
    P.save(s);
    this.emitEvent({ type: "project", state: s });
    return s;
  }

  newTopic(topic: string, layout?: P.Layout): State {
    const s = P.create(topic, new Date(), layout);
    this.emitEvent({ type: "project", state: s });
    this.say("You", topic, s.id);
    this.say(role("script").name, `On it! Writing "${topic}".`, s.id);
    this.enqueue(s.id, "script");
    return s;
  }

  enqueue(id: string, step: Step) {
    const q = this.queues.get(step)!;
    if (!q.includes(id)) q.push(id);
    this.pump(step);
  }

  private pump(step: Step) {
    if (this.busy.has(step)) return;
    const id = this.queues.get(step)!.shift();
    if (!id) return;
    this.busy.add(step);
    this.work(step, id).finally(() => {
      this.busy.delete(step);
      this.pump(step);
    });
  }

  // A queued entry can go stale (a redo or archive happened while a handoff was walking over).
  private runnable(id: string, step: Step): boolean {
    try {
      const s = P.load(id);
      const before = P.STEPS.slice(0, P.STEPS.indexOf(step));
      return !s.gate && !s.approved && s.steps[step] === "pending" && before.every((b) => s.steps[b] === "done");
    } catch {
      return false; // archived
    }
  }

  private async work(step: Step, id: string) {
    if (!this.runnable(id, step)) return;
    const bot = role(step);
    let state = this.update(id, (s) => (s.steps[step] = "working"));
    this.setBot(step, "working", id, "starting…");
    const ac = new AbortController();
    this.running.set(id, ac);
    let summary = "";
    try {
      summary = await this.jobs[step]({
        state,
        note: state.notes[step],
        activity: (a) => !ac.signal.aborted && this.setBot(step, "working", id, a),
        signal: ac.signal,
      });
    } catch (e) {
      if (!ac.signal.aborted) {
        this.update(id, (s) => (s.steps[step] = "failed"));
        this.setBot(step, "failed", id, "something went wrong");
        this.say(bot.name, `I got stuck: ${(e as Error).message}`, id);
        return;
      }
    } finally {
      this.running.delete(id);
    }
    if (ac.signal.aborted) {
      this.update(id, (s) => (s.steps[step] = "failed"));
      this.setBot(step, "idle");
      this.say(bot.name, "Stopped. Hit Retry to pick it back up.", id);
      return;
    }
    const gate = P.GATE_AFTER[step];
    state = this.update(id, (s) => {
      s.steps[step] = "done";
      delete s.notes[step];
      if (gate) s.gate = gate;
    });
    this.setBot(step, "idle");
    const to = gate ? "desk" : next(step)!;
    this.emitEvent({ type: "handoff", from: step, to, project: id, color: state.color });
    if (gate) {
      this.say(bot.name, `${summary} It's on your desk for review.`, id, gate);
    } else {
      this.say(bot.name, `${summary} Handing it to ${role(to as Step).name}.`, id);
      setTimeout(() => this.enqueue(id, to as Step), this.handoffMs);
    }
  }

  approve(id: string) {
    const s = P.load(id);
    if (!s.gate) throw new Error("nothing is waiting for approval");
    if (s.gate === "script") {
      this.update(id, (x) => (x.gate = null));
      this.say("You", "Script approved.", id);
      this.emitEvent({ type: "handoff", from: "script", to: "scenes", project: id, color: s.color });
      setTimeout(() => this.enqueue(id, "scenes"), this.handoffMs);
    } else {
      this.update(id, (x) => {
        x.gate = null;
        x.approved = true;
      });
      this.say("You", "Video approved.", id);
      this.say(role("render").name, `Final video saved at projects/${id}/out.mp4 — ready to post.`, id);
      if (this.afterApprove) {
        const ray = role("render").name;
        this.say(ray, s.layout === "long" ? "Making 3 thumbnails, then cutting each chapter into a Short…" : "Making 3 thumbnails for YouTube Shorts and Reels…", id);
        this.afterApprove({ state: P.load(id), activity: () => {}, signal: new AbortController().signal })
          .then((summary) => {
            this.update(id, () => {}); // bumps updated_at so the files list picks the thumbnails up
            this.say(ray, summary, id);
          })
          .catch((e) => this.say(ray, `I couldn't finish the thumbnails${s.layout === "long" ? " and Shorts" : ""}: ${(e as Error).message}`, id));
      }
    }
  }

  // Sends the work back to `to` with a note; that step and everything after it is redone.
  reject(id: string, note: string, to?: Step) {
    const s = P.load(id);
    if (!s.gate) throw new Error("nothing is waiting for review");
    const allowed: Step[] = s.gate === "script" ? ["script"] : ["scenes", "build"];
    const target = to && allowed.includes(to) ? to : allowed[allowed.length - 1];
    this.update(id, (x) => {
      x.gate = null;
      x.notes[target] = note;
      for (const st of P.STEPS.slice(P.STEPS.indexOf(target))) x.steps[st] = "pending";
    });
    this.say("You", `Back to ${role(target).name}: ${note}`, id);
    this.emitEvent({ type: "handoff", from: target, to: target, project: id, color: s.color });
    setTimeout(() => this.enqueue(id, target), this.handoffMs);
  }

  private dequeue(id: string) {
    for (const q of this.queues.values()) {
      const i = q.indexOf(id);
      if (i >= 0) q.splice(i, 1);
    }
  }

  private assertIdle(s: State) {
    const busy = P.STEPS.find((st) => s.steps[st] === "working");
    if (busy) throw new Error(`${role(busy).name} is working on it right now; try again when they finish`);
  }

  // Re-run `step` and everything after it, from any state (including approved videos → a new version).
  redo(id: string, step: Step, note?: string) {
    const s = P.load(id);
    this.assertIdle(s);
    // The script gate must be approved, not skipped, before scenes can run.
    if (s.gate === "script" && P.STEPS.indexOf(step) > P.STEPS.indexOf("script")) throw new Error("approve the script first");
    const missing = P.STEPS.slice(0, P.STEPS.indexOf(step)).find((st) => s.steps[st] !== "done");
    if (missing) throw new Error(`${role(missing).name}'s step isn't done yet, so ${role(step).name} has nothing to work from`);
    this.dequeue(id);
    // Keep the previous final video instead of overwriting it.
    if (existsSync(P.dir(id, "out.mp4"))) renameSync(P.dir(id, "out.mp4"), P.dir(id, `out-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`));
    this.update(id, (x) => {
      x.gate = null;
      x.approved = false;
      if (note) x.notes[step] = note;
      for (const st of P.STEPS.slice(P.STEPS.indexOf(step))) x.steps[st] = "pending";
    });
    this.say("You", `Redo from ${role(step).name}${note ? `: ${note}` : "."}`, id);
    this.emitEvent({ type: "handoff", from: step, to: step, project: id, color: s.color });
    setTimeout(() => this.enqueue(id, step), this.handoffMs);
  }

  // Picks this video's track (a file in its music folder, "off", or undefined = back to .env) and re-renders only;
  // the picture, voice and drawings are kept. shortcut: a long video gets that one track in every chapter.
  music(id: string, music?: string) {
    const s = P.load(id);
    if (music && music !== "off" && !musicFiles(musicDirFor(s.layout)).includes(music)) throw new Error(`there's no ${music} in the music folder`);
    this.assertIdle(s);
    this.update(id, (x) => (x.music = music));
    this.redo(id, "render", `music: ${music === "off" ? "none" : (music ?? "default")}`);
  }

  // Moves the project folder to projects/_archive/ (nothing is deleted).
  archive(id: string) {
    const s = P.load(id);
    this.assertIdle(s);
    this.dequeue(id);
    mkdirSync(P.ARCHIVE, { recursive: true });
    renameSync(P.dir(id), join(P.ARCHIVE, id));
    this.emitEvent({ type: "removed", id });
  }

  // Stops the project: kills the bot's current job (or drops it from the queue). Retry resumes it.
  cancel(id: string) {
    const s = P.load(id);
    const step = P.STEPS.find((st) => s.steps[st] !== "done");
    if (s.gate || s.approved || !step || s.steps[step] === "failed") throw new Error("nothing is running for this project");
    this.dequeue(id);
    this.say("You", "Cancel this.", id);
    const ac = this.running.get(id);
    if (ac) return ac.abort(); // work() marks the step stopped once the job exits
    this.update(id, (x) => (x.steps[step] = "failed"));
    this.say(role(step).name, "Stopped. Hit Retry to pick it back up.", id);
  }

  // Permanently deletes the project folder, whether it's in the office or the archive.
  delete(id: string) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("no such project");
    if (existsSync(P.dir(id, "state.json"))) {
      this.assertIdle(P.load(id));
      this.dequeue(id);
      rmSync(P.dir(id), { recursive: true, force: true });
      this.emitEvent({ type: "removed", id });
    } else if (existsSync(join(P.ARCHIVE, id, "state.json"))) rmSync(join(P.ARCHIVE, id), { recursive: true, force: true });
    else throw new Error("no such project");
  }

  // Brings an archived project back into the office, where it picks up from where it was.
  restore(id: string) {
    if (!/^[a-z0-9-]+$/.test(id) || !existsSync(join(P.ARCHIVE, id, "state.json"))) throw new Error("no such archived project");
    if (existsSync(P.dir(id))) throw new Error("a project with that id is already in the office");
    renameSync(join(P.ARCHIVE, id), P.dir(id));
    this.say("You", "Brought this back from the archive.", id);
    this.emitEvent({ type: "restored", state: P.load(id), chat: P.chatOf(id) });
    this.resumeOne(P.load(id));
  }

  // Hand edits to the script while it waits at your desk.
  saveScript(id: string, write: () => void) {
    const s = P.load(id);
    if (s.gate !== "script") throw new Error("the script can only be edited while it's on your desk");
    write();
    this.update(id, () => {});
    this.say("You", "Edited the script by hand.", id);
  }

  retry(id: string) {
    const s = P.load(id);
    const failed = P.STEPS.find((st) => s.steps[st] === "failed");
    if (!failed) throw new Error("no failed step");
    this.update(id, (x) => (x.steps[failed] = "pending"));
    this.enqueue(id, failed);
  }

  // After a restart: re-queue anything that was in progress and not waiting on you.
  resume() {
    for (const s of P.list()) this.resumeOne(s);
  }

  private resumeOne(s: State) {
    if (s.gate || s.approved) return;
    const step = P.STEPS.find((st) => s.steps[st] === "pending" || s.steps[st] === "working");
    if (!step || !P.STEPS.slice(0, P.STEPS.indexOf(step)).every((st) => s.steps[st] === "done")) return;
    if (s.steps[step] === "working") this.update(s.id, (x) => (x.steps[step] = "pending")); // interrupted by a restart or archive
    this.enqueue(s.id, step);
  }

  snapshot() {
    return {
      bots: BOTS.map((b) => ({ ...b, ...this.bots.get(b.id)! })),
      projects: P.list(),
      chat: P.chatHistory(),
    };
  }
}
