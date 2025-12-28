// // import { defineConfig, loadEnv } from "vite";
// // import react from "@vitejs/plugin-react";

// // // Déclaration manuelle pour supprimer les erreurs TS si @types/node n'est pas encore propagé
// // declare const process: {
// //   cwd: () => string;
// //   env: Record<string, string | undefined>;
// // };

// // export default defineConfig(({ mode }) => {
// //   // Charge les variables d'environnement du fichier .env
// //   // process.cwd() retourne le chemin racine du projet
// //   const env = loadEnv(mode, process.cwd(), "");

// //   return {
// //     plugins: [react()],
// //     define: {
// //       // On injecte la clé API du .env dans le code client
// //       "process.env.API_KEY": JSON.stringify(env.VITE_API_KEY || ""),
// //     },
// //   };
// // });
// import { defineConfig, loadEnv } from "vite";
// import react from "@vitejs/plugin-react";
// import mkcert from "vite-plugin-mkcert";

// // Déclaration manuelle pour supprimer les erreurs TS si @types/node n'est pas encore propagé
// declare const process: {
//   cwd: () => string;
//   env: Record<string, string | undefined>;
// };

// export default defineConfig(({ mode }) => {
//   const env = loadEnv(mode, process.cwd(), "");

//   return {
//     plugins: [
//       react(),
//       mkcert(), // 🔥 Ajout du certificat HTTPS local
//     ],
//     server: {
//       https: true, // 🔥 Active HTTPS en local
//       host: true, // Permet l'accès depuis ton téléphone sur le réseau local
//       port: 5173, // Tu peux changer si besoin
//     },
//     define: {
//       "process.env.API_KEY": JSON.stringify(env.VITE_API_KEY || ""),
//     },
//   };
// });
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

// Déclaration manuelle pour éviter les erreurs TS si @types/node n'est pas chargé
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      mkcert(), // 🔥 Certificat HTTPS local automatique
    ],

    server: {
      https: true, // 🔥 Active HTTPS pour éviter Mixed Content
      host: "0.0.0.0", // 🔥 Permet l'accès depuis ton téléphone
      port: 5173,

      // 🔥 PROXY API — LA CLÉ POUR QUE LE TÉLÉPHONE FONCTIONNE
      proxy: {
        "/api": {
          target: "https://toonhunter.test", // Backend Laragon
          changeOrigin: true,
          secure: false, // Accepte le certificat mkcert
        },
      },
    },

    define: {
      "process.env.API_KEY": JSON.stringify(env.VITE_API_KEY || ""),
    },
  };
});
