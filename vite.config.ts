import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Déclaration manuelle pour supprimer les erreurs TS si @types/node n'est pas encore propagé
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement du fichier .env
  // process.cwd() retourne le chemin racine du projet
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      // On injecte la clé API du .env dans le code client
      "process.env.API_KEY": JSON.stringify(env.VITE_API_KEY || ""),
    },
  };
});
