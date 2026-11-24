/* Every word that appears on screen, in one place.
   Two locales times two orientations is four renders, and copy that lives in
   the composition would have to be changed in all four. The compositions hold
   timing and layout; this holds language. */

export type Locale = "en" | "hi";

export type Strings = {
  tiles: string;
  clock: string;
  appsPrefix: string | null;
  apps: string[];
  beats: Record<string, { cap: string; cap2?: string; cap3?: string }>;
  tagline: string;
  features: string[];
  store: string;
};

export const STRINGS: Record<Locale, Strings> = {
  en: {
    tiles: "You meant to *read* tonight.",
    clock: "Then the *scrolling* took over.",
    appsPrefix: "Works with",
    apps: ["Instagram", "YouTube", "Reddit", "X", "any app"],
    beats: {
      "01_nudge.mp4": {
        cap: "FlowRead catches you *first*.",
        cap2: "A gentle nudge. *Always your choice*.",
      },
      "02_reading.mp4": { cap: "Just a *few pages*." },
      "03_unlock.mp4": { cap: "You traded scrolling for *reading*." },
      "04_highlight.mp4": { cap: "Keep the lines that *stay with you*." },
      "05_dictionary.mp4": { cap: "And every *word* you learn." },
      /* 16.37. Three statements over two screens: the free shelf, the
         month's pick, then your own file. The footage scrolls from the shelf
         up into the picks so the captions read in the order the screen does.

         "1 new book" is the *claim* -- one book a month, which is the fixed
         half of the mechanic. The number section 12 forbids is the size of
         the month's set, which is whatever `dropChoices` holds and cannot be
         written into a render. */
      "06_freebooks.mp4": {
        cap: "Start with a *free book*.",
        cap2: "Get *1 new book* every month.",
        cap3: "Or bring your *own*.",
      },
    },
    tagline: "Read more. Scroll less.",
    features: ["No account", "Works offline", "Free to start"],
    store: "Available on Google Play",
  },

  /* Supplied by the owner. The gold emphasis was marked in bold in the source
     document and bold does not survive a paste, so the spans below are chosen
     to fall on the same idea the English accents: the verb or the object that
     carries the line, never the whole sentence.

     The subline carries no "works with" lead-in because the script gives none,
     and it drops X for the same reason. Both are the script's call, not an
     omission here. */
  hi: {
    tiles: "आज रात *पढ़ने* का सोचा था।",
    clock: "फिर *स्क्रॉलिंग* हावी हो गई।",
    appsPrefix: null,
    apps: ["Instagram", "YouTube", "Reddit", "कोई भी ऐप"],
    beats: {
      "01_nudge.mp4": {
        cap: "FlowRead आपको *पहले ही* टोक देता है।",
        cap2: "एक हल्का इशारा। *फैसला हमेशा आपका*।",
      },
      "02_reading.mp4": { cap: "बस *कुछ पन्ने*।" },
      "03_unlock.mp4": { cap: "आपने स्क्रॉलिंग छोड़, *पढ़ना चुना*।" },
      "04_highlight.mp4": { cap: "जो लाइनें *साथ रह जाएं*, उन्हें सेव करें।" },
      "05_dictionary.mp4": { cap: "और हर *नया शब्द*, जो आप सीखें।" },
      /* NOT SIGNED OFF -- drafted here so the Hindi cut has three captions
         where the English one does, rather than rendering a gap. The owner
         supplies Hindi (section 16). */
      "06_freebooks.mp4": {
        cap: "शुरुआत करें एक *फ़्री किताब* से।",
        cap2: "हर महीने पाएं *1 नई किताब*।",
        cap3: "या *अपनी खुद की* लाएं।",
      },
    },
    /* NOT SIGNED OFF. The script ends at "FlowRead" and gives no Hindi for
       the closing card, so these three are drafted here rather than left as
       English or as blanks -- section 16's practice. They need the owner's
       pass before the listing goes live. */
    tagline: "ज़्यादा पढ़ें। कम स्क्रॉल करें।",
    features: ["कोई अकाउंट नहीं", "ऑफ़लाइन चलता है", "शुरुआत मुफ़्त"],
    store: "Google Play पर उपलब्ध",
  },
};
