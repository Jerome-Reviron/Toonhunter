import { API_CONFIG } from "../config";
import { CollectionItem } from "../types";

const MOCK_COLLECTION_KEY = "toonhunter_mock_collection";

export const collectionService = {
  getUserCollection: async (
    userId: string | number
  ): Promise<Record<string, CollectionItem>> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      const stored = localStorage.getItem(`${MOCK_COLLECTION_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : {};
    }

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/collection.php?user_id=${userId}`
      );
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
    photoUrl: string, // base64 envoyé ici
    quote: string
  ): Promise<string | null> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      const current = await collectionService.getUserCollection(userId);
      current[locationId] = {
        locationId,
        photoUrl,
        quote,
        capturedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        `${MOCK_COLLECTION_KEY}_${userId}`,
        JSON.stringify(current)
      );
      return photoUrl;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/collection.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, locationId, photoUrl, quote }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error("Erreur API addTrophy:", data);
        return null;
      }

      // Le backend renvoie l’URL publique du fichier
      return data.photoUrl || null;
    } catch (e) {
      console.error("Erreur addTrophy:", e);
      return null;
    }
  },

  removeTrophy: async (
    userId: string | number,
    locationId: string | number
  ): Promise<void> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      const current = await collectionService.getUserCollection(userId);
      delete current[locationId];
      localStorage.setItem(
        `${MOCK_COLLECTION_KEY}_${userId}`,
        JSON.stringify(current)
      );
      return;
    }

    // TODO: ajouter suppression côté backend si nécessaire
  },
};
