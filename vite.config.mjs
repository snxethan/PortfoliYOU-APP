// vite is a build tool that aims to provide a faster and leaner development experience for modern web projects

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "app/renderer", // tells Vite where the root of the project is
  base: "./", // ensures that assets are served correctly
  build: { outDir: "../../dist", emptyOutDir: true }, // output directory for the build
  server: { port: 5173, strictPort: true }, // keep in sync with electron wait-on port
  plugins: [react()], // enables React support
});
