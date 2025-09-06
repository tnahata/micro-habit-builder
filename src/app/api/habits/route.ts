import { NextResponse } from "next/server";
import { addHabits, getHabits } from "@/lib/db";

// ✅ Save/update habits
export async function POST(req: Request) {
  console.log("Received request to add habbits");
  const { userId, habits } = await req.json();
  await addHabits(userId, habits);
  return NextResponse.json({ success: true });
}

// ✅ Load habits
export async function PUT(req: Request) {
  const { userId } = await req.json();
  const habits = await getHabits(userId);
  return NextResponse.json({ habits });
}
