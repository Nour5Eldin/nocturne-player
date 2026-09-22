// Parity check: every class token written in a `className` in src/*.tsx must have a matching
// rule in the built dist/style.css. Run after `npm run build`. This is how we catch a typo'd
// Tailwind class, or a class Tailwind's scanner didn't pick up, before it ships.
import { readFileSync, readdirSync } from "node:fs";

const SRC_DIR = new URL("../src/", import.meta.url);
const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".tsx"));

// Pull every double-quoted string that sits inside a `className={cn(...)}` call or a plain
// `className="..."` — the only two places this codebase puts classNames — then split each on
// whitespace (Tailwind arbitrary values never contain a literal space, so this is safe).
const tokens = new Set();
for (const file of files) {
  const src = readFileSync(new URL(file, SRC_DIR), "utf8");
  for (const m of src.matchAll(/className=(?:"((?:[^"\\]|\\.)*)"|\{cn\(([\s\S]*?)\)\})/g)) {
    if (m[1] !== undefined) {
      // Plain className="..." — the regex's own capture group already stripped the quotes,
      // so this is the space-separated class list itself.
      for (const tok of m[1].split(/\s+/)) if (tok) tokens.add(tok);
    } else {
      // className={cn(...)} — m[2] is the raw, still-quoted argument list; pull every
      // double-quoted string literal out of it (covers ternaries and `cond && "..."`).
      for (const s of m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
        for (const tok of s[1].split(/\s+/)) if (tok) tokens.add(tok);
      }
    }
  }
}

const css = readFileSync(new URL("../dist/style.css", import.meta.url), "utf8");
// Tailwind backslash-escapes special characters in the generated selector (.hover\:bg-white\/12).
// Stripping every backslash turns that back into the plain token, so a straight substring
// search against the token as written in source works regardless of escaping.
const unescapedCss = css.replace(/\\/g, "");

const missing = [...tokens].filter((tok) => !unescapedCss.includes(`.${tok}`)).sort();

if (missing.length) {
  console.error(`FAIL  ${missing.length} class(es) in src/*.tsx have no rule in dist/style.css:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  all ${tokens.size} classes referenced in src/*.tsx are present in dist/style.css`);
}
