import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { Plate } from "./Plate";
import { Stage, Screen, DrawnScreen } from "./Stage";
import { Feed } from "./Feed";
import { Caption } from "./Caption";
import { ClockReadout } from "./Clock";
import { TileWall } from "./Opener";
import { EndCard } from "./EndCard";
import { sec } from "./theme";

const TILES = 3.5;
const FEED = 3.5;
const PRODUCT = 30;
const END = 3.5;
const BLEND = 14;

export const TOTAL_FRAMES = sec(TILES + FEED + PRODUCT + END);

const STAGE_IN = TILES;                 /* the phone arrives on the feed beat */
const PRODUCT_IN = TILES + FEED;
const STAGE_LEN = FEED + PRODUCT;

/* Beat slots, in seconds from the start of the product section. */
const BEATS = [
  { at: 0,    len: 5.5, clip: "01_nudge.mp4",      rate: 0.6,  cap: "FlowRead catches you *first*." },
  { at: 5.5,  len: 5.0, clip: "02_reading.mp4",    rate: 1.3,  cap: "Just a *few pages*." },
  { at: 10.5, len: 4.5, clip: "03_unlock.mp4",     rate: 1.0,  cap: "Your clock *resets*." },
  { at: 15,   len: 6.0, clip: "04_highlight.mp4",  rate: 1.55, cap: "Keep the lines that *stay with you*." },
  { at: 21,   len: 4.5, clip: "05_dictionary.mp4", rate: 1.75, cap: "And every *word* you learn." },
  { at: 25.5, len: 4.5, clip: "06_freebooks.mp4",  rate: 1.75, cap: "Start *free*, or bring your own." },
];

const NUDGE_SPLIT = 2.9;

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, BLEND], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      {children}
    </AbsoluteFill>
  );
};

const FadeOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [durationInFrames - BLEND, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      {children}
    </AbsoluteFill>
  );
};

/* A hairline wiping out above each caption -- the only drawn flourish left in
   the product half, and nowhere near the footage. */
const Rule: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 132,
        top: 318,
        height: 3,
        width: interpolate(frame, [4, 26], [0, 132], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        background: "#e8c547",
        opacity: 0.85,
      }}
    />
  );
};

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Plate />

    <Sequence durationInFrames={sec(TILES) + BLEND}>
      <FadeOut>
        <TileWall />
        <Caption text="You meant to *read* tonight." />
      </FadeOut>
    </Sequence>

    {/* The device enters once, here, and does not move again until the end
        card. The feed it arrives on is the problem; everything after it on
        the same screen is the answer. */}
    <Sequence from={sec(STAGE_IN)} durationInFrames={sec(STAGE_LEN) + BLEND}>
      <FadeOut>
        <Stage>
          <Sequence durationInFrames={sec(FEED) + 20}>
            <DrawnScreen>
              <Feed />
            </DrawnScreen>
          </Sequence>

          {BEATS.map((b, i) => (
            <Sequence
              key={b.clip}
              from={sec(FEED + b.at)}
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
      </FadeOut>
    </Sequence>

    <Sequence from={sec(STAGE_IN)} durationInFrames={sec(FEED)}>
      <Caption text="Then the *scrolling* took over." />
      <ClockReadout />
    </Sequence>

    <Sequence from={sec(PRODUCT_IN)} durationInFrames={sec(PRODUCT)}>
      <FadeIn>
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
      </FadeIn>
    </Sequence>

    <Sequence from={sec(TILES + FEED + PRODUCT)} durationInFrames={sec(END)}>
      <FadeIn>
        <EndCard />
      </FadeIn>
    </Sequence>
  </AbsoluteFill>
);
