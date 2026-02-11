import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";
import { FastAPIAdapter } from "./authAdapter";

// Validate required environment variables at build time
if (!process.env.AUTH_SECRET) {
  console.error("AUTH_SECRET environment variable is required");
}

// Build providers list dynamically — skip providers with missing env vars
const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    allowDangerousEmailAccountLinking: true,
  }),
];

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (process.env.RESEND_API_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "DocTalk <noreply@doctalk.site>",
    })
  );
} else {
  console.warn("RESEND_API_KEY not set — email magic link provider disabled");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: FastAPIAdapter(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        (session as any).user = (session as any).user || {};
        (session as any).user.id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
});

