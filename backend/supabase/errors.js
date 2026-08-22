export class PreviewApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options);
    this.name = "PreviewApiError";
    this.status = status;
    this.code = code;
    this.expose = options.expose !== false;
  }
}

export function previewError(status, code, message, options) {
  return new PreviewApiError(status, code, message, options);
}

export function normalizePreviewError(error) {
  if (error instanceof PreviewApiError) return error;
  return previewError(
    502,
    "supabase_preview_unavailable",
    "The Supabase preview is temporarily unavailable.",
    { cause: error, expose: true },
  );
}
