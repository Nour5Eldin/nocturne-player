# nocturne-player

A themeable, accessible video player for React — chapters, captions, ambient glow, full
keyboard control and picture-in-picture, in one component. Ships as a real npm package: install
it, import two things, done. No Tailwind config required in the app that uses it, even though
the component is built with Tailwind internally.

```tsx
import { Nocturne } from "nocturne-player";
import "nocturne-player/style.css";

<Nocturne src="/movie.mp4" poster="/movie.jpg" title="My film" />;
```

This document covers how the package is built and shipped, its full API, how to install and
theme it, how it's tested, what it needs from the browser, and what's planned next.

---

## 1. Packaging and distribution

**Framework: React (18.2+ or 19), TypeScript.** Not Vue or vanilla JS — the component is built
on React hooks and context-free local state, and `framer-motion`'s React bindings drive the
animations. A vanilla-JS/web-components build is possible as a separate package later (see
§7) but isn't what's here.

**Bundler: [`tsup`](https://tsup.egoist.dev/)** (esbuild under the hood). One entry point
(`src/index.ts`), two output formats:

| File | Format | Consumers |
| --- | --- | --- |
| `dist/index.js` | ESM | Vite, Next.js, modern bundlers, `"type": "module"` projects |
| `dist/index.cjs` | CommonJS | older Node tooling, `require()` |
| `dist/index.d.ts` / `dist/index.d.cts` | Types | both, matched via `package.json#exports` |
| `dist/style.css` | Plain CSS | anyone, via a separate `import "nocturne-player/style.css"` |

`package.json#exports` maps both formats and their type files correctly (verified with
[`publint`](https://publint.dev/), which is wired into `npm run prepublishOnly` and CI — see §5).

**"use client".** The whole package is browser-only (media APIs, `ResizeObserver`,
`IntersectionObserver`, keyboard/pointer events), so every output file is a client component.
esbuild strips a source-level `"use client"` directive once multiple files get concatenated
into one bundle — that's correct behavior on esbuild's part, not a bug — so a `tsup` build hook
(`onSuccess` in `tsup.config.ts`) prepends the directive to the finished files itself, after
bundling is done. This makes the package safe to import from a Next.js App Router server
component tree without the caller needing to know or care.

**Peer vs. regular dependencies.**
- `react` / `react-dom` are **peerDependencies** (`^18.2.0 || ^19.0.0`) — standard for a
  component library, so the consumer's own React instance is used, not a bundled second copy.
- `framer-motion` is a regular **dependency** (`^13.4.0`) but marked `external` in the `tsup`
  build, so it's never bundled into `dist/`. npm installs it automatically for the consumer;
  if their app already depends on a compatible version, npm dedupes it — no duplicate copy.

**Versioning.** Plain [semver](https://semver.org/), starting at `0.1.0`. Pre-1.0, a breaking
change bumps the minor version (`0.1.x` → `0.2.0`) rather than the patch, since `0.x` has no
stability guarantee by convention. Once the API settles, `1.0.0` starts normal semver (breaking
→ major). There's no changelog automation set up (no Changesets, no semantic-release) — for a
single-package repo at this stage that's more process than the problem needs; `npm version
<major|minor|patch>` plus a hand-written `CHANGELOG.md` entry is enough. If the package grows
into a monorepo with several packages, revisit — [Changesets](https://github.com/changesets/changesets)
is the standard choice at that point.

**CI/CD.** `.github/workflows/ci.yml`: every push and PR runs typecheck → lint → test → build →
CSS-parity check → `publint`, on Node 20.9 (the package's stated minimum). A second job publishes
to npm automatically on a `v*` tag push, gated behind an `NPM_TOKEN` repo secret — delete that
job if you'd rather run `npm publish` by hand.

**Registry.** Written assuming public npm (`npm publish`, no `private: true`,
`"access": "public"` implied by an unscoped name). For a private/internal registry, add
`"publishConfig": { "registry": "https://your-registry" }` to `package.json` — nothing else
about the build changes.

---

## 2. API surface

**One component, by design.** `<Nocturne>` (aliased as `<VideoPlayer>` — pick whichever name
reads better in your codebase, they're the same export) is a single, tightly integrated player,
the way `<video controls>` is one element rather than a kit of parts. `IconButton`,
`ProgressRail`, `VolumeControl`, `SettingsMenu` exist internally (`src/controls.tsx`) but aren't
exported — they're not designed to be recomposed independently, since the player manages one
shared piece of state (current time, dragging, menu-open, chrome-visible...) across all of them.
If you need specific pieces exposed as standalone primitives, that's a reasonable ask — it just
means designing a real headless API (state via a hook, pieces as separate components), which is
future work (§7), not a small change.

### `<Nocturne>` props

| Prop | Type | Notes |
| --- | --- | --- |
| `src` | `string` | Required. Changing it remounts the player with fresh state. |
| `poster` | `string` | Also tints the ambient glow before the first play. |
| `subtitles` | `{ src, lang?, label? }` | WebVTT. Needs CORS headers (video gets `crossOrigin="anonymous"`). |
| `title`, `eyebrow` | `string` | Overlay text. Fades out with the controls. |
| `chapters` | `{ time, label }[]` | Ticks on the seek bar, tooltip labels, a list in Settings. |
| `captions` | `boolean` | Captions on by default. |
| `playback` | `Partial<PlaybackOptions>` | `autoPlay`, `startMuted`, `loop`, `pauseOffscreen`, `startAt`, `speed`, `volume` |
| `chrome` | `Partial<ChromeOptions>` | `layout` (`"floating" \| "edge"`), `hideAfter`, `skipBy`, `showSkip/Volume/Time/Settings/Pip/Fullscreen`, `volumeReveal`, `volumeWidth`, `keyboard`, `tapToSeek`, `clickToPlay` |
| `look` | `Partial<LookOptions>` | `accent`, `panel`, `ink`, `rail`, `backdrop`, `corner`, `fit`, `heroSize` |
| `glow` | `Partial<GlowOptions>` | `enabled`, `strength`, `spread`, `softness`, `rate` |
| `aspectRatio`, `className`, `style` | | Layout of the outer wrapper. Default aspect ratio `16 / 9`. |
| `onPrefsChange` | `(patch: Partial<NocturnePrefs>) => void` | The event surface — fires when the viewer changes volume, mute, speed, ambient mode or captions. |
| `ref` | `Ref<NocturneHandle>` | `play()`, `pause()`, `toggle()`, `seek(seconds)`, `element` |

All the grouped option types (`PlaybackOptions`, `ChromeOptions`, `LookOptions`, `GlowOptions`,
`NocturnePrefs`, `Chapter`, `NocturneHandle`) are exported for your own typing. Defaults live in
`DEFAULT_PLAYBACK` / `DEFAULT_CHROME` / `DEFAULT_LOOK` / `DEFAULT_GLOW`, also exported.

### Customization model

Three layers, cheapest first:
1. **CSS variables** (`look.accent`, or the `--nct-*` custom properties directly) — for color.
2. **Props** (`chrome`, `look`, `glow`) — for layout/behavior toggles the component already
   supports.
3. **Composition** (`className`/`style` on the root, `ref` + your own UI around it,
   `onPrefsChange` to sync your own store) — for anything the props don't cover, without
   touching the library's source. §4 has the details and a worked example.

---

## 3. Integration guide

```bash
npm install nocturne-player
```

(`framer-motion` installs automatically as a dependency; add `react` / `react-dom` if your
project doesn't already have them, since they're peer dependencies.)

```tsx
import { Nocturne } from "nocturne-player";
import "nocturne-player/style.css"; // once, anywhere near your app's root

export default function Page() {
  return (
    <Nocturne
      src="/media/film.mp4"
      poster="/media/film.jpg"
      title="Film title"
      chapters={[
        { time: 0, label: "Opening" },
        { time: 95, label: "The turn" },
      ]}
      subtitles={{ src: "/media/film.en.vtt", lang: "en", label: "English" }}
      className="mx-auto max-w-4xl"
    />
  );
}
```

That's the entire integration — no `tailwind.config`, no PostCSS setup, no build step of your
own. `Nocturne` is a client component: import it from a server component (Next.js App Router)
or a plain client component, either works. It fills its container's width at `aspect-ratio: 16 /
9` by default (`aspectRatio` prop to change it).

**If your project already runs Tailwind:** you don't need the CSS import at all. Point your own
Tailwind build at the package so it generates the same utilities from *your* theme (same colors,
spacing, fonts as the rest of your app, and zero duplicate CSS):

```css
/* your global.css, Tailwind v4 */
@import "tailwindcss";
@source "../node_modules/nocturne-player/dist/index.js";
```

I verified this actually works — running Tailwind's CLI with that `@source` line against the
package's real compiled output produces matching rules for every class the component uses,
including compound ones like `group-hover/rail:h-1.5` and `hover:bg-white/12`, in the host
project's own theme. (Tailwind v3's `content` array does the same job: add the same path there.)

A working, from-scratch example (plain Vite + React, no Tailwind) is in
[`examples/basic-vite`](examples/basic-vite).

---

## 4. Theming and extensibility

**Colors: CSS variables**, each with the built-in default as a fallback:

```css
.nocturne-player {
  --nct-accent: #f2c14e;   /* progress fill, focus ring, play button, active icons */
  --nct-panel: rgba(16, 16, 20, 0.62);  /* control-dock background (floating layout) */
  --nct-ink: #fff;         /* icon/text color */
  --nct-rail: rgba(255, 255, 255, 0.2); /* seek-bar and volume-bar track */
  --nct-backdrop: #0b0b0e; /* player background before video paints */
}
```

Set them globally on `:root`, on a wrapper around several players, or skip the CSS entirely and
use the `look` prop per instance — both work, props win when both are present:

```tsx
<Nocturne src="…" look={{ accent: "#6bb6ff", corner: 12 }} />
```

**Behavior:** `chrome` (which controls show, how skip/volume/fullscreen work, keyboard on/off,
tap-to-seek), `glow` (ambient glow on/off and intensity), `playback` (autoplay, loop, start
time, speed).

**Beyond props — composition, not forking:**
- `className` / `style` on the root position and size the player in your layout; the component
  itself never sets margin or absolute positioning on itself.
- The `ref` handle (`play`, `pause`, `toggle`, `seek`, `element`) lets you drive playback from
  your own UI — a custom chapter list, a "resume where you left off" button, anything. See
  `WatchPlayer` in the sibling Next.js project this package was extracted from for a worked
  example (a component that renders `<Nocturne ref={player}>` plus its own chapter list, and
  calls `player.current.seek(t)` when a chapter is clicked).
- `onPrefsChange` reports viewer-driven changes (volume, mute, speed, ambient, captions) so you
  can persist them yourself — in `localStorage`, a user-settings API, wherever. The component
  intentionally stays uncontrolled/stateless about persistence; wiring it to a store is a ~30-line
  wrapper component in your own code, not a library feature, so it can't force one storage
  strategy on you.
- Deeper visual overrides via a more specific CSS selector than `.nocturne-player …` are
  possible (nothing stops you), but aren't a supported extension point — the internal class
  names and DOM structure aren't part of the public API and can change between minor versions.
  The `look`/`chrome` props and the five `--nct-*` variables are; treat anything else as an
  implementation detail.

**How the CSS is built.** This is the part that makes "just install it" true even without
Tailwind, so it's worth explaining rather than leaving as a black box:

1. `scripts/build-css.mjs` runs Tailwind's CLI against `scripts/tailwind-entry.css`, which
   imports only Tailwind's **theme tokens and utilities layers** — explicitly *not* Preflight
   (Tailwind's global element reset). Preflight resets bare selectors like `*`, `button`, `svg`
   across the *whole document* — fine inside an app that runs Tailwind everywhere, not safe to
   ship in a library stylesheet that loads on pages this package doesn't control.
2. `src/reset.css` is a hand-picked, 15-line substitute covering only what the component's own
   utility classes actually assume (`box-sizing: border-box`, a couple of button/svg baselines).
3. Every selector from both sources — Tailwind's generated utilities and the hand-written
   reset — gets rewritten under a single `.nocturne-player` ancestor
   (via [`postcss-prefix-selector`](https://github.com/gucong3000/postcss-prefix-selector)),
   including the one special case that needs different handling: Tailwind's theme tokens are
   normally defined on `:root`, and `:root` can't be turned into a descendant selector
   (`.nocturne-player :root` would be unmatchable — `:root` is always the document element).
   That block becomes `.nocturne-player { --spacing: …; … }` instead, so the variables are
   available to the whole subtree by inheritance.
4. `@keyframes` names are global in CSS with no scoping mechanism at all — a host page that
   happens to define its own `@keyframes spin` would silently fight with the player's loading
   spinner, whichever one loads last winning for *both*. Every keyframe name gets a
   `nocturne-player-` prefix, and the couple of theme values that reference them by name
   (Tailwind's `--animate-spin` token) are rewritten to match.
5. Everything is arranged into three [CSS cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
   — `theme` < `reset` < `utilities` — plus the component's own hand-written `nocturne.css`
   (focus rings, WebVTT caption sizing) left **unlayered**, so it always wins regardless of
   specificity math, matching what it's meant to do: encode a few deliberate, specific states
   that shouldn't be silently overridden by an unrelated same-specificity utility.
6. `npm run verify:css` is a small parity check (no external CSS-testing library, ~40 lines) that
   extracts every literal class string written in `src/*.tsx` and asserts each one has a real
   rule in the built `dist/style.css` — the thing that would actually catch a typo'd Tailwind
   class, or one Tailwind's own content scanner missed, before it ships. It runs in CI.

Net result, verified end to end (not just asserted — see §5): dropping
`nocturne-player/style.css` into a page with **zero** Tailwind, and even a page that happens to
define its own conflicting `.hidden` class or `@keyframes spin`, changes nothing else on that
page.

---

## 5. Build and QA

```bash
npm run typecheck    # tsc --noEmit, strict, noUncheckedIndexedAccess on
npm run lint          # eslint flat config: typescript-eslint + react-hooks recommended
npm test              # vitest + Testing Library, jsdom
npm run build          # tsup (JS + types) then the CSS pipeline above
npm run verify:css     # class-parity check described in §4, run after build
npx publint             # validates package.json / exports / types shape
```

All five run in CI on every push/PR (`.github/workflows/ci.yml`), and `prepublishOnly` chains
typecheck → lint → test → build → verify:css → publint, so a broken package can't be published
by accident.

**Unit tests** (`src/__tests__/`, 25 tests): rendering and ARIA, play/pause, mute, arrow-key and
number-row seeking, speed shortcuts, the settings menu (open, change speed, arrow-key navigation
inside the menu, Escape closing it and returning focus), chapter seeking from the menu, the
ambient toggle, `onPrefsChange` firing correctly, the imperative ref handle, the error state,
remounting cleanly when `src` changes, `look` colors becoming CSS variables only when actually
passed, and catching up correctly when the browser's `loadedmetadata`/`error` events fire before
React hydrates (a real scenario server-rendered `<video src>` elements hit).

**What jsdom can't test, and what I did instead of leaving it unverified:** jsdom has no media
pipeline, no real layout, and (I confirmed directly, worth knowing if you extend the test setup)
does not execute `<script type="module">` at all — so testing an actual bundled build's runtime
behavior needs more than jsdom-in-isolation. To validate the packaging claims in this README for
real rather than by inspection, I:
- Ran `npm pack` and installed the **real tarball** (not the source directory) into a brand-new,
  separate Vite + React project with no Tailwind anywhere in it, and confirmed `tsc --noEmit`
  and `vite build` both succeed against it — proving the `exports` map, `.d.ts` resolution, and
  peer-dependency setup actually work for a consumer, not just in theory.
- Statically analyzed the **actual built** `dist/style.css` from that consumer's build output:
  confirmed every rule (aside from inherently-global `@keyframes` step selectors like `to`,
  which can't collide with anything) is scoped under `.nocturne-player`, and that the deliberate
  `.hidden`/`@keyframes spin` collisions I set up in that test project's own CSS are unaffected.
- Loaded that project's real, server-served HTML in jsdom and used `getComputedStyle` on the
  colliding element to confirm, in an actually-executing style engine (not just text search),
  that its color was untouched by the imported stylesheet.
- Ran Tailwind's own CLI with `@source` pointed at the package's real compiled `dist/index.js`
  (mimicking the "consumer already has Tailwind" path from §3) and confirmed it generates
  matching utility rules, including compound variants.
- Ran `publint` against the packed tarball.

What's *not* verified, because it needs a real browser and this environment doesn't have one:
actual visual rendering, click/drag/touch interaction, fullscreen, picture-in-picture, and the
ambient glow's live sampling. If you're setting up further QA, that's the gap to fill —
Playwright against the built `examples/basic-vite` app is the natural next step.

---

## 6. Compatibility notes

- **React** 18.2+ or 19 (peer dependency range above). **Node** 20.9+ to *build* the package —
  a consumer installing the published `dist/` doesn't need any particular Node version at
  runtime, since it's browser code.
- **Browsers:** evergreen Chrome, Firefox, Safari, Edge (last ~2 versions). The component
  degrades gracefully rather than breaking on older/partial support: picture-in-picture and the
  Fullscreen API are feature-detected and their buttons hidden if unavailable;
  `prefers-reduced-motion` turns off the ambient-glow sampling loop, the progress-bar animation
  frame loop, and framer-motion's transform animations, falling back to the browser's native
  transitions where relevant.
- **Video formats:** the component plays whatever the browser's native `<video>` element
  supports — it doesn't do its own decoding. **MP4 (H.264 video + AAC audio)** is the safe
  baseline across every current browser; **WebM (VP9/AV1 + Opus)** works everywhere except
  older Safari. Avoid **Ogg/Theora** — Safari never supported it and Chrome removed support after
  version 120. Encode with `ffmpeg -movflags +faststart` so playback (and instant metadata) can
  start before the whole file downloads; the host serving the file needs to support HTTP range
  requests for seeking to work.
- **Streaming (HLS/DASH):** not supported yet — see §7.
- **Size**, gzipped, measured from the actual build: **`dist/index.js` ≈ 14.5 KB**,
  **`dist/style.css` ≈ 4.2 KB**. `framer-motion` is not included in that figure since it's an
  external dependency — if your app doesn't already use it, budget for it separately (it's the
  larger of the two by far; the component only imports `domAnimation`'s feature set via
  `LazyMotion`, so a decent bundler tree-shakes away drag/layout-animation code it never uses,
  but the exact number depends on your bundler and what else in your app already pulls in
  `framer-motion`).

---

## 7. MVP plan

**Where this stands now (v0.1.0) is already past a bare MVP** — it's the full port of the
original component, not a stripped-down first cut, because the "MVP" here was "make the
existing component installable and self-contained," and that's done and verified (§5). Laid out
against your phasing anyway:

**Phase 1 — plug-and-play core.** ✅ Done: `src` + `poster` props, play/pause/volume/mute/seek/
fullscreen, a prebuilt CSS bundle that needs no host configuration, and a minimal working example
(`examples/basic-vite`).

**Phase 2 — accessibility.** Largely already in place, not a future increment:
`role="region"`/`"slider"` with value text, every control a named, keyboard-reachable button,
`aria-pressed`/`aria-expanded` on toggles, a real settings `menu` with roving focus and Escape-
to-close-and-return-focus, a live region announcing play/pause/seek/volume/speed changes, and
`prefers-reduced-motion` support throughout. Genuine gaps: no automated accessibility test (a
`vitest-axe` or Playwright + `axe-core` pass would catch what manual review misses), and no
screen-reader QA has been done with a real screen reader (VoiceOver/NVDA) — both worth doing
before calling accessibility "complete" rather than "substantially covered."

**Phase 2 — responsive sizing.** Also already in place: the player watches its *own* container
width with `ResizeObserver` (not just viewport width), so it correctly drops secondary controls
in a narrow sidebar or a grid cell, not just on a narrow screen.

**Phase 3 — streaming support (HLS/DASH).** Real gap, not started. Plan: an optional,
dynamically-imported `hls.js` integration gated on the `src` extension (`.m3u8`) or an explicit
`streaming="hls"` prop, so a consumer who only plays progressive MP4/WebM pays zero extra bytes
for it. Safari plays HLS natively already (no library needed there); `hls.js` covers everyone
else. DASH would follow the same pattern with `dash.js` if there's demand for it specifically —
I'd want to know whether HLS alone covers your actual use case before building both.

**Other real next steps**, roughly in order of how likely they are to matter soon:
- Playwright visual/interaction tests against `examples/basic-vite` (the gap called out in §5).
- A published `CHANGELOG.md`, once there's a second release to log.
- Decide whether sub-components (a standalone seek bar, a standalone volume control) are worth
  exposing as a real headless API — only if something concrete needs to recompose the player
  differently than the built-in layout allows; don't build it speculatively.
