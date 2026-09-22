"use client";

import "./nocturne.css";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { DEFAULT_CHROME, DEFAULT_GLOW, DEFAULT_LOOK, DEFAULT_PLAYBACK, EASE, RATES, T } from "./constants";
import { IconButton, ProgressRail, SettingsMenu, VolumeControl } from "./controls";
import { useBoxWidth, useOnScreen, usePipSupported, useSyncedState, useTabShown } from "./hooks";
import { IconAhead, IconBack, IconCaptions, IconExpand, IconPause, IconPip, IconPlay, IconTune } from "./icons";
import { BufferingSpinner, EmptyState, ErrorState, PlayHero, PulseBadge, TitleBlock, pulseLabel } from "./overlays";
import type { Pulse, PulseKind } from "./overlays";
import type { NocturneProps } from "./types";
import { chapterAt, clampTo, clock, colorVars, cn, sortedChapters } from "./utils";

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Play; if the browser refuses (autoplay policy), retry muted. */
function playSafely(v: HTMLVideoElement) {
  Promise.resolve(v.play()).catch(() => {
    v.muted = true;
    Promise.resolve(v.play()).catch(() => {});
  });
}

/**
 * Nocturne — video player with ambient glow, chapters, captions, PiP and full keyboard control.
 * Ported from the Framer component of the same name.
 *
 * Client component. The server renders the poster-less shell with the controls visible; the
 * browser starts loading metadata straight away and the player catches up on hydration.
 */
export function Nocturne(props: NocturneProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        {/* Keyed by src: a new source gets fresh state instead of a hand-written reset effect. */}
        <Theatre key={props.src} {...props} />
      </MotionConfig>
    </LazyMotion>
  );
}

function Theatre(props: NocturneProps) {
  const {
    src,
    poster = "",
    title,
    eyebrow,
    subtitles,
    chapters,
    captions,
    aspectRatio,
    className,
    style,
    onPrefsChange,
    ref,
    playback: playbackProp,
    chrome: chromeProp,
    look: lookProp,
    glow: glowProp,
  } = props;
  const playback = { ...DEFAULT_PLAYBACK, ...playbackProp };
  const chrome = { ...DEFAULT_CHROME, ...chromeProp };
  const look = { ...DEFAULT_LOOK, ...lookProp };
  const glow = { ...DEFAULT_GLOW, ...glowProp };
  const marks = useMemo(() => sortedChapters(chapters), [chapters]);
  const hasSubs = !!subtitles?.src;

  /* ── refs ── */
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const haloRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef(0);
  const raf = useRef(false); // true while the rAF progress loop is painting
  const heldByScroll = useRef(false);
  const autoStarted = useRef(false);

  /* ── environment ── */
  const onScreen = useOnScreen(shellRef);
  const tabShown = useTabShown();
  const calm = useReducedMotion() ?? false;
  const width = useBoxWidth(shellRef);
  const pipAllowed = usePipSupported();
  const tight = width < 520;
  const tiny = width < 360;

  /* ── state ── */
  const [running, setRunning] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [finished, setFinished] = useState(false);
  const [broken, setBroken] = useState(false);
  const [length, setLength] = useState(0);
  const [at, setAt] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [quiet, setQuiet] = useState(!!playback.startMuted);
  const [level, setLevel] = useState(clampTo(playback.volume, 0, 1));
  const [rate, setRate] = useSyncedState<number>(playback.speed || 1);
  const [looping, setLooping] = useSyncedState(!!playback.loop);
  const [subsOn, setSubsOn] = useSyncedState(!!captions);
  const [lit, setLit] = useSyncedState(!!glow.enabled);
  const [countdown, setCountdown] = useState(false);
  const [chromeUp, setChromeUp] = useState(true);
  const [menu, setMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [peek, setPeek] = useState<number | null>(null);
  const [whole, setWhole] = useState(false);
  const [floating, setFloating] = useState(false);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [touched, setTouched] = useState(false);

  /** Latest values for handlers and timers that outlive a render. */
  const live = useRef({ length, dragging, running, touched, menu, chromeUp, hideAfter: chrome.hideAfter });
  useLayoutEffect(() => {
    live.current = { length, dragging, running, touched, menu, chromeUp, hideAfter: chrome.hideAfter };
  });

  /* ── ambient glow ── */
  const sample = useCallback(
    (mix: number) => {
      const c = haloRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const v = videoRef.current;
      const still = stillRef.current;
      ctx.globalAlpha = mix;
      try {
        if (v && v.readyState >= 2 && (live.current.touched || !still)) ctx.drawImage(v, 0, 0, c.width, c.height);
        else if (still && still.complete && still.naturalWidth) ctx.drawImage(still, 0, 0, c.width, c.height);
      } catch {
        /* frame not readable yet */
      }
      ctx.globalAlpha = 1;
    },
    [live],
  );

  // Until the first play, tint the glow from the poster.
  useEffect(() => {
    stillRef.current = null;
    if (!lit || !poster) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      stillRef.current = img;
      if (!live.current.touched) sample(1);
    };
    img.src = poster;
    return () => {
      img.onload = null;
    };
  }, [lit, poster, sample, live]);

  useEffect(() => {
    if (lit) sample(1);
  }, [lit, sample]);

  // Sample the video into the tiny canvas while it plays, is on screen and the tab is visible.
  useEffect(() => {
    if (!lit || !src || calm || !running || !onScreen || !tabShown) return;
    let alive = true;
    let handle = 0;
    let prev = 0;
    const gap = 1000 / clampTo(glow.rate || 12, 2, 30);
    const step = (ts: number) => {
      if (!alive) return;
      if (ts - prev >= gap) {
        prev = ts;
        sample(0.28);
      }
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(handle);
    };
  }, [lit, src, calm, running, onScreen, tabShown, glow.rate, sample]);

  /* ── progress painting (no React re-render) ── */
  const paint = useCallback(
    (t: number) => {
      const d = live.current.length;
      const frac = d > 0 ? clampTo(t / d, 0, 1) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`;
      if (knobRef.current) knobRef.current.style.left = `${frac * 100}%`;
    },
    [live],
  );

  // rAF loop runs only while playing + visible + tab shown + motion allowed.
  useEffect(() => {
    if (!onScreen || !tabShown || calm || !running || dragging) return;
    let handle = 0;
    const step = () => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      paint(v.currentTime);
      handle = requestAnimationFrame(step);
    };
    raf.current = true;
    handle = requestAnimationFrame(step);
    return () => {
      raf.current = false;
      cancelAnimationFrame(handle);
    };
  }, [onScreen, tabShown, calm, running, dragging, paint]);

  /* ── chrome auto-hide ── */
  const scheduleHide = useCallback(() => {
    clearTimeout(idleTimer.current);
    const v = videoRef.current;
    if (!v || v.paused || v.ended) return;
    const delay = Math.max(0.8, live.current.hideAfter || 2.5) * 1000;
    idleTimer.current = setTimeout(() => {
      if (live.current.menu || live.current.dragging) return;
      setChromeUp(false);
    }, delay);
  }, [live]);

  const wake = useCallback(() => {
    setChromeUp(true);
    scheduleHide();
  }, [scheduleHide]);

  const closeMenu = useCallback(() => {
    setMenu(false);
    wake();
  }, [wake]);

  const flash = useCallback((kind: PulseKind, text?: string) => {
    setPulse((prev) => ({ kind, text, n: (prev?.n ?? 0) + 1 }));
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(null), 650);
  }, []);

  /* ── player actions ── */
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    setTouched(true);
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      playSafely(v);
      flash("play");
    } else {
      v.pause();
      flash("pause");
    }
  }, [src, flash]);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = clampTo(t, 0, v.duration);
      setAt(v.currentTime);
      paint(v.currentTime);
    },
    [paint, setAt],
  );

  const jump = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = clampTo(v.currentTime + delta, 0, v.duration);
      paint(v.currentTime);
      flash(delta < 0 ? "back" : "ahead", `${Math.abs(delta)}s`);
      wake();
    },
    [flash, paint, wake],
  );

  const setVol = useCallback((x: number) => {
    const v = videoRef.current;
    if (!v) return;
    const n = clampTo(x, 0, 1);
    v.volume = n;
    v.muted = n === 0;
  }, []);

  const flipMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.6;
    } else {
      v.muted = true;
    }
  }, []);

  const applyRate = useCallback(
    (r: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = r;
      setRate(r);
    },
    [setRate],
  );

  const flipWhole = useCallback(() => {
    const d = document as FsDocument;
    const shell = shellRef.current as FsElement | null;
    const v = videoRef.current as FsVideo | null;
    if (!shell) return;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
      return;
    }
    const ask = shell.requestFullscreen || shell.webkitRequestFullscreen;
    if (ask) {
      const r = ask.call(shell);
      if (r && r.catch) r.catch(() => {});
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen(); // iPhone Safari: native fullscreen only
    }
  }, []);

  const flipFloat = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(() => {});
  }, []);

  const toggleAmbient = () => {
    const next = !lit;
    setLit(next);
    onPrefsChange?.({ ambient: next });
  };
  const toggleCaptions = () => {
    const next = !subsOn;
    setSubsOn(next);
    onPrefsChange?.({ captions: next });
  };

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        const v = videoRef.current;
        if (v) playSafely(v);
      },
      pause: () => videoRef.current?.pause(),
      toggle,
      seek: seekTo,
      get element() {
        return videoRef.current;
      },
    }),
    [toggle, seekTo],
  );

  /* ── side effects that only touch the DOM ── */
  // Pause when scrolled away, resume on return, and autoplay on first view.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (onScreen && tabShown) {
      if (heldByScroll.current) {
        heldByScroll.current = false;
        v.play().catch(() => {});
      } else if (playback.autoPlay && !autoStarted.current) {
        autoStarted.current = true;
        playSafely(v);
      }
    } else if (!onScreen && playback.pauseOffscreen && !v.paused && !document.pictureInPictureElement) {
      heldByScroll.current = true;
      v.pause();
    }
  }, [onScreen, tabShown, src, playback.autoPlay, playback.pauseOffscreen]);

  // Props that may change after mount.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playback.speed || 1;
  }, [playback.speed]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !!playback.startMuted;
  }, [playback.startMuted]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = clampTo(playback.volume, 0, 1);
  }, [playback.volume]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      const track = v.textTracks[i];
      if (track) track.mode = subsOn ? "showing" : "hidden";
    }
  }, [subsOn, subtitles?.src]);

  useEffect(() => {
    const sync = () => {
      const d = document as FsDocument;
      const el = d.fullscreenElement || d.webkitFullscreenElement;
      setWhole(!!el && el === shellRef.current);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => setFloating(true);
    const off = () => setFloating(false);
    v.addEventListener("enterpictureinpicture", on);
    v.addEventListener("leavepictureinpicture", off);
    return () => {
      v.removeEventListener("enterpictureinpicture", on);
      v.removeEventListener("leavepictureinpicture", off);
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(idleTimer.current);
      clearTimeout(pulseTimer.current);
      clearTimeout(tapTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!onScreen) clearTimeout(idleTimer.current);
  }, [onScreen]);

  // Settings menu: dismiss on outside press, and move focus in when it opens.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return;
      setMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  /* ── media events ── */
  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setLength(d);
    live.current.length = d;
    if (playback.startAt > 0 && v.currentTime < 0.1 && playback.startAt < v.duration) v.currentTime = playback.startAt;
    v.playbackRate = rate;
    v.volume = clampTo(playback.volume, 0, 1);
    v.muted = !!playback.startMuted;
    setQuiet(v.muted);
    setLevel(v.volume);
    paint(v.currentTime);
  };

  // The server-rendered <video> starts loading before React hydrates, so its
  // loadedmetadata / error events can fire with nobody listening. Catch up once on mount.
  const metaRef = useRef(onMeta);
  useLayoutEffect(() => {
    metaRef.current = onMeta;
  });
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.readyState >= 1) metaRef.current();
    if (v.error) setBroken(true);
  }, [metaRef]);

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    setAt(v.currentTime);
    if (!raf.current && !live.current.dragging) paint(v.currentTime);
  };

  const onBuffer = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length || !Number.isFinite(v.duration) || v.duration === 0) return;
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime + 0.5) end = Math.max(end, v.buffered.end(i));
    }
    setLoaded(clampTo(end / v.duration, 0, 1));
  };

  /* ── input handlers ── */
  const skipN = Math.round(chrome.skipBy || 10);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!chrome.keyboard || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    // A focused button handles Space itself (Mute, Settings...) instead of toggling playback.
    if (k === " " && e.target !== e.currentTarget && (e.target as HTMLElement).closest("button")) return;
    let used = true;
    switch (k) {
      case " ":
      case "k":
      case "K":
        toggle();
        break;
      case "ArrowLeft":
      case "j":
      case "J":
        jump(-skipN);
        break;
      case "ArrowRight":
      case "l":
      case "L":
        jump(skipN);
        break;
      case "ArrowUp":
      case "ArrowDown": {
        const next = clampTo(level + (k === "ArrowUp" ? 0.05 : -0.05), 0, 1);
        setVol(next);
        flash("vol", `${Math.round(next * 100)}%`);
        break;
      }
      case "m":
      case "M":
        flipMute();
        break;
      case "f":
      case "F":
        flipWhole();
        break;
      case "a":
      case "A":
        toggleAmbient();
        break;
      case "c":
      case "C":
        if (hasSubs) toggleCaptions();
        break;
      case "Home":
        seekTo(0);
        break;
      case "End":
        seekTo(length);
        break;
      case ">":
      case "<": {
        const i = RATES.indexOf(rate);
        const next = RATES[clampTo((i < 0 ? 2 : i) + (k === ">" ? 1 : -1), 0, RATES.length - 1)] ?? rate;
        applyRate(next);
        flash("rate", `${next}×`);
        break;
      }
      case "Escape":
        if (menu) {
          closeMenu();
          menuBtnRef.current?.focus();
        } else used = false;
        break;
      default:
        if (/^[0-9]$/.test(k) && length > 0) seekTo((Number(k) / 10) * length);
        else used = false;
    }
    if (used) {
      e.preventDefault();
      e.stopPropagation();
      wake();
    }
  };

  // Mouse click = play/pause. Touch: tap reveals or hides controls, double-tap a side third to skip.
  const onSurfaceUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!src || broken) return;
    if (e.pointerType === "mouse") {
      if (chrome.clickToPlay) toggle();
      return;
    }
    const now = performance.now();
    const box = e.currentTarget.getBoundingClientRect();
    const zone = (e.clientX - box.left) / box.width;
    if (chrome.tapToSeek && now - lastTap.current < 300 && (zone < 0.34 || zone > 0.66)) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      jump(zone < 0.34 ? -skipN : skipN);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(
      () => {
        if (!live.current.running) toggle();
        else if (live.current.chromeUp) setChromeUp(false);
        else wake();
      },
      chrome.tapToSeek ? 260 : 0,
    );
  };

  const railFrac = (clientX: number) => {
    const r = railRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return clampTo((clientX - r.left) / r.width, 0, 1);
  };
  const railDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!length) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const t = railFrac(e.clientX) * length;
    setPeek(t);
    seekTo(t);
  };
  const railMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!length) return;
    const t = railFrac(e.clientX) * length;
    setPeek(t);
    if (live.current.dragging) seekTo(t);
  };
  const railUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!live.current.dragging) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDragging(false);
    if (e.pointerType !== "mouse") setPeek(null);
    wake();
  };
  const railKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      jump(e.key === "ArrowLeft" ? -5 : 5);
    }
  };

  // Arrow-key roving focus inside the settings menu.
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      menuBtnRef.current?.focus();
      return;
    }
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    items[next]?.focus();
  };

  /* ── derived ── */
  const current = chapterAt(marks, at);
  const peekChapter = peek != null ? chapterAt(marks, peek) : null;
  const showChrome = chromeUp || !running || menu || dragging;
  const hideCursor = running && !chromeUp && !menu;
  const floatingDock = chrome.layout === "floating";
  const inset = chrome.layout === "edge" ? 0 : tight ? 8 : 14;
  const pad = tight ? 8 : 12;
  const btn = tight ? 34 : 38;
  const glyph = tight ? 18 : 20;
  const hero = tight ? look.heroSize * 0.78 : look.heroSize;
  const heroVisible = !!src && !broken && (!running || finished) && !stalled;
  const spread = Math.max(0, glow.spread || 0);
  const volW = Math.round(clampTo(chrome.volumeWidth || 88, 40, 200) * (tiny ? 0.55 : tight ? 0.77 : 1));

  return (
    <div
      className={cn("nocturne-player relative isolate w-full", className)}
      style={
        {
          aspectRatio: aspectRatio ?? "16 / 9",
          "--nct-cue-size": `${tight ? 15 : 19}px`,
          ...colorVars(lookProp),
          ...style,
        } as CSSProperties
      }
    >
      {lit && src && !broken && (
        <m.canvas
          ref={haloRef}
          width={48}
          height={27}
          aria-hidden="true"
          className="pointer-events-none absolute z-0 transform-gpu"
          style={{
            top: -spread,
            left: -spread,
            width: `calc(100% + ${spread * 2}px)`,
            height: `calc(100% + ${spread * 2}px)`,
            filter: `blur(${Math.max(0, glow.softness)}px) saturate(1.35)`,
            borderRadius: look.corner + spread,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: whole ? 0 : clampTo(glow.strength, 0, 1) }}
          transition={{ duration: 0.6 }}
        />
      )}

      <div
        ref={shellRef}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        tabIndex={0}
        className="nct-shell relative isolate z-1 size-full touch-manipulation overflow-hidden select-none"
        style={{ borderRadius: whole ? 0 : look.corner, background: T.backdrop, cursor: hideCursor ? "none" : "default" }}
        onKeyDown={onKey}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") wake();
        }}
        onPointerLeave={() => {
          if (running && !menu && !dragging) {
            clearTimeout(idleTimer.current);
            setChromeUp(false);
          }
          if (!dragging) setPeek(null);
        }}
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster || undefined}
            playsInline
            preload="metadata"
            loop={looping}
            crossOrigin={hasSubs ? "anonymous" : undefined}
            className="absolute inset-0 block size-full"
            style={{ objectFit: look.fit, background: T.backdrop }}
            onLoadedMetadata={onMeta}
            onDurationChange={onMeta}
            onTimeUpdate={onTime}
            onProgress={onBuffer}
            onPlay={() => {
              setRunning(true);
              setFinished(false);
              setTouched(true);
              wake();
            }}
            onPause={() => {
              setRunning(false);
              clearTimeout(idleTimer.current);
              if (lit) sample(1);
            }}
            onWaiting={() => setStalled(true)}
            onPlaying={() => setStalled(false)}
            onCanPlay={() => setStalled(false)}
            onSeeked={() => {
              onBuffer();
              if (lit) sample(1);
            }}
            onLoadedData={() => {
              if (lit && (touched || !poster)) sample(1);
            }}
            onEnded={() => {
              setRunning(false);
              setFinished(true);
            }}
            onVolumeChange={() => {
              const v = videoRef.current;
              if (!v) return;
              setQuiet(v.muted);
              setLevel(v.volume);
              onPrefsChange?.({ volume: v.volume, muted: v.muted });
            }}
            onRateChange={() => {
              const v = videoRef.current;
              if (!v) return;
              setRate(v.playbackRate);
              onPrefsChange?.({ rate: v.playbackRate });
            }}
            onError={() => {
              setBroken(true);
              setStalled(false);
            }}
          >
            {hasSubs && (
              <track
                kind="subtitles"
                src={subtitles.src}
                srcLang={subtitles.lang ?? "en"}
                label={subtitles.label ?? subtitles.lang ?? "Subtitles"}
              />
            )}
          </video>
        ) : (
          <EmptyState />
        )}

        {/* click / tap surface */}
        <div
          className="absolute inset-0 z-1"
          onPointerUp={onSurfaceUp}
          onDoubleClick={(e) => {
            if (chrome.showFullscreen) {
              e.preventDefault();
              flipWhole();
            }
          }}
        />

        {/* top + bottom scrims */}
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-2 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_26%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.6)_100%)]"
          initial={false}
          animate={{ opacity: showChrome && src ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />

        {(title || eyebrow) && (
          <TitleBlock visible={showChrome || !touched} title={title} eyebrow={eyebrow} tight={tight} pad={pad} />
        )}

        <PlayHero visible={heroVisible} size={hero} finished={finished} onPress={toggle} />

        <AnimatePresence>{stalled && !broken && src && <BufferingSpinner key="spinner" />}</AnimatePresence>

        {broken && <ErrorState />}

        {pulse && !calm && (running || pulse.kind !== "play") && <PulseBadge key={pulse.n} pulse={pulse} skipBy={skipN} />}

        {/* announcements for assistive tech */}
        <span role="status" className="sr-only">
          {pulseLabel(pulse, skipN)}
        </span>

        {src && !broken && (
          <m.div
            className="absolute z-6"
            style={{
              left: inset,
              right: inset,
              bottom: inset,
              padding: floatingDock ? `${tight ? 8 : 10}px ${pad}px ${tight ? 4 : 6}px` : `0 ${pad + 4}px ${tight ? 6 : 10}px`,
              borderRadius: floatingDock ? Math.min(look.corner + 4, 26) : 0,
              background: floatingDock ? T.panel : "transparent",
              backdropFilter: floatingDock ? "blur(18px) saturate(1.4)" : undefined,
              WebkitBackdropFilter: floatingDock ? "blur(18px) saturate(1.4)" : undefined,
              border: floatingDock ? "1px solid rgba(255,255,255,0.1)" : "none",
              boxShadow: floatingDock ? "0 10px 40px rgba(0,0,0,0.35)" : "none",
              color: T.ink,
              pointerEvents: showChrome ? "auto" : "none",
            }}
            initial={false}
            animate={showChrome ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: EASE }}
            onFocus={wake}
          >
            <ProgressRail
              length={length}
              at={at}
              loaded={loaded}
              marks={marks}
              peek={peek}
              peekChapter={peekChapter}
              dragging={dragging}
              tight={tight}
              railRef={railRef}
              fillRef={fillRef}
              knobRef={knobRef}
              onPointerDown={railDown}
              onPointerMove={railMove}
              onPointerUp={railUp}
              onPointerLeave={() => {
                if (!dragging) setPeek(null);
              }}
              onKeyDown={railKey}
            />

            <div className="flex min-w-0 items-center" style={{ gap: tight ? 0 : 2 }}>
              <IconButton label={running ? "Pause" : "Play"} hint="k" size={btn} onClick={() => {
                  toggle();
                  wake();
                }}>
                {running ? <IconPause size={glyph} /> : <IconPlay size={glyph} />}
              </IconButton>

              {chrome.showSkip && !tiny && (
                <>
                  <IconButton label={`Back ${skipN} seconds`} hint="j" size={btn} onClick={() => jump(-skipN)}>
                    <IconBack size={glyph} n={skipN} />
                  </IconButton>
                  <IconButton label={`Forward ${skipN} seconds`} hint="l" size={btn} onClick={() => jump(skipN)}>
                    <IconAhead size={glyph} n={skipN} />
                  </IconButton>
                </>
              )}

              {chrome.showVolume && (
                <VolumeControl
                  level={level}
                  quiet={quiet}
                  alwaysVisible={(chrome.volumeReveal || "always") === "always"}
                  width={volW}
                  size={btn}
                  glyph={glyph}
                  onSetVolume={setVol}
                  onToggleMute={() => {
                    flipMute();
                    wake();
                  }}
                />
              )}

              {chrome.showTime && !tiny && (
                <button
                  type="button"
                  title="Switch between elapsed and remaining time"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCountdown((c) => !c);
                  }}
                  className="nct-focus shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1.5 whitespace-nowrap tabular-nums transition-colors hover:bg-white/14 motion-reduce:transition-none"
                  style={{ font: "inherit", fontSize: tight ? 12 : 13, color: T.ink }}
                >
                  {countdown ? `-${clock(length - at)}` : clock(at)}
                  <span className="opacity-55"> / {clock(length)}</span>
                </button>
              )}

              <div className="min-w-0 flex-1 truncate px-1.5 text-xs opacity-70">
                {!tight && current?.label ? `• ${current.label}` : ""}
              </div>

              {hasSubs && !tiny && (
                <IconButton label="Subtitles" hint="c" size={btn} pressed={subsOn} active={subsOn} onClick={() => {
                    toggleCaptions();
                    wake();
                  }}>
                  <IconCaptions size={glyph} on={subsOn} />
                </IconButton>
              )}

              {chrome.showSettings && (
                <IconButton
                  ref={menuBtnRef}
                  label="Settings"
                  size={btn}
                  expanded={menu}
                  active={menu}
                  onClick={() => {
                    setMenu((o) => !o);
                    wake();
                  }}
                >
                  <IconTune size={glyph} />
                </IconButton>
              )}

              {chrome.showPip && pipAllowed && !tight && (
                <IconButton label="Picture in picture" size={btn} pressed={floating} active={floating} onClick={() => {
                    flipFloat();
                    wake();
                  }}>
                  <IconPip size={glyph} />
                </IconButton>
              )}

              {chrome.showFullscreen && (
                <IconButton label={whole ? "Exit full screen" : "Full screen"} hint="f" size={btn} onClick={() => {
                    flipWhole();
                    wake();
                  }}>
                  <IconExpand size={glyph} open={whole} />
                </IconButton>
              )}
            </div>

            <AnimatePresence>
              {menu && (
                <SettingsMenu
                  key="menu"
                  ref={menuRef}
                  width={width}
                  tight={tight}
                  rate={rate}
                  onRate={applyRate}
                  ambient={lit}
                  onAmbient={toggleAmbient}
                  loop={looping}
                  onLoop={() => setLooping((l) => !l)}
                  hasSubs={hasSubs}
                  subsOn={subsOn}
                  onSubs={toggleCaptions}
                  countdown={countdown}
                  onCountdown={() => setCountdown((c) => !c)}
                  pipSwitch={chrome.showPip && pipAllowed && tight}
                  floating={floating}
                  onFloat={flipFloat}
                  marks={marks}
                  currentChapter={current}
                  onChapter={(t) => {
                    seekTo(t);
                    closeMenu();
                  }}
                  onKeyDown={onMenuKey}
                />
              )}
            </AnimatePresence>
          </m.div>
        )}
      </div>
    </div>
  );
}
