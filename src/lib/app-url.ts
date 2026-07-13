function normalizeOrigin(value: string): string {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value.replace(/\/$/, "")
    : `https://${value.replace(/\/$/, "")}`;
}

export function publicAppUrlFromEnv(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return normalizeOrigin(vercelUrl);

  return null;
}

export async function publicAppUrl(): Promise<string> {
  const configured = publicAppUrlFromEnv();
  if (configured) return configured;

  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  if (host) return `${proto}://${host}`;
  return "http://localhost:3001";
}
