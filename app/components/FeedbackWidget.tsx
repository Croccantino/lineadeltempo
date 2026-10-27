"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { submitFeedback } from "../../lib/firebase";

const RATINGS = [
  { value: 1, face: "😞", label: "Per niente" },
  { value: 2, face: "🙁", label: "Poco" },
  { value: 3, face: "😐", label: "Così così" },
  { value: 4, face: "🙂", label: "Bene" },
  { value: 5, face: "😄", label: "Molto bene" },
] as const;

export default function FeedbackWidget() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openDialog = () => {
    setRating(null);
    setMessage("");
    setError("");
    setSubmitted(false);
    dialogRef.current?.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const cleanMessage = message.trim();
    if (rating === null) {
      setError("Scegli una valutazione.");
      return;
    }
    if (!cleanMessage) {
      setError("Scrivi un breve commento prima di inviare.");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback(rating, cleanMessage);
      setSubmitted(true);
    } catch (submitError) {
      console.error("Invio feedback non riuscito:", submitError);
      const errorCode =
        typeof submitError === "object" && submitError !== null && "code" in submitError
          ? String(submitError.code)
          : "";

      if (errorCode.toLowerCase().includes("permission_denied")) {
        setError("Invio non autorizzato: le regole del database Firebase devono essere aggiornate.");
      } else if (
        submitError instanceof Error &&
        submitError.message.includes("Firebase non configurato")
      ) {
        setError("Invio non disponibile: Firebase non è configurato.");
      } else {
        setError("Non è stato possibile inviare la recensione. Controlla la connessione e riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="feedback-button"
        aria-haspopup="dialog"
        onClick={openDialog}
      >
        ✉ Feedback
      </button>

      <dialog
        ref={dialogRef}
        className="feedback-dialog"
        aria-labelledby="feedback-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <section className="feedback-panel">
          <div className="feedback-panel-heading">
            <div>
              <h2 id="feedback-title">Com’è stata la tua esperienza?</h2>
              <p>La valutazione e il commento saranno visibili pubblicamente.</p>
            </div>
            <button
              type="button"
              className="feedback-close"
              aria-label="Chiudi"
              onClick={closeDialog}
            >
              ×
            </button>
          </div>

          {submitted ? (
            <div className="feedback-success" role="status">
              <span aria-hidden="true">💛</span>
              <h3>Grazie per la recensione!</h3>
              <p>Il tuo feedback è stato pubblicato.</p>
              <div className="feedback-success-actions">
                <Link href="/dashboard/" className="btn-edit-nav" onClick={closeDialog}>
                  Leggi tutte le recensioni
                </Link>
                <button type="button" onClick={closeDialog}>Chiudi</button>
              </div>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={handleSubmit}>
              <fieldset className="feedback-ratings">
                <legend>Scegli una valutazione da 1 a 5</legend>
                <div className="feedback-faces">
                  {RATINGS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`feedback-face${rating === item.value ? " selected" : ""}`}
                      aria-label={`${item.value} su 5: ${item.label}`}
                      aria-pressed={rating === item.value}
                      onClick={() => {
                        setRating(item.value);
                        setError("");
                      }}
                    >
                      <span aria-hidden="true">{item.face}</span>
                      <small>{item.value}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              {rating !== null && (
                <div className="feedback-comment">
                  <label htmlFor="feedback-message">Vuoi raccontarci qualcosa?</label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Scrivi qui il tuo commento…"
                    maxLength={1200}
                    rows={4}
                    required
                    autoFocus
                  />
                  <span className="feedback-char-count">{message.length}/1200</span>
                </div>
              )}

              {error && <p className="feedback-form-error" role="alert">{error}</p>}

              {rating !== null && (
                <button type="submit" className="feedback-submit" disabled={submitting}>
                  {submitting ? "Invio in corso…" : "Invia recensione"}
                </button>
              )}
            </form>
          )}

          <Link href="/dashboard/" className="feedback-reviews-link" onClick={closeDialog}>
            Leggi le recensioni pubblicate →
          </Link>
        </section>
      </dialog>
    </>
  );
}
