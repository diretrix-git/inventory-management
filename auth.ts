import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import type { Role } from "@/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await connectDB();
          const user = await User.findOne({
            email: (credentials.email as string).toLowerCase(),
          }).lean();

          if (!user) return null;

          if (!user.isActive) {
            throw new Error("Account disabled");
          }

          if (!user.passwordHash) return null;

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) return null;

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image ?? null,
            role: user.role as Role,
          };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Account disabled"
          ) {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, user object is present — seed the token
      if (user) {
        token.id = user.id;
        token.role = (user as { id?: string; role?: Role }).role;
      }

      // On session update or if role is missing, re-fetch from DB
      if (trigger === "update" || !token.role) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id).lean();
          if (dbUser) {
            token.role = dbUser.role as Role;
            token.name = dbUser.name;
            // Sync image from DB (set via profile page upload)
            if (dbUser.image) token.picture = dbUser.image;
          }
        } catch {
          // Keep existing token data on DB error
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { id: string; role?: Role }).role =
          token.role as Role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
