import { LocationTarget } from "../types";
import { authService } from "./authService";

/**
 * Service pour interagir avec le backend Gemini.
 * Envoie l'image au backend PHP qui appelle Gemini 2.5 Flash Image via OAuth.
 */
export const generateCharacterPhoto = async (
  base64Image: string,
  target: LocationTarget
): Promise<{ image: string; quote: string }> => {
  console.log("📸 [Gemini] generateCharacterPhoto() appelé");
  console.log("📤 [Gemini] Taille image base64 envoyée :", base64Image.length);
  console.log("🎯 [Gemini] Target envoyé :", target);

  try {
    console.log("🌐 [Gemini] Envoi du fetch → /api/gemini.php");
    const user = authService.getCurrentUser();
    const response = await fetch("/api/gemini.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image, target, userId: user?.id }),
    });

    console.log("📥 [Gemini] Réponse brute reçue :", response);

    const rawText = await response.text();

    console.log("📏 [Gemini] Taille JSON brut :", rawText.length);
    console.log("📄 [Gemini] Début JSON :", rawText.slice(0, 200), "...");

    if (!response.ok) {
      throw new Error("Erreur backend IA : statut HTTP " + response.status);
    }

    if (rawText.trim().startsWith("<")) {
      throw new Error("Erreur backend IA : contenu HTML reçu");
    }

    console.log("🔍 [Gemini] Tentative de parse JSON…");
    const data = JSON.parse(rawText);
    console.log("✅ [Gemini] JSON parsé :", data);

    // 👉 NOUVELLE STRUCTURE : on lit directement l’item renvoyé par le backend
    if (!data.success || !data.item) {
      throw new Error("Réponse backend invalide");
    }

    const photoUrl = data.item.photoUrl;
    const quote = data.item.quote;

    if (!photoUrl) {
      throw new Error("Aucune image renvoyée par le backend");
    }

    console.log("🎉 [Gemini] Success → image + quote renvoyées");

    return {
      image: photoUrl,
      quote: quote,
    };
  } catch (error: any) {
    console.error("🔥 [Gemini] ERREUR CAPTURE :", error);
    throw new Error("Erreur IA : " + error.message);
  }
};

/**
 * Fonction utilitaire (placeholder pour l'avenir)
 */
export const verifyLandmark = async () => true;
