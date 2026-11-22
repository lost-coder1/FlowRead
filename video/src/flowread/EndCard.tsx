import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT } from "./theme";
import { STRINGS, Locale } from "./strings";
import { Plate } from "./Plate";

/* The Play mark, drawn.
   On the listing itself the Install button sits directly under the video, so
   this is redundant there; in a Reels or Shorts feed nothing says which store
   to search, and an iOS viewer searches the wrong one. It is drawn rather
   than fetched because nothing here reaches the network, and because the
   asset is not in the repo.

   Google's brand guidelines ask for their own supplied badge, unaltered. If
   that matters for the listing, drop the official PNG in public/ and this
   becomes an <Img>. Section 15's palette does not govern it -- it is somebody
   else's mark and recolouring it would be the actual violation. */
const PlayMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <path d="M3.6 1.8 L13.8 12 L3.6 22.2 C3.2 21.9 3 21.5 3 21 V3 C3 2.5 3.2 2.1 3.6 1.8 Z" fill="#00A0FF" />
    <path d="M3.6 1.8 C4.1 1.5 4.7 1.5 5.2 1.75 L17.45 8.65 L13.8 12 Z" fill="#00DF6C" />
    <path d="M17.45 8.65 L20.9 10.6 C21.6 11 21.6 13 20.9 13.4 L17.45 15.35 L13.8 12 Z" fill="#FFC900" />
    <path d="M3.6 22.2 L13.8 12 L17.45 15.35 L5.2 22.25 C4.7 22.5 4.1 22.5 3.6 22.2 Z" fill="#FF3A44" />
  </svg>
);

export const EndCard: React.FC<{ portrait?: boolean; locale?: Locale }> = ({
  portrait = false,
  locale = "en",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = STRINGS[locale];
  const s = spring({ frame, fps, config: { damping: 20, mass: 0.8 }, durationInFrames: 38 });
  const line = spring({ frame: frame - 14, fps, config: { damping: 22 }, durationInFrames: 34 });

  return (
    <>
      <Plate drift={0.35} portrait={portrait} />
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
            {S.tagline}
          </div>
        </div>

        {/* The closing claim was set at 30px in muted grey and read as a
            footnote, when it is in fact the whole objection-handling: no
            sign-up, no connection, no card. Full brightness, larger, and
            arriving one at a time so each is actually read. */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {S.features.map((item, i) => (
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: -14,
            opacity: interpolate(frame, [56, 74], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: `0px ${interpolate(frame, [56, 76], [12, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px`,
          }}
        >
          <PlayMark size={portrait ? 30 : 32} />
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: portrait ? 28 : 30,
              color: "rgba(232,228,220,0.72)",
              letterSpacing: "0.02em",
            }}
          >
            {S.store}
          </div>
        </div>
      </div>
    </>
  );
};
