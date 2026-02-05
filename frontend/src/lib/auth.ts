import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { FastAPIAdapter } from "./authAdapter";

// Validate required environment variables at build time
if (!process.env.AUTH_SECRET) {
  console.error("AUTH_SECRET environment variable is required");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: FastAPIAdapter(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    // Apple and Email providers can be added later
  ],
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
  },
});

