import { session, createSdk } from "@descope/nextjs-sdk/server";
import DescopeClient from "@descope/node-sdk";
import { upsertUser, getUser } from "@/lib/db";

const descope = DescopeClient({
  projectId: process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!,
});

const sdk = createSdk({
  projectId: process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!,
  managementKey: process.env.DESCOPE_MANAGEMENT_KEY!,
});

export async function POST(req: Request) {
  try {
    let currSession;

    // 1️⃣ Try reading session from cookies (prod)
    currSession = await session();

    // 2️⃣ Fallback: read manual sessionJwt from request body (local dev)
    if (!currSession) {
      const body = await req.json();
      if (!body.sessionJwt) {
        return new Response(
          JSON.stringify({ error: "No session token provided" }),
          { status: 401 }
        );
      }
      currSession = await descope.validateSession(body.sessionJwt);
    }

    // 3️⃣ Extract userId from session token
    const userId = currSession.token.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "No valid user ID in session" }),
        { status: 400 }
      );
    }

    const { ok, data: user } = await sdk.management.user.load(userId);
    if (!ok || !user) {
      return new Response("User not found", { status: 404 });
    }

    // 4️⃣ Fetch user profile from Descope
    const email = user.email ?? "";
    const name = user.name ?? "";

    // 🔑 5️⃣ Check Firestore for existing user
    let existingUser;
    try {
      existingUser = await getUser(userId);
    } catch (error: Error | any) {
      console.log("User does not exist, will create new user:", error.message);
    }

    const insertData = {
      email,
      name,
      streaks: existingUser?.streaks ?? { current: 0, longest: 0 },
      rewards: existingUser?.rewards ?? { points: 0, badges: [] },
      integrations: existingUser?.integrations ?? {
        googleCalendar: { connected: false },
        slack: { connected: false },
      },
      habits: existingUser?.habits ?? [], // preserve habits
    };

    // 6️⃣ Upsert user into Firestore
    await upsertUser(userId, insertData);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email, name },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Auth callback error:", err);
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 500 }
    );
  }
}