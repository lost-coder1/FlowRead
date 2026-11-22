import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";

/* The listing's own gradient, drifting very slowly so the frame is never
   completely static behind a held shot. */
export const Plate: React.FC<{ drift?: number }> = ({ drift = 1 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#2a1f14", overflow: "hidden" }}>
      <Img
        src={staticFile("plate-landscape.png")}
        style={{
          width: "108%",
          height: "108%",
          objectFit: "cover",
          position: "absolute",
          left: interpolate(frame, [0, 900], [-20, -60 * drift], {
            extrapolateRight: "clamp",
          }),
          top: -20,
        }}
      />
      {/* A touch of vignette so the phone separates from the tan corner. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 90% at 38% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
