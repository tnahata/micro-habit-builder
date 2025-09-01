// app/onboarding/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkAuth } from "@/lib/auth";

export default function OnboardingPage() { // TOOD: this should not be needed anymore
  const router = useRouter();

  useEffect(() => {
    const user = checkAuth();
    if (!user) {
      router.push("/auth/callback"); // redirect to login/auth
    }
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Welcome to Streakly 🎉</h2>
      <p className="text-gray-600 mb-6">
        Let’s set up your reminder preferences.
      </p>
      {/* TODO: Add multi-step form for onboarding */}
    </main>
  );
}
