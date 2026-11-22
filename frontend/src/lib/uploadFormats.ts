// Upload formats the backend accepts (`POST /api/documents/upload`). Shared by
// the dashboard upload zone and the guest "use your own document" entry, so
// the two can never disagree about what a visitor may pick.

export const UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
] as const;

export const UPLOAD_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'] as const;

/** Value for an `<input type="file" accept>` attribute. */
export const UPLOAD_ACCEPT = [...UPLOAD_MIME_TYPES, ...UPLOAD_EXTENSIONS].join(',');

export function isSupportedUploadFile(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot) : '';
  return (UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)
    || (UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}
