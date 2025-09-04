// src/app/api/connect/slack/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/callback`;
  const authUrl = `https://api.descope.com/v1/integrations/oauth/authorize?projectId=${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}&provider=slack&redirectUri=${encodeURIComponent(redirectUri)}`;
  return NextResponse.redirect(authUrl);
}
