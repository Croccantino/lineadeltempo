export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i;
const LOCAL_IMAGE_RE = /^\/images\/[A-Za-z0-9._-]+\.(webp|jpe?g|png|gif|avif)$/i;
const RTDB_IMAGE_RE = /^rtdb:[A-Za-z0-9-]+$/;

export function isDataImageUrl(value: string): boolean {
  return DATA_IMAGE_RE.test(value.trim());
}

export function isRtdbImageUrl(value: string): boolean {
  return RTDB_IMAGE_RE.test(value.trim());
}

export function getRtdbImageId(value: string): string {
  const trimmed = String(value || "").trim();
  return isRtdbImageUrl(trimmed) ? trimmed.slice(5) : "";
}

function safeHttpUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return "";
  }
  return "";
}

export function sanitizeImageUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isDataImageUrl(trimmed)) return trimmed;
  if (LOCAL_IMAGE_RE.test(trimmed)) return trimmed;
  if (isRtdbImageUrl(trimmed)) return trimmed;
  return safeHttpUrl(trimmed);
}

export function sanitizeLink(value: string): string {
  return safeHttpUrl(value);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function prepareImageFile(
  file: File,
  maxSide = 1600,
  quality = 0.82
): Promise<{ blob: Blob; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Il file selezionato non è un'immagine."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura del file non riuscita."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Immagine non valida."));
      image.onload = async () => {
        try {
          const sides = [maxSide, 1400, 1200, 1000, 800].filter(
            (side, index, list) => side <= maxSide && list.indexOf(side) === index
          );

          for (const side of sides) {
            const ratio = Math.min(1, side / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * ratio));
            const height = Math.max(1, Math.round(image.height * ratio));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas non disponibile."));
              return;
            }

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);

            for (let q = quality; q >= 0.5; q -= 0.1) {
              let blob = await canvasToBlob(canvas, "image/webp", q);
              if (!blob) blob = await canvasToBlob(canvas, "image/jpeg", q);
              if (blob && blob.size <= MAX_IMAGE_BYTES) {
                resolve({ blob, previewUrl: URL.createObjectURL(blob) });
                return;
              }
            }
          }

          reject(
            new Error(
              "Immagine troppo grande anche dopo la compressione. Usa un file più piccolo o un URL."
            )
          );
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Compressione non riuscita."));
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
