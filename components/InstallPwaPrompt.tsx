import React from "react";
import { usePwaInstallPrompt } from "../services/usePwaInstallPrompt";

export default function InstallPwaPrompt() {
  const { isInstallable, hasInstalled, hasDismissed, install } = usePwaInstallPrompt();

  // Ne rien afficher si :
  // - l'app n'est pas installable
  // - elle est déjà installée
  // - l'utilisateur a déjà refusé
  if (!isInstallable || hasInstalled || hasDismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        padding: "14px 18px",
        background: "#111827",
        color: "white",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 9999,
      }}
    >
      <div style={{ marginRight: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Installer ToonHunter</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Ajoutez ToonHunter sur votre écran d’accueil pour un accès rapide.
        </div>
      </div>

      <button
        onClick={install}
        style={{
          background: "#0f0518",
          color: "white",
          border: "none",
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Installer
      </button>
    </div>
  );
}
