import React, { useState, useEffect } from "react";
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
  RefreshCcw,
} from "lucide-react";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locations, setLocations] = useState<LocationTarget[]>([]);
  const [allLocations, setAllLocations] = useState<LocationTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<LocationTarget | null>(
    null,
  );
  const [appState, setAppState] = useState<AppState>(AppState.SPLASH);
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
  const [countdown, setCountdown] = useState(10);
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
    setCountdown(10);
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
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  // ---------------------------------------------------------
  // Chargement des données du parc
  // ---------------------------------------------------------
  // useEffect(() => {
  //   if (appState === AppState.LIST && user) {
  //     const loadData = async () => {
  //       try {
  //         const [locs, col] = await Promise.all([
  //           locationService.getAll(selectedParcId ?? undefined),
  //           collectionService.getUserCollection(user.id),
  //         ]);
  //         setLocations(locs);
  //         setCollection(col);
  //       } catch (e) {
  //         console.error("Load error:", e);
  //       }
  //     };
  //     loadData();
  //   }
  // }, [appState]);
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

  useEffect(() => {
    if (!selectedParcId) return;

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
      const currentUser = authService.getCurrentUser();
      setAppState(currentUser ? AppState.LIST : AppState.AUTH);
    }, 3500);

    return () => clearTimeout(timer);
  }, []); // 🔥 dépendances VIDES

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
      const res = await fetch(`/api/get_user_refresh.php`);
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

  return (
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
                  );
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
                      {locations.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredLocations.map((loc) => (
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
                                downloadImage(item.photoUrl, loc.characterName)
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
  );
};

export default App;
