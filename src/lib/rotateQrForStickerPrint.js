// Print-only transformation. The saved artwork and normal Base44 preview remain upright.
// Rotating in an offscreen canvas also avoids PDF-library pivot/offset ambiguity.
export async function rotateQrForStickerPrint(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The QR label image could not be rotated for printing.'));
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The print-only label rotation could not be initialised.');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}
