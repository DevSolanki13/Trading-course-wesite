"use client";

import {
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSimpleSlash,
  ClosedCaptioning,
  CaretDown,
  PictureInPicture,
  CornersIn,
  CornersOut,
} from "@phosphor-icons/react";

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lessonDuration?: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  speedMenuOpen: boolean;
  isFullscreen: boolean;
  captionsOn: boolean;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (v: number) => void;
  handleSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleScrubberKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  toggleCaptions: () => void;
  setSpeedMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  handleSpeedChange: (s: number) => void;
  togglePiP: () => void;
  toggleFullscreen: () => void;
  formatTime: (secs: number) => string;
}

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  lessonDuration,
  volume,
  isMuted,
  playbackSpeed,
  speedMenuOpen,
  isFullscreen,
  captionsOn,
  togglePlay,
  toggleMute,
  handleVolumeChange,
  handleSeek,
  handleScrubberKeyDown,
  toggleCaptions,
  setSpeedMenuOpen,
  handleSpeedChange,
  togglePiP,
  toggleFullscreen,
  formatTime,
}: PlayerControlsProps) {
  const effectiveDuration = duration || lessonDuration || 0;

  return (
    <div className="vlp-player-controls-overlay">
      {/* Scrubber timeline */}
      <div
        className="vlp-scrubber-track"
        onClick={handleSeek}
        onKeyDown={handleScrubberKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Video seek scrubber"
        aria-valuemin={0}
        aria-valuemax={Math.round(effectiveDuration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(effectiveDuration)}`}
      >
        <div
          className="vlp-scrubber-fill"
          style={{
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
          }}
        >
          <div className="vlp-scrubber-thumb" />
        </div>
      </div>

      {/* Bottom controls row */}
      <div className="vlp-controls-row">
        <div className="vlp-controls-left">
          {/* Play/Pause */}
          <button
            type="button"
            className="vlp-ctrl-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
          </button>

          {/* Mute/Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="vlp-ctrl-btn"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <SpeakerSimpleSlash size={18} />
              ) : (
                <SpeakerHigh size={18} />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume slider"
              style={{
                width: "55px",
                height: "4px",
                accentColor: "#00df8f",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Time display */}
          <span className="vlp-time-readout">
            {formatTime(currentTime)} /{" "}
            {duration > 0
              ? formatTime(duration)
              : lessonDuration
                ? formatTime(lessonDuration)
                : "--:--"}
          </span>
        </div>

        <div className="vlp-controls-right">
          {/* CC Toggle */}
          <button
            type="button"
            className={`vlp-ctrl-btn ${captionsOn ? "is-active" : ""}`}
            onClick={toggleCaptions}
            title={captionsOn ? "Disable captions" : "Enable captions"}
            aria-label="Toggle captions"
            aria-pressed={captionsOn}
          >
            <ClosedCaptioning size={18} weight={captionsOn ? "fill" : "regular"} />
          </button>

          {/* Speed dropdown */}
          <div className="vlp-speed-dropdown">
            <button
              type="button"
              className="vlp-speed-btn"
              onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
              aria-label="Playback speed"
            >
              <span>{playbackSpeed}x</span>
              <CaretDown size={11} />
            </button>

            {speedMenuOpen && (
              <div className="vlp-speed-menu">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`vlp-speed-option ${playbackSpeed === s ? "is-active" : ""}`}
                    onClick={() => handleSpeedChange(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          <button
            type="button"
            className="vlp-ctrl-btn"
            onClick={togglePiP}
            title="Picture-in-picture"
            aria-label="Picture in picture"
          >
            <PictureInPicture size={18} />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            className="vlp-ctrl-btn"
            onClick={toggleFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            {isFullscreen ? <CornersIn size={18} /> : <CornersOut size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
