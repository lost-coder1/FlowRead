import { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
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
const PRODUCT = 31.5;
const END = 3.5;
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
    at: 0, len: 5.5, clip: "01_nudge.mp4", rate: 0.6,
    cap: "FlowRead catches you *first*.",
    /* The escape hatch is the whole point of that screen, so it gets said
       while the screen is still up rather than left to be noticed. */
    split: 2.9, cap2: "A gentle nudge. *Always your choice*.", cap2Size: 74,
  },
  { at: 5.5,  len: 5.0, clip: "02_reading.mp4",    rate: 1.3,  cap: "Just a *few pages*." },
  { at: 10.5, len: 4.5, clip: "03_unlock.mp4",     rate: 1.0,  cap: "Your clock *resets*." },
  { at: 15,   len: 6.0, clip: "04_highlight.mp4",  rate: 1.55, cap: "Keep the lines that *stay with you*." },
  { at: 21,   len: 4.5, clip: "05_dictionary.mp4", rate: 1.75, cap: "And every *word* you learn." },
  {
    at: 25.5, len: 6.0, clip: "06_freebooks.mp4", rate: 1.75,
    cap: "Start with the *free books*.",
    /* The catalogue alone left "bring your own" as an unbacked claim. This is
       the import screen the eighth store screenshot is built from, so the
       second half of the offer is shown rather than merely asserted. */
    split: 3.0, cap2: "Or bring your *own*.",
    still: "shots/FlowReadOwnbookNewSS.jpeg",
  },
];

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
