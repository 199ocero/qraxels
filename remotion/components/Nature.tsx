import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, run, walk, walkRate, RUN_RATE, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// Nature, sky and weather pictures. Every scene takes only an optional label.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const wave = (y: number, amp: number, len: number, off: number) =>
  `M ${-len * 2 - (off % (len * 2))} ${y} ${Array.from({ length: Math.ceil(W / len) + 4 }, (_, i) => `q ${len / 2} ${i % 2 ? amp : -amp} ${len} 0`).join(" ")}`;
const star = (x: number, y: number, r: number, key?: string | number, fill = "#fff") => (
  <path key={key} d={`M ${x} ${y - r} L ${x + r * 0.2} ${y - r * 0.2} L ${x + r} ${y} L ${x + r * 0.2} ${y + r * 0.2} L ${x} ${y + r} L ${x - r * 0.2} ${y + r * 0.2} L ${x - r} ${y} L ${x - r * 0.2} ${y - r * 0.2} Z`} fill={fill} />
);

// The sun rises over the horizon, rays spreading; a figure watches.
export function Sunrise({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const hz = s.bottom - 300;
  const k = k01(f, 0, dur * 0.85);
  const sy = hz + 200 - k * 520;
  return (
    <Frame p={p} t={t}>
      <defs>
        <clipPath id="sky"><rect x={0} y={0} width={W} height={hz} /></clipPath>
      </defs>
      <g clipPath="url(#sky)">
        {Array.from({ length: 14 }, (_, i) => {
          const [a, b] = [go([s.cx, sy], 90 + i * 13 + Math.sin(f / 30) * 3, 280), go([s.cx, sy], 90 + i * 13 + Math.sin(f / 30) * 3, 280 + 500 * k)];
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={10} opacity={0.4 * k} strokeLinecap="round" />;
        })}
        <circle cx={s.cx} cy={sy} r={240} fill="#fff" filter="url(#glow)" />
      </g>
      <line x1={0} y1={hz} x2={W} y2={hz} stroke="#fff" strokeWidth={5} />
      {[0, 1, 2, 3].map((i) => <line key={i} x1={s.cx - 300 + i * 40} y1={hz + 40 + i * 50} x2={s.cx + 300 - i * 40} y2={hz + 40 + i * 50} stroke="#fff" strokeWidth={8} opacity={0.4 * k * (1 - i / 4)} />)}
      <Figure x={s.cx - 260} ground={hz} s={0.6} back pose={mix(STAND, VICTORY, k01(f, dur * 0.6, dur * 0.85))} color="#cfcfcf" />
    </Frame>
  );
}

// The moon cycles through its phases: night after night.
export function Moon({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 40];
  const R = 280;
  const ph = (f / 50) % 1; // 0 new → 0.5 full → 1 new
  const kx = Math.cos(ph * 2 * Math.PI) * R;
  const lit = ph < 0.5 ? 1 : -1;
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: c[1] + R + 100, textAlign: "center", font: `400 90px ${font.impact}`, color: "#888" }}>NIGHT {Math.floor(f / 50) + 1}</div>}>
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 211) % W} cy={s.top + ((i * 137) % s.height)} r={2 + (i % 3)} fill="#fff" opacity={0.2 + 0.4 * Math.abs(Math.sin(f / 18 + i))} />)}
      <circle cx={c[0]} cy={c[1]} r={R} fill="#1a1a1a" stroke="#444" strokeWidth={4} />
      <path d={`M ${c[0]} ${c[1] - R} A ${R} ${R} 0 0 ${lit > 0 ? 1 : 0} ${c[0]} ${c[1] + R} A ${Math.abs(kx)} ${R} 0 0 ${(lit > 0) === (kx > 0) ? 0 : 1} ${c[0]} ${c[1] - R} Z`} fill="#e6e6e6" filter="url(#glow)" />
    </Frame>
  );
}

// Leaves fall from a bare-ing tree; seasons pass.
export function Autumn({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const left = 1 - k01(f, 0, dur * 0.9, clamp);
  const crown: Pt[] = Array.from({ length: 26 }, (_, i) => [s.cx + Math.cos(i * 2.4) * (60 + (i * 37) % 260), s.top + 330 + Math.sin(i * 2.4) * (40 + (i * 23) % 160)]);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${s.cx - 40} ${gy} L ${s.cx - 20} ${s.top + 400} M ${s.cx + 40} ${gy} L ${s.cx + 20} ${s.top + 400} M ${s.cx - 20} ${s.top + 480} L ${s.cx - 220} ${s.top + 300} M ${s.cx + 20} ${s.top + 450} L ${s.cx + 240} ${s.top + 280} M ${s.cx} ${s.top + 400} L ${s.cx + 10} ${s.top + 200}`} stroke="#ddd" strokeWidth={22} strokeLinecap="round" fill="none" />
      {crown.map(([x, y], i) => {
        const fallAt = i / crown.length;
        if (fallAt < 1 - left) {
          const u = cyc(f, 70, i * 11);
          return <ellipse key={i} cx={x + Math.sin(u * 8 + i) * 80} cy={y + u * (gy - y)} rx={26} ry={14} fill="#aaa" opacity={1 - u} transform={`rotate(${u * 400} ${x + Math.sin(u * 8 + i) * 80} ${y + u * (gy - y)})`} />;
        }
        return <ellipse key={i} cx={x} cy={y} rx={30} ry={16} fill={i % 3 ? "#bbb" : "#fff"} transform={`rotate(${i * 40 + Math.sin(f / 10 + i) * 10} ${x} ${y})`} />;
      })}
      {Array.from({ length: Math.floor((1 - left) * 24) }, (_, i) => <ellipse key={`g${i}`} cx={s.cx - 360 + (i * 61) % 720} cy={gy - 6} rx={24} ry={8} fill="#888" />)}
    </Frame>
  );
}

// Surfing down the face of a giant wave.
export function Surf({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const base = s.bottom - 100;
  const crest: Pt = [s.cx + 260, s.top + 200];
  const bx = s.cx - 120 + Math.sin(f / 15) * 80;
  const by = base - 280 + Math.cos(f / 15) * 60;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${-50} ${base} Q ${s.cx - 100} ${base - 50} ${s.cx + 120} ${crest[1] + 300} Q ${crest[0]} ${crest[1] - 50} ${crest[0] + 300} ${crest[1] + 40} Q ${crest[0] + 60} ${crest[1] + 40} ${crest[0] + 80} ${crest[1] + 220} Q ${W} ${base - 200} ${W + 50} ${base} V ${H} H -50 Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${s.cx - 200 + i * 60} ${base - 40 - i * 80} Q ${s.cx + 60 + i * 30} ${base - 200 - i * 100} ${s.cx + 160 + i * 40} ${crest[1] + 340 - i * 40}`} fill="none" stroke="#fff" strokeOpacity={0.15} strokeWidth={4} />)}
      {Array.from({ length: 12 }, (_, i) => {
        const u = cyc(f, 30, i * 3);
        return <circle key={i} cx={crest[0] + 200 - u * 120 + (i * 17) % 60} cy={crest[1] + 40 + u * 120 - (i * 13) % 50} r={6 + (i % 3) * 3} fill="#fff" opacity={1 - u} />;
      })}
      <g transform={`rotate(-20 ${bx} ${by})`}>
        <ellipse cx={bx} cy={by} rx={150} ry={22} fill="#e6e6e6" />
        <Figure x={bx} ground={by - 18} s={0.6} pose={{ ...STAND, t: 10, ls: -80, le: -60, rs: 90, re: 70, lh: -30, lk: 10, rh: 30, rk: -10 }} />
      </g>
    </Frame>
  );
}

// A volcano rumbles, then erupts.
export function Volcano({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.4;
  const erupt = f >= at;
  const shake = !erupt ? Math.sin(f * 3) * 4 * (f / at) : 0;
  const top = gy - 560;
  return (
    <Frame p={p} t={t}>
      <g transform={`translate(${shake} 0)`}>
        {erupt && Array.from({ length: 16 }, (_, i) => {
          const u = cyc(f - at, 36, i * 2.3);
          const vx = ((i * 53) % 21 - 10) * 30;
          return <circle key={i} cx={s.cx + vx * u} cy={top - 900 * u + 1100 * u * u} r={18 + (i % 4) * 8} fill={i % 3 ? "#ddd" : "#fff"} opacity={1 - u * 0.6} filter="url(#glow)" />;
        })}
        {erupt && <path d={`M ${s.cx - 70} ${top} Q ${s.cx - 200} ${top - 400} ${s.cx} ${top - 520 - Math.sin(f / 4) * 40} Q ${s.cx + 200} ${top - 400} ${s.cx + 70} ${top} Z`} fill="#fff" opacity={0.85} filter="url(#glow)" />}
        {[0, 1, 2].map((i) => {
          const u = cyc(f, 60, i * 20);
          return <circle key={`sm${i}`} cx={s.cx + Math.sin(u * 4 + i) * 60} cy={top - 60 - u * 400} r={60 + u * 120} fill="#555" opacity={0.6 * (1 - u)} />;
        })}
        <path d={`M ${s.left - 100} ${gy} L ${s.cx - 90} ${top} H ${s.cx + 90} L ${s.right + 100} ${gy} Z`} fill="#141414" stroke="#fff" strokeWidth={8} />
        {erupt && <path d={`M ${s.cx - 40} ${top} q -30 120 -90 200 q -40 80 -120 160 M ${s.cx + 50} ${top} q 40 160 140 260`} fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" opacity={k01(f, at, at + 20)} filter="url(#glow)" />}
      </g>
    </Frame>
  );
}

// The moon slides across the sun; then the ring of light blazes.
export function Eclipse({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 40];
  const k = k01(f, 0, dur * 0.6);
  const mx = c[0] + (1 - k) * 600;
  const full = k >= 1;
  return (
    <Frame p={p} t={t}>
      {full && Array.from({ length: 24 }, (_, i) => {
        const [a, b] = [go(c, i * 15 + f, 280), go(c, i * 15 + f, 340 + 80 * Math.abs(Math.sin(f / 6 + i)))];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={0.7} />;
      })}
      <circle cx={c[0]} cy={c[1]} r={260} fill="#fff" filter="url(#glow)" />
      <circle cx={mx} cy={c[1]} r={255} fill="#000" />
      {full && <circle cx={c[0]} cy={c[1]} r={262} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />}
    </Frame>
  );
}

// Walking a ridge line as peaks scroll past.
export function Ridge({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 200;
  const off = f * 3;
  const range = (y: number, h: number, step: number, sp: number, fill: string, key: string) => {
    const o = (off * sp) % (step * 2);
    const pts = Array.from({ length: Math.ceil(W / step) + 4 }, (_, i) => `${i * step - o - step},${y - (i % 2 ? h : h * 0.4) - ((i * 37) % 60)}`);
    return <polygon key={key} points={`${-step * 2},${H} ${pts.join(" ")} ${W + step * 2},${H}`} fill={fill} stroke="#fff" strokeOpacity={0.4} strokeWidth={3} />;
  };
  return (
    <Frame p={p} t={t}>
      <circle cx={s.right - 120} cy={s.top + 160} r={80} fill="#fff" opacity={0.5} />
      {range(gy - 150, 300, 220, 0.3, "#0c0c0c", "a")}
      {range(gy - 40, 200, 160, 0.6, "#141414", "b")}
      <path d={`M 0 ${gy} Q ${s.cx} ${gy - 40} ${W} ${gy}`} fill="none" stroke="#fff" strokeWidth={6} />
      <rect x={0} y={gy + 2} width={W} height={H} fill="#0a0a0a" />
      <Figure x={s.cx} ground={gy - 20} s={0.7} pose={walk(f * 0.12)} />
    </Frame>
  );
}

// A drop falls on a stone, again and again, until it cracks.
export function Drip({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const top = gy - 300;
  const u = cyc(f, 24);
  const crack = k01(f, 0, dur * 0.9, clamp);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx - 120} ${s.top + 140} q 120 40 240 0 v 30 q -120 40 -240 0 Z`} fill="#555" />
      <path d={`M ${s.cx} ${s.top + 200 + u * (top - s.top - 200)} q 24 40 0 60 q -24 -20 0 -60 Z`} fill="#fff" filter="url(#glow)" />
      {u < 0.3 && [0, 1, 2, 3].map((i) => <circle key={i} cx={s.cx + (i - 1.5) * 30 * (1 + u * 10)} cy={top - 20 - Math.sin(u * 10) * 30} r={6} fill="#fff" opacity={1 - u * 3} />)}
      <path d={`M ${s.cx - 380} ${gy} Q ${s.cx - 400} ${top} ${s.cx} ${top} Q ${s.cx + 400} ${top} ${s.cx + 380} ${gy} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <path d={`M ${s.cx} ${top} l -20 ${80 * crack} l 40 ${60 * crack} l -30 ${90 * crack} M ${s.cx - 20} ${top + 80 * crack} l -60 ${50 * crack}`} fill="none" stroke="#fff" strokeWidth={6} opacity={crack > 0.1 ? 1 : 0} />
      <ellipse cx={s.cx} cy={top + 6} rx={40 * (1 + crack)} ry={8} fill="#999" opacity={0.6} />
      <Ground y={gy} />
      {big(`DROP ${Math.floor(f / 24) * 1000 + 1}`, s.cx, gy + 120, 70, "#777")}
    </Frame>
  );
}

// Trudging across desert dunes under a blazing sun; heat haze.
export function Desert({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const ph = f * 0.07;
  return (
    <Frame p={p} t={t}>
      <circle cx={s.right - 140} cy={s.top + 180} r={130} fill="#fff" filter="url(#glow)" />
      {Array.from({ length: 8 }, (_, i) => {
        const [a, b] = [go([s.right - 140, s.top + 180], i * 45 + f, 160), go([s.right - 140, s.top + 180], i * 45 + f, 220)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={8} strokeLinecap="round" />;
      })}
      <path d={`M -100 ${gy - 200} Q 300 ${gy - 400} 700 ${gy - 220} T ${W + 300} ${gy - 260} V ${gy} H -100 Z`} fill="#141414" stroke="#888" strokeWidth={4} />
      <path d={`M -100 ${gy} Q 400 ${gy - 120} ${W + 100} ${gy} V ${H} H -100 Z`} fill="#1c1c1c" stroke="#fff" strokeWidth={5} />
      {[0, 1, 2].map((i) => <path key={i} d={wave(s.cy - 100 + i * 60, 8, 60, f * 2 + i * 20)} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={3} />)}
      <Figure x={s.cx - 60} ground={gy - 60} s={0.75} pose={{ ...walk(ph, 0.5), t: 22 }} headDown={30} />
    </Frame>
  );
}

// Trudging through snow, leaving a trail of tracks.
export function Snow({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 80;
  const x = interpolate(f, [0, dur], [s.left + 100, s.right - 120]);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 60 }, (_, i) => {
        const y = ((i * 211 + f * (3 + (i % 3))) % (s.height + 200)) + s.top - 100;
        const sx = ((i * 157) % W) + Math.sin(f / 15 + i) * 30;
        return <circle key={i} cx={sx} cy={y} r={3 + (i % 3) * 2} fill="#fff" opacity={0.6} />;
      })}
      <rect x={0} y={gy} width={W} height={300} fill="#e6e6e6" opacity={0.15} />
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#fff" strokeWidth={5} />
      {Array.from({ length: Math.floor((x - s.left - 100) / 60) }, (_, i) => <ellipse key={`t${i}`} cx={s.left + 100 + i * 60} cy={gy + 14 + (i % 2) * 14} rx={22} ry={8} fill="#000" opacity={0.6} />)}
      <Figure x={x} ground={gy + 40} s={0.8} pose={{ ...walk((x - s.left) / (walkRate(0.6) * 0.8), 0.6), t: 20, ls: -20, rs: 20 }} headDown={25} />
    </Frame>
  );
}

// Sitting by a campfire; sparks rise into the night.
export function Campfire({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 80;
  const c: Pt = [s.cx + 120, gy];
  const flame = (sc: number, o: number, fill: string, key: string) => {
    const w = Math.sin(f / 3 + o) * 20;
    return <path key={key} d={`M ${c[0] - 110 * sc} ${c[1] - 30} Q ${c[0] - 120 * sc} ${c[1] - 200 * sc} ${c[0] + w} ${c[1] - 360 * sc} Q ${c[0] + 120 * sc} ${c[1] - 200 * sc} ${c[0] + 110 * sc} ${c[1] - 30} Z`} fill={fill} />;
  };
  return (
    <Frame p={p} t={t}>
      <circle cx={c[0]} cy={c[1] - 100} r={420 + Math.sin(f / 2) * 20} fill="#fff" opacity={0.06} />
      <g filter="url(#glow)">
        {flame(1, 0, "#bbb", "a")}
        {flame(0.65, 2, "#fff", "b")}
      </g>
      {[-1, 1].map((d) => <rect key={d} x={c[0] - 150} y={c[1] - 40} width={300} height={36} rx={18} fill="#555" transform={`rotate(${d * 15} ${c[0]} ${c[1] - 22})`} />)}
      {Array.from({ length: 10 }, (_, i) => {
        const u = cyc(f, 50, i * 5);
        return <circle key={i} cx={c[0] + Math.sin(u * 6 + i) * 60} cy={c[1] - 300 - u * 600} r={4} fill="#fff" opacity={1 - u} />;
      })}
      <Ground y={gy} />
      <Figure x={s.left + 160} ground={gy} s={0.75} pose={{ ...SIT, rs: 70, re: 40 }} headDown={10} />
    </Frame>
  );
}

// A lighthouse beam sweeps across a dark sea.
export function Lighthouse({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.bottom - 160;
  const lamp: Pt = [s.cx - 160, s.top + 320];
  const a = Math.sin(f / 25) * 50;
  const beam = (d: number) => {
    const [p1, p2] = [go(lamp, 90 * d + a - 10, 1400), go(lamp, 90 * d + a + 10, 1400)];
    return <polygon key={d} points={`${lamp[0]},${lamp[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill="#fff" opacity={0.18} />;
  };
  return (
    <Frame p={p} t={t}>
      {beam(1)}
      {beam(-1)}
      <path d={`M ${lamp[0] - 70} ${sea} L ${lamp[0] - 45} ${lamp[1] + 60} H ${lamp[0] + 45} L ${lamp[0] + 70} ${sea} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      {[0, 1, 2].map((i) => <rect key={i} x={lamp[0] - 60 + i * 4} y={lamp[1] + 160 + i * 180} width={120 - i * 8} height={60} fill="#ccc" />)}
      <rect x={lamp[0] - 50} y={lamp[1] - 40} width={100} height={100} fill="#fff" filter="url(#glow)" />
      <path d={`M ${lamp[0] - 70} ${lamp[1] - 40} L ${lamp[0]} ${lamp[1] - 120} L ${lamp[0] + 70} ${lamp[1] - 40} Z`} fill="#ccc" />
      <rect x={0} y={sea} width={W} height={400} fill="#0d0d0d" />
      {[0, 1, 2].map((i) => <path key={i} d={wave(sea + 10 + i * 60, 14, 120, f * (2 + i))} fill="none" stroke="#fff" strokeOpacity={0.5 - i * 0.12} strokeWidth={5} />)}
      <path d={`M ${s.right - 200 + Math.sin(f / 20) * 20} ${sea + 50} h 160 l -30 40 h -100 Z M ${s.right - 120 + Math.sin(f / 20) * 20} ${sea + 50} v -120 l 70 100 Z`} fill="#888" />
    </Frame>
  );
}

// A small boat tossed on big waves, holding course.
export function Boat({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 160;
  const tilt = Math.sin(f / 10) * 14;
  const bob = Math.sin(f / 10 + 1) * 40;
  return (
    <Frame p={p} t={t}>
      {f % 60 < 3 && <path d={`M ${s.left + 200} ${s.top} l -50 200 h 50 l -60 220`} fill="none" stroke="#fff" strokeWidth={8} />}
      {Array.from({ length: 40 }, (_, i) => {
        const y = ((i * 211 + f * 30) % 1200) + s.top - 100;
        const x = ((i * 157 - f * 10) % W + W) % W;
        return <line key={i} x1={x} y1={y} x2={x - 16} y2={y + 30} stroke="#fff" strokeOpacity={0.3} strokeWidth={2} />;
      })}
      <g transform={`translate(${s.cx} ${sea + bob}) rotate(${tilt})`}>
        <path d="M -220 0 H 220 L 160 110 H -160 Z" fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        <line x1={0} y1={0} x2={0} y2={-420} stroke="#ccc" strokeWidth={10} />
        <path d="M 10 -400 L 200 -40 H 10 Z" fill="#e6e6e6" />
        <Figure x={-110} ground={0} s={0.45} pose={{ ...STAND, t: -tilt * 0.5 }} />
      </g>
      {[0, 1, 2].map((i) => <path key={i} d={wave(sea + 80 + i * 90, 50 - i * 10, 200 - i * 30, f * (4 + i * 2))} fill="none" stroke="#fff" strokeOpacity={0.7 - i * 0.2} strokeWidth={8 - i * 2} />)}
      <rect x={0} y={sea + 120} width={W} height={600} fill="#000" opacity={0.6} />
    </Frame>
  );
}

// Chained to an anchor on the seabed; the figure cuts free and swims up.
export function Anchor({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const bed = s.bottom - 40;
  const at = hit ?? dur * 0.45;
  const up = k01(f, at, dur, { ...clamp, easing: Easing.in(Easing.quad) });
  const fy = bed - 380 - up * 600;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top} width={W} height={s.height} fill="#fff" opacity={0.03} />
      {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={s.left + (i * 97) % s.width} cy={bed - cyc(f, 80, i * 8) * 900} r={6 + (i % 3) * 4} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={3} />)}
      <g transform={`translate(${s.cx + 200} ${bed - 160})`}>
        <path d="M 0 -200 V 120 M -140 40 Q -120 150 0 150 Q 120 150 140 40 M -170 60 l 30 -30 l 20 40 M 170 60 l -30 -30 l -20 40 M -80 -140 H 80" fill="none" stroke="#bbb" strokeWidth={28} strokeLinecap="round" />
        <circle cx={0} cy={-230} r={34} fill="none" stroke="#bbb" strokeWidth={16} />
      </g>
      {up === 0
        ? <path d={`M ${s.cx + 200} ${bed - 420} Q ${s.cx + 60} ${bed - 300} ${s.cx - 20} ${bed - 210}`} fill="none" stroke="#999" strokeWidth={10} strokeDasharray="22 10" />
        : <path d={`M ${s.cx + 200} ${bed - 420} q -40 60 -60 ${60 + up * 100}`} fill="none" stroke="#999" strokeWidth={10} strokeDasharray="22 10" />}
      <Figure x={s.cx - 20} y={fy} s={0.7} front pose={up > 0 ? VICTORY : { ...STAND, ls: 60, le: 140, rs: -60, re: -140, t: Math.sin(f / 5) * 8 }} trail={up > 0 && up < 1 ? [VICTORY] : []} />
      <line x1={0} y1={bed} x2={W} y2={bed} stroke="#888" strokeWidth={5} />
    </Frame>
  );
}

// Alone on a tiny island with one palm tree.
export function Island({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 220;
  const sw = Math.sin(f / 20) * 4;
  return (
    <Frame p={p} t={t}>
      <circle cx={s.left + 140} cy={s.top + 160} r={70} fill="#fff" opacity={0.6} />
      <path d={`M ${s.cx - 300} ${sea + 10} Q ${s.cx} ${sea - 120} ${s.cx + 300} ${sea + 10} Z`} fill="#1e1e1e" stroke="#fff" strokeWidth={6} />
      <g transform={`rotate(${sw} ${s.cx + 120} ${sea - 60})`}>
        <path d={`M ${s.cx + 120} ${sea - 60} Q ${s.cx + 80} ${sea - 300} ${s.cx + 160} ${sea - 520}`} fill="none" stroke="#ccc" strokeWidth={26} strokeLinecap="round" />
        {[-140, -70, 10, 80, 150].map((a, i) => {
          const tip = go([s.cx + 160, sea - 520], 180 + a, 230);
          return <path key={i} d={`M ${s.cx + 160} ${sea - 520} Q ${(s.cx + 160 + tip[0]) / 2} ${Math.min(sea - 520, tip[1]) - 80} ${tip[0]} ${tip[1]}`} fill="none" stroke="#e6e6e6" strokeWidth={22} strokeLinecap="round" />;
        })}
      </g>
      <Figure x={s.cx - 100} ground={sea - 50} s={0.5} pose={SIT} headDown={20} />
      <rect x={0} y={sea} width={W} height={600} fill="#0d0d0d" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={wave(sea + 10 + i * 70, 10, 100, f * (1.5 + i))} fill="none" stroke="#fff" strokeOpacity={0.5 - i * 0.1} strokeWidth={4} />)}
    </Frame>
  );
}

// Walking out of a dark cave into daylight.
export function Cave({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 80;
  const k = k01(f, 0, dur, clamp);
  const sc = 0.3 + 0.9 * k;
  const y = gy - 280 + 280 * k;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx - 300} ${gy} Q ${s.cx - 340} ${s.top + 200} ${s.cx} ${s.top + 160} Q ${s.cx + 340} ${s.top + 200} ${s.cx + 300} ${gy} Z`} fill="#fff" opacity={0.85} filter="url(#glow)" />
      <path d={`M 0 0 H ${W} V ${H} H 0 Z M ${s.cx - 300} ${gy} Q ${s.cx - 340} ${s.top + 200} ${s.cx} ${s.top + 160} Q ${s.cx + 340} ${s.top + 200} ${s.cx + 300} ${gy} Z`} fill="#0d0d0d" fillRule="evenodd" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M ${s.left + i * 130} ${s.top} l 30 ${60 + (i % 3) * 40} l 30 ${-60 - (i % 3) * 40}`} fill="#222" />)}
      <Figure x={s.cx} ground={y} s={sc} back={k < 0.5} front={k >= 0.5} pose={walk(f * 0.15, 0.6)} color={k > 0.4 ? "#ececec" : "#222"} glow={k > 0.4} />
    </Frame>
  );
}

// A sprout pushes up through cracked concrete.
export function Sprout({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 220;
  const g = k01(f, 4, dur * 0.85);
  const h = 450 * g;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={gy} width={W} height={600} fill="#1a1a1a" />
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#ccc" strokeWidth={6} />
      {[0, 1, 2].map((i) => <rect key={i} x={s.left + i * 330} y={gy + 40} width={300} height={140} fill="none" stroke="#333" strokeWidth={4} />)}
      <path d={`M ${s.cx - 10} ${gy} l -60 ${70 * g} l 40 ${40 * g} l -50 ${70 * g} M ${s.cx + 10} ${gy} l 70 ${60 * g} l -20 ${50 * g} l 50 ${60 * g} M ${s.cx - 10} ${gy} l -${120 * g} 20`} fill="none" stroke="#fff" strokeWidth={6} />
      <path d={`M ${s.cx} ${gy} Q ${s.cx - 30} ${gy - h / 2} ${s.cx} ${gy - h}`} fill="none" stroke="#e6e6e6" strokeWidth={14} strokeLinecap="round" filter="url(#glow)" />
      {g > 0.4 && [[-1, 0.55], [1, 0.75], [-1, 0.95]].map(([d, at], i) => {
        const lk = k01(f, dur * 0.85 * (at as number) - 10, dur * 0.85 * (at as number), pop);
        const y = gy - h * ((at as number) - 0.05);
        return <path key={i} d={`M ${s.cx} ${y} q ${(d as number) * 80 * lk} -60 ${(d as number) * 150 * lk} -20 q ${-(d as number) * 60 * lk} 50 ${-(d as number) * 150 * lk} 20 Z`} fill="#fff" />;
      })}
      {Array.from({ length: 6 }, (_, i) => <rect key={`c${i}`} x={s.cx - 120 + i * 45} y={gy - 16 - (i % 2) * 10} width={20} height={16} fill="#555" transform={`rotate(${i * 30} ${s.cx - 110 + i * 45} ${gy - 8})`} />)}
    </Frame>
  );
}

// A flower opens petal by petal.
export function Bloom({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 80];
  const k = k01(f, 4, dur * 0.8);
  const n = 8;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${c[0]} ${s.bottom} Q ${c[0] + 60} ${c[1] + 300} ${c[0]} ${c[1] + 40}`} fill="none" stroke="#bbb" strokeWidth={16} />
      <path d={`M ${c[0] + 30} ${c[1] + 380} q 120 -60 180 20 q -100 40 -180 -20 Z`} fill="#888" />
      {Array.from({ length: n }, (_, i) => {
        const a = (i * 360) / n + f * 0.3;
        const open = Math.min(1, Math.max(0, k * 1.6 - (i % 2) * 0.4));
        return <ellipse key={i} cx={c[0]} cy={c[1] - 40 - 110 * open} rx={70 * (0.5 + 0.5 * open)} ry={140 * (0.4 + 0.6 * open)} fill={i % 2 ? "#e6e6e6" : "#fff"} stroke="#000" strokeWidth={4} transform={`rotate(${a * open} ${c[0]} ${c[1]})`} />;
      })}
      <circle cx={c[0]} cy={c[1]} r={70} fill="#777" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
    </Frame>
  );
}

// A cocoon splits open; a butterfly unfolds and flies off.
export function Cocoon({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const at = hit ?? dur * 0.4;
  const out = k01(f, at, at + dur * 0.2);
  const fly = k01(f, at + dur * 0.25, dur, clamp);
  const branch = s.top + 220;
  const b: Pt = [s.cx + fly * 380 + Math.sin(fly * 12) * 60, s.cy + 60 - fly * 560];
  const flap = f > at ? 0.3 + 0.7 * Math.abs(Math.sin(f * (fly > 0 ? 0.6 : 0.15))) : 0;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.left - 40} ${branch} Q ${s.cx} ${branch + 40} ${s.right + 40} ${branch - 30}`} fill="none" stroke="#ccc" strokeWidth={24} strokeLinecap="round" />
      <line x1={s.cx} y1={branch + 20} x2={s.cx} y2={s.cy - 220} stroke="#aaa" strokeWidth={4} />
      <g transform={`rotate(${f < at ? Math.sin(f * 0.8) * 4 * (f / at) : 0} ${s.cx} ${s.cy - 220})`}>
        <path d={`M ${s.cx} ${s.cy - 220} Q ${s.cx - 120 - out * 40} ${s.cy} ${s.cx} ${s.cy + 220} Q ${s.cx + 120 + out * 40} ${s.cy} ${s.cx} ${s.cy - 220} Z`} fill="#1f1f1f" stroke="#ddd" strokeWidth={6} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M ${s.cx - 90} ${s.cy - 120 + i * 60} q 90 30 180 0`} fill="none" stroke="#555" strokeWidth={4} />)}
        {out > 0 && <path d={`M ${s.cx} ${s.cy - 200} l -20 ${120 * out} l 30 ${80 * out} l -20 ${100 * out}`} fill="none" stroke="#fff" strokeWidth={6} />}
      </g>
      {out > 0 && (
        <g transform={`translate(${b[0]} ${b[1]}) scale(${out})`} filter="url(#glow)">
          {[-1, 1].map((d) => (
            <g key={d} transform={`scale(${d * flap} 1)`}>
              <path d="M 0 0 C 80 -200 260 -160 200 -20 C 260 60 160 200 0 40 Z" fill="#fff" />
              <circle cx={120} cy={-80} r={30} fill="#888" />
            </g>
          ))}
          <ellipse rx={14} ry={70} fill="#ddd" />
        </g>
      )}
    </Frame>
  );
}

// A bird soars over the clouds, wings beating then gliding.
export function Bird({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const b: Pt = [s.cx + Math.sin(f / 30) * 80, s.cy - 100 + Math.sin(f / 20) * 50];
  const flap = Math.sin(f / 5) * (f % 90 < 50 ? 1 : 0.15);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 6 }, (_, i) => {
        const x = W - ((i * 300 + f * (6 + (i % 3) * 3)) % (W + 600)) + 300;
        const y = s.cy + 200 + (i % 3) * 150;
        return <g key={i} opacity={0.15 + (i % 3) * 0.1}>{[-1, 0, 1].map((d) => <circle key={d} cx={x + d * 100} cy={y - (d === 0 ? 40 : 0)} r={d === 0 ? 110 : 80} fill="#fff" />)}</g>;
      })}
      {Array.from({ length: 8 }, (_, i) => <line key={`w${i}`} x1={W - ((i * 180 + f * 20) % (W + 200))} y1={s.top + 100 + i * 100} x2={W - ((i * 180 + f * 20) % (W + 200)) + 120} y2={s.top + 100 + i * 100} stroke="#fff" strokeOpacity={0.15} strokeWidth={3} />)}
      <g transform={`translate(${b[0]} ${b[1]})`} filter="url(#glow)">
        <path d={`M 0 0 Q -150 ${-120 * flap - 30} -320 ${-160 * flap + 20} Q -180 ${-40 * flap + 20} 0 30 Z`} fill="#e6e6e6" />
        <path d={`M 0 0 Q 150 ${-120 * flap - 30} 320 ${-160 * flap + 20} Q 180 ${-40 * flap + 20} 0 30 Z`} fill="#e6e6e6" />
        <ellipse cx={0} cy={15} rx={40} ry={90} fill="#fff" />
        <circle cx={0} cy={-80} r={34} fill="#fff" />
        <path d="M -10 -95 l 10 -40 l 10 40 Z" fill="#888" />
      </g>
    </Frame>
  );
}

// A fish leaps up a waterfall against the current.
export function Upstream({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const ledge = s.cy - 140;
  const pool = s.bottom - 80;
  const u = k01(f, dur * 0.1, dur * 0.7, clamp);
  const fx = s.cx + 160 - u * 280;
  const fy = pool - u * (pool - ledge + 80) - Math.sin(u * Math.PI) * 220;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={ledge} width={s.cx + 40} height={pool - ledge} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />
      <rect x={s.cx - 160} y={ledge} width={200} height={pool - ledge} fill="#fff" opacity={0.12} />
      {Array.from({ length: 12 }, (_, i) => {
        const y = ledge + ((i * 70 + f * 18) % (pool - ledge));
        return <line key={i} x1={s.cx - 150 + (i * 37) % 180} y1={y} x2={s.cx - 150 + (i * 37) % 180} y2={y + 60} stroke="#fff" strokeOpacity={0.6} strokeWidth={5} />;
      })}
      <path d={wave(ledge, 6, 80, f * 3)} fill="none" stroke="#fff" strokeWidth={4} transform={`translate(0 0)`} clipPath="none" />
      <rect x={0} y={pool} width={W} height={400} fill="#0d0d0d" />
      {[0, 1].map((i) => <path key={i} d={wave(pool + 10 + i * 50, 10, 100, f * 3)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} />)}
      <g transform={`translate(${fx} ${fy}) rotate(${-60 + u * 30 + Math.sin(f) * 8})`} filter="url(#glow)">
        <path d="M -90 0 Q 0 -50 90 0 Q 0 50 -90 0 Z" fill="#e6e6e6" />
        <path d="M -80 0 l -50 -40 v 80 Z" fill="#e6e6e6" />
        <circle cx={55} cy={-8} r={7} fill="#000" />
      </g>
    </Frame>
  );
}

// Standing under a crashing waterfall, not moving.
export function Waterfall({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  return (
    <Frame p={p} t={t}>
      <rect x={s.left - 80} y={s.top + 80} width={260} height={gy - s.top - 80} fill="#141414" stroke="#888" strokeWidth={4} />
      <rect x={s.right - 180} y={s.top + 80} width={260} height={gy - s.top - 80} fill="#141414" stroke="#888" strokeWidth={4} />
      <rect x={s.left + 180} y={s.top + 80} width={s.width - 360} height={gy - s.top - 80} fill="#fff" opacity={0.12} />
      {Array.from({ length: 30 }, (_, i) => {
        const y = s.top + 80 + ((i * 97 + f * 30) % (gy - s.top - 80));
        return <line key={i} x1={s.left + 200 + (i * 41) % (s.width - 400)} y1={y} x2={s.left + 200 + (i * 41) % (s.width - 400)} y2={y + 90} stroke="#fff" strokeWidth={6} opacity={0.6} />;
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const u = cyc(f, 20, i * 3);
        const d = i % 2 ? 1 : -1;
        return <circle key={`sp${i}`} cx={s.cx + d * (60 + u * 300)} cy={gy - 40 - Math.sin(u * Math.PI) * 140} r={6 + (i % 3) * 3} fill="#fff" opacity={1 - u} />;
      })}
      <Figure x={s.cx} ground={gy} s={0.95} front pose={{ ...STAND, ls: -40, le: -60, rs: 40, re: 60, lh: -12, lk: -12, rh: 12, rk: 12 }} headDown={10} />
    </Frame>
  );
}

// Stars appear and connect into a constellation: connecting the dots.
export function Stars({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pts: Pt[] = [[s.cx - 340, s.cy + 300], [s.cx - 180, s.cy + 80], [s.cx - 240, s.cy - 180], [s.cx - 20, s.cy - 300], [s.cx + 180, s.cy - 140], [s.cx + 120, s.cy + 120], [s.cx + 340, s.cy + 260]];
  const k = k01(f, 4, dur * 0.85, clamp) * (pts.length - 1);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 211) % W} cy={s.top + ((i * 137) % s.height)} r={1.5 + (i % 3)} fill="#fff" opacity={0.15 + 0.3 * Math.abs(Math.sin(f / 15 + i))} />)}
      {pts.slice(1).map((q, i) => {
        const u = Math.max(0, Math.min(1, k - i));
        if (u <= 0) return null;
        const e = lerp(pts[i], q, u);
        return <line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={e[0]} y2={e[1]} stroke="#fff" strokeWidth={5} opacity={0.8} />;
      })}
      {pts.map(([x, y], i) => star(x, y, (i <= k + 0.5 ? 40 : 22) * (1 + 0.15 * Math.sin(f / 5 + i)), i, i <= k + 0.5 ? "#fff" : "#777"))}
    </Frame>
  );
}

// A shooting star streaks across the sky; the figure looks up.
export function Wish({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const u = k01(f, dur * 0.2, dur * 0.55, { ...clamp, easing: Easing.in(Easing.quad) });
  const h: Pt = [s.right + 100 - u * 900, s.top + 80 + u * 400];
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 211) % W} cy={s.top + ((i * 137) % (s.height - 300))} r={1.5 + (i % 3)} fill="#fff" opacity={0.2 + 0.4 * Math.abs(Math.sin(f / 15 + i))} />)}
      {u > 0 && u < 1 && (
        <>
          <line x1={h[0]} y1={h[1]} x2={h[0] + 420} y2={h[1] - 190} stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={0.5} />
          {star(h[0], h[1], 40, "h")}
        </>
      )}
      <path d={`M 0 ${gy} Q ${s.cx} ${gy - 80} ${W} ${gy} V ${H} H 0 Z`} fill="#0d0d0d" stroke="#888" strokeWidth={4} />
      <Figure x={s.cx - 150} ground={gy - 50} s={0.7} pose={{ ...STAND, rs: 150 * u, re: 160 * u }} headDown={-30} />
    </Frame>
  );
}

// A small planet orbits a bright sun, lap after lap.
export function Orbit({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy];
  const a = (f / 60) * 2 * Math.PI;
  const pl: Pt = [c[0] + Math.cos(a) * 400, c[1] + Math.sin(a) * 160];
  const behind = Math.sin(a) < 0;
  const planet = <circle cx={pl[0]} cy={pl[1]} r={60 * (1 + 0.2 * Math.sin(a))} fill="#bbb" stroke="#fff" strokeWidth={5} />;
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.bottom - 220, textAlign: "center", font: `400 90px ${font.impact}`, color: "#888" }}>LAP {Math.floor(f / 60) + 1}</div>}>
      <ellipse cx={c[0]} cy={c[1]} rx={400} ry={160} fill="none" stroke="#555" strokeWidth={4} strokeDasharray="14 12" />
      {behind && planet}
      <circle cx={c[0]} cy={c[1]} r={170} fill="#fff" filter="url(#glow)" />
      {!behind && planet}
    </Frame>
  );
}

// The globe turns; a single light shows where you are.
export function Globe({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy];
  const R = 380;
  const rot = f * 2;
  return (
    <Frame p={p} t={t}>
      <defs>
        <clipPath id="globe"><circle cx={c[0]} cy={c[1]} r={R} /></clipPath>
      </defs>
      <circle cx={c[0]} cy={c[1]} r={R} fill="#141414" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <g clipPath="url(#globe)">
        {[-60, -30, 0, 30, 60].map((lat) => <ellipse key={lat} cx={c[0]} cy={c[1] + Math.sin(lat * D) * R} rx={Math.cos(lat * D) * R} ry={Math.cos(lat * D) * R * 0.12} fill="none" stroke="#444" strokeWidth={3} />)}
        {Array.from({ length: 6 }, (_, i) => {
          const a = ((i * 30 + rot) % 180) - 90;
          return <ellipse key={i} cx={c[0]} cy={c[1]} rx={Math.abs(Math.sin(a * D)) * R} ry={R} fill="none" stroke="#444" strokeWidth={3} />;
        })}
        {[[0, -0.3, 160, 120], [140, 0.25, 120, 200], [250, -0.1, 200, 140]].map(([lon, lat, w, h], i) => {
          const a = ((lon + rot) % 360) * D;
          const x = c[0] + Math.sin(a) * R * 0.8;
          return Math.cos(a) > -0.1 ? <ellipse key={i} cx={x} cy={c[1] + lat * R * 2} rx={w * Math.max(0.15, Math.cos(a))} ry={h} fill="#777" /> : null;
        })}
        {(() => {
          const a = ((140 + rot) % 360) * D;
          return Math.cos(a) > 0 ? <circle cx={c[0] + Math.sin(a) * R * 0.8} cy={c[1] + 0.25 * R * 2 - 40} r={18} fill="#fff" filter="url(#glow)" /> : null;
        })()}
      </g>
    </Frame>
  );
}

// A windmill turns steadily in the wind.
export function Windmill({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const hub: Pt = [s.cx, s.top + 380];
  const speed = interpolate(f, [0, dur], [1, 6]);
  const a = (f * speed) % 360;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${hub[0] - 30} ${hub[1]} L ${hub[0] - 70} ${gy} H ${hub[0] + 70} L ${hub[0] + 30} ${hub[1]} Z`} fill="#e6e6e6" />
      {[0, 120, 240].map((b) => (
        <g key={b} transform={`rotate(${a + b} ${hub[0]} ${hub[1]})`}>
          <path d={`M ${hub[0] - 12} ${hub[1]} L ${hub[0] - 30} ${hub[1] - 460} Q ${hub[0]} ${hub[1] - 490} ${hub[0] + 20} ${hub[1] - 440} L ${hub[0] + 12} ${hub[1]} Z`} fill="#fff" filter="url(#glow)" />
        </g>
      ))}
      <circle cx={hub[0]} cy={hub[1]} r={30} fill="#888" stroke="#fff" strokeWidth={5} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M ${W - ((i * 260 + f * 14) % (W + 300))} ${s.top + 200 + i * 140} q 60 -20 120 0 t 120 0`} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={4} />)}
    </Frame>
  );
}

// Running off a cliff edge and leaping into the open.
export function Leap({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const edge = s.cx - 60;
  const gy = s.cy + 160;
  const at = hit ?? dur * 0.4;
  const runX = interpolate(f, [0, at], [s.left, edge], clamp);
  const air = k01(f, at, dur, clamp);
  const x = f < at ? runX : edge + air * 520;
  const y = f < at ? gy : gy - Math.sin(air * Math.PI * 0.8) * 340 + air * 60;
  return (
    <Frame p={p} t={t}>
      <path d={`M -20 ${gy} H ${edge} L ${edge - 60} ${gy + 140} L ${edge - 20} ${gy + 300} L ${edge - 120} ${H} H -20 Z`} fill="#141414" stroke="#fff" strokeWidth={6} />
      {[0, 1, 2].map((i) => <path key={i} d={wave(s.bottom + 20 + i * 50, 10, 120, f * 2 + i * 40)} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
      {f < at
        ? <Figure x={x} ground={y} s={0.7} pose={run(((x - s.left) / (RUN_RATE * 0.7)) * Math.PI)} />
        : <Figure x={x} ground={y} s={0.7} pose={{ ...VICTORY, t: 20, lh: -40, lk: 30, rh: 40, rk: -10 }} trail={air < 0.7 ? [VICTORY, VICTORY] : []} />}
    </Frame>
  );
}

// Sinking into quicksand, then hauling yourself out.
export function Sink({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 220;
  const down = k01(f, 0, dur * 0.45);
  const upk = k01(f, dur * 0.55, dur * 0.9);
  const depth = 300 * down * (1 - upk);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.right - 80} ${gy} q -40 -200 -10 -400`} fill="none" stroke="#ccc" strokeWidth={18} />
      <Figure x={s.cx} ground={gy + depth} s={0.9} front pose={upk > 0 ? mix({ ...STAND, ls: 140, le: 160, rs: -140, re: -160 }, VICTORY, upk) : { ...STAND, ls: 160, le: 175, rs: -160, re: -175 }} />
      <rect x={0} y={gy} width={W} height={600} fill="#1f1f1f" />
      <ellipse cx={s.cx} cy={gy} rx={380} ry={50} fill="#2a2a2a" stroke="#888" strokeWidth={4} />
      {[0, 1, 2].map((i) => <ellipse key={i} cx={s.cx} cy={gy} rx={120 + cyc(f, 40, i * 13) * 240} ry={20 + cyc(f, 40, i * 13) * 30} fill="none" stroke="#fff" strokeWidth={3} opacity={0.5 * (1 - cyc(f, 40, i * 13))} />)}
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#aaa" strokeWidth={4} />
    </Frame>
  );
}

// Standing on thin ice as cracks spread out from under your feet.
export function Ice({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 220;
  const k = k01(f, 4, dur * 0.85, clamp);
  // Cracks radiate from the feet across the ice (flattened for perspective), each with a jagged walk.
  const cracks = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 + 20) * D;
    return Array.from({ length: 7 }, (_, j): Pt => {
      const r = j * 70, jit = j ? ((i * 31 + j * 17) % 40) - 20 : 0;
      return [s.cx + Math.cos(a) * r + jit, gy + 60 + Math.sin(a) * r * 0.3 + jit * 0.3];
    });
  });
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={gy} width={W} height={600} fill="#fff" opacity={0.08} />
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#fff" strokeWidth={5} />
      {cracks.map((pts, i) => {
        const n = Math.max(2, Math.floor(k * pts.length));
        return <polyline key={i} points={pts.slice(0, n).map((q) => q.join(",")).join(" ")} fill="none" stroke="#fff" strokeWidth={5} filter="url(#glow)" />;
      })}
      <Figure x={s.cx} ground={gy + 60} s={0.85} front pose={{ ...STAND, ls: -50, le: -70, rs: 50, re: 70, lh: -14, lk: -14, rh: 14, rk: 14 }} headDown={30} />
      {k > 0.5 && Math.floor(f / 3) % 2 === 0 && big("CRACK", s.cx + 300, gy - 400, 70, "#666")}
    </Frame>
  );
}
