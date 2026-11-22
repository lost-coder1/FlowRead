import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "./theme";

/* The opening two beats are drawn, never captured.
   A promo video showing a competitor's real app carries their trade dress and
   whatever a stranger happened to post that day, and the recording session
   proved the point: the live take caught a real person's account of their
   divorce. None of that is needed -- these seconds are about the feeling. */

const TILE_COLS = 4;
const TILE_ROWS = 5;

/* Beat 1: a wall of app tiles lighting up with notifications, faster and
   faster, until it is the only thing on screen. */
export const TileWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const tiles = [];
  for (let r = 0; r < TILE_ROWS; r++) {
    for (let c = 0; c < TILE_COLS; c++) {
      const i = r * TILE_COLS + c;
      const s = spring({
        frame: frame - i * 1.6,
        fps,
        config: { damping: 15, mass: 0.6 },
        durationInFrames: 26,
      });
      /* Each tile gets its badge at its own moment; the pace compounds. */
      const badgeAt = 18 + ((i * 7) % 34);
      const badge = spring({
        frame: frame - badgeAt,
        fps,
        config: { damping: 11, mass: 0.5 },
        durationInFrames: 18,
      });
      tiles.push({ r, c, s, badge });
    }
  }

  const drift = interpolate(frame, [0, durationInFrames], [0, -70], { extrapolateRight: "clamp" });
  const size = 132;
  const gap = 40;
  const gridW = TILE_COLS * size + (TILE_COLS - 1) * gap;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 210,
          top: 150 + drift,
          width: gridW,
          display: "flex",
          flexWrap: "wrap",
          gap,
        }}
      >
        {tiles.map((t, i) => (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: 30,
              background: i % 3 === 0 ? "#241d16" : i % 3 === 1 ? "#1d1a16" : "#201a14",
              border: "1px solid #2a2a2a",
              position: "relative",
              opacity: interpolate(t.s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
              scale: interpolate(t.s, [0, 1], [0.72, 1], { output: "perceptual-scale" }),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -9,
                right: -9,
                width: 34,
                height: 34,
                borderRadius: 999,
                background: COLORS.accent2,
                opacity: interpolate(t.badge, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
                scale: interpolate(t.badge, [0, 1], [0.2, 1], { output: "perceptual-scale" }),
              }}
            />
          </div>
        ))}
      </div>
      {/* the wall sinks into shadow as the line lands */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.82) 46%, rgba(13,13,13,0.2) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* Beat 2: a ring sweeping away an evening, with the clock running under it.
   The reference uses a countdown ring for focus earned; this is its opposite,
   time being spent. */
