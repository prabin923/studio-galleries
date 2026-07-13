import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code. Please try again.",
  state_mismatch: "This authorization belongs to a different session. Please try again.",
  bad_state: "The authorization request expired. Please try again.",
  no_refresh_token:
    "Google didn't grant offline access. Remove the app at myaccount.google.com/permissions and reconnect.",
  admin_only: "Only a platform admin can manage the storage connection.",
};

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { isAdmin } = await requireStudio();
  const { connected, error } = await searchParams;
  const connection = await prisma.storageConnection.findFirst({
    orderBy: { createdAt: "asc" },
  });

  async function disconnect() {
    "use server";
    const { isAdmin } = await requireStudio();
    if (!isAdmin) throw new Error("Only a platform admin can disconnect storage");
    await prisma.storageConnection.deleteMany({});
    revalidatePath("/dashboard/settings/storage");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-zinc-900">Storage</h1>
      <p className="mt-1 text-sm text-zinc-500">
        All galleries are stored in the platform&apos;s central Google Drive, in a
        folder per studio. The app only ever touches the folder it creates.
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
                <p className="font-medium text-zinc-900">Platform Google Drive</p>
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
            {isAdmin ? (
              <>
                <div className="mt-6 flex gap-3">
                  <a
                    href="/api/drive/connect"
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Reconnect
                  </a>
                  <form action={disconnect}>
                    <ConfirmSubmitButton
                      message="Disconnect platform storage for every studio?"
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Disconnect
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  Disconnecting keeps all files in Drive but stops every studio&apos;s
                  galleries from loading until you reconnect.
                </p>
              </>
            ) : (
              <p className="mt-4 text-xs text-zinc-400">
                Storage is managed by the platform admin.
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="font-medium text-zinc-900">No storage connected</p>
            {isAdmin ? (
              <>
                <p className="mt-1 text-sm text-zinc-500">
                  Connect the platform Google account whose Drive will hold every
                  studio&apos;s photos.
                </p>
                <a
                  href="/api/drive/connect"
                  className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Connect Google Drive
                </a>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                The platform admin hasn&apos;t connected storage yet — uploads are
                disabled until then.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
