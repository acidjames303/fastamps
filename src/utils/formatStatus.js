export function formatStatus(value) {
  if (!value) return '';
  const words = String(value)
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

  if (!words.length) return '';
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
}
