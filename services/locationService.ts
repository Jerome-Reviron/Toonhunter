import { LocationTarget } from "../types";
import { API_CONFIG } from "../config";
import { TARGET_LOCATIONS } from "../constants";

export const locationService = {
  getAll: async (): Promise<LocationTarget[]> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      return TARGET_LOCATIONS;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/locations.php`);
      if (!response.ok) throw new Error("Erreur chargement lieux");
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? data : TARGET_LOCATIONS;
    } catch (e) {
      console.error("Erreur API Locations, fallback to constants:", e);
      return TARGET_LOCATIONS;
    }
  },

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

  update: async (location: LocationTarget): Promise<LocationTarget> => {
    return location;
  },

  delete: async (id: string | number): Promise<void> => {
    return;
  },
};
