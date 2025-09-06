import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
	try {
		const user = await getCurrentUser(req);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized"} , {status: 401 });
		}
		return NextResponse.json(user);
	} catch (error) {
		console.error("Error fetching user data:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}