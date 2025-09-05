import * as admin from "firebase-admin";

import serviceAccount from "../../streakflow-ac191-firebase-adminsdk-fbsvc-92717a0a39.json";
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount), 
  });
}

export const adminDb = admin.firestore();