import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/storage";
import { GoogleDriveProvider } from "@/lib/storage/google-drive";

const ROOT_FOLDER_NAME = "Studio Galleries";

function settingsRedirect(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/dashboard/settings/storage?${query}`, req.url));
}

export async function GET(req: NextRequest) {
  const { studio } = await requireStudio();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return settingsRedirect(req, "error=missing_code");

  // The state JWT binds this callback to the studio that initiated the flow.
  try {
    const { payload } = await jwtVerify(
      state,
      new TextEncoder().encode(process.env.AUTH_SECRET!)
    );
    if (payload.studioId !== studio.id) return settingsRedirect(req, "error=state_mismatch");
  } catch {
    return settingsRedirect(req, "error=bad_state");
  }

  const tokens = await exchangeCodeForTokens(
    code,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/drive/callback`
  );
  if (!tokens.refresh_token) {
    // Happens if consent was previously granted and prompt=consent was bypassed
    return settingsRedirect(req, "error=no_refresh_token");
  }

  // id_token comes straight from Google's token endpoint over TLS — safe to decode
  let googleEmail = "unknown";
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
      );
      if (typeof payload.email === "string") googleEmail = payload.email;
    } catch {
      // keep "unknown"
    }
  }

  const provider = new GoogleDriveProvider(async () => tokens.access_token);

  // Reuse the existing root folder on reconnect when it still exists
  const existing = await prisma.storageConnection.findUnique({
    where: { studioId: studio.id },
  });
  let rootFolderId: string | null = null;
  if (existing?.rootFolderId) {
    try {
      await provider.getFileMeta(existing.rootFolderId);
      rootFolderId = existing.rootFolderId;
    } catch {
      rootFolderId = null;
    }
  }
  rootFolderId ??= await provider.ensureRootFolder(ROOT_FOLDER_NAME);

  const data = {
    googleEmail,
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    accessTokenEnc: encryptSecret(tokens.access_token),
    accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    rootFolderId,
    status: "ACTIVE" as const,
  };
  await prisma.storageConnection.upsert({
    where: { studioId: studio.id },
    create: { studioId: studio.id, ...data },
    update: data,
  });

  return settingsRedirect(req, "connected=1");
}
