import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pose, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// Life, people and milestone pictures. Every scene takes only an optional label.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const burst = (c: Pt, n: number, r0: number, r1: number, rot: number, key = "b", w = 8) =>
  Array.from({ length: n }, (_, i) => {
    const [a, b] = [go(c, (i * 360) / n + rot, r0), go(c, (i * 360) / n + rot, r1)];
    return <line key={`${key}${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={w} strokeLinecap="round" />;
  });
const confetti = (f: number, n: number, top: number, bot: number, key = "c") =>
  Array.from({ length: n }, (_, i) => {
    const u = cyc(f, 60, i * 7);
    const x = (i * 71) % W + Math.sin(u * 6 + i) * 40;
    const y = top + u * (bot - top);
    return <rect key={`${key}${i}`} x={x} y={y} width={16} height={28} fill={i % 3 ? "#fff" : "#888"} opacity={0.85} transform={`rotate(${f * 9 + i * 40} ${x + 8} ${y + 14})`} />;
  });

// A lit fuse burns down toward the bomb.
export function Fuse({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx - 120, s.cy + 200];
  const k = k01(f, 0, dur, clamp);
  const fuse = `M ${c[0] + 150} ${c[1] - 190} C ${c[0] + 300} ${c[1] - 400}, ${c[0] + 500} ${c[1] - 200}, ${c[0] + 420} ${c[1] - 520}`;
  return (
    <Frame p={p} t={t}>
      <path d={fuse} fill="none" stroke="#888" strokeWidth={10} pathLength={100} strokeDasharray={`${(1 - k) * 100} 100`} />
      {(() => {
        // The spark rides the fuse's burning end: sample the cubic at 1 - k.
        const u = 1 - k;
        const P: Pt[] = [[c[0] + 150, c[1] - 190], [c[0] + 300, c[1] - 400], [c[0] + 500, c[1] - 200], [c[0] + 420, c[1] - 520]];
        const b = (i: 0 | 1) => (1 - u) ** 3 * P[0][i] + 3 * (1 - u) ** 2 * u * P[1][i] + 3 * (1 - u) * u * u * P[2][i] + u ** 3 * P[3][i];
        const sp: Pt = [b(0), b(1)];
        return (
          <g filter="url(#glow)">
            {burst(sp, 8, 10, 40 + 20 * Math.sin(f), f * 20, "s", 5)}
            <circle cx={sp[0]} cy={sp[1]} r={16} fill="#fff" />
          </g>
        );
      })()}
      <circle cx={c[0]} cy={c[1]} r={260} fill="#1a1a1a" stroke="#fff" strokeWidth={9} />
      <rect x={c[0] + 80} y={c[1] - 250} width={110} height={90} rx={12} fill="#555" transform={`rotate(40 ${c[0] + 135} ${c[1] - 205})`} />
      <path d={`M ${c[0] - 160} ${c[1] - 90} q 40 -80 120 -100`} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={16} strokeLinecap="round" />
    </Frame>
  );
}

// A snowball rolls downhill, growing bigger every turn.
export function Snowball({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const a: Pt = [0, s.top + 360], b: Pt = [W, s.bottom - 60];
  const u = k01(f, 0, dur, { ...clamp, easing: Easing.in(Easing.quad) });
  const r = 40 + 220 * u;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  const q = lerp(a, b, 0.1 + 0.6 * u);
  const c: Pt = [q[0] - nx * r * -1, q[1] - ny * r];
  return (
    <Frame p={p} t={t}>
      <path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} V ${H} H 0 Z`} fill="#141414" stroke="#fff" strokeWidth={6} />
      <path d={`M ${a[0]} ${a[1] + 20} L ${q[0]} ${q[1] + 20}`} stroke="#000" strokeWidth={24} opacity={0.5} />
      <g transform={`rotate(${f * 12} ${c[0]} ${c[1]})`}>
        <circle cx={c[0]} cy={c[1]} r={r} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        {[0, 1, 2].map((i) => <path key={i} d={`M ${c[0] - r * 0.5} ${c[1] + (i - 1) * r * 0.4} q ${r * 0.5} ${-r * 0.2} ${r} 0`} fill="none" stroke="#999" strokeWidth={4} />)}
      </g>
      {Array.from({ length: 6 }, (_, i) => {
        const v = cyc(f, 20, i * 3);
        return <circle key={i} cx={c[0] - r - v * 80} cy={c[1] + r * 0.6 - v * 60} r={6} fill="#fff" opacity={1 - v} />;
      })}
    </Frame>
  );
}

// A wrecking ball swings in and smashes a wall.
export function Wrecking({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.45;
  const piv: Pt = [s.left + 60, s.top + 80];
  const ang = f < at ? interpolate(f, [0, at], [70, 0], { ...clamp, easing: Easing.in(Easing.quad) }) : Math.sin((f - at) / 10) * -8 * Math.exp(-(f - at) / 30);
  const ball = go(piv, ang, 760);
  const age = f - at;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => {
          const bx = s.cx + 120 + c * 110 - (r % 2) * 55, by = gy - 80 - r * 80;
          const out = age > 0 && Math.abs(by - ball[1]) < 260;
          const dx = out ? age * (12 + ((r * 7 + c * 3) % 9)) : 0;
          const dy = out ? -age * ((r % 4) - 1) * 3 + age * age * 0.8 : 0;
          return <rect key={`${r}${c}`} x={bx + dx} y={by + dy} width={108} height={76} fill="#1f1f1f" stroke="#ddd" strokeWidth={4} transform={out ? `rotate(${age * 10 * (c % 2 ? 1 : -1)} ${bx + dx + 54} ${by + dy + 38})` : undefined} />;
        }),
      )}
      <line x1={piv[0]} y1={piv[1]} x2={ball[0]} y2={ball[1]} stroke="#aaa" strokeWidth={8} />
      <circle cx={ball[0]} cy={ball[1]} r={130} fill="#1a1a1a" stroke="#fff" strokeWidth={9} filter="url(#glow)" />
      {age >= 0 && age < 10 && burst([ball[0] + 130, ball[1]], 10, 60, 140 + age * 20, 0)}
    </Frame>
  );
}

// A giant grey figure looms; the small lit one stands its ground.
export function Giant({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const up = k01(f, dur * 0.4, dur * 0.7);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx + 180} ground={gy} s={1.9 - 0.3 * up} flip front pose={{ ...STAND, t: -8 + Math.sin(f / 20) * 2 }} color="#2a2a2a" glow={false} headDown={20} />
      <Figure x={s.cx - 220} ground={gy} s={0.6} pose={mix(STAND, { ...STAND, rs: 100, re: 100, t: -6 }, up)} headDown={-25} />
    </Frame>
  );
}

// Walking forward while faded copies of your past selves trail behind.
export function Echoes({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const x = interpolate(f, [0, dur], [s.cx - 100, s.cx + 160]);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[5, 4, 3, 2, 1].map((i) => (
        <g key={i} opacity={0.6 - i * 0.1}>
          <Figure x={x - i * 150} ground={gy} s={0.8 - i * 0.04} pose={walk((x - i * 150) / (walkRate() * 0.8))} color="#777" glow={false} headDown={10 + i * 5} />
        </g>
      ))}
      <Figure x={x} ground={gy} s={0.85} pose={walk(x / (walkRate() * 0.85))} />
    </Frame>
  );
}

// A hand reaches down from above and pulls the figure up.
export function Hand({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const reach = k01(f, 0, dur * 0.35);
  const lift = k01(f, dur * 0.45, dur * 0.9);
  const hy = s.top + 80 + reach * 360 - lift * 200;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx + 40} y={s.top - 400} width={130} height={hy - s.top + 400} rx={50} fill="#cfcfcf" stroke="#fff" strokeWidth={5} />
      <rect x={s.cx + 10} y={hy - 30} width={190} height={150} rx={60} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={s.cx + 16 + i * 45} y={hy + 90} width={38} height={80} rx={18} fill="#e6e6e6" stroke="#999" strokeWidth={3} />)}
      <Figure x={s.cx + 60} ground={gy - lift * 200} s={0.8} front pose={{ ...STAND, rs: -100 - 70 * reach, re: -110 - 65 * reach }} headDown={-25} />
    </Frame>
  );
}

// A barrier gate lifts and the way opens.
export function Gate({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const open = k01(f, dur * 0.2, dur * 0.5, pop);
  const walkK = k01(f, dur * 0.5, dur, clamp);
  const piv: Pt = [s.left + 120, gy - 300];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={piv[0] - 60} y={piv[1] - 40} width={120} height={gy - piv[1] + 40} fill="#1a1a1a" stroke="#ccc" strokeWidth={6} />
      <circle cx={piv[0]} cy={piv[1] - 80} r={24} fill={open > 0.5 ? "#fff" : "#555"} filter={open > 0.5 ? "url(#glow)" : undefined} />
      <g transform={`rotate(${-80 * open} ${piv[0]} ${piv[1]})`}>
        <rect x={piv[0]} y={piv[1] - 20} width={560} height={40} rx={10} fill="#e6e6e6" />
        {Array.from({ length: 4 }, (_, i) => <rect key={i} x={piv[0] + 40 + i * 130} y={piv[1] - 20} width={60} height={40} fill="#333" />)}
      </g>
      <Figure x={s.cx + 280 - walkK * 380} ground={gy} s={0.8} flip pose={walkK > 0 ? walk((walkK * 380) / (walkRate() * 0.8)) : STAND} />
    </Frame>
  );
}

// Confetti rains on a figure with arms up.
export function Confetti({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const jump = Math.max(0, Math.sin(f / 7)) * 60;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => <path key={d} d={`M ${s.cx + d * 360} ${gy} l ${d * -40} -140 l ${d * -60} 40 Z`} fill="#888" />)}
      {confetti(f, 40, s.top - 100, gy)}
      <Figure x={s.cx} ground={gy} air={jump} s={0.9} front pose={VICTORY} />
    </Frame>
  );
}

// Fireworks burst over the skyline.
export function Fireworks({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const shells = [[s.cx - 220, s.top + 320, 0], [s.cx + 240, s.top + 220, 15], [s.cx, s.top + 420, 30], [s.cx - 300, s.top + 180, 45]] as const;
  return (
    <Frame p={p} t={t}>
      {shells.map(([x, y, o], i) => {
        const u = cyc(f, 60, -o);
        if (u < 0.3) return <line key={i} x1={x} y1={gy - (u / 0.3) * (gy - y)} x2={x} y2={gy - (u / 0.3) * (gy - y) + 50} stroke="#fff" strokeWidth={5} />;
        const v = (u - 0.3) / 0.7;
        return (
          <g key={i} opacity={1 - v} filter="url(#glow)">
            {Array.from({ length: 16 }, (_, j) => {
              const q = go([x, y], j * 22.5, 40 + v * 220);
              return <circle key={j} cx={q[0]} cy={q[1] + v * v * 80} r={7} fill="#fff" />;
            })}
          </g>
        );
      })}
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 125 - 10} y={gy - 120 - ((i * 73) % 200)} width={110} height={200 + ((i * 73) % 200)} fill="#0d0d0d" stroke="#555" strokeWidth={3} />)}
      <Figure x={s.cx} ground={gy} s={0.6} back pose={STAND} headDown={-30} />
    </Frame>
  );
}

// A gift box: the lid pops off and light spills out.
export function Gift({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const at = hit ?? dur * 0.4;
  const open = k01(f, at, at + 12, pop);
  const b = { x: s.cx - 240, w: 480, h: 400 };
  const shake = f < at ? Math.sin(f * 1.8) * 4 * (f / at) : 0;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {open > 0 && <polygon points={`${b.x + 40},${gy - b.h} ${b.x + b.w - 40},${gy - b.h} ${s.cx + 400},${s.top} ${s.cx - 400},${s.top}`} fill="#fff" opacity={0.3 * open} />}
      {open > 0 && burst([s.cx, gy - b.h - 60], 12, 100, 200 + 60 * open, f, "g")}
      <g transform={`rotate(${shake} ${s.cx} ${gy})`}>
        <rect x={b.x} y={gy - b.h} width={b.w} height={b.h} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
        <rect x={s.cx - 30} y={gy - b.h} width={60} height={b.h} fill="#ccc" />
        <g transform={`translate(${open * 260} ${-open * 300}) rotate(${open * 35} ${s.cx} ${gy - b.h})`}>
          <rect x={b.x - 30} y={gy - b.h - 80} width={b.w + 60} height={90} rx={8} fill="#2a2a2a" stroke="#fff" strokeWidth={8} />
          <rect x={s.cx - 30} y={gy - b.h - 80} width={60} height={90} fill="#ccc" />
          <path d={`M ${s.cx} ${gy - b.h - 80} q -120 -120 -160 -20 q 40 40 160 20 q 120 -120 160 -20 q -40 40 -160 20`} fill="#ccc" stroke="#fff" strokeWidth={4} />
        </g>
      </g>
    </Frame>
  );
}

// An envelope opens; the letter rises: ACCEPTED.
export function Letter({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const e = { x: s.cx - 320, y: s.cy + 40, w: 640, h: 420 };
  const flap = k01(f, 4, dur * 0.3);
  const rise = k01(f, dur * 0.3, dur * 0.6);
  const stamp = k01(f, dur * 0.65, dur * 0.72, pop);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${e.x} ${e.y} L ${s.cx} ${e.y - 260 * flap + 260 * (1 - flap) * 0} L ${e.x + e.w} ${e.y}`} fill="#1f1f1f" stroke="#fff" strokeWidth={6} transform={`translate(0 ${0}) scale(1 ${flap > 0.5 ? 1 : 1})`} />
      <g transform={`translate(0 ${-rise * 420})`}>
        <rect x={e.x + 50} y={e.y - 60} width={e.w - 100} height={500} fill="#e6e6e6" />
        {[0, 1, 2].map((i) => <rect key={i} x={e.x + 100} y={e.y + 160 + i * 50} width={e.w - 200 - i * 60} height={16} fill="#999" />)}
        <g transform={`translate(${s.cx} ${e.y + 70}) scale(${stamp ? 1.6 - 0.6 * stamp : 0}) rotate(-8)`}>
          <rect x={-230} y={-60} width={460} height={110} rx={10} fill="none" stroke="#111" strokeWidth={10} />
          {big("ACCEPTED", 0, 30, 90, "#111")}
        </g>
      </g>
      <rect x={e.x} y={e.y} width={e.w} height={e.h} fill="#2a2a2a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <path d={`M ${e.x} ${e.y + e.h} L ${s.cx} ${e.y + 200} L ${e.x + e.w} ${e.y + e.h}`} fill="none" stroke="#888" strokeWidth={5} />
      {flap < 0.5 && <path d={`M ${e.x} ${e.y} L ${s.cx} ${e.y + 220 * (1 - flap * 2)} L ${e.x + e.w} ${e.y}`} fill="#333" stroke="#fff" strokeWidth={6} />}
    </Frame>
  );
}

// Suitcase in hand, walking out the door to somewhere new.
export function Suitcase({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const x = interpolate(f, [0, dur], [s.left + 60, s.right - 80]);
  const ph = (x - s.left) / (walkRate() * 0.85);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.right - 160} y={gy - 640} width={240} height={640} fill="#fff" opacity={0.85} filter="url(#glow)" />
      <rect x={s.right - 180} y={gy - 660} width={20} height={660} fill="#888" />
      <Figure x={x} ground={gy} s={0.85} pose={{ ...walk(ph), rs: 6, re: 6 }} />
      <g transform={`translate(${x - 20} ${gy - 170 + Math.abs(Math.sin(ph)) * 6})`}>
        <rect x={0} y={0} width={190} height={140} rx={14} fill="#1a1a1a" stroke="#fff" strokeWidth={6} />
        <path d="M 60 0 v -26 h 70 v 26" fill="none" stroke="#fff" strokeWidth={8} />
        <line x1={0} y1={50} x2={190} y2={50} stroke="#777" strokeWidth={4} />
      </g>
    </Frame>
  );
}

// A plane takes off and climbs out of frame.
export function Plane({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const u = k01(f, 0, dur, { ...clamp, easing: Easing.in(Easing.quad) });
  const x = s.left - 200 + u * (W + 300);
  const climb = Math.max(0, u - 0.35) * 1.3;
  const y = gy - 60 - climb * 900;
  const ang = -climb * 30;
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#ccc" strokeWidth={6} />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={((i * 160 - f * 20) % (W + 160) + W + 160) % (W + 160) - 80} y={gy + 30} width={80} height={10} fill="#888" />)}
      <g transform={`translate(${x} ${y}) rotate(${ang})`} filter="url(#glow)">
        <path d="M -220 -20 H 160 Q 240 -20 260 10 Q 240 30 160 30 H -220 Z" fill="#e6e6e6" />
        <path d="M -20 0 L -100 140 H -40 L 80 0 Z" fill="#bbb" />
        <path d="M -20 -10 L -80 -110 H -30 L 60 -10 Z" fill="#bbb" />
        <path d="M -200 -20 L -240 -120 H -190 L -140 -20 Z" fill="#ccc" />
        {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={-120 + i * 50} cy={0} r={8} fill="#333" />)}
      </g>
      {climb > 0 && Array.from({ length: 6 }, (_, i) => <circle key={`t${i}`} cx={x - 240 - i * 70} cy={y + 40 + i * 30 * Math.max(0.3, climb)} r={20 + i * 6} fill="#fff" opacity={0.25 - i * 0.04} />)}
    </Frame>
  );
}

// A house is built, then its windows light up one by one.
export function House({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const build = k01(f, 0, dur * 0.5);
  const h = { x: s.cx - 300, w: 600, wall: 460 };
  const wins: Pt[] = [[h.x + 80, gy - 380], [h.x + h.w - 220, gy - 380], [h.x + 80, gy - 200]];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <defs><clipPath id="build"><rect x={0} y={gy - (h.wall + 340) * build} width={W} height={H} /></clipPath></defs>
      <g clipPath="url(#build)">
        <rect x={h.x} y={gy - h.wall} width={h.w} height={h.wall} fill="#141414" stroke="#fff" strokeWidth={8} />
        <path d={`M ${h.x - 60} ${gy - h.wall} L ${s.cx} ${gy - h.wall - 320} L ${h.x + h.w + 60} ${gy - h.wall} Z`} fill="#1f1f1f" stroke="#fff" strokeWidth={8} />
        <rect x={h.x + h.w - 160} y={gy - h.wall - 250} width={70} height={140} fill="#1f1f1f" stroke="#fff" strokeWidth={6} />
        <rect x={h.x + h.w - 200} y={gy - 240} width={140} height={240} fill="#2a2a2a" stroke="#ccc" strokeWidth={6} />
        {wins.map(([x, y], i) => {
          const on = f > dur * (0.55 + i * 0.12);
          return (
            <g key={i}>
              <rect x={x} y={y} width={140} height={120} fill={on ? "#fff" : "#000"} stroke="#ccc" strokeWidth={6} filter={on ? "url(#glow)" : undefined} />
              <path d={`M ${x + 70} ${y} V ${y + 120} M ${x} ${y + 60} H ${x + 140}`} stroke={on ? "#bbb" : "#444"} strokeWidth={5} />
            </g>
          );
        })}
      </g>
      {build < 1 && Array.from({ length: 3 }, (_, i) => <rect key={i} x={h.x + 60 + i * 200} y={gy - (h.wall + 340) * build - 30 - ((f * 6 + i * 40) % 120)} width={80} height={40} fill="#999" opacity={0.7} />)}
    </Frame>
  );
}

// A city skyline rises tower by tower.
export function Skyline({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 7;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, i) => {
        const tall = i === 3;
        const hMax = tall ? 900 : 300 + ((i * 173) % 360);
        const u = k01(f, tickAt(i, n, dur) - 10, tickAt(i, n, dur), { ...clamp, easing: Easing.out(Easing.cubic) });
        const w = tall ? 170 : 120;
        const x = s.left + i * 140 - (tall ? 20 : 0);
        const h = hMax * u;
        return (
          <g key={i}>
            <rect x={x} y={gy - h} width={w} height={h} fill={tall ? "#1f1f1f" : "#121212"} stroke={tall ? "#fff" : "#888"} strokeWidth={tall ? 7 : 4} filter={tall && u >= 1 ? "url(#glow)" : undefined} />
            {Array.from({ length: Math.floor(h / 70) }, (_, r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={x + 22 + c * (w / 2 - 6)} y={gy - h + 26 + r * 70} width={w / 2 - 40} height={34} fill="#fff" opacity={(r + c + i + Math.floor(f / 15)) % 4 === 0 ? 0.8 : 0.12} />))}
            {tall && u >= 1 && <line x1={x + w / 2} y1={gy - h} x2={x + w / 2} y2={gy - h - 120} stroke="#fff" strokeWidth={6} />}
          </g>
        );
      })}
    </Frame>
  );
}

// A tower crane swings a beam into place on the top floor.
export function Crane({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const mast = s.left + 80;
  const top = s.top + 260;
  const k = k01(f, 0, dur * 0.75);
  const trolley = mast + 200 + k * 500;
  const lower = k01(f, dur * 0.5, dur * 0.8);
  const floors = 5;
  const by = top + 80 + lower * (gy - floors * 110 - top - 120);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={mast - 30} y={top} width={60} height={gy - top} fill="none" stroke="#ccc" strokeWidth={6} />
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1={mast - 30} y1={top + i * 70} x2={mast + 30} y2={top + (i + 1) * 70} stroke="#888" strokeWidth={3} />)}
      <line x1={mast - 200} y1={top} x2={s.right + 40} y2={top} stroke="#e6e6e6" strokeWidth={14} />
      <line x1={mast} y1={top - 100} x2={s.right} y2={top} stroke="#999" strokeWidth={4} />
      <line x1={mast} y1={top - 100} x2={mast - 200} y2={top} stroke="#999" strokeWidth={4} />
      <rect x={mast - 220} y={top} width={80} height={80} fill="#555" />
      <rect x={trolley - 20} y={top} width={40} height={24} fill="#fff" />
      <line x1={trolley} y1={top + 20} x2={trolley} y2={by} stroke="#aaa" strokeWidth={3} />
      <rect x={trolley - 150} y={by} width={300} height={40} fill="#e6e6e6" filter="url(#glow)" />
      {Array.from({ length: floors }, (_, i) => <rect key={i} x={s.cx + 50} y={gy - (i + 1) * 110} width={360} height={110} fill="#141414" stroke="#ccc" strokeWidth={5} />)}
    </Frame>
  );
}

// A blueprint draws itself line by line.
export function Blueprint({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur * 0.85, clamp);
  const x0 = s.left + 60, y0 = s.top + 160, w = s.width - 120, h = s.height - 260;
  const lines: [number, number, number, number][] = [
    [x0 + 60, y0 + h - 60, x0 + w - 60, y0 + h - 60], [x0 + 60, y0 + h - 60, x0 + 60, y0 + 300], [x0 + w - 60, y0 + h - 60, x0 + w - 60, y0 + 300],
    [x0 + 60, y0 + 300, x0 + w / 2, y0 + 80], [x0 + w / 2, y0 + 80, x0 + w - 60, y0 + 300], [x0 + 60, y0 + 300, x0 + w - 60, y0 + 300],
    [x0 + 140, y0 + 400, x0 + 340, y0 + 400], [x0 + 140, y0 + 400, x0 + 140, y0 + 560], [x0 + 340, y0 + 400, x0 + 340, y0 + 560], [x0 + 140, y0 + 560, x0 + 340, y0 + 560],
    [x0 + w - 300, y0 + h - 60, x0 + w - 300, y0 + h - 340], [x0 + w - 300, y0 + h - 340, x0 + w - 140, y0 + h - 340], [x0 + w - 140, y0 + h - 340, x0 + w - 140, y0 + h - 60],
  ];
  const per = 1 / lines.length;
  return (
    <Frame p={p} t={t}>
      <rect x={x0} y={y0} width={w} height={h} fill="#0d0d0d" stroke="#888" strokeWidth={5} />
      {Array.from({ length: 12 }, (_, i) => <line key={`g${i}`} x1={x0} y1={y0 + i * (h / 12)} x2={x0 + w} y2={y0 + i * (h / 12)} stroke="#fff" strokeOpacity={0.07} strokeWidth={2} />)}
      {Array.from({ length: 8 }, (_, i) => <line key={`v${i}`} x1={x0 + i * (w / 8)} y1={y0} x2={x0 + i * (w / 8)} y2={y0 + h} stroke="#fff" strokeOpacity={0.07} strokeWidth={2} />)}
      {lines.map(([a, b, c, d], i) => {
        const u = Math.max(0, Math.min(1, (k - i * per) / per));
        if (u <= 0) return null;
        const head = lerp([a, b], [c, d], u);
        return (
          <g key={i}>
            <line x1={a} y1={b} x2={head[0]} y2={head[1]} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
            {u < 1 && <circle cx={head[0]} cy={head[1]} r={10} fill="#fff" filter="url(#glow)" />}
          </g>
        );
      })}
    </Frame>
  );
}

// A stone drops into still water; ripples spread wide.
export function Ripple({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 140];
  const drop = k01(f, 0, 14, { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <Frame p={p} t={t}>
      {drop < 1 && <circle cx={c[0]} cy={s.top + 120 + drop * (c[1] - s.top - 120)} r={30} fill="#ccc" />}
      {f >= 14 && Array.from({ length: 6 }, (_, i) => {
        const u = ((f - 14) / 50 - i * 0.18);
        if (u <= 0) return null;
        const r = u * 520;
        return <ellipse key={i} cx={c[0]} cy={c[1]} rx={r} ry={r * 0.32} fill="none" stroke="#fff" strokeWidth={8 - i} opacity={Math.max(0, 1 - u * 0.8)} filter={i === 0 ? "url(#glow)" : undefined} />;
      })}
      {f >= 14 && f < 34 && Array.from({ length: 8 }, (_, i) => {
        const u = (f - 14) / 20;
        const q = go(c, 90 + i * 45, u * 100);
        return <circle key={`s${i}`} cx={q[0]} cy={c[1] - Math.sin(u * Math.PI) * 140 + (q[1] - c[1]) * 0.3} r={8} fill="#fff" opacity={1 - u} />;
      })}
    </Frame>
  );
}

// At the mic under a spotlight, then the voice carries.
export function Mic({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const mic: Pt = [s.cx + 90, gy - 470];
  const talk = Math.abs(Math.sin(f / 4));
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <polygon points={`${s.cx - 30},${s.top - 200} ${s.cx + 30},${s.top - 200} ${s.cx + 300},${gy + 20} ${s.cx - 300},${gy + 20}`} fill="#fff" opacity={0.12} />
      <line x1={mic[0]} y1={mic[1]} x2={mic[0] + 30} y2={gy} stroke="#aaa" strokeWidth={8} />
      <path d={`M ${mic[0] - 60} ${gy} h 180`} stroke="#aaa" strokeWidth={10} />
      <Figure x={s.cx - 60} ground={gy} s={0.9} pose={{ ...STAND, rs: 50, re: 110 }} />
      <rect x={mic[0] - 22} y={mic[1] - 70} width={44} height={80} rx={22} fill="#e6e6e6" stroke="#fff" strokeWidth={4} filter="url(#glow)" />
      {[0, 1, 2].map((i) => <path key={i} d={`M ${mic[0] + 70 + i * 50} ${mic[1] - 80 - i * 20} q ${40 + i * 10} ${50 + i * 20} 0 ${100 + i * 40}`} fill="none" stroke="#fff" strokeWidth={6} opacity={talk * (1 - i * 0.25)} />)}
    </Frame>
  );
}

// Filming yourself: camera on a tripod, the red-dot REC blinking, the viewfinder showing you.
export function Vlog({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const cam: Pt = [s.cx + 240, gy - 420];
  const rec = Math.floor(f / 15) % 2 === 0;
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: s.left + 20, top: s.top + 110, font: `400 70px ${font.impact}`, color: "#fff", opacity: rec ? 1 : 0.3 }}>● REC {String(Math.floor(f / 30)).padStart(2, "0")}:{String(f % 30 * 2).padStart(2, "0")}</div>}>
      <Ground y={gy} />
      {[-1, 0, 1].map((d) => <line key={d} x1={cam[0]} y1={cam[1] + 80} x2={cam[0] + d * 120} y2={gy} stroke="#aaa" strokeWidth={8} />)}
      <rect x={cam[0] - 110} y={cam[1] - 40} width={220} height={130} rx={16} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <rect x={cam[0] - 190} y={cam[1] - 10} width={80} height={70} rx={8} fill="#555" stroke="#fff" strokeWidth={5} />
      <circle cx={cam[0] + 80} cy={cam[1] - 20} r={10} fill={rec ? "#fff" : "#333"} />
      {[-1, 1].map((d) => <line key={`f${d}`} x1={cam[0] - 190} y1={cam[1] + 25} x2={s.cx - 260} y2={gy - 300 + d * 240} stroke="#fff" strokeOpacity={0.12} strokeWidth={4} />)}
      <Figure x={s.cx - 200} ground={gy} s={0.85} pose={{ ...STAND, rs: 100 + 30 * Math.sin(f / 6), re: 130 + 30 * Math.sin(f / 6) }} />
    </Frame>
  );
}

// A loading bar crawls, stalls at 99%, then completes.
export function Loading({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = f < dur * 0.45 ? interpolate(f, [0, dur * 0.45], [0, 0.99], { ...clamp, easing: Easing.out(Easing.cubic) }) : f < dur * 0.75 ? 0.99 : 1;
  const b = { x: s.left + 40, y: s.cy, w: s.width - 80, h: 120 };
  const done = k >= 1;
  return (
    <Frame p={p} t={t}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={60} fill="none" stroke="#fff" strokeWidth={8} filter={done ? "url(#glow)" : undefined} />
      <rect x={b.x + 16} y={b.y + 16} width={(b.w - 32) * k} height={b.h - 32} rx={44} fill={done ? "#fff" : "#999"} />
      {!done && <rect x={b.x + 16 + ((f * 12) % Math.max(1, (b.w - 32) * k))} y={b.y + 16} width={60} height={b.h - 32} fill="#fff" opacity={0.4} />}
      {big(`${Math.floor(k * 100)}%`, s.cx, b.y - 80, 200, done ? "#fff" : "#888")}
      {done && <path d={`M ${s.cx - 90} ${b.y + 330} l 70 70 l 140 -160`} fill="none" stroke="#fff" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />}
      {!done && f >= dur * 0.45 && <circle cx={s.cx} cy={b.y + 330} r={70} fill="none" stroke="#fff" strokeWidth={14} strokeDasharray="110 330" transform={`rotate(${f * 12} ${s.cx} ${b.y + 330})`} />}
    </Frame>
  );
}

// Hearts float up as the like counter climbs.
export function Likes({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = Math.round(interpolate(f, [0, dur * 0.9], [3, 12480], { ...clamp, easing: Easing.in(Easing.cubic) }));
  const heart = (x: number, y: number, sc: number, o: number, key: number | string) => (
    <path key={key} d={`M ${x} ${y + 30 * sc} c -60 -40 -90 -90 -40 -120 c 25 -15 40 0 40 15 c 0 -15 15 -30 40 -15 c 50 30 20 80 -40 120 Z`} fill="#fff" opacity={o} transform={`translate(${x} ${y}) scale(${sc}) translate(${-x} ${-y})`} />
  );
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.cy + 260, textAlign: "center", font: `400 170px ${font.impact}`, color: "#fff", textShadow: "0 0 30px rgba(255,255,255,0.5)" }}>{n.toLocaleString("en-US")}</div>}>
      {Array.from({ length: 14 }, (_, i) => {
        const u = cyc(f, 50, i * 4);
        return heart(s.cx + Math.sin(u * 5 + i) * 120 + ((i * 97) % 500) - 250, s.cy + 200 - u * 700, 0.6 + (i % 3) * 0.3, 1 - u, i);
      })}
      <g filter="url(#glow)">{heart(s.cx, s.cy + 60, 2.2 + 0.2 * Math.abs(Math.sin(f / 5)), 1, "main")}</g>
    </Frame>
  );
}

// A candle burns down slowly, the flame flickering.
export function Candle({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const h = interpolate(f, [0, dur], [620, 260]);
  const top = gy - h;
  const fl = Math.sin(f / 3) * 8 + Math.sin(f / 1.7) * 4;
  return (
    <Frame p={p} t={t}>
      <circle cx={s.cx} cy={top - 110} r={300} fill="#fff" opacity={0.06} />
      <ellipse cx={s.cx} cy={gy} rx={260} ry={40} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />
      <rect x={s.cx - 90} y={top} width={180} height={h} fill="#e6e6e6" />
      <path d={`M ${s.cx - 90} ${top} q 20 40 0 90 M ${s.cx + 90} ${top} q -20 60 0 140`} fill="#e6e6e6" stroke="#ccc" strokeWidth={14} strokeLinecap="round" />
      <line x1={s.cx} y1={top} x2={s.cx} y2={top - 40} stroke="#333" strokeWidth={8} />
      <g filter="url(#glow)">
        <path d={`M ${s.cx - 34} ${top - 50} Q ${s.cx - 40} ${top - 130} ${s.cx + fl} ${top - 220} Q ${s.cx + 40} ${top - 130} ${s.cx + 34} ${top - 50} Q ${s.cx} ${top - 20} ${s.cx - 34} ${top - 50} Z`} fill="#fff" />
      </g>
    </Frame>
  );
}

// Alone on a park bench under a streetlight; leaves blow past.
export function Bench({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const lamp: Pt = [s.right - 120, s.top + 200];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <line x1={lamp[0]} y1={lamp[1]} x2={lamp[0]} y2={gy} stroke="#aaa" strokeWidth={14} />
      <path d={`M ${lamp[0]} ${lamp[1]} q 0 -60 -80 -60 h -40`} fill="none" stroke="#aaa" strokeWidth={14} />
      <polygon points={`${lamp[0] - 130},${lamp[1] - 40} ${lamp[0] - 110},${lamp[1] - 40} ${s.cx + 100},${gy} ${s.left - 100},${gy}`} fill="#fff" opacity={0.12} />
      <circle cx={lamp[0] - 120} cy={lamp[1] - 40} r={26} fill="#fff" filter="url(#glow)" />
      <rect x={s.cx - 330} y={gy - 190} width={460} height={24} rx={6} fill="#bbb" />
      <rect x={s.cx - 330} y={gy - 300} width={460} height={20} rx={6} fill="#bbb" />
      {[-300, 80].map((x) => <rect key={x} x={s.cx + x} y={gy - 300} width={20} height={300} fill="#888" />)}
      <Figure x={s.cx - 100} ground={gy - 40} s={0.75} pose={SIT} headDown={30} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 70, i * 12);
        const x = W - u * (W + 200);
        const y = gy - 40 - Math.abs(Math.sin(u * 8 + i)) * 160;
        return <ellipse key={i} cx={x} cy={y} rx={18} ry={9} fill="#888" transform={`rotate(${f * 10 + i * 50} ${x} ${y})`} />;
      })}
    </Frame>
  );
}

// A headstone with a dash between two years: what will you do with the dash?
export function Grave({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const dash = k01(f, dur * 0.3, dur * 0.6);
  return (
    <Frame p={p} t={t}>
      <path d={`M 0 ${gy} Q ${s.cx} ${gy - 60} ${W} ${gy} V ${H} H 0 Z`} fill="#0d0d0d" stroke="#777" strokeWidth={4} />
      <path d={`M ${s.cx - 230} ${gy - 20} V ${gy - 520} Q ${s.cx - 230} ${gy - 720} ${s.cx} ${gy - 720} Q ${s.cx + 230} ${gy - 720} ${s.cx + 230} ${gy - 520} V ${gy - 20} Z`} fill="#1f1f1f" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {big("19XX", s.cx - 110, gy - 360, 80, "#888")}
      {big("20XX", s.cx + 110, gy - 360, 80, "#888")}
      <rect x={s.cx - 40} y={gy - 395} width={80 * dash} height={14} fill="#fff" />
      {dash >= 1 && <circle cx={s.cx} cy={gy - 388} r={60 + 10 * Math.sin(f / 5)} fill="none" stroke="#fff" strokeWidth={5} />}
      {[0, 1, 2].map((i) => <path key={i} d={`M ${s.cx - 300 + i * 260} ${gy - 10} q 10 -40 20 0 q 10 -50 20 0`} fill="none" stroke="#888" strokeWidth={5} />)}
    </Frame>
  );
}

// Birthday cake: candles light, then get blown out; another year.
export function Cake({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const out = f > dur * 0.6;
  const c = { x: s.cx - 300, w: 600 };
  const n = 7;
  return (
    <Frame p={p} t={t}>
      <rect x={c.x} y={gy - 220} width={c.w} height={220} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <rect x={c.x + 60} y={gy - 380} width={c.w - 120} height={160} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <path d={`M ${c.x} ${gy - 180} ${Array.from({ length: 10 }, (_, i) => `q 30 ${i % 2 ? -40 : 40} 60 0`).join(" ")}`} fill="none" stroke="#bbb" strokeWidth={8} />
      {Array.from({ length: n }, (_, i) => {
        const x = c.x + 110 + i * 63;
        const lit = !out && f > tickAt(i, n, dur * 0.5);
        return (
          <g key={i}>
            <rect x={x - 10} y={gy - 480} width={20} height={100} fill={i % 2 ? "#ccc" : "#888"} />
            {lit && <ellipse cx={x + Math.sin(f / 3 + i) * 3} cy={gy - 510} rx={13} ry={26} fill="#fff" filter="url(#glow)" />}
            {out && <path d={`M ${x} ${gy - 490} q 20 -40 0 -80 q -20 -40 0 -80`} fill="none" stroke="#777" strokeWidth={4} opacity={Math.max(0, 1 - (f - dur * 0.6) / 30)} />}
          </g>
        );
      })}
      <ellipse cx={s.cx} cy={gy} rx={360} ry={30} fill="none" stroke="#888" strokeWidth={6} />
      {out && f - dur * 0.6 < 12 && Array.from({ length: 6 }, (_, i) => <line key={i} x1={s.right} y1={gy - 520 + i * 15} x2={s.right - (f - dur * 0.6) * 50} y2={gy - 520 + i * 15} stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
    </Frame>
  );
}

// Child to adult to old: the same figure growing up and bending over as years pass.
export function Ages({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur * 0.9, clamp);
  const grow = Math.min(1, k * 2);
  const old = Math.max(0, k * 2 - 1);
  const year = Math.round(5 + k * 80);
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.top + 120, textAlign: "center", font: `400 140px ${font.impact}`, color: "#fff" }}>AGE {year}</div>}>
      <Ground y={gy} />
      <Figure x={s.cx} ground={gy} s={0.45 + 0.5 * grow - 0.05 * old} pose={{ ...walk(f * 0.12, 0.6 - 0.4 * old), t: 5 + 30 * old }} headDown={25 * old} color={old > 0.5 ? "#9a9a9a" : "#ececec"} />
      {old > 0.3 && <line x1={s.cx + 90} y1={gy} x2={s.cx + 70} y2={gy - 250} stroke="#aaa" strokeWidth={10} opacity={Math.min(1, (old - 0.3) * 3)} />}
    </Frame>
  );
}

// Flying a kite high on the wind.
export function Kite({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const rise = k01(f, 0, dur * 0.7);
  const kt: Pt = [s.right - 180 + Math.sin(f / 12) * 40, gy - 500 - rise * 280 + Math.cos(f / 9) * 30];
  const hand: Pt = [s.left + 260, gy - 320];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M ${W - ((i * 260 + f * 16) % (W + 300))} ${s.top + 140 + i * 130} q 60 -20 120 0 t 120 0`} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={4} />)}
      <path d={`M ${hand[0]} ${hand[1]} Q ${(hand[0] + kt[0]) / 2} ${(hand[1] + kt[1]) / 2 + 120} ${kt[0]} ${kt[1] + 120}`} fill="none" stroke="#ccc" strokeWidth={3} />
      <g transform={`rotate(${Math.sin(f / 10) * 10} ${kt[0]} ${kt[1]})`} filter="url(#glow)">
        <path d={`M ${kt[0]} ${kt[1] - 120} L ${kt[0] + 90} ${kt[1]} L ${kt[0]} ${kt[1] + 120} L ${kt[0] - 90} ${kt[1]} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={5} />
        <path d={`M ${kt[0]} ${kt[1] - 120} V ${kt[1] + 120} M ${kt[0] - 90} ${kt[1]} H ${kt[0] + 90}`} stroke="#888" strokeWidth={4} />
        <path d={`M ${kt[0]} ${kt[1] + 120} ${Array.from({ length: 5 }, (_, i) => `q ${20 * Math.sin(f / 4 + i)} 30 0 60`).join(" ")}`} fill="none" stroke="#fff" strokeWidth={4} />
      </g>
      <Figure x={s.left + 180} ground={gy} s={0.8} pose={{ ...STAND, rs: 130, re: 130, t: -6 }} headDown={-30} />
    </Frame>
  );
}

// Holding a bunch of balloons, the figure lifts off the ground.
export function Balloon({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const lift = k01(f, dur * 0.3, dur, { ...clamp, easing: Easing.in(Easing.quad) }) * 280;
  const hand: Pt = [s.cx + 60, gy - 560 - lift];
  const balls: Pt[] = [[-120, -380], [0, -440], [120, -380], [-60, -280], [70, -290]];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {balls.map(([dx, dy], i) => {
        const b: Pt = [hand[0] + dx + Math.sin(f / 15 + i) * 15, hand[1] + dy];
        return (
          <g key={i}>
            <line x1={hand[0]} y1={hand[1]} x2={b[0]} y2={b[1] + 90} stroke="#aaa" strokeWidth={3} />
            <ellipse cx={b[0]} cy={b[1]} rx={75} ry={90} fill={i === 1 ? "#fff" : "#999"} stroke="#fff" strokeWidth={4} filter={i === 1 ? "url(#glow)" : undefined} />
            <ellipse cx={b[0] - 25} cy={b[1] - 35} rx={14} ry={22} fill="#fff" opacity={0.6} />
          </g>
        );
      })}
      <Figure x={s.cx} ground={gy - lift} s={0.8} front pose={{ ...STAND, lh: -6 - lift / 40, rh: 6 + lift / 40 }} hands={[[-60, -300], [60 / 0.8, (hand[1] - (gy - lift - 185 * 0.8)) / 0.8]]} />
    </Frame>
  );
}

// One lit figure leads; a line of grey followers falls in behind.
export function Lead({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const x = interpolate(f, [0, dur], [s.cx - 40, s.cx + 300]);
  const n = 5;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={50} offset={f * 3} />
      {Array.from({ length: n }, (_, i) => {
        const join = k01(f, i * 8, i * 8 + 12, clamp);
        const fx = x - 180 * (i + 1) - (1 - join) * 200;
        return <g key={i} opacity={join}><Figure x={fx} ground={gy} s={0.75 - i * 0.03} pose={walk(fx / (walkRate() * 0.75))} color="#555" glow={false} /></g>;
      })}
      <Figure x={x} ground={gy} s={0.8} pose={walk(x / (walkRate() * 0.8))} />
    </Frame>
  );
}
