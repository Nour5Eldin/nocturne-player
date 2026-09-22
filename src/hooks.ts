"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

/**
 * State that starts from `prop` and resets whenever `prop` changes (the "adjust state while
 * rendering" pattern from the React docs), so the viewer can override it in the UI without an effect.
 */
export function useSyncedState<T>(prop: T) {
  const [state, setState] = useState(prop);
  const [prev, setPrev] = useState(prop);
  if (!Object.is(prev, prop)) {
    setPrev(prop);
    setState(prop);
  }
  return [state, setState] as const;
}

/** True while at least 15% of the element is in the viewport. */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(false);
  const supported = typeof IntersectionObserver !== "undefined";
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setSeen(e.isIntersecting && e.intersectionRatio > 0.15);
      },
      { threshold: [0, 0.15, 0.5] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ref]);
  return supported ? seen : true;
}

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/** False while the browser tab is hidden. */
export function useTabShown(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

const noopSubscribe = () => () => {};

/** Picture-in-picture support. False on the server and during hydration, so markup always matches. */
export function usePipSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => !!document.pictureInPictureEnabled,
    () => false,
  );
}

/** Element width in px, tracked with ResizeObserver. `fallback` is used on the server. */
export function useBoxWidth(ref: RefObject<HTMLElement | null>, fallback = 800): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.round(e.contentRect.width));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
