import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT } from "./theme";
import { Plate } from "./Plate";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, mass: 0.8 }, durationInFrames: 36 });

  return (
    <>
      <Plate drift={0.4} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 42,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
            scale: interpolate(s, [0, 1], [0.9, 1], { output: "perceptual-scale" }),
          }}
        >
          <Img src={staticFile("icon.png")} style={{ width: 112, height: 112, borderRadius: 25 }} />
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 92, letterSpacing: "-0.02em" }}>
            <span style={{ color: COLORS.white }}>Flow</span>
            <span style={{ color: COLORS.accent }}>Read</span>
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 58,
            color: COLORS.cream,
            opacity: interpolate(frame, [18, 38], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: `0px ${interpolate(frame, [18, 38], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px`,
          }}
        >
          Read more. Scroll less.
        </div>
      </div>
    </>
  );
};
