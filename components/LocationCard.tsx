import React, { useState } from "react";
import { LocationTarget, Coordinates } from "../types";
import {
  MapPin,
  Navigation,
  Star,
  Lock,
  Target,
  Trophy,
  MapPinHouse,
} from "lucide-react";

interface LocationCardProps {
  location: LocationTarget;
  userCoords: Coordinates | null;
  onSelect: (loc: LocationTarget) => void;
  onUnlock: (loc: LocationTarget) => void; // 🔥 AJOUT
  isCollected: boolean;
  hasAccess: boolean;
}

const DEV_MODE = true;

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  userCoords,
  onSelect,
  onUnlock, // 🔥 AJOUT
  isCollected,
  hasAccess,
}) => {
  // ---------------------------------------------------------
  // 🔥 NOUVEAU : état local pour afficher le bouton premium
  // ---------------------------------------------------------
  const [showUnlockButton, setShowUnlockButton] = useState(false);

  const distanceInMeters = DEV_MODE
    ? 0
    : userCoords
      ? calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          location.coordinates.latitude,
          location.coordinates.longitude,
        )
      : null;

  const isNearby = DEV_MODE
    ? true
    : distanceInMeters !== null && distanceInMeters <= location.radiusMeters;

  const distanceDisplay =
    distanceInMeters !== null
      ? distanceInMeters < 5
        ? "Sur place"
        : distanceInMeters < 1000
          ? `${distanceInMeters.toFixed(1)}m`
          : `${(distanceInMeters / 1000).toFixed(2)}km`
      : "Localisation...";

  const borderColor =
    location.rarity === "Légendaire"
      ? "border-amber-400"
      : location.rarity === "Rare"
        ? "border-purple-400"
        : "border-blue-400";

  const badgeColor =
    location.rarity === "Légendaire"
      ? "bg-amber-400 text-black"
      : location.rarity === "Rare"
        ? "bg-purple-500 text-white"
        : "bg-blue-500 text-white";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
        isCollected
          ? "border-emerald-500 bg-emerald-900/10"
          : !hasAccess
            ? "border-gray-800 bg-gray-900/40 opacity-70"
            : `${borderColor} bg-gray-900/60`
      } backdrop-blur-md shadow-lg`}
      // ---------------------------------------------------------
      // 🔥 CLIC SUR LA CARTE VERROUILLÉE → afficher bouton premium
      // ---------------------------------------------------------
      onClick={() => {
        if (!hasAccess && !isCollected) {
          setShowUnlockButton(true);
        }
      }}
    >
      {/* IMAGE */}
      <div className="h-32 w-full relative">
        <img
          src={location.imageUrl}
          alt={location.name}
          className={`h-full w-full object-cover ${
            !hasAccess || isCollected ? "opacity-40" : "opacity-60"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>

        {isCollected && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10">
            <Trophy className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
          </div>
        )}
      </div>

      {/* CONTENU */}
      <div className="p-4 relative">
        <div className="absolute -top-6 right-4">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg ${badgeColor} flex items-center gap-1`}
          >
            <Star className="w-3 h-3 fill-current" /> {location.rarity}
          </span>
        </div>

        <h3
          className={`text-xl font-black font-display mb-1 ${!hasAccess ? "text-gray-500" : "text-white"}`}
        >
          {location.characterName}
        </h3>

        <p className="text-xs text-white/80 mb-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {location.name}
        </p>

        {location.description && (
          <p className="text-xs text-gray-400 mb-1 leading-snug">
            {location.description}
          </p>
        )}

        {/* BAS DE CARTE */}
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-white/5">
          <div
            className={`flex items-center text-xs font-bold ${
              !hasAccess
                ? "text-gray-600"
                : distanceInMeters !== null && distanceInMeters < 5
                  ? "text-emerald-400 animate-pulse"
                  : "text-pink-400"
            }`}
          >
            {distanceInMeters !== null && distanceInMeters < 5 ? (
              <MapPinHouse className="w-3 h-3 mr-1" />
            ) : (
              <Navigation className="w-3 h-3 mr-1" />
            )}
            {distanceDisplay}
          </div>

          <div className="flex flex-col gap-2 items-end">
            {/* 🔥 BOUTON PREMIUM QUI APPARAÎT APRÈS CLIC */}
            {!hasAccess && !isCollected && showUnlockButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlock(location);
                }}
                className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide bg-gradient-to-r from-yellow-400 to-pink-500 text-black shadow-lg active:scale-95"
              >
                ✨ Débloquer la Magie
              </button>
            )}

            {/* BOUTON CAPTURE / VERROUILLÉ */}
            {!isCollected ? (
              <button
                onClick={() => hasAccess && onSelect(location)}
                className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all shadow-lg flex items-center gap-2 ${
                  !hasAccess
                    ? "bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed"
                    : isNearby
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white active:scale-95"
                      : "bg-gray-800 text-gray-400 cursor-default"
                }`}
              >
                {!hasAccess ? (
                  <>
                    <Lock className="w-3 h-3" /> Verrouillé
                  </>
                ) : isNearby ? (
                  <>
                    <Target className="w-3 h-3" /> Capturer
                  </>
                ) : (
                  "Trop loin"
                )}
              </button>
            ) : (
              <button
                onClick={() => onSelect(location)}
                className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-2 hover:bg-emerald-500/30 transition-all active:scale-95"
              >
                <Trophy className="w-3 h-3" /> Album
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
