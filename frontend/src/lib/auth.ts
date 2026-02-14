import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";
import { cookies } from "next/headers";
import { FastAPIAdapter } from "./authAdapter";
import { buildSignInEmail } from "./emailTemplate";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

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
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.EMAIL_FROM || "DocTalk <auth@doctalk.site>";

  providers.push(
    Resend({
      apiKey: resendApiKey,
      from: fromAddress,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { host } = new URL(url);

        // Detect locale from NEXT_LOCALE cookie
        let locale = "en";
        try {
          const cookieStore = await cookies();
          locale = cookieStore.get("NEXT_LOCALE")?.value || "en";
        } catch {
          // cookies() may throw outside request context; default to "en"
        }

        // Check if user exists to differentiate sign-up vs sign-in
        let isNewUser = false;
        try {
          if (ADAPTER_SECRET) {
            const res = await fetch(
              `${BACKEND_URL}/api/internal/auth/users/by-email/${encodeURIComponent(email)}`,
              {
                headers: {
                  "Content-Type": "application/json",
                  "X-Adapter-Secret": ADAPTER_SECRET,
                },
              }
            );
            isNewUser = res.status === 404;
          }
        } catch {
          // On any error, default to sign-in flow
        }

        const { html, text, subject } = buildSignInEmail({
          url,
          host,
          locale,
          isNewUser,
        });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject,
            html,
            text,
            headers: {
              "X-Entity-Ref-ID": crypto.randomUUID(),
              "Reply-To": "support@doctalk.site",
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`Resend error: ${await res.text()}`);
        }
      },
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

