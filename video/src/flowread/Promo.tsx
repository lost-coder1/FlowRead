import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Plate } from "./Plate";
import { PhoneFrame } from "./PhoneFrame";
import { Caption } from "./Caption";
import { AbstractFeed, RunawayClock } from "./AbstractFeed";
import { EndCard } from "./EndCard";
import { sec } from "./theme";

/* Scene lengths, in seconds, before transitions eat into them.
   The two nudge beats share one scene rather than cutting between identical
   frames: the push continues across both captions instead of restarting. */
export const SCENES = {
  doomscroll: 5,
  nudge: 8,
  reading: 6,
  reward: 4,
  highlight: 4,
  dictionary: 3,
  freebooks: 5,
  endcard: 3,
} as const;

export const XFADE = 12;
const TRANSITIONS = Object.keys(SCENES).length - 1;

export const TOTAL_FRAMES =
  Object.values(SCENES).reduce((a, b) => a + sec(b), 0) - TRANSITIONS * XFADE;

const Shot: React.FC<{
  src: string;
  caption: string;
  zoom?: [number, number];
  focus?: [number, number];
  enter?: boolean;
}> = ({ src, caption, zoom, focus, enter }) => (
  <AbsoluteFill>
    <Plate />
    <PhoneFrame src={src} zoom={zoom} focus={focus} enter={enter} />
    <Caption text={caption} />
  </AbsoluteFill>
);

const FadeIn: React.FC<{ frames?: number; children: React.ReactNode }> = ({
  frames = 10,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ opacity: interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" }) }}
    >
      {children}
    </AbsoluteFill>
  );
};

const t = () => (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: XFADE })}
  />
);

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0b" }}>
      <TransitionSeries>
        {/* 1. The problem, drawn rather than captured. */}
        <TransitionSeries.Sequence durationInFrames={sec(SCENES.doomscroll)}>
          <AbsoluteFill>
            <AbstractFeed />
            <Sequence durationInFrames={sec(2.6)}>
              <Caption text="You meant to read tonight." align="center" size={96} />
            </Sequence>
            <Sequence from={sec(2.6)}>
              <RunawayClock />
              <Caption text="Then the scrolling took over." align="center" size={96} />
            </Sequence>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        {t()}

        {/* 2. The nudge arrives and is held, so the escape hatch is readable.
               One continuous push across both captions. */}
        <TransitionSeries.Sequence durationInFrames={sec(SCENES.nudge)}>
          <AbsoluteFill>
            <Plate />
            <PhoneFrame
              src="shots/FlowReadSS1.jpeg"
              enter
              zoom={[1, 1.3]}
              focus={[0.45, 0.78]}
            />
            <Sequence durationInFrames={sec(4)}>
              <Caption text="FlowRead catches you first." />
            </Sequence>
            <Sequence from={sec(4)}>
              <Caption text="A gentle nudge. Always your choice." size={82} />
            </Sequence>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        {t()}

        <TransitionSeries.Sequence durationInFrames={sec(SCENES.reading)}>
          <Shot
            src="shots/FlowreadHighlight.jpeg"
            caption="Just a few pages."
            zoom={[1.0, 1.08]}
            focus={[0.3, 0.46]}
          />
        </TransitionSeries.Sequence>
        {t()}

        <TransitionSeries.Sequence durationInFrames={sec(SCENES.reward)}>
          <Shot
            src="shots/FlowReadClosedNudge.jpeg"
            caption="Your clock resets."
            zoom={[1.12, 1.04]}
            focus={[0.46, 0.46]}
          />
        </TransitionSeries.Sequence>
        {t()}

        {/* STAND-IN: the highlights list is not captured yet, so the reading
            shot stands in for it. Replace once the device session happens. */}
        <TransitionSeries.Sequence durationInFrames={sec(SCENES.highlight)}>
          <Shot
            src="shots/FlowreadHighlight.jpeg"
            caption="Keep the lines that stay with you."
            zoom={[1.14, 1.22]}
            focus={[0.46, 0.5]}
          />
        </TransitionSeries.Sequence>
        {t()}

        {/* STAND-IN: saved words screen not captured yet. */}
        <TransitionSeries.Sequence durationInFrames={sec(SCENES.dictionary)}>
          <Shot
            src="shots/FlowReadHome2.jpeg"
            caption="And every word you learn."
            zoom={[1.04, 1.12]}
            focus={[0.62, 0.84]}
          />
        </TransitionSeries.Sequence>
        {t()}

        {/* The library beat is the choice, not a catalogue size: start with
            something free, or bring what you already have. No count is quoted,
            so the catalogue can grow without dating the video. */}
        <TransitionSeries.Sequence durationInFrames={sec(SCENES.freebooks)}>
          <AbsoluteFill>
            <Plate />
            <Sequence durationInFrames={sec(2.9)}>
              <PhoneFrame
                src="shots/FlowReadFreeBook.jpeg"
                zoom={[1.0, 1.1]}
                focus={[0.34, 0.58]}
              />
              <Caption text="Start with a free book." />
            </Sequence>
            <Sequence from={sec(2.7)}>
              <FadeIn>
                <PhoneFrame
                  src="shots/FlowReadOwnbookNewSS.jpeg"
                  zoom={[1.0, 1.08]}
                  focus={[0.42, 0.56]}
                />
                <Caption text="Or bring your own." />
              </FadeIn>
            </Sequence>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        {t()}

        <TransitionSeries.Sequence durationInFrames={sec(SCENES.endcard)}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
