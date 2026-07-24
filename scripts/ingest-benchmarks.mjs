#!/usr/bin/env node
// Ingests the raw strokes-gained CSVs in data/reference/ into the normalized
// benchmark JSON consumed by the SG engine (lib/sg) and cached for offline use.
//
//   node scripts/ingest-benchmarks.mjs
//
// Output: data/benchmarks/v1/benchmarks.json
// Faithful transcription — anomalies in the source data are preserved, not "fixed".
// See data/benchmarks/README.md for the format + semantics.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REF = `${root}/data/reference`;
const OUT = `${root}/data/benchmarks/v1/benchmarks.json`;
const VERSION = 1;

const parseCsv = (path) =>
  readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim()));

const num = (s) => (s === "" || s == null ? null : Number(s));

// --- Long game: DISTANCE (yards), TEE, FAIRWAY, ROUGH, SAND, RECOVERY ---------
const longRows = parseCsv(`${REF}/long-game.csv`);
const longLies = ["tee", "fairway", "rough", "sand", "recovery"];
const longGame = {
  unit: "yards",
  lies: Object.fromEntries(longLies.map((l) => [l, []])),
};
for (const row of longRows.slice(1)) {
  const dist = Number(row[0]);
  longLies.forEach((lie, i) => {
    const v = num(row[i + 1]); // +1 skips the distance column
    if (v != null) longGame.lies[lie].push([dist, v]);
  });
}

// --- Putting: DISTANCE (feet), GREEN -----------------------------------------
const puttRows = parseCsv(`${REF}/putting.csv`);
const putting = { unit: "feet", green: [] };
for (const row of puttRows.slice(1)) {
  const d = num(row[0]);
  const v = num(row[1]);
  if (d != null && v != null) putting.green.push([d, v]);
}

// --- Handicap adjustments: Handicap, TEE, APPROACH, SHORT, PUTT ---------------
// Strokes lost per 18-hole round vs the Tour baseline, by category.
// Source column -> engine SG category: TEE->ott, APPROACH->app, SHORT->arg, PUTT->putt
const hcpRows = parseCsv(`${REF}/handicap-adjustments.csv`);
const handicapAdjustments = {
  unit: "strokes lost per 18 holes vs tour baseline",
  categoryMap: { tee: "ott", approach: "app", short: "arg", putt: "putt" },
  levels: {},
};
for (const row of hcpRows.slice(1)) {
  handicapAdjustments.levels[Number(row[0])] = {
    ott: num(row[1]),
    app: num(row[2]),
    arg: num(row[3]),
    putt: num(row[4]),
  };
}

const out = {
  version: VERSION,
  generatedAt: new Date().toISOString().slice(0, 10),
  source: "User-supplied Broadie-derived CSVs (data/reference/*.csv)",
  notes:
    "Tour baseline is the only per-shot table; handicap levels are applied as round-level " +
    "category adjustments added back to SG. Baseline toggle: tour (no adjustment) + 0/5/10/15/20/25.",
  tour: { longGame, putting },
  handicapAdjustments,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

// Quick summary + light validation to stdout.
const count = (pairs) => pairs.length;
console.log(`Wrote ${OUT}`);
console.log(
  "Long game rows per lie:",
  Object.fromEntries(longLies.map((l) => [l, count(longGame.lies[l])])),
);
console.log("Putting rows:", putting.green.length);
console.log(
  "Handicap levels:",
  Object.keys(handicapAdjustments.levels).join(", "),
);
