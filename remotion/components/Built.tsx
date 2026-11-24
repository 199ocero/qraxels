import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { type VisualProps } from "./common.tsx";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pose, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// More "built" series pictures: building methods, megastructures, and water and climate engineering.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const wave = (y: number, amp: number, len: number, off: number) =>
  `M ${-len * 2 - (off % (len * 2))} ${y} ${Array.from({ length: Math.ceil(W / len) + 4 }, (_, i) => `q ${len / 2} ${i % 2 ? amp : -amp} ${len} 0`).join(" ")}`;
const haul: Pose = { ...STAND, t: 30, ls: 70, le: 80, rs: 80, re: 90 };

// Inca masonry: irregular stones lower into place one by one and fit with no gaps and no mortar.
export function Masonry({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  // Polygons sharing their edges exactly, so the finished wall has no gaps.
  const pts: Pt[][] = [
    [[90, 0], [330, 0], [350, 200], [70, 230]],
    [[330, 0], [620, 0], [600, 170], [350, 200]],
    [[620, 0], [990, 0], [990, 250], [600, 170]],
    [[70, 230], [350, 200], [380, 430], [90, 470]],
    [[350, 200], [600, 170], [640, 420], [380, 430]],
    [[600, 170], [990, 250], [990, 460], [640, 420]],
    [[90, 470], [380, 430], [420, 640], [90, 640]],
    [[380, 430], [640, 420], [700, 640], [420, 640]],
    [[640, 420], [990, 460], [990, 640], [700, 640]],
  ];
  const n = pts.length;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {pts.map((poly, k) => {
        const u = k01(f, tickAt(k, n, dur) - 10, tickAt(k, n, dur), { ...clamp, easing: Easing.out(Easing.cubic) });
        if (u <= 0) return null;
        const q = pts[n - 1 - k]; // bottom row first
        const d = `M ${q.map(([x, y]) => `${x + 45} ${gy - 640 + y - (1 - u) * 300}`).join(" L ")} Z`;
        return <path key={k} d={d} fill={k === n - 1 && u >= 1 ? "#3a3a3a" : "#262626"} stroke="#ddd" strokeWidth={5} strokeLinejoin="round" />;
      })}
      <Figure x={s.right - 40} ground={gy} s={0.4} flip pose={STAND} headDown={-10} />
    </Frame>
  );
}

// Roman concrete: lime and volcanic ash are mixed, poured into wooden formwork, and the boards come off a solid wall.
export function Concrete({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const fill = k01(f, dur * 0.1, dur * 0.65, clamp);
  const strip = k01(f, dur * 0.7, dur * 0.9);
  const form = { x: s.cx - 120, w: 340, h: 640 };
  const lvl = gy - form.h * fill;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={form.x} y={lvl} width={form.w} height={gy - lvl} fill="#555" />
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={form.x + 20 + ((i * 53) % (form.w - 40))} cy={gy - 20 - ((i * 97) % Math.max(1, gy - lvl - 20))} r={6 + (i % 3) * 4} fill="#888" opacity={gy - lvl > 40 ? 1 : 0} />)}
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${d * strip * 160} ${strip * 40}) rotate(${d * strip * 10} ${d < 0 ? form.x : form.x + form.w} ${gy})`} opacity={1 - strip}>
          {Array.from({ length: 8 }, (_, i) => <rect key={i} x={d < 0 ? form.x - 30 : form.x + form.w} y={gy - (i + 1) * 80} width={30} height={76} fill="#8a8a8a" stroke="#ccc" strokeWidth={3} />)}
        </g>
      ))}
      <path d={`M ${form.x + form.w / 2} ${s.top + 140} V ${lvl}`} stroke="#999" strokeWidth={fill < 1 ? 30 : 0} />
      <path d={`M ${s.left + 20} ${s.top + 300} h 200 l -40 120 h -120 Z`} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {big("LIME", s.left + 120, s.top + 380, 36, "#bbb")}
      <path d={`M ${s.right - 220} ${s.top + 300} h 200 l -40 120 h -120 Z`} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {big("ASH", s.right - 120, s.top + 380, 36, "#bbb")}
      {strip >= 1 && <rect x={form.x} y={lvl} width={form.w} height={gy - lvl} fill="none" stroke="#fff" strokeWidth={6} filter="url(#glow)" />}
    </Frame>
  );
}

// A flying buttress: the vault pushes the tall wall outward, the arched buttress pushes it back in.
export function Buttress({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const wall = s.cx - 140;
  const k = k01(f, dur * 0.2, dur * 0.5);
  const push = Math.sin(f / 8) * 6 * (1 - k);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`rotate(${push * 0.3} ${wall} ${gy})`}>
        <rect x={wall - 40} y={s.top + 200} width={80} height={gy - s.top - 200} fill="#262626" stroke="#ddd" strokeWidth={5} />
        <path d={`M ${wall - 40} ${s.top + 260} Q ${s.left - 60} ${s.top + 200} ${s.left - 120} ${s.top + 460}`} fill="none" stroke="#999" strokeWidth={16} />
        {Array.from({ length: 4 }, (_, i) => <rect key={i} x={wall - 24} y={s.top + 300 + i * 200} width={48} height={120} rx={24} fill="#000" stroke="#777" strokeWidth={3} />)}
      </g>
      <rect x={s.right - 160} y={s.top + 420} width={120} height={gy - s.top - 420} fill="#262626" stroke="#ddd" strokeWidth={5} />
      <path d={`M ${wall + 40} ${s.top + 300} Q ${s.right - 260} ${s.top + 320} ${s.right - 160} ${s.top + 560} L ${s.right - 160} ${s.top + 620} Q ${s.right - 280} ${s.top + 400} ${wall + 40} ${s.top + 380} Z`} fill="#3a3a3a" stroke="#fff" strokeWidth={6} opacity={k} filter="url(#glow)" />
      <path d={`M ${wall - 120} ${s.top + 330} l 60 0 l -14 -14 m 14 14 l -14 14`} stroke="#fff" strokeWidth={6} fill="none" opacity={0.6 * (1 - k)} />
      <path d={`M ${wall + 140} ${s.top + 340} l -60 0 l 14 -14 m -14 14 l 14 14`} stroke="#fff" strokeWidth={6} fill="none" opacity={k} />
      <path d={`M ${s.right - 160} ${s.top + 420} l 60 -100 l 60 100 Z`} fill="#3a3a3a" stroke="#ddd" strokeWidth={5} />
    </Frame>
  );
}

// A castle: walls and towers rise around the keep, then the drawbridge drops over the moat.
export function Castle({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const k = k01(f, 0, dur * 0.65, clamp);
  const bridge = k01(f, dur * 0.7, dur * 0.85, { ...clamp, easing: Easing.out(Easing.bounce) });
  const crenel = (x: number, y: number, w: number) => Array.from({ length: Math.floor(w / 40) }, (_, i) => (i % 2 ? null : <rect key={i} x={x + i * 40} y={y - 30} width={40} height={30} fill="#262626" stroke="#ddd" strokeWidth={3} />));
  const part = (x: number, w: number, h: number, i: number) => {
    const u = Math.max(0, Math.min(1, k * 4 - i));
    const hh = h * u;
    return (
      <g key={i}>
        <rect x={x} y={gy - hh} width={w} height={hh} fill="#262626" stroke="#ddd" strokeWidth={5} />
        {u >= 1 && crenel(x, gy - h, w)}
      </g>
    );
  };
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={gy} width={W} height={120} fill="#fff" opacity={0.1} />
      <path d={wave(gy + 40, 8, 90, f * 2)} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={4} />
      {part(s.cx - 140, 280, 640, 3)}
      {part(s.left, s.width, 360, 0)}
      {part(s.left - 20, 160, 520, 1)}
      {part(s.right - 140, 160, 520, 2)}
      <path d={`M ${s.cx - 90} ${gy} V ${gy - 160} A 90 90 0 0 1 ${s.cx + 90} ${gy - 160} V ${gy} Z`} fill="#000" stroke="#ddd" strokeWidth={5} />
      <g transform={`rotate(${-90 + 90 * bridge} ${s.cx} ${gy})`}>
        <rect x={s.cx - 90} y={gy - 4} width={180} height={250} fill="#555" stroke="#ccc" strokeWidth={4} transform={`rotate(180 ${s.cx} ${gy})`} />
      </g>
      {bridge > 0 && [-1, 1].map((d) => <line key={d} x1={s.cx + d * 90} y1={gy - 220} x2={s.cx + d * 90} y2={gy + 250 * Math.sin(bridge * Math.PI / 2) * 0 + 10} stroke="#999" strokeWidth={4} />)}
    </Frame>
  );
}

// Petra: the facade is carved straight out of the cliff, from the top down.
export function Petra({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur * 0.85, clamp);
  const top = s.top + 140, cut = top + (gy - top) * k;
  const x0 = s.cx - 300, x1 = s.cx + 300;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top} width={W} height={gy - s.top} fill="#2a2a2a" />
      {Array.from({ length: 14 }, (_, i) => <path key={i} d={wave(s.top + 60 + i * 70, 6, 120, i * 40)} fill="none" stroke="#3a3a3a" strokeWidth={4} />)}
      <defs><clipPath id="carved"><rect x={0} y={0} width={W} height={cut} /></clipPath></defs>
      <g clipPath="url(#carved)" stroke="#fff" strokeWidth={5} fill="#141414">
        <rect x={x0} y={top} width={x1 - x0} height={gy - top} />
        <path d={`M ${x0 + 40} ${top + 260} L ${s.cx} ${top + 160} L ${x1 - 40} ${top + 260} Z`} fill="#1f1f1f" />
        <rect x={s.cx - 70} y={top + 40} width={140} height={180} fill="#1f1f1f" />
        <path d={`M ${s.cx - 80} ${top + 40} Q ${s.cx} ${top - 20} ${s.cx + 80} ${top + 40}`} fill="none" />
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={x0 + 40 + i * 92} y={top + 300} width={40} height={gy - top - 320} fill="#262626" />)}
        <rect x={s.cx - 70} y={gy - 300} width={140} height={300} fill="#000" />
      </g>
      <line x1={0} y1={cut} x2={W} y2={cut} stroke="#fff" strokeWidth={3} opacity={k < 1 ? 0.6 : 0} />
      {k < 1 && <Figure x={x0 + 60 + ((f * 4) % (x1 - x0 - 120))} ground={cut} s={0.35} pose={{ ...STAND, rs: 120 + 40 * Math.sin(f), re: 140 }} />}
      {k < 1 && Array.from({ length: 6 }, (_, i) => <circle key={i} cx={x0 + 80 + (i * 97) % 440} cy={cut + cyc(f, 20, i * 3) * 200} r={5} fill="#aaa" opacity={1 - cyc(f, 20, i * 3)} />)}
      <Ground y={gy} />
    </Frame>
  );
}

// Mountain terraces: flat steps cut into a steep slope, stone walls holding each one.
export function Terraces({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 7;
  const shown = k01(f, 0, dur * 0.8, clamp) * n;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx - 40} ${s.top + 40} L ${s.cx + 160} ${s.top + 200} L ${s.right + 100} ${s.top + 120}`} fill="none" stroke="#555" strokeWidth={5} />
      {Array.from({ length: n }, (_, i) => {
        const u = Math.max(0, Math.min(1, shown - i));
        const y = s.bottom - 60 - i * 120;
        const x = s.left - 60 + i * 80;
        return (
          <g key={i} opacity={u}>
            <path d={`M ${x} ${y} V ${y - 100} H ${W + 100} V ${y}`} fill={i % 2 ? "#1f1f1f" : "#262626"} stroke="#ddd" strokeWidth={5} />
            {Array.from({ length: 10 }, (_, j) => <rect key={j} x={x + 10 + j * 50} y={y - 96} width={46} height={44} fill="none" stroke="#555" strokeWidth={3} />)}
            {u >= 1 && Array.from({ length: 6 }, (_, j) => <path key={`g${j}`} d={`M ${x + 120 + j * 140} ${y - 100} q 10 -40 20 0 q 10 -50 20 0`} fill="none" stroke="#aaa" strokeWidth={4} />)}
          </g>
        );
      })}
      <Figure x={s.left + 200} ground={s.bottom - 160} s={0.35} pose={walk(f * 0.2)} />
    </Frame>
  );
}

// A stepped temple-pyramid: terraces stack up, a staircase climbs the front to the shrine.
export function StepPyramid({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const n = 7, lh = 90, base = 900;
  const k = k01(f, 0, dur * 0.8, clamp) * n;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: n }, (_, i) => {
        const u = Math.max(0, Math.min(1, k - i));
        if (u <= 0) return null;
        const w = base - i * 100;
        return <rect key={i} x={s.cx - w / 2} y={gy - (i + 1) * lh + (1 - u) * 30} width={w} height={lh} fill={i % 2 ? "#1f1f1f" : "#262626"} stroke="#ddd" strokeWidth={4} opacity={u} />;
      })}
      {k >= n && (
        <>
          <rect x={s.cx - 120} y={gy - n * lh - 160} width={240} height={160} fill="#262626" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
          <rect x={s.cx - 40} y={gy - n * lh - 110} width={80} height={110} fill="#000" />
        </>
      )}
      <path d={`M ${s.cx - 70} ${gy} L ${s.cx - 50} ${gy - Math.min(k, n) * lh} H ${s.cx + 50} L ${s.cx + 70} ${gy} Z`} fill="#141414" stroke="#ccc" strokeWidth={4} />
      {Array.from({ length: Math.floor(Math.min(k, n) * 4) }, (_, i) => <line key={i} x1={s.cx - 64} y1={gy - i * (lh / 4)} x2={s.cx + 64} y2={gy - i * (lh / 4)} stroke="#555" strokeWidth={3} />)}
      <Figure x={s.cx + 500} ground={gy} s={0.3} flip pose={STAND} headDown={-20} />
    </Frame>
  );
}

// A pagoda in an earthquake: the tiers sway like a snake around the free-hanging central pillar, and it stands.
export function Pagoda({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const quake = k01(f, dur * 0.2, dur * 0.3, clamp) * (1 - k01(f, dur * 0.75, dur * 0.9, clamp));
  const n = 5;
  return (
    <Frame p={p} t={t}>
      <g transform={`translate(${Math.sin(f * 2.2) * 8 * quake} 0)`}><Ground y={gy} /></g>
      <rect x={s.cx - 12} y={gy - n * 170 - 60} width={24} height={n * 170 + 60} fill="#fff" opacity={0.8} filter="url(#glow)" />
      {Array.from({ length: n }, (_, i) => {
        const sway = Math.sin(f / 4 + i * 1.4) * 22 * quake * (i % 2 ? 1 : -1);
        const y = gy - (i + 1) * 170;
        const w = 520 - i * 60;
        return (
          <g key={i} transform={`translate(${sway} 0)`}>
            <rect x={s.cx - w / 2 + 50} y={y + 40} width={w - 100} height={130} fill="#1f1f1f" stroke="#ddd" strokeWidth={4} />
            <path d={`M ${s.cx - w / 2 - 50} ${y + 60} Q ${s.cx} ${y - 10} ${s.cx + w / 2 + 50} ${y + 60} L ${s.cx + w / 2 - 20} ${y + 40} H ${s.cx - w / 2 + 20} Z`} fill="#2a2a2a" stroke="#fff" strokeWidth={5} />
          </g>
        );
      })}
      <line x1={s.cx} y1={gy - n * 170 - 60} x2={s.cx} y2={gy - n * 170 - 200} stroke="#ccc" strokeWidth={8} />
    </Frame>
  );
}

// An iron lattice tower rises, criss-crossed girders section by section.
export function IronTower({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur * 0.85, clamp);
  const topY = s.top + 100, hgt = gy - topY;
  const wAt = (y: number) => 40 + 420 * ((gy - y) / hgt - 1) ** 2;
  const segs = 12;
  const shown = Math.floor(k * segs);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: shown }, (_, i) => {
        const y0 = gy - (i * hgt) / segs, y1 = gy - ((i + 1) * hgt) / segs;
        const [w0, w1] = [wAt(y0), wAt(y1)];
        return (
          <g key={i} stroke={i === shown - 1 ? "#fff" : "#ccc"} strokeWidth={i < 2 ? 8 : 5} fill="none" filter={i === shown - 1 ? "url(#glow)" : undefined}>
            <line x1={s.cx - w0} y1={y0} x2={s.cx - w1} y2={y1} />
            <line x1={s.cx + w0} y1={y0} x2={s.cx + w1} y2={y1} />
            <line x1={s.cx - w0} y1={y0} x2={s.cx + w1} y2={y1} strokeOpacity={0.5} />
            <line x1={s.cx + w0} y1={y0} x2={s.cx - w1} y2={y1} strokeOpacity={0.5} />
            {(i === 2 || i === 6) && <line x1={s.cx - w1 - 20} y1={y1} x2={s.cx + w1 + 20} y2={y1} strokeWidth={14} />}
          </g>
        );
      })}
      {shown >= 3 && <path d={`M ${s.cx - wAt(gy - (2.2 * hgt) / segs)} ${gy} A ${wAt(gy)} 260 0 0 1 ${s.cx + wAt(gy - (2.2 * hgt) / segs)} ${gy}`} fill="none" stroke="#999" strokeWidth={6} />}
      {k < 1 && <circle cx={s.cx + wAt(gy - (shown * hgt) / segs)} cy={gy - (shown * hgt) / segs} r={10} fill="#fff" opacity={(f % 6) < 3 ? 1 : 0.2} />}
    </Frame>
  );
}

// A suspension bridge: towers stand, the main cables are spun across, then the deck is hung from them.
export function Suspension({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.bottom - 100;
  const deckY = sea - 260;
  const tw = [s.left + 170, s.right - 170];
  const towerTop = s.top + 220;
  const cable = k01(f, dur * 0.15, dur * 0.45, clamp);
  const deck = k01(f, dur * 0.5, dur * 0.85, clamp);
  const sag = (x: number) => towerTop + (deckY - 40 - towerTop) * (1 - ((x - s.cx) / ((tw[1] - tw[0]) / 2)) ** 2);
  const span = Array.from({ length: 41 }, (_, i) => tw[0] + (i * (tw[1] - tw[0])) / 40);
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={sea} width={W} height={400} fill="#fff" opacity={0.08} />
      {[0, 1].map((i) => <path key={i} d={wave(sea + 20 + i * 40, 8, 120, f * 2)} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
      {tw.map((x) => (
        <g key={x}>
          <rect x={x - 30} y={towerTop} width={60} height={sea - towerTop} fill="#262626" stroke="#fff" strokeWidth={5} />
          <rect x={x - 50} y={towerTop + 80} width={100} height={24} fill="#555" />
        </g>
      ))}
      <polyline points={span.filter((_, i) => i / 40 <= cable).map((x) => `${x},${sag(x)}`).join(" ")} fill="none" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      <polyline points={`${s.left - 80},${deckY + 60} ${tw[0]},${towerTop}`} fill="none" stroke="#fff" strokeWidth={8} />
      <polyline points={`${tw[1]},${towerTop} ${s.right + 80},${deckY + 60}`} fill="none" stroke="#fff" strokeWidth={8} opacity={cable >= 1 ? 1 : 0} />
      {span.filter((_, i) => i % 2 === 0 && i > 0 && i < 40 && Math.abs(i - 20) / 20 <= deck).map((x, i) => <line key={i} x1={x} y1={sag(x)} x2={x} y2={deckY} stroke="#aaa" strokeWidth={3} />)}
      {deck > 0 && <rect x={s.cx - ((tw[1] - tw[0]) / 2) * deck} y={deckY} width={(tw[1] - tw[0]) * deck} height={30} fill="#3a3a3a" stroke="#ddd" strokeWidth={4} />}
      {[0, 1].map((i) => <rect key={i} x={i ? s.right - 40 : -20} y={deckY} width={i ? 140 : s.left + 140} height={30} fill="#3a3a3a" stroke="#ddd" strokeWidth={4} />)}
    </Frame>
  );
}

// A concrete dam holds back a lake; water pours through the turbines and they spin.
export function Dam({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const top = s.top + 180;
  const lake = top + 60;
  const k = k01(f, dur * 0.2, dur * 0.4, clamp);
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={lake} width={s.cx - 120} height={gy - lake} fill="#fff" opacity={0.12} />
      <path d={wave(lake, 8, 100, f * 1.5)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} transform={`scale(${(s.cx - 120) / W} 1)`} />
      <path d={`M ${s.cx - 140} ${top} H ${s.cx - 60} Q ${s.cx + 40} ${gy - 300} ${s.cx + 260} ${gy} H ${s.cx - 140} Z`} fill="#2a2a2a" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
      {Array.from({ length: 5 }, (_, i) => <line key={i} x1={s.cx - 140} y1={top + 120 + i * 160} x2={s.cx - 60 + (i * 70)} y2={top + 120 + i * 160} stroke="#555" strokeWidth={3} />)}
      <rect x={s.cx + 260} y={gy - 160} width={260} height={160} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {[0, 1].map((i) => (
        <g key={i} transform={`rotate(${f * 12 * k} ${s.cx + 330 + i * 120} ${gy - 80})`}>
          {[0, 60, 120].map((a) => <line key={a} x1={s.cx + 330 + i * 120 - Math.cos(a * D) * 44} y1={gy - 80 - Math.sin(a * D) * 44} x2={s.cx + 330 + i * 120 + Math.cos(a * D) * 44} y2={gy - 80 + Math.sin(a * D) * 44} stroke="#fff" strokeWidth={8} />)}
        </g>
      ))}
      {k > 0 && Array.from({ length: 10 }, (_, i) => <circle key={i} cx={s.cx + 20 + cyc(f, 20, i * 2) * 250} cy={gy - 260 + cyc(f, 20, i * 2) * 200} r={7} fill="#fff" opacity={0.6 * k} />)}
      {k > 0 && Array.from({ length: 5 }, (_, i) => <path key={`b${i}`} d={`M ${s.right - 60} ${s.top + 200 + i * 40} l 30 30 l -20 0 l 30 40`} fill="none" stroke="#fff" strokeWidth={4} opacity={((f + i * 5) % 20) < 10 ? k : 0} />)}
      <line x1={s.cx + 520} y1={gy - 120} x2={s.right + 40} y2={s.top + 260} stroke="#888" strokeWidth={4} />
      <Ground y={gy} />
    </Frame>
  );
}

// A tunnel boring machine grinds forward through rock, lining the tunnel behind it with rings.
export function Borer({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const cy = s.cy + 100, R = 220;
  const x = interpolate(f, [0, dur], [s.cx - 80, s.cx + 160]);
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top} width={W} height={s.height} fill="#1a1a1a" />
      {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M ${(i * 113) % W} ${s.top + ((i * 71) % s.height)} l 30 10 l -10 20`} fill="none" stroke="#333" strokeWidth={4} />)}
      <rect x={-20} y={cy - R} width={x + 20} height={2 * R} fill="#000" />
      {Array.from({ length: Math.floor((x + 20) / 70) }, (_, i) => <line key={i} x1={x - 160 - i * 70} y1={cy - R} x2={x - 160 - i * 70} y2={cy + R} stroke="#555" strokeWidth={8} />)}
      <line x1={-20} y1={cy - R} x2={x} y2={cy - R} stroke="#ddd" strokeWidth={5} />
      <line x1={-20} y1={cy + R} x2={x} y2={cy + R} stroke="#ddd" strokeWidth={5} />
      <rect x={x - 260} y={cy - R + 20} width={260} height={2 * R - 40} fill="#2a2a2a" stroke="#ddd" strokeWidth={5} />
      <g transform={`translate(${x + 20} ${cy}) scale(0.25 1) rotate(${f * 8})`}>
        <circle r={R} fill="#3a3a3a" stroke="#fff" strokeWidth={14} />
        {Array.from({ length: 8 }, (_, i) => <line key={i} x1={0} y1={0} x2={Math.cos((i * 45) * D) * R} y2={Math.sin((i * 45) * D) * R} stroke="#fff" strokeWidth={12} />)}
      </g>
      {Array.from({ length: 10 }, (_, i) => {
        const u = cyc(f, 16, i * 2);
        return <rect key={i} x={x + 70 + u * 60} y={cy - R + ((i * 47) % (2 * R))} width={14} height={14} fill="#888" opacity={1 - u} transform={`rotate(${f * 20 + i * 40} ${x + 70} ${cy})`} />;
      })}
      <Figure x={x - 360} ground={cy + R} s={0.4} pose={walk(f * 0.2)} />
    </Frame>
  );
}

// A railway is laid: ties go down, rails go on, spikes are hammered in, and the line runs on.
export function Rails({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const hz = s.top + 200;
  const k = k01(f, 0, dur * 0.85, clamp);
  const n = 14;
  const shown = Math.floor(k * n);
  const yOf = (i: number) => s.bottom + 100 - (s.bottom + 100 - hz) * (1 - 1 / (1 + i * 0.25));
  const half = (y: number) => 40 + ((y - hz) / (s.bottom + 100 - hz)) * 380;
  const swing = Math.sin(((f % 16) / 16) * Math.PI);
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={hz} x2={W} y2={hz} stroke="#555" strokeWidth={3} />
      {Array.from({ length: shown }, (_, i) => {
        const y = yOf(i);
        const w = half(y);
        return <rect key={i} x={s.cx - w * 1.3} y={y - w * 0.06} width={w * 2.6} height={Math.max(4, w * 0.12)} fill="#555" stroke="#888" strokeWidth={2} />;
      })}
      {shown > 1 && [-1, 1].map((d) => <line key={d} x1={s.cx + d * half(yOf(0))} y1={yOf(0)} x2={s.cx + d * half(yOf(shown - 1))} y2={yOf(shown - 1)} stroke="#e6e6e6" strokeWidth={10} filter="url(#glow)" />)}
      <Figure x={s.cx + half(yOf(shown)) + 90} ground={yOf(shown)} s={Math.max(0.2, half(yOf(shown)) / 500)} pose={{ ...STAND, t: 30, rs: 90 + 80 * swing, re: 100 + 80 * swing }} />
    </Frame>
  );
}

// A colossal statue (torch raised, crown, tablet): an iron skeleton inside, then thin copper skin panels go on from
// the feet up. The frame-and-skin build of the Statue of Liberty.
export function Skeleton({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, dur * 0.1, dur * 0.85, clamp);
  const c = s.cx + 40;
  const foot = gy - 200, top = s.top + 140;
  const skinY = foot - (foot - top) * k;
  const shapes = (fill: string, stroke?: string) => {
    const st = stroke ? { stroke, strokeWidth: 14, strokeLinejoin: "round" as const } : {};
    return (
      <>
        <path d={`M ${c - 170} ${foot} L ${c - 110} ${foot - 420} Q ${c} ${foot - 470} ${c + 110} ${foot - 420} L ${c + 170} ${foot} Z`} fill={fill} {...st} />
        <path d={`M ${c - 120} ${foot - 400} L ${c - 230} ${top + 140} L ${c - 180} ${top + 120} L ${c - 70} ${foot - 430} Z`} fill={fill} {...st} />
        <path d={`M ${c - 245} ${top + 140} h 80 l -10 -40 h -60 Z`} fill={fill} {...st} />
        <circle cx={c} cy={foot - 500} r={62} fill={fill} {...st} />
        <rect x={c + 50} y={foot - 400} width={90} height={150} rx={6} fill={fill} transform={`rotate(-14 ${c + 95} ${foot - 325})`} {...st} />
      </>
    );
  };
  return (
    <Frame p={p} t={t}>
      <defs>
        <clipPath id="statue">{shapes("#000")}</clipPath>
        <clipPath id="skin"><rect x={0} y={skinY} width={W} height={H} /></clipPath>
      </defs>
      <rect x={c - 260} y={foot} width={520} height={gy - foot} fill="#262626" stroke="#ddd" strokeWidth={5} />
      <Ground y={gy} />
      {shapes("#0d0d0d", "#fff")}
      {shapes("#0d0d0d")}
      <g clipPath="url(#statue)">
        {Array.from({ length: 16 }, (_, i) => <line key={`v${i}`} x1={c - 300 + i * 40} y1={top} x2={c - 300 + i * 40} y2={foot} stroke="#555" strokeWidth={4} />)}
        {Array.from({ length: 24 }, (_, i) => <line key={`d${i}`} x1={c - 300} y1={top + i * 50} x2={c + 300} y2={top + i * 50 - 160} stroke="#444" strokeWidth={3} />)}
        <line x1={c} y1={top + 200} x2={c} y2={foot} stroke="#999" strokeWidth={18} />
        <g clipPath="url(#skin)">
          <rect x={c - 320} y={top - 40} width={640} height={foot - top + 40} fill="#9a9a9a" />
          {Array.from({ length: 30 }, (_, i) => <line key={`h${i}`} x1={c - 320} y1={top + i * 40} x2={c + 320} y2={top + i * 40} stroke="#777" strokeWidth={3} />)}
          {Array.from({ length: 16 }, (_, i) => <line key={`p${i}`} x1={c - 300 + i * 40 + ((i * 13) % 20)} y1={top} x2={c - 300 + i * 40 + ((i * 13) % 20)} y2={foot} stroke="#777" strokeWidth={2} />)}
        </g>
      </g>
      {Array.from({ length: 7 }, (_, i) => {
        const [a, b] = [go([c, foot - 520], 120 + i * 20, 62), go([c, foot - 520], 120 + i * 20, 112)];
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={k > 0.95 ? "#ccc" : "#666"} strokeWidth={10} strokeLinecap="round" />;
      })}
      <path d={`M ${c - 225} ${top + 100} q -24 -60 0 -110 q 24 50 0 110`} fill="#fff" filter="url(#glow)" />
      {k < 1 && <line x1={c - 330} y1={skinY} x2={c + 330} y2={skinY} stroke="#fff" strokeWidth={4} filter="url(#glow)" />}
    </Frame>
  );
}

// A Roman hypocaust: a furnace sends hot air under a floor raised on stacks of tiles, heating the room above.
export function Hypocaust({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const floor = s.cy + 160, base = s.bottom - 60;
  const k = k01(f, 0, dur * 0.6);
  return (
    <Frame p={p} t={t}>
      <rect x={s.left} y={s.top + 160} width={s.width} height={floor - s.top - 160} fill="#141414" stroke="#ddd" strokeWidth={5} />
      <rect x={s.left} y={floor} width={s.width} height={40} fill="#3a3a3a" stroke="#ddd" strokeWidth={5} />
      <line x1={s.left} y1={base} x2={s.right} y2={base} stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          {Array.from({ length: 5 }, (_, j) => <rect key={j} x={s.left + 60 + i * 115} y={base - (j + 1) * ((base - floor - 40) / 5)} width={50} height={(base - floor - 40) / 5 - 4} fill="#555" stroke="#888" strokeWidth={2} />)}
        </g>
      ))}
      <path d={`M ${s.left - 40} ${base - 150} h 120 v 150 h -120 Z`} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      <path d={`M ${s.left} ${base - 20} Q ${s.left - 10} ${base - 100} ${s.left + 20 + Math.sin(f / 3) * 8} ${base - 130} Q ${s.left + 50} ${base - 80} ${s.left + 40} ${base - 20} Z`} fill="#fff" filter="url(#glow)" />
      {Array.from({ length: 12 }, (_, i) => {
        const u = cyc(f, 60, i * 5);
        const x = s.left + 80 + u * (s.width - 120);
        const y = base - 40 - ((i * 37) % (base - floor - 100)) + Math.sin(u * 12) * 10;
        return <path key={i} d={`M ${x} ${y} q 15 -10 30 0 t 30 0`} fill="none" stroke="#fff" strokeWidth={4} opacity={0.6 * k * Math.sin(u * Math.PI)} />;
      })}
      {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M ${s.left + 120 + i * 150} ${floor - 20 - cyc(f, 40, i * 7) * 200} q 10 -20 0 -40 q -10 -20 0 -40`} fill="none" stroke="#fff" strokeWidth={4} opacity={0.4 * k * (1 - cyc(f, 40, i * 7))} />)}
      <Figure x={s.cx} ground={floor} s={0.6} pose={mix(STAND, { ...STAND, ls: -40, le: -60, rs: 40, re: 60 }, k)} />
    </Frame>
  );
}

// A windcatcher tower: the breeze is caught up top, pushed down over water, and the room below stays cool.
export function Windcatcher({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const tw = { x: s.cx + 120, w: 160, top: s.top + 140 };
  const room = { x: s.left, y: gy - 360, w: tw.x + tw.w - s.left };
  const path: Pt[] = [[s.left - 100, tw.top + 60], [tw.x + 60, tw.top + 60], [tw.x + 80, gy - 300], [tw.x - 60, gy - 120], [s.left + 120, gy - 160]];
  const along = (u: number): Pt => {
    const segs = path.length - 1, i = Math.min(segs - 1, Math.floor(u * segs));
    return lerp(path[i], path[i + 1], u * segs - i);
  };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={tw.x} y={tw.top} width={tw.w} height={room.y - tw.top} fill="#262626" stroke="#ddd" strokeWidth={5} />
      {[0, 1, 2].map((i) => <rect key={i} x={tw.x + 20 + i * 44} y={tw.top + 30} width={30} height={90} fill="#000" />)}
      <rect x={room.x} y={room.y} width={room.w} height={360} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      <ellipse cx={tw.x - 60} cy={gy - 40} rx={120} ry={24} fill="#fff" opacity={0.2} />
      {Array.from({ length: 10 }, (_, i) => {
        const u = cyc(f, 70, i * 7);
        const [x, y] = along(u);
        const cool = u > 0.55;
        return <path key={i} d={`M ${x} ${y} q 20 -12 40 0 t 40 0`} fill="none" stroke="#fff" strokeWidth={cool ? 6 : 4} opacity={cool ? 0.9 : 0.5} filter={cool ? "url(#glow)" : undefined} />;
      })}
      <Figure x={s.left + 160} ground={gy} s={0.55} pose={SIT} headDown={-5} />
      <circle cx={s.right - 60} cy={s.top + 140} r={70} fill="#fff" opacity={0.6} />
    </Frame>
  );
}

// A qanat: a gently sloping tunnel carries groundwater from the hills to the village; shafts dot the surface.
export function Qanat({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const ground = (x: number) => s.top + 360 + (x / W) * 520;
  const tunnel = (x: number) => s.cy + 120 + (x / W) * 200;
  const flow = k01(f, 0, dur * 0.7, clamp);
  return (
    <Frame p={p} t={t}>
      <path d={`M 0 ${ground(0)} L ${W} ${ground(W)} V ${H} H 0 Z`} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      <path d={`M 0 ${s.top + 200} Q 120 ${s.top + 60} 280 ${ground(280) - 40}`} fill="#141414" stroke="#888" strokeWidth={4} />
      <rect x={-20} y={tunnel(0) + 60} width={W + 40} height={300} fill="#262626" />
      <path d={wave(tunnel(0) + 70, 6, 80, f)} fill="none" stroke="#555" strokeWidth={3} />
      <path d={`M 0 ${tunnel(0)} L ${W} ${tunnel(W)}`} stroke="#000" strokeWidth={50} />
      <path d={`M 0 ${tunnel(0)} L ${W * flow} ${tunnel(W * flow)}`} stroke="#fff" strokeWidth={14} strokeLinecap="round" filter="url(#glow)" />
      {[150, 330, 510, 690].map((x) => (
        <g key={x}>
          <line x1={x} y1={ground(x)} x2={x} y2={tunnel(x)} stroke="#777" strokeWidth={10} />
          <ellipse cx={x} cy={ground(x) - 6} rx={40} ry={14} fill="#333" stroke="#bbb" strokeWidth={4} />
        </g>
      ))}
      <rect x={s.right - 140} y={ground(s.right - 140) - 160} width={160} height={160} fill="#262626" stroke="#ddd" strokeWidth={5} />
      {flow >= 1 && Array.from({ length: 4 }, (_, i) => <circle key={i} cx={s.right - 80 + i * 20} cy={tunnel(W) - cyc(f, 20, i * 5) * 40} r={6} fill="#fff" opacity={1 - cyc(f, 20, i * 5)} />)}
    </Frame>
  );
}

// A stepwell: flights of stairs zigzag down to the water far below the dry ground.
export function Stepwell({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const top = s.top + 120;
  const lvl = s.bottom - 140;
  const n = 6;
  const reveal = k01(f, 0, dur * 0.6, clamp) * n;
  const walker = k01(f, dur * 0.2, dur, clamp);
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={top} x2={W} y2={top} stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: n }, (_, i) => {
        const u = Math.max(0, Math.min(1, reveal - i));
        const y = top + i * ((lvl - top) / n);
        const inset = i * 55;
        return (
          <g key={i} opacity={u}>
            <rect x={s.left + inset} y={y} width={s.width - inset * 2} height={(lvl - top) / n} fill={i % 2 ? "#1a1a1a" : "#222"} stroke="#888" strokeWidth={3} />
            {Array.from({ length: 5 }, (_, j) => <line key={j} x1={s.left + inset + 20 + j * 12} y1={y + j * 30} x2={s.right - inset - 20 - j * 12} y2={y + j * 30} stroke="#555" strokeWidth={3} />)}
            {[0.25, 0.5, 0.75].map((c) => <rect key={c} x={s.left + inset + (s.width - inset * 2) * c - 14} y={y + 20} width={28} height={(lvl - top) / n - 30} fill="#2a2a2a" stroke="#999" strokeWidth={2} />)}
          </g>
        );
      })}
      <rect x={s.left + n * 55} y={lvl} width={s.width - n * 110} height={80} fill="#fff" opacity={0.3} />
      <path d={wave(lvl + 10, 5, 60, f * 2)} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={4} transform={`translate(0 0)`} />
      <Figure x={s.cx - 120 + Math.sin(walker * Math.PI * 3) * 120} ground={top + walker * (lvl - top)} s={0.3 + walker * 0.05} back pose={walk(f * 0.25, 0.6)} />
    </Frame>
  );
}

// An ancient sewer: drains in the streets feed a vaulted tunnel that carries the water to the river.
export function Sewer({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const street = s.top + 300;
  const vault = { cx: s.cx, cy: s.bottom - 220, r: 260 };
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={street} x2={W} y2={street} stroke="#ddd" strokeWidth={6} />
      {[s.left + 80, s.right - 260].map((x) => <rect key={x} x={x} y={street - 260} width={180} height={260} fill="#1f1f1f" stroke="#ccc" strokeWidth={4} />)}
      {Array.from({ length: 30 }, (_, i) => {
        const y = ((i * 97 + f * 20) % 300) + s.top - 40;
        return <line key={i} x1={(i * 151) % W} y1={y} x2={((i * 151) % W) - 8} y2={y + 30} stroke="#fff" strokeOpacity={0.3} strokeWidth={2} />;
      })}
      {[s.cx - 200, s.cx + 200].map((x) => (
        <g key={x}>
          <rect x={x - 40} y={street - 6} width={80} height={12} fill="#888" />
          <rect x={x - 20} y={street} width={40} height={vault.cy - vault.r - street + 40} fill="#141414" stroke="#777" strokeWidth={3} />
          {Array.from({ length: 4 }, (_, i) => <circle key={i} cx={x} cy={street + 20 + cyc(f, 24, i * 6) * (vault.cy - vault.r - street)} r={6} fill="#fff" opacity={0.7} />)}
        </g>
      ))}
      <path d={`M ${vault.cx - vault.r} ${vault.cy + 120} V ${vault.cy} A ${vault.r} ${vault.r} 0 0 1 ${vault.cx + vault.r} ${vault.cy} V ${vault.cy + 120} Z`} fill="#0d0d0d" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {Array.from({ length: 9 }, (_, i) => {
        const a = 180 + i * 22.5;
        const [q1, q2] = [go([vault.cx, vault.cy], 90 - a, vault.r), go([vault.cx, vault.cy], 90 - a, vault.r + 50)];
        return <line key={i} x1={q1[0]} y1={q1[1]} x2={q2[0]} y2={q2[1]} stroke="#777" strokeWidth={4} />;
      })}
      <rect x={vault.cx - vault.r + 10} y={vault.cy + 40} width={2 * vault.r - 20} height={70} fill="#fff" opacity={0.25} />
      {[0, 1].map((i) => <path key={i} d={wave(vault.cy + 50 + i * 30, 6, 60, f * 4)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={3} transform={`translate(0 0)`} clipPath="none" />)}
    </Frame>
  );
}

// Heights side by side, to scale, with a person for reference: "146 M" vs "93 M".
export function Heights({ p, t, dur }: VisualProps<{ items: { name: string; meters: number }[] }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 120;
  const n = p.items.length;
  const max = Math.max(...p.items.map((i) => i.meters), 2);
  const maxH = gy - s.top - 200;
  const colW = s.width / n;
  return (
    <>
      <Frame p={{}} t={t}>
        <Ground y={gy} />
        {p.items.map((it, k) => {
          const u = k01(f, tickAt(k, n, dur) - 12, tickAt(k, n, dur), { ...clamp, easing: Easing.out(Easing.cubic) });
          const h = (it.meters / max) * maxH * u;
          const x = s.left + k * colW + colW * 0.2;
          const w = colW * 0.6;
          const tallest = it.meters === max;
          return <path key={k} d={`M ${x} ${gy} L ${x + w * 0.15} ${gy - h} H ${x + w * 0.85} L ${x + w} ${gy} Z`} fill={tallest ? "#2f2f2f" : "#1f1f1f"} stroke={tallest ? "#fff" : "#bbb"} strokeWidth={5} filter={tallest && u >= 1 ? "url(#glow)" : undefined} />;
        })}
        {/* A person to scale (1.8 m), so the heights read as real. */}
        <Figure x={s.left + 20} ground={gy} s={Math.max(0.08, ((1.8 / max) * maxH) / 440)} pose={STAND} />
      </Frame>
      {p.items.map((it, k) => {
        const u = k01(f, tickAt(k, n, dur) - 12, tickAt(k, n, dur), clamp);
        const h = (it.meters / max) * maxH * u;
        return (
          <div key={k} style={{ position: "absolute", left: s.left + k * colW, width: colW, top: gy - h - 110, textAlign: "center", opacity: u }}>
            <div style={{ font: `400 70px/1 ${font.impact}`, color: "#fff" }}>{Math.round(it.meters * u).toLocaleString("en-US")} M</div>
          </div>
        );
      })}
      {p.items.map((it, k) => (
        <div key={`n${k}`} style={{ position: "absolute", left: s.left + k * colW, width: colW, top: gy + 24, textAlign: "center", font: `700 32px/1.1 ${font.display}`, color: "#aaa", letterSpacing: 2 }}>{it.name.toUpperCase()}</div>
      ))}
    </>
  );
}
