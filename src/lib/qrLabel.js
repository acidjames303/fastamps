import { createImageTemplateLabel } from './qrFixedTemplate.js';

// The production QR label always uses the approved, uploaded PNG artwork.
// NO fallbacks, regenerated brand logos, rewritten copy or alternative layouts.
// Only the QR code, serial number and 6-digit PIN are composited into the image.
export const LABEL_WIDTH_MM = 50.8;
export const LABEL_HEIGHT_MM = 76.2;
export const LABEL_DPI = 400; // Fast 800 × 1200 px exports; physical label remains 2 × 3 inches.

export async function createBrandedQrLabel({claimUrl, serialNumber, pinCode, templateUrl}) {
  if (!templateUrl) {
    throw new Error('The fixed FastAmps poster template is not available yet. Reload Admin → QR batches before printing.');
  }
  return createImageTemplateLabel({templateUrl, claimUrl, serialNumber, pinCode});
}
