import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { TimelineRow, TimelineEvent, TimelineData } from "../app/api/eventi/route";

// Configurazione predefinita o da variabili d'ambiente
const getStoredConfig = () => {
  if (typeof window === "undefined") return null;
  try {
    const custom = localStorage.getItem("firebase_custom_config");
    if (custom) return JSON.parse(custom);
  } catch (e) {}
  return null;
};

export const getFirebaseConfig = () => {
  const custom = getStoredConfig();
  if (custom && custom.apiKey) return custom;

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
};

export const isFirebaseActive = () => {
  const conf = getFirebaseConfig();
  return Boolean(conf.apiKey && conf.projectId);
};

// Inizializza Firebase solo se configurato
export const getDbInstance = () => {
  const conf = getFirebaseConfig();
  if (!conf.apiKey || !conf.projectId) return null;
  try {
    const app = !getApps().length ? initializeApp(conf) : getApp();
    return getFirestore(app);
  } catch (err) {
    console.warn("Inizializzazione Firebase non riuscita:", err);
    return null;
  }
};

const DOC_PATH = ["timeline", "main"] as const;

// Salva tutti i dati su Firestore
export async function syncToFirebase(rows: TimelineRow[], events: TimelineEvent[]): Promise<boolean> {
  const db = getDbInstance();
  if (!db) return false;
  try {
    const docRef = doc(db, DOC_PATH[0], DOC_PATH[1]);
    await setDoc(docRef, { rows, events, updatedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    console.error("Errore salvataggio Firebase:", err);
    return false;
  }
}

// Sottoscrizione in tempo reale (Realtime listener con onSnapshot)
export function subscribeToFirebase(
  onUpdate: (data: TimelineData) => void,
  onError?: (error: unknown) => void
): () => void {
  const db = getDbInstance();
  if (!db) return () => {};

  try {
    const docRef = doc(db, DOC_PATH[0], DOC_PATH[1]);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.rows) && Array.isArray(data.events)) {
            onUpdate({ rows: data.rows, events: data.events });
          }
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

// Caricamento una tantum
export async function fetchFromFirebase(): Promise<TimelineData | null> {
  const db = getDbInstance();
  if (!db) return null;
  try {
    const docRef = doc(db, DOC_PATH[0], DOC_PATH[1]);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && Array.isArray(data.rows) && Array.isArray(data.events)) {
        return { rows: data.rows, events: data.events };
      }
    }
  } catch (err) {
    console.error("Errore fetch Firebase:", err);
  }
  return null;
}
