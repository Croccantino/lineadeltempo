import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, set, onValue, serverTimestamp } from "firebase/database";
import { TimelineRow, TimelineEvent, TimelineData } from "./initialData";

const getEnvConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
});

let firebaseApp: FirebaseApp | null = null;

export const isFirebaseActive = () => {
  const conf = getEnvConfig();
  return Boolean(conf.apiKey && conf.projectId && conf.databaseURL);
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

const DB_PATH = "timeline/main";

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
          onUpdate({ rows: data.rows, events: data.events });
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
