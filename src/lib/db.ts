// src/lib/db.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

// ✅ Firebase config from your .env.local (make sure to set NEXT_PUBLIC_ vars)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Avoid re-initialization in Next.js (Hot Reload friendly)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

//
// 🔹 Query Helpers
//

// Get a user profile by ID
export async function getUser(userId: string) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

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

// Log a habit completion
export async function logHabit(userId: string, habitId: string, completed: boolean) {
  const logsRef = collection(db, "users", userId, "logs");
  return await addDoc(logsRef, {
    habitId,
    completed,
    date: Timestamp.now(),
  });
}

// Get logs for a specific habit
export async function getHabitLogs(userId: string, habitId: string) {
  const logsRef = collection(db, "users", userId, "logs");
  const q = query(logsRef, where("habitId", "==", habitId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getUserIntegrations(userId: string) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().integrations : null;
}
