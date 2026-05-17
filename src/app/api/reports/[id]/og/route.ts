import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves the first image of a public share report as a real PNG so WhatsApp,
// iMessage, Slack etc. can pull a preview. No auth — same access rule as
// /share/[id]: the only secret is the cuid in the URL.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report || report.imageUrls.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const dataUrl = report.imageUrls[0];
  const match = dataUrl.match(/^data:(image\/png);base64,(.+)$/);
  if (!match) return new NextResponse("Bad image", { status: 500 });
  const buf = Buffer.from(match[2], "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
