import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireStudio } from "@/lib/auth";
import { publicAppUrl } from "@/lib/app-url";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const DRIVE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export async function GET() {
  const { studio, isAdmin } = await requireStudio();
  if (!isAdmin) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  const state = await new SignJWT({ studioId: studio.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

  const appUrl = await publicAppUrl();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/drive/callback`,
    response_type: "code",
    scope: DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
}
