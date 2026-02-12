import React, { useState, useEffect, useRef } from "react";
import {
  Coordinates,
  LocationTarget,
  AppState,
  AnalysisResult,
  User,
  CollectionItem,
} from "./types";
import { LocationCard } from "./components/LocationCard";
import { AdminPanel } from "./components/AdminPanel";
import { AuthScreen } from "./components/AuthScreen";
import { authService } from "./services/authService";
import { locationService } from "./services/locationService";
import { collectionService } from "./services/collectionService";
import { generateCharacterPhoto } from "./services/geminiService";
import SplashScreen from "./components/SplashScreen/SplashScreen";
import ParcSelector from "./components/ParcSelector";
import InstallPwaPrompt from "./components/InstallPwaPrompt";
import {
  Map,
  Trophy,
  Lock,
  LogOut,
  X,
  Download,
  Sparkles,
  AlertTriangle,
  Navigation2,
  Radar,
  CircleDot,
  CircleHelp,
  Loader2,
  Send,
  Upload,
  RefreshCcw,
} from "lucide-react";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locations, setLocations] = useState<LocationTarget[]>([]);
  const [allLocations, setAllLocations] = useState<LocationTarget[]>([]);
  const [sortedLocations, setSortedLocations] = useState<LocationTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<LocationTarget | null>(
    null,
  );
  const [appState, setAppState] = useState<AppState>(AppState.SPLASH);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [showViewer, setShowViewer] = useState<{
    isOpen: boolean;
    item?: CollectionItem;
    target?: LocationTarget;
  }>({ isOpen: false });
  const [collection, setCollection] = useState<Record<string, CollectionItem>>(
    {},
  );
  const [currentTab, setCurrentTab] = useState<"map" | "collection" | "admin">(
    "map",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isDataReady, setIsDataReady] = useState(false);
  const [adminAccessDenied, setAdminAccessDenied] = useState(false);
  const [selectedParcId, setSelectedParcId] = useState<number | null>(() => {
    const stored = localStorage.getItem("selected_parc_id");
    return stored ? parseInt(stored) : null;
  });

  // ---------------------------------------------------------
  // 🔥 Décompte automatique
  // ---------------------------------------------------------

  useEffect(() => {
    if (appState === AppState.ANALYZING && countdown > 0) {
      const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [appState, countdown]);

  function compressBase64(base64: string, quality = 0.6): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx!.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.src = base64;
    });
  }

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

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Full = ev.target?.result as string;
      e.target.value = "";

      // Compression
      const compressedFull = await compressBase64(base64Full, 0.6);

      // 🔥 Correction : enlever le header SEULEMENT s'il existe
      const base64 = compressedFull.includes(",")
        ? compressedFull.split(",")[1]
        : compressedFull;

      handleCapture(base64);
    };

    reader.readAsDataURL(file);
  };

  const handleCapture = async (base64Image: string) => {
    if (!selectedTarget || !user) return;

    // ---------------------------------------------------------
    // 🚨 Vérification premium CÔTÉ FRONT
    // ---------------------------------------------------------

    // Si la location est gratuite → pas besoin de premium
    if (selectedTarget.free) {
      console.log("Lieu gratuit → capture autorisée sans premium");
      await new Promise((r) => setTimeout(r, 200));
    } else {
      // Sinon → vérifier premium côté backend
      try {
        const res = await fetch(
          `/api/check_premium.php?parc_id=${selectedParcId}`,
        );
        const data = await res.json();

        if (!res.ok || !data.success || data.isPremium !== true) {
          setErrorMessage("Accès premium requis.");
          setAppState(AppState.ERROR);
          return;
        }
      } catch (e) {
        console.error("Erreur check_premium:", e);
        setErrorMessage("Erreur de vérification de l'accès premium.");
        setAppState(AppState.ERROR);
        return;
      }
    }

    // 🔥 Si premium confirmé OU lieu gratuit → on peut lancer le workflow

    // ---------------------------------------------------------
    // 🔒 Vérification session AVANT capture (important)
    // ---------------------------------------------------------
    try {
      const sessionCheck = await fetch("/api/get_user_refresh.php", {
        credentials: "include",
      });

      if (sessionCheck.status === 401) {
        window.location.href = "/login";
        return;
      }
    } catch (e) {
      console.error("Erreur check session:", e);
      window.location.href = "/login";
      return;
    }

    setCountdown(5);
    setIsDataReady(false);
    setAppState(AppState.ANALYZING);
    setErrorMessage(null);

    try {
      const result = await generateCharacterPhoto(base64Image, selectedTarget);
      const savedItem = await collectionService.addTrophy(
        user.id,
        selectedTarget.id,
        result.image,
        result.quote,
      );

      if (!savedItem) {
        throw new Error("Erreur sauvegarde BDD : savedItem est null");
      }

      setAnalysisResult({
        originalImage: `data:image/jpeg;base64,${base64Image}`,
        processedImage: `data:image/jpeg;base64,${savedItem.photoUrl}`,
        quote: savedItem.quote,
      });

      setCollection((prev) => ({
        ...prev,
        [selectedTarget.id]: savedItem,
      }));

      setIsDataReady(true);
    } catch (error) {
      console.error("Capture Error:", error);
      setErrorMessage("Une interférence magique empêche la matérialisation.");
      setAppState(AppState.ERROR);
    }
  };

  const fetchAllLocations = async () => {
    try {
      const data = await locationService.getAll(); // 🔥 sans parc_id
      setAllLocations(data);
    } catch (err) {
      console.error("Erreur chargement locations globales", err);
    }
  };

  // ---------------------------------------------------------
  // Empêcher le reload automatique après capture (Android / Chrome bug)
  // ---------------------------------------------------------
  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);
  useEffect(() => {
    const preventReload = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener("pageshow", preventReload);
    return () => window.removeEventListener("pageshow", preventReload);
  }, []);

  // ---------------------------------------------------------
  // Chargement utilisateur (sans changer l'état)
  // ---------------------------------------------------------
  const checkSession = async () => {
    try {
      const res = await fetch("/api/get_user_refresh.php", {
        credentials: "include",
      });

      if (res.status === 200) {
        const data = await res.json();
        setUser(data.user);
        setAppState(AppState.LIST);
      } else {
        setAppState(AppState.AUTH);
      }
    } catch {
      setAppState(AppState.AUTH);
    }
  };

  // ---------------------------------------------------------
  // Chargement des données du parc
  // ---------------------------------------------------------
  useEffect(() => {
    if (appState === AppState.LIST && user) {
      const loadData = async () => {
        try {
          const [locs, col, allLocs] = await Promise.all([
            locationService.getAll(selectedParcId ?? undefined), // filtré parc
            collectionService.getUserCollection(user.id),
            locationService.getAll(), // 🔥 toutes les locations pour l’admin
          ]);

          setLocations(locs); // pour map / collection
          setCollection(col);
          setAllLocations(allLocs); // pour AdminPanel
        } catch (e) {
          console.error("Load error:", e);
        }
      };
      loadData();
    }
  }, [appState, user, selectedParcId]);

  // ---------------------------------------------------------
  // Filtrage des locations selon le parc choisi
  // ---------------------------------------------------------
  const filteredLocations = locations.filter(
    (loc) => loc.parc_id === selectedParcId,
  );

  const SCAN_RADIUS = 50; // rayon global du radar

  const nearbyCount = filteredLocations.filter((loc) => {
    if (!userLocation) return false;

    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      loc.coordinates.latitude,
      loc.coordinates.longitude,
    );

    return dist <= SCAN_RADIUS;
  }).length;

  // ---------------------------------------------------------
  // Tri automatique par distance + polling léger (30s)
  // ---------------------------------------------------------
  useEffect(() => {
    // Si pas de GPS ou pas de locations → on garde tel quel
    if (!userLocation || filteredLocations.length === 0) {
      setSortedLocations(filteredLocations);
      return;
    }

    // 1) On calcule les distances une seule fois
    const sorted = [...filteredLocations]
      .map((loc) => ({
        ...loc,
        _dist: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          loc.coordinates.latitude,
          loc.coordinates.longitude,
        ),
      }))
      .sort((a, b) => a._dist - b._dist);

    // 2) Séparation gratuit / payant
    const freeLocations = sorted.filter((loc) => loc.free === true);
    const paidLocations = sorted.filter((loc) => loc.free !== true);

    // 3) Ordre final selon accès premium
    const finalList = paidLocations.every((loc) => loc.hasAccess === true)
      ? sorted
      : [...freeLocations, ...paidLocations];

    // 4) 🔥 IMPORTANT : on compare avant de setState pour éviter les boucles infinies
    setSortedLocations((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(finalList)) {
        return prev; // rien n’a changé → pas de rerender
      }
      return finalList;
    });
  }, [userLocation, filteredLocations]);

  // ---------------------------------------------------------
  // Rechargement des locations quand on change de parc
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedParcId) return;
    if (!user) return;

    locationService.getAll(selectedParcId).then((data) => {
      setLocations(data);
    });
  }, [selectedParcId]);

  // ---------------------------------------------------------
  // GPS (corrigé pour éviter les micro-rerenders inutiles)
  // ---------------------------------------------------------
  useEffect(() => {
    // 🔒 On bloque toute mise à jour GPS pendant l’analyse
    if (appState === AppState.ANALYZING) return;

    // ✅ Si l’utilisateur est connecté et que le GPS est dispo
    if (user && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          // 🧠 Vérifie si la position a réellement changé (tolérance ≈ 1 mètre)
          setUserLocation((prev) => {
            const hasChanged =
              !prev ||
              Math.abs(prev.latitude - newCoords.latitude) > 0.00001 ||
              Math.abs(prev.longitude - newCoords.longitude) > 0.00001;

            return hasChanged ? newCoords : prev;
          });
        },
        (err) => console.error("GPS Error:", err),
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );

      // 🧹 Nettoyage du watcher GPS à chaque changement d’état
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [appState]);

  // ---------------------------------------------------------
  // SPLASH SCREEN → transition automatique
  // ---------------------------------------------------------
  useEffect(() => {
    if (appState !== AppState.SPLASH) return;

    const timer = setTimeout(() => {
      checkSession(); // 🔥 vérification réelle côté serveur
    }, 3500);

    return () => clearTimeout(timer);
  }, [appState]);

  // ---------------------------------------------------------
  // Déconnexion
  // ---------------------------------------------------------
  const handleLogout = async () => {
    // 🔥 Déconnexion côté serveur (destruction session PHP)
    await fetch("/api/logout.php", {
      method: "POST",
      credentials: "include",
    });

    // 🔥 Déconnexion côté frontend (vider les states)
    authService.logout();
    setUser(null);
    setAppState(AppState.AUTH);
    setAnalysisResult(null);
    setSelectedTarget(null);
    setCollection({});
    setCurrentTab("map");
  };

  const handleFinish = async () => {
    if (!user) return;

    // 1) Recharge la collection AVANT de quitter RESULT
    try {
      const freshCollection = await collectionService.getUserCollection(
        user.id,
      );
      setCollection(freshCollection);
    } catch (e) {
      console.error("Erreur refresh collection:", e);
    }

    // 2) Refresh user (optionnel)
    try {
      const res = await fetch(`/api/get_user_refresh.php`, {
        credentials: "include",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (data.success && data.user) {
        const refreshed = data.user;
        setUser(refreshed);
        localStorage.setItem("toonhunter_session", JSON.stringify(refreshed));
      }
    } catch (e) {
      console.error("Erreur refresh user:", e);
    }

    // 3) Reset UI
    setSelectedTarget(null);
    setAppState(AppState.LIST);
    setErrorMessage(null);
    setIsDataReady(false);
    setCountdown(0);
  };

  const downloadImage = async (base64Data: string, fileName: string) => {
    try {
      const base64Content = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ToonHunter_${fileName.replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleShare = async () => {
    try {
      // Préparation du fichier à partager
      const response = await fetch(analysisResult!.processedImage);
      const blob = await response.blob();
      const file = new File([blob], "toonhunter.jpg", { type: "image/jpeg" });

      if (navigator.share) {
        await navigator.share({
          title: "ToonHunter",
          text: analysisResult!.quote,
          files: [file],
        });
      } else {
        alert("Le partage n'est pas supporté sur cet appareil.");
      }
    } catch (e) {
      console.error("Erreur partage:", e);
    }
  };

  const handleUnlock = async (location: LocationTarget) => {
    try {
      const res = await fetch("/api/create-checkout-session.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parc_id: location.parc_id }),
      });

      const json = await res.json();

      if (json.success && json.url) {
        window.location.href = json.url;
        return;
      }

      alert(json.message || "Erreur Stripe");
    } catch (err) {
      console.error("Erreur Stripe", err);
      alert("Erreur réseau.");
    }
  };

  // ---------------------------------------------------------
  // UI rendering
  // ---------------------------------------------------------

  if (appState === AppState.SPLASH) {
    return <SplashScreen />;
  }

  if (appState === AppState.AUTH) {
    return (
      <AuthScreen
        onLoginSuccess={(u) => {
          setUser(u);
          setAppState(AppState.LIST);
        }}
      />
    );
  }

  if (appState === AppState.ERROR) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 p-4 bg-red-500/10 rounded-full">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-black text-white mb-4">
          Les éclats de magie ont perturbé la capture !
        </h2>
        {errorMessage && (
          <>
            {errorMessage ===
            "La capture n’est possible que depuis un appareil mobile." ? (
              !isMobile && (
                <p className="text-gray-400 text-sm max-w-xs mb-12 leading-relaxed">
                  {errorMessage}
                </p>
              )
            ) : (
              <p className="text-gray-400 text-sm max-w-xs mb-12 leading-relaxed">
                {errorMessage}
              </p>
            )}
          </>
        )}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={handleFinish}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-black uppercase text-white shadow-lg active:scale-95 transition-all"
          >
            Retour au parc
          </button>
        </div>
      </div>
    );
  }

  if (!userLocation) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="fixed inset-0 flex items-center justify-center bg-[#0f0518] text-sm font-black uppercase tracking-widest text-pink-500">
          Recherche de votre position GPS…
        </div>
      </div>
    );
  }
  type FireworkProps = {
    x: string;
    y: string;
    big?: boolean;
  };

  const Firework = ({ x, y, big = false }: FireworkProps) => {
    const colors = ["#ff4fd8", "#7dd3fc", "#a855f7"]; // pink / blue / purple
    const particleCount = big ? 24 : 12;
    const distance = big ? 160 : 90;

    return (
      <>
        {Array.from({ length: particleCount }).map((_, i) => {
          const angle = (i / particleCount) * Math.PI * 2;
          const dx = Math.cos(angle) * distance + "px";
          const dy = Math.sin(angle) * distance + "px";

          return (
            <div
              key={i}
              className="fw"
              style={{
                left: x,
                top: y,
                background: colors[Math.floor(Math.random() * colors.length)],
                ["--dx" as any]: dx,
                ["--dy" as any]: dy,
              }}
            />
          );
        })}
      </>
    );
  };

  // 🔥 Écran ANALYZING simplifié : décompte + bouton
  if (appState === AppState.ANALYZING) {
    const isReadyToShow = countdown === 0 && isDataReady;

    return (
      <div className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center p-8 overflow-hidden">
        {/* Explosion synchronisée avec le décompte */}
        {countdown > 0 && (
          <Firework
            x="50%"
            y="50%"
            big={countdown === 1} // explosion plus grosse sur le 1
          />
        )}

        {/* Explosion finale massive */}
        {countdown === 0 && isDataReady && (
          <Firework x="50%" y="50%" big={true} />
        )}

        {/* Contenu */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Décompte */}
          <div className="flex flex-col items-center justify-center">
            <div
              key={countdown}
              className="text-[12rem] font-[Cinzel] font-[600] text-white/90 animate-[fadeScaleMagic_1s_ease-out] drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              {countdown > 0 ? countdown : ""}
            </div>
          </div>

          {/* Texte */}
          <div className="text-center space-y-6 max-w-sm mt-6">
            <p className="text-3xl font-display font-black text-white">
              {countdown > 0
                ? `Invocation de ${selectedTarget?.characterName}...`
                : isDataReady
                  ? "La magie est prête !"
                  : "Encore un instant..."}
            </p>
          </div>

          {/* Bouton */}
          <div
            className={`mt-16 w-full max-w-xs transition-all duration-1000 transform ${
              isReadyToShow
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-20 opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <button
              onClick={() => setAppState(AppState.RESULT)}
              className="
              w-full py-4 
              bg-gradient-to-r from-pink-500 to-purple-600 
              rounded-xl
              font-black uppercase
              text-white 
              shadow-lg 
              active:scale-95 
              transition-all
            "
            >
              Révélation
            </button>
          </div>

          {/* Loader */}
          {!isDataReady && countdown === 0 && (
            <div className="mt-12 flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-14 h-14 text-[#D4AF37]/20 animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37] animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appState === AppState.RESULT && analysisResult) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col overflow-y-auto">
        {" "}
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          {" "}
          <h2 className="text-xl font-display font-black text-white">
            {" "}
            Capture Réussie !{" "}
          </h2>{" "}
          <button
            onClick={handleFinish}
            className="p-2 bg-white/10 rounded-full text-white"
          >
            {" "}
            <X />{" "}
          </button>{" "}
        </div>{" "}
        <div className="px-6 flex-1 flex flex-col gap-4 max-w-md mx-auto w-full pb-12 pt-4">
          {" "}
          <div className="rounded-3xl overflow-hidden shadow-2xl border-2 border-pink-500/50 bg-gray-900 shine-effect">
            {" "}
            <img
              src={analysisResult.processedImage}
              className="w-full aspect-[3/4] object-cover"
              alt="Result"
            />{" "}
          </div>{" "}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-inner">
            {" "}
            <p className="text-pink-400 font-bold mb-1 uppercase text-[10px] tracking-widest">
              {" "}
              Message de {selectedTarget?.characterName}{" "}
            </p>{" "}
            <p className="text-md font-display italic text-white leading-tight">
              {" "}
              "{analysisResult.quote}"{" "}
            </p>{" "}
          </div>{" "}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                downloadImage(
                  analysisResult.processedImage,
                  selectedTarget?.characterName || "Toon",
                )
              }
              className="w-[150px] px-6 py-4 bg-white/10 border border-white/20 rounded-xl uppercase text-white shadow-lg active:scale-95 transition-all hover:bg-white/20 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5 shrink-0" />
              <span className="text-[15px] leading-none font-black tracking-wide">
                Télécharger
              </span>
            </button>

            <button
              onClick={handleShare}
              className="w-[150px] px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl uppercase text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5 shrink-0" />
              <span className="text-[15px] leading-none font-black tracking-wide">
                Partager
              </span>
            </button>
          </div>
        </div>{" "}
      </div>
    );
  }

  // 🟣 PAGE INDÉPENDANTE : accès admin refusé
  if (adminAccessDenied) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col items-center justify-center p-8 text-center">
        {/* Icône d’avertissement */}
        <div className="mb-6 p-4 bg-red-500/10 rounded-full">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>

        {/* Titre */}
        <h2 className="text-2xl font-display font-black text-white mb-4">
          Accès réservé aux administrateurs
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-sm max-w-xs mb-12 leading-relaxed">
          Les éclats de magie ne suffisent pas pour accéder à cette zone
          secrète…
        </p>

        {/* Bouton */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={async () => {
              await handleFinish();
              setAdminAccessDenied(false);
              setCurrentTab("map");
            }}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-black uppercase text-white shadow-lg active:scale-95 transition-all"
          >
            Retour au parc
          </button>
        </div>
      </div>
    );
  }

  if (!selectedParcId) {
    return (
      <ParcSelector
        onSelectParc={(id: number) => {
          localStorage.setItem("selected_parc_id", id.toString());
          setSelectedParcId(id);
        }}
      />
    );
  }

  // ---------------------------------------------------------
  // ÉCRAN CGV
  // ---------------------------------------------------------
  if (appState === AppState.CGV) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0f0518] flex flex-col overflow-y-auto">
        {/* Header CGV */}
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          <h2 className="text-xl font-display font-black text-white">
            Conditions Générales de Vente
          </h2>

          <button
            onClick={() => setAppState(AppState.LIST)}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-6 py-8 flex flex-col gap-6 max-w-2xl mx-auto text-gray-300 leading-relaxed">
          {/* --------------------------------------------------------- */}
          {/* 1. Présentation du service */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              1. Présentation du service
            </h3>
            <p>
              ToonHunter est un service numérique de création et de récupération
              de photos personnalisées, accessible via une web app mobile.
              L’utilisateur choisit un parc partenaire, se rapproche de points
              GPS définis, réalise une photo, et ToonHunter génère
              automatiquement un souvenir numérique. Les souvenirs sont
              accessibles dans une collection personnelle, avec une durée de
              conservation variable selon le parc. Ils sont téléchargeables et
              partageables sur les réseaux sociaux, directement à partir de la
              web app.
            </p>
            <p className="mt-2">
              ToonHunter est édité par :<br />
              <strong>ToonHunter</strong>
              <br />
              40 Avenue du Puy Marmant, 63670 Le Cendre
              <br />
              Email : contact@toonhunter.fr
              <br />
              Statut : Entreprise en cours de création (future SASU)
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 2. Les conditions */}
          {/* --------------------------------------------------------- */}

          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              2. Objet des présentes conditions
            </h3>
            <p>Les présentes Conditions Générales de Vente (CGV) encadrent :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>l’accès au service ToonHunter</li>
              <li>l’achat d’un accès Premium propre à chaque parc</li>
              <li>les modalités d’utilisation des photos générées</li>
              <li>les responsabilités de l’utilisateur et de ToonHunter</li>
            </ul>
            <p className="mt-2">
              En utilisant ToonHunter, l’utilisateur accepte pleinement ces
              conditions.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 3. Le fonctionnement */}
          {/* --------------------------------------------------------- */}

          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              3. Fonctionnement du service
            </h3>

            <h4 className="font-semibold text-white mt-3">
              3.1 Compte utilisateur
            </h4>
            <p>
              Pour accéder aux parcs, aux points GPS et à sa collection de
              photos, l’utilisateur doit créer un compte comprenant une adresse
              email et un mot de passe qui sera chiffré en base de données. Sans
              création de son compte, l’utilisateur n’aura pas accès à la web
              app mobile.
            </p>

            <h4 className="font-semibold text-white mt-3">
              3.2 Photos et points GPS
            </h4>
            <p>
              Chaque parc dispose d’un nombre fixe de points GPS. Une seule
              photo peut être générée par point. Les photos sont stockées en
              base64 et ne sont jamais accessibles en fichier brut. Sans
              activation de la fonctionnalité de géolocalisation GPS, la capture
              de photos est impossible. Les photos ne peuvent être générées que
              lorsque l’utilisateur se trouve à proximité immédiate du point GPS
              défini (tolérance d’environ 10 mètres).
            </p>

            <h4 className="font-semibold text-white mt-3">
              3.3 Conservation des photos
            </h4>
            <p>
              La durée de conservation des photos est de 15 jours. À expiration,
              les photos sont supprimées définitivement et automatiquement de la
              base de données. Cette suppression est définitive et irréversible.
              La durée est identique en mode gratuit et en mode Premium.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 4. Accès Premium */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              4. Accès Premium
            </h3>

            <h4 className="font-semibold text-white mt-3">4.1 Achat Premium</h4>
            <p>Le Premium est :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>spécifique à un parc</li>
              <li>payé en une seule fois</li>
              <li>non remboursable</li>
              <li>immédiatement actif après paiement</li>
            </ul>

            <p className="mt-3">Il permet :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>de débloquer davantage de points GPS</li>
              <li>de réaliser plus de photos</li>
              <li>
                d’accéder à l’ensemble des points gps souvenir du parc choisi
              </li>
            </ul>

            <h4 className="font-semibold text-white mt-4">4.2 Prix</h4>
            <p>Chaque parc partenaire fixe :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>le prix du Premium</li>
              <li>la durée d’accès</li>
              <li>le nombre total de points GPS disponibles</li>
            </ul>
            <p className="mt-2">ToonHunter ne fixe pas les tarifs.</p>

            <h4 className="font-semibold text-white mt-4">4.3 Paiement</h4>
            <p>
              Le paiement est réalisé uniquement via Stripe, en une fois. Aucun
              remboursement n’est possible, même en cas :
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>d’erreur de parc</li>
              <li>de non-utilisation du service</li>
              <li>de problème technique indépendant de ToonHunter</li>
            </ul>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 5. Responsabilités */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              5. Responsabilités
            </h3>

            <p>ToonHunter ne peut être tenu responsable en cas de :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                impossibilité de capturer une photo si l’utilisateur n’est pas
                physiquement proche du point GPS
              </li>
              <li>perte d’accès au compte par l’utilisateur</li>
              <li>
                problème technique lié au téléphone, au GPS, au réseau ou à
                l’environnement
              </li>
              <li>
                suppression automatique des photos à l’expiration de la durée
                définie par le parc
              </li>
              <li>mauvaise utilisation du service</li>
            </ul>

            <p className="mt-3">L’utilisateur est responsable :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>de la véracité de son email</li>
              <li>de la confidentialité de son mot de passe</li>
              <li>de l’usage de son compte</li>
            </ul>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 6. Données personnelles */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              6. Données personnelles
            </h3>

            <h4 className="font-semibold text-white mt-3">
              6.1 Données conservées
            </h4>
            <p>ToonHunter conserve uniquement :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>l’email de l’utilisateur</li>
              <li>son mot de passe chiffré</li>
              <li>les photos en base64</li>
              <li>les dates de création (pour la suppression automatique)</li>
            </ul>
            <p className="mt-2">
              Aucune localisation précise n’est stockée.
              <br />
              Aucune photo n’est visible directement par ToonHunter.
            </p>

            <h4 className="font-semibold text-white mt-3">
              6.2 Durée de conservation
            </h4>
            <p>
              Emails et mots de passe : 2 ans
              <br />
              Photos : 15 jours (automatiquement supprimées après expiration)
            </p>

            <h4 className="font-semibold text-white mt-3">
              6.3 Suppression du compte
            </h4>
            <p>
              L’utilisateur peut demander la suppression anticipée de son compte
              via :<br />
              📩 contact@toonhunter.fr
            </p>
            <p className="mt-2">
              La suppression sera effectuée dans un délai maximum de 15 jours.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 7. Support */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">7. Support</h3>
            <p>
              Pour toute question :<br />
              📩 contact@toonhunter.fr
            </p>
            <p className="mt-2">
              Délai de réponse indicatif : 72 heures.
              <br />
              Sans réponse, l’utilisateur est invité à renouveler sa demande.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 8. Litiges */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">8. Litiges</h3>
            <p>
              En cas de litige, le droit français s’applique.
              <br />
              Le tribunal compétent est celui du siège de ToonHunter.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 9. Acceptation */}
          {/* --------------------------------------------------------- */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              9. Acceptation
            </h3>
            <p>
              L’utilisation de ToonHunter implique l’acceptation pleine et
              entière des présentes CGV, dès lors qu’il créer un compte et qu’il
              n’en demande pas la suppression dans un délais court.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (appState === AppState.RGPD) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0f0518] flex flex-col overflow-y-auto">
        {/* Header RGPD */}
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          <h2 className="text-xl font-display font-black text-white">
            Politique de confidentialité – RGPD
          </h2>

          <button
            onClick={() => setAppState(AppState.LIST)}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-6 py-8 flex flex-col gap-6 max-w-2xl mx-auto text-gray-300 leading-relaxed">
          {/* 1. Responsable du traitement */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              1. Responsable du traitement
            </h3>
            <p>
              Le responsable du traitement des données personnelles collectées
              via la web app mobile ToonHunter est :
            </p>
            <p className="mt-2">
              <strong>
                ToonHunter – entreprise en cours de création (future SASU)
              </strong>
              <br />
              Email : contact@toonhunter.fr
            </p>
          </section>

          {/* 2. Données collectées */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              2. Données collectées
            </h3>
            <p>
              ToonHunter collecte uniquement les données nécessaires au
              fonctionnement du service :
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Adresse email</li>
              <li>Mot de passe (stocké de manière chiffrée)</li>
              <li>Pseudo</li>
              <li>
                Localisation GPS en temps réel (non stockée en base de données)
              </li>
              <li>Photos générées, stockées sous forme base64</li>
              <li>
                Adresse IP (à des fins de sécurité et de protection contre les
                intrusions)
              </li>
            </ul>
          </section>

          {/* 3. Finalités du traitement */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              3. Finalités du traitement
            </h3>
            <p>Les données sont utilisées pour les finalités suivantes :</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Gestion du compte utilisateur :</strong> création de
                compte, connexion, mot de passe oublié, envoi d’emails liés au
                compte et aux données stockées (photos, accès Premium,
                suppression de compte).
              </li>
              <li>
                <strong>Fonctionnement du jeu et de la gamification :</strong>{" "}
                la localisation GPS en temps réel permet de vérifier la
                proximité des points GPS et de déclencher l’expérience magique.
                Cette localisation n’est pas stockée en base de données.
              </li>
              <li>
                <strong>Gestion des photos :</strong> les photos sont stockées
                en base64 pour permettre à l’utilisateur de consulter, récupérer
                ou partager ses souvenirs dans sa collection, pendant une durée
                limitée.
              </li>
              <li>
                <strong>Sécurité :</strong> l’adresse IP est utilisée pour
                détecter et limiter les tentatives d’intrusion ou de
                brute-force, et préserver un environnement sécurisé.
              </li>
            </ul>
            <p className="mt-2">
              Aucune exploitation commerciale, aucun profilage marketing et
              aucun tracking externe ne sont réalisés.
            </p>
          </section>

          {/* 4. Durées de conservation */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              4. Durées de conservation
            </h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Email et mot de passe :</strong> conservés jusqu’à 2 ans
                maximum, sauf demande de suppression anticipée du compte par
                l’utilisateur.
              </li>
              <li>
                <strong>Photos en base64 :</strong> conservées pour une durée
                maximale de 15 jours, puis supprimées automatiquement et de
                manière définitive.
              </li>
              <li>
                <strong>Localisation GPS :</strong> utilisée uniquement en temps
                réel pour le gameplay, non stockée en base de données.
              </li>
              <li>
                <strong>Adresse IP :</strong> utilisée pour la sécurité
                (limitation des tentatives de connexion) et conservée uniquement
                dans ce cadre.
              </li>
            </ul>
          </section>

          {/* 5. Partage des données */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              5. Partage des données
            </h3>
            <p>
              Les données personnelles ne sont pas vendues ni transmises à des
              tiers à des fins commerciales.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Paiement :</strong> les paiements sont gérés par Stripe,
                qui traite les données de paiement de manière autonome.
                ToonHunter n’a pas accès aux numéros de carte bancaire.
              </li>
              <li>
                <strong>Hébergement :</strong> l’application et la base de
                données sont hébergées chez Hostinger (France). L’hébergeur
                assure l’infrastructure technique mais n’a pas d’accès
                administratif aux données des utilisateurs.
              </li>
              <li>
                <strong>Autres services :</strong> aucun service externe
                n’accède aux données personnelles de manière non anonymisée.
              </li>
            </ul>
          </section>

          {/* 6. Localisation des données */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              6. Localisation des données
            </h3>
            <p>
              Les données sont hébergées sur des serveurs situés en France, chez
              Hostinger. Aucune donnée n’est transférée en dehors de l’Union
              européenne.
            </p>
          </section>

          {/* 7. Droits des utilisateurs */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              7. Droits des utilisateurs
            </h3>
            <p>
              Conformément au Règlement Général sur la Protection des Données
              (RGPD), l’utilisateur dispose des droits suivants sur ses données
              personnelles :
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>droit d’accès à ses données ;</li>
              <li>
                droit de rectification (mot de passe via la fonction “mot de
                passe oublié”) ;
              </li>
              <li>
                droit de suppression de son compte et des données associées ;
              </li>
              <li>
                droit de limitation du traitement dans les cas prévus par la
                loi.
              </li>
            </ul>
            <p className="mt-2">
              ToonHunter ne réalise aucun traitement marketing, aucun profilage
              et aucune exploitation commerciale des données personnelles.
            </p>
            <p className="mt-2">
              Toute demande liée à ces droits peut être adressée à :<br />
              📩 contact@toonhunter.fr
            </p>
          </section>

          {/* 8. Cookies, session et stockage local */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              8. Cookies, session et stockage local
            </h3>
            <p>
              ToonHunter utilise uniquement des mécanismes techniques
              nécessaires au fonctionnement de la web app :
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Cookies de session PHP :</strong> utilisés pour
                maintenir la connexion de l’utilisateur et sécuriser l’accès à
                son compte.
              </li>
              <li>
                <strong>LocalStorage :</strong> utilisé de manière limitée (par
                exemple pour mémoriser le parc sélectionné). Aucune donnée
                sensible n’y est stockée.
              </li>
            </ul>
            <p className="mt-2">
              Aucun cookie publicitaire, aucun tracker externe (Google
              Analytics, Meta, etc.) n’est utilisé. Les éventuelles statistiques
              futures seront anonymisées.
            </p>
          </section>

          {/* 9. Sécurité des données */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              9. Sécurité des données
            </h3>
            <p>
              ToonHunter met en œuvre des mesures techniques et
              organisationnelles pour protéger les données personnelles :
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                mots de passe stockés de manière chiffrée et jamais renvoyés au
                client ;
              </li>
              <li>
                sessions sécurisées côté serveur pour l’accès aux
                fonctionnalités de la web app ;
              </li>
              <li>
                protection anti brute-force par adresse IP lors de la connexion
                ;
              </li>
              <li>requêtes SQL préparées pour éviter les injections ;</li>
              <li>
                photos stockées en base64 et non accessibles directement en
                fichier brut ;
              </li>
              <li>
                aucun accès prévu aux photos des utilisateurs par
                l’administrateur.
              </li>
            </ul>
          </section>

          {/* 10. Contact */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">10. Contact</h3>
            <p>
              Pour toute question relative à la protection des données
              personnelles ou à l’exercice de vos droits :
            </p>
            <p className="mt-2">📩 contact@toonhunter.fr</p>
          </section>
        </div>
      </div>
    );
  }

  if (appState === AppState.MENTIONS) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0f0518] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          <h2 className="text-xl font-display font-black text-white">
            Mentions légales
          </h2>

          <button
            onClick={() => setAppState(AppState.LIST)}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-6 py-8 flex flex-col gap-6 max-w-2xl mx-auto text-gray-300 leading-relaxed">
          {/* 1. Éditeur du site */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              1. Éditeur du site
            </h3>
            <p>
              Le présent site et web app mobile <strong>ToonHunter</strong> sont
              édités par :
            </p>
            <p className="mt-2">
              <strong>
                ToonHunter – entreprise en cours de création (future SASU)
              </strong>
              <br />
              Adresse : 40 Avenue du Puy Marmant, 63670 Le Cendre
              <br />
              Email : contact@toonhunter.fr
            </p>
            <p className="mt-2">
              L’entreprise n’étant pas encore immatriculée, les numéros SIREN /
              SIRET / TVA intracommunautaire seront ajoutés dès l’enregistrement
              officiel.
            </p>
          </section>

          {/* 2. Directeur de la publication */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              2. Directeur de la publication
            </h3>
            <p>
              Le directeur de la publication est le fondateur de ToonHunter.
            </p>
          </section>

          {/* 3. Hébergement */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              3. Hébergement
            </h3>
            <p>Le site et web app est hébergés par :</p>
            <p className="mt-2">
              <strong>Hostinger International Ltd</strong>
              <br />
              Serveurs situés en France
              <br />
              Site web : https://www.hostinger.fr
            </p>
          </section>

          {/* 4. Propriété intellectuelle */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              4. Propriété intellectuelle
            </h3>
            <p>
              L’ensemble des éléments présents sur ToonHunter (textes, images,
              logos, interface, fonctionnalités, contenus générés, structure
              technique) sont protégés par le droit d’auteur et restent la
              propriété exclusive de ToonHunter.
            </p>
            <p className="mt-2">
              Toute reproduction, modification, diffusion ou exploitation,
              totale ou partielle, sans autorisation préalable est strictement
              interdite.
            </p>
          </section>

          {/* 5. Données personnelles */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              5. Données personnelles
            </h3>
            <p>
              La gestion des données personnelles est détaillée dans la page
              dédiée :
            </p>
            <p className="mt-2">
              <strong>Politique de confidentialité – RGPD</strong>
            </p>
            <p className="mt-2">
              Conformément au RGPD, l’utilisateur peut exercer ses droits
              (accès, rectification, suppression, limitation) en contactant :
              <br />
              📩 contact@toonhunter.fr
            </p>
          </section>

          {/* 6. Responsabilité */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              6. Responsabilité
            </h3>
            <p>
              ToonHunter met tout en œuvre pour assurer l’exactitude des
              informations et le bon fonctionnement du service, mais ne peut
              garantir l’absence totale d’erreurs ou d’interruptions.
            </p>
            <p className="mt-2">
              L’utilisateur reste responsable de l’usage de son compte, de ses
              photos et de son matériel (téléphone, GPS, connexion réseau).
            </p>
          </section>

          {/* 7. Conditions d’utilisation */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">
              7. Conditions d’utilisation
            </h3>
            <p>
              L’utilisation de ToonHunter implique l’acceptation des Conditions
              Générales de Vente (CGV) et de la Politique de confidentialité.
            </p>
          </section>

          {/* 8. Contact */}
          <section>
            <h3 className="text-lg font-bold text-white mb-2">8. Contact</h3>
            <p>
              Pour toute question concernant le site et application ou les
              présentes mentions légales :
            </p>
            <p className="mt-2">📩 contact@toonhunter.fr</p>
          </section>
        </div>
      </div>
    );
  }

  if (appState === AppState.CONTACT) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0f0518] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          <h2 className="text-xl font-display font-black text-white">
            Contact
          </h2>

          <button
            onClick={() => setAppState(AppState.LIST)}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X />
          </button>
        </div>

        {/* Formulaire */}
        <div className="px-6 py-8 max-w-xl mx-auto w-full">
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              if (!subject.trim() || !message.trim()) {
                setToast("Veuillez remplir tous les champs obligatoires.");
                setTimeout(() => setToast(null), 3000);
                return;
              }

              const formData = new FormData();
              formData.append("subject", subject);
              formData.append("message", message);

              if (screenshotFile) {
                formData.append("screenshot", screenshotFile);
              }

              try {
                const response = await fetch("/api/contact.php", {
                  method: "POST",
                  credentials: "include",
                  body: formData,
                });

                const result = await response.json();

                if (!result.success) {
                  setToast(result.message || "Erreur lors de l’envoi.");
                  setTimeout(() => setToast(null), 3000);
                  return;
                }

                // 🎉 Toast premium
                setToast("Votre message a bien été envoyé !");
                setTimeout(() => {
                  setToast(null);
                  setAppState(AppState.LIST);
                }, 3000);
              } catch (error) {
                setToast("Erreur réseau.");
                setTimeout(() => setToast(null), 3000);
              }
            }}
            className="bg-black/30 border border-white/10 rounded-xl p-6 space-y-6 shadow-xl"
          >
            {/* Email prérempli */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Votre email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-gray-400 cursor-not-allowed"
              />
            </div>

            {/* Sujet */}
            <div>
              <label className="block text-sm font-medium mb-1">Sujet *</label>
              <input
                type="text"
                placeholder="Sujet de votre message"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 focus:border-white focus:outline-none transition-colors"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Message *
              </label>
              <textarea
                placeholder="Expliquez votre demande..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 focus:border-white focus:outline-none transition-colors"
              />
            </div>

            {/* Upload capture d’écran */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Joindre une capture d’écran (optionnel)
              </label>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScreenshotFile(file);
                    setScreenshotPreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-white transition-colors relative overflow-hidden"
              >
                {screenshotPreview ? (
                  <img
                    src={screenshotPreview}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-xs text-gray-400">
                      Cliquez pour ajouter une image
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bouton envoyer */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-orange-500 rounded-xl font-black text-white hover:opacity-90 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Envoyer le message
            </button>
          </form>
        </div>

        {/* ⭐ Toast global */}
        {toast && (
          <div
            className="
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              bg-emerald-500/20 backdrop-blur-xl
              text-emerald-300 px-6 py-4 rounded-xl
              shadow-[0_0_20px_rgba(16,185,129,0.4)]
              border border-emerald-500/30
              animate-fade-in z-[9999] font-bold
            "
          >
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 🔥 Bouton d’installation PWA */}
      <InstallPwaPrompt />
      <div className="min-h-screen bg-[#0f0518] text-white overflow-x-hidden font-nunito">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-20 -right-20 w-96 h-96 bg-pink-600/10 rounded-full blur-[120px]"></div>
        </div>

        <input
          id="native-capture"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleNativeCapture}
        />

        <header className="sticky top-0 z-30 bg-[#0f0518]/80 backdrop-blur-xl border-b border-white/10 p-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <h1 className="text-2xl font-display font-black tracking-tight text-white">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
                TOON
              </span>
              HUNTER
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentTab("map")}
                className={`p-2.5 rounded-xl transition-all ${
                  currentTab === "map"
                    ? "bg-white/10 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Map className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentTab("collection")}
                className={`p-2.5 rounded-xl transition-all ${
                  currentTab === "collection"
                    ? "bg-white/10 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Trophy className="w-5 h-5" />
              </button>

              {user?.role === "admin" && (
                <button
                  onClick={async () => {
                    // Vérification en BDD AVANT d’ouvrir le panel admin
                    const res = await fetch(
                      `/api/get_user_refresh.php?userId=${user.id}`,
                      {
                        credentials: "include",
                      },
                    );

                    if (res.status === 401) {
                      window.location.href = "/login";
                      return;
                    }

                    const data = await res.json();

                    if (!data.success || data.user.role !== "admin") {
                      // ❌ Pas admin en BDD → page intermédiaire
                      setAdminAccessDenied(true);
                      return;
                    }

                    // ✔ Admin réel → accès autorisé
                    setCurrentTab("admin");
                  }}
                  className={`p-2.5 rounded-xl transition-all ${
                    currentTab === "admin"
                      ? "bg-white/10 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.3)]"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Lock className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={handleLogout}
                className="p-2.5 text-gray-500 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6 pb-24 relative z-10">
          {currentTab === "map" && (
            <div className="space-y-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-display font-black text-white">
                  Exploration
                </h2>
                <p className="text-gray-400 text-sm">
                  Découvrez les Toons cachés autour de vous...
                </p>
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem("selected_parc_id");
                  window.location.reload();
                }}
                className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCcw className="w-4 h-4" /> Où changer de parc.
              </button>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                      <Navigation2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      Signal GPS
                    </p>
                    <p className="text-sm font-bold text-white">
                      Position Active
                    </p>
                  </div>
                </div>

                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-0.5">
                      Rayon Scan
                    </p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <CircleDot className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-sm font-bold text-white">50m</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-0.5">
                      Toons proches
                    </p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Radar className="w-3.5 h-3.5 text-pink-500" />
                      <span className="text-sm font-bold text-white">
                        {nearbyCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedLocations.map((loc) => (
                  <LocationCard
                    key={loc.id}
                    location={loc}
                    userCoords={userLocation}
                    isCollected={!!collection[loc.id]}
                    hasAccess={loc.hasAccess ?? false}
                    onUnlock={handleUnlock}
                    onSelect={(t) => {
                      if (collection[t.id]) {
                        setCurrentTab("collection");
                        return;
                      }

                      // 👉 Détection mobile
                      const isMobile = /Android|iPhone|iPad|iPod/i.test(
                        navigator.userAgent,
                      );

                      if (!isMobile) {
                        setErrorMessage(
                          "La capture n’est possible que depuis un appareil mobile.",
                        );
                        setAppState(AppState.ERROR);
                        return;
                      }

                      // 👉 Flux mobile normal
                      setSelectedTarget(t);
                      document.getElementById("native-capture")?.click();
                    }}
                  />
                ))}
              </div>

              {/* 🌐 Liens légaux */}
              <div className="mt-10 grid grid-cols-2 gap-3 text-center">
                {/* CGV */}
                <button
                  onClick={() => setAppState(AppState.CGV)}
                  className="py-3 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg text-sm font-bold text-blue-300 transition-colors w-full"
                >
                  CGV
                </button>

                {/* RGPD */}
                <button
                  onClick={() => setAppState(AppState.RGPD)}
                  className="py-3 bg-pink-600/20 hover:bg-pink-600/40 border border-pink-500/30 rounded-lg text-sm font-bold text-pink-300 transition-colors w-full"
                >
                  RGPD
                </button>

                {/* Mentions légales */}
                <button
                  onClick={() => setAppState(AppState.MENTIONS)}
                  className="py-3 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 rounded-lg text-sm font-bold text-emerald-300 transition-colors w-full"
                >
                  Mentions légales
                </button>

                {/* Contact */}
                <button
                  onClick={() => setAppState(AppState.CONTACT)}
                  className="py-3 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 rounded-lg text-sm font-bold text-amber-300 transition-colors w-full"
                >
                  Contact
                </button>
              </div>
            </div>
          )}

          {currentTab === "collection" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-display font-black text-white">
                Trophées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredLocations.map((loc) => {
                  const item = collection[loc.id];
                  const isFound = !!item;
                  const rarityColor =
                    loc.rarity === "Légendaire"
                      ? "text-amber-400"
                      : loc.rarity === "Rare"
                        ? "text-purple-400"
                        : "text-blue-400";

                  return (
                    <div
                      key={loc.id}
                      className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                        isFound
                          ? "border-emerald-500/50 bg-gray-900 shadow-xl"
                          : "border-white/5 bg-white/5 grayscale opacity-50 hover:opacity-80"
                      }`}
                    >
                      <div className="h-48 w-full relative">
                        <img
                          src={
                            isFound
                              ? `data:image/jpeg;base64,${item.photoUrl}`
                              : loc.imageUrl
                          }
                          alt={loc.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                        {!isFound && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-100 pointer-events-none">
                            <CircleHelp className="w-10 h-10 text-purple-300 mb-2 drop-shadow-[0_0_14px_rgba(220,150,255,0.9)] animate-pulse" />
                            <span className="text-[12px] font-black uppercase tracking-widest text-purple-200 drop-shadow-[0_0_10px_rgba(220,150,255,0.8)] animate-pulse">
                              À découvrir
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-black font-display text-white">
                            {loc.characterName}
                          </h3>
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest ${rarityColor}`}
                          >
                            {loc.rarity}
                          </span>
                        </div>
                        {isFound ? (
                          <div className="space-y-3">
                            <p className="text-sm italic text-emerald-400 leading-tight">
                              "{item.quote}"
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  setShowViewer({
                                    isOpen: true,
                                    item,
                                    target: loc,
                                  })
                                }
                                className="flex-1 py-2 bg-white/10 text-white text-[10px] font-black uppercase rounded-xl border border-white/10 hover:bg-white/20 transition-colors"
                              >
                                Détails
                              </button>
                              <button
                                onClick={() =>
                                  downloadImage(
                                    item.photoUrl,
                                    loc.characterName,
                                  )
                                }
                                className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Destination : {loc.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentTab === "admin" && user?.role === "admin" && (
            <AdminPanel
              selectedParcId={selectedParcId}
              userLocation={userLocation}
              locations={allLocations}
              onAddLocation={async (l) => {
                const created = await locationService.create(l);

                // 🔁 maj liste globale admin
                setAllLocations((prev) => [...prev, created]);

                // 🔁 si le point appartient au parc sélectionné → on l’ajoute aussi à locations (map/collection)
                if (created.parc_id === selectedParcId) {
                  setLocations((prev) => [...prev, created]);
                }
              }}
              onUpdateLocation={async (l) => {
                await locationService.update(l);

                // 🔁 maj liste globale admin
                setAllLocations((prev) =>
                  prev.map((loc) => (loc.id === l.id ? { ...loc, ...l } : loc)),
                );

                // 🔁 maj liste filtrée (map/collection)
                setLocations((prev) => {
                  // si la location mise à jour appartient au parc sélectionné
                  if (l.parc_id === selectedParcId) {
                    return prev.map((loc) =>
                      loc.id === l.id ? { ...loc, ...l } : loc,
                    );
                  }
                  // sinon, on la retire de la liste filtrée
                  return prev.filter((loc) => loc.id !== l.id);
                });
              }}
              onDeleteLocation={async (id) => {
                await locationService.delete(Number(id), Number(user.id));

                // 🔁 maj liste globale admin
                setAllLocations((prev) => prev.filter((x) => x.id !== id));

                // 🔁 maj liste filtrée (map/collection)
                setLocations((prev) => prev.filter((x) => x.id !== id));
              }}
              onClose={() => setCurrentTab("map")}
              userId={user.id}
            />
          )}
        </main>

        {showViewer.isOpen && showViewer.item && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col overflow-y-auto">
            <div className="p-6 flex justify-between items-center bg-black/50 border-b border-white/10">
              <h3 className="font-display font-black text-xl text-white">
                {showViewer.target?.characterName}
              </h3>
              <button
                onClick={() => setShowViewer({ isOpen: false })}
                className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center p-6 gap-6">
              <img
                src={`data:image/jpeg;base64,${showViewer.item.photoUrl}`}
                className="max-w-full max-h-[70vh] rounded-3xl shadow-2xl border border-white/20 object-contain"
                alt="Full"
              />
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl max-w-md w-full text-center shadow-2xl">
                <p className="text-pink-400 text-[10px] font-black uppercase tracking-widest mb-2">
                  Réplique magique
                </p>
                <p className="text-lg font-display italic text-white leading-tight">
                  "{showViewer.item.quote}"
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() =>
                  downloadImage(
                    showViewer.item!.photoUrl,
                    showViewer.target?.characterName || "Toon",
                  )
                }
                className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-xl uppercase text-white shadow-lg active:scale-95 transition-all hover:bg-white/20 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span className="text-[15px] leading-none font-black tracking-wide">
                  Télécharger
                </span>
              </button>

              <button
                onClick={handleShare}
                className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl uppercase text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5 shrink-0" />
                <span className="text-[15px] leading-none font-black tracking-wide">
                  Partager
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
