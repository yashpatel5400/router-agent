import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";

const OUTPUTS_DIR = join(process.cwd(), "..", "outputs");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("..") || filename.includes("/")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filePath = join(OUTPUTS_DIR, filename);

  if (!existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const data = readFileSync(filePath);
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
