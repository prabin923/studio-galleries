import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { resolveShareLink } from "@/lib/share";
import { readClientSession, writeClientSession } from "@/lib/client-session";
import { rateLimit } from "@/lib/rate-limit";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") redirect(`/g/${token}`);
  const { link } = resolved;
  if (!link.passwordHash) redirect(`/g/${token}`);

  const claims = await readClientSession(link.id);
  if (!claims) redirect(`/g/${token}/enter`);
  if (claims.pwOk) redirect(`/g/${token}`);

  async function submit(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");

    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`pw:${token}:${ip}`, 10, 10 * 60 * 1000)) {
      redirect(`/g/${token}/password?error=rate_limited`);
    }

    const fresh = await resolveShareLink(token);
    if (fresh.status !== "ok" || !fresh.link.passwordHash) redirect(`/g/${token}`);
    const session = await readClientSession(fresh.link.id);
    if (!session) redirect(`/g/${token}/enter`);

    const ok = await verify(fresh.link.passwordHash, password);
    if (!ok) redirect(`/g/${token}/password?error=wrong`);

    await prisma.clientSession.update({
      where: { id: session.sid },
      data: { lastSeenAt: new Date() },
    });
    await writeClientSession({ ...session, pwOk: true });
    redirect(`/g/${token}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">
          {resolved.link.gallery.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          This gallery is password protected.
        </p>
        {error === "wrong" && (
          <p className="mt-3 text-sm text-red-600">Wrong password, try again.</p>
        )}
        {error === "rate_limited" && (
          <p className="mt-3 text-sm text-red-600">
            Too many attempts. Wait a few minutes and try again.
          </p>
        )}
        <form action={submit} className="mt-5">
          <input
            name="password"
            type="password"
            required
            autoFocus
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Open gallery
          </button>
        </form>
      </div>
    </main>
  );
}
