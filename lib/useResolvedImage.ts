"use client";

import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { getDbInstance } from "./firebase";
import { getRtdbImageId, isRtdbImageUrl, sanitizeImageUrl } from "./media";

export function useResolvedImage(value?: string): { src: string } {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    const image = sanitizeImageUrl(value || "");

    if (!image) {
      setSrc("");
      return;
    }

    if (!isRtdbImageUrl(image)) {
      setSrc(image);
      return;
    }

    const id = getRtdbImageId(image);
    const db = getDbInstance();
    if (!db || !id) {
      setSrc("");
      return;
    }

    setSrc("");

    get(ref(db, `images/${id}`))
      .then((snapshot) => {
        if (cancelled) return;
        const data = snapshot.val();
        const dataUrl = typeof data === "string" ? data : data?.data;
        setSrc(typeof dataUrl === "string" ? sanitizeImageUrl(dataUrl) : "");
      })
      .catch(() => {
        if (cancelled) return;
        setSrc("");
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { src };
}
