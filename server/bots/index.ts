import type { Job } from "../office.ts";
import type { Step } from "../project.ts";
import { script, scenes } from "./claude-bots.ts";
import { voice } from "./voice.ts";
import { build, render, thumbs } from "./remotion.ts";

export const jobs: Record<Step, Job> = { script, scenes, voice, build, render };
export { thumbs };
