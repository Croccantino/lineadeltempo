import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const resendApiKey = defineSecret("RESEND_API_KEY");
const feedbackFromEmail = defineSecret("FEEDBACK_FROM_EMAIL");
const feedbackToEmail = defineSecret("FEEDBACK_TO_EMAIL");

const ratingLabels: Record<number, string> = {
  1: "Per niente",
  2: "Poco",
  3: "Così così",
  4: "Bene",
  5: "Ottimo",
};

export const submitFeedback = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
    maxInstances: 2,
    secrets: [resendApiKey, feedbackFromEmail, feedbackToEmail],
  },
  async (request) => {
    const data: unknown = request.data;
    if (typeof data !== "object" || data === null) {
      throw new HttpsError("invalid-argument", "Dati feedback non validi.");
    }

    const { rating, suggestions } = data as {
      rating?: unknown;
      suggestions?: unknown;
    };

    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new HttpsError("invalid-argument", "Valutazione non valida.");
    }

    if (
      typeof suggestions !== "string" ||
      suggestions.length > 1200
    ) {
      throw new HttpsError("invalid-argument", "Suggerimenti non validi.");
    }

    const text = [
      `Valutazione: ${rating}/5 - ${ratingLabels[rating]}`,
      "",
      `Suggerimenti: ${suggestions.trim() || "Nessuno"}`,
    ].join("\n");

    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: feedbackFromEmail.value(),
          to: [feedbackToEmail.value()],
          subject: "Feedback - Linea del Tempo",
          text,
        }),
      });
    } catch (error) {
      console.error("Connessione al servizio email non riuscita:", error);
      throw new HttpsError(
        "unavailable",
        "Il servizio email non è raggiungibile. Riprova tra poco.",
      );
    }

    if (!response.ok) {
      console.error("Il servizio email ha rifiutato il feedback:", response.status);
      throw new HttpsError(
        "internal",
        "Il servizio email non ha accettato il feedback.",
      );
    }

    return { success: true };
  },
);
