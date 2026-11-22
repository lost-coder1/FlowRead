/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
/* PNG, not JPEG. Every frame was being JPEG-compressed at quality 80 before
   the H.264 encoder ever saw it, which is a lossy generation spent on the one
   thing this video is made of: small app text. */
Config.setVideoImageFormat("png");

/* The default CRF of 18 was sized for a frame that is mostly flat gradient.
   The vertical cut gives the phone 54% of the frame width against the
   landscape cut's 25%, so it carries 2.2x the fine detail -- and at the
   default it was being handed 16% FEWER bits, about 61% less bitrate per unit
   of detail. That gap, not resolution, is why it looked softer: nothing here
   is upscaled, and the vertical actually shows MORE source pixels than the
   landscape (584px across the screen against 479px, from a 1080px capture). */
Config.setCrf(15);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
