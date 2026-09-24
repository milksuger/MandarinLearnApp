// Better Auth CLI schema-generation config. The Worker supplies its D1 binding
// and secrets per request in worker/auth.ts; keep auth features aligned there.
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
});
