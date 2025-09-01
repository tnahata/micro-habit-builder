import { NextResponse } from 'next/server';

export async function GET() {
  const redirectUrl = `https://api.descope.com/v1/integrations/oauth/authorize?provider=slack&projectId=${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}&redirectUri=${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/callback`;

  return NextResponse.redirect(redirectUrl);
}
