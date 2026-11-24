import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as remotion from "remotion";
import { FPS, H, SAFE, W, font, stage } from "./theme.ts";
import { D, Figure, Ground, HIP, SIT, STAND, Stamp, StatCounter, VICTORY, clamp, go, lerp, mix, run, walk, walkRate } from "./components/Mono.tsx";
import { Frame, cyc, ease, k01, pop } from "./components/kit.tsx";
import { saidAt, tickAt } from "./mono.ts";
import type { VisualProps } from "./components/common.tsx";

// Scenes drawn for one video (projects/{id}/draw/scene-NN.tsx, written by Bolt from the director's shot) import
// only these. "kit" is the same drawing kit the library components use (prompts/draw.md documents it).
export const KIT = { W, H, FPS, SAFE, font, stage, D, HIP, STAND, SIT, VICTORY, Figure, Ground, Stamp, StatCounter, Frame, clamp, ease, pop, k01, cyc, go, lerp, mix, walk, run, walkRate, tickAt, saidAt };
const MODULES: Record<string, unknown> = { react: React, "react/jsx-runtime": jsx, remotion, kit: KIT };
export const IMPORTS = Object.keys(MODULES);

// esbuild's CommonJS output (server/bots/draw.ts toJs) → the file's default export.
export function compile(js: string): React.FC<VisualProps<any>> {
  const m = { exports: {} as { default?: unknown } };
  const req = (name: string) => {
    if (!(name in MODULES)) throw new Error(`can't import "${name}"; only ${IMPORTS.join(", ")}`);
    return MODULES[name];
  };
  new Function("require", "module", "exports", js)(req, m, m.exports);
  if (typeof m.exports.default !== "function") throw new Error("the file must `export default` a component");
  return m.exports.default as React.FC<VisualProps<any>>;
}

// A drawn scene, or the library picture when it doesn't compile or throws. DRAW_FAIL logs tell the build step
// (renderStills) which scene broke and why, so it can be redrawn.
type Props = { i: number; js: string; fallback: React.ReactNode; props: VisualProps<any> };
export class Drawn extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };
  C = (() => {
    try {
      return compile(this.props.js);
    } catch (e) {
      console.error(`DRAW_FAIL ${this.props.i} ${(e as Error).message}`);
      return null;
    }
  })();
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    console.error(`DRAW_FAIL ${this.props.i} ${e.message}`);
  }
  render() {
    const C = this.C;
    return this.state.failed || !C ? this.props.fallback : <C {...this.props.props} />;
  }
}
