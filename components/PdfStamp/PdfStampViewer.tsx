"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { StampPlacement } from "@/lib/pdf-stamp";
import { screenToPdf } from "@/lib/pdf-stamp";

interface PdfStampViewerProps {
  pdfBytes: ArrayBuffer | null;
  currentPage: number;
  totalPages: number;
  placements: StampPlacement[];
  selectedStampData: ArrayBuffer | null;
  mode: "click" | "riding-seam";
  stampWidth: number;
  onAddStamp: (placement: Omit<StampPlacement, "id">) => void;
  onMoveStamp?: (id: string, x: number, y: number) => void;
  onPdfMeta: (width: number, height: number) => void;
}

const PREVIEW_SCALE = 1.5;
const DRAG_HIT_MARGIN = 10;

/** Resolve position — use drag override if this stamp is being dragged */
function resolvePos(
  stamp: StampPlacement,
  drag: { stampId: string; x: number; y: number } | null,
) {
  return drag?.stampId === stamp.id
    ? { x: drag.x, y: drag.y }
    : { x: stamp.x, y: stamp.y };
}

export default function PdfStampViewer({
  pdfBytes,
  currentPage,
  totalPages,
  placements,
  selectedStampData,
  mode,
  stampWidth,
  onAddStamp,
  onMoveStamp,
  onPdfMeta,
}: PdfStampViewerProps) {
  const dispRef = useRef<HTMLCanvasElement>(null);
  const baseCache = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [loading, setLoading] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Drag state — all refs, no React state during drag so mousemove is cheap
  const drag = useRef<{
    stampId: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
    stampH: number; // stamp height in PDF points
  } | null>(null);
  const dragEnded = useRef(false); // drag.current kept alive until next mousedown
  const [ver, setVer] = useState(0);
  const [hoveredStamp, setHoveredStamp] = useState(false);

  // Refs to capture latest props (avoids stale closures)
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const onMoveRef = useRef(onMoveStamp);
  onMoveRef.current = onMoveStamp;
  const onAddStampRef = useRef(onAddStamp);
  onAddStampRef.current = onAddStamp;
  const selectedStampDataRef = useRef(selectedStampData);
  selectedStampDataRef.current = selectedStampData;

  const dragCleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => dragCleanup.current?.(), []);

  // ---------- Load all pages ----------
  useEffect(() => {
    let dead = false;
    async function load(buf: ArrayBuffer) {
      setLoading(true);
      setError(null);
      baseCache.current.clear();
      setReady(false);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
        const n = doc.numPages;
        const p1 = await doc.getPage(1);
        const v1 = p1.getViewport({ scale: PREVIEW_SCALE });
        if (!dead) {
          setDims({ w: v1.width, h: v1.height });
          onPdfMeta(v1.width / PREVIEW_SCALE, v1.height / PREVIEW_SCALE);
        }
        for (let i = 0; i < n; i++) {
          if (dead) return;
          const p = await doc.getPage(i + 1);
          const vp = p.getViewport({ scale: PREVIEW_SCALE });
          const c = document.createElement("canvas");
          c.width = vp.width;
          c.height = vp.height;
          await p.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp }).promise;
          baseCache.current.set(i, c);
        }
        if (!dead) setReady(true);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "PDF 加载失败");
      } finally {
        if (!dead) setLoading(false);
      }
    }
    if (pdfBytes) load(pdfBytes);
    return () => { dead = true; };
  }, [pdfBytes, onPdfMeta]);

  // ---------- Composite (rebuilds when page/placements/ready/ver changes) ----------
  const doComposite = useRef<() => void>(() => {});
  const compositeGen = useRef(0);

  useEffect(() => {
    const d = dispRef.current;
    if (!d || !ready) return;
    const base = baseCache.current.get(currentPage);
    if (!base) { doComposite.current = () => {}; return; }

    doComposite.current = () => {
      const ctx = d.getContext("2d")!;
      d.width = base.width;
      d.height = base.height;
      ctx.drawImage(base, 0, 0);

      const gen = ++compositeGen.current;
      const list = placementsRef.current.filter((s) => s.pageIndex === currentPage);
      if (list.length === 0) return;

      for (const st of list) {
        const pos = resolvePos(st, drag.current);
        const sx = pos.x * PREVIEW_SCALE;
        const sy = base.height - pos.y * PREVIEW_SCALE - st.height * PREVIEW_SCALE;
        const sw = st.width * PREVIEW_SCALE;
        const sh = st.height * PREVIEW_SCALE;

        createImageBitmap(new Blob([st.imageData])).then((bmp) => {
          if (gen !== compositeGen.current) { bmp.close(); return; }
          ctx.globalCompositeOperation = "multiply";
          ctx.save();
          ctx.translate(sx + sw / 2, sy + sh / 2);
          ctx.rotate((st.rotation * Math.PI) / 180);
          ctx.drawImage(bmp, -sw / 2, -sh / 2, sw, sh);
          ctx.restore();
          ctx.globalCompositeOperation = "source-over";
          bmp.close();
        });
      }
    };

    doComposite.current();
  }, [currentPage, ready, ver, placements.length]);

  // ---------- Hit test (reads from refs — never stale) ----------
  function hitTest(cx: number, cy: number): StampPlacement | null {
    const base = baseCache.current.get(currentPage);
    if (!base) return null;
    const list = placementsRef.current.filter((s) => s.pageIndex === currentPage);
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i];
      const pos = resolvePos(st, drag.current);
      const sx = pos.x * PREVIEW_SCALE;
      const sy = base.height - pos.y * PREVIEW_SCALE - st.height * PREVIEW_SCALE;
      const sw = st.width * PREVIEW_SCALE;
      const sh = st.height * PREVIEW_SCALE;
      if (cx >= sx - DRAG_HIT_MARGIN && cx <= sx + sw + DRAG_HIT_MARGIN &&
          cy >= sy - DRAG_HIT_MARGIN && cy <= sy + sh + DRAG_HIT_MARGIN) {
        return st;
      }
    }
    return null;
  }

  // ---------- Canvas coords from mouse event ----------
  const canvasXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = dispRef.current;
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (d.width / r.width),
      y: (e.clientY - r.top) * (d.height / r.height),
    };
  }, []);

  // ---------- Mouse move — track hover for cursor ----------
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Clear stale drag ref so cursor goes back to normal
    if (dragEnded.current) {
      dragEnded.current = false;
      drag.current = null;
    }
    const c = canvasXY(e);
    if (!c) { setHoveredStamp(false); return; }
    setHoveredStamp(hitTest(c.x, c.y) !== null);
  }, [canvasXY]);

  // ---------- Mouse down — start drag ----------
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // If a drag just completed, clear the stale drag ref so onClick can fire
    if (dragEnded.current) {
      dragEnded.current = false;
      drag.current = null;
    }
    if (mode !== "click") return;
    const c = canvasXY(e);
    if (!c) return;
    const h = hitTest(c.x, c.y);
    if (!h) return;
    e.preventDefault();

    const base = baseCache.current.get(currentPage);
    if (!base) return;
    const pos = resolvePos(h, drag.current);
    const sx = pos.x * PREVIEW_SCALE;
    const sy = base.height - pos.y * PREVIEW_SCALE - h.height * PREVIEW_SCALE;

    drag.current = {
      stampId: h.id,
      x: pos.x,
      y: pos.y,
      ox: c.x - sx,
      oy: c.y - sy,
      stampH: h.height,
    };
    setHoveredStamp(false);

    dragCleanup.current?.();

    let raf: number | null = null;

    const move = (e: MouseEvent) => {
      const d = dispRef.current;
      if (!d || !drag.current) return;
      const r = d.getBoundingClientRect();
      const cx = (e.clientX - r.left) * (d.width / r.width);
      const cy = (e.clientY - r.top) * (d.height / r.height);

      const newSx = cx - drag.current.ox;
      const newSy = cy - drag.current.oy;

      drag.current.x = newSx / PREVIEW_SCALE;
      drag.current.y = (base.height - newSy) / PREVIEW_SCALE - drag.current.stampH;

      if (raf === null) {
        raf = requestAnimationFrame(() => {
          raf = null;
          doComposite.current();
        });
      }
    };

    const up = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      const st = drag.current;
      if (st) {
        onMoveRef.current?.(st.stampId, st.x, st.y);
        setVer((v) => v + 1);
      }
      // Keep drag.current alive so onClick sees it and skips.
      // Set flag so next onMouseDown clears it.
      dragEnded.current = true;
      dragCleanup.current = null;
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (raf !== null) cancelAnimationFrame(raf);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    dragCleanup.current = cleanup;
  }, [mode, currentPage, canvasXY]);

  // ---------- Click — place new stamp ----------
  const onClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drag.current || mode !== "click" || !selectedStampDataRef.current || !pdfBytes) return;
    const c = canvasXY(e);
    if (!c) return;
    if (hitTest(c.x, c.y)) return;

    const { x, y } = screenToPdf(c.x, c.y, dispRef.current!.height, PREVIEW_SCALE);
    const stampData = selectedStampDataRef.current;
    const img = await createImageBitmap(new Blob([stampData]));
    const h = stampWidth * (img.height / img.width);
    img.close();

    onAddStampRef.current({
      pageIndex: currentPage,
      x: x - stampWidth / 2,
      y: y - h / 2,
      width: stampWidth,
      height: h,
      rotation: 0,
      imageData: stampData,
    });
  }, [mode, pdfBytes, currentPage, stampWidth, canvasXY]);

  // ---------- Cursor (position-aware via hoveredStamp) ----------
  const cursor = (() => {
    if (!ready) return "cursor-default";
    if (drag.current && !dragEnded.current) return "cursor-grabbing";
    if (hoveredStamp) return "cursor-grab";
    if (mode === "click" && selectedStampData) return "cursor-crosshair";
    return "cursor-default";
  })();

  // ---------- Render ----------
  if (!pdfBytes) {
    return (
      <div className="flex aspect-[3/4] max-h-[75vh] items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-600">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          上传 PDF 文件或拖拽到此处
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-[3/4] max-h-[75vh] items-center justify-center rounded-xl border-2 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <p className="px-4 text-sm text-red-500">PDF 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm dark:bg-black/60">
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm text-zinc-500 shadow-lg dark:bg-zinc-900 dark:text-zinc-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            加载 PDF 中...
          </div>
        </div>
      )}

      <canvas
        ref={dispRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onClick={onClick}
        className={`w-full max-h-[75vh] rounded-xl border border-zinc-200 bg-white object-contain dark:border-zinc-800 select-none ${cursor}`}
        style={{ aspectRatio: dims.w > 0 ? `${dims.w} / ${dims.h}` : "3/4" }}
      />

      {!loading && ready && (
        <div className="mt-2 text-center text-xs text-zinc-400">
          {mode === "click" && selectedStampData
            ? "点击放置图章 · 拖拽已放置的图章调整位置"
            : "支持拖拽 PDF 文件到此处"}
        </div>
      )}
    </div>
  );
}
