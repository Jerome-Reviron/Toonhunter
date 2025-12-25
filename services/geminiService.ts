import { GoogleGenAI } from "@google/genai";
import { LocationTarget } from "../types";

// Initialisation de l'IA
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Génère le personnage Toon en un seul appel.
 * Version utilisant gemini-2.5-flash-image pour une meilleure intégration.
 */
export const generateCharacterPhoto = async (
  base64Image: string,
  target: LocationTarget
): Promise<{ image: string; quote: string }> => {
  try {
    if (!base64Image) throw new Error("Image source manquante");

    console.log(
      `[Gemini] Tentative de génération pour: ${target.characterName}`
    );

    // 1. Génération de l'image (Gemini 2.5 Flash Image)
    // On utilise un prompt très direct pour éviter que le modèle ne fasse que décrire l'image
    const imageResponse = await ai.models.generateContent({
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
            text: `COMMAND: Modify this image. Add a 3D Pixar-style character named "${target.characterName}" into the scene. 
            Context: ${target.promptContext}. 
            The character MUST be integrated naturally with realistic shadows and lighting. 
            Interaction: If there is a ${target.validationKeywords}, the character should be placed relative to it.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        },
      },
    });

    let processedImage = null;

    // Vérification rigoureuse des candidats
    if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          processedImage = part.inlineData.data;
          break;
        }
      }
    }

    // Si aucune image n'a été générée (le modèle a peut-être juste répondu par du texte)
    if (!processedImage) {
      console.error(
        "[Gemini] Le modèle n'a pas renvoyé d'image. Contenu reçu:",
        imageResponse.text
      );
      throw new Error(
        "Le personnage n'a pas pu se matérialiser. Réessayez avec une meilleure luminosité."
      );
    }

    // 2. Génération de la réplique
    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tu es ${target.characterName}. L'utilisateur vient de te trouver dans la vie réelle grâce à sa caméra. Dis une phrase très courte (max 8 mots), joyeuse et magique pour le saluer.`,
    });

    console.log("[Gemini] Génération réussie !");

    return {
      image: processedImage,
      quote: textResponse.text || `Oh, tu m'as trouvé ! ✨`,
    };
  } catch (error: any) {
    console.error("[Gemini Service Error]:", error);
    throw error;
  }
};

export const verifyLandmark = async () => true;
