import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
});

export type StudioContext = {
  user: { id: string; email: string; name: string | null; image: string | null };
  studio: { id: string; name: string; slug: string };
  role: "OWNER" | "MEMBER";
  /** Platform admin — may manage the central storage connection */
  isAdmin: boolean;
};

/**
 * Platform admins come from ADMIN_EMAILS (comma-separated). If unset, every
 * signed-in user is treated as admin — acceptable for local dev only.
 */
export function isAdminEmail(email: string): boolean {
  const list = process.env.ADMIN_EMAILS;
  if (!list) return true;
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "studio"}-${randomBytes(3).toString("hex")}`;
}

/**
 * Resolves the signed-in user's studio, provisioning one on first login.
 * The single entry point for all dashboard data access — every query made
 * on behalf of a studio must scope by the returned studio.id.
 */
export async function requireStudio(): Promise<StudioContext> {
  const ctx = await getStudioContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Like requireStudio, but returns null for API routes to map to a 401. */
export async function getStudioContext(): Promise<StudioContext | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      memberships: {
        include: { studio: true },
        orderBy: { studio: { createdAt: "asc" } },
      },
    },
  });
  if (!user) return null;

  let membership = user.memberships[0];
  if (!membership) {
    // Layout and page render concurrently, so first-login provisioning can
    // race with itself — serialize it with a per-user advisory lock
    membership = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      const existing = await tx.membership.findFirst({
        where: { userId: user.id },
        include: { studio: true },
        orderBy: { studio: { createdAt: "asc" } },
      });
      if (existing) return existing;
      const name = user.name ? `${user.name}'s Studio` : "My Studio";
      return tx.membership.create({
        data: {
          role: "OWNER",
          user: { connect: { id: user.id } },
          studio: {
            create: { name, slug: slugify(user.name ?? user.email.split("@")[0]) },
          },
        },
        include: { studio: true },
      });
    });
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, image: user.image },
    studio: {
      id: membership.studio.id,
      name: membership.studio.name,
      slug: membership.studio.slug,
    },
    role: membership.role,
    isAdmin: isAdminEmail(user.email),
  };
}
