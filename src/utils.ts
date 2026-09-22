import type { CSSProperties } from "react";
import type { Chapter, LookOptions } from "./types";

export const clampTo = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const whole = Math.floor(sec);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) return `${h}:${m < 10 ? `0${m}` : m}:${ss}`;
  return `${m}:${ss}`;
}

export function sortedChapters(list?: readonly Chapter[]): Chapter[] {
  return (list ?? [])
    .filter((c) => c && Number.isFinite(Number(c.time)))
    .map((c) => ({ time: Math.max(0, Number(c.time)), label: c.label || "" }))
    .sort((a, b) => a.time - b.time);
}

/** The last chapter that starts at or before `t`. `list` must be sorted. */
export function chapterAt(list: readonly Chapter[], t: number): Chapter | null {
  let hit: Chapter | null = null;
  for (const c of list) {
    if (c.time <= t) hit = c;
    else break;
  }
  return hit;
}

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Only the colors the caller actually passed become inline CSS variables, so the cascade can supply the rest. */
export function colorVars(look?: Partial<LookOptions>): CSSProperties {
  const out: Record<string, string> = {};
  if (look?.accent) out["--nct-accent"] = look.accent;
  if (look?.panel) out["--nct-panel"] = look.panel;
  if (look?.ink) out["--nct-ink"] = look.ink;
  if (look?.rail) out["--nct-rail"] = look.rail;
  if (look?.backdrop) out["--nct-backdrop"] = look.backdrop;
  return out as CSSProperties;
}
