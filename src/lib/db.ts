// src/lib/db.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

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
  const payload: any = {
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
    const normalizedHabits = userHabits.map((name) => ({
      id: String(name).toLowerCase().trim().replace(/\s+/g, "-"),
      name: String(name),
      streaks: { current: 0, longest: 0 },
      logs: [] as { completed: boolean; date: admin.firestore.Timestamp }[],
      createdAt: now,
      updatedAt: now,
    }));

    transaction.update(userRef, {
      habits: normalizedHabits,
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

// Get user integrations
export async function getUserIntegrations(userId: string) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? (snap.data() as any).integrations : null;
}
