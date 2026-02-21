#!/usr/bin/env node
/**
 * sync-sitemap.js
 *
 * Reads all .md files from the docs/ directory and generates a sitemap.json
 * in the project root. Each entry records the title (first H1), relative
 * path, word count, and last-modified date of the source file.
 *
 * Usage: node scripts/sync-sitemap.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DOCS_DIR = path.resolve(__dirname, "..", "docs");
const SITEMAP_PATH = path.resolve(__dirname, "..", "sitemap.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count words in a string using whitespace splitting.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

/**
 * Extract the first H1 heading from markdown text.
 * Returns the heading text, or null if no H1 is found.
 * @param {string} content
 * @returns {string | null}
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract the first paragraph of text following the H1 heading.
 * Used as a short excerpt for the sitemap entry.
 * @param {string} content
 * @returns {string | null}
 */
function extractExcerpt(content) {
  // Skip frontmatter-style lines and the H1, then take the first non-empty paragraph.
  const lines = content.split("\n");
  let pastTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!pastTitle) {
      if (/^#\s/.test(line)) {
        pastTitle = true;
      }
      continue;
    }

    // Skip blank lines and markdown headings immediately after the title.
    if (line === "" || /^#+\s/.test(line)) {
      continue;
    }

    // Skip horizontal rules and HTML comments.
    if (/^---+$/.test(line) || /^<!--/.test(line)) {
      continue;
    }

    // Return up to 200 characters of the first meaningful line.
    return line.length > 200 ? line.slice(0, 197) + "..." : line;
  }

  return null;
}

/**
 * Convert a file path (relative to docs/) into a URL-style slug path.
 * Strips the .md extension and converts backslashes (Windows) to forward slashes.
 * @param {string} relPath - Path relative to DOCS_DIR.
 * @returns {string}
 */
function toSlugPath(relPath) {
  return relPath.replace(/\\/g, "/").replace(/\.md$/, "");
}

/**
 * Format a Date as an ISO 8601 date string (YYYY-MM-DD).
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Recursively find all .md files under a root directory.
 * Returns paths relative to the root directory.
 * @param {string} dir - Absolute path to the root directory.
 * @param {string} [base] - Internal: tracks the relative path prefix.
 * @returns {string[]}
 */
function findMdFiles(dir, base) {
  base = base || "";
  let results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") {
      return results;
    }
    throw err;
  }

  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results = results.concat(findMdFiles(path.join(dir, entry.name), relPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relPath);
    }
  }

  // Sort for deterministic output.
  results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return results;
}

// ---------------------------------------------------------------------------
// Sitemap generation
// ---------------------------------------------------------------------------

/**
 * Build the sitemap data structure from the docs/ directory.
 * @returns {{ generatedAt: string, totalDocuments: number, pages: object[] }}
 */
function buildSitemap() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.warn(`docs/ directory not found at: ${DOCS_DIR}`);
    console.warn("Creating an empty sitemap.");
    return {
      generatedAt: new Date().toISOString(),
      totalDocuments: 0,
      pages: [],
    };
  }

  const relPaths = findMdFiles(DOCS_DIR);

  if (relPaths.length === 0) {
    console.warn("No .md files found in docs/.");
  }

  const pages = relPaths.map((relPath) => {
    const absPath = path.join(DOCS_DIR, relPath);
    const content = fs.readFileSync(absPath, "utf8");
    const stat = fs.statSync(absPath);

    const title = extractTitle(content) || path.basename(relPath, ".md");
    const excerpt = extractExcerpt(content);
    const wordCount = countWords(content);
    const lastModified = toDateString(stat.mtime);
    const slugPath = toSlugPath(relPath);
    const isIndex = path.basename(relPath) === "INDEX.md";

    return {
      title,
      path: slugPath,
      file: relPath,
      wordCount,
      lastModified,
      excerpt: excerpt || null,
      isIndex,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalDocuments: pages.length,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("sync-sitemap.js — DNS Reference Library");
  console.log("----------------------------------------");
  console.log(`Docs directory  : ${DOCS_DIR}`);
  console.log(`Sitemap output  : ${SITEMAP_PATH}`);
  console.log("");

  const sitemap = buildSitemap();

  const json = JSON.stringify(sitemap, null, 2);
  fs.writeFileSync(SITEMAP_PATH, json, "utf8");

  console.log(`Found ${sitemap.totalDocuments} document(s).`);
  sitemap.pages.forEach((page) => {
    const wordLabel = page.wordCount.toLocaleString("en-US").padStart(8);
    const dateLabel = page.lastModified;
    console.log(`  ${page.file.padEnd(40)} ${wordLabel} words   ${dateLabel}   "${page.title}"`);
  });

  console.log("");
  console.log(`sitemap.json written with ${sitemap.totalDocuments} page(s).`);
}

main();
