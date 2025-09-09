import { authMiddleware } from "@descope/nextjs-sdk/server";

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"], // run middleware for everything except _next, api, favicon
};

export default authMiddleware({
  projectId: process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!,
  publicRoutes: ["/", "/login"],
  redirectUrl: "/login",
});
