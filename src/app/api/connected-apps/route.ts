// app/api/integrations/route.ts
import { NextRequest } from "next/server";
import { updateIntegrationStatus } from "@/lib/db"; // 👈 import your Firestore helper

const DESCOPE_PROJECT_ID = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!;
const MANAGEMENT_KEY = process.env.DESCOPE_MANAGEMENT_KEY!;

export async function POST(req: NextRequest) {
  console.log("Received request to /api/integrations");
  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // ✅ Define apps to check
    const apps: Record<string, "googleCalendar" | "slack"> = {
      "google-calendar": "googleCalendar",
      "slack": "slack",
    };

    const results: Record<string, boolean> = {};

    for (const [appId, fieldName] of Object.entries(apps)) {
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
        results[fieldName] = false;
        await updateIntegrationStatus(userId, fieldName, false); // 👈 update Firestore
        continue;
      }

      const data = await response.json();
      console.log("Data for", appId, ":", data);

      // ✅ Mark connected only if token object exists and has an accessToken
      const isConnected = !!(data?.token?.accessToken);
      results[fieldName] = isConnected;

      // 👇 update Firestore
      await updateIntegrationStatus(userId, fieldName, isConnected);
    }

    console.log("Integration check results:", results);
    return Response.json(results);

  } catch (err) {
    console.error("Error fetching integrations:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
