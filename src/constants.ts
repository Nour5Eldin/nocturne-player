import type { ChromeOptions, GlowOptions, LookOptions, PlaybackOptions } from "./types";

export const RATES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const LAYOUTS = [
  { name: "Floating", value: "floating" },
  { name: "Edge", value: "edge" },
] as const;
/** Defaults copied from the Framer component's `defaultProps`. */
export const DEFAULT_PLAYBACK: PlaybackOptions = {
  autoPlay: false,
  startMuted: false,
  loop: false,
  pauseOffscreen: true,
  startAt: 0,
  speed: 1,
  volume: 0.8,
};

export const DEFAULT_CHROME: ChromeOptions = {
  layout: "floating",
  hideAfter: 2.5,
  skipBy: 10,
  showSkip: true,
  showVolume: true,
  volumeReveal: "always",
  volumeWidth: 88,
  showTime: true,
  showSettings: true,
  showPip: true,
  showFullscreen: true,
  keyboard: true,
  tapToSeek: true,
  clickToPlay: true,
};

export const DEFAULT_LOOK: Pick<LookOptions, "corner" | "fit" | "heroSize"> = {
  corner: 20,
  fit: "cover",
  heroSize: 76,
};

export const DEFAULT_GLOW: GlowOptions = {
  enabled: true,
  strength: 0.7,
  spread: 40,
  softness: 48,
  rate: 12,
};

/**
 * Color tokens. Every value is a CSS variable with the Framer default as fallback, so a
 * page can theme the player from CSS (`--nct-accent: ...`) or through the `look` prop.
 */
export const T = {
  accent: "var(--nct-accent, #F2C14E)",
  panel: "var(--nct-panel, rgba(16,16,20,0.62))",
  ink: "var(--nct-ink, #FFFFFF)",
  rail: "var(--nct-rail, rgba(255,255,255,0.2))",
  backdrop: "var(--nct-backdrop, #0B0B0E)",
} as const;

export const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];