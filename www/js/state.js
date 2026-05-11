/* Global application state — single source of truth */

const AppState = {
  currentFile: null,     /* { id, name, words, pageWordIndex, rawLines, metadata, pdfDoc } */
  currentIndex: 0,       /* current word position across all engines */
  wpm: 260,
  isPlaying: false,
  currentView: 'view-upload',
  currentEngine: 'rsvp',
};
