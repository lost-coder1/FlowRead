import {
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
} from "remotion";
import { PHONE, COLORS } from "./theme";

type Props = {
  src: string;
  /** Scale at the start and end of the scene. 1 fits the capture to the frame. */
  zoom?: [number, number];
  /** Which point of the capture sits in the middle of the phone, as a fraction
      of its height, at the start and end. 0.8 holds on the buttons. */
  focus?: [number, number];
  /** Spring the phone in from below, where it first appears. */
  enter?: boolean;
};

export const PhoneFrame: React.FC<Props> = ({
  src,
  zoom = [1, 1],
  focus = [0.5, 0.5],
  enter = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  const w = PHONE.width;
  const h = PHONE.height;
  const left = width - 100 - w;
  const top = (height - h) / 2;

  const ease = { extrapolateRight: "clamp" as const, easing: Easing.bezier(0.33, 0, 0.2, 1) };
  const z = interpolate(frame, [0, durationInFrames], zoom, ease);
  const f = interpolate(frame, [0, durationInFrames], focus, ease);

  /* The capture is scaled to the phone's width, so its rendered height is
     h * z. Offsetting by the focal fraction puts that point at the centre --
     which is what makes a zoom land on a thing rather than drift near it. */
  const imgH = h * z;
  const imgTop = h / 2 - f * imgH;
  /* Centre horizontally too. Anchored at 0 a zoom shows the left edge of the
     capture, which on a page of text cuts every line ending. */
  const imgLeft = (w - w * z) / 2;

  const rise = enter
    ? spring({ frame, fps, config: { damping: 18, mass: 0.9 }, durationInFrames: 34 })
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        translate: `0px ${interpolate(rise, [0, 1], [170, 0])}px`,
        opacity: enter ? interpolate(rise, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }) : 1,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -20,
          borderRadius: PHONE.radius + 20,
          background: COLORS.cream,
          opacity: 0.28,
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          translate: "8px 24px",
          borderRadius: PHONE.radius,
          background: "#000",
          opacity: 0.5,
          filter: "blur(34px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: PHONE.radius,
          background: COLORS.ink,
          border: "3px solid rgba(232,228,220,0.82)",
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ position: "absolute", left: imgLeft, top: imgTop, width: w * z }}
        />
      </div>
    </div>
  );
};
