// vite is a build tool that aims to provide a faster and leaner development experience for modern web projects

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: "app/renderer", // tells Vite where the root of the project is
  base: "./", // ensures that assets are served correctly
  build: { outDir: "../../dist", emptyOutDir: true }, // output directory for the build
  server: { port: 5173, strictPort: true }, // keep in sync with electron wait-on port
  plugins: [react()], // enables React support
  test: {
    root: workspaceRoot,
    environment: 'jsdom',
    setupFiles: path.resolve(workspaceRoot, 'tests/unit/setup.ts'),
    globals: true,
    include: [
      'app/renderer/src/**/*.spec.{ts,tsx}',
      'app/renderer/src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.spec.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
    ]
  }
});
