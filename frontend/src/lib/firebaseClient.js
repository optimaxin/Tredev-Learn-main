import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

let auth = null;

// Lazy init — this module is pulled in app-wide via AuthContext, so
// initializing at import time would crash the whole app (not just Google
// sign-in) whenever the REACT_APP_FIREBASE_* env vars aren't set yet.
function getFirebaseAuth() {
  if (!auth) {
    if (!process.env.REACT_APP_FIREBASE_API_KEY) {
      throw new Error("Google sign-in isn't configured yet — REACT_APP_FIREBASE_* env vars are missing.");
    }
    const app = initializeApp({
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
  }
  return auth;
}

/** Opens the Google account picker and returns a Firebase ID token for the
 * chosen account — the backend verifies it and finds-or-creates the user. */
export async function signInWithGoogle() {
  const { user } = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  return user.getIdToken();
}
