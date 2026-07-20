import Link from "next/link";
import type { Metadata } from "next";

const FEATURES = [
  {
    title: "Galleries that sell your work",
    body: "Every photoshoot becomes a beautiful, private gallery with a hero cover and a clean grid your clients will love browsing.",
  },
  {
    title: "Clients pick, you deliver",
    body: "Send a link — no client accounts needed. They heart their favorites (capped if you like), leave comments, and you export the list straight into Lightroom or Capture One.",
  },
  {
    title: "Protected by default",
    body: "Password-protected links, expiry dates, revocation, and download control. Original files are never exposed.",
  },
  {
    title: "One-click delivery",
    body: "Clients download single photos or the whole shoot as a ZIP — full resolution, exactly as you shot it.",
  },
];

export const metadata: Metadata = {
  title: "Private Client Photo Proofing",
  description:
    "Create secure proofing galleries, collect client favorites and comments, and deliver final images from one private studio workspace.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-widest uppercase">
          Studio Galleries
        </span>
        <Link
          href="/login"
          className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
          For photo studios
        </p>
        <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Deliver photoshoots
          <br />
          <span className="text-zinc-500">your clients will love.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          Upload a shoot, share one private link, and let clients pick their
          favorites, comment, and download — while you stay in control.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:scale-[1.03]"
          >
            Get started free
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-colors hover:border-zinc-600"
          >
            <h2 className="text-lg font-medium text-white">{f.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
        Studio Galleries — client photo delivery, done right.
      </footer>
    </main>
  );
}
