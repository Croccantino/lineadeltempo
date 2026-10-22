"use client";

import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { getDbInstance } from "./firebase";
import { getRtdbImageId, isRtdbImageUrl, sanitizeImageUrl } from "./media";

export function useResolvedImage(value?: string): { src: string; loading: boolean } {
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = sanitizeImageUrl(value || "");

    if (!image) {
      setSrc("");
      setLoading(false);
      return;
    }

    if (!isRtdbImageUrl(image)) {
      setSrc(image);
      setLoading(false);
      return;
    }

    const id = getRtdbImageId(image);
    const db = getDbInstance();
    if (!db || !id) {
      setSrc("");
      setLoading(false);
      return;
    }

    setSrc("");
    setLoading(true);

    get(ref(db, `images/${id}`))
      .then((snapshot) => {
        if (cancelled) return;
        const data = snapshot.val();
        const dataUrl = typeof data === "string" ? data : data?.data;
        setSrc(typeof dataUrl === "string" ? sanitizeImageUrl(dataUrl) : "");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc("");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { src, loading };
}
