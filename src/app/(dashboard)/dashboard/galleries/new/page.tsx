import { createGallery } from "@/actions/galleries";

export default function NewGalleryPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-zinc-900">New gallery</h1>
      <p className="mt-1 text-sm text-zinc-500">
        One gallery per photoshoot. You&apos;ll upload photos on the next screen.
      </p>
      <form action={createGallery} className="mt-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="Emma & Jake — Wedding"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="eventDate" className="block text-sm font-medium text-zinc-700">
            Shoot date <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
            Description <span className="text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Create gallery
        </button>
      </form>
    </div>
  );
}
