import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import theme from "./theme.cjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(root, "../..");
export default defineConfig(({ mode }) => ({
  root,
  envDir: workspace,
  define: {
    "import.meta.env.VITE_PAGEON_TRANSFORM_URL": JSON.stringify(loadEnv(mode, workspace, "VITE_PAGEON_").VITE_PAGEON_TRANSFORM_URL || ""),
  },
  plugins: [
    { name: "pageon-jsx", enforce: "pre", async transform(code, id) {
      if (/packages\/ui\/src\/.*\.js$/.test(id)) return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
    } },
    react(),
  ],
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  css: { postcss: { plugins: [tailwindcss({ ...theme, content: [resolve(root, "src/**/*.{js,jsx}"), resolve(workspace, "packages/{editor,ui}/src/**/*.{js,jsx}")] }), autoprefixer()] } },
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [workspace] } },
  // Runtime serializes its self-contained functions into exported HTML.
  build: { outDir: resolve(workspace, "dist"), emptyOutDir: true, minify: false },
}));
