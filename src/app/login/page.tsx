import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Studio Galleries</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Deliver photoshoots to your clients with secure, beautiful galleries.
        </p>
        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
