import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT } from "./theme";

type Props = {
  text: string;
  /** "left" sits beside the phone; "center" is for the full-bleed opening. */
  align?: "left" | "center";
  size?: number;
  color?: string;
  /** Fade the caption out this many frames before the sequence ends. */
  holdOut?: boolean;
};

/* Word-by-word rise. Staggering the words is most of what separates kinetic
   typography from a block of text with a fade on it. */
export const Caption: React.FC<Props> = ({
  text,
  align = "left",
  size = 84,
  color = COLORS.white,
  holdOut = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const words = text.split(" ");

  const out = holdOut
    ? interpolate(frame, [durationInFrames - 10, durationInFrames - 2], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : 130,
        right: align === "center" ? 0 : undefined,
        width: align === "center" ? "100%" : 1000,
        top: align === "center" ? 430 : 360,
        display: "flex",
        flexWrap: "wrap",
        gap: `0px ${Math.round(size * 0.26)}px`,
        justifyContent: align === "center" ? "center" : "flex-start",
        opacity: out,
      }}
    >
      {words.map((word, i) => {
        const s = spring({
          frame: frame - i * 3,
          fps,
          config: { damping: 20, mass: 0.7 },
          durationInFrames: 30,
        });
        return (
          <span
            key={`${word}-${i}`}
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: size,
              lineHeight: 1.12,
              color,
              letterSpacing: "-0.015em",
              textShadow: "0 6px 26px rgba(0,0,0,0.55)",
              opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
              translate: `0px ${interpolate(s, [0, 1], [34, 0])}px`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
