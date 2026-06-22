import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import type { Role } from "@/types";

// ─── Brute-force protection config ───────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;          // lock after 5 consecutive failures
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
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

          // Find user — use findOne without .lean() so we can .save() later
          const user = await User.findOne({
            email: (credentials.email as string).toLowerCase(),
          });

          // User not found — return null with no details (prevent email enumeration)
          if (!user) return null;

          // Check if account is temporarily locked
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            const remainingMs = user.lockedUntil.getTime() - Date.now();
            const remainingMins = Math.ceil(remainingMs / 60000);
            throw new Error(`Account temporarily locked. Try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`);
          }

          // Check if account is permanently deactivated
          if (!user.isActive) {
            throw new Error("Account disabled");
          }

          if (!user.passwordHash) return null;

          // Verify password
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            // Increment failed attempt counter
            const newAttempts = (user.loginAttempts ?? 0) + 1;

            if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
              // Lock the account
              user.loginAttempts = newAttempts;
              user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
              await user.save();
              throw new Error(`Too many failed attempts. Account locked for 15 minutes.`);
            } else {
              user.loginAttempts = newAttempts;
              await user.save();
            }
            return null;
          }

          // ── Success — reset failed attempt counter ────────────────────────
          user.loginAttempts = 0;
          user.lockedUntil = null;
          await user.save();

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image ?? null,
            role: user.role as Role,
          };
        } catch (error) {
          if (error instanceof Error) {
            // Re-throw known error messages to the login page
            const known = ["Account disabled", "Account temporarily locked", "Too many failed attempts", "locked for 15 minutes"];
            if (known.some((msg) => error.message.includes(msg.split(" ")[0]))) {
              throw error;
            }
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
      if (user) {
        token.id = user.id;
        token.role = (user as { id?: string; role?: Role }).role;
      }

      if (trigger === "update" || !token.role) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id).lean();
          if (dbUser) {
            token.role = dbUser.role as Role;
            token.name = dbUser.name;
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
