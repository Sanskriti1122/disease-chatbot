import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/predict-image": "http://127.0.0.1:8002",
      "/chat-symptoms": "http://127.0.0.1:8002",
    },
  },
});
