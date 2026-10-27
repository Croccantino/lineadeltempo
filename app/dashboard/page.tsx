"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthBar from "../components/AuthBar";
import {
  deleteFeedback,
  subscribeToFeedback,
  type FeedbackEntry,
} from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

const ADMIN_EMAIL = "francesco.zompi29@gmail.com";
const RATING_FACES = ["", "😞", "🙁", "😐", "🙂", "😄"];

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
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const successPercentage = entries.length
    ? (entries.reduce((total, entry) => total + entry.rating, 0) / (entries.length * 5)) * 100
    : null;

  useEffect(() => {
    setLoading(true);
    setError("");

    return subscribeToFeedback(
      (nextEntries) => {
        setEntries(nextEntries);
        setLoading(false);
      },
      () => {
        setError("Non è stato possibile caricare le recensioni. Riprova più tardi.");
        setLoading(false);
      }
    );
  }, []);

  const handleDelete = async (entry: FeedbackEntry) => {
    if (!window.confirm("Vuoi eliminare questa recensione? L'operazione non si può annullare.")) {
      return;
    }

    setDeletingId(entry.id);
    setDeleteError("");
    try {
      await deleteFeedback(entry.id);
    } catch (deleteError) {
      console.error("Eliminazione recensione non riuscita:", deleteError);
      setDeleteError("Non è stato possibile eliminare la recensione. Verifica l'accesso come amministratore e i permessi Firebase.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Recensioni</h1>
          <p className="dashboard-intro">Le opinioni condivise dalla comunità.</p>
        </div>
        <div className="dashboard-header-actions">
          <AuthBar />
          <Link href="/" className="btn-edit-nav">
            ← Torna alla timeline
          </Link>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-summary">
          <div className="dashboard-summary-stat">
            <span className="dashboard-stat-label">Recensioni pubblicate</span>
            <strong>{entries.length}</strong>
          </div>
          <div className="dashboard-summary-stat">
            <span className="dashboard-stat-label">Percentuale media</span>
            <strong>
              {successPercentage === null
                ? "—"
                : `${successPercentage.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
            </strong>
          </div>
          <span className="dashboard-stat-icon" aria-hidden="true">★</span>
        </div>

        <div className="dashboard-list">
          <div className="dashboard-list-heading">
            <div>
              <h2>Tutte le recensioni</h2>
              <p>Le più recenti sono in cima</p>
            </div>
          </div>

          {deleteError && <p className="dashboard-message dashboard-error" role="alert">{deleteError}</p>}

          {loading ? (
            <p className="dashboard-message" role="status">Caricamento delle recensioni…</p>
          ) : error ? (
            <p className="dashboard-message dashboard-error" role="alert">{error}</p>
          ) : entries.length === 0 ? (
            <div className="dashboard-empty">
              <span aria-hidden="true">📭</span>
              <h3>Ancora nessuna recensione</h3>
              <p>Lascia la prima valutazione con il pulsante Feedback.</p>
            </div>
          ) : (
            <ul className="feedback-list">
              {entries.map((entry) => (
                <li key={entry.id} className="feedback-card">
                  <div className="feedback-card-meta">
                    <strong>Visitatore</strong>
                    <time dateTime={new Date(entry.createdAt).toISOString()}>
                      {formatDate(entry.createdAt)}
                    </time>
                  </div>
                  <div className="feedback-review-rating" aria-label={`Valutazione: ${entry.rating} su 5`}>
                    <span aria-hidden="true">{RATING_FACES[entry.rating]}</span>
                    <strong>{entry.rating}/5</strong>
                  </div>
                  {entry.message && <p>{entry.message}</p>}
                  {isAdmin && (
                    <button
                      type="button"
                      className="feedback-delete"
                      onClick={() => handleDelete(entry)}
                      disabled={deletingId === entry.id || authLoading}
                    >
                      {deletingId === entry.id ? "Eliminazione…" : "Elimina recensione"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
