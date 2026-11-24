import { interpolate, useCurrentFrame } from "remotion";
import { evolvePath } from "@remotion/paths";
import { font, stage, W } from "../theme.ts";
import { useIn, usePop, type VisualProps } from "./common.tsx";

// Big punchy title; the frame around it is drawn as one line.
export function HookCard({ p, t }: VisualProps<{ title: string; subtitle?: string }>) {
  const s = stage(t);
  const words = p.title.split(" ");
  const frame = `M ${s.left + 20} ${s.cy - 330} H ${s.right - 20} V ${s.cy + 330} H ${s.left + 20} Z`;
  const draw = evolvePath(useIn(0, 24), frame);
  const sub = useIn(words.length * 3 + 8, 14);
  const size = p.title.length > 40 ? 92 : 112;
  return (
    <>
      <svg width={W} height={1920} style={{ position: "absolute" }}>
        <path d={frame} fill="none" stroke={t.line} strokeWidth={4} strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} />
      </svg>
      <div style={{ position: "absolute", left: s.left + 70, right: W - s.right + 70, top: s.cy - 300, height: 600, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <div style={{ font: `700 ${size}px/1.05 ${t.titleFont ?? font.display}`, color: t.text, letterSpacing: t.titleFont ? 0 : -2 }}>
          {words.map((w, i) => (
            <Word key={i} w={w} i={i} accent={i === words.length - 1 ? t.accent : undefined} />
          ))}
        </div>
        {p.subtitle && <div style={{ font: `500 48px/1.25 ${font.display}`, color: t.muted, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>{p.subtitle}</div>}
      </div>
    </>
  );
}

function Word({ w, i, accent }: { w: string; i: number; accent?: string }) {
  const k = usePop(i * 3);
  return <span style={{ display: "inline-block", marginRight: "0.25em", transform: `translateY(${(1 - k) * 60}px) scale(${0.7 + k * 0.3})`, opacity: Math.min(1, k * 1.5), color: accent }}>{w}</span>;
}

// One big sentence; the emphasis word gets a highlight swipe.
export function Callout({ p, t }: VisualProps<{ text: string; emphasis?: string }>) {
  const s = stage(t);
  const f = useCurrentFrame();
  const words = p.text.split(" ");
  const emph = (p.emphasis ?? "").toLowerCase().split(" ").filter(Boolean);
  const swipe = interpolate(f, [words.length * 2 + 6, words.length * 2 + 18], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = p.text.length > 60 ? 76 : 92;
  return (
    <div style={{ position: "absolute", left: s.left + 20, right: W - s.right + 20, top: s.top, height: s.height, display: "flex", alignItems: "center" }}>
      <div style={{ font: `700 ${size}px/1.18 ${t.titleFont ?? font.display}`, color: t.text, letterSpacing: t.titleFont ? 0 : -1 }}>
        {words.map((w, i) => {
          const on = emph.includes(w.toLowerCase().replace(/[^\w%$.]/g, ""));
          const k = interpolate(f - i * 2, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ display: "inline-block", marginRight: "0.25em", opacity: k, transform: `translateY(${(1 - k) * 24}px)`, position: "relative", color: on ? "#111" : undefined }}>
              {on && <span style={{ position: "absolute", inset: "-4px -10px", background: t.accent, borderRadius: 10, zIndex: -1, clipPath: `inset(0 ${100 - swipe}% 0 0)` }} />}
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}
