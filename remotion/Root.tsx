import { Composition } from "remotion";
import { Explainer, calculateMetadata, type ExplainerProps } from "./Explainer.tsx";
import { FPS, H, W } from "./theme.ts";
import { BRAND } from "./Brand.tsx";
import { Thumbnail, thumbnailMetadata, type ThumbnailProps } from "./Thumbnail.tsx";
import fixtureMono from "./fixture-mono.json";

// The app renders this with a project's scenes.json as input props; the fixture is for Studio and smoke tests.
export function Root() {
  return (
    <>
      <Composition
        id="Explainer"
        component={Explainer}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={300}
        defaultProps={fixtureMono as unknown as ExplainerProps}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={300}
        calculateMetadata={thumbnailMetadata}
        defaultProps={{ video: fixtureMono, title: "Why discipline beats motivation" } as unknown as ThumbnailProps}
      />
      {BRAND.map((b) => <Composition key={b.id} {...b} fps={FPS} durationInFrames={1} />)}
    </>
  );
}
