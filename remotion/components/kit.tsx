import { Easing, interpolate } from "remotion";
import { stage, type Theme } from "../theme.ts";
import { type VisualProps } from "./common.tsx";
import { Scene, Stamp, clamp } from "./Mono.tsx";

// Shared bits for the label-only picture scenes (Money, Mind, Nature, Action, Life .tsx): the drawing in <Scene>,
// optional HTML on top, the label stamped at the stage top.
export type L = VisualProps<{ label?: string }>;
export const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
export const pop = { ...clamp, easing: Easing.out(Easing.back(2)) };
// 0→1 between frames a and b (clamped, eased in-out by default).
export const k01 = (f: number, a: number, b: number, e: object = ease) => interpolate(f, [a, b], [0, 1], e);
// Cycles 0→1 every n frames, offset by o.
export const cyc = (f: number, n: number, o = 0) => (((f + o) % n) + n) % n / n;

export function Frame({ p, t, children, over }: { p: { label?: string }; t: Theme; children: React.ReactNode; over?: React.ReactNode }) {
  return (
    <>
      <Scene>{children}</Scene>
      {over}
      {p.label && <Stamp text={p.label} t={t} y={stage(t).top} />}
    </>
  );
}
