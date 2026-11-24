import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS, FONT, lineBox } from "./theme";

type Props = {
  /** Words wrapped in *asterisks* take the accent colour. */
  text: string;
  align?: "left" | "center";
  size?: number;
  /** Frames before the end of the sequence that the exit begins. */
  exitAt?: number;
  top?: number;
};

/* Words rise out of a clip mask on the way in and sink back out on the way
   out. The reference does the same thing, and it is most of what separates
   kinetic typography from text with a fade on it: nothing ever simply
   disappears. */
/* `*...*` marks an accent span, which may be several words long. Splitting
   on whitespace first and testing each word was wrong: "*few pages*" arrives
   as "*few" and "pages*." and neither opens and closes, so the asterisks
   rendered on screen. Split on the marker instead, then attach trailing
   punctuation -- the Devanagari danda among it -- to the word before it so "pages ." never appears. */
type Token = { w: string; accent: boolean };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  text.split("*").forEach((part, i) => {
    part
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => {
        if (/^[.,;:!?'")\]।]+$/.test(w) && out.length) out[out.length - 1].w += w;
        else out.push({ w, accent: i % 2 === 1 });
      });
  });
  return out;
}

export const Caption: React.FC<Props> = ({
  text,
  align = "left",
  size = 84,
  exitAt = 16,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const words = tokenize(text);
  const lineH = lineBox(size, text);

  /* Both staggers are scaled to the time available rather than fixed per
     word. At a fixed 1.5 frames the exit of a long line started after its own
     end -- interpolate was handed [75, 75] and refused -- and Hindi hit it
     first simply because the same sentence takes more words. A fixed entry
     step has the quieter version of the same fault: the last word of a long
     line arrives after the caption is half over. */
  const gaps = Math.max(1, words.length - 1);
  const inStep = Math.min(3, Math.max(0.6, ((durationInFrames - 32) * 0.4) / gaps));
  const outTo = durationInFrames - 3;
  const outFrom = durationInFrames - exitAt;
  const outStep = Math.min(1.5, Math.max(0.3, ((outTo - outFrom) * 0.5) / gaps));

  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : 130,
        width: align === "center" ? "100%" : 880,   /* clears the pushed-in device */
        /* Centred captions are the vertical cut's, where the frame is only
           1080 wide: without a gutter a long line reaches the edge. */
        boxSizing: "border-box" as const,
        paddingLeft: align === "center" ? 74 : 0,
        paddingRight: align === "center" ? 74 : 0,
        top: top ?? (align === "center" ? 430 : 372),
        display: "flex",
        flexWrap: "wrap",
        gap: `6px ${Math.round(size * 0.26)}px`,
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      {words.map(({ w: word, accent }, i) => {

        const inS = spring({
          frame: frame - i * inStep,
          fps,
          config: { damping: 19, mass: 0.7 },
          durationInFrames: 32,
        });
        /* Exit is faster than entry and staggers from the other end, so the
           line clears instead of unravelling. */
        const outT = interpolate(
          frame,
          [Math.min(outFrom + (words.length - 1 - i) * outStep, outTo - 1), outTo],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.9, 0.4) },
        );

        const y = interpolate(inS, [0, 1], [lineH, 0]) - outT * lineH * 0.85;

        return (
          <span
            key={`${word}-${i}`}
            style={{ display: "inline-block", height: lineH, overflow: "hidden" }}
          >
            <span
              style={{
                display: "inline-block",
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: size,
                lineHeight: `${lineH}px`,
                color: accent ? COLORS.accent : COLORS.white,
                letterSpacing: "-0.015em",
                translate: `0px ${y}px`,
                opacity: 1 - outT,
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};
