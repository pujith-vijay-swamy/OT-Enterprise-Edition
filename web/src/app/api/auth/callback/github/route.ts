import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4400/api';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(error || 'No authorization code returned')}`);
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23liH6AZE8ReibuQmV';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'e8895fb22b85e71f86e762a3ba316112a2d585ee';

    // Exchange GitHub authorization code for OAuth Access Token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(tokenData.error_description || 'Failed to exchange token with GitHub')}`);
    }

    const accessToken = tokenData.access_token;

    // Send access token to Python AST Engine backend server
    try {
      await fetch(`${apiBase}/auth/github/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken }),
      });
    } catch (engineErr) {
      console.warn('Backend engine notify warning:', engineErr);
    }

    // Set cookie and redirect back to homepage
    const response = NextResponse.redirect(`${appUrl}/?github_connected=true`);
    response.cookies.set('omnitrace_github_token', accessToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
    });

    return response;

  } catch (err: any) {
    return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(err.message || 'OAuth Exchange Error')}`);
  }
}
