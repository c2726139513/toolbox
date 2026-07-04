"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFileUpload?: (fileName: string) => void;
}

export default function MarkdownEditor({
  value,
  onChange,
  onFileUpload,
}: MarkdownEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      onFileUpload?.(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onChange(text);
      };
      reader.readAsText(file);
    },
    [onChange, onFileUpload],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types?.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.endsWith(".md")) return;

      onFileUpload?.(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onChange(text);
      };
      reader.readAsText(file);
    },
    [onChange, onFileUpload],
  );

  const charCount = value.length;
  const wordCount = value.trim()
    ? value.trim().split(/\s+/).length
    : 0;
  const lineCount = value ? value.split("\n").length : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
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
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            上传 .md
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown"
            onChange={handleFileUpload}
            onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
            className="hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {lineCount} 行
          </span>
          <span className="text-xs text-zinc-300 dark:text-zinc-600">|</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {wordCount} 词
          </span>
          <span className="text-xs text-zinc-300 dark:text-zinc-600">|</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {charCount} 字符
          </span>
          <span className="text-xs text-zinc-300 dark:text-zinc-600">|</span>
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showPreview
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            预览
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div
        className="relative flex flex-1 overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] transition-all duration-200">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-400 bg-white/90 px-10 py-8 shadow-lg dark:bg-zinc-900/90 dark:border-blue-500">
              <svg
                className="h-10 w-10 text-blue-500 animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-base font-medium text-blue-600 dark:text-blue-400">
                松开导入 .md 文件
              </p>
            </div>
          </div>
        )}

        {/* Editor pane */}
        <textarea
          value={value}
          onChange={handleTextChange}
          placeholder="在此输入或粘贴 Markdown..."
          className="flex-1 resize-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300 dark:text-zinc-200 dark:placeholder:text-zinc-600"
          spellCheck={false}
        />

        {/* Preview pane */}
        {showPreview && (
          <div className="w-1/2 overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            {value ? (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600 prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-zinc-900 prose-pre:text-zinc-100 dark:prose-code:bg-zinc-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  预览将显示在此处
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
