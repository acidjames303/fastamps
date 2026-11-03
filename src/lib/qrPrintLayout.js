import { LABEL_WIDTH_MM, LABEL_HEIGHT_MM } from './qrLabel.js';

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

// TopStick 8735: 18 landscape stickers, 3 columns x 6 rows. This is a
// PRINT-ONLY geometry; the approved on-screen portrait artwork is untouched.
export const TOPSTICK_8735 = Object.freeze({
  columns: 3, rows: 6, widthMm: 63.5, heightMm: 46.6,
  leftMm: 7.25, topMm: 8.7, gapX: 2.5, gapY: 0, artworkSafetyMm: 1,
});

export function getTopStick8735Positions({ offsetXmm = 0, offsetYmm = 0 } = {}) {
  const cfg = TOPSTICK_8735;
  if (![offsetXmm, offsetYmm].every(Number.isFinite) ||
      Math.abs(offsetXmm) > 3 || Math.abs(offsetYmm) > 3) {
    throw new Error('TopStick alignment offsets must be within 3 mm.');
  }
  // Original portrait label is 50.8 x 76.2 mm. Rotate the COMPLETED artwork,
  // then contain it within the sticker, never stretch or crop it.
  const imageWidth = Math.min(
    cfg.widthMm - 2 * cfg.artworkSafetyMm,
    (cfg.heightMm - 2 * cfg.artworkSafetyMm) * (LABEL_HEIGHT_MM / LABEL_WIDTH_MM),
  );
  const imageHeight = imageWidth * (LABEL_WIDTH_MM / LABEL_HEIGHT_MM);
  const positions = [];
  for (let row = 0; row < cfg.rows; row++) {
    for (let column = 0; column < cfg.columns; column++) {
      const x = cfg.leftMm + offsetXmm + column * (cfg.widthMm + cfg.gapX);
      const y = cfg.topMm + offsetYmm + row * (cfg.heightMm + cfg.gapY);
      positions.push({
        x, y,
        imageX: x + (cfg.widthMm - imageWidth) / 2,
        imageY: y + (cfg.heightMm - imageHeight) / 2,
        imageWidth, imageHeight,
      });
    }
  }
  return { positions, perPage: positions.length, ...cfg };
}
// This is a generic 9-up layout. Exact Avery alignment depends on the product number.
export const A4_LABEL_LAYOUT = Object.freeze({
  columns: 3, rows: 3, gapX: 6, gapY: 6, leftMm: 22.8, topMm: 28.2,
});

export function getA4LabelPositions({
  columns = A4_LABEL_LAYOUT.columns,
  rows = A4_LABEL_LAYOUT.rows,
  gapX = A4_LABEL_LAYOUT.gapX,
  gapY = A4_LABEL_LAYOUT.gapY,
  leftMm,
  topMm,
} = {}) {
  if (![columns, rows, gapX, gapY].every(Number.isFinite)
    || !Number.isInteger(columns) || !Number.isInteger(rows)
    || columns < 1 || rows < 1 || columns > 3 || rows > 3 || gapX < 0 || gapY < 0) {
    throw new Error('Choose an Avery layout with 1–3 columns, 1–3 rows and non-negative gaps.');
  }
  const usedWidth = columns * LABEL_WIDTH_MM + (columns - 1) * gapX;
  const usedHeight = rows * LABEL_HEIGHT_MM + (rows - 1) * gapY;
  const left = leftMm == null ? (A4_WIDTH_MM - usedWidth) / 2 : Number(leftMm);
  const top = topMm == null ? (A4_HEIGHT_MM - usedHeight) / 2 : Number(topMm);
  if (!Number.isFinite(left) || !Number.isFinite(top) || left < 5 || top < 5 ||
    left + usedWidth > A4_WIDTH_MM - 5 || top + usedHeight > A4_HEIGHT_MM - 5) {
    throw new Error('These Avery dimensions do not fit on A4 with 5 mm safe outer margins. Check the product measurements.');
  }
  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      positions.push({
        x: left + column * (LABEL_WIDTH_MM + gapX),
        y: top + row * (LABEL_HEIGHT_MM + gapY),
      });
    }
  }
  return { positions, perPage: positions.length, left, top, usedWidth, usedHeight };
}
