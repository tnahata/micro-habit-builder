// app/api/integrations/route.ts
import { NextRequest } from "next/server";


const DESCOPE_PROJECT_ID = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!;
const MANAGEMENT_KEY = process.env.NEXT_PUBLIC_DESCOPE_MANAGEMENT_KEY!;

export async function POST(req: NextRequest) {
  console.log("Received request to /api/integrations");
  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }



    // ✅ Define apps to check
    const apps = ["google-calendar", "slack"];

    const results: Record<string, boolean> = {};

    for (const appId of apps) {
      const response = await fetch(
        "https://api.descope.com/v1/mgmt/outbound/app/user/token/latest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DESCOPE_PROJECT_ID}:${MANAGEMENT_KEY}`,
          },
          body: JSON.stringify({
            appId,
            userId,
            options: { withRefreshToken: false, forceRefresh: false },
          }),
        }
      );

      if (!response.ok) {
        results[appId] = false;
        continue;
      }

      const data = await response.json();
      console.log("Data for", appId, ":", data);

      // ✅ Mark connected only if token object exists and has an accessToken
      results[appId] = !!(data?.token?.accessToken);
    }

    console.log("Integration check results:", results);
    return Response.json(results);

  } catch (err) {
    console.error("Error fetching integrations:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
