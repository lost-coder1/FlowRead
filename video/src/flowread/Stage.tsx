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
/* Geometry is derived from a single scale factor so the vertical cut can use
   a larger device without a second copy of any of this. */
export const geom = (k: number) => {
  const screenW = PHONE.screenW * k;
  return {
    w: PHONE.width * k,
    h: PHONE.height * k,
    radius: PHONE.radius * k,
    bezelX: PHONE.bezelX * k,
    bezelY: PHONE.bezelY * k,
    screenRadius: PHONE.screenRadius * k,
    screenW,
    screenH: PHONE.screenH * k,
    mediaW: screenW,
    mediaH: (screenW * CAPTURE_H) / CAPTURE_W,
    mediaTop: -(STATUS_PX * screenW) / CAPTURE_W,
  };
};

const Key: React.FC<{ top: number; height: number; side: "l" | "r"; w: number; k: number }> = ({
  top, height, side, w, k,
}) => (
  <div
    style={{
      position: "absolute",
      top,
      height,
      width: 4 * k,
      [side === "r" ? "left" : "right"]: w - k,
      borderRadius: 2 * k,
      background: "#2b2622",
    }}
  />
);

export const Stage: React.FC<{
  children: React.ReactNode;
  k?: number;
  left?: number;
  top?: number;
}> = ({ children, k = 1, left: leftIn, top: topIn }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const g = geom(k);
  const w = g.w;
  const h = g.h;
  const left = leftIn ?? width - 190 - w;
  const top = topIn ?? (height - h) / 2;

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
      <div style={{ position: "absolute", inset: -24 * k, borderRadius: g.radius + 24 * k, background: COLORS.cream, opacity: 0.2, filter: `blur(${38 * k}px)` }} />
      <div style={{ position: "absolute", inset: 0, translate: `${8 * k}px ${30 * k}px`, borderRadius: g.radius, background: "#000", opacity: 0.58, filter: `blur(${44 * k}px)` }} />

      <Key side="r" top={232 * k} height={96 * k} w={w} k={k} />
      <Key side="l" top={196 * k} height={58 * k} w={w} k={k} />
      <Key side="l" top={268 * k} height={58 * k} w={w} k={k} />

      {/* body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: g.radius,
          background: "#141210",
          border: `${3 * k}px solid rgba(232,228,220,0.82)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {/* earpiece and camera, which is most of what makes a rectangle a phone */}
        <div style={{ position: "absolute", top: g.bezelY / 2 - 3 * k, left: "50%", translate: `${-34 * k}px 0`, width: 56 * k, height: 5 * k, borderRadius: 3 * k, background: "#272320" }} />
        <div style={{ position: "absolute", top: g.bezelY / 2 - 5 * k, left: "50%", translate: `${30 * k}px 0`, width: 9 * k, height: 9 * k, borderRadius: "50%", background: "#0a0908", border: `${k}px solid #2e2924` }} />

        {/* screen */}
        <div
          style={{
            position: "absolute",
            left: g.bezelX,
            top: g.bezelY,
            width: g.screenW,
            height: g.screenH,
            borderRadius: g.screenRadius,
            overflow: "hidden",
            background: COLORS.ink,
          }}
        >
          <div style={{ position: "absolute", left: 0, top: g.mediaTop, width: g.mediaW, height: g.mediaH }}>
            {children}
          </div>
        </div>

        <div style={{ position: "absolute", inset: 0, borderRadius: g.radius, background: "linear-gradient(104deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 46%)", pointerEvents: "none" }} />
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
export const DrawnScreen: React.FC<{ children: React.ReactNode; k?: number }> = ({ children, k = 1 }) => {
  const frame = useCurrentFrame();
  const g = geom(k);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -g.mediaTop,
        width: g.screenW,
        height: g.screenH,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </div>
  );
};
