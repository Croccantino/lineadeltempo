import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  "https://timeline-cb4b2-default-rtdb.europe-west1.firebasedatabase.app"
).replace(/\/+$/, "");

const IMAGES_DIR = path.resolve("public/images");
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DO_COMMIT = process.argv.includes("--commit");
const DO_APPLY = process.argv.includes("--apply");

async function fetchJson(pathName, search = "") {
  const response = await fetch(`${DB_URL}/${pathName}.json${search}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GET ${pathName}: ${response.status}`);
  }
  return response.json();
}

async function putJson(pathName, value) {
  const response = await fetch(`${DB_URL}/${pathName}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PUT ${pathName}: ${response.status} ${await response.text()}`);
  }
}

async function deleteJson(pathName) {
  const response = await fetch(`${DB_URL}/${pathName}.json`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`DELETE ${pathName}: ${response.status}`);
  }
}

function parseDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:image\/(png|jpe?g|webp|gif|avif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    value.trim()
  );
  if (!match) return null;
  return Buffer.from(match[2].replace(/\s/g, ""), "base64");
}

function rtdbImageId(value) {
  if (typeof value !== "string" || !value.startsWith("rtdb:")) return "";
  const id = value.slice(5);
  return /^[A-Za-z0-9-]+$/.test(id) ? id : "";
}

const data = await fetchJson("timeline/main");
if (!data || !Array.isArray(data.events) || data.events.length === 0) {
  console.log("Nessun evento da sincronizzare.");
  process.exit(0);
}

await mkdir(IMAGES_DIR, { recursive: true });

const updates = [];
const referencedFiles = new Set();
let errors = 0;

for (const event of data.events) {
  const image = typeof event?.img === "string" ? event.img.trim() : "";

  if (image.startsWith("/images/")) {
    referencedFiles.add(path.basename(image));
    continue;
  }

  let buffer = null;
  let imageId = "";

  if (rtdbImageId(image)) {
    imageId = rtdbImageId(image);
    const record = await fetchJson(`images/${imageId}`);
    const raw = typeof record === "string" ? record : record?.data;
    buffer = parseDataUrl(raw);
    if (!buffer) {
      console.warn(`Immagine RTDB mancante per l'evento ${event.id}: ${imageId}`);
      errors += 1;
      continue;
    }
  } else if (image.startsWith("data:image/")) {
    buffer = parseDataUrl(image);
    if (!buffer) {
      console.warn(`Data URL non valido per l'evento ${event.id}`);
      errors += 1;
      continue;
    }
  } else {
    continue;
  }

  try {
    const webp = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const hash = createHash("sha256").update(webp).digest("hex").slice(0, 16);
    const filename = `${hash}.webp`;

    await writeFile(path.join(IMAGES_DIR, filename), webp);
    referencedFiles.add(filename);
    updates.push({ eventId: event.id, source: image, imageId, filename });
    console.log(`Preparata ${filename} per ${event.id}`);
  } catch (err) {
    console.error(`Errore elaborazione immagine per ${event.id}:`, err);
    errors += 1;
  }
}

const existing = await readdir(IMAGES_DIR).catch(() => []);
for (const file of existing) {
  if (!/\.webp$/i.test(file) || referencedFiles.has(file)) continue;
  await unlink(path.join(IMAGES_DIR, file));
  console.log(`Rimosso file non referenziato: ${file}`);
}

if (DO_COMMIT) {
  const status = execFileSync("git", ["status", "--porcelain", "public/images"], {
    encoding: "utf8",
  }).trim();

  if (status) {
    execFileSync("git", ["add", "-A", "public/images"], { stdio: "inherit" });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=github-actions[bot]",
        "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit",
        "-m",
        "chore(images): sincronizza immagini da Firebase",
      ],
      { stdio: "inherit" }
    );
    const branch = process.env.GITHUB_REF_NAME || "main";
    execFileSync("git", ["pull", "--rebase", "origin", branch], { stdio: "inherit" });
    execFileSync("git", ["push", "origin", `HEAD:${branch}`], { stdio: "inherit" });
    console.log(`Immagini committate e pushate su ${branch}.`);
  } else {
    console.log("Nessuna modifica ai file immagine.");
  }
}

if (DO_APPLY && updates.length > 0) {
  const latest = await fetchJson("timeline/main");
  const latestEvents = Array.isArray(latest?.events) ? latest.events : [];

  for (const update of updates) {
    const index = latestEvents.findIndex((event) => event.id === update.eventId);
    if (index < 0) continue;
    if (latestEvents[index].img !== update.source) continue;

    try {
      await putJson(`timeline/main/events/${index}/img`, `/images/${update.filename}`);
      console.log(`Aggiornato ${update.eventId} -> /images/${update.filename}`);
    } catch (err) {
      console.error(`Errore aggiornamento evento ${update.eventId}:`, err);
      errors += 1;
    }
  }
}

if (DO_APPLY) {
  const refreshed = await fetchJson("timeline/main");
  const refreshedEvents = Array.isArray(refreshed?.events) ? refreshed.events : [];
  const stillReferenced = new Set(
    refreshedEvents.map((event) => rtdbImageId(event?.img)).filter(Boolean)
  );

  const keys = (await fetchJson("images", "?shallow=true")) || {};
  for (const id of Object.keys(keys)) {
    if (stillReferenced.has(id)) continue;
    const createdAt = Number(await fetchJson(`images/${id}/createdAt`)) || 0;
    if (createdAt && Date.now() - createdAt < RETENTION_MS) continue;

    try {
      await deleteJson(`images/${id}`);
      console.log(`Rimosso nodo immagine sincronizzato: ${id}`);
    } catch (err) {
      console.error(`Errore rimozione immagine ${id}:`, err);
      errors += 1;
    }
  }
}

if (errors > 0) {
  console.error(`Completato con ${errors} errori.`);
  process.exitCode = 1;
} else {
  console.log("Sincronizzazione completata.");
}
