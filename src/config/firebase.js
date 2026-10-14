import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyBirUYpiRpaJ9B5acPTjtpMfuaAZor_AgQ",
  authDomain: "rs-purchase.firebaseapp.com",
  projectId: "rs-purchase",
  storageBucket: "rs-purchase.firebasestorage.app",
  messagingSenderId: "231019803645",
  appId: "1:231019803645:web:ee2aae2114e63409c39f94"
};

// Root artifact path used in RSBETA.html
export const BASE_COLLECTION_PATH = "artifacts/rs-purchase-my-business";

let app;
let db;
let auth;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (cacheErr) {
    console.warn("Firestore persistent cache fallback:", cacheErr);
    db = getFirestore(app);
  }
  auth = getAuth(app);
} catch (err) {
  console.warn("Firebase initialization notice:", err);
}

export { app, db, auth };
