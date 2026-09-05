import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { getPlaybackInfo } from "@/lib/bunny";

const WATERMARK_MOVE_MS = 15000;
const PLAYERJS_SRC = "https://iframe.mediadelivery.net/player.js";

function randomPct() {
  return { top: `${5 + Math.random() * 80}%`, left: `${5 + Math.random() * 70}%` };
}

// Bunny's player.js talks to the embedded (cross-origin) iframe over postMessage —
// it's the only supported way to read playback progress out of a bare <iframe>
// embed. Loaded once and shared across every VideoPlayer instance on the page.
let playerJsPromise = null;
function loadPlayerJs() {
  if (window.playerjs) return Promise.resolve();
  if (!playerJsPromise) {
    playerJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PLAYERJS_SRC;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return playerJsPromise;
}

/**
 * Enrollment-gated lesson video player. Fetches a short-lived Bunny embed URL
 * (or the legacy plain video_url) per lesson, overlays a watermark of the
 * viewer's own email, and — when `onWatchProgress` is given — reports how far
 * (0-100) the viewer has watched, for attendance tracking.
 */
export default function VideoPlayer({ offeringId, lessonId, className = "", onWatchProgress }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [mark, setMark] = useState(randomPct());
  const intervalRef = useRef(null);
  const iframeRef = useRef(null);
  const maxPctRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setError(null);
    maxPctRef.current = 0;
    if (!offeringId || !lessonId) return;
    getPlaybackInfo(offeringId, lessonId)
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch((e) => { if (!cancelled) setError(e?.response?.status === 403 ? "forbidden" : "error"); });
    return () => { cancelled = true; };
  }, [offeringId, lessonId]);

  useEffect(() => {
    intervalRef.current = setInterval(() => setMark(randomPct()), WATERMARK_MOVE_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Wire up watch-progress reporting once the Bunny iframe is mounted.
  useEffect(() => {
    if (!onWatchProgress || info?.provider !== "bunny") return;
    let cancelled = false;
    let player;
    loadPlayerJs().then(() => {
      if (cancelled || !iframeRef.current || !window.playerjs) return;
      player = new window.playerjs.Player(iframeRef.current);
      player.on("timeupdate", ({ seconds, duration }) => {
        if (!duration) return;
        const pct = Math.min(100, (seconds / duration) * 100);
        if (pct > maxPctRef.current) {
          maxPctRef.current = pct;
          onWatchProgress(pct);
        }
      });
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.embed_url]);

  const onLegacyTimeUpdate = (e) => {
    if (!onWatchProgress || !e.target.duration) return;
    const pct = Math.min(100, (e.target.currentTime / e.target.duration) * 100);
    if (pct > maxPctRef.current) {
      maxPctRef.current = pct;
      onWatchProgress(pct);
    }
  };

  if (error) {
    return (
      <div className={`w-full aspect-video rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm ${className}`}>
        {error === "forbidden" ? t("videoPlayer.notAuthorized") : t("videoPlayer.loadError")}
      </div>
    );
  }

  if (!info) {
    return (
      <div className={`w-full aspect-video rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div
      data-testid="video-player"
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-black ${className}`}
    >
      {info.provider === "bunny" ? (
        <iframe
          ref={iframeRef}
          src={info.embed_url}
          title="Lecture video"
          loading="lazy"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      ) : info.video_url ? (
        <video src={info.video_url} controls onTimeUpdate={onLegacyTimeUpdate} className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          {t("courseWorkspace.noVideo")}
        </div>
      )}
      {user?.email && (
        <div
          aria-hidden="true"
          data-testid="video-watermark"
          className="absolute select-none pointer-events-none text-white/40 text-xs font-mono px-2 py-1 bg-black/20 rounded"
          style={{ top: mark.top, left: mark.left, transition: "top 1s linear, left 1s linear" }}
        >
          {user.email}
        </div>
      )}
    </div>
  );
}
