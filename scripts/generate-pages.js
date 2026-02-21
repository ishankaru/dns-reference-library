#!/usr/bin/env node
/**
 * generate-pages.js
 *
 * Reads all .md files from the docs/ directory and generates a table of
 * contents (docs/INDEX.md) listing each section with a file link and word count.
 *
 * Usage: node scripts/generate-pages.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DOCS_DIR = path.resolve(__dirname, "..", "docs");
const INDEX_PATH = path.join(DOCS_DIR, "INDEX.md");

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
 * Returns the heading text, or null if none is found.
 * @param {string} content
 * @returns {string | null}
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract the first H2-level sections from markdown content.
 * Returns an array of section heading strings.
 * @param {string} content
 * @returns {string[]}
 */
function extractSections(content) {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((m) => m[1].trim());
}

/**
 * Recursively find all .md files under a root directory.
 * Files named INDEX.md are excluded. Returns paths relative to rootDir.
 * @param {string} dir - Absolute path to search.
 * @param {string} rootDir - Absolute path of the docs root (for relative path calculation).
 * @returns {string[]} Relative paths to .md files, sorted alphabetically.
 */
function findMdFiles(dir, rootDir) {
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
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(findMdFiles(absPath, rootDir));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "INDEX.md") {
      results.push(path.relative(rootDir, absPath));
    }
  }

  results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return results;
}

/**
 * Read and collect metadata for all .md files under a docs directory tree.
 * Files named INDEX.md are excluded from the listing.
 * @param {string} dir - Absolute path to the docs root.
 * @returns {Array<{filename: string, title: string, sections: string[], wordCount: number}>}
 */
function collectDocMetadata(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    console.error("Create the docs/ directory and add .md files before running this script.");
    process.exit(1);
  }

  const relPaths = findMdFiles(dir, dir);

  if (relPaths.length === 0) {
    console.warn("No .md files found in docs/ (excluding INDEX.md).");
  }

  return relPaths.map((relPath) => {
    const filepath = path.join(dir, relPath);
    const content = fs.readFileSync(filepath, "utf8");
    const title = extractTitle(content) || path.basename(relPath, ".md");
    const sections = extractSections(content);
    const wordCount = countWords(content);
    // Normalise to forward slashes for consistent cross-platform output.
    const filename = relPath.replace(/\\/g, "/");

    return { filename, title, sections, wordCount };
  });
}

/**
 * Format a number with thousands separators for readability.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Index generation
// ---------------------------------------------------------------------------

/**
 * Build the INDEX.md content from the collected file metadata.
 * @param {ReturnType<typeof collectDocMetadata>} docs
 * @returns {string}
 */
function buildIndexContent(docs) {
  const generatedAt = new Date().toISOString();
  const totalWords = docs.reduce((sum, d) => sum + d.wordCount, 0);

  const lines = [
    "# DNS Reference Library — Index",
    "",
    `Generated: ${generatedAt}`,
    `Total documents: ${docs.length}`,
    `Total word count: ${formatNumber(totalWords)}`,
    "",
    "---",
    "",
    "## Contents",
    "",
  ];

  if (docs.length === 0) {
    lines.push("No documents found. Add .md files to the docs/ directory.");
  } else {
    docs.forEach((doc, i) => {
      // Group by subdirectory: use the filename as the link (already relative to docs/).
      const relLink = `./${doc.filename}`;
      lines.push(`### ${i + 1}. [${doc.title}](${relLink})`);
      lines.push("");
      lines.push(`- **File:** \`${doc.filename}\``);
      lines.push(`- **Word count:** ${formatNumber(doc.wordCount)}`);

      if (doc.sections.length > 0) {
        lines.push(`- **Sections (${doc.sections.length}):**`);
        doc.sections.forEach((section) => {
          lines.push(`  - ${section}`);
        });
      } else {
        lines.push("- **Sections:** none");
      }

      lines.push("");
    });
  }

  lines.push("---");
  lines.push("");
  lines.push("*This file is auto-generated by `scripts/generate-pages.js`. Do not edit manually.*");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("generate-pages.js — DNS Reference Library");
  console.log("------------------------------------------");
  console.log(`Docs directory : ${DOCS_DIR}`);
  console.log(`Index output   : ${INDEX_PATH}`);
  console.log("");

  // Ensure docs/ directory exists before writing the index.
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log("Created docs/ directory.");
  }

  const docs = collectDocMetadata(DOCS_DIR);
  console.log(`Found ${docs.length} .md file(s).`);

  docs.forEach((doc) => {
    console.log(`  ${doc.filename.padEnd(40)} ${formatNumber(doc.wordCount).padStart(8)} words   "${doc.title}"`);
  });

  const content = buildIndexContent(docs);
  fs.writeFileSync(INDEX_PATH, content, "utf8");

  console.log("");
  console.log(`INDEX.md written (${formatNumber(countWords(content))} words).`);
}

main();
