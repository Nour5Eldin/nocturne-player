"use client";

import { AnimatePresence, m } from "framer-motion";
import { EASE, T } from "./constants";
import { IconAlert, IconAhead, IconBack, IconFilm, IconPause, IconPlay, IconReplay } from "./icons";

export type PulseKind = "play" | "pause" | "back" | "ahead" | "vol" | "rate";
export interface Pulse {
  kind: PulseKind;
  text?: string;
  /** Increments on every flash so the animation restarts. */
  n: number;
}

/** Spoken equivalent of the on-screen pulse, for the live region. */
export function pulseLabel(p: Pulse | null, skipBy: number): string {
  if (!p) return "";
  switch (p.kind) {
    case "play":
      return "Playing";
    case "pause":
      return "Paused";
    case "back":
      return `Back ${skipBy} seconds`;
    case "ahead":
      return `Forward ${skipBy} seconds`;
    case "vol":
      return `Volume ${p.text ?? ""}`;
    case "rate":
      return `Speed ${p.text ?? ""}`;
  }
}

/* Big centered play / replay button. */
export function PlayHero({ visible, size, finished, onPress }: { visible: boolean; size: number; finished: boolean; onPress: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="hero"
          className="pointer-events-none absolute inset-0 z-[4] grid place-items-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {/* Pointer-only shortcut: the dock's Play button is the accessible control, so hide this duplicate from assistive tech and the tab order. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onPress();
            }}
            className="nct-focus pointer-events-auto grid cursor-pointer place-items-center rounded-full border border-white/22 shadow-[0_18px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none"
            style={{
              width: size,
              height: size,
              background: T.accent,
              color: T.backdrop,
              paddingLeft: finished ? 0 : size * 0.05,
            }}
          >
            {finished ? <IconReplay size={size * 0.4} /> : <IconPlay size={size * 0.42} />}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/* Brief badge in the middle (or left/right third) confirming a keyboard or tap action. */
export function PulseBadge({ pulse, skipBy }: { pulse: Pulse; skipBy: number }) {
  const left = pulse.kind === "back" ? "22%" : pulse.kind === "ahead" ? "78%" : "50%";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 z-[4] -translate-x-1/2 -translate-y-1/2" style={{ left }}>
      <m.div
        className="grid h-16 min-w-16 place-items-center rounded-full bg-black/50 px-3.5 text-[13px] font-semibold text-white"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 1, 0], scale: [0.7, 1, 1.15] }}
        transition={{ duration: 0.65, times: [0, 0.3, 1], ease: "easeOut" }}
      >
        {pulse.kind === "play" && <IconPlay size={26} />}
        {pulse.kind === "pause" && <IconPause size={26} />}
        {pulse.kind === "back" && <IconBack size={26} n={skipBy} />}
        {pulse.kind === "ahead" && <IconAhead size={26} n={skipBy} />}
        {(pulse.kind === "vol" || pulse.kind === "rate") && <span>{pulse.text}</span>}
      </m.div>
    </div>
  );
}

export function BufferingSpinner() {
  return (
    <m.div
      role="status"
      aria-label="Loading"
      className="pointer-events-none absolute top-1/2 left-1/2 z-[4] -mt-[23px] -ml-[23px] size-[46px] animate-spin rounded-full border-[3px] border-white/18 motion-reduce:animate-none"
      style={{ borderTopColor: T.accent }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.2 }}
    />
  );
}

export function ErrorState() {
  return (
    <div role="alert" className="absolute inset-0 z-[5] grid place-items-center bg-black/60 p-6 text-center" style={{ color: T.ink }}>
      <div className="grid justify-items-center gap-2.5">
        <IconAlert size={32} color={T.accent} />
        <div className="text-[15px] font-semibold">This video can’t be played</div>
        <div className="text-xs opacity-70">Check the file or link and try again</div>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center opacity-70" style={{ color: T.ink }}>
      <div className="grid justify-items-center gap-2.5">
        <IconFilm size={36} />
        <div className="text-sm">Pass a video URL to the src prop</div>
      </div>
    </div>
  );
}

/* Title + eyebrow at the top of the frame. Fades with the controls once playback has started. */
export function TitleBlock({
  visible,
  title,
  eyebrow,
  tight,
  pad,
}: {
  visible: boolean;
  title?: string;
  eyebrow?: string;
  tight: boolean;
  pad: number;
}) {
  return (
    <m.div
      className="pointer-events-none absolute z-[3]"
      style={{ top: pad + 4, left: pad + 8, right: pad + 8, color: T.ink }}
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      {eyebrow && (
        <div
          className="mb-1 font-semibold tracking-[0.14em] uppercase"
          style={{ fontSize: tight ? 10 : 11, color: T.accent }}
        >
          {eyebrow}
        </div>
      )}
      {title && (
        <div
          className="truncate leading-tight font-semibold [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]"
          style={{ fontSize: tight ? 15 : 19 }}
        >
          {title}
        </div>
      )}
    </m.div>
  );
}
