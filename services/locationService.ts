import { LocationTarget } from "../types";
import { API_CONFIG } from "../config";
import { TARGET_LOCATIONS } from "../constants";

export const locationService = {
  // ---------------------------------------------------------
  // GET : récupérer les locations d’un parc
  // ---------------------------------------------------------
  getAll: async (parcId?: number): Promise<LocationTarget[]> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      return TARGET_LOCATIONS;
    }

    try {
      const url = parcId
        ? `/api/locations.php?parc_id=${parcId}`
        : `/api/locations.php`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Erreur chargement lieux");

      const data = await response.json();

      if (data.success && Array.isArray(data.locations)) {
        return data.locations;
      }

      return [];
    } catch (e) {
      console.error("Erreur API Locations:", e);
      return [];
    }
  },

  // ---------------------------------------------------------
  // POST : créer une nouvelle location
  // ---------------------------------------------------------
  create: async (location: LocationTarget): Promise<LocationTarget> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      return { ...location, id: Date.now().toString() };
    }

    const response = await fetch("/api/locations.php", {
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

    const response = await fetch("/api/locations.php", {
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
  delete: async (id: number, userId: number) => {
    const response = await fetch("/api/locations.php", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error("Erreur suppression lieu");
    }

    return true;
  },
};
