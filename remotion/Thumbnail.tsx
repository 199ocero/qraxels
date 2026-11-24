import { AbsoluteFill, type CalculateMetadataFunction } from "remotion";
import { Explainer, type ExplainerProps } from "./Explainer.tsx";
import { videoEnd } from "./mono.ts";
import { FPS, font } from "./theme.ts";

export type ThumbnailProps = { video: ExplainerProps; title: string };

// As long as the video, so renderStill can pick any of its frames.
export const thumbnailMetadata: CalculateMetadataFunction<ThumbnailProps> = ({ props }) => ({ durationInFrames: Math.ceil(videoEnd(props.video.scenes) * FPS) });

// A 1080x1920 cover for YouTube Shorts and Facebook/Instagram Reels: one frame of the video plus its title.
// The title sits in the top of the centre 3:4 crop (y 240–1680) that the Reels profile grid shows, clear of the bottom UI.
export function Thumbnail({ video, title }: ThumbnailProps) {
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
