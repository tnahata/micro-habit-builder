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
        onSuccess={() => {
          router.push("/dashboard");
        }}
      />
    </div>
  );
}
