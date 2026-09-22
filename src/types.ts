import type { CSSProperties, Ref } from "react";

/** A named position on the timeline. `time` is in seconds. */
export interface Chapter {
  time: number;
  label: string;
}

export interface PlaybackOptions {
  /** Start playing the first time the player scrolls into view (falls back to muted if the browser blocks sound). */
  autoPlay: boolean;
  /** Muted state. Initial value, kept in sync if the prop changes later. */
  startMuted: boolean;
  loop: boolean;
  /** Pause when scrolled out of view and resume when it returns. */
  pauseOffscreen: boolean;
  /** Seconds to seek to once metadata loads. */
  startAt: number;
  /** Playback rate. One of 0.5 – 2 in the settings menu. */
  speed: number;
  /** 0 – 1. Initial value, kept in sync if the prop changes later. */
  volume: number;
}

export interface ChromeOptions {
  /** `floating`: rounded glass dock inset from the edges. `edge`: full-bleed controls. */
  layout: "floating" | "edge";
  /** Seconds of inactivity before the controls fade out while playing. */
  hideAfter: number;
  /** Seconds for the skip buttons, J/L and double-tap. */
  skipBy: number;
  showSkip: boolean;
  showVolume: boolean;
  volumeReveal: "always" | "hover";
  volumeWidth: number;
  showTime: boolean;
  showSettings: boolean;
  showPip: boolean;
  showFullscreen: boolean;
  /** Keyboard shortcuts when the player has focus. */
  keyboard: boolean;
  /** Double-tap the left/right third on touch screens to skip. */
  tapToSeek: boolean;
  /** Click the video surface to play/pause (mouse). */
  clickToPlay: boolean;
}

export interface LookOptions {
  /**
   * Colors are optional on purpose: when omitted, the player reads the CSS variables
   * `--nct-accent`, `--nct-panel`, `--nct-ink`, `--nct-rail`, `--nct-backdrop` from
   * the cascade (with the original Framer values as fallbacks).
   */
  accent?: string;
  panel?: string;
  ink?: string;
  rail?: string;
  backdrop?: string;
  /** Corner radius in px. */
  corner: number;
  fit: "cover" | "contain";
  /** Diameter of the big play button in px. */
  heroSize: number;
}

export interface GlowOptions {
  /** Ambient mode: a blurred copy of the video glows behind the player. */
  enabled: boolean;
  /** 0 – 1 */
  strength: number;
  /** px the glow extends beyond the player. */
  spread: number;
  /** Blur radius in px. */
  softness: number;
  /** Sampling rate in frames per second (2 – 30). */
  rate: number;
}

/** Preferences a host app may want to persist. Emitted through `onPrefsChange`. */
export interface NocturnePrefs {
  volume: number;
  muted: boolean;
  rate: number;
  ambient: boolean;
  captions: boolean;
}

/** Imperative API exposed through `ref`. */
export interface NocturneHandle {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seek to a time in seconds (no-op until metadata has loaded). */
  seek: (time: number) => void;
  /** The underlying <video> element, or null before mount. */
  readonly element: HTMLVideoElement | null;
}

export interface NocturneProps {
  /** Video URL (mp4/webm/m4v). Changing it remounts the player with fresh state. */
  src: string;
  poster?: string;
  /** WebVTT file. Must be served with CORS headers. */
  subtitles?: { src: string; lang?: string; label?: string };
  title?: string;
  eyebrow?: string;
  chapters?: readonly Chapter[];
  /** Captions on by default. */
  captions?: boolean;
  playback?: Partial<PlaybackOptions>;
  chrome?: Partial<ChromeOptions>;
  look?: Partial<LookOptions>;
  glow?: Partial<GlowOptions>;
  /** CSS aspect-ratio of the player. Default `16 / 9`. */
  aspectRatio?: string | number;
  className?: string;
  style?: CSSProperties;
  /** Called when the viewer changes volume, mute, speed, ambient mode or captions. */
  onPrefsChange?: (patch: Partial<NocturnePrefs>) => void;
  ref?: Ref<NocturneHandle>;
}
