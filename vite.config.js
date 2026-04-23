import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from `/<repo>/`.
  // In Actions, `GITHUB_REPOSITORY` is like "owner/repo" so we can derive the base automatically.
  base: (() => {
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    return repo ? `/${repo}/` : "/";
  })(),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        vinylpuffin: resolve(__dirname, "vinylpuffin.html"),
      },
    },
  },
});
