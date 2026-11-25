import { Figure, STAND } from "./components/Mono.tsx";
import { font } from "./theme.ts";

// Channel art (YouTube + Facebook), rendered as stills: `npx remotion still remotion/index.ts <id> out.png`.
// Sizes (2026): YouTube avatar 800², banner 2560x1440 (safe area 1546x423 centred);
// Facebook page avatar 320² min (rendered 720²), cover 851x315 (rendered 2x).

const NAME = "QRAXELS";
const TAG = "BIG IDEAS · EXPLAINED IN BLACK AND WHITE";

export function Defs() {
  return (
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={10} result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="eyeglow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation={5} result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <radialGradient id="spot" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#2a2a2a" />
        <stop offset="60%" stopColor="#0a0a0a" />
        <stop offset="100%" stopColor="#000" />
      </radialGradient>
    </defs>
  );
}

export function Backdrop({ w, h }: { w: number; h: number }) {
  return (
    <>
      <rect width={w} height={h} fill="url(#spot)" />
      <rect width={w} height={h} filter="url(#grain)" opacity={0.07} />
    </>
  );
}

// The mascot, front-facing, feet on `ground` (scale 1: about 430 px tall). Scaled through `s`, not an outer transform,
// so the 3D figure renders at the size it's shown (sharp at 3x in the avatar).
const Mascot = ({ x, ground, s = 1, pose = STAND }: { x: number; ground: number; s?: number; pose?: typeof STAND }) => <Figure x={x} ground={ground} s={s} pose={pose} front />;

function Avatar({ size }: { size: number }) {
  const k = size / 800;
  return (
    <svg width={size} height={size} viewBox="0 0 800 800">
      <Defs />
      <Backdrop w={800} h={800} />
      {/* Head and chest fill the circle crop; legs fall off the bottom. */}
      <Mascot x={375} ground={1480} s={3} />
      <circle cx={400} cy={400} r={392} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={4 / k} />
    </svg>
  );
}

function Wordmark({ x, y, size, anchor = "start", tag = true }: { x: number; y: number; size: number; anchor?: "start" | "middle"; tag?: boolean }) {
  return (
    <>
      <text x={x} y={y} fontFamily={font.impact} fontSize={size} fill="#fff" letterSpacing={size * 0.06} textAnchor={anchor} filter="url(#glow)">{NAME}</text>
      {tag && <text x={x} y={y + size * 0.42} fontFamily={font.mono} fontWeight={700} fontSize={size * 0.135} fill="#8c8c8c" letterSpacing={size * 0.02} textAnchor={anchor}>{TAG}</text>}
    </>
  );
}

// Faint perspective floor lines, like the office backdrop.
function Floor({ w, y, h }: { w: number; y: number; h: number }) {
  return (
    <g stroke="#fff" strokeOpacity={0.08} strokeWidth={2}>
      <line x1={0} y1={y} x2={w} y2={y} strokeOpacity={0.25} />
      {Array.from({ length: 25 }, (_, i) => <line key={i} x1={w / 2 + (i - 12) * 40} y1={y} x2={w / 2 + (i - 12) * w * 0.12} y2={y + h} />)}
    </g>
  );
}

export function YouTubeAvatar() { return <Avatar size={800} />; }
export function FacebookAvatar() { return <Avatar size={720} />; }

export function YouTubeBanner() {
  const W = 2560, H = 1440, gy = H / 2 + 200;
  return (
    <svg width={W} height={H}>
      <Defs />
      <Backdrop w={W} h={H} />
      <Floor w={W} y={gy} h={H - gy} />
      {/* Everything that matters sits in the 1546x423 centre (x 507-2053, y 508-931). */}
      <Mascot x={W / 2 - 560} ground={gy - 18} s={0.95} />
      <Wordmark x={W / 2 - 360} y={H / 2 + 50} size={230} />
    </svg>
  );
}

export function FacebookCover() {
  const W = 1702, H = 630, gy = 540;
  return (
    <svg width={W} height={H}>
      <Defs />
      <Backdrop w={W} h={H} />
      <Floor w={W} y={gy} h={H - gy} />
      {/* Bottom-left is covered by the page avatar, and mobile crops the sides: keep it right of centre. */}
      <Mascot x={W / 2 - 330} ground={gy} s={0.95} />
      <Wordmark x={W / 2 - 150} y={330} size={190} />
    </svg>
  );
}

export const BRAND = [
  { id: "YouTubeAvatar", component: YouTubeAvatar, width: 800, height: 800 },
  { id: "YouTubeBanner", component: YouTubeBanner, width: 2560, height: 1440 },
  { id: "FacebookAvatar", component: FacebookAvatar, width: 720, height: 720 },
  { id: "FacebookCover", component: FacebookCover, width: 1702, height: 630 },
];
