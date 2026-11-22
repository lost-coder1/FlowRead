import React from "react";
import { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { Plate } from "./Plate";
import { Stage, Screen, DrawnScreen, geom } from "./Stage";
import { Feed } from "./Feed";
import { Caption } from "./Caption";
import { ClockReadout } from "./Clock";
import { TileWall } from "./Opener";
import { EndCard } from "./EndCard";
import { sec, FONT } from "./theme";
import { TILES, FEED, PRODUCT, END, BLEND, BEATS, DETAILS, RAMP } from "./Promo";
import { STRINGS, Locale } from "./strings";

/* The Shorts cut: 1080x1920, same film, same beats, same bed.
   Everything here is layout. The beat list, the clips, the captions and the
   timings are imported from the landscape cut rather than copied, so a change
   to the edit cannot land in one orientation and not the other. */

export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;

/* The caption goes above the phone instead of beside it, so the device gets
   the full width and the screen comes out 30% larger than in landscape --
   which is the whole reason this cut exists. */
/* Sized against the platform, not the frame. Instagram Reels and YouTube
   Shorts cover the bottom fifth with captions, the handle and the audio bar,
   and at 1.30/490 every call to action landed inside it -- "Start reading" at
   1553, the escape hatch at 1632, "Open Instagram" at 1667, against a safe
   line of 1536. Smaller and higher puts the worst of them at 1489. */
const K = 1.22;
const G = geom(K);
const PHONE_LEFT = (V_WIDTH - G.w) / 2;
const PHONE_TOP = 410;

/* The frame has generous dark margin up top and the headline was not using
   it, which left the subline flush against the bezel. */
const CAP_TOP = 120;
const CAP_SIZE = 64;
const SUB_TOP = 296;

/* Gentler than landscape's 1.40: the screen is already larger here, the
   phone has less room to grow into, and every pixel it grows downward pushes
   a call to action closer to the platform's overlay. */
const PUSH = 1.08;

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

const Push: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const xs: number[] = [0];
  const ys: number[] = [0];
  DETAILS.forEach(([a, b]) => {
    xs.push(sec(a - RAMP), sec(a), sec(b), sec(b + RAMP));
    ys.push(0, 1, 1, 0);
  });
  const lin = interpolate(frame, xs, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const d = lin * lin * (3 - 2 * lin);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${V_WIDTH / 2}px ${PHONE_TOP + G.h / 2}px`,
        transform: `scale(${1 + (PUSH - 1) * d})`,
      }}
    >
      {children}
    </div>
  );
};

const Rule: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute", left: 0, width: "100%", top: 96,
        display: "flex", justifyContent: "center",
      }}
    >
      <div
        style={{
          height: 3,
          width: interpolate(frame, [4, 26], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          background: "#e8c547",
          opacity: 0.85,
        }}
      />
    </div>
  );
};

const SubLine: React.FC<{ locale: Locale }> = ({ locale }) => {
  const frame = useCurrentFrame();
  const { apps, appsPrefix } = STRINGS[locale];
  const o = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute", left: 0, width: "100%", top: SUB_TOP,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 11,
        opacity: o, translate: `0px ${interpolate(o, [0, 1], [10, 0])}px`,
      }}
    >
      {apps.map((a, i) => (
        <React.Fragment key={a}>
          {i > 0 ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8c547", opacity: 0.7 }} /> : null}
          <div
            style={{
              fontFamily: FONT, fontWeight: 500, fontSize: 27, letterSpacing: "0.015em",
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

const Bed: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("audio/bed.m4a")}
      volume={(f) =>
        interpolate(f, [0, 24, durationInFrames - 78, durationInFrames - 4], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

export const PromoVertical: React.FC<{ locale?: Locale }> = ({ locale = "en" }) => {
  const S = STRINGS[locale];
  return (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Bed />
    <Plate portrait />

    <Sequence durationInFrames={sec(TILES) + BLEND}>
      <FadeOut>
        <TileWall centered />
        <Caption text={S.tiles} align="center" top={CAP_TOP} size={CAP_SIZE} />
      </FadeOut>
    </Sequence>

    <Sequence from={sec(TILES)} durationInFrames={sec(FEED + PRODUCT) + BLEND}>
      <FadeOut>
        <Push>
          <Stage k={K} left={PHONE_LEFT} top={PHONE_TOP}>
            <Sequence durationInFrames={sec(FEED) + 20}>
              <DrawnScreen k={K}>
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
                      <Video src={staticFile(`clips/${b.clip}`)} muted playbackRate={b.rate} style={{ position: "absolute", inset: 0, width: "100%" }} />
                    </Screen>
                  </Sequence>
                  {b.still ? (
                    <Sequence from={sec(b.split!)} durationInFrames={sec(b.len - b.split!)}>
                      <DrawnScreen k={K}>
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

    <Sequence from={sec(TILES)} durationInFrames={sec(FEED)}>
      <Caption text={S.clock} align="center" top={CAP_TOP} size={CAP_SIZE} />
      <ClockReadout centered />
    </Sequence>

    <Sequence from={sec(TILES + FEED)} durationInFrames={sec(PRODUCT)}>
      <FadeIn>
        {BEATS.map((b) => (
          <Sequence key={b.clip} from={sec(b.at)} durationInFrames={sec(b.len)}>
            <Rule />
            {b.at === 0 ? <SubLine locale={locale} /> : null}
            {S.beats[b.clip].cap2 ? (
              <>
                <Sequence durationInFrames={sec(b.split!)}>
                  <Caption text={S.beats[b.clip].cap} align="center" top={CAP_TOP} size={CAP_SIZE} exitAt={12} />
                </Sequence>
                <Sequence from={sec(b.split!)}>
                  <Caption text={S.beats[b.clip].cap2!} align="center" top={CAP_TOP} size={b.cap2Size ? CAP_SIZE - 6 : CAP_SIZE} />
                </Sequence>
              </>
            ) : (
              <Caption text={S.beats[b.clip].cap} align="center" top={CAP_TOP} size={CAP_SIZE} />
            )}
          </Sequence>
        ))}
      </FadeIn>
    </Sequence>

    <Sequence from={sec(TILES + FEED + PRODUCT)} durationInFrames={sec(END)}>
      <FadeIn>
        <EndCard portrait locale={locale} />
      </FadeIn>
    </Sequence>
    </AbsoluteFill>
  );
};
