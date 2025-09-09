// app/api/habits/route.ts
import { NextResponse } from "next/server";
import { addHabits, getHabits } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId, habits } = await req.json();

    if (!userId || !Array.isArray(habits)) {
      return NextResponse.json({ error: "Missing userId or habits" }, { status: 400 });
    }

    // Accept string[] or habit-object[]; normalize to string[]
    const names = habits
      .map((h: any) => (typeof h === "string" ? h : h?.name))
      .filter((n: any) => typeof n === "string" && n.trim() !== "");

    await addHabits(userId, names);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/habits error:", err);
    return NextResponse.json({ error: "Failed to save habits" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    const habits = await getHabits(userId);
    return NextResponse.json({ habits });
  } catch (err) {
    console.error("PUT /api/habits error:", err);
    return NextResponse.json({ error: "Failed to load habits" }, { status: 500 });
  }
}
