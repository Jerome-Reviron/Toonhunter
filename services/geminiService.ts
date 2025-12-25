import { GoogleGenAI } from "@google/genai";
import { LocationTarget } from "../types";

// Cette déclaration supprime le soulignement rouge dans VS Code pour le côté client
declare var process: {
  env: {
    API_KEY: string;
  };
};

/**
 * Service pour interagir avec l'IA Gemini.
 * Ce service gère l'intégration d'un personnage 3D dans une photo et la génération d'une citation.
 */
export const generateCharacterPhoto = async (
  base64Image: string,
  target: LocationTarget
): Promise<{ image: string; quote: string }> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "") {
    throw new Error(
      "Clé API manquante. Veuillez configurer VITE_API_KEY dans votre environnement."
    );
  }

  // Initialisation de l'API Gemini
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Génération de l'image (Incrustation 3D)
    // On utilise gemini-2.5-flash-image pour l'édition d'image.
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

    // Analyse des candidats pour extraire l'image et potentiellement du texte
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          processedImageBase64 = part.inlineData.data || "";
        } else if (part.text) {
          // Parfois le modèle renvoie aussi du texte dans la même réponse
          generatedQuote = part.text.trim();
        }
      }
    }

    if (!processedImageBase64) {
      throw new Error(
        "Le modèle n'a pas renvoyé d'image traitée (Vérifiez vos quotas)."
      );
    }

    // 2. Génération de la citation si non présente ou trop générique
    // On utilise un modèle de texte plus léger pour la rapidité
    if (!generatedQuote || generatedQuote.length < 5) {
      try {
        const textResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Tu incarnes ${target.characterName}. Dis une phrase courte (maximum 10 mots) et magique pour saluer le visiteur qui vient de te trouver au parc.`,
        });
        generatedQuote =
          textResponse.text || "La magie est partout autour de vous !";
      } catch (textError) {
        console.warn(
          "Échec génération texte, utilisation fallback:",
          textError
        );
        generatedQuote = "Salut ! Content de te rencontrer ici !";
      }
    }

    return {
      image: processedImageBase64,
      quote: generatedQuote,
    };
  } catch (error: any) {
    console.error("[Gemini Service Exception]:", error);

    // Détection spécifique des erreurs de quota pour informer l'utilisateur
    if (error.message?.includes("429") || error.status === 429) {
      throw new Error(
        "Quota d'IA épuisé (Erreur 429). Le parc a atteint sa limite de magie gratuite pour aujourd'hui."
      );
    }

    throw error;
  }
};

/**
 * Fonction utilitaire pour vérifier si un lieu est reconnu (pour une future fonctionnalité de validation).
 */
export const verifyLandmark = async () => true;
