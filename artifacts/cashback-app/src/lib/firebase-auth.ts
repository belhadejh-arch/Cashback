const firebaseConfig = {
  apiKey: "AIzaSyA6kiJzWhgYZ-eTX-oBIYhKVLomIXHbnyA",
  authDomain: "studio-5817063024-c14a2.firebaseapp.com",
  projectId: "studio-5817063024-c14a2",
  storageBucket: "studio-5817063024-c14a2.firebasestorage.app",
  messagingSenderId: "682218596807",
  appId: "1:682218596807:web:05f9ae90848de238a111e2",
};

declare global {
  interface Window {
    firebase?: any;
  }
}

let authPromise: Promise<any> | undefined;
let confirmation: any;
let verifier: any;
let verificationMode: "sign-in" | "link" | undefined;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.firebase) resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("FIREBASE_LOAD_FAILED")), {
          once: true,
        });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("FIREBASE_LOAD_FAILED"));
    document.head.appendChild(script);
  });
}

export function getFirebaseAuth(): Promise<any> {
  if (!authPromise) {
    authPromise = (async () => {
      await loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
      await loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js");
      const firebase = window.firebase;
      if (!firebase) throw new Error("FIREBASE_LOAD_FAILED");
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      return firebase.auth();
    })();
  }
  return authPromise;
}

export async function signInWithEmail(email: string, password: string): Promise<any> {
  const auth = await getFirebaseAuth();
  return auth.signInWithEmailAndPassword(email.trim(), password);
}

export async function createEmailAccount(email: string, password: string): Promise<any> {
  const auth = await getFirebaseAuth();
  return auth.createUserWithEmailAndPassword(email.trim(), password);
}

export async function linkEmailPassword(email: string, password: string): Promise<any> {
  const auth = await getFirebaseAuth();
  const firebase = window.firebase;
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const credential = firebase.auth.EmailAuthProvider.credential(email.trim(), password);
  const result = await auth.currentUser.linkWithCredential(credential);
  await result.user.getIdToken(true);
  return result;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = await getFirebaseAuth();
  await auth.sendPasswordResetEmail(email.trim());
}

export async function sendPhoneCode(
  phoneNumber: string,
  mode: "sign-in" | "link" = "sign-in",
): Promise<void> {
  const auth = await getFirebaseAuth();
  const firebase = window.firebase;
  if (!document.getElementById("phone-recaptcha")) {
    throw new Error("PHONE_VERIFICATION_UNAVAILABLE");
  }
  verifier?.clear?.();
  verifier = new firebase.auth.RecaptchaVerifier(
    "phone-recaptcha",
    { size: "invisible" },
    auth,
  );
  await verifier.render();
  verificationMode = mode;
  try {
    if (mode === "link") {
      if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
      confirmation = await auth.currentUser.linkWithPhoneNumber(phoneNumber, verifier);
    } else {
      confirmation = await auth.signInWithPhoneNumber(phoneNumber, verifier);
    }
  } catch (error) {
    verifier?.clear?.();
    verifier = undefined;
    throw error;
  }
}

export async function confirmPhoneCode(code: string): Promise<any> {
  if (!confirmation) throw new Error("PHONE_CODE_NOT_SENT");
  const result = await confirmation.confirm(code.trim());
  confirmation = undefined;
  verificationMode = undefined;
  await result.user.getIdToken(true);
  return result;
}

export function currentFirebaseUser(): any {
  return window.firebase?.auth?.().currentUser ?? null;
}

export async function signOutFirebase(): Promise<void> {
  const auth = await getFirebaseAuth();
  confirmation = undefined;
  verificationMode = undefined;
  await auth.signOut();
}

export function firebaseErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code: unknown }).code)
    : error instanceof Error
      ? error.message
      : "UNKNOWN_ERROR";
}

export function pendingPhoneVerificationMode(): "sign-in" | "link" | undefined {
  return verificationMode;
}
