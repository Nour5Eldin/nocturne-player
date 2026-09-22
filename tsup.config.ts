import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

// The package ships only client components (browser media APIs, hooks), so every output
// file needs the "use client" directive Next.js's App Router requires to accept it.
//
// esbuild strips the source-level "use client" lines once Nocturne.tsx / controls.tsx /
// overlays.tsx / hooks.ts are concatenated into one bundle (a directive is only meaningful
// as literally the first line of a file, and after bundling only one file's worth of
// "first line" exists) — that's correct behavior, not a bug, so we don't fight it. Instead
// we prepend the directive to the finished files ourselves, after esbuild is done with them.
const USE_CLIENT = '"use client";\n';

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2020",
  platform: "browser",
  external: ["react", "react-dom", "framer-motion"],
  esbuildOptions(options) {
    // Keep className strings exactly as written — the CSS build (scripts/build-css.mjs)
    // scans this output for the Tailwind utility classes actually used.
    options.minifyIdentifiers = false;
    options.keepNames = true;
  },
  async onSuccess() {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const current = readFileSync(file, "utf8");
      if (!current.startsWith(USE_CLIENT)) writeFileSync(file, USE_CLIENT + current);
    }
    // esbuild also extracted the plain `import "./nocturne.css"` side effect into its own
    // dist/index.css. It's incomplete on its own (no Tailwind utilities), so we discard it —
    // scripts/build-css.mjs generates the real, complete stylesheet at dist/style.css.
    for (const file of ["dist/index.css", "dist/index.css.map"]) {
      try {
        rmSync(file);
      } catch {
        /* not present */
      }
    }
  },
});
