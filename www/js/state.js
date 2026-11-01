/* Global application state — single source of truth */

const AppState = {
  currentFile: null,     /* { id, name, words, pageWordIndex, rawLines, metadata, pdfDoc } */
  currentIndex: 0,       /* current word position across all engines */
  wpm: 260,
  settings: {},
  isPro: false,       /* derived gate: "has paid for anything still good" — either tier.
                         NOT the lifetime purchase; that is ownsLifetime below. */
  ownsLifetime: false,  /* the one-time pro_lifetime purchase specifically */
  isSubscriber: false,  /* an active flowread_plus subscription. Stored and read
                           independently of ownsLifetime (§4) — either alone unlocks
                           everything that exists today, but the monthly book drops
                           will need to tell the two apart. */
  subscriptionRenewing: false,  /* false for a cancelled subscription still inside the
                                   period it was paid for — entitled, but don't re-offer */
  isPlaying: false,
  currentView: 'view-upload',
  currentEngine: 'rsvp',
  normalPage: 1,
  normalZoom: 1,
  normalFitWidth: true,
  lastReaderEngine: 'rsvp',
  normalRenderToken: 0,
  chapters: [],
  isIndexOpen: false,
  activeModal: null,
  onboardingCalibrationWpm: 200,
  readerSource: 'upload',   /* 'upload' | 'dashboard' | 'free-books' | 'nudge' — where the file was opened from */
  nudgeContext: null,       /* { packageName, label, startPage } while reading from a nudge */
};
