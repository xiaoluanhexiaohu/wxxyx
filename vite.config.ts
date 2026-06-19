import { defineConfig } from "vite";
import rawUni from "@dcloudio/vite-plugin-uni";

const uni = typeof rawUni === "function" ? rawUni : (rawUni as unknown as { default: typeof rawUni }).default;

export default defineConfig({
  plugins: [uni()],
  esbuild: {
    target: "es2015",
  },
  build: {
    target: "es2015",
  },
});
