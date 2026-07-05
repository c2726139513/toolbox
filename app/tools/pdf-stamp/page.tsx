"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import PdfStampViewer from "@/components/PdfStamp/PdfStampViewer";
import StampControls from "@/components/PdfStamp/StampControls";
import {
  exportStampedPdf,
  sliceStampForRidingSeam,
  generateStampId,
  PDF_SIZE_THRESHOLDS,
} from "@/lib/pdf-stamp";
import type { StampPlacement, PageDimensions } from "@/lib/pdf-stamp";

export default function PdfStampPage() {
  // ---- State ----
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampImageData, setStampImageData] = useState<ArrayBuffer | null>(null);
  const [placements, setPlacements] = useState<StampPlacement[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [mode, setMode] = useState<"click" | "riding-seam">("click");
  const [stampWidth, setStampWidth] = useState(100);
  const [ridingSeamPosition, setRidingSeamPosition] = useState(50);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerDragOver, setViewerDragOver] = useState(false);
  const pdfDimsRef = useRef<Map<number, PageDimensions>>(new Map());

  // ---- Shared: read file to bytes ----
  const readPdfFile = useCallback(async (file: File) => {
    if (file.size > PDF_SIZE_THRESHOLDS.BLOCK) {
      setError("文件超过 300MB 限制，请选择较小的文件");
      return;
    }
    const bytes = await file.arrayBuffer();
    setPdfFile(file);
    setPdfBytes(bytes);
    setCurrentPage(0);
    setPlacements([]);
    setError(null);

    import("pdf-lib")
      .then(({ PDFDocument }) => PDFDocument.load(bytes, { ignoreEncryption: true }))
      .then((doc) => setTotalPages(doc.getPageCount()))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "读取 PDF 元数据失败"),
      );
  }, []);

  // ---- Handlers ----
  const handlePdfUpload = useCallback(
    (file: File, bytes: ArrayBuffer) => {
      setPdfFile(file);
      setPdfBytes(bytes);
      setCurrentPage(0);
      setPlacements([]);
      setError(null);

      import("pdf-lib")
        .then(({ PDFDocument }) => PDFDocument.load(bytes, { ignoreEncryption: true }))
        .then((doc) => setTotalPages(doc.getPageCount()))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "读取 PDF 元数据失败"),
        );
    },
    [],
  );

  const handleStampUpload = useCallback((file: File, bytes: ArrayBuffer) => {
    setStampFile(file);
    setStampImageData(bytes);
  }, []);

  const handleAddStamp = useCallback(
    (placement: Omit<StampPlacement, "id">) => {
      setPlacements((prev) => [...prev, { ...placement, id: generateStampId() }]);
    },
    [],
  );

  const handleDeleteStamp = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setPlacements([]);
  }, []);

  const handlePdfMeta = useCallback((pageIndex: number, width: number, height: number) => {
    pdfDimsRef.current.set(pageIndex, { width, height });
  }, []);

  const handleMoveStamp = useCallback((id: string, x: number, y: number) => {
    setPlacements((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  }, []);

  const handleApplyRidingSeam = useCallback(async () => {
    if (!stampImageData || totalPages <= 1) return;

    try {
      const slices = await sliceStampForRidingSeam({
        imageData: stampImageData,
        totalPages,
        stampWidth,
        side: "right",
        overlapRatio: 0.05,
      });

      const pos = ridingSeamPosition / 100; // 0–1

      const newPlacements: StampPlacement[] = slices.map((slice) => {
        const dims = pdfDimsRef.current.get(slice.pageIndex);
        const pw = dims?.width ?? 0;
        const ph = dims?.height ?? 0;
        return {
          id: generateStampId(),
          pageIndex: slice.pageIndex,
          x: pw - slice.width,
          y: (ph - slice.height) * pos,
          width: slice.width,
          height: slice.height,
          rotation: 0,
          imageData: slice.sliceData,
        };
      });

      setPlacements((prev) => [...prev, ...newPlacements]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用骑缝章失败");
    }
  }, [stampImageData, totalPages, stampWidth, ridingSeamPosition]);

  const handleExport = useCallback(async () => {
    if (!pdfBytes || placements.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      const blob = await exportStampedPdf(pdfBytes, placements, {
        renderScale: 2,
        jpegQuality: 0.92,
        onProgress: (current, total) => {
          console.log(`导出进度 ${current + 1}/${total}`);
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = pdfFile?.name.replace(/\.pdf$/i, "") || "stamped";
      a.download = `${baseName}-盖章.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  }, [pdfBytes, placements, pdfFile]);

  // ---- Drag-drop on viewer ----
  const handleViewerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewerDragOver(true);
  };
  const handleViewerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewerDragOver(false);
  };
  const handleViewerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewerDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("请拖入 PDF 文件");
      return;
    }
    readPdfFile(file);
  };

  // ---- Render ----
  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            ←
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-rose-400 text-sm font-bold text-white">
            S
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              PDF 盖章
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              全客户端处理，文件不上传服务器
            </p>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 px-6 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 shrink-0 text-red-400 hover:text-red-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewer */}
        <div
          className={`relative flex flex-1 items-start justify-center overflow-auto p-6 transition-colors ${viewerDragOver ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
          onDragOver={handleViewerDragOver}
          onDragLeave={handleViewerDragLeave}
          onDrop={handleViewerDrop}
        >
          {viewerDragOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/80 px-8 py-6 text-center backdrop-blur-sm dark:border-blue-500 dark:bg-blue-950/60">
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  拖放 PDF 到此处
                </p>
              </div>
            </div>
          )}
          <PdfStampViewer
            pdfBytes={pdfBytes}
            currentPage={currentPage}
            totalPages={totalPages}
            placements={placements}
            selectedStampData={stampImageData}
            mode={mode}
            stampWidth={stampWidth}
            onAddStamp={handleAddStamp}
            onMoveStamp={handleMoveStamp}
            onPdfMeta={handlePdfMeta}
          />
        </div>

        {/* Controls sidebar */}
        <StampControls
          pdfFile={pdfFile}
          stampFile={stampFile}
          currentPage={currentPage}
          totalPages={totalPages}
          mode={mode}
          placements={placements}
          stampWidth={stampWidth}
          ridingSeamPosition={ridingSeamPosition}
          onPdfUpload={handlePdfUpload}
          onStampUpload={handleStampUpload}
          onPageChange={setCurrentPage}
          onModeChange={setMode}
          onStampWidthChange={setStampWidth}
          onRidingSeamPositionChange={setRidingSeamPosition}
          onExport={handleExport}
          onDeleteStamp={handleDeleteStamp}
          onClearAll={handleClearAll}
          onApplyRidingSeam={handleApplyRidingSeam}
          onError={setError}
          isExporting={isExporting}
          hasStamps={placements.length > 0}
        />
      </div>
    </div>
  );
}
