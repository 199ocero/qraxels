import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, type Theme } from "../theme.ts";

// w: the scene's spoken words, start in seconds from the scene's start (for visuals that react to the voice).
// hit: the frame (within the scene) its hit word is spoken, so a scene's big moment can land on it.
export type VisualProps<P> = { p: P; t: Theme; dur: number; w?: { word: string; start: number }[]; hit?: number };

// 0→1 over `frames`, starting at `delay`, eased.
export function useIn(delay = 0, frames = 12) {
  const f = useCurrentFrame();
  return interpolate(f - delay, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

export function usePop(delay = 0) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
}
