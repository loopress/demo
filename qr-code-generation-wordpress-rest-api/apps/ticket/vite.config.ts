import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Loopress serves the bundle from wp-content/loopress/apps/ticket/, not the site root, so
// asset URLs in dist/index.html must be relative.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
