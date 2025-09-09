// src/lib/db.ts

import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

interface UserPayload {
  createdAt?: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  habits?: string[];
}
// Get user data
export async function getUser(userId: string): Promise<any> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User does not exist");
  }

  return userDoc.data(); // full user object (habits, streaks, etc.)
}

// Upsert user
export async function upsertUser(userId: string, data: any) {
  const userRef = adminDb.collection("users").doc(userId);
  const docSnapshot = await userRef.get();
  const payload: UserPayload = {
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!docSnapshot.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.habits = [];
  }
  await userRef.set(payload, { merge: true });
}

// Update integration
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
    const fieldPath = `integrations.${integration}.connected`;
    transaction.update(userRef, {
      [fieldPath]: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

// Add habits
export async function addHabits(userId: string, userHabits: string[]) {
  const userRef = adminDb.collection("users").doc(userId);
  await adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("User does not exist");
    }
    const now = admin.firestore.Timestamp.now();
    const existingData = userDoc.data();
    const existingHabits: any[] = existingData?.habits || [];
    // Normalize input
    const normalizedInput = userHabits.map((name) => ({
      id: String(name).toLowerCase().trim().replace(/\s+/g, "-"),
      name: String(name),
    }));
    // Preserve existing habits
    const updatedHabits = [...existingHabits];
    // Add only new habits
    normalizedInput.forEach((habit) => {
      const alreadyExists = existingHabits.some((h) => h.id === habit.id);
      if (!alreadyExists) {
        updatedHabits.push({
          ...habit,
          streaks: { current: 0, longest: 0 },
          logs: [] as { completed: boolean; date: admin.firestore.Timestamp }[],
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    transaction.update(userRef, {
      habits: updatedHabits,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

// Get habits
export async function getHabits(userId: string): Promise<any[]> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error("User does not exist");
  }
  const data = userDoc.data();
  return Array.isArray(data?.habits) ? data!.habits : [];
}
// Store integration tokens
export async function storeIntegrationTokens(
  userId: string,
  integration: "googleCalendar" | "slack",
  accessToken: string,
  refreshToken?: string,
  additionalData?: Record<string, any>
) {
  const userRef = adminDb.collection("users").doc(userId);

  const updateData: any = {
    [`integrations.${integration}.accessToken`]: accessToken,
    [`integrations.${integration}.connected`]: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (refreshToken) {
    updateData[`integrations.${integration}.refreshToken`] = refreshToken;
  }

  // Add any additional data (like Slack user ID)
  if (additionalData) {
    Object.keys(additionalData).forEach(key => {
      updateData[`integrations.${integration}.${key}`] = additionalData[key];
    });
  }

  await userRef.update(updateData);
}

// Log habit (append log entry inside the habit)
export async function logHabit(
  userId: string,
  habitId: string,
  completed: boolean
) {
  const userRef = adminDb.collection("users").doc(userId);

  await adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new Error("User does not exist");

    const data = userDoc.data();
    const habits = data?.habits || [];

    const updatedHabits = habits.map((habit: any) => {
      if (habit.id === habitId) {
        return {
          ...habit,
          logs: [
            ...(habit.logs || []),
            {
              completed,
              date: admin.firestore.Timestamp.now().toDate(),
            },
          ],
          updatedAt: admin.firestore.Timestamp.now(),
        };
      }
      return habit;
    });

    transaction.update(userRef, {
      habits: updatedHabits,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

// Get logs for a habit
export async function getHabitLogs(
  userId: string,
  habitId: string
): Promise<{ completed: boolean; date: any }[]> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new Error("User does not exist");

  const data = userDoc.data();
  const habits = data?.habits || [];
  const habit = habits.find((h: any) => h.id === habitId);

  return habit ? habit.logs || [] : [];
}