const EXIF_SCAN_BYTES = 256 * 1024;

function typeSize(type) {
  switch (type) {
    case 1:
    case 2:
    case 6:
    case 7:
      return 1;
    case 3:
    case 8:
      return 2;
    case 4:
    case 9:
    case 11:
      return 4;
    case 5:
    case 10:
    case 12:
      return 8;
    default:
      return 0;
  }
}

function findTiffHeader(view) {
  if (view.byteLength < 8 || view.getUint16(0) !== 0xffd8) return -1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return -1;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return -1;
    const length = view.getUint16(offset + 2);
    if (length < 2) return -1;
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      const signature = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7),
      );
      if (signature === 'Exif' && view.getUint8(offset + 8) === 0 && view.getUint8(offset + 9) === 0) {
        return offset + 10;
      }
    }
    offset += 2 + length;
  }
  return -1;
}

function readEntries(view, ifdOffset, littleEndian, tiffStart, onEntry) {
  if (ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return;
  const count = view.getUint16(ifdOffset, littleEndian);
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (entry + 12 > view.byteLength) return;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const itemCount = view.getUint32(entry + 4, littleEndian);
    const size = typeSize(type);
    if (!size) continue;
    const dataBytes = size * itemCount;
    let valueOffset = entry + 8;
    if (dataBytes > 4) {
      valueOffset = tiffStart + view.getUint32(entry + 8, littleEndian);
      if (valueOffset < 0 || valueOffset + dataBytes > view.byteLength) continue;
    }
    onEntry(tag, type, itemCount, valueOffset);
  }
}

function readRationals(view, offset, count, littleEndian) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const numerator = view.getUint32(offset + index * 8, littleEndian);
    const denominator = view.getUint32(offset + index * 8 + 4, littleEndian);
    if (!denominator) return null;
    values.push(numerator / denominator);
  }
  return values;
}

function toDegrees(parts, ref, negativeRef) {
  if (!Array.isArray(parts) || parts.length < 3) return null;
  const value = parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (!Number.isFinite(value)) return null;
  return String(ref || '').toUpperCase() === negativeRef ? -value : value;
}

// Reads the GPS coordinates a camera wrote into the photo itself.
export function readExifGps(buffer) {
  const view = new DataView(buffer);
  const tiffStart = findTiffHeader(view);
  if (tiffStart < 0) return null;

  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return null;
  if (tiffStart + 8 > view.byteLength || view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

  let gpsIfd = 0;
  readEntries(view, tiffStart + view.getUint32(tiffStart + 4, littleEndian), littleEndian, tiffStart, (tag, type, count, valueOffset) => {
    if (tag === 0x8825 && type === 4 && count === 1) {
      gpsIfd = tiffStart + view.getUint32(valueOffset, littleEndian);
    }
  });
  if (!gpsIfd) return null;

  let latitudeParts = null;
  let longitudeParts = null;
  let latitudeRef = 'N';
  let longitudeRef = 'E';
  readEntries(view, gpsIfd, littleEndian, tiffStart, (tag, type, count, valueOffset) => {
    if (tag === 1 && type === 2) latitudeRef = String.fromCharCode(view.getUint8(valueOffset));
    else if (tag === 3 && type === 2) longitudeRef = String.fromCharCode(view.getUint8(valueOffset));
    else if (tag === 2 && type === 5) latitudeParts = readRationals(view, valueOffset, Math.min(count, 3), littleEndian);
    else if (tag === 4 && type === 5) longitudeParts = readRationals(view, valueOffset, Math.min(count, 3), littleEndian);
  });

  const latitude = toDegrees(latitudeParts, latitudeRef, 'S');
  const longitude = toDegrees(longitudeParts, longitudeRef, 'W');
  if (latitude === null || longitude === null) return null;
  // 0,0 means the camera had no fix rather than a genuine location.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function readDeviceLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation?.getCurrentPosition) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

// Uses the photo's own GPS data first, then the device's current position.
export async function readPhotoLocation(file) {
  if (!file || !String(file.type || '').startsWith('image/')) return null;

  if (/jpe?g/i.test(String(file.type))) {
    try {
      const buffer = await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer();
      const gps = readExifGps(buffer);
      if (gps) {
        return { ...gps, accuracy_m: null, source: 'exif', captured_at: new Date().toISOString() };
      }
    } catch {
      // Fall through to the device location.
    }
  }

  const device = await readDeviceLocation();
  if (!device) return null;
  return { ...device, source: 'device', captured_at: new Date().toISOString() };
}