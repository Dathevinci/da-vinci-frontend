import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "davinci_super_secret",
  debug: true,
  callbacks: {
    async session({ session, token }) {
      return session;
    },
    async signIn({ user, account, profile }) {
      // Allow sign in even if some profile fields are missing, let DiscordSync handle it
      return true;
    }
  },
});

export { handler as GET, handler as POST };
