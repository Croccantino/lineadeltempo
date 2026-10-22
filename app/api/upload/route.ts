import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_IMAGE_BYTES } from "../../../lib/media";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function databaseUrl(): string {
  return (
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    ""
  ).replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const dbUrl = databaseUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { error: "Database non configurato. Controlla le variabili d'ambiente Firebase." },
      { status: 500 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File immagine mancante." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato non supportato. Usa JPEG, PNG, WebP, GIF o AVIF." },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "L'immagine supera il limite di 2 MB." },
        { status: 413 }
      );
    }

    const id = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const response = await fetch(`${dbUrl}/images/${id}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: dataUrl,
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Errore salvataggio immagine su RTDB:", response.status, details);
      return NextResponse.json(
        { error: "Salvataggio dell'immagine non riuscito." },
        { status: 502 }
      );
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("Errore upload immagine:", err);
    return NextResponse.json({ error: "Upload immagine non riuscito." }, { status: 500 });
  }
}
