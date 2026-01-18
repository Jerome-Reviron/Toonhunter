import { API_CONFIG } from "../config";
import { CollectionItem } from "../types";

const MOCK_COLLECTION_KEY = "toonhunter_mock_collection";

export const collectionService = {
  getUserCollection: async (
    userId: string | number,
  ): Promise<Record<string, CollectionItem>> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      const stored = localStorage.getItem(`${MOCK_COLLECTION_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : {};
    }

    try {
      const response = await fetch(`/api/collection.php?userId=${userId}`);
      const data = await response.json();

      return data.collection || {};
    } catch (e) {
      console.error("Erreur collection API:", e);
      return {};
    }
  },

  addTrophy: async (
    userId: string | number,
    locationId: string | number,
    photoBase64: string,
    quote: string,
  ): Promise<CollectionItem | null> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      const current = await collectionService.getUserCollection(userId);
      const item: CollectionItem = {
        locationId,
        photoUrl: photoBase64,
        quote,
        capturedAt: new Date().toISOString(),
      };
      current[locationId] = item;

      localStorage.setItem(
        `${MOCK_COLLECTION_KEY}_${userId}`,
        JSON.stringify(current),
      );

      return item;
    }

    // 👉 PLUS AUCUN APPEL BACKEND ICI
    // Gemini a déjà inséré en BDD.
    // On renvoie simplement l’item pour que handleCapture fonctionne.

    try {
      const item: CollectionItem = {
        locationId,
        photoUrl: photoBase64,
        quote,
        capturedAt: new Date().toISOString(),
      };

      return item;
    } catch (e) {
      console.error("Erreur addTrophy:", e);
      return null;
    }
  },
};
