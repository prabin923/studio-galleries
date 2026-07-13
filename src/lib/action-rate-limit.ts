import { headers } from "next/headers";
import { rateLimit } from "./rate-limit";

export async function rateLimitAction(
  prefix: string,
  token: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return rateLimit(`${prefix}:${token}:${ip}`, max, windowMs);
}
