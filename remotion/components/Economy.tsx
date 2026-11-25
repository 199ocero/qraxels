import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { Figure, Ground, HIP, STAND, VICTORY, clamp, mix, walk, walkRate, type Pt } from "./Mono.tsx";
import { Frame, cyc, k01, pop, type L } from "./kit.tsx";

// Economy and prices pictures (energy, food, housing, rates, trade, AI and jobs). Every scene takes only an optional
// label, and draws inside the vertical stage() so the same picture plays in Shorts and centred in the 16:9 video.

const txt = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const usd = (n: number, dp = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const climb = { ...clamp, easing: Easing.in(Easing.quad) };
const settle = { ...clamp, easing: Easing.out(Easing.cubic) };
const coin = (x: number, y: number, r = 30, key?: string | number) => <ellipse key={key} cx={x} cy={y} rx={r} ry={r * 0.36} fill="#9a9a9a" stroke="#eee" strokeWidth={4} />;
// A cardboard box with a tape line; (x, y) is its bottom-left corner.
const box = (x: number, y: number, w: number, h: number, key?: string | number, glow = false) => (
  <g key={key} filter={glow ? "url(#glow)" : undefined}>
    <rect x={x} y={y - h} width={w} height={h} rx={4} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />
    <path d={`M ${x + w / 2} ${y - h} v ${h * 0.3}`} stroke="#999" strokeWidth={5} />
  </g>
);
// A plain house front; (x, gy) is its bottom-left corner.
const house = (x: number, gy: number, w: number, lit = 1, key?: string | number) => (
  <g key={key}>
    <rect x={x} y={gy - w * 0.7} width={w} height={w * 0.7} fill="#141414" stroke="#fff" strokeWidth={7} />
    <path d={`M ${x - w * 0.1} ${gy - w * 0.7} L ${x + w / 2} ${gy - w * 1.2} L ${x + w * 1.1} ${gy - w * 0.7} Z`} fill="#1f1f1f" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
    <rect x={x + w * 0.15} y={gy - w * 0.5} width={w * 0.25} height={w * 0.22} fill="#fff" opacity={0.15 + 0.85 * lit} stroke="#ccc" strokeWidth={5} />
    <rect x={x + w * 0.58} y={gy - w * 0.42} width={w * 0.24} height={w * 0.42} fill="#2a2a2a" stroke="#ccc" strokeWidth={5} />
  </g>
);
// A small price tag hanging from (x, y), showing `text`.
const tag = (x: number, y: number, text: string, size = 1, glow = false, key?: string | number) => (
  <g key={key} transform={`translate(${x} ${y}) scale(${size})`} filter={glow ? "url(#glow)" : undefined}>
    <line x1={0} y1={-60} x2={0} y2={0} stroke="#bbb" strokeWidth={4} />
    <path d="M 0 0 l 90 60 v 140 h -180 v -140 Z" fill="#e6e6e6" stroke="#fff" strokeWidth={5} strokeLinejoin="round" />
    <circle cx={0} cy={38} r={12} fill="#000" />
    {txt(text, 0, 160, 64, "#111")}
  </g>
);

// A gas pump: the dollars and gallons spin up while the price per gallon on top jumps.
export function GasPump({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const w = 380;
  const x0 = s.cx - 360;
  const top = gy - 720;
  const k = k01(f, dur * 0.08, dur * 0.9, climb);
  const jump = k01(f, dur * 0.45, dur * 0.5, pop);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={x0 - 30} y={top - 110} width={w + 60} height={100} rx={14} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      <g transform={`translate(${x0 + w / 2} ${top - 40}) scale(${1 + 0.15 * jump * (1 - jump) * 4})`}>{txt(jump > 0.5 ? "$4.59/GAL" : "$3.19/GAL", 0, 0, 64, jump > 0.5 ? "#fff" : "#999")}</g>
      <rect x={x0} y={top} width={w} height={gy - top} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <rect x={x0 + 40} y={top + 50} width={w - 80} height={240} rx={12} fill="#000" stroke="#bbb" strokeWidth={5} filter="url(#glow)" />
      {txt(usd(k * 92, 2), x0 + w / 2, top + 160, 96)}
      {txt(`${(k * 20).toFixed(1)} GAL`, x0 + w / 2, top + 255, 54, "#999")}
      {[0, 1, 2].map((i) => <rect key={i} x={x0 + 70 + i * 90} y={top + 340} width={60} height={60} rx={8} fill="#262626" stroke="#999" strokeWidth={4} />)}
      <rect x={x0 + w} y={top + 300} width={60} height={160} rx={10} fill="#262626" stroke="#ccc" strokeWidth={5} />
      <path d={`M ${x0 + w + 30} ${top + 460} C ${x0 + w + 40} ${gy - 60} ${x0 + w + 200} ${gy - 60} ${x0 + w + 230} ${top + 380}`} fill="none" stroke="#777" strokeWidth={16} strokeLinecap="round" />
      <Figure x={s.right - 130} ground={gy} s={0.85} front pose={STAND} headDown={-12} />
    </Frame>
  );
}

// Groceries drop one by one into a cart while the total above it climbs.
export function Cart({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const cx = s.cx - 40;
  const by = gy - 170;
  const n = 6;
  const landed = Array.from({ length: n }, (_, i) => f >= tickAt(i, n, dur)).filter(Boolean).length;
  const total = interpolate(f, [tickAt(0, n, dur), tickAt(n - 1, n, dur)], [0, 187], clamp);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g filter="url(#glow)">{txt(usd(landed ? total : 0, 2), s.cx, s.top + 170, 120)}</g>
      {Array.from({ length: n }, (_, i) => {
        const at = tickAt(i, n, dur);
        if (f < at - 14) return null;
        const u = k01(f, at - 14, at, climb);
        const x = cx - 230 + (i % 3) * 150;
        const y = by - 30 - Math.floor(i / 3) * 120 - (1 - u) * 700;
        const kind = i % 3;
        return (
          <g key={i}>
            {kind === 0 && <rect x={x} y={y - 180} width={110} height={180} rx={6} fill="#3a3a3a" stroke="#ddd" strokeWidth={5} />}
            {kind === 1 && <path d={`M ${x + 30} ${y} v -130 q 0 -30 20 -40 v -30 h 20 v 30 q 20 10 20 40 v 130 Z`} fill="#555" stroke="#ddd" strokeWidth={5} />}
            {kind === 2 && <ellipse cx={x + 60} cy={y - 60} rx={62} ry={58} fill="#262626" stroke="#ddd" strokeWidth={5} />}
          </g>
        );
      })}
      <path d={`M ${cx - 330} ${by - 400} L ${cx + 300} ${by - 400} L ${cx + 240} ${by} L ${cx - 270} ${by} Z`} fill="#1a1a1a" fillOpacity={0.55} stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
      {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={cx - 330 + i * 105} y1={by - 400} x2={cx - 270 + i * 85} y2={by} stroke="#777" strokeWidth={4} />)}
      {[1, 2, 3].map((i) => <line key={`h${i}`} x1={cx - 330 + i * 15} y1={by - 400 + i * 100} x2={cx + 300 - i * 15} y2={by - 400 + i * 100} stroke="#777" strokeWidth={4} />)}
      <path d={`M ${cx + 300} ${by - 400} l 90 -90 h 60`} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${cx - 250} ${by} v 60 h 470`} fill="none" stroke="#ccc" strokeWidth={8} />
      {[cx - 220, cx + 190].map((x) => <circle key={x} cx={x} cy={gy - 40} r={36} fill="#111" stroke="#ddd" strokeWidth={7} />)}
    </Frame>
  );
}

// A holiday table set around a roast turkey; the price tag hanging over it keeps climbing.
export function Feast({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const ty = gy - 300;
  const price = Math.round(interpolate(f, [dur * 0.15, dur * 0.85], [48, 64], climb));
  const sw = Math.sin(f / 14) * 6;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left + 20} y={ty} width={s.width - 40} height={34} rx={8} fill="#2a2a2a" stroke="#ddd" strokeWidth={6} />
      {[s.left + 80, s.right - 80].map((x) => <rect key={x} x={x - 15} y={ty + 34} width={30} height={gy - ty - 34} fill="#262626" stroke="#bbb" strokeWidth={5} />)}
      {[-330, 330].map((d) => <ellipse key={d} cx={s.cx + d} cy={ty - 8} rx={90} ry={22} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />)}
      <ellipse cx={s.cx} cy={ty - 10} rx={230} ry={38} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M ${s.cx + d * 120} ${ty - 90} L ${s.cx + d * 215} ${ty - 165}`} stroke="#777" strokeWidth={62} strokeLinecap="round" />
          <circle cx={s.cx + d * 238} cy={ty - 182} r={16} fill="#eee" />
          <circle cx={s.cx + d * 252} cy={ty - 170} r={16} fill="#eee" />
        </g>
      ))}
      <ellipse cx={s.cx} cy={ty - 100} rx={195} ry={115} fill="#555" stroke="#eee" strokeWidth={7} />
      <path d={`M ${s.cx - 120} ${ty - 150} Q ${s.cx} ${ty - 200} ${s.cx + 120} ${ty - 150}`} fill="none" stroke="#999" strokeWidth={6} strokeLinecap="round" />
      {[-430, 430].map((d) => <path key={d} d={`M ${s.cx + d} ${ty - 10} v -120`} stroke="#999" strokeWidth={6} />)}
      <g transform={`rotate(${sw} ${s.cx} ${s.top + 40})`}>{tag(s.cx, s.top + 110, `$${price}`, 1.4, true)}</g>
      <line x1={s.cx} y1={s.top - 20} x2={s.cx} y2={s.top + 26} stroke="#bbb" strokeWidth={4} />
    </Frame>
  );
}

// An electric meter on the wall: its disc spins faster and faster and the kWh count races up.
export function PowerMeter({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 20];
  const speed = interpolate(f, [0, dur], [0.03, 0.4], clamp);
  // Integral of the rising speed, so the disc never jumps backwards.
  const phase = 0.03 * f + ((0.4 - 0.03) / (2 * dur)) * f * f;
  const kwh = Math.round(4210 + phase * 40);
  return (
    <Frame p={p} t={t}>
      <rect x={c[0] - 330} y={c[1] - 440} width={660} height={880} rx={30} fill="#1a1a1a" stroke="#999" strokeWidth={6} />
      <circle cx={c[0]} cy={c[1]} r={300} fill="#111" stroke="#fff" strokeWidth={10} />
      <circle cx={c[0]} cy={c[1]} r={270} fill="none" stroke="#555" strokeWidth={5} />
      {[-120, -40, 40, 120].map((x, i) => (
        <g key={x}>
          <circle cx={c[0] + x} cy={c[1] - 120} r={34} fill="#000" stroke="#bbb" strokeWidth={4} />
          <line x1={c[0] + x} y1={c[1] - 120} x2={c[0] + x + Math.sin(phase * (i + 1) * 0.7) * 26} y2={c[1] - 120 - Math.cos(phase * (i + 1) * 0.7) * 26} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
      <rect x={c[0] - 180} y={c[1] - 40} width={360} height={100} rx={8} fill="#000" stroke="#bbb" strokeWidth={5} filter="url(#glow)" />
      {txt(`${kwh} kWh`, c[0], c[1] + 35, 70)}
      <ellipse cx={c[0]} cy={c[1] + 160} rx={200} ry={28} fill="#555" stroke="#ddd" strokeWidth={5} />
      <rect x={c[0] - 200 + ((phase * 140) % 400)} y={c[1] + 135} width={26} height={50} fill="#000" opacity={0.85} />
      {speed > 0.25 && [0, 1, 2].map((i) => <path key={i} d={`M ${c[0] + 340 + i * 30} ${c[1] - 60 + i * 60} q 30 -20 0 -40`} fill="none" stroke="#ccc" strokeWidth={5} opacity={cyc(f, 10, i * 3)} />)}
    </Frame>
  );
}

// Power lines march across the land: pulses of current run past a dimming house into a glowing data centre.
export function Pylons({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const xs = [s.left + 60, s.cx - 120, s.cx + 200];
  const top = gy - 620;
  const pull = k01(f, dur * 0.2, dur * 0.85);
  const wire = (a: number, b: number, y: number) => `M ${a} ${y} Q ${(a + b) / 2} ${y + 70} ${b} ${y}`;
  const end = s.right - 280;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {xs.map((x) => (
        <g key={x} stroke="#ccc" strokeWidth={6} fill="none" strokeLinejoin="round">
          <path d={`M ${x - 70} ${gy} L ${x} ${top} L ${x + 70} ${gy} M ${x - 55} ${gy - 150} L ${x + 45} ${gy - 300} M ${x + 55} ${gy - 150} L ${x - 45} ${gy - 300} M ${x - 35} ${gy - 300} L ${x + 25} ${gy - 470} M ${x + 35} ${gy - 300} L ${x - 25} ${gy - 470}`} />
          <path d={`M ${x - 110} ${top + 60} H ${x + 110} M ${x - 80} ${top + 140} H ${x + 80}`} />
        </g>
      ))}
      {[top + 60, top + 140].map((y) => [0, 1].map((i) => <path key={`${y}${i}`} d={wire(xs[i], xs[i + 1], y)} fill="none" stroke="#777" strokeWidth={4} />))}
      {[top + 60, top + 140].map((y) => <path key={y} d={`M ${xs[2]} ${y} Q ${(xs[2] + end) / 2} ${y + 70} ${end} ${gy - 470}`} fill="none" stroke="#777" strokeWidth={4} />)}
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 40 - pull * 22, i * 7);
        const x = xs[0] + u * (end - xs[0]);
        return <circle key={i} cx={x} cy={top + 60 + Math.sin(u * Math.PI * 3) * 30 + 30} r={10} fill="#fff" opacity={0.4 + pull * 0.6} />;
      })}
      {house(s.left + 30, gy, 180, 1 - pull * 0.85)}
      <g filter="url(#glow)">
        <rect x={end - 30} y={gy - 470} width={240} height={470} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={end + (i % 3) * 70} y={gy - 430 + Math.floor(i / 3) * 105} width={40} height={14} fill="#fff" opacity={0.25 + 0.75 * pull * (((i * 37 + Math.floor(f / 6)) % 5) > 1 ? 1 : 0.3)} />)}
      </g>
    </Frame>
  );
}

// Rows of data-centre racks blink and hum; heat shimmers up off them, more and more.
export function Servers({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const heat = k01(f, 0, dur * 0.8);
  const racks = [s.cx - 400, s.cx - 130, s.cx + 140];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M ${s.cx - 300 + i * 150} ${s.top + 380} q 30 -50 0 -100 q -30 -50 0 -100`} fill="none" stroke="#bbb" strokeWidth={6} strokeLinecap="round" opacity={heat * (0.3 + 0.7 * cyc(f, 24, i * 5))} transform={`translate(0 ${-cyc(f, 24, i * 5) * 40})`} />
      ))}
      {racks.map((x, r) => (
        <g key={x}>
          <rect x={x} y={gy - 700} width={250} height={700} rx={8} fill="#141414" stroke="#ddd" strokeWidth={7} />
          {Array.from({ length: 10 }, (_, i) => {
            const y = gy - 670 + i * 66;
            const on = ((i * 7 + r * 13 + Math.floor(f / 4)) % 6) < 3;
            return (
              <g key={i}>
                <rect x={x + 20} y={y} width={210} height={46} rx={4} fill="#262626" stroke="#555" strokeWidth={3} />
                <circle cx={x + 200} cy={y + 23} r={8} fill="#fff" opacity={on ? 1 : 0.2} filter={on && r === 1 ? "url(#glow)" : undefined} />
                <line x1={x + 40} y1={y + 23} x2={x + 140} y2={y + 23} stroke="#555" strokeWidth={4} />
              </g>
            );
          })}
        </g>
      ))}
    </Frame>
  );
}

// A diesel truck rolls along (the road scrolls) while its fuel gauge sinks toward empty.
export function Truck({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 160;
  const x = s.left + 40;
  const fuel = 1 - k01(f, 0, dur * 0.9);
  const bob = Math.sin(f / 3) * 2;
  const g: Pt = [s.cx, s.top + 230];
  const ang = -70 + fuel * 140;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={60} offset={-f * 14} />
      <g transform={`translate(0 ${bob})`}>
        <rect x={x} y={gy - 360} width={600} height={290} rx={8} fill="#1f1f1f" stroke="#ddd" strokeWidth={7} />
        <path d={`M ${x + 620} ${gy - 70} V ${gy - 300} h 140 l 90 120 V ${gy - 70} Z`} fill="#2a2a2a" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
        <path d={`M ${x + 780} ${gy - 280} l 60 85 h -60 Z`} fill="#555" stroke="#ccc" strokeWidth={5} />
        <rect x={x + 640} y={gy - 400} width={18} height={110} fill="#777" />
        {[0, 1, 2].map((i) => {
          const u = cyc(f, 18, i * 6);
          return <circle key={i} cx={x + 649 - u * 120} cy={gy - 410 - u * 90} r={18 + u * 30} fill="#777" opacity={0.5 * (1 - u)} />;
        })}
      </g>
      {[x + 90, x + 200, x + 480, x + 700, x + 800].map((wx) => (
        <g key={wx} transform={`rotate(${f * 12} ${wx} ${gy - 50})`}>
          <circle cx={wx} cy={gy - 50} r={48} fill="#111" stroke="#ddd" strokeWidth={7} />
          <line x1={wx - 30} y1={gy - 50} x2={wx + 30} y2={gy - 50} stroke="#777" strokeWidth={6} />
        </g>
      ))}
      <path d={`M ${g[0] - 180} ${g[1]} A 180 180 0 0 1 ${g[0] + 180} ${g[1]}`} fill="#111" stroke="#ddd" strokeWidth={7} />
      {txt("E", g[0] - 140, g[1] - 20, 50, "#999")}
      {txt("F", g[0] + 140, g[1] - 20, 50, "#999")}
      <line x1={g[0]} y1={g[1]} x2={g[0] + Math.sin(ang * Math.PI / 180) * 150} y2={g[1] - Math.cos(ang * Math.PI / 180) * 150} stroke="#fff" strokeWidth={9} strokeLinecap="round" filter="url(#glow)" />
      <circle cx={g[0]} cy={g[1]} r={16} fill="#fff" />
    </Frame>
  );
}

// An oil barrel; the price per barrel climbs beside a rising arrow.
export function Barrel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.1, dur * 0.85, climb);
  const bx = s.cx - 160;
  const top = gy - 560;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={bx - 170} y={top} width={340} height={560} fill="#262626" stroke="#fff" strokeWidth={8} />
      <ellipse cx={bx} cy={top} rx={170} ry={44} fill="#3a3a3a" stroke="#fff" strokeWidth={8} />
      {[0.33, 0.66].map((v) => <path key={v} d={`M ${bx - 170} ${top + 560 * v} Q ${bx} ${top + 560 * v + 44} ${bx + 170} ${top + 560 * v}`} fill="none" stroke="#ccc" strokeWidth={6} />)}
      <circle cx={bx + 70} cy={top - 4} r={16} fill="#111" stroke="#bbb" strokeWidth={4} />
      <path d={`M ${bx} ${top + 180} q -50 70 0 110 q 50 -40 0 -110 Z`} fill="#555" stroke="#ddd" strokeWidth={5} />
      <g filter="url(#glow)">
        <path d={`M ${s.cx + 120} ${gy - 120} L ${s.cx + 220} ${gy - 120 - k * 480} L ${s.cx + 320} ${gy - 160 - k * 520}`} fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${s.cx + 320} ${gy - 160 - k * 520} l -70 10 m 70 -10 l -20 65`} fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" />
      </g>
      {txt(`${usd(Math.round(68 + k * 42))}`, s.cx + 250, s.top + 140, 110)}
      {txt("PER BARREL", s.cx + 250, s.top + 200, 44, "#999")}
    </Frame>
  );
}

// A port crane lifts a shipping container off a ship and sets it on the dock stack.
export function Port({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const sea = gy;
  const crane = s.cx + 140;
  const beam = s.top + 160;
  const from: Pt = [s.left + 200, sea - 120];
  const to: Pt = [s.right - 140, gy - 250];
  const up = k01(f, dur * 0.1, dur * 0.3);
  const across = k01(f, dur * 0.3, dur * 0.6);
  const down = k01(f, dur * 0.6, dur * 0.8, settle);
  const cx = from[0] + (to[0] - from[0]) * across;
  const lift = beam + 120;
  const cy = down > 0 ? lift + (to[1] - lift) * down : from[1] + (lift - from[1]) * up;
  const sway = Math.sin(f / 8) * 4 * (1 - down);
  const cont = (x: number, y: number, key?: string | number, glow = false) => (
    <g key={key} filter={glow ? "url(#glow)" : undefined}>
      <rect x={x - 130} y={y - 110} width={260} height={110} fill="#2a2a2a" stroke="#eee" strokeWidth={6} />
      {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={x - 130 + i * 43} y1={y - 100} x2={x - 130 + i * 43} y2={y - 10} stroke="#777" strokeWidth={4} />)}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      <line x1={s.left - 60} y1={sea + 10} x2={s.cx - 20} y2={sea + 10} stroke="#777" strokeWidth={5} strokeDasharray="40 20" strokeDashoffset={-f * 2} />
      <path d={`M ${s.left - 40} ${sea - 120} H ${s.cx - 40} L ${s.cx - 90} ${sea + 40} H ${s.left} Z`} fill="#1a1a1a" stroke="#ddd" strokeWidth={7} strokeLinejoin="round" />
      {cont(s.left + 200 + 270, sea - 120, "s1")}
      <rect x={s.cx - 10} y={gy} width={s.right - s.cx + 80} height={30} fill="#262626" stroke="#bbb" strokeWidth={5} />
      {cont(s.right - 140, gy, "d1")}
      {cont(s.right - 140, gy - 110, "d2")}
      <g stroke="#ccc" strokeWidth={8} fill="none" strokeLinejoin="round">
        <path d={`M ${crane - 60} ${gy} V ${beam} M ${crane + 60} ${gy} V ${beam} M ${crane - 60} ${gy - 250} H ${crane + 60} M ${crane - 60} ${gy - 500} H ${crane + 60}`} />
        <path d={`M ${s.left + 60} ${beam} H ${s.right + 40} M ${crane} ${beam} L ${crane} ${beam - 120} L ${s.left + 120} ${beam}`} />
      </g>
      <rect x={cx - 50} y={beam - 10} width={100} height={40} fill="#555" stroke="#ddd" strokeWidth={5} />
      <line x1={cx} y1={beam + 30} x2={cx + sway} y2={cy - 110} stroke="#bbb" strokeWidth={5} />
      <g transform={`rotate(${sway * 0.4} ${cx} ${cy - 110})`}>{cont(cx + sway, cy, "lift", true)}</g>
    </Frame>
  );
}

// A container stops at a toll gate; coins walk off the buyer's stack into the booth before the bar lifts.
export function Toll({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const gate = s.cx - 40;
  const roll = k01(f, 0, dur * 0.25, settle);
  const pay = k01(f, dur * 0.3, dur * 0.6);
  const lift = k01(f, dur * 0.62, dur * 0.72, pop);
  const go2 = k01(f, dur * 0.72, dur * 0.95);
  const cx = s.left - 120 + roll * 300 + go2 * 380;
  const n = 6;
  const left = n - Math.floor(pay * 3);
  const flying = pay > 0 && pay < 1 ? cyc(f, 20) : -1;
  const stackX = s.right - 90;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g>
        <rect x={cx - 170} y={gy - 230} width={340} height={170} fill="#2a2a2a" stroke="#eee" strokeWidth={6} />
        {[1, 2, 3, 4, 5, 6].map((i) => <line key={i} x1={cx - 170 + i * 48} y1={gy - 220} x2={cx - 170 + i * 48} y2={gy - 70} stroke="#777" strokeWidth={4} />)}
        {[cx - 110, cx + 110].map((x) => <circle key={x} cx={x} cy={gy - 35} r={32} fill="#111" stroke="#ddd" strokeWidth={6} />)}
      </g>
      <rect x={gate + 20} y={gy - 360} width={170} height={360} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <rect x={gate + 45} y={gy - 320} width={120} height={90} fill="#000" stroke="#bbb" strokeWidth={5} filter="url(#glow)" />
      {txt("TARIFF", gate + 105, gy - 260, 34)}
      <g transform={`rotate(${80 * lift} ${gate} ${gy - 150})`}>
        <rect x={gate - 320} y={gy - 165} width={320} height={30} fill="#ddd" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={gate - 300 + i * 80} y={gy - 165} width={40} height={30} fill="#333" />)}
      </g>
      <circle cx={gate} cy={gy - 150} r={20} fill="#fff" />
      {Array.from({ length: left }, (_, i) => coin(stackX, gy - 20 - i * 22, 46, i))}
      {flying >= 0 && coin(stackX + (gate + 105 - stackX) * flying, gy - 20 - left * 22 - Math.sin(flying * Math.PI) * 260, 34, "fly")}
      <Figure x={s.right - 210} ground={gy} s={0.7} flip pose={STAND} headDown={10} />
    </Frame>
  );
}

// A big gauge marked in percent: the needle climbs from 3 to 7 and the readout follows.
export function RateDial({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 200];
  const r = 400;
  const v = 3 + 4.1 * k01(f, dur * 0.15, dur * 0.75, { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const deg = -90 + (v / 10) * 180;
  const at = (val: number, rr: number): Pt => [c[0] + Math.sin(((-90 + val * 18) * Math.PI) / 180) * rr, c[1] - Math.cos(((-90 + val * 18) * Math.PI) / 180) * rr];
  return (
    <Frame p={p} t={t}>
      <path d={`M ${c[0] - r} ${c[1]} A ${r} ${r} 0 0 1 ${c[0] + r} ${c[1]} Z`} fill="#141414" stroke="#fff" strokeWidth={9} />
      <path d={`M ${at(7, r - 40).join(" ")} A ${r - 40} ${r - 40} 0 0 1 ${c[0] + r - 40} ${c[1]}`} fill="none" stroke="#555" strokeWidth={30} />
      {Array.from({ length: 11 }, (_, i) => {
        const [a, b] = [at(i, r - 20), at(i, r - (i % 5 ? 60 : 90))];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ccc" strokeWidth={i % 5 ? 5 : 9} />;
      })}
      {[0, 5, 10].map((i) => { const q = at(i, r - 170); return <g key={i}>{txt(`${i}%`, q[0], q[1] + 20, 56, "#999")}</g>; })}
      <line x1={c[0]} y1={c[1]} x2={c[0] + Math.sin((deg * Math.PI) / 180) * (r - 70)} y2={c[1] - Math.cos((deg * Math.PI) / 180) * (r - 70)} stroke="#fff" strokeWidth={14} strokeLinecap="round" filter="url(#glow)" />
      <circle cx={c[0]} cy={c[1]} r={34} fill="#fff" />
      {txt(`${v.toFixed(1)}%`, c[0], c[1] + 190, 150)}
    </Frame>
  );
}

// A columned central bank; behind it, the rate line steps up and up.
export function CentralBank({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const w = 720;
  const x0 = s.cx - w / 2;
  const roof = gy - 520;
  const steps = 4;
  const k = k01(f, dur * 0.1, dur * 0.85);
  const pts: Pt[] = Array.from({ length: steps + 1 }, (_, i) => [s.left + 40 + i * ((s.width - 80) / steps), roof - 140 - i * 70]);
  const shown = k * steps;
  const path = pts.slice(0, Math.floor(shown) + 1).map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  const i0 = Math.min(steps - 1, Math.floor(shown));
  const fr = shown - i0;
  const tip: Pt = shown >= steps ? pts[steps] : [pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * fr, pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * fr];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`${path} L ${tip[0]} ${tip[1]}`} fill="none" stroke="#fff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
      <circle cx={tip[0]} cy={tip[1]} r={18} fill="#fff" />
      {txt("%", tip[0] + 50, tip[1] - 20, 80)}
      <path d={`M ${x0 - 40} ${roof} L ${s.cx} ${roof - 170} L ${x0 + w + 40} ${roof} Z`} fill="#1f1f1f" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
      <rect x={x0 - 40} y={roof} width={w + 80} height={50} fill="#262626" stroke="#ddd" strokeWidth={6} />
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x={x0 + 30 + i * 125} y={roof + 50} width={56} height={gy - roof - 140} fill="#2a2a2a" stroke="#ccc" strokeWidth={5} />)}
      {[0, 1, 2].map((i) => <rect key={i} x={x0 - 40 - i * 30} y={gy - 90 + i * 30} width={w + 80 + i * 60} height={30} fill="#1a1a1a" stroke="#bbb" strokeWidth={5} />)}
    </Frame>
  );
}

// A house with a FOR SALE sign; the asking price keeps dropping and a tumbleweed rolls past. Nobody comes.
export function ForSale({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const price = Math.round(interpolate(f, [dur * 0.15, dur * 0.85], [450, 405], clamp) / 5) * 5;
  const tw = s.left - 100 + k01(f, dur * 0.3, dur * 0.95) * (s.width + 200);
  const signX = s.right - 250;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {house(s.left + 60, gy, 380)}
      <rect x={signX - 8} y={gy - 420} width={16} height={420} fill="#777" />
      <rect x={signX - 150} y={gy - 420} width={300} height={130} fill="#e6e6e6" stroke="#fff" strokeWidth={5} />
      {txt("FOR SALE", signX, gy - 335, 64, "#111")}
      <g filter="url(#glow)">
        <rect x={signX - 130} y={gy - 270} width={260} height={100} fill="#1a1a1a" stroke="#fff" strokeWidth={5} />
        {txt(`$${price}K`, signX, gy - 195, 70)}
      </g>
      <g transform={`translate(${tw} ${gy - 60}) rotate(${f * 9})`}>
        <circle r={55} fill="none" stroke="#999" strokeWidth={5} />
        <path d="M -40 -20 Q 0 40 40 -25 M -30 30 Q 0 -40 35 30 M -50 5 H 50" fill="none" stroke="#777" strokeWidth={4} />
      </g>
    </Frame>
  );
}

// A house key hangs from a balloon marked % that keeps swelling and rising, just out of the figure's reach.
export function Mortgage({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.1, dur * 0.85);
  const r = 70 + k * 50;
  const kx = s.cx + 50 + Math.sin(f / 18) * 12;
  const ky = gy - 540 - k * 120;
  const by = ky - 110 - r * 1.12;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g filter="url(#glow)">
        <ellipse cx={kx} cy={by} rx={r} ry={r * 1.12} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        {txt("%", kx, by + r * 0.35, r)}
      </g>
      <path d={`M ${kx} ${by + r * 1.12} q 16 50 0 100`} fill="none" stroke="#bbb" strokeWidth={4} />
      <g transform={`translate(${kx} ${ky})`}>
        <circle cx={0} cy={30} r={40} fill="none" stroke="#ddd" strokeWidth={14} />
        <path d="M 0 70 V 210 M 0 170 h 40 M 0 200 h 30" stroke="#ddd" strokeWidth={14} strokeLinecap="round" />
      </g>
      <Figure x={s.cx - 50} ground={gy} s={0.8} pose={mix(STAND, { ...STAND, rs: 170, re: 172 }, k01(f, 0, dur * 0.2))} headDown={-25} />
    </Frame>
  );
}

// Gold bars stack into a pyramid while the price per ounce counts up past $5,000.
export function Gold({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const rows = [4, 3, 2, 1];
  const all = rows.flatMap((n, r) => Array.from({ length: n }, (_, i) => ({ r, x: s.cx + (i - (n - 1) / 2) * 200 })));
  const price = Math.round(interpolate(f, [0, dur * 0.85], [3800, 5050], climb) / 10) * 10;
  const shine = ((f * 14) % 1400) - 300;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g filter="url(#glow)">{txt(usd(price), s.cx, s.top + 160, 140)}</g>
      {txt("PER OUNCE", s.cx, s.top + 230, 46, "#999")}
      <defs><clipPath id="goldShine"><rect x={s.left + shine} y={0} width={60} height={3000} transform="skewX(-20)" /></clipPath></defs>
      {all.map((b, i) => {
        const at = tickAt(i, all.length, dur);
        if (f < at - 10) return null;
        const u = k01(f, at - 10, at, climb);
        const y = gy - b.r * 100 - (1 - u) * 600;
        const bar = `M ${b.x - 90} ${y} L ${b.x - 70} ${y - 95} H ${b.x + 70} L ${b.x + 90} ${y} Z`;
        return (
          <g key={i}>
            <path d={bar} fill="#ddd" stroke="#fff" strokeWidth={5} strokeLinejoin="round" />
            <path d={`M ${b.x - 60} ${y - 80} H ${b.x + 60}`} stroke="#aaa" strokeWidth={5} />
            <path d={bar} fill="#fff" opacity={0.7} clipPath="url(#goldShine)" />
          </g>
        );
      })}
    </Frame>
  );
}

// A month on a calendar: day after day lights up as another SALE, until the whole month is one.
export function SaleMonth({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x0 = s.left + 40;
  const y0 = s.top + 180;
  const cw = (s.width - 80) / 7;
  const ch = 130;
  const lit = Math.floor(k01(f, dur * 0.05, dur * 0.85) * 30);
  return (
    <Frame p={p} t={t}>
      <rect x={x0 - 20} y={s.top + 20} width={s.width - 40} height={ch * 5 + 200} rx={18} fill="#141414" stroke="#fff" strokeWidth={8} />
      <rect x={x0 - 20} y={s.top + 20} width={s.width - 40} height={130} rx={18} fill="#2a2a2a" stroke="#fff" strokeWidth={8} />
      {txt("NOVEMBER", s.cx, s.top + 115, 80)}
      {Array.from({ length: 30 }, (_, i) => {
        const x = x0 + ((i + 5) % 7) * cw;
        const y = y0 + Math.floor((i + 5) / 7) * ch;
        const on = i < lit;
        const newest = i === lit - 1;
        return (
          <g key={i} filter={newest ? "url(#glow)" : undefined}>
            <rect x={x + 6} y={y + 6} width={cw - 12} height={ch - 12} rx={8} fill={on ? "#e6e6e6" : "#1a1a1a"} stroke={on ? "#fff" : "#555"} strokeWidth={4} />
            {txt(on ? "SALE" : String(i + 1), x + cw / 2, y + ch / 2 + 16, on ? 38 : 40, on ? "#111" : "#777")}
          </g>
        );
      })}
    </Frame>
  );
}

// A crowd waits at a store's closed doors; they slide open, light floods out and the crowd surges in.
export function Doorbuster({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const open = k01(f, dur * 0.4, dur * 0.55, settle);
  const surge = k01(f, dur * 0.55, dur * 0.95);
  const dw = 360;
  const top = gy - 560;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left + 20} y={top - 170} width={s.width - 40} height={gy - top + 170} fill="#141414" stroke="#ccc" strokeWidth={6} />
      <rect x={s.cx - 260} y={top - 140} width={520} height={100} rx={10} fill="#1a1a1a" stroke="#fff" strokeWidth={6} />
      {txt("SALE", s.cx, top - 62, 80, open > 0.5 ? "#fff" : "#777")}
      <rect x={s.cx - dw} y={top} width={dw * 2} height={gy - top} fill="#fff" opacity={open} filter="url(#glow)" />
      {[-1, 1].map((d) => (
        <rect key={d} x={d < 0 ? s.cx - dw - open * dw * 0.9 : s.cx + open * dw * 0.9} y={top} width={dw} height={gy - top} fill="#262626" fillOpacity={0.9} stroke="#ddd" strokeWidth={6} />
      ))}
      <polygon points={`${s.cx - dw},${gy} ${s.cx + dw},${gy} ${s.right + 200},${s.bottom + 400} ${s.left - 200},${s.bottom + 400}`} fill="#fff" opacity={0.12 * open} />
      {Array.from({ length: 7 }, (_, i) => {
        const x = s.cx + (i - 3) * 130 + ((i * 41) % 30);
        const ph = f * 0.12 + i;
        return <Figure key={i} x={x} ground={gy + 10 + (i % 2) * 30 - surge * 60} s={0.62 - surge * 0.12} back pose={surge > 0 ? walk(ph, 0.6) : { ...STAND, ls: -10 + Math.sin(f / 10 + i) * 6 }} color={i === 3 ? "#ececec" : "#888"} glow={false} />;
      })}
    </Frame>
  );
}

// A phone chat: you ask, the assistant thinks, then answers with one product, and the cart fills.
export function Assistant({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pw = 520;
  const x0 = s.cx - pw / 2;
  const y0 = s.top + 20;
  const ph = s.height - 40;
  const ask = k01(f, dur * 0.05, dur * 0.15, pop);
  const think = f > dur * 0.18 && f < dur * 0.4;
  const reply = k01(f, dur * 0.4, dur * 0.5, pop);
  const buy = k01(f, dur * 0.7, dur * 0.78, pop);
  return (
    <Frame p={p} t={t}>
      <rect x={x0} y={y0} width={pw} height={ph} rx={60} fill="#0d0d0d" stroke="#fff" strokeWidth={9} />
      <rect x={s.cx - 70} y={y0 + 24} width={140} height={22} rx={11} fill="#333" />
      <g transform={`translate(${x0 + pw - 60} ${y0 + 150}) scale(${ask})`}>
        <rect x={-300} y={0} width={300} height={90} rx={30} fill="#3a3a3a" stroke="#bbb" strokeWidth={4} />
        <rect x={-270} y={30} width={180} height={12} rx={6} fill="#999" />
        <rect x={-270} y={54} width={120} height={12} rx={6} fill="#999" />
      </g>
      {think && [0, 1, 2].map((i) => <circle key={i} cx={x0 + 90 + i * 40} cy={y0 + 320} r={12} fill="#ccc" opacity={0.3 + 0.7 * cyc(f, 18, i * 6)} />)}
      <g transform={`translate(${x0 + 50} ${y0 + 290}) scale(${reply})`} filter="url(#glow)">
        <rect x={0} y={0} width={380} height={420} rx={30} fill="#1f1f1f" stroke="#fff" strokeWidth={5} />
        <rect x={40} y={40} width={300} height={200} rx={14} fill="#3a3a3a" stroke="#ccc" strokeWidth={4} />
        <path d="M 130 200 l 60 -100 l 60 100 Z" fill="#777" />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${70 + i * 55} 290 l 10 22 h 24 l -19 14 l 7 24 l -22 -14 l -22 14 l 7 -24 l -19 -14 h 24 Z`} fill="#fff" />)}
        <rect x={60} y={350} width={260} height={50} rx={25} fill={buy > 0.5 ? "#fff" : "#555"} />
        {txt("BUY", 190, 388, 40, buy > 0.5 ? "#111" : "#ddd")}
      </g>
      <g transform={`translate(${s.cx} ${y0 + ph - 160}) scale(${0.6 + buy * 0.4})`} opacity={buy}>
        <path d="M -110 -60 h 40 l 30 110 h 130 l 30 -80 h -170" fill="none" stroke="#fff" strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
        {[-20, 90].map((x) => <circle key={x} cx={x} cy={80} r={16} fill="#fff" />)}
      </g>
    </Frame>
  );
}

// An injection pen clicks once; the heaped plate beside it shrinks to a small portion.
export function Appetite({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const click = k01(f, dur * 0.2, dur * 0.28, pop);
  const ring = k01(f, dur * 0.25, dur * 0.45);
  const shrink = k01(f, dur * 0.35, dur * 0.85);
  const pc: Pt = [s.cx + 170, s.cy + 260];
  const food = 1 - shrink * 0.65;
  const px = s.left + 230;
  return (
    <Frame p={p} t={t}>
      <ellipse cx={pc[0]} cy={pc[1]} rx={290} ry={100} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <ellipse cx={pc[0]} cy={pc[1]} rx={250} ry={78} fill="none" stroke="#555" strokeWidth={5} />
      <g transform={`translate(${pc[0]} ${pc[1] - 10}) scale(${food})`}>
        {[[-120, -20, 70], [0, -50, 95], [120, -20, 70], [-60, -110, 60], [70, -120, 65], [0, -180, 55]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#3a3a3a" : "#555"} stroke="#ddd" strokeWidth={5} />
        ))}
      </g>
      <g transform={`rotate(-12 ${px} ${s.cy})`} filter="url(#glow)">
        <rect x={px - 45} y={s.cy - 420} width={90} height={560} rx={40} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        <rect x={px - 30} y={s.cy - 180} width={60} height={140} rx={10} fill="#555" />
        <rect x={px - 35} y={s.cy - 480 + click * 40} width={70} height={70} rx={14} fill="#bbb" stroke="#fff" strokeWidth={5} />
        <rect x={px - 6} y={s.cy + 140} width={12} height={40} fill="#ccc" />
      </g>
      {ring > 0 && ring < 1 && <circle cx={px + 40} cy={s.cy - 450} r={40 + ring * 120} fill="none" stroke="#fff" strokeWidth={5} opacity={1 - ring} />}
    </Frame>
  );
}

// The figure walks out of the office carrying a box of their things; behind them a screen marked AI lights up.
export function Layoff({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const sc = 0.85;
  const ph = f * 0.1;
  const x = s.left + 260 + ph * walkRate(0.7) * sc;
  const on = k01(f, dur * 0.35, dur * 0.5);
  const hands: [Pt, Pt] = [[70, -40], [95, -40]];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left + 20} y={gy - 640} width={240} height={640} fill="#1a1a1a" stroke="#ccc" strokeWidth={6} />
      <rect x={s.left + 50} y={gy - 600} width={180} height={600} fill="#000" stroke="#555" strokeWidth={4} />
      <rect x={s.left + 330} y={gy - 230} width={300} height={20} fill="#2a2a2a" stroke="#bbb" strokeWidth={5} />
      <rect x={s.left + 350} y={gy - 210} width={16} height={210} fill="#555" />
      <rect x={s.left + 590} y={gy - 210} width={16} height={210} fill="#555" />
      <g filter={on > 0.5 ? "url(#glow)" : undefined}>
        <rect x={s.left + 380} y={gy - 440} width={200} height={140} rx={8} fill={on > 0.5 ? "#e6e6e6" : "#111"} stroke="#fff" strokeWidth={6} />
        {txt("AI", s.left + 480, gy - 345, 80, on > 0.5 ? "#111" : "#333")}
      </g>
      <rect x={s.left + 465} y={gy - 300} width={30} height={70} fill="#777" />
      <Figure x={x} ground={gy} s={sc} pose={walk(ph, 0.7)} hands={hands} />
      {box(x + 50 * sc, gy - HIP * sc + 10 * sc, 130, 100)}
      <path d={`M ${x + 70 * sc} ${gy - HIP * sc - 85 * sc} v -50 M ${x + 110 * sc} ${gy - HIP * sc - 85 * sc} l 20 -40`} stroke="#999" strokeWidth={6} strokeLinecap="round" />
    </Frame>
  );
}

// One price jumps, and the jump spreads: rings ripple out and every tag around it ticks up in turn.
export function Spillover({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 80];
  const n = 6;
  const around = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [c[0] + Math.cos(a) * 370, c[1] + Math.sin(a) * 380] as Pt;
  });
  const first = k01(f, dur * 0.05, dur * 0.2, pop);
  return (
    <Frame p={p} t={t}>
      {[0, 1, 2].map((i) => {
        const u = cyc(f, 45, i * 15);
        return <circle key={i} cx={c[0]} cy={c[1] + 60} r={80 + u * 380} fill="none" stroke="#fff" strokeWidth={5} opacity={(1 - u) * 0.5 * first} />;
      })}
      {around.map(([x, y], i) => {
        const at = tickAt(i, n, dur) + dur * 0.15;
        const u = k01(f, at - 8, at, pop);
        return (
          <g key={i}>
            <line x1={c[0]} y1={c[1] + 60} x2={x} y2={y} stroke="#555" strokeWidth={4} strokeDasharray="14 12" />
            {tag(x, y - 40, u > 0.5 ? `$${5 + i}` : `$${3 + i}`, 0.62 + u * 0.08, false, i)}
          </g>
        );
      })}
      <g transform={`translate(0 ${(1 - first) * 40})`}>{tag(c[0], c[1] - 70, "$5.30", 1.15, true)}</g>
    </Frame>
  );
}

// A product box shrinks inside the outline of its old size while its price tag stays exactly the same.
export function Shrink({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.2, dur * 0.8);
  const w = 440 - k * 110;
  const h = 680 - k * 200;
  const x = s.cx - 120;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={x - 220} y={gy - 680} width={440} height={680} fill="none" stroke="#777" strokeWidth={5} strokeDasharray="20 16" />
      <rect x={x - w / 2} y={gy - h} width={w} height={h} rx={10} fill="#2a2a2a" stroke="#fff" strokeWidth={8} />
      <circle cx={x} cy={gy - h * 0.6} r={w * 0.25} fill="#3a3a3a" stroke="#ccc" strokeWidth={5} />
      <rect x={x - w * 0.35} y={gy - h * 0.25} width={w * 0.7} height={30} rx={6} fill="#555" />
      <g transform={`rotate(${Math.sin(f / 15) * 5} ${s.right - 150} ${gy - 640})`}>{tag(s.right - 150, gy - 580, "$4.99", 1.3, true)}</g>
      <line x1={s.right - 150} y1={gy - 700} x2={s.right - 150} y2={gy - 640} stroke="#bbb" strokeWidth={4} />
    </Frame>
  );
}

// A wallet squeezed in a bench vise: the jaws close and coins pop out of it.
export function Vise({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.1, dur * 0.8);
  const gap = 360 - k * 170;
  const wy = gy - 480;
  const bench = gy - 260;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left + 20} y={bench} width={s.width - 40} height={40} fill="#262626" stroke="#bbb" strokeWidth={6} />
      {[s.left + 70, s.right - 90].map((x) => <rect key={x} x={x} y={bench + 40} width={24} height={gy - bench - 40} fill="#3a3a3a" />)}
      <g filter="url(#glow)">
        <rect x={s.cx - gap / 2} y={wy - 130} width={gap} height={260} rx={24} fill="#3a3a3a" stroke="#fff" strokeWidth={7} />
        <path d={`M ${s.cx - gap / 2} ${wy - 40} H ${s.cx + gap / 2}`} stroke="#ccc" strokeWidth={5} />
      </g>
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${s.cx + d * (gap / 2 + 70)} 0)`}>
          <rect x={-70} y={wy - 190} width={140} height={330} rx={8} fill="#555" stroke="#ddd" strokeWidth={7} />
          <rect x={-55} y={wy + 140} width={110} height={bench - wy - 140} fill="#3a3a3a" stroke="#bbb" strokeWidth={5} />
        </g>
      ))}
      <rect x={s.cx + gap / 2 + 140} y={wy - 25} width={s.right - s.cx - gap / 2 - 150} height={50} fill="#777" />
      <rect x={s.right - 30} y={wy - 110} width={30} height={220} rx={10} fill="#999" transform={`rotate(${k * 160} ${s.right - 15} ${wy})`} />
      {k > 0.4 && [0, 1, 2, 3].map((i) => {
        const u = cyc(f, 30, i * 7);
        const dir = i % 2 ? 1 : -1;
        return coin(s.cx + dir * (40 + u * 160), wy - 150 - Math.sin(u * Math.PI) * 220 + u * 300, 26, i);
      })}
    </Frame>
  );
}

// Factory, ship, truck, store: a box travels the chain and picks up a cost at every stop.
export function Supply({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 170;
  const xs = [s.left + 110, s.left + 350, s.left + 590, s.left + 830];
  const k = k01(f, dur * 0.05, dur * 0.9) * 3;
  const seg = Math.min(2, Math.floor(k));
  const bx = xs[seg] + (xs[seg + 1] - xs[seg]) * (k - seg);
  const stops = Math.floor(k + 0.02);
  const price = [2, 3, 4, 6][Math.min(3, stops)];
  const icon = (i: number, x: number) => {
    const st = { fill: "#1a1a1a", stroke: "#ddd", strokeWidth: 6, strokeLinejoin: "round" as const };
    if (i === 0) return <path d={`M ${x - 90} ${gy} V ${gy - 120} l 60 -40 v 40 l 60 -40 v 40 l 60 -40 V ${gy} Z M ${x + 50} ${gy - 160} V ${gy - 260} h 30 V ${gy - 140}`} {...st} />;
    if (i === 1) return <path d={`M ${x - 100} ${gy - 70} H ${x + 100} L ${x + 70} ${gy} H ${x - 70} Z M ${x - 60} ${gy - 70} V ${gy - 130} H ${x + 30} V ${gy - 70}`} {...st} />;
    if (i === 2) return <path d={`M ${x - 100} ${gy - 30} V ${gy - 140} H ${x + 30} V ${gy - 30} Z M ${x + 30} ${gy - 30} V ${gy - 100} h 50 l 25 40 V ${gy - 30} Z`} {...st} />;
    return <path d={`M ${x - 90} ${gy} V ${gy - 120} H ${x + 90} V ${gy} Z M ${x - 105} ${gy - 120} l 25 -50 H ${x + 80} l 25 50 M ${x - 25} ${gy} V ${gy - 70} H ${x + 25} V ${gy}`} {...st} />;
  };
  return (
    <Frame p={p} t={t}>
      <line x1={xs[0]} y1={gy + 40} x2={xs[3]} y2={gy + 40} stroke="#555" strokeWidth={5} strokeDasharray="18 14" />
      {xs.map((x, i) => (
        <g key={i}>
          {icon(i, x)}
          {i > 0 && stops >= i && txt("+$", x, gy + 120, 52, "#999")}
        </g>
      ))}
      <g filter="url(#glow)">
        {box(bx - 50, gy - 300, 100, 90)}
        {tag(bx, gy - 520, `$${price}`, 0.8)}
      </g>
    </Frame>
  );
}

// A dollar bill shrinks inside the outline of what it used to be.
export function Dollar({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, dur * 0.15, dur * 0.85);
  const sc = 1 - k * 0.45;
  const w = 820;
  const h = 380;
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - w / 2} y={s.cy - h / 2} width={w} height={h} rx={20} fill="none" stroke="#777" strokeWidth={5} strokeDasharray="22 16" />
      <g transform={`translate(${s.cx} ${s.cy}) scale(${sc}) rotate(${Math.sin(f / 20) * 2})`} filter="url(#glow)">
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} fill="#9a9a9a" stroke="#fff" strokeWidth={8} />
        <rect x={-w / 2 + 30} y={-h / 2 + 30} width={w - 60} height={h - 60} rx={12} fill="none" stroke="#eee" strokeWidth={5} />
        <circle r={120} fill="#bbb" stroke="#eee" strokeWidth={6} />
        {txt("$1", 0, 40, 120, "#111")}
        {[-1, 1].map((d) => txt("1", d * (w / 2 - 80), -h / 2 + 100, 70, "#eee", d))}
      </g>
      {txt(`${Math.round(100 - k * 22)}¢`, s.cx, s.cy + h / 2 + 170, 100, "#ccc")}
    </Frame>
  );
}

// An envelope opens and the electric bill slides out; the amount due keeps climbing.
export function PowerBill({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const ex = s.cx - 380;
  const ey = s.cy + 120;
  const out = k01(f, dur * 0.05, dur * 0.35, settle);
  const amt = interpolate(f, [dur * 0.35, dur * 0.85], [96, 148], climb);
  const py = ey - 40 - out * 520;
  return (
    <Frame p={p} t={t}>
      <rect x={ex + 40} y={py} width={680} height={620} rx={10} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
      <path d={`M ${ex + 120} ${py + 90} l 30 -60 h 20 l -15 40 h 30 l -45 70 l 10 -50 h -30 Z`} fill="#111" />
      {[0, 1, 2].map((i) => <rect key={i} x={ex + 230} y={py + 50 + i * 36} width={380 - i * 90} height={16} rx={8} fill="#999" />)}
      <g filter="url(#glow)">
        <rect x={ex + 100} y={py + 220} width={560} height={160} rx={10} fill="#111" stroke="#fff" strokeWidth={5} />
        {txt(usd(amt, 2), ex + 380, py + 340, 110)}
      </g>
      <rect x={ex} y={ey} width={760} height={420} rx={14} fill="#262626" stroke="#ddd" strokeWidth={7} />
      <path d={`M ${ex} ${ey + 420} L ${ex + 380} ${ey + 180} L ${ex + 760} ${ey + 420}`} fill="none" stroke="#999" strokeWidth={6} />
      <path d={`M ${ex} ${ey} L ${ex + 380} ${ey - 240 * (1 - out)} L ${ex + 760} ${ey}`} fill="#2a2a2a" stroke="#ddd" strokeWidth={7} strokeLinejoin="round" />
    </Frame>
  );
}

// A tanker steams through a narrow strait; a barrier drops across it and the oil price arrow shoots up.
export function Strait({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 220;
  const shut = k01(f, dur * 0.35, dur * 0.48, settle);
  const sail = Math.min(k01(f, 0, dur * 0.35), 1);
  const tx = s.left - 100 + sail * 360;
  const rise = k01(f, dur * 0.5, dur * 0.9, climb);
  const bar = s.cx + 120;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.left - 120} ${sea} L ${s.left - 120} ${sea - 320} Q ${s.left} ${sea - 360} ${s.left + 60} ${sea - 160} L ${s.left + 120} ${sea} Z`} fill="#262626" stroke="#ccc" strokeWidth={6} />
      <path d={`M ${s.right + 120} ${sea} L ${s.right + 120} ${sea - 420} Q ${s.right - 20} ${sea - 440} ${s.right - 120} ${sea - 200} L ${s.right - 180} ${sea} Z`} fill="#262626" stroke="#ccc" strokeWidth={6} />
      {[0, 1, 2].map((i) => <path key={i} d={`M ${s.left - 60} ${sea + 30 + i * 50} q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0`} fill="none" stroke="#555" strokeWidth={4} transform={`translate(${-((f * (1 + i * 0.3)) % 240)} 0)`} />)}
      <g transform={`translate(${tx} ${sea + Math.sin(f / 10) * 4})`}>
        <path d="M -260 -70 H 260 L 220 20 H -230 Z" fill="#1a1a1a" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
        <rect x={150} y={-170} width={90} height={100} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />
        {[-170, -80, 10, 100].map((x) => <ellipse key={x} cx={x + 30} cy={-80} rx={38} ry={14} fill="#3a3a3a" stroke="#bbb" strokeWidth={4} />)}
      </g>
      <g transform={`translate(0 ${(shut - 1) * 500})`} opacity={shut > 0 ? 1 : 0}>
        <line x1={bar} y1={sea - 480} x2={bar} y2={sea + 20} stroke="#ddd" strokeWidth={10} />
        {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={bar} cy={sea - 40 - i * 55} r={14} fill="#999" stroke="#ddd" strokeWidth={4} />)}
      </g>
      <g filter="url(#glow)" opacity={rise > 0 ? 1 : 0}>
        <path d={`M ${s.cx - 40} ${s.top + 420} L ${s.cx + 60} ${s.top + 420 - rise * 280}`} stroke="#fff" strokeWidth={14} strokeLinecap="round" />
        <path d={`M ${s.cx + 60} ${s.top + 420 - rise * 280} l -55 15 m 55 -15 l -5 58`} stroke="#fff" strokeWidth={14} strokeLinecap="round" fill="none" />
      </g>
      {txt("OIL", s.cx + 200, s.top + 330, 90, rise > 0 ? "#fff" : "#555")}
    </Frame>
  );
}

// Parcels drop onto the doorstep one after another and pile up against the door.
export function Parcels({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const spots: [number, number, number, number][] = [[-280, 0, 220, 170], [-40, 0, 200, 150], [180, 0, 180, 190], [-200, 170, 180, 140], [10, 150, 200, 130], [-110, 310, 160, 120], [190, 190, 150, 110]];
  const n = spots.length;
  const landed = spots.filter((_, i) => f >= tickAt(i, n, dur)).length;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx - 200} y={gy - 820} width={400} height={820} fill="#1a1a1a" stroke="#ccc" strokeWidth={7} />
      <rect x={s.cx - 160} y={gy - 780} width={320} height={780} fill="#262626" stroke="#777" strokeWidth={5} />
      <circle cx={s.cx + 110} cy={gy - 400} r={14} fill="#bbb" />
      <rect x={s.cx - 360} y={gy - 20} width={720} height={20} fill="#3a3a3a" />
      {spots.map(([dx, dy, w, h], i) => {
        const at = tickAt(i, n, dur);
        if (f < at - 12) return null;
        const u = k01(f, at - 12, at, climb);
        return box(s.cx + dx - w / 2 + 40, gy - 20 - dy - (1 - u) * 800, w, h, i, i === landed - 1);
      })}
    </Frame>
  );
}

// A crowd of products pours into a funnel; one comes out the bottom, glowing, the only choice left.
export function Funnel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const top = s.top + 260;
  const neck = s.cy + 80;
  const out = k01(f, dur * 0.5, dur * 0.75, pop);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 14 }, (_, i) => {
        const u = cyc(f, 40, i * 11);
        const x0 = s.left + 60 + ((i * 137) % (s.width - 120));
        const x = x0 + (s.cx - x0) * u;
        const y = s.top + 20 + u * (neck - s.top - 60);
        const sh = i % 3;
        return (
          <g key={i} opacity={1 - u * 0.8}>
            {sh === 0 && <rect x={x - 30} y={y - 30} width={60} height={60} rx={6} fill="#3a3a3a" stroke="#bbb" strokeWidth={4} />}
            {sh === 1 && <circle cx={x} cy={y} r={30} fill="#555" stroke="#bbb" strokeWidth={4} />}
            {sh === 2 && <path d={`M ${x} ${y - 34} l 32 60 h -64 Z`} fill="#262626" stroke="#bbb" strokeWidth={4} />}
          </g>
        );
      })}
      <path d={`M ${s.left + 20} ${top} L ${s.cx - 50} ${neck} V ${neck + 140} M ${s.right - 20} ${top} L ${s.cx + 50} ${neck} V ${neck + 140}`} fill="none" stroke="#fff" strokeWidth={10} strokeLinejoin="round" />
      <ellipse cx={s.cx} cy={top} rx={(s.width - 40) / 2} ry={50} fill="none" stroke="#ddd" strokeWidth={7} />
      <g transform={`translate(${s.cx} ${neck + 160 + out * 90}) scale(${out})`} filter="url(#glow)">
        <rect x={-90} y={-90} width={180} height={180} rx={14} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        <path d="M -40 0 l 30 30 l 55 -60" fill="none" stroke="#111" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

// A line of people outside an office door keeps getting longer as more walk up and join it.
export function Queue({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const door = s.left + 60;
  const n = 7;
  const gap = 115;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={door - 40} y={gy - 600} width={200} height={600} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      <rect x={door - 10} y={gy - 570} width={140} height={570} fill="#262626" filter="url(#glow)" />
      {Array.from({ length: n }, (_, i) => {
        const slot = door + 220 + i * gap;
        const joinAt = i < 3 ? -1 : tickAt(i - 3, n - 3, dur);
        const u = joinAt < 0 ? 1 : k01(f, joinAt - 40, joinAt);
        if (u <= 0) return null;
        const x = slot + (1 - u) * 500;
        const walking = u < 1;
        return <Figure key={i} x={x} ground={gy} s={0.6} flip pose={walking ? walk(f * 0.12 + i, 0.7) : { ...STAND, ls: -10 + Math.sin(f / 15 + i) * 4 }} color={i === n - 1 ? "#ececec" : "#888"} glow={i === n - 1} headDown={walking ? 0 : 15} />;
      })}
    </Frame>
  );
}

// A boxy robot slides into the desk chair and starts typing; the figure is left standing beside it.
export function Robot({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const slide = k01(f, dur * 0.1, dur * 0.4, settle);
  const rx = s.right + 200 - slide * (s.right + 200 - (s.cx + 80));
  const typing = f > dur * 0.45;
  const arm = typing ? Math.sin(f / 2) * 10 : 0;
  const desk = gy - 300;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx - 260} y={desk} width={520} height={24} fill="#2a2a2a" stroke="#bbb" strokeWidth={5} />
      {[s.cx - 240, s.cx + 220].map((x) => <rect key={x} x={x} y={desk + 24} width={20} height={gy - desk - 24} fill="#555" />)}
      <rect x={s.cx - 180} y={desk - 230} width={260} height={180} rx={10} fill={typing ? "#e6e6e6" : "#111"} stroke="#fff" strokeWidth={6} filter={typing ? "url(#glow)" : undefined} />
      {typing && [0, 1, 2, 3].map((i) => <rect key={i} x={s.cx - 150} y={desk - 200 + i * 36} width={((f * 6 + i * 50) % 180) + 20} height={14} rx={7} fill="#555" />)}
      <rect x={s.cx - 65} y={desk - 50} width={30} height={50} fill="#777" />
      <g transform={`translate(${rx} 0)`}>
        <rect x={-90} y={desk - 120} width={180} height={220} rx={16} fill="#3a3a3a" stroke="#ddd" strokeWidth={6} />
        <rect x={-75} y={desk - 280} width={150} height={140} rx={14} fill="#262626" stroke="#ddd" strokeWidth={6} />
        {[-35, 35].map((d) => <rect key={d} x={d - 18} y={desk - 230} width={36} height={18} rx={4} fill="#fff" />)}
        <line x1={0} y1={desk - 280} x2={0} y2={desk - 330} stroke="#ddd" strokeWidth={6} />
        <circle cx={0} cy={desk - 340} r={12} fill="#fff" />
        <path d={`M -80 ${desk - 70} L -170 ${desk - 10 + arm}`} stroke="#ddd" strokeWidth={18} strokeLinecap="round" />
        <rect x={-70} y={desk + 100} width={40} height={gy - desk - 100} fill="#555" />
        <rect x={30} y={desk + 100} width={40} height={gy - desk - 100} fill="#555" />
      </g>
      <Figure x={s.left + 130} ground={gy} s={0.8} pose={STAND} headDown={12} />
    </Frame>
  );
}

// A vending machine full of snacks empties row by row as nobody buys them.
export function Snacks({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const mw = 560;
  const x0 = s.cx - mw / 2;
  const top = gy - 900;
  const rows = 5;
  const cols = 4;
  const gone = Math.floor(k01(f, dur * 0.1, dur * 0.85) * rows * cols * 0.7);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={x0} y={top} width={mw} height={900} rx={20} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <rect x={x0 + 30} y={top + 30} width={380} height={700} fill="#0d0d0d" stroke="#999" strokeWidth={5} filter="url(#glow)" />
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const order = (i * 7) % (rows * cols);
        if (order < gone) return null;
        return <path key={i} d={`M ${x0 + 55 + c * 90} ${top + 140 + r * 135} l 8 -90 h 54 l 8 90 Z`} fill={(r + c) % 2 ? "#555" : "#3a3a3a"} stroke="#ccc" strokeWidth={4} />;
      })}
      {Array.from({ length: rows }, (_, r) => <line key={r} x1={x0 + 30} y1={top + 145 + r * 135} x2={x0 + 410} y2={top + 145 + r * 135} stroke="#777" strokeWidth={4} />)}
      <rect x={x0 + 435} y={top + 60} width={95} height={240} rx={8} fill="#262626" stroke="#bbb" strokeWidth={4} />
      {Array.from({ length: 6 }, (_, i) => <circle key={i} cx={x0 + 460 + (i % 2) * 45} cy={top + 110 + Math.floor(i / 2) * 60} r={14} fill="#555" />)}
      <rect x={x0 + 60} y={top + 770} width={320} height={80} rx={8} fill="#000" stroke="#999" strokeWidth={5} />
    </Frame>
  );
}

// Two bars race upward, pay and prices; prices pull ahead and the gap between them opens.
export function Race({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const k = k01(f, dur * 0.1, dur * 0.85);
  const pay = 120 + k * 330;
  const prices = 120 + k * k * 560 + k * 100;
  const bw = 240;
  const xs = [s.cx - 300, s.cx + 60];
  return (
    <Frame p={p} t={t}>
      <line x1={s.left + 20} y1={gy} x2={s.right - 20} y2={gy} stroke="#ccc" strokeWidth={6} />
      <rect x={xs[0]} y={gy - pay} width={bw} height={pay} fill="#555" stroke="#ddd" strokeWidth={6} />
      <rect x={xs[1]} y={gy - prices} width={bw} height={prices} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      {k > 0.3 && <path d={`M ${xs[0] + bw + 20} ${gy - pay} H ${xs[1] - 20} M ${xs[1] - 40} ${gy - prices} V ${gy - pay}`} stroke="#999" strokeWidth={5} strokeDasharray="14 10" fill="none" />}
      {txt("PAY", xs[0] + bw / 2, gy + 80, 60, "#bbb")}
      {txt("PRICES", xs[1] + bw / 2, gy + 80, 60)}
    </Frame>
  );
}

// Coins flow through a pipe; a big valve wheel turns and the flow slows to a trickle.
export function Valve({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const py = s.cy + 160;
  const turn = k01(f, dur * 0.2, dur * 0.7);
  const flow = 1 - turn * 0.85;
  const vx = s.cx;
  // Coins travel at a speed that falls with the flow: position is the running sum of the speed.
  const dist = f * 9 - turn * turn * (dur * 0.5) * 9 * 0.85;
  const n = Math.max(2, Math.round(8 * flow));
  return (
    <Frame p={p} t={t}>
      <rect x={s.left - 60} y={py - 80} width={s.width + 120} height={160} fill="#141414" stroke="#ddd" strokeWidth={8} />
      <rect x={s.left + 80} y={py - 60} width={s.width - 160} height={120} fill="#000" stroke="#555" strokeWidth={4} />
      {Array.from({ length: n }, (_, i) => {
        const x = s.left + 80 + ((dist + (i * (s.width - 160)) / n) % (s.width - 160));
        return <circle key={i} cx={x} cy={py} r={42} fill="#9a9a9a" stroke="#eee" strokeWidth={5} />;
      })}
      <rect x={vx - 70} y={py - 260} width={140} height={180} fill="#2a2a2a" stroke="#ddd" strokeWidth={6} />
      <line x1={vx} y1={py - 260} x2={vx} y2={py - 340} stroke="#ccc" strokeWidth={14} />
      <g transform={`rotate(${turn * 540} ${vx} ${py - 380})`} filter="url(#glow)">
        <circle cx={vx} cy={py - 380} r={150} fill="none" stroke="#fff" strokeWidth={18} />
        {[0, 60, 120].map((a) => <line key={a} x1={vx - Math.cos((a * Math.PI) / 180) * 150} y1={py - 380 - Math.sin((a * Math.PI) / 180) * 150} x2={vx + Math.cos((a * Math.PI) / 180) * 150} y2={py - 380 + Math.sin((a * Math.PI) / 180) * 150} stroke="#fff" strokeWidth={12} />)}
        <circle cx={vx} cy={py - 380} r={28} fill="#fff" />
      </g>
    </Frame>
  );
}

// A heavy price weight lands on a household's budget: the stack of bills sinks and a crack runs through it.
export function Squeeze({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const drop = k01(f, dur * 0.15, dur * 0.35, { ...clamp, easing: Easing.in(Easing.quad) });
  const sink = k01(f, dur * 0.35, dur * 0.8);
  const wy = s.top + 60 + drop * (gy - 420 - s.top - 60) + sink * 120;
  const stackH = 300 - sink * 120;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={s.cx - 260 + (i % 2) * 10} y={gy - (i + 1) * (stackH / 8)} width={520} height={stackH / 8 - 4} rx={6} fill="#9a9a9a" stroke="#eee" strokeWidth={4} />
      ))}
      <g filter="url(#glow)">
        <path d={`M ${s.cx - 200} ${wy + 220} L ${s.cx - 150} ${wy} H ${s.cx + 150} L ${s.cx + 200} ${wy + 220} Z`} fill="#3a3a3a" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
        <path d={`M ${s.cx - 50} ${wy} q 0 -70 50 -70 q 50 0 50 70`} fill="none" stroke="#fff" strokeWidth={14} />
        {txt("PRICES", s.cx, wy + 150, 70)}
      </g>
      {sink > 0 && <path d={`M ${s.cx + 30} ${gy - stackH} l -20 ${stackH * 0.3} l 30 ${stackH * 0.25} l -25 ${stackH * 0.3}`} fill="none" stroke="#000" strokeWidth={6} opacity={sink} />}
    </Frame>
  );
}

// Prices rise like a flood around the steps the figure has climbed: each raise is a step, the water rises faster.
export function Flood({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const rise = k01(f, dur * 0.1, dur * 0.9);
  const water = gy - rise * 520;
  const n = 4;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, i) => <rect key={i} x={s.left + 80 + i * 210} y={gy - (i + 1) * 150} width={210} height={(i + 1) * 150} fill="#1a1a1a" stroke="#ccc" strokeWidth={6} />)}
      <Figure x={s.left + 80 + 3 * 210 + 105} ground={gy - 600} s={0.6} front pose={mix(STAND, VICTORY, 0.25)} headDown={20} />
      <rect x={s.left - 60} y={water} width={s.width + 120} height={gy - water + 60} fill="#fff" opacity={0.18} />
      <path d={`M ${s.left - 60} ${water} q 60 -16 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0`} fill="none" stroke="#fff" strokeWidth={6} filter="url(#glow)" transform={`translate(${-(f * 3) % 240} 0)`} />
      {txt("PRICES", s.cx - 60, Math.min(gy - 40, water + 110), 64, "#ddd")}
    </Frame>
  );
}

// A plain sandwich in a bun (no brand), centred on (x, y).
const sandwich = (x: number, y: number, sc = 1, key?: string | number) => (
  <g key={key} transform={`translate(${x} ${y}) scale(${sc})`}>
    <path d="M -150 -10 Q -150 -110 0 -115 Q 150 -110 150 -10 Z" fill="#555" stroke="#eee" strokeWidth={6} />
    <rect x={-160} y={-10} width={320} height={44} rx={14} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />
    {[-90, -30, 30, 90].map((d) => <line key={d} x1={d - 12} y1={-2} x2={d + 12} y2={26} stroke="#777" strokeWidth={5} />)}
    <path d="M -150 34 H 150 Q 150 80 0 82 Q -150 80 -150 34 Z" fill="#555" stroke="#eee" strokeWidth={6} />
  </g>
);

// Two shoppers look at the same product; one tag stays put, the other jumps for the same thing.
export function TwoPrices({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.35, dur * 0.5, pop);
  const [lx, rx] = [s.left + 170, s.right - 170];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx - 110} y={gy - 140} width={220} height={140} fill="#1a1a1a" stroke="#bbb" strokeWidth={5} />
      {box(s.cx - 90, gy - 140, 180, 220)}
      <Figure x={lx} ground={gy} s={0.72} pose={STAND} color="#888" glow={false} headDown={8} />
      <Figure x={rx} ground={gy} s={0.72} flip pose={STAND} headDown={8} />
      {[lx, rx].map((x) => <path key={x} d={`M ${x} ${s.top + 330} Q ${(x + s.cx) / 2} ${s.top + 420} ${s.cx} ${gy - 380}`} fill="none" stroke="#555" strokeWidth={4} strokeDasharray="12 10" />)}
      {tag(lx, s.top + 130, "$12", 1.1)}
      <g transform={`translate(${rx} ${s.top + 130}) scale(${1 + k * 0.15}) translate(${-rx} ${-(s.top + 130)})`}>{tag(rx, s.top + 130, k > 0.5 ? "$18" : "$12", 1.1, k > 0.5)}</g>
    </Frame>
  );
}

// Dots of data stream off a phone into a profile card, filling it row by row; a price appears at the bottom.
export function Profile({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const ph: Pt = [s.left + 150, s.cy - 100];
  const card = { x: s.cx - 10, y: s.cy - 330, w: s.right - s.cx - 30, h: 660 };
  const rows = 4;
  const filled = k01(f, dur * 0.1, dur * 0.7) * rows;
  const price = k01(f, dur * 0.72, dur * 0.8, pop);
  return (
    <Frame p={p} t={t}>
      <rect x={ph[0] - 100} y={ph[1] - 190} width={200} height={380} rx={30} fill="#0d0d0d" stroke="#fff" strokeWidth={7} />
      <rect x={ph[0] - 75} y={ph[1] - 150} width={150} height={280} rx={10} fill="#262626" />
      {Array.from({ length: 8 }, (_, i) => {
        const u = cyc(f, 30, i * 4);
        const x = ph[0] + 100 + u * (card.x - ph[0] - 100);
        return <circle key={i} cx={x} cy={ph[1] - 60 + Math.sin(u * Math.PI) * -120 + (i % 3) * 40} r={9} fill="#fff" opacity={(1 - u) * 0.9 * (filled < rows ? 1 : 0.3)} />;
      })}
      <g filter="url(#glow)">
        <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={22} fill="#141414" stroke="#fff" strokeWidth={7} />
        <circle cx={card.x + 90} cy={card.y + 100} r={50} fill="#3a3a3a" stroke="#ddd" strokeWidth={5} />
      </g>
      <rect x={card.x + 170} y={card.y + 70} width={card.w - 210} height={22} rx={11} fill="#777" />
      <rect x={card.x + 170} y={card.y + 108} width={(card.w - 210) * 0.6} height={18} rx={9} fill="#555" />
      {Array.from({ length: rows }, (_, i) => {
        const u = Math.min(1, Math.max(0, filled - i));
        const y = card.y + 200 + i * 80;
        return (
          <g key={i}>
            <circle cx={card.x + 60} cy={y + 15} r={18} fill={u > 0 ? "#ddd" : "#333"} />
            <rect x={card.x + 100} y={y} width={(card.w - 140) * u} height={30} rx={8} fill="#999" />
          </g>
        );
      })}
      <g opacity={price} transform={`translate(${card.x + card.w / 2} ${card.y + card.h - 70}) scale(${0.6 + price * 0.4})`}>{txt("$$$", 0, 0, 90)}</g>
    </Frame>
  );
}

// A security camera swivels to follow the figure along the aisle; when they stop, the shelf price ticks up.
export function Watching({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const sc = 0.7;
  const stopAt = dur * 0.55;
  const ph = Math.min(f, stopAt) * 0.1;
  const x = s.left + 80 + ph * walkRate(0.7) * sc;
  const cam: Pt = [s.left + 120, s.top + 120];
  const aim = Math.atan2(gy - 250 - cam[1], x - cam[0]) * 180 / Math.PI;
  const bump = k01(f, stopAt + 10, stopAt + 20, pop);
  const shelf = s.right - 170;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={shelf - 120} y={gy - 560} width={240} height={560} fill="#141414" stroke="#ccc" strokeWidth={6} />
      {[0, 1, 2].map((r) => <line key={r} x1={shelf - 120} y1={gy - 400 + r * 160} x2={shelf + 120} y2={gy - 400 + r * 160} stroke="#777" strokeWidth={5} />)}
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={shelf - 100 + c * 70} y={gy - 470 + r * 160} width={50} height={70} rx={4} fill="#3a3a3a" stroke="#999" strokeWidth={3} />))}
      {tag(shelf, gy - 760, bump > 0.5 ? "$7" : "$5", 0.9, bump > 0.5)}
      <polygon points={`${cam[0]},${cam[1]} ${x - 120},${gy} ${x + 120},${gy}`} fill="#fff" opacity={0.08} />
      <line x1={s.left - 40} y1={cam[1] - 40} x2={cam[0]} y2={cam[1] - 40} stroke="#999" strokeWidth={10} />
      <line x1={cam[0]} y1={cam[1] - 40} x2={cam[0]} y2={cam[1]} stroke="#999" strokeWidth={10} />
      <g transform={`rotate(${aim} ${cam[0]} ${cam[1]})`} filter="url(#glow)">
        <rect x={cam[0] - 20} y={cam[1] - 40} width={170} height={80} rx={14} fill="#e6e6e6" stroke="#fff" strokeWidth={5} />
        <circle cx={cam[0] + 150} cy={cam[1]} r={26} fill="#111" stroke="#fff" strokeWidth={5} />
      </g>
      <Figure x={x} ground={gy} s={sc} pose={f < stopAt ? walk(ph, 0.7) : STAND} headDown={f < stopAt ? 0 : -10} />
    </Frame>
  );
}

// An electronic shelf label: the price on its screen flickers and changes again and again.
export function ShelfLabel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const prices = ["$3.49", "$3.79", "$4.29", "$3.99", "$4.59"];
  const n = prices.length;
  const k = Math.min(n - 1, Math.floor(k01(f, dur * 0.05, dur * 0.85) * n));
  const since = f - (dur * 0.05 + (k / n) * dur * 0.8);
  const flick = k > 0 && since >= 0 && since < 6 && Math.floor(since) % 2 === 0;
  const ly = s.cy + 120;
  return (
    <Frame p={p} t={t}>
      <rect x={s.left - 40} y={ly - 60} width={s.width + 80} height={50} fill="#262626" stroke="#bbb" strokeWidth={5} />
      {[-300, -100, 100, 300].map((d) => (
        <g key={d}>
          <rect x={s.cx + d - 80} y={ly - 420} width={160} height={360} rx={18} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />
          <rect x={s.cx + d - 80} y={ly - 330} width={160} height={110} fill="#3a3a3a" />
        </g>
      ))}
      <g filter="url(#glow)">
        <rect x={s.cx - 260} y={ly} width={520} height={260} rx={16} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        <rect x={s.cx - 230} y={ly + 30} width={460} height={200} rx={8} fill={flick ? "#777" : "#f2f2f2"} />
      </g>
      {!flick && txt(prices[k], s.cx, ly + 175, 140, "#111")}
      <circle cx={s.cx + 215} cy={ly + 45} r={8} fill="#111" opacity={cyc(f, 20) > 0.5 ? 1 : 0.2} />
    </Frame>
  );
}

// A menu board: one item disappears (GONE), the slot sits empty, then it slides back in under a starburst.
export function MenuBoard({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x0 = s.left + 30;
  const y0 = s.top + 60;
  const w = s.width - 60;
  const gone = k01(f, dur * 0.2, dur * 0.3);
  const back = k01(f, dur * 0.6, dur * 0.7, pop);
  const show = gone < 1 ? 1 - gone : back;
  const slot: Pt = [s.cx, y0 + 330];
  return (
    <Frame p={p} t={t}>
      <rect x={x0} y={y0} width={w} height={880} rx={20} fill="#141414" stroke="#fff" strokeWidth={8} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x0 + 60} y={y0 + 590 + i * 90} width={420} height={28} rx={10} fill="#555" />
          <rect x={x0 + w - 220} y={y0 + 590 + i * 90} width={160} height={28} rx={10} fill="#777" />
        </g>
      ))}
      <rect x={x0 + 40} y={y0 + 40} width={w - 80} height={500} rx={16} fill="#0d0d0d" stroke="#777" strokeWidth={5} strokeDasharray={show < 0.05 ? "20 14" : undefined} />
      {back > 0 && (
        <polygon points={Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 150 : 230; const a = (i / 24) * Math.PI * 2 + f * 0.01; return `${slot[0] + Math.cos(a) * r * back * 1.4},${slot[1] + Math.sin(a) * r * back}`; }).join(" ")} fill="#fff" opacity={0.15} />
      )}
      <g opacity={show} filter={back > 0.5 ? "url(#glow)" : undefined}>{sandwich(slot[0], slot[1] + (1 - show) * 60, 1.1)}</g>
      {gone >= 1 && back === 0 && txt("GONE", slot[0], slot[1] + 40, 120, "#777")}
      {back > 0.5 && txt("BACK", slot[0], y0 + 500, 80)}
    </Frame>
  );
}

// A drive-thru window glows; cars keep rolling up and the line stretches back.
export function DriveThru({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 5;
  const car = (x: number, key: number, lit: boolean) => (
    <g key={key}>
      <path d={`M ${x - 110} ${gy - 40} V ${gy - 100} l 40 -10 l 30 -55 h 100 l 40 55 l 40 10 V ${gy - 40} Z`} fill={lit ? "#3a3a3a" : "#262626"} stroke={lit ? "#fff" : "#999"} strokeWidth={6} strokeLinejoin="round" />
      {[x - 60, x + 70].map((wx) => <circle key={wx} cx={wx} cy={gy - 36} r={28} fill="#111" stroke="#bbb" strokeWidth={5} />)}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left - 60} y={gy - 640} width={260} height={640} fill="#1a1a1a" stroke="#ddd" strokeWidth={7} />
      <path d={`M ${s.left - 80} ${gy - 640} h 300 l -30 -60 h -240 Z`} fill="#262626" stroke="#ddd" strokeWidth={6} strokeLinejoin="round" />
      <rect x={s.left + 90} y={gy - 360} width={110} height={150} fill="#fff" filter="url(#glow)" />
      <rect x={s.left + 300} y={gy - 560} width={20} height={300} fill="#777" />
      <rect x={s.left + 250} y={gy - 640} width={120} height={110} rx={8} fill="#262626" stroke="#bbb" strokeWidth={5} />
      {Array.from({ length: n }, (_, i) => {
        const slot = s.left + 330 + i * 270;
        const at = i < 2 ? -1 : tickAt(i - 2, n - 2, dur);
        const u = at < 0 ? 1 : k01(f, at - 30, at, settle);
        if (u <= 0) return null;
        return car(slot + (1 - u) * 500, i, i === 0);
      })}
    </Frame>
  );
}

// A sandwich on a pedestal under a countdown ring that drains away: LIMITED time, days left ticking down.
export function Limited({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 40];
  const k = k01(f, dur * 0.05, dur * 0.9);
  const r = 380;
  const a = (1 - k) * 359.9;
  const end: Pt = [c[0] + Math.sin((a * Math.PI) / 180) * r, c[1] - Math.cos((a * Math.PI) / 180) * r];
  const days = Math.max(1, Math.ceil((1 - k) * 30));
  return (
    <Frame p={p} t={t}>
      <circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke="#333" strokeWidth={28} />
      {a > 0.5 && <path d={`M ${c[0]} ${c[1] - r} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${end[0]} ${end[1]}`} fill="none" stroke="#fff" strokeWidth={28} strokeLinecap="round" filter="url(#glow)" />}
      {sandwich(c[0], c[1] - 40, 1.2)}
      {txt(`${days} ${days === 1 ? "DAY" : "DAYS"} LEFT`, c[0], c[1] + 200, 70)}
      {txt("LIMITED", c[0], s.bottom - 30, 80, "#999")}
    </Frame>
  );
}

// A pig stands on a scale; the price per pound underneath slides down.
export function Hog({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 220;
  const k = k01(f, dur * 0.15, dur * 0.85);
  const c: Pt = [s.cx, gy - 230];
  const bob = Math.sin(f / 10) * 3;
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 360} y={gy} width={720} height={40} rx={10} fill="#262626" stroke="#ddd" strokeWidth={6} />
      <g transform={`translate(0 ${bob})`}>
        {[-150, -60, 70, 160].map((d) => <rect key={d} x={c[0] + d - 22} y={c[1] + 110} width={44} height={gy - c[1] - 110} rx={10} fill="#555" stroke="#ddd" strokeWidth={5} />)}
        <ellipse cx={c[0]} cy={c[1]} rx={270} ry={170} fill="#555" stroke="#eee" strokeWidth={7} filter="url(#glow)" />
        <ellipse cx={c[0] + 300} cy={c[1] + 10} rx={60} ry={50} fill="#777" stroke="#eee" strokeWidth={6} />
        {[-14, 14].map((d) => <circle key={d} cx={c[0] + 330} cy={c[1] + 10 + d} r={8} fill="#111" />)}
        <path d={`M ${c[0] + 200} ${c[1] - 120} l 40 -80 l 30 90`} fill="#555" stroke="#eee" strokeWidth={6} strokeLinejoin="round" />
        <circle cx={c[0] + 230} cy={c[1] - 40} r={10} fill="#111" />
        <path d={`M ${c[0] - 270} ${c[1] - 20} q -50 -30 -30 -60 q 20 -20 30 10`} fill="none" stroke="#eee" strokeWidth={7} strokeLinecap="round" />
      </g>
      <rect x={s.cx - 220} y={gy + 70} width={440} height={130} rx={12} fill="#000" stroke="#bbb" strokeWidth={5} />
      {txt(`$${(1.1 - k * 0.32).toFixed(2)}/LB`, s.cx, gy + 165, 84)}
    </Frame>
  );
}

// Ten people in a row; the last one rises onto a pedestal and lights up: the top 10%.
export function TopTen({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const lift = k01(f, dur * 0.35, dur * 0.65, settle);
  const gap = (s.width - 60) / 10;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = s.left + 30 + gap * (i + 0.5);
        const top = i === 9;
        const appear = k01(f, i * 3, i * 3 + 10);
        return (
          <g key={i} opacity={appear}>
            {top && <rect x={x - gap / 2 + 4} y={gy - lift * 260} width={gap - 8} height={lift * 260} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />}
            <Figure x={x} ground={gy - (top ? lift * 260 : 0)} s={0.42} front pose={top ? mix(STAND, VICTORY, lift) : STAND} color={top ? "#ececec" : "#777"} glow={top} />
          </g>
        );
      })}
      <g opacity={lift}>{txt("TOP 10%", s.right - gap / 2 - 60, gy - 260 * lift - 280, 64)}</g>
    </Frame>
  );
}

// Income by age: a curve climbs from 25 to its peak around 50; a dot rides along it.
export function AgeCurve({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x0 = s.left + 60;
  const x1 = s.right - 40;
  const y0 = s.bottom - 160;
  const yTop = s.top + 160;
  const k = k01(f, dur * 0.05, dur * 0.85);
  const curve = (u: number): Pt => [x0 + u * (x1 - x0), y0 - (Math.sin(Math.min(1, u * 1.25) * Math.PI / 2) ** 1.4 - Math.max(0, u - 0.8) * 0.6) * (y0 - yTop) * 0.92];
  const pts = Array.from({ length: 41 }, (_, i) => curve((i / 40) * k));
  const dot = curve(k);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${x0} ${yTop - 40} V ${y0} H ${x1 + 20}`} fill="none" stroke="#bbb" strokeWidth={6} strokeLinecap="round" />
      {[25, 35, 45, 55, 65].map((a, i) => {
        const x = x0 + ((i + 0.5) / 5) * (x1 - x0);
        return <g key={a}><line x1={x} y1={y0} x2={x} y2={y0 + 20} stroke="#bbb" strokeWidth={5} />{txt(String(a), x, y0 + 80, 52, "#999")}</g>;
      })}
      <line x1={x0} y1={yTop + 80} x2={x1} y2={yTop + 80} stroke="#555" strokeWidth={4} strokeDasharray="16 12" />
      <path d={pts.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={dot[0]} cy={dot[1]} r={22} fill="#fff" filter="url(#glow)" />
      {txt("AGE", s.cx, y0 + 140, 48, "#777")}
    </Frame>
  );
}

// An income histogram rises bar by bar; then the far-right tail lights up, cut off by a dashed line: the top 10%.
export function Distribution({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const heights = [380, 560, 620, 540, 430, 330, 250, 190, 140, 100, 70, 50];
  const n = heights.length;
  const bw = (s.width - 60) / n;
  const light = k01(f, dur * 0.6, dur * 0.75);
  const cut = s.left + 30 + bw * (n - 3);
  return (
    <Frame p={p} t={t}>
      <line x1={s.left + 20} y1={gy} x2={s.right - 20} y2={gy} stroke="#ccc" strokeWidth={6} />
      {heights.map((h, i) => {
        const u = k01(f, i * 3, i * 3 + 18, settle);
        const top = i >= n - 3;
        return <rect key={i} x={s.left + 30 + i * bw + 4} y={gy - h * u} width={bw - 8} height={h * u} fill={top && light > 0.5 ? "#e6e6e6" : "#3a3a3a"} stroke={top && light > 0.5 ? "#fff" : "#999"} strokeWidth={4} filter={top && light > 0.5 ? "url(#glow)" : undefined} />;
      })}
      <line x1={cut} y1={gy + 30} x2={cut} y2={gy - 700 * light} stroke="#fff" strokeWidth={5} strokeDasharray="16 12" />
      <g opacity={light}>{txt("TOP 10%", cut + bw * 1.5, gy - 300, 56)}</g>
    </Frame>
  );
}

// Then and now: the same item side by side; the old price sits still, the new one counts up.
export function ThenNow({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const half = (s.width - 60) / 2;
  const k = k01(f, dur * 0.25, dur * 0.8, climb);
  const panel = (x: number, now: boolean) => (
    <g key={x} filter={now ? "url(#glow)" : undefined}>
      <rect x={x} y={s.top + 120} width={half} height={s.height - 200} rx={18} fill="#141414" stroke={now ? "#fff" : "#777"} strokeWidth={now ? 8 : 5} />
      {box(x + half / 2 - 100, s.cy + 120, 200, 260, undefined, false)}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {panel(s.left + 20, false)}
      {panel(s.left + 40 + half, true)}
      {txt("THEN", s.left + 20 + half / 2, s.top + 220, 64, "#777")}
      {txt("NOW", s.left + 40 + half * 1.5, s.top + 220, 64)}
      {txt("$2.49", s.left + 20 + half / 2, s.cy + 280, 96, "#999")}
      {txt(`$${(2.49 + k * 1.8).toFixed(2)}`, s.left + 40 + half * 1.5, s.cy + 280, 96)}
    </Frame>
  );
}

// Two receipts for the same basket: the old one short, the new one keeps printing, its total climbing.
export function Receipts({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const top = s.top + 80;
  const w = 340;
  const k = k01(f, dur * 0.1, dur * 0.85);
  const longH = 420 + k * 460;
  const paper = (x: number, h: number, total: string, lit: boolean) => (
    <g key={x} filter={lit ? "url(#glow)" : undefined}>
      <path d={`M ${x} ${top} H ${x + w} V ${top + h} ${Array.from({ length: 8 }, (_, i) => `l ${-w / 16} 18 l ${-w / 16} -18`).join(" ")} Z`} fill={lit ? "#eee" : "#bbb"} stroke="#fff" strokeWidth={4} />
      {Array.from({ length: Math.floor((h - 160) / 50) }, (_, i) => (
        <g key={i}>
          <rect x={x + 30} y={top + 40 + i * 50} width={150 - (i % 3) * 30} height={16} rx={8} fill="#777" />
          <rect x={x + w - 110} y={top + 40 + i * 50} width={80} height={16} rx={8} fill="#777" />
        </g>
      ))}
      {txt(total, x + w / 2, top + h - 40, 72, "#111")}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {paper(s.left + 50, 420, "$48", false)}
      {paper(s.right - 50 - w, longH, `$${Math.round(48 + k * 31)}`, true)}
    </Frame>
  );
}

// A price tag gets a new sticker slapped over the old one, again and again, each a little higher.
export function Sticker({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const prices = ["$2.99", "$3.49", "$3.99", "$4.79"];
  const n = prices.length;
  const c: Pt = [s.cx, s.cy + 40];
  return (
    <Frame p={p} t={t}>
      <path d={`M ${c[0]} ${c[1] - 420} l 300 220 v 560 h -600 v -560 Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
      <circle cx={c[0]} cy={c[1] - 280} r={36} fill="#000" />
      {prices.map((pr, i) => {
        const at = i === 0 ? 0 : tickAt(i - 1, n - 1, dur);
        const u = i === 0 ? 1 : k01(f, at - 6, at, pop);
        if (u <= 0) return null;
        const rot = ((i * 37) % 14) - 7;
        const newest = i === n - 1 ? u >= 1 : f < (i + 1 < n ? tickAt(i, n - 1, dur) - 6 : Infinity);
        return (
          <g key={i} transform={`translate(${c[0]} ${c[1] + 80 - i * 14}) rotate(${rot}) scale(${1.4 - u * 0.4})`} opacity={Math.min(1, u * 2)} filter={newest ? "url(#glow)" : undefined}>
            <rect x={-230} y={-110} width={460} height={220} rx={20} fill={i % 2 ? "#ddd" : "#f2f2f2"} stroke="#111" strokeWidth={6} />
            {txt(pr, 0, 50, 140, "#111")}
          </g>
        );
      })}
    </Frame>
  );
}

// A wall thermostat holds the same temperature while the dollars under it keep climbing.
export function Thermostat({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 60];
  const k = k01(f, dur * 0.05, dur * 0.9);
  const r = 300;
  const a = k * 270;
  const start = -135;
  const pt = (deg: number): Pt => [c[0] + Math.sin((deg * Math.PI) / 180) * r, c[1] - Math.cos((deg * Math.PI) / 180) * r];
  const [p0, p1] = [pt(start), pt(start + a)];
  return (
    <Frame p={p} t={t}>
      <rect x={c[0] - 400} y={c[1] - 400} width={800} height={800} rx={60} fill="#141414" stroke="#999" strokeWidth={6} />
      <circle cx={c[0]} cy={c[1]} r={r + 40} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <path d={`M ${pt(start).join(" ")} A ${r} ${r} 0 1 1 ${pt(135).join(" ")}`} fill="none" stroke="#333" strokeWidth={26} strokeLinecap="round" />
      {a > 1 && <path d={`M ${p0.join(" ")} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${p1.join(" ")}`} fill="none" stroke="#fff" strokeWidth={26} strokeLinecap="round" filter="url(#glow)" />}
      {txt("72°", c[0], c[1] + 40, 200)}
      {txt(usd(Math.round(110 + k * 70)), c[0], c[1] + 170, 80, "#bbb")}
      {Array.from({ length: 3 }, (_, i) => <path key={i} d={`M ${c[0] - 60 + i * 60} ${s.bottom - 30} q 20 -30 0 -60 q -20 -30 0 -60`} fill="none" stroke="#777" strokeWidth={5} opacity={cyc(f, 30, i * 10)} />)}
    </Frame>
  );
}

// A house with a padlock marked 3% on its door; across the street a rate sign climbs to 7%. Nobody moves.
export function LockedIn({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const snap = k01(f, dur * 0.2, dur * 0.3, pop);
  const rate = 3 + 4 * k01(f, dur * 0.35, dur * 0.85);
  const hx = s.left + 40;
  const hw = 520;
  const lock: Pt = [hx + hw * 0.7, gy - 220];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {house(hx, gy, hw)}
      <g transform={`translate(${lock[0]} ${lock[1]})`} filter="url(#glow)">
        <path d={`M -55 0 V ${-60 - (1 - snap) * 40} a 55 55 0 0 1 110 0 V 0`} fill="none" stroke="#fff" strokeWidth={18} />
        <rect x={-90} y={-10} width={180} height={170} rx={18} fill="#e6e6e6" stroke="#fff" strokeWidth={5} />
        {txt("3%", 0, 110, 80, "#111")}
      </g>
      <rect x={s.right - 140} y={gy - 520} width={16} height={520} fill="#777" />
      <rect x={s.right - 250} y={gy - 640} width={236} height={140} rx={10} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
      {txt(`${rate.toFixed(1)}%`, s.right - 132, gy - 540, 84)}
    </Frame>
  );
}

// A TARIFF tag hops from the container to the store, then from the store onto the shopper.
export function HandOff({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const xs = [s.left + 160, s.cx, s.right - 140];
  const k = k01(f, dur * 0.1, dur * 0.85) * 2;
  const seg = Math.min(1, Math.floor(k));
  const u = k - seg;
  const hopY = gy - 560 - Math.sin(Math.min(1, u) * Math.PI) * 180;
  const tx = xs[seg] + (xs[seg + 1] - xs[seg]) * Math.min(1, u);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={xs[0] - 140} y={gy - 200} width={280} height={200} fill="#2a2a2a" stroke="#eee" strokeWidth={6} />
      {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={xs[0] - 140 + i * 47} y1={gy - 190} x2={xs[0] - 140 + i * 47} y2={gy - 10} stroke="#777" strokeWidth={4} />)}
      <path d={`M ${xs[1] - 130} ${gy} V ${gy - 260} H ${xs[1] + 130} V ${gy} Z M ${xs[1] - 150} ${gy - 260} l 30 -60 H ${xs[1] + 120} l 30 60 M ${xs[1] - 35} ${gy} V ${gy - 120} H ${xs[1] + 35} V ${gy}`} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} strokeLinejoin="round" />
      <Figure x={xs[2]} ground={gy} s={0.75} flip pose={k >= 2 ? { ...STAND, t: 8 } : STAND} headDown={k >= 2 ? 20 : -5} />
      <g filter="url(#glow)">{tag(tx, hopY + (k >= 2 ? 120 : 0), "TARIFF", 0.85)}</g>
    </Frame>
  );
}

// A phone feed of product cards scrolls up; one stops in the middle under a glowing FOR YOU banner.
export function ForYou({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pw = 540;
  const x0 = s.cx - pw / 2;
  const y0 = s.top + 20;
  const ph = s.height - 40;
  const stop = k01(f, 0, dur * 0.5, settle);
  const scroll = stop * 1400;
  const pick = k01(f, dur * 0.5, dur * 0.6, pop);
  return (
    <Frame p={p} t={t}>
      <defs><clipPath id="feed"><rect x={x0 + 20} y={y0 + 70} width={pw - 40} height={ph - 110} rx={20} /></clipPath></defs>
      <rect x={x0} y={y0} width={pw} height={ph} rx={60} fill="#0d0d0d" stroke="#fff" strokeWidth={9} />
      <g clipPath="url(#feed)">
        {Array.from({ length: 9 }, (_, i) => {
          const y = y0 + 1500 + i * 300 - scroll - 1180;
          const chosen = i === 4;
          return (
            <g key={i} filter={chosen && pick > 0.5 ? "url(#glow)" : undefined}>
              <rect x={x0 + 50} y={y} width={pw - 100} height={260} rx={18} fill={chosen && pick > 0.5 ? "#2a2a2a" : "#1a1a1a"} stroke={chosen && pick > 0.5 ? "#fff" : "#555"} strokeWidth={chosen ? 6 : 4} />
              <rect x={x0 + 80} y={y + 30} width={170} height={200} rx={10} fill="#3a3a3a" />
              <rect x={x0 + 280} y={y + 60} width={150} height={20} rx={10} fill="#777" />
              <rect x={x0 + 280} y={y + 100} width={100} height={20} rx={10} fill="#555" />
            </g>
          );
        })}
      </g>
      <g opacity={pick} transform={`translate(${s.cx} ${y0 + 110})`}>
        <rect x={-170} y={-40} width={340} height={80} rx={40} fill="#fff" filter="url(#glow)" />
        {txt("FOR YOU", 0, 24, 56, "#111")}
      </g>
    </Frame>
  );
}

// A company memo slides in; an AI stamp thumps onto it and the names on it are struck out one by one.
export function Memo({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const slide = k01(f, 0, dur * 0.2, settle);
  const stamp = k01(f, dur * 0.28, dur * 0.34, { ...clamp, easing: Easing.in(Easing.cubic) });
  const x0 = s.cx - 330;
  const y0 = s.top + 40 + (1 - slide) * 300;
  const n = 6;
  return (
    <Frame p={p} t={t}>
      <g opacity={slide}>
        <rect x={x0} y={y0} width={660} height={900} rx={10} fill="#e6e6e6" stroke="#fff" strokeWidth={6} />
        <rect x={x0 + 50} y={y0 + 50} width={300} height={34} rx={8} fill="#111" />
        <rect x={x0 + 50} y={y0 + 110} width={420} height={18} rx={9} fill="#777" />
        <rect x={x0 + 50} y={y0 + 145} width={360} height={18} rx={9} fill="#777" />
        {Array.from({ length: n }, (_, i) => {
          const y = y0 + 260 + i * 90;
          const at = dur * 0.45 + (i / n) * dur * 0.4;
          const strike = k01(f, at, at + 8);
          return (
            <g key={i}>
              <circle cx={x0 + 80} cy={y + 12} r={18} fill="#555" />
              <rect x={x0 + 120} y={y} width={300 - (i % 3) * 40} height={24} rx={12} fill="#555" />
              <line x1={x0 + 50} y1={y + 12} x2={x0 + 50 + strike * 420} y2={y + 12} stroke="#111" strokeWidth={8} strokeLinecap="round" />
            </g>
          );
        })}
      </g>
      {stamp > 0 && (
        <g transform={`translate(${x0 + 470} ${y0 + 190}) rotate(-12) scale(${2.4 - stamp * 1.0})`} opacity={stamp} filter="url(#glow)">
          <rect x={-120} y={-80} width={240} height={160} rx={14} fill="#111" stroke="#fff" strokeWidth={8} />
          {txt("AI", 0, 50, 130)}
        </g>
      )}
    </Frame>
  );
}

// A tractor ploughs across the field, puffing diesel; the price per gallon over it keeps rising.
export function Tractor({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const k = k01(f, dur * 0.1, dur * 0.85, climb);
  const x = s.cx - 60;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={50} offset={-f * 8} />
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={s.left - 60} y1={gy + 30 + i * 22} x2={s.right + 60} y2={gy + 30 + i * 22} stroke="#333" strokeWidth={5} strokeDasharray="30 18" strokeDashoffset={f * 8} />)}
      <g transform={`translate(0 ${Math.sin(f / 4) * 2})`}>
        <path d={`M ${x - 200} ${gy - 120} V ${gy - 240} H ${x + 40} V ${gy - 400} H ${x + 220} V ${gy - 240} H ${x + 300} V ${gy - 120} Z`} fill="#2a2a2a" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
        <rect x={x + 70} y={gy - 370} width={120} height={110} fill="#111" stroke="#bbb" strokeWidth={5} />
        <rect x={x - 120} y={gy - 330} width={22} height={90} fill="#777" />
        {[0, 1, 2].map((i) => {
          const u = cyc(f, 20, i * 7);
          return <circle key={i} cx={x - 109 - u * 80} cy={gy - 340 - u * 120} r={16 + u * 28} fill="#777" opacity={0.5 * (1 - u)} />;
        })}
      </g>
      <g transform={`rotate(${f * 6} ${x + 160} ${gy - 120})`}>
        <circle cx={x + 160} cy={gy - 120} r={120} fill="#111" stroke="#ddd" strokeWidth={8} />
        {[0, 60, 120].map((a) => <line key={a} x1={x + 160 - Math.cos((a * Math.PI) / 180) * 110} y1={gy - 120 - Math.sin((a * Math.PI) / 180) * 110} x2={x + 160 + Math.cos((a * Math.PI) / 180) * 110} y2={gy - 120 + Math.sin((a * Math.PI) / 180) * 110} stroke="#555" strokeWidth={8} />)}
      </g>
      <g transform={`rotate(${f * 10} ${x - 120} ${gy - 70})`}>
        <circle cx={x - 120} cy={gy - 70} r={70} fill="#111" stroke="#ddd" strokeWidth={7} />
        <line x1={x - 180} y1={gy - 70} x2={x - 60} y2={gy - 70} stroke="#555" strokeWidth={7} />
      </g>
      <g filter="url(#glow)">
        <path d={`M ${s.cx} ${s.top + 70} q -50 80 0 110 q 50 -30 0 -110 Z`} fill="#fff" />
      </g>
      {txt(`$${(3.6 + k * 1.8).toFixed(2)}`, s.cx, s.top + 290, 100)}
    </Frame>
  );
}

// The figure stands on a bathroom scale; the dial's number drops week by week.
export function BathScale({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.15, dur * 0.85);
  const w = 520;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.cx - w / 2} y={gy - 70} width={w} height={70} rx={24} fill="#2a2a2a" stroke="#ddd" strokeWidth={6} />
      <Figure x={s.cx} ground={gy - 70} s={0.95} front pose={STAND} headDown={25} />
      <g filter="url(#glow)">
        <rect x={s.cx - 180} y={s.top + 60} width={360} height={170} rx={20} fill="#000" stroke="#fff" strokeWidth={7} />
        {txt(String(Math.round(212 - k * 30)), s.cx, s.top + 190, 130)}
      </g>
      <path d={`M ${s.cx} ${s.top + 230} V ${gy - 600}`} stroke="#555" strokeWidth={4} strokeDasharray="12 10" />
    </Frame>
  );
}

// A sale tag: WAS $199 gets struck through and NOW $99 pops, the discount that hooks you.
export function WasNow({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const strike = k01(f, dur * 0.2, dur * 0.35);
  const now = k01(f, dur * 0.38, dur * 0.48, pop);
  const c: Pt = [s.cx, s.cy];
  const sw = Math.sin(f / 16) * 4;
  return (
    <Frame p={p} t={t}>
      <g transform={`rotate(${sw} ${c[0]} ${c[1] - 460})`}>
        <line x1={c[0]} y1={s.top - 40} x2={c[0]} y2={c[1] - 400} stroke="#bbb" strokeWidth={5} />
        <path d={`M ${c[0]} ${c[1] - 400} l 330 200 v 560 h -660 v -560 Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
        <circle cx={c[0]} cy={c[1] - 280} r={34} fill="#000" />
        {txt("WAS $199", c[0], c[1] - 60, 110, "#555")}
        <line x1={c[0] - 250} y1={c[1] - 95} x2={c[0] - 250 + strike * 500} y2={c[1] - 95} stroke="#111" strokeWidth={14} strokeLinecap="round" />
        <g transform={`translate(${c[0]} ${c[1] + 170}) scale(${now})`} filter="url(#glow)">
          <rect x={-260} y={-110} width={520} height={190} rx={18} fill="#111" />
          {txt("NOW $99", 0, 30, 130)}
        </g>
      </g>
    </Frame>
  );
}
