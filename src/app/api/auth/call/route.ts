// src/app/api/auth/call/route.ts
import { session } from "@descope/nextjs-sdk/server";

// ✅ define it here
export async function getUserSession() {
  try {
    const currSession = await session();
    if (currSession?.token?.sub) {
      return {
        loggedIn: true,
        userId: currSession.token.sub,
        email: currSession.token.email ?? null,
        name: currSession.token.name ?? null,
      };
    }
    return { loggedIn: false };
  } catch (err) {
    console.error("Error reading session:", err);
    return { loggedIn: false };
  }
}

// Keep your API handler too
export async function GET() {
  const session = await getUserSession();
  return Response.json(session);
}
