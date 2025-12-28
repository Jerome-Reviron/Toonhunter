import { LocationTarget } from "../types";
import { API_CONFIG } from "../config";
import { TARGET_LOCATIONS } from "../constants";

export const locationService = {
  // ---------------------------------------------------------
  // GET : récupérer toutes les locations
  // ---------------------------------------------------------
  getAll: async (): Promise<LocationTarget[]> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      return TARGET_LOCATIONS;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/locations.php`);
      if (!response.ok) throw new Error("Erreur chargement lieux");

      const data = await response.json();

      // Nouveau format backend : { success: true, locations: [...] }
      if (data.success && Array.isArray(data.locations)) {
        return data.locations;
      }

      return TARGET_LOCATIONS;
    } catch (e) {
      console.error("Erreur API Locations, fallback to constants:", e);
      return TARGET_LOCATIONS;
    }
  },

  // ---------------------------------------------------------
  // POST : créer une nouvelle location
  // ---------------------------------------------------------
  create: async (location: LocationTarget): Promise<LocationTarget> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      return { ...location, id: Date.now().toString() };
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/locations.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
    });

    const data = await response.json();

    if (data.success && data.id) {
      return { ...location, id: data.id };
    }

    throw new Error("Erreur création lieu");
  },

  // ---------------------------------------------------------
  // PUT : mettre à jour une location existante
  // ---------------------------------------------------------
  update: async (location: LocationTarget): Promise<LocationTarget> => {
    if (API_CONFIG.USE_MOCK_DATA) return location;

    const response = await fetch(`${API_CONFIG.BASE_URL}/locations.php`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error("Erreur mise à jour lieu");
    }

    return location;
  },

  // ---------------------------------------------------------
  // DELETE : supprimer une location
  // ---------------------------------------------------------
  delete: async (id: string | number): Promise<void> => {
    if (API_CONFIG.USE_MOCK_DATA) return;

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/locations.php?id=${id}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error("Erreur suppression lieu");
    }
  },
};
