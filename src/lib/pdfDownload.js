// jsPDF's save() uses an <a download="..."> click, which iOS Safari ignores.
// On mobile we use the Web Share API (which lets the user save to Files or share),
// then fall back to the standard anchor download everywhere else.
export async function savePdfDocument(pdf, filename) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isMobile && typeof navigator.canShare === 'function') {
    const blob = pdf.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user dismissed the share sheet
        // fall through to anchor download
      }
    }
  }

  pdf.save(filename);
}