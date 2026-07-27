import { createSerwistRoute } from "@serwist/turbopack";

// Bundles app/sw.ts with esbuild and serves it (with Service-Worker-Allowed: /
// so it can control the whole app even though it's served from this nested
// route). Needed because Next.js 16's default Turbopack builder doesn't
// support @serwist/next's webpack-based injection.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
