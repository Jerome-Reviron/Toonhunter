import { LocationTarget } from "./types";

// Location specific to the user's request (45.7122501, 3.190665)
export const TARGET_LOCATIONS: LocationTarget[] = [
  {
    id: "tasse-magique",
    name: "La Tasse Magique",
    description:
      "TEST: Une tasse standard. Mickey apparaîtra en version MINIATURE assis sur le bord.",
    coordinates: {
      latitude: 45.7122501,
      longitude: 3.190665,
    },
    radiusMeters: 9999999,
    characterName: "Mickey Miniature",
    rarity: "Common",
    // Le mot clé "Miniature figurine" force la petite taille
    promptContext:
      "A tiny 3D miniature figurine of Mickey Mouse sitting on the RIM/EDGE of the cup behind the handle. The cup handle should partially block the view of Mickey. He is small and waving.",
    validationKeywords: "cup, mug, coffee cup, tea cup, tasse",
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
  },
  {
    id: "salon-geant",
    name: "Le Salon (Test Sol)",
    description:
      "TEST: Vise le sol ou une pièce vide. Mickey apparaîtra pour une photo souvenir avec toi.",
    coordinates: {
      latitude: 45.7122501,
      longitude: 3.190665,
    },
    radiusMeters: 9999999,
    characterName: "Mickey Mascotte",
    rarity: "Legendary",
    // Prompt modifié pour insister sur la position ARRIÈRE et l'occlusion
    promptContext:
      "3D Mickey Mouse peaking out from BEHIND the person's shoulder. The person is in the foreground and BLOCKS part of Mickey's body. Mickey is standing on the floor in the background. He is waving hello. Realistic fur texture, soft lighting, Pixar style rendering.",
    validationKeywords:
      "floor, ground, carpet, room, floor tiles, parquet, sol",
    imageUrl:
      "https://images.unsplash.com/photo-1581456495146-65a71b2c8e52?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
  },
  {
    id: "lion-gardien",
    name: "Le Lion Gardien",
    description:
      "TEST: Un lion majestueux qui veille sur vous. Vise le sol ou un endroit spacieux.",
    coordinates: {
      latitude: 45.7122501,
      longitude: 3.190665,
    },
    radiusMeters: 9999999,
    characterName: "Lion Majestueux",
    rarity: "Rare",
    promptContext:
      "A friendly 3D CGI LION with a golden mane. He is standing BEHIND the human subject, peeking over their shoulder. The person blocks part of the lion's body. Realistic fur, bright eyes, Pixar style. NOT a monster, but a Lion.",
    validationKeywords: "floor, ground, carpet, lion, cat, animal",
    imageUrl:
      "https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
  },
];

export const GOOGLE_MAPS_URL = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
