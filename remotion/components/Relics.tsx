import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pose, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// More "built" series pictures: old machines, siege and travel, and the archaeology of how we know.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const wave = (y: number, amp: number, len: number, off: number) =>
  `M ${-len * 2 - (off % (len * 2))} ${y} ${Array.from({ length: Math.ceil(W / len) + 4 }, (_, i) => `q ${len / 2} ${i % 2 ? amp : -amp} ${len} 0`).join(" ")}`;
const haul: Pose = { ...STAND, t: 30, ls: 70, le: 80, rs: 80, re: 90 };
const gear = (c: Pt, r: number, teeth: number, rot: number, fill = "#2a2a2a", key?: string | number) => (
  <g key={key} transform={`rotate(${rot} ${c[0]} ${c[1]})`}>
    {Array.from({ length: teeth }, (_, i) => <rect key={i} x={c[0] - 6} y={c[1] - r - 14} width={12} height={20} fill="#bbb" transform={`rotate(${(i * 360) / teeth} ${c[0]} ${c[1]})`} />)}
    <circle cx={c[0]} cy={c[1]} r={r} fill={fill} stroke="#ddd" strokeWidth={4} />
    <circle cx={c[0]} cy={c[1]} r={r * 0.2} fill="#000" stroke="#999" strokeWidth={3} />
  </g>
);

// The Antikythera mechanism: a bronze train of gears turns a pointer around a dial of the sky.
export function Antikythera({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const dial: Pt = [s.cx, s.top + 330];
  return (
    <Frame p={p} t={t}>
      <rect x={s.left + 40} y={s.top + 100} width={s.width - 80} height={s.height - 160} rx={20} fill="#141414" stroke="#777" strokeWidth={5} />
      <circle cx={dial[0]} cy={dial[1]} r={200} fill="#1f1f1f" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      {Array.from({ length: 12 }, (_, i) => {
        const [a, b] = [go(dial, i * 30, 170), go(dial, i * 30, 196)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#aaa" strokeWidth={4} />;
      })}
      {(() => {
        const tip = go(dial, 180 - f * 3, 160);
        const moon = go(dial, 180 - f * 9, 110);
        return (
          <>
            <line x1={dial[0]} y1={dial[1]} x2={tip[0]} y2={tip[1]} stroke="#fff" strokeWidth={8} strokeLinecap="round" />
            <circle cx={tip[0]} cy={tip[1]} r={16} fill="#fff" />
            <circle cx={moon[0]} cy={moon[1]} r={12} fill="#888" />
          </>
        );
      })()}
      {gear([s.cx - 180, s.cy + 180], 130, 20, f * 3, "#2a2a2a", "a")}
      {gear([s.cx + 60, s.cy + 140], 90, 14, -f * 3 * (130 / 90), "#333", "b")}
      {gear([s.cx + 230, s.cy + 260], 70, 11, f * 3 * (130 / 70), "#2a2a2a", "c")}
      {gear([s.cx - 60, s.cy + 380], 60, 10, -f * 3 * (130 / 60), "#333", "d")}
      <line x1={s.cx + 330} y1={s.cy + 380} x2={s.cx + 330 + Math.cos(f / 5) * 60} y2={s.cy + 380 + Math.sin(f / 5) * 60} stroke="#ccc" strokeWidth={10} strokeLinecap="round" />
    </Frame>
  );
}

// A water clock: a steady drip fills the vessel, a float rises and its pointer climbs the hour marks.
export function WaterClock({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const v = { x: s.cx - 120, w: 240, top: s.top + 420, bot: s.bottom - 80 };
  const lvl = v.bot - (v.bot - v.top - 40) * k01(f, 0, dur, clamp);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx - 220} ${s.top + 140} h 240 l -30 140 h -180 Z`} fill="#1f1f1f" stroke="#ddd" strokeWidth={5} />
      <rect x={s.cx - 110} y={s.top + 200} width={200} height={60} fill="#fff" opacity={0.15} />
      {[0, 1].map((i) => <ellipse key={i} cx={s.cx - 100} cy={s.top + 290 + cyc(f, 20, i * 10) * (lvl - s.top - 290)} rx={7} ry={11} fill="#fff" />)}
      <rect x={v.x} y={lvl} width={v.w} height={v.bot - lvl} fill="#fff" opacity={0.2} />
      <rect x={v.x} y={v.top} width={v.w} height={v.bot - v.top} fill="none" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
      <rect x={v.x + 60} y={lvl - 24} width={120} height={24} fill="#888" />
      <line x1={v.x + 120} y1={lvl - 24} x2={v.x + 120} y2={lvl - 260} stroke="#ccc" strokeWidth={8} />
      <path d={`M ${v.x + 120} ${lvl - 260} h 140`} stroke="#fff" strokeWidth={8} />
      <path d={`M ${v.x + 270} ${lvl - 270} l 20 10 l -20 10 Z`} fill="#fff" />
      <line x1={v.x + 300} y1={s.top + 120} x2={v.x + 300} y2={v.bot} stroke="#777" strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={v.x + 300} y1={v.bot - 260 - i * 60} x2={v.x + 340} y2={v.bot - 260 - i * 60} stroke="#aaa" strokeWidth={4} />)}
    </Frame>
  );
}

// A loom: the shuttle flies back and forth and the cloth grows row by row.
export function Loom({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const top = s.top + 160, bot = s.bottom - 160;
  const woven = (bot - top) * k01(f, 0, dur, clamp);
  const u = cyc(f, 24);
  const dir = Math.floor(f / 24) % 2 ? -1 : 1;
  const sx = s.left + 80 + (dir > 0 ? u : 1 - u) * (s.width - 160);
  const wy = bot - woven;
  return (
    <Frame p={p} t={t}>
      <rect x={s.left + 40} y={top - 40} width={s.width - 80} height={30} fill="#888" />
      <rect x={s.left + 40} y={bot + 10} width={s.width - 80} height={30} fill="#888" />
      {Array.from({ length: 20 }, (_, i) => <line key={i} x1={s.left + 80 + i * ((s.width - 160) / 19)} y1={top - 10} x2={s.left + 80 + i * ((s.width - 160) / 19)} y2={bot + 10} stroke="#777" strokeWidth={3} />)}
      <rect x={s.left + 80} y={wy} width={s.width - 160} height={woven} fill="#cfcfcf" />
      {Array.from({ length: Math.floor(woven / 18) }, (_, i) => <line key={i} x1={s.left + 80} y1={bot - i * 18} x2={s.right - 80} y2={bot - i * 18} stroke={i % 4 < 2 ? "#999" : "#eee"} strokeWidth={6} />)}
      <line x1={s.left + 60} y1={wy - 60 - Math.abs(Math.sin(f / 6)) * 20} x2={s.right - 60} y2={wy - 60 - Math.abs(Math.sin(f / 6)) * 20} stroke="#bbb" strokeWidth={14} />
      <path d={`M ${sx - 60} ${wy - 20} h 120 l 20 10 l -20 10 h -120 l -20 -10 Z`} fill="#fff" filter="url(#glow)" />
    </Frame>
  );
}

// A potter's wheel: a lump of clay spins up into a pot.
export function Potter({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const wheelY = gy - 260;
  const k = k01(f, 0, dur * 0.8, clamp);
  const h = 80 + 300 * k, belly = 120 + 40 * k, neck = 120 - 60 * k;
  const c = s.cx + 100;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <line x1={c} y1={wheelY} x2={c} y2={gy} stroke="#777" strokeWidth={14} />
      <ellipse cx={c} cy={gy - 20} rx={180} ry={30} fill="#262626" stroke="#ccc" strokeWidth={4} />
      <ellipse cx={c} cy={wheelY} rx={220} ry={34} fill="#3a3a3a" stroke="#fff" strokeWidth={5} />
      <path d={`M ${c - 100} ${wheelY} Q ${c - belly - 30} ${wheelY - h * 0.45} ${c - neck} ${wheelY - h} H ${c + neck} Q ${c + belly + 30} ${wheelY - h * 0.45} ${c + 100} ${wheelY} Z`} fill="#555" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
      {[0.25, 0.5, 0.75].map((y, i) => <path key={i} d={`M ${c - belly * 0.9 + ((f * 8 + i * 30) % 60)} ${wheelY - h * y} q 30 6 60 0`} fill="none" stroke="#999" strokeWidth={4} />)}
      <Figure x={c - 340} ground={gy} s={0.7} pose={{ ...SIT, rs: 70, re: 30, ls: 60, le: 20 }} />
    </Frame>
  );
}

// Bronze casting: glowing metal pours into a mould; the mould is broken open on a finished figure.
export function Casting({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.65;
  const pour = k01(f, dur * 0.05, at * 0.9, clamp);
  const breakk = k01(f, at, at + 12, pop);
  const m = { x: s.cx - 180, w: 360, top: gy - 560 };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`rotate(${-50 + 10 * Math.sin(f / 10)} ${s.cx + 140} ${m.top - 120})`} opacity={1 - breakk}>
        <path d={`M ${s.cx + 60} ${m.top - 200} h 160 l -20 140 h -120 Z`} fill="#262626" stroke="#ddd" strokeWidth={5} />
      </g>
      {pour < 1 && <path d={`M ${s.cx + 30} ${m.top - 110} Q ${s.cx + 10} ${m.top - 40} ${s.cx} ${m.top}`} fill="none" stroke="#fff" strokeWidth={18} filter="url(#glow)" />}
      <Figure x={s.cx} ground={gy} s={1.1} front pose={STAND} color={breakk > 0 ? "#cfcfcf" : "#fff"} glow />
      <rect x={m.x} y={gy - 560 * pour} width={m.w} height={560 * pour} fill="#fff" opacity={0.35 * (1 - breakk)} />
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${d * breakk * 260} ${breakk * 60}) rotate(${d * breakk * 25} ${s.cx + d * m.w / 2} ${gy})`}>
          <rect x={d < 0 ? m.x : s.cx} y={m.top} width={m.w / 2} height={gy - m.top} fill="#333" stroke="#ddd" strokeWidth={6} />
          <path d={`M ${d < 0 ? m.x + 30 : s.cx + 30} ${m.top + 100} l 60 80 l -40 60 M ${d < 0 ? m.x + 60 : s.cx + 60} ${gy - 120} l 50 -50`} stroke="#666" strokeWidth={4} fill="none" />
        </g>
      ))}
    </Frame>
  );
}

// A pendulum clock: the pendulum swings, the escapement lets the gear advance one tooth at a time.
export function Pendulum({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const piv: Pt = [s.cx, s.top + 520];
  const a = Math.sin((f / 30) * Math.PI) * 22;
  const bob = go(piv, -a, 480);
  const step = Math.floor(f / 15);
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 260} y={s.top + 160} width={520} height={s.height - 180} rx={20} fill="#141414" stroke="#777" strokeWidth={5} />
      <circle cx={s.cx} cy={s.top + 330} r={150} fill="#e6e6e6" />
      {(() => {
        const [h, m] = [go([s.cx, s.top + 330], 180 - step * 2, 70), go([s.cx, s.top + 330], 180 - step * 24, 110)];
        return (
          <>
            <line x1={s.cx} y1={s.top + 330} x2={h[0]} y2={h[1]} stroke="#111" strokeWidth={12} strokeLinecap="round" />
            <line x1={s.cx} y1={s.top + 330} x2={m[0]} y2={m[1]} stroke="#111" strokeWidth={7} strokeLinecap="round" />
          </>
        );
      })()}
      {gear([s.cx + 120, piv[1] - 10], 70, 16, step * (360 / 16), "#2a2a2a", "g")}
      <path d={`M ${piv[0] - 60} ${piv[1] - 60} L ${piv[0]} ${piv[1]} L ${piv[0] + 60} ${piv[1] - 60}`} fill="none" stroke="#ccc" strokeWidth={8} transform={`rotate(${-a} ${piv[0]} ${piv[1]})`} />
      <line x1={piv[0]} y1={piv[1]} x2={bob[0]} y2={bob[1]} stroke="#ccc" strokeWidth={6} />
      <circle cx={bob[0]} cy={bob[1]} r={60} fill="#fff" filter="url(#glow)" />
    </Frame>
  );
}

// A steam locomotive chuffs along, smoke trailing, wheels and rods turning.
export function Locomotive({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const x = s.cx - 380;
  const a = f / 4;
  const wheel = (cx: number, r: number, key: string) => (
    <g key={key}>
      <circle cx={cx} cy={gy - r} r={r} fill="#1a1a1a" stroke="#fff" strokeWidth={6} />
      {[0, 60, 120].map((d) => <line key={d} x1={cx - Math.cos(a + d * D) * r} y1={gy - r - Math.sin(a + d * D) * r} x2={cx + Math.cos(a + d * D) * r} y2={gy - r + Math.sin(a + d * D) * r} stroke="#888" strokeWidth={4} />)}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#ccc" strokeWidth={8} />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={((i * 90 - f * 12) % (W + 90) + W + 90) % (W + 90) - 45} y={gy + 6} width={60} height={14} fill="#555" />)}
      <rect x={x + 120} y={gy - 380} width={460} height={210} rx={20} fill="#262626" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      <rect x={x + 520} y={gy - 500} width={220} height={330} fill="#1f1f1f" stroke="#fff" strokeWidth={6} />
      <rect x={x + 560} y={gy - 460} width={130} height={110} fill="#fff" opacity={0.6} />
      <rect x={x + 170} y={gy - 500} width={70} height={120} fill="#333" stroke="#ddd" strokeWidth={5} />
      <path d={`M ${x + 120} ${gy - 170} L ${x + 40} ${gy - 30} H ${x + 140}`} fill="#333" stroke="#ddd" strokeWidth={5} />
      {wheel(x + 220, 80, "a")}
      {wheel(x + 420, 80, "b")}
      {wheel(x + 620, 60, "c")}
      <line x1={x + 220 + Math.cos(a) * 50} y1={gy - 80 + Math.sin(a) * 50} x2={x + 420 + Math.cos(a) * 50} y2={gy - 80 + Math.sin(a) * 50} stroke="#e6e6e6" strokeWidth={12} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 40, i * 7);
        return <circle key={i} cx={x + 205 - u * 500} cy={gy - 520 - u * 160 - Math.sin(u * 6) * 20} r={40 + u * 70} fill="#777" opacity={0.6 * (1 - u)} />;
      })}
    </Frame>
  );
}

// An airship drifts across the sky, its gondola slung underneath, propellers turning.
export function Airship({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const x = interpolate(f, [0, dur], [s.cx - 120, s.cx + 120]);
  const y = s.cy - 100 + Math.sin(f / 30) * 20;
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 5 }, (_, i) => {
        const cx = ((i * 300 - f * 2) % (W + 400) + W + 400) % (W + 400) - 200;
        const cy = s.top + 120 + (i * 230) % (s.height - 200);
        return <g key={i} opacity={0.12}>{[-1, 0, 1].map((d) => <circle key={d} cx={cx + d * 80} cy={cy - (d ? 0 : 30)} r={d ? 60 : 90} fill="#fff" />)}</g>;
      })}
      <ellipse cx={x} cy={y} rx={420} ry={130} fill="#262626" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M ${x - 360 + i * 120} ${y - 115 + Math.abs(i - 3) * 10} Q ${x - 380 + i * 120} ${y} ${x - 360 + i * 120} ${y + 115 - Math.abs(i - 3) * 10}`} fill="none" stroke="#555" strokeWidth={3} />)}
      <path d={`M ${x + 360} ${y - 60} l 120 -80 v 80 Z M ${x + 360} ${y + 60} l 120 80 v -80 Z`} fill="#333" stroke="#ddd" strokeWidth={5} />
      <rect x={x - 120} y={y + 150} width={240} height={70} rx={20} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {[-80, 80].map((d) => <line key={d} x1={x + d} y1={y + 120} x2={x + d} y2={y + 150} stroke="#999" strokeWidth={4} />)}
      {Array.from({ length: 4 }, (_, i) => <rect key={i} x={x - 100 + i * 55} y={y + 165} width={36} height={30} fill="#fff" opacity={0.7} />)}
      <line x1={x + 130} y1={y + 185 - 50 * Math.cos(f)} x2={x + 130} y2={y + 185 + 50 * Math.cos(f)} stroke="#fff" strokeWidth={6} />
    </Frame>
  );
}

// An early biplane rolls along the sand, lifts off, and flies.
export function Biplane({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 80;
  const at = hit ?? dur * 0.45;
  const lift = k01(f, at, dur, { ...clamp, easing: Easing.in(Easing.quad) });
  const x = interpolate(f, [0, dur], [s.left - 40, s.right - 280]);
  const y = gy - 120 - lift * 500;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={40} offset={f * 6} />
      <g transform={`translate(${x} ${y}) rotate(${-8 * lift})`} filter="url(#glow)">
        <rect x={0} y={-90} width={420} height={14} fill="#e6e6e6" />
        <rect x={0} y={0} width={420} height={14} fill="#e6e6e6" />
        {[60, 180, 300].map((d) => <line key={d} x1={d} y1={-76} x2={d} y2={0} stroke="#ccc" strokeWidth={5} />)}
        <line x1={420} y1={-40} x2={560} y2={-40} stroke="#ccc" strokeWidth={5} />
        <rect x={540} y={-80} width={14} height={80} fill="#e6e6e6" />
        <line x1={-20} y1={-80 + 60 * Math.cos(f * 1.5)} x2={-20} y2={-20 - 60 * Math.cos(f * 1.5)} stroke="#fff" strokeWidth={6} />
        <Figure x={210} ground={0} s={0.3} pose={{ ...SIT, t: -90, ls: -80, le: -80, rs: -80, re: -80, lh: -90, lk: -90, rh: -90, rk: -90 }} />
        {lift === 0 && [100, 320].map((d) => <circle key={d} cx={d} cy={40} r={20} fill="none" stroke="#bbb" strokeWidth={5} />)}
      </g>
      <Figure x={s.left + 60} ground={gy} s={0.5} pose={mix(STAND, VICTORY, lift)} />
    </Frame>
  );
}

// A camera obscura: light through a small hole throws the world upside down onto the far wall.
export function Obscura({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const hole: Pt = [s.cx - 60, s.cy];
  const tree: Pt = [s.left + 40, s.cy];
  const wall = s.right - 60;
  const k = k01(f, dur * 0.1, dur * 0.5);
  const treeShape = (x: number, y: number, sc: number) => (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      <rect x={-12} y={0} width={24} height={150} fill="#ccc" />
      <circle cx={0} cy={-40} r={90} fill="#ddd" />
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {treeShape(tree[0] + 40, tree[1] - 60, 1)}
      <circle cx={s.left + 40} cy={s.top + 140} r={60} fill="#fff" filter="url(#glow)" />
      <rect x={hole[0]} y={s.top + 160} width={wall - hole[0] + 30} height={s.height - 240} fill="#0a0a0a" stroke="#ddd" strokeWidth={6} />
      <rect x={hole[0] - 4} y={hole[1] - 10} width={14} height={20} fill="#fff" />
      <g opacity={k}>
        <polygon points={`${tree[0] + 40},${tree[1] - 190} ${hole[0]},${hole[1]} ${wall},${hole[1] + 260}`} fill="#fff" opacity={0.08} />
        <polygon points={`${tree[0] + 40},${tree[1] + 90} ${hole[0]},${hole[1]} ${wall},${hole[1] - 180}`} fill="#fff" opacity={0.08} />
        <line x1={tree[0] + 40} y1={tree[1] - 190} x2={wall} y2={hole[1] + 260} stroke="#fff" strokeWidth={3} strokeDasharray="12 10" />
        <line x1={tree[0] + 40} y1={tree[1] + 90} x2={wall} y2={hole[1] - 180} stroke="#fff" strokeWidth={3} strokeDasharray="12 10" />
        <g transform={`translate(${wall - 40} ${hole[1] + 40}) rotate(180)`} filter="url(#glow)">{treeShape(0, 0, 1.3)}</g>
      </g>
      <Figure x={s.cx + 140} ground={s.bottom - 80} s={0.55} pose={STAND} headDown={-10} />
    </Frame>
  );
}

// A cannon fires: the fuse burns, the flash, the recoil, the smoke.
export function Cannon({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.45;
  const fired = f >= at;
  const age = f - at;
  const recoil = fired ? Math.exp(-age / 6) * 80 : 0;
  const mouth: Pt = [s.cx + 260 - recoil, gy - 300];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`translate(${-recoil} 0)`}>
        <g transform={`rotate(-12 ${s.cx - 160} ${gy - 220})`}>
          <path d={`M ${s.cx - 280} ${gy - 290} H ${s.cx + 270} V ${gy - 210} H ${s.cx - 280} Q ${s.cx - 330} ${gy - 250} ${s.cx - 280} ${gy - 290} Z`} fill="#262626" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
          {[-200, 0, 200].map((d) => <rect key={d} x={s.cx + d - 10} y={gy - 296} width={20} height={92} fill="#555" />)}
        </g>
        <circle cx={s.cx - 100} cy={gy - 110} r={110} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
        {[0, 45, 90, 135].map((a) => <line key={a} x1={s.cx - 100 - Math.cos(a * D) * 110} y1={gy - 110 - Math.sin(a * D) * 110} x2={s.cx - 100 + Math.cos(a * D) * 110} y2={gy - 110 + Math.sin(a * D) * 110} stroke="#666" strokeWidth={5} />)}
      </g>
      {!fired && <circle cx={s.cx - 270} cy={gy - 330} r={10 + 4 * Math.sin(f * 2)} fill="#fff" filter="url(#glow)" />}
      {fired && age < 6 && <circle cx={mouth[0] + 60} cy={mouth[1]} r={60 + age * 30} fill="#fff" filter="url(#glow)" />}
      {fired && Array.from({ length: 6 }, (_, i) => {
        const u = Math.min(1, age / 40);
        return <circle key={i} cx={mouth[0] + 60 + u * (100 + i * 60)} cy={mouth[1] - u * (40 + i * 30)} r={40 + u * 80 - i * 4} fill="#777" opacity={0.6 * (1 - u * 0.7)} />;
      })}
    </Frame>
  );
}

// A siege tower is rolled up to the wall and its ramp drops onto the battlements.
export function SiegeTower({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const roll = k01(f, 0, dur * 0.65);
  const ramp = k01(f, dur * 0.65, dur * 0.8, { ...clamp, easing: Easing.out(Easing.bounce) });
  const wallX = s.right - 160;
  const x = interpolate(roll, [0, 1], [s.left - 60, wallX - 330]);
  const h = 760;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={wallX} y={gy - 600} width={260} height={600} fill="#262626" stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: 3 }, (_, i) => <rect key={i} x={wallX + i * 90} y={gy - 640} width={50} height={40} fill="#262626" stroke="#ddd" strokeWidth={4} />)}
      <rect x={x} y={gy - h} width={300} height={h - 60} fill="#1f1f1f" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={x} y1={gy - h + i * 120} x2={x + 300} y2={gy - h + i * 120 + 120} stroke="#555" strokeWidth={4} />)}
      {[x + 60, x + 240].map((cx) => (
        <g key={cx} transform={`rotate(${roll * 400} ${cx} ${gy - 50})`}>
          <circle cx={cx} cy={gy - 50} r={50} fill="#1a1a1a" stroke="#ddd" strokeWidth={6} />
          <line x1={cx - 50} y1={gy - 50} x2={cx + 50} y2={gy - 50} stroke="#888" strokeWidth={5} />
        </g>
      ))}
      <g transform={`rotate(${-90 + 90 * ramp} ${x + 300} ${gy - 620})`}>
        <rect x={x + 300} y={gy - 640} width={190} height={22} fill="#999" stroke="#ddd" strokeWidth={3} />
      </g>
      {roll < 1 && [0, 1].map((i) => <Figure key={i} x={x - 70 - i * 100} ground={gy} s={0.45} pose={{ ...walk(f * 0.15 + i, 0.5), t: 30, ls: 80, le: 90, rs: 80, re: 90 }} color={i ? "#888" : "#ececec"} glow={!i} />)}
    </Frame>
  );
}

// A battering ram swings against the gate again and again until it cracks.
export function BatteringRam({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.7;
  const swing = Math.sin(((f % 30) / 30) * Math.PI * 2);
  const ramX = s.cx - 220 + swing * 60;
  const gateX = s.cx + 260;
  const cracked = f >= at;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={gateX} y={s.top + 120} width={300} height={gy - s.top - 120} fill="#262626" stroke="#ddd" strokeWidth={5} />
      <rect x={gateX + 40} y={gy - 420} width={200} height={420} fill="#3a3a3a" stroke="#fff" strokeWidth={6} transform={cracked ? `rotate(${Math.min(20, (f - at) * 2)} ${gateX + 240} ${gy})` : undefined} />
      {Array.from({ length: 4 }, (_, i) => <line key={i} x1={gateX + 40} y1={gy - 380 + i * 100} x2={gateX + 240} y2={gy - 380 + i * 100} stroke="#777" strokeWidth={6} />)}
      {f > at * 0.4 && <path d={`M ${gateX + 50} ${gy - 220} l 40 -30 l 20 40 l 40 -50 ${cracked ? "l 30 60 l 20 -40" : ""}`} fill="none" stroke="#fff" strokeWidth={5} />}
      <path d={`M ${s.left} ${gy} L ${s.cx - 120} ${gy - 360} L ${s.cx + 120} ${gy - 360} L ${s.cx + 200} ${gy}`} fill="#141414" stroke="#ccc" strokeWidth={6} />
      {[-160, 40].map((d) => <line key={d} x1={s.cx + d} y1={gy - 360} x2={ramX + 200 + d * 0.3} y2={gy - 200} stroke="#999" strokeWidth={4} />)}
      <rect x={ramX} y={gy - 230} width={480} height={60} rx={30} fill="#888" stroke="#fff" strokeWidth={5} />
      <path d={`M ${ramX + 480} ${gy - 240} h 40 v 80 h -40 Z`} fill="#ddd" />
      {swing > 0.95 && <circle cx={gateX + 40} cy={gy - 200} r={60} fill="none" stroke="#fff" strokeWidth={6} opacity={0.7} />}
    </Frame>
  );
}

// A longship: the dragon prow, a row of shields, one big square sail, oars pulling together.
export function Longship({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 160;
  const bob = Math.sin(f / 12) * 12;
  const stroke = Math.sin(f / 8);
  return (
    <Frame p={p} t={t}>
      <g transform={`translate(0 ${bob}) rotate(${Math.sin(f / 14) * 2} ${s.cx} ${sea})`}>
        <line x1={s.cx} y1={sea - 60} x2={s.cx} y2={sea - 560} stroke="#ccc" strokeWidth={12} />
        <rect x={s.cx - 220} y={sea - 540} width={440} height={340} fill="#e6e6e6" opacity={0.9} />
        {[0, 1, 2].map((i) => <rect key={i} x={s.cx - 220} y={sea - 540 + i * 113} width={440} height={56} fill="#999" opacity={0.6} />)}
        <path d={`M ${s.left - 40} ${sea - 160} Q ${s.left} ${sea + 40} ${s.cx} ${sea + 40} Q ${s.right} ${sea + 40} ${s.right + 40} ${sea - 160} L ${s.right - 40} ${sea - 60} H ${s.left + 40} Z`} fill="#262626" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        <path d={`M ${s.right + 40} ${sea - 160} q 30 -40 0 -70 q -30 10 -20 40`} fill="none" stroke="#fff" strokeWidth={8} />
        {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={s.left + 110 + i * 105} cy={sea - 70} r={34} fill={i % 2 ? "#999" : "#555"} stroke="#ddd" strokeWidth={4} />)}
        {Array.from({ length: 7 }, (_, i) => {
          const x = s.left + 160 + i * 105;
          const a = 60 + stroke * 25;
          return <line key={`o${i}`} x1={x} y1={sea - 20} x2={x - Math.cos(a * D) * 220} y2={sea - 20 + Math.sin(a * D) * 220} stroke="#ddd" strokeWidth={6} />;
        })}
      </g>
      <rect x={0} y={sea + 60} width={W} height={600} fill="#000" opacity={0.35} />
      {[0, 1, 2].map((i) => <path key={i} d={wave(sea + 60 + i * 60, 14 - i * 3, 140, f * (6 - i))} fill="none" stroke="#fff" strokeOpacity={0.5 - i * 0.12} strokeWidth={5} />)}
    </Frame>
  );
}

// A camel caravan crosses the dunes along a trade route.
export function Caravan({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 160;
  const camel = (x: number, sc: number, ph: number, key: number) => {
    const step = Math.sin(f / 6 + ph) * 12;
    return (
      <g key={key} transform={`translate(${x} ${gy}) scale(${sc})`}>
        {[-70, -40, 50, 80].map((lx, i) => <line key={i} x1={lx} y1={-170} x2={lx + (i % 2 ? step : -step)} y2={0} stroke="#ccc" strokeWidth={14} strokeLinecap="round" />)}
        <path d="M -110 -170 Q -100 -260 -40 -250 Q -10 -320 30 -250 Q 80 -260 110 -190 L 150 -260 Q 170 -300 210 -290 L 220 -270 L 180 -260 L 130 -170 Z" fill="#262626" stroke="#fff" strokeWidth={6} />
        <rect x={-60} y={-300} width={110} height={50} rx={10} fill="#555" stroke="#ccc" strokeWidth={4} />
      </g>
    );
  };
  return (
    <Frame p={p} t={t}>
      <circle cx={s.right - 140} cy={s.top + 160} r={90} fill="#fff" opacity={0.7} />
      <path d={`M -100 ${gy - 260} Q 300 ${gy - 440} 700 ${gy - 280} T ${W + 300} ${gy - 300} V ${gy} H -100 Z`} fill="#141414" stroke="#777" strokeWidth={4} />
      <path d={`M -100 ${gy} Q 500 ${gy - 60} ${W + 100} ${gy} V ${H} H -100 Z`} fill="#1c1c1c" stroke="#fff" strokeWidth={5} />
      {[0, 1, 2].map((i) => camel(((s.left + 100 + i * 300 + f * 2) % (W + 400)) - 100, 0.9 - i * 0.12, i * 2, i))}
      <Figure x={((s.left + 380 + f * 2) % (W + 400)) - 100} ground={gy} s={0.45} pose={walk(f * 0.15)} />
      {Array.from({ length: 10 }, (_, i) => <ellipse key={i} cx={((i * 120 - f * 2) % W + W) % W} cy={gy + 30} rx={20} ry={6} fill="#000" opacity={0.4} />)}
    </Frame>
  );
}

// The Nazca lines: from above, one figure's rope-and-stake lines turn out to be a giant bird.
export function Nazca({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur * 0.85, clamp);
  // Starts close on the walker at ground level, pulls up and out until the whole bird is visible.
  const zoom = 2.2 - 1.2 * k01(f, dur * 0.4, dur * 0.9);
  const bird = "M 540 560 L 540 760 L 300 700 L 420 820 L 260 900 L 520 880 L 540 1200 L 500 1400 L 580 1400 L 560 1200 L 580 880 L 840 900 L 680 820 L 800 700 L 560 760 Z";
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top} width={W} height={s.height} fill="#1a1a1a" />
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 137) % W} cy={s.top + ((i * 211) % s.height)} r={3} fill="#333" />)}
      <g transform={`translate(${s.cx} ${s.cy}) scale(${zoom}) translate(${-s.cx} ${-s.cy})`}>
        <path d={bird} fill="none" stroke="#e6e6e6" strokeWidth={12} strokeLinejoin="round" pathLength={100} strokeDasharray={`${k * 100} 100`} filter="url(#glow)" />
        {(() => {
          const L2 = 100 * k;
          const i = Math.floor((L2 / 100) * 15);
          const pts = bird.replace(/[MLZ]/g, "").trim().split(/\s+/).map(Number);
          const xy: Pt = [pts[(i * 2) % pts.length], pts[(i * 2 + 1) % pts.length]];
          return k < 1 ? <Figure x={xy[0]} ground={xy[1]} s={0.18} pose={walk(f * 0.3)} /> : null;
        })()}
      </g>
    </Frame>
  );
}

// The Rosetta Stone: one decree in hieroglyphs, Demotic and Greek. The name Ptolemy, in its cartouche above and as
// ΠΤΟΛΕΜΑΙΟΥ in the Greek below, lights up and links: the match that started the decipherment. Demotic has no
// Unicode script, so its band is drawn as cursive strokes.
const ROSETTA_GREEK = ["ΒΑΣΙΛΕΥΟΝΤΟΣ ΤΟΥ ΝΕΟΥ ΚΑΙ", "ΠΑΡΑΛΑΒΟΝΤΟΣ ΤΗΝ ΒΑΣΙΛΕΙΑΝ", "ΠΑΡΑ ΤΟΥ ΠΑΤΡΟΣ", "ΠΤΟΛΕΜΑΙΟΥ ΑΙΩΝΟΒΙΟΥ"];
export function Rosetta({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const st = { x: s.cx - 340, y: s.top + 100, w: 680, h: s.height - 160 };
  const bh = st.h / 3;
  const link = k01(f, dur * 0.35, dur * 0.6, clamp);
  const lit = link > 0;
  const cart: Pt = [s.cx, st.y + 120];
  const greekY = st.y + 2 * bh + 70 + 3 * 62;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${st.x + 60} ${st.y} L ${st.x + st.w - 120} ${st.y + 30} L ${st.x + st.w} ${st.y + 160} V ${st.y + st.h} H ${st.x} V ${st.y + 120} Z`} fill="#262626" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
      {[1, 2].map((b) => <line key={b} x1={st.x + 20} y1={st.y + b * bh} x2={st.x + st.w - 20} y2={st.y + b * bh} stroke="#555" strokeWidth={4} />)}
      <text x={s.cx} y={st.y + 70} fontSize={56} fontFamily={font.hiero} textAnchor="middle" fill="#888">{"𓇳𓏏𓊹𓋹𓂋"}</text>
      <rect x={cart[0] - 230} y={cart[1] - 6} width={460} height={84} rx={42} fill="none" stroke={lit ? "#fff" : "#888"} strokeWidth={lit ? 6 : 4} filter={lit ? "url(#glow)" : undefined} />
      <text x={cart[0]} y={cart[1] + 62} fontSize={58} fontFamily={font.hiero} textAnchor="middle" fill={lit ? "#fff" : "#888"}>{"𓊪𓏏𓍯𓃭𓐝𓇌𓋴"}</text>
      <text x={s.cx} y={st.y + 225} fontSize={56} fontFamily={font.hiero} textAnchor="middle" fill="#888">{"𓄤𓈖𓂝𓆑𓇋"}</text>
      {Array.from({ length: 4 }, (_, r) => <path key={r} d={`M ${st.x + 60} ${st.y + bh + 60 + r * 62} ${Array.from({ length: 9 }, (_, j) => `q ${18 + (j % 3) * 4} ${j % 2 ? -22 : 18} ${36 + ((j * 7) % 10)} ${((j * 5) % 7) - 3}`).join(" ")}`} fill="none" stroke="#888" strokeWidth={4} />)}
      {ROSETTA_GREEK.map((line, r) => {
        const name = r === 3;
        return (
          <text key={r} x={st.x + 50} y={st.y + 2 * bh + 70 + r * 62} fontSize={33} fontFamily={font.greek} fontWeight={700} fill={name && lit ? "#fff" : "#888"} filter={name && lit ? "url(#glow)" : undefined}>
            {line}
          </text>
        );
      })}
      {lit && <path d={`M ${cart[0] - 230} ${cart[1] + 40} C ${st.x - 120} ${cart[1] + 200}, ${st.x - 120} ${greekY - 120}, ${st.x + 40} ${greekY - 12}`} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="12 10" pathLength={100} strokeDashoffset={100 - link * 100} />}
      {[["HIEROGLYPHS", 0], ["DEMOTIC", 1], ["GREEK", 2]].map(([n, b]) => <text key={n as string} x={st.x + st.w - 30} y={st.y + (b as number) * bh + bh - 20} fontSize={26} fontFamily={font.impact} textAnchor="end" fill="#666" letterSpacing={3}>{n}</text>)}
    </Frame>
  );
}

// Rows and rows of clay soldiers stretch into the distance; one is lit.
export function Terracotta({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const hz = s.top + 200;
  const rows = 6;
  const pan = k01(f, 0, dur, clamp) * 60;
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={hz} x2={W} y2={hz} stroke="#444" strokeWidth={3} />
      {Array.from({ length: rows }, (_, r) => {
        const z = (rows - r) / rows;
        const y = hz + 120 + (1 - z) * 0 + (s.bottom - hz - 120) * (1 - z * z) * 0.95;
        const sc = 0.2 + 0.6 * (1 - z * 0.8);
        const n = Math.floor(W / (220 * sc)) + 2;
        return Array.from({ length: n }, (_, c) => {
          const x = c * 220 * sc - pan * sc - (r % 2) * 110 * sc;
          const lit = r === rows - 1 && c === Math.floor(n / 2);
          return <Figure key={`${r}-${c}`} x={x} ground={y} s={sc} front pose={{ ...STAND, ls: -10, le: 60, rs: 10, re: -60 }} color={lit ? "#ececec" : r > 3 ? "#6a6a6a" : "#4a4a4a"} glow={lit} />;
        });
      })}
    </Frame>
  );
}

// A mummy is wrapped: linen winds round and round from the feet up.
export function Mummy({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur * 0.85, clamp);
  const top = s.top + 160, bot = s.bottom - 120;
  const wrapY = bot - (bot - top) * k;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx} ${top} Q ${s.cx + 170} ${top} ${s.cx + 150} ${top + 260} Q ${s.cx + 200} ${top + 450} ${s.cx + 110} ${bot} H ${s.cx - 110} Q ${s.cx - 200} ${top + 450} ${s.cx - 150} ${top + 260} Q ${s.cx - 170} ${top} ${s.cx} ${top} Z`} fill="#3a3a3a" stroke="#888" strokeWidth={5} />
      <defs><clipPath id="body"><path d={`M ${s.cx} ${top} Q ${s.cx + 170} ${top} ${s.cx + 150} ${top + 260} Q ${s.cx + 200} ${top + 450} ${s.cx + 110} ${bot} H ${s.cx - 110} Q ${s.cx - 200} ${top + 450} ${s.cx - 150} ${top + 260} Q ${s.cx - 170} ${top} ${s.cx} ${top} Z`} /></clipPath></defs>
      <g clipPath="url(#body)">
        {Array.from({ length: Math.ceil((bot - wrapY) / 34) + 1 }, (_, i) => <path key={i} d={`M ${s.cx - 260} ${bot - i * 34 + 20} L ${s.cx + 260} ${bot - i * 34 - 20}`} stroke={i % 2 ? "#e6e6e6" : "#cfcfcf"} strokeWidth={30} />)}
      </g>
      <path d={`M ${s.cx + 220} ${wrapY - 10} Q ${s.cx + 340} ${wrapY - 60} ${s.right - 40} ${wrapY - 160}`} fill="none" stroke="#e6e6e6" strokeWidth={26} opacity={k < 1 ? 1 : 0} filter="url(#glow)" />
      <ellipse cx={s.right - 40} cy={wrapY - 180} rx={40} ry={60} fill="#cfcfcf" stroke="#fff" strokeWidth={4} opacity={k < 1 ? 1 : 0} transform={`rotate(${f * 10} ${s.right - 40} ${wrapY - 180})`} />
    </Frame>
  );
}

// A diver's light sweeps the seabed and finds a shipwreck.
export function Shipwreck({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const bed = s.bottom - 80;
  const sweep = Math.sin(k01(f, 0, dur, clamp) * Math.PI * 0.9) * 50 - 20;
  const diver: Pt = [s.left + 120, s.top + 260 + Math.sin(f / 20) * 20];
  const lit = k01(f, dur * 0.4, dur * 0.6);
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top} width={W} height={s.height} fill="#fff" opacity={0.02} />
      <path d={`M 0 ${bed} Q ${s.cx} ${bed - 40} ${W} ${bed} V ${H} H 0 Z`} fill="#141414" stroke="#555" strokeWidth={4} />
      <g opacity={0.3 + 0.7 * lit}>
        <path d={`M ${s.cx - 340} ${bed - 20} Q ${s.cx - 300} ${bed - 220} ${s.cx - 100} ${bed - 240} L ${s.cx + 300} ${bed - 160} L ${s.cx + 340} ${bed - 20} Z`} fill="#262626" stroke="#fff" strokeWidth={6} transform={`rotate(-8 ${s.cx} ${bed})`} />
        <line x1={s.cx - 40} y1={bed - 230} x2={s.cx + 60} y2={bed - 560} stroke="#bbb" strokeWidth={14} />
        <line x1={s.cx + 10} y1={bed - 420} x2={s.cx + 180} y2={bed - 380} stroke="#bbb" strokeWidth={8} />
        {[0, 1, 2].map((i) => <circle key={i} cx={s.cx - 200 + i * 140} cy={bed - 140} r={20} fill="#000" stroke="#888" strokeWidth={4} />)}
      </g>
      <polygon points={`${diver[0] + 40},${diver[1]} ${diver[0] + 900 * Math.cos((sweep + 30) * D)},${diver[1] + 900 * Math.sin((sweep + 30) * D)} ${diver[0] + 900 * Math.cos((sweep + 50) * D)},${diver[1] + 900 * Math.sin((sweep + 50) * D)}`} fill="#fff" opacity={0.12} />
      <g transform={`rotate(70 ${diver[0]} ${diver[1]})`}>
        <Figure x={diver[0]} y={diver[1]} s={0.5} pose={{ ...STAND, ls: -60, le: -40, rs: 80, re: 80, lh: -10 + Math.sin(f / 4) * 15, rh: 10 - Math.sin(f / 4) * 15 }} />
      </g>
      {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={diver[0] + 20 + Math.sin(i + f / 10) * 10} cy={diver[1] - 60 - cyc(f, 40, i * 5) * 300} r={5 + (i % 3) * 3} fill="none" stroke="#fff" strokeWidth={2} opacity={1 - cyc(f, 40, i * 5)} />)}
    </Frame>
  );
}

// Torchlight moves along a cave wall and finds painted animals and handprints.
export function CavePaint({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const tx = interpolate(f, [0, dur], [s.left + 60, s.right - 60]);
  const ty = s.cy + 80;
  const hand = (x: number, y: number, key: number) => (
    <g key={key} transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={20} rx={40} ry={50} fill="#ccc" />
      {[-36, -16, 4, 24].map((dx, i) => <rect key={i} x={dx} y={-60 + Math.abs(i - 1.5) * 10} width={16} height={60} rx={8} fill="#ccc" />)}
      <rect x={30} y={0} width={16} height={46} rx={8} fill="#ccc" transform="rotate(-40 38 20)" />
    </g>
  );
  return (
    <Frame p={p} t={t}>
      <defs>
        <radialGradient id="torchlight">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id="lit"><rect x={0} y={0} width={W} height={H} fill="#000" /><circle cx={tx} cy={ty - 150} r={380 + 20 * Math.sin(f / 3)} fill="url(#torchlight)" /></mask>
      </defs>
      <path d={`M 0 ${s.top + 80} Q ${s.cx} ${s.top - 40} ${W} ${s.top + 120} V ${s.bottom} H 0 Z`} fill="#141414" />
      <g mask="url(#lit)">
        <rect x={0} y={s.top} width={W} height={s.height} fill="#2a2a2a" />
        <path d={`M 180 ${s.cy - 200} q 60 -80 160 -40 q 80 -20 120 40 l 20 60 l -30 0 l -10 -40 l -40 20 l 0 60 l -30 0 l -10 -60 l -100 0 l -10 60 l -30 0 l 0 -60 q -40 -10 -20 -40 Z`} fill="#bbb" />
        <path d={`M 620 ${s.cy - 120} q 40 -60 120 -40 q 40 -40 60 0 q 30 10 20 40 l -10 80 l -24 0 l 0 -50 l -110 0 l -10 50 l -24 0 Z`} fill="#999" />
        {hand(300, s.cy + 180, 1)}
        {hand(780, s.cy + 260, 2)}
        {hand(520, s.cy + 320, 3)}
      </g>
      <g filter="url(#glow)">
        <path d={`M ${tx - 20} ${ty} Q ${tx - 24} ${ty - 60} ${tx + Math.sin(f / 3) * 8} ${ty - 100} Q ${tx + 24} ${ty - 60} ${tx + 20} ${ty} Z`} fill="#fff" />
      </g>
      <rect x={tx - 10} y={ty} width={20} height={140} fill="#888" />
      <Figure x={tx - 120} ground={s.bottom - 40} s={0.6} pose={{ ...STAND, rs: 100, re: 70 }} />
    </Frame>
  );
}

// Tree rings: a cross-section of a trunk; a marker counts the rings outward, one per year.
export function TreeRings({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy - 40];
  const n = 16;
  const k = Math.floor(k01(f, 0, dur * 0.85, clamp) * n);
  const rOf = (i: number) => 30 + i * 22 + ((i * 7) % 5) * 3;
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.bottom - 200, textAlign: "center", font: `400 100px ${font.impact}`, color: "#fff" }}>{k} YEARS</div>}>
      <circle cx={c[0]} cy={c[1]} r={rOf(n) + 30} fill="#3a3a3a" stroke="#888" strokeWidth={14} />
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={c[0]} cy={c[1]} r={rOf(i)} fill="none" stroke={i < k ? "#fff" : "#666"} strokeWidth={i % 5 === 4 ? 6 : 3} filter={i === k - 1 ? "url(#glow)" : undefined} />)}
      <line x1={c[0]} y1={c[1]} x2={c[0] + rOf(n) + 40} y2={c[1]} stroke="#fff" strokeWidth={3} strokeDasharray="10 8" />
      <circle cx={c[0] + rOf(Math.max(0, k - 1))} cy={c[1]} r={14} fill="#fff" filter="url(#glow)" />
      <path d={`M ${c[0] + rOf(6)} ${c[1] - 60} l 30 30 l -20 10 l 30 40`} fill="none" stroke="#000" strokeWidth={6} opacity={0.6} />
    </Frame>
  );
}

// Radiocarbon dating: a sample's carbon-14 halves again and again; counting the halvings gives its age.
export function HalfLife({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const steps = 4;
  const k = k01(f, 0, dur * 0.85, clamp) * steps;
  const amount = 0.5 ** k;
  const grid = 10;
  const total = grid * grid;
  const left = Math.round(total * amount);
  const g0: Pt = [s.cx - 300, s.top + 160];
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.bottom - 230, textAlign: "center" }}><div style={{ font: `400 110px/1 ${font.impact}`, color: "#fff" }}>{Math.round(amount * 100)}% LEFT</div><div style={{ font: `700 40px ${font.display}`, color: "#999", letterSpacing: 4 }}>HALF-LIFE × {Math.floor(k)}</div></div>}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < left;
        return <circle key={i} cx={g0[0] + (i % grid) * 66 + 3} cy={g0[1] + Math.floor(i / grid) * 66} r={22} fill={on ? "#fff" : "#1f1f1f"} stroke={on ? "#fff" : "#444"} strokeWidth={3} opacity={on ? 1 : 0.6} />;
      })}
    </Frame>
  );
}

// LiDAR: a laser scan line sweeps over thick forest and the hidden ruins beneath it appear.
export function Lidar({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const scan = interpolate(f, [0, dur * 0.85], [s.top, s.bottom], clamp);
  const plane: Pt = [interpolate(f, [0, dur], [s.left, s.right]), s.top + 40];
  return (
    <Frame p={p} t={t}>
      <defs><clipPath id="scanned"><rect x={0} y={s.top} width={W} height={scan - s.top} /></clipPath></defs>
      {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={s.top + 60 + ((i * 151) % (s.height - 60))} r={50 + (i % 4) * 14} fill="#2a2a2a" stroke="#3a3a3a" strokeWidth={3} />)}
      <g clipPath="url(#scanned)">
        <rect x={0} y={s.top} width={W} height={s.height} fill="#0a0a0a" />
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={wave(s.top + 40 + i * 65, 10, 140, i * 30)} fill="none" stroke="#333" strokeWidth={3} />)}
        <g stroke="#fff" strokeWidth={6} fill="none" filter="url(#glow)">
          <path d={`M ${s.cx - 160} ${s.cy + 200} L ${s.cx} ${s.cy - 40} L ${s.cx + 160} ${s.cy + 200} Z`} />
          <path d={`M ${s.cx - 100} ${s.cy + 110} H ${s.cx + 100}`} />
          <rect x={s.left + 40} y={s.top + 180} width={200} height={140} />
          <rect x={s.right - 240} y={s.cy + 260} width={180} height={180} />
          <path d={`M ${s.left + 140} ${s.top + 320} L ${s.cx - 100} ${s.cy + 200} M ${s.cx + 160} ${s.cy + 200} L ${s.right - 150} ${s.cy + 260} M ${s.cx} ${s.cy - 40} V ${s.top + 120}`} strokeDasharray="16 12" />
        </g>
      </g>
      <line x1={0} y1={scan} x2={W} y2={scan} stroke="#fff" strokeWidth={4} filter="url(#glow)" />
      <polygon points={`${plane[0]},${plane[1]} ${plane[0] - 300},${scan} ${plane[0] + 300},${scan}`} fill="#fff" opacity={0.05} />
      <path d={`M ${plane[0] - 60} ${plane[1]} h 120 l 20 -10 h -160 Z M ${plane[0] - 20} ${plane[1] - 10} l -40 -40 h 30 l 50 40`} fill="#ccc" />
    </Frame>
  );
}
