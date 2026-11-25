import { AbsoluteFill, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { Defs } from "./Brand.tsx";
import { Drawn } from "./drawn.tsx";
import { Explainer, WIDE, type ExplainerProps } from "./Explainer.tsx";
import { videoEnd } from "./mono.ts";
import { FPS, font } from "./theme.ts";

// `cover`: a drawn cover (compiled projects/{id}/covers/*.tsx, prompts/cover.md); without one, or if it breaks,
// a frame of the video with its title.
export type ThumbnailProps = { video: ExplainerProps; title: string; cover?: string };

// As long as the video, so renderStill can pick any of its frames.
export const thumbnailMetadata: CalculateMetadataFunction<ThumbnailProps> = ({ props }) => ({
  durationInFrames: Math.ceil(videoEnd(props.video.scenes) * FPS),
  ...(props.video.wide ? { width: WIDE.W, height: WIDE.H } : {}),
});

export function Thumbnail({ cover, ...props }: ThumbnailProps) {
  const { width: w, height: h } = useVideoConfig();
  if (!cover) return <Framed {...props} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* The glow, grain and spotlight filters the cover refers to by id. */}
      <svg width={0} height={0} style={{ position: "absolute" }}><Defs /></svg>
      <Drawn i={-1} js={cover} fallback={<Framed {...props} />} props={{ w, h, title: props.title } as never} />
    </AbsoluteFill>
  );
}

// The fallback cover: one frame of the video plus its title. Vertical (Shorts, Reels): the title sits in the top of
// the centre 3:4 crop (y 240–1680) that the Reels profile grid shows, clear of the bottom UI.
function Framed({ video: v, title }: Omit<ThumbnailProps, "cover">) {
  // The scene's label stamp would sit behind the title; the title does its job here.
  const video = { ...v, scenes: v.scenes.map((s) => ({ ...s, props: { ...s.props, label: undefined } }) as typeof s) };
  // A long video's 16:9 thumbnail: the picture on the left (as in the video), the title big on the right.
  if (video.wide)
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Explainer {...video} captions={false} />
        <div style={{ position: "absolute", left: 1130, right: 70, top: 0, bottom: 0, display: "flex", alignItems: "center", font: `400 ${title.length > 40 ? 104 : 128}px/1.02 ${font.impact}`, color: "#fff", textTransform: "uppercase", textShadow: "0 0 30px #fff6" }}>
          {title}
        </div>
      </AbsoluteFill>
    );
  const size = title.length > 40 ? 112 : title.length > 22 ? 136 : 160;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Explainer {...video} captions={false} />
      <AbsoluteFill style={{ background: "linear-gradient(#000e 0%, #000c 32%, #0000 55%)" }} />
      <div style={{ position: "absolute", top: 300, left: 80, right: 80, font: `400 ${size}px/1.02 ${font.impact}`, color: "#fff", textTransform: "uppercase", textAlign: "center", textShadow: "0 0 30px #fff6, 0 6px 0 #000" }}>
        {title}
      </div>
    </AbsoluteFill>
  );
}
