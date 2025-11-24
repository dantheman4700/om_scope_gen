import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    proxy: {
      // FastAPI backend on http://localhost:8000
      "/auth": "http://localhost:8000",
      "/deals": "http://localhost:8000",
      "/teams": "http://localhost:8000",
      "/listings": "http://localhost:8000",
      "/runs": "http://localhost:8000",
      "/artifacts": "http://localhost:8000",
      "/oms": "http://localhost:8000",
      "/system": "http://localhost:8000",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
