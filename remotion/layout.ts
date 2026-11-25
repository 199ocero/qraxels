// Responsive layout for drawings (kit): a long video's drawings play on its 16:9 canvas and again in its vertical
// Shorts. Each helper splits a box by the box's own shape, so the same call lays out side by side on the wide stage
// and stacked on the tall one. No Remotion imports, so server tests can use it.

export type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number; cx: number; cy: number };

export const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom, width: right - left, height: bottom - top, cx: (left + right) / 2, cy: (top + bottom) / 2 });

// Two halves: left/right in a wide box, top/bottom in a tall one (cause → effect, before → after).
export function split(b: Box, gap = 40): [Box, Box] {
  if (b.width >= b.height) {
    const w = (b.width - gap) / 2;
    return [box(b.left, b.top, b.left + w, b.bottom), box(b.right - w, b.top, b.right, b.bottom)];
  }
  const h = (b.height - gap) / 2;
  return [box(b.left, b.top, b.right, b.top + h), box(b.left, b.bottom - h, b.right, b.bottom)];
}

// n cells in reading order: one row in a wide box; in a tall one a column (n ≤ 2) or a 2-wide grid, an odd last cell centred.
export function row(b: Box, n: number, gap = 30): Box[] {
  const cols = b.width >= b.height ? n : n <= 2 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const w = (b.width - gap * (cols - 1)) / cols;
  const h = (b.height - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const x = b.left + (b.width - (inRow * w + (inRow - 1) * gap)) / 2 + (i % cols) * (w + gap);
    const y = b.top + r * (h + gap);
    return box(x, y, x + w, y + h);
  });
}

// SVG transform that fits a group drawn in its own w x h units (ground at y = h) into b: scaled to fit (never above
// 1.25x), centred across, standing on b's bottom.
export function place(b: Box, w: number, h: number): string {
  const k = Math.min(b.width / w, b.height / h, 1.25);
  return `translate(${b.cx - (w * k) / 2} ${b.bottom - h * k}) scale(${k})`;
}
