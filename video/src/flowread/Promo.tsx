import React from "react";
import { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { Plate } from "./Plate";
import { Stage, Screen, DrawnScreen } from "./Stage";
import { Feed } from "./Feed";
import { Caption } from "./Caption";
import { ClockReadout } from "./Clock";
import { TileWall } from "./Opener";
import { EndCard } from "./EndCard";
import { sec, PHONE, WIDTH, HEIGHT, FONT } from "./theme";
import { STRINGS, Locale } from "./strings";

/* The nudge has to be on screen inside five seconds: that is where people
   leave. The two drawn beats state the problem and get out of the way. */
export const TILES = 2.0;
export const FEED = 2.3;
export const PRODUCT = 27.0;
export const END = 3.2;
export const BLEND = 14;

export const TOTAL_FRAMES = sec(TILES + FEED + PRODUCT + END);

const STAGE_IN = TILES;              /* the phone arrives on the feed beat */
const PRODUCT_IN = TILES + FEED;
const STAGE_LEN = FEED + PRODUCT;

export type Beat = {
  at: number;
  len: number;
  clip: string;
  rate: number;
  /* A beat that makes two statements owes two screens and two captions.
     `split` is where the still takes over the screen. `capSplit` is where the
     caption changes *inside* the clip, for a beat that says two things over
     one piece of footage -- beat 6 shows the free shelf, scrolls up to the
     month's picks, and then cuts to the import screen, which is three
     statements over two screens. Without capSplit the caption change and the
     screen change are the same instant, which is what the other beats want. */
  split?: number;
  capSplit?: number;
  cap2Size?: number;
  still?: string;
};

export const BEATS: Beat[] = [
  { at: 0,    len: 5.0, clip: "01_nudge.mp4",      rate: 0.6,  split: 2.6, cap2Size: 72 },
  { at: 5.0,  len: 4.5, clip: "02_reading.mp4",    rate: 1.3 },
  { at: 9.5,  len: 4.0, clip: "03_unlock.mp4",     rate: 1.0 },
  /* Highlighting and the dictionary are real, but they are not what makes
     this app different -- Kindle has both -- and at eleven seconds they were
     taking a quarter of the film. Cut to six and a half between them, which
     means each is shown faster: enough to reach the payoff, not enough to
     study. That is the right trade for a feature nobody installs for. */
  { at: 13.5, len: 3.5, clip: "04_highlight.mp4",  rate: 2.2 },
  { at: 17.0, len: 3.0, clip: "05_dictionary.mp4", rate: 2.4 },
  /* 16.37. The footage starts on the free shelf and scrolls up into the
     month's picks, so the captions read in the order the screen does. Longer
     than the 5.5 it was: three statements at the old length gave the middle
     one 1.4s, which is under what a staggered line needs to land (rule 8). */
  {
    at: 20.0, len: 7.0, clip: "06_freebooks.mp4", rate: 1.37,
    split: 4.6, capSplit: 2.6, still: "FlowReadOwnbookNewSS.jpeg",
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
export const RAMP = 0.5;
export const DETAILS: [number, number][] = [
  [FEED + 0, FEED + 5.0],        /* the nudge */
  [FEED + 9.5, FEED + 13.5],     /* the completion card */
  [FEED + 24.6, FEED + 27.0],    /* the import screen */
];

/* 16.36. The footage is locale-scoped, not just the copy.

   It used to be `clips/<name>`, one file for both cuts, which is why the
   Hindi film ran Hindi captions over an English device: there was nowhere to
   put a Hindi recording. A Hindi viewer was being told the app speaks Hindi
   by the caption and told otherwise by the screen underneath it, which is
   worse than an honest English cut.

   So section 27's rule grows one clause: orientation is layout, locale is
   copy *and footage*. The beat list still holds one name per beat and both
   orientations still share it -- only the directory changes. A locale whose
   recording has not been shot yet carries a copy of the English one, so the
   cut always renders and what is still owed is visible as a duplicate file
   rather than as a broken render. */
export const clipSrc = (locale: Locale, clip: string) => `clips/${locale}/${clip}`;
export const stillSrc = (locale: Locale, still: string) => `shots/${locale}/${still}`;

/* One place that decides when each of a beat's captions is up, because both
   orientations have to agree and they draw the caption differently. The cut
   list is beat-relative seconds; the compositions supply the type scale. */
export type CapCut = { from: number; len: number; text: string; idx: number; exit: boolean };

export const capCuts = (
  b: Beat,
  s: { cap: string; cap2?: string; cap3?: string },
): CapCut[] => {
  const marks: number[] = [0];
  if (s.cap2) marks.push(b.capSplit ?? b.split!);
  if (s.cap3) marks.push(b.split!);
  const texts = [s.cap, s.cap2, s.cap3].filter(Boolean) as string[];
  return texts.map((text, i) => {
    const from = marks[i];
    const to = i + 1 < marks.length ? marks[i + 1] : b.len;
    return { from, len: to - from, text, idx: i, exit: i + 1 < marks.length };
  });
};

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

/* The film can only show one app being intercepted, and a viewer reasonably
   concludes that is the only one it handles. It is not: section 8.4 narrows
   the accessibility filter to whatever the user picks, from a <queries>
   listing of every launcher app on the device. Said once, under the beat that
   introduces the mechanic, and set quietly so it reads as a fact rather than
   a second headline.

   The claim is compatibility, not quantity -- section 3 gives the free tier
   one app at a time -- so it says "works with", never "all at once". */
const SubLine: React.FC<{ locale?: Locale }> = ({ locale = "en" }) => {
  const frame = useCurrentFrame();
  const { apps, appsPrefix } = STRINGS[locale];
  const o = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 132,
        top: 612,
        display: "flex",
        alignItems: "center",
        gap: 13,
        opacity: o,
        translate: `0px ${interpolate(o, [0, 1], [10, 0])}px`,
      }}
    >
      {apps.map((a, i) => (
        <React.Fragment key={a}>
          {i > 0 ? (
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8c547", opacity: 0.7 }} />
          ) : null}
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 32,
              letterSpacing: "0.015em",
              color: i === apps.length - 1 ? "rgba(232,228,220,0.82)" : "rgba(232,228,220,0.62)",
            }}
          >
            {i === 0 && appsPrefix ? `${appsPrefix} ${a}` : a}
          </div>
        </React.Fragment>
      ))}
    </div>
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

export const Promo: React.FC<{ locale?: Locale }> = ({ locale = "en" }) => {
  const S = STRINGS[locale];
  return (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Bed />
    <Plate />

    <Sequence durationInFrames={sec(TILES) + BLEND}>
      <FadeOut>
        <TileWall />
        <Caption text={S.tiles} />
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
                      src={staticFile(clipSrc(locale, b.clip))}
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
                      <Img src={staticFile(stillSrc(locale, b.still))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
      <Caption text={S.clock} />
      <ClockReadout />
    </Sequence>

    <Sequence from={sec(PRODUCT_IN)} durationInFrames={sec(PRODUCT)}>
      <FadeIn>
        {BEATS.map((b) => (
          <Sequence key={b.clip} from={sec(b.at)} durationInFrames={sec(b.len)}>
            <Rule />
            {b.at === 0 ? <SubLine locale={locale} /> : null}
            {capCuts(b, S.beats[b.clip]).map((c) => (
              <Sequence key={c.idx} from={sec(c.from)} durationInFrames={sec(c.len)}>
                <Caption
                  text={c.text}
                  size={c.idx === 0 ? undefined : c.idx === 1 ? b.cap2Size ?? 84 : 84}
                  exitAt={c.exit ? 12 : undefined}
                />
              </Sequence>
            ))}
          </Sequence>
        ))}
      </FadeIn>
    </Sequence>

    <Sequence from={sec(TILES + FEED + PRODUCT)} durationInFrames={sec(END)}>
      <FadeIn>
        <EndCard locale={locale} />
      </FadeIn>
    </Sequence>
    </AbsoluteFill>
  );
};
