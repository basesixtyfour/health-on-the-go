import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  const missing: string[] = [];
  if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");

  throw new Error(
    `Missing required Google OAuth environment variables: ${missing.join(
      ", "
    )}. ` + `Please ensure these are set in your environment configuration.`
  );
}

if (!BETTER_AUTH_SECRET) {
  console.warn(
    "WARNING: BETTER_AUTH_SECRET is not set. Better Auth will generate a secret, but it's recommended to set one explicitly for production."
  );
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/v1/auth",
  secret: BETTER_AUTH_SECRET, // Required for JWE encryption
  trustedOrigins: ["http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "PATIENT",
        returned: true, // Include in session.user
        input: false, // Prevent users from setting their own role
      },
    },
  },
  socialProviders: {
    google: {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
      strategy: "jwe",
      refreshCache: true,
    },
  },
});
