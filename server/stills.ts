// npm run stills [outDir]: renders the fixture's scenes, to eyeball the component library.
import { join } from "node:path";
import { ROOT } from "./project.ts";
import { bundleFor, renderStills } from "./bots/remotion.ts";
import fixtureMono from "../remotion/fixture-mono.json" with { type: "json" };
import type { ExplainerProps } from "../remotion/Explainer.tsx";

const out = process.argv[2] ?? join(ROOT, "projects", "_stills");
const serveUrl = await bundleFor(join(ROOT, "remotion"));
// Stills don't need sound, so the music prop is dropped.
const { music, ...mono } = fixtureMono as unknown as ExplainerProps;
const files = await renderStills(serveUrl, mono, join(out, "mono"));
console.log("mono", files.length, "stills →", join(out, "mono"));
