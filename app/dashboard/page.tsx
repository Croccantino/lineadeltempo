"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthBar from "../components/AuthBar";
import { subscribeToFeedback, type FeedbackEntry } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

const ADMIN_EMAIL = "francesco.zompi29@gmail.com";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export default function FeedbackDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading || !isAdmin) return;

    setLoading(true);
    setError("");

    return subscribeToFeedback(
      (nextEntries) => {
        setEntries(nextEntries);
        setLoading(false);
      },
      () => {
        setError("Non è stato possibile caricare i feedback. Verifica la configurazione e i permessi Firebase.");
        setLoading(false);
      }
    );
  }, [authLoading, isAdmin]);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Linea del Tempo</p>
          <h1>Dashboard feedback</h1>
          <p className="dashboard-intro">I messaggi inviati dagli utenti compariranno qui.</p>
        </div>
        <Link href="/" className="btn-edit-nav">
          ← Torna alla timeline
        </Link>
      </header>

      <section className="dashboard-content">
        {authLoading ? (
          <div className="dashboard-panel" role="status">Verifica accesso…</div>
        ) : !isAdmin ? (
          <div className="dashboard-panel dashboard-access">
            <span className="dashboard-icon" aria-hidden="true">🔒</span>
            <h2>Area riservata</h2>
            <p>Accedi con l’account autorizzato per consultare i feedback.</p>
            <AuthBar />
          </div>
        ) : (
          <>
            <div className="dashboard-summary">
              <div>
                <span className="dashboard-stat-label">Feedback ricevuti</span>
                <strong>{entries.length}</strong>
              </div>
              <span className="dashboard-stat-icon" aria-hidden="true">✉</span>
            </div>

            <div className="dashboard-list">
              <div className="dashboard-list-heading">
                <div>
                  <h2>Posta in arrivo</h2>
                  <p>Più recenti per primi</p>
                </div>
                <AuthBar />
              </div>

              {loading ? (
                <p className="dashboard-message" role="status">Caricamento dei feedback…</p>
              ) : error ? (
                <p className="dashboard-message dashboard-error" role="alert">{error}</p>
              ) : entries.length === 0 ? (
                <div className="dashboard-empty">
                  <span aria-hidden="true">📭</span>
                  <h3>Nessun feedback ancora</h3>
                  <p>I nuovi messaggi saranno visibili qui quando il pulsante Feedback verrà collegato alla raccolta.</p>
                </div>
              ) : (
                <ul className="feedback-list">
                  {entries.map((entry) => (
                    <li key={entry.id} className="feedback-card">
                      <div className="feedback-card-meta">
                        <strong>{entry.name || entry.email || "Utente"}</strong>
                        <time dateTime={new Date(entry.createdAt).toISOString()}>
                          {formatDate(entry.createdAt)}
                        </time>
                      </div>
                      {entry.email && entry.name && (
                        <a className="feedback-sender" href={`mailto:${encodeURIComponent(entry.email)}`}>
                          {entry.email}
                        </a>
                      )}
                      <p>{entry.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
