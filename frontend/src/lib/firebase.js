import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: User needs to provide actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB21VoBplmz1bSARdYwzqQwbwVFYs4p5-c",
  authDomain: "inspectai-f9c10.firebaseapp.com",
  projectId: "inspectai-f9c10",
  storageBucket: "inspectai-f9c10.firebasestorage.app",
  messagingSenderId: "933286771053",
  appId: "1:933286771053:web:9afd2df6683c898fa2c264"
};

let app, auth, db;
let isFirebaseInitialized = false;

try {
  console.log("[Firebase Init] Attempting to initialize Firebase...");
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseInitialized = true;
  console.log("[Firebase Init] ✅ Firebase initialized successfully");
} catch (error) {
  console.error("[Firebase Init] ❌ Firebase error:", error);
}

export { app, auth, db, isFirebaseInitialized };
export default app;
