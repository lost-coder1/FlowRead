/* Global application state — single source of truth */

const AppState = {
  currentFile: null,     /* { id, name, words, pageWordIndex, rawLines, metadata, pdfDoc } */
  currentIndex: 0,       /* current word position across all engines */
  wpm: 260,
  settings: {},
  isPro: false,
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
  readerSource: 'upload',   /* 'upload' | 'dashboard' — where the file was opened from */
};
