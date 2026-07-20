"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold text-zinc-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              The page could not load. Try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
