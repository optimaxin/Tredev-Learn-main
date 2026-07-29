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
