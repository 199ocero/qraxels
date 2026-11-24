import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// Mind, habits and self-image pictures. Every scene takes only an optional label.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);

// A brain; sparks race along its folds and it lights up region by region.
export function Brain({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy];
  const lit = k01(f, 0, dur * 0.8);
  const folds = [
    `M ${c[0] - 300} ${c[1]} q 40 -120 140 -90 q 40 -110 160 -60 q 80 -90 170 0 q 120 -20 130 100`,
    `M ${c[0] - 280} ${c[1] + 80} q 80 -60 160 0 q 60 -70 140 0 q 80 -60 160 10`,
    `M ${c[0] - 220} ${c[1] + 170} q 70 -50 140 0 q 70 -50 140 0 q 60 -40 120 10`,
    `M ${c[0]} ${c[1] - 260} q -20 100 10 180 q 20 100 -10 220`,
  ];
  return (
    <Frame p={p} t={t}>
      <path d={`M ${c[0] - 330} ${c[1] + 40} Q ${c[0] - 360} ${c[1] - 240} ${c[0] - 100} ${c[1] - 280} Q ${c[0] + 60} ${c[1] - 360} ${c[0] + 220} ${c[1] - 250} Q ${c[0] + 380} ${c[1] - 180} ${c[0] + 340} ${c[1] + 60} Q ${c[0] + 320} ${c[1] + 260} ${c[0] + 100} ${c[1] + 260} Q ${c[0] - 60} ${c[1] + 330} ${c[0] - 220} ${c[1] + 250} Q ${c[0] - 350} ${c[1] + 200} ${c[0] - 330} ${c[1] + 40} Z`} fill={`rgba(255,255,255,${0.05 + 0.25 * lit})`} stroke="#fff" strokeWidth={9} filter="url(#glow)" />
      {folds.map((d, i) => <path key={i} d={d} fill="none" stroke="#bbb" strokeWidth={6} strokeLinecap="round" />)}
      {folds.map((d, i) => <path key={`s${i}`} d={d} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" pathLength={100} strokeDasharray="8 92" strokeDashoffset={-((f * 2 + i * 25) % 100)} filter="url(#glow)" />)}
      <path d={`M ${c[0] - 40} ${c[1] + 270} q 20 120 -20 220 M ${c[0] + 40} ${c[1] + 270} q 0 100 20 220`} fill="none" stroke="#888" strokeWidth={8} />
    </Frame>
  );
}

// A small storm cloud follows the figure, raining only on them; it breaks up into sun.
export function Cloud({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const clear = k01(f, dur * 0.55, dur * 0.85);
  const x = s.cx;
  const cy = gy - 620;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <circle cx={x + 260} cy={cy - 60} r={90} fill="#fff" opacity={clear} filter="url(#glow)" />
      <g opacity={1 - clear} transform={`translate(${-clear * 300} ${-clear * 100})`}>
        {[[-90, 0, 90], [0, -50, 110], [90, 0, 90], [0, 30, 100]].map(([dx, dy, r], i) => <circle key={i} cx={x + dx} cy={cy + dy} r={r} fill="#2a2a2a" stroke="#888" strokeWidth={5} />)}
        {Array.from({ length: 14 }, (_, i) => {
          const u = cyc(f, 18, i * 5);
          const rx = x - 150 + (i * 23) % 300;
          return <line key={i} x1={rx} y1={cy + 90 + u * 380} x2={rx - 6} y2={cy + 130 + u * 380} stroke="#bbb" strokeWidth={4} opacity={1 - u} />;
        })}
        {f % 40 < 3 && <path d={`M ${x + 20} ${cy + 80} l -40 90 h 40 l -50 110`} fill="none" stroke="#fff" strokeWidth={8} />}
      </g>
      <Figure x={x} ground={gy} s={0.9} front pose={mix({ ...STAND, t: 0, ls: 10, rs: -10 }, VICTORY, clear)} headDown={35 * (1 - clear)} color={clear > 0.5 ? "#ececec" : "#8a8a8a"} />
    </Frame>
  );
}

// A dot finds its way through a maze, top-down.
export function Maze({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 7, cell = 120;
  const x0 = s.cx - (n * cell) / 2, y0 = s.cy - (n * cell) / 2 + 30;
  // Walls as cell edges: [col,row,dir] where dir 0 = right wall, 1 = bottom wall.
  const walls: [number, number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const h = (r * 7 + c * 13 + r * c) % 5;
    if (c < n - 1 && h < 2 && !(r === 3)) walls.push([c, r, 0]);
    if (r < n - 1 && h === 3 && c !== 0 && c !== n - 1) walls.push([c, r, 1]);
  }
  const route: Pt[] = [[0, 0], [0, 3], [3, 3], [3, 1], [6, 1], [6, 6]];
  const segs = route.slice(1).map((q, i) => Math.abs(q[0] - route[i][0]) + Math.abs(q[1] - route[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let left = k01(f, 4, dur * 0.85, clamp) * total;
  const trail: Pt[] = [route[0]];
  for (let i = 0; i < segs.length && left > 0; i++) {
    const u = Math.min(1, left / segs[i]);
    trail.push(lerp(route[i], route[i + 1], u));
    left -= segs[i];
  }
  const px = (q: Pt): Pt => [x0 + q[0] * cell + cell / 2, y0 + q[1] * cell + cell / 2];
  const head = px(trail[trail.length - 1]);
  return (
    <Frame p={p} t={t}>
      <rect x={x0} y={y0} width={n * cell} height={n * cell} fill="none" stroke="#fff" strokeWidth={10} />
      {walls.map(([c, r, d], i) => d === 0
        ? <line key={i} x1={x0 + (c + 1) * cell} y1={y0 + r * cell} x2={x0 + (c + 1) * cell} y2={y0 + (r + 1) * cell} stroke="#888" strokeWidth={8} strokeLinecap="round" />
        : <line key={i} x1={x0 + c * cell} y1={y0 + (r + 1) * cell} x2={x0 + (c + 1) * cell} y2={y0 + (r + 1) * cell} stroke="#888" strokeWidth={8} strokeLinecap="round" />)}
      <polyline points={trail.map((q) => px(q).join(",")).join(" ")} fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <rect x={x0 + 6 * cell + 20} y={y0 + 6 * cell + 20} width={cell - 40} height={cell - 40} fill="#fff" opacity={0.5 + 0.5 * Math.sin(f / 4)} />
      <circle cx={head[0]} cy={head[1]} r={30} fill="#fff" filter="url(#glow)" />
    </Frame>
  );
}

// A book's pages flip fast.
export function Book({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 140];
  const page = (u: number, key: number) => {
    const sx = Math.cos(u * Math.PI);
    return (
      <g key={key} transform={`translate(${c[0]} 0) scale(${sx} 1) translate(${-c[0]} 0)`}>
        <path d={`M ${c[0]} ${c[1] - 360} q 180 -40 360 0 v 420 q -180 -40 -360 0 Z`} fill={sx > 0 ? "#e6e6e6" : "#bbb"} stroke="#fff" strokeWidth={4} />
        {sx > 0 && [0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={c[0] + 50} y1={c[1] - 290 + i * 55} x2={c[0] + 310} y2={c[1] - 290 + i * 55} stroke="#777" strokeWidth={6} />)}
      </g>
    );
  };
  return (
    <Frame p={p} t={t}>
      <path d={`M ${c[0] - 380} ${c[1] - 340} v 440 q 190 -50 380 0 q 190 -50 380 0 v -440`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <path d={`M ${c[0]} ${c[1] - 360} q -180 -40 -360 0 v 420 q 180 -40 360 0 Z`} fill="#e6e6e6" />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={c[0] - 310} y1={c[1] - 290 + i * 55} x2={c[0] - 50} y2={c[1] - 290 + i * 55} stroke="#777" strokeWidth={6} />)}
      {page(0, 0)}
      {[0, 1].map((k) => page(cyc(f, 14, k * 7), k + 1))}
      {big(`PAGE ${Math.floor(f / 7) + 1}`, c[0], c[1] + 250, 70, "#888")}
    </Frame>
  );
}

// An alarm clock rings and rattles; the figure in bed slaps snooze, then gets up.
export function Alarm({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const up = k01(f, dur * 0.55, dur * 0.8);
  const ring = f < dur * 0.5;
  const sh = ring ? Math.sin(f * 2.5) * 8 : 0;
  const clk: Pt = [s.cx + 300, gy - 360];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left} y={gy - 200} width={620} height={120} rx={20} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />
      <rect x={s.left} y={gy - 360} width={40} height={360} fill="#ccc" />
      <rect x={s.left + 40} y={gy - 260} width={150} height={60} rx={20} fill="#e6e6e6" />
      {up < 0.1
        ? <Figure x={s.left + 300} y={gy - 230} s={0.6} pose={{ ...STAND, t: -90, ls: -90, le: -90, rs: -90, re: -90, lh: -90, lk: -90, rh: -90, rk: -90 }} headDown={0} />
        : <Figure x={s.left + 300 + up * 300} ground={gy} s={0.7} pose={mix(SIT, STAND, up)} />}
      <rect x={s.left + 40} y={gy - 250} width={560} height={60} rx={20} fill="#555" opacity={1 - up} />
      <rect x={clk[0] + 100} y={gy - 200} width={180} height={200} fill="#141414" stroke="#888" strokeWidth={5} />
      <g transform={`rotate(${sh} ${clk[0] + 190} ${clk[1] + 80})`}>
        <circle cx={clk[0] + 190} cy={clk[1]} r={110} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        {[-1, 1].map((d) => <circle key={d} cx={clk[0] + 190 + d * 80} cy={clk[1] - 100} r={40} fill="#ccc" />)}
        <line x1={clk[0] + 190} y1={clk[1]} x2={clk[0] + 190} y2={clk[1] - 70} stroke="#111" strokeWidth={10} />
        <line x1={clk[0] + 190} y1={clk[1]} x2={clk[0] + 240} y2={clk[1]} stroke="#111" strokeWidth={10} />
      </g>
      {ring && [0, 1, 2].map((i) => <path key={i} d={`M ${clk[0] + 330 + i * 30} ${clk[1] - 80} q 30 80 0 160`} fill="none" stroke="#fff" strokeWidth={6} opacity={(f + i * 3) % 8 < 4 ? 1 : 0.3} />)}
    </Frame>
  );
}

// Slumped on the couch, the TV's flicker on the figure.
export function Couch({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const flick = 0.3 + 0.25 * Math.abs(Math.sin(f * 0.7) * Math.cos(f * 0.31));
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.right - 330} y={gy - 600} width={330} height={260} rx={14} fill="#fff" opacity={flick + 0.3} filter="url(#glow)" />
      <rect x={s.right - 230} y={gy - 340} width={130} height={340} fill="#222" />
      <polygon points={`${s.right - 330},${gy - 600} ${s.left + 60},${gy - 700} ${s.left + 60},${gy} ${s.right - 330},${gy - 340}`} fill="#fff" opacity={flick * 0.2} />
      <rect x={s.left} y={gy - 360} width={540} height={220} rx={40} fill="#1a1a1a" stroke="#bbb" strokeWidth={6} />
      <rect x={s.left - 10} y={gy - 220} width={560} height={160} rx={30} fill="#222" stroke="#bbb" strokeWidth={6} />
      <Figure x={s.left + 260} ground={gy - 90} s={0.75} pose={{ ...SIT, t: -20 }} headDown={10} color="#9a9a9a" />
      {[0, 1].map((k) => <rect key={k} x={s.left + 60 + k * 400} y={gy - 70} width={30} height={70} fill="#bbb" />)}
      {big(`${1 + Math.floor(f / 6) % 1}:${String(Math.floor(f / 1.5) % 60).padStart(2, "0")} AM`, s.right - 165, gy - 450, 70, "#000")}
    </Frame>
  );
}

// Notification bubbles keep popping up around the figure.
export function Pings({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = Math.floor(interpolate(f, [0, dur * 0.85], [1, 12], clamp));
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx} ground={gy} s={0.9} front pose={{ ...STAND, ls: 20, le: 150, rs: -20, re: -150 }} headDown={25} />
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = [s.left + 60 + ((i * 263) % (s.width - 300)), s.top + 200 + ((i * 181) % 640)];
        const k = k01(f, tickAt(i - 1, 11, dur) , tickAt(i - 1, 11, dur) + 6, pop);
        return (
          <g key={i} transform={`translate(${x + 120} ${y + 40}) scale(${i === 0 ? 1 : k}) translate(${-x - 120} ${-y - 40})`}>
            <rect x={x} y={y} width={240} height={80} rx={20} fill="#1a1a1a" stroke="#ddd" strokeWidth={4} />
            <circle cx={x + 40} cy={y + 40} r={20} fill="#fff" />
            <rect x={x + 76} y={y + 26} width={130} height={12} fill="#888" />
            <rect x={x + 76} y={y + 48} width={90} height={10} fill="#555" />
            <circle cx={x + 236} cy={y + 4} r={18} fill="#fff" />
          </g>
        );
      })}
    </Frame>
  );
}

// Asleep under the moon; Zs drift up. Rest, recovery.
export function Sleep({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.right - 120} ${s.top + 140} a 110 110 0 1 0 90 170 a 90 90 0 1 1 -90 -170 Z`} fill="#e6e6e6" filter="url(#glow)" />
      {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={(i * 173) % W} cy={s.top + 80 + ((i * 97) % 400)} r={3 + (i % 3)} fill="#fff" opacity={0.3 + 0.5 * Math.abs(Math.sin(f / 15 + i))} />)}
      <rect x={s.left + 40} y={gy - 160} width={s.width - 80} height={100} rx={20} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />
      <rect x={s.left + 40} y={gy - 320} width={40} height={320} fill="#ccc" />
      <rect x={s.right - 80} y={gy - 240} width={40} height={240} fill="#ccc" />
      <rect x={s.left + 90} y={gy - 230} width={160} height={70} rx={30} fill="#e6e6e6" />
      <path d={`M ${s.left + 230} ${gy - 160} q 0 ${-90 - 6 * Math.sin(f / 15)} 120 -100 h 360 q 40 0 40 100 Z`} fill="#555" stroke="#aaa" strokeWidth={5} />
      <rect x={s.left + 140} y={gy - 290} width={100} height={90} rx={20} fill="#ececec" />
      {[0, 1, 2].map((i) => {
        const u = cyc(f, 60, i * 20);
        return big("Z", s.left + 240 + u * 160 + i * 10, gy - 320 - u * 380, 60 + u * 60, "#fff", i);
      })}
    </Frame>
  );
}

// Sitting cross-legged, hovering, calm rings pulsing out.
export function Meditate({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const hov = 60 + Math.sin(f / 18) * 20;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[0, 1, 2].map((i) => {
        const u = cyc(f, 60, i * 20);
        return <circle key={i} cx={s.cx} cy={gy - 330} r={150 + u * 400} fill="none" stroke="#fff" strokeWidth={5} opacity={0.5 * (1 - u)} />;
      })}
      <ellipse cx={s.cx} cy={gy} rx={130 - hov * 0.6} ry={14} fill="#fff" opacity={0.15} />
      <Figure x={s.cx} ground={gy - hov} s={0.9} front pose={{ t: 0, ls: -30, le: 20, rs: 30, re: -20, lh: -95, lk: 60, rh: 95, rk: -60 }} />
    </Frame>
  );
}

// A pen writes line after line in a journal.
export function Journal({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pg = { x: s.cx - 320, y: s.top + 140, w: 640, h: 820 };
  const lines = 9;
  const k = k01(f, 0, dur * 0.9, clamp) * lines;
  const cur = Math.min(lines - 1, Math.floor(k));
  const u = k - cur;
  const lw = (i: number) => pg.w - 140 - ((i * 97) % 180);
  const pen: Pt = [pg.x + 70 + lw(cur) * Math.min(1, u), pg.y + 120 + cur * 80 + Math.sin(f * 1.6) * 8];
  return (
    <Frame p={p} t={t}>
      <rect x={pg.x} y={pg.y} width={pg.w} height={pg.h} rx={12} fill="#e6e6e6" />
      <line x1={pg.x + 50} y1={pg.y} x2={pg.x + 50} y2={pg.y + pg.h} stroke="#999" strokeWidth={3} />
      {Array.from({ length: lines }, (_, i) => {
        const w = i < cur ? lw(i) : i === cur ? lw(i) * Math.min(1, u) : 0;
        const pts = Array.from({ length: Math.max(2, Math.floor(w / 20)) }, (_, j) => `${pg.x + 70 + (j * w) / Math.max(1, Math.floor(w / 20) - 1)},${pg.y + 120 + i * 80 + Math.sin(j * 1.7 + i) * 9}`).join(" ");
        return w > 4 ? <polyline key={i} points={pts} fill="none" stroke="#111" strokeWidth={6} strokeLinecap="round" /> : null;
      })}
      <g transform={`translate(${pen[0]} ${pen[1]}) rotate(35)`}>
        <rect x={-14} y={-300} width={28} height={280} rx={8} fill="#222" stroke="#fff" strokeWidth={4} />
        <path d="M -14 -20 L 0 10 L 14 -20 Z" fill="#fff" />
      </g>
    </Frame>
  );
}

// The figure holds up a smiling mask; it lowers to show the head hung behind it.
export function Mask({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const down = k01(f, dur * 0.4, dur * 0.65);
  const head: Pt = [s.cx, gy - 520];
  const mk: Pt = [s.cx + 30, head[1] + down * 300];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx} ground={gy} s={1} front pose={STAND} hands={[[60, -330 + down * 300], [-40, -330 + down * 300]]} headDown={30 * down} color={down > 0.5 ? "#8a8a8a" : "#ececec"} />
      <g transform={`translate(${mk[0]} ${mk[1]}) rotate(${down * 25})`}>
        <ellipse rx={100} ry={120} fill="#e6e6e6" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
        {[-40, 40].map((x) => <path key={x} d={`M ${x - 22} -20 q 22 -26 44 0`} fill="none" stroke="#111" strokeWidth={9} strokeLinecap="round" />)}
        <path d="M -50 40 q 50 50 100 0" fill="none" stroke="#111" strokeWidth={10} strokeLinecap="round" />
      </g>
    </Frame>
  );
}

// A small figure, but its shadow on the wall is a giant standing tall.
export function Shadow({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const grow = k01(f, 0, dur * 0.7);
  return (
    <Frame p={p} t={t}>
      <rect x={s.left} y={s.top + 60} width={s.width} height={gy - s.top - 60} fill="#141414" />
      <polygon points={`${s.left},${gy} ${s.cx - 300},${s.top + 60} ${s.right},${s.top + 60} ${s.right},${gy}`} fill="#fff" opacity={0.06} />
      <Figure x={s.cx + 60} ground={gy} s={0.9 + 1.1 * grow} front pose={mix(STAND, VICTORY, grow)} color="#000" glow={false} />
      <Ground y={gy} />
      <Figure x={s.left + 200} ground={gy} s={0.55} pose={mix(STAND, VICTORY, grow)} />
      <circle cx={s.left - 40} cy={gy - 100} r={50} fill="#fff" filter="url(#glow)" />
    </Frame>
  );
}

// Inside a birdcage; the door was open all along, the figure steps out.
export function Cage({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const c = { x: s.cx - 80, w: 500, top: s.top + 160 };
  const door = k01(f, dur * 0.2, dur * 0.4);
  const out = k01(f, dur * 0.45, dur * 0.95, clamp);
  const fx = c.x + 160 + out * 420;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${c.x - c.w / 2} ${gy} V ${c.top + 260} Q ${c.x - c.w / 2} ${c.top} ${c.x} ${c.top} Q ${c.x + c.w / 2} ${c.top} ${c.x + c.w / 2} ${c.top + 260}`} fill="none" stroke="#fff" strokeWidth={9} filter="url(#glow)" />
      {Array.from({ length: 9 }, (_, i) => {
        const x = c.x - c.w / 2 + (i * c.w) / 8;
        const yTop = c.top + 260 - Math.sqrt(Math.max(0, 1 - ((x - c.x) / (c.w / 2)) ** 2)) * 260;
        return i > 5 && i < 8 ? null : <line key={i} x1={x} y1={yTop} x2={x} y2={gy} stroke="#ccc" strokeWidth={6} />;
      })}
      <g transform={`translate(${c.x + c.w / 2} 0) scale(${Math.cos(door * 1.4)} 1) translate(${-(c.x + c.w / 2)} 0)`}>
        {[1, 2].map((i) => <line key={i} x1={c.x + c.w / 2 - i * (c.w / 8)} y1={gy - 460} x2={c.x + c.w / 2 - i * (c.w / 8)} y2={gy} stroke="#fff" strokeWidth={7} />)}
        <rect x={c.x + c.w / 2 - c.w / 4} y={gy - 460} width={c.w / 4} height={10} fill="#fff" />
      </g>
      <circle cx={c.x} cy={c.top - 30} r={30} fill="none" stroke="#ccc" strokeWidth={7} />
      <Figure x={fx} ground={gy} s={0.75} pose={out > 0 && out < 1 ? walk((out * 420) / (walkRate() * 0.75)) : out >= 1 ? VICTORY : STAND} headDown={out > 0 ? 0 : 25} />
    </Frame>
  );
}

// Trapped in a box; the figure pushes the lid off and climbs out.
export function OutBox({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const b = { x: s.cx - 220, w: 440, h: 440 };
  const lid = k01(f, dur * 0.3, dur * 0.5, pop);
  const climb = k01(f, dur * 0.5, dur * 0.8);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx} ground={gy - 20 - climb * b.h} s={0.8} front pose={climb >= 1 ? VICTORY : { ...STAND, ls: 160, le: 175, rs: -160, re: -175 }} headDown={climb >= 1 ? 0 : -20} />
      <rect x={b.x} y={gy - b.h} width={b.w} height={b.h} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <path d={`M ${b.x} ${gy - b.h} l 60 -50 h ${b.w} l -60 50 M ${b.x + b.w} ${gy} l 60 -50 v ${-b.h}`} fill="none" stroke="#fff" strokeWidth={6} />
      <g transform={`translate(${lid * 360} ${-lid * 260 + lid * lid * 200}) rotate(${lid * 50} ${b.x + b.w / 2} ${gy - b.h - 30})`}>
        <rect x={b.x - 20} y={gy - b.h - 50} width={b.w + 80} height={40} rx={8} fill="#cfcfcf" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
      </g>
      {f < dur * 0.3 && Math.floor(f / 6) % 2 === 0 && [0, 1].map((i) => <line key={i} x1={b.x + 120 + i * 200} y1={gy - b.h - 70} x2={b.x + 120 + i * 200} y2={gy - b.h - 110} stroke="#fff" strokeWidth={6} />)}
    </Frame>
  );
}

// A glass fills from empty to full.
export function Glass({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const g = { x: s.cx, top: s.top + 280, bot: s.bottom - 120 };
  const lvl = k01(f, 4, dur * 0.8);
  const wy = g.bot - (g.bot - g.top - 30) * lvl;
  const half = (y: number) => 220 - ((g.bot - y) / (g.bot - g.top)) * -60;
  return (
    <Frame p={p} t={t}>
      {lvl < 1 && <rect x={g.x - 14} y={s.top + 60} width={28} height={wy - s.top - 60} fill="#bbb" opacity={0.8} />}
      <path d={`M ${g.x - half(wy)} ${wy} Q ${g.x} ${wy + Math.sin(f / 3) * 14} ${g.x + half(wy)} ${wy} L ${g.x + 220} ${g.bot} H ${g.x - 220} Z`} fill="#888" />
      <path d={`M ${g.x - 280} ${g.top} L ${g.x - 220} ${g.bot} H ${g.x + 220} L ${g.x + 280} ${g.top}`} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
      <line x1={g.x - 210} y1={g.top + 60} x2={g.x - 170} y2={g.bot - 60} stroke="#fff" strokeOpacity={0.3} strokeWidth={14} strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={g.x - 120 + i * 80} cy={g.bot - 40 - cyc(f, 40, i * 10) * (g.bot - wy - 40)} r={8} fill="none" stroke="#fff" strokeWidth={3} />)}
    </Frame>
  );
}

// The tip of an iceberg above the water; the camera drops below to show the mass under it.
export function Iceberg({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.top + 400;
  const bob = Math.sin(f / 20) * 8;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={sea} width={W} height={1200} fill="#fff" opacity={0.05} />
      <path d={`M ${s.cx - 140} ${sea + bob} L ${s.cx - 40} ${sea - 180 + bob} L ${s.cx + 30} ${sea - 120 + bob} L ${s.cx + 90} ${sea - 220 + bob} L ${s.cx + 170} ${sea + bob} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      <path d={`M ${s.cx - 140} ${sea + bob} L ${s.cx - 380} ${sea + 300} L ${s.cx - 300} ${sea + 700} L ${s.cx - 60} ${sea + 980} L ${s.cx + 260} ${sea + 880} L ${s.cx + 420} ${sea + 420} L ${s.cx + 170} ${sea + bob} Z`} fill="#2a2a2a" stroke="#aaa" strokeWidth={6} strokeDasharray="20 10" />
      <path d={`M 0 ${sea} ${Array.from({ length: 12 }, (_, i) => `q 45 ${i % 2 ? 14 : -14} 90 0`).join(" ")}`} transform={`translate(${-((f * 2) % 180)} 0)`} fill="none" stroke="#fff" strokeWidth={5} />
      {big("10%", s.cx + 330, sea - 80, 80, "#fff")}
      {big("90%", s.cx, sea + 560, 140, "#777")}
    </Frame>
  );
}

// A compass needle spins wildly, then locks on.
export function Compass({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy];
  const settle = k01(f, dur * 0.2, dur * 0.65);
  const ang = (1 - settle) * (f * 25) + settle * 0 + (1 - settle) * 0 + Math.sin(f / 3) * 30 * (1 - settle) + (settle >= 1 ? Math.sin(f / 2) * 1.5 : 0);
  const tip = go(c, 180 - ang, 300);
  const tail = go(c, -ang, 300);
  return (
    <Frame p={p} t={t}>
      <circle cx={c[0]} cy={c[1]} r={400} fill="#141414" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
      <circle cx={c[0]} cy={c[1]} r={350} fill="none" stroke="#555" strokeWidth={4} />
      {Array.from({ length: 36 }, (_, i) => {
        const [a, b] = [go(c, i * 10, 350), go(c, i * 10, i % 9 ? 330 : 300)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#999" strokeWidth={i % 9 ? 3 : 8} />;
      })}
      {(["N", "E", "S", "W"] as const).map((n, i) => {
        const q = go(c, 180 - i * 90, 250);
        return big(n, q[0], q[1] + 28, 80, i === 0 ? "#fff" : "#777", n);
      })}
      <path d={`M ${tip[0]} ${tip[1]} L ${go(c, 90 - ang, 40)[0]} ${go(c, 90 - ang, 40)[1]} L ${tail[0]} ${tail[1]} L ${go(c, 270 - ang, 40)[0]} ${go(c, 270 - ang, 40)[1]} Z`} fill="#777" />
      <path d={`M ${tip[0]} ${tip[1]} L ${go(c, 90 - ang, 40)[0]} ${go(c, 90 - ang, 40)[1]} L ${go(c, 270 - ang, 40)[0]} ${go(c, 270 - ang, 40)[1]} Z`} fill="#fff" filter="url(#glow)" />
      <circle cx={c[0]} cy={c[1]} r={24} fill="#fff" />
    </Frame>
  );
}

// A dotted route draws itself across a map to the X.
export function Route({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 4, dur * 0.8);
  const d = `M ${s.left + 80} ${s.bottom - 120} C ${s.left + 400} ${s.bottom - 200}, ${s.left + 50} ${s.cy}, ${s.cx} ${s.cy + 20} S ${s.right - 50} ${s.cy - 120}, ${s.right - 140} ${s.top + 200}`;
  const x: Pt = [s.right - 140, s.top + 200];
  return (
    <Frame p={p} t={t}>
      <rect x={s.left} y={s.top + 80} width={s.width} height={s.height - 80} rx={16} fill="#141414" stroke="#ccc" strokeWidth={6} />
      {[0, 1, 2].map((i) => <path key={i} d={`M ${s.left + 100 + i * 280} ${s.top + 200 + i * 180} q 80 -60 160 0 q 60 60 0 120 q -100 40 -160 -20 Z`} fill="#2a2a2a" />)}
      {[0, 1, 2, 3, 4].map((i) => <line key={`g${i}`} x1={s.left} y1={s.top + 80 + i * 200} x2={s.right} y2={s.top + 80 + i * 200} stroke="#fff" strokeOpacity={0.06} strokeWidth={2} />)}
      <path d={d} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" pathLength={100} strokeDasharray={`${k * 100} 100`} />
      <path d={d} fill="none" stroke="#141414" strokeWidth={12} pathLength={100} strokeDasharray="3 4" />
      <circle cx={s.left + 80} cy={s.bottom - 120} r={22} fill="#fff" />
      <g filter={k >= 1 ? "url(#glow)" : undefined} opacity={0.4 + 0.6 * k}>
        <path d={`M ${x[0] - 50} ${x[1] - 50} L ${x[0] + 50} ${x[1] + 50} M ${x[0] + 50} ${x[1] - 50} L ${x[0] - 50} ${x[1] + 50}`} stroke="#fff" strokeWidth={22} strokeLinecap="round" />
      </g>
    </Frame>
  );
}

// Looking through a telescope at one bright star.
export function Vision({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const star: Pt = [s.right - 120, s.top + 180];
  const tw = 1 + 0.25 * Math.sin(f / 4);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 211) % W} cy={s.top + 40 + ((i * 131) % 700)} r={2 + (i % 3)} fill="#fff" opacity={0.2 + 0.4 * Math.abs(Math.sin(f / 20 + i))} />)}
      <g transform={`translate(${star[0]} ${star[1]}) scale(${tw})`} filter="url(#glow)">
        <path d="M 0 -70 L 14 -14 L 70 0 L 14 14 L 0 70 L -14 14 L -70 0 L -14 -14 Z" fill="#fff" />
      </g>
      <Ground y={gy} />
      <g transform={`rotate(-38 ${s.cx} ${gy - 330})`}>
        <rect x={s.cx - 60} y={gy - 380} width={420} height={90} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
        <rect x={s.cx + 340} y={gy - 395} width={60} height={120} rx={10} fill="#ccc" />
      </g>
      {[-1, 1].map((d) => <line key={d} x1={s.cx + 40} y1={gy - 300} x2={s.cx + 40 + d * 110} y2={gy} stroke="#ccc" strokeWidth={8} />)}
      <Figure x={s.cx - 200} ground={gy} s={0.8} pose={{ ...STAND, t: 10, rs: 100, re: 120, ls: 80, le: 120 }} headDown={-25} />
    </Frame>
  );
}

// Footprints appear one at a time across the sand.
export function Footsteps({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 10;
  const shown = Math.floor(k01(f, 0, dur * 0.85, clamp) * n);
  const foot = (x: number, y: number, a: number, key: number, o: number) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${a})`} opacity={o}>
      <ellipse rx={38} ry={66} fill="#e6e6e6" />
      {[-26, -10, 8, 24].map((dx, i) => <circle key={i} cx={dx} cy={-84 + Math.abs(dx) * 0.4} r={11 - i * 1.5} fill="#e6e6e6" />)}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M ${(i * 97) % W} ${s.top + 100 + ((i * 151) % 900)} q 30 -10 60 0`} stroke="#fff" strokeOpacity={0.12} strokeWidth={3} fill="none" />)}
      {Array.from({ length: shown + 1 }, (_, i) => {
        const y = s.bottom - 80 - i * 105;
        const x = s.cx + (i % 2 ? 70 : -70) + Math.sin(i / 2) * 60;
        return foot(x, y, Math.cos(i / 2) * 12, i, i === shown ? k01(f % (dur * 0.85 / n), 0, 4, clamp) : 0.4 + 0.6 * (i / n));
      })}
    </Frame>
  );
}

// A lit circle on the floor marked COMFORT ZONE; the figure steps out of it into the dark.
export function Zone({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 160;
  const out = k01(f, dur * 0.3, dur * 0.8);
  return (
    <Frame p={p} t={t}>
      <polygon points={`${s.cx - 30},${s.top - 200} ${s.cx + 30},${s.top - 200} ${s.cx + 320},${gy + 40} ${s.cx - 320},${gy + 40}`} fill="#fff" opacity={0.12} />
      <ellipse cx={s.cx - 100} cy={gy} rx={320} ry={90} fill="#fff" opacity={0.15} stroke="#fff" strokeWidth={6} />
      <text x={s.cx - 100} y={gy + 140} textAnchor="middle" fontSize={50} fontFamily={font.impact} fill="#777" letterSpacing={6}>COMFORT ZONE</text>
      <Figure x={s.cx - 100 + out * 460} ground={gy} s={0.8} pose={out > 0 && out < 1 ? walk((out * 460) / (walkRate() * 0.8)) : STAND} color={out > 0.8 ? "#ffffff" : "#ececec"} />
      {out >= 1 && [0, 1, 2].map((i) => <circle key={i} cx={s.cx + 360} cy={gy - 300} r={100 + cyc(f, 30, i * 10) * 300} fill="none" stroke="#fff" strokeWidth={4} opacity={0.5 * (1 - cyc(f, 30, i * 10))} />)}
    </Frame>
  );
}

// Pulled back in a giant slingshot, then launched.
export function Slingshot({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.55;
  const pull = k01(f, 0, at * 0.9);
  const fly = k01(f, at, at + dur * 0.3, { ...clamp, easing: Easing.out(Easing.quad) });
  const fork = { x: s.cx + 180, y: gy - 560 };
  const pouch: Pt = fly > 0 ? [fork.x, fork.y + 40] : [fork.x - 80 - pull * 380, fork.y + 40 + pull * 120];
  const body: Pt = fly > 0 ? [fork.x + fly * 300, fork.y - fly * 520] : pouch;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${fork.x} ${gy} V ${fork.y + 200} L ${fork.x - 100} ${fork.y} M ${fork.x} ${fork.y + 200} L ${fork.x + 100} ${fork.y}`} fill="none" stroke="#cfcfcf" strokeWidth={36} strokeLinecap="round" />
      <path d={`M ${fork.x - 100} ${fork.y} L ${pouch[0]} ${pouch[1]} L ${fork.x + 100} ${fork.y}`} fill="none" stroke="#fff" strokeWidth={8} />
      <Figure x={body[0] + 40} y={body[1] - 40} s={0.6} pose={fly > 0 ? { ...VICTORY, t: 40 } : { ...SIT, t: -20 }} trail={fly > 0 && fly < 1 ? [VICTORY, VICTORY] : []} />
      {fly > 0 && fly < 0.6 && Array.from({ length: 6 }, (_, i) => <line key={i} x1={body[0] - 80 - i * 30} y1={body[1] + 100 + i * 40} x2={body[0] - 200 - i * 30} y2={body[1] + 260 + i * 40} stroke="#fff" strokeWidth={5} opacity={0.5} />)}
    </Frame>
  );
}

// A coiled spring compresses under the figure, then fires it up.
export function Spring({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.5;
  const sq = k01(f, 0, at);
  const air = f > at ? Math.max(0, Math.sin(((f - at) / (dur * 0.5)) * Math.PI) * 700) : 0;
  const h = f > at ? Math.min(360, 140 + (f - at) * 40) : 360 - 220 * sq;
  const coils = 8;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${s.cx} ${gy} ${Array.from({ length: coils }, (_, i) => `L ${s.cx + (i % 2 ? -120 : 120)} ${gy - ((i + 0.5) * h) / coils}`).join(" ")} L ${s.cx} ${gy - h}`} fill="none" stroke="#fff" strokeWidth={14} strokeLinejoin="round" filter="url(#glow)" />
      <rect x={s.cx - 160} y={gy - h - 20} width={320} height={24} rx={8} fill="#cfcfcf" />
      <Figure x={s.cx} ground={gy - h - 20} air={air} s={0.75} front pose={air > 0 ? VICTORY : mix(STAND, { ...SIT, t: 0, lh: -60, lk: 30, rh: 60, rk: -30 }, sq * 0.6)} />
    </Frame>
  );
}

// A seesaw tips back and forth: balance.
export function Seesaw({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const piv: Pt = [s.cx, gy - 200];
  const a = Math.sin(f / 18) * 14 * (1 - k01(f, dur * 0.5, dur * 0.9));
  const end = (d: number): Pt => [piv[0] + Math.cos(a * D) * 420 * d, piv[1] + Math.sin(a * D) * 420 * d];
  const [l, r] = [end(-1), end(1)];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${piv[0] - 90} ${gy} L ${piv[0]} ${piv[1]} L ${piv[0] + 90} ${gy} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <line x1={l[0]} y1={l[1]} x2={r[0]} y2={r[1]} stroke="#fff" strokeWidth={22} strokeLinecap="round" filter="url(#glow)" />
      <rect x={l[0] + 20} y={l[1] - 160} width={160} height={150} rx={12} fill="#555" stroke="#ccc" strokeWidth={5} transform={`rotate(${a} ${l[0] + 100} ${l[1]})`} />
      <Figure x={r[0] - 100} ground={r[1] - 10} s={0.55} pose={STAND} flip />
    </Frame>
  );
}

// Juggling more balls than two hands can hold.
export function Juggle({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 5;
  const hipY = gy - 185 * 0.9;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, i) => {
        const u = cyc(f, 50, (i * 50) / n);
        const x = s.cx + Math.cos(u * 2 * Math.PI) * 220;
        const y = hipY - 360 - Math.sin(u * 2 * Math.PI) * 300 * (u < 0.5 ? 1 : 0.2);
        return <circle key={i} cx={x} cy={y} r={44} fill={i === 0 ? "#fff" : "#888"} stroke="#fff" strokeWidth={4} filter={i === 0 ? "url(#glow)" : undefined} />;
      })}
      <Figure x={s.cx} ground={gy} s={0.9} front pose={STAND} hands={[[-160, -300 + Math.sin(f / 4) * 30], [160, -300 - Math.sin(f / 4) * 30]]} headDown={-15} />
      {[0, 1].map((i) => <circle key={`sw${i}`} cx={s.cx + (i ? 80 : -80)} cy={hipY - 440 + cyc(f, 20, i * 10) * 80} r={8} fill="#fff" opacity={1 - cyc(f, 20, i * 10)} />)}
    </Frame>
  );
}

// Walking a tightrope over the void, arms out.
export function Tightrope({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const ry = s.cy + 120;
  const x = interpolate(f, [0, dur], [s.left + 100, s.right - 100]);
  const sag = 60;
  const yAt = (px: number) => ry + sag * (1 - ((px - s.cx) / (W / 2)) ** 2);
  const wob = Math.sin(f / 7) * 10;
  return (
    <Frame p={p} t={t}>
      {[-1, 1].map((d) => <path key={d} d={`M ${s.cx + d * 600} ${ry - 20} L ${s.cx + d * 420} ${s.bottom + 300}`} stroke="#aaa" strokeWidth={14} />)}
      <path d={`M 0 ${ry} Q ${s.cx} ${ry + sag * 2} ${W} ${ry}`} fill="none" stroke="#fff" strokeWidth={6} />
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={s.left + i * 180} y1={s.bottom + 40 + (i % 2) * 60} x2={s.left + i * 180 + 120} y2={s.bottom + 40 + (i % 2) * 60} stroke="#fff" strokeOpacity={0.1} strokeWidth={3} />)}
      <g transform={`rotate(${wob} ${x} ${yAt(x)})`}>
        <Figure x={x} ground={yAt(x)} s={0.75} pose={{ ...walk(f * 0.08, 0.3), ls: -90, le: -100, rs: 90, re: 100 }} />
        <line x1={x - 300} y1={yAt(x) - 330 + 20} x2={x + 300} y2={yAt(x) - 330 - 20} stroke="#ccc" strokeWidth={8} />
      </g>
    </Frame>
  );
}

// Walking out of thick fog into clear light.
export function Fog({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur, clamp);
  const fx = interpolate(k, [0, 1], [s.left + 60, s.right - 160]);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <circle cx={s.right - 60} cy={s.top + 200} r={140} fill="#fff" opacity={0.2 + 0.6 * k} filter="url(#glow)" />
      <Figure x={fx} ground={gy} s={0.8} pose={walk((fx - s.left) / (walkRate() * 0.8))} color={k > 0.5 ? "#ececec" : "#888"} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = ((i * 157 + f * (1 + (i % 3))) % (W + 600)) - 600;
        const y = s.top + 200 + ((i * 113) % 1000);
        return <ellipse key={i} cx={x + 300} cy={y} rx={360} ry={110} fill="#bbb" opacity={0.28 * (1 - k * 0.9) * (x + 300 < fx + 100 ? 1 : 0.6)} />;
      })}
      <rect x={0} y={s.top} width={W * (1 - k) * 0.7} height={s.height} fill="#888" opacity={0.25} />
    </Frame>
  );
}

// Shouting through a megaphone; sound waves blast out.
export function Megaphone({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const mx = s.cx - 140, my = gy - 470;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx - 300} ground={gy} s={0.9} pose={{ ...STAND, t: 10, rs: 90, re: 90, ls: 70, le: 100 }} />
      <path d={`M ${mx} ${my - 30} L ${mx + 260} ${my - 130} V ${my + 130} L ${mx} ${my + 30} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      <ellipse cx={mx + 260} cy={my} rx={30} ry={130} fill="#ccc" />
      {[0, 1, 2, 3].map((i) => {
        const u = cyc(f, 24, i * 6);
        const r = 160 + u * 420;
        return <path key={i} d={`M ${mx + 200 + r * 0.5} ${my - r * 0.7} Q ${mx + 260 + r} ${my} ${mx + 200 + r * 0.5} ${my + r * 0.7}`} fill="none" stroke="#fff" strokeWidth={10 * (1 - u) + 2} opacity={1 - u} />;
      })}
    </Frame>
  );
}

// Grey figures point and laugh at the lit one, who keeps walking.
export function Pointing({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const x = interpolate(f, [0, dur], [s.left + 40, s.right - 40]);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[0, 1, 2, 3].map((i) => {
        const gx = s.left + 80 + i * 260;
        const facing = gx < x ? 1 : -1;
        return <Figure key={i} x={gx} ground={gy - 220} s={0.5} flip={facing < 0} pose={{ ...STAND, rs: 95, re: 95, t: Math.sin(f / 3 + i) * 6 }} color="#4a4a4a" glow={false} />;
      })}
      {[0, 1, 2, 3].map((i) => f % 30 < 18 && big(["HA", "NO", "LOL", "WHY?"][i], s.left + 80 + i * 260, gy - 560 - (f % 30) * 2, 44, "#666", `t${i}`))}
      <Figure x={x} ground={gy} s={0.8} pose={walk((x - s.left) / (walkRate() * 0.8))} />
    </Frame>
  );
}

// A puppet on strings jerks; the strings snap and it stands on its own.
export function Puppet({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.5;
  const free = f >= at;
  const jerk = free ? 0 : Math.sin(f / 4) * 30;
  const bar = s.top + 120;
  const hands: [Pt, Pt] = free ? [[-60, -40], [60, -40]] : [[-150, -260 + jerk], [150, -200 - jerk]];
  const hipY = gy - 185 * 0.9;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`translate(0 ${free ? -(f - at) * 20 : 0})`} opacity={free ? Math.max(0, 1 - (f - at) / 20) : 1}>
        <rect x={s.cx - 260} y={bar - 20} width={520} height={30} rx={10} fill="#cfcfcf" />
        <rect x={s.cx - 20} y={bar - 120} width={40} height={140} fill="#cfcfcf" />
      </g>
      {[hands[0], hands[1], [0, -440] as Pt].map((h, i) => {
        const end: Pt = [s.cx + h[0] * 0.9, hipY + h[1] * 0.9];
        const len = free ? Math.max(0, 1 - (f - at) / 8) : 1;
        return <line key={i} x1={s.cx + (i - 1) * 220} y1={bar} x2={s.cx + (i - 1) * 220 + (end[0] - s.cx - (i - 1) * 220) * len} y2={bar + (end[1] - bar) * len} stroke="#aaa" strokeWidth={3} />;
      })}
      <Figure x={s.cx} ground={gy} s={0.9} front pose={free ? mix(STAND, VICTORY, k01(f, at + 6, at + 20)) : { ...STAND, lh: -10 + jerk / 3, rh: 10 - jerk / 3 }} hands={free ? undefined : hands} headDown={free ? 0 : 30} />
    </Frame>
  );
}
