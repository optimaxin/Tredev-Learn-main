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
 * @param {string} [offeringId] course id — lets the backend file this video into
 *   that course's own Bunny collection (skipped for a not-yet-saved draft course)
 * @param {(pct:number)=>void} [onProgress] 0..100
 * @returns {Promise<{video_id:string, playback_url:string}>}
 */
export async function uploadLectureVideo(file, title, offeringId, onProgress) {
  const { data } = await api.post("/lectures/video/sign", {
    title: title || file.name,
    offering_id: offeringId || undefined,
  });

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

/**
 * Get a short-lived, enrollment-checked playback URL for one lesson. The backend
 * verifies the viewer is enrolled (or staff/the course's Ācharya) before minting
 * a Bunny embed-view token — a 403 here means "not authorized to watch this".
 *
 * @param {string} offeringId
 * @param {string} lessonId
 * @returns {Promise<{provider:string, embed_url?:string, video_url?:string}>}
 */
export async function getPlaybackInfo(offeringId, lessonId) {
  const { data } = await api.get(`/offerings/${offeringId}/lessons/${lessonId}/play`);
  return data;
}

/**
 * Staff's own immediate preview right after uploading — mints a token straight
 * from the video id, no offering/lesson lookup (the lesson may not be saved yet).
 *
 * @param {string} videoId
 * @returns {Promise<string>} signed embed URL
 */
export async function getPreviewUrl(videoId) {
  const { data } = await api.get(`/lectures/video/${videoId}/preview-token`);
  return data.embed_url;
}
