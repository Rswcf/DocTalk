export function sanitizeFilename(name: string, maxLength = 100): string {
  // Strip control characters and null bytes
  let clean = name.replace(/[\x00-\x1f\x7f]/g, '');
  // Replace suspicious characters
  clean = clean.replace(/[<>:"|?*\\]/g, '_');
  // Truncate preserving extension
  if (clean.length > maxLength) {
    const dotIdx = clean.lastIndexOf('.');
    if (dotIdx > 0) {
      const ext = clean.slice(dotIdx);
      clean = clean.slice(0, maxLength - ext.length) + ext;
    } else {
      clean = clean.slice(0, maxLength);
    }
  }
  return clean || 'document';
}
