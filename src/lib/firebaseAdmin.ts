import * as admin from "firebase-admin";

import serviceAccount from "../../streakflow-ac191-firebase-adminsdk-fbsvc-3cf493e88b.json";
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount), 
  });
}

export const adminDb = admin.firestore();