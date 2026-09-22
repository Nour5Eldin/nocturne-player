// Builds dist/style.css: Tailwind's theme tokens + utilities (no Preflight) for exactly the
// classes this package's source actually uses, plus our own reset.css and nocturne.css — all
// scoped under a single .nocturne-player selector so importing this file can never change
// styles anywhere else on the host page. See README.md → "How the CSS is built" for the design.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";
import cssnano from "cssnano";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const rawPath = resolve(root, "dist/.tailwind-raw.css");
const outPath = resolve(root, "dist/style.css");

mkdirSync(dirname(rawPath), { recursive: true });

// 1) Ask Tailwind for theme tokens + utilities for whatever classes src/*.tsx actually use.
//    No Preflight import here on purpose — see src/reset.css.
execFileSync(
  "npx",
  ["@tailwindcss/cli", "-i", resolve(root, "scripts/tailwind-entry.css"), "-o", rawPath, "--minify"],
  { stdio: "inherit" },
);
const tailwindCss = readFileSync(rawPath, "utf8");
const reset = readFileSync(resolve(root, "src/reset.css"), "utf8");
const nocturne = readFileSync(resolve(root, "src/nocturne.css"), "utf8");

// 2) Scope everything under .nocturne-player. postcss-prefix-selector's default behavior
//    (no custom `transform`) already does the right thing for our one special case: a bare
//    `:root` selector (Tailwind's theme-token block) is REPLACED with `.nocturne-player`
//    rather than prefixed — `.nocturne-player :root` would be unmatchable, since :root can
//    only ever be the document element. Everything else gets `.nocturne-player ` prepended.
const scopeToPlayer = prefixSelector({ prefix: ".nocturne-player" });

// 3) @keyframes names are global by nature (CSS gives them no scoping mechanism at all), so a
//    host page that happens to define its own e.g. `@keyframes spin` would silently clash with
//    ours — whichever declaration loads last wins for every element on the page using that
//    name, ours included. Give every keyframe name a package-unique prefix, and rewrite the
//    handful of theme values (Tailwind's `--animate-*` tokens) that reference them by name.
const KEYFRAME_PREFIX = "nocturne-player-";
function namespaceKeyframes() {
  return {
    postcssPlugin: "namespace-keyframes",
    Once(root) {
      const names = new Set();
      root.walkAtRules(/^(-\w+-)?keyframes$/, (rule) => {
        names.add(rule.params.trim());
        rule.params = KEYFRAME_PREFIX + rule.params.trim();
      });
      if (!names.size) return;
      const escaped = [...names].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "g");
      root.walkDecls((decl) => {
        if (pattern.test(decl.value)) decl.value = decl.value.replace(pattern, (m) => KEYFRAME_PREFIX + m);
      });
    },
  };
}
namespaceKeyframes.postcss = true;

// 4) Master cascade-layer order, lowest to highest priority: theme tokens, our reset, Tailwind
//    utilities, then our own nocturne.css completely unlayered so it always wins (it encodes
//    deliberate, specific states — the focus ring, caption sizing — that should never be
//    silently defeated by a same-specificity utility, regardless of import order on the page).
const combined = `
@layer theme, reset, utilities;
@layer reset {
${reset}
}
${tailwindCss}
${nocturne}
`;

const result = await postcss([scopeToPlayer, namespaceKeyframes, cssnano({ preset: "default" })]).process(combined, {
  from: undefined,
});

if (result.warnings().length) {
  for (const warning of result.warnings()) console.warn(warning.toString());
}

writeFileSync(outPath, result.css);
rmSync(rawPath); // intermediate artifact — not part of the published package
console.log(`wrote ${outPath} (${(result.css.length / 1024).toFixed(1)} KB)`);
