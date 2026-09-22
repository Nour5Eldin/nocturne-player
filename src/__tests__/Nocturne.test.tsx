import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Nocturne } from "../Nocturne";
import type { NocturneHandle } from "../types";

const SRC = "https://example.com/film.mp4";

const region = () => screen.getByRole("region", { name: /video player/i });
const video = () => document.querySelector("video") as HTMLVideoElement;

/** jsdom never loads media, so hand the element a duration and announce it. */
function loadMetadata(duration = 600) {
  const v = video();
  Object.defineProperty(v, "duration", { configurable: true, value: duration });
  Object.defineProperty(v, "readyState", { configurable: true, value: 4 });
  act(() => {
    v.dispatchEvent(new Event("loadedmetadata"));
  });
}

describe("<Nocturne />", () => {
  it("renders an accessible region with the video source", () => {
    render(<Nocturne src={SRC} title="Test film" />);
    expect(screen.getByRole("region", { name: "Video player: Test film" })).toBeTruthy();
    expect(video().getAttribute("src")).toBe(SRC);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
  });

  it("shows an empty state without a src", () => {
    render(<Nocturne src="" />);
    expect(screen.getByText(/pass a video url/i)).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
  });

  it("toggles playback from the keyboard and announces it", async () => {
    render(<Nocturne src={SRC} />);
    fireEvent.keyDown(region(), { key: "k" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe("Playing");

    fireEvent.keyDown(region(), { key: " " });
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeTruthy());
  });

  it("ignores shortcuts that carry a modifier key", () => {
    render(<Nocturne src={SRC} />);
    fireEvent.keyDown(region(), { key: "k", ctrlKey: true });
    expect(video().paused).toBe(true);
  });

  it("lets a focused button handle Space itself", () => {
    render(<Nocturne src={SRC} />);
    const mute = screen.getByRole("button", { name: "Mute" });
    fireEvent.keyDown(mute, { key: " " });
    expect(video().paused).toBe(true);
  });

  it("mutes with M and reflects it on the button", async () => {
    render(<Nocturne src={SRC} />);
    fireEvent.keyDown(region(), { key: "m" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy());
    expect(video().muted).toBe(true);
  });

  it("seeks with the arrow keys and the number row", () => {
    render(<Nocturne src={SRC} chrome={{ skipBy: 10 }} />);
    loadMetadata(600);
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    expect(video().currentTime).toBe(10);
    fireEvent.keyDown(region(), { key: "j" });
    expect(video().currentTime).toBe(0);
    fireEvent.keyDown(region(), { key: "5" });
    expect(video().currentTime).toBe(300);
    fireEvent.keyDown(region(), { key: "End" });
    expect(video().currentTime).toBe(600);
  });

  it("steps playback speed with > and <", async () => {
    const onPrefsChange = vi.fn();
    render(<Nocturne src={SRC} onPrefsChange={onPrefsChange} />);
    fireEvent.keyDown(region(), { key: ">" });
    expect(video().playbackRate).toBe(1.25);
    act(() => {
      video().dispatchEvent(new Event("ratechange"));
    });
    expect(onPrefsChange).toHaveBeenCalledWith({ rate: 1.25 });
    fireEvent.keyDown(region(), { key: "<" });
    fireEvent.keyDown(region(), { key: "<" });
    expect(video().playbackRate).toBe(0.75);
  });

  it("reports volume changes through onPrefsChange", () => {
    const onPrefsChange = vi.fn();
    render(<Nocturne src={SRC} onPrefsChange={onPrefsChange} />);
    const v = video();
    v.volume = 0.3;
    act(() => {
      v.dispatchEvent(new Event("volumechange"));
    });
    expect(onPrefsChange).toHaveBeenCalledWith({ volume: 0.3, muted: false });
  });

  it("opens the settings menu, changes speed, and closes on Escape", async () => {
    render(<Nocturne src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const menu = await screen.findByRole("menu", { name: "Player settings" });
    expect(menu).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5×" }));
    expect(video().playbackRate).toBe(1.5);

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Settings" }));
  });

  it("moves focus through menu items with the arrow keys", async () => {
    render(<Nocturne src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const menu = await screen.findByRole("menu");
    const items = menu.querySelectorAll<HTMLElement>('[role^="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("toggles ambient mode from the menu and reports it", async () => {
    const onPrefsChange = vi.fn();
    render(<Nocturne src={SRC} onPrefsChange={onPrefsChange} />);
    expect(document.querySelector("canvas")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /ambient/i }));
    expect(onPrefsChange).toHaveBeenCalledWith({ ambient: false });
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("lists chapters in the menu and seeks when one is chosen", async () => {
    render(<Nocturne src={SRC} chapters={[{ time: 0, label: "Intro" }, { time: 120, label: "Finale" }]} />);
    loadMetadata(600);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /finale/i }));
    expect(video().currentTime).toBe(120);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("exposes an imperative handle", () => {
    const ref = createRef<NocturneHandle>();
    render(<Nocturne ref={ref} src={SRC} />);
    loadMetadata(600);
    expect(ref.current?.element).toBe(video());
    act(() => ref.current?.seek(42));
    expect(video().currentTime).toBe(42);
    act(() => ref.current?.play());
    expect(video().paused).toBe(false);
    act(() => ref.current?.pause());
    expect(video().paused).toBe(true);
  });

  it("shows an alert when the media fails to load", () => {
    render(<Nocturne src={SRC} />);
    act(() => {
      video().dispatchEvent(new Event("error"));
    });
    expect(screen.getByRole("alert").textContent).toMatch(/can’t be played/);
  });

  it("starts over with fresh state when src changes", async () => {
    const { rerender } = render(<Nocturne src={SRC} />);
    fireEvent.keyDown(region(), { key: "k" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy());
    rerender(<Nocturne src="https://example.com/other.mp4" />);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(video().getAttribute("src")).toBe("https://example.com/other.mp4");
  });

  it("applies look colors as CSS variables only when provided", () => {
    const { container, rerender } = render(<Nocturne src={SRC} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--nct-accent")).toBe("");
    rerender(<Nocturne src={SRC} look={{ accent: "#ff0000" }} />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--nct-accent")).toBe("#ff0000");
  });

  it("catches up when metadata loaded before hydration", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "readyState");
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
    Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get: () => 90 });
    try {
      render(<Nocturne src={SRC} />);
      expect(screen.getByRole("slider", { name: "Seek" }).getAttribute("aria-valuemax")).toBe("90");
    } finally {
      if (original) Object.defineProperty(HTMLMediaElement.prototype, "readyState", original);
      else delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).readyState;
      delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).duration;
    }
  });
});
