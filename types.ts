import React from "react";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string | number;
  pseudo: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

export interface CollectionItem {
  locationId: string | number;
  photoUrl: string;
  quote: string; // La réplique du Toon
  capturedAt: string;
}

export interface LocationTarget {
  id: string | number;
  name: string;
  description: string;
  coordinates: Coordinates;
  radiusMeters: number;
  characterName: string;
  promptContext: string;
  validationKeywords?: string;
  imageUrl: string;
  rarity: "Commune" | "Rare" | "Légendaire";
  free: boolean;
  parc_id?: number | null;
  hasAccess?: boolean;
}
export interface Parc {
  id: number;
  name: string;
  logo: string; // base64
}

export enum AppState {
  SPLASH = "SPLASH",
  AUTH = "AUTH",
  LIST = "LIST",
  COLLECTION = "COLLECTION",
  ANALYZING = "ANALYZING",
  RESULT = "RESULT",
  ERROR = "ERROR",
  PAYMENT = "PAYMENT",
}

export interface AnalysisResult {
  originalImage: string;
  processedImage: string;
  quote: string;
}
