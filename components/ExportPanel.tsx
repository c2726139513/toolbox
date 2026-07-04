"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import type { DocxStyleOptions } from "@/lib/converter";
import { DEFAULT_STYLE_OPTIONS, formatSize } from "@/lib/converter";

interface ExportPanelProps {
  markdown: string;
  style: DocxStyleOptions;
  onStyleChange: (style: DocxStyleOptions) => void;
  fileName?: string;
}

export default function ExportPanel({
  markdown,
  style,
  onStyleChange,
  fileName,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!markdown.trim()) {
      setError("没有可导出的内容，请先编写或上传 Markdown。");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, style }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "转换失败" }));
        throw new Error(err.error ?? `Server error: ${res.status}`);
      }

      const blob = await res.blob();
      const docxName = fileName
        ? fileName.replace(/\.(md|markdown)$/i, ".docx")
        : "document.docx";
      triggerDownload(blob, docxName);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "导出失败，未知错误";
      console.error("Export failed:", err);
      setError(message);
    } finally {
      setExporting(false);
    }
  }, [markdown, style]);

  const updateStyle = useCallback(
    <K extends keyof DocxStyleOptions>(
      key: K,
      value: DocxStyleOptions[K],
    ) => {
      onStyleChange({ ...style, [key]: value });
    },
    [style, onStyleChange],
  );

  const contentSize = new Blob([markdown]).size;

  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Font */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            字体
          </label>
          <select
            value={style.fontFamily}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              updateStyle("fontFamily", e.target.value)
            }
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none transition-colors focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Calibri">Calibri</option>
            <option value="Georgia">Georgia</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Courier New">Courier New</option>
          </select>
        </div>

        {/* H1 Color */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            H1 颜色
          </label>
          <input
            type="color"
            value={`#${style.heading1Color}`}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateStyle("heading1Color", e.target.value.replace("#", ""))
            }
            className="h-7 w-9 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
          />
        </div>

        {/* H2 Color */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            H2 颜色
          </label>
          <input
            type="color"
            value={`#${style.heading2Color}`}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateStyle("heading2Color", e.target.value.replace("#", ""))
            }
            className="h-7 w-9 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
          />
        </div>

        {/* Orientation */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            页面方向
          </label>
          <select
            value={style.pageOrientation}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              updateStyle(
                "pageOrientation",
                e.target.value as "PORTRAIT" | "LANDSCAPE",
              )
            }
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none transition-colors focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="PORTRAIT">纵向</option>
            <option value="LANDSCAPE">横向</option>
          </select>
        </div>

        {/* Export */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatSize(contentSize)} · 服务端转换
          </span>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                导出中...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                导出 DOCX
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
