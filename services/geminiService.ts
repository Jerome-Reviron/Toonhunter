import { LocationTarget } from "../types";

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

    const response = await fetch("/api/gemini.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image, target }),
    });

    console.log("📥 [Gemini] Réponse brute reçue :", response);

    const rawText = await response.text();
    console.log(
      "📄 [Gemini] Contenu brut reçu :",
      rawText.slice(0, 200),
      "..."
    );

    // 🔍 Vérifie si le backend a renvoyé du HTML au lieu de JSON
    if (!response.ok) {
      console.error("❌ [Gemini] Statut HTTP non OK :", response.status);
      throw new Error("Erreur backend IA : statut HTTP " + response.status);
    }

    if (rawText.trim().startsWith("<")) {
      console.error("❌ [Gemini] Le backend renvoie du HTML :", rawText);
      throw new Error("Erreur backend IA : contenu HTML reçu");
    }

    console.log("🔍 [Gemini] Tentative de parse JSON…");

    const data = JSON.parse(rawText);
    console.log("✅ [Gemini] JSON parsé :", data);

    const candidate = data.candidates?.[0];
    let processedImageBase64 = "";
    let generatedQuote = "";

    if (candidate?.content?.parts) {
      console.log(
        "🧩 [Gemini] Parts trouvées :",
        candidate.content.parts.length
      );

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          console.log("🖼️ [Gemini] Image traitée trouvée");
          processedImageBase64 = part.inlineData.data;
        } else if (part.text) {
          console.log("💬 [Gemini] Texte trouvé :", part.text);
          generatedQuote = part.text.trim();
        }
      }
    } else {
      console.warn("⚠️ [Gemini] Aucun candidate.content.parts trouvé");
    }

    if (!processedImageBase64) {
      console.error("❌ [Gemini] Aucune image traitée renvoyée");
      throw new Error("Le modèle n'a pas renvoyé d'image traitée.");
    }

    if (!generatedQuote || generatedQuote.length < 5) {
      console.warn("⚠️ [Gemini] Citation vide → fallback");
      generatedQuote = "Bienvenue au parc ToonHunter !";
    }

    console.log("🎉 [Gemini] Succès → image + quote renvoyées");

    return {
      image: processedImageBase64,
      quote: generatedQuote,
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
