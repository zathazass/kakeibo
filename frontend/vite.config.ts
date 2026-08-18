import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const API = process.env.KAKEIBO_API ?? "http://127.0.0.1:8004";

export default defineConfig({
  plugins: [
    // SPA mode: no server rendering, builds to a static build/client that
    // FastAPI can serve directly.
    remix({ ssr: false }),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API, changeOrigin: true },
    },
  },
});
