#!/usr/bin/env node
// Verifies every Markdown heading-anchor link in this repo resolves,
// both within a file and across files (e.g. SPEC.md <-> DEVIATIONS.md).
// No dependencies — plain Node, run via `node scripts/check-md-links.mjs`.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

function findMarkdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) findMarkdownFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".md")) {
      out.push(path.relative(repoRoot, path.join(dir, entry.name)));
    }
  }
  return out;
}

const files = findMarkdownFiles(repoRoot);

// Approximates GitHub's heading slugger: lowercase, strip punctuation
// (keep word chars/spaces/hyphens), then replace each whitespace run
// character-by-character with '-' (NOT collapsed — "a & b" -> "a--b").
function slugify(heading) {
  let s = heading.toLowerCase();
  s = s.replace(/[^\w\s-]/g, "");
  s = s.trim().replace(/\s/g, "-");
  return s;
}

function headingSlugs(text) {
  const slugs = new Map(); // slug -> count, for GitHub's -1/-2 dedup suffix
  const result = new Set();
  for (const line of text.split("\n")) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!m) continue;
    let slug = slugify(m[2]);
    const seen = slugs.get(slug) ?? 0;
    slugs.set(slug, seen + 1);
    if (seen > 0) slug = `${slug}-${seen}`;
    result.add(slug);
  }
  return result;
}

const fileText = new Map();
const fileSlugs = new Map();
for (const f of files) {
  const text = readFileSync(path.join(repoRoot, f), "utf8");
  fileText.set(f, text);
  fileSlugs.set(f, headingSlugs(text));
}

const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
let errors = 0;

for (const f of files) {
  const text = fileText.get(f);
  const lines = text.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Strip inline code spans so link-shaped syntax examples (e.g. a
    // sentence describing "`[ID](...)`") aren't mistaken for real links.
    const line = lines[i].replace(/`[^`]*`/g, "");
    for (const m of line.matchAll(linkRe)) {
      const target = m[2].trim();
      if (/^[a-z]+:\/\//i.test(target) || target.startsWith("mailto:")) continue; // external

      const [filePart, anchor] = target.split("#");
      const targetFile = filePart ? path.normalize(path.join(path.dirname(f), filePart)) : f;

      if (filePart && !existsSync(path.join(repoRoot, targetFile))) {
        console.error(`${f}:${i + 1}: broken file link -> ${target}`);
        errors++;
        continue;
      }
      if (!anchor) continue; // plain file link, already checked above

      const slugs = fileSlugs.get(targetFile);
      if (!slugs) continue; // linked file isn't markdown we indexed; skip
      if (!slugs.has(anchor)) {
        console.error(`${f}:${i + 1}: broken anchor -> ${target}`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} broken markdown link(s) found.`);
  process.exit(1);
}
console.log(`OK — checked ${files.length} markdown file(s), all links resolve.`);
