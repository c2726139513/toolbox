"use client";

import { useRef, useState, useEffect } from "react";
import type { StampPlacement } from "@/lib/pdf-stamp";
import { PDF_SIZE_THRESHOLDS } from "@/lib/pdf-stamp";

interface StampControlsProps {
  pdfFile: File | null;
  stampFile: File | null;
  currentPage: number;
  totalPages: number;
  mode: "click" | "riding-seam";
  placements: StampPlacement[];
  stampWidth: number;
  ridingSeamPosition: number; // 0–100, vertical position %
  onPdfUpload: (file: File, bytes: ArrayBuffer) => void;
  onStampUpload: (file: File, bytes: ArrayBuffer) => void;
  onPageChange: (page: number) => void;
  onModeChange: (mode: "click" | "riding-seam") => void;
  onStampWidthChange: (width: number) => void;
  onRidingSeamPositionChange: (pos: number) => void;
  onExport: () => void;
  onDeleteStamp: (id: string) => void;
  onClearAll: () => void;
  onApplyRidingSeam: () => void;
  onError?: (msg: string) => void;
  isExporting: boolean;
  hasStamps: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StampControls({
  pdfFile,
  stampFile,
  currentPage,
  totalPages,
  mode,
  placements,
  stampWidth,
  ridingSeamPosition,
  onPdfUpload,
  onStampUpload,
  onPageChange,
  onModeChange,
  onStampWidthChange,
  onRidingSeamPositionChange,
  onExport,
  onDeleteStamp,
  onClearAll,
  onApplyRidingSeam,
  onError,
  isExporting,
  hasStamps,
}: StampControlsProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // ---- Drag-over visual feedback ----
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [stampDragOver, setStampDragOver] = useState(false);

  // ---- PDF upload handler ----
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > PDF_SIZE_THRESHOLDS.BLOCK) {
        onError?.("文件超过 300MB 限制，请选择较小的文件");
        return;
      }
      const bytes = await file.arrayBuffer();
      onPdfUpload(file, bytes);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "读取 PDF 文件失败");
    } finally {
      e.target.value = "";
    }
  };

  // ---- Stamp upload handler ----
  const handleStampChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const bytes = await file.arrayBuffer();
      onStampUpload(file, bytes);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "读取图章图片失败");
    } finally {
      e.target.value = "";
    }
  };

  // ---- Drag-drop shared helpers ----
  const readFileAsBytes = async (
    file: File,
    onSuccess: (f: File, b: ArrayBuffer) => void,
  ) => {
    if (file.size > PDF_SIZE_THRESHOLDS.BLOCK) {
      onError?.("文件超过 300MB 限制");
      return;
    }
    const bytes = await file.arrayBuffer();
    onSuccess(file, bytes);
  };

  const isValidPdf = (f: File) => f.type === "application/pdf" || f.name.endsWith(".pdf");
  const isValidImage = (f: File) => /^image\//.test(f.type);

  // ---- PDF drop zone ----
  const onPdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isValidPdf(file)) {
      onError?.("请拖入 PDF 文件");
      return;
    }
    readFileAsBytes(file, onPdfUpload);
  };

  // ---- Stamp drop zone (the stamp upload label) ----
  const onStampDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStampDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isValidImage(file)) {
      onError?.("请拖入图片文件 (PNG/JPEG)");
      return;
    }
    readFileAsBytes(file, onStampUpload);
  };

  // ---- Expose these handlers to parents via data attributes or props ----
  // We expose them via a window-level event for the viewer to call
  useEffect(() => {
    const handler = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file || !isValidPdf(file)) return;
      readFileAsBytes(file, onPdfUpload);
    };
    // Listen on the viewer area for PDF drops
    window.addEventListener("pdf-drop", handler as unknown as EventListener);
    return () => window.removeEventListener("pdf-drop", handler as unknown as EventListener);
  }, [onPdfUpload]);

  const pageStamps = placements.filter((s) => s.pageIndex === currentPage);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* PDF 文件 */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          PDF 文件
        </h3>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfChange}
          className="hidden"
          id="pdf-upload"
        />
        <label
          htmlFor="pdf-upload"
          onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
          onDragLeave={() => setPdfDragOver(false)}
          onDrop={onPdfDrop}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm transition-colors ${
            pdfDragOver
              ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-400"
              : "border-zinc-300 text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
          }`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="truncate">{pdfFile ? pdfFile.name : "上传 PDF"}</span>
        </label>
        {pdfFile && (
          <p className="mt-1 px-1 text-xs text-zinc-400">{formatFileSize(pdfFile.size)}</p>
        )}
      </div>

      {/* 图章图片 */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          图章图片
        </h3>
        <input
          ref={stampInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleStampChange}
          className="hidden"
          id="stamp-upload"
        />
        <label
          htmlFor="stamp-upload"
          onDragOver={(e) => { e.preventDefault(); setStampDragOver(true); }}
          onDragLeave={() => setStampDragOver(false)}
          onDrop={onStampDrop}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm transition-colors ${
            stampDragOver
              ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-400"
              : "border-zinc-300 text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
          }`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="truncate">{stampFile ? stampFile.name : "上传图章 (PNG)"}</span>
        </label>
      </div>

      {/* 图章大小 */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          图章大小
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="30"
            max="300"
            value={stampWidth}
            onChange={(e) => onStampWidthChange(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="w-10 text-right text-xs text-zinc-500">{stampWidth}pt</span>
        </div>
      </div>

      {/* 盖章模式 */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          盖章模式
        </h3>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          <button
            onClick={() => onModeChange("click")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "click"
                ? "bg-blue-600 text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            点击放置
          </button>
          <button
            onClick={() => onModeChange("riding-seam")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "riding-seam"
                ? "bg-blue-600 text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            骑缝章
          </button>
        </div>
      </div>

      {/* 页面导航 */}
      {totalPages > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            页面
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span className="min-w-[5rem] text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 骑缝章位置 */}
      {mode === "riding-seam" && totalPages > 1 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            骑缝章垂直位置
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={ridingSeamPosition}
              onChange={(e) => onRidingSeamPositionChange(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="w-8 text-right text-xs text-zinc-500">{ridingSeamPosition}%</span>
          </div>
        </div>
      )}

      {/* 当前页图章列表 */}
      {pageStamps.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            图章 (第 {currentPage + 1} 页)
          </h3>
          <div className="space-y-1">
            {pageStamps.map((stamp, idx) => (
              <div
                key={stamp.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs dark:border-zinc-800"
              >
                <span className="text-zinc-500 dark:text-zinc-400">#{idx + 1}</span>
                <button
                  onClick={() => onDeleteStamp(stamp.id)}
                  className="text-zinc-400 transition-colors hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                  title="删除图章"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-auto flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {mode === "riding-seam" && totalPages > 1 && (
          <button
            onClick={onApplyRidingSeam}
            disabled={!stampFile || !pdfFile}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            应用骑缝章
          </button>
        )}

        {hasStamps && (
          <button
            onClick={onClearAll}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            清除所有图章
          </button>
        )}

        <button
          onClick={onExport}
          disabled={!pdfFile || !hasStamps || isExporting}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-40"
        >
          {isExporting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              导出中...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              导出盖章 PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
