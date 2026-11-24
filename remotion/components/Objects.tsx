import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W } from "../theme.ts";
import { type VisualProps } from "./common.tsx";
import { tickAt } from "../mono.ts";
import { D, Figure, Ground, SIT, STAND, Scene, Stamp, StatCounter, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pt, type Stat } from "./Mono.tsx";

// Third batch of object scenes (Mono.tsx holds the figure and the first two). Same rules: SVG drawing in <Scene>,
// text as HTML on top, labels via <Stamp> at the stage top.

type L = VisualProps<{ label?: string }>;
const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };

// Everyone's on a ladder; yours keeps going.
export function Ladder({ p, t }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const rung = 110;
  const off = (f * 4) % rung;
  const sw = Math.sin(f / 6);
  const ladder = (x: number, w: number, o: number, c: string) => (
    <g>
      {[-1, 1].map((d) => <line key={d} x1={x + d * w} y1={s.top + 100} x2={x + d * w} y2={s.bottom + 100} stroke={c} strokeWidth={8} />)}
      {Array.from({ length: 11 }, (_, k) => <line key={k} x1={x - w} y1={s.top + 100 + k * rung + o} x2={x + w} y2={s.top + 100 + k * rung + o} stroke={c} strokeWidth={6} />)}
    </g>
  );
  const hipY = s.cy + 160;
  return (
    <>
      <Scene>
        {[0, 1, 2].map((k) => {
          const y = ((k * 430 + f * 3) % 1500) + s.top - 300;
          return <ellipse key={`c${k}`} cx={(k * 390 + 160) % W} cy={y} rx={190} ry={40} fill="#fff" opacity={0.08} />;
        })}
        {ladder(170, 55, 0, "#333")}
        {ladder(910, 55, 0, "#333")}
        <Figure x={170} y={s.cy + 260} s={0.5} back pose={STAND} hands={[[-90, -300], [90, -300]]} color="#4a4a4a" glow={false} headDown={30} />
        <Figure x={910} y={s.cy + 60} s={0.5} back pose={STAND} hands={[[-90, -300], [90, -300]]} color="#4a4a4a" glow={false} headDown={30} />
        {ladder(s.cx, 120, off, "#e6e6e6")}
        <Figure x={s.cx} y={hipY} s={0.9} back pose={{ ...STAND, lh: -10 + 25 * sw, lk: -10 - 10 * sw, rh: 10 - 25 * sw, rk: 10 + 10 * sw }} hands={[[-120, -250 + 40 * sw], [120, -250 - 40 * sw]]} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Walking over a chasm on planks that appear one step ahead.
export function Bridge({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy + 220;
  const [a, b] = [250, 830];
  const x = interpolate(f, [0, dur], [140, 940]);
  const planks = Array.from({ length: Math.ceil((b - a) / 64) }, (_, k) => a + k * 64);
  return (
    <>
      <Scene>
        <path d={`M 0 ${gy} H ${a} L ${a - 60} ${s.bottom + 200} H 0 Z M ${W} ${gy} H ${b} L ${b + 60} ${s.bottom + 200} H ${W} Z`} fill="#0d0d0d" stroke="#e6e6e6" strokeWidth={5} />
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={a + 20} y1={gy + 120 + i * 70} x2={b - 20} y2={gy + 120 + i * 70} stroke="#fff" strokeOpacity={0.05 + i * 0.01} strokeWidth={2} />)}
        {planks.map((px, k) => {
          const k2 = interpolate(x + 150 - px, [0, 40], [0, 1], clamp);
          return k2 > 0 ? <rect key={k} x={px + 3} y={gy - 4 - (1 - k2) * 80} width={58} height={22} rx={4} fill="#cfcfcf" opacity={k2} /> : null;
        })}
        {[0, 1, 2, 3].map((k) => {
          const age = ((f + k * 11) % 44) / 44;
          const px = Math.min(b - 30, Math.max(a + 20, x + 60 - k * 30));
          return <circle key={`p${k}`} cx={px} cy={gy + 20 + age * age * 520} r={4 + (k % 2) * 2} fill="#bbb" opacity={1 - age} />;
        })}
        <Figure x={x} ground={gy} s={0.7} pose={walk((x - 140) / (walkRate() * 0.7))} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Leaning into a storm: sideways rain, wind, lightning.
export function Storm({ p, t }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const bolt = f % 50 < 4;
  const ph = f * 0.12;
  return (
    <>
      <Scene>
        {bolt && <path d={`M 760 ${s.top - 100} L 700 ${s.top + 120} L 760 ${s.top + 120} L 680 ${s.top + 380}`} fill="none" stroke="#fff" strokeWidth={8} filter="url(#glow)" />}
        {Array.from({ length: 80 }, (_, i) => {
          const y = ((i * 211 + f * 34) % (gy - s.top + 400)) + s.top - 300;
          const x = (((i * 157 - f * 22) % (W + 200)) + W + 200) % (W + 200) - 100;
          return <line key={i} x1={x} y1={y} x2={x - 30} y2={y + 30} stroke="#fff" strokeOpacity={0.3} strokeWidth={2} />;
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const y = s.top + 80 + i * 110;
          const x = W - ((i * 300 + f * 40) % (W + 500));
          return <path key={i} d={`M ${x} ${y} q 80 -30 160 0 t 160 0`} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={4} />;
        })}
        {[0, 1, 2].map((k) => {
          const x = W - ((k * 410 + f * 26) % (W + 300)) + 150;
          const y = gy - 120 - k * 180 + Math.sin(f / 5 + k) * 60;
          return <rect key={`d${k}`} x={x} y={y} width={40} height={28} fill="#ccc" opacity={0.7} transform={`rotate(${f * 15 + k * 90} ${x + 20} ${y + 14})`} />;
        })}
        <Ground y={gy} dash={40} offset={-ph * walkRate(0.5) * 0.9} />
        {[0, 1, 2, 3].map((k) => {
          const age = ((f + k * 5) % 20) / 20;
          return <line key={`s${k}`} x1={s.cx - 60 + (k - 1.5) * 30} y1={gy - 4} x2={s.cx - 60 + (k - 1.5) * (30 + age * 70)} y2={gy - 20 - age * 30 + age * age * 40} stroke="#fff" strokeWidth={3} opacity={0.6 * (1 - age)} strokeLinecap="round" />;
        })}
        <Figure x={s.cx - 60} ground={gy} s={0.9} pose={{ ...walk(ph, 0.5), t: 28 }} headDown={25} />
      </Scene>
      {bolt && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.25 }} />}
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// You, slumped, in front of a mirror where the other you stands tall; slowly you straighten up.
export function Mirror({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = interpolate(f, [dur * 0.3, dur * 0.8], [0, 1], ease);
  const m = { cx: 720, cy: gy - 330, rx: 210, ry: 330 };
  const slump = { ...STAND, t: 18, ls: 10, rs: 14 };
  return (
    <>
      <Scene>
        <defs>
          <clipPath id="mirrorglass">
            <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} />
          </clipPath>
        </defs>
        <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill="#151515" />
        <g clipPath="url(#mirrorglass)">
          <Figure x={m.cx + 30} ground={gy - 40} s={0.8} flip pose={mix(STAND, VICTORY, 0.25 + 0.75 * k)} />
        </g>
        <g clipPath="url(#mirrorglass)">
          <rect x={m.cx - m.rx - 200 + ((f * 9) % (2 * m.rx + 400))} y={m.cy - m.ry} width={50} height={m.ry * 2} fill="#fff" opacity={0.12} transform={`skewX(-20)`} />
        </g>
        <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        <line x1={m.cx} y1={m.cy + m.ry} x2={m.cx} y2={gy} stroke="#cfcfcf" strokeWidth={10} />
        <Ground y={gy} />
        <Figure x={320} ground={gy} s={0.9} pose={mix(slump, STAND, k)} headDown={35 * (1 - k)} color={k > 0.5 ? "#ececec" : "#8a8a8a"} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Coins drop into a glass jar that keeps filling.
export function Jar({ p, t, dur }: VisualProps<{ stat?: Stat }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const j = { x: s.cx - 220, w: 440, top: gy - 560 };
  const level = interpolate(f, [0, dur], [0.1, 0.85]);
  const fillTop = gy - 20 - (gy - 20 - j.top - 40) * level;
  const rows = Math.floor((gy - 20 - fillTop) / 22);
  const u = (f % 8) / 8;
  return (
    <>
      <Scene>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => <ellipse key={`${r}${c}`} cx={j.x + 60 + c * 64 + (r % 2 ? 30 : 0)} cy={gy - 34 - r * 22} rx={30} ry={11} fill="#9a9a9a" stroke="#eee" strokeWidth={3} />),
        )}
        <ellipse cx={s.cx + Math.sin(f) * 40} cy={j.top - 200 + u * (fillTop - j.top + 200)} rx={30} ry={11 + 15 * Math.abs(Math.sin(f / 2))} fill="#eee" filter="url(#glow)" />
        <path d={`M ${j.x} ${j.top} V ${gy - 30} Q ${j.x} ${gy} ${j.x + 30} ${gy} H ${j.x + j.w - 30} Q ${j.x + j.w} ${gy} ${j.x + j.w} ${gy - 30} V ${j.top}`} fill="none" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        <rect x={j.x - 20} y={j.top - 40} width={j.w + 40} height={40} rx={10} fill="none" stroke="#bbb" strokeWidth={5} />
        <line x1={j.x + 40} y1={j.top + 40} x2={j.x + 40} y2={gy - 80} stroke="#fff" strokeOpacity={0.3} strokeWidth={10} strokeLinecap="round" />
        {/* The sticker says what's being counted (the counter's label), never a fixed word like "SAVINGS". */}
        {p.stat && (
          <>
            <rect x={j.x + 110} y={j.top + 90} width={j.w - 220} height={70} rx={8} fill="#e6e6e6" />
            <text x={s.cx} y={j.top + 140} textAnchor="middle" fontSize={44} fontFamily={font.impact} fill="#111" letterSpacing={4}>{p.stat.label.toUpperCase().slice(0, 10)}</text>
          </>
        )}
        {[0, 1, 2].map((k) => {
          const tw = Math.max(0, Math.sin(f / 4 + k * 2.1));
          const gx = j.x + 90 + k * 120, gy2 = gy - 40 - ((k * 37) % Math.max(1, rows * 22 - 20));
          return <path key={`g${k}`} d={`M ${gx} ${gy2 - 14 * tw} L ${gx + 4} ${gy2} L ${gx} ${gy2 + 14 * tw} L ${gx - 4} ${gy2} Z M ${gx - 14 * tw} ${gy2} L ${gx} ${gy2 - 4} L ${gx + 14 * tw} ${gy2} L ${gx} ${gy2 + 4} Z`} fill="#fff" />;
        })}
      </Scene>
      {p.stat && <StatCounter stat={p.stat} t={t} dur={dur} y={s.top} />}
    </>
  );
}

// Arrows land closer each time; the last one is dead centre (at tickAt; sfxCues pops on each).
export function Target({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx + 60, s.cy - 40];
  const hits: Pt[] = [[-170, -120], [130, 150], [-60, 70], [0, 0]];
  return (
    <>
      <Scene>
        {[300, 230, 160, 90, 30].map((r, i) => <circle key={r} cx={c[0]} cy={c[1]} r={r} fill={i % 2 ? "#e6e6e6" : "#0d0d0d"} stroke="#fff" strokeWidth={5} />)}
        {hits.map((h, k) => {
          const t0 = tickAt(k, hits.length, dur);
          const u = interpolate(f, [t0 - 6, t0], [0, 1], clamp);
          if (u <= 0) return null;
          const tip: Pt = [c[0] + h[0] - (1 - u) * 900, c[1] + h[1] - (1 - u) * 60];
          const ring = f - t0;
          const quiver = ring > 0 && ring < 16 ? Math.sin(ring * 2.2) * 5 * (1 - ring / 16) : 0;
          return (
            <g key={k} transform={`rotate(${quiver} ${tip[0]} ${tip[1]})`}>
              <line x1={tip[0] - 260} y1={tip[1]} x2={tip[0]} y2={tip[1]} stroke="#fff" strokeWidth={8} />
              <path d={`M ${tip[0]} ${tip[1]} l -30 -14 v 28 z`} fill="#fff" />
              <path d={`M ${tip[0] - 260} ${tip[1]} l -30 -24 h 40 l 20 24 l -20 24 h -40 z`} fill="#888" />
              {k === hits.length - 1 && ring > 0 && ring < 14 && <circle cx={tip[0]} cy={tip[1]} r={40 + ring * 20} fill="none" stroke="#fff" strokeWidth={8} opacity={1 - ring / 14} filter="url(#glow)" />}
            </g>
          );
        })}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A dead bulb flickers, then blazes on (at 45%; sfxCues dings there).
export function Bulb({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const at = hit ?? dur * 0.45; // blazes on with the line's hit word when it has one, after flickering
  const on = f >= at ? 1 : f >= at - dur * 0.15 ? ((f * 7) % 5 < 2 ? 0.7 : 0) : 0;
  const c: Pt = [s.cx, s.top + 380];
  const gy = s.bottom - 40;
  return (
    <>
      <Scene>
        <line x1={c[0]} y1={s.top + 100} x2={c[0]} y2={c[1] - 230} stroke="#888" strokeWidth={5} />
        {on > 0 && Array.from({ length: 12 }, (_, i) => {
          const [a, b] = [go(c, i * 30 + f, 215), go(c, i * 30 + f, 270 + 20 * Math.sin(f / 4 + i))];
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={on} />;
        })}
        <circle cx={c[0]} cy={c[1]} r={170} fill={on ? "#fff" : "#111"} opacity={on ? on : 1} stroke="#fff" strokeWidth={8} filter={on ? "url(#glow)" : undefined} />
        <path d={`M ${c[0] - 40} ${c[1] + 30} l 20 -60 l 20 50 l 20 -50 l 20 60`} fill="none" stroke={on ? "#000" : "#777"} strokeWidth={6} />
        {f >= at - dur * 0.15 && f < at && [0, 1, 2, 3].map((k) => {
          const a = ((f * 47 + k * 90) % 360) * D;
          return <line key={`sp${k}`} x1={c[0] + Math.cos(a) * 40} y1={c[1] + Math.sin(a) * 40} x2={c[0] + Math.cos(a) * 90} y2={c[1] + Math.sin(a) * 90} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={(f * 7) % 5 < 2 ? 1 : 0.3} />;
        })}
        <rect x={c[0] - 80} y={c[1] + 150} width={160} height={80} rx={12} fill="#9a9a9a" />
        {[0, 1, 2].map((i) => <line key={i} x1={c[0] - 80} y1={c[1] + 170 + i * 22} x2={c[0] + 80} y2={c[1] + 170 + i * 22} stroke="#555" strokeWidth={5} />)}
        <Ground y={gy} />
        <Figure x={s.cx} ground={gy} s={0.75} pose={mix(STAND, VICTORY, on === 1 ? interpolate(f, [at, at + dur * 0.15], [0, 1], ease) : 0)} headDown={-15} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A giant battery charges bar by bar (or drains), the figure sitting on top; the percentage reads below.
export function Battery({ p, t, dur }: VisualProps<{ label?: string; drain?: boolean }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const b = { x: s.left + 40, y: s.cy - 60, w: s.width - 120, h: 300 };
  const k = interpolate(f, [4, dur * 0.85], p.drain ? [0.95, 0.08] : [0.08, 1], clamp);
  const bars = 5;
  const pct = Math.round(k * 100);
  return (
    <>
      <Scene>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={30} fill="#0a0a0a" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        <rect x={b.x + b.w + 6} y={b.y + b.h / 2 - 60} width={36} height={120} rx={10} fill="#fff" />
        {Array.from({ length: bars }, (_, i) => {
          const on = Math.max(0, Math.min(1, k * bars - i));
          const bw = (b.w - 40 - (bars - 1) * 16) / bars;
          return <rect key={i} x={b.x + 20 + i * (bw + 16)} y={b.y + 20} width={bw * on} height={b.h - 40} rx={10} fill={k < 0.2 ? "#777" : "#fff"} />;
        })}
        <path d={`M ${b.x + b.w / 2 + 20} ${b.y + 40} L ${b.x + b.w / 2 - 40} ${b.y + 160} H ${b.x + b.w / 2 + 10} L ${b.x + b.w / 2 - 20} ${b.y + b.h - 40} L ${b.x + b.w / 2 + 50} ${b.y + 130} H ${b.x + b.w / 2} Z`} fill="#000" stroke="#000" strokeWidth={6} opacity={p.drain ? 0.2 : 0.55 + 0.45 * Math.sin(f / 4)} />
        {!p.drain && <path d={`M ${b.x + b.w + 42} ${b.y + b.h / 2} C ${b.x + b.w + 120} ${b.y + b.h / 2}, ${b.x + b.w + 20} ${b.y + b.h + 260}, ${b.x + b.w - 60} ${b.y + b.h + 380}`} fill="none" stroke="#999" strokeWidth={10} />}
        <Figure x={b.x + 220} ground={b.y} s={0.6} pose={SIT} headDown={p.drain ? 35 : -10} />
      </Scene>
      <div style={{ position: "absolute", left: 0, right: 0, top: b.y + b.h + 30, textAlign: "center", font: `400 150px ${font.impact}`, color: "#fff", textShadow: "0 0 30px rgba(255,255,255,0.4)" }}>{pct}%</div>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Pushing a boulder up a hill, one step at a time.
export function Boulder({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const a: Pt = [0, s.bottom - 20], b: Pt = [W, s.bottom - 560];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const [nx, ny] = [uy, -ux];
  const u = interpolate(f, [0, dur], [0.45, 0.62]);
  const R = 170;
  const q = lerp(a, b, u);
  const roll = ((u * len) / R) * (180 / Math.PI);
  const fx = q[0] - ux * (R + 55);
  const fy = q[1] - uy * (R + 55);
  return (
    <>
      <Scene>
        <path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} V ${s.bottom + 300} H 0 Z`} fill="#0b0b0b" stroke="#eaeaea" strokeWidth={5} />
        <g transform={`translate(${q[0] - nx * R} ${q[1] - ny * R}) rotate(${roll})`}>
          <path d={`M ${-R} 0 Q ${-R} ${-R} 0 ${-R} Q ${R * 1.05} ${-R * 0.9} ${R} 0 Q ${R * 0.9} ${R} 0 ${R} Q ${-R} ${R * 0.95} ${-R} 0 Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
          <path d={`M -60 -40 l 40 30 M 50 60 l 30 -20 M -20 90 l -30 10`} stroke="#888" strokeWidth={5} />
        </g>
        {[0, 1, 2].map((k) => {
          const age = ((f + k * 15) % 45) / 45;
          const pp = lerp(a, b, Math.max(0, u - 0.05 - age * 0.35));
          return <circle key={`pb${k}`} cx={pp[0] - nx * 8} cy={pp[1] - ny * 8 - Math.abs(Math.sin(age * 12)) * 16} r={6 + k * 2} fill="#bbb" opacity={1 - age} />;
        })}
        <Figure x={fx} ground={fy} s={0.8} pose={{ ...walk(f * 0.08, 0.6), t: 40, rs: 80, re: 88, ls: 74, le: 84 }} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// An empty wallet falls open and a moth flutters out.
export function Wallet({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 180];
  const open = interpolate(f, [4, 16], [0, 1], ease);
  const m = Math.max(0, f - 14);
  const moth: Pt = [c[0] + Math.sin(m / 6) * 120 + m * 2, c[1] - 120 - m * 9];
  const flap = Math.abs(Math.sin(f * 0.9));
  return (
    <>
      <Scene>
        <rect x={c[0] - 280} y={c[1]} width={560} height={260} rx={30} fill="#111" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        <rect x={c[0] - 240} y={c[1] + 40} width={480} height={120} rx={14} fill="none" stroke="#666" strokeWidth={4} strokeDasharray="14 10" />
        <g opacity={0.6} stroke="#aaa" strokeWidth={2} fill="none">
          {[0, 25, 50, 75].map((a) => <line key={a} x1={c[0] + 236} y1={c[1] + 44} x2={c[0] + 236 - Math.cos(a * D) * 110} y2={c[1] + 44 + Math.sin(a * D) * 110} />)}
          {[40, 75, 105].map((r) => <path key={r} d={`M ${c[0] + 236 - r} ${c[1] + 44} Q ${c[0] + 236 - r * 0.62} ${c[1] + 44 + r * 0.45} ${c[0] + 236 - r * 0.26} ${c[1] + 44 + r * 0.97}`} />)}
        </g>
        <g transform={`translate(0 ${c[1]}) scale(1 ${1 - 2 * open}) translate(0 ${-c[1]})`}>
          <rect x={c[0] - 280} y={c[1]} width={560} height={240} rx={30} fill="#1c1c1c" stroke="#fff" strokeWidth={8} />
        </g>
        {f > 14 && m < dur && (
          <g transform={`translate(${moth[0]} ${moth[1]})`} filter="url(#glow)">
            <path d={`M 0 0 L ${-60} ${-40 * flap - 10} L ${-50} ${30 * flap} Z M 0 0 L 60 ${-40 * flap - 10} L 50 ${30 * flap} Z`} fill="#ddd" />
            <ellipse rx={8} ry={24} fill="#fff" />
          </g>
        )}
        {f > 14 && Array.from({ length: 10 }, (_, i) => <circle key={i} cx={c[0] - 150 + i * 33} cy={c[1] - 20 - ((m * (1 + (i % 3))) % 200)} r={4} fill="#fff" opacity={0.4 * Math.max(0, 1 - m / 40)} />)}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A key slides in, turns, the shackle springs open (at 55%; sfxCues hits there).
export function Lock({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 80];
  const at = hit ?? dur * 0.55; // springs open on the line's hit word when it has one
  const slide = interpolate(f, [4, at * 0.55], [1, 0], ease);
  const turn = interpolate(f, [at * 0.65, at * 0.92], [0, 90], ease);
  const pop = interpolate(f, [at, at + dur * 0.07], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.5)) });
  return (
    <>
      <Scene>
        <path d={`M ${c[0] - 140} ${c[1] - 180 - 90 * pop} V ${c[1] - 330 - 90 * pop} A 140 140 0 0 1 ${c[0] + 140} ${c[1] - 330 - 90 * pop} V ${c[1] - 180 - (pop > 0 ? 40 + 90 * pop : 0)}`} fill="none" stroke="#e6e6e6" strokeWidth={44} transform={`rotate(${-12 * pop} ${c[0] - 140} ${c[1] - 180})`} />
        <rect x={c[0] - 260} y={c[1] - 200} width={520} height={420} rx={50} fill="#111" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        {pop > 0 && pop < 1.2 && <rect x={c[0] - 260 + pop * 460} y={c[1] - 200} width={60} height={420} fill="#fff" opacity={0.25 * (1 - Math.min(1, pop))} transform="skewX(-15)" />}
        <circle cx={c[0]} cy={c[1] - 20} r={34} fill="#fff" />
        <rect x={c[0] - 12} y={c[1] - 10} width={24} height={90} fill="#fff" />
        <g transform={`translate(${c[0] + 30 + slide * 500} ${c[1] - 20}) rotate(${turn})`}>
          <rect x={0} y={-10} width={240} height={20} fill="#cfcfcf" />
          <circle cx={290} cy={0} r={60} fill="none" stroke="#cfcfcf" strokeWidth={20} />
          <path d="M 40 10 v 30 h 25 v -15 h 20 v 15 h 20 v -30" fill="#cfcfcf" />
        </g>
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// Nine pieces fly in and snap into one square (one at each tickAt).
export function Puzzle({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 3, size = 230;
  const x0 = s.cx - (n * size) / 2, y0 = s.cy - (n * size) / 2 + 40;
  return (
    <>
      <Scene>
        <rect x={x0} y={y0} width={n * size} height={n * size} fill="none" stroke="#333" strokeWidth={4} strokeDasharray="16 12" />
        {Array.from({ length: n * n }, (_, k) => {
          const t0 = tickAt(k, n * n, dur);
          const u = interpolate(f, [t0 - 8, t0], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          if (u <= 0) return null;
          const [cx, cy] = [x0 + (k % n) * size, y0 + Math.floor(k / n) * size];
          const from: Pt = [((k * 389) % W) - 100, k % 2 ? -400 : 2200];
          const [x, y] = lerp(from, [cx, cy], u);
          const last = k === n * n - 1 && f - t0 < 12;
          return (
            <g key={k} transform={`translate(${x} ${y}) rotate(${(1 - u) * (k % 2 ? 90 : -90)} ${size / 2} ${size / 2})`} filter={last ? "url(#glow)" : undefined}>
              <rect x={6} y={6} width={size - 12} height={size - 12} rx={14} fill={last ? "#fff" : "#1a1a1a"} stroke="#eee" strokeWidth={5} />
              {k % n < n - 1 && <circle cx={size - 4} cy={size / 2} r={26} fill={last ? "#fff" : "#1a1a1a"} stroke="#eee" strokeWidth={5} />}
              {u === 1 && f - t0 < 10 && <rect x={6 - (f - t0) * 3} y={6 - (f - t0) * 3} width={size - 12 + (f - t0) * 6} height={size - 12 + (f - t0) * 6} rx={14} fill="none" stroke="#fff" strokeWidth={4} opacity={1 - (f - t0) / 10} />}
            </g>
          );
        })}
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// The train roars past the platform and is gone; you're left standing there.
export function Train({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 160;
  const cars = 5, cw = 560;
  const x = interpolate(f, [0, dur * 0.8], [-cars * cw, W + 100], { ...clamp, easing: Easing.in(Easing.quad) });
  const reach = interpolate(f, [dur * 0.5, dur * 0.7], [0, 1], ease);
  return (
    <>
      <Scene>
        {Array.from({ length: cars }, (_, k) => {
          const cx = x + k * cw;
          return (
            <g key={k}>
              <rect x={cx + 10} y={gy - 380} width={cw - 20} height={320} rx={k === cars - 1 ? 60 : 20} fill="#0f0f0f" stroke="#eee" strokeWidth={6} />
              {[0, 1, 2, 3].map((w) => (
                <g key={w}>
                  <rect x={cx + 50 + w * 120} y={gy - 330} width={80} height={90} rx={8} fill="#fff" opacity={0.75} />
                  {(w + k) % 2 === 0 && <path d={`M ${cx + 75 + w * 120} ${gy - 240} v -30 a 15 15 0 1 1 30 0 v 30 Z`} fill="#222" />}
                </g>
              ))}
              {f < dur * 0.8 && [100, cw - 100].map((wx) => <line key={`sp${wx}`} x1={cx + wx - 30} y1={gy - 18} x2={cx + wx - 70 - ((f * 13 + wx) % 30)} y2={gy - 30 - ((f * 7 + k) % 14)} stroke="#fff" strokeWidth={3} />)}
              {[100, cw - 100].map((wx) => <circle key={wx} cx={cx + wx} cy={gy - 50} r={34} fill="#000" stroke="#ccc" strokeWidth={5} />)}
            </g>
          );
        })}
        {f < dur * 0.8 && Array.from({ length: 10 }, (_, i) => <line key={i} x1={(i * 211 + f * 50) % W} y1={gy - 420 - (i % 3) * 30} x2={((i * 211 + f * 50) % W) - 200} y2={gy - 420 - (i % 3) * 30} stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
        <line x1={0} y1={gy - 14} x2={W} y2={gy - 14} stroke="#aaa" strokeWidth={6} />
        <rect x={-10} y={gy + 20} width={W + 20} height={40} fill="#111" stroke="#ddd" strokeWidth={4} />
        <Figure x={s.cx - 120} ground={gy + 20} s={0.85} pose={{ ...STAND, rs: 10 + 70 * reach, re: 20 + 70 * reach }} headDown={20 * reach} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A bar chart rises bar by bar, each taller; the last one glows.
export function Bars({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 6, bw = 110, gap = 40;
  const x0 = s.left + 60;
  const maxH = s.height - (p.label ? 220 : 140);
  return (
    <>
      <Scene>
        <Ground y={gy} />
        {Array.from({ length: n }, (_, k) => {
          const t0 = tickAt(k, n, dur);
          const u = interpolate(f, [t0 - 8, t0], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
          const h = maxH * (0.15 + 0.85 * (k / (n - 1)) ** 1.6) * u;
          return (
            <g key={k}>
              <rect x={x0 + k * (bw + gap)} y={gy - h} width={bw} height={h} rx={8} fill={k === n - 1 ? "#fff" : "#2a2a2a"} stroke="#eee" strokeWidth={5} filter={k === n - 1 ? "url(#glow)" : undefined} />
              {u > 0.6 && k < n - 1 && <text x={x0 + k * (bw + gap) + bw / 2} y={gy - h - 16} textAnchor="middle" fontSize={34} fontFamily={font.impact} fill="#aaa">{Math.round(10 * 2 ** k)}</text>}
            </g>
          );
        })}
        <Figure x={x0 + (n - 1) * (bw + gap) + bw / 2} ground={gy - maxH * interpolate(f, [tickAt(n - 1, n, dur) - 8, tickAt(n - 1, n, dur)], [0, 1], clamp)} s={0.38} pose={mix(STAND, VICTORY, interpolate(f, [tickAt(n - 1, n, dur), tickAt(n - 1, n, dur) + 10], [0, 1], clamp))} />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}

// A road forks; the dim sign on the left, the lit one on the right, and you take the right.
export function Fork({ p, t, dur }: VisualProps<{ left: string; right: string }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const hz = s.top + 220, split = s.cy + 60;
  const u = interpolate(f, [0, dur], [0, 1]);
  const pos: Pt = u < 0.5 ? lerp([s.cx, s.bottom + 40], [s.cx, split + 40], u * 2) : lerp([s.cx, split + 40], [860, hz + 30], (u - 0.5) * 2);
  const sc = 0.8 - 0.62 * u;
  const sign = (text: string, x: number, on: boolean) => (
    <div style={{ position: "absolute", left: x - 170, width: 340, top: split - 300, textAlign: "center", font: `400 56px ${font.impact}`, color: on ? "#000" : "#888", background: on ? "#fff" : "#151515", border: `4px solid ${on ? "#fff" : "#555"}`, borderRadius: 10, boxShadow: on ? "0 0 30px rgba(255,255,255,0.5)" : "none" }}>{text.toUpperCase()}</div>
  );
  return (
    <>
      <Scene>
        <circle cx={860} cy={hz - 130} r={80} fill="#fff" opacity={0.18} />
        <line x1={0} y1={hz} x2={W} y2={hz} stroke="#fff" strokeOpacity={0.3} strokeWidth={3} />
        {[0, 1, 2, 3, 4].map((k) => {
          const t2 = k / 5;
          const [lx, ly] = lerp([s.cx - 380, split + 260], [180, hz], t2);
          const [rx, ry] = lerp([s.cx + 380, split + 260], [920, hz], t2);
          return (
            <g key={`p${k}`}>
              <line x1={lx} y1={ly} x2={lx} y2={ly - 90 * (1 - t2)} stroke="#555" strokeWidth={6 * (1 - t2) + 2} />
              <line x1={rx} y1={ry} x2={rx} y2={ry - 90 * (1 - t2)} stroke="#999" strokeWidth={6 * (1 - t2) + 2} />
            </g>
          );
        })}
        <path d={`M ${s.cx - 300} ${s.bottom + 200} L ${s.cx - 90} ${split} L 200 ${hz} L 240 ${hz} L ${s.cx} ${split - 60} L 840 ${hz} L 880 ${hz} L ${s.cx + 90} ${split} L ${s.cx + 300} ${s.bottom + 200} Z`} fill="#161616" stroke="#ddd" strokeWidth={5} strokeLinejoin="round" />
        <path d={`M ${s.cx} ${s.bottom + 200} L ${s.cx} ${split + 40} L 860 ${hz}`} fill="none" stroke="#fff" strokeWidth={6} strokeDasharray="40 30" strokeDashoffset={-f * 4} opacity={0.8} />
        {[230, 850].map((x) => <line key={x} x1={x} y1={split - 220} x2={x} y2={split + 60} stroke="#999" strokeWidth={8} />)}
        <Figure x={pos[0]} ground={pos[1]} s={sc} back pose={walk(f * 0.2, 0.35)} />
      </Scene>
      {sign(p.left, 230, false)}
      {sign(p.right, 850, true)}
    </>
  );
}

// A speedometer needle sweeps into the red and shakes there.
export function Gauge({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 160];
  const R = 400;
  const k = interpolate(f, [4, dur * 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ang = -120 + 240 * k + (k > 0.98 ? Math.sin(f * 2.3) * 3 : 0);
  const tip = go(c, 180 - ang, R - 60);
  return (
    <>
      <Scene>
        <path d={`M ${go(c, 300, R)[0]} ${go(c, 300, R)[1]} A ${R} ${R} 0 1 1 ${go(c, 60, R)[0]} ${go(c, 60, R)[1]}`} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        <path d={`M ${go(c, 108, R - 30)[0]} ${go(c, 108, R - 30)[1]} A ${R - 30} ${R - 30} 0 0 1 ${go(c, 60, R - 30)[0]} ${go(c, 60, R - 30)[1]}`} fill="none" stroke="#fff" strokeWidth={40} opacity={0.35 + 0.4 * k} />
        {Array.from({ length: 13 }, (_, i) => {
          const a = 180 - (-120 + i * 20);
          const [q1, q2] = [go(c, a, R - 20), go(c, a, R - (i % 3 ? 60 : 90))];
          return <line key={i} x1={q1[0]} y1={q1[1]} x2={q2[0]} y2={q2[1]} stroke="#ddd" strokeWidth={i % 3 ? 5 : 10} />;
        })}
        {[0, 20, 40, 60, 80, 100].map((v, k) => {
          const q = go(c, 180 - (-120 + k * 48), R - 140);
          return <text key={v} x={q[0]} y={q[1] + 14} textAnchor="middle" fontSize={40} fontFamily={font.impact} fill={k === 5 ? "#fff" : "#888"}>{v}</text>;
        })}
        {k > 0.85 && Math.floor(f / 4) % 2 === 0 && <path d={`M ${go(c, 108, R - 30)[0]} ${go(c, 108, R - 30)[1]} A ${R - 30} ${R - 30} 0 0 1 ${go(c, 60, R - 30)[0]} ${go(c, 60, R - 30)[1]}`} fill="none" stroke="#fff" strokeWidth={40} filter="url(#glow)" />}
        <line x1={c[0]} y1={c[1]} x2={go(c, 180 - (ang - 6), R - 60)[0]} y2={go(c, 180 - (ang - 6), R - 60)[1]} stroke="#fff" strokeOpacity={0.25} strokeWidth={10} strokeLinecap="round" />
        <line x1={c[0]} y1={c[1]} x2={tip[0]} y2={tip[1]} stroke="#fff" strokeWidth={14} strokeLinecap="round" filter="url(#glow)" />
        <circle cx={c[0]} cy={c[1]} r={34} fill="#fff" />
      </Scene>
      {p.label && <Stamp text={p.label} t={t} y={s.top} />}
    </>
  );
}
