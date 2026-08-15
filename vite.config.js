import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    target: env.KALION_BACKEND_URL || "http://127.0.0.1:3001",
    headers: env.KALION_INTERNAL_API_KEY ? { "x-kalion-api-key": env.KALION_INTERNAL_API_KEY } : {},
  };
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": proxy,
        "/kalion-api": {
          ...proxy,
          rewrite: (path) => path.replace(/^\/kalion-api/, "/api"),
        },
        "/webhooks": proxy,
      },
    },
  };
});
