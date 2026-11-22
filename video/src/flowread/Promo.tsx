import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Plate } from "./Plate";
import { Stage, Screen } from "./Stage";
import { Caption } from "./Caption";
import { TileWall, ClockSweep } from "./Opener";
import { EndCard } from "./EndCard";
import { sec } from "./theme";

const OPENER = 7;
const PRODUCT = 30;
const END = 3.5;
const BLEND = 14;

export const TOTAL_FRAMES = sec(OPENER + PRODUCT + END);

/* Beat slots inside the product section, in seconds from its start.
   Playback rates fit each clip to its slot; none is sped up far enough to
   make the UI unreadable. */
const BEATS = [
  { at: 0,    len: 5.5, clip: "01_nudge.mp4",      rate: 0.6,  cap: "FlowRead catches you *first*." },
  { at: 5.5,  len: 5.0, clip: "02_reading.mp4",    rate: 1.3,  cap: "Just a *few pages*." },
  { at: 10.5, len: 4.5, clip: "03_unlock.mp4",     rate: 1.0,  cap: "Your clock *resets*." },
  { at: 15,   len: 6.0, clip: "04_highlight.mp4",  rate: 1.55, cap: "Keep the lines that *stay with you*." },
  { at: 21,   len: 4.5, clip: "05_dictionary.mp4", rate: 1.75, cap: "And every *word* you learn." },
  { at: 25.5, len: 4.5, clip: "06_freebooks.mp4",  rate: 1.75, cap: "Start *free*, or bring your own." },
];

/* The nudge beat carries a second line: the escape hatch is the point, and it
   needs saying while it is on screen. */
const NUDGE_SPLIT = 2.9;

const Fade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, BLEND], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* A hairline that wipes out under the caption. The only drawn flourish in the
   product section -- it keeps a thread back to the opener's vocabulary
   without putting motion anywhere near the footage. */
const Rule: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 132,
        top: 318,
        height: 3,
        width: interpolate(frame, [4, 26], [0, 132], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        background: "#e8c547",
        opacity: 0.85,
      }}
    />
  );
};

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Plate />

    {/* ── drawn: the problem ───────────────────────────────── */}
    <Sequence durationInFrames={sec(OPENER) + BLEND}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sec(3.6)}>
          <AbsoluteFill>
            <TileWall />
            <Caption text="You meant to *read* tonight." />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 10 })}
        />
        <TransitionSeries.Sequence durationInFrames={sec(3.8) + BLEND}>
          <AbsoluteFill>
            <ClockSweep />
            <Caption text="Then the *scrolling* took over." />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </Sequence>

    {/* ── real footage: one device, content changing inside it ── */}
    <Sequence from={sec(OPENER)} durationInFrames={sec(PRODUCT) + BLEND}>
      <Fade>
        <Stage>
          {BEATS.map((b, i) => (
            <Sequence
              key={b.clip}
              from={sec(b.at)}
              /* overruns its slot so the next screen dissolves over it */
              durationInFrames={sec(b.len) + (i === BEATS.length - 1 ? 0 : 18)}
            >
              <Screen>
                <Video
                  src={staticFile(`clips/${b.clip}`)}
                  muted
                  playbackRate={b.rate}
                  style={{ position: "absolute", inset: 0, width: "100%" }}
                />
              </Screen>
            </Sequence>
          ))}
        </Stage>

        {BEATS.map((b, i) =>
          i === 0 ? (
            <Sequence key="cap0" from={sec(b.at)} durationInFrames={sec(b.len)}>
              <Rule />
              <Sequence durationInFrames={sec(NUDGE_SPLIT)}>
                <Caption text={b.cap} exitAt={12} />
              </Sequence>
              <Sequence from={sec(NUDGE_SPLIT)}>
                <Caption text="A gentle nudge. *Always your choice*." size={74} />
              </Sequence>
            </Sequence>
          ) : (
            <Sequence key={b.clip} from={sec(b.at)} durationInFrames={sec(b.len)}>
              <Rule />
              <Caption text={b.cap} />
            </Sequence>
          ),
        )}
      </Fade>
    </Sequence>

    <Sequence from={sec(OPENER + PRODUCT)} durationInFrames={sec(END)}>
      <Fade>
        <EndCard />
      </Fade>
    </Sequence>
  </AbsoluteFill>
);
