import { useCurrentFrame, interpolate, Easing } from "remotion";

/* A drawn feed, not a captured one.
   Recording a real social app put a stranger's account name, their post and
   their engagement counts into a Play Store listing, which is not ours to
   publish. Drawing it also keeps the video clear of another company's
   trademarks, and loses nothing: the shape of a feed is what reads at this
   size, never the words in it. */

const TINTS = ["#3b404b", "#4a3e36", "#39443c", "#474154", "#50453c", "#3d4450"];

const CARDS = Array.from({ length: 9 }, (_, i) => ({
  media: 210 + ((i * 53) % 130),
  tint: TINTS[i % TINTS.length],
  bar: 0.45 + ((i * 17) % 40) / 100,
}));

const Card: React.FC<{ c: (typeof CARDS)[number] }> = ({ c }) => (
  <div style={{ padding: "0 14px 22px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 2px" }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#30303a" }} />
      <div>
        <div style={{ width: 74, height: 7, borderRadius: 3, background: "#34343e" }} />
        <div style={{ width: 46, height: 5, borderRadius: 3, background: "#26262e", marginTop: 5 }} />
      </div>
    </div>
    <div style={{ height: c.media, borderRadius: 7, background: c.tint, opacity: 0.85 }} />
    <div style={{ display: "flex", gap: 11, padding: "11px 2px 7px" }}>
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ width: 17, height: 17, borderRadius: 4, background: "#2c2c35" }} />
      ))}
    </div>
    <div style={{ width: `${c.bar * 100}%`, height: 6, borderRadius: 3, background: "#2a2a33" }} />
    <div style={{ width: `${c.bar * 72}%`, height: 6, borderRadius: 3, background: "#232329", marginTop: 6 }} />
  </div>
);

export const Feed: React.FC = () => {
  const frame = useCurrentFrame();

  /* Accelerating, because that is what the beat is about: it starts as a look
     at the phone and turns into the thirty minutes the caption names. */
  const y = interpolate(frame, [0, 120], [0, 1760], {
    extrapolateRight: "extend",
    easing: Easing.bezier(0.3, 0, 0.75, 0.6),
  });

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0b0d", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: -(y % 3200) }}>
        {CARDS.map((c, i) => <Card key={`a${i}`} c={c} />)}
        {CARDS.map((c, i) => <Card key={`b${i}`} c={c} />)}
      </div>
      {/* the app's own bars, so the screen is a screen and not a list */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 38, background: "#0b0b0d" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, background: "#111114", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <div key={k} style={{ width: 17, height: 17, borderRadius: 4, background: k === 0 ? "#55555f" : "#2b2b33" }} />
        ))}
      </div>
    </div>
  );
};
