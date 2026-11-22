import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { FONT } from "./theme";

/* A generic feed, drawn rather than captured.
   Deliberately no logos, no real posts and no recognisable UI: a promo video
   showing a competitor's actual app is someone else's trade dress and content,
   and the point of these three seconds is the feeling, not the app. */

const CARDS = Array.from({ length: 16 }, (_, i) => ({
  h: 180 + ((i * 97) % 220),
  media: i % 3 !== 1,
  lines: 2 + (i % 3),
}));

const Card: React.FC<{ h: number; media: boolean; lines: number }> = ({ h, media, lines }) => (
  <div
    style={{
      width: 620,
      marginBottom: 26,
      borderRadius: 14,
      background: "#1f1f25",
      padding: 22,
      boxSizing: "border-box",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 999, background: "#3a3a44" }} />
      <div style={{ width: 190, height: 13, borderRadius: 7, background: "#3a3a44" }} />
    </div>
    {media && (
      <div style={{ height: h, borderRadius: 10, background: "#303039", marginBottom: 16 }} />
    )}
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        style={{
          height: 12,
          borderRadius: 6,
          background: "#34343d",
          marginBottom: 10,
          width: i === lines - 1 ? "58%" : "100%",
        }}
      />
    ))}
  </div>
);

export const AbstractFeed: React.FC = () => {
  const frame = useCurrentFrame();

  /* Starts at a browsing pace and runs away with itself. */
  const speed = interpolate(frame, [0, 150], [9, 64], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.9, 0.6),
  });
  const offset = (frame * speed) % 3400;

  return (
    <AbsoluteFill style={{ background: "#0a0a0b", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          translate: `-50% ${-offset}px`,
          top: -200,
          filter: `blur(${interpolate(frame, [0, 150], [0, 3.4], {
            extrapolateRight: "clamp",
          })}px) saturate(${interpolate(frame, [0, 150], [1, 0.25], {
            extrapolateRight: "clamp",
          })})`,
        }}
      >
        {[...CARDS, ...CARDS].map((c, i) => (
          <Card key={i} {...c} />
        ))}
      </div>

      {/* Darkening, so the scene sinks as the captions land. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(105% 75% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* The clock is an overlay, not something any screen recording contains. */
export const RunawayClock: React.FC = () => {
  const frame = useCurrentFrame();
  const mins = Math.floor(
    interpolate(frame, [0, 60], [21 * 60 + 14, 23 * 60 + 47], { extrapolateRight: "clamp" }),
  );
  const hh = String(Math.floor(mins / 60) % 24).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");

  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        top: 96,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 72,
        color: "rgba(232,228,220,0.9)",
        letterSpacing: "0.02em",
        fontVariantNumeric: "tabular-nums",
        opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      {hh}:{mm}
    </div>
  );
};
