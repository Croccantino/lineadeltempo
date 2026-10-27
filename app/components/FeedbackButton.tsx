"use client";

import { useRef, useState, type FormEvent } from "react";

const ratings = [
  { value: 1, face: "😞", label: "Per niente" },
  { value: 2, face: "🙁", label: "Poco" },
  { value: 3, face: "😐", label: "Così così" },
  { value: 4, face: "🙂", label: "Bene" },
  { value: 5, face: "🤩", label: "Ottimo" },
] as const;

type Rating = (typeof ratings)[number]["value"];

export default function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [suggestions, setSuggestions] = useState("");

  const selectedRating = ratings.find((option) => option.value === rating);
  const emailBody = [
    `Valutazione: ${rating}/5${selectedRating ? ` - ${selectedRating.label}` : ""}`,
    "",
    `Suggerimenti: ${suggestions.trim() || "Nessuno"}`,
  ].join("\n");
  const mailtoHref = `mailto:francesco.zompi29@gmail.com?subject=${encodeURIComponent(
    "Feedback - Linea del Tempo",
  )}&body=${encodeURIComponent(emailBody)}`;

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) return;
    window.location.href = mailtoHref;
  }

  function resetFeedback() {
    setRating(null);
    setSuggestions("");
  }

  return (
    <>
      <button className="feedback-button" type="button" onClick={openDialog}>
        ✉ Lascia un feedback
      </button>
      <dialog
        ref={dialogRef}
        className="feedback-dialog"
        aria-labelledby="feedback-title"
        onClose={resetFeedback}
      >
        <form className="feedback-form" onSubmit={sendFeedback}>
          <div className="feedback-dialog-heading">
            <div>
              <p className="feedback-eyebrow">La tua opinione conta</p>
              <h2 id="feedback-title">Com’è stata la tua esperienza?</h2>
            </div>
            <button
              className="feedback-close"
              type="button"
              aria-label="Chiudi"
              onClick={closeDialog}
            >
              ×
            </button>
          </div>

          <fieldset className="feedback-rating">
            <legend>Scegli una valutazione da 1 a 5</legend>
            <div className="feedback-rating-options">
              {ratings.map((option) => (
                <button
                  key={option.value}
                  className="feedback-rating-option"
                  type="button"
                  aria-label={`${option.label}, ${option.value} su 5`}
                  aria-pressed={rating === option.value}
                  onClick={() => setRating(option.value)}
                >
                  <span aria-hidden="true">{option.face}</span>
                  <span>{option.value}</span>
                </button>
              ))}
            </div>
            <div className="feedback-rating-labels" aria-hidden="true">
              <span>Per niente</span>
              <span>Ottimo</span>
            </div>
          </fieldset>

          <label className="feedback-suggestions" htmlFor="feedback-suggestions">
            Consigli o suggerimenti <span>(facoltativi)</span>
          </label>
          <textarea
            id="feedback-suggestions"
            value={suggestions}
            onChange={(event) => setSuggestions(event.target.value)}
            placeholder="C’è qualcosa che potremmo migliorare?"
            maxLength={1200}
            rows={4}
          />

          <div className="feedback-dialog-actions">
            <button className="feedback-cancel" type="button" onClick={closeDialog}>
              Annulla
            </button>
            <button className="feedback-submit" type="submit" disabled={rating === null}>
              Apri l’email
            </button>
          </div>
          <p className="feedback-email-note">
            Si aprirà il programma email con il messaggio già compilato.
          </p>
        </form>
      </dialog>
    </>
  );
}
