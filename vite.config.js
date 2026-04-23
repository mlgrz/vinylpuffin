import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "https://mlgrz.github.io/vinylpuffin/",
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
