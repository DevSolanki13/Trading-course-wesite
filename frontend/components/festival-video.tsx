"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "@phosphor-icons/react";

const FestivalVideoContext = createContext<(() => void) | null>(null);
const FESTIVAL_VIDEO_SEEN_KEY = "indianxtrade-diwali-video-seen";

function FestivalVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"playing" | "blocked" | "ended" | "error">("playing");
  const finished = status === "ended" || status === "error";

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    let active = true;
    void media.play().catch(() => {
      if (active) setStatus(media.error ? "error" : "blocked");
    });
    return () => {
      active = false;
      media.pause();
    };
  }, []);

  function play() {
    void video.current?.play().catch(() => setStatus(video.current?.error ? "error" : "blocked"));
  }

  return (
    <>
      <Dialog.Title className="sr-only">Happy Diwali from indianXtrade</Dialog.Title>
      <Dialog.Description className="sr-only">
        Our opening video starts muted. Skip to the website at any time, or close the video when it
        ends. You can play it again from Happy Diwali on the homepage.
      </Dialog.Description>
      <video
        ref={video}
        className="festival-video-player"
        src="/videos/INDIAN_X_TRADE_Single_Logo_Smooth_Outro_1080p.mp4"
        aria-label="indianXtrade Diwali greeting video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onPlay={() => setStatus("playing")}
        onEnded={() => setStatus("ended")}
        onError={() => setStatus("error")}
      />
      {status === "blocked" && (
        <button type="button" className="festival-video-play" onClick={play}>
          <Play size={22} weight="fill" aria-hidden="true" />
          Play video
        </button>
      )}
      {status === "error" && (
        <p className="festival-video-error" role="alert">
          The video couldn’t load. Close this window to continue to the website.
        </p>
      )}
      {status === "ended" && (
        <p className="sr-only" role="status">
          Video ended. Close the video to continue to the website.
        </p>
      )}
      <Dialog.Close asChild>
        <button
          type="button"
          className="festival-video-close"
          aria-label={finished ? "Close video" : "Skip video"}
        >
          {finished ? <X size={22} aria-hidden="true" /> : "Skip"}
        </button>
      </Dialog.Close>
    </>
  );
}

export function FestivalVideoProvider({ children }: { children: ReactNode }) {
  // The shared layout persists during navigation. Show the greeting once per browser, then let
  // the replay button open it again on demand.
  const [open, setOpen] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (document.querySelector(".ix-checkout")) return;
    try {
      if (window.localStorage.getItem(FESTIVAL_VIDEO_SEEN_KEY) === "1") return;
    } catch {
      // Storage can be disabled by privacy settings; still show the greeting for this visit.
    }
    const frame = window.requestAnimationFrame(() => {
      try {
        window.localStorage.setItem(FESTIVAL_VIDEO_SEEN_KEY, "1");
      } catch {
        // Storage can be disabled by privacy settings; the greeting still works for this visit.
      }
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const replay = useCallback(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  return (
    <FestivalVideoContext.Provider value={replay}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="festival-video-backdrop" />
          <Dialog.Content
            className="festival-video-dialog"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.querySelector<HTMLButtonElement>(".festival-video-close")?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = previousFocus.current?.isConnected
                ? previousFocus.current
                : document.querySelector<HTMLElement>("[data-diwali-replay], .site-header a");
              target?.focus({ preventScroll: true });
            }}
          >
            {open && <FestivalVideo />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </FestivalVideoContext.Provider>
  );
}

export function DiwaliReplayButton({ children }: { children: ReactNode }) {
  const replay = useContext(FestivalVideoContext);

  return (
    <button
      type="button"
      className="diwali-greeting"
      data-diwali-replay
      aria-label="Happy Diwali — play greeting video"
      aria-haspopup="dialog"
      onClick={replay ?? undefined}
    >
      {children}
    </button>
  );
}
