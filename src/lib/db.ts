// src/lib/db.ts

import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

interface UserPayload {
  createdAt?: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  habits?: string[];
}

export async function upsertUser(userId: string, data: Record<string, unknown>) {
  const userRef = adminDb.collection("users").doc(userId);
  const docSnapshot = await userRef.get();
  const payload: UserPayload = {
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!docSnapshot.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.habits = [] as string[]; // Define habits as an array of strings
  }
  await userRef.set(payload, { merge: true });
}

export async function updateIntegrationStatus(
  userId: string,
  integration: "googleCalendar" | "slack",
  status: boolean
) {
  const userRef = adminDb.collection("users").doc(userId);

  await adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("User does not exist");
    }

    // Build the dynamic field path, e.g. "integrations.slack.connected"
    const fieldPath = `integrations.${integration}.connected`;

    transaction.update(userRef, {
      [fieldPath]: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

// Add a new habit
export async function addHabits(userId: string, userHabits: string[]) {
  const userRef = adminDb.collection("users").doc(userId);
  
  // Use a transaction to safely update the habits array
  await adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("User does not exist");
    }
    transaction.update(userRef, { habits: userHabits, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

// Get all habits for a user
export async function getHabits(userId: string): Promise<string[]> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error("User does not exist");
  }
  const data = userDoc.data();
  if (!data) {
    return [];
  }
  // habits is stored as an array in your doc
  return Array.isArray(data.habits) ? (data.habits as string[]) : [];
}