import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/?auth_error=${error}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/?auth_error=No code provided`, request.url));
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const baseUrl = process.env.NEXTAUTH_URL 
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/discord/callback`;

    // 1. Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Discord Token Error:', tokenData);
      return NextResponse.redirect(new URL(`/?auth_error=Failed to authenticate with Discord`, request.url));
    }

    // 2. Fetch User Profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('Discord User Error:', userData);
      return NextResponse.redirect(new URL(`/?auth_error=Failed to fetch Discord profile`, request.url));
    }

    // 3. Format Data
    const email = userData.email || null;
    const username = userData.username || null;
    const avatar = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null;

    if (!email) {
      return NextResponse.redirect(new URL(`/?auth_error=No email associated with your Discord account`, request.url));
    }

    // 4. Redirect to Frontend with Auth Payload
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('discord_auth', 'success');
    redirectUrl.searchParams.set('email', email);
    redirectUrl.searchParams.set('username', username);
    if (avatar) redirectUrl.searchParams.set('avatar', avatar);

    return NextResponse.redirect(redirectUrl);

  } catch (err: any) {
    console.error('Manual Discord Auth Exception:', err);
    return NextResponse.redirect(new URL(`/?auth_error=Internal server error during authentication`, request.url));
  }
}
