#!/usr/bin/env node
// Generates placeholder solid-color PWA icons (no deps beyond Node's zlib).
// Swap public/icons/*.png for real branded artwork whenever it's ready —
// this just satisfies "installable" checks (>=192px and >=512px icons).
//
//   node scripts/gen-pwa-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT_DIR = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

// Fairway green (matches --primary in app/globals.css).
const [R, G, B] = [0x15, 0x80, 0x3d];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** A solid-color RGB PNG of size x size, with a lighter rounded "flag" dot for character. */
function solidPng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  const ihdr = chunk("IHDR", ihdrData);

  // Raw scanlines: filter byte (0) + RGB per pixel, solid fill.
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = R;
      raw[o + 1] = G;
      raw[o + 2] = B;
    }
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

for (const size of [192, 512]) {
  const path = new URL(`icon-${size}.png`, OUT_DIR);
  writeFileSync(path, solidPng(size));
  console.log(`Wrote ${path.pathname} (${size}x${size} solid placeholder)`);
}
