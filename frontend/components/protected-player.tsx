"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { PlaybackView } from "../../shared/learning";
import { learningApi } from "../lib/learning-api";

type VideoProxy = {
  currentTime: number;
  duration: number;
  paused: boolean;
  seeking: boolean;
  playbackRate: number;
  disablePictureInPicture: boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  addEventListener: (name: string, callback: () => void) => void;
  removeEventListener: (name: string, callback: () => void) => void;
};
type Player = { video: VideoProxy };
declare global {
  interface Window {
    VdoPlayer?: { getInstance: (frame: HTMLIFrameElement) => Player };
  }
}
export function ProtectedPlayer({
  playback,
  title,
  onEnded,
}: {
  playback: PlaybackView;
  title: string;
  onEnded: () => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const ended = useRef(onEnded);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [rate, setRate] = useState(1);
  const proxy = useRef<VideoProxy | null>(null);
  useEffect(() => {
    ended.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    if (!ready || !iframe.current || !window.VdoPlayer) return;
    const player = window.VdoPlayer.getInstance(iframe.current);
    const video = player.video;
    proxy.current = video;
    let active = true;
    let stopped = false;
    let sequence = playback.sequence;
    let queue = Promise.resolve();
    let resumed = false;
    const pulse = (seeking = false) => {
      if (
        !active ||
        stopped ||
        !resumed ||
        !playback.leaseId ||
        !Number.isFinite(video.currentTime)
      )
        return;
      const snapshot = {
        position: video.currentTime,
        playing: !video.paused,
        seeking: seeking || video.seeking,
        rate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
      };
      queue = queue.then(async () => {
        if (!active || stopped) return;
        try {
          await learningApi("heartbeat", {
            leaseId: playback.leaseId,
            sequence: ++sequence,
            ...snapshot,
          });
          if (active) setSaved(true);
        } catch {
          stopped = true;
          await video.pause().catch(() => {});
          if (active)
            setError(
              "Progress saving stopped. Your session may have ended or another lesson was opened. Reload the lesson to continue.",
            );
        }
      });
    };
    const initialise = () => {
      if (resumed) return;
      resumed = true;
      video.disablePictureInPicture = true;
      if (playback.position > 0) video.currentTime = playback.position;
      if (playback.autoplay) void video.play().catch(() => {});
    };
    const play = () => pulse();
    const pause = () => pulse();
    const rateChange = () => {
      if (video.playbackRate < 0.5 || video.playbackRate > 2) video.playbackRate = 1;
      setRate(video.playbackRate);
      pulse();
    };
    const seeking = () => pulse(true);
    const finish = () => {
      pulse();
      void queue.then(() => {
        if (active) ended.current();
      });
    };
    const failed = () =>
      setError(
        "Your browser could not play this protected video. Try an updated browser or reload the lesson.",
      );
    const listeners: [string, () => void][] = [
      ["loadedmetadata", initialise],
      ["play", play],
      ["pause", pause],
      ["seeking", seeking],
      ["seeked", play],
      ["ended", finish],
      ["error", failed],
      ["ratechange", rateChange],
    ];
    for (const [name, callback] of listeners) video.addEventListener(name, callback);
    const timer = setInterval(() => pulse(), 10000);
    const unload = () => {
      void video.pause().catch(() => {});
    };
    window.addEventListener("pagehide", unload);
    return () => {
      active = false;
      proxy.current = null;
      clearInterval(timer);
      window.removeEventListener("pagehide", unload);
      for (const [name, callback] of listeners) video.removeEventListener(name, callback);
      void video.pause().catch(() => {});
    };
  }, [ready, playback]);
  const params = new URLSearchParams({
    otp: playback.otp,
    playbackInfo: playback.playbackInfo,
    primaryColor: "2962FF",
    autoplay: playback.autoplay ? "true" : "false",
  });
  return (
    <>
      <Script
        src="https://player.vdocipher.com/v2/api.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() =>
          setError("Player controls could not load. Check your connection and reload.")
        }
      />
      <div
        className="learning-video"
        role="group"
        aria-label="Lesson video. Focus here and use Space to play or pause, or arrow keys to seek."
        tabIndex={0}
        onKeyDown={(event) => {
          const video = proxy.current;
          if (!video || event.target !== event.currentTarget) return;
          if (event.code === "Space") {
            event.preventDefault();
            void (video.paused ? video.play() : video.pause()).catch(() => {});
          }
          if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
            event.preventDefault();
            video.currentTime = Math.max(
              0,
              Math.min(video.duration, video.currentTime + (event.code === "ArrowRight" ? 5 : -5)),
            );
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          ref={iframe}
          title={title}
          src={`https://player.vdocipher.com/v2/?${params}`}
          allow="encrypted-media; fullscreen; autoplay"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <label className="learning-speed">
        Playback speed{" "}
        <select
          value={rate}
          onChange={(event) => {
            const next = Number(event.target.value);
            setRate(next);
            if (proxy.current) proxy.current.playbackRate = next;
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="learning-player-status" role="status">
          {playback.leaseId
            ? saved
              ? "Progress saved to your account."
              : "Progress saves while this player is open."
            : "Public preview. Sign in to save your progress."}
        </p>
      )}
      <p className="learning-caption">
        Protected online streaming · Personalised watermark · Use the player settings for speed and
        quality.
      </p>
    </>
  );
}
