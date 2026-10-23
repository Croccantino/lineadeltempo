import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, set, onValue, serverTimestamp } from "firebase/database";
//<<<<<<< 
immagini
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { TimelineRow, TimelineEvent, TimelineData } from "./initialData";
//=======
import { TimelineRow, TimelineEvent, TimelineData, normalizeTimelineData } from "./initialData";
//>>>>>>> 
main

const getEnvConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
});

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export const isFirebaseActive = () => {
  const conf = getEnvConfig();
  return Boolean(conf.apiKey && conf.projectId && conf.databaseURL);
};

export const isAuthActive = () => {
  const conf = getEnvConfig();
  return Boolean(conf.apiKey && conf.authDomain && conf.projectId);
};

const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseActive()) return null;
  if (firebaseApp) return firebaseApp;
  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(getEnvConfig());
    return firebaseApp;
  } catch (err) {
    console.warn("Inizializzazione Firebase non riuscita:", err);
    return null;
  }
};

export const getDbInstance = () => {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getDatabase(app);
  } catch (err) {
    console.warn("Connessione al database non riuscita:", err);
    return null;
  }
};

export const getAuthInstance = (): Auth | null => {
  if (!isAuthActive()) return null;
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    authInstance = getAuth(app);
    return authInstance;
  } catch (err) {
    console.warn("Inizializzazione autenticazione non riuscita:", err);
    return null;
  }
};

const requireAuth = (): Auth => {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Firebase Auth non configurato. Controlla le variabili d'ambiente.");
  return auth;
};

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(requireAuth(), email, password);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuth(), email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuthState(
  onUpdate: (user: User | null) => void,
  onError?: (error: unknown) => void
): () => void {
  const auth = getAuthInstance();
  if (!auth) {
    onUpdate(null);
    return () => {};
  }
  try {
    return onAuthStateChanged(
      auth,
      (user) => onUpdate(user),
      (err) => {
        console.warn("Errore listener autenticazione:", err);
        if (onError) onError(err);
        onUpdate(null);
      }
    );
  } catch (err) {
    console.warn("Impossibile connettere il listener di autenticazione:", err);
    if (onError) onError(err);
    onUpdate(null);
    return () => {};
  }
}

const DB_PATH = "timeline/main";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lettura dell'immagine non riuscita."));
    reader.readAsDataURL(blob);
  });
}

export async function saveImageToFirebase(blob: Blob): Promise<string> {
  const db = getDbInstance();
  if (!db) throw new Error("Firebase non configurato. Controlla le variabili d'ambiente.");

  const id = crypto.randomUUID();
  const data = await blobToDataUrl(blob);
  await set(ref(db, `images/${id}`), {
    data,
    type: blob.type || "image/webp",
    size: blob.size,
    createdAt: Date.now(),
  });
  return id;
}

export async function syncToFirebase(
  rows: TimelineRow[],
  events: TimelineEvent[]
): Promise<boolean> {
  const db = getDbInstance();
  if (!db) return false;
  try {
    await set(ref(db, DB_PATH), {
      rows,
      events,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Errore salvataggio Firebase:", err);
    return false;
  }
}

export function subscribeToFirebase(
  onUpdate: (data: TimelineData) => void,
  onError?: (error: unknown) => void
): () => void {
  const db = getDbInstance();
  if (!db) return () => {};

  try {
    const unsubscribe = onValue(
      ref(db, DB_PATH),
      (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data.rows) && Array.isArray(data.events)) {
          onUpdate(normalizeTimelineData({ rows: data.rows, events: data.events }));
        }
      },
      (err) => {
        console.warn("Errore listener Firebase:", err);
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn("Impossibile connettere listener Firebase:", err);
    return () => {};
  }
}
