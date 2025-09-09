// app/onboarding/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@descope/nextjs-sdk/client";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const [habits, setHabits] = useState<string[]>([""]);
  const [originalHabits, setOriginalHabits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user && !isUserLoading) {
      router.push("/auth/callback");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const loadHabits = async () => {
      if (!user?.userId) return;
      try {
        const res = await fetch("/api/habits", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.userId }),
        });

        if (res.ok) {
          const data = await res.json();
          const names = Array.isArray(data.habits)
            ? data.habits
                .map((h: any) => (typeof h === "string" ? h : h?.name))
                .filter((n: any) => typeof n === "string" && n.trim() !== "")
            : [];
          setHabits([...names, ""]);
          setOriginalHabits(names);
        } else {
          setHabits([""]);
          setOriginalHabits([]);
        }
      } catch (err) {
        console.error("Failed to load habits:", err);
      } finally {
        setLoading(false);
      }
    };

    loadHabits();
  }, [user?.userId]);

  const handleHabitChange = (index: number, value: string) => {
    const next = [...habits];
    next[index] = value;
    setHabits(next);
  };

  const addHabit = () => setHabits((prev) => [...prev, ""]);

  const removeHabit = (index: number) => {
    const next = habits.filter((_, i) => i !== index);
    setHabits(next.length > 0 ? next : [""]);
  };

  const handleSubmit = async () => {
    if (!user?.userId) return;

    const filtered = habits.map((h) => h.trim()).filter((h) => h !== "");

    const unchanged =
      filtered.length === originalHabits.length &&
      filtered.every((h, i) => h === originalHabits[i]);

    if (unchanged) {
      router.push("/dashboard");
      return;
    }

    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, habits: filtered }), // send string[]
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to save habits:", err);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Loading your habits...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <button
        onClick={() => router.push("/dashboard")}
        className="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-md"
      >
        Go to Dashboard
      </button>

      <h2 className="text-2xl font-bold mb-4">Welcome to StreakFlow 🎉</h2>
      <p className="text-gray-400 mb-6">Let&apos;s set up your reminder preferences.</p>

      <div className="w-full max-w-md space-y-3">
        {habits.map((habit, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={habit}
              onChange={(e) => handleHabitChange(index, e.target.value)}
              placeholder={`Habit ${index + 1}`}
              className="flex-1 p-2 border rounded-lg bg-black text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => removeHabit(index)}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              -
            </button>
          </div>
        ))}

        <button
          onClick={addHabit}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
        >
          + Add Habit
        </button>

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Submit Habits
        </button>
      </div>
    </main>
  );
}
