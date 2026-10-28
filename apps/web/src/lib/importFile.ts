// Client-side pre-checks for file import. The server enforces the same rules (and is the
// source of truth); these just give instant feedback before uploading.

export const IMPORT_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.join(",");
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_LABEL = ".txt, .md, .docx";

export function validateImportFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `“${file.name}” isn't supported. Supported file types: ${IMPORT_LABEL}.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > IMPORT_MAX_BYTES) {
    return `“${file.name}” is too large (max ${IMPORT_MAX_BYTES / 1024 / 1024} MB).`;
  }
  return null;
}
