import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS, FONT } from "./theme";

/* The clock sits in the caption column now, not across the middle of the
   frame: the phone has the stage, and the time is the supporting fact. */
export const ClockReadout: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0, 0.3, 1),
  });

  const mins = Math.round(interpolate(t, [0, 1], [21 * 60 + 14, 23 * 60 + 52]));
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div style={{ position: "absolute", left: 132, top: 648, display: "flex", alignItems: "center", gap: 26, opacity: interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      <svg width={128} height={128}>
        <circle cx={64} cy={64} r={R} fill="none" stroke="rgba(232,228,220,0.16)" strokeWidth={7} />
        <circle
          cx={64}
          cy={64}
          r={R}
          fill="none"
          stroke={COLORS.accent2}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - t * 0.82)}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div style={{ fontFamily: FONT, fontSize: 70, fontWeight: 300, color: COLORS.cream, letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>
        {hh}:{mm}
      </div>
    </div>
  );
};
