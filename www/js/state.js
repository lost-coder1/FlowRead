/* Global application state — single source of truth */

const AppState = {
  currentFile: null,     /* { id, name, words, pageWordIndex, rawLines, metadata, pdfDoc } */
  currentIndex: 0,       /* current word position across all engines */
  wpm: 260,
  settings: {},
  isPro: false,
  isSubscriber: false,  /* Claude.md §4 — independent of isPro; always false until Task 16.1 */
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
