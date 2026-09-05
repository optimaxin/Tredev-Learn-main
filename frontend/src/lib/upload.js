import api from "@/lib/api";

/**
 * Upload a file to Supabase Storage via a backend-signed URL.
 * The browser PUTs the file directly to Supabase (large files never proxy through the API).
 *
 * @param {File} file
 * @param {(pct:number)=>void} [onProgress]  0..100
 * @returns {Promise<{public_url:string, path:string}>}
 */
export async function uploadCourseMedia(file, onProgress) {
  // 1) ask the backend for a signed upload URL (service key stays server-side)
  const { data } = await api.post("/storage/sign-upload", {
    filename: file.name,
    content_type: file.type || "application/octet-stream",
  });

  // 2) PUT the file straight to Supabase Storage
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.upload_url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText?.slice(0, 200)}`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  return { public_url: data.public_url, path: data.path };
}

/**
 * Downscale + re-encode an image client-side before upload, using the browser's
 * native Canvas API — no image library needed. Cuts typical phone-camera photos
 * (3-8 MB) down to a few hundred KB, which is most of what makes the Supabase
 * free tier's 1 GB storage go further (see docs/COMMUNITY_CHAT_CHANGES.md).
 *
 * Animated GIFs are returned untouched — a canvas re-encode would flatten them
 * to a single static frame. If compressing wouldn't actually shrink the file
 * (already a small/optimized image), the original file is returned as-is.
 *
 * @param {File} file
 * @param {{maxDim?: number, quality?: number}} [opts] maxDim: longest side in px, quality: 0..1 JPEG quality
 * @returns {Promise<File>}
 */
export async function compressImage(file, { maxDim = 1600, quality = 0.82 } = {}) {
  if (file.type === "image/gif") return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // flatten transparency (PNG -> JPEG) onto white instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // compression didn't help — keep the original

    const name = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // any failure (e.g. corrupt image) — fall back to the original, let server-side validation catch it
  } finally {
    URL.revokeObjectURL(url);
  }
}
