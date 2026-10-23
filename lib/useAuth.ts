"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "./firebase";

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { user, loading };
}
