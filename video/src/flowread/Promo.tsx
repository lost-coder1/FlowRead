import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Plate } from "./Plate";
import { Device } from "./Device";
import { Caption } from "./Caption";
import { TileWall, ClockSweep } from "./Opener";
import { EndCard } from "./EndCard";
import { sec } from "./theme";

/* Structure: drawn motion graphics carry the problem, real footage carries
   the product, and a drawn card closes. The middle is what a store listing is
   actually for -- a video that never shows the app withholds the one thing
   the viewer came to see. */
export const SCENES = {
  tiles: 3.5,
  clock: 3.5,
  nudge: 5.5,
  reading: 5.5,
  unlock: 4.5,
  highlight: 6.5,
  dictionary: 4.5,
  library: 4.5,
  end: 3.5,
} as const;

export const XFADE = 10;
const N_TRANSITIONS = Object.keys(SCENES).length - 1;
export const TOTAL_FRAMES =
  Object.values(SCENES).reduce((a, b) => a + sec(b), 0) - N_TRANSITIONS * XFADE;

/* One slow push applied to the whole scene. Together with the plate's own
   drift and the device's zoom this gives three planes moving at three rates,
   which is what reads as depth rather than a slideshow. */
const Camera: React.FC<{ children: React.ReactNode; to?: number }> = ({ children, to = 1.02 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        scale: interpolate(frame, [0, durationInFrames], [1, to], {
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.3, 0, 0.3, 1),
          output: "perceptual-scale",
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

type ShotProps = {
  src: string;
  caption: string;
  playbackRate?: number;
  trimAfter?: number;
  zoom?: [number, number];
  focus?: [number, number];
  tiltY?: [number, number];
  tiltX?: [number, number];
  enter?: boolean;
};

const Shot: React.FC<ShotProps> = ({ src, caption, ...rest }) => (
  <Camera>
    <Plate />
    <Device src={src} {...rest} />
    <Caption text={caption} />
  </Camera>
);

const t = (dir?: "from-right") =>
  dir ? (
    <TransitionSeries.Transition
      presentation={slide({ direction: "from-right" })}
      timing={linearTiming({ durationInFrames: XFADE + 4 })}
    />
  ) : (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: XFADE })}
    />
  );

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <TransitionSeries>
      {/* ── drawn: the problem ─────────────────────────────── */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENES.tiles)}>
        <Camera to={1.05}>
          <Plate drift={0.5} />
          <TileWall />
          <Caption text="You meant to *read* tonight." />
        </Camera>
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.clock)}>
        <Camera to={1.04}>
          <Plate drift={0.5} />
          <ClockSweep />
          <Caption text="Then the *scrolling* took over." />
        </Camera>
      </TransitionSeries.Sequence>
      {t("from-right")}

      {/* ── real footage: the product ──────────────────────── */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENES.nudge)}>
        <Camera>
          <Plate />
          <Device
            src="clips/01_nudge.mp4"
            enter
            playbackRate={0.6}
            zoom={[1.0, 1.08]}
            focus={[0.44, 0.66]}
            tiltY={[-7, -2]}
            tiltX={[2, 0]}
          />
          <Sequence durationInFrames={sec(2.9)}>
            <Caption text="FlowRead catches you *first*." exitAt={12} />
          </Sequence>
          <Sequence from={sec(2.9)}>
            <Caption text="A gentle nudge. *Always your choice*." size={74} />
          </Sequence>
        </Camera>
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.reading)}>
        <Shot
          src="clips/02_reading.mp4"
          caption="Just a *few pages*."
          playbackRate={1.3}
          zoom={[1.0, 1.07]}
          focus={[0.44, 0.52]}
          tiltY={[5, 1]}
        />
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.unlock)}>
        <Shot
          src="clips/03_unlock.mp4"
          caption="Your clock *resets*."
          zoom={[1.08, 1.0]}
          focus={[0.45, 0.45]}
          tiltY={[-5, -1]}
        />
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.highlight)}>
        <Shot
          src="clips/04_highlight.mp4"
          caption="Keep the lines that *stay with you*."
          playbackRate={1.45}
          zoom={[1.0, 1.07]}
          focus={[0.46, 0.58]}
          tiltY={[5, 1]}
        />
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.dictionary)}>
        <Shot
          src="clips/05_dictionary.mp4"
          caption="And every *word* you learn."
          playbackRate={1.75}
          zoom={[1.0, 1.1]}
          focus={[0.44, 0.46]}
          tiltY={[-7, -2]}
        />
      </TransitionSeries.Sequence>
      {t()}

      {/* No catalogue count is quoted, so growing the library cannot date it. */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENES.library)}>
        <Shot
          src="clips/06_freebooks.mp4"
          caption="Start *free*, or bring your own."
          playbackRate={1.75}
          zoom={[1.0, 1.08]}
          focus={[0.44, 0.5]}
          tiltY={[5, 1]}
        />
      </TransitionSeries.Sequence>
      {t()}

      <TransitionSeries.Sequence durationInFrames={sec(SCENES.end)}>
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
