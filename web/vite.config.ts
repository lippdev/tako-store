import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // A 5173 é do Tako Launcher; a loja usa a seguinte.
    port: 5174,
    strictPort: true,
    open: "/#/componentes",
  },
  build: {
    target: "es2023",
  },
});
