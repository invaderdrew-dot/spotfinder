// Owner: Andrew (backend + reliability)
// Shrinks photos in the browser before upload: faster requests, and phone photos stay under the 8 MB limit.
// Gemini only needs enough detail to read the style, so 1024px on the long side is plenty and keeps Gemini fast.

const MAX_SIDE = 1024;
const QUALITY = 0.8;

export async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    // Already small enough: send as-is.
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // The browser can't decode it (for example HEIC in Chrome). Send the original and let the server decide.
    return file;
  }
}
