import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
      <h1 className="text-xl font-semibold text-zinc-900">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Go home
      </Link>
    </main>
  );
}
