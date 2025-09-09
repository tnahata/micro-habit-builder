// app/api/integrations/route.ts
import { NextRequest } from "next/server";
import { updateIntegrationStatus } from "@/lib/db"; // 👈 import your Firestore helper
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

const DESCOPE_PROJECT_ID = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!;
const MANAGEMENT_KEY = process.env.DESCOPE_MANAGEMENT_KEY!;

export async function POST(req: NextRequest) {
  console.log("Received request to /api/connected-apps");
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

      // 👇 update Firestore with connection status AND store tokens
      await updateIntegrationStatus(userId, fieldName, isConnected);
      
      // 🔑 Store the actual tokens in Firestore if connected
      if (isConnected && data?.token?.accessToken) {
        const userRef = adminDb.collection('users').doc(userId);
        const updateData: any = {
          [`integrations.${fieldName}.accessToken`]: data.token.accessToken,
          [`integrations.${fieldName}.connected`]: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Store refresh token if available
        if (data.token.refreshToken) {
          updateData[`integrations.${fieldName}.refreshToken`] = data.token.refreshToken;
        }
        
        // For Slack, we need to get the Slack user ID from the token
        if (fieldName === 'slack' && data.token.accessToken) {
          try {
            // Get Slack user info to store the Slack user ID
            const slackResponse = await fetch('https://slack.com/api/auth.test', {
              headers: {
                'Authorization': `Bearer ${data.token.accessToken}`
              }
            });
            const slackData = await slackResponse.json();
            if (slackData.ok && slackData.user_id) {
              updateData[`integrations.${fieldName}.userId`] = slackData.user_id;
              console.log(`📱 Stored Slack user ID: ${slackData.user_id} for user: ${userId}`);
            }
          } catch (slackError) {
            console.error('Error getting Slack user ID:', slackError);
          }
        }
        
        await userRef.update(updateData);
        console.log(`🔑 Stored ${fieldName} tokens for user: ${userId}`);
      }
    }

    console.log("Integration check results:", results);
    return Response.json(results);

  } catch (err) {
    console.error("Error fetching integrations:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
