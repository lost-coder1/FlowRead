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
import { TILES, FEED, PRODUCT, END, BLEND, BEATS, DETAILS, RAMP, APPS } from "./Promo";

/* The Shorts cut: 1080x1920, same film, same beats, same bed.
   Everything here is layout. The beat list, the clips, the captions and the
   timings are imported from the landscape cut rather than copied, so a change
   to the edit cannot land in one orientation and not the other. */

export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;

/* The caption goes above the phone instead of beside it, so the device gets
   the full width and the screen comes out 30% larger than in landscape --
   which is the whole reason this cut exists. */
const K = 1.3;
const G = geom(K);
const PHONE_LEFT = (V_WIDTH - G.w) / 2;
const PHONE_TOP = 490;

const CAP_TOP = 150;
const CAP_SIZE = 64;
const SUB_TOP = 352;

/* Gentler than landscape's 1.40: the screen is already larger here, and the
   phone has less room above and below to grow into. */
const PUSH = 1.14;

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

const SubLine: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute", left: 0, width: "100%", top: SUB_TOP,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 11,
        opacity: o, translate: `0px ${interpolate(o, [0, 1], [10, 0])}px`,
      }}
    >
      {APPS.map((a, i) => (
        <React.Fragment key={a}>
          {i > 0 ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8c547", opacity: 0.7 }} /> : null}
          <div
            style={{
              fontFamily: FONT, fontWeight: 500, fontSize: 27, letterSpacing: "0.015em",
              color: i === APPS.length - 1 ? "rgba(232,228,220,0.82)" : "rgba(232,228,220,0.62)",
            }}
          >
            {i === 0 ? `Works with ${a}` : a}
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

export const PromoVertical: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
    <Bed />
    <Plate portrait />

    <Sequence durationInFrames={sec(TILES) + BLEND}>
      <FadeOut>
        <TileWall centered />
        <Caption text="You meant to *read* tonight." align="center" top={CAP_TOP} size={CAP_SIZE} />
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
      <Caption text="Then the *scrolling* took over." align="center" top={CAP_TOP} size={CAP_SIZE} />
      <ClockReadout centered />
    </Sequence>

    <Sequence from={sec(TILES + FEED)} durationInFrames={sec(PRODUCT)}>
      <FadeIn>
        {BEATS.map((b) => (
          <Sequence key={b.clip} from={sec(b.at)} durationInFrames={sec(b.len)}>
            <Rule />
            {b.at === 0 ? <SubLine /> : null}
            {b.cap2 ? (
              <>
                <Sequence durationInFrames={sec(b.split!)}>
                  <Caption text={b.cap} align="center" top={CAP_TOP} size={CAP_SIZE} exitAt={12} />
                </Sequence>
                <Sequence from={sec(b.split!)}>
                  <Caption text={b.cap2} align="center" top={CAP_TOP} size={b.cap2Size ? CAP_SIZE - 6 : CAP_SIZE} />
                </Sequence>
              </>
            ) : (
              <Caption text={b.cap} align="center" top={CAP_TOP} size={CAP_SIZE} />
            )}
          </Sequence>
        ))}
      </FadeIn>
    </Sequence>

    <Sequence from={sec(TILES + FEED + PRODUCT)} durationInFrames={sec(END)}>
      <FadeIn>
        <EndCard portrait />
      </FadeIn>
    </Sequence>
  </AbsoluteFill>
);
