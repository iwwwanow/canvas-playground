import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { readdirSync } from "fs";

function compositionInputs() {
  const dir = resolve(__dirname, "compositions");
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => /^composition-\d+$/.test(name))
      .map((name) => [name, resolve(dir, name, "index.html")]),
  );
}

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@xtc-toaster/core": resolve(__dirname, "../core/lib"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:   resolve(__dirname, "index.html"),
        editor: resolve(__dirname, "editor.html"),
        ...compositionInputs(),
      },
    },
    outDir: "dist",
  },
});
