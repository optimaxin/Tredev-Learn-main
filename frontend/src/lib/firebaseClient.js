import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

let auth = null;
let recaptchaVerifier = null;

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

/** Sends an SMS OTP to `phoneNumber` (E.164 format, e.g. "+919876543210").
 * `recaptchaContainerId` must be an element already mounted in the DOM.
 * Returns a Firebase ConfirmationResult — pass the user's entered code to
 * confirmPhoneOtp() to finish sign-in. */
export async function sendPhoneOtp(phoneNumber, recaptchaContainerId) {
  const auth = getFirebaseAuth();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  }
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

/** Confirms the SMS code against the ConfirmationResult from sendPhoneOtp()
 * and returns a Firebase ID token for the backend's /auth/phone endpoint. */
export async function confirmPhoneOtp(confirmationResult, code) {
  const { user } = await confirmationResult.confirm(code);
  return user.getIdToken();
}

/** Re-fetches a fresh ID token for the signed-in Firebase user. Call this
 * right before a backend call that happens a while after the initial
 * sign-in (e.g. after the user has been filling out a profile form), so the
 * backend never gets handed a token that's gone stale in the meantime. */
export async function refreshIdToken() {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(true);
}
