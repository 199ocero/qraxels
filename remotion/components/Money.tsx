import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { Bill, D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, mix, walk, walkRate, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// Money and work pictures. Every scene takes only an optional label.

const coin = (x: number, y: number, r = 34, key?: string | number) => (
  <g key={key}>
    <ellipse cx={x} cy={y} rx={r} ry={r * 0.36} fill="#9a9a9a" stroke="#eee" strokeWidth={4} />
  </g>
);
const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);

// Coins drop into a piggy bank; it wobbles with each one.
export function Piggy({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 160];
  const u = cyc(f, 20);
  const wob = Math.sin(f / 20 * Math.PI * 2) * 3 * Math.max(0, 1 - u * 3);
  return (
    <Frame p={p} t={t}>
      <Ground y={c[1] + 250} />
      <g transform={`rotate(${wob} ${c[0]} ${c[1] + 240})`}>
        <ellipse cx={c[0]} cy={c[1]} rx={300} ry={220} fill="#151515" stroke="#fff" strokeWidth={9} filter="url(#glow)" />
        <ellipse cx={c[0] + 300} cy={c[1] + 10} rx={50} ry={70} fill="#151515" stroke="#fff" strokeWidth={8} />
        {[-6, 18].map((d) => <circle key={d} cx={c[0] + 300 + d * 0.6} cy={c[1] + d - 4} r={9} fill="#fff" />)}
        <path d={`M ${c[0] + 120} ${c[1] - 200} l 60 -80 l 30 100`} fill="#151515" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
        {[-180, -60, 60, 180].map((x) => <rect key={x} x={c[0] + x - 30} y={c[1] + 180} width={60} height={70} rx={10} fill="#151515" stroke="#fff" strokeWidth={7} />)}
        <path d={`M ${c[0] - 300} ${c[1] - 20} q -60 -10 -50 -60 q 10 -30 -20 -40`} fill="none" stroke="#fff" strokeWidth={7} />
        <rect x={c[0] - 70} y={c[1] - 225} width={140} height={18} rx={9} fill="#000" stroke="#888" strokeWidth={4} />
        <circle cx={c[0] + 200} cy={c[1] - 70} r={14} fill="#fff" />
      </g>
      {coin(c[0], c[1] - 600 + u * u * 380, 40, "drop")}
      {big(`${Math.min(999, Math.floor(f / 20))}`, c[0], c[1] + 40, 90, "#555")}
    </Frame>
  );
}

// A vault's wheel spins, the door swings open on light.
export function Vault({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 40];
  const spin = interpolate(f, [0, dur * 0.5], [0, 540], ease);
  const open = k01(f, dur * 0.5, dur * 0.8);
  return (
    <Frame p={p} t={t}>
      <rect x={s.left} y={c[1] - 420} width={s.width} height={840} rx={30} fill="#0c0c0c" stroke="#555" strokeWidth={6} />
      <circle cx={c[0]} cy={c[1]} r={340} fill="#fff" opacity={open} filter="url(#glow)" />
      {open > 0 && Array.from({ length: 10 }, (_, i) => {
        const [a, b] = [go(c, i * 36 + f, 360), go(c, i * 36 + f, 360 + 200 * open)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={10} opacity={open * 0.6} strokeLinecap="round" />;
      })}
      <g transform={`translate(${c[0] - 340} 0) scale(${1 - open * 0.85} 1) translate(${-(c[0] - 340)} 0)`}>
        <circle cx={c[0]} cy={c[1]} r={340} fill="#1a1a1a" stroke="#fff" strokeWidth={12} />
        <circle cx={c[0]} cy={c[1]} r={280} fill="none" stroke="#666" strokeWidth={5} />
        <g transform={`rotate(${spin} ${c[0]} ${c[1]})`}>
          {[0, 60, 120].map((a) => {
            const [q1, q2] = [go(c, a, 180), go(c, a + 180, 180)];
            return <line key={a} x1={q1[0]} y1={q1[1]} x2={q2[0]} y2={q2[1]} stroke="#ddd" strokeWidth={22} strokeLinecap="round" />;
          })}
          <circle cx={c[0]} cy={c[1]} r={60} fill="#ddd" />
        </g>
      </g>
    </Frame>
  );
}

// A receipt prints on and on, line after line of spending.
export function Receipt({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const len = interpolate(f, [0, dur], [80, 1100]);
  const top = s.top + 160;
  const n = Math.floor(len / 60);
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 300} y={top - 120} width={600} height={150} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <rect x={s.cx - 220} y={top} width={440} height={10} fill="#000" />
      <path d={`M ${s.cx - 200} ${top} V ${top + len} ${Array.from({ length: 10 }, (_, i) => `l 20 20 l 20 -20`).join(" ")} V ${top} Z`} fill="#e6e6e6" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={s.cx - 170} y={top + len - 70 - i * 60} width={150 + ((i * 37) % 90)} height={14} fill="#555" />
          {big(`-$${(i * 47 + 13) % 200}`, s.cx + 120, top + len - 54 - i * 60, 40, "#222")}
        </g>
      ))}
    </Frame>
  );
}

// A card swipes; DECLINED flashes.
export function Card({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x = interpolate(f, [4, dur * 0.35], [-600, 0], ease);
  const no = f > dur * 0.45;
  const shake = no && f < dur * 0.6 ? Math.sin(f * 3) * 14 : 0;
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 260 + shake} y={s.cy - 360} width={520} height={760} rx={40} fill="#111" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <rect x={s.cx - 200 + shake} y={s.cy - 300} width={400} height={180} rx={14} fill={no ? "#fff" : "#222"} />
      {no && big("DECLINED", s.cx + shake, s.cy - 180, 80, "#000")}
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={s.cx - 180 + (i % 3) * 130 + shake} y={s.cy - 60 + Math.floor(i / 3) * 110} width={100} height={80} rx={12} fill="#2a2a2a" stroke="#666" strokeWidth={3} />)}
      <g transform={`translate(${s.cx + 20 + x} ${s.cy + 420})`}>
        <rect x={-260} y={0} width={500} height={300} rx={26} fill="#cfcfcf" />
        <rect x={-260} y={50} width={500} height={50} fill="#333" />
        <rect x={-210} y={150} width={90} height={70} rx={10} fill="#888" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={-90 + i * 80} y={240} width={60} height={14} fill="#666" />)}
      </g>
    </Frame>
  );
}

// Coin stacks rise left to right, each taller than the last.
export function Stacks({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 5;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, k) => {
        const x = s.left + 100 + k * 190;
        const h = Math.floor(interpolate(f, [k * 6, dur * 0.8], [0, 4 + k * k * 1.6], clamp));
        return Array.from({ length: h }, (_, j) => coin(x, gy - 14 - j * 22, 70, `${k}-${j}`));
      })}
      <Figure x={s.left + 100 + (n - 1) * 190} ground={gy - 14 - Math.floor(interpolate(f, [(n - 1) * 6, dur * 0.8], [0, 4 + 16 * 1.6], clamp)) * 22} s={0.4} pose={mix(STAND, VICTORY, k01(f, dur * 0.8, dur * 0.9))} />
    </Frame>
  );
}

// A paycheck lands in your hand, and bills fly straight back out of it.
export function Paycheck({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const land = k01(f, 0, 14, pop);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <Figure x={s.cx - 200} ground={gy} s={0.9} pose={{ ...STAND, rs: 70, re: 80 }} headDown={10 + 25 * k01(f, dur * 0.4, dur * 0.8)} />
      <g transform={`translate(${s.cx + 10} ${gy - 470 - (1 - land) * 600}) rotate(-6)`}>
        <rect x={-30} y={-90} width={360} height={180} rx={10} fill="#e6e6e6" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
        <rect x={0} y={-60} width={160} height={16} fill="#777" />
        <rect x={0} y={20} width={260} height={10} fill="#999" />
        {big("$", 270, 0, 70, "#111")}
      </g>
      {f > 16 && Array.from({ length: 8 }, (_, i) => {
        const age = cyc(f - 16, 30, i * 4);
        return <Bill key={i} x={s.cx + 150 + age * 500 + i * 10} y={gy - 470 - age * 600 + Math.sin(i + age * 6) * 40} r={age * 300 + i * 40} s={0.9} />;
      })}
    </Frame>
  );
}

// Rows of cubicles, grey heads down; one figure stands up and walks out.
export function Cubicle({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const up = k01(f, dur * 0.3, dur * 0.45);
  const go2 = k01(f, dur * 0.45, dur, clamp);
  const rows = [s.top + 300, s.top + 580, s.top + 860];
  return (
    <Frame p={p} t={t}>
      {rows.map((y, r) =>
        [0, 1, 2].map((c) => {
          const x = 220 + c * 320;
          const me = r === 2 && c === 1;
          return (
            <g key={`${r}${c}`}>
              {!me && <Figure x={x - 40} ground={y + 60} s={0.45} pose={SIT} color="#555" glow={false} headDown={30} />}
              {!me && <rect x={x + 20} y={y - 70} width={70} height={50} rx={6} fill="#fff" opacity={0.25} />}
              <path d={`M ${x - 140} ${y + 70} V ${y - 40} H ${x + 140} V ${y + 70}`} fill="#0d0d0d" stroke="#888" strokeWidth={5} />
            </g>
          );
        }),
      )}
      <Figure x={540 - 40 + go2 * 700} ground={rows[2] + 60 + up * 20} s={0.55} pose={go2 > 0 ? walk((go2 * 700) / (walkRate() * 0.55)) : mix(SIT, STAND, up)} />
    </Frame>
  );
}

// A mug fills with coffee, steam rising: the early hours.
export function Coffee({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c = { x: s.cx - 220, y: s.cy - 80, w: 400, h: 480 };
  const lvl = interpolate(f, [0, dur * 0.7], [0.1, 0.85], clamp);
  return (
    <Frame p={p} t={t}>
      {[0, 1, 2].map((k) => {
        const u = cyc(f, 60, k * 20);
        const x = c.x + 110 + k * 90;
        return <path key={k} d={`M ${x} ${c.y - 40 - u * 300} q 30 -50 0 -100 q -30 -50 0 -100`} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={Math.sin(u * Math.PI) * 0.6} />;
      })}
      <rect x={c.x} y={c.y + c.h * (1 - lvl)} width={c.w} height={c.h * lvl} rx={20} fill="#777" />
      <path d={`M ${c.x} ${c.y} V ${c.y + c.h - 40} Q ${c.x} ${c.y + c.h} ${c.x + 40} ${c.y + c.h} H ${c.x + c.w - 40} Q ${c.x + c.w} ${c.y + c.h} ${c.x + c.w} ${c.y + c.h - 40} V ${c.y}`} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
      <path d={`M ${c.x + c.w} ${c.y + 100} h 60 q 70 0 70 90 v 60 q 0 90 -70 90 h -60`} fill="none" stroke="#fff" strokeWidth={10} />
      <ellipse cx={c.x + c.w / 2} cy={c.y + c.h + 40} rx={300} ry={30} fill="none" stroke="#888" strokeWidth={6} />
      {big(`${5 + Math.floor(f / 30) % 1}:${String(Math.floor(f / 2) % 60).padStart(2, "0")} AM`, s.cx, c.y + c.h + 200, 90, "#aaa")}
    </Frame>
  );
}

// A laptop flips open; code scrolls and lights the figure's face.
export function Laptop({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const open = k01(f, 0, 16);
  const base: Pt = [s.cx + 80, gy - 260];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={base[0] - 230} y={base[1]} width={460} height={260} fill="#111" stroke="#666" strokeWidth={5} />
      <g transform={`translate(${base[0]} ${base[1]}) scale(1 ${open})`}>
        <rect x={-200} y={-300} width={400} height={290} rx={14} fill="#0a0a0a" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        {Array.from({ length: 8 }, (_, i) => {
          const y = -280 + ((i * 34 - f * 3) % 272 + 272) % 272;
          return <rect key={i} x={-170 + (i % 3) * 30} y={y} width={80 + ((i * 53) % 200)} height={12} rx={4} fill="#fff" opacity={0.7} />;
        })}
      </g>
      <rect x={base[0] - 240} y={base[1] - 10} width={480} height={20} rx={8} fill="#ccc" />
      <polygon points={`${base[0] - 200},${base[1] - 160} ${base[0] - 420},${base[1] - 300} ${base[0] - 420},${base[1] - 40}`} fill="#fff" opacity={0.1 * open} />
      <Figure x={base[0] - 400} ground={gy} s={0.8} pose={SIT} hands={[[180, -60 + Math.sin(f) * 6], [200, -60 - Math.sin(f) * 6]]} />
    </Frame>
  );
}

// Envelopes pile up faster than they can be opened.
export function Inbox({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = Math.floor(interpolate(f, [0, dur], [3, 22]));
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.top + 150, textAlign: "center", font: `400 120px ${font.impact}`, color: "#fff" }}>{n * 37} UNREAD</div>}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, i) => {
        const x = s.cx - 220 + ((i * 97) % 300);
        const y = gy - 60 - i * 34;
        const land = i === n - 1 ? k01(f % (dur / 19), 0, 4, clamp) : 1;
        return (
          <g key={i} transform={`translate(${x} ${y - (1 - land) * 200}) rotate(${((i * 31) % 20) - 10})`}>
            <rect x={0} y={0} width={180} height={110} rx={8} fill="#1a1a1a" stroke="#ddd" strokeWidth={4} />
            <path d="M 0 0 L 90 60 L 180 0" fill="none" stroke="#ddd" strokeWidth={4} />
          </g>
        );
      })}
      <Figure x={s.cx + 280} ground={gy} s={0.7} flip pose={{ ...STAND, ls: 30, le: 140, rs: 30, re: 140 }} headDown={30} />
    </Frame>
  );
}

// A small storefront; the sign flips to OPEN and lights up.
export function Shop({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const on = k01(f, dur * 0.35, dur * 0.45, clamp);
  const flip = Math.cos(on * Math.PI);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left + 40} y={gy - 820} width={s.width - 80} height={820} fill="#0f0f0f" stroke="#fff" strokeWidth={7} />
      <path d={`M ${s.left + 10} ${gy - 820} h ${s.width - 20} l -40 120 h ${-(s.width - 100)} Z`} fill="#222" stroke="#fff" strokeWidth={6} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M ${s.left + 50 + i * 155} ${gy - 700} q 77 60 155 0`} fill={i % 2 ? "#ddd" : "#333"} />)}
      <rect x={s.left + 100} y={gy - 600} width={420} height={400} fill="#fff" opacity={0.08 + 0.5 * on} filter={on ? "url(#glow)" : undefined} />
      <rect x={s.cx + 120} y={gy - 560} width={250} height={560} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      <line x1={s.cx + 245} y1={gy - 480} x2={s.cx + 245} y2={gy - 430} stroke="#ddd" strokeWidth={4} />
      <g transform={`translate(${s.cx + 245} ${gy - 380}) scale(${Math.abs(flip) || 0.02} 1)`}>
        <rect x={-110} y={0} width={220} height={90} rx={10} fill={flip < 0 ? "#fff" : "#333"} filter={flip < 0 ? "url(#glow)" : undefined} />
        {big(flip < 0 ? "OPEN" : "CLOSED", 0, 66, 58, flip < 0 ? "#000" : "#888")}
      </g>
      <Figure x={s.left + 250} ground={gy} s={0.6} front pose={mix(STAND, VICTORY, on)} />
    </Frame>
  );
}

// Two hands come in from the sides and shake on it.
export function Deal({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur * 0.4);
  const bob = k >= 1 ? Math.sin(f / 4) * 20 : 0;
  const arm = (d: number) => {
    const x = s.cx + d * (60 + (1 - k) * 500);
    return (
      <g transform={`translate(${x} ${s.cy + bob})`}>
        <rect x={d > 0 ? 40 : -600} y={-70} width={560} height={140} rx={40} fill={d > 0 ? "#2a2a2a" : "#cfcfcf"} stroke="#fff" strokeWidth={6} />
        <rect x={d > 0 ? -120 : -40} y={-80} width={160} height={160} rx={60} fill={d > 0 ? "#bbb" : "#eee"} stroke="#fff" strokeWidth={6} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={d > 0 ? -150 : 100} y={-70 + i * 38} width={60} height={30} rx={14} fill={d > 0 ? "#bbb" : "#eee"} stroke="#999" strokeWidth={3} />)}
      </g>
    );
  };
  return (
    <Frame p={p} t={t}>
      {arm(1)}
      {arm(-1)}
      {k >= 1 && [0, 1, 2, 3, 4, 5].map((i) => {
        const [a, b] = [go([s.cx, s.cy], i * 60 + 30, 220), go([s.cx, s.cy], i * 60 + 30, 280 + 30 * Math.sin(f / 3))];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={8} strokeLinecap="round" />;
      })}
    </Frame>
  );
}

// A bucket with holes: money pours in, leaks straight out the bottom.
export function Leak({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const b = { x: s.cx - 220, y: s.cy - 120, w: 440, h: 460 };
  const lvl = 0.25 + 0.05 * Math.sin(f / 10);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 5 }, (_, i) => <Bill key={i} x={s.cx + Math.sin(i * 2) * 80} y={b.y - 260 + cyc(f, 24, i * 5) * 300} r={i * 50 + f * 4} s={0.8} />)}
      <rect x={b.x + 20} y={b.y + b.h * (1 - lvl)} width={b.w - 40} height={b.h * lvl} fill="#666" />
      <path d={`M ${b.x} ${b.y} L ${b.x + 40} ${b.y + b.h} H ${b.x + b.w - 40} L ${b.x + b.w} ${b.y}`} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
      <path d={`M ${b.x} ${b.y} Q ${s.cx} ${b.y - 240} ${b.x + b.w} ${b.y}`} fill="none" stroke="#999" strokeWidth={6} />
      {[-140, -40, 60, 150].map((dx, i) => (
        <g key={dx}>
          <circle cx={s.cx + dx} cy={b.y + b.h - 4} r={10} fill="#000" stroke="#aaa" strokeWidth={3} />
          {[0, 1, 2].map((j) => <ellipse key={j} cx={s.cx + dx} cy={b.y + b.h + 20 + cyc(f, 16, i * 4 + j * 5) * 300} rx={8} ry={14} fill="#bbb" opacity={1 - cyc(f, 16, i * 4 + j * 5)} />)}
        </g>
      ))}
    </Frame>
  );
}

// Candlesticks march up a stock chart, a few red days, mostly up.
export function Candles({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 12;
  const gy = s.bottom - 60;
  let y = gy - 120;
  const sticks = Array.from({ length: n }, (_, k) => {
    const up = k % 4 !== 2;
    const d = up ? 60 + (k * 13) % 50 : -50;
    const o = y;
    y -= d;
    return { o, c: y, up };
  });
  return (
    <Frame p={p} t={t}>
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={s.left} y1={gy - i * 200} x2={s.right} y2={gy - i * 200} stroke="#fff" strokeOpacity={0.08} strokeWidth={2} />)}
      {sticks.map((c, k) => {
        const u = k01(f, tickAt(k, n, dur) - 6, tickAt(k, n, dur), pop);
        if (u <= 0) return null;
        const x = s.left + 40 + k * 76;
        const [top, bot] = [Math.min(c.o, c.c), Math.max(c.o, c.c)];
        const h = (bot - top) * u;
        return (
          <g key={k}>
            <line x1={x + 22} y1={top - 30} x2={x + 22} y2={bot + 30} stroke="#aaa" strokeWidth={4} />
            <rect x={x} y={c.up ? bot - h : top} width={44} height={h} fill={c.up ? "#fff" : "#111"} stroke="#fff" strokeWidth={4} filter={k === n - 1 ? "url(#glow)" : undefined} />
          </g>
        );
      })}
    </Frame>
  );
}

// Dice tumble across the table and come up snake eyes.
export function Dice({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 300;
  const u = k01(f, 0, dur * 0.55, { ...clamp, easing: Easing.out(Easing.cubic) });
  const die = (x0: number, d: number) => {
    const x = x0 - 700 * (1 - u);
    const y = gy - 200 - Math.abs(Math.sin(u * Math.PI * 3)) * 300 * (1 - u);
    const faces = u < 1 ? 1 + (Math.floor(f / 3 + d) % 6) : 1;
    const pips: Pt[] = ({ 1: [[0, 0]], 2: [[-50, -50], [50, 50]], 3: [[-50, -50], [0, 0], [50, 50]], 4: [[-50, -50], [50, -50], [-50, 50], [50, 50]], 5: [[-50, -50], [50, -50], [0, 0], [-50, 50], [50, 50]], 6: [[-50, -55], [50, -55], [-50, 0], [50, 0], [-50, 55], [50, 55]] } as Record<number, Pt[]>)[faces];
    return (
      <g transform={`translate(${x} ${y}) rotate(${(1 - u) * 720 + d * 10})`}>
        <rect x={-100} y={-100} width={200} height={200} rx={30} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        {pips.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={18} fill="#111" />)}
      </g>
    );
  };
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#ccc" strokeWidth={5} />
      {die(s.cx - 140, 0)}
      {die(s.cx + 160, 3)}
    </Frame>
  );
}

// A slot machine spins and lands on a mismatch.
export function Slots({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sym = ["7", "$", "X", "?", "#"];
  const box = { x: s.cx - 360, y: s.cy - 180, w: 720, h: 560 };
  const lever = Math.sin(k01(f, 0, 10, clamp) * Math.PI) * 60;
  return (
    <Frame p={p} t={t}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={40} fill="#111" stroke="#fff" strokeWidth={9} filter="url(#glow)" />
      <rect x={box.x + 40} y={box.y - 120} width={box.w - 80} height={110} rx={20} fill="#222" stroke="#ddd" strokeWidth={5} />
      {big("JACKPOT", s.cx, box.y - 40, 80, Math.floor(f / 6) % 2 ? "#fff" : "#666")}
      {[0, 1, 2].map((r) => {
        const stop = dur * (0.35 + r * 0.15);
        const sp = f < stop ? Math.floor(f * 1.5 + r * 2) : [0, 0, 2][r];
        return (
          <g key={r}>
            <rect x={box.x + 50 + r * 215} y={box.y + 120} width={190} height={300} rx={14} fill="#e6e6e6" />
            {big(sym[sp % sym.length], box.x + 145 + r * 215, box.y + 330 + (f < stop ? (f * 40) % 100 - 50 : 0), 200, "#111")}
          </g>
        );
      })}
      <line x1={box.x + box.w + 40} y1={box.y + 260} x2={box.x + box.w + 40} y2={box.y + 60 + lever * 4} stroke="#ccc" strokeWidth={14} />
      <circle cx={box.x + box.w + 40} cy={box.y + 50 + lever * 4} r={36} fill="#fff" />
    </Frame>
  );
}

// Dragging a ball and chain step by step.
export function BallChain({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const ph = f * 0.08;
  const x = s.cx + 140;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={50} offset={f * 2} />
      {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={x - 40 - i * 46} cy={gy - 20 + Math.sin(i / 2) * 6} rx={26} ry={14} fill="none" stroke="#bbb" strokeWidth={7} />)}
      <circle cx={x - 420} cy={gy - 90} r={90} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {big("$", x - 420, gy - 60, 90, "#777")}
      {[0, 1, 2].map((k) => <line key={k} x1={x - 520 - k * 40} y1={gy - 10 - k * 15} x2={x - 600 - k * 50} y2={gy - 10 - k * 15} stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
      <Figure x={x} ground={gy} s={0.85} pose={{ ...walk(ph, 0.4), t: 26 }} headDown={25} />
    </Frame>
  );
}

// A pyramid of grey figures; one lit at the top.
export function Pyramid({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const rows = 4;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: rows }, (_, r) => {
        const n = rows - r;
        const y = gy - r * 230;
        const show = k01(f, r * 10, r * 10 + 10, pop);
        return Array.from({ length: n }, (_, c) => (
          <Figure key={`${r}${c}`} x={s.cx + (c - (n - 1) / 2) * 220} ground={y - (1 - show) * 60} s={0.5} front pose={{ ...STAND, ls: -100, le: -120, rs: 100, re: 120 }} color={r === rows - 1 ? "#ececec" : ["#3a3a3a", "#4a4a4a", "#5e5e5e"][r]} glow={r === rows - 1} headDown={r === rows - 1 ? 0 : 25} />
        ));
      })}
    </Frame>
  );
}

// A money printer cranks out bills.
export function Printer({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c = { x: s.cx - 300, y: s.cy - 200, w: 600, h: 320 };
  return (
    <Frame p={p} t={t}>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={30} fill="#141414" stroke="#fff" strokeWidth={9} filter="url(#glow)" />
      {[0, 1].map((i) => (
        <g key={i} transform={`rotate(${f * 12 * (i ? -1 : 1)} ${c.x + 180 + i * 240} ${c.y + 140})`}>
          <circle cx={c.x + 180 + i * 240} cy={c.y + 140} r={70} fill="none" stroke="#888" strokeWidth={8} strokeDasharray="20 14" />
        </g>
      ))}
      <rect x={c.x + 80} y={c.y + c.h - 30} width={c.w - 160} height={20} fill="#000" />
      <circle cx={c.x + c.w - 60} cy={c.y + 50} r={14} fill={Math.floor(f / 5) % 2 ? "#fff" : "#444"} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 30, i * 5);
        return <Bill key={i} x={s.cx + (i - 2.5) * 30 * u} y={c.y + c.h + u * 600} r={(i % 2 ? 1 : -1) * u * 120} s={1.2} />;
      })}
    </Frame>
  );
}

// A pie chart fills slice by slice; the last slice pops out.
export function Pie({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 40];
  const R = 360;
  const cuts = [0, 0.4, 0.65, 0.85, 1];
  const fill = k01(f, 0, dur * 0.7);
  const arc = (a0: number, a1: number, r: number, o: Pt = [0, 0]) => {
    const [x0, y0] = [c[0] + o[0] + Math.sin(a0 * 2 * Math.PI) * r, c[1] + o[1] - Math.cos(a0 * 2 * Math.PI) * r];
    const [x1, y1] = [c[0] + o[0] + Math.sin(a1 * 2 * Math.PI) * r, c[1] + o[1] - Math.cos(a1 * 2 * Math.PI) * r];
    return `M ${c[0] + o[0]} ${c[1] + o[1]} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z`;
  };
  return (
    <Frame p={p} t={t}>
      <circle cx={c[0]} cy={c[1]} r={R} fill="none" stroke="#333" strokeWidth={5} strokeDasharray="20 14" />
      {cuts.slice(0, -1).map((a0, i) => {
        const a1 = Math.min(cuts[i + 1], fill);
        if (a1 <= a0) return null;
        const last = i === cuts.length - 2;
        const mid = (a0 + cuts[i + 1]) / 2;
        const out = last ? 50 * k01(f, dur * 0.75, dur * 0.85, pop) : 0;
        return <path key={i} d={arc(a0, a1, R, [Math.sin(mid * 2 * Math.PI) * out, -Math.cos(mid * 2 * Math.PI) * out])} fill={last ? "#fff" : ["#2a2a2a", "#555", "#888"][i]} stroke="#000" strokeWidth={6} filter={last ? "url(#glow)" : undefined} />;
      })}
    </Frame>
  );
}

// A huge magnet pulls coins toward the figure.
export function Magnet({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const m: Pt = [s.cx - 180, s.cy - 60];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`rotate(90 ${m[0]} ${m[1]})`}>
        <path d={`M ${m[0] - 160} ${m[1] - 160} V ${m[1]} A 160 160 0 0 0 ${m[0] + 160} ${m[1]} V ${m[1] - 160} H ${m[0] + 70} V ${m[1]} A 70 70 0 0 1 ${m[0] - 70} ${m[1]} V ${m[1] - 160} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        <rect x={m[0] - 160} y={m[1] - 220} width={90} height={60} fill="#fff" />
        <rect x={m[0] + 70} y={m[1] - 220} width={90} height={60} fill="#fff" />
      </g>
      {Array.from({ length: 9 }, (_, i) => {
        const u = cyc(f, 40, i * 9);
        const from: Pt = [W + 80, s.top + 120 + (i * 137) % 700];
        const to: Pt = [m[0] + 240, m[1] + ((i % 3) - 1) * 50];
        return coin(from[0] + (to[0] - from[0]) * u * u, from[1] + (to[1] - from[1]) * u * u, 34, i);
      })}
      {[0, 1, 2].map((i) => <path key={`w${i}`} d={`M ${m[0] + 260 + i * 60} ${m[1] - 140} q 40 140 0 280`} fill="none" stroke="#fff" strokeWidth={4} opacity={0.4 * (1 - cyc(f, 20, i * 7))} />)}
      <Figure x={m[0] - 30} ground={gy} s={0.7} pose={{ ...STAND, rs: 80, re: 80 }} />
    </Frame>
  );
}

// A tap drips money into a growing pool: income while you sleep.
export function Faucet({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const pool = interpolate(f, [0, dur], [40, 300]);
  const tap: Pt = [s.cx + 60, s.top + 260];
  return (
    <Frame p={p} t={t}>
      <rect x={tap[0] + 120} y={tap[1] - 120} width={60} height={240} fill="#888" />
      <path d={`M ${tap[0] + 120} ${tap[1] - 40} H ${tap[0] - 40} Q ${tap[0] - 100} ${tap[1] - 40} ${tap[0] - 100} ${tap[1] + 40} V ${tap[1] + 80} H ${tap[0] - 20} V ${tap[1] + 40} H ${tap[0] + 120} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <rect x={tap[0] - 10} y={tap[1] - 120} width={40} height={80} fill="#ccc" />
      <rect x={tap[0] - 60} y={tap[1] - 130} width={140} height={24} rx={10} fill="#ccc" />
      {[0, 1, 2].map((k) => coin(tap[0] - 60, tap[1] + 110 + cyc(f, 18, k * 6) * (gy - tap[1] - 140), 30, k))}
      <ellipse cx={tap[0] - 60} cy={gy - 10} rx={pool} ry={pool * 0.18} fill="#777" stroke="#ccc" strokeWidth={4} />
      <ellipse cx={tap[0] - 60} cy={gy - 10} rx={pool * (0.3 + cyc(f, 18) * 0.7)} ry={pool * 0.18 * (0.3 + cyc(f, 18) * 0.7)} fill="none" stroke="#fff" strokeWidth={3} opacity={1 - cyc(f, 18)} />
      <Figure x={s.left + 120} ground={gy} s={0.6} pose={SIT} headDown={-10} />
    </Frame>
  );
}

// A fundraising thermometer fills to the top and bursts with light.
export function Meter({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x = s.cx, top = s.top + 140, bot = s.bottom - 140;
  const k = k01(f, 4, dur * 0.8);
  return (
    <Frame p={p} t={t}>
      <rect x={x - 60} y={top} width={120} height={bot - top} rx={60} fill="#0d0d0d" stroke="#fff" strokeWidth={8} />
      <rect x={x - 36} y={bot - (bot - top - 40) * k} width={72} height={(bot - top - 40) * k + 20} rx={36} fill="#fff" filter="url(#glow)" />
      <circle cx={x} cy={bot + 60} r={110} fill="#fff" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={x + 80} y1={bot - 20 - (bot - top - 40) * v} x2={x + 140} y2={bot - 20 - (bot - top - 40) * v} stroke="#aaa" strokeWidth={5} />
          {big(`${v * 100}%`, x + 230, bot - (bot - top - 40) * v, 50, k >= v ? "#fff" : "#555")}
        </g>
      ))}
      {k >= 1 && Array.from({ length: 10 }, (_, i) => {
        const [a, b] = [go([x, top], i * 36 + f * 2, 90), go([x, top], i * 36 + f * 2, 160)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={6} strokeLinecap="round" />;
      })}
    </Frame>
  );
}

// Identical boxes ride a conveyor belt; one figure steps off it.
export function Conveyor({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const by = s.cy + 160;
  const off = k01(f, dur * 0.4, dur * 0.7);
  return (
    <Frame p={p} t={t}>
      <rect x={-20} y={by} width={W + 40} height={60} rx={30} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={((i * 100 + f * 4) % (W + 100)) - 50} cy={by + 30} r={18} fill="none" stroke="#777" strokeWidth={4} />)}
      {Array.from({ length: 5 }, (_, i) => {
        const x = ((i * 260 + f * 4) % (W + 260)) - 200;
        return <Figure key={i} x={x} ground={by} s={0.55} pose={STAND} color="#555" glow={false} headDown={25} />;
      })}
      <Figure x={s.cx + off * 80} ground={by + off * (s.bottom - 40 - by)} air={Math.sin(off * Math.PI) * 120} s={0.6} front={off > 0.9} pose={off > 0.9 ? mix(STAND, VICTORY, k01(f, dur * 0.75, dur * 0.85)) : STAND} />
      <Ground y={s.bottom - 40} />
    </Frame>
  );
}

// Interlocking gears turning together.
export function Gears({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gear = (c: Pt, r: number, teeth: number, dir: number, lit = false) => (
    <g transform={`rotate(${(f * 2 * dir * 200) / r} ${c[0]} ${c[1]})`} filter={lit ? "url(#glow)" : undefined}>
      {Array.from({ length: teeth }, (_, i) => <rect key={i} x={c[0] - 18} y={c[1] - r - 36} width={36} height={56} rx={6} fill={lit ? "#fff" : "#444"} transform={`rotate(${(i * 360) / teeth} ${c[0]} ${c[1]})`} />)}
      <circle cx={c[0]} cy={c[1]} r={r} fill={lit ? "#fff" : "#1a1a1a"} stroke={lit ? "#fff" : "#888"} strokeWidth={6} />
      <circle cx={c[0]} cy={c[1]} r={r * 0.3} fill="#000" stroke="#888" strokeWidth={6} />
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {gear([s.cx - 150, s.cy - 160], 200, 14, 1, true)}
      {gear([s.cx + 205, s.cy + 120], 140, 10, -200 / 140)}
      {gear([s.cx - 140, s.cy + 330], 110, 8, 200 / 110)}
    </Frame>
  );
}

// A punch clock stamps the card: in, out, in, out.
export function PunchClock({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.top + 360];
  const n = 4;
  return (
    <Frame p={p} t={t}>
      <rect x={c[0] - 250} y={c[1] - 220} width={500} height={600} rx={30} fill="#141414" stroke="#fff" strokeWidth={8} />
      <circle cx={c[0]} cy={c[1]} r={150} fill="#e6e6e6" />
      {(() => {
        const [h, m] = [go(c, 180 - f * 0.5, 80), go(c, 180 - f * 6, 120)];
        return (
          <>
            <line x1={c[0]} y1={c[1]} x2={h[0]} y2={h[1]} stroke="#111" strokeWidth={14} strokeLinecap="round" />
            <line x1={c[0]} y1={c[1]} x2={m[0]} y2={m[1]} stroke="#111" strokeWidth={8} strokeLinecap="round" />
          </>
        );
      })()}
      <rect x={c[0] - 120} y={c[1] + 220} width={240} height={30} fill="#000" />
      {(() => {
        const k = Math.min(n - 1, Math.floor((f / dur) * n));
        const u = cyc(f, dur / n);
        const down = u < 0.3 ? Math.sin((u / 0.3) * Math.PI) : 0;
        return (
          <g transform={`translate(${c[0]} ${c[1] + 230 + 80 - down * 80})`}>
            <rect x={-110} y={0} width={220} height={380} rx={8} fill="#cfcfcf" />
            {Array.from({ length: k + 1 }, (_, i) => big(i % 2 ? "OUT" : "IN", 0, 70 + i * 70, 50, "#111", i))}
          </g>
        );
      })()}
    </Frame>
  );
}

// A price tag swings while the price climbs.
export function Tag({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pivot: Pt = [s.cx, s.top + 140];
  const sw = Math.sin(f / 12) * 10;
  const price = Math.round(interpolate(f, [0, dur], [9, 999], { ...clamp, easing: Easing.in(Easing.cubic) }));
  return (
    <Frame p={p} t={t}>
      <g transform={`rotate(${sw} ${pivot[0]} ${pivot[1]})`}>
        <line x1={pivot[0]} y1={pivot[1]} x2={pivot[0]} y2={pivot[1] + 200} stroke="#bbb" strokeWidth={5} />
        <path d={`M ${pivot[0]} ${pivot[1] + 200} l 220 160 v 480 h -440 v -480 Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        <circle cx={pivot[0]} cy={pivot[1] + 290} r={30} fill="#000" />
        {big(`$${price}`, pivot[0], pivot[1] + 640, 160, "#111")}
      </g>
    </Frame>
  );
}

// A crown lowers onto the figure's head.
export function Crown({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 4, dur * 0.6, { ...clamp, easing: Easing.out(Easing.bounce) });
  const head = gy - 520;
  const cy = head - 60 - (1 - k) * 500;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <polygon points={`${s.cx - 60},${s.top - 100} ${s.cx + 60},${s.top - 100} ${s.cx + 300},${gy} ${s.cx - 300},${gy}`} fill="#fff" opacity={0.08 + 0.1 * k} />
      <Figure x={s.cx} ground={gy} s={1.1} front pose={k >= 1 ? mix(STAND, VICTORY, k01(f, dur * 0.65, dur * 0.8)) : STAND} />
      <path d={`M ${s.cx - 90} ${cy} l -20 -130 l 60 60 l 50 -100 l 50 100 l 60 -60 l -20 130 Z`} fill="#fff" stroke="#fff" strokeWidth={6} strokeLinejoin="round" filter="url(#glow)" />
      {[-60, 0, 60].map((x) => <circle key={x} cx={s.cx + x} cy={cy - 30} r={10} fill="#000" />)}
    </Frame>
  );
}

// A trophy rises on a pedestal and gleams.
export function Trophy({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const rise = k01(f, 0, dur * 0.4);
  const y = gy - 300 - rise * 100;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx - 200} y={y + 300} width={400} height={gy - y - 300} fill="#141414" stroke="#ddd" strokeWidth={6} />
      <g transform={`translate(${s.cx} ${y})`} filter="url(#glow)">
        <path d="M -200 -420 H 200 Q 200 -150 0 -110 Q -200 -150 -200 -420 Z" fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        {[-1, 1].map((d) => <path key={d} d={`M ${d * 200} -380 q ${d * 110} 0 ${d * 100} 100 q -10 80 ${-d * 120} 110`} fill="none" stroke="#e6e6e6" strokeWidth={22} />)}
        <rect x={-30} y={-110} width={60} height={120} fill="#e6e6e6" />
        <rect x={-130} y={10} width={260} height={70} rx={8} fill="#e6e6e6" />
        <rect x={-180} y={80} width={360} height={60} rx={8} fill="#bbb" />
        <rect x={-150 + ((f * 12) % 500) - 100} y={-420} width={40} height={300} fill="#fff" opacity={0.6} transform="skewX(-20)" />
      </g>
      {[0, 1, 2, 3].map((i) => {
        const tw = Math.max(0, Math.sin(f / 5 + i * 1.7));
        const [gx, gyy] = [s.cx + [-260, 250, -180, 200][i], y - [500, 420, 200, 140][i]];
        return <path key={i} d={`M ${gx} ${gyy - 24 * tw} L ${gx + 6} ${gyy} L ${gx} ${gyy + 24 * tw} L ${gx - 6} ${gyy} Z M ${gx - 24 * tw} ${gyy} L ${gx} ${gyy - 6} L ${gx + 24 * tw} ${gyy} L ${gx} ${gyy + 6} Z`} fill="#fff" />;
      })}
    </Frame>
  );
}

// Three-tier podium; the figure steps up onto first place.
export function Podium({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const tiers = [{ x: s.cx - 300, h: 200, n: "2" }, { x: s.cx, h: 320, n: "1" }, { x: s.cx + 300, h: 140, n: "3" }];
  const up = k01(f, dur * 0.2, dur * 0.45);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {tiers.map((tr) => (
        <g key={tr.n}>
          <rect x={tr.x - 140} y={gy - tr.h} width={280} height={tr.h} fill={tr.n === "1" ? "#e6e6e6" : "#1a1a1a"} stroke="#fff" strokeWidth={6} filter={tr.n === "1" ? "url(#glow)" : undefined} />
          {big(tr.n, tr.x, gy - tr.h + 110, 100, tr.n === "1" ? "#111" : "#777")}
        </g>
      ))}
      <Figure x={s.cx - 300} ground={gy - 200} s={0.5} front pose={STAND} color="#555" glow={false} headDown={20} />
      <Figure x={s.cx + 300} ground={gy - 140} s={0.5} front pose={STAND} color="#555" glow={false} headDown={20} />
      <Figure x={s.cx - 160 + 160 * up} ground={gy - 320 * up} air={Math.sin(up * Math.PI) * 80} s={0.6} front={up >= 1} pose={up >= 1 ? mix(STAND, VICTORY, k01(f, dur * 0.5, dur * 0.65)) : walk(f * 0.2)} />
      {up >= 1 && Array.from({ length: 16 }, (_, i) => {
        const u = cyc(f, 50, i * 13);
        return <rect key={i} x={(i * 71) % W} y={s.top + u * (gy - s.top)} width={16} height={26} fill="#fff" opacity={0.7} transform={`rotate(${f * 8 + i * 40} ${(i * 71) % W} ${s.top + u * (gy - s.top)})`} />;
      })}
    </Frame>
  );
}

// A lottery ticket is scratched off: TRY AGAIN.
export function Lottery({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const r = { x: s.cx - 320, y: s.cy - 260, w: 640, h: 520 };
  const k = k01(f, 4, dur * 0.7, clamp);
  const coinX = r.x + 60 + ((Math.floor(k * 8) % 2 ? 1 - (k * 8) % 1 : (k * 8) % 1) * (r.w - 120));
  const coinY = r.y + 200 + k * 260;
  return (
    <Frame p={p} t={t}>
      <rect x={r.x - 40} y={r.y - 200} width={r.w + 80} height={r.h + 300} rx={24} fill="#141414" stroke="#fff" strokeWidth={7} />
      {big("WIN BIG", s.cx, r.y - 90, 100, "#888")}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={14} fill="#e6e6e6" />
      {big("TRY AGAIN", s.cx, s.cy + 40, 110, "#111")}
      <rect x={r.x} y={r.y + r.h * k} width={r.w} height={r.h * (1 - k)} fill="#555" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={r.x + (i * 53) % r.w} y={r.y + r.h * k - 10 - (i % 3) * 6} width={30} height={14} fill="#555" />)}
      <circle cx={coinX} cy={coinY} r={60} fill="#bbb" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
    </Frame>
  );
}
