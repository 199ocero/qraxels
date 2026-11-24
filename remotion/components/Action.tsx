import { Easing, interpolate, useCurrentFrame } from "remotion";
import { font, stage, W, H } from "../theme.ts";
import { tickAt } from "../mono.ts";
import { D, Figure, Ground, HIP, SIT, STAND, VICTORY, clamp, go, lerp, mix, run, walk, walkRate, RUN_RATE, type Pose, type Pt } from "./Mono.tsx";
import { Frame, cyc, ease, k01, pop, type L } from "./kit.tsx";

// Fighting, pushing and breaking-through pictures. Every scene takes only an optional label.

const big = (text: string, x: number, y: number, size: number, fill = "#fff", key?: string | number) => (
  <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} fontFamily={font.impact} fill={fill}>{text}</text>
);
const sprint = (x: number, s = 1) => run((x / (RUN_RATE * s)) * Math.PI);
const burst = (c: Pt, n: number, r0: number, r1: number, f: number, key = "b") =>
  Array.from({ length: n }, (_, i) => {
    const [a, b] = [go(c, (i * 360) / n + f, r0), go(c, (i * 360) / n + f, r1)];
    return <line key={`${key}${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={8} strokeLinecap="round" />;
  });

// A sword is drawn from its sheath and gleams.
export function Sword({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 4, dur * 0.45);
  const hilt: Pt = [s.cx, s.cy + 380];
  const gleam = k01(f, dur * 0.5, dur * 0.7, clamp);
  return (
    <Frame p={p} t={t}>
      <rect x={s.cx - 50} y={s.cy - 60} width={100} height={540} rx={20} fill="#1a1a1a" stroke="#999" strokeWidth={6} />
      <g transform={`translate(0 ${80 - k * 200})`}>
        <path d={`M ${s.cx - 34} ${hilt[1] - 30} V ${s.cy - 200} L ${s.cx} ${s.cy - 280} L ${s.cx + 34} ${s.cy - 200} V ${hilt[1] - 30} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={5} filter={k >= 1 ? "url(#glow)" : undefined} />
        <line x1={s.cx} y1={hilt[1] - 40} x2={s.cx} y2={s.cy - 220} stroke="#999" strokeWidth={6} />
        <rect x={s.cx - 150} y={hilt[1] - 40} width={300} height={36} rx={14} fill="#bbb" />
        <rect x={s.cx - 24} y={hilt[1]} width={48} height={160} rx={10} fill="#777" />
        <circle cx={s.cx} cy={hilt[1] + 190} r={34} fill="#bbb" />
        {gleam > 0 && gleam < 1 && (
          <g transform={`translate(${s.cx} ${s.cy - 200 + (hilt[1] - s.cy + 200) * (1 - gleam)})`} filter="url(#glow)">
            <path d="M 0 -60 L 10 -10 L 60 0 L 10 10 L 0 60 L -10 10 L -60 0 L -10 -10 Z" fill="#fff" />
          </g>
        )}
      </g>
      <rect x={s.cx - 50} y={s.cy - 80} width={100} height={60} rx={10} fill="#333" stroke="#999" strokeWidth={5} />
    </Frame>
  );
}

// Arrows rain on a raised shield and bounce off.
export function Shield({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const sh: Pt = [s.cx + 60, gy - 380];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 24, i * 4);
        const hitU = 0.5;
        const y0 = s.top - 100, x0 = s.right + 200 - i * 40;
        const end: Pt = [sh[0] + 140 + (i % 3) * 20, sh[1] - 120 + i * 40];
        const pos: Pt = u < hitU ? lerp([x0, y0], end, u / hitU) : [end[0] + (u - hitU) * 500, end[1] + ((u - hitU) * 6) ** 2 * 20];
        const ang = u < hitU ? 210 : 210 + (u - hitU) * 900;
        return (
          <g key={i} transform={`translate(${pos[0]} ${pos[1]}) rotate(${ang})`} opacity={1 - Math.max(0, u - 0.8) * 5}>
            <line x1={0} y1={0} x2={180} y2={0} stroke="#ddd" strokeWidth={6} />
            <path d="M 0 0 l 24 -12 v 24 z" fill="#fff" />
          </g>
        );
      })}
      {f % 24 > 10 && f % 24 < 15 && burst([sh[0] + 150, sh[1]], 6, 40, 90, 0)}
      <Figure x={s.cx - 120} ground={gy} s={0.9} pose={{ ...STAND, t: 10, rs: 80, re: 80, lh: -20, lk: -10, rh: 25, rk: 10 }} />
      <path d={`M ${sh[0]} ${sh[1] - 240} q 160 0 160 60 v 180 q 0 140 -160 220 q -160 -80 -160 -220 v -180 q 0 -60 160 -60 Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={10} filter="url(#glow)" transform={`scale(0.6 1) translate(${sh[0] * 0.67 + 60} 0)`} />
    </Frame>
  );
}

// A hammer strikes glowing metal on an anvil; sparks fly.
export function Anvil({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const top = gy - 360;
  const u = cyc(f, 24);
  const swing = u < 0.6 ? -70 * Math.sin((u / 0.6) * Math.PI * 0.5) : -70 + 70 * ((u - 0.6) / 0.4) ** 2;
  const hitNow = u < 0.12;
  const piv: Pt = [s.cx + 260, top - 120];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <path d={`M ${s.cx - 320} ${top} H ${s.cx + 220} Q ${s.cx + 180} ${top + 80} ${s.cx + 100} ${top + 100} V ${top + 200} L ${s.cx + 180} ${gy} H ${s.cx - 200} L ${s.cx - 120} ${top + 200} V ${top + 100} Q ${s.cx - 220} ${top + 100} ${s.cx - 320} ${top} Z`} fill="#1a1a1a" stroke="#fff" strokeWidth={8} />
      <rect x={s.cx - 160} y={top - 40} width={260} height={40} rx={10} fill="#fff" filter="url(#glow)" />
      <g transform={`rotate(${swing} ${piv[0]} ${piv[1]})`}>
        <line x1={piv[0]} y1={piv[1]} x2={s.cx - 10} y2={top - 100} stroke="#999" strokeWidth={18} strokeLinecap="round" />
        <rect x={s.cx - 90} y={top - 160} width={130} height={110} rx={10} fill="#ccc" />
      </g>
      {hitNow && burst([s.cx - 30, top - 40], 10, 60, 160 + u * 400, f * 7)}
      {Array.from({ length: 10 }, (_, i) => {
        const v = cyc(f, 24, -i);
        return v < 0.6 ? <circle key={i} cx={s.cx - 30 + ((i * 37) % 13 - 6) * 60 * v} cy={top - 40 - 300 * v + 500 * v * v} r={5} fill="#fff" opacity={1 - v} /> : null;
      })}
    </Frame>
  );
}

// Walking straight through a wall of flames.
export function Fire({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const x = interpolate(f, [0, dur], [s.left + 40, s.right - 40]);
  const flame = (cx: number, h: number, o: number, fill: string, key: string) => {
    const w = Math.sin(f / 3 + o) * 18;
    return <path key={key} d={`M ${cx - 70} ${gy} Q ${cx - 80} ${gy - h * 0.5} ${cx + w} ${gy - h} Q ${cx + 80} ${gy - h * 0.5} ${cx + 70} ${gy} Z`} fill={fill} />;
  };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g opacity={0.6}>{Array.from({ length: 9 }, (_, i) => flame(s.left + i * 120, 380 + 120 * Math.sin(f / 5 + i), i, "#777", `b${i}`))}</g>
      <Figure x={x} ground={gy} s={0.9} pose={walk((x - s.left) / (walkRate() * 0.9))} />
      <g filter="url(#glow)">{Array.from({ length: 9 }, (_, i) => flame(s.left + 60 + i * 120, 220 + 100 * Math.sin(f / 4 + i * 2), i * 2, i % 2 ? "#fff" : "#bbb", `f${i}`))}</g>
      {Array.from({ length: 12 }, (_, i) => {
        const u = cyc(f, 40, i * 4);
        return <circle key={i} cx={s.left + (i * 83) % s.width + Math.sin(u * 6) * 30} cy={gy - 200 - u * 700} r={4} fill="#fff" opacity={1 - u} />;
      })}
    </Frame>
  );
}

// Running full speed and smashing through a brick wall.
export function Breakthrough({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.45;
  const wx = s.cx + 120;
  const x = interpolate(f, [0, at, dur], [s.left - 100, wx - 60, s.right + 40]);
  const blown = f >= at;
  const age = f - at;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 2 }, (_, c) => {
          const bx = wx + c * 80 - (r % 2) * 40;
          const by = gy - 70 - r * 70;
          const out = blown && Math.abs(by - (gy - 300)) < 260;
          const dx = out ? age * (14 + ((r * 7 + c * 3) % 10)) : 0;
          const dy = out ? -age * ((r * 5) % 9 - 4) * 2 + age * age * 0.9 : 0;
          return <rect key={`${r}${c}`} x={bx + dx} y={by + dy} width={78} height={66} fill="#1f1f1f" stroke="#ddd" strokeWidth={4} transform={out ? `rotate(${age * 12 * ((r + c) % 2 ? 1 : -1)} ${bx + dx + 39} ${by + dy + 33})` : undefined} />;
        }),
      )}
      <Figure x={x} ground={gy} s={0.85} pose={sprint(x - s.left, 0.85)} trail={[sprint(x - s.left - 30, 0.85)]} />
      {blown && age < 10 && <circle cx={wx + 40} cy={gy - 300} r={100 + age * 50} fill="none" stroke="#fff" strokeWidth={12} opacity={1 - age / 10} filter="url(#glow)" />}
    </Frame>
  );
}

// Sprinting and clearing hurdle after hurdle.
export function Hurdles({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const scroll = f * 12;
  const gap = 520;
  const fx = s.cx - 140;
  const ph = ((scroll + fx) % gap) / gap;
  const air = ph > 0.65 ? Math.sin(((ph - 0.65) / 0.35) * Math.PI) * 220 : 0;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={60} offset={scroll} />
      {Array.from({ length: 4 }, (_, i) => {
        const hx = i * gap - (scroll % gap) + 60;
        return (
          <g key={i}>
            <line x1={hx} y1={gy} x2={hx} y2={gy - 180} stroke="#999" strokeWidth={8} />
            <line x1={hx + 30} y1={gy} x2={hx + 30} y2={gy - 180} stroke="#999" strokeWidth={8} />
            <rect x={hx - 16} y={gy - 200} width={62} height={30} fill="#e6e6e6" />
          </g>
        );
      })}
      <Figure x={fx} ground={gy} air={air} s={0.75} pose={air > 0 ? { ...VICTORY, t: 25, ls: 120, le: 140, rs: -40, re: -20, lh: 80, lk: 80, rh: -40, rk: -110 } : sprint(scroll, 0.75)} />
    </Frame>
  );
}

// Tug of war: grey team on one side, you dig in and drag them over the line.
export function TugOfWar({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const k = k01(f, dur * 0.2, dur * 0.9);
  const shift = -80 + k * 240 + Math.sin(f / 3) * 6;
  const ry = gy - 280;
  const lean: Pose = { ...STAND, t: -28, ls: 80, le: 80, rs: 90, re: 90, lh: -30, lk: -10, rh: 20, rk: 10 };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <line x1={s.cx} y1={gy - 40} x2={s.cx} y2={gy + 40} stroke="#fff" strokeWidth={8} />
      <line x1={s.left - 100} y1={ry} x2={s.right + 100} y2={ry} stroke="#cfcfcf" strokeWidth={14} transform={`translate(${shift} 0)`} />
      {[0, 1, 2].map((i) => <Figure key={i} x={s.cx + 140 + i * 170 + shift} ground={gy} s={0.6} flip pose={{ ...lean, t: -lean.t * (1 - k) * -1 }} color="#555" glow={false} />)}
      <Figure x={s.cx - 220 + shift} ground={gy} s={0.75} flip pose={{ ...lean, t: 30 }} />
    </Frame>
  );
}

// Climbing a rope hand over hand.
export function Rope({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const climb = interpolate(f, [0, dur], [0, 400]);
  const u = Math.sin(f / 6);
  const hipY = s.bottom - 160 - climb;
  return (
    <Frame p={p} t={t}>
      <path d={`M ${s.cx} ${s.top - 100} Q ${s.cx + 10 * Math.sin(f / 9)} ${s.cy} ${s.cx} ${s.bottom + 200}`} fill="none" stroke="#cfcfcf" strokeWidth={22} strokeDasharray="30 6" />
      <Figure x={s.cx - 40} y={hipY} s={0.85} pose={{ ...STAND, lh: 30 + 30 * u, lk: -40, rh: 50 - 30 * u, rk: -60 }} hands={[[45, -320 - 50 * u], [45, -270 + 50 * u]]} />
      {big(`${Math.round(climb / 10)} FT`, s.right - 120, hipY - 100, 70, "#777")}
    </Frame>
  );
}

// Push-ups, rep after rep.
export function Pushup({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const k = (1 - Math.cos((f / 30) * Math.PI * 2)) / 2; // 0 up, 1 down
  const sc = 0.9;
  // The body is a plank pivoting on the feet: rotate the upright figure 90° (feet left, facing the floor), lifted by tilt.
  const tilt = 20 - 14 * k;
  const th = (90 - tilt) * D;
  const hip: Pt = [s.cx - 60, gy - HIP * sc * Math.sin(tilt * D)];
  const sh: Pt = [hip[0] + 210 * sc * Math.cos(tilt * D), hip[1] - 210 * sc * Math.sin(tilt * D)];
  const local = (w: Pt): Pt => {
    const [dx, dy] = [(w[0] - hip[0]) / sc, (w[1] - hip[1]) / sc];
    return [dx * Math.cos(th) + dy * Math.sin(th), -dx * Math.sin(th) + dy * Math.cos(th)];
  };
  return (
    <Frame p={p} t={t} over={<div style={{ position: "absolute", left: 0, right: 0, top: s.top + 160, textAlign: "center", font: `400 160px ${font.impact}`, color: "#fff" }}>{Math.floor(f / 30) + 1}</div>}>
      <Ground y={gy} />
      <g transform={`rotate(${90 - tilt} ${hip[0]} ${hip[1]})`}>
        <Figure x={hip[0]} y={hip[1]} s={sc} pose={{ ...STAND, lh: 0, lk: 0, rh: 0, rk: 0 }} hands={[local([sh[0] - 10, gy - 8]), local([sh[0] + 10, gy - 8])]} />
      </g>
      {k > 0.8 && [0, 1, 2].map((i) => <circle key={i} cx={sh[0] + 60 + i * 30} cy={gy - 20 - (k - 0.8) * 300} r={6} fill="#fff" opacity={0.5} />)}
    </Frame>
  );
}

// Skipping rope, faster and faster.
export function JumpRope({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const rate = interpolate(f, [0, dur], [16, 9], clamp);
  const ph = (f / rate) % 1;
  const air = Math.max(0, Math.sin(ph * Math.PI * 2)) * 70;
  const a = ph * 2 * Math.PI;
  const handY = gy - 330 - air;
  const ropeY = handY + 160 + Math.cos(a) * 280;
  const front = Math.sin(a) > 0;
  const ropePath = `M ${s.cx - 150} ${handY} Q ${s.cx} ${ropeY + 140 * Math.cos(a)} ${s.cx + 150} ${handY}`;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {!front && <path d={ropePath} fill="none" stroke="#999" strokeWidth={6} />}
      <Figure x={s.cx} ground={gy} air={air} s={0.9} front pose={{ ...STAND, lh: -8, lk: 8, rh: 8, rk: -8 }} hands={[[-150 / 0.9, (handY - (gy - 185 * 0.9 - air)) / 0.9], [150 / 0.9, (handY - (gy - 185 * 0.9 - air)) / 0.9]]} />
      {front && <path d={ropePath} fill="none" stroke="#fff" strokeWidth={8} filter="url(#glow)" />}
    </Frame>
  );
}

// Swimming freestyle through the waves.
export function Swim({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const sea = s.cy + 60;
  const ph = f / 10;
  const x = s.cx - 60;
  const arm = (o: number): Pt => [Math.cos(ph + o) * 180, -Math.sin(ph + o) * 140 - 20];
  return (
    <Frame p={p} t={t}>
      <g transform={`rotate(-90 ${x} ${sea})`}>
        <Figure x={x} y={sea} s={0.8} pose={{ ...STAND, lh: Math.sin(ph * 2) * 15, lk: Math.sin(ph * 2) * 15 - 10, rh: -Math.sin(ph * 2) * 15, rk: -Math.sin(ph * 2) * 15 - 10 }} hands={[[arm(0)[1], -330 + arm(0)[0]], [arm(Math.PI)[1], -330 + arm(Math.PI)[0]]]} />
      </g>
      <rect x={0} y={sea + 20} width={W} height={H} fill="#0a0a0a" opacity={0.85} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M ${-200 + ((f * (4 + i)) % 200)} ${sea + 20 + i * 70} ${Array.from({ length: 10 }, (_, j) => `q 50 ${j % 2 ? 16 : -16} 100 0`).join(" ")}`} transform={`translate(${-((f * (4 + i)) % 200) * 2} 0)`} fill="none" stroke="#fff" strokeOpacity={0.6 - i * 0.12} strokeWidth={5} />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const u = cyc(f, 20, i * 3);
        return <circle key={i} cx={x - 300 - u * 300} cy={sea + 10 - Math.sin(u * Math.PI) * 60} r={8} fill="#fff" opacity={1 - u} />;
      })}
    </Frame>
  );
}

// Pedalling a bike up a steep hill.
export function Bike({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const slope = -14;
  const c: Pt = [s.cx, s.cy + 200];
  const ph = f / 8;
  const wheel = (x: number) => (
    <g key={x}>
      <circle cx={x} cy={0} r={110} fill="none" stroke="#fff" strokeWidth={8} />
      {[0, 60, 120].map((a) => <line key={a} x1={x + Math.cos((a + f * 8) * D) * 110} y1={Math.sin((a + f * 8) * D) * 110} x2={x - Math.cos((a + f * 8) * D) * 110} y2={-Math.sin((a + f * 8) * D) * 110} stroke="#888" strokeWidth={3} />)}
    </g>
  );
  const ped = (o: number): Pt => [Math.cos(ph + o) * 50, Math.sin(ph + o) * 50];
  return (
    <Frame p={p} t={t}>
      <g transform={`rotate(${slope} ${c[0]} ${c[1]})`}>
        <line x1={-400} y1={c[1] + 110} x2={W + 400} y2={c[1] + 110} stroke="#ccc" strokeWidth={6} />
        {Array.from({ length: 10 }, (_, i) => <line key={i} x1={(i * 180 - f * 6) % (W + 400) + 0} y1={c[1] + 150} x2={(i * 180 - f * 6) % (W + 400) + 80} y2={c[1] + 150} stroke="#fff" strokeOpacity={0.2} strokeWidth={4} />)}
        <g transform={`translate(${c[0]} ${c[1]})`}>
          {wheel(-190)}
          {wheel(190)}
          <path d="M -190 0 L -40 0 L 60 -160 L -80 -160 Z M -40 0 L -110 -200 M 190 0 L 130 -230 L 70 -230" fill="none" stroke="#e6e6e6" strokeWidth={10} strokeLinejoin="round" />
          <line x1={-150} y1={-205} x2={-70} y2={-205} stroke="#e6e6e6" strokeWidth={14} />
          <circle cx={-40} cy={0} r={22} fill="none" stroke="#e6e6e6" strokeWidth={6} />
          <Figure x={-110} y={-220} s={0.75} pose={{ ...STAND, t: 35, rs: 75, re: 60, ls: 70, le: 55 }} hands={[[245 / 0.75 - 40, -15 / 0.75 - 70], [245 / 0.75 - 50, -15 / 0.75 - 60]]} headDown={-10} />
          {[0, Math.PI].map((o, i) => <circle key={i} cx={-40 + ped(o)[0]} cy={ped(o)[1]} r={14} fill="#fff" />)}
        </g>
      </g>
    </Frame>
  );
}

// Breaking the finish-line tape, arms up.
export function Finish({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const lx = s.cx + 140;
  const x = interpolate(f, [0, dur * 0.6], [s.left - 100, lx + 100], clamp);
  const broke = x > lx;
  const ty = gy - 300;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => <line key={d} x1={lx} y1={gy} x2={lx} y2={gy + 40 * d} stroke="#fff" strokeWidth={0} />)}
      <rect x={lx - 20} y={gy} width={40} height={120} fill="none" />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={lx - 20 + (i % 2) * 20} y={gy + Math.floor(i / 2) * 20} width={20} height={20} fill={(i + Math.floor(i / 2)) % 2 ? "#fff" : "#000"} />)}
      <line x1={lx - 10} y1={s.top + 120} x2={lx - 10} y2={gy} stroke="#888" strokeWidth={10} transform={`translate(${-420} 0)`} />
      <line x1={lx + 10} y1={s.top + 120} x2={lx + 10} y2={gy} stroke="#888" strokeWidth={10} transform={`translate(${380} 0)`} />
      {big("FINISH", lx - 20, s.top + 280, 90, "#fff")}
      {!broke
        ? <line x1={lx - 430} y1={ty} x2={lx + 390} y2={ty} stroke="#fff" strokeWidth={8} />
        : (
          <>
            <path d={`M ${lx - 430} ${ty} Q ${lx - 300} ${ty + 120} ${x - 60} ${ty + 30}`} fill="none" stroke="#fff" strokeWidth={8} />
            <path d={`M ${lx + 390} ${ty} Q ${lx + 300} ${ty + 160} ${x + 20} ${ty + 40}`} fill="none" stroke="#fff" strokeWidth={8} />
          </>
        )}
      <Figure x={x} ground={gy} s={0.8} pose={broke ? mix(sprint(x, 0.8), VICTORY, k01(f, dur * 0.6, dur * 0.75)) : sprint(x - s.left, 0.8)} />
    </Frame>
  );
}

// Crouched in the starting blocks; the gun fires, you explode out.
export function Start({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 60;
  const at = hit ?? dur * 0.5;
  const go2 = f >= at;
  const x = go2 ? s.left + 160 + ((f - at) ** 1.5) * 2.5 : s.left + 160;
  const crouch: Pose = { t: 70, ls: 95, le: 95, rs: 95, re: 95, lh: 70, lk: -50, rh: 100, rk: -20 };
  return (
    <Frame p={p} t={t} over={!go2 ? <div style={{ position: "absolute", left: 0, right: 0, top: s.top + 140, textAlign: "center", font: `400 150px ${font.impact}`, color: "#fff" }}>{f < at * 0.5 ? "READY" : "SET"}</div> : undefined}>
      <Ground y={gy} dash={60} offset={go2 ? (f - at) * 30 : 0} />
      <path d={`M ${s.left + 60} ${gy} l 60 -60 v 60 M ${s.left + 140} ${gy} l 50 -50 v 50`} fill="#888" stroke="#ccc" strokeWidth={5} />
      {go2 && f - at < 8 && burst([s.right - 160, s.top + 260], 10, 40, 120 + (f - at) * 20, 0)}
      {go2 && f - at < 8 && big("BANG", s.right - 160, s.top + 290, 80)}
      <Figure x={x} ground={gy} s={0.8} pose={go2 ? sprint(x, 0.8) : crouch} trail={go2 ? [sprint(x - 30, 0.8), sprint(x - 60, 0.8)] : []} />
    </Frame>
  );
}

// 3, 2, 1, GO slamming in.
export function Countdown({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 4;
  const k = Math.min(n - 1, Math.floor((f / (dur * 0.9)) * n));
  const u = ((f / (dur * 0.9)) * n) % 1;
  const txt = ["3", "2", "1", "GO"][k];
  const sc = 1.6 - 0.6 * Math.min(1, u * 4);
  return (
    <Frame p={p} t={t}>
      <circle cx={s.cx} cy={s.cy} r={380} fill="none" stroke="#333" strokeWidth={20} />
      <circle cx={s.cx} cy={s.cy} r={380} fill="none" stroke="#fff" strokeWidth={20} pathLength={100} strokeDasharray={`${u * 100} 100`} transform={`rotate(-90 ${s.cx} ${s.cy})`} filter="url(#glow)" />
      <g transform={`translate(${s.cx} ${s.cy + 130}) scale(${sc})`} opacity={Math.min(1, u * 5)}>{big(txt, 0, 0, txt === "GO" ? 300 : 380, "#fff")}</g>
    </Frame>
  );
}

// Holding up a hydraulic press that's crushing down.
export function Press({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const push = k01(f, dur * 0.5, dur * 0.9);
  const plateY = gy - 470 - push * 120 + Math.sin(f * 2) * 3 * (1 - push);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {[-1, 1].map((d) => <rect key={d} x={s.cx + d * 380 - 30} y={s.top + 80} width={60} height={gy - s.top - 80} fill="#1a1a1a" stroke="#aaa" strokeWidth={5} />)}
      <rect x={s.cx - 60} y={s.top + 80} width={120} height={plateY - s.top - 80} fill="#555" />
      <rect x={s.cx - 350} y={plateY - 80} width={700} height={80} rx={10} fill="#cfcfcf" stroke="#fff" strokeWidth={6} />
      <Figure x={s.cx} ground={gy} s={0.9} front pose={{ ...STAND, lh: -14, lk: 6, rh: 14, rk: -6 }} hands={[[-90, (plateY - (gy - 185 * 0.9)) / 0.9], [90, (plateY - (gy - 185 * 0.9)) / 0.9]]} headDown={-10 + 20 * (1 - push)} />
      {push < 1 && [0, 1, 2].map((i) => <circle key={i} cx={s.cx + (i - 1) * 60} cy={plateY + 60 + cyc(f, 20, i * 7) * 200} r={6} fill="#fff" opacity={0.5 * (1 - cyc(f, 20, i * 7))} />)}
    </Frame>
  );
}

// Carrying the world on your shoulders, still walking.
export function Atlas({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const ph = f * 0.06;
  const bob = Math.abs(Math.sin(ph)) * 8;
  const c: Pt = [s.cx + 10, gy - 640 + bob];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} dash={50} offset={f * 2} />
      <Figure x={s.cx - 40} ground={gy} s={0.9} pose={{ ...walk(ph, 0.35), t: 18, rs: 160, re: 170, ls: 150, le: 165 }} headDown={30} />
      <g transform={`rotate(${f * 0.5} ${c[0]} ${c[1]})`}>
        <circle cx={c[0]} cy={c[1]} r={220} fill="#1a1a1a" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
        {[-0.5, 0, 0.5].map((k) => <ellipse key={k} cx={c[0]} cy={c[1] + k * 300} rx={Math.sqrt(1 - k * k) * 220} ry={30} fill="none" stroke="#555" strokeWidth={3} />)}
        <ellipse cx={c[0]} cy={c[1]} rx={100} ry={220} fill="none" stroke="#555" strokeWidth={3} />
        <path d={`M ${c[0] - 120} ${c[1] - 80} q 60 -60 120 -20 q 40 60 -20 100 Z M ${c[0] + 40} ${c[1] + 60} q 80 -10 100 60 q -60 40 -100 -20 Z`} fill="#777" />
      </g>
    </Frame>
  );
}

// A long tunnel; light at the end grows as you walk toward it.
export function Tunnel({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 0, dur, clamp);
  const c: Pt = [s.cx, s.cy - 40];
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 9 }, (_, i) => {
        const z = ((i + (f * 0.06) % 1) / 9);
        const r = 60 + z * z * 900;
        return <rect key={i} x={c[0] - r * 0.8} y={c[1] - r} width={r * 1.6} height={r * 2} rx={r * 0.8} fill="none" stroke="#fff" strokeWidth={2 + z * 8} opacity={0.15 + 0.35 * z} />;
      })}
      <ellipse cx={c[0]} cy={c[1]} rx={50 + k * 150} ry={70 + k * 200} fill="#fff" filter="url(#glow)" />
      <Figure x={c[0]} ground={s.bottom - 120 - k * 200} s={0.9 - 0.55 * k} back pose={walk(f * 0.15, 0.5)} color="#ececec" />
    </Frame>
  );
}

// Everyone rides the down escalator; you run up it.
export function Escalator({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const a: Pt = [s.left - 40, s.bottom - 40], b: Pt = [s.right + 40, s.top + 200];
  const steps = 14;
  const u = cyc(f, 40);
  const me = 0.3 + 0.4 * k01(f, 0, dur, clamp);
  const at = (k: number) => lerp(a, b, k);
  return (
    <Frame p={p} t={t}>
      <path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${b[0]} ${b[1] + 160} L ${a[0]} ${a[1] + 160} Z`} fill="#141414" stroke="#ccc" strokeWidth={6} />
      {Array.from({ length: steps }, (_, i) => {
        const k = ((i + 1 - u) % steps) / steps;
        const [x, y] = at(k);
        return <path key={i} d={`M ${x} ${y} h 70 v -50`} fill="none" stroke="#666" strokeWidth={4} />;
      })}
      <path d={`M ${a[0]} ${a[1] - 200} L ${b[0]} ${b[1] - 200}`} fill="none" stroke="#999" strokeWidth={10} />
      {[0.15, 0.55, 0.85].map((k0, i) => {
        const k = (k0 - u * 0.1 + 1) % 1;
        const [x, y] = at(k);
        return <Figure key={i} x={x} ground={y} s={0.45} flip pose={STAND} color="#555" glow={false} headDown={30} />;
      })}
      {(() => {
        const [x, y] = at(me);
        return <Figure x={x} ground={y} s={0.55} pose={{ ...sprint(f * 8, 0.55), t: 25 }} />;
      })()}
    </Frame>
  );
}

// Elevator doors part at the top floor; light pours out.
export function Elevator({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const open = k01(f, dur * 0.5, dur * 0.75);
  const floor = Math.min(99, Math.floor(interpolate(f, [0, dur * 0.5], [1, 99], { ...clamp, easing: Easing.in(Easing.quad) })));
  const d = { x: s.cx - 260, w: 520, top: gy - 820 };
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <rect x={d.x - 40} y={d.top - 140} width={d.w + 80} height={gy - d.top + 140} fill="#111" stroke="#aaa" strokeWidth={6} />
      <rect x={s.cx - 120} y={d.top - 120} width={240} height={90} rx={10} fill="#000" stroke="#666" strokeWidth={4} />
      {big(`${floor}`, s.cx, d.top - 45, 80, floor === 99 ? "#fff" : "#888")}
      <rect x={d.x} y={d.top} width={d.w} height={gy - d.top} fill="#fff" filter="url(#glow)" />
      <Figure x={s.cx} ground={gy} s={0.9} front pose={mix(STAND, VICTORY, k01(f, dur * 0.75, dur * 0.9))} color="#000" glow={false} />
      <rect x={d.x} y={d.top} width={(d.w / 2) * (1 - open)} height={gy - d.top} fill="#2a2a2a" stroke="#888" strokeWidth={4} />
      <rect x={d.x + d.w / 2 + (d.w / 2) * open} y={d.top} width={(d.w / 2) * (1 - open)} height={gy - d.top} fill="#2a2a2a" stroke="#888" strokeWidth={4} />
      <polygon points={`${d.x},${gy} ${d.x + d.w},${gy} ${d.x + d.w + 300},${gy + 300} ${d.x - 300},${gy + 300}`} fill="#fff" opacity={0.25 * open} />
    </Frame>
  );
}

// Standing in the rain under an umbrella; the sun breaks through, it closes.
export function Umbrella({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const sun = k01(f, dur * 0.5, dur * 0.8);
  const fold = sun;
  const top: Pt = [s.cx + 60, gy - 600];
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <circle cx={s.right - 120} cy={s.top + 160} r={110} fill="#fff" opacity={sun} filter="url(#glow)" />
      {Array.from({ length: 50 }, (_, i) => {
        const y = ((i * 211 + f * 30) % (gy - s.top)) + s.top;
        const x = (i * 157) % W;
        const under = Math.abs(x - top[0]) < 280 && y > top[1];
        return under ? null : <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 36} stroke="#fff" strokeOpacity={0.35 * (1 - sun)} strokeWidth={3} />;
      })}
      <Figure x={s.cx - 20} ground={gy} s={0.9} pose={mix({ ...STAND, rs: 150, re: 170 }, VICTORY, sun)} headDown={-10 * sun} />
      <line x1={top[0]} y1={top[1]} x2={top[0]} y2={gy - 340} stroke="#ccc" strokeWidth={8} />
      <path d={`M ${top[0] - 300 * (1 - fold * 0.85)} ${top[1] + 60 + fold * 140} Q ${top[0]} ${top[1] - 160 * (1 - fold)} ${top[0] + 300 * (1 - fold * 0.85)} ${top[1] + 60 + fold * 140} ${Array.from({ length: 4 }, (_, i) => `q ${-75 * (1 - fold * 0.85)} -30 ${-150 * (1 - fold * 0.85)} 0`).join(" ")} Z`} fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
    </Frame>
  );
}

// A fist clenches tight and trembles.
export function Fist({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const k = k01(f, 4, dur * 0.4);
  const sh = k >= 1 ? Math.sin(f * 2.7) * 5 : 0;
  const c: Pt = [s.cx + sh, s.cy];
  return (
    <Frame p={p} t={t}>
      {k >= 1 && burst(c, 12, 360, 420 + 30 * Math.sin(f / 3), f)}
      <rect x={c[0] - 150} y={c[1] + 150} width={300} height={500} rx={40} fill="#cfcfcf" stroke="#fff" strokeWidth={6} />
      <rect x={c[0] - 230} y={c[1] - 200} width={420} height={380} rx={90} fill="#e6e6e6" stroke="#fff" strokeWidth={8} filter="url(#glow)" />
      {[0, 1, 2, 3].map((i) => {
        const y = c[1] - 200 + i * 92;
        const curl = 1 - k;
        return <rect key={i} x={c[0] + 120 - curl * 0} y={y + 4} width={110 + curl * 160} height={84} rx={40} fill="#e6e6e6" stroke="#999" strokeWidth={5} />;
      })}
      <path d={`M ${c[0] - 230} ${c[1] - 40} q ${100 + 120 * k} ${-20 - 60 * k} ${200 + 120 * k} ${40 - 80 * k}`} fill="none" stroke="#999" strokeWidth={50 * 0 + 8} />
      <rect x={c[0] - 260 + 80 * k} y={c[1] - 20 - 60 * k} width={260} height={90} rx={45} fill="#e6e6e6" stroke="#999" strokeWidth={5} transform={`rotate(${-30 + 30 * k} ${c[0] - 200} ${c[1]})`} />
    </Frame>
  );
}

// A heart monitor: the line flatlines, then a beat kicks back in, stronger.
export function Heartbeat({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const y0 = s.cy + 40;
  const at = hit ?? dur * 0.45;
  const n = 120;
  const head = (f * 12) % (s.width + 200);
  const amp = (x: number) => {
    const fx = f - (head - x) / 12;
    if (fx < at * 0.4) return 1;
    if (fx < at) return 0;
    return 1.5;
  };
  const pts = Array.from({ length: n }, (_, i) => {
    const x = s.left + (i * s.width) / (n - 1);
    if (x > s.left + head) return null;
    const m = ((x - s.left) % 260) / 260;
    const spike = m > 0.4 && m < 0.5 ? (m < 0.45 ? -(m - 0.4) * 20 : (m - 0.5) * 20) * 200 : m > 0.5 && m < 0.55 ? (m - 0.5) * 2400 * 0.5 : 0;
    return `${x},${y0 + spike * amp(x - s.left)}`;
  }).filter(Boolean);
  const beat = f >= at && (f - at) % 20 < 6;
  return (
    <Frame p={p} t={t}>
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={s.left} y1={s.cy - 300 + i * 120} x2={s.right} y2={s.cy - 300 + i * 120} stroke="#fff" strokeOpacity={0.06} strokeWidth={2} />)}
      <polyline points={pts.join(" ")} fill="none" stroke="#fff" strokeWidth={8} strokeLinejoin="round" filter="url(#glow)" />
      <path d={`M ${s.cx} ${s.top + 260} c -40 -60 -150 -30 -120 60 c 20 50 120 110 120 110 c 0 0 100 -60 120 -110 c 30 -90 -80 -120 -120 -60 Z`} fill={beat ? "#fff" : "#444"} transform={`translate(${s.cx} ${s.top + 300}) scale(${beat ? 1.25 : 1}) translate(${-s.cx} ${-s.top - 300})`} filter={beat ? "url(#glow)" : undefined} />
    </Frame>
  );
}

// Falling, then the parachute bursts open.
export function Parachute({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const at = hit ?? dur * 0.35;
  const open = k01(f, at, at + 10, pop);
  const sway = open > 0 ? Math.sin((f - at) / 15) * 8 : 0;
  const y = s.cy + 120 + (open > 0 ? Math.sin((f - at) / 20) * 20 : 0);
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 10 }, (_, i) => {
        const sp = open > 0 ? 6 : 40;
        const yy = s.bottom + 200 - ((i * 211 + f * sp) % (s.height + 400));
        return <line key={i} x1={(i * 157) % W} y1={yy} x2={(i * 157) % W} y2={yy + (open > 0 ? 40 : 200)} stroke="#fff" strokeOpacity={0.2} strokeWidth={4} />;
      })}
      <g transform={`rotate(${sway} ${s.cx} ${y - 300})`}>
        {open > 0 && (
          <g transform={`translate(${s.cx} ${y - 560}) scale(${open})`}>
            <path d="M -360 80 Q -360 -220 0 -220 Q 360 -220 360 80 Q 270 40 180 80 Q 90 40 0 80 Q -90 40 -180 80 Q -270 40 -360 80 Z" fill="#e6e6e6" stroke="#fff" strokeWidth={6} filter="url(#glow)" />
            {[-180, 0, 180].map((x) => <path key={x} d={`M ${x} 80 Q ${x * 0.6} -100 ${x * 0.3} -215`} fill="none" stroke="#999" strokeWidth={4} />)}
            {[-360, -180, 0, 180, 360].map((x) => <line key={x} x1={x} y1={80} x2={0} y2={430} stroke="#bbb" strokeWidth={3} />)}
          </g>
        )}
        <Figure x={s.cx} y={y} s={0.75} front pose={open > 0 ? { ...STAND, lh: -10, rh: 10 } : { ...VICTORY, ls: 120, rs: -120, lh: -30, rh: 30, lk: 30, rk: -30 }} hands={open > 0 ? [[-120, -400], [120, -400]] : undefined} />
      </g>
    </Frame>
  );
}

// Climbing up out of a deep hole into the light.
export function Pit({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const rim = s.top + 420;
  const k = k01(f, 0, dur * 0.85);
  const hipY = s.bottom - 60 - k * (s.bottom - rim - 40);
  const u = Math.sin(f / 5);
  return (
    <Frame p={p} t={t}>
      <rect x={0} y={s.top - 300} width={W} height={rim - s.top + 300} fill="#fff" opacity={0.12} />
      <rect x={s.cx - 260} y={rim} width={520} height={s.bottom - rim + 300} fill="#0d0d0d" />
      {[-1, 1].map((d) => <path key={d} d={`M ${s.cx + d * 260} ${rim} ${Array.from({ length: 8 }, (_, i) => `L ${s.cx + d * (260 + (i % 2 ? 20 : -10))} ${rim + (i + 1) * 120}`).join(" ")}`} fill="none" stroke="#ccc" strokeWidth={8} />)}
      <line x1={0} y1={rim} x2={s.cx - 260} y2={rim} stroke="#fff" strokeWidth={8} />
      <line x1={s.cx + 260} y1={rim} x2={W} y2={rim} stroke="#fff" strokeWidth={8} />
      <Figure x={s.cx} y={hipY} s={0.85} back pose={{ ...STAND, lh: -20 + 30 * u, lk: -40, rh: 20 - 30 * u, rk: -40 }} hands={[[-230, -320 + 40 * u], [230, -320 - 40 * u]]} color={k > 0.7 ? "#ececec" : "#999"} />
    </Frame>
  );
}

// Shattering a glass ceiling from below.
export function Ceiling({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const cy = s.top + 360;
  const at = hit ?? dur * 0.45;
  const k = k01(f, 0, at, { ...clamp, easing: Easing.in(Easing.quad) });
  const broke = f >= at;
  const age = f - at;
  const fy = s.bottom - 40 - k * (s.bottom - 40 - cy - 340) - (broke ? Math.min(250, age * 14) : 0);
  return (
    <Frame p={p} t={t}>
      {!broke && <rect x={0} y={cy - 10} width={W} height={20} fill="#fff" opacity={0.35} />}
      {!broke && <line x1={0} y1={cy - 10} x2={W} y2={cy - 10} stroke="#fff" strokeWidth={4} />}
      {broke && Array.from({ length: 18 }, (_, i) => {
        const x0 = s.cx + (i - 9) * 50;
        const vx = (i - 9) * 4;
        return <polygon key={i} points={`0,0 ${30 + (i % 3) * 15},${(i % 2) * 20 - 10} ${10},${30}`} fill="#fff" opacity={Math.max(0, 1 - age / 30)} transform={`translate(${x0 + vx * age} ${cy - age * 8 + age * age * 0.6}) rotate(${age * 20 * (i % 2 ? 1 : -1)})`} />;
      })}
      {broke && age < 10 && <circle cx={s.cx} cy={cy} r={80 + age * 40} fill="none" stroke="#fff" strokeWidth={10} opacity={1 - age / 10} filter="url(#glow)" />}
      {[0, 1, 2].map((i) => <line key={i} x1={i * 400} y1={cy - 10} x2={i * 400 + 200} y2={cy - 10} stroke="#000" strokeWidth={2} opacity={broke ? 0 : 0.5} />)}
      <Figure x={s.cx} ground={fy} s={0.85} front pose={{ ...VICTORY, ls: 175, le: 178, rs: -175, re: -178 }} trail={!broke ? [VICTORY] : []} />
    </Frame>
  );
}

// Flying through the clouds, cape-style, fist forward.
export function Fly({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const bob = Math.sin(f / 10) * 30;
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: 7 }, (_, i) => {
        const x = W - ((i * 240 + f * (14 + (i % 3) * 6)) % (W + 500)) + 250;
        const y = s.top + 80 + (i * 173) % (s.height - 100);
        return <g key={i} opacity={0.12 + (i % 3) * 0.08}>{[-1, 0, 1].map((d) => <circle key={d} cx={x + d * 90} cy={y - (d === 0 ? 40 : 0)} r={d === 0 ? 100 : 70} fill="#fff" />)}</g>;
      })}
      {Array.from({ length: 10 }, (_, i) => <line key={`l${i}`} x1={W - ((i * 160 + f * 40) % (W + 300))} y1={s.top + 60 + i * 95} x2={W - ((i * 160 + f * 40) % (W + 300)) + 220} y2={s.top + 60 + i * 95} stroke="#fff" strokeOpacity={0.25} strokeWidth={4} />)}
      <g transform={`rotate(-80 ${s.cx} ${s.cy + bob})`}>
        <path d={`M ${s.cx - 30} ${s.cy + bob - 300} Q ${s.cx - 160 + Math.sin(f / 3) * 30} ${s.cy + bob - 40} ${s.cx - 120} ${s.cy + bob + 220} L ${s.cx + 40} ${s.cy + bob - 300} Z`} fill="#777" />
        <Figure x={s.cx} y={s.cy + bob} s={0.85} pose={{ ...STAND, ls: 178, le: 178, rs: 10, re: 20, lh: -4, lk: -10, rh: 6, rk: -30 }} />
      </g>
    </Frame>
  );
}

// A tornado tears past; the figure doesn't move.
export function Tornado({ p, t, dur }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const tx = interpolate(f, [0, dur], [s.right - 60, s.left + 160]);
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      {Array.from({ length: 14 }, (_, i) => {
        const y = gy - i * 60;
        const w = 40 + i * i * 2.6;
        const x = tx + Math.sin(f / 6 + i * 0.5) * (10 + i * 4);
        return <ellipse key={i} cx={x} cy={y} rx={w} ry={18 + i} fill="none" stroke="#ccc" strokeWidth={6} strokeDasharray={`${40 + i * 6} 20`} strokeDashoffset={-f * (10 + i)} opacity={0.4 + i * 0.03} />;
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const a = f / 4 + i * 0.8;
        const r = 120 + (i * 37) % 160;
        return <rect key={`d${i}`} x={tx + Math.cos(a) * r} y={gy - 200 - i * 70 + Math.sin(a) * 30} width={26} height={18} fill="#aaa" transform={`rotate(${f * 20 + i * 45} ${tx + Math.cos(a) * r} ${gy - 200 - i * 70})`} />;
      })}
      <Figure x={s.cx + 120} ground={gy} s={0.9} front pose={{ ...STAND, lh: -14, lk: -14, rh: 14, rk: 14 }} headDown={-5} />
    </Frame>
  );
}

// The pawn crosses the board and becomes a queen; the king tips over.
export function Chess({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const n = 6, cell = 150;
  const x0 = s.cx - (n * cell) / 2, y0 = s.cy - (n * cell) / 2 + 60;
  const at = hit ?? dur * 0.6;
  const k = k01(f, 4, at * 0.9);
  const px = x0 + 2 * cell + cell / 2;
  const py = y0 + (n - 0.5) * cell - k * (n - 1) * cell;
  const queen = f >= at;
  const tip = k01(f, at + 6, at + 20, { ...clamp, easing: Easing.in(Easing.quad) });
  const piece = (x: number, y: number, kind: "pawn" | "queen" | "king", fill: string) => (
    <g transform={`translate(${x} ${y})`} filter={kind === "queen" ? "url(#glow)" : undefined}>
      <path d="M -50 0 H 50 L 35 -30 H -35 Z" fill={fill} stroke="#fff" strokeWidth={4} />
      <path d={kind === "pawn" ? "M -25 -30 L -15 -80 H 15 L 25 -30 Z" : "M -30 -30 L -20 -130 H 20 L 30 -30 Z"} fill={fill} stroke="#fff" strokeWidth={4} />
      {kind === "pawn" && <circle cy={-100} r={30} fill={fill} stroke="#fff" strokeWidth={4} />}
      {kind === "queen" && <path d="M -40 -130 l 10 -50 l 20 30 l 10 -40 l 10 40 l 20 -30 l 10 50 Z" fill={fill} stroke="#fff" strokeWidth={4} />}
      {kind === "king" && <path d="M -8 -130 v -60 M -28 -170 h 56" stroke={fill === "#fff" ? "#fff" : "#888"} strokeWidth={12} />}
    </g>
  );
  return (
    <Frame p={p} t={t}>
      {Array.from({ length: n * n }, (_, i) => <rect key={i} x={x0 + (i % n) * cell} y={y0 + Math.floor(i / n) * cell} width={cell} height={cell} fill={(i + Math.floor(i / n)) % 2 ? "#1a1a1a" : "#3a3a3a"} />)}
      <rect x={x0} y={y0} width={n * cell} height={n * cell} fill="none" stroke="#ccc" strokeWidth={6} />
      <g transform={`rotate(${tip * 80} ${x0 + 4 * cell + cell / 2 + 50} ${y0 + cell * 0.85})`}>{piece(x0 + 4 * cell + cell / 2, y0 + cell * 0.85, "king", "#555")}</g>
      {piece(px, py + cell * 0.35, queen ? "queen" : "pawn", "#fff")}
    </Frame>
  );
}

// A house of cards wobbles and collapses.
export function Cards({ p, t, dur, hit }: L) {
  const f = useCurrentFrame();
  const s = stage(t);
  const gy = s.bottom - 40;
  const at = hit ?? dur * 0.45;
  const fall = k01(f, at, at + dur * 0.3, { ...clamp, easing: Easing.in(Easing.quad) });
  const wob = f < at ? Math.sin(f / 3) * 2 * (f / at) : 0;
  const levels = 4, ch = 200, cw = 120;
  return (
    <Frame p={p} t={t}>
      <Ground y={gy} />
      <g transform={`rotate(${wob} ${s.cx} ${gy})`}>
        {Array.from({ length: levels }, (_, l) => {
          const n = levels - l;
          return Array.from({ length: n }, (_, c) => {
            const x = s.cx + (c - (n - 1) / 2) * cw * 1.3;
            const y = gy - l * ch;
            const seed = l * 5 + c;
            const dx = fall * ((seed % 5) - 2) * 120;
            const dy = fall * l * ch;
            const r = fall * ((seed % 2 ? 1 : -1) * (60 + (seed % 3) * 20));
            return (
              <g key={`${l}${c}`} transform={`translate(${dx} ${dy}) rotate(${r} ${x} ${y - ch / 2})`}>
                <path d={`M ${x - cw / 2} ${y} L ${x} ${y - ch} L ${x + cw / 2} ${y}`} fill="none" stroke="#e6e6e6" strokeWidth={12} strokeLinejoin="round" />
                {l < levels - 1 && c < n - 1 && <line x1={x} y1={y - ch} x2={x + cw * 1.3} y2={y - ch} stroke="#bbb" strokeWidth={10} />}
              </g>
            );
          });
        })}
      </g>
    </Frame>
  );
}
