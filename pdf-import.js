// Client-side screenplay PDF extraction. The file stays in the browser.
// Keep layout data: indentation is meaningful in a screenplay (action,
// character cues and dialogue normally occupy different columns).
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

  function linesForPage(content, pageNumber, pageWidth) {
    const runs = content.items
      .map((item) => ({
        text: String(item.str || '').replace(/\u00a0/g, ' ').trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
      }))
      .filter((item) => item.text);
    // PDF text streams are not guaranteed to be emitted in reading order.
    runs.sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x);
    const groups = [];
    runs.forEach((run) => {
      const group = groups.find((candidate) => Math.abs(candidate.y - run.y) <= 2.5);
      if (group) group.runs.push(run);
      else groups.push({ y: run.y, runs: [run] });
    });
    return groups
      .sort((a, b) => b.y - a.y)
      .map((group) => {
        const ordered = group.runs.sort((a, b) => a.x - b.x);
        let previousRight = null;
        const text = ordered.map((run) => {
          const gap = previousRight === null ? '' : (run.x - previousRight > 1.8 ? ' ' : '');
          previousRight = Math.max(previousRight ?? 0, run.x + run.width);
          return gap + run.text;
        }).join('').replace(/\s+/g, ' ').trim();
        return { text, x: ordered[0]?.x || 0, y: group.y, page: pageNumber, pageWidth };
      })
      .filter((line) => line.text);
  }

  window.filmscriptPdfLines = async (file) => {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      lines.push(...linesForPage(await page.getTextContent(), pageNumber, viewport.width));
    }
    return lines;
  };

  // Kept for any existing integrations that only need plain text.
  window.filmscriptPdfText = async (file) => {
    const lines = await window.filmscriptPdfLines(file);
    let previousPage = lines[0]?.page;
    return lines.map((line) => {
      const separator = line.page !== previousPage ? '\n\n' : '\n';
      previousPage = line.page;
      return separator + line.text;
    }).join('').trim();
  };
})();
