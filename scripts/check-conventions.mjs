#!/usr/bin/env node
// Enforces the mechanically checkable conventions that the other gates cannot:
// the 150-line module budget, snake_case Zig functions, kebab-case TypeScript
// filenames, and emoji code points. Scans `src/` and `tests/`; vendored and
// generated trees are out of scope.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_ROOTS = ["src", "tests"];
const EXEMPT = new Set(["src/types/ws.d.ts"]);
const MAX_LINES = 150;
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".zig",
  ".md",
  ".json",
  ".yml",
  ".yaml",
]);
const EMOJI = /\p{Extended_Pictographic}/u;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ZIG_FUNCTION = /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

const violations = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    check(path);
  }
}

function check(path) {
  const name = relative(ROOT, path);
  if (EXEMPT.has(name)) return;
  const extension = name.slice(name.lastIndexOf("."));
  if (!TEXT_EXTENSIONS.has(extension)) return;
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n").length - (source.endsWith("\n") ? 1 : 0);

  if (lines > MAX_LINES) {
    violations.push(`${name}: ${lines} lines exceeds the ${MAX_LINES}-line module budget`);
  }

  if (extension === ".zig") {
    for (const match of source.matchAll(ZIG_FUNCTION)) {
      if (!/[A-Z]/.test(match[1])) continue;
      violations.push(`${name}: Zig function '${match[1]}' is not snake_case`);
    }
  }

  if (extension === ".ts" && name.startsWith("src/")) {
    const stem = name.slice(name.lastIndexOf("/") + 1).split(".")[0];
    if (!KEBAB_CASE.test(stem)) {
      violations.push(`${name}: TypeScript filename '${stem}' is not kebab-case`);
    }
  }

  if (EMOJI.test(source)) {
    violations.push(`${name}: contains an emoji code point`);
  }
}

for (const root of SCAN_ROOTS) walk(join(ROOT, root));

if (violations.length > 0) {
  for (const violation of violations) process.stderr.write(`conventions: ${violation}\n`);
  process.exit(1);
}
