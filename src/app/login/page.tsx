"use client";

import { Descope } from "@descope/nextjs-sdk";
import { useRouter } from "next/navigation" 

export default function AuthPage() {
  const router = useRouter();

  return (
    <div className="flex justify-center items-center h-screen">
      <Descope
        flowId="sign-up-or-in"   // Descope default flow
        projectId={process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!}
        onSuccess={async (e: { detail: { sessionJwt: string; refreshJwt: string } }) => {
          const { sessionJwt, refreshJwt } = e.detail;

          try {
            // Send sessionJwt manually in dev; prod will ignore it and use cookies
            await fetch("/api/auth/callback", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ sessionJwt }),
            });
            console.log("Auth callback completed, redirecting to onboarding...");
            router.push("/onboarding");
          } catch (error) {
            console.error("Error in auth callback:", error);
          }
        }}
      />
    </div>
  );
}
