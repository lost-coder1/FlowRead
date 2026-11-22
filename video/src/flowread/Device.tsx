import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from "remotion";
import { Video } from "@remotion/media";
import { PHONE, COLORS } from "./theme";

type Props = {
  /** A clip under public/clips, or a still under public/caps. */
  src: string;
  kind?: "video" | "image";
  trimBefore?: number;
  trimAfter?: number;
  playbackRate?: number;
  /** Scale at the start and end of the scene. */
  zoom?: [number, number];
  /** Which fraction of the capture's height sits centred, start to end. */
  focus?: [number, number];
  /** Degrees of Y-rotation, start to end. The phone is never quite flat. */
  tiltY?: [number, number];
  tiltX?: [number, number];
  /** Spring in from below and from depth. */
  enter?: boolean;
  /** Horizontal placement, 0 = left edge of the safe area, 1 = right. */
  xAnchor?: number;
};

/* The status bar is cropped the way the still assets crop it: the carrier
   icons and the clock are the phone's, not the product's. 2340px tall capture,
   status bar is the first ~96px. */
const STATUS_CROP = 96 / 2340;

export const Device: React.FC<Props> = ({
  src,
  kind = "video",
  trimBefore,
  trimAfter,
  playbackRate,
  zoom = [1, 1],
  focus = [0.5, 0.5],
  tiltY = [0, 0],
  tiltX = [0, 0],
  enter = false,
  xAnchor = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  const w = PHONE.width;
  const h = PHONE.height;
  /* 180px, not 120: perspective plus a Y-rotation projects the near edge
     outward, and at 120 the tilted phone clipped the right edge of the frame. */
  const left = interpolate(xAnchor, [0, 1], [150, width - 180 - w]);
  const top = (height - h) / 2;

  const ease = { extrapolateRight: "clamp" as const, easing: Easing.bezier(0.33, 0, 0.2, 1) };
  const z = interpolate(frame, [0, durationInFrames], zoom, ease);
  const f = interpolate(frame, [0, durationInFrames], focus, ease);
  const ry = interpolate(frame, [0, durationInFrames], tiltY, ease);
  const rx = interpolate(frame, [0, durationInFrames], tiltX, ease);

  /* The capture is cropped to the phone's width, so its drawn height is
     h * z / (1 - STATUS_CROP); offsetting by the focal fraction puts that
     point in the middle, which is what makes a zoom land on a thing. */
  const mediaH = (h * z) / (1 - STATUS_CROP);
  const mediaW = (w * z) / (1 - STATUS_CROP);
  const mediaTop = h / 2 - f * (mediaH * (1 - STATUS_CROP)) - mediaH * STATUS_CROP;
  const mediaLeft = (w - mediaW) / 2;

  const rise = enter
    ? spring({ frame, fps, config: { damping: 17, mass: 1 }, durationInFrames: 40 })
    : 1;

  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    left: mediaLeft,
    top: mediaTop,
    width: mediaW,
  };

  return (
    <div style={{ position: "absolute", left, top, width: w, height: h, perspective: 2200 }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${ry}deg) rotateX(${rx}deg) translateY(${interpolate(
            rise,
            [0, 1],
            [190, 0],
          )}px) translateZ(${interpolate(rise, [0, 1], [-420, 0])}px)`,
          opacity: enter ? interpolate(rise, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) : 1,
        }}
      >
        {/* edge light, which is what reads as a physical object rather than a rectangle */}
        <div
          style={{
            position: "absolute",
            inset: -22,
            borderRadius: PHONE.radius + 22,
            background: COLORS.cream,
            opacity: 0.26,
            filter: "blur(32px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            translate: `${-ry * 1.6}px 26px`,
            borderRadius: PHONE.radius,
            background: "#000",
            opacity: 0.55,
            filter: "blur(38px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: PHONE.radius,
            background: COLORS.ink,
            border: "3px solid rgba(232,228,220,0.8)",
            overflow: "hidden",
          }}
        >
          {kind === "video" ? (
            <Video
              src={staticFile(src)}
              muted
              trimBefore={trimBefore}
              trimAfter={trimAfter}
              playbackRate={playbackRate}
              style={mediaStyle}
            />
          ) : (
            <Img src={staticFile(src)} style={mediaStyle} />
          )}
          {/* a faint sheen that moves with the tilt */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${105 + ry * 2}deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0) 42%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
