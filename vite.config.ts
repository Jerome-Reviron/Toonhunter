import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import fs from "fs";

// Déclaration manuelle pour éviter les erreurs TS si @types/node n'est pas chargé
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), mkcert()],

    server: {
      https: {
        key: fs.readFileSync("./192.168.1.98+3-key.pem"),
        cert: fs.readFileSync("./192.168.1.98+3.pem"),
      },
      host: "0.0.0.0",
      port: 5173,

      hmr: false,

      // 🔥 PROXY API — LA CLÉ POUR QUE LE TÉLÉPHONE FONCTIONNE
      proxy: {
        "/api": {
          target: "http://localhost/toonhunter/api",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },

    define: {
      "process.env.API_KEY": JSON.stringify(env.VITE_API_KEY || ""),
    },
  };
});
