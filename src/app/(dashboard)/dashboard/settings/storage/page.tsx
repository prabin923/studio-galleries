import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code. Please try again.",
  state_mismatch: "This authorization belongs to a different session. Please try again.",
  bad_state: "The authorization request expired. Please try again.",
  no_refresh_token:
    "Google didn't grant offline access. Remove the app at myaccount.google.com/permissions and reconnect.",
};

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { studio } = await requireStudio();
  const { connected, error } = await searchParams;
  const connection = await prisma.storageConnection.findUnique({
    where: { studioId: studio.id },
  });

  async function disconnect() {
    "use server";
    const { studio } = await requireStudio();
    await prisma.storageConnection.delete({ where: { studioId: studio.id } });
    revalidatePath("/dashboard/settings/storage");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-zinc-900">Storage</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your photos are stored in your own Google Drive, in a folder this app
        creates and manages. We never see the rest of your Drive.
      </p>

      {connected && (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Google Drive connected successfully.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {ERROR_MESSAGES[error] ?? "Something went wrong connecting Google Drive."}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        {connection ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900">Google Drive</p>
                <p className="mt-1 text-sm text-zinc-500">{connection.googleEmail}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  connection.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {connection.status === "ACTIVE" ? "Connected" : "Needs reconnect"}
              </span>
            </div>
            <div className="mt-6 flex gap-3">
              <a
                href="/api/drive/connect"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Reconnect
              </a>
              <form action={disconnect}>
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </form>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Disconnecting keeps all files in your Drive but stops galleries from
              loading until you reconnect.
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-zinc-900">No storage connected</p>
            <p className="mt-1 text-sm text-zinc-500">
              Connect a Google account to store your photoshoots in its Drive.
            </p>
            <a
              href="/api/drive/connect"
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Connect Google Drive
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
