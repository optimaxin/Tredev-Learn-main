import * as tus from "tus-js-client";
import api from "@/lib/api";

/**
 * Upload a lecture video straight to Bunny Stream via resumable TUS upload,
 * using a short-lived per-video signature from the backend — the real Bunny
 * API key never reaches the browser (same pattern as uploadCourseMedia's
 * signed Supabase URL).
 *
 * @param {File} file
 * @param {string} title
 * @param {(pct:number)=>void} [onProgress] 0..100
 * @returns {Promise<{video_id:string, playback_url:string}>}
 */
export async function uploadLectureVideo(file, title, onProgress) {
  const { data } = await api.post("/lectures/video/sign", { title: title || file.name });

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: data.endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: data.signature,
        AuthorizationExpire: String(data.expire),
        VideoId: data.video_id,
        LibraryId: data.library_id,
      },
      metadata: { filetype: file.type, title: title || file.name },
      onError: reject,
      onProgress: (sent, total) => onProgress && onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });

  return { video_id: data.video_id, playback_url: data.playback_url };
}
