import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const dynamic = "force-dynamic";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: 'identify email' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "davinci_super_secret",
  session: { strategy: "jwt" },
  debug: true,
  callbacks: {
    async session({ session, token }) {
      return session;
    },
    async signIn({ user, account, profile }) {
      return true;
    }
  },
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true
      }
    }
  }
});

export { handler as GET, handler as POST };
