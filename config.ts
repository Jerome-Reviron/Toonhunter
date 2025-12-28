// // Configuration de l'API
// export const API_CONFIG = {
//   BASE_URL: "https://toonhunter.test/api",
//   USE_MOCK_DATA: false,
// };
// Configuration de l'API avec détection automatique mobile/PC

// const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// // IP locale de ton PC (à adapter si elle change)
// const LOCAL_PC_IP = "192.168.1.98";

// // URL backend selon le contexte
// const BASE_URL = isMobileDevice
//   ? `https://${LOCAL_PC_IP}/api` // Pour téléphone
//   : "https://toonhunter.test/api"; // Pour PC

// export const API_CONFIG = {
//   BASE_URL,
//   USE_MOCK_DATA: false,
// };
export const API_CONFIG = {
  BASE_URL: "/api",
  USE_MOCK_DATA: false,
};
