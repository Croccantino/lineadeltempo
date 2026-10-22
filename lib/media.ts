export const MAX_IMAGE_BYTES = 600 * 1024;

const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i;

export function isDataImageUrl(value: string): boolean {
  return DATA_IMAGE_RE.test(value.trim());
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
  return safeHttpUrl(trimmed);
}

export function sanitizeLink(value: string): string {
  return safeHttpUrl(value);
}

export function resizeImageFile(
  file: File,
  maxSide = 1000,
  quality = 0.72
): Promise<string> {
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
      image.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
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

        const maxChars = Math.floor(MAX_IMAGE_BYTES * 1.37);
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        let q = quality;
        while (dataUrl.length > maxChars && q > 0.4) {
          q = Math.max(0.4, q - 0.1);
          dataUrl = canvas.toDataURL("image/jpeg", q);
        }

        if (dataUrl.length > maxChars) {
          reject(
            new Error(
              "Immagine troppo grande anche dopo la compressione. Usa un file più piccolo o un URL."
            )
          );
          return;
        }

        resolve(dataUrl);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
