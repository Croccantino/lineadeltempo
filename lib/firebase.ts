import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  serverTimestamp,
  push,
  remove,
} from "firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { TimelineRow, TimelineEvent, TimelineData, normalizeTimelineData } from "./initialData";

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

export const getFirebaseApp = (): FirebaseApp | null => {
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

export interface FeedbackEntry {
  id: string;
  rating: number;
  message?: string;
  createdAt: number;
}

const FEEDBACK_ADMIN_EMAIL = "francesco.zompi29@gmail.com";

export async function submitFeedback(rating: number, message = ""): Promise<void> {
  const db = getDbInstance();
  if (!db) throw new Error("Firebase non configurato. Controlla le variabili d'ambiente.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("La valutazione deve essere compresa tra 1 e 5.");
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > 1200) {
    throw new Error("Il commento non può superare i 1200 caratteri.");
  }

  const feedbackRef = push(ref(db, "feedback"));
  if (!feedbackRef.key) throw new Error("Impossibile creare un identificativo per la recensione.");

  await set(feedbackRef, {
    rating,
    createdAt: serverTimestamp(),
    ...(cleanMessage ? { message: cleanMessage } : {}),
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  const auth = getAuthInstance();
  if (auth?.currentUser?.email !== FEEDBACK_ADMIN_EMAIL) {
    throw new Error("Solo l'amministratore può eliminare le recensioni.");
  }

  const db = getDbInstance();
  if (!db) throw new Error("Firebase non configurato. Controlla le variabili d'ambiente.");
  await remove(ref(db, `feedback/${id}`));
}

export function subscribeToFeedback(
  onUpdate: (entries: FeedbackEntry[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const db = getDbInstance();
  if (!db) {
    onError?.(new Error("Firebase non configurato. Controlla le variabili d'ambiente."));
    return () => {};
  }

  try {
    return onValue(
      ref(db, "feedback"),
      (snapshot) => {
        const data = snapshot.val() as Record<string, unknown> | null;
        const entries = Object.entries(data ?? {}).flatMap(([id, value]) => {
          if (typeof value !== "object" || value === null) return [];

          const item = value as Record<string, unknown>;
          if (
            typeof item.rating !== "number" ||
            !Number.isInteger(item.rating) ||
            item.rating < 1 ||
            item.rating > 5 ||
            (item.message !== undefined && typeof item.message !== "string") ||
            typeof item.createdAt !== "number" ||
            !Number.isFinite(new Date(item.createdAt).getTime())
          ) {
            return [];
          }

          return [{
            id,
            rating: item.rating,
            createdAt: item.createdAt,
            ...(typeof item.message === "string" ? { message: item.message } : {}),
          }];
        });

        onUpdate(entries.sort((a, b) => b.createdAt - a.createdAt));
      },
      (err) => {
        console.warn("Errore lettura feedback Firebase:", err);
        onError?.(err);
      }
    );
  } catch (err) {
    console.warn("Impossibile connettere il listener dei feedback:", err);
    onError?.(err);
    return () => {};
  }
}

export function subscribeToFirebase(
  onUpdate: (data: TimelineData) => void,
  onError?: (error: unknown) => void
): () => void {
  const db = getDbInstance();
  if (!db) {
    onError?.(new Error("Firebase non configurato. Controlla la configurazione del database."));
    return () => {};
  }

  try {
    const unsubscribe = onValue(
      ref(db, DB_PATH),
      (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data.rows) && Array.isArray(data.events)) {
          onUpdate(normalizeTimelineData({ rows: data.rows, events: data.events }));
        } else {
          onError?.(new Error(`I dati Firebase in ${DB_PATH} non hanno il formato previsto.`));
        }
      },
      (err) => {
        console.warn("Errore listener Firebase:", err);
        onError?.(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn("Impossibile connettere listener Firebase:", err);
    onError?.(err);
    return () => {};
  }
}
