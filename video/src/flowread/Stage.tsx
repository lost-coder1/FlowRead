import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { PHONE, COLORS } from "./theme";

/* One device, entering once and then held absolutely still.
   Nothing zooms, pans or rotates it. A perspective rotation, however slow,
   still changes the thing's apparent size, which on a screen recording reads
   as exactly the drift this is meant to be free of. The motion in this half
   of the film is the app's own. */

const CAPTURE_W = 1080;
const CAPTURE_H = 2340;
const STATUS_PX = 96;

/* Fitting the capture to the screen's width leaves ~74px over, spent hiding
   the status bar at the top and the gesture bar at the bottom. Nothing is
   cropped horizontally, so no line of app UI loses its first character. */
const MEDIA_W = PHONE.screenW;
const MEDIA_H = (PHONE.screenW * CAPTURE_H) / CAPTURE_W;
const MEDIA_TOP = -(STATUS_PX * PHONE.screenW) / CAPTURE_W;

const Key: React.FC<{ top: number; height: number; side: "l" | "r" }> = ({ top, height, side }) => (
  <div
    style={{
      position: "absolute",
      top,
      height,
      width: 4,
      [side === "r" ? "left" : "right"]: side === "r" ? PHONE.width - 1 : PHONE.width - 1,
      borderRadius: 2,
      background: "#2b2622",
    }}
  />
);

export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const w = PHONE.width;
  const h = PHONE.height;
  const left = width - 190 - w;
  const top = (height - h) / 2;

  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        opacity: interpolate(rise, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        translate: `0 ${interpolate(rise, [0, 1], [46, 0])}px`,
      }}
    >
      <div style={{ position: "absolute", inset: -24, borderRadius: PHONE.radius + 24, background: COLORS.cream, opacity: 0.2, filter: "blur(38px)" }} />
      <div style={{ position: "absolute", inset: 0, translate: "8px 30px", borderRadius: PHONE.radius, background: "#000", opacity: 0.58, filter: "blur(44px)" }} />

      <Key side="r" top={232} height={96} />
      <Key side="l" top={196} height={58} />
      <Key side="l" top={268} height={58} />

      {/* body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: PHONE.radius,
          background: "#141210",
          border: `3px solid rgba(232,228,220,0.82)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {/* earpiece and camera, which is most of what makes a rectangle a phone */}
        <div style={{ position: "absolute", top: PHONE.bezelY / 2 - 3, left: "50%", translate: "-34px 0", width: 56, height: 5, borderRadius: 3, background: "#272320" }} />
        <div style={{ position: "absolute", top: PHONE.bezelY / 2 - 5, left: "50%", translate: "30px 0", width: 9, height: 9, borderRadius: "50%", background: "#0a0908", border: "1px solid #2e2924" }} />

        {/* screen */}
        <div
          style={{
            position: "absolute",
            left: PHONE.bezelX,
            top: PHONE.bezelY,
            width: PHONE.screenW,
            height: PHONE.screenH,
            borderRadius: PHONE.screenRadius,
            overflow: "hidden",
            background: COLORS.ink,
          }}
        >
          {/* every screen renders at this exact geometry, so a swap cannot shift the picture */}
          <div style={{ position: "absolute", left: 0, top: MEDIA_TOP, width: MEDIA_W, height: MEDIA_H }}>
            {children}
          </div>
        </div>

        <div style={{ position: "absolute", inset: 0, borderRadius: PHONE.radius, background: "linear-gradient(104deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 46%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
};

/* A screen inside the Stage, cross-dissolving with whatever is beneath it so
   the device never blinks between beats. */
export const Screen: React.FC<{ children: React.ReactNode; fadeIn?: number }> = ({ children, fadeIn = 12 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </div>
  );
};

/* The feed fills the screen rather than the capture box -- it is drawn, not
   captured, so it has no status bar to hide. */
export const DrawnScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -MEDIA_TOP,
        width: PHONE.screenW,
        height: PHONE.screenH,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </div>
  );
};
