import { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { Plate } from "./Plate";
import { Stage, Screen, DrawnScreen } from "./Stage";
import { Feed } from "./Feed";
import { Caption } from "./Caption";
import { ClockReadout } from "./Clock";
import { TileWall } from "./Opener";
import { EndCard } from "./EndCard";
import { sec, PHONE, WIDTH, HEIGHT } from "./theme";

/* The nudge has to be on screen inside five seconds: that is where people
   leave. The two drawn beats state the problem and get out of the way. */
const TILES = 2.0;
const FEED = 2.3;
const PRODUCT = 25.5;
const END = 3.2;
const BLEND = 14;

export const TOTAL_FRAMES = sec(TILES + FEED + PRODUCT + END);

const STAGE_IN = TILES;              /* the phone arrives on the feed beat */
const PRODUCT_IN = TILES + FEED;
const STAGE_LEN = FEED + PRODUCT;

type Beat = {
  at: number;
  len: number;
  clip: string;
  rate: number;
  cap: string;
  /* A beat that makes two statements owes two screens and two captions. */
  split?: number;
  cap2?: string;
  cap2Size?: number;
  still?: string;
};

const BEATS: Beat[] = [
  {
    at: 0, len: 5.0, clip: "01_nudge.mp4", rate: 0.6,
    cap: "FlowRead catches you *first*.",
    split: 2.6, cap2: "A gentle nudge. *Always your choice*.", cap2Size: 72,
  },
  { at: 5.0,  len: 4.5, clip: "02_reading.mp4", rate: 1.3, cap: "Just a *few pages*." },
  {
    at: 9.5, len: 4.0, clip: "03_unlock.mp4", rate: 1.0,
    /* "Your clock resets" is the mechanism, which only means anything to
       someone who already knows the mechanism. This says what happened. */
    cap: "You traded scrolling for *reading*.",
  },
  /* Highlighting and the dictionary are real, but they are not what makes
     this app different -- Kindle has both -- and at eleven seconds they were
     taking a quarter of the film. Cut to six and a half between them, which
     means each is shown faster: enough to reach the payoff, not enough to
     study. That is the right trade for a feature nobody installs for. */
  { at: 13.5, len: 3.5, clip: "04_highlight.mp4",  rate: 2.2, cap: "Keep the lines that *stay with you*." },
  { at: 17.0, len: 3.0, clip: "05_dictionary.mp4", rate: 2.4, cap: "And every *word* you learn." },
  {
    at: 20.0, len: 5.5, clip: "06_freebooks.mp4", rate: 1.75,
    cap: "Start with the *free books*.",
    split: 2.8, cap2: "Or bring your *own*.",
    still: "shots/FlowReadOwnbookNewSS.jpeg",
  },
];

/* A held push, not a drift.
   The whole phone at this size makes its own UI small, so the three screens
   that are text rather than picture -- the nudge, the completion card and the
   import grid -- are moved closer for as long as they are up. The device is
   still never zoomed *into*: the camera scales the whole thing, so the app's
   layout is never cropped and never reflows. It eases in at the boundary,
   holds dead still for the beat, and eases back out.

   Windows are in stage-relative seconds; the stage starts at the feed. */
/* 1.40, and no closer. At 1.45 the push cut off "Continue to Instagram
   anyway" -- the escape hatch section 8.1 makes a product rule, and the thing
   the very next caption claims. A promo that crops it is making a claim its
   own footage contradicts. At 1.40 the visible band is 75.6% of the phone,
   placed at 0.147-0.903, which holds the headline and both buttons. */
const PUSH = 1.40;
const PUSH_X = -88;    /* keeps the phone's left edge clear of the captions */
const PUSH_Y = -36;    /* centres on 0.525 of the screen, not its middle */
const RAMP = 0.5;
const DETAILS: [number, number][] = [
  [FEED + 0, FEED + 5.0],        /* the nudge */
  [FEED + 9.5, FEED + 13.5],     /* the completion card */
  [FEED + 22.8, FEED + 25.5],    /* the import screen */
];

const Push: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const xs: number[] = [0];
  const ys: number[] = [0];
  DETAILS.forEach(([a, b]) => {
    xs.push(sec(a - RAMP), sec(a), sec(b), sec(b + RAMP));
    ys.push(0, 1, 1, 0);
  });
  const lin = interpolate(frame, xs, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const d = lin * lin * (3 - 2 * lin);   /* smoothstep, so the ramp has no corners */

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${WIDTH - 190 - PHONE.width / 2}px ${HEIGHT / 2}px`,
        transform: `translate(${PUSH_X * d}px, ${PUSH_Y * d}px) scale(${1 + (PUSH - 1) * d})`,
      }}
    >
      {children}
    </div>
  );
};

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
        position: "absolute", left: 132, top: 318, height: 3,
        width: interpolate(frame, [4, 26], [0, 132], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        background: "#e8c547", opacity: 0.85,
      }}
    />
  );
};

/* The bed is pre-normalised to about -14 LUFS in public/audio, not attenuated
   here: the source track is -10.7 LUFS, which is hot enough that riding it
   down with a volume number would leave its dynamics squashed against the
   ceiling. Fades only, in frames, so changing the runtime cannot strand them.

   It carries nothing. The clips are muted and the captions say everything the
   video has to say, because a store listing autoplays silent and most people
   will never hear this. */
const Bed: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("audio/bed.m4a")}
      volume={(f) =>
        interpolate(
          f,
          [0, 24, durationInFrames - 78, durationInFrames - 4],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      }
    />
  );
};

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Bed />
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
        <Push>
        <Stage>
          <Sequence durationInFrames={sec(FEED) + 20}>
            <DrawnScreen>
              <Feed />
            </DrawnScreen>
          </Sequence>

          {BEATS.map((b, i) => {
            const last = i === BEATS.length - 1;
            const clipLen = b.still ? sec(b.split!) + 18 : sec(b.len) + (last ? 0 : 18);
            return (
              <Sequence key={b.clip} from={sec(FEED + b.at)}>
                <Sequence durationInFrames={clipLen}>
                  <Screen>
                    <Video
                      src={staticFile(`clips/${b.clip}`)}
                      muted
                      playbackRate={b.rate}
                      style={{ position: "absolute", inset: 0, width: "100%" }}
                    />
                  </Screen>
                </Sequence>
                {b.still ? (
                  /* 786x1601: already cropped to the screen, with no status bar
                     to hide, so it fills the screen box rather than the capture
                     box the recordings are placed in. */
                  <Sequence from={sec(b.split!)} durationInFrames={sec(b.len - b.split!)}>
                    <DrawnScreen>
                      <Img src={staticFile(b.still)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </DrawnScreen>
                  </Sequence>
                ) : null}
              </Sequence>
            );
          })}
        </Stage>
        </Push>
      </FadeOut>
    </Sequence>

    <Sequence from={sec(STAGE_IN)} durationInFrames={sec(FEED)}>
      <Caption text="Then the *scrolling* took over." />
      <ClockReadout />
    </Sequence>

    <Sequence from={sec(PRODUCT_IN)} durationInFrames={sec(PRODUCT)}>
      <FadeIn>
        {BEATS.map((b) => (
          <Sequence key={b.clip} from={sec(b.at)} durationInFrames={sec(b.len)}>
            <Rule />
            {b.cap2 ? (
              <>
                <Sequence durationInFrames={sec(b.split!)}>
                  <Caption text={b.cap} exitAt={12} />
                </Sequence>
                <Sequence from={sec(b.split!)}>
                  <Caption text={b.cap2} size={b.cap2Size ?? 84} />
                </Sequence>
              </>
            ) : (
              <Caption text={b.cap} />
            )}
          </Sequence>
        ))}
      </FadeIn>
    </Sequence>

    <Sequence from={sec(TILES + FEED + PRODUCT)} durationInFrames={sec(END)}>
      <FadeIn>
        <EndCard />
      </FadeIn>
    </Sequence>
  </AbsoluteFill>
);
