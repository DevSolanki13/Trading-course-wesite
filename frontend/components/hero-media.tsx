"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { site } from "../content/site";

export function HeroMedia() {
  const video = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 900px)");
    const network = navigator as Navigator & { connection?: { saveData?: boolean } };
    const update = () =>
      setEnabled(
        !!site.heroVideoSrc && !motion.matches && desktop.matches && !network.connection?.saveData,
      );
    update();
    motion.addEventListener("change", update);
    desktop.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!enabled || !element) return;
    let visible = false;
    const syncPlayback = () => {
      if (visible && !document.hidden && !userPaused.current)
        element.play().catch(() => setPlaying(false));
      else element.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      },
      { threshold: 0.1 },
    );
    const visibility = syncPlayback;
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);
  return (
    <div className="hero-media">
      <Image
        src="/images/study-desk.png"
        alt=""
        fill
        priority
        sizes="(max-width: 899px) 100vw, 46vw"
        className="hero-photo"
      />
      {enabled && site.heroVideoSrc && (
        <video
          ref={video}
          className="hero-video"
          src={site.heroVideoSrc}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setEnabled(false)}
        />
      )}
      {enabled && (
        <button
          className="video-control icon-button"
          aria-label={playing ? "Pause background video" : "Play background video"}
          onClick={() => {
            userPaused.current = playing;
            if (playing) video.current?.pause();
            else video.current?.play().catch(() => setPlaying(false));
          }}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
      )}
      <span className="media-annotation">A quieter approach to the markets.</span>
    </div>
  );
}
