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
      const response = await fetch(`/api/collection.php?user_id=${userId}`);
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
    quote: string
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
        JSON.stringify(current)
      );

      return item;
    }

    try {
      const response = await fetch("/api/collection.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          locationId,
          photoUrl: photoBase64,
          quote,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur API");
      }

      const data = await response.json();
      return data.item || null;

      // Le backend renvoie maintenant l'objet complet
      return data.item || null;
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

    // TODO: suppression backend si besoin
  },
};
