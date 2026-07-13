import { prisma } from "../prisma";
import { decryptSecret, encryptSecret } from "../crypto";
import { GoogleDriveProvider } from "./google-drive";
import {
  StorageNotConnectedError,
  StorageProvider,
  StorageRevokedError,
} from "./types";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type StudioStorage = {
  provider: StorageProvider & GoogleDriveProvider;
  connection: {
    id: string;
    rootFolderId: string;
    googleEmail: string;
  };
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
};

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${json.error ?? res.status}`);
  }
  return json;
}

/**
 * Returns a Drive provider bound to the platform's central Google account
 * (a singleton connection shared by all studios), transparently refreshing
 * (and persisting) the access token as needed.
 * Throws StorageNotConnectedError / StorageRevokedError for the UI to map.
 */
export async function getStorage(): Promise<StudioStorage> {
  const connection = await prisma.storageConnection.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!connection) throw new StorageNotConnectedError();
  if (connection.status === "REVOKED") throw new StorageRevokedError();

  let cachedToken: { value: string; expiresAt: number } | null =
    connection.accessTokenEnc && connection.accessExpiresAt
      ? {
          value: decryptSecret(connection.accessTokenEnc),
          expiresAt: connection.accessExpiresAt.getTime(),
        }
      : null;

  const getAccessToken = async (): Promise<string> => {
    if (cachedToken && cachedToken.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      return cachedToken.value;
    }

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: decryptSecret(connection.refreshTokenEnc),
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json()) as GoogleTokenResponse;

    if (!res.ok) {
      if (json.error === "invalid_grant") {
        await prisma.storageConnection.update({
          where: { id: connection.id },
          data: { status: "REVOKED", accessTokenEnc: null, accessExpiresAt: null },
        });
        throw new StorageRevokedError();
      }
      throw new Error(`Google token refresh failed: ${json.error ?? res.status}`);
    }

    const expiresAt = Date.now() + json.expires_in * 1000;
    cachedToken = { value: json.access_token, expiresAt };
    await prisma.storageConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encryptSecret(json.access_token),
        accessExpiresAt: new Date(expiresAt),
        status: "ACTIVE",
      },
    });
    return json.access_token;
  };

  return {
    provider: new GoogleDriveProvider(getAccessToken),
    connection: {
      id: connection.id,
      rootFolderId: connection.rootFolderId,
      googleEmail: connection.googleEmail,
    },
  };
}

/**
 * Every studio gets its own subfolder inside the platform Drive so gallery
 * names can't collide across tenants. Created lazily, persisted on Studio.
 */
export async function ensureStudioFolder(
  storage: StudioStorage,
  studio: { id: string; name: string; slug: string }
): Promise<string> {
  const row = await prisma.studio.findUnique({
    where: { id: studio.id },
    select: { driveFolderId: true },
  });
  if (row?.driveFolderId) return row.driveFolderId;

  const folderId = await storage.provider.createFolder(
    `${studio.name} (${studio.slug})`,
    storage.connection.rootFolderId
  );
  await prisma.studio.update({
    where: { id: studio.id },
    data: { driveFolderId: folderId },
  });
  return folderId;
}
