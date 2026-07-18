import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const requestUrl = new URL(request.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'Missing DISCORD_CLIENT_ID' }, { status: 500 });
  }

  // Construct Discord OAuth2 URL
  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify email');
  authUrl.searchParams.set('prompt', 'none'); // Auto-approve if previously authorized

  return NextResponse.redirect(authUrl.toString());
}
