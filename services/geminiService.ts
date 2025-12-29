import { GoogleGenAI } from "@google/genai";
import { LocationTarget } from "../types";

// Déclaration pour éviter les erreurs TypeScript avec import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_API_KEY: string;
    };
  }
}

/**
 * Service pour interagir avec l'IA Gemini.
 * Gère l'incrustation 3D + la génération d'une citation.
 */
export const generateCharacterPhoto = async (
  base64Image: string,
  target: LocationTarget
): Promise<{ image: string; quote: string }> => {
  const apiKey = import.meta.env.VITE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Clé API manquante. Ajoutez VITE_API_KEY dans votre fichier .env du frontend."
    );
  }

  // Initialisation de l'API Gemini
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Génération de l'image (incrustation 3D)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `INSTRUCTION: Add a high-quality 3D Pixar-style character named "${target.characterName}" into this photo.
            Placement context: ${target.promptContext}.
            Requirements: The character must look like a 3D asset perfectly integrated with correct lighting, shadows, and depth (occlusion).
            Final Output: The modified image.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        },
      },
    });

    let processedImageBase64 = "";
    let generatedQuote = "";

    // Extraction de l'image et du texte
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          processedImageBase64 = part.inlineData.data || "";
        } else if (part.text) {
          generatedQuote = part.text.trim();
        }
      }
    }

    if (!processedImageBase64) {
      throw new Error(
        "Le modèle n'a pas renvoyé d'image traitée (vérifiez vos quotas)."
      );
    }

    // 2. Génération d'une citation si absente
    if (!generatedQuote || generatedQuote.length < 5) {
      try {
        const textResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Tu incarnes ${target.characterName}. Dis une phrase courte (max 10 mots) et magique pour saluer le visiteur.`,
        });

        generatedQuote =
          textResponse.text || "La magie est partout autour de vous !";
      } catch {
        generatedQuote = "Salut ! Content de te rencontrer ici !";
      }
    }

    return {
      image: processedImageBase64,
      quote: generatedQuote,
    };
  } catch (error: any) {
    console.error("[Gemini Service Exception]:", error);

    if (error.message?.includes("429") || error.status === 429) {
      throw new Error(
        "Quota d'IA épuisé (Erreur 429). Le parc a atteint sa limite de magie gratuite pour aujourd'hui."
      );
    }

    throw error;
  }
};

/**
 * Fonction utilitaire (placeholder pour l'avenir)
 */
export const verifyLandmark = async () => true;
