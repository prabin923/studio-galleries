import Link from "next/link";
import type { Metadata } from "next";
import { requireStudio } from "@/lib/auth";
import { signOut } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { studio, user, isAdmin } = await requireStudio();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-zinc-900">
              {studio.name}
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Galleries
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/settings/storage"
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Storage
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
