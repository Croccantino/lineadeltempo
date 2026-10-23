"use client";

import React, { useEffect, useRef, useState } from "react";

const FEEDBACK_EMAIL = "francesco.zompi29@gmail.com";

export default function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) {
      setError("Scrivi un messaggio prima di inviare.");
      return;
    }

    const subject = encodeURIComponent("Feedback Linea del Tempo");
    const body = encodeURIComponent(
      `${text}\n\n---\nDa: ${name.trim() || "Anonimo"}${
        email.trim() ? `\nEmail: ${email.trim()}` : ""
      }`
    );
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    close();
  };

  return (
    <>
      <button type="button" className="feedback-btn" onClick={() => setOpen(true)}>
        Feedback
      </button>

      <dialog
        ref={dialogRef}
        className="feedback-dialog"
        onClose={close}
        aria-labelledby="feedback-title"
      >
        <form onSubmit={handleSubmit}>
          <h2 id="feedback-title">Invia un feedback</h2>
          <p className="auth-subtitle">Il messaggio verrà inviato a {FEEDBACK_EMAIL}.</p>

          <label htmlFor="feedback-name">Nome (facoltativo)</label>
          <input
            id="feedback-name"
            type="text"
            autoComplete="name"
            placeholder="Il tuo nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label htmlFor="feedback-email">Email (facoltativa)</label>
          <input
            id="feedback-email"
            type="email"
            autoComplete="email"
            placeholder="Per essere ricontattato"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="feedback-message">Messaggio</label>
          <textarea
            id="feedback-message"
            required
            maxLength={2000}
            placeholder="Scrivi qui il tuo feedback…"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError("");
            }}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="row">
            <button type="submit" className="grow">
              Invia via email
            </button>
            <button type="button" onClick={close}>
              Annulla
            </button>
          </div>

          <p className="auth-hint">
            Si aprirà il tuo programma di posta. In alternativa scrivi a{" "}
            <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>.
          </p>
        </form>
      </dialog>
    </>
  );
}
