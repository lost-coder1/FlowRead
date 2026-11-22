import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { PHONE, COLORS } from "./theme";

/* One device for the whole product section.
   The screen recordings already move; a zoom or pan on top of them fights the
   content and crops the app's own chrome -- the engine tab row was being cut
   off the top. So the capture is shown whole and 1:1, and the only movement
   the frame itself makes is a single slow rotation across the entire section,
   never a per-scene reset. */

/* Capture is 1080x2340. Fitting its width to the phone leaves ~80px over,
   which is spent hiding the status bar at the top and the gesture bar at the
   bottom -- the phone's furniture, not the product's. Nothing is cropped
   horizontally, so no line of app UI ever loses its first character. */
const CAPTURE_W = 1080;
const CAPTURE_H = 2340;
const STATUS_PX = 96;

export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const w = PHONE.width;
  const h = PHONE.height;
  const left = width - 180 - w;
  const top = (height - h) / 2;

  /* One continuous sweep, about a quarter of a degree per second. Enough that
     the frame is never dead, far too slow to compete with the screen. */
  const ry = interpolate(frame, [0, durationInFrames], [-5.5, 1.5], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });

  const mediaW = w;
  const mediaH = (w * CAPTURE_H) / CAPTURE_W;
  const mediaTop = -(STATUS_PX * w) / CAPTURE_W;

  return (
    <div style={{ position: "absolute", left, top, width: w, height: h, perspective: 2400 }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${ry}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -22,
            borderRadius: PHONE.radius + 22,
            background: COLORS.cream,
            opacity: 0.24,
            filter: "blur(34px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            translate: `${-ry * 1.8}px 26px`,
            borderRadius: PHONE.radius,
            background: "#000",
            opacity: 0.55,
            filter: "blur(40px)",
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
          {/* Every screen renders at exactly this geometry, so swapping the
              content cannot shift the picture. */}
          <div
            style={{ position: "absolute", left: 0, top: mediaTop, width: mediaW, height: mediaH }}
          >
            {children}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${104 + ry * 2}deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 44%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/* A screen inside the Stage. Cross-dissolves with whatever is beneath it, so
   the device never blinks between beats. */
export const Screen: React.FC<{ children: React.ReactNode; fadeIn?: number }> = ({
  children,
  fadeIn = 11,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: interpolate(frame, [0, fadeIn], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </div>
  );
};
