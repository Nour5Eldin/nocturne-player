"use client";

import { m } from "framer-motion";
import { useRef } from "react";
import type { CSSProperties, KeyboardEventHandler, PointerEvent, PointerEventHandler, ReactNode, Ref, RefObject } from "react";
import { EASE, LAYOUTS, RATES, T } from "./constants";
import { IconSpeaker } from "./icons";
import type { Chapter } from "./types";
import { clampTo, clock, cn } from "./utils";

/* ─────────────────────────── icon button ─────────────────────────── */

interface IconButtonProps {
  label: string;
  /** Shortcut key, shown in the tooltip and exposed via aria-keyshortcuts. */
  hint?: string;
  size: number;
  onClick: () => void;
  /** Tints the icon with the accent color. */
  active?: boolean;
  /** Set for toggle buttons. */
  pressed?: boolean;
  /** Set for buttons that open a menu. */
  expanded?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}

export function IconButton({ label, hint, size, onClick, active, pressed, expanded, ref, children }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-keyshortcuts={hint}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
      title={hint ? `${label} (${hint})` : label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="nct-focus grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[background-color,transform] duration-200 [-webkit-tap-highlight-color:transparent] hover:bg-white/12 active:scale-90 motion-reduce:transition-none"
      style={{ width: size, height: size, color: active ? T.accent : T.ink }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── seek rail ─────────────────────────── */

interface ProgressRailProps {
  length: number;
  at: number;
  loaded: number;
  marks: readonly Chapter[];
  peek: number | null;
  peekChapter: Chapter | null;
  dragging: boolean;
  tight: boolean;
  railRef: RefObject<HTMLDivElement | null>;
  /** Painted imperatively every animation frame while playing (no React re-render). */
  fillRef: RefObject<HTMLDivElement | null>;
  knobRef: RefObject<HTMLDivElement | null>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: () => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function ProgressRail({
  length,
  at,
  loaded,
  marks,
  peek,
  peekChapter,
  dragging,
  tight,
  railRef,
  fillRef,
  knobRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onKeyDown,
}: ProgressRailProps) {
  return (
    <div
      ref={railRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(length)}
      aria-valuenow={Math.round(at)}
      aria-valuetext={`${clock(at)} of ${clock(length)}`}
      data-drag={dragging ? "true" : "false"}
      className="nct-focus group/rail relative mx-1 flex h-4.5 cursor-pointer touch-none items-center"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <div
        className="relative h-1 w-full overflow-hidden rounded-md transition-[height] duration-150 group-hover/rail:h-1.5 group-data-[drag=true]/rail:h-1.5 motion-reduce:transition-none"
        style={{ background: T.rail }}
      >
        {/* buffered */}
        <div
          className="absolute inset-0 origin-left bg-white/30 transition-transform duration-300 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${loaded})` }}
        />
        {/* played */}
        <div ref={fillRef} className="absolute inset-0 origin-left" style={{ background: T.accent, transform: "scaleX(0)" }} />
        {/* hover preview */}
        {peek != null && length > 0 && !dragging && (
          <div className="absolute inset-y-0 left-0 bg-white/18" style={{ width: `${(peek / length) * 100}%` }} />
        )}
        {/* chapter ticks */}
        {length > 0 &&
          marks
            .filter((c) => c.time > 0 && c.time < length)
            .map((c, i) => (
              <div
                key={i}
                className="absolute inset-y-0 w-0.75"
                style={{ left: `calc(${(c.time / length) * 100}% - 1.5px)`, background: T.backdrop }}
              />
            ))}
      </div>
      <div
        ref={knobRef}
        className={cn(
          "pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_rgba(0,0,0,0.25)] transition-transform duration-150 motion-reduce:transition-none",
          tight
            ? "scale-100"
            : "scale-0 group-hover/rail:scale-100 group-focus-visible/rail:scale-100 group-data-[drag=true]/rail:scale-100",
        )}
        style={{ left: "0%", background: T.accent }}
      />
      {peek != null && length > 0 && (
        <div
          className="pointer-events-none absolute max-w-55 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-[rgba(10,10,12,0.92)] px-2.25 py-1.25 text-center text-xs font-semibold text-white tabular-nums shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
          style={{ bottom: 22, left: `clamp(40px, ${(peek / length) * 100}%, calc(100% - 40px))`, transform: "translateX(-50%)" }}
        >
          {peekChapter?.label && <div className="mb-px text-[11px] font-medium opacity-75">{peekChapter.label}</div>}
          {clock(peek)}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── volume ─────────────────────────── */

interface VolumeControlProps {
  level: number;
  quiet: boolean;
  /** false: the slider slides out on hover/focus. */
  alwaysVisible: boolean;
  width: number;
  size: number;
  glyph: number;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({ level, quiet, alwaysVisible, width, size, glyph, onSetVolume, onToggleMute }: VolumeControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const shown = quiet ? 0 : level;
  const icon = quiet || level === 0 ? 0 : level < 0.5 ? 1 : 2;

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || !r.width) return level;
    return clampTo((clientX - r.left) / r.width, 0, 1);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onSetVolume(valueAt(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onSetVolume(valueAt(e.clientX));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  return (
    <div className="group/vol flex items-center" style={{ "--nct-vol-w": `${width}px` } as CSSProperties}>
      <IconButton label={quiet ? "Unmute" : "Mute"} hint="m" size={size} onClick={onToggleMute}>
        <IconSpeaker size={glyph} level={icon} />
      </IconButton>
      <div
        className={cn(
          "overflow-hidden transition-[width,opacity,margin] duration-200 motion-reduce:transition-none",
          alwaysVisible
            ? "mr-1.5 w-(--nct-vol-w) opacity-100"
            : "w-0 opacity-0 group-hover/vol:mr-1.5 group-hover/vol:w-(--nct-vol-w) group-hover/vol:opacity-100 group-focus-within/vol:mr-1.5 group-focus-within/vol:w-(--nct-vol-w) group-focus-within/vol:opacity-100 [@media(hover:none)]:mr-1.5 [@media(hover:none)]:w-(--nct-vol-w) [@media(hover:none)]:opacity-100",
        )}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown * 100)}
          className="nct-focus flex h-6 cursor-pointer touch-none items-center px-1.5"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              onSetVolume(level + (e.key === "ArrowRight" ? 0.05 : -0.05));
            }
          }}
        >
          <div ref={trackRef} className="relative h-1 w-full rounded" style={{ background: T.rail }}>
            <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${shown * 100}%`, background: T.ink }} />
            <div
              className="absolute top-1/2 size-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${shown * 100}%`, background: T.ink }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── settings menu ─────────────────────────── */

function SheetSwitch({ label, on, onFlip }: { label: string; on: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={onFlip}
      className="nct-focus flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-2 py-2 text-[13px] text-white transition-colors hover:bg-white/10 motion-reduce:transition-none"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className="relative h-5 w-8.5 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none"
        style={{ background: on ? T.accent : "rgba(255,255,255,0.2)" }}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-200 motion-reduce:transition-none"
          style={{ left: on ? 16 : 2 }}
        />
      </span>
    </button>
  );
}

interface SettingsMenuProps {
  ref: Ref<HTMLDivElement>;
  width: number;
  tight: boolean;
  rate: number;
  onRate: (r: number) => void;
  layout: (typeof LAYOUTS)[number]["value"];
  onLayout: (l: (typeof LAYOUTS)[number]["value"]) => void;
  ambient: boolean;
  onAmbient: () => void;
  loop: boolean;
  onLoop: () => void;
  hasSubs: boolean;
  subsOn: boolean;
  onSubs: () => void;
  countdown: boolean;
  onCountdown: () => void;
  /** Show a PiP switch inside the menu (used when the dock has no room for the button). */
  pipSwitch: boolean;
  floating: boolean;
  onFloat: () => void;
  marks: readonly Chapter[];
  currentChapter: Chapter | null;
  onChapter: (time: number) => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

const SECTION = "text-[11px] tracking-[0.1em] uppercase opacity-55";

export function SettingsMenu({
  ref,
  width,
  tight,
  rate,
  onRate,
  layout,
  onLayout,
  ambient,
  onAmbient,
  loop,
  onLoop,
  hasSubs,
  subsOn,
  onSubs,
  countdown,
  onCountdown,
  pipSwitch,
  floating,
  onFloat,
  marks,
  currentChapter,
  onChapter,
  onKeyDown,
}: SettingsMenuProps) {
  return (
    <m.div
      ref={ref}
      role="menu"
      aria-label="Player settings"
      className="absolute z-10 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(14,14,18,0.94)] p-3 text-[13px] text-white shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-[20px]"
      style={{
        right: tight ? 4 : 8,
        bottom: "calc(100% + 10px)",
        width: tight ? Math.min(240, width - 24) : 260,
        maxHeight: "min(320px, 70vh)",
        transformOrigin: "bottom right",
      }}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: EASE }}
      onKeyDown={onKeyDown}
    >
      <div className={cn(SECTION, "mb-2")}>Speed</div>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {RATES.map((r) => {
          const on = rate === r;
          return (
            <button
              key={r}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              onClick={() => onRate(r)}
              className={cn(
                "nct-focus cursor-pointer rounded-full border-0 px-2.5 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none",
                !on && "bg-white/[0.07] text-white hover:bg-white/[0.14]",
              )}
              style={on ? { background: T.accent, color: T.backdrop } : undefined}
            >
              {r === 1 ? "Normal" : `${r}×`}
            </button>
          );
        })}
      </div>

      <div className={cn(SECTION, "mb-2")}>Layout</div>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {LAYOUTS.map((l) => {
          const on = layout === l.value;
          return (
            <button
              key={l.value}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              onClick={() => onLayout(l.value)}
              className={cn(
                "nct-focus cursor-pointer rounded-full border-0 px-2.5 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none",
                !on && "bg-white/[0.07] text-white hover:bg-white/[0.14]",
              )}
              style={on ? { background: T.accent, color: T.backdrop } : undefined}
            >
              {l.name}
            </button>
          );
        })}
      </div>

      <SheetSwitch label="Ambient mode" on={ambient} onFlip={onAmbient} />
      <SheetSwitch label="Loop" on={loop} onFlip={onLoop} />
      {hasSubs && <SheetSwitch label="Subtitles" on={subsOn} onFlip={onSubs} />}
      <SheetSwitch label="Show time remaining" on={countdown} onFlip={onCountdown} />
      {pipSwitch && <SheetSwitch label="Picture in picture" on={floating} onFlip={onFloat} />}

      {marks.length > 0 && (
        <>
          <div className={cn(SECTION, "mt-3 mb-1.5")}>Chapters</div>
          {marks.map((c, i) => {
            const on = currentChapter === c;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => onChapter(c.time)}
                className={cn(
                  "nct-focus flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-2 py-1.75 text-left text-[13px] transition-colors hover:bg-white/10 motion-reduce:transition-none",
                  on ? "bg-white/8" : "bg-transparent text-white",
                )}
                style={on ? { color: T.accent } : undefined}
              >
                <span className="min-w-10 opacity-60 tabular-nums">{clock(c.time)}</span>
                <span className="truncate">{c.label || `Chapter ${i + 1}`}</span>
              </button>
            );
          })}
        </>
      )}
    </m.div>
  );
}
