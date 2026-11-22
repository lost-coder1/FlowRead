import { continueRender, delayRender, staticFile } from "remotion";

/* Bundled, not fetched. The app pulls Noto Sans Devanagari from the Google
   Fonts CDN at runtime, which is right for the app and wrong for a render:
   it would make the output depend on the network and on whatever the CDN
   serves that day. 120KB of variable subset in public/ makes every render of
   the Hindi cuts byte-reproducible and offline. */
const handle = delayRender("Noto Sans Devanagari");

const font = new FontFace(
  "Noto Sans Devanagari",
  `url(${staticFile("fonts/noto-sans-devanagari.woff2")}) format("woff2")`,
  { weight: "100 900" },
);

font
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  /* A missing face must not hang the render: Devanagari would fall back to a
     system font, which is visibly wrong but still reports rather than hangs. */
  .catch(() => continueRender(handle));
