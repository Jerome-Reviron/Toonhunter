import React from "react";
import "./splash.css"; // le fichier CSS que je te donne plus bas

export default function SplashScreen() {
  return (
    <div className="splash-container">
      <img
        src="/Toonhunter-logo.png" // mets ton logo ici
        alt="ToonHunter Logo"
        className="splash-logo"
      />
    </div>
  );
}
