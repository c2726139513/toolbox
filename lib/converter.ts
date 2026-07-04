/**
 * Types and helpers shared between client and server.
 * ⚠️  Must NOT import @mohtasham/md-to-docx here — it has Node built-in
 *     deps (node:dns/promises) that Turbopack cannot bundle for the client.
 *     Server-only logic lives in lib/convert-server.ts.
 */
export interface DocxStyleOptions {
  fontFamily: string;
  heading1Color: string;
  heading2Color: string;
  heading1Alignment: "LEFT" | "CENTER" | "RIGHT";
  heading2Alignment: "LEFT" | "CENTER" | "RIGHT";
  pageOrientation: "PORTRAIT" | "LANDSCAPE";
}

export const DEFAULT_STYLE_OPTIONS: DocxStyleOptions = {
  fontFamily: "Arial",
  heading1Color: "1e3a5f",
  heading2Color: "2d5a87",
  heading1Alignment: "LEFT",
  heading2Alignment: "LEFT",
  pageOrientation: "PORTRAIT",
};

export const CLIENT_SIZE_LIMIT = 50 * 1024;

export function isSmallContent(markdown: string): boolean {
  return new Blob([markdown]).size <= CLIENT_SIZE_LIMIT;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildDocxOptions(style: DocxStyleOptions) {
  return {
    style: {
      fontFamily: style.fontFamily,
    },
    imageHandling: {
      remote: { enabled: false },
      dataUrls: { enabled: true },
    },
    documentType: "document" as const,
  };
}
