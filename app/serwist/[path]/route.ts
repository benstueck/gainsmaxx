import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// A stable-per-build revision so the SW knows when the fallback page's
// content has actually changed (falls back to a random id outside a git repo).
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() || crypto.randomUUID();

// Bundles app/sw.ts with esbuild and serves it (with Service-Worker-Allowed: /
// so it can control the whole app even though it's served from this nested
// route). Needed because Next.js 16's default Turbopack builder doesn't
// support @serwist/next's webpack-based injection.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
  });
