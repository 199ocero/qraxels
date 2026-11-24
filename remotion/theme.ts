import { Easing } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadImpact } from "@remotion/google-fonts/Anton";
import { loadFont as loadHiero } from "@remotion/google-fonts/NotoSansEgyptianHieroglyphs";
import { loadFont as loadCuneiform } from "@remotion/google-fonts/NotoSansCuneiform";
import { loadFont as loadNoto } from "@remotion/google-fonts/NotoSans";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Platform UI covers the top and bottom of vertical video; keep text out of these bands.
export const SAFE = { top: 220, bottom: 380, side: 70 };

export const font = {
  display: loadDisplay("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily,
  impact: loadImpact("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  // Real ancient scripts for the history pictures (Rosetta, Hieroglyphs, Tablet).
  hiero: loadHiero("normal", { weights: ["400"], subsets: ["egyptian-hieroglyphs"] }).fontFamily,
  cuneiform: loadCuneiform("normal", { weights: ["400"], subsets: ["cuneiform"] }).fontFamily,
  greek: loadNoto("normal", { weights: ["700"], subsets: ["greek"] }).fontFamily,
};

export const ease = Easing.bezier(0.22, 1, 0.36, 1);

export type Theme = {
  name: "mono";
  bg: string;
  bg2: string;
  line: string;
  accent: string;
  text: string;
  muted: string;
  panel: string;
  // Where captions sit; visuals take the rest of the safe area.
  captions: "top" | "bottom";
  titleFont?: string;
};

// The only look: black and white.
export const MONO: Theme = { name: "mono", bg: "#000000", bg2: "#0b0b0b", line: "#d9d9d9", accent: "#ffffff", text: "#ffffff", muted: "#8c8c8c", panel: "rgba(0,0,0,0.92)", captions: "top", titleFont: font.impact };

// The box visuals may use, leaving room for captions on the theme's caption side.
export function stage(t: Theme) {
  const capH = 260;
  const top = SAFE.top + (t.captions === "top" ? capH : 20);
  const bottom = H - SAFE.bottom - (t.captions === "bottom" ? capH : 20);
  return { left: SAFE.side, right: W - SAFE.side, top, bottom, width: W - SAFE.side * 2, height: bottom - top, cx: W / 2, cy: (top + bottom) / 2 };
}
