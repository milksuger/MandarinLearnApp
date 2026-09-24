import { betterAuth } from "better-auth";

export interface AppBindings {
  DB: D1Database;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET: string;
  APP_URL?: string;
  BOOTSTRAP_ADMIN_SECRET?: string;
  MEDIA?: R2Bucket;
}

export function createAuth(env: AppBindings, captureResetToken?: (token: string) => void) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters");
  }

  return betterAuth({
    appName: "Belajar Mandarin",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: env.APP_URL ? [env.APP_URL] : undefined,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      // The no-cost product does not send email. Recovery is explicitly handled
      // through a user-held code and this callback never sends or logs the token.
      sendResetPassword: async ({ token }) => captureResetToken?.(token),
      onPasswordReset: async ({ user }) => {
        await env.DB.prepare("UPDATE recovery_codes SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND revoked_at IS NULL").bind(user.id).run();
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      storage: "database",
    },
    advanced: {
      useSecureCookies: Boolean(env.APP_URL?.startsWith("https://")),
      defaultCookieAttributes: {
        sameSite: "lax",
        httpOnly: true,
        secure: Boolean(env.APP_URL?.startsWith("https://")),
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO learner_profiles (user_id, display_name) VALUES (?, ?)",
            ).bind(user.id, user.name).run();
          },
        },
      },
    },
  });
}

export type AuthSession = Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;
