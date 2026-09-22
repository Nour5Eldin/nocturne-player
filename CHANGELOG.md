# Changelog

All notable changes to this package are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [semver](https://semver.org/)
(pre-1.0: a breaking change bumps the minor version, not the patch).

## 0.1.0 — initial release

- First standalone release, extracted from a Next.js demo app into its own package.
- `<Nocturne>` / `<VideoPlayer>` component: chapters, WebVTT captions, ambient glow,
  picture-in-picture, full keyboard control, a settings menu, and responsive (container-width,
  not just viewport-width) layout.
- Self-contained `dist/style.css`: Tailwind-built, scoped under `.nocturne-player`, works with
  or without Tailwind in the consuming project.
- ESM + CJS builds with correct `"use client"` handling for Next.js App Router.
