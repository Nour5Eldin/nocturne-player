import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/*
 * jsdom has no media pipeline, no layout and no observers. These stubs give the player just
 * enough of a browser to mount, receive events and react to keyboard input.
 */

const playing = new WeakMap<HTMLMediaElement, boolean>();

Object.defineProperty(HTMLMediaElement.prototype, "paused", {
  configurable: true,
  get(this: HTMLMediaElement) {
    return !(playing.get(this) ?? false);
  },
});
HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
  playing.set(this, true);
  this.dispatchEvent(new Event("play"));
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
  playing.set(this, false);
  this.dispatchEvent(new Event("pause"));
};
HTMLCanvasElement.prototype.getContext = (() => ({ drawImage() {}, globalAlpha: 1 })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

class ImmediateIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb([{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

class FixedResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element) {
    this.cb([{ target, contentRect: { width: 800, height: 450 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  window.IntersectionObserver = ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;
  window.ResizeObserver = FixedResizeObserver as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  localStorage.clear();
});

afterEach(() => cleanup());
