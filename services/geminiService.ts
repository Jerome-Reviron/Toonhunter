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
 */
export const generateCharacterPhoto = async (
  base64Image: string,
  target: LocationTarget
): Promise<{ image: string; quote: string }> => {
  // Utilisation stricte de process.env.API_KEY injectée par Vite
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "") {
    throw new Error("Clé API manquante dans le fichier .env (VITE_API_KEY)");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Génération de l'image (Toonification)
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
            text: `COMMAND: Add a 3D Pixar-style ${target.characterName} into this photo. 
            Placement: ${target.promptContext}. 
            The character must be high-quality 3D, perfectly integrated with shadows and lighting.`,
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

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          // Correction TypeScript: on assure que data n'est pas undefined
          processedImageBase64 = part.inlineData.data || "";
        } else if (part.text) {
          // Correction TypeScript: on assure que text n'est pas undefined
          generatedQuote = part.text || "";
        }
      }
    }

    if (!processedImageBase64) {
      throw new Error("L'image n'a pas pu être générée.");
    }

    // 2. Génération de la citation si non présente dans la première réponse
    if (!generatedQuote) {
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tu es ${target.characterName}. Dis une phrase de 8 mots max pour saluer l'utilisateur.`,
      });
      generatedQuote = textResponse.text || "Salut !";
    }

    return {
      image: processedImageBase64,
      quote: generatedQuote,
    };
  } catch (error: any) {
    console.error("[Gemini Error]:", error);
    throw error;
  }
};

export const verifyLandmark = async () => true;
