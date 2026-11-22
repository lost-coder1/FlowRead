import React from "react";
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

        {/* The closing claim was set at 30px in muted grey and read as a
            footnote, when it is in fact the whole objection-handling: no
            sign-up, no connection, no card. Full brightness, larger, and
            arriving one at a time so each is actually read. */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {["No account", "Works offline", "Free to start"].map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 ? (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: COLORS.accent,
                    opacity: interpolate(frame, [30 + i * 9, 42 + i * 9], [0, 0.9], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
              ) : null}
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 42,
                  color: COLORS.cream,
                  letterSpacing: "0.01em",
                  opacity: interpolate(frame, [26 + i * 9, 40 + i * 9], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  translate: `0px ${interpolate(frame, [26 + i * 9, 42 + i * 9], [14, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px`,
                }}
              >
                {item}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
};
