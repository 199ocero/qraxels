import { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Canvas, font, stage, W, H, type Theme } from "../theme.ts";
import { useIn, type VisualProps } from "./common.tsx";
import { saidAt, tickAt } from "../mono.ts";

// Motivation style: glowing monochrome stick figures, always moving.

export type Pt = [number, number];
export type Pose = { t: number; ls: number; le: number; rs: number; re: number; lh: number; lk: number; rh: number; rk: number };
export const D = Math.PI / 180;
const L = { torso: 140, arm: 74, leg: 86, neck: 64, head: 42 };
// Hip height above the ground when standing (two leg segments + half the limb stroke).
export const HIP = L.leg * 2 + 13;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const go = ([x, y]: Pt, deg: number, len: number): Pt => [x + Math.sin(deg * D) * len, y + Math.cos(deg * D) * len];

// Two-bone IK for an arm with equal segments; bend picks which side the elbow goes.
function ik(a: Pt, b: Pt, bend: number): Pt {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const d = Math.min(Math.hypot(dx, dy), 2 * L.arm - 0.01) || 0.01;
  const h = Math.sqrt(Math.max(0, L.arm ** 2 - (d / 2) ** 2));
  return [a[0] + dx / 2 - (bend * h * dy) / d, a[1] + dy / 2 + (bend * h * dx) / d];
}

// Angles are absolute degrees from straight down; positive points forward (+x).
export const STAND: Pose = { t: 0, ls: -6, le: -2, rs: 6, re: 10, lh: -4, lk: -4, rh: 4, rk: 4 };
export const SIT: Pose = { t: 25, ls: 50, le: 80, rs: 55, re: 85, lh: 80, lk: -5, rh: 84, rk: 0 };
export const VICTORY: Pose = { t: -4, ls: 160, le: 175, rs: -160, re: -175, lh: -6, lk: -6, rh: 6, rk: 6 };

// Walk cycle: knee flexion peaks just after toe-off and is straight at heel strike; arms swing against the legs.
export function walk(ph: number, amp = 1): Pose {
  const leg = (p: number) => {
    const th = 24 * amp * Math.sin(p);
    return [th, th - 6 - 58 * amp * Math.max(0, Math.cos(p + 0.4)) ** 1.4];
  };
  const arm = (p: number) => {
    const a = 20 * amp * Math.sin(p);
    return [a, a + 10 + 22 * amp * Math.max(0, Math.sin(p))];
  };
  const [rh, rk] = leg(ph);
  const [lh, lk] = leg(ph + Math.PI);
  const [rs, re] = arm(ph + Math.PI);
  const [ls, le] = arm(ph);
  return { t: 5 * amp + 1.5 * Math.cos(2 * ph), ls, le, rs, re, lh, lk, rh, rk };
}

// Sprint: high knees, elbows locked near 90°, forward lean.
export function run(ph: number): Pose {
  const leg = (p: number) => {
    const th = 42 * Math.sin(p) + 12;
    return [th, th - 12 - 105 * Math.max(0, Math.cos(p + 0.5)) ** 1.2];
  };
  const arm = (p: number) => {
    const a = 48 * Math.sin(p);
    return [a, a + 88];
  };
  const [rh, rk] = leg(ph);
  const [lh, lk] = leg(ph + Math.PI);
  const [rs, re] = arm(ph + Math.PI);
  const [ls, le] = arm(ph);
  return { t: 16 + 2 * Math.cos(2 * ph), ls, le, rs, re, lh, lk, rh, rk };
}
// Ground covered per radian of cycle phase at scale 1, so planted feet don't slide.
export const walkRate = (amp = 1) => (2 * L.leg * 2 * Math.sin(24 * amp * D)) / Math.PI;
export const RUN_RATE = 72;
// Both feet off the ground mid-stride.
export const runAir = (ph: number) => 14 * Math.max(0, -Math.cos(2 * ph));

const ease = Easing.inOut(Easing.cubic);
export const mix = (a: Pose, b: Pose, k: number): Pose => {
  const e = ease(Math.max(0, Math.min(1, k)));
  return Object.fromEntries(Object.keys(a).map((n) => [n, a[n as keyof Pose] * (1 - e) + b[n as keyof Pose] * e])) as Pose;
};

const LIMB = 24;
function joints(pose: Pose, front: boolean, headDown: number, hands?: [Pt, Pt]) {
  const hip: Pt = [0, 0];
  const sh = go(hip, 180 - pose.t, L.torso);
  const head = go(sh, 180 - pose.t - headDown, L.neck);
  const w = front ? 26 : 0;
  const arm = (s0: Pt, a: number, b: number, hand: Pt | undefined, bend: number) => {
    const e = hand ? ik(s0, hand, bend) : go(s0, a, L.arm);
    return [s0, e, hand ?? go(e, b, L.arm)];
  };
  // Feet point forward (side view) or outward (front view); a tilted shin tips the foot, as at toe-off.
  const leg = (h0: Pt, a: number, b: number, side: number) => {
    const k = go(h0, a, L.leg);
    const ank = go(k, b, L.leg);
    return [h0, k, ank, go(ank, b + 90 * (front ? side : 1), front ? 14 : 24)];
  };
  return {
    sh,
    head,
    // Facing the camera, both arms open outward (a pose's forward/back angles become sideways), so raised arms make a V.
    armL: arm([sh[0] - w, sh[1]], front ? -Math.abs(pose.ls) : pose.ls, front ? -Math.abs(pose.le) : pose.le, hands?.[0], front ? -1 : 1),
    armR: arm([sh[0] + w, sh[1]], front ? Math.abs(pose.rs) : pose.rs, front ? Math.abs(pose.re) : pose.re, hands?.[1], 1),
    legL: leg([-w * 0.6, 0], pose.lh, pose.lk, -1),
    legR: leg([w * 0.6, 0], pose.rh, pose.rk, 1),
  };
}

// A figure with its hip at (x, y), or standing on `ground` (its lowest foot touches it; `air` lifts it).
// `hands` (local units, hip at 0,0) overrides the arm angles via IK; `trail` draws fading earlier poses as a motion smear.
// Three views: side (default, facing +x; flip faces -x), `front` (facing the camera), `back` (walking away from it).
export function Figure({ x, y = 0, ground, air = 0, s = 1, pose, hands, front = false, back: away = false, flip = false, color = "#ececec", headDown = 0, glow = true, trail = [] }: {
  x: number; y?: number; ground?: number; air?: number; s?: number; pose: Pose; hands?: [Pt, Pt]; front?: boolean; back?: boolean; flip?: boolean; color?: string; headDown?: number; glow?: boolean; trail?: Pose[];
}) {
  const facing = front || away; // front and back share the symmetric (shoulders-wide) skeleton
  const j = joints(pose, facing, headDown, hands);
  const lowest = Math.max(j.legL[2][1], j.legL[3][1], j.legR[2][1], j.legR[3][1]) + LIMB / 2;
  const hy = ground !== undefined ? ground - lowest * s - air : y;
  const back = facing ? color : "#a9a9a9";
  // Rubber-hose limbs: one smooth curve, no visible elbow or knee. The control point makes the curve pass through the
  // skeleton's joint, so IK hands and planted feet land exactly where they did.
  const limb = ([a, k, e, toe]: Pt[], c: string) => {
    const ctl = [2 * k[0] - (a[0] + e[0]) / 2, 2 * k[1] - (a[1] + e[1]) / 2];
    return <path d={`M ${a.join(" ")} Q ${ctl.join(" ")} ${e.join(" ")}${toe ? ` L ${toe.join(" ")}` : ""}`} fill="none" stroke={c} strokeWidth={LIMB} strokeLinecap="round" strokeLinejoin="round" />;
  };
  // Body and hood are drawn upright in their own frame (up = -y), then rotated to the torso / neck direction.
  const deg = (v: Pt) => (Math.atan2(v[0], -v[1]) * 180) / Math.PI;
  const len = Math.hypot(j.sh[0], j.sh[1]) || 1;
  return (
    <>
      {ground !== undefined && <ellipse cx={x} cy={ground + 6} rx={70 * s} ry={11 * s} fill="#fff" opacity={0.12 * Math.max(0, 1 - air / 80)} />}
      <g transform={`translate(${x} ${hy}) scale(${flip ? -s : s} ${s})`} filter={glow ? "url(#glow)" : undefined}>
        {trail.map((tp, i) => {
          const g = joints(tp, facing, headDown, hands);
          return (
            <g key={i} opacity={0.2 / (i + 1)}>
              {limb(g.armL, back)}
              {limb(g.legL, back)}
              {limb(g.legR, color)}
              {limb(g.armR, color)}
            </g>
          );
        })}
        {limb(j.armL, back)}
        {limb(j.legL, back)}
        {/* Hoodie body, drawn upright in the torso's frame. Lit from the front: the far side is shaded. */}
        <g transform={`rotate(${deg(j.sh)})`}>
          <Hoodie len={len} view={front ? "front" : away ? "back" : "side"} color={color} />
        </g>
        {/* Hood up. Front: dark face opening, two glowing eyes. Side: the opening on the forward edge, one eye.
            Back: no face, just the hood's centre seam. */}
        <g transform={`translate(${j.head[0]} ${j.head[1]}) rotate(${deg([j.head[0] - j.sh[0], j.head[1] - j.sh[1]])})`}>
          <Hood view={front ? "front" : away ? "back" : "side"} color={color} />
        </g>
        {limb(j.legR, color)}
        {limb(j.armR, color)}
      </g>
    </>
  );
}

// The hoodie and hood are flat, rounded shapes with soft shading (the far side and the back darker, a highlight on
// top) so they read as solid in every view and stay consistent when the figure is flipped.
type View = "side" | "front" | "back";
const shade = (d: string, o: number) => <path d={d} fill="#000" opacity={o} />;

function Hoodie({ len, view, color }: { len: number; view: View; color: string }) {
  const top = -len - 22; // rises into the hood so no gap opens when the head turns
  if (view === "side") {
    const body = `M -28 ${top} H 24 Q 40 ${top} 40 ${top + 18} L 38 2 Q 38 14 26 14 H -28 Q -40 14 -40 2 L -38 ${top + 18} Q -38 ${top} -28 ${top} Z`;
    return (
      <>
        <path d={body} fill={color} />
        {shade(`M -28 ${top} H -20 Q -26 ${top + 10} -26 ${top + 22} L -26 14 Q -40 14 -40 2 L -38 ${top + 18} Q -38 ${top} -28 ${top} Z`, 0.12)}
        <path d={`M 38 -46 Q 20 -42 18 -8`} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={4} strokeLinecap="round" />
        <line x1={-39} y1={-2} x2={38} y2={-2} stroke="#000" strokeOpacity={0.22} strokeWidth={4} />
      </>
    );
  }
  const body = `M -40 ${top} H 40 Q 52 ${top} 52 ${top + 16} L 46 2 Q 46 14 34 14 H -34 Q -46 14 -46 2 L -52 ${top + 16} Q -52 ${top} -40 ${top} Z`;
  return (
    <>
      <path d={body} fill={color} />
      {shade(`M 32 ${top} H 40 Q 52 ${top} 52 ${top + 16} L 46 2 Q 46 14 34 14 H 28 Q 34 0 34 -30 L 32 ${top} Z`, 0.16)}
      <line x1={-45} y1={-2} x2={45} y2={-2} stroke="#000" strokeOpacity={0.22} strokeWidth={4} />
      {view === "front" && <path d={`M -30 -44 H 30 L 36 -4 H -36 Z`} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={4} strokeLinejoin="round" />}
      {view === "front" && [-12, 12].map((x) => <line key={x} x1={x} y1={-len - 8} x2={x * 1.2} y2={-len + 30} stroke="#000" strokeOpacity={0.32} strokeWidth={4} strokeLinecap="round" />)}
    </>
  );
}

function Hood({ view, color }: { view: View; color: string }) {
  if (view === "side") {
    const face = "M 55 -40 Q 24 -42 20 -8 Q 22 26 55 28 Z";
    return (
      <>
        <path d="M 54 34 L 55 -26 Q 55 -60 20 -61 L -16 -61 Q -58 -59 -58 -16 L -58 24 Q -58 48 -30 48 L 42 48 Q 54 48 54 34 Z" fill={color} />
        {shade("M -16 -61 L -8 -61 Q -40 -52 -42 -12 L -42 24 Q -42 42 -22 48 L -30 48 Q -58 48 -58 24 L -58 -16 Q -58 -59 -16 -61 Z", 0.12)}
        <path d="M -12 -55 Q 18 -59 40 -52" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={5} strokeLinecap="round" />
        <path d={face} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={12} strokeLinejoin="round" />
        <path d={face} fill="#050505" />
        <rect x={33} y={-10} width={14} height={10} rx={5} fill="#fff" filter="url(#eyeglow)" />
      </>
    );
  }
  const outer = "M -48 46 Q -58 46 -58 34 L -58 -22 Q -58 -60 -20 -62 Q 0 -70 20 -62 Q 58 -60 58 -22 L 58 34 Q 58 46 48 46 Z";
  const face = "M -16 -38 H 16 Q 38 -38 38 -16 V 12 Q 38 34 16 34 H -16 Q -38 34 -38 12 V -16 Q -38 -38 -16 -38 Z";
  return (
    <>
      <path d={outer} fill={color} />
      {shade("M 40 -57 Q 58 -50 58 -22 L 58 34 Q 58 46 48 46 L 40 46 Q 46 20 46 -10 Q 46 -40 40 -57 Z", 0.16)}
      <path d="M -36 -56 Q -18 -64 0 -66" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={5} strokeLinecap="round" />
      {view === "front" ? (
        <>
          <path d={face} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={12} />
          <path d={face} fill="#050505" />
          {[-14, 14].map((ex) => <rect key={ex} x={ex - 7} y={-8} width={14} height={10} rx={5} fill="#fff" filter="url(#eyeglow)" />)}
        </>
      ) : (
        <path d="M 0 -66 V 0" stroke="#000" strokeOpacity={0.28} strokeWidth={4} strokeLinecap="round" />
      )}
    </>
  );
}

// Set per scene by MonoFrame: mirrors the drawing (never the HTML text over it) so repeated scenes don't look identical.
export const Mirror = createContext(false);
// Set by MonoFrame for every camera move: the inverse of the camera transform, so screen labels (stamps,
// counters) stay pinned in place while the picture moves under them instead of riding up into the captions.
export const Pin = createContext<string | undefined>(undefined);
function Pinned({ children }: { children: React.ReactNode }) {
  const pin = useContext(Pin);
  const { W, H } = useContext(Canvas);
  return pin ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: pin, transformOrigin: "0 0" }}>{children}</div> : <>{children}</>;
}

// Every scene's SVG carries the glow filter (the references are lit, not flat).
export function Scene({ children }: { children: React.ReactNode }) {
  const mirror = useContext(Mirror);
  const { W, H } = useContext(Canvas);
  return (
    <svg width={W} height={H} style={{ position: "absolute" }}>
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={10} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* The hood's eyes glow even on unlit (crowd) figures. */}
        <filter id="eyeglow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation={5} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={mirror ? `translate(${W} 0) scale(-1 1)` : undefined}>{children}</g>
    </svg>
  );
}

export function Bill({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity={0.85}>
      <rect x={-50} y={-24} width={100} height={48} rx={6} fill="#9a9a9a" stroke="#eee" strokeWidth={4} />
      <circle r={12} fill="none" stroke="#eee" strokeWidth={4} />
    </g>
  );
}

export type Stat = { label: string; to: number; from?: number; prefix?: string };

// "NET WORTH $63,930": counts up over most of the scene.
export function StatCounter({ stat, t, dur, y }: { stat: Stat; t: Theme; dur: number; y: number }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [4, Math.max(10, dur * 0.8)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const from = stat.from ?? 0;
  const text = `${stat.prefix ?? ""}${Math.round(from + (stat.to - from) * k).toLocaleString("en-US")}`;
  const size = Math.min(150, 900 / (Math.max(text.length, 4) * 0.62));
  return (
    <Pinned>
    <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center", opacity: useIn(0, 8) }}>
      <div style={{ font: `700 34px ${font.display}`, letterSpacing: 8, color: t.muted }}>{stat.label.toUpperCase()}</div>
      <div style={{ font: `700 ${size}px/1.05 ${font.display}`, color: "#fff", textShadow: "0 0 30px rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{text}</div>
    </div>
    </Pinned>
  );
}

// The ground line plus a floor plane: lines fan out from the horizon toward the viewer and fade, for depth.
export const Ground = ({ y, dash = 0, offset = 0 }: { y: number; dash?: number; offset?: number }) => {
  const { W } = useContext(Canvas);
  return (
  <>
    {Array.from({ length: 13 }, (_, k) => (
      <line key={k} x1={W / 2 + (k - 6) * 40} y1={y} x2={W / 2 + (k - 6) * 420} y2={y + 460} stroke="#fff" strokeOpacity={0.07} strokeWidth={2} />
    ))}
    {[50, 130, 250].map((d, k) => <line key={`h${d}`} x1={0} y1={y + d} x2={W} y2={y + d} stroke="#fff" strokeOpacity={0.06 - k * 0.015} strokeWidth={2} />)}
    <line x1={0} y1={y} x2={W} y2={y} stroke="#cfcfcf" strokeWidth={4} strokeDasharray={dash ? `${dash} ${dash * 0.6}` : undefined} strokeDashoffset={offset} />
  </>
  );
};

// Grey strangers walk past; the lit one sits alone in the ring (and maybe gets up).
export function Crowd({ p, t, dur }: VisualProps<{ ending?: "alone" | "stands" }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 160;
  const rows = [0.55, 0.7, 0.88];
  const walkers = Array.from({ length: 9 }, (_, i) => ({ row: i % 3, dir: i % 2 ? -1 : 1, x0: (i * 331) % (W + 400), speed: 2.2 + (i % 4) * 0.5 }));
  const drawWalker = (w: (typeof walkers)[number], i: number) => {
    const sc = rows[w.row];
    const x = ((((w.x0 + w.dir * w.speed * f) % (W + 400)) + W + 400) % (W + 400)) - 200;
    const c = ["#4a4a4a", "#5e5e5e", "#747474"][w.row];
    const g = gy - 120 + w.row * 70;
    return (
      <g key={i}>
        <Figure x={x} ground={g} s={sc} pose={{ ...walk((w.speed * f) / (walkRate() * sc) + i, 1), rs: 70, re: 120 }} flip={w.dir < 0} color={c} glow={false} headDown={25} />
        {/* every stranger is lit by a phone, not looking up */}
        <rect x={x + w.dir * 70 * sc - 9 * sc} y={g - 360 * sc} width={18 * sc} height={28 * sc} rx={3} fill="#fff" opacity={0.75} />
      </g>
    );
  };
  const up = p.ending === "stands" ? interpolate(f, [dur * 0.55, dur * 0.75], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const pose = mix(SIT, STAND, up);

  return (
    <Scene>
      <defs>
        <linearGradient id="crowdcone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.22} />
        </linearGradient>
      </defs>
      <polygon points={`${s.cx - 30},${s.top - 300} ${s.cx + 30},${s.top - 300} ${s.cx + 260},${gy + 40} ${s.cx - 260},${gy + 40}`} fill="url(#crowdcone)" />
      <ellipse cx={s.cx} cy={gy} rx={470} ry={120} fill="none" stroke="#9a9a9a" strokeWidth={3} opacity={0.7} />
      {walkers.map(drawWalker)}
      <Figure x={s.cx} ground={gy + 40} s={1.15} pose={pose} headDown={35 * (1 - up)} />
    </Scene>
  );
}

// Pull-ups on a wireframe rock, one rep every 1.2 s.
export function PullUp({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const barY = s.top + 150;
  const base = s.bottom - 60;
  const k = (1 - Math.cos((f / 36) * Math.PI * 2)) / 2;
  const sc = 1.15;
  const lift = 280 - 110 * k;
  const hipY = barY + lift * sc;
  const sway = Math.sin(f / 9) * 3;
  const rock: Pt[] = [[s.cx - 380, base + 40], [s.cx - 250, base - 40], [s.cx - 90, base - 70], [s.cx + 80, base - 60], [s.cx + 260, base - 35], [s.cx + 390, base + 40], [s.cx - 160, base + 20], [s.cx + 20, base + 10], [s.cx + 190, base + 25]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [6, 7], [7, 8], [8, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8]];
  return (
    <>
      <Scene>
        {edges.map(([a, b], i) => <line key={i} x1={rock[a][0]} y1={rock[a][1]} x2={rock[b][0]} y2={rock[b][1]} stroke="#cfcfcf" strokeWidth={2} />)}
        {[-1, 1].map((d) => <line key={d} x1={s.cx + d * 210} y1={barY - 10} x2={s.cx + d * 210} y2={base - 50} stroke="#e0e0e0" strokeWidth={6} />)}
        <line x1={s.cx - 230} y1={barY} x2={s.cx + 230} y2={barY} stroke="#f2f2f2" strokeWidth={10} strokeLinecap="round" />
        <Figure x={s.cx} y={hipY} s={sc} front pose={{ ...STAND, lh: -3 + sway, lk: -3 + sway, rh: 3 + sway, rk: 3 + sway }} hands={[[-80, -lift], [80, -lift]]} />
        {[-1, 1].map((d) =>
          [0, 1, 2, 3].map((j) => {
            const age = ((f + 18 + j * 3) % 36) / 36; // released as the chin clears the bar
            return <circle key={`${d}${j}`} cx={s.cx + d * (92 + j * 14 + age * 40)} cy={barY + 10 + age * 160 + j * 8} r={4 + age * 10} fill="#fff" opacity={0.3 * (1 - age)} />;
          }),
        )}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

export function Stamp({ text, t, y }: { text: string; t: Theme; y: number }) {
  const k = useIn(4, 10);
  return (
    <Pinned>
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: k, transform: `scale(${1.3 - 0.3 * k})` }}>
      <div style={{ font: `400 56px ${font.impact}`, color: "#fff", border: "4px solid #fff", borderRadius: 12, padding: "4px 26px", letterSpacing: 2, boxShadow: "0 0 30px rgba(255,255,255,0.35)" }}>{text.toUpperCase()}</div>
    </div>
    </Pinned>
  );
}

// At the desk, editing late: timeline blocks scroll, coffee cups pile up, money ticks up.
export function Grind({ p, t, dur }: VisualProps<{ stat?: Stat }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 20;
  const desk = gy - 230;
  const mon = { x: 430, y: desk - 360, w: 560, h: 330 };
  const hipX = 250, hipY = gy - 102;
  const tap = (i: number) => Math.sin(f * 1.3 + i * 2) * 8;
  const handL: Pt = [(mon.x + 40 - hipX) / 1.05, (desk - 20 - hipY + tap(0)) / 1.05];
  const handR: Pt = [(mon.x + 120 - hipX) / 1.05, (desk - 22 - hipY + tap(1)) / 1.05];
  const cups = Math.min(3, 1 + Math.floor(f / 40));
  const play = mon.x + 40 + ((f * 4) % (mon.w - 80));
  return (
    <>
      <Scene>
        {/* the city asleep through the window behind; a pendant lamp lighting the desk */}
        <rect x={70} y={s.top + 230} width={300} height={340} rx={8} fill="#060606" stroke="#666" strokeWidth={4} />
        <line x1={220} y1={s.top + 230} x2={220} y2={s.top + 570} stroke="#666" strokeWidth={3} />
        <circle cx={300} cy={s.top + 290} r={26} fill="#ddd" opacity={0.7} />
        {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={90 + k * 55} y={s.top + 570 - 60 - ((k * 47) % 130)} width={40} height={60 + ((k * 47) % 130)} fill="#151515" stroke="#444" strokeWidth={2} />)}
        <line x1={mon.x + mon.w / 2} y1={s.top + 220} x2={mon.x + mon.w / 2} y2={mon.y - 90} stroke="#999" strokeWidth={4} />
        <path d={`M ${mon.x + mon.w / 2 - 30} ${mon.y - 90} h 60 l 30 40 h -120 z`} fill="#ddd" filter="url(#glow)" />
        <polygon points={`${mon.x + mon.w / 2 - 60},${mon.y - 50} ${mon.x + mon.w / 2 + 60},${mon.y - 50} ${mon.x + mon.w + 60},${desk} ${mon.x - 60},${desk}`} fill="#fff" opacity={0.06} />
        {[0, 1, 2].map((k) => {
          const u = ((f + k * 20) % 60) / 60;
          return <path key={k} d={`M ${mon.x + 606 + Math.sin(u * 6 + k) * 8} ${desk - 70 - (cups - 1) * 64 - u * 110} q 10 -14 0 -28`} fill="none" stroke="#fff" strokeOpacity={0.35 * (1 - u)} strokeWidth={4} strokeLinecap="round" />;
        })}
        <line x1={hipX - 60} y1={hipY + 34} x2={hipX + 50} y2={hipY + 34} stroke="#cfcfcf" strokeWidth={8} />
        <line x1={hipX - 5} y1={hipY + 34} x2={hipX - 5} y2={gy} stroke="#cfcfcf" strokeWidth={8} />
        <rect x={mon.x - 40} y={desk} width={700} height={18} fill="none" stroke="#f2f2f2" strokeWidth={5} />
        {[mon.x - 10, mon.x + 630].map((x) => <line key={x} x1={x} y1={desk + 18} x2={x} y2={gy} stroke="#cfcfcf" strokeWidth={5} />)}
        <line x1={mon.x + mon.w / 2} y1={mon.y + mon.h} x2={mon.x + mon.w / 2} y2={desk} stroke="#cfcfcf" strokeWidth={14} />
        <rect x={mon.x} y={mon.y} width={mon.w} height={mon.h} rx={22} fill="#050505" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        <rect x={mon.x + 120} y={mon.y + 30} width={mon.w - 240} height={130} fill="#2a2a2a" />
        <circle cx={mon.x + mon.w / 2} cy={mon.y + 95} r={28} fill="#fff" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => {
            const bw = 70 + ((r * 3 + c * 7) % 4) * 25;
            const x = mon.x + 30 + ((c * 150 + r * 55 - f * (2 + r)) % (mon.w - 60) + mon.w - 60) % (mon.w - 60);
            return <rect key={`${r}${c}`} x={x} y={mon.y + 185 + r * 42} width={Math.min(bw, mon.x + mon.w - 30 - x)} height={28} fill={c % 2 ? "#8a8a8a" : "#e6e6e6"} />;
          }),
        )}
        <line x1={play} y1={mon.y + 175} x2={play} y2={mon.y + 310} stroke="#fff" strokeWidth={4} />
        {Array.from({ length: cups }, (_, i) => (
          <path key={i} d={`M ${mon.x + 590} ${desk - 6 - i * 64} l -8 -56 h 52 l -8 56 z`} fill="#eee" opacity={0.9} />
        ))}
        <Figure x={hipX} y={hipY} s={1.05} pose={{ t: 10 + Math.sin(f / 20) * 2, ls: 0, le: 0, rs: 0, re: 0, lh: 88, lk: 0, rh: 90, rk: 2 }} hands={[handL, handR]} />
        {[0, 1].map((i) => {
          const u = ((f + i * 45) % 90) / 90;
          return <Bill key={i} x={960 - i * 60 + u * 60} y={desk - 120 - u * 380} r={f * (3 + i) + i * 50} />;
        })}
      </Scene>
      {p.stat && <StatCounter stat={p.stat} t={t} dur={dur} y={s.top} />}
    </>
  );
}

// Walking through the rain past a glowing milestone pole; bills fall near the light.
export function RainWalk({ p, t, dur }: VisualProps<{ sign?: string; stat?: Stat }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const pole = 300;
  const x = interpolate(f, [0, dur], [860, 560]);
  return (
    <>
      <Scene>
        <defs>
          <linearGradient id="beam" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.5" stopColor="#fff" stopOpacity={0.35} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: 70 }, (_, i) => {
          const rx = (i * 157) % W;
          const ry = ((i * 241 + f * 38) % (gy - s.top + 300)) + s.top - 250;
          return <line key={i} x1={rx} y1={ry} x2={rx - 6} y2={ry + 34} stroke="#fff" strokeOpacity={0.25} strokeWidth={2} />;
        })}
        <path d={`M 40 ${gy} V ${gy - 300} L ${pole} ${gy - 420} M 40 ${gy - 300} H ${pole}`} fill="none" stroke="#e6e6e6" strokeWidth={5} />
        {[0, 1].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={80 + c * 95} y={gy - 260 + r * 110} width={70} height={70} fill="#6a6a6a" />))}
        <rect x={pole - 80} y={s.top} width={160} height={gy - s.top} fill="url(#beam)" />
        <line x1={pole} y1={s.top + 60} x2={pole} y2={gy + 40} stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        {[0, 1, 2].map((i) => {
          const u = ((f + i * 30) % 90) / 90;
          return <Bill key={i} x={pole - 120 + i * 50 + Math.sin(f / 10 + i) * 30} y={s.top + 120 + u * (gy - s.top - 200)} r={f * 4 + i * 70} s={0.8} />;
        })}
        <Ground y={gy} dash={40} />
        {Array.from({ length: 7 }, (_, i) => {
          const u = ((f + i * 13) % 40) / 40;
          return <ellipse key={i} cx={(i * 173 + 60) % W} cy={gy + 30 + (i % 3) * 40} rx={10 + u * 60} ry={(10 + u * 60) * 0.22} fill="none" stroke="#fff" strokeOpacity={0.3 * (1 - u)} strokeWidth={2} />;
        })}
        {(() => {
          const ph = (860 - x) / walkRate(0.8);
          const step = ((ph / Math.PI) % 1 + 1) % 1; // a foot lands every half cycle
          return step < 0.25 && [-1, 1].map((d) => <line key={d} x1={x + d * 20} y1={gy - 2} x2={x + d * (40 + step * 120)} y2={gy - 30 + step * 60} stroke="#fff" strokeOpacity={0.5 * (1 - step * 4)} strokeWidth={3} strokeLinecap="round" />);
        })()}
        <Figure x={x} ground={gy} s={1} pose={walk((860 - x) / walkRate(0.8), 0.8)} flip headDown={20} />
      </Scene>
      {p.sign && (
        <div style={{ position: "absolute", left: pole - 130, width: 260, top: s.top + (p.stat ? 240 : 10), display: "flex", justifyContent: "center" }}>
          <div style={{ font: `700 40px ${font.display}`, color: "#ddd", border: "4px solid #ddd", borderRadius: 10, padding: "4px 16px", background: "#111", whiteSpace: "nowrap" }}>{p.sign.toUpperCase()}</div>
        </div>
      )}
      {p.stat && <StatCounter stat={p.stat} t={t} dur={dur} y={s.top} />}
    </>
  );
}

// Climbing labeled steps; arms up at the top.
export function Climb({ p, t, dur }: VisualProps<{ steps: string[] }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = p.steps.length;
  const gy = s.bottom - 20;
  const w = s.width / n;
  const h = Math.min(150, (s.height - 480) / n);
  const u = interpolate(f, [8, dur * 0.8], [0, n - 0.5], clamp);
  const i = Math.min(n - 1, Math.floor(u));
  const rise = interpolate(u - i, [0.6, 1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const feet = gy - h * (i + 1 + (i < n - 1 ? rise : 0));
  const done = interpolate(u, [n - 0.8, n - 0.5], [0, 1], clamp);
  return (
    <>
      <Scene>
        {p.steps.map((_, k) => (
          <rect key={k} x={s.left + k * w} y={gy - h * (k + 1)} width={w} height={h * (k + 1)} fill="#0c0c0c" stroke="#eaeaea" strokeWidth={5} />
        ))}
        <line x1={s.left + n * w - 40} y1={gy - h * n} x2={s.left + n * w - 40} y2={gy - h * n - 150} stroke="#fff" strokeWidth={5} />
        <path d={`M ${s.left + n * w - 40} ${gy - h * n - 150} l 70 18 l -70 18 z`} fill="#fff" opacity={0.4 + 0.6 * done} filter={done > 0 ? "url(#glow)" : undefined} />
        {i > 0 && (() => {
          const age = (u - i) * 8;
          return age < 1 && [-1, 1].map((d) => <circle key={d} cx={s.left + i * w + w * 0.3 + d * (20 + age * 50)} cy={gy - h * (i + 1) - 6} r={6 + age * 14} fill="#fff" opacity={0.35 * (1 - age)} />);
        })()}
        <Figure x={s.left + u * w + w * 0.3} ground={feet} s={0.8} pose={mix(walk((u * w) / (walkRate(0.9) * 0.8), 0.9), VICTORY, done)} />
      </Scene>
      {p.steps.map((label, k) => (
        <div key={k} style={{ position: "absolute", left: s.left + k * w, width: w, top: gy - h * (k + 1) + 16, textAlign: "center", font: `400 ${w > 220 ? 44 : 34}px ${font.impact}`, color: k <= i ? "#fff" : "#777", letterSpacing: 1 }}>
          {label.toUpperCase()}
        </div>
      ))}
    </>
  );
}

// Sprinting: the world streams past, the goal sign closes in.
export function Run({ p, t, dur }: VisualProps<{ goal?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const goalX = interpolate(f, [0, dur * 0.45], [W + 80, 640], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <Scene>
        {Array.from({ length: 14 }, (_, i) => {
          const y = s.top + 60 + ((i * 97) % (gy - s.top - 120));
          const x = W - ((i * 233 + f * (28 + (i % 3) * 10)) % (W + 400));
          return <line key={i} x1={x} y1={y} x2={x + 140 + (i % 4) * 60} y2={y} stroke="#fff" strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round" />;
        })}
        <path d={`M ${-((f * 3) % 600)} ${gy - 160} ${Array.from({ length: 6 }, (_, k) => `q 150 ${-120 - (k % 3) * 40} 300 0`).join(" ")} V ${gy} H ${-((f * 3) % 600)} Z`} fill="#0e0e0e" stroke="#333" strokeWidth={3} />
        <Ground y={gy} dash={60} offset={f * 0.32 * RUN_RATE * 1.1} />
        {[0, 1, 2, 3, 4].map((k) => {
          const age = ((f * 0.32 + k * 0.6) % 3) / 3;
          return <circle key={k} cx={300 - age * 260} cy={gy - 10 - age * 40} r={8 + age * 26} fill="#fff" opacity={0.25 * (1 - age)} />;
        })}
        <line x1={goalX} y1={gy} x2={goalX} y2={gy - 420} stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        <Figure x={360} ground={gy} air={runAir(f * 0.32)} s={1.1} pose={run(f * 0.32)} trail={[run(f * 0.32 - 0.25), run(f * 0.32 - 0.5)]} />
      </Scene>
      {p.goal && (
        <div style={{ position: "absolute", left: goalX - 6, top: gy - 420, font: `400 52px ${font.impact}`, color: "#000", background: "#fff", padding: "4px 18px", whiteSpace: "nowrap" }}>{p.goal.toUpperCase()}</div>
      )}
    </>
  );
}

// One giant word slams in and keeps growing; a figure walks past in front of it.
export function BigWord({ p, t, dur }: VisualProps<{ word: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const word = p.word.toUpperCase();
  const size = Math.min(560, 980 / (Math.max(word.length, 2) * 0.5));
  const slam = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const grow = 1 + (0.08 * f) / dur;
  const gy = s.bottom - 40;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: s.cy - size * 0.75, textAlign: "center", font: `400 ${size}px/1.1 ${font.impact}`, color: "transparent", WebkitTextStroke: "4px rgba(255,255,255,0.35)", transform: `translateY(${18 + (1 - slam) * 40}px) scale(${(2.2 - 1.2 * slam) * grow})` }}>
        {word}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: s.cy - size * 0.75, textAlign: "center", font: `400 ${size}px/1.1 ${font.impact}`, color: "#fff", opacity: slam, textShadow: "0 0 40px rgba(255,255,255,0.45)", transform: `scale(${(2.2 - 1.2 * slam) * grow})` }}>
        {word}
      </div>
      <Scene>
        {f < 16 && <circle cx={s.cx} cy={s.cy - size * 0.25} r={60 + f * 55} fill="none" stroke="#fff" strokeWidth={10 - f * 0.6} opacity={1 - f / 16} />}
        <Ground y={gy} />
        <Figure x={interpolate(f, [0, dur], [260, 820])} ground={gy} s={0.85} pose={walk((560 * f) / dur / (walkRate(0.9) * 0.85), 0.9)} />
      </Scene>
    </>
  );
}

// You vs them: one scrolls in bed, the other runs.
export function Split({ p, t }: VisualProps<{ left: string; right: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const bed = gy - 70;
  const lie: Pose = { t: 90, ls: 150, le: 200, rs: 160, re: 210, lh: -90, lk: -90, rh: -95, rk: -95 };
  const glow = 0.6 + 0.4 * Math.sin(f / 4);
  const label = (text: string, x: number, on: boolean) => (
    <div style={{ position: "absolute", left: x - 230, width: 460, top: s.top + 40, textAlign: "center", font: `400 92px ${font.impact}`, color: on ? "#fff" : "#6a6a6a", textShadow: on ? "0 0 30px rgba(255,255,255,0.5)" : "none" }}>{text.toUpperCase()}</div>
  );
  return (
    <>
      <Scene>
        <circle cx={140} cy={s.top + 200} r={40} fill="#bbb" opacity={0.5} />
        <circle cx={160} cy={s.top + 190} r={36} fill="#000" opacity={0.85} />
        <circle cx={(3 * W) / 4} cy={gy} r={150} fill="#fff" opacity={0.18} />
        {Array.from({ length: 9 }, (_, k) => {
          const a = (-80 + k * 20 + Math.sin(f / 30) * 4) * D;
          return <line key={k} x1={(3 * W) / 4} y1={gy} x2={(3 * W) / 4 + Math.sin(a) * 600} y2={gy - Math.cos(a) * 600} stroke="#fff" strokeOpacity={0.08} strokeWidth={22} />;
        })}
        <line x1={W / 2} y1={s.top} x2={W / 2} y2={s.bottom} stroke="#fff" strokeWidth={4} filter="url(#glow)" />
        <rect x={50} y={bed} width={420} height={40} fill="none" stroke="#777" strokeWidth={4} />
        <line x1={60} y1={bed + 40} x2={60} y2={gy} stroke="#777" strokeWidth={4} />
        <line x1={460} y1={bed + 40} x2={460} y2={gy} stroke="#777" strokeWidth={4} />
        <Figure x={170} y={bed - 32} s={0.75} pose={lie} hands={[[150, -90], [160, -100]]} color="#8a8a8a" glow={false} />
        <rect x={278} y={bed - 150} width={26} height={44} rx={5} fill="#fff" opacity={glow} filter="url(#glow)" />
        <Ground y={gy} dash={40} offset={f * 0.32 * RUN_RATE * 0.8} />
        <Figure x={810} ground={gy} air={runAir(f * 0.32) * 0.8} s={0.8} pose={run(f * 0.32)} trail={[run(f * 0.32 - 0.25)]} />
      </Scene>
      {label(p.left, W / 4, false)}
      {label(p.right, (3 * W) / 4, true)}
    </>
  );
}

// Deadlift, front view: one rep every 1.6 s, dust when the plates hit the floor.
export function Lift({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const floor = s.bottom - 40;
  const sc = 1.1;
  const k = (1 + Math.cos((f / 48) * Math.PI * 2)) / 2; // 1 = bar on the floor
  const strain = (1 - k) * Math.sin(f * 2.2) * 2;
  const hipY = floor - 90 - 8 * sc - (HIP - 10 - 95 * k) * sc;
  const barY = hipY + 8 * sc;
  const dust = interpolate(f % 48, [0, 14], [0, 1], clamp);
  const pose: Pose = { ...STAND, lh: -4 - 30 * k, lk: -4 + 30 * k, rh: 4 + 30 * k, rk: 4 - 30 * k };
  return (
    <>
      <Scene>
        <line x1={0} y1={floor} x2={W} y2={floor} stroke="#cfcfcf" strokeWidth={4} />
        {f % 48 < 14 && [-1, 1].map((d) => [0, 1, 2].map((j) => <circle key={`${d}${j}`} cx={s.cx + d * (330 + dust * 90 + j * 30)} cy={floor - 10 - j * 14} r={8 + dust * 22} fill="#fff" opacity={0.35 * (1 - dust)} />))}
        <Figure x={s.cx + strain} y={hipY} s={sc} front pose={pose} hands={[[-120, 8], [120, 8]]} />
        <path d={`M ${s.cx - 420} ${barY + 26 * (1 - k)} Q ${s.cx} ${barY - 26 * (1 - k)} ${s.cx + 420} ${barY + 26 * (1 - k)}`} fill="none" stroke="#f2f2f2" strokeWidth={14} strokeLinecap="round" />
        {[-1, 1].map((d) => (
          <g key={d}>
            <rect x={s.cx + d * 330 - 22} y={barY - 90 + 20 * (1 - k)} width={44} height={180} rx={10} fill="#d0d0d0" stroke="#fff" strokeWidth={4} />
            <rect x={s.cx + d * 380 - 16} y={barY - 70 + 24 * (1 - k)} width={32} height={140} rx={8} fill="#9a9a9a" stroke="#fff" strokeWidth={4} />
          </g>
        ))}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Heavy bag work: jab, cross, the bag swings; contact every 18 frames at frame 6 (sfxCues matches this).
export function Boxing({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  // Jab / cross alternate; the fist snaps out (ease-in) and recoils slower, the hips turn into it.
  const poseAt = (fr: number): Pose => {
    const ph = ((fr % 18) + 18) % 18;
    const ext = ph < 6 ? Easing.in(Easing.quad)(ph / 6) : interpolate(ph, [6, 14], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
    const right = Math.floor(fr / 18) % 2 === 0;
    const arm = (on: boolean) => (on ? { s: 25 + 63 * ext, e: 150 - 60 * ext } : { s: 25, e: 150 });
    const [a, b] = [arm(!right), arm(right)];
    return { t: 12 + 6 * ext, ls: a.s, le: a.e, rs: b.s, re: b.e, lh: -18, lk: -8 - 4 * ext, rh: 22, rk: 8 };
  };
  const ph = f % 18;
  const swing = 7 * Math.max(0, Math.sin((Math.PI * ((f - 6 + 18) % 18)) / 18));
  const bagTop = s.top + 200;
  const bob = 3 + Math.sin(f / 5) * 3; // bouncing on the toes
  return (
    <>
      <Scene>
        {[0, 1, 2].map((r) => <line key={r} x1={0} y1={gy - 260 - r * 110} x2={W} y2={gy - 260 - r * 110 + 10} stroke="#555" strokeWidth={6} />)}
        {[60, W - 60].map((x) => <rect key={x} x={x - 14} y={gy - 520} width={28} height={520} fill="#222" stroke="#666" strokeWidth={3} />)}
        <Ground y={gy} />
        {ph >= 6 && ph < 14 && [0, 1, 2, 3, 4, 5].map((j) => {
          const age = (ph - 6) / 8;
          return <circle key={j} cx={740 + age * (60 + j * 25)} cy={gy - 480 + j * 30 - age * 50 + age * age * 80} r={5} fill="#fff" opacity={0.7 * (1 - age)} />;
        })}
        <g transform={`rotate(${swing} 660 ${bagTop})`}>
          <line x1={660} y1={bagTop} x2={660} y2={bagTop + 160} stroke="#bbb" strokeWidth={6} />
          <rect x={580} y={bagTop + 160} width={160} height={420} rx={60} fill="#cfcfcf" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
        </g>
        {ph >= 6 && ph < 9 && [0, 1, 2, 3, 4].map((j) => <line key={j} x1={604} y1={gy - 470 + j * 18} x2={640 + j * 10} y2={gy - 500 + j * 30} stroke="#fff" strokeWidth={5} strokeLinecap="round" />)}
        <Figure x={420} ground={gy} air={bob} s={1} pose={poseAt(f)} trail={ph > 2 && ph < 8 ? [poseAt(f - 1), poseAt(f - 2)] : []} headDown={10} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Knocked flat (lands at frame 14, sfxCues matches this), stays down, then gets back up into the light.
export function Fall({ t, dur }: VisualProps<Record<string, never>>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 80;
  const LIE: Pose = { t: -90, ls: -150, le: -130, rs: -40, re: -20, lh: 88, lk: 92, rh: 92, rk: 95 };
  const KNEEL: Pose = { t: 8, ls: 40, le: 60, rs: 20, re: 30, lh: 88, lk: 0, rh: 0, rk: -90 };
  const fall = interpolate(f, [8, 14], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const kneel = interpolate(f, [dur * 0.45, dur * 0.62], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const stand = interpolate(f, [dur * 0.66, dur * 0.82], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pose = stand > 0 ? mix(KNEEL, STAND, stand) : kneel > 0 ? mix(LIE, KNEEL, kneel) : mix(STAND, LIE, fall);
  const hipLie = gy - 45, hipKneel = gy - 13 - L.leg, hipStand = gy - HIP;
  const hipY = stand > 0 ? hipKneel + (hipStand - hipKneel) * stand : kneel > 0 ? hipLie + (hipKneel - hipLie) * kneel : hipStand + (hipLie - hipStand) * fall;
  const dust = interpolate(f, [14, 30], [0, 1], clamp);
  return (
    <Scene>
      <defs>
        <radialGradient id="rise">
          <stop offset="0" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={s.cx} cy={gy - 200} rx={420} ry={520} fill="url(#rise)" opacity={stand} />
      <Ground y={gy} />
      {f >= 14 && [-1, 1].map((d) => <path key={`c${d}`} d={`M ${s.cx - 40} ${gy} l ${d * 40} 18 l ${d * 30} -6 l ${d * 50} 24 M ${s.cx - 40 + d * 70} ${gy + 12} l ${d * 10} 30`} fill="none" stroke="#fff" strokeOpacity={0.5 * Math.min(1, (f - 14) / 4) * (1 - stand)} strokeWidth={3} />)}
      {f >= 14 && f < 30 && [-1, 1].map((d) => <circle key={d} cx={s.cx - 40 + d * (60 + dust * 160)} cy={gy - 14} r={10 + dust * 26} fill="#fff" opacity={0.4 * (1 - dust)} />)}
      <Figure x={s.cx - (stand > 0 || kneel > 0 ? 0 : 40 * fall)} y={hipY} s={1.05} pose={pose} headDown={kneel > 0 && stand === 0 ? 25 : 0} />
    </Scene>
  );
}

// Climb to the peak, plant the flag; the camera follows up the slope.
export function Summit({ p, t, dur }: VisualProps<{ flag?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const base: Pt = [s.left - 40, s.bottom + 60];
  const peak: Pt = [s.cx + 140, s.top + 330];
  const u = interpolate(f, [0, dur * 0.65], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const pole = interpolate(f, [dur * 0.68, dur * 0.8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const lift = 160 * (1 - u);
  const x = base[0] + (peak[0] - base[0]) * u;
  const y = base[1] + (peak[1] - base[1]) * u;
  const wave = Math.sin(f / 4) * 10;
  return (
    <>
      <Scene>
        <g transform={`translate(0 ${lift})`}>
          {[0, 1, 2].map((i) => <ellipse key={i} cx={((i * 380 + f * (1 + i * 0.5)) % (W + 400)) - 200} cy={s.top + 120 + i * 90} rx={140} ry={26} fill="#fff" opacity={0.12} />)}
          <path d={`M -40 ${s.top + 620} L 180 ${s.top + 380} L 330 ${s.top + 520} L 520 ${s.top + 300} L 760 ${s.top + 560} L 960 ${s.top + 420} L ${W + 40} ${s.top + 560} V ${H} H -40 Z`} fill="#070707" stroke="#3a3a3a" strokeWidth={3} />
          {Array.from({ length: 26 }, (_, k) => {
            const x = (((k * 97 - f * (9 + (k % 4) * 3)) % (W + 200)) + W + 200) % (W + 200) - 100;
            return <circle key={k} cx={x} cy={peak[1] - 200 + ((k * 61) % 380) + Math.sin(f / 8 + k) * 12} r={2 + (k % 3)} fill="#fff" opacity={0.5} />;
          })}
          <path d={`M ${base[0] - 80} ${base[1]} L ${peak[0]} ${peak[1]} L ${W + 60} ${s.bottom - 160} L ${W + 60} ${H} L ${base[0] - 80} ${H} Z`} fill="#0b0b0b" stroke="#eaeaea" strokeWidth={5} strokeLinejoin="round" />
          <path d={`M ${peak[0] - 110} ${peak[1] + 120} L ${peak[0]} ${peak[1]} L ${peak[0] + 90} ${peak[1] + 100}`} fill="none" stroke="#fff" strokeWidth={4} opacity={0.6} />
          {pole > 0 && (
            <g transform={`translate(${peak[0] + 30} ${peak[1]}) scale(1 ${pole})`}>
              <line x1={0} y1={0} x2={0} y2={-260} stroke="#fff" strokeWidth={6} />
              <path d={`M 0 -260 q 90 ${-20 + wave} 180 0 v 90 q -90 ${-20 - wave} -180 0 z`} fill="#fff" filter="url(#glow)" />
            </g>
          )}
          <Figure x={x} ground={y} s={0.8} pose={u < 1 ? { ...walk((u * Math.hypot(peak[0] - base[0], peak[1] - base[1])) / (walkRate() * 0.8), 1), t: 18 } : mix(STAND, VICTORY, pole)} />
        </g>
      </Scene>
      {p.flag && pole > 0.6 && (
        <div style={{ position: "absolute", left: peak[0] + 40, width: 170, top: peak[1] + lift - 240, textAlign: "center", font: `400 40px ${font.impact}`, color: "#000" }}>{p.flag.toUpperCase()}</div>
      )}
    </>
  );
}

// Time is running out: the hands spin, the figure keeps walking.
export function Clock({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.top + 370];
  const r = 250;
  const gy = s.bottom - 40;
  const hand = (deg: number, len: number, w: number) => <line x1={c[0]} y1={c[1]} x2={c[0] + Math.sin(deg * D) * len} y2={c[1] - Math.cos(deg * D) * len} stroke="#fff" strokeWidth={w} strokeLinecap="round" />;
  return (
    <>
      <Scene>
        <circle cx={c[0]} cy={c[1]} r={r} fill="#060606" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        {Array.from({ length: 12 }, (_, i) => {
          const [a, b] = [go(c, 180 - i * 30, r - 20), go(c, 180 - i * 30, r - (i % 3 ? 45 : 70))];
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ddd" strokeWidth={i % 3 ? 5 : 10} />;
        })}
        {[12, 3, 6, 9].map((n, k) => {
          const q = go(c, 180 - k * 90, r - 110);
          return <text key={n} x={q[0]} y={q[1] + 22} textAnchor="middle" fontSize={64} fontFamily={font.impact} fill="#bbb">{n}</text>;
        })}
        <line x1={c[0]} y1={c[1] + r} x2={c[0] + Math.sin(Math.sin(f / 10) * 0.35) * 260} y2={c[1] + r + Math.cos(Math.sin(f / 10) * 0.35) * 260} stroke="#999" strokeWidth={5} />
        <circle cx={c[0] + Math.sin(Math.sin(f / 10) * 0.35) * 260} cy={c[1] + r + Math.cos(Math.sin(f / 10) * 0.35) * 260} r={26} fill="#ddd" />
        {hand(f * 2, 150, 14)}
        {hand(f * 24, 230, 8)}
        {hand(Math.floor(f / 5) * 30, 240, 3)}
        <circle cx={c[0]} cy={c[1]} r={14} fill="#fff" />
        <Ground y={gy} dash={40} offset={f * 0.2 * walkRate(0.9) * 0.75} />
        <Figure x={s.cx} ground={gy} s={0.75} pose={walk(f * 0.2, 0.9)} headDown={15} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// ---------- object scenes: money, plans, roads, screens (so a video isn't all workouts) ----------

export const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

// A line graph draws itself; a tiny figure walks along its tip. "comeback" dips hard, then rockets.
export function Chart({ p, t, dur }: VisualProps<{ label?: string; trend?: "up" | "down" | "comeback" }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x0 = s.left + 60, x1 = s.right - 30;
  const y0 = s.bottom - 60, y1 = s.top + (p.label ? 290 : 220);
  const trend = p.trend ?? "up";
  const N = 10;
  const shape = (u: number) => (trend === "down" ? 0.9 - 0.8 * u : trend === "comeback" ? (u < 0.45 ? 0.55 - 1.1 * u : 0.05 + 1.7 * (u - 0.45)) : 0.1 + 0.8 * u);
  const v = (i: number) => Math.min(0.97, Math.max(0.03, shape(i / (N - 1)) + (i && i < N - 1 ? (i % 2 ? 0.06 : -0.04) : 0)));
  const pts: Pt[] = Array.from({ length: N }, (_, i) => [x0 + ((x1 - x0) * i) / (N - 1), y0 - (y0 - y1) * v(i)]);
  const k = interpolate(f, [4, dur * 0.75], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pos = k * (N - 1);
  const i = Math.min(N - 2, Math.floor(pos));
  const tip = lerp(pts[i], pts[i + 1], pos - i);
  const shown = [...pts.slice(0, i + 1), tip];
  const line = shown.map((q) => q.join(",")).join(" ");
  return (
    <>
      <Scene>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={x0} y1={y0 - (y0 - y1) * g} x2={x1} y2={y0 - (y0 - y1) * g} stroke="#fff" strokeOpacity={0.1} strokeWidth={2} />)}
        <polyline points={`${x0},${y1 - 40} ${x0},${y0} ${x1 + 10},${y0}`} fill="none" stroke="#cfcfcf" strokeWidth={5} />
        {/* Unlabelled ticks: the chart is used for views, days and weight as well as money. */}
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={`t${g}`} x1={x0 - 22} y1={y0 - (y0 - y1) * g} x2={x0} y2={y0 - (y0 - y1) * g} stroke="#666" strokeWidth={4} />)}
        <line x1={x0} y1={y1 + 30} x2={x1} y2={y1 + 30} stroke="#fff" strokeOpacity={0.45} strokeWidth={3} strokeDasharray="14 12" />
        <text x={x1} y={y1 + 14} textAnchor="end" fontSize={30} fontFamily={font.impact} fill="#999" letterSpacing={3}>GOAL</text>
        <polygon points={`${line} ${tip[0]},${y0} ${x0},${y0}`} fill="#fff" opacity={0.08} />
        <polyline points={line} fill="none" stroke="#fff" strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" />
        <circle cx={tip[0]} cy={tip[1]} r={16} fill="#fff" filter="url(#glow)" />
        {[0, 1, 2, 3].map((k) => {
          const a = (k * 90 + f * 6) * D;
          const r = 30 + 10 * Math.sin(f / 3 + k);
          return <line key={`s${k}`} x1={tip[0] + Math.cos(a) * r} y1={tip[1] + Math.sin(a) * r} x2={tip[0] + Math.cos(a) * (r + 18)} y2={tip[1] + Math.sin(a) * (r + 18)} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.7} />;
        })}
        <Figure x={tip[0]} ground={tip[1] - 12} s={0.42} pose={walk((tip[0] - x0) / (walkRate() * 0.42))} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Bills drop one by one onto a growing stack; the figure keeps feeding it.
export function Cash({ p, t, dur }: VisualProps<{ stat?: Stat }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 30;
  const max = 13;
  const every = Math.max(4, Math.floor((dur * 0.8) / max));
  const n = Math.min(max, Math.floor(f / every) + 1);
  const bh = 44, cx = 690;
  const drop = n < max ? interpolate(f % every, [0, 5], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
  const reach = Math.sin((f / every) * Math.PI * 2);
  return (
    <>
      <Scene>
        {!p.stat && [0, 1, 2, 3].map((i) => {
          const u = ((f + i * 24) % 96) / 96;
          return <Bill key={i} x={120 + i * 260 + Math.sin(f / 12 + i) * 30} y={s.top + u * 420} r={f * 3 + i * 80} s={0.7} />;
        })}
        <Ground y={gy} />
        {Array.from({ length: n }, (_, k) => {
          const y = gy - (k + 1) * bh - (k === n - 1 ? drop * 260 : 0);
          return (
            <g key={k} transform={`translate(${cx + ((k * 37) % 23) - 11} ${y})`} filter={k === n - 1 ? "url(#glow)" : undefined}>
              <rect x={-150} y={0} width={300} height={bh - 4} rx={6} fill="#7a7a7a" stroke="#eee" strokeWidth={4} />
              <rect x={-128} y={7} width={256} height={bh - 18} fill="none" stroke="#ddd" strokeWidth={2} opacity={0.6} />
              <circle cx={0} cy={(bh - 4) / 2} r={11} fill="none" stroke="#eee" strokeWidth={4} />
              {k % 3 === 1 && <rect x={-22} y={-2} width={44} height={bh} fill="#e6e6e6" opacity={0.6} />}
              {k === n - 1 && drop === 0 && <rect x={-150 + ((f * 30) % 360)} y={2} width={40} height={bh - 8} fill="#fff" opacity={0.5} transform="skewX(-20)" />}
            </g>
          );
        })}
        <Figure x={370} ground={gy} s={0.95} pose={{ ...STAND, rs: 95 + 25 * reach, re: 110 + 25 * reach, ls: 80 + 15 * reach, le: 100 }} />
      </Scene>
      {p.stat && <StatCounter stat={p.stat} t={t} dur={dur} y={s.top} />}
    </>
  );
}

// A whiteboard checklist; each box is ticked the moment its item is spoken (saidAt, which sfxCues pops on).
export function Plan({ p, t, dur, w = [] }: VisualProps<{ items: string[] }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = p.items.length;
  const row = 130;
  const bx = s.left + 10, bw = s.width - 20, by = s.top + 20, bh = n * row + 70;
  const gy = s.bottom - 20;
  const said = saidAt(p.items, w, 0, dur / 30).map((sec) => sec * 30);
  const done = (k: number) => interpolate(f, [said[k], said[k] + 5], [0, 1], clamp);
  const point = Math.sin(f / 6) * 8;
  return (
    <>
      <Scene>
        {[bx + 90, bx + bw - 90].map((x) => <line key={x} x1={x} y1={by + bh} x2={x + (x < s.cx ? -40 : 40)} y2={gy} stroke="#cfcfcf" strokeWidth={6} />)}
        <rect x={bx} y={by} width={bw} height={bh} rx={16} fill="#0a0a0a" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        {p.items.map((_, k) => {
          const y = by + 35 + k * row;
          return (
            <g key={k}>
              <rect x={bx + 40} y={y} width={76} height={76} rx={10} fill="none" stroke={done(k) > 0 ? "#fff" : "#777"} strokeWidth={6} />
              <path d={`M ${bx + 54} ${y + 40} l 18 22 l 34 -50`} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={100} strokeDashoffset={100 * (1 - done(k))} filter="url(#glow)" />
            </g>
          );
        })}
        <Ground y={gy} />
        <Figure x={bx + bw - 140} ground={gy} s={0.8} flip pose={{ ...STAND, rs: 145 + point, re: 160 + point }} />
        {(() => {
          const hand = go(go([bx + bw - 140, gy - HIP * 0.8 - L.torso * 0.8], -(145 + point), L.arm * 0.8), -(160 + point), L.arm * 0.8);
          return <line x1={hand[0]} y1={hand[1]} x2={hand[0] - 26} y2={hand[1] - 40} stroke="#fff" strokeWidth={14} strokeLinecap="round" />;
        })()}
        {[0, 1].map((k) => <line key={`x${k}`} x1={bx + bw - 230} y1={by + bh - 50 - k * 34} x2={bx + bw - 40} y2={by + bh - 60 - k * 34} stroke="#555" strokeWidth={4} />)}
      </Scene>
      {p.items.map((label, k) => (
        <div key={k} style={{ position: "absolute", left: bx + 150, right: W - bx - bw + 30, top: by + 35 + k * row, height: 76, display: "flex", alignItems: "center", font: `400 60px ${font.impact}`, color: done(k) > 0.5 ? "#fff" : "#777", whiteSpace: "nowrap", overflow: "hidden" }}>
          {label.toUpperCase()}
        </div>
      ))}
    </>
  );
}

// Driving at night under street lights; a highway sign slides past slowly enough to read.
export function Car({ p, t, dur }: VisualProps<{ sign?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 140;
  const speed = 30;
  const cx = 460;
  const bob = Math.sin(f / 3) * 2;
  const signX = interpolate(f, [0, dur * 0.35, dur * 0.75, dur], [W + 60, 640, 560, 100]);
  const spin = (f * speed) / 52;
  return (
    <>
      <Scene>
        <defs>
          <linearGradient id="headlight" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.45} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lampcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, k) => {
          const bw = 140 + ((k * 53) % 90), bh2 = 180 + ((k * 137) % 260);
          const x = ((((k * 190 - f * 4) % 1710) + 1710) % 1710) - 300;
          return <rect key={`b${k}`} x={x} y={gy - 120 - bh2} width={bw} height={bh2} fill="#0b0b0b" stroke="#2c2c2c" strokeWidth={3} />;
        })}
        {[0, 1, 2, 3].map((k) => {
          const age = ((f + k * 6) % 24) / 24;
          return <circle key={`e${k}`} cx={cx - 250 - age * 160} cy={gy - 60 - age * 30} r={10 + age * 26} fill="#fff" opacity={0.2 * (1 - age)} />;
        })}
        {[0, 1, 2, 3].map((k) => {
          const x = ((((k * 420 - f * speed) % 1680) + 1680) % 1680) - 200;
          return (
            <g key={k}>
              <path d={`M ${x + 70} ${gy - 540} L ${x - 60} ${gy} L ${x + 200} ${gy} Z`} fill="url(#lampcone)" />
              <path d={`M ${x} ${gy} V ${gy - 560} H ${x + 70}`} fill="none" stroke="#9a9a9a" strokeWidth={6} />
              <circle cx={x + 70} cy={gy - 548} r={12} fill="#fff" filter="url(#glow)" />
            </g>
          );
        })}
        {p.sign && (
          <g>
            {[60, 320].map((d) => <line key={d} x1={signX + d} y1={gy - 430} x2={signX + d} y2={gy} stroke="#bbb" strokeWidth={8} />)}
            <rect x={signX} y={gy - 560} width={380} height={130} rx={12} fill="#111" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
          </g>
        )}
        <Ground y={gy} />
        <line x1={0} y1={gy + 70} x2={W} y2={gy + 70} stroke="#fff" strokeOpacity={0.5} strokeWidth={8} strokeDasharray="90 70" strokeDashoffset={f * speed} />
        <g transform={`translate(${cx} ${gy - 52 + bob})`}>
          <polygon points="250,-60 760,-150 760,60" fill="url(#headlight)" />
          <path d="M -230 0 L -230 -80 Q -225 -100 -190 -105 L -110 -110 L -50 -185 L 110 -185 L 170 -115 L 230 -105 Q 250 -100 250 -60 L 250 0 Z" fill="#0d0d0d" stroke="#f2f2f2" strokeWidth={6} strokeLinejoin="round" filter="url(#glow)" />
          <path d="M -30 -172 L 102 -172 L 150 -118 L -30 -118 Z M -95 -118 L -48 -172 L -45 -118 Z" fill="#2a2a2a" />
          <circle cx={40} cy={-142} r={22} fill="#ececec" />
          {[-140, 150].map((wx) => (
            <g key={wx} transform={`translate(${wx} 0) rotate(${(spin * 180) / Math.PI})`}>
              <circle r={52} fill="#000" stroke="#fff" strokeWidth={6} />
              {[0, 60, 120].map((a) => <line key={a} x1={-34 * Math.cos(a * D)} y1={-34 * Math.sin(a * D)} x2={34 * Math.cos(a * D)} y2={34 * Math.sin(a * D)} stroke="#bbb" strokeWidth={5} />)}
            </g>
          ))}
        </g>
      </Scene>
      {p.sign && (
        <div style={{ position: "absolute", left: signX, width: 380, top: gy - 560, height: 130, display: "flex", alignItems: "center", justifyContent: "center", font: `400 50px ${font.impact}`, color: "#fff", whiteSpace: "nowrap" }}>{p.sign.toUpperCase()}</div>
      )}
    </>
  );
}

// A giant phone; a thumb flicks an endless feed upward.
export function Phone({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pw = 540, ph = 980, px = s.cx - pw / 2, py = s.top + 20;
  const sx = px + 24, sy = py + 70, sw = pw - 48, sh = ph - 140;
  const scroll = f * 14;
  const u = (f % 14) / 14;
  const tip: Pt = [px + pw - 110, py + ph - 200 - 280 * Easing.out(Easing.quad)(u)];
  return (
    <>
      <Scene>
        <defs>
          <clipPath id="phonescreen">
            <rect x={sx} y={sy} width={sw} height={sh} rx={20} />
          </clipPath>
        </defs>
        <g clipPath="url(#phonescreen)">
          {Array.from({ length: 6 }, (_, k) => {
            const y = sy + ((((k * 330 - scroll) % 1980) + 1980) % 1980) - 330;
            return (
              <g key={k}>
                <rect x={sx + 20} y={y} width={sw - 40} height={300} rx={18} fill="#141414" stroke="#555" strokeWidth={3} />
                <rect x={sx + 40} y={y + 20} width={sw - 80} height={170} rx={10} fill={k % 2 ? "#5a5a5a" : "#3a3a3a"} />
                <rect x={sx + 40} y={y + 210} width={(sw - 80) * 0.8} height={22} rx={11} fill="#777" />
                <rect x={sx + 40} y={y + 250} width={(sw - 80) * 0.5} height={22} rx={11} fill="#555" />
              </g>
            );
          })}
        </g>
        {[0, 1].map((k) => {
          const age = ((f + k * 30) % 60) / 60;
          const y = sy + 10 + Math.min(1, age * 5) * 40 - Math.max(0, age - 0.8) * 300;
          return (
            <g key={`n${k}`} opacity={age < 0.85 ? 1 : 0}>
              <rect x={sx + 16} y={y + k * 0} width={sw - 32} height={64} rx={20} fill="#e6e6e6" />
              <circle cx={sx + 52} cy={y + 32} r={16} fill="#555" />
              <rect x={sx + 82} y={y + 18} width={(sw - 150) * (k ? 0.6 : 0.8)} height={12} rx={6} fill="#777" />
              <rect x={sx + 82} y={y + 38} width={(sw - 150) * 0.45} height={10} rx={5} fill="#aaa" />
            </g>
          );
        })}
        {[0, 1, 2].map((k) => {
          const age = ((f + k * 17) % 50) / 50;
          const hx = px + pw + 40 + Math.sin(age * 6 + k) * 30, hy = py + ph * 0.6 - age * 520;
          return <path key={`h${k}`} d={`M ${hx} ${hy + 14} l -22 -22 a 12 12 0 0 1 22 -12 a 12 12 0 0 1 22 12 z`} fill="#fff" opacity={0.8 * (1 - age)} />;
        })}
        <rect x={px} y={py} width={pw} height={ph} rx={70} fill="none" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        <rect x={s.cx - 70} y={py + 24} width={140} height={26} rx={13} fill="#fff" opacity={0.8} />
        <line x1={px + pw + 170} y1={s.bottom + 260} x2={tip[0]} y2={tip[1]} stroke="#ececec" strokeWidth={70} strokeLinecap="round" opacity={1 - 0.5 * u} filter="url(#glow)" />
      </Scene>
      {p.label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: sy + 20, display: "flex", justifyContent: "center", opacity: useIn(4, 10) }}>
          <div style={{ font: `400 52px ${font.impact}`, color: "#fff", background: "#000", border: "4px solid #fff", borderRadius: 12, padding: "4px 22px" }}>{p.label.toUpperCase()}</div>
        </div>
      )}
    </>
  );
}

// A month fills with X's day by day; without a label the header counts the days.
export function Calendar({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const cw = 860, x0 = s.cx - cw / 2, y0 = s.top + 40, head = 120, cell = cw / 7, rh = 100;
  const count = interpolate(f, [6, dur * 0.85], [0, 31], clamp);
  const gy = s.bottom - 20;
  return (
    <>
      <Scene>
        <rect x={x0} y={y0} width={cw} height={head + 5 * rh + 20} rx={16} fill="#0a0a0a" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        <rect x={x0} y={y0} width={cw} height={head} rx={16} fill="#fff" />
        {[0, 1, 2].map((k) => {
          const age = ((f + k * 14) % 42) / 42;
          return <rect key={`p${k}`} x={x0 + cw - 220 + age * 300} y={y0 + 20 - age * 220 + Math.sin(age * 9 + k) * 30} width={160} height={110} rx={6} fill="#ddd" opacity={0.7 * (1 - age)} transform={`rotate(${age * 160 + k * 40} ${x0 + cw - 140 + age * 300} ${y0 + 75 - age * 220})`} />;
        })}
        {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={x0 + 90 + k * 136} y={y0 - 30} width={18} height={56} rx={9} fill="#ccc" />)}
        {Array.from({ length: 31 }, (_, k) => {
          const x = x0 + (k % 7) * cell, y = y0 + head + 10 + Math.floor(k / 7) * rh;
          const pr = Math.max(0, Math.min(1, count - k));
          return (
            <g key={k}>
              <text x={x + 14} y={y + 34} fontSize={28} fontFamily={font.display} fill={pr > 0 ? "#555" : "#999"}>{k + 1}</text>
              {pr > 0 && [[x + 22, y + 18, x + cell - 22, y + rh - 14], [x + cell - 22, y + 18, x + 22, y + rh - 14]].map(([a, b, c, d], j) => (
                <line key={j} x1={a} y1={b} x2={c} y2={d} stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeDasharray={110} strokeDashoffset={110 * (1 - Math.min(1, pr * 2 - j))} />
              ))}
            </g>
          );
        })}
        <Ground y={gy} dash={40} offset={f * 0.2 * walkRate(0.9) * 0.6} />
        <Figure x={s.cx} ground={gy} s={0.6} pose={walk(f * 0.2, 0.9)} />
      </Scene>
      <div style={{ position: "absolute", left: x0, width: cw, top: y0, height: head, display: "flex", alignItems: "center", justifyContent: "center", font: `400 72px ${font.impact}`, color: "#000" }}>
        {(p.label ?? `DAY ${Math.max(1, Math.ceil(count))}`).toUpperCase()}
      </div>
    </>
  );
}

// A door swings open, light floods out, and a silhouette walks into it.
export function Door({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const dw = 340, dh = 560, dx = s.cx - dw / 2, floor = s.bottom - 300, dy = floor - dh;
  const open = interpolate(f, [4, Math.max(14, dur * 0.3)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const w = interpolate(f, [dur * 0.3, dur], [0, 1], clamp);
  const panel = dw * (1 - open * 0.85);
  return (
    <>
      <Scene>
        <defs>
          <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.5} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={0} y1={floor} x2={W} y2={floor} stroke="#fff" strokeOpacity={0.25} strokeWidth={3} />
        <polygon points={`${dx},${floor} ${dx + dw},${floor} ${s.cx + 460},${s.bottom + 60} ${s.cx - 460},${s.bottom + 60}`} fill="url(#spill)" opacity={open * 0.7} />
        <rect x={dx} y={dy} width={dw} height={dh} fill="#fff" opacity={open} filter="url(#glow)" />
        <polygon points={`${dx},${dy} ${dx + panel},${dy - 40 * open} ${dx + panel},${floor + 40 * open} ${dx},${floor}`} fill="#111" stroke="#ddd" strokeWidth={4} />
        <circle cx={dx + panel - 28} cy={dy + dh / 2} r={9} fill="#ddd" />
        <rect x={dx} y={dy} width={dw} height={dh} fill="none" stroke="#fff" strokeWidth={8} />
        {open > 0.3 && Array.from({ length: 18 }, (_, k) => (
          <circle key={k} cx={s.cx - 300 + ((k * 157 + f * (0.6 + (k % 3) * 0.3)) % 600)} cy={floor + 20 + ((k * 89 + f * 0.8) % 360)} r={2 + (k % 3)} fill="#fff" opacity={0.5 * open} />
        ))}
        <ellipse cx={s.cx} cy={(s.bottom - 20 + (floor - s.bottom + 20) * w) + 60 * (1.05 - 0.6 * w)} rx={36 * (1.05 - 0.6 * w)} ry={140 * (1.05 - 0.6 * w)} fill="#000" opacity={0.55 * open} />
        <Figure x={s.cx} ground={s.bottom - 20 + (floor - s.bottom + 20) * w} s={1.05 - 0.6 * w} back pose={walk(f * 0.22, 0.35)} color="#050505" glow={false} />
      </Scene>
      {p.label && open > 0.5 && <Stamp text={p.label} t={t} y={dy - 110} />}
    </>
  );
}

// A wall rises brick by brick while the figure keeps laying them.
export function Bricks({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 30;
  const bw = 150, bh = 72, cols = 5, rows = 7, wx = s.left + 30;
  const count = interpolate(f, [4, dur * 0.85], [0, cols * rows], clamp);
  const lay = Math.sin(f / 5);
  return (
    <>
      <Scene>
        <Ground y={gy} />
        {Array.from({ length: cols * rows }, (_, k) => {
          const pr = Math.max(0, Math.min(1, count - k));
          if (pr <= 0) return null;
          const r = Math.floor(k / cols);
          const x = wx + (k % cols) * bw + (r % 2 ? bw / 2 : 0);
          const y = gy - (r + 1) * bh - (1 - Easing.out(Easing.cubic)(pr)) * 120;
          const set = count - k - 1; // 0..1 just after this brick lands
          return (
            <g key={k}>
              <rect x={x + 3} y={y + 3} width={bw - 6} height={bh - 6} rx={6} fill={pr < 1 ? "#fff" : "#1a1a1a"} stroke="#eee" strokeWidth={4} opacity={pr} filter={pr < 1 ? "url(#glow)" : undefined} />
              {pr < 1 && <line x1={x + 20} y1={y + 24} x2={x + bw - 40} y2={y + 24} stroke="#000" strokeOpacity={0.25} strokeWidth={4} />}
              {set > 0 && set < 1 && [-1, 1].map((d) => <circle key={d} cx={x + bw / 2 + d * (bw / 2 + set * 30)} cy={y + bh - 6} r={5 + set * 12} fill="#fff" opacity={0.4 * (1 - set)} />)}
            </g>
          );
        })}
        <Figure x={985} ground={gy} s={0.7} flip pose={{ ...STAND, rs: 80 + 25 * lay, re: 95 + 25 * lay, ls: 70 + 20 * lay, le: 90 }} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// ---------- more object scenes: people, traffic, time, growth ----------

const CAR_BODY = "M -230 0 L -230 -80 Q -225 -100 -190 -105 L -110 -110 L -50 -185 L 110 -185 L 170 -115 L 230 -105 Q 250 -100 250 -60 L 250 0 Z";
// A side-view car with its wheel centres at (x, y), facing right; brake 0..1 lights the tail light.
function Auto({ x, y, s = 1, spin = 0, brake = 0 }: { x: number; y: number; s?: number; spin?: number; brake?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={CAR_BODY} fill="#0d0d0d" stroke="#d8d8d8" strokeWidth={6} strokeLinejoin="round" />
      <path d="M -30 -172 L 102 -172 L 150 -118 L -30 -118 Z M -95 -118 L -48 -172 L -45 -118 Z" fill="#2a2a2a" />
      {brake > 0 && <rect x={-242} y={-84} width={16} height={28} rx={4} fill="#fff" opacity={brake} filter="url(#glow)" />}
      {[-140, 150].map((wx) => (
        <g key={wx} transform={`translate(${wx} 0) rotate(${spin})`}>
          <circle r={52} fill="#000" stroke="#ddd" strokeWidth={6} />
          <line x1={-34} y1={0} x2={34} y2={0} stroke="#999" strokeWidth={5} />
        </g>
      ))}
    </g>
  );
}

// Three lanes of stuck cars, brake lights pulsing; you run past all of them.
export function Traffic({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 20;
  const lanes = [{ y: s.top + 400, sc: 0.5 }, { y: s.top + 640, sc: 0.68 }, { y: s.top + 890, sc: 0.85 }];
  const x = interpolate(f, [0, dur], [90, 990]);
  return (
    <>
      <Scene>
        {lanes.map((l, li) => {
          const gap = 540 * l.sc;
          const n = Math.ceil(W / gap) + 2;
          return (
            <g key={li}>
              <line x1={0} y1={l.y + 56 * l.sc} x2={W} y2={l.y + 56 * l.sc} stroke="#fff" strokeOpacity={0.15} strokeWidth={3} />
              {Array.from({ length: n }, (_, k) => (
                <Auto key={k} x={((k * gap + li * 170 + f * 0.4) % (n * gap)) - gap / 2} y={l.y + Math.sin(f * 1.5 + k + li) * 1.2} s={l.sc} brake={0.55 + 0.45 * Math.sin(f / 6 + k * 2 + li)} />
              ))}
            </g>
          );
        })}
        <line x1={W - 140} y1={s.top - 40} x2={W - 140} y2={s.top + 120} stroke="#888" strokeWidth={8} />
        <rect x={W - 185} y={s.top + 120} width={90} height={230} rx={18} fill="#111" stroke="#bbb" strokeWidth={5} />
        {[0, 1, 2].map((k) => <circle key={k} cx={W - 140} cy={s.top + 165 + k * 70} r={26} fill={k === 0 ? "#fff" : "#2a2a2a"} filter={k === 0 ? "url(#glow)" : undefined} opacity={k === 0 ? 0.75 + 0.25 * Math.sin(f / 5) : 1} />)}
        {[0, 1, 2].map((k) => {
          const age = ((f + k * 23) % 46) / 46;
          const l = lanes[k % 3];
          return <text key={`h${k}`} x={160 + k * 300} y={l.y - 220 * l.sc - age * 40} fontSize={70 * l.sc} fontFamily={font.impact} fill="#fff" opacity={age < 0.5 ? 0.8 : 0}>!!</text>;
        })}
        <Ground y={gy} dash={30} />
        <Figure x={x} ground={gy} air={runAir((x - 90) / (RUN_RATE * 0.6)) * 0.6} s={0.6} pose={run((x - 90) / (RUN_RATE * 0.6))} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Rush hour: rows of grey people stream left; one lit figure walks the other way.
export function Rush({ t, dur }: VisualProps<Record<string, never>>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const rows = [{ g: gy - 330, sc: 0.38, c: "#3a3a3a", n: 10, v: 3 }, { g: gy - 190, sc: 0.5, c: "#555", n: 8, v: 3.8 }, { g: gy - 30, sc: 0.65, c: "#6e6e6e", n: 7, v: 4.6 }];
  const row = (r: (typeof rows)[number], ri: number) =>
    Array.from({ length: r.n }, (_, i) => {
      const span = W + 300;
      const x = ((((i * span) / r.n + ri * 90 - r.v * f) % span) + span) % span - 150;
      return <Figure key={`${ri}-${i}`} x={x} ground={r.g} s={r.sc} pose={walk((r.v * f) / (walkRate() * r.sc) + i)} flip color={r.c} glow={false} />;
    });
  const hx = interpolate(f, [0, dur], [360, 700]);
  return (
    <Scene>
      {Array.from({ length: 7 }, (_, k) => {
        const bw = 130 + ((k * 61) % 80), bh = 380 + ((k * 211) % 420);
        return (
          <g key={`t${k}`}>
            <rect x={k * 160 - 20} y={gy - 360 - bh} width={bw} height={bh} fill="#0a0a0a" stroke="#262626" strokeWidth={3} />
            {Array.from({ length: 10 }, (_, j) => ((k + j) % 3 ? null : <rect key={j} x={k * 160 + (j % 3) * 36} y={gy - 330 - bh + Math.floor(j / 3) * 70} width={18} height={30} fill="#333" />))}
          </g>
        );
      })}
      <ellipse cx={hx} cy={gy - 230} rx={130} ry={200} fill="#fff" opacity={0.07} />
      {row(rows[0], 0)}
      {row(rows[1], 1)}
      <Figure x={hx} ground={gy - 110} s={0.72} pose={walk((hx - 360) / (walkRate() * 0.72))} />
      {row(rows[2], 2)}
    </Scene>
  );
}

// Dominoes, each bigger than the last, fall one into the next (at tickAt; sfxCues lands on each).
export function Dominoes({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 8;
  const hs = Array.from({ length: n }, (_, k) => 80 * 1.3 ** k);
  const total = hs.reduce((a, h, k) => a + h / 5 + (k < n - 1 ? h * 0.55 : 0), 0);
  const sc = Math.min(1, (s.width - 150) / total);
  let x = s.left + 130;
  const dom = hs.map((h0, k) => {
    const h = h0 * sc, w = (h0 / 5) * sc, gap = h0 * 0.55 * sc;
    const rest = k === n - 1 ? 90 : (Math.asin(Math.min(1, gap / h)) * 180) / Math.PI + 8;
    const a = interpolate(f, [tickAt(k, n, dur), tickAt(k, n, dur) + 6], [0, rest], { ...clamp, easing: Easing.in(Easing.quad) });
    const el = (
      <g key={k} transform={`rotate(${a} ${x + w} ${gy})`}>
        <rect x={x} y={gy - h} width={w} height={h} rx={6} fill="#111" stroke="#fff" strokeWidth={5} filter={a > 0 && a < rest ? "url(#glow)" : undefined} />
        {[0.25, 0.7].map((d) => <circle key={d} cx={x + w / 2} cy={gy - h * d} r={w * 0.15} fill="#fff" />)}
      </g>
    );
    const hitF = tickAt(k, n, dur) + 6;
    const age = (f - hitF) / 12;
    const burst = k === n - 1 && age > 0 && age < 1 ? [-1, 1].map((d) => <circle key={`d${k}${d}`} cx={x + w + h * 0.9 + d * age * 90} cy={gy - 10} r={10 + age * 30} fill="#fff" opacity={0.4 * (1 - age)} />) : null;
    x += w + gap;
    return <g key={`g${k}`}>{el}{burst}</g>;
  });
  const poke = interpolate(f, [0, 10], [0, 1], clamp);
  return (
    <>
      <Scene>
        <Ground y={gy} />
        {dom}
        <Figure x={s.left + 40} ground={gy} s={0.45} pose={{ ...STAND, rs: 40 + 50 * poke, re: 60 + 30 * poke }} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Sand runs out.
export function Hourglass({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.top + 520];
  const hh = 380, hw = 260;
  const k = interpolate(f, [0, dur], [0.15, 0.95]);
  const top = (hh - 20) * Math.sqrt(1 - k);
  const pile = 280 * Math.sqrt(k);
  return (
    <>
      <Scene>
        <path d={`M ${c[0] - (hw * top) / hh} ${c[1] - top} L ${c[0] + (hw * top) / hh} ${c[1] - top} L ${c[0]} ${c[1] - 4} Z`} fill="#cfcfcf" />
        <path d={`M ${c[0] - hw + 20} ${c[1] + hh} L ${c[0] + hw - 20} ${c[1] + hh} L ${c[0]} ${c[1] + hh - pile} Z`} fill="#cfcfcf" />
        <line x1={c[0]} y1={c[1]} x2={c[0]} y2={c[1] + hh - pile} stroke="#eee" strokeWidth={6} strokeDasharray="10 8" strokeDashoffset={-f * 6} />
        {Array.from({ length: 6 }, (_, k) => {
          const u = ((f * 1.5 + k * 9) % 40) / 40;
          return <circle key={`g${k}`} cx={c[0] + Math.sin(k * 3 + u * 9) * 10 * u} cy={c[1] + (hh - pile) * u} r={3} fill="#fff" />;
        })}
        <path d={`M ${c[0] - hw + 50} ${c[1] - hh + 40} L ${c[0] - 40} ${c[1] - 40}`} stroke="#fff" strokeOpacity={0.25} strokeWidth={14} strokeLinecap="round" />
        <path d={`M ${c[0] - 40} ${c[1] + 40} L ${c[0] - hw + 50} ${c[1] + hh - 40}`} stroke="#fff" strokeOpacity={0.15} strokeWidth={10} strokeLinecap="round" />
        <path d={`M ${c[0] - hw} ${c[1] - hh} L ${c[0] + hw} ${c[1] - hh} L ${c[0] + 18} ${c[1]} L ${c[0] + hw} ${c[1] + hh} L ${c[0] - hw} ${c[1] + hh} L ${c[0] - 18} ${c[1]} Z`} fill="none" stroke="#fff" strokeWidth={7} strokeLinejoin="round" filter="url(#glow)" />
        {[-1, 1].map((d) => <rect key={d} x={c[0] - hw - 50} y={c[1] + d * hh - 18} width={2 * hw + 100} height={36} rx={10} fill="#e6e6e6" />)}
        {[-1, 1].map((d) => <line key={d} x1={c[0] + d * (hw + 30)} y1={c[1] - hh} x2={c[0] + d * (hw + 30)} y2={c[1] + hh} stroke="#bbb" strokeWidth={10} />)}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A balance: the light thing on the left, the heavy one on the right, and the beam swings to the right.
export function Scale({ p, t, dur }: VisualProps<{ left: string; right: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pv: Pt = [s.cx, s.top + 300];
  const arm = 380, hang = 260, gy = s.bottom - 20;
  const a = interpolate(f, [6, dur * 0.5], [-8, 12], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const end = (d: number): Pt => [pv[0] + d * arm * Math.cos(a * D), pv[1] + d * arm * Math.sin(a * D)];
  const [L0, R0] = [end(-1), end(1)];
  const pan = (q: Pt) => [q[0], q[1] + hang] as Pt;
  const [pl, pr] = [pan(L0), pan(R0)];
  const tag = (text: string, q: Pt, h: number, on: boolean) => (
    <div style={{ position: "absolute", left: q[0] - 200, width: 400, top: q[1] - h - 84, textAlign: "center", font: `400 64px ${font.impact}`, color: on ? "#fff" : "#888", textShadow: on ? "0 0 24px rgba(255,255,255,0.5)" : "none" }}>{text.toUpperCase()}</div>
  );
  return (
    <>
      <Scene>
        <line x1={pv[0]} y1={pv[1]} x2={pv[0]} y2={gy} stroke="#cfcfcf" strokeWidth={14} />
        <path d={`M ${pv[0] - 160} ${gy} L ${pv[0]} ${gy - 70} L ${pv[0] + 160} ${gy} Z`} fill="#111" stroke="#cfcfcf" strokeWidth={5} />
        <line x1={L0[0]} y1={L0[1]} x2={R0[0]} y2={R0[1]} stroke="#fff" strokeWidth={12} strokeLinecap="round" filter="url(#glow)" />
        <circle cx={pv[0]} cy={pv[1]} r={18} fill="#fff" />
        {[[L0, pl], [R0, pr]].map(([q, b], i) => (
          <g key={i}>
            {[-1, 1].map((d) => <line key={d} x1={q[0]} y1={q[1]} x2={b[0] + d * 120} y2={b[1]} stroke="#aaa" strokeWidth={3} />)}
            <path d={`M ${b[0] - 130} ${b[1]} Q ${b[0]} ${b[1] + 70} ${b[0] + 130} ${b[1]} Z`} fill="#111" stroke="#eee" strokeWidth={5} />
          </g>
        ))}
        <rect x={pl[0] - 45} y={pl[1] - 90} width={90} height={90} rx={8} fill="#666" />
        <rect x={pr[0] - 100} y={pr[1] - 170 - interpolate(f, [0, 8], [500, 0], { ...clamp, easing: Easing.in(Easing.quad) })} width={200} height={170} rx={10} fill="#eee" filter="url(#glow)" />
        {f > 8 && f < 22 && <ellipse cx={pr[0]} cy={pr[1]} rx={140 + (f - 8) * 12} ry={30 + (f - 8) * 3} fill="none" stroke="#fff" strokeWidth={4} opacity={1 - (f - 8) / 14} />}
      </Scene>
      {tag(p.left, pl, 90, false)}
      {tag(p.right, pr, 170, true)}
    </>
  );
}

// Countdown shake, ignition, liftoff (at 40%; sfxCues puts the riser's peak there).
export function Rocket({ p, t, dur, hit }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const launch = hit ?? dur * 0.4, ign = launch * 0.6; // lifts off on the line's hit word when it has one
  const u = Math.max(0, f - launch);
  const rise = 0.7 * u * u; // slow enough that it's still climbing through the frame
  const shake = f < launch ? Math.sin(f * 3) * (f / launch) * 5 : 0;
  const flick = Math.sin(f * 1.7) * 25;
  return (
    <>
      <Scene>
        <path d={`M ${s.cx - 230} ${gy} V ${gy - 520} M ${s.cx - 300} ${gy} V ${gy - 520} M ${s.cx - 300} ${gy - 520} H ${s.cx - 230} ${[1, 2, 3, 4, 5].map((k) => `M ${s.cx - 300} ${gy - k * 100} L ${s.cx - 230} ${gy - k * 100 + 100}`).join(" ")}`} fill="none" stroke="#999" strokeWidth={5} />
        {[1, 2, 3, 4, 5].map((k) => <circle key={`l${k}`} cx={s.cx - 265} cy={gy - k * 100} r={9} fill="#fff" opacity={f < launch && Math.floor(f / 6) % 2 === k % 2 ? 1 : 0.15} filter="url(#glow)" />)}
        {Array.from({ length: 40 }, (_, k) => <circle key={`st${k}`} cx={(k * 211) % W} cy={s.top - 200 + ((k * 131) % 700)} r={1.5 + (k % 2)} fill="#fff" opacity={0.35} />)}
        <Ground y={gy} />
        {f > ign && Array.from({ length: 10 }, (_, k) => {
          const age = ((f + k * 3) % 14) / 14;
          return <circle key={`sp${k}`} cx={s.cx + shake + (k - 4.5) * 14 * age * 3} cy={gy - 70 - rise + 40 + age * 220} r={3} fill="#fff" opacity={1 - age} />;
        })}
        <g transform={`translate(${s.cx + shake} ${gy - 70 - rise})`}>
          {f > ign && <path d={`M -45 0 Q 0 ${130 + flick + Math.min(200, u * 6)} 45 0 Z`} fill="#fff" filter="url(#glow)" />}
          <path d="M -70 -120 L -140 20 L -70 0 Z M 70 -120 L 140 20 L 70 0 Z" fill="#cfcfcf" />
          <path d="M -70 0 L -70 -380 Q -70 -470 0 -560 Q 70 -470 70 -380 L 70 0 Z" fill="#0d0d0d" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
          <circle cy={-360} r={32} fill="none" stroke="#fff" strokeWidth={6} />
        </g>
        {Array.from({ length: 16 }, (_, i) => {
          const age = f - ign - i * 2;
          if (age <= 0) return null;
          return <circle key={i} cx={s.cx + (i % 2 ? 1 : -1) * (age * 6 + i * 8)} cy={gy - 20 - age * 0.8} r={30 + age * 2.5} fill="#ddd" opacity={Math.max(0, 0.5 * (1 - age / 60))} />;
        })}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A seed becomes a tree: branches split as it grows, leaves pop at the end.
export function Tree({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 30;
  const g = interpolate(f, [4, dur * 0.85], [0, 1], clamp);
  const lines: React.ReactNode[] = [];
  const leaves: React.ReactNode[] = [];
  const grow = (x: number, y: number, ang: number, len: number, d: number) => {
    const k = Math.max(0, Math.min(1, g * 6 - d));
    if (k <= 0) return;
    const [ex, ey] = [x + Math.sin(ang * D) * len * k, y - Math.cos(ang * D) * len * k];
    lines.push(<line key={lines.length} x1={x} y1={y} x2={ex} y2={ey} stroke="#eaeaea" strokeWidth={(5 - d) * 7} strokeLinecap="round" />);
    if (d === 4) {
      const r = 38 * Math.max(0, Math.min(1, g * 6 - 5));
      if (r > 0) leaves.push(<circle key={leaves.length} cx={ex} cy={ey} r={r} fill="#fff" opacity={0.85} />);
      return;
    }
    if (k < 1) return;
    grow(ex, ey, ang - 28 + (d % 2 ? 6 : -4), len * 0.72, d + 1);
    grow(ex, ey, ang + 26, len * 0.72, d + 1);
  };
  grow(s.cx + 60, gy, 0, 300, 0);
  const roots = [-60, -25, 15, 50].map((a, k) => {
    const r = Math.min(1, g * 3) * (140 + (k % 2) * 60);
    return <path key={`r${k}`} d={`M ${s.cx + 60} ${gy} q ${Math.sin(a * D) * r * 0.5} ${r * 0.4} ${Math.sin(a * D) * r} ${Math.cos(a * D) * r * 0.6}`} fill="none" stroke="#777" strokeWidth={8} strokeLinecap="round" />;
  });
  const fall = g > 0.97 ? [0, 1, 2].map((k) => {
    const age = ((f + k * 20) % 60) / 60;
    return <ellipse key={`f${k}`} cx={s.cx + 60 + (k - 1) * 200 + Math.sin(age * 8 + k) * 40} cy={gy - 600 + age * 560} rx={16} ry={9} fill="#ddd" opacity={0.8 * (1 - age)} transform={`rotate(${age * 300 + k * 60} ${s.cx + 60 + (k - 1) * 200} ${gy - 600 + age * 560})`} />;
  }) : null;
  return (
    <>
      <Scene>
        <Ground y={gy} />
        <ellipse cx={s.cx + 60} cy={gy - 6} rx={16} ry={10} fill="#fff" opacity={g < 0.05 ? 1 : 0} />
        {roots}
        {lines}
        <g filter="url(#glow)">{leaves}</g>
        {fall}
        <Figure x={s.left + 110} ground={gy} s={0.55} pose={STAND} headDown={-10} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Lights off across the whole city except one window, and the camera pushes in on it.
export function Window({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom;
  const bs = [{ x: 60, w: 200, h: 620 }, { x: 280, w: 240, h: 820 }, { x: 540, w: 180, h: 540 }, { x: 740, w: 270, h: 740 }];
  const lit: Pt = [280 + 24 + 60, gy - 820 + 40 + 180];
  const z = interpolate(f, [0, dur], [1, 1.7], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const [lx, ly] = [lit[0] + 17, lit[1] + 25];
  return (
    <>
      <Scene>
        <circle cx={880} cy={s.top + 60} r={60} fill="#ddd" opacity={0.8} filter="url(#glow)" />
        {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={(i * 197) % W} cy={s.top - 100 + ((i * 89) % 260)} r={2.5} fill="#fff" opacity={0.3 + 0.3 * Math.sin(f / 8 + i)} />)}
        <g transform={`translate(${lx} ${ly}) scale(${z}) translate(${-lx} ${-ly})`}>
          {bs.map((b, i) => {
            const top = gy - b.h;
            const cols = Math.floor((b.w - 40) / 60), rows = Math.floor((b.h - 60) / 90);
            return (
              <g key={i}>
                <rect x={b.x} y={top} width={b.w} height={b.h} fill="#0a0a0a" stroke="#cfcfcf" strokeWidth={4} />
                {Array.from({ length: cols * rows }, (_, k) => {
                  // a few windows start lit and switch off, one after another, until only yours is left
                  const off = ((k * 7 + i * 13) % 23) / 23;
                  const on = (k + i) % 5 === 0 && f / dur < off * 0.8;
                  return <rect key={k} x={b.x + 24 + (k % cols) * 60} y={top + 40 + Math.floor(k / cols) * 90} width={34} height={50} fill={on ? "#8a8a8a" : "#1c1c1c"} />;
                })}
              </g>
            );
          })}
          {(() => {
            const cx2 = ((f * 9) % (W + 400)) - 200;
            return <polygon points={`${cx2},${gy - 14} ${cx2 + 220},${gy - 40} ${cx2 + 220},${gy + 10}`} fill="#fff" opacity={0.2} />;
          })()}
          <rect x={lit[0] - 20} y={lit[1] - 20} width={74} height={90} fill="#fff" opacity={0.12} />
          <rect x={lit[0]} y={lit[1]} width={34} height={50} fill="#fff" filter="url(#glow)" />
          <circle cx={lit[0] + 13} cy={lit[1] + 22} r={5} fill="#000" />
          <rect x={lit[0] + 8} y={lit[1] + 28} width={11} height={22} fill="#000" />
          <rect x={lit[0] + 20} y={lit[1] + 34} width={14} height={4} fill="#000" />
        </g>
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// The rat race: running flat out inside a wheel that only spins.
export function Wheel({ p, t }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.top + 520];
  const R = 380, gy = s.bottom - 20;
  const a = f * 5;
  return (
    <>
      <Scene>
        {[-1, 1].map((d) => <line key={d} x1={c[0]} y1={c[1]} x2={c[0] + d * 300} y2={gy} stroke="#9a9a9a" strokeWidth={10} />)}
        <Ground y={gy} />
        <g transform={`rotate(${a} ${c[0]} ${c[1]})`}>
          {Array.from({ length: 6 }, (_, k) => {
            const q = go(c, k * 60, R - 40);
            return <line key={k} x1={c[0]} y1={c[1]} x2={q[0]} y2={q[1]} stroke="#555" strokeWidth={5} />;
          })}
          {Array.from({ length: 30 }, (_, k) => {
            const [q1, q2] = [go(c, k * 12, R - 40), go(c, k * 12, R)];
            return <line key={k} x1={q1[0]} y1={q1[1]} x2={q2[0]} y2={q2[1]} stroke="#bbb" strokeWidth={5} />;
          })}
        </g>
        <circle cx={c[0]} cy={c[1]} r={R + 14} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={20} strokeDasharray="60 40" strokeDashoffset={-f * 30} />
        <circle cx={c[0]} cy={c[1]} r={R} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        {[0, 1, 2].map((k) => {
          const age = ((f + k * 8) % 24) / 24;
          return <circle key={`sw${k}`} cx={c[0] - 30 - age * (80 + k * 30)} cy={c[1] + R - 330 - age * 40 + age * age * 90} r={5} fill="#fff" opacity={0.8 * (1 - age)} />;
        })}
        <circle cx={c[0]} cy={c[1]} r={R - 40} fill="none" stroke="#ddd" strokeWidth={4} />
        <circle cx={c[0]} cy={c[1]} r={20} fill="#fff" />
        <Figure x={c[0]} ground={c[1] + R - 44} air={runAir(f * 0.32) * 0.7} s={0.72} pose={run(f * 0.32)} trail={[run(f * 0.32 - 0.25)]} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Chained to two posts, straining; at 45% the chains snap, links fly, arms go up (sfxCues hits there).
export function Chains({ p, t, dur, hit }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const sc = 1.05;
  const hipY = gy - HIP * sc;
  const snap = hit ?? dur * 0.45; // the chains break on the line's hit word when it has one
  const u = interpolate(f, [snap, snap + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pull = f < snap ? Math.sin(f * 1.8) * 6 : 0;
  const down: [Pt, Pt] = [[-150, -170], [150, -170]];
  const up: [Pt, Pt] = [[-80, -270], [80, -270]];
  const hands: [Pt, Pt] = [lerp(down[0], up[0], u), lerp(down[1], up[1], u)];
  const posts = [110, 970];
  const age = f - snap;
  return (
    <>
      <Scene>
        <Ground y={gy} />
        {posts.map((x, k) => <line key={x} x1={x + (f < snap ? Math.sin(f * 2.1 + k) * 3 : 0)} y1={hipY - 300} x2={x} y2={gy} stroke="#cfcfcf" strokeWidth={14} />)}
        {age > 0 && age < 18 && [-1, 1].map((d) => Array.from({ length: 8 }, (_, k) => {
          const a = (-60 + k * 17) * D;
          const r = 20 + age * (14 + k);
          const [ox, oy] = [s.cx + d * 150 * sc, hipY - 170 * sc];
          return <line key={`k${d}${k}`} x1={ox + d * Math.cos(a) * r} y1={oy + Math.sin(a) * r + age * age * 0.4} x2={ox + d * Math.cos(a) * (r + 16)} y2={oy + Math.sin(a) * (r + 16) + age * age * 0.4} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={1 - age / 18} />;
        }))}
        {down.map((h, side) => {
          const a: Pt = [s.cx + h[0] * sc + (side ? pull : -pull), hipY + h[1] * sc];
          const b: Pt = [posts[side], hipY - 170 * sc];
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          const dir = side ? 1 : -1;
          return Array.from({ length: 10 }, (_, j) => {
            const q = lerp(a, b, (j + 0.5) / 10);
            const fly = age > 0 ? [dir * (3 + j * 0.7) * age, (-7 + j * 0.4) * age + 0.9 * age * age] : [0, 0];
            const op = age > 0 ? Math.max(0, 1 - age / 25) : 1;
            if (op <= 0) return null;
            return <ellipse key={`${side}${j}`} cx={q[0] + fly[0]} cy={q[1] + fly[1]} rx={24} ry={j % 2 ? 5 : 12} transform={`rotate(${ang + (age > 0 ? age * 20 * dir : 0)} ${q[0] + fly[0]} ${q[1] + fly[1]})`} fill="none" stroke="#ddd" strokeWidth={6} opacity={op} />;
          });
        })}
        {age > 0 && age < 12 && [-1, 1].map((d) => <circle key={d} cx={s.cx + d * 150 * sc} cy={hipY - 170 * sc} r={20 + age * 14} fill="none" stroke="#fff" strokeWidth={6} opacity={1 - age / 12} />)}
        <Figure x={s.cx} y={hipY} s={sc} front pose={STAND} hands={hands} headDown={20 * (1 - u)} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A spotlight on stage, arms go up; a sea of heads and raised phones in front.
export function Stage({ p, t, dur }: VisualProps<{ label?: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const floor = s.top + 640;
  const up = interpolate(f, [dur * 0.3, dur * 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <>
      <Scene>
        <defs>
          <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.05} />
            <stop offset="1" stopColor="#fff" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <polygon points={`${s.cx - 40},${s.top - 260} ${s.cx + 40},${s.top - 260} ${s.cx + 260},${floor} ${s.cx - 260},${floor}`} fill="url(#spot)" />
        <ellipse cx={s.cx} cy={floor} rx={260} ry={40} fill="#fff" opacity={0.35} />
        <rect x={-10} y={floor} width={W + 20} height={50} fill="#111" stroke="#ccc" strokeWidth={4} />
        <Figure x={s.cx} ground={floor} s={0.85} pose={mix(STAND, VICTORY, up)} />
        {up > 0.5 && Array.from({ length: 30 }, (_, k) => {
          const t0 = f - dur * 0.45;
          const x = (k * 137) % W + Math.sin(t0 / 6 + k) * 30;
          const y = s.top - 200 + ((t0 * (4 + (k % 4)) + k * 53) % 1100);
          return <rect key={`c${k}`} x={x} y={y} width={14} height={8} fill={k % 3 ? "#fff" : "#999"} transform={`rotate(${t0 * 12 + k * 40} ${x + 7} ${y + 4})`} />;
        })}
        {[0, 1, 2].map((r) =>
          Array.from({ length: 8 + r }, (_, k) => {
            const x = ((k + 0.5) * W) / (8 + r) + (r % 2 ? 30 : -15);
            const y = floor + 170 + r * 120 + Math.sin(f / 5 + k * 1.7 + r) * (6 + 10 * up);
            const m = 1 + r * 0.18;
            return (
              <g key={`${r}${k}`}>
                {(k * 7 + r) % 4 === 0 && (
                  <>
                    <line x1={x + 40 * m} y1={y + 60} x2={x + 62 * m} y2={y - 60} stroke="#3a3a3a" strokeWidth={14} strokeLinecap="round" />
                    <rect x={x + 50 * m} y={y - 104} width={24} height={38} rx={4} fill="#fff" opacity={0.6 + 0.4 * Math.sin(f / 3 + k)} />
                  </>
                )}
                <path d={`M ${x - 90 * m} ${y + 130 * m} Q ${x - 85 * m} ${y + 50 * m} ${x} ${y + 50 * m} Q ${x + 85 * m} ${y + 50 * m} ${x + 90 * m} ${y + 130 * m} Z`} fill="#050505" stroke="#3a3a3a" strokeWidth={3} />
                <circle cx={x} cy={y} r={44 * m} fill="#050505" stroke="#3a3a3a" strokeWidth={3} />
              </g>
            );
          }),
        )}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}
