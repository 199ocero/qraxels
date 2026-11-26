import { Figure, STAND, Backdrop, font } from "kit";

// Title: "How Costco Makes Money (It's Not the Groceries)". Copy the TECHNIQUE (one huge glowing hero, the mascot
// pointing, 3 big words, the coins). One lesson from it: the video opened on a grocery
// receipt and said "$65" only at 1:08, so viewers who clicked for the card left in 8 seconds. Draw a hero from the
// video's opening lines.
export default function Cover({ w, h }) {
  const cx = 700, cy = 590;
  const coin = (x, y, r, s) => (
    <g key={x} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <circle r={46} fill="#1a1a1a" stroke="#fff" strokeWidth={7} />
      <text y={22} textAnchor="middle" fontFamily={font.impact} fontSize={62} fill="#fff">$</text>
    </g>
  );
  return (
    <svg width={w} height={h}>
      <defs>
        <filter id="cardglow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={38} result="b" />
          <feFlood floodColor="#fff" floodOpacity={0.55} />
          <feComposite in2="b" operator="in" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ray" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={1100}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={760}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.2} />
          <stop offset="55%" stopColor="#fff" stopOpacity={0.04} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="cardface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b2b2b" />
          <stop offset="100%" stopColor="#0c0c0c" />
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Backdrop w={w} h={h} />
      <rect width={w} height={h} fill="url(#halo)" />
      {/* A sun-burst behind the hero. */}
      <g opacity={0.5}>
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2 + 0.12;
          const p = (k) => `${cx + Math.cos(a + k) * 1400} ${cy + Math.sin(a + k) * 1400}`;
          return <path key={i} d={`M ${cx} ${cy} L ${p(-0.05)} L ${p(0.05)} Z`} fill="url(#ray)" />;
        })}
      </g>
      {/* Money flying off the card. */}
      {[[150, 190, -20, 1.1], [1180, 210, 15, 0.9], [250, 960, 10, 1.25], [1130, 930, -12, 0.8], [520, 120, 25, 0.7]].map(([x, y, r, s]) => coin(x, y, r, s))}

      {/* The hero: the membership card, tilted, glowing. */}
      <g transform={`translate(${cx} ${cy}) rotate(-9)`}>
        <rect x={-450} y={-285} width={900} height={570} rx={44} fill="url(#cardface)" stroke="#fff" strokeWidth={12} filter="url(#cardglow)" />
        <rect x={-450} y={-200} width={900} height={84} fill="#000" />
        <text x={-395} y={-226} fontFamily={font.mono} fontWeight={700} fontSize={44} letterSpacing={10} fill="#fff">MEMBER</text>
        <rect x={-385} y={-70} width={130} height={100} rx={16} fill="#bdbdbd" />
        <path d="M -385 -20 H -255 M -320 -70 V 30" stroke="#777" strokeWidth={6} />
        <rect x={-385} y={150} width={260} height={24} rx={12} fill="#6a6a6a" />
        <rect x={-385} y={195} width={170} height={20} rx={10} fill="#4a4a4a" />
        <text x={170} y={175} textAnchor="middle" fontFamily={font.impact} fontSize={320} fill="#fff">$65</text>
        <text x={170} y={240} textAnchor="middle" fontFamily={font.mono} fontWeight={700} fontSize={40} letterSpacing={8} fill="#9a9a9a">PER YEAR</text>
        <rect x={-450} y={-285} width={900} height={570} rx={44} fill="url(#shine)" />
      </g>

      {/* The mascot, facing you, pointing at the card (hands in its local units: hip at 0,0, shoulders near y -140). */}
      <g transform="translate(1590 1250) scale(1.75)">
        <Figure x={0} ground={0} pose={STAND} front hands={[[-172, -175], [52, -40]]} />
      </g>

      {/* 3 words that add to the title; the key word inverted (black on a white box). */}
      <g fontFamily={font.impact} textAnchor="end">
        <text x={1860} y={225} fontSize={190} fill="#fff" stroke="#000" strokeWidth={14} paintOrder="stroke">THE REAL</text>
        <rect x={1215} y={250} width={665} height={190} rx={10} fill="#fff" filter="url(#glow)" />
        <text x={1845} y={418} fontSize={190} fill="#000">PRODUCT</text>
      </g>
    </svg>
  );
}
