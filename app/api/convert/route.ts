import { NextRequest, NextResponse } from "next/server";
import type { DocxStyleOptions } from "@/lib/converter";
import { DEFAULT_STYLE_OPTIONS } from "@/lib/converter";
import { convertToBuffer } from "@/lib/convert-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const markdown = body.markdown as string | undefined;
    const style: DocxStyleOptions = body.style ?? DEFAULT_STYLE_OPTIONS;

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'markdown' field in request body" },
        { status: 400 },
      );
    }

    const byteSize = new TextEncoder().encode(markdown).length;
    if (byteSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Markdown input exceeds maximum size of 10 MB" },
        { status: 413 },
      );
    }

    const buffer = await convertToBuffer(markdown, style);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=\"document.docx\"",
        "Content-Length": String(uint8.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("DOCX conversion error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
