"use client";

import { useState } from "react";
import Link from "next/link";
import MarkdownEditor from "@/components/MarkdownEditor";
import ExportPanel from "@/components/ExportPanel";
import type { DocxStyleOptions } from "@/lib/converter";
import { DEFAULT_STYLE_OPTIONS } from "@/lib/converter";

export default function MdToDocxPage() {
  const [markdown, setMarkdown] = useState("");
  const [style, setStyle] = useState<DocxStyleOptions>(DEFAULT_STYLE_OPTIONS);
  const [fileName, setFileName] = useState<string | undefined>();

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            ←
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              MD → DOCX
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Markdown 转 Word 文档
            </p>
          </div>
        </div>
      </header>

      {/* Export panel */}
      <ExportPanel
        markdown={markdown}
        style={style}
        onStyleChange={setStyle}
        fileName={fileName}
      />

      {/* Editor */}
      <MarkdownEditor
        value={markdown}
        onChange={setMarkdown}
        onFileUpload={setFileName}
      />
    </div>
  );
}
