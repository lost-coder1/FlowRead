import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT } from "./theme";
import { Plate } from "./Plate";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, mass: 0.8 }, durationInFrames: 38 });
  const line = spring({ frame: frame - 14, fps, config: { damping: 22 }, durationInFrames: 34 });

  return (
    <>
      <Plate drift={0.35} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: interpolate(s, [0, 0.45], [0, 1], { extrapolateRight: "clamp" }),
            scale: interpolate(s, [0, 1], [0.88, 1], { output: "perceptual-scale" }),
          }}
        >
          <Img src={staticFile("icon.png")} style={{ width: 118, height: 118, borderRadius: 26 }} />
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 96, letterSpacing: "-0.02em" }}>
            <span style={{ color: COLORS.white }}>Flow</span>
            <span style={{ color: COLORS.accent }}>Read</span>
          </div>
        </div>

        <div style={{ height: 76, overflow: "hidden" }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 58,
              lineHeight: "76px",
              color: COLORS.cream,
              translate: `0px ${interpolate(line, [0, 1], [76, 0])}px`,
            }}
          >
            Read more. Scroll less.
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 30,
            color: "rgba(232,228,220,0.62)",
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [34, 52], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          No account · Works offline · Free to start
        </div>
      </div>
    </>
  );
};
