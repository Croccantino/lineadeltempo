"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isAuthActive,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
} from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

type AuthMode = "login" | "signup";

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "L'indirizzo email non è valido.",
  "auth/missing-password": "Inserisci la password.",
  "auth/user-not-found": "Nessun account registrato con questa email.",
  "auth/wrong-password": "Password errata.",
  "auth/invalid-credential": "Email o password non corretti.",
  "auth/email-already-in-use": "Esiste già un account con questa email.",
  "auth/weak-password": "La password deve contenere almeno 6 caratteri.",
  "auth/too-many-requests": "Troppi tentativi. Riprova tra qualche minuto.",
  "auth/network-request-failed": "Errore di rete. Controlla la connessione.",
  "auth/operation-not-allowed":
    "Accesso email/password non abilitato: attivalo nella Console Firebase.",
  "auth/configuration-not-found":
    "Provider di autenticazione non configurato nella Console Firebase.",
  "auth/unauthorized-domain":
    "Dominio non autorizzato: aggiungilo in Authentication → Settings → Authorized domains.",
  "auth/invalid-api-key": "Configurazione Firebase non valida.",
  "auth/user-disabled": "Questo account è stato disabilitato.",
};

function authErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code?: unknown }).code || "");
    if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  }
  if (err instanceof Error && err.message) return err.message;
  return "Operazione non riuscita. Riprova.";
}

function safeNextPath(value: string | null): string {
  if (!value) return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

export default function AuthBar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const autoOpenedRef = useRef(false);

  const [mode, setMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authReady = isAuthActive();

  const openDialog = (next: AuthMode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const resetFields = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleDialogClose = () => {
    setMode(null);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mode) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [mode]);

  useEffect(() => {
    if (user && mode) setMode(null);
  }, [user, mode]);

  useEffect(() => {
    if (autoOpenedRef.current || loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") !== "1") return;
    autoOpenedRef.current = true;
    if (!user) openDialog("login");
  }, [loading, user]);

  const cleanupQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("login");
    url.searchParams.delete("next");
    const search = url.searchParams.toString();
    window.history.replaceState(null, "", url.pathname + (search ? `?${search}` : "") + url.hash);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Inserisci l'email.");
      return;
    }
    if (!password) {
      setError("Inserisci la password.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 6) {
        setError("La password deve contenere almeno 6 caratteri.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Le password non coincidono.");
        return;
      }
    }
    if (!authReady) {
      setError("Firebase Auth non configurato. Controlla le variabili d'ambiente.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(cleanEmail, password);
      } else {
        await signInWithEmail(cleanEmail, password);
      }

      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      setMode(null);
      resetFields();
      if (next) {
        router.push(next);
      } else {
        cleanupQuery();
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signOutUser();
      cleanupQuery();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-area">
      {user ? (
        <div className="auth-session">
          <span className="auth-user" title={user.email || ""}>
            {user.email}
          </span>
          <button
            type="button"
            className="btn-logout"
            onClick={handleLogout}
            disabled={submitting}
          >
            Esci
          </button>
        </div>
      ) : (
        <div className="auth-actions" aria-busy={loading}>
          <button type="button" className="btn-login" onClick={() => openDialog("login")}>
            Login
          </button>
          <button type="button" className="btn-signup" onClick={() => openDialog("signup")}>
            Signup
          </button>
        </div>
      )}

      {!mode && error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <dialog
        ref={dialogRef}
        className="auth-dialog"
        onClose={handleDialogClose}
        aria-labelledby="auth-title"
      >
        <form onSubmit={handleSubmit} className="auth-form">
          <h2 id="auth-title">{mode === "signup" ? "Crea un account" : "Accedi"}</h2>
          <p className="auth-subtitle">
            {mode === "signup"
              ? "Registrati con email e password."
              : "Inserisci le tue credenziali per continuare."}
          </p>

          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="nome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Almeno 6 caratteri"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {mode === "signup" && (
            <>
              <label htmlFor="auth-confirm">Conferma password</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </>
          )}

          {!authReady && (
            <p className="auth-hint">
              Firebase Auth non configurato: controlla le variabili d&apos;ambiente.
            </p>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="row">
            <button type="submit" className="grow" disabled={submitting || !authReady}>
              {submitting
                ? "Attendi…"
                : mode === "signup"
                  ? "Registrati"
                  : "Accedi"}
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={submitting}>
              Annulla
            </button>
          </div>

          <p className="auth-switch">
            {mode === "signup" ? "Hai già un account?" : "Non hai un account?"}{" "}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => openDialog(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Accedi" : "Registrati"}
            </button>
          </p>
        </form>
      </dialog>
    </div>
  );
}
