import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveShareLink } from "@/lib/share";
import { readClientSession, writeClientSession } from "@/lib/client-session";

// Server Components can't set cookies, so first-time visitors bounce through
// this handler to get their anonymous ClientSession before seeing the gallery.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const galleryUrl = new URL(`/g/${token}`, req.url);

  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return NextResponse.redirect(galleryUrl);
  const { link } = resolved;

  const existing = await readClientSession(link.id);
  if (!existing) {
    const session = await prisma.clientSession.create({
      data: { shareLinkId: link.id },
    });
    await writeClientSession({
      sid: session.id,
      linkId: link.id,
      pwOk: !link.passwordHash,
    });
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  return NextResponse.redirect(galleryUrl);
}
