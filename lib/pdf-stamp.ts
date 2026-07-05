/**
 * Client-side PDF stamping engine.
 *
 * Architecture: Canvas rasterize → multiply composite → pdf-lib embed
 * (Option B from research) for guaranteed multiply appearance.
 *
 * Flow per page:
 *   PDF.js render  →  <canvas>  →  ctx.globalCompositeOperation='multiply'
 *   →  draw stamp  →  toBlob('image/jpeg')  →  pdf-lib embed in new PDF
 *
 * This avoids pdf-lib's copyPages bloat bug and gives pixel-level
 * control over the multiply blend, identical to GIMP's behavior.
 */

import { PDFDocument } from "pdf-lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-page dimensions in PDF points */
export type PageDimensions = { width: number; height: number };

export interface StampPlacement {
  /** Unique id for this placement (for React key and drag targeting) */
  id: string;
  /** 0-based page index */
  pageIndex: number;
  /** X position in PDF coordinate space (points, bottom-left origin) */
  x: number;
  /** Y position in PDF coordinate space (points, bottom-left origin) */
  y: number;
  /** Display width in PDF points */
  width: number;
  /** Display height in PDF points */
  height: number;
  /** Rotation in degrees (clockwise) */
  rotation: number;
  /** Raw PNG bytes of the stamp image */
  imageData: ArrayBuffer;
}

export interface StampExportOptions {
  /** Render scale factor (2 = ~150 DPI, 3 = ~225 DPI, 4 = ~300 DPI) */
  renderScale?: number;
  /** JPEG quality 0-1 */
  jpegQuality?: number;
  /** Callback for progress updates (pageIndex, totalPages) */
  onProgress?: (current: number, total: number) => void;
}

// ---------------------------------------------------------------------------
// PDF.js dynamic import
// ---------------------------------------------------------------------------

async function getPdfJs() {
  // pdfjs-dist v5+ exports as ESM; dynamic import keeps it out of the server
  // bundle and works with Turbopack.
  const pdfjsLib = await import("pdfjs-dist");
  // Set worker path — pdfjs-dist v5+ ships a built-in worker entry
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjsLib;
}

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;  // PDF points
  height: number; // PDF points
}

/**
 * Render a single PDF page to an off-screen canvas at the given scale.
 * Returns both the canvas (for compositing) and the original page dimensions.
 */
async function renderPageToCanvas(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  scale: number,
): Promise<RenderedPage> {
  const pdfjsLib = await getPdfJs();
  const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const page = await pdfDoc.getPage(pageIndex + 1); // pdfjs is 1-based
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, canvas, viewport }).promise;

  return {
    canvas,
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
}

/**
 * Render a PDF page and optionally apply stamps. This is the single
 * function used during export — it renders, composites stamps with
 * multiply blend mode, and returns the composited canvas.
 */
async function renderAndCompositePage(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  stamps: StampPlacement[],
  scale: number,
): Promise<HTMLCanvasElement> {
  const { canvas, width, height } = await renderPageToCanvas(pdfBytes, pageIndex, scale);
  const ctx = canvas.getContext("2d")!;

  // Apply each stamp for this page
  const pageStamps = stamps.filter((s) => s.pageIndex === pageIndex);
  for (const stamp of pageStamps) {
    const imgBitmap = await createImageBitmap(new Blob([stamp.imageData]));

    // Convert PDF coordinates to canvas coordinates
    // PDF origin = bottom-left, Canvas origin = top-left
    const sx = stamp.x * scale;
    const sy = height * scale - stamp.y * scale - stamp.height * scale;
    const sw = stamp.width * scale;
    const sh = stamp.height * scale;

    // ---- Multiply blend (exactly like GIMP) ----
    ctx.globalCompositeOperation = "multiply";
    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.rotate((stamp.rotation * Math.PI) / 180);
    ctx.drawImage(imgBitmap, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    // --------------------------------------------

    imgBitmap.close();
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Riding seam stamp (骑缝章)
// ---------------------------------------------------------------------------

export interface RidingSeamOptions {
  /** Stamp image bytes (PNG with transparency) */
  imageData: ArrayBuffer;
  /** Total pages in the PDF */
  totalPages: number;
  /** Stamp width per page in PDF points */
  stampWidth?: number;
  /** Side to apply: 'right' (default) or 'left' */
  side?: "left" | "right";
  /** Overlap ratio between slices (0-1, default 0.05 = 5%) */
  overlapRatio?: number;
}

export interface RidingSeamSlice {
  pageIndex: number;
  sliceData: ArrayBuffer;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Slice a stamp image into N vertical strips for riding seam stamp.
 * Each strip is slightly wider than 1/N to create overlap that prevents
 * visible gaps when pages are viewed side by side.
 */
export async function sliceStampForRidingSeam(
  options: RidingSeamOptions,
): Promise<RidingSeamSlice[]> {
  const {
    imageData,
    totalPages,
    stampWidth = 113, // ~40mm in points
    side = "right",
    overlapRatio = 0.05,
  } = options;

  const img = await createImageBitmap(new Blob([imageData]));
  const sliceW = img.width / totalPages;
  const overlapPx = sliceW * overlapRatio;
  const height = img.height;

  const slices: RidingSeamSlice[] = [];
  const canvas = new OffscreenCanvas(sliceW + overlapPx, height);

  for (let i = 0; i < totalPages; i++) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the slice from the source image
    // Last page gets the remainder to avoid missing pixels
    const srcX = i * sliceW;
    const srcW = i < totalPages - 1 ? sliceW + overlapPx : img.width - srcX;
    canvas.width = srcW;
    ctx.drawImage(img, srcX, 0, srcW, height, 0, 0, srcW, height);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buffer = await blob.arrayBuffer();

    // Each riding seam slice is 1/N of the total stamp width.
    // This matches the click-to-place stamp: when N slices are assembled
    // across N pages, the total width equals stampWidth and height matches.
    const sliceDisplayWidth = stampWidth / totalPages;
    const sliceDisplayHeight = (stampWidth * img.height) / img.width;

    slices.push({
      pageIndex: i,
      sliceData: buffer,
      x: side === "right" ? 0 : 0,
      y: 0,
      width: sliceDisplayWidth,
      height: sliceDisplayHeight,
    });
  }

  img.close();
  return slices;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export a stamped PDF. For each page:
 *   1. Render the original PDF page to canvas (PDF.js)
 *   2. Composite stamps with multiply blend (Canvas 2D)
 *   3. Export canvas as JPEG
 *   4. Create a new PDF page with pdf-lib and embed the JPEG image
 *
 * Returns the final PDF as a Blob ready for download.
 *
 * This completely bypasses pdf-lib's copyPages(), avoiding the known
 * object-bloat bug (#1338).
 */
export async function exportStampedPdf(
  originalPdfBytes: ArrayBuffer,
  placements: StampPlacement[],
  options: StampExportOptions = {},
): Promise<Blob> {
  const { renderScale = 2, jpegQuality = 0.92, onProgress } = options;

  // Load original with pdf-lib to get page count and dimensions
  const srcDoc = await PDFDocument.load(originalPdfBytes, {
    ignoreEncryption: true,
  });
  const totalPages = srcDoc.getPageCount();

  // Create a new PDF document
  const newDoc = await PDFDocument.create();
  // Mimic WPS Office metadata so PDF properties match files exported by WPS
  newDoc.setProducer("WPS Office");
  newDoc.setCreator("WPS Office");

  for (let i = 0; i < totalPages; i++) {
    onProgress?.(i, totalPages);

    // 1-2. Render + composite stamps with multiply blend
    const canvas = await renderAndCompositePage(
      originalPdfBytes,
      i,
      placements,
      renderScale,
    );

    // 3. Export canvas as JPEG blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        jpegQuality,
      );
    });

    // Get original page dimensions, accounting for rotation
    const srcPage = srcDoc.getPage(i);
    let { width: pageW, height: pageH } = srcPage.getSize();
    const rotation = srcPage.getRotation().angle;
    // If page is rotated 90° or 270° (landscape), swap dimensions so the
    // new page respects the visual orientation. pdfjs already rendered with
    // rotation applied, so the canvas matches the swapped dimensions.
    if (rotation === 90 || rotation === 270) {
      [pageW, pageH] = [pageH, pageW];
    }

    // 4. Embed into new PDF
    const jpgBytes = new Uint8Array(await blob.arrayBuffer());
    const jpgImage = await newDoc.embedJpg(jpgBytes);
    const newPage = newDoc.addPage([pageW, pageH]);
    newPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });
  }

  onProgress?.(totalPages, totalPages);

  const pdfBytes = await newDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Coordinate conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a mouse/click position (top-left origin, CSS pixels) to PDF
 * coordinate space (bottom-left origin, points).
 */
export function screenToPdf(
  clickX: number,
  clickY: number,
  canvasHeight: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: clickX / scale,
    y: canvasHeight / scale - clickY / scale,
  };
}

/**
 * Convert PDF coordinates to canvas pixel position (top-left origin).
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pageHeightPdf: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: pdfX * scale,
    y: (pageHeightPdf - pdfY) * scale,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
export function generateStampId(): string {
  return `stamp-${++_idCounter}-${Date.now()}`;
}

/**
 * Estimate safe file size limits for browser PDF processing.
 * Exports thresholds for UI warnings.
 */
export const PDF_SIZE_THRESHOLDS = {
  WARN_YELLOW: 50 * 1024 * 1024,  // 50 MB — suggest using smaller files
  WARN_RED: 150 * 1024 * 1024,    // 150 MB — warn about potential instability
  BLOCK: 300 * 1024 * 1024,       // 300 MB — block processing
} as const;
