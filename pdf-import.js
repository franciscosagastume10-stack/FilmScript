// Reliable client-side PDF text extraction for screenplay imports.
// The PDF stays in the browser; it is never uploaded to FilmScript.
(() => {
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let loader;

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) return reject(new Error('PDF reader unavailable'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('PDF reader unavailable'));
      document.head.appendChild(script);
    });
    return loader;
  }

  window.filmscriptPdfText = async (file) => {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = [];
      let lastY = null;
      let line = '';
      for (const item of content.items) {
        const text = (item.str || '').trim();
        if (!text) continue;
        const y = item.transform ? item.transform[5] : lastY;
        if (lastY !== null && Math.abs(y - lastY) > 2.5) {
          if (line) lines.push(line.trim());
          line = text;
        } else {
          line += (line ? ' ' : '') + text;
        }
        lastY = y;
        if (item.hasEOL) {
          if (line) lines.push(line.trim());
          line = '';
          lastY = null;
        }
      }
      if (line) lines.push(line.trim());
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n');
  };
})();
