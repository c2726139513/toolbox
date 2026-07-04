/**
 * Server-only conversion functions.
 * This file imports @mohtasham/md-to-docx and must NEVER be imported
 * from client components (directly or transitively).
 */
import { convertMarkdownToBuffer } from "@mohtasham/md-to-docx";
import type { DocxStyleOptions } from "./converter";
import { buildDocxOptions, DEFAULT_STYLE_OPTIONS } from "./converter";

/**
 * Convert markdown to a DOCX Buffer on the server.
 */
export async function convertToBuffer(
  markdown: string,
  style: DocxStyleOptions = DEFAULT_STYLE_OPTIONS,
): Promise<Buffer> {
  return convertMarkdownToBuffer(markdown, buildDocxOptions(style));
}
