import { Composition } from "remotion";
import { Promo, TOTAL_FRAMES } from "./flowread/Promo";
import { PromoVertical, V_WIDTH, V_HEIGHT } from "./flowread/PromoVertical";
import { FPS, WIDTH, HEIGHT } from "./flowread/theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FlowReadPromo"
        component={Promo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="FlowReadPromoVertical"
        component={PromoVertical}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
      />
    </>
  );
};
