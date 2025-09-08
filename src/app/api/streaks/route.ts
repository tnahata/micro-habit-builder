import { NextResponse } from "next/server";
import { getUser } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    const user = await getUser(userId);
    return NextResponse.json({ user });
  } catch (err) {
    console.error("PUT /api/user error:", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
      