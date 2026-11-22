import { Composition } from "remotion";
import { Promo, TOTAL_FRAMES } from "./flowread/Promo";
import { FPS, WIDTH, HEIGHT } from "./flowread/theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FlowReadPromo"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
