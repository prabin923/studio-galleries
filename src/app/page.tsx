import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
      <h1 className="text-center text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Deliver photoshoots
        <br />
        your clients will love
      </h1>
      <p className="mt-4 max-w-xl text-center text-lg text-zinc-500">
        Upload a shoot, share a private gallery link, and let clients pick their
        favorites — stored safely in your own Google Drive.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Get started free
        </Link>
      </div>
    </main>
  );
}
