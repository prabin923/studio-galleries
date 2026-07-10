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
};

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
    include: { memberships: { include: { studio: true } } },
  });
  if (!user) return null;

  let membership = user.memberships[0];
  if (!membership) {
    const name = user.name ? `${user.name}'s Studio` : "My Studio";
    membership = await prisma.membership.create({
      data: {
        role: "OWNER",
        user: { connect: { id: user.id } },
        studio: {
          create: { name, slug: slugify(user.name ?? user.email.split("@")[0]) },
        },
      },
      include: { studio: true },
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
  };
}
