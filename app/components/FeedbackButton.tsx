"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";

const ratings = [
  { value: 1, face: "😞", label: "Per niente" },
  { value: 2, face: "🙁", label: "Poco" },
  { value: 3, face: "😐", label: "Così così" },
  { value: 4, face: "🙂", label: "Bene" },
  { value: 5, face: "🤩", label: "Ottimo" },
] as const;

type Rating = (typeof ratings)[number]["value"];

let appCheckInitialized = false;

function initializeFeedbackBackend() {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase non è configurato per l’invio dei feedback.");
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    throw new Error("La protezione anti-spam dei feedback non è configurata.");
  }

  if (!appCheckInitialized) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  return httpsCallable<
    { rating: Rating; suggestions: string },
    { success: boolean }
  >(getFunctions(app, "europe-west1"), "submitFeedback");
}

export default function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [suggestions, setSuggestions] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isSent, setIsSent] = useState(false);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null || isSending) return;

    setIsSending(true);
    setSendError("");
    try {
      await initializeFeedbackBackend()({
        rating,
        suggestions: suggestions.trim(),
      });
      setIsSent(true);
    } catch (error) {
      console.error("Invio del feedback non riuscito:", error);
      setSendError(
        "Non siamo riusciti a inviare il feedback. Riprova tra poco.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function resetFeedback() {
    setRating(null);
    setSuggestions("");
    setIsSending(false);
    setSendError("");
    setIsSent(false);
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
        {isSent ? (
          <div className="feedback-success" role="status">
            <span className="feedback-success-icon" aria-hidden="true">
              ✓
            </span>
            <h2 id="feedback-title">Grazie per il tuo feedback!</h2>
            <p>La tua valutazione è stata inviata.</p>
            <button
              className="feedback-submit"
              type="button"
              onClick={closeDialog}
            >
              Chiudi
            </button>
          </div>
        ) : (
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

            <label
              className="feedback-suggestions"
              htmlFor="feedback-suggestions"
            >
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
              <button
                className="feedback-cancel"
                type="button"
                onClick={closeDialog}
              >
                Annulla
              </button>
              <button
                className="feedback-submit"
                type="submit"
                disabled={rating === null || isSending}
              >
                {isSending ? "Invio in corso…" : "Invia feedback"}
              </button>
            </div>
            {sendError && (
              <p className="feedback-error" role="alert">
                {sendError}
              </p>
            )}
          </form>
        )}
      </dialog>
    </>
  );
}
