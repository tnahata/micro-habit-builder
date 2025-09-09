import { NextRequest, NextResponse } from "next/server";
import DescopeClient from "@descope/node-sdk";

const descope = DescopeClient({ projectId: process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID! });

export async function getCurrentUser(req: NextRequest) {
    const sessionToken = req.cookies.get("DS")?.value;
	const refreshToken = req.cookies.get("DSR")?.value;

	console.log("Session Token:", sessionToken);

	if (!sessionToken) return null;

    try {
		const authInfo = await descope.validateSession(sessionToken);
		console.log("Auth Info:", authInfo);
		if (authInfo && authInfo.jwt) {
			return {
				uid: "authInfo.user.userId",
				email: "authInfo.user.email",
			};
		}
  } catch (err: unknown) {
    // If session is expired, try refreshing with the refresh token
    if (refreshToken) {
      try {
        const refreshed = await descope.refreshSession(refreshToken);

		const res = NextResponse.next();
        // res.cookies.set("DS", refreshed.sessionJwt, {
        //   httpOnly: true,
        //   secure: true,
        //   path: "/",
        // });

        return {
          uid: "refreshed.user.userId",
          email: "refreshed.user.email",
        };
      } catch (refreshErr) {
        console.error("Refresh failed:", refreshErr);
        return null;
      }
    }

    if (err instanceof Error) {
      console.error("Session validation failed:", err.message);
    } else {
      console.error("Session validation failed:", err);
    }
    return null;
  }
}  