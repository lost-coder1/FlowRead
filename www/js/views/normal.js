/* Embedded Normal PDF view with lazy page rendering */

const NormalView = (function() {
  let _observer = null;
  let _renderedPages = new Map();
  let _visiblePage = 1;
  let _isBindingScroll = false;

  function render(pageNumber) {
    const file = AppState.currentFile;
    const view = qs('#view-normal');
    if (!file || !file.pdfDoc || !view) return;

    _renderedPages.clear();
    _visiblePage = 1;
    _isBindingScroll = false;
    AppState.normalRenderToken += 1;
    const token = AppState.normalRenderToken;
    AppState.normalPage = Math.max(1, Math.min(file.pdfDoc.numPages, pageNumber || AppState.normalPage || 1));

    view.innerHTML = `
      <div class="normal-view">
        <div class="normal-toolbar">
          <button class="btn btn-ghost" id="btn-normal-back">←</button>
          <button class="btn btn-ghost" id="btn-normal-prev">‹</button>
          <div class="normal-page-input-wrap">
            <input class="normal-page-input" id="normal-page-input" type="number" min="1" max="${file.pdfDoc.numPages}" value="${AppState.normalPage}" />
            <span class="normal-page-total">/ ${file.pdfDoc.numPages}</span>
          </div>
          <button class="btn btn-ghost" id="btn-normal-next">›</button>
          <button class="btn btn-ghost" id="btn-normal-zoom-out">A−</button>
          <button class="btn btn-ghost normal-zoom-readout" id="normal-zoom-readout">${Math.round(AppState.normalZoom * 100)}%</button>
          <button class="btn btn-ghost" id="btn-normal-zoom-in">A+</button>
          <button class="btn btn-ghost" id="btn-normal-fit">Fit Width</button>
          <button class="btn btn-primary" id="btn-normal-read-here">▶ Read from here</button>
        </div>
        <div class="normal-scroll" id="normal-scroll">
          <div class="normal-pages" id="normal-pages">
            ${buildPageShells(file.pdfDoc.numPages)}
          </div>
        </div>
      </div>
    `;

    bindControls(token);
    bindObserver(token);
    acquireWakeLock();

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        applyScaleToShells();
        scrollToPage(AppState.normalPage, false);
        updateVisiblePageFromScroll();
        renderVisibleWindow(token);
      });
    });
  }

  function buildPageShells(pageCount) {
    let html = '';
    for (let page = 1; page <= pageCount; page++) {
      html += `
        <section class="normal-page-shell" data-page="${page}">
          <div class="normal-page-card">
            <div class="normal-page-label">Page ${page}</div>
            <div class="normal-page-canvas-wrap" data-page-wrap="${page}">
              <div class="normal-page-placeholder">Preparing page…</div>
            </div>
          </div>
        </section>
      `;
    }
    return html;
  }

  function bindControls(token) {
    qs('#btn-normal-back').addEventListener('click', function() {
      if (_observer) _observer.disconnect();
      releaseWakeLock();
      renderReader({ startIndex: AppState.currentIndex, silentResume: true });
      switchView('view-reader');
    });

    qs('#btn-normal-prev').addEventListener('click', function() {
      scrollToPage(AppState.normalPage - 1, true);
    });

    qs('#btn-normal-next').addEventListener('click', function() {
      scrollToPage(AppState.normalPage + 1, true);
    });

    qs('#normal-page-input').addEventListener('change', function() {
      scrollToPage(parseInt(this.value, 10) || 1, true);
    });

    qs('#btn-normal-zoom-out').addEventListener('click', function() {
      AppState.normalFitWidth = false;
      AppState.normalZoom = Math.max(0.6, parseFloat((AppState.normalZoom - 0.1).toFixed(2)));
      rerenderAll(token);
    });

    qs('#btn-normal-zoom-in').addEventListener('click', function() {
      AppState.normalFitWidth = false;
      AppState.normalZoom = Math.min(2.5, parseFloat((AppState.normalZoom + 0.1).toFixed(2)));
      rerenderAll(token);
    });

    qs('#btn-normal-fit').addEventListener('click', function() {
      AppState.normalFitWidth = true;
      rerenderAll(token);
    });

    qs('#btn-normal-read-here').addEventListener('click', function() {
      const targetIndex = pageToWordIndex(AppState.normalPage);
      this.textContent = '✓ Jumping...';
      this.disabled = true;
      setTimeout(() => {
        if (_observer) _observer.disconnect();
        jumpReaderToWord(targetIndex, { silentResume: true });
      }, 180);
    });

    const scrollEl = qs('#normal-scroll');
    scrollEl.addEventListener('scroll', function() {
      if (_isBindingScroll) return;
      window.clearTimeout(scrollEl._scrollTimer);
      scrollEl._scrollTimer = window.setTimeout(function() {
        updateVisiblePageFromScroll();
        renderVisibleWindow(token);
      }, 80);
    });
  }

  function bindObserver(token) {
    if (_observer) _observer.disconnect();
    _observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const page = parseInt(entry.target.dataset.page, 10);
          renderPage(page, token);
        }
      });
    }, {
      root: qs('#normal-scroll'),
      rootMargin: '600px 0px',
      threshold: 0.01,
    });

    qsa('.normal-page-shell').forEach(function(shell) {
      _observer.observe(shell);
    });
  }

  function renderVisibleWindow(token) {
    const total = AppState.currentFile.pdfDoc.numPages;
    const start = Math.max(1, AppState.normalPage - 2);
    const end = Math.min(total, AppState.normalPage + 2);

    for (let page = start; page <= end; page++) {
      renderPage(page, token);
    }
  }

  async function renderPage(pageNumber, token) {
    const file = AppState.currentFile;
    if (!file || !file.pdfDoc || token !== AppState.normalRenderToken) return;
    if (_renderedPages.get(pageNumber) === getRenderKey(pageNumber)) return;

    const wrap = qs('[data-page-wrap="' + pageNumber + '"]');
    const shell = qs('.normal-page-shell[data-page="' + pageNumber + '"]');
    if (!wrap || !shell) return;

    shell.classList.add('is-rendering');

    try {
      const page = await file.pdfDoc.getPage(pageNumber);
      if (token !== AppState.normalRenderToken) return;

      const scale = computeScale(page);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.className = 'normal-page-canvas';
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';

      wrap.innerHTML = '';
      wrap.appendChild(canvas);

      await page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      }).promise;
      if (token !== AppState.normalRenderToken) return;

      shell.style.setProperty('--page-height', viewport.height + 'px');
      _renderedPages.set(pageNumber, getRenderKey(pageNumber));
      shell.classList.remove('is-rendering');
    } catch (err) {
      console.error('Normal page render failed:', err);
      wrap.innerHTML = '<div class="normal-page-placeholder">Could not render this page.</div>';
      shell.classList.remove('is-rendering');
    }
  }

  function computeScale(page) {
    if (!AppState.normalFitWidth) return AppState.normalZoom;
    const scrollEl = qs('#normal-scroll');
    if (!scrollEl) return AppState.normalZoom;

    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(240, scrollEl.clientWidth - 40);
    const fitScale = availableWidth / baseViewport.width;
    AppState.normalZoom = Math.max(0.6, Math.min(2.5, fitScale));
    return AppState.normalZoom;
  }

  function rerenderAll(token) {
    updateZoomReadout();
    applyScaleToShells();
    _renderedPages.clear();
    qsa('[data-page-wrap]').forEach(function(wrap) {
      wrap.innerHTML = '<div class="normal-page-placeholder">Preparing page…</div>';
    });
    requestAnimationFrame(function() {
      renderVisibleWindow(token);
    });
  }

  function applyScaleToShells() {
    updateZoomReadout();
    qsa('.normal-page-shell').forEach(function(shell) {
      shell.style.setProperty('--page-scale', AppState.normalZoom);
    });
  }

  function updateZoomReadout() {
    const readout = qs('#normal-zoom-readout');
    if (readout) readout.textContent = Math.round(AppState.normalZoom * 100) + '%';
  }

  function updateVisiblePageFromScroll() {
    const scrollEl = qs('#normal-scroll');
    if (!scrollEl) return;

    const midpoint = scrollEl.scrollTop + scrollEl.clientHeight * 0.35;
    let resolved = 1;

    qsa('.normal-page-shell').forEach(function(shell) {
      if (shell.offsetTop <= midpoint) {
        resolved = parseInt(shell.dataset.page, 10);
      }
    });

    _visiblePage = resolved;
    AppState.normalPage = resolved;
    syncPageControls();
  }

  function syncPageControls() {
    const input = qs('#normal-page-input');
    if (input) input.value = AppState.normalPage;
  }

  function scrollToPage(pageNumber, smooth) {
    const file = AppState.currentFile;
    if (!file || !file.pdfDoc) return;

    const targetPage = Math.max(1, Math.min(file.pdfDoc.numPages, pageNumber || 1));
    const shell = qs('.normal-page-shell[data-page="' + targetPage + '"]');
    const scrollEl = qs('#normal-scroll');
    if (!shell || !scrollEl) return;

    AppState.normalPage = targetPage;
    syncPageControls();
    _isBindingScroll = true;
    scrollEl.scrollTo({
      top: Math.max(0, shell.offsetTop - 12),
      behavior: smooth ? 'smooth' : 'auto',
    });
    window.setTimeout(function() {
      _isBindingScroll = false;
      renderVisibleWindow(AppState.normalRenderToken);
    }, smooth ? 260 : 30);
  }

  function getRenderKey(pageNumber) {
    return pageNumber + '::' + AppState.normalZoom.toFixed(2) + '::' + (AppState.normalFitWidth ? 'fit' : 'manual');
  }

  return {
    render,
    scrollToPage,
  };
})();

function renderNormal(pageNumber) {
  NormalView.render(pageNumber);
}
