import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { type VisualProps } from "./common.tsx";
import { D, Figure, Ground, SIT, STAND, VICTORY, clamp, go, lerp, mix, walk, walkRate, type Pose, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// History and engineering pictures for the "built" series: how it was built, how it worked. Diagrams first: each one
// shows the actual method (the ramp, the lever, the centering under an arch), so the narration can point at it.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const wave = (y: number, amp: number, len: number, off: number) =>
  `M ${-len * 2 - (off % (len * 2))} ${y} ${Array.from({ length: Math.ceil(W / len) + 4 }, (_, i) => `q ${len / 2} ${i % 2 ? amp : -amp} ${len} 0`).join(" ")}`;
const haul: Pose = { ...STAND, t: 30, ls: 70, le: 80, rs: 80, re: 90 };
const stone = (x: number, y: number, w: number, h: number, key?: string | number, lit = false) => (
  <g key={key}>
    <rect x={x} y={y} width={w} height={h} rx={4} fill={lit ? "#e6e6e6" : "#2a2a2a"} stroke="#ddd" strokeWidth={4} filter={lit ? "url(#glow)" : undefined} />
    {!lit && <path d={`M ${x + w * 0.2} ${y + h * 0.3} l ${w * 0.15} ${h * 0.2} M ${x + w * 0.6} ${y + h * 0.6} l ${w * 0.2} ${-h * 0.1}`} stroke="#555" strokeWidth={3} />}
  </g>
);

// A pyramid rises layer by layer while a block is hauled up the ramp.
export function Giza({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const layers = 8, base = 860, lh = 72;
  const k = k01(f, 0, dur * 0.9, clamp);
  const done = Math.max(1, Math.floor(k * layers));
  const top = gy - done * lh;
  const rampX = s.cx - base / 2 + (done * base) / (2 * layers);
  const u = cyc(f, 60);
  const blk = lerp([s.left - 60, gy], [rampX - 40, top], u);
  return (
    <Frame p={p} t={t}>
      <circle cx={s.right - 130} cy={s.top + 170} r={90} fill="#fff" opacity={0.5} />
      {Array.from({ length: done }, (_, i) => {
        const w = base * (1 - i / layers);
        return <rect key={i} x={s.cx - w / 2} y={gy - (i + 1) * lh} width={w} height={lh} fill={i % 2 ? "#1f1f1f" : "#262626"} stroke="#ddd" strokeWidth={4} />;
      })}
      <path d={`M ${s.cx - base / 2 + (layers * base) / (2 * layers)} ${gy - layers * lh} L ${s.cx - base / 2} ${gy} H ${s.cx + base / 2} Z`} fill="none" stroke="#fff" strokeOpacity={0.15} strokeWidth={3} strokeDasharray="14 10" />
      <path d={`M ${s.left - 140} ${gy} L ${rampX} ${top} V ${gy} Z`} fill="#141414" stroke="#aaa" strokeWidth={4} />
      <g transform={`rotate(${(Math.atan2(top - gy, rampX - s.left + 140) * 180) / Math.PI} ${blk[0]} ${blk[1]})`}>
        {stone(blk[0] - 60, blk[1] - 50, 80, 50, "b", true)}
        <Figure x={blk[0] + 70} ground={blk[1]} s={0.28} pose={{ ...walk(f * 0.25), t: 30 }} />
      </g>
      <Ground y={gy} />
    </Frame>
  );
}

// A stone block dragged on a wooden sledge; a worker pours water on the sand ahead to cut the friction.
export function Sledge({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const ph = f * 0.1;
  const bx = s.cx - 330;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={40} offset={f * 3} />
      {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={(((i * 97 - f * 3) % W) + W) % W} cy={gy + 20 + (i % 3) * 14} r={3} fill="#777" />)}
      <path d={`M ${bx - 30} ${gy - 10} H ${bx + 330} Q ${bx + 370} ${gy - 10} ${bx + 380} ${gy - 50}`} fill="none" stroke="#bbb" strokeWidth={14} strokeLinecap="round" />
      {stone(bx, gy - 280, 320, 260, "s")}
      <line x1={bx + 370} y1={gy - 50} x2={s.right + 40} y2={gy - 260} stroke="#ccc" strokeWidth={5} />
      {[0, 1, 2].map((i) => <Figure key={i} x={bx + 520 + i * 150} ground={gy} s={0.55} pose={{ ...walk(ph + i, 0.5), t: 32, ls: 70, le: 80, rs: 80, re: 90 }} color={i === 1 ? "#ececec" : "#888"} glow={i === 1} />)}
      <Figure x={bx + 430} ground={gy} s={0.5} pose={{ ...STAND, rs: 100, re: 140, t: 10 }} />
      <ellipse cx={bx + 470} cy={gy - 150} rx={26} ry={34} fill="#555" stroke="#ccc" strokeWidth={4} transform={`rotate(70 ${bx + 470} ${gy - 150})`} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 18, i * 3);
        return <circle key={`w${i}`} cx={bx + 500 + u * 30} cy={gy - 140 + u * 140} r={6} fill="#fff" opacity={1 - u} />;
      })}
      <ellipse cx={bx + 520} cy={gy + 4} rx={70} ry={10} fill="#fff" opacity={0.25} />
    </Frame>
  );
}

// An obelisk is hauled upright with ropes over an A-frame.
export function Obelisk({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const k = k01(f, 0, dur * 0.85);
  const pivot: Pt = [s.cx - 60, gy];
  const ang = -90 * k; // 0 = lying to the right, -90 = upright
  const len = 760;
  const tip = go(pivot, 90 - ang, len);
  const frame: Pt = [s.cx - 380, gy - 520];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${frame[0] - 120} ${gy} L ${frame[0]} ${frame[1]} L ${frame[0] + 120} ${gy}`} fill="none" stroke="#bbb" strokeWidth={14} />
      <g transform={`rotate(${ang} ${pivot[0]} ${pivot[1]})`}>
        <path d={`M ${pivot[0]} ${pivot[1] - 40} L ${pivot[0] + len - 60} ${pivot[1] - 28} L ${pivot[0] + len} ${pivot[1]} L ${pivot[0] + len - 60} ${pivot[1] + 28} L ${pivot[0]} ${pivot[1] + 40} Z`} fill="#262626" stroke="#fff" strokeWidth={6} filter="url(#glow)" transform={`translate(0 -40)`} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={pivot[0] + 120 + i * 140} y={pivot[1] - 52} width={26} height={24} fill="#777" />)}
      </g>
      <line x1={tip[0]} y1={tip[1]} x2={frame[0]} y2={frame[1]} stroke="#ddd" strokeWidth={5} />
      <line x1={frame[0]} y1={frame[1]} x2={s.left - 40} y2={gy - 120} stroke="#ddd" strokeWidth={5} />
      {[0, 1].map((i) => <Figure key={i} x={s.left + 40 + i * 120} ground={gy} s={0.45} flip pose={{ ...haul, t: -30 + Math.sin(f / 6 + i) * 3 }} color={i ? "#888" : "#ececec"} glow={!i} />)}
    </Frame>
  );
}

// Water flows along the channel on top of a two-tier aqueduct and pours into a basin.
export function Aqueduct({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const tier = (y: number, h: number, n: number, key: string) => {
    const w = W / n;
    const d = Array.from({ length: n }, (_, i) => `M ${i * w} ${y + h} V ${y + w * 0.5} A ${w / 2 - 14} ${w / 2 - 14} 0 0 1 ${(i + 1) * w - 28} ${y + w * 0.5} V ${y + h}`).join(" ");
    return (
      <g key={key}>
        <rect x={-10} y={y} width={W + 20} height={h} fill="#1f1f1f" stroke="#ddd" strokeWidth={5} />
        <path d={d} fill="#000" stroke="#ddd" strokeWidth={4} transform={`translate(14 0)`} />
      </g>
    );
  };
  const ch = gy - 680;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {tier(gy - 340, 340, 4, "low")}
      {tier(ch + 40, 300, 7, "high")}
      <rect x={-10} y={ch} width={W + 20} height={40} fill="#2a2a2a" stroke="#fff" strokeWidth={5} />
      {Array.from({ length: 10 }, (_, i) => <line key={i} x1={((i * 140 + f * 8) % (W + 140)) - 70} y1={ch + 14} x2={((i * 140 + f * 8) % (W + 140)) - 10} y2={ch + 14} stroke="#fff" strokeWidth={8} strokeLinecap="round" filter="url(#glow)" />)}
      <Figure x={s.cx + 120} ground={gy} s={0.4} pose={walk(f * 0.15, 0.6)} />
    </Frame>
  );
}

// Wedge stones go onto a wooden frame one by one, the keystone drops in, the frame comes out, and the arch holds.
export function Arch({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const c: Pt = [s.cx, gy - 420];
  const R = 300, n = 9;
  const at = hit ?? dur * 0.6;
  const key = k01(f, at - 10, at, { ...clamp, easing: Easing.in(Easing.quad) });
  const out = k01(f, at + 8, at + dur * 0.2, { ...clamp, easing: Easing.in(Easing.quad) });
  const order = [0, 8, 1, 7, 2, 6, 3, 5]; // both sides at once, toward the top
  const block = (i: number, dy = 0, lit = false) => {
    const a0 = 180 + (i * 180) / n, a1 = 180 + ((i + 1) * 180) / n;
    const p1 = go(c, 90 - a0, R), p2 = go(c, 90 - a1, R), p3 = go(c, 90 - a1, R + 110), p4 = go(c, 90 - a0, R + 110);
    return <path key={i} d={`M ${p1[0]} ${p1[1] + dy} L ${p2[0]} ${p2[1] + dy} L ${p3[0]} ${p3[1] + dy} L ${p4[0]} ${p4[1] + dy} Z`} fill={lit ? "#e6e6e6" : "#262626"} stroke="#ddd" strokeWidth={4} filter={lit ? "url(#glow)" : undefined} />;
  };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => <rect key={d} x={c[0] + d * (R + 55) - 55} y={c[1]} width={110} height={gy - c[1]} fill="#262626" stroke="#ddd" strokeWidth={4} />)}
      <g transform={`translate(0 ${out * 400})`} opacity={1 - out}>
        <path d={`M ${c[0] - R + 10} ${c[1]} A ${R - 10} ${R - 10} 0 0 1 ${c[0] + R - 10} ${c[1]}`} fill="none" stroke="#999" strokeWidth={10} />
        {Array.from({ length: 7 }, (_, i) => <line key={i} x1={c[0] - R + 40 + i * ((2 * R - 80) / 6)} y1={c[1]} x2={c[0] - R + 40 + i * ((2 * R - 80) / 6)} y2={gy} stroke="#777" strokeWidth={8} />)}
        <line x1={c[0] - R} y1={c[1]} x2={c[0] + R} y2={c[1]} stroke="#999" strokeWidth={8} />
      </g>
      {order.map((i, j) => (f >= tickAt(j, order.length, at * 0.9) ? block(i) : null))}
      {key > 0 && block(4, -(1 - key) * 400, key >= 1 && f < at + 20)}
      {out >= 1 && <Figure x={c[0]} ground={gy} s={0.6} pose={walk(f * 0.2)} />}
    </Frame>
  );
}

// The Colosseum's facade rises tier by tier: three rows of arches and a solid top.
export function Colosseum({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur * 0.8, clamp) * 4;
  const th = 200, n = 6, w = s.width / n;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[0, 1, 2, 3].map((r) => {
        const u = Math.max(0, Math.min(1, k - r));
        if (u <= 0) return null;
        const y = gy - (r + 1) * th;
        return (
          <g key={r} opacity={u}>
            <rect x={s.left} y={y + (1 - u) * 40} width={s.width} height={th} fill="#1f1f1f" stroke="#ddd" strokeWidth={5} />
            {r < 3
              ? Array.from({ length: n }, (_, i) => <path key={i} d={`M ${s.left + i * w + 22} ${y + th} V ${y + 70} A ${w / 2 - 22} ${w / 2 - 22} 0 0 1 ${s.left + (i + 1) * w - 22} ${y + 70} V ${y + th}`} fill="#000" stroke="#ccc" strokeWidth={4} />)
              : Array.from({ length: n }, (_, i) => <rect key={i} x={s.left + i * w + 50} y={y + 70} width={w - 100} height={50} fill="#000" stroke="#999" strokeWidth={3} />)}
            {Array.from({ length: n + 1 }, (_, i) => <rect key={`c${i}`} x={s.left + i * w - 8} y={y} width={16} height={th} fill="#3a3a3a" />)}
          </g>
        );
      })}
      {k >= 4 && Array.from({ length: 8 }, (_, i) => <line key={i} x1={s.left + i * (s.width / 7)} y1={gy - 4 * th} x2={s.left + i * (s.width / 7) + 30} y2={gy - 4 * th - 60} stroke="#bbb" strokeWidth={6} />)}
      <Figure x={s.cx} ground={gy} s={0.35} pose={walk(f * 0.2)} />
    </Frame>
  );
}

// The Great Wall snakes over the hills; signal fires light tower to tower.
export function GreatWall({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const pts: Pt[] = [[-40, s.bottom - 80], [220, s.bottom - 260], [420, s.cy + 60], [620, s.cy + 180], [820, s.cy - 60], [1000, s.cy - 220], [W + 60, s.cy - 160]];
  const d = `M ${pts.map((q) => q.join(" ")).join(" L ")}`;
  const towers = pts.slice(1, -1);
  return (
    <Frame p={p} t={t}>
      <path d={`M -40 ${s.bottom} Q 200 ${s.cy - 100} 480 ${s.cy + 120} T ${W + 60} ${s.cy - 250} V ${H} H -40 Z`} fill="#121212" stroke="#555" strokeWidth={3} />
      <path d={d} fill="none" stroke="#ddd" strokeWidth={46} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#1f1f1f" strokeWidth={34} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#ddd" strokeWidth={14} strokeDasharray="16 14" strokeLinejoin="round" transform="translate(0 -26)" />
      {towers.map(([x, y], i) => {
        const lit = f >= tickAt(i, towers.length, dur);
        const fl = Math.sin(f / 3 + i) * 6;
        return (
          <g key={i}>
            <rect x={x - 45} y={y - 120} width={90} height={110} fill="#262626" stroke="#ddd" strokeWidth={5} />
            {lit && <path d={`M ${x - 22} ${y - 120} Q ${x - 26} ${y - 170} ${x + fl} ${y - 210} Q ${x + 26} ${y - 170} ${x + 22} ${y - 120} Z`} fill="#fff" filter="url(#glow)" />}
            {lit && [0, 1, 2].map((j) => <circle key={j} cx={x + Math.sin(f / 10 + j) * 20} cy={y - 230 - cyc(f, 40, j * 13) * 160} r={16 + j * 6} fill="#666" opacity={0.5 * (1 - cyc(f, 40, j * 13))} />)}
          </g>
        );
      })}
    </Frame>
  );
}

// A lintel is raised on a growing timber crib, then slid onto the two uprights.
export function Stonehenge({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const upH = 460;
  const rise = k01(f, 0, dur * 0.6, clamp);
  const slide = k01(f, dur * 0.65, dur * 0.85);
  const logs = Math.floor(rise * 8);
  const cribX = s.cx + 340;
  const ly = gy - 60 - logs * 52;
  // On the crib it rides up with the logs; once the crib is above the uprights it slides across onto them.
  const lx = cribX - 260 - slide * (cribX - s.cx);
  const lintelY = slide > 0 ? gy - upH - 100 : ly - 100;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => (
        <path key={d} d={`M ${s.cx + d * 190 - 70} ${gy} L ${s.cx + d * 190 - 60} ${gy - upH} H ${s.cx + d * 190 + 60} L ${s.cx + d * 190 + 70} ${gy} Z`} fill="#262626" stroke="#ddd" strokeWidth={5} />
      ))}
      {Array.from({ length: logs }, (_, i) => (
        <g key={i}>
          {i % 2 === 0
            ? [-90, 90].map((dx) => <rect key={dx} x={cribX + dx - 120} y={gy - 52 * (i + 1)} width={240} height={46} rx={20} fill="#555" stroke="#aaa" strokeWidth={3} transform={`rotate(90 ${cribX + dx} ${gy - 52 * i - 26})`} />)
            : <rect x={cribX - 160} y={gy - 52 * (i + 1)} width={320} height={46} rx={20} fill="#666" stroke="#aaa" strokeWidth={3} />}
        </g>
      ))}
      <g filter={slide >= 1 ? "url(#glow)" : undefined}>{stone(lx, lintelY, 520, 100, "l", slide >= 1)}</g>
      <Figure x={cribX + 250} ground={gy} s={0.45} flip pose={haul} />
    </Frame>
  );
}

// A long lever over a fulcrum: one person lifts a stone many times their weight.
export function Lever({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const k = (1 - Math.cos((f / 50) * Math.PI * 2)) / 2;
  const fulcrum: Pt = [s.left + 320, gy - 90];
  const a = -12 + 24 * k; // degrees; positive tips the long end down
  const end = (d: number): Pt => [fulcrum[0] + Math.cos(a * D) * d, fulcrum[1] + Math.sin(a * D) * d];
  const shortEnd = end(-180), longEnd = end(460);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${fulcrum[0] - 70} ${gy} L ${fulcrum[0]} ${fulcrum[1]} L ${fulcrum[0] + 70} ${gy} Z`} fill="#2a2a2a" stroke="#fff" strokeWidth={6} />
      {stone(shortEnd[0] - 150, shortEnd[1] - 290, 260, 290, "s")}
      <line x1={shortEnd[0]} y1={shortEnd[1]} x2={longEnd[0]} y2={longEnd[1]} stroke="#e6e6e6" strokeWidth={22} strokeLinecap="round" filter="url(#glow)" />
      <Figure x={longEnd[0] + 70} ground={gy} s={0.7} flip pose={{ ...STAND, t: 25 * k, ls: 60, le: 80, rs: 70, re: 90 }} />
      {big("SHORT", (fulcrum[0] + shortEnd[0]) / 2, fulcrum[1] + 90, 40, "#777")}
      {big("LONG", (fulcrum[0] + longEnd[0]) / 2, fulcrum[1] + 90, 40, "#ccc")}
    </Frame>
  );
}

// A block and tackle: ropes over four pulleys, so one person lifts a heavy stone.
export function Pulley({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const k = k01(f, 0, dur * 0.85);
  const beam = s.top + 140;
  const lowY = gy - 360 - k * 300;
  const xs = [s.cx - 80, s.cx + 20];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left} y={beam - 30} width={s.width} height={30} fill="#555" />
      {xs.map((x) => <circle key={`u${x}`} cx={x} cy={beam + 40} r={44} fill="#1a1a1a" stroke="#fff" strokeWidth={6} />)}
      {xs.map((x) => <circle key={`l${x}`} cx={x + 50} cy={lowY} r={44} fill="#1a1a1a" stroke="#fff" strokeWidth={6} />)}
      <path d={`M ${xs[0] - 44} ${beam + 40} V ${gy - 260} M ${xs[0] + 44} ${beam + 40} V ${lowY} M ${xs[0] + 6} ${lowY} V ${beam + 40} M ${xs[1] + 44} ${beam + 40} V ${lowY} M ${xs[1] + 6} ${lowY} V ${beam}`} stroke="#ddd" strokeWidth={5} />
      <line x1={s.cx + 70} y1={lowY + 44} x2={s.cx + 70} y2={lowY + 110} stroke="#ddd" strokeWidth={6} />
      {stone(s.cx - 90, lowY + 110, 320, 220, "s")}
      <Figure x={xs[0] - 110} ground={gy} s={0.7} pose={{ ...STAND, t: -10, rs: 150 - 40 * Math.abs(Math.sin(f / 6)), re: 170, ls: 120, le: 160 }} />
    </Frame>
  );
}

// A Roman treadwheel crane: a worker walks inside the wheel, the rope winds up, and the stone rises to the top.
export function Treadwheel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const c: Pt = [s.cx - 220, gy - 300];
  const R = 270;
  const k = k01(f, 0, dur * 0.9, clamp);
  const jib: Pt = [s.cx + 300, s.top + 140];
  const sy = gy - 140 - k * 560;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <line x1={c[0]} y1={c[1]} x2={jib[0]} y2={jib[1]} stroke="#ccc" strokeWidth={18} />
      <line x1={c[0] + 150} y1={gy} x2={jib[0] - 60} y2={jib[1] + 40} stroke="#888" strokeWidth={10} />
      <g transform={`rotate(${-f * 2} ${c[0]} ${c[1]})`}>
        <circle cx={c[0]} cy={c[1]} r={R} fill="none" stroke="#fff" strokeWidth={12} filter="url(#glow)" />
        {Array.from({ length: 12 }, (_, i) => {
          const q = go(c, i * 30, R);
          return <line key={i} x1={c[0]} y1={c[1]} x2={q[0]} y2={q[1]} stroke="#777" strokeWidth={6} />;
        })}
      </g>
      <path d={`M ${c[0] - 120} ${gy} L ${c[0]} ${c[1]} L ${c[0] + 120} ${gy}`} fill="none" stroke="#999" strokeWidth={12} />
      <Figure x={c[0]} ground={c[1] + R - 10} s={0.6} pose={walk(f * 0.2)} />
      <line x1={jib[0]} y1={jib[1]} x2={jib[0]} y2={sy} stroke="#ddd" strokeWidth={5} />
      <line x1={c[0]} y1={c[1]} x2={jib[0]} y2={jib[1]} stroke="#ddd" strokeWidth={4} strokeDasharray="10 8" strokeDashoffset={f * 4} />
      {stone(jib[0] - 110, sy, 220, 150, "s", k >= 1)}
    </Frame>
  );
}

// An Archimedes screw: turning the crank lifts water up the tube from the river to the field.
export function Screw({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const lo: Pt = [s.left + 60, s.bottom - 120], hi: Pt = [s.right - 120, s.top + 300];
  const len = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]);
  const ang = (Math.atan2(hi[1] - lo[1], hi[0] - lo[0]) * 180) / Math.PI;
  const off = (f * 6) % 80;
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.bottom - 160} width={s.left + 260} height={400} fill="#fff" opacity={0.1} />
      {[0, 1].map((i) => <path key={i} d={wave(s.bottom - 150 + i * 40, 8, 80, f * 2)} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={4} />)}
      <g transform={`translate(${lo[0]} ${lo[1]}) rotate(${ang})`}>
        <rect x={0} y={-70} width={len} height={140} rx={30} fill="#141414" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        {Array.from({ length: Math.ceil(len / 80) + 1 }, (_, i) => <path key={i} d={`M ${i * 80 + off - 40} -66 q 30 66 0 132`} fill="none" stroke="#aaa" strokeWidth={6} />)}
        {Array.from({ length: Math.ceil(len / 80) }, (_, i) => <ellipse key={`w${i}`} cx={i * 80 + off + 10} cy={44} rx={26} ry={14} fill="#bbb" opacity={0.7} />)}
      </g>
      <path d={`M ${hi[0] + 20} ${hi[1] - 20} H ${s.right + 40}`} stroke="#ccc" strokeWidth={14} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 20, i * 3);
        return <circle key={i} cx={hi[0] + 30 + u * 140} cy={hi[1] - 10 + u * u * 140} r={8} fill="#fff" opacity={1 - u} />;
      })}
      <line x1={hi[0]} y1={hi[1]} x2={hi[0] + Math.cos(f / 4) * 70} y2={hi[1] + Math.sin(f / 4) * 70} stroke="#fff" strokeWidth={10} strokeLinecap="round" />
      <Figure x={hi[0] - 60} ground={hi[1] + 240} s={0.5} pose={{ ...STAND, rs: 120 + 20 * Math.sin(f / 4), re: 140 }} />
    </Frame>
  );
}

// Water pours from a chute onto a turning mill wheel.
export function Waterwheel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx - 60, s.cy + 120];
  const R = 330;
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx + 260} y={s.cy - 220} width={260} height={700} fill="#1a1a1a" stroke="#ccc" strokeWidth={5} />
      <path d={`M ${s.cx + 250} ${s.cy - 220} l 140 -140 l 140 140`} fill="#262626" stroke="#ccc" strokeWidth={5} />
      <rect x={s.left - 80} y={c[1] - R - 60} width={c[0] - s.left + 120} height={36} fill="#555" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={c[0] + 20 + (i % 3) * 14} y={c[1] - R - 24 + cyc(f, 10, i * 3) * 120} width={10} height={40} fill="#fff" opacity={0.7} />)}
      <g transform={`rotate(${f * 3} ${c[0]} ${c[1]})`}>
        <circle cx={c[0]} cy={c[1]} r={R} fill="none" stroke="#fff" strokeWidth={10} filter="url(#glow)" />
        <circle cx={c[0]} cy={c[1]} r={R - 80} fill="none" stroke="#888" strokeWidth={6} />
        {Array.from({ length: 16 }, (_, i) => {
          const [a, b] = [go(c, i * 22.5, R - 80), go(c, i * 22.5, R + 30)];
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ddd" strokeWidth={14} />;
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const q = go(c, i * 45, R - 80);
          return <line key={`s${i}`} x1={c[0]} y1={c[1]} x2={q[0]} y2={q[1]} stroke="#777" strokeWidth={8} />;
        })}
      </g>
      <circle cx={c[0]} cy={c[1]} r={40} fill="#ccc" />
      <line x1={c[0]} y1={c[1]} x2={s.cx + 260} y2={c[1]} stroke="#999" strokeWidth={16} />
      <rect x={0} y={c[1] + R - 40} width={W} height={400} fill="#000" opacity={0.7} />
      {[0, 1].map((i) => <path key={i} d={wave(c[1] + R - 30 + i * 40, 10, 100, f * 4)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} />)}
    </Frame>
  );
}

// A trebuchet: the counterweight drops, the arm whips over, the sling lets go.
export function Trebuchet({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.4;
  const k = k01(f, at - 12, at + 6, { ...clamp, easing: Easing.in(Easing.cubic) });
  const piv: Pt = [s.left + 300, gy - 440];
  const ang = 230 - 175 * k; // arm direction for the long end, degrees from +x (screen, y down flips)
  const longEnd: Pt = [piv[0] + Math.cos(ang * D) * 440, piv[1] - Math.sin(ang * D) * 440];
  const shortEnd: Pt = [piv[0] - Math.cos(ang * D) * 140, piv[1] + Math.sin(ang * D) * 140];
  const fly = f > at + 4 ? k01(f, at + 4, dur, clamp) : 0;
  const rock: Pt = fly > 0 ? [longEnd[0] + fly * 700, longEnd[1] - Math.sin(fly * Math.PI) * 400 + fly * 300] : [longEnd[0] + 40, longEnd[1] + 60];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${piv[0] - 160} ${gy} L ${piv[0]} ${piv[1]} L ${piv[0] + 160} ${gy}`} fill="none" stroke="#ccc" strokeWidth={18} />
      <line x1={shortEnd[0]} y1={shortEnd[1]} x2={longEnd[0]} y2={longEnd[1]} stroke="#e6e6e6" strokeWidth={22} strokeLinecap="round" />
      <rect x={shortEnd[0] - 80} y={shortEnd[1] + 10} width={160} height={140} fill="#2a2a2a" stroke="#fff" strokeWidth={6} />
      <line x1={shortEnd[0]} y1={shortEnd[1]} x2={shortEnd[0]} y2={shortEnd[1] + 10} stroke="#fff" strokeWidth={6} />
      {fly === 0 && <line x1={longEnd[0]} y1={longEnd[1]} x2={rock[0]} y2={rock[1]} stroke="#aaa" strokeWidth={4} />}
      <circle cx={rock[0]} cy={rock[1]} r={34} fill="#ccc" stroke="#fff" strokeWidth={4} filter={fly > 0 ? "url(#glow)" : undefined} />
      {fly > 0 && fly < 0.6 && [1, 2, 3].map((i) => <circle key={i} cx={rock[0] - i * 40} cy={rock[1] + i * 10} r={34 - i * 8} fill="#fff" opacity={0.2} />)}
      <rect x={s.right - 140} y={gy - 360} width={180} height={360} fill="#1a1a1a" stroke="#888" strokeWidth={5} />
    </Frame>
  );
}

// A sundial's shadow sweeps across the hour lines as the sun crosses the sky.
export function Sundial({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const c: Pt = [s.cx, s.cy + 220];
  const k = k01(f, 0, dur, clamp);
  const sunA = 160 - 140 * k;
  const sun: Pt = [s.cx + Math.cos(sunA * D) * 420, s.top + 380 - Math.sin(sunA * D) * 260];
  const shA = 180 + sunA;
  const shTip: Pt = [c[0] + Math.cos(shA * D) * 360, c[1] - Math.sin(shA * D) * 360 * 0.35];
  return (
    <Frame p={p} t={t}>
      <circle cx={sun[0]} cy={sun[1]} r={60} fill="#fff" filter="url(#glow)" />
      <ellipse cx={c[0]} cy={c[1]} rx={400} ry={140} fill="#1f1f1f" stroke="#fff" strokeWidth={7} />
      {Array.from({ length: 11 }, (_, i) => {
        const a = 180 + 18 * i;
        return <line key={i} x1={c[0]} y1={c[1]} x2={c[0] + Math.cos(a * D) * 370} y2={c[1] - Math.sin(a * D) * 370 * 0.35} stroke="#777" strokeWidth={4} />;
      })}
      <path d={`M ${c[0]} ${c[1]} L ${shTip[0]} ${shTip[1]} L ${c[0] + 10} ${c[1] + 6} Z`} fill="#000" opacity={0.9} />
      <path d={`M ${c[0]} ${c[1]} L ${c[0]} ${c[1] - 220} L ${c[0] + 200} ${c[1]} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={4} />
      <rect x={c[0] - 260} y={c[1] + 140} width={520} height={160} fill="#262626" stroke="#ccc" strokeWidth={5} />
    </Frame>
  );
}

// A trireme: three banks of oars sweep together, the bronze ram cuts the waves.
export function Trireme({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 160;
  const stroke = Math.sin(f / 7);
  const bob = Math.sin(f / 12) * 10;
  return (
    <Frame p={p} t={t}>
      <g transform={`translate(0 ${bob})`}>
        <line x1={s.cx} y1={sea - 120} x2={s.cx} y2={sea - 560} stroke="#ccc" strokeWidth={12} />
        <rect x={s.cx - 200} y={sea - 540} width={400} height={300} fill="#e6e6e6" opacity={0.9} />
        <path d={`M ${s.left - 20} ${sea - 120} H ${s.right - 60} L ${s.right + 30} ${sea + 10} L ${s.right - 80} ${sea + 30} H ${s.left + 40} Q ${s.left - 40} ${sea - 40} ${s.left - 20} ${sea - 120} Z`} fill="#1f1f1f" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        <path d={`M ${s.right - 80} ${sea + 10} L ${s.right + 60} ${sea + 20} L ${s.right - 80} ${sea + 40} Z`} fill="#ccc" />
        <circle cx={s.right - 140} cy={sea - 70} r={20} fill="#fff" />
        {[0, 1, 2].map((row) =>
          Array.from({ length: 9 }, (_, i) => {
            const x = s.left + 120 + i * 90 + row * 20;
            const y = sea + row * 14;
            const a = 60 + stroke * 25;
            return <line key={`${row}-${i}`} x1={x} y1={y} x2={x - Math.cos(a * D) * 230} y2={y + Math.sin(a * D) * 230} stroke="#ddd" strokeWidth={6} />;
          }),
        )}
      </g>
      <rect x={0} y={sea + 50} width={W} height={600} fill="#000" opacity={0.35} />
      {[0, 1, 2].map((i) => <path key={i} d={wave(sea + 50 + i * 60, 14 - i * 3, 140, f * (6 - i))} fill="none" stroke="#fff" strokeOpacity={0.5 - i * 0.12} strokeWidth={5} />)}
    </Frame>
  );
}

// Wedges hammered into a line of slots split a block off the bedrock.
export function Quarry({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.6;
  const crack = k01(f, 0, at, clamp);
  const split = k01(f, at, at + dur * 0.25);
  const top = gy - 520, line = s.cx + 40;
  const swing = Math.sin(((f % 20) / 20) * Math.PI);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.left - 100} ${gy} V ${top} H ${line} V ${gy} Z`} fill="#1f1f1f" stroke="#ddd" strokeWidth={5} />
      <g transform={`translate(${split * 120} 0) rotate(${split * 6} ${s.right} ${gy})`}>
        <path d={`M ${line} ${top} H ${s.right + 100} V ${gy} H ${line} Z`} fill="#262626" stroke="#ddd" strokeWidth={5} filter={split > 0 ? "url(#glow)" : undefined} />
      </g>
      <polyline points={Array.from({ length: 10 }, (_, i) => `${line + ((i * 37) % 22) - 11},${top + (i * (gy - top) * crack) / 9}`).join(" ")} fill="none" stroke="#fff" strokeWidth={5} />
      <path d={`M ${line - 18} ${top - 60 + crack * 50} h 36 l -18 60 Z`} fill="#bbb" stroke="#fff" strokeWidth={3} />
      <Figure x={line - 200} ground={top} s={0.6} pose={{ ...STAND, t: 15, rs: 90 + 70 * swing, re: 100 + 70 * swing }} />
      <Ground y={gy} />
    </Frame>
  );
}

// A scroll unrolls to show its lines of writing.
export function Scroll({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur * 0.6);
  const top = s.top + 160, h = 820 * k + 40;
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 320} y={top} width={640} height={h} fill="#e6e6e6" />
      {Array.from({ length: Math.floor((h - 60) / 56) }, (_, i) => <rect key={i} x={s.cx - 260} y={top + 50 + i * 56} width={480 - ((i * 73) % 160)} height={14} rx={6} fill="#555" />)}
      {[top, top + h].map((y, i) => (
        <g key={i}>
          <rect x={s.cx - 360} y={y - 34} width={720} height={68} rx={34} fill="#cfcfcf" stroke="#fff" strokeWidth={5} filter="url(#glow)" />
          {[-1, 1].map((d) => <circle key={d} cx={s.cx + d * 380} cy={y} r={26} fill="#999" />)}
        </g>
      ))}
    </Frame>
  );
}

// A stylus presses real cuneiform signs into wet clay, one by one: "Ur-Namma, king of Ur, king of Sumer and Akkad",
// the royal title on Ur III building inscriptions (Noto Sans Cuneiform).
const TABLET = ["𒌨𒀭𒇉", "𒈗", "𒋀𒀊𒆠𒈠", "𒈗", "𒆠𒂗𒄀", "𒆠𒌵𒆤"];
export function Tablet({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const tb = { x: s.cx - 300, y: s.top + 140, w: 600, h: 800 };
  const signs = TABLET.flatMap((line, r) => Array.from(line).map((g, c) => ({ g, r, c })));
  const shown = Math.floor(k01(f, 0, dur * 0.9, clamp) * signs.length);
  const pos = (i: number): Pt => [tb.x + 90 + signs[i].c * 105, tb.y + 140 + signs[i].r * 118];
  const cur = pos(Math.min(signs.length - 1, shown));
  const press = Math.abs(Math.sin(f / 3));
  return (
    <Frame p={p} t={t}>
      <rect x={tb.x} y={tb.y} width={tb.w} height={tb.h} rx={60} fill="#3a3a3a" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
      {TABLET.slice(1).map((_, r) => <line key={r} x1={tb.x + 40} y1={tb.y + 168 + r * 118} x2={tb.x + tb.w - 40} y2={tb.y + 168 + r * 118} stroke="#2a2a2a" strokeWidth={3} />)}
      {signs.slice(0, shown).map(({ g }, i) => {
        const [x, y] = pos(i);
        return <text key={i} x={x} y={y} fontSize={84} fontFamily={font.cuneiform} fill="#111" textAnchor="middle">{g}</text>;
      })}
      <g transform={`translate(${cur[0] + 20} ${cur[1] - 60 - press * 20}) rotate(35)`}>
        <rect x={-10} y={-320} width={20} height={320} rx={6} fill="#cfcfcf" stroke="#fff" strokeWidth={3} />
        <path d="M -10 0 L 0 18 L 10 0 Z" fill="#fff" />
      </g>
    </Frame>
  );
}

// Broken columns today; the full temple fades in over them, then back to ruins.
export function Ruins({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const ghost = Math.sin(k01(f, dur * 0.1, dur * 0.9, clamp) * Math.PI);
  const cols = 6, cw = 70, top = gy - 560;
  const xs = Array.from({ length: cols }, (_, i) => s.left + 70 + i * ((s.width - 140 - cw) / (cols - 1)));
  const broken = [0.9, 0.35, 1, 0.55, 0.2, 0.7];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={s.left} y={gy - 50} width={s.width} height={50} fill="#262626" stroke="#ddd" strokeWidth={4} />
      <g opacity={ghost} stroke="#fff" strokeWidth={4} strokeDasharray="14 10" fill="none" filter="url(#glow)">
        <path d={`M ${s.left - 20} ${top} L ${s.cx} ${top - 240} L ${s.right + 20} ${top} Z`} />
        <rect x={s.left - 20} y={top} width={s.width + 40} height={60} />
        {xs.map((x) => <rect key={x} x={x} y={top + 60} width={cw} height={gy - 50 - top - 60} />)}
      </g>
      {xs.map((x, i) => {
        const h = (gy - 50 - top - 60) * broken[i];
        return (
          <g key={i}>
            <rect x={x} y={gy - 50 - h} width={cw} height={h} fill="#262626" stroke="#ddd" strokeWidth={4} />
            {Array.from({ length: 3 }, (_, j) => <line key={j} x1={x + 18 + j * 17} y1={gy - 50 - h} x2={x + 18 + j * 17} y2={gy - 50} stroke="#555" strokeWidth={3} />)}
            <path d={`M ${x} ${gy - 50 - h} l 20 -16 l 18 12 l 20 -10 l 12 14`} fill="none" stroke="#ddd" strokeWidth={4} />
          </g>
        );
      })}
      {[0, 1].map((i) => stone(s.left + 140 + i * 420, gy - 110, 140, 60, `r${i}`))}
    </Frame>
  );
}

// Brushing the sand away: an ancient pot appears in the dig, layer by layer.
export function Dig({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.cy - 40;
  const k = k01(f, 0, dur * 0.8, clamp);
  const pot: Pt = [s.cx + 60, gy + 360];
  const brush = Math.sin(f / 3) * 40;
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={gy} x2={W} y2={gy} stroke="#ddd" strokeWidth={5} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={0} y={gy + i * 150} width={W} height={150} fill={["#1a1a1a", "#202020", "#161616", "#1c1c1c"][i]} />)}
      {[0, 1, 2, 3].map((i) => <path key={`l${i}`} d={wave(gy + 150 * (i + 1), 10, 160, i * 50)} fill="none" stroke="#555" strokeWidth={3} />)}
      <defs><clipPath id="dug"><rect x={pot[0] - 200} y={pot[1] - 260} width={400} height={520 * k} /></clipPath></defs>
      <g clipPath="url(#dug)">
        <rect x={pot[0] - 200} y={pot[1] - 260} width={400} height={520} fill="#0a0a0a" />
        <path d={`M ${pot[0] - 60} ${pot[1] - 200} h 120 l -20 40 q 140 60 100 220 q -40 120 -160 120 q -120 0 -160 -120 q -40 -160 100 -220 Z`} fill="#3a3a3a" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
        <path d={`M ${pot[0] - 130} ${pot[1] + 20} h 260 M ${pot[0] - 140} ${pot[1] + 70} h 280`} stroke="#aaa" strokeWidth={5} strokeDasharray="20 12" />
      </g>
      <Figure x={pot[0] - 330} ground={gy} s={0.7} pose={{ ...SIT, t: 50, rs: 120, re: 120 + brush / 2 }} />
      {Array.from({ length: 8 }, (_, i) => {
        const u = cyc(f, 20, i * 3);
        return <circle key={i} cx={pot[0] - 120 + u * 100 + i * 10} cy={pot[1] - 260 + 520 * k - u * 120} r={5} fill="#bbb" opacity={1 - u} />;
      })}
    </Frame>
  );
}

// Inside a tomb: the lid slides off the sarcophagus and light falls in.
export function Tomb({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const at = hit ?? dur * 0.5;
  const open = k01(f, at * 0.4, at);
  const sar = { x: s.cx - 300, y: gy - 300, w: 600, h: 300 };
  return (
    <Frame p={p} t={t}>
      <rect x={s.left} y={s.top + 60} width={s.width} height={gy - s.top - 60} fill="#0d0d0d" stroke="#444" strokeWidth={4} />
      <rect x={s.left + 60} y={s.top + 160} width={160} height={300} fill="#fff" opacity={0.85} filter="url(#glow)" />
      <polygon points={`${s.left + 60},${s.top + 160} ${s.left + 220},${s.top + 160} ${sar.x + sar.w},${gy} ${sar.x - 100},${gy}`} fill="#fff" opacity={0.1 + 0.08 * open} />
      <rect x={sar.x} y={sar.y} width={sar.w} height={sar.h} fill="#262626" stroke="#ddd" strokeWidth={6} />
      {Array.from({ length: 5 }, (_, i) => <rect key={i} x={sar.x + 60 + i * 100} y={sar.y + 80} width={60} height={140} fill="none" stroke="#666" strokeWidth={4} />)}
      {open > 0.3 && <rect x={sar.x + 40} y={sar.y - 20} width={sar.w - 80} height={30} fill="#fff" opacity={open} filter="url(#glow)" />}
      <g transform={`translate(${open * 320} ${-open * 40}) rotate(${open * 8} ${sar.x + sar.w} ${sar.y})`}>
        <rect x={sar.x - 20} y={sar.y - 60} width={sar.w + 40} height={60} rx={10} fill="#3a3a3a" stroke="#fff" strokeWidth={6} />
      </g>
      {open > 0.5 && Array.from({ length: 10 }, (_, i) => <circle key={i} cx={sar.x + 60 + (i * 53) % (sar.w - 120)} cy={sar.y - 30 - cyc(f, 50, i * 5) * 260} r={4} fill="#fff" opacity={0.5 * (1 - cyc(f, 50, i * 5))} />)}
      <Figure x={sar.x - 120} ground={gy} s={0.6} pose={{ ...STAND, rs: 80, re: 80, t: 15 }} />
    </Frame>
  );
}

// A wall of real hieroglyphs lights up sign by sign under a torch, read in columns top to bottom: "life, prosperity,
// health" (ankh wedja seneb), "the good god" (netjer nefer), and Thutmose III's throne name Menkheperre in a cartouche.
const GLYPH_COLUMNS: { signs: string; cartouche?: boolean }[] = [{ signs: "𓋹𓍑𓋴" }, { signs: "𓊹𓄤" }, { signs: "𓇳𓏠𓆣", cartouche: true }, { signs: "𓋹𓍑𓋴" }];
export function Hieroglyphs({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const cw = 200, rh = 190;
  const x0 = s.cx - (GLYPH_COLUMNS.length * cw) / 2, y0 = s.top + 220;
  const signs = GLYPH_COLUMNS.flatMap((col, c) => Array.from(col.signs).map((g, r) => ({ g, c, r })));
  const shown = Math.floor(k01(f, 0, dur * 0.9, clamp) * signs.length);
  const torch: Pt = [s.right - 40, s.bottom - 260];
  return (
    <Frame p={p} t={t}>
      <rect x={x0 - 40} y={y0 - 120} width={GLYPH_COLUMNS.length * cw + 80} height={3 * rh + 160} fill="#141414" stroke="#555" strokeWidth={5} />
      {GLYPH_COLUMNS.slice(1).map((_, i) => <line key={`c${i}`} x1={x0 + (i + 1) * cw} y1={y0 - 100} x2={x0 + (i + 1) * cw} y2={y0 + 3 * rh} stroke="#333" strokeWidth={4} />)}
      {GLYPH_COLUMNS.map((col, c) => col.cartouche && <rect key={`k${c}`} x={x0 + c * cw + 22} y={y0 - 100} width={cw - 44} height={Array.from(col.signs).length * rh + 30} rx={(cw - 44) / 2} fill="none" stroke={signs.findIndex((x) => x.c === c) < shown ? "#fff" : "#444"} strokeWidth={6} />)}
      {signs.map(({ g, c, r }, i) => <text key={i} x={x0 + c * cw + cw / 2} y={y0 + r * rh + 40} fontSize={120} fontFamily={font.hiero} textAnchor="middle" fill={i < shown ? "#fff" : "#333"} filter={i === shown - 1 ? "url(#glow)" : undefined}>{g}</text>)}
      <g filter="url(#glow)">
        <path d={`M ${torch[0] - 20} ${torch[1]} Q ${torch[0] - 24} ${torch[1] - 60} ${torch[0] + Math.sin(f / 3) * 8} ${torch[1] - 100} Q ${torch[0] + 24} ${torch[1] - 60} ${torch[0] + 20} ${torch[1]} Z`} fill="#fff" />
      </g>
      <rect x={torch[0] - 10} y={torch[1]} width={20} height={160} fill="#888" />
    </Frame>
  );
}

// A moai "walks": ropes on both sides rock the statue from side to side and it shuffles forward.
export function Moai({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const rock = Math.sin(f / 10) * 7;
  const x = interpolate(f, [0, dur], [s.cx - 60, s.cx + 60]);
  const head: Pt = [x, gy - 640];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`rotate(${rock} ${x + (rock > 0 ? 110 : -110)} ${gy})`}>
        <path d={`M ${x - 120} ${gy} L ${x - 140} ${gy - 300} L ${x - 160} ${gy - 560} Q ${x - 150} ${gy - 700} ${x} ${gy - 700} Q ${x + 150} ${gy - 700} ${x + 160} ${gy - 560} L ${x + 140} ${gy - 300} L ${x + 120} ${gy} Z`} fill="#262626" stroke="#fff" strokeWidth={7} filter="url(#glow)" />
        <path d={`M ${x - 110} ${gy - 520} h 220 M ${x - 20} ${gy - 520} v 140 l 40 0 M ${x - 70} ${gy - 330} h 140`} fill="none" stroke="#aaa" strokeWidth={10} strokeLinecap="round" />
        <path d={`M ${x - 140} ${gy - 600} q -40 80 0 160 M ${x + 140} ${gy - 600} q 40 80 0 160`} fill="none" stroke="#aaa" strokeWidth={8} />
      </g>
      {[-1, 1].map((d) => (
        <g key={d}>
          <line x1={head[0] + d * 100} y1={head[1] + 40} x2={x + d * 420} y2={gy - 150} stroke="#ddd" strokeWidth={4} />
          {[0, 1].map((i) => <Figure key={i} x={x + d * (400 + i * 90)} ground={gy} s={0.4} flip={d < 0} pose={{ ...haul, t: 30 + (d * rock > 0 ? 10 : 0) }} color={i ? "#888" : "#ececec"} glow={!i} />)}
        </g>
      ))}
    </Frame>
  );
}

// A Roman road in cross-section, built layer by layer from big stones up to the paving.
export function Road({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const base = s.bottom - 60;
  const layers = [
    { h: 170, fill: "#1a1a1a", name: "BIG STONES", dots: 18 },
    { h: 130, fill: "#262626", name: "RUBBLE", dots: 40 },
    { h: 100, fill: "#333", name: "GRAVEL + LIME", dots: 80 },
    { h: 70, fill: "#cfcfcf", name: "PAVING", dots: 0 },
  ];
  let y = base;
  return (
    <Frame p={p} t={t}>
      <line x1={0} y1={base} x2={W} y2={base} stroke="#888" strokeWidth={4} />
      {layers.map((l, i) => {
        const u = k01(f, tickAt(i, layers.length, dur) - 8, tickAt(i, layers.length, dur), pop);
        y -= l.h;
        const top = y;
        if (u <= 0) return null;
        const camber = i === 3 ? 30 : 0;
        return (
          <g key={i} transform={`translate(0 ${(1 - u) * -200})`} opacity={Math.min(1, u)}>
            <path d={`M ${s.left} ${top + l.h} V ${top + camber} Q ${s.cx} ${top - camber} ${s.right} ${top + camber} V ${top + l.h} Z`} fill={l.fill} stroke="#fff" strokeWidth={4} />
            {i === 3 && Array.from({ length: 7 }, (_, j) => <line key={j} x1={s.left + (j + 1) * (s.width / 8)} y1={top + 4} x2={s.left + (j + 1) * (s.width / 8)} y2={top + l.h} stroke="#777" strokeWidth={4} />)}
            {Array.from({ length: l.dots }, (_, j) => <ellipse key={j} cx={s.left + 20 + ((j * 211) % (s.width - 40))} cy={top + 20 + ((j * 47) % Math.max(1, l.h - 40))} rx={i === 0 ? 40 : i === 1 ? 16 : 6} ry={i === 0 ? 26 : i === 1 ? 10 : 4} fill="#555" />)}
            {big(l.name, s.cx, top + l.h / 2 + 16, 42, i === 3 ? "#111" : "#bbb")}
          </g>
        );
      })}
      {[-1, 1].map((d) => <path key={d} d={`M ${s.cx + d * (s.width / 2)} ${base - 470} q ${d * 40} 0 ${d * 60} 60`} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={4} />)}
    </Frame>
  );
}

// A canal lock: the chamber fills, the boat rises, the upper gate opens and it sails on.
export function Canal({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const low = s.bottom - 160, high = s.cy - 60;
  const fill = k01(f, 0, dur * 0.6);
  const gate = k01(f, dur * 0.6, dur * 0.75);
  const go2 = k01(f, dur * 0.75, dur, clamp);
  const lvl = low - (low - high) * fill;
  const ch = { x: s.left + 60, w: 620 };
  const bx = ch.x + 300 + go2 * 500;
  return (
    <Frame p={p} t={t}>
      <rect x={ch.x + ch.w} y={high} width={W} height={H} fill="#fff" opacity={0.1} />
      <rect x={0} y={low} width={ch.x + 10} height={H} fill="#fff" opacity={0.1} />
      <rect x={ch.x} y={lvl} width={ch.w} height={s.bottom + 100 - lvl} fill="#fff" opacity={0.12} />
      <path d={wave(lvl, 6, 80, f * 2)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={4} />
      <path d={`M ${ch.x} ${low - 60} V ${s.bottom + 100} M ${ch.x + ch.w} ${high - 60} V ${s.bottom + 100} M ${ch.x + ch.w} ${high} H ${W}`} stroke="#ddd" strokeWidth={10} />
      <rect x={ch.x + ch.w - 14} y={high - 60 - gate * 280} width={28} height={low - high + 60} fill="#555" stroke="#ddd" strokeWidth={4} />
      <rect x={ch.x - 14} y={low - 60} width={28} height={120} fill="#555" stroke="#ddd" strokeWidth={4} />
      <g transform={`translate(${bx} ${lvl})`} filter="url(#glow)">
        <path d="M -170 -10 H 170 L 130 50 H -130 Z" fill="#1f1f1f" stroke="#fff" strokeWidth={6} />
        <rect x={-60} y={-80} width={120} height={70} fill="#2a2a2a" stroke="#fff" strokeWidth={5} />
      </g>
      {fill < 1 && Array.from({ length: 6 }, (_, i) => <circle key={i} cx={ch.x + ch.w - 20 - cyc(f, 16, i * 3) * 80} cy={high + 40 + cyc(f, 16, i * 3) * (lvl - high - 40)} r={7} fill="#fff" opacity={0.6} />)}
    </Frame>
  );
}

// A screw press: the bar turns, the platen presses paper onto inked type, and a printed page comes out.
export function Printing({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const u = cyc(f, 60);
  const down = Math.sin(Math.min(1, u * 2) * Math.PI);
  const pl = gy - 520 + down * 90;
  const page = Math.floor(f / 60) + 1;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => <rect key={d} x={s.cx + d * 260 - 30} y={s.top + 160} width={60} height={gy - s.top - 160} fill="#262626" stroke="#ddd" strokeWidth={5} />)}
      <rect x={s.cx - 300} y={s.top + 140} width={600} height={70} fill="#262626" stroke="#ddd" strokeWidth={5} />
      <rect x={s.cx - 22} y={s.top + 210} width={44} height={pl - s.top - 210} fill="#888" />
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={s.cx - 22} y1={s.top + 230 + i * 30 + down * 20} x2={s.cx + 22} y2={s.top + 250 + i * 30 + down * 20} stroke="#ccc" strokeWidth={4} />)}
      <line x1={s.cx - 160 * Math.cos(down * 2)} y1={s.top + 300} x2={s.cx + 160 * Math.cos(down * 2)} y2={s.top + 300} stroke="#e6e6e6" strokeWidth={14} strokeLinecap="round" />
      <rect x={s.cx - 200} y={pl} width={400} height={50} fill="#cfcfcf" stroke="#fff" strokeWidth={5} />
      <rect x={s.cx - 220} y={gy - 380} width={440} height={60} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={s.cx - 190 + i * 38} y={gy - 396} width={28} height={16} fill="#999" />)}
      <g transform={`translate(${s.cx + 340} ${gy - 300 - (u > 0.6 ? (u - 0.6) * 200 : 0)}) rotate(-8)`}>
        <rect x={-110} y={-150} width={220} height={300} fill="#e6e6e6" filter={u > 0.6 ? "url(#glow)" : undefined} />
        {Array.from({ length: 7 }, (_, i) => <rect key={i} x={-80} y={-120 + i * 36} width={160 - ((i * 37) % 60)} height={12} fill="#333" />)}
      </g>
      {big(`PAGE ${page}`, s.cx + 340, gy - 60, 50, "#888")}
      <Figure x={s.cx - 400} ground={gy} s={0.6} pose={{ ...haul, t: 20 + down * 10 }} />
    </Frame>
  );
}

// A steam engine: the piston slides, the rod turns the flywheel, steam puffs out.
export function Steam({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const a = (f / 30) * 2 * Math.PI;
  const wheel: Pt = [s.cx + 220, s.cy + 120];
  const crank: Pt = [wheel[0] + Math.cos(a) * 110, wheel[1] + Math.sin(a) * 110];
  const cyl = { x: s.left + 20, y: s.cy + 60, w: 380, h: 120 };
  const pistonX = crank[0] - 420;
  return (
    <Frame p={p} t={t}>
      <rect x={s.left - 20} y={s.top + 200} width={300} height={300} rx={40} fill="#1f1f1f" stroke="#ddd" strokeWidth={6} />
      <rect x={s.left + 90} y={s.top + 80} width={60} height={130} fill="#333" stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: 4 }, (_, i) => {
        const u = cyc(f, 30, i * 7);
        return <circle key={i} cx={s.left + 120 + Math.sin(u * 3) * 30} cy={s.top + 60 - u * 200} r={30 + u * 50} fill="#888" opacity={0.5 * (1 - u)} />;
      })}
      <rect x={cyl.x} y={cyl.y} width={cyl.w} height={cyl.h} fill="#141414" stroke="#fff" strokeWidth={7} />
      <rect x={Math.max(cyl.x + 10, Math.min(cyl.x + cyl.w - 50, pistonX))} y={cyl.y + 8} width={40} height={cyl.h - 16} fill="#cfcfcf" />
      <line x1={Math.max(cyl.x + 30, Math.min(cyl.x + cyl.w - 30, pistonX + 20))} y1={cyl.y + cyl.h / 2} x2={crank[0]} y2={crank[1]} stroke="#e6e6e6" strokeWidth={16} strokeLinecap="round" />
      <g transform={`rotate(${(a * 180) / Math.PI} ${wheel[0]} ${wheel[1]})`}>
        <circle cx={wheel[0]} cy={wheel[1]} r={250} fill="none" stroke="#fff" strokeWidth={22} filter="url(#glow)" />
        {Array.from({ length: 6 }, (_, i) => {
          const q = go(wheel, i * 60, 240);
          return <line key={i} x1={wheel[0]} y1={wheel[1]} x2={q[0]} y2={q[1]} stroke="#999" strokeWidth={12} />;
        })}
      </g>
      <circle cx={crank[0]} cy={crank[1]} r={18} fill="#fff" />
      <circle cx={wheel[0]} cy={wheel[1]} r={34} fill="#ccc" />
      <line x1={s.left - 40} y1={s.bottom - 60} x2={s.right + 40} y2={s.bottom - 60} stroke="#888" strokeWidth={6} />
    </Frame>
  );
}

// A telegraph key taps; dots and dashes run along the wire from pole to pole.
export function Telegraph({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const wireY = s.cy - 120;
  const code = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0]; // 1 = dash, 0 = dot
  const down = (f % 12) < 5;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[0, 1, 2].map((i) => {
        const x = s.left + 140 + i * 340;
        return (
          <g key={i}>
            <line x1={x} y1={wireY - 40} x2={x} y2={gy} stroke="#aaa" strokeWidth={14} />
            <line x1={x - 60} y1={wireY - 30} x2={x + 60} y2={wireY - 30} stroke="#aaa" strokeWidth={10} />
          </g>
        );
      })}
      <path d={`M -20 ${wireY} Q ${s.left + 310} ${wireY + 60} ${s.left + 480} ${wireY} T ${W + 20} ${wireY}`} fill="none" stroke="#ddd" strokeWidth={4} />
      {code.map((c, i) => {
        const x = ((f * 10 + i * 110) % (W + 200)) - 100;
        const y = wireY + 30 * Math.sin(((x + 20) / (W / 2)) * Math.PI) * 0.6;
        return c ? <rect key={i} x={x - 30} y={y - 9} width={60} height={18} rx={9} fill="#fff" filter="url(#glow)" /> : <circle key={i} cx={x} cy={y} r={11} fill="#fff" filter="url(#glow)" />;
      })}
      <rect x={s.cx - 240} y={gy - 120} width={480} height={60} rx={10} fill="#262626" stroke="#ddd" strokeWidth={5} />
      <g transform={`rotate(${down ? 6 : 0} ${s.cx - 160} ${gy - 140})`}>
        <rect x={s.cx - 180} y={gy - 160} width={340} height={26} rx={10} fill="#cfcfcf" />
        <circle cx={s.cx + 150} cy={gy - 170} r={30} fill="#e6e6e6" stroke="#fff" strokeWidth={4} />
      </g>
      <Figure x={s.cx - 380} ground={gy} s={0.7} pose={{ ...SIT, rs: 70 + (down ? 10 : 0), re: 60 }} />
      {big("·– ·· –·", s.cx + 120, gy - 230, 70, down ? "#fff" : "#666")}
    </Frame>
  );
}

// A dome built ring by ring, thinner toward the top, around an open eye of light.
export function Dome({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const c: Pt = [s.cx, gy - 420];
  const R = 420, rings = 7;
  const k = k01(f, 0, dur * 0.7, clamp) * rings;
  const beam = k01(f, dur * 0.7, dur * 0.85);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={c[0] - R} y={c[1]} width={2 * R} height={gy - c[1]} fill="#1a1a1a" stroke="#ddd" strokeWidth={5} />
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x={c[0] - R + 60 + i * 130} y={c[1] + 60} width={70} height={gy - c[1] - 60} fill="#262626" stroke="#777" strokeWidth={3} />)}
      {Array.from({ length: rings }, (_, i) => {
        const u = Math.max(0, Math.min(1, k - i));
        if (u <= 0) return null;
        const a0 = (i * 80) / rings, a1 = ((i + 1) * 80) / rings;
        const arc = (a: number, d: number) => [c[0] + d * Math.cos(a * D) * R, c[1] - Math.sin(a * D) * R] as Pt;
        return [-1, 1].map((d) => {
          const [p0, p1] = [arc(a0, d), arc(a0 + (a1 - a0) * u, d)];
          return <path key={`${i}${d}`} d={`M ${p0[0]} ${p0[1]} A ${R} ${R} 0 0 ${d > 0 ? 0 : 1} ${p1[0]} ${p1[1]}`} fill="none" stroke={i % 2 ? "#ccc" : "#fff"} strokeWidth={60 - i * 6} />;
        });
      })}
      {beam > 0 && <polygon points={`${c[0] - 60},${c[1] - R + 20} ${c[0] + 60},${c[1] - R + 20} ${c[0] + 260 * beam},${gy} ${c[0] + 40 + 140 * beam},${gy}`} fill="#fff" opacity={0.25 * beam} />}
      {beam > 0 && <ellipse cx={c[0] + 150 + 50 * beam} cy={gy - 6} rx={110} ry={16} fill="#fff" opacity={0.6 * beam} filter="url(#glow)" />}
      <Figure x={c[0] - 160} ground={gy} s={0.45} pose={{ ...STAND, t: -6 }} headDown={-30} />
    </Frame>
  );
}

// A timeline: each date drops in as it's reached, a marker travels down the line.
export function Timeline({ p, t, dur }: VisualProps<{ events: { year: string; label: string }[] }>) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = p.events.length;
  const top = s.top + 120, bot = s.bottom - 60;
  const y = (k: number) => top + ((k + 0.5) / n) * (bot - top);
  const at = (k: number) => tickAt(k, n, dur);
  const reached = p.events.filter((_, k) => f >= at(k) - 6).length;
  const markY = interpolate(f, [0, at(n - 1)], [top, y(n - 1)], clamp);
  return (
    <>
      <Frame p={{}} t={t}>
        <line x1={s.cx} y1={top} x2={s.cx} y2={bot} stroke="#444" strokeWidth={8} />
        <line x1={s.cx} y1={top} x2={s.cx} y2={markY} stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        {p.events.map((_, k) => <circle key={k} cx={s.cx} cy={y(k)} r={k < reached ? 26 : 16} fill={k < reached ? "#fff" : "#222"} stroke="#fff" strokeWidth={5} filter={k === reached - 1 ? "url(#glow)" : undefined} />)}
      </Frame>
      {p.events.map((e, k) => {
        const u = k01(f, at(k) - 6, at(k) + 4, pop);
        const left = k % 2 === 0;
        return (
          <div key={k} style={{ position: "absolute", top: y(k) - 70, [left ? "right" : "left"]: W / 2 + 60, width: W / 2 - 120, textAlign: left ? "right" : "left", opacity: Math.min(1, u), transform: `translateX(${(1 - u) * (left ? -40 : 40)}px)` }}>
            <div style={{ font: `400 84px/1 ${font.impact}`, color: "#fff", textShadow: "0 0 24px rgba(255,255,255,0.4)" }}>{e.year.toUpperCase()}</div>
            <div style={{ font: `700 34px/1.2 ${font.display}`, color: "#aaa", letterSpacing: 2 }}>{e.label.toUpperCase()}</div>
          </div>
        );
      })}
    </>
  );
}
