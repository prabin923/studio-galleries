import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
const COOKIE_MAX_AGE = 180 * 24 * 3600; // clients revisit galleries for months

export type ClientSessionClaims = {
  /** ClientSession row id */
  sid: string;
  /** ShareLink row id the cookie is bound to */
  linkId: string;
  /** true once the link's password (if any) has been entered */
  pwOk: boolean;
};

const cookieName = (linkId: string) => `cg_${linkId}`;

export async function readClientSession(linkId: string): Promise<ClientSessionClaims | null> {
  const jar = await cookies();
  const raw = jar.get(cookieName(linkId))?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    if (payload.linkId !== linkId || typeof payload.sid !== "string") return null;
    return { sid: payload.sid, linkId, pwOk: payload.pwOk === true };
  } catch {
    return null;
  }
}

/** Only callable from Server Actions and Route Handlers (cookie writes). */
export async function writeClientSession(claims: ClientSessionClaims): Promise<void> {
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(cookieName(claims.linkId), jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
