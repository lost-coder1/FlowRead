import { Composition } from "remotion";
import "./flowread/fonts";
import { Promo, TOTAL_FRAMES } from "./flowread/Promo";
import { PromoVertical, V_WIDTH, V_HEIGHT } from "./flowread/PromoVertical";
import { FPS, WIDTH, HEIGHT } from "./flowread/theme";
import { Locale } from "./flowread/strings";

/* Four renders off two compositions: the orientation is layout, the locale is
   copy, and neither duplicates the edit. */
const CUTS: { id: string; locale: Locale; vertical: boolean }[] = [
  { id: "FlowReadPromo", locale: "en", vertical: false },
  { id: "FlowReadPromoVertical", locale: "en", vertical: true },
  { id: "FlowReadPromoHI", locale: "hi", vertical: false },
  { id: "FlowReadPromoVerticalHI", locale: "hi", vertical: true },
];

export const RemotionRoot: React.FC = () => (
  <>
    {CUTS.map(({ id, locale, vertical }) => (
      <Composition
        key={id}
        id={id}
        component={vertical ? PromoVertical : Promo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={vertical ? V_WIDTH : WIDTH}
        height={vertical ? V_HEIGHT : HEIGHT}
        defaultProps={{ locale }}
      />
    ))}
  </>
);
